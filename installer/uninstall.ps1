# Shadow Wallpaper - clean-up before the uninstaller removes the files (run silently by the uninstaller).
param([Parameter(Mandatory)] [string]$AppDir)
$ErrorActionPreference = 'SilentlyContinue'
$helper = Join-Path $AppDir 'helper'
# stop the helper and anything it started (sign-in / font jobs)
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -match [regex]::Escape($AppDir) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }   # (not this script itself)
Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object { $_.CommandLine -match [regex]::Escape($AppDir) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }   # Launchpad-over-apps' browser
Start-Sleep -Milliseconds 800
# take the wallpaper out of Lively (Lively falls back to its own wallpaper choice)
$lively = @("$env:ProgramFiles\Lively Wallpaper\Lively.exe", "$env:LOCALAPPDATA\Programs\Lively Wallpaper\Lively.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$lib = Join-Path $env:LOCALAPPDATA 'Lively Wallpaper\Library'
$settings = Join-Path $env:LOCALAPPDATA 'Lively Wallpaper\Settings.json'
if (Test-Path $settings) { $j = Get-Content $settings -Raw; if ($j -match '"WallpaperDir":\s*"([^"]+)"') { $d = $Matches[1] -replace '\\\\', '\'; if (Test-Path $d) { $lib = $d } } }
$inLib = Join-Path $lib 'wallpapers\ShadowWallpaper'
if ($lively -and (Test-Path $inLib)) { & $lively closewp --monitor -1 2>$null }
for ($i = 0; $i -lt 15 -and (Test-Path $inLib); $i++) { Start-Sleep 1; Remove-Item $inLib -Recurse -Force }   # Lively lets go of the files a moment after closing them
if (Test-Path $inLib) {                                                  # still held open by Lively: remove it at the next sign-in instead
    New-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce' -Name 'ShadowWallpaperCleanup' -PropertyType String -Force `
        -Value ('cmd.exe /c rmdir /s /q "' + $inLib + '"') | Out-Null
}
exit 0
