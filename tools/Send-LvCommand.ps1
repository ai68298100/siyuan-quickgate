# 小驴快门桥客户端（PowerShell，无第三方依赖）
# 用法：
#   $env:SIYUAN_URL = "http://127.0.0.1:1568"; $env:SIYUAN_TOKEN = "<token>"
#   .\Send-LvCommand.ps1 -Op bridge.ping
#   .\Send-LvCommand.ps1 -Op checkin.record -ArgsJson '{"itemId":"...","value":1}' -WaitMs 8000
#   .\Send-LvCommand.ps1 -Op commands.run -ArgsJson '{"plugin":"siyuan-checkin","command":"<命令>"}' -WaitMs 35000
param(
    [Parameter(Mandatory = $true)][string]$Op,
    [string]$ArgsJson = "{}",
    [string]$Plugin = "siyuan-quickgate",
    [int]$WaitMs = 8000,
    [string]$BaseUrl = $(if ($env:SIYUAN_URL) { $env:SIYUAN_URL } else { "http://127.0.0.1:1568" }),
    [string]$Token = $(if ($env:SIYUAN_TOKEN) { $env:SIYUAN_TOKEN } else { throw "请设置 SIYUAN_TOKEN 环境变量" })
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd("/")

function Invoke-KernelPost([string]$Endpoint, [object]$Payload) {
    $json = $Payload | ConvertTo-Json -Depth 10 -Compress
    return Invoke-RestMethod -Method Post -Uri "$BaseUrl$Endpoint" -Headers @{ Authorization = "Token $Token" } -ContentType "application/json" -Body $json
}

function Send-LvCommand {
    param([string]$TargetPlugin, [string]$Op, [string]$Args, [int]$TtlMs = 60000)
    $id = "ps-{0}-{1}" -f (Get-Date -Format "yyyyMMdd-HHmmss"), ("{0:x4}" -f (Get-Random -Maximum 65535))
    $envelope = @{ v = 1; id = $id; op = $Op; args = ($Args | ConvertFrom-Json); createdAt = (Get-Date).ToString("o"); ttlMs = $TtlMs } | ConvertTo-Json -Depth 10 -Compress
    $path = "/storage/petal/$TargetPlugin/bridge/commands.ndjson"
    $old = ""
    try { $old = Invoke-KernelPost "/api/file/getFile" @{ path = $path } } catch { $old = "" }
    $merged = ($old -replace "`r", "" -replace "`n+$", "") + "`n" + $envelope
    # putFile 为 multipart：用 -Form（PowerShell 7+）
    $form = @{ path = $path; isDir = "false"; file = $merged }
    Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/file/putFile" -Headers @{ Authorization = "Token $Token" } -Form $form | Out-Null
    return $id
}

function Wait-LvReceipt {
    param([string]$TargetPlugin, [string]$Id, [int]$MaxMs)
    $path = "/storage/petal/$TargetPlugin/bridge/results.ndjson"
    $deadline = [DateTime]::UtcNow.AddMilliseconds($MaxMs)
    while ([DateTime]::UtcNow -lt $deadline) {
        try {
            $text = Invoke-KernelPost "/api/file/getFile" @{ path = $path }
            foreach ($line in ($text -split "`n")) {
                $t = $line.Trim()
                if (-not $t) { continue }
                try {
                    $obj = $t | ConvertFrom-Json
                    if ($obj.id -eq $Id) { return $obj }
                } catch { }
            }
        } catch { }
        Start-Sleep -Milliseconds 300
    }
    return [pscustomobject]@{ id = $Id; status = "timeout"; message = "等待 $MaxMs ms 未收到回执" }
}

$id = Send-LvCommand -TargetPlugin $Plugin -Op $Op -Args $ArgsJson
[pscustomobject]@{ id = $id; sent = $true; plugin = $Plugin; op = $Op } | ConvertTo-Json -Compress
$receipt = Wait-LvReceipt -TargetPlugin $Plugin -Id $id -MaxMs $WaitMs
$receipt | ConvertTo-Json -Depth 6 -Compress
