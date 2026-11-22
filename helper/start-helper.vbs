' Starts the Shadow Wallpaper helper with no visible window (runs at sign-in from the Startup folder).
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & here & "\shadow-helper.ps1""", 0, False
