param([string]$DeviceAddress = '')
$ErrorActionPreference = 'Stop'
$adb = Get-CimInstance Win32_Process -Filter "Name='adb.exe'" |
    Select-Object -First 1 -ExpandProperty ExecutablePath
if (!$adb) {
    $adb = Get-ChildItem "$env:USERPROFILE/.hbuilderv-alpha/extensions/dcloud.launcher-tools-*/resources/launcher-tools/tools/adbs/adb.exe" |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (!$adb) { throw 'ADB not found. Open HBuilder V first.' }
if ($DeviceAddress -and $DeviceAddress -notmatch '^(\d{1,3}\.){3}\d{1,3}:\d{1,5}$') {
    throw 'Use IP:port from the phone Wireless debugging screen, not the pairing port.'
}
function Read-OnlineDevices {
    $lines = & $adb devices -l
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read ADB devices.' }
    foreach ($line in $lines) {
        if ($line -match '^(\S+)\s+device(?:\s|$)') { $Matches[1] }
    }
}
$online = @(Read-OnlineDevices)
if (!$DeviceAddress) {
    if ($online.Count -eq 1) { $DeviceAddress = $online[0] }
    elseif ($online.Count -gt 1) { throw 'Multiple devices. Specify -DeviceAddress IP:port.' }
    else {
        $services = & $adb mdns services
        $addresses = @($services | ForEach-Object {
            if ($_ -match '_adb-tls-connect\._tcp\s+(\d+\.\d+\.\d+\.\d+:\d+)') { $Matches[1] }
        } | Select-Object -Unique)
        if ($addresses.Count -ne 1) {
            throw 'Discovery is missing or ambiguous. Enable Wireless debugging; pass -DeviceAddress IP:port shown on the phone.'
        }
        $DeviceAddress = $addresses[0]
    }
}
if ($online -notcontains $DeviceAddress) { & $adb connect $DeviceAddress | Out-Host }
if (@(Read-OnlineDevices) -notcontains $DeviceAddress) {
    throw 'Device not online. Check Wireless debugging and pairing in HBuilder V.'
}
& $adb -s $DeviceAddress reverse tcp:8088 tcp:8088 | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'API port forwarding failed.' }
$forwarding = & $adb -s $DeviceAddress reverse --list
if ($LASTEXITCODE -ne 0 -or !($forwarding -match 'tcp:8088\s+tcp:8088')) {
    throw 'API port forwarding verification failed.'
}
Write-Host "Connected: $DeviceAddress; API port 8088 ready. Select this device in HBuilder V."
