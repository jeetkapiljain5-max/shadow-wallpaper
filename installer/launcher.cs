// Shadow Wallpaper.exe - the app's front door (built with the .NET Framework compiler that ships with Windows; see build.ps1).
//   Shadow Wallpaper.exe            sets the wallpaper up (first run) or re-applies it, and starts the helper
//   Shadow Wallpaper.exe --helper   starts the helper at sign-in (or the full setup, if it never ran)
// Everything runs hidden; this program just starts it and exits.
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;

[assembly: AssemblyTitle("Shadow Wallpaper")]
[assembly: AssemblyProduct("Shadow Wallpaper")]
[assembly: AssemblyDescription("Shadow Wallpaper")]
[assembly: AssemblyCompany("jeetkapiljain5-max")]
[assembly: AssemblyCopyright("MIT License")]
[assembly: AssemblyVersion("1.0.2.0")]
[assembly: AssemblyFileVersion("1.0.2.0")]
[assembly: AssemblyInformationalVersion("1.0.2")]

static class ShadowLauncher {
  static int Main(string[] args) {
    string app = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
    bool helperOnly = args.Length > 0 && args[0].Equals("--helper", StringComparison.OrdinalIgnoreCase);
    bool setUp = File.Exists(Path.Combine(app, @"wallpaper\launch-config.js"));   // written by the first setup
    string ps = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), @"WindowsPowerShell\v1.0\powershell.exe");
    string a = (helperOnly && setUp)
      ? "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + Path.Combine(app, @"helper\shadow-helper.ps1") + "\""
      : "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + Path.Combine(app, "setup.ps1") + "\" -AppDir \"" + app + "\"";
    try {
      var psi = new ProcessStartInfo(ps, a) { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden, WorkingDirectory = app };
      Process.Start(psi);
      return 0;
    } catch (Exception) { return 1; }
  }
}
