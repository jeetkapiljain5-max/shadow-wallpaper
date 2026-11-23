# Builds the installer: Shadow Wallpaper.exe (from launcher.cs), then the Inno Setup package into dist\.
#   powershell -ExecutionPolicy Bypass -File installer\build.ps1
param([string]$Publisher = 'jeetkapiljain5-max', [string]$RepoUrl = 'https://github.com/jeetkapiljain5-max/shadow-wallpaper')
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$csc = Join-Path $env:windir 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$iscc = @("${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe", "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not (Test-Path $csc)) { throw 'csc.exe (.NET Framework 4) not found' }
if (-not $iscc) { throw 'Inno Setup 6 not found' }
$bin = Join-Path $here 'bin'; New-Item -ItemType Directory -Force $bin | Out-Null
& $csc /nologo /target:winexe /optimize+ /platform:anycpu "/win32icon:$here\shadow.ico" "/out:$bin\Shadow Wallpaper.exe" "$here\launcher.cs"
if ($LASTEXITCODE) { throw "csc failed ($LASTEXITCODE)" }
& $iscc /Q "/DPublisher=$Publisher" "/DRepoUrl=$RepoUrl" "$here\shadow.iss"
if ($LASTEXITCODE) { throw "ISCC failed ($LASTEXITCODE)" }
Get-ChildItem (Join-Path (Split-Path $here) 'dist') -Filter *.exe | Sort-Object LastWriteTime | Select-Object -Last 1 | ForEach-Object { $_.FullName; (Get-FileHash $_.FullName).Hash }
