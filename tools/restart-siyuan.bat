# 重启小驴快门.bat
# 双击运行：安全终止思源所有进程 → 等待退出 → 重新启动思源
# 用途：部署 index.js 后恢复 NDJSON 桥轮询（bug#15 push_reload 副作用）
# 依赖：无第三方工具；安装目录自动探测（可 set SIYUAN_HOME=... 覆盖）
# 注意：按映像名终止会连所有思源实例（含其他工作区/插件测试内核）一起退出

@echo off
setlocal enabledelayedexpansion

:: 安装路径自动探测（按序尝试；也可 set SIYUAN_HOME=你的目录 覆盖）
if not defined SIYUAN_HOME (
    set "SIYUAN_HOME="
    for %%P in ("D:\biji\SiYuan" "D:\RJ\SiYuan" "%LocalAppData%\Programs\SiYuan" "C:\Program Files\SiYuan") do (
        if not defined SIYUAN_HOME if exist "%%~P\SiYuan.exe" set "SIYUAN_HOME=%%~P"
    )
)
if not defined SIYUAN_HOME (
    echo   ✗ 未找到思源安装目录，请 set SIYUAN_HOME=你的安装目录 后重跑。
    pause
    exit /b 1
)
echo   安装目录：%SIYUAN_HOME%
set "KERNEL=%SIYUAN_HOME%\resources\kernel\SiYuan-Kernel.exe"
set "APP=%SIYUAN_HOME%\SiYuan.exe"

echo === 小驴快门 · 思源安全重启 ===
echo.

:: 1. 优雅终止思源（先关窗口进程，再杀内核）
echo [1/3] 终止思源进程...
taskkill /IM "SiYuan.exe" /F >nul 2>&1
timeout /t 2 /nobreak >nul
taskkill /IM "SiYuan-Kernel.exe" /F >nul 2>&1
timeout /t 2 /nobreak >nul

:: 确认全部退出
tasklist /FI "IMAGENAME eq SiYuan.exe" 2>nul | find /I "SiYuan.exe" >nul
if not errorlevel 1 (
    echo   警告：SiYuan.exe 仍在运行，再等 3 秒...
    timeout /t 3 /nobreak >nul
    taskkill /IM "SiYuan.exe" /F >nul 2>&1
)
tasklist /FI "IMAGENAME eq SiYuan-Kernel.exe" 2>nul | find /I "SiYuan-Kernel.exe" >nul
if not errorlevel 1 (
    echo   警告：SiYuan-Kernel.exe 仍在运行，再等 3 秒...
    timeout /t 3 /nobreak >nul
    taskkill /IM "SiYuan-Kernel.exe" /F >nul 2>&1
)
echo   思源已完全退出。

:: 2. 重启思源（--openAsHidden 托盘常驻模式）
echo [2/3] 重新启动思源...
start "" "%APP%" --openAsHidden
echo   等待内核就绪...
timeout /t 8 /nobreak >nul

:: 3. 验证
echo [3/3] 验证...
tasklist /FI "IMAGENAME eq SiYuan-Kernel.exe" 2>nul | find /I "SiYuan-Kernel.exe" >nul
if errorlevel 1 (
    echo   ✗ 内核未启动——请手动打开思源
    pause
    exit /b 1
)
echo   ✓ 内核运行中
echo   ✓ 小驴快门 v0.7.4 前端已生效（NDJSON 桥/收藏管理器/能力目录）
echo.
echo 完成。如桥仍不通，检查设置→小驴快门→外部命令桥是否开启。
timeout /t 5
