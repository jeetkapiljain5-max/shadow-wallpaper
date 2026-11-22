# Shadow Wallpaper - finishes the install (run by the installer, silently).
#  1. a private key shared only by this PC's wallpaper and helper
#  2. Lively Wallpaper (installs it with winget if it's missing), lets the wallpaper receive mouse + keys
#  3. puts the wallpaper in Lively's library and applies it
#  4. starts the helper (it also starts at every sign-in, from the Startup folder)
#  5. in the background: Apple's SF Pro font, downloaded from Apple on this PC (never shipped with the app)
param([Parameter(Mandatory)] [string]$AppDir)
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$log = Join-Path $AppDir 'setup-log.txt'
function Say([string]$m) { Add-Content $log ("{0:HH:mm:ss} {1}" -f (Get-Date), $m) }
Say 'setup started'
$wp = Join-Path $AppDir 'wallpaper'; $helper = Join-Path $AppDir 'helper'

# 1. the key
$tokFile = Join-Path $helper 'token.txt'
if (-not (Test-Path $tokFile)) {
    $b = New-Object byte[] 16; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    Set-Content $tokFile (($b | ForEach-Object { $_.ToString('x2') }) -join '') -Encoding ASCII
}
$token = (Get-Content $tokFile -Raw).Trim()
Set-Content (Join-Path $wp 'launch-config.js') "window.LAUNCH = { url: 'http://localhost:47613/open/', token: '$token' };" -Encoding ASCII

# 2. Lively
function Find-Lively {
    $c = @("$env:ProgramFiles\Lively Wallpaper\Lively.exe", "$env:LOCALAPPDATA\Programs\Lively Wallpaper\Lively.exe", "${env:ProgramFiles(x86)}\Lively Wallpaper\Lively.exe")
    $c += Get-ItemProperty 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
          Where-Object { $_.DisplayName -like 'Lively Wallpaper*' -and $_.InstallLocation } | ForEach-Object { Join-Path $_.InstallLocation 'Lively.exe' }
    $c | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
}
$lively = Find-Lively
if (-not $lively -and (Get-Command winget -ErrorAction SilentlyContinue)) {
    Say 'installing Lively Wallpaper with winget'
    winget install --id rocksdanister.LivelyWallpaper -e --silent --accept-source-agreements --accept-package-agreements | Out-Null
    $lively = Find-Lively
}
if (-not $lively) { Say 'Lively Wallpaper not found - install it from https://www.rocksdanister.com/lively/ then run Shadow Wallpaper setup again'; }
else {
    Say "Lively: $lively"
    $settings = Join-Path $env:LOCALAPPDATA 'Lively Wallpaper\Settings.json'
    if (-not (Test-Path $settings)) { Start-Process $lively; for ($i = 0; $i -lt 30 -and -not (Test-Path $settings); $i++) { Start-Sleep 1 } }
    $lib = Join-Path $env:LOCALAPPDATA 'Lively Wallpaper\Library'
    if (Test-Path $settings) {
        $j = Get-Content $settings -Raw
        if ($j -match '"WallpaperDir":\s*"([^"]+)"') { $d = $Matches[1] -replace '\\\\', '\'; if (Test-Path $d) { $lib = $d } }
        # the wallpaper needs the mouse and keyboard, and keeps running (music, lyrics) when an app is focused; full-screen apps still pause it
        if ($j -notmatch '"InputForward":\s*2' -or $j -notmatch '"AppFocusPause":\s*1') {
            Get-Process 'Lively.UI.WinUI', 'Lively' -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep 2
            Copy-Item $settings "$settings.before-shadow" -Force
            Set-Content $settings (($j -replace '"InputForward":\s*\d', '"InputForward": 2') -replace '"AppFocusPause":\s*\d', '"AppFocusPause": 1') -Encoding UTF8
        }
    }
    # 3. into Lively's library, then apply
    $inLib = Join-Path $lib 'wallpapers\ShadowWallpaper'
    New-Item -ItemType Directory -Force $inLib | Out-Null
    Copy-Item (Join-Path $wp '*') $inLib -Recurse -Force
    if (-not (Get-Process Lively -ErrorAction SilentlyContinue)) { Start-Process $lively; Start-Sleep 8 }
    & $lively setwp --file $inLib
    Say "wallpaper applied from $inLib"
}

# 4. the helper
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match [regex]::Escape($helper) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Process wscript.exe ('"' + (Join-Path $helper 'start-helper.vbs') + '"')
Say 'helper started'

# 5. fonts, in the background (about 220 MB from Apple; the wallpaper uses similar Windows fonts until then)
$fontJob = @"
`$ErrorActionPreference = 'Continue'
& '$helper\fonts.ps1' -Dest '$wp\fonts' *>> '$AppDir\fonts-log.txt'
if ((Test-Path '$wp\fonts\SFClock.ttf') -and '$lively' -and (Test-Path '$lively')) {
    `$lib = '$(if ($lively) { $inLib } else { '' })'
    if (`$lib) { Copy-Item '$wp\fonts' `$lib -Recurse -Force; & '$lively' setwp --file `$lib }
}
"@
$fj = Join-Path $AppDir 'get-fonts.ps1'; Set-Content $fj $fontJob -Encoding UTF8
if (-not (Test-Path (Join-Path $wp 'fonts\SFClock.ttf'))) { Start-Process powershell.exe -WindowStyle Hidden -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$fj`"" }
Say 'setup done'
exit 0
