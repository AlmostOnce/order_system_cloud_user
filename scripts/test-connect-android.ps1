$ErrorActionPreference = 'Stop'
$global:androidTestCalls = @()
$global:androidTestDevices = @('List of devices attached', '192.168.1.10:12345 device model:Test', '192.168.1.9:11111 offline')
function Get-CimInstance { [pscustomobject]@{ ExecutablePath = 'Invoke-FakeAdb' } }
function Invoke-FakeAdb {
    $global:androidTestCalls += ($args -join ' ')
    $global:LASTEXITCODE = 0
    if ($args[0] -eq 'devices') { $global:androidTestDevices }
    if ($args[-1] -eq '--list') { 'host-1 tcp:8088 tcp:8088' }
}
& "$PSScriptRoot/connect-android.ps1"
if ($global:androidTestCalls -notcontains '-s 192.168.1.10:12345 reverse tcp:8088 tcp:8088') { throw 'Missing forwarding.' }
if ($global:androidTestCalls -match 'disconnect|kill-server') { throw 'Must not disrupt other devices.' }
$rejected = $false
try { & "$PSScriptRoot/connect-android.ps1" -DeviceAddress 'invalid' } catch { $rejected = $true }
if (!$rejected) { throw 'Invalid address accepted.' }
$global:androidTestDevices = @('List of devices attached', '192.168.1.9:11111 offline')
$rejected = $false
try { & "$PSScriptRoot/connect-android.ps1" } catch { $rejected = $true }
if (!$rejected) { throw 'Missing device must not report success.' }
Write-Host 'PASS: online selection, offline exclusion, port verification, invalid address and missing device guards.'

