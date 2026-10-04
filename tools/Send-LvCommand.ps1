# 小驴快门桥客户端（PowerShell，无第三方依赖）
# 用法：
#   $env:SIYUAN_URL = "http://127.0.0.1:6806"; $env:SIYUAN_TOKEN = "<token>"
#   .\Send-LvCommand.ps1 -Op bridge.ping
#   .\Send-LvCommand.ps1 -Op checkin.record -ArgsJson '{"itemId":"...","value":1}' -WaitMs 8000
#   .\Send-LvCommand.ps1 -Op commands.run -ArgsJson '{"plugin":"siyuan-checkin","command":"<命令>"}' -WaitMs 35000
#   .\Send-LvCommand.ps1 -Op bridge.ping -Exec        # 内核同步路由直呼（不经桥文件，spike⑩ 校准用）
#   .\Send-LvCommand.ps1 -Op bridge.ping -Fast        # v1.5 广播快路径（postMessage 推 qg-cmd 频道，毫秒级；回执仍读 results.ndjson）
param(
    [Parameter(Mandatory = $true)][string]$Op,
    [string]$ArgsJson = "{}",
    [string]$Plugin = "siyuan-quickgate",
    [int]$WaitMs = 8000,
    [switch]$Exec,
    [switch]$Fast,
    [string]$Channel = "qg-cmd",
    [string]$BaseUrl = $(if ($env:SIYUAN_URL) { $env:SIYUAN_URL } else { "http://127.0.0.1:6806" }),
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
    # id 承载幂等语义（processed 台账按键去重）——GUID 段杜绝同秒碰撞
    $id = "ps-{0}-{1}" -f (Get-Date -Format "yyyyMMdd-HHmmss"), ([guid]::NewGuid().ToString("N").Substring(0, 8))
    $envelope = @{ v = 1; id = $id; op = $Op; args = ($Args | ConvertFrom-Json); createdAt = (Get-Date).ToString("o"); ttlMs = $TtlMs } | ConvertTo-Json -Depth 10 -Compress
    $path = "/storage/petal/$TargetPlugin/bridge/commands.ndjson"
    # L453：多生产者 read-modify-write 并发会互相覆盖（实测 4 写者丢 66/100）——
    # 写后读回校验本行仍在，丢失则基于最新内容重试 ≤5 次（残窗=最后一次写竞态；高并发建议广播通道）
    for ($attempt = 0; $attempt -lt 5; $attempt++) {
        $old = ""
        try { $old = Invoke-KernelPost "/api/file/getFile" @{ path = $path } } catch { $old = "" }
        $merged = ($old -replace "`r", "" -replace "`n+$", "")
        if ($merged) { $merged = $merged + "`n" }
        $merged = $merged + $envelope
        # putFile 为 multipart：用 -Form（PowerShell 7+）
        $form = @{ path = $path; isDir = "false"; file = $merged }
        Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/file/putFile" -Headers @{ Authorization = "Token $Token" } -Form $form | Out-Null
        $back = ""
        try { $back = Invoke-KernelPost "/api/file/getFile" @{ path = $path } } catch { $back = "" }
        if ($back -match [regex]::Escape("`"id`":`"$id`""))) { return $id }
        Start-Sleep -Milliseconds (60 + (Get-Random -Maximum 120))
    }
    throw "追加重试 5 次仍未持久化（多写者竞争过于激烈）"
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

if ($Exec) {
    # 内核同步路由：POST /plugin/private/<plugin>/exec，同步返回回执（不经桥文件）
    $resp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/plugin/private/$Plugin/exec" -Headers @{ Authorization = "Token $Token" } -ContentType "application/json" -Body (@{ op = $Op; args = ($ArgsJson | ConvertFrom-Json) } | ConvertTo-Json -Depth 10 -Compress)
    $resp | ConvertTo-Json -Depth 10 -Compress
    exit 0
}

if ($Fast) {
    # v1.5 广播快路径：postMessage 推信封到频道（默认 qg-cmd），插件 SSE 订阅毫秒级执行；
    # 回执仍写 results.ndjson——复用 Wait-LvReceipt 并算端到端耗时
    $id = "ps-{0}-{1}" -f (Get-Date -Format "yyyyMMdd-HHmmss"), ("{0:x4}" -f (Get-Random -Maximum 65535))
    $envelope = @{ v = 1; id = $id; op = $Op; args = ($ArgsJson | ConvertFrom-Json); createdAt = (Get-Date).ToString("o") } | ConvertTo-Json -Depth 10 -Compress
    $t0 = [DateTime]::UtcNow
    Invoke-KernelPost "/api/broadcast/postMessage" @{ channel = $Channel; message = $envelope } | Out-Null
    [pscustomobject]@{ id = $id; via = "broadcast"; channel = $Channel; postMs = [int]([DateTime]::UtcNow - $t0).TotalMilliseconds } | ConvertTo-Json -Compress
    $receipt = Wait-LvReceipt -TargetPlugin $Plugin -Id $id -MaxMs $WaitMs
    if ($receipt.status -ne "timeout") {
        $receipt | Add-Member -NotePropertyName e2eMs -NotePropertyValue ([int]([DateTime]::UtcNow - $t0).TotalMilliseconds)
    }
    $receipt | ConvertTo-Json -Depth 6 -Compress
    exit 0
}

$id = Send-LvCommand -TargetPlugin $Plugin -Op $Op -Args $ArgsJson
[pscustomobject]@{ id = $id; sent = $true; plugin = $Plugin; op = $Op } | ConvertTo-Json -Compress
$receipt = Wait-LvReceipt -TargetPlugin $Plugin -Id $id -MaxMs $WaitMs
$receipt | ConvertTo-Json -Depth 6 -Compress
