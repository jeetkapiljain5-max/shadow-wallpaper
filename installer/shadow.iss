; Shadow Wallpaper - Inno Setup script. Build: ISCC.exe installer\shadow.iss  (output in dist\)
; Per-user install (no admin), silent-friendly for winget: /VERYSILENT /SUPPRESSMSGBOXES /NORESTART
; A silent install only puts the files in place (nothing is started); the wallpaper is set up the first time you open
; Shadow Wallpaper from Start - or at your next sign-in. The normal installer offers to set it up on its last page.
#define AppVer "1.0.2"
#ifndef Publisher
  #define Publisher "Shadow Wallpaper"
#endif
#ifndef RepoUrl
  #define RepoUrl "https://github.com/"
#endif

[Setup]
AppId={{8C2F2B1E-5A7D-4E8B-9C61-2D7B3F0A9E41}
AppName=Shadow Wallpaper
AppVersion={#AppVer}
AppVerName=Shadow Wallpaper {#AppVer}
AppPublisher={#Publisher}
AppPublisherURL={#RepoUrl}
AppSupportURL={#RepoUrl}/issues
AppUpdatesURL={#RepoUrl}/releases
DefaultDirName={localappdata}\Programs\Shadow Wallpaper
PrivilegesRequired=lowest
DisableProgramGroupPage=yes
DisableDirPage=yes
DisableReadyPage=yes
OutputDir=..\dist
OutputBaseFilename=Shadow-Wallpaper-Setup-{#AppVer}
SetupIconFile=shadow.ico
UninstallDisplayIcon={app}\Shadow Wallpaper.exe
UninstallDisplayName=Shadow Wallpaper
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=no
LicenseFile=..\LICENSE

[Files]
Source: "..\wallpaper\*"; DestDir: "{app}\wallpaper"; Flags: recursesubdirs ignoreversion
Source: "..\helper\*"; DestDir: "{app}\helper"; Flags: recursesubdirs ignoreversion
Source: "setup.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "uninstall.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "shadow.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "bin\Shadow Wallpaper.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; the helper (Launchpad, lyrics, music) starts at every sign-in (the first time, it sets the wallpaper up)
Name: "{userstartup}\Shadow Wallpaper"; Filename: "{app}\Shadow Wallpaper.exe"; Parameters: "--helper"; WorkingDir: "{app}"
Name: "{userprograms}\Shadow Wallpaper"; Filename: "{app}\Shadow Wallpaper.exe"; WorkingDir: "{app}"; Comment: "Set up or re-apply Shadow Wallpaper"

[Run]
; only after a normal (not silent) install, as a ticked box on the last page
Filename: "{app}\Shadow Wallpaper.exe"; Description: "Set up Shadow Wallpaper now"; Flags: postinstall skipifsilent nowait

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\uninstall.ps1"" -AppDir ""{app}"""; Flags: runhidden waituntilterminated; RunOnceId: "ShadowCleanup"

[UninstallDelete]
; the key, your layout, usage, sign-in and downloaded fonts live next to the app: remove them too
Type: filesandordirs; Name: "{app}"
