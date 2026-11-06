<#
.SYNOPSIS
清理 HBuilderV 遗留的无线 ADB 设备等待进程。
.DESCRIPTION
仅处理 HBuilderV 扩展目录中、等待无线设备的 adb.exe；保留 ADB 服务、
USB 等待任务和其他工具的 ADB。无法判断等待是否仍有用途，运行时应先关闭设备连接窗口。
支持 -WhatIf 预览。进程已自行退出时忽略，权限不足等错误则明确报错。
#>
[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = 'Stop'
# 同时核对程序路径和完整命令参数，防止只按 adb 名称误杀调试服务。
$waitingProcesses = @(Get-CimInstance Win32_Process -Filter "Name='adb.exe'" | Where-Object {
    $_.ExecutablePath -match '(?i)[\\/]\.hbuilderv[^\\/]*[\\/]extensions[\\/]' -and
    $_.CommandLine -match '(?i)(?:^|\s)wait-for-device(?:\s|$)' -and
    $_.CommandLine -match '(?i)(?:^|\s)-s\s+"?adb-[^\s"]+\._adb-tls-connect\._tcp(?::\d+)?"?(?:\s|$)'
})

foreach ($waitingProcess in $waitingProcesses) {
    if ($PSCmdlet.ShouldProcess("ADB PID $($waitingProcess.ProcessId)", '结束无线设备等待')) {
        # 进程可能在枚举后退出；重新取得进程对象，退出竞争可忽略，其他失败不得假报成功。
        $liveProcess = Get-Process -Id $waitingProcess.ProcessId -ErrorAction SilentlyContinue
        if ($liveProcess) {
            $liveProcess | Stop-Process -Force
            Write-Output "已结束无线等待进程：$($waitingProcess.ProcessId)"
        }
    }
}
Write-Output "本次匹配到的无线等待进程：$($waitingProcesses.Count)"
