<#
.SYNOPSIS
清理 HBuilderV 遗留的无线 ADB 设备等待进程。
.DESCRIPTION
仅处理 HBuilderV 扩展目录中、等待无线设备的 adb.exe；保留 ADB 服务、
USB 等待任务和其他工具的 ADB。无法判断等待是否仍有用途，运行时应先关闭设备连接窗口。
支持 -WhatIf 预览和 -ConfirmOnce 单次确认。进程已自行退出时忽略，权限不足等错误则明确报错。
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    # 双击入口先列出全部 PID，再确认一次，避免逐个进程反复确认。
    [switch]$ConfirmOnce
)

$ErrorActionPreference = 'Stop'
# 同时核对程序路径和完整命令参数，防止只按 adb 名称误杀调试服务。
$waitingProcesses = @(Get-CimInstance Win32_Process -Filter "Name='adb.exe'" | Where-Object {
    $_.ExecutablePath -match '(?i)[\\/]\.hbuilderv[^\\/]*[\\/]extensions[\\/]' -and
    $_.CommandLine -match '(?i)(?:^|\s)wait-for-device(?:\s|$)' -and
    $_.CommandLine -match '(?i)(?:^|\s)-s\s+"?adb-[^\s"]+\._adb-tls-connect\._tcp(?::\d+)?"?(?:\s|$)'
})

if ($waitingProcesses.Count -eq 0) {
    Write-Output '本次匹配到的无线等待进程：0'
    return
}

$processIds = @($waitingProcesses | ForEach-Object { $_.ProcessId })
Write-Output "匹配到的无线等待进程 PID：$($processIds -join ', ')"

# 中文名双击入口使用自定义单次确认，避免内层 Stop-Process 再触发逐项确认。
if ($ConfirmOnce) {
    $answer = Read-Host '确认结束以上全部无线等待进程？输入 Y 确认，其他输入取消'
    if (-not [string]::Equals($answer, 'Y', [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Output '已取消清理。'
        return
    }
}

# 将确认放在遍历外：传入 -Confirm 时只询问一次，再按已确认的 PID 批量处理。
if ($PSCmdlet.ShouldProcess("上述 $($waitingProcesses.Count) 个 HBuilderV 无线等待进程", '一次性结束')) {
    foreach ($waitingProcess in $waitingProcesses) {
        # 进程可能在枚举后退出；退出竞争可忽略，权限不足等其他失败仍会明确报错。
        $liveProcess = Get-Process -Id $waitingProcess.ProcessId -ErrorAction SilentlyContinue
        if ($liveProcess) {
            # 外层已统一确认；关闭 Stop-Process 自身的确认，避免每个 PID 再重复询问。
            $liveProcess | Stop-Process -Force -Confirm:$false
            Write-Output "已结束无线等待进程：$($waitingProcess.ProcessId)"
        }
    }
}
Write-Output "本次匹配到的无线等待进程：$($waitingProcesses.Count)"
