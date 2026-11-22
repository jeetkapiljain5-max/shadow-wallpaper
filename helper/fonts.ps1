# Gets Apple's SF Pro (straight from Apple, on this PC - Apple doesn't allow passing the files on) and puts what Shadow uses in $Dest:
#   SF-Pro-Text-Regular/Medium/Semibold.otf, SF-Pro-Display-Semibold.otf  (Launchpad text)
#   SFClock.ttf  (the tall clock digits: SF Pro at width 35 / weight 620, made with a temporary portable Python)
# Used by install.ps1. -Dmg uses an already-downloaded SF-Pro.dmg instead of downloading it.
param([Parameter(Mandatory)] [string]$Dest, [string]$Dmg, [string]$Work = (Join-Path $env:TEMP ('shadow-fonts-' + [guid]::NewGuid().ToString('N').Substring(0, 8))))
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$otfs = 'SF-Pro-Text-Regular.otf', 'SF-Pro-Text-Medium.otf', 'SF-Pro-Text-Semibold.otf', 'SF-Pro-Display-Semibold.otf'
$clock = Join-Path $Dest 'SFClock.ttf'
New-Item -ItemType Directory -Force $Dest, $Work | Out-Null
$missing = @($otfs | Where-Object { -not (Test-Path (Join-Path $Dest $_)) })
if (-not $missing.Count -and (Test-Path $clock)) { Write-Host '  already set up'; return }
function Has-Winget { [bool](Get-Command winget -ErrorAction SilentlyContinue) }
function Find-7z { @("$env:ProgramFiles\7-Zip\7z.exe", "${env:ProgramFiles(x86)}\7-Zip\7z.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1 }
try {
    Write-Host '  Apple licence: SF Pro comes from https://developer.apple.com/fonts/ under Apple''s terms.'
    $z = Find-7z
    if (-not $z -and (Has-Winget)) {
        Write-Host '  installing 7-Zip (to open Apple''s Mac download)...'
        winget install --id 7zip.7zip -e --silent --accept-source-agreements --accept-package-agreements | Out-Null
        $z = Find-7z
    }
    if (-not $z) { throw '7-Zip is not installed (get it from 7-zip.org, then run Install Shadow again)' }
    if (-not $Dmg) {
        Write-Host '  downloading SF Pro from Apple (about 220 MB)...'
        $Dmg = Join-Path $Work 'SF-Pro.dmg'
        Invoke-WebRequest 'https://devimages-cdn.apple.com/design/resources/download/SF-Pro.dmg' -OutFile $Dmg -UseBasicParsing
    }
    # Mac disk image -> installer package -> payload -> font files
    & $z x -y "-o$Work\dmg" $Dmg | Out-Null
    $pkg = Get-ChildItem "$Work\dmg" -Recurse -Filter *.pkg | Select-Object -First 1
    if (-not $pkg) { throw 'no installer package inside Apple''s download' }
    & $z x -y "-o$Work\pkg" $pkg.FullName | Out-Null
    $payload = Get-ChildItem "$Work\pkg" -Recurse -Filter Payload* | Where-Object { -not $_.PSIsContainer } | Select-Object -First 1
    if (-not $payload) { throw 'no Payload inside Apple''s package' }
    & $z x -y "-o$Work\pl" $payload.FullName | Out-Null
    Get-ChildItem "$Work\pl" -File | ForEach-Object { & $z x -y "-o$Work\fonts" $_.FullName | Out-Null }
    $all = Get-ChildItem "$Work\fonts", "$Work\pl" -Recurse -File -Include *.otf, *.ttf -ErrorAction SilentlyContinue
    foreach ($n in $otfs) { $f = $all | Where-Object Name -eq $n | Select-Object -First 1; if ($f) { Copy-Item $f.FullName (Join-Path $Dest $n) -Force } }
    Write-Host ('  Launchpad fonts: ' + @($otfs | Where-Object { Test-Path (Join-Path $Dest $_) }).Count + ' of 4')

    if (-not (Test-Path $clock)) {
        $sfpro = $all | Where-Object Name -eq 'SF-Pro.ttf' | Select-Object -First 1
        if (-not $sfpro) { throw 'SF-Pro.ttf not found in Apple''s download' }
        Write-Host '  making the clock version of the font...'
        Invoke-WebRequest 'https://www.python.org/ftp/python/3.12.8/python-3.12.8-embed-amd64.zip' -OutFile "$Work\py.zip" -UseBasicParsing
        Expand-Archive "$Work\py.zip" "$Work\py" -Force
        $whl = ((Invoke-RestMethod 'https://pypi.org/pypi/fonttools/json' -UseBasicParsing).urls | Where-Object { $_.filename -like '*py3-none-any.whl' } | Select-Object -First 1).url
        if (-not $whl) { throw 'could not find fonttools' }
        Invoke-WebRequest $whl -OutFile "$Work\ft.zip" -UseBasicParsing
        Expand-Archive "$Work\ft.zip" "$Work\ft" -Force
        $code = "import sys; sys.path.insert(0, r'$Work\ft'); from fontTools.ttLib import TTFont; from fontTools.varLib import instancer; " +
                "instancer.instantiateVariableFont(TTFont(r'$($sfpro.FullName)'), {'wdth': 35, 'wght': 620, 'opsz': 28}).save(r'$clock')"
        & "$Work\py\python.exe" -c $code
        if (-not (Test-Path $clock)) { throw 'the clock font could not be made' }
    }
    Write-Host '  done'
} finally {
    Remove-Item $Work -Recurse -Force -ErrorAction SilentlyContinue
}
