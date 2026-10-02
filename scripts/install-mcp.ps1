#Requires -Version 5.1
<#
.SYNOPSIS
    一键安装 Claude Desktop + 配置快门 MCP 服务器
.DESCRIPTION
    自动完成：安装 Claude Desktop（如未装）→ 写入 MCP 配置 → 提示重启
    运行后 AI 助手即可通过 MCP 查看并操作你的思源/小驴生态数据
.EXAMPLE
    .\install-mcp.ps1 -SiYuanToken "你的令牌"
    .\install-mcp.ps1 -SiYuanToken "你的令牌" -EnableWrite
#>
param(
    [Parameter(Mandatory)][string]$SiYuanToken,
    [switch]$EnableWrite,
    [string]$QuickGatePath = "D:\AI\Codex\siyuan-quickgate"
)

$ErrorActionPreference = "Stop"
$configDir = "$env:APPDATA\Claude"
$configFile = "$configDir\claude_desktop_config.json"

Write-Host "=== 快门 MCP 一键安装 ===" -ForegroundColor Cyan

# 1. 确认快门已构建
$mcpJs = "$QuickGatePath\dist-mcp\mcp-quickgate.js"
if (-not (Test-Path $mcpJs)) {
    Write-Host "  dist-mcp/mcp-quickgate.js 不存在，运行 build:mcp..." -ForegroundColor Yellow
    Push-Location $QuickGatePath
    npm run build:mcp
    Pop-Location
}
if (-not (Test-Path $mcpJs)) {
    Write-Error "构建失败：$mcpJs 仍不存在"; exit 1
}
Write-Host "  ✓ MCP 服务器文件确认" -ForegroundColor Green

# 2. 检查/安装 Claude Desktop
$claudeExe = "$env:LOCALAPPDATA\AnthropicClaude\claude.exe"
if (-not (Test-Path $claudeExe)) {
    Write-Host "  Claude Desktop 未安装，通过 winget 安装..." -ForegroundColor Yellow
    winget install Anthropic.Claude --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  winget 安装失败，请手动从 https://claude.ai/download 下载安装" -ForegroundColor Red
        Write-Host "  安装后重新运行此脚本以完成 MCP 配置" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "  ✓ Claude Desktop 已安装" -ForegroundColor Green
} else {
    Write-Host "  ✓ Claude Desktop 已安装" -ForegroundColor Green
}

# 3. 写入 MCP 配置（合并已有配置）
New-Item -ItemType Directory -Path $configDir -Force | Out-Null
$config = @{}
if (Test-Path $configFile) {
    try { $config = Get-Content $configFile -Raw | ConvertFrom-Json -AsHashtable } catch { $config = @{} }
}
if (-not $config.ContainsKey("mcpServers")) { $config["mcpServers"] = @{} }

$env2 = @{ "SIYUAN_TOKEN" = $SiYuanToken }
if ($EnableWrite) { $env2["LV_MCP_WRITE"] = "1" }
$config["mcpServers"]["lv-quickgate"] = @{
    command = "node"
    args = @(($mcpJs -replace '\\', '/'))
    env = $env2
}

$json = $config | ConvertTo-Json -Depth 10
Set-Content -Path $configFile -Value $json -Encoding UTF8
Write-Host "  ✓ MCP 配置已写入 $configFile" -ForegroundColor Green
Write-Host "  ✓ 工具数: $(if ($EnableWrite) { 23 } else { 13 }) 个（$(if ($EnableWrite) { '读写' } else { '只读' })）" -ForegroundColor Green

# 4. 完成
Write-Host ""
Write-Host "=== 安装完成 ===" -ForegroundColor Cyan
Write-Host "  重启 Claude Desktop 后，AI 助手即可查看你的思源数据"
Write-Host "  试试对 Claude 说：帮我看看今天的日记写了没有"
if (-not $EnableWrite) {
    Write-Host ""
    Write-Host "  要启用写入（打卡/人脉），重新运行加 -EnableWrite" -ForegroundColor Yellow
}
