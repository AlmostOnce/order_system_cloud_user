# 使用模拟进程核验筛选边界，不接触真实 ADB 或手机连接。
$ErrorActionPreference = 'Stop'
$global:androidWaitStopped = @()
function Get-CimInstance {
    param($ClassName, $Filter)
    $extensionAdb = 'C:\Users\Test\.hbuilderv-alpha\extensions\launcher\adb.exe'
    @(
        [pscustomobject]@{ ProcessId = 1; ExecutablePath = $extensionAdb; CommandLine = 'adb -s adb-phone-token._adb-tls-connect._tcp:5555 wait-for-device' }
        [pscustomobject]@{ ProcessId = 2; ExecutablePath = $extensionAdb; CommandLine = 'adb -s adb-phone-token._adb-tls-connect._tcp wait-for-device' }
        [pscustomobject]@{ ProcessId = 3; ExecutablePath = $extensionAdb; CommandLine = 'adb -L tcp:5037 fork-server server' }
        [pscustomobject]@{ ProcessId = 4; ExecutablePath = $extensionAdb; CommandLine = 'adb -s USB123 wait-for-device' }
        [pscustomobject]@{ ProcessId = 5; ExecutablePath = 'C:\Android\adb.exe'; CommandLine = 'adb -s adb-phone-token._adb-tls-connect._tcp wait-for-device' }
        [pscustomobject]@{ ProcessId = 6; ExecutablePath = $null; CommandLine = 'adb -s adb-phone-token._adb-tls-connect._tcp wait-for-device' }
    )
}
# 模拟查询和终止操作，只记录脚本实际选中的 PID。
function Get-Process { param($Id) [pscustomobject]@{ Id = $Id } }
function Stop-Process {
    param([Parameter(ValueFromPipeline)]$InputObject, [switch]$Force)
    process { $global:androidWaitStopped += $InputObject.Id }
}
& "$PSScriptRoot/stop-android-waits.ps1" -WhatIf
if ($global:androidWaitStopped.Count -ne 0) { throw '预览模式不应结束任何进程。' }
& "$PSScriptRoot/stop-android-waits.ps1"
if (($global:androidWaitStopped -join ',') -ne '1,2') { throw '无线等待筛选错误，或误伤了服务、USB 或其他工具。' }
Write-Output 'PASS：带端口和不带端口的无线等待均可清理，服务、USB、其他工具及预览模式均受保护。'
