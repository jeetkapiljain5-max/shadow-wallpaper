# Shadow helper (runs quietly in the background, started at sign-in).
#  - Opens YouTube Music / Claude / WhatsApp when you click the wallpaper's glass icons.
#  - Tells the wallpaper which of those apps are installed (missing ones are hidden).
#  - Tells the wallpaper whether the desktop is in front, so it stops drawing (saves battery) while you use apps.
# Listens only on this computer (localhost), only for those three apps, and needs the secret key in token.txt.
$ErrorActionPreference = 'Continue'
$port  = 47613
$token = (Get-Content (Join-Path $PSScriptRoot 'token.txt') -Raw).Trim()
$names = @{ 'ytmusic' = 'YouTube Music'; 'claude' = 'Claude'; 'whatsapp' = 'WhatsApp' }
$startDirs = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs", "$env:ProgramData\Microsoft\Windows\Start Menu\Programs"

# Where an app can be started from: its Start-menu shortcut (opens Chrome web apps as apps), or its installed-app ID.
function Find-App([string]$display) {
    $lnk = Get-ChildItem $startDirs -Recurse -Filter "$display.lnk" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($lnk) { return @{ lnk = $lnk.FullName } }
    $app = Get-StartApps | Where-Object Name -eq $display | Select-Object -First 1
    if ($app) { return @{ id = $app.AppID } }
    return $null
}
function Open-App([string]$key) {
    $a = Find-App $names[$key]
    if ($a -and $a.lnk) { Start-Process $a.lnk; return $true }
    if ($a -and $a.id)  { Start-Process 'explorer.exe' "shell:AppsFolder\$($a.id)"; return $true }
    if ($key -eq 'ytmusic') {
        # not installed: open YouTube Music in its own app window (no tabs, no address bar)
        $chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
        $edge   = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
        $browser = if ($chrome) { $chrome } else { $edge }
        if ($browser) { Start-Process $browser '--app=https://music.youtube.com'; return $true }
    }
    return $false
}
# A YouTube Music link: in the installed YouTube Music app (closing its old window first, or two songs would play), else an app window, else the browser.
$ytGhost = $true                                                  # open YouTube Music invisibly when a song is picked (Now Playing on the wallpaper)
function Open-YTM([string]$url, [bool]$ghost = $false) {
    $a = Find-App 'YouTube Music'
    if ($a -and $a.lnk) {
        $l = (New-Object -ComObject WScript.Shell).CreateShortcut($a.lnk)
        if ($l.Arguments -match '--app-id=') {
            Close-YTM $(if ($l.Arguments -match '--app-id=(\w+)') { $Matches[1] } else { '' })
            if ($script:ytGhost -and $ghost) { [Fg]::GhostNext('YouTube Music', 9000) }
            Start-Process $l.TargetPath ($l.Arguments.Trim() + ' --app-launch-url-for-shortcuts-menu-item="' + $url + '"'); return
        }
    }
    $chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
                "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($chrome) { [void][Fg]::CloseAppWindows('YouTube Music'); Start-Process $chrome "--app=$url" } else { Start-Process $url }
}
# Closes YouTube Music's window before it opens the next song. Closed mid-song it asks "Leave app?" (popping its window up to ask),
# so it's paused first; if it asks anyway, the prompt is kept out of sight and answered "Leave".
try { Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes } catch {}
function Close-YTM([string]$appId) {
    $old = @([Fg]::AppWindowList('YouTube Music')); if (-not $old.Count) { return }
    $paused = $false
    if ($media -and $appId) {
        try { foreach ($s in @($media.GetSessions())) {
            $a = [string]$s.SourceAppUserModelId
            $code = if ($appId.Length -gt 15) { $appId.Substring(0, 5) + $appId.Substring($appId.Length - 10) } else { $appId }
            if ($a -match "_crx_$code" -and [string]$s.GetPlaybackInfo().PlaybackStatus -eq 'Playing') { [void](Await-Op ($s.TryPauseAsync()) ([bool])); $paused = $true }
        } } catch {}
    }
    if ($paused) { Start-Sleep -Milliseconds 150 }
    [void][Fg]::CloseAppWindows('YouTube Music')
    $until = (Get-Date).AddMilliseconds(1500)
    while ((Get-Date) -lt $until) {
        $left = @($old | Where-Object { [Fg]::Alive($_) }); if (-not $left.Count) { break }
        foreach ($h in $left) {
            foreach ($d in [Fg]::Owned($h)) {
                [Fg]::Shape($d); [Fg]::Shape($h)
                try {
                    $el = [System.Windows.Automation.AutomationElement]::FromHandle($d)
                    $btn = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)
                    $bs = @($el.FindAll([System.Windows.Automation.TreeScope]::Descendants, $btn))
                    $b = $bs | Where-Object { $_.Current.Name -eq 'Leave' } | Select-Object -First 1; if (-not $b) { $b = $bs | Select-Object -First 1 }   # "Leave" comes first
                    if ($b) { $b.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke() }
                } catch {}
            }
        }
        Start-Sleep -Milliseconds 20
    }
}
# What's playing (any app that shows in Windows' media controls: YouTube Music, Spotify, ...), for the wallpaper's lyrics.
$media = $null
try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
    [void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
    $mgrType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]; $propType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]
    function Await-Op($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); if ($task.Wait(1500)) { $task.Result } else { $null } }
    $media = Await-Op ($mgrType::RequestAsync()) $mgrType
} catch { $media = $null }
$mediaProps = @{}   # per session: (title, props) so we only re-ask for the song details when the song changes
# Which player the wallpaper follows: a music app that's playing; else the music app it was showing (paused stays paused,
# a video playing in the browser meanwhile doesn't take over); else whatever plays. The media buttons act on this one too.
$musicApps = '_crx_cinhi|youtube ?music|spotify|applemusic|apple music|tidal|deezer|amazon ?music|soundcloud'
$lastAumid = ''; $shownSession = $null
function Pick-Session {
    $all = @($media.GetSessions()); if (-not $all.Count) { $script:shownSession = $null; return $null }
    $playing = @($all | Where-Object { [string]$_.GetPlaybackInfo().PlaybackStatus -eq 'Playing' })
    $s = $playing | Where-Object { [string]$_.SourceAppUserModelId -match $musicApps } | Select-Object -First 1
    if (-not $s) { $s = $playing | Select-Object -First 1 }                      # anything that is playing beats a paused music app (Spotify in a browser is just 'Chrome')
    if (-not $s -and $script:lastAumid -match $musicApps) { $s = $all | Where-Object { [string]$_.SourceAppUserModelId -eq $script:lastAumid } | Select-Object -First 1 }
    if (-not $s) { $s = $playing | Select-Object -First 1 }
    if (-not $s -and $script:lastAumid -match $musicApps) { $script:shownSession = $null; return $null }   # the music app is between tracks: not some paused tab instead
    if (-not $s) { $s = $media.GetCurrentSession() }; if (-not $s) { $s = $all[0] }
    $script:lastAumid = [string]$s.SourceAppUserModelId; $script:shownSession = $s
    return $s
}
function Media-Art {
    if (-not $media) { return $null }
    try {
        $s = Pick-Session; if (-not $s) { return $null }
        $p = Await-Op ($s.TryGetMediaPropertiesAsync()) $propType; if (-not $p -or -not $p.Thumbnail) { return $null }
        $ras = Await-Op ($p.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime])
        if (-not $ras) { return $null }
        $inT = [Windows.Storage.Streams.IInputStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
        $st = [System.IO.WindowsRuntimeStreamExtensions].GetMethod('AsStreamForRead', [Type[]]@($inT)).Invoke($null, @($ras))
        $ms = New-Object IO.MemoryStream; $st.CopyTo($ms); $st.Dispose()
        return @{ bytes = $ms.ToArray(); type = $(if ($ras.ContentType) { [string]$ras.ContentType } else { 'image/png' }) }
    } catch { return $null }
}
# What YouTube Music is really playing: its page address (watch?v=...) read through Windows' accessibility interface. Works while
# it is minimized; tells the exact video (or song) id, so the wallpaper never has to search for it.
$script:ytmDoc = $null; $script:ytmDocAt = [datetime]::MinValue
function Ytm-Vid {
    try {
        if (-not $script:ytmDoc) {
            if (((Get-Date) - $script:ytmDocAt).TotalSeconds -lt 3) { return '' }
            $script:ytmDocAt = Get-Date
            Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
            $A = [Windows.Automation.AutomationElement]
            $win = $A::RootElement.FindFirst([Windows.Automation.TreeScope]::Children, (New-Object Windows.Automation.PropertyCondition($A::NameProperty, 'YouTube Music')))
            if ($win) { $script:ytmDoc = $win.FindFirst([Windows.Automation.TreeScope]::Descendants, (New-Object Windows.Automation.PropertyCondition($A::ControlTypeProperty, [Windows.Automation.ControlType]::Document))) }
            if (-not $script:ytmDoc) { return '' }
        }
        $u = [string]$script:ytmDoc.GetCurrentPropertyValue([Windows.Automation.ValuePattern]::ValueProperty)
        if ($u -match '[?&]v=([A-Za-z0-9_-]{11})') { return $Matches[1] }
        if (-not $u) { $script:ytmDoc = $null }
        return ''
    } catch { $script:ytmDoc = $null; return '' }
}
# YouTube in a browser: Windows only updates its position on play / pause / seek, so ads, pauses and buffering go unseen.
# The tab's own seek bar (read through the accessibility interface) tells the real second while the window is visible;
# bat = when it last moved (a minimized window's bar stands still and is then ignored by the wallpaper).
$script:bSlider = $null; $script:bEdit = $null; $script:bWin = ''; $script:bAt = [datetime]::MinValue; $script:bVal = -1; $script:bChanged = 0L
function Browser-Pos([string]$title) {
    try {
        $key = ($title -replace '[^\w]', '').ToLower(); if (-not $key) { return $null }
        if (-not $script:bSlider -or $script:bWin -ne $key) {
            if (((Get-Date) - $script:bAt).TotalSeconds -lt 3 -and $script:bWin -eq $key) { return $null }
            $script:bAt = Get-Date; $script:bWin = $key; $script:bSlider = $null; $script:bEdit = $null; $script:bVal = -1
            Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
            $A = [Windows.Automation.AutomationElement]
            foreach ($w in $A::RootElement.FindAll([Windows.Automation.TreeScope]::Children, [Windows.Automation.Condition]::TrueCondition)) {
                $n = (([string]$w.Current.Name) -replace '[^\w]', '').ToLower()
                if ($n -match 'youtube' -and $n.Contains($key.Substring(0, [Math]::Min(24, $key.Length)))) {
                    $script:bSlider = $w.FindFirst([Windows.Automation.TreeScope]::Descendants, (New-Object Windows.Automation.PropertyCondition($A::NameProperty, 'Seek slider')))
                    $script:bEdit = $w.FindFirst([Windows.Automation.TreeScope]::Descendants, (New-Object Windows.Automation.PropertyCondition($A::ControlTypeProperty, [Windows.Automation.ControlType]::Edit)))   # the address bar: the exact video
                    break
                }
            }
            if (-not $script:bSlider) { return $null }
        }
        $vid = ''; if ($script:bEdit) { try { $u = [string]$script:bEdit.GetCurrentPropertyValue([Windows.Automation.ValuePattern]::ValueProperty); if ($u -match 'youtube\.com/watch\?(?:.*&)?v=([A-Za-z0-9_-]{11})') { $vid = $Matches[1] } } catch { $script:bEdit = $null } }
        $v = [double]$script:bSlider.GetCurrentPropertyValue([Windows.Automation.RangeValuePattern]::ValueProperty)
        if ($v -ne $script:bVal) { $script:bChanged = $(if ($script:bVal -lt 0) { 0L } else { [DateTimeOffset]::Now.ToUnixTimeMilliseconds() }); $script:bVal = $v }   # (the first reading is not a move)
        return @{ v = $v; at = $script:bChanged; vid = $vid }
    } catch { $script:bSlider = $null; return $null }
}
function Media-Json {
    if (-not $media) { return '{}' }
    try {
        $s = Pick-Session; if (-not $s) { return '{}' }
        $p = Await-Op ($s.TryGetMediaPropertiesAsync()) $propType; if (-not $p) { return '{}' }
        $tl = $s.GetTimelineProperties()
        $o = [ordered]@{
            app = [string]$s.SourceAppUserModelId; title = [string]$p.Title; artist = [string]$p.Artist; album = [string]$p.AlbumTitle
            status = [string]$s.GetPlaybackInfo().PlaybackStatus
            pos = [math]::Round($tl.Position.TotalSeconds, 3); dur = [math]::Round(($tl.EndTime - $tl.StartTime).TotalSeconds, 3)
            upd = $tl.LastUpdatedTime.ToUnixTimeMilliseconds(); now = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
            art = $(if ($p.Thumbnail) { '1' } else { '' })
            vid = $(if ([string]$s.SourceAppUserModelId -match '_crx_cinhi') { Ytm-Vid } else { '' })
        }
        if ([string]$s.SourceAppUserModelId -match '^(Chrome|MSEdge|Brave|Opera|Firefox)') { $bp = Browser-Pos ([string]$p.Title); if ($bp) { $o.bpos = $bp.v; $o.bat = $bp.at; if ($bp.vid) { $o.vid = $bp.vid } } }
        return ($o | ConvertTo-Json -Compress)
    } catch { return '{}' }
}
# Your YouTube Music library (google.ps1 signs in and syncs in its own process, so a slow network never holds this loop up)
$googleScript = Join-Path $PSScriptRoot 'google.ps1'
$googleSyncAt = (Get-Date).AddMinutes(-235); $strayAt = [datetime]::MinValue                       # first sync ~5 minutes after start, then every 4 hours
function Start-Google([string]$mode) { Start-Process powershell.exe -WindowStyle Hidden -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$googleScript`" -$mode" }
function YtLib-Json {
    $st = Join-Path $PSScriptRoot 'google-state.json'; $lib = Join-Path $PSScriptRoot 'google-library.json'
    $state = if (Test-Path $st) { [IO.File]::ReadAllText($st).Trim() } else { 'null' }
    $client = if (Test-Path (Join-Path $PSScriptRoot 'google-client.json')) { 'true' } else { 'false' }
    $signed = if (Test-Path (Join-Path $PSScriptRoot 'google-token.dat')) { 'true' } else { 'false' }
    $body = if (Test-Path $lib) { [IO.File]::ReadAllText($lib).Trim() } else { 'null' }
    return '{"client":' + $client + ',"signedIn":' + $signed + ',"state":' + $state + ',"lib":' + $body + '}'
}
$appsCache = $null; $appsAt = [datetime]::MinValue
function Apps-Json {
    if (((Get-Date) - $script:appsAt).TotalSeconds -gt 20) {
        $script:appsCache = '{"whatsapp":' + ($(if (Find-App 'WhatsApp') { 'true' } else { 'false' })) + ',"claude":' + ($(if (Find-App 'Claude') { 'true' } else { 'false' })) + ',"ytmusic":true}'
        $script:appsAt = Get-Date
    }
    return $script:appsCache
}

Add-Type @'
using System; using System.Runtime.InteropServices; using System.Text;
public static class Fg {
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  public static string Cls() { var sb = new StringBuilder(256); GetClassName(GetForegroundWindow(), sb, 256); return sb.ToString(); }
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  public static void Tap(byte vk) { keybd_event(vk, 0, 1, UIntPtr.Zero); keybd_event(vk, 0, 3, UIntPtr.Zero); }
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  // app windows (Chrome/Edge installed web apps) whose title ends in the app's name; normal browser windows end in the browser's name
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] static extern int SetWindowRgn(IntPtr h, IntPtr rgn, bool redraw);
  [DllImport("user32.dll")] static extern int GetWindowRgn(IntPtr h, IntPtr rgn);
  [DllImport("gdi32.dll")] static extern IntPtr CreateRectRgn(int a, int b, int c, int d);
  [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr o);
  [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h, uint flags);
  delegate void WinEventProc(IntPtr hook, uint ev, IntPtr h, int obj, int child, uint thread, uint time);
  [DllImport("user32.dll")] static extern IntPtr SetWinEventHook(uint min, uint max, IntPtr mod, WinEventProc proc, uint pid, uint tid, uint flags);
  [DllImport("user32.dll")] static extern bool UnhookWinEvent(IntPtr hook);
  [StructLayout(LayoutKind.Sequential)] struct MSG { public IntPtr h; public uint m; public IntPtr w, l; public uint t; public int x, y; }
  [DllImport("user32.dll")] static extern bool PeekMessage(out MSG m, IntPtr h, uint min, uint max, uint remove);
  [DllImport("user32.dll")] static extern bool TranslateMessage(ref MSG m);
  [DllImport("user32.dll")] static extern IntPtr DispatchMessage(ref MSG m);
  static readonly System.Collections.Generic.List<IntPtr> ghosts = new System.Collections.Generic.List<IntPtr>();
  static string Title(IntPtr h) { var sb = new StringBuilder(512); GetWindowText(h, sb, 512); return sb.ToString(); }
  static bool IsApp(string t, string app) { return t == app || t.EndsWith(" - " + app); }
  static readonly System.Collections.Generic.Dictionary<uint, bool> chromePid = new System.Collections.Generic.Dictionary<uint, bool>();
  static bool IsChromeTop(IntPtr h) {
    if (GetAncestor(h, 2) != h) return false;                               // top-level only
    var c = new StringBuilder(256); GetClassName(h, c, 256); if (c.ToString() != "Chrome_WidgetWin_1") return false;
    uint pid; GetWindowThreadProcessId(h, out pid); bool ok;
    lock (chromePid) if (chromePid.TryGetValue(pid, out ok)) return ok;   // remembered: this runs for every window event
    try { var pn = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName.ToLower(); ok = pn == "chrome" || pn == "msedge"; } catch { ok = false; }
    lock (chromePid) chromePid[pid] = ok; return ok;
  }
  static System.Collections.Generic.List<IntPtr> AppWindows(string app) {
    var list = new System.Collections.Generic.List<IntPtr>();
    EnumWindows((h, l) => { if (IsWindowVisible(h) && IsApp(Title(h), app) && IsChromeTop(h)) list.Add(h); return true; }, IntPtr.Zero);
    return list;
  }
  // An empty window shape: nothing of it is drawn (this works for Chrome's DirectComposition windows, where see-through
  // styles don't), yet Windows and Chrome still treat it as an open, on-screen window, so the music starts normally.
  // (a single pixel, not nothing: with no visible pixel at all Chrome thinks the window is covered and holds the music back)
  [StructLayout(LayoutKind.Sequential)] struct WRECT { public int L, T, R, B; }
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out WRECT r);
  [DllImport("user32.dll")] static extern int GetWindowRgnBox(IntPtr h, out WRECT r);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint f);
  [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr h, int a, ref int v, int s);
  static void NoAnim(IntPtr h, bool off) { int v = off ? 1 : 0; DwmSetWindowAttribute(h, 3, ref v, 4); }   // DWMWA_TRANSITIONS_FORCEDISABLED: no open/minimise animation to see
  // Chrome gives app windows Windows 11's "Mica" backdrop, which Windows draws itself - ignoring the window's shape: a dark panel
  // where the hidden window is. While hidden: no backdrop, no border (the original backdrop comes back when it's shown).
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int s);
  static readonly System.Collections.Generic.Dictionary<IntPtr, int> backdrop = new System.Collections.Generic.Dictionary<IntPtr, int>();
  static void NoPanel(IntPtr h) {
    lock (backdrop) if (!backdrop.ContainsKey(h)) { int was; if (DwmGetWindowAttribute(h, 38, out was, 4) != 0) was = 0; backdrop[h] = was; }
    int none = 1, noBorder = unchecked((int)0xFFFFFFFE), noFrame = 1;
    DwmSetWindowAttribute(h, 38, ref none, 4); DwmSetWindowAttribute(h, 34, ref noBorder, 4); DwmSetWindowAttribute(h, 2, ref noFrame, 4);   // no backdrop, border, frame/shadow
  }
  static void Panel(IntPtr h) {
    int was; lock (backdrop) { if (!backdrop.TryGetValue(h, out was)) return; backdrop.Remove(h); }
    int def = unchecked((int)0xFFFFFFFF), frame = 0; DwmSetWindowAttribute(h, 2, ref frame, 4); DwmSetWindowAttribute(h, 38, ref was, 4); DwmSetWindowAttribute(h, 34, ref def, 4);
  }
  static readonly System.Collections.Generic.Dictionary<IntPtr, string> shaped = new System.Collections.Generic.Dictionary<IntPtr, string>();
  static bool Hidden(IntPtr h) { WRECT b; return GetWindowRgnBox(h, out b) == 2 && b.R - b.L == 1 && b.B - b.T == 1; }   // our one-pixel shape is on it
  static void Ghost(IntPtr h) {
    WRECT r; if (IsIconic(h) || !GetWindowRect(h, out r) || r.R <= r.L) return;
    NoPanel(h);                                                           // (every time: Chrome may set its backdrop again)
    var mi = new MONINFO(); mi.cbSize = Marshal.SizeOf(typeof(MONINFO)); GetMonitorInfo(MonitorFromWindow(h, 2), ref mi); var w = mi.work;
    int x0 = Math.Max(r.L, w.L), y0 = Math.Max(r.T, w.T), x1 = Math.Min(r.R, w.R), y1 = Math.Min(r.B, w.B);
    if (x1 <= x0 || y1 <= y0) { x0 = r.L; x1 = r.R; y0 = r.T; y1 = r.B; }   // (not resized here: Chrome redraws its full shape on every resize)
    string key = r.L + "," + r.T + "," + r.R + "," + r.B; string had;
    lock (shaped) if (Hidden(h) && shaped.TryGetValue(h, out had) && had == key) return;
    int x = (x0 + x1) / 2 - r.L, y = (y0 + y1) / 2 - r.T;                // the pixel is ON the screen (one off-screen = "covered" to Chrome: no music)
    SetWindowRgn(h, CreateRectRgn(x, y, x + 1, y + 1), false);            // the shape first: nothing may wait before it
    NoAnim(h, true);                                                      // (not made always-on-top: Windows then draws the whole window as a dark panel)
    lock (shaped) shaped[h] = key;
  }
  static void Unghost(IntPtr h) { Panel(h); SetWindowRgn(h, IntPtr.Zero, true); NoAnim(h, false); lock (shaped) shaped.Remove(h); }
  // closing YouTube Music: its windows, whether they're gone yet, and a prompt it may show (owned by its window)
  public static IntPtr[] AppWindowList(string app) { return AppWindows(app).ToArray(); }
  public static bool Alive(IntPtr h) { return IsWindow(h); }
  public static void Shape(IntPtr h) { Ghost(h); }
  public static IntPtr[] Owned(IntPtr owner) {
    var o = new System.Collections.Generic.List<IntPtr>();
    EnumWindows((h, l) => { if (IsWindowVisible(h) && GetWindow(h, 4) == owner) o.Add(h); return true; }, IntPtr.Zero);
    return o.ToArray();
  }
  static int ghostGen = 0; static WinEventProc hookProc;
  // From the moment we open the app: every new Chrome window is shaped away as it is created (before its first frame);
  // ones that turn out not to be YouTube Music get their shape back as soon as their title shows.
  public static void GhostNext(string app, int forMs) {
    int gen = System.Threading.Interlocked.Increment(ref ghostGen);
    var ready = new System.Threading.ManualResetEvent(false);
    var t = new System.Threading.Thread(() => {
      var until = DateTime.UtcNow.AddMilliseconds(forMs);
      var maybe = new System.Collections.Generic.Dictionary<IntPtr, DateTime>();
      hookProc = (hk, ev, h, obj, child, th, tm) => {
        if (obj != 0 || child != 0 || h == IntPtr.Zero || gen != ghostGen || ev == 0x8001) return;
        if (ev == 0x800B) { bool g; lock (ghosts) g = ghosts.Contains(h); if (g) Ghost(h); return; }   // moved / resized: shape again at once
        if (!IsChromeTop(h)) return;
        Ghost(h); lock (ghosts) { if (!ghosts.Contains(h)) ghosts.Add(h); } if (!maybe.ContainsKey(h)) maybe[h] = DateTime.UtcNow;
      };
      IntPtr hook = SetWinEventHook(0x8000, 0x8002, IntPtr.Zero, hookProc, 0, 0, 0x0002);   // OBJECT_CREATE..SHOW, out of context, skip own process
      IntPtr hook2 = SetWinEventHook(0x800B, 0x800B, IntPtr.Zero, hookProc, 0, 0, 0x0002); // OBJECT_LOCATIONCHANGE
      ready.Set();
      MSG m;
      while (DateTime.UtcNow < until && gen == ghostGen) {
        while (PeekMessage(out m, IntPtr.Zero, 0, 0, 1)) { TranslateMessage(ref m); DispatchMessage(ref m); }
        foreach (var h in AppWindows(app)) { Ghost(h); lock (ghosts) { if (!ghosts.Contains(h)) ghosts.Add(h); } }   // keep it shaped away (if Chrome resets it)
        foreach (var kv in new System.Collections.Generic.List<System.Collections.Generic.KeyValuePair<IntPtr, DateTime>>(maybe)) {
          string ti = Title(kv.Key);
          if (ti.Length > 0 && !IsApp(ti, app)) { Unghost(kv.Key); lock (ghosts) ghosts.Remove(kv.Key); maybe.Remove(kv.Key); }   // some other Chrome window
        }
        System.Threading.Thread.Sleep(4);
      }
      if (hook != IntPtr.Zero) UnhookWinEvent(hook); if (hook2 != IntPtr.Zero) UnhookWinEvent(hook2);
      foreach (var h in maybe.Keys) if (!IsApp(Title(h), app)) { Unghost(h); lock (ghosts) ghosts.Remove(h); }
      if (gen != ghostGen) return;                                         // already revealed
      System.Threading.Thread.Sleep(12000); if (gen == ghostGen) Reveal(true);    // never leave a hidden window behind (tucked away, not popped up)
    });
    t.IsBackground = true; t.Start(); ready.WaitOne(800);                // the app opens only once the watch is in place
  }
  [StructLayout(LayoutKind.Sequential)] struct WPLACE { public int len, flags, show; public int mx, my, nx, ny; public WRECT normal; }
  [DllImport("user32.dll")] static extern bool GetWindowPlacement(IntPtr h, ref WPLACE p);
  [DllImport("user32.dll")] static extern bool SetWindowPlacement(IntPtr h, ref WPLACE p);
  static void FixPlace(IntPtr h) {                                        // Chrome remembered a squashed or off-screen size: open it properly next time
    var p = new WPLACE(); p.len = Marshal.SizeOf(typeof(WPLACE)); if (!GetWindowPlacement(h, ref p)) return;
    var mi = new MONINFO(); mi.cbSize = Marshal.SizeOf(typeof(MONINFO)); GetMonitorInfo(MonitorFromWindow(h, 2), ref mi); var w = mi.work; var r = p.normal;
    if (Math.Min(r.R, w.R) - Math.Max(r.L, w.L) >= 400 && Math.Min(r.B, w.B) - Math.Max(r.T, w.T) >= 300) return;
    int ww = (w.R - w.L) * 4 / 5, wh = (w.B - w.T) * 4 / 5;
    p.normal.L = w.L + (w.R - w.L - ww) / 2; p.normal.T = w.T + (w.B - w.T - wh) / 2; p.normal.R = p.normal.L + ww; p.normal.B = p.normal.T + wh;
    p.show = 7; p.flags = 0; SetWindowPlacement(h, ref p);                 // stays minimised
  }
  public static int Reveal(bool minimise) {
    int n = 0; System.Threading.Interlocked.Increment(ref ghostGen);       // stops any ghosting still running
    lock (ghosts) {
      foreach (var h in ghosts) { bool yt = IsApp(Title(h), "YouTube Music"); if (minimise && yt) ShowWindow(h, 6); Unghost(h); if (minimise && yt) FixPlace(h); n++; }   // minimise first, then give the shape back: no flash
      ghosts.Clear();
    }
    return n;
  }
  // Adobe's background service sometimes shows its invisible helper window as a pale box at the bottom of the screen
  public static int HideStray() {
    int n = 0;
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h)) return true;
      var c = new StringBuilder(64); GetClassName(h, c, 64); if (c.ToString() != "Internet Explorer_Hidden") return true;
      uint pid; GetWindowThreadProcessId(h, out pid);
      try { if (System.Diagnostics.Process.GetProcessById((int)pid).ProcessName.StartsWith("Adobe", StringComparison.OrdinalIgnoreCase)) { ShowWindow(h, 0); n++; } } catch { }
      return true;
    }, IntPtr.Zero);
    return n;
  }
  [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h, uint f);
  [StructLayout(LayoutKind.Sequential)] struct MONINFO { public int cbSize; public WRECT mon, work; public uint flags; }
  [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr m, ref MONINFO mi);

  // the app in front fills the screen (maximised or full screen): nothing of the wallpaper can be seen
  public static bool Covered() {
    IntPtr h = GetForegroundWindow(); if (h == IntPtr.Zero) return false;
    var c = new StringBuilder(64); GetClassName(h, c, 64); string cls = c.ToString();
    if (cls == "Progman" || cls == "WorkerW" || cls == "Shell_TrayWnd") return false;
    if (IsZoomed(h)) return true;
    WRECT r; var mi = new MONINFO(); mi.cbSize = Marshal.SizeOf(typeof(MONINFO));
    if (!GetWindowRect(h, out r) || !GetMonitorInfo(MonitorFromWindow(h, 2), ref mi)) return false;
    return r.L <= mi.mon.L && r.T <= mi.mon.T && r.R >= mi.mon.R && r.B >= mi.mon.B;
  }
  public static int MinimiseApp(string app) { int n = Reveal(true); foreach (var h in AppWindows(app)) { ShowWindow(h, 6); FixPlace(h); n++; } return n; }
  public static int CloseAppWindows(string app) {
    int n = 0;
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h)) return true;
      var sb = new StringBuilder(512); GetWindowText(h, sb, 512); var t = sb.ToString();
      if (!(t == app || t.EndsWith(" - " + app))) return true;
      var c = new StringBuilder(256); GetClassName(h, c, 256); if (c.ToString() != "Chrome_WidgetWin_1") return true;
      uint pid; GetWindowThreadProcessId(h, out pid);
      try { var pn = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName.ToLower(); if (pn != "chrome" && pn != "msedge") return true; } catch { return true; }
      PostMessage(h, 0x0010, IntPtr.Zero, IntPtr.Zero); n++; return true;        // WM_CLOSE
    }, IntPtr.Zero);
    return n;
  }
}
'@
$desktopClasses = @('Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd', '')

# ---------- Launchpad: every Start-menu app, with its real high-resolution icon ----------
Add-Type -ReferencedAssemblies System.Drawing @'
using System; using System.Runtime.InteropServices; using System.Drawing; using System.Drawing.Imaging;
public static class ShellIcon {
  [ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItemImageFactory { [PreserveSig] int GetImage(SIZE size, int flags, out IntPtr phbm); }
  [StructLayout(LayoutKind.Sequential)] struct SIZE { public int cx, cy; }
  [StructLayout(LayoutKind.Sequential)] struct BITMAP { public int bmType, bmWidth, bmHeight, bmWidthBytes; public ushort bmPlanes, bmBitsPixel; public IntPtr bmBits; }
  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
  static extern void SHCreateItemFromParsingName(string path, IntPtr pbc, [MarshalAs(UnmanagedType.LPStruct)] Guid riid, [MarshalAs(UnmanagedType.Interface)] out IShellItemImageFactory ppv);
  [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr h);
  [DllImport("gdi32.dll")] static extern int GetObject(IntPtr h, int c, ref BITMAP bm);
  // Saves the icon Windows shows for this app (Start menu / taskbar quality) as a PNG with transparency.
  public static void Save(string parsingName, string outPng, int size) {
    IShellItemImageFactory f;
    SHCreateItemFromParsingName(parsingName, IntPtr.Zero, typeof(IShellItemImageFactory).GUID, out f);
    IntPtr hbm; SIZE sz; sz.cx = size; sz.cy = size;
    int hr = f.GetImage(sz, 0x1 | 0x4, out hbm);              // BIGGERSIZEOK | ICONONLY
    if (hr != 0) throw new Exception("GetImage " + hr);
    try {
      BITMAP bm = new BITMAP(); GetObject(hbm, Marshal.SizeOf(typeof(BITMAP)), ref bm);
      using (var raw = new Bitmap(bm.bmWidth, bm.bmHeight, bm.bmWidthBytes, PixelFormat.Format32bppPArgb, bm.bmBits))
      using (var copy = new Bitmap(bm.bmWidth, bm.bmHeight, PixelFormat.Format32bppArgb)) {
        using (var g = Graphics.FromImage(copy)) g.DrawImage(raw, 0, 0, bm.bmWidth, bm.bmHeight);
        if (bm.bmHeight > 0 && bm.bmBits != IntPtr.Zero && BottomUp) copy.RotateFlip(RotateFlipType.RotateNoneFlipY);
        using (var fixedUp = Enlarge(copy)) (fixedUp ?? copy).Save(outPng, ImageFormat.Png);
      }
    } finally { DeleteObject(hbm); }
  }
  // A file's picture for Launchpad search: its real thumbnail (photos, videos, PDFs...) or, with iconOnly, the icon Explorer shows.
  public static void SaveThumb(string path, string outPng, int size, bool iconOnly) {
    IShellItemImageFactory f;
    SHCreateItemFromParsingName(path, IntPtr.Zero, typeof(IShellItemImageFactory).GUID, out f);
    IntPtr hbm; SIZE sz; sz.cx = size; sz.cy = size;
    int hr = f.GetImage(sz, iconOnly ? (0x1 | 0x4) : 0x1, out hbm);   // BIGGERSIZEOK (| ICONONLY)
    if (hr != 0) throw new Exception("GetImage " + hr);
    try {
      BITMAP bm = new BITMAP(); GetObject(hbm, Marshal.SizeOf(typeof(BITMAP)), ref bm);
      bool bottomUp = iconOnly || System.IO.Directory.Exists(path);   // icons and folder pictures come bottom-up; real thumbnails (photos, videos) top-down, whatever the header says
      using (var raw = new Bitmap(bm.bmWidth, bm.bmHeight, bm.bmWidthBytes, PixelFormat.Format32bppPArgb, bm.bmBits))
      using (var copy = new Bitmap(bm.bmWidth, bm.bmHeight, PixelFormat.Format32bppArgb)) {
        using (var g = Graphics.FromImage(copy)) g.DrawImage(raw, 0, 0, bm.bmWidth, bm.bmHeight);
        if (bm.bmBits != IntPtr.Zero && bottomUp) copy.RotateFlip(RotateFlipType.RotateNoneFlipY);
        bool anyAlpha = false;                                          // thumbnails often come back with alpha 0 everywhere: make them opaque
        for (int y = 0; y < copy.Height && !anyAlpha; y += Math.Max(1, copy.Height / 16)) for (int x = 0; x < copy.Width; x += Math.Max(1, copy.Width / 16)) if (copy.GetPixel(x, y).A > 0) { anyAlpha = true; break; }
        if (!anyAlpha) {
          using (var o = new Bitmap(bm.bmWidth, bm.bmHeight, PixelFormat.Format32bppArgb)) {
            using (var raw2 = new Bitmap(bm.bmWidth, bm.bmHeight, bm.bmWidthBytes, PixelFormat.Format32bppRgb, bm.bmBits)) using (var g = Graphics.FromImage(o)) g.DrawImage(raw2, 0, 0, bm.bmWidth, bm.bmHeight);
            if (bottomUp) o.RotateFlip(RotateFlipType.RotateNoneFlipY);
            o.Save(outPng, ImageFormat.Png);
          }
        } else copy.Save(outPng, ImageFormat.Png);
      }
    } finally { DeleteObject(hbm); }
  }
  public static bool BottomUp = true;   // the shell hands back a bottom-up bitmap
  // Old programs only have small icons, which Windows draws tiny inside a faint frame.
  // Find the real icon (ignoring the frame near the edges), crop it and scale it up smoothly.
  static Bitmap Enlarge(Bitmap b) {
    int w = b.Width, h = b.Height, m = Math.Max(4, w / 32);
    int x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (int y = m; y < h - m; y++) for (int x = m; x < w - m; x++)
      if (b.GetPixel(x, y).A > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    int bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (bw > w * 0.45 || bh > h * 0.45) return null;              // already a proper large icon
    int target = (int)(w * 0.72), side = Math.Max(bw, bh);
    var outB = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(outB)) {
      g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
      g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
      float s = (float)target / side, dw = bw * s, dh = bh * s;
      g.DrawImage(b, new RectangleF((w - dw) / 2, (h - dh) / 2, dw, dh), new RectangleF(x0, y0, bw, bh), GraphicsUnit.Pixel);
    }
    return outB;
  }
}
'@
# ---------- Two-finger trackpad swipe (Precision Touchpad raw input) ----------
# Lively never passes trackpad swipes to the wallpaper, so we read the touchpad directly (Windows' official
# raw-input API for touchpads; touchpad only, no keyboard). When a two-finger horizontal swipe happens while
# the DESKTOP is in front, we press F13 (swipe left) or F14 (swipe right), which Lively forwards to the wallpaper.
Add-Type -ReferencedAssemblies System.Windows.Forms @'
using System; using System.Collections.Generic; using System.Runtime.InteropServices; using System.Text; using System.Windows.Forms;
public class TouchSwipe : NativeWindow {
  [StructLayout(LayoutKind.Sequential)] struct RAWINPUTDEVICE { public ushort usUsagePage, usUsage; public uint dwFlags; public IntPtr hwndTarget; }
  [StructLayout(LayoutKind.Sequential)] struct HIDP_CAPS { public ushort Usage, UsagePage, InputReportByteLength, OutputReportByteLength, FeatureReportByteLength;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 17)] public ushort[] Reserved;
    public ushort NumberLinkCollectionNodes, NumberInputButtonCaps, NumberInputValueCaps, NumberInputDataIndices, NumberOutputButtonCaps, NumberOutputValueCaps,
      NumberOutputDataIndices, NumberFeatureButtonCaps, NumberFeatureValueCaps, NumberFeatureDataIndices; }
  [DllImport("user32.dll")] static extern bool RegisterRawInputDevices(RAWINPUTDEVICE[] d, uint n, uint size);
  [DllImport("user32.dll")] static extern uint GetRawInputData(IntPtr h, uint cmd, IntPtr data, ref uint size, uint hdr);
  [DllImport("user32.dll")] static extern uint GetRawInputDeviceInfo(IntPtr dev, uint cmd, IntPtr data, ref uint size);
  [DllImport("hid.dll")] static extern int HidP_GetCaps(IntPtr pp, out HIDP_CAPS caps);
  [DllImport("hid.dll")] static extern int HidP_GetValueCaps(int type, IntPtr caps, ref ushort len, IntPtr pp);
  [DllImport("hid.dll")] static extern int HidP_GetUsageValue(int type, ushort page, ushort lc, ushort usage, out uint val, IntPtr pp, IntPtr report, uint len);
  [DllImport("hid.dll")] static extern int HidP_GetUsages(int type, ushort page, ushort lc, [Out] ushort[] list, ref uint len, IntPtr pp, IntPtr report, uint repLen);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  delegate IntPtr HookProc(int code, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id, HookProc proc, IntPtr mod, uint thread);
  [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr h, int code, IntPtr wParam, IntPtr lParam);
  [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string name);
  static HookProc hookProc, kbProc; static IntPtr hook, kbHook;
  static readonly HashSet<int> held = new HashSet<int>();
  static long lastSpace; static bool spaceDown;
  [StructLayout(LayoutKind.Sequential)] struct GUITHREADINFO { public int cbSize, flags; public IntPtr hwndActive, hwndFocus, hwndCapture, hwndMenuOwner, hwndMoveSize, hwndCaret; public int l, t, r, b; }
  [DllImport("user32.dll")] static extern bool GetGUIThreadInfo(uint thread, ref GUITHREADINFO info);
  static bool TypingInBox() {                          // e.g. renaming a file on the desktop: leave Space alone
    var gi = new GUITHREADINFO(); gi.cbSize = Marshal.SizeOf(typeof(GUITHREADINFO));
    if (!GetGUIThreadInfo(GetWindowThreadProcessId(GetForegroundWindow(), IntPtr.Zero), ref gi) || gi.hwndFocus == IntPtr.Zero) return false;
    string c = FgClass(gi.hwndFocus); return c.IndexOf("Edit", StringComparison.OrdinalIgnoreCase) >= 0 || gi.hwndCaret != IntPtr.Zero;
  }
  public static volatile bool LpOpen; public static bool KeyLog = false; static long pageSeen;
  public static bool WinKey = true; static bool winHeld, winAlone, lpShowedDesk;   // the Windows key on its own opens / closes Launchpad
  public static void Seen() { System.Threading.Interlocked.Exchange(ref pageSeen, DateTime.UtcNow.Ticks); }
  static bool PageAlive() { return DateTime.UtcNow.Ticks - System.Threading.Interlocked.Read(ref pageSeen) < 30000000; }        // a waiting poll refreshes this every second        // wallpaper connected in the last 3 s
  // event log with sequence numbers: each poll asks for "everything after N", so no key is ever dropped between polls
  static readonly object evLock = new object();
  static readonly List<KeyValuePair<long, string>> evLog = new List<KeyValuePair<long, string>>();
  static readonly List<long> evAt = new List<long>();
  static long evSeq = 0;
  static void ToggleDesktop() { try { var sh = Type.GetTypeFromProgID("Shell.Application"); var o = Activator.CreateInstance(sh); sh.InvokeMember("ToggleDesktop", System.Reflection.BindingFlags.InvokeMethod, null, o, null); } catch { } }
  // the Windows key: Launchpad from anywhere; pressed again, Launchpad closes and the windows it moved aside come back
  static void WinToggle() {
    if (LpOpen) { LpOpen = false; Send("{\"t\":\"toggle\"}"); if (lpShowedDesk) { lpShowedDesk = false; System.Threading.Thread.Sleep(250); ToggleDesktop(); } }
    else if (!SignalOverlay()) OpenLaunchpad();                                     // Launchpad over your windows (overlay.ps1); the desktop one if that isn't running
  }
  static System.Threading.EventWaitHandle ovSignal;
  static bool SignalOverlay() {
    try { if (ovSignal == null) ovSignal = System.Threading.EventWaitHandle.OpenExisting("Local\\ShadowLaunchpadToggle"); return ovSignal.Set(); }
    catch { ovSignal = null; return false; }
  }
  public static void OpenLaunchpad() {
    if (DeskState() == 0) {
      ToggleDesktop(); lpShowedDesk = true;
      System.Threading.Thread.Sleep(380);
    }
    FocusDesktop();
    if (!LpOpen) { LpOpen = true; Send("{\"t\":\"toggle\"}"); }
  }
  static void Send(string json) {
    lock (evLock) {
      evSeq++; evLog.Add(new KeyValuePair<long, string>(evSeq, json)); evAt.Add(DateTime.UtcNow.Ticks);
      while (evLog.Count > 0 && (evLog.Count > 400 || DateTime.UtcNow.Ticks - evAt[0] > 30000000)) { evLog.RemoveAt(0); evAt.RemoveAt(0); }   // keep 3 s
      System.Threading.Monitor.PulseAll(evLock);
    }
  }
  static string Js(string t) {
    var b = new StringBuilder("\"");
    foreach (char c in t) { if (c == '"' || c == '\\') b.Append('\\').Append(c); else if (c < 32) b.Append("\\u").Append(((int)c).ToString("x4")); else b.Append(c); }
    return b.Append('"').ToString();
  }
  static void SendPaste() {                            // the clipboard can only be read on an STA thread
    var th = new System.Threading.Thread(() => { string t = ""; try { if (Clipboard.ContainsText()) t = Clipboard.GetText(); } catch { } if (t.Length > 500) t = t.Substring(0, 500); Send("{\"t\":\"paste\",\"text\":" + Js(t) + "}"); });
    th.SetApartmentState(System.Threading.ApartmentState.STA); th.IsBackground = true; th.Start();
  }
  // held keys repeat sooner and steadier than Windows' default (which waits ~0.5 s): after 0.28 s, about 30 per second
  class HeldKey { public string json; public long down, last; public bool synth; }
  static readonly Dictionary<int, HeldKey> rep = new Dictionary<int, HeldKey>();
  static bool Repeatable(int vk, int ch) { return vk == 0x08 || vk == 0x2E || (vk >= 0x25 && vk <= 0x28) || ch != 0; }   // Backspace, Delete, arrows, characters
  static void StartRepeater() {
    var t = new System.Threading.Thread(() => {
      while (true) {
        System.Threading.Thread.Sleep(12);
        long now = DateTime.UtcNow.Ticks; var fire = new List<string>();
        lock (rep) {
          if (!LpOpen) { rep.Clear(); continue; }
          foreach (var hk in rep.Values) {
            if (now - hk.down > 100000000) continue;                                   // 10 s safety: a lost key-up never repeats forever
            if (now - hk.down >= 2800000 && now - hk.last >= 330000) { hk.synth = true; hk.last = now; fire.Add(hk.json); }
          }
        }
        foreach (var j in fire) Send(j);
      }
    });
    t.IsBackground = true; t.Start();
  }
  public static void StartEvents(int port, string token) {
    StartRepeater();
    var t = new System.Threading.Thread(() => {
      var l = new System.Net.HttpListener(); l.Prefixes.Add("http://localhost:" + port + "/");
      try { l.Start(); } catch (Exception e) { Log("event channel failed: " + e.Message); return; }
      Log("event channel on port " + port);
      while (l.IsListening) {
        System.Net.HttpListenerContext ctx; try { ctx = l.GetContext(); } catch { continue; }
        System.Threading.ThreadPool.QueueUserWorkItem(_ => { try { ServeWait(ctx, token); } catch { try { ctx.Response.Abort(); } catch { } } });
      }
    });
    t.IsBackground = true; t.Start();
  }
  // YouTube Music's own public search (the same request music.youtube.com makes): songs, videos, albums, playlists, artists
  const string UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  static string ytVer;
  static string JsQ(string v) {
    var sb = new StringBuilder("\"");
    foreach (char ch in v) { if (ch == '"' || ch == '\\') sb.Append('\\').Append(ch); else if (ch < ' ') sb.Append(' '); else sb.Append(ch); }
    return sb.Append('"').ToString();
  }
  static string YtSearch(string q, string gl, string prm = null) {   // prm: a search filter (videos only, ...)
    q = q.Trim(); if (q.Length == 0 || q.Length > 200) throw new Exception("bad query");
    if (!System.Text.RegularExpressions.Regex.IsMatch(gl, "^[A-Z]{2}$")) gl = "US";
    System.Net.ServicePointManager.SecurityProtocol |= System.Net.SecurityProtocolType.Tls12;
    if (ytVer == null) {                                   // the site's current client version (fallback: a known one)
      ytVer = "1.20261117.06.00";
      try { var wc = new System.Net.WebClient(); wc.Headers["User-Agent"] = UA; wc.Encoding = Encoding.UTF8;
            var m = System.Text.RegularExpressions.Regex.Match(wc.DownloadString("https://music.youtube.com/"), "\"INNERTUBE_CLIENT_VERSION\":\"([0-9.]+)\"");
            if (m.Success) ytVer = m.Groups[1].Value; } catch { }
    }
    var json = "{\"context\":{\"client\":{\"clientName\":\"WEB_REMIX\",\"clientVersion\":\"" + ytVer + "\",\"hl\":\"en\",\"gl\":\"" + gl + "\"}},\"query\":" + JsQ(q) + (prm != null ? ",\"params\":\"" + prm + "\"" : "") + "}";
    var r = (System.Net.HttpWebRequest)System.Net.WebRequest.Create("https://music.youtube.com/youtubei/v1/search?prettyPrint=false");
    r.Method = "POST"; r.ContentType = "application/json"; r.UserAgent = UA; r.Headers["Origin"] = "https://music.youtube.com"; r.Timeout = 9000;
    r.AutomaticDecompression = System.Net.DecompressionMethods.GZip | System.Net.DecompressionMethods.Deflate;
    var b = Encoding.UTF8.GetBytes(json); using (var st = r.GetRequestStream()) st.Write(b, 0, b.Length);
    using (var resp = r.GetResponse()) using (var rd = new System.IO.StreamReader(resp.GetResponseStream(), Encoding.UTF8)) return rd.ReadToEnd();
  }
  // YouTube Music's "up next" for a song (its radio, or the rest of a playlist): lets the wallpaper load the next covers and lyrics early
  static void ServeYtNext(System.Net.HttpListenerRequest req, System.Net.HttpListenerResponse res) {
    string v = req.QueryString["v"] ?? "", list = req.QueryString["list"] ?? "";
    var id = new System.Text.RegularExpressions.Regex("^[A-Za-z0-9_-]{1,80}$");
    if (!id.IsMatch(v)) { res.StatusCode = 400; res.Close(); return; }
    string json;
    try {
      System.Net.ServicePointManager.SecurityProtocol |= System.Net.SecurityProtocolType.Tls12;
      if (ytVer == null) YtSearch("a", "US");                            // learns the client version
      string body = "{\"context\":{\"client\":{\"clientName\":\"WEB_REMIX\",\"clientVersion\":\"" + ytVer + "\",\"hl\":\"en\"}},\"videoId\":\"" + v + "\",\"playlistId\":\"" + (id.IsMatch(list) ? list : "RDAMVM" + v) + "\",\"isAudioOnly\":true}";
      var r = (System.Net.HttpWebRequest)System.Net.WebRequest.Create("https://music.youtube.com/youtubei/v1/next?prettyPrint=false");
      r.Method = "POST"; r.ContentType = "application/json"; r.UserAgent = UA; r.Headers["Origin"] = "https://music.youtube.com"; r.Timeout = 9000;
      r.AutomaticDecompression = System.Net.DecompressionMethods.GZip | System.Net.DecompressionMethods.Deflate;
      var b = Encoding.UTF8.GetBytes(body); using (var st = r.GetRequestStream()) st.Write(b, 0, b.Length);
      using (var resp = r.GetResponse()) using (var rd = new System.IO.StreamReader(resp.GetResponseStream(), Encoding.UTF8)) json = rd.ReadToEnd();
    } catch (Exception e) { Log("ytnext: " + e.Message); res.StatusCode = 502; res.Close(); return; }
    var bytes = Encoding.UTF8.GetBytes(json); res.ContentType = "application/json; charset=utf-8"; res.StatusCode = 200; res.OutputStream.Write(bytes, 0, bytes.Length); res.Close();
  }
  // YouTube Music's synced lyrics for a track: its "next" names the lyrics page, the phone app's client gets the timed version of it
  static string YtPost(string path, string body, string ua) {
    var r = (System.Net.HttpWebRequest)System.Net.WebRequest.Create("https://music.youtube.com/youtubei/v1/" + path + "?prettyPrint=false");
    r.Method = "POST"; r.ContentType = "application/json"; r.UserAgent = ua; r.Headers["Origin"] = "https://music.youtube.com"; r.Timeout = 9000;
    r.AutomaticDecompression = System.Net.DecompressionMethods.GZip | System.Net.DecompressionMethods.Deflate;
    var b = Encoding.UTF8.GetBytes(body); using (var st = r.GetRequestStream()) st.Write(b, 0, b.Length);
    using (var resp = r.GetResponse()) using (var rd = new System.IO.StreamReader(resp.GetResponseStream(), Encoding.UTF8)) return rd.ReadToEnd();
  }
  static void ServeYtLyrics(System.Net.HttpListenerRequest req, System.Net.HttpListenerResponse res) {
    string v = req.QueryString["v"] ?? "";
    if (!System.Text.RegularExpressions.Regex.IsMatch(v, "^[A-Za-z0-9_-]{6,20}$")) { res.StatusCode = 400; res.Close(); return; }
    string json = null;
    try {
      System.Net.ServicePointManager.SecurityProtocol |= System.Net.SecurityProtocolType.Tls12;
      if (ytVer == null) YtSearch("a", "US");
      string nx = YtPost("next", "{\"context\":{\"client\":{\"clientName\":\"WEB_REMIX\",\"clientVersion\":\"" + ytVer + "\",\"hl\":\"en\"}},\"videoId\":\"" + v + "\",\"isAudioOnly\":true}", UA);
      var m = System.Text.RegularExpressions.Regex.Match(nx, "\"browseId\":\"(MPLY[A-Za-z0-9_-]+)\"");
      if (m.Success) {
        string[][] clients = { new[] { "IOS_MUSIC", "7.27.0", "com.google.ios.youtubemusic/7.27.0 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)" },
                               new[] { "ANDROID_MUSIC", "7.27.52", "com.google.android.apps.youtube.music/7.27.52 (Linux; U; Android 14) gzip" } };
        foreach (var c in clients) {
          string br = YtPost("browse", "{\"context\":{\"client\":{\"clientName\":\"" + c[0] + "\",\"clientVersion\":\"" + c[1] + "\",\"hl\":\"en\"}},\"browseId\":\"" + m.Groups[1].Value + "\"}", c[2]);
          if (br.Contains("\"lyricLine\"")) { json = br; break; }
        }
      }
    } catch (Exception e) { Log("ytlyrics: " + e.Message); }
    if (json == null) { res.StatusCode = 404; res.Close(); return; }
    var bytes = Encoding.UTF8.GetBytes(json); res.ContentType = "application/json; charset=utf-8"; res.StatusCode = 200; res.OutputStream.Write(bytes, 0, bytes.Length); res.Close();
  }
  // A video's storyboard (YouTube's seek-preview frames): its description from the video's page, and its picture sheets passed
  // through (YouTube doesn't let a page read their pixels directly) - the wallpaper's stripes take the colour of the frame on screen
  static readonly System.Collections.Generic.Dictionary<string, string> sbSpecs = new System.Collections.Generic.Dictionary<string, string>();
  static void ServeYtSb(System.Net.HttpListenerRequest req, System.Net.HttpListenerResponse res) {
    string v = req.QueryString["v"] ?? "";
    if (!System.Text.RegularExpressions.Regex.IsMatch(v, "^[A-Za-z0-9_-]{6,20}$")) { res.StatusCode = 400; res.Close(); return; }
    string spec; lock (sbSpecs) sbSpecs.TryGetValue(v, out spec);
    if (spec == null) {
      try {
        System.Net.ServicePointManager.SecurityProtocol |= System.Net.SecurityProtocolType.Tls12;
        var r = (System.Net.HttpWebRequest)System.Net.WebRequest.Create("https://www.youtube.com/watch?v=" + v + "&hl=en");
        r.UserAgent = UA; r.Headers["Accept-Language"] = "en"; r.Headers["Cookie"] = "CONSENT=YES+; SOCS=CAI"; r.Timeout = 9000;
        r.AutomaticDecompression = System.Net.DecompressionMethods.GZip | System.Net.DecompressionMethods.Deflate;
        string html; using (var resp = r.GetResponse()) using (var rd = new System.IO.StreamReader(resp.GetResponseStream(), Encoding.UTF8)) html = rd.ReadToEnd();
        var m = System.Text.RegularExpressions.Regex.Match(html, "\"playerStoryboardSpecRenderer\":\\{\"spec\":\"([^\"]+)\"");
        spec = m.Success ? m.Groups[1].Value.Replace("\\u0026", "&") : "";
        lock (sbSpecs) { sbSpecs[v] = spec; if (sbSpecs.Count > 200) sbSpecs.Clear(); }
      } catch (Exception e) { Log("ytsb: " + e.Message); spec = ""; }
    }
    var bytes = Encoding.UTF8.GetBytes("{\"spec\":\"" + spec.Replace("\\", "").Replace("\"", "") + "\"}");
    res.ContentType = "application/json; charset=utf-8"; res.StatusCode = 200; res.OutputStream.Write(bytes, 0, bytes.Length); res.Close();
  }
  static void ServeYtSbImg(System.Net.HttpListenerRequest req, System.Net.HttpListenerResponse res) {
    string u = req.QueryString["u"] ?? "";
    if (!u.StartsWith("https://i.ytimg.com/sb/")) { res.StatusCode = 400; res.Close(); return; }   // only YouTube's storyboard pictures
    try {
      var r = (System.Net.HttpWebRequest)System.Net.WebRequest.Create(u); r.UserAgent = UA; r.Timeout = 9000;
      using (var resp = (System.Net.HttpWebResponse)r.GetResponse()) using (var st = resp.GetResponseStream()) using (var ms = new System.IO.MemoryStream()) {
        st.CopyTo(ms); var b = ms.ToArray(); res.ContentType = resp.ContentType; res.StatusCode = 200; res.OutputStream.Write(b, 0, b.Length);
      }
    } catch (Exception e) { Log("ytsbimg: " + e.Message); res.StatusCode = 502; }
    res.Close();
  }
  // A tiny page hosting YouTube's player for the wallpaper (YouTube won't play inside a local file, it does on localhost).
  // Always muted - the sound comes from the real player; the wallpaper keeps it in step with postMessage({cmd:'sync',pos,playing}).
  static void ServeEmbed(System.Net.HttpListenerRequest req, System.Net.HttpListenerResponse res, string token) {
    string v = req.QueryString["v"] ?? ""; double s0; double.TryParse(req.QueryString["s"] ?? "0", System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out s0);
    if (!System.Text.RegularExpressions.Regex.IsMatch(v, "^[A-Za-z0-9_-]{6,20}$")) { res.StatusCode = 400; res.Close(); return; }
    string html = "<!doctype html><html><head><meta charset=utf-8><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#p,iframe{position:absolute;left:50%;top:50%;width:1920px;height:1080px;border:0;translate:-50% -50%;scale:var(--s,1)}</style></head><body><div id=p></div>" +
      // the address carries the helper's key: dropped before YouTube's player reads it. A full-HD player shrunk to fit (YouTube picks
      // the quality from the player's size). The ready-callback is defined BEFORE YouTube's script loads: from the cache it can run
      // at once, and a callback defined after it is never called (the player then never appears).
      "<script>history.replaceState(null,'',location.pathname);const fit=()=>document.documentElement.style.setProperty('--s',Math.max(innerWidth/1920,innerHeight/1080));fit();addEventListener('resize',fit);" +
      "let want=true,pl,ok=false,ls=0,warm=" + (req.QueryString["w"] == "1" ? "true" : "false") + ";const nocc=()=>{try{pl.setOption('captions','track',{});pl.unloadModule('captions');pl.unloadModule('cc')}catch(_){}};" +
      "function init(){if(pl||!window.YT||!YT.Player)return;pl=new YT.Player('p',{videoId:'" + v + "',host:'https://www.youtube-nocookie.com'," +
      "playerVars:{autoplay:1,mute:1,controls:0,disablekb:1,fs:0,iv_load_policy:3,modestbranding:1,playsinline:1,rel:0,cc_load_policy:0,cc_lang_pref:'zz',start:" + ((int)Math.Max(0, s0)).ToString() + "}," +
      "events:{onReady:e=>{ok=true;e.target.mute();nocc();if(want)e.target.playVideo();else e.target.pauseVideo();parent.postMessage({t:'yt',ev:'ready'},'*')},onError:e=>parent.postMessage({t:'yt',ev:'error',code:e.data},'*')," +
      "onApiChange:nocc,onStateChange:e=>{if(warm&&e.data===1){warm=false;pl.pauseVideo();pl.seekTo(0,true);nocc();return}if(!want&&(e.data===1||e.data===3))pl.pauseVideo();if(e.data===1){nocc();setTimeout(nocc,1500);setTimeout(nocc,5000)}parent.postMessage({t:'yt',ev:'state',s:e.data},'*')}}})}" +
      "window.onYouTubeIframeAPIReady=init</script><script src='https://www.youtube.com/iframe_api'></script>" +
      "<script>if(window.YT&&YT.loaded)init();setTimeout(init,1500);setTimeout(init,4000);" +
      // kept in step with the real player - but only moved while it actually plays (moving a loading player restarts its loading)
      "addEventListener('message',e=>{const m=e.data||{};if(ok&&m.cmd==='kick'){pl.seekTo(Math.max(0,(m.pos!=null?m.pos:pl.getCurrentTime())),true);if(m.playing)pl.playVideo();return}if(ok&&m.cmd==='load'&&/^[A-Za-z0-9_-]{6,20}$/.test(m.v)){want=true;fresh=1;ls=Date.now();pl.loadVideoById({videoId:m.v,startSeconds:Math.max(0,m.pos||0)});pl.mute();pl.playVideo();return}});" +
      // in step with the song: the drift is measured on every sync (median of the last 5, so one stale reading never jumps it) and put
      // right past 0.2 s; each jump lands where the song will be once YouTube has seeked (lag, learned from how the last jump landed)
      "let ds=[],lag=.3,ck=0,fresh=1;addEventListener('message',e=>{const m=e.data||{};if(m.cmd==='fresh'){fresh=1;return}if(m.cmd==='sync')want=!!m.playing;if(!ok||m.cmd!=='sync')return;const s=pl.getPlayerState(),n=Date.now(),d=pl.getCurrentTime()-m.pos;" +
      "if(fresh&&s===1&&m.playing){fresh=0;if(Math.abs(d)>.12){ls=n;ds=[];ck=1;pl.seekTo(Math.max(0,m.pos+lag),true)}}" +
      "if(s===1&&n-ls>1200){ds.push(d);if(ds.length>5)ds.shift()}else if(s!==1)ds=[];const md=ds.length>=3?[...ds].sort((a,b)=>a-b)[ds.length>>1]:0;" +
      "if(ds.length>=3&&n-(window._dl||0)>3000){window._dl=n;parent.postMessage({t:'yt',ev:'drift',d:+md.toFixed(3),lag:+lag.toFixed(2)},'*')}if(ck&&ds.length>=3){lag=Math.max(0,Math.min(1.2,lag-md*.7));ck=0}" +
      "if(n-ls>2200&&((s===1&&ds.length>=3&&Math.abs(md)>.2)||(s===2&&Math.abs(d)>.6))){ls=n;ds=[];ck=s===1?1:0;pl.seekTo(Math.max(0,m.pos+(s===1?lag:0)),true)}" +
      "if(m.playing){if(s!==1&&s!==3)pl.playVideo()}else if(s!==2&&s!==0)pl.pauseVideo()})</script></body></html>";
    var bytes = Encoding.UTF8.GetBytes(html); res.ContentType = "text/html; charset=utf-8"; res.StatusCode = 200; res.OutputStream.Write(bytes, 0, bytes.Length); res.Close();
  }
  static void ServeYtm(System.Net.HttpListenerRequest req, System.Net.HttpListenerResponse res) {
    string json; try { json = YtSearch(req.QueryString["q"] ?? "", req.QueryString["gl"] ?? "", req.QueryString["f"] == "v" ? "EgWKAQIQAWoMEA4QChADEAQQCRAF" : null); } catch (Exception e) { Log("ytm: " + e.Message); res.StatusCode = 502; res.Close(); return; }
    var bytes = Encoding.UTF8.GetBytes(json); res.ContentType = "application/json; charset=utf-8"; res.StatusCode = 200; res.OutputStream.Write(bytes, 0, bytes.Length); res.Close();
  }
  // the colours of the video as it plays, read straight off the screen where the wallpaper shows it (the player is YouTube's,
  // so the page can't read its pixels): 12 columns, left to right, each the average of its slice
  static void ServeVCol(System.Net.HttpListenerRequest req, System.Net.HttpListenerResponse res) {
    int x, y, w, h; string json = "{}";
    if (int.TryParse(req.QueryString["x"], out x) && int.TryParse(req.QueryString["y"], out y) && int.TryParse(req.QueryString["w"], out w) && int.TryParse(req.QueryString["h"], out h) && w > 8 && h > 8) {
      try { json = req.Url.AbsolutePath == "/vedge" ? VCol.Edges(x, y, w, h) : VCol.Cols(x, y, w, h); } catch (Exception e) { Log("vcol: " + e.Message); }
    }
    var bytes = Encoding.UTF8.GetBytes(json); res.ContentType = "application/json"; res.StatusCode = 200; res.OutputStream.Write(bytes, 0, bytes.Length); res.Close();
  }
  public static Func<System.Net.HttpListenerRequest, System.Net.HttpListenerResponse, bool> Extra;
  static void ServeWait(System.Net.HttpListenerContext ctx, string token) {
    var req = ctx.Request; var res = ctx.Response;
    res.AddHeader("Access-Control-Allow-Origin", "*"); res.AddHeader("Cache-Control", "no-store");
    if (req.QueryString["t"] != token) { res.StatusCode = 403; res.Close(); return; }
    if (req.Url.AbsolutePath == "/lpstate") { LpOpen = req.QueryString["open"] == "1"; Seen(); res.StatusCode = 204; res.Close(); return; }   // instant: no key slips past while Launchpad opens
    if (req.Url.AbsolutePath == "/ytm") { ServeYtm(req, res); return; }
    if (req.Url.AbsolutePath == "/ytnext") { ServeYtNext(req, res); return; }
    if (req.Url.AbsolutePath == "/ytlyrics") { ServeYtLyrics(req, res); return; }
    if (req.Url.AbsolutePath == "/ytsb") { ServeYtSb(req, res); return; }
    if (req.Url.AbsolutePath == "/ytsbimg") { ServeYtSbImg(req, res); return; }
    if (req.Url.AbsolutePath == "/embed") { ServeEmbed(req, res, token); return; }
    if (req.Url.AbsolutePath == "/lpopen") { res.StatusCode = 204; res.Close(); OpenLaunchpad(); return; }
    if (req.Url.AbsolutePath == "/vcol" || req.Url.AbsolutePath == "/vedge") { ServeVCol(req, res); return; }   // the video's colours, live, for the stripes' backlight
    if (Extra != null && Extra(req, res)) return;                                // Launchpad search: files, recent files, web suggestions, Store (class Finder)
    if (req.Url.AbsolutePath != "/wait") { res.StatusCode = 404; res.Close(); return; }
    long since; if (!long.TryParse(req.QueryString["since"], out since)) since = -1;
    Seen();
    string body;
    lock (evLock) {
      if (since < 0 || since > evSeq) body = "{\"seq\":" + evSeq + ",\"evs\":[]}";                 // first call: just learn where we are
      else {
        DateTime until = DateTime.UtcNow.AddSeconds(20);
        while (evSeq <= since) { int ms = (int)(until - DateTime.UtcNow).TotalMilliseconds; if (ms <= 0) break; System.Threading.Monitor.Wait(evLock, Math.Min(ms, 1000)); Seen(); }
        var sb = new StringBuilder("{\"seq\":" + evSeq + ",\"evs\":["); bool first = true;
        foreach (var kv in evLog) if (kv.Key > since) { if (!first) sb.Append(','); sb.Append(kv.Value); first = false; }
        body = sb.Append("]}").ToString();
      }
    }
    var b = Encoding.UTF8.GetBytes(body); res.ContentType = "application/json"; res.ContentLength64 = b.Length;
    res.OutputStream.Write(b, 0, b.Length); res.Close();
  }
  static bool Bridged(int vk) {                       // keys that stay with Windows even while Launchpad is open
    if ((vk >= 0x10 && vk <= 0x14) || (vk >= 0xA0 && vk <= 0xA5) || vk == 0x5B || vk == 0x5C || vk == 0x5D) return false;   // modifiers, caps, Win, menu
    if ((vk >= 0x70 && vk <= 0x87) || (vk >= 0xA6 && vk <= 0xB7) || vk == 0x2C || vk == 0x90 || vk == 0x91 || vk == 0xFF || vk == 0) return false;  // F-keys, media, PrtSc
    return true;
  }
  [DllImport("user32.dll")] static extern int ToUnicodeEx(uint vk, uint scan, byte[] state, StringBuilder buf, int n, uint flags, IntPtr layout);
  [DllImport("user32.dll")] static extern IntPtr GetKeyboardLayout(uint thread);
  [DllImport("user32.dll")] static extern short GetKeyState(int vk);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetShellWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr pid);
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool attach);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vk);

  // The wallpaper only gets keys while the desktop itself is the active window. When you are "on the desktop" but
  // the taskbar, nothing, or a minimised window is active, make the desktop active first (no click needed).
  static string FgClass(IntPtr h) { var sb = new StringBuilder(64); GetClassName(h, sb, 64); return sb.ToString(); }
  public static int DeskState() {             // 2 = desktop active, 1 = desktop showing but not active, 0 = an app is in front
    IntPtr h = GetForegroundWindow(); string c = h == IntPtr.Zero ? "" : FgClass(h);
    if (c == "Progman" || c == "WorkerW") return 2;
    if (c == "" || c == "Shell_TrayWnd" || c == "Shell_SecondaryTrayWnd" || IsIconic(h) || !IsWindowVisible(h)) return 1;
    return 0;
  }
  public static bool FocusDesktop() {
    IntPtr d = GetShellWindow(); if (d == IntPtr.Zero) return false;
    IntPtr fg = GetForegroundWindow(); uint me = GetCurrentThreadId(), other = fg == IntPtr.Zero ? 0 : GetWindowThreadProcessId(fg, IntPtr.Zero);
    bool att = other != 0 && other != me && AttachThreadInput(me, other, true);
    bool ok = SetForegroundWindow(d);
    if (att) AttachThreadInput(me, other, false);
    return ok && DeskState() == 2;
  }
  static void Tap(byte vk) { keybd_event(vk, 0, 0, UIntPtr.Zero); keybd_event(vk, 0, 2, UIntPtr.Zero); }

  class Dev { public IntPtr pp; public List<ushort> fingers = new List<ushort>(); public int xMax = 1; public ushort page; }
  readonly Dictionary<IntPtr, Dev> devs = new Dictionary<IntPtr, Dev>();
  readonly Dictionary<uint, int> startX = new Dictionary<uint, int>(), lastX = new Dictionary<uint, int>();
  int count = 0; DateTime countAt = DateTime.MinValue, gestureAt = DateTime.MinValue, firedAt = DateTime.MinValue; bool fired;
  public static string LogPath; public static int Reports, Fires;
  public static void Note(string m) { Log(m); }
  public static readonly System.Collections.Concurrent.ConcurrentQueue<string> Events = new System.Collections.Concurrent.ConcurrentQueue<string>();
  static void Log(string m) { try { if (LogPath != null) System.IO.File.AppendAllText(LogPath, DateTime.Now.ToString("HH:mm:ss.fff ") + m + "\r\n"); } catch { } }

  public static void Start() {
    var t = new System.Threading.Thread(() => {
      try {
        var me = new TouchSwipe();
        hookProc = (code, wp, lp) => {                                   // mouse only: horizontal scroll messages
          if (code >= 0 && (int)wp == 0x020E) me.HWheel((short)((Marshal.ReadInt32(lp, 8) >> 16) & 0xFFFF), "hook");
          if (code >= 0 && (int)wp == 0x020A) me.VWheel((short)((Marshal.ReadInt32(lp, 8) >> 16) & 0xFFFF), Marshal.ReadInt32(lp, 0), Marshal.ReadInt32(lp, 4));   // scroll on the desktop: Clock <-> Now Playing
          if (code >= 0 && (int)wp == 0x0201) me.LClick(Marshal.ReadInt32(lp, 0), Marshal.ReadInt32(lp, 4));                                                 // double-click on empty desktop: Launchpad
          return CallNextHookEx(hook, code, wp, lp);
        };
        hook = SetWindowsHookEx(14, hookProc, GetModuleHandle(null), 0);
        // F4 on the desktop opens/closes Launchpad, and while Launchpad is open every key goes straight to it.
        // Both travel over the wallpaper's /wait connection, so nothing depends on Lively forwarding keys
        // (which needs a click on the wallpaper first).
        kbProc = (code, wp, lp) => {
          if (code < 0) return CallNextHookEx(kbHook, code, wp, lp);
          int vk = Marshal.ReadInt32(lp, 0), scan = Marshal.ReadInt32(lp, 4), flags = Marshal.ReadInt32(lp, 8), msg = (int)wp;
          if ((flags & 0x10) != 0) return CallNextHookEx(kbHook, code, wp, lp);                               // injected: leave alone
          bool down = msg == 0x100 || msg == 0x104, up = msg == 0x101 || msg == 0x105;
          // Alt+Down / Alt+Up on the desktop: Now Playing / the clock (for keyboards without a trackpad's swipe)
          if (down && !LpOpen && (vk == 0x26 || vk == 0x28) && (AsyncKey(0x12) & 0x8000) != 0 && (AsyncKey(0x11) & 0x8000) == 0 && (AsyncKey(0x5B) & 0x8000) == 0 && DeskState() == 2 && PageAlive()) {
            Send("{\"t\":\"page\",\"to\":\"" + (vk == 0x28 ? "np" : "clock") + "\"}"); return (IntPtr)1;
          }
          // The Windows key pressed and released on its own: Launchpad instead of Start. The key itself is never blocked
          // (Win+E, Win+D... all still work); a do-nothing key tapped just before it lifts tells Windows a shortcut was
          // used, so Start stays shut. (Ctrl+Esc still opens Start.)
          if (WinKey && (vk == 0x5B || vk == 0x5C)) {
            if (down) { if (!winHeld) { winHeld = true; winAlone = true; } }
            else if (up) {
              winHeld = false;
              if (winAlone) { winAlone = false; keybd_event(0xE8, 0, 0, UIntPtr.Zero); keybd_event(0xE8, 0, 2, UIntPtr.Zero); System.Threading.ThreadPool.QueueUserWorkItem(_ => WinToggle()); }
            }
            return CallNextHookEx(kbHook, code, wp, lp);
          }
          if (down && winHeld) winAlone = false;                                                               // Win + another key: a shortcut, not Launchpad
          if (KeyLog && down && !(vk >= 0x30 && vk <= 0x5A) && vk != 0x20 && !(vk >= 0xBA && vk <= 0xE2) && !(vk >= 0x08 && vk <= 0x2E))
            Log("key vk=0x" + vk.ToString("X2") + " scan=0x" + scan.ToString("X2") + " flags=0x" + flags.ToString("X2"));
          if (up) { if (vk == 0x20) spaceDown = false; lock (rep) rep.Remove(vk); lock (held) { if (held.Remove(vk)) return (IntPtr)1; } return CallNextHookEx(kbHook, code, wp, lp); }
          if (!down) return CallNextHookEx(kbHook, code, wp, lp);
          bool alt = (flags & 0x20) != 0 || GetAsyncKeyState(0x12) < 0, ctrl = GetAsyncKeyState(0x11) < 0, shift = GetAsyncKeyState(0x10) < 0,
               win = GetAsyncKeyState(0x5B) < 0 || GetAsyncKeyState(0x5C) < 0;
          if (vk == 0x73 && !alt && !ctrl && !shift && !win) {                                                  // plain F4 (Alt+F4 never touched)
            int ds = DeskState();
            if (ds > 0) {
              lock (held) { if (held.Contains(vk)) return (IntPtr)1; held.Add(vk); }                            // held down: no repeats
              Log("F4 | desktop state " + ds); LpOpen = !LpOpen; Send("{\"t\":\"toggle\"}");
              if (ds == 1) System.Threading.ThreadPool.QueueUserWorkItem(_ => FocusDesktop());
              return (IntPtr)1;
            }
            return CallNextHookEx(kbHook, code, wp, lp);
          }
          if (vk == 0x20 && !alt && !ctrl && !shift && !win && !LpOpen) {
            bool repeat = spaceDown; spaceDown = true;
            int ds2 = DeskState();
            if (!repeat && ds2 > 0 && !TypingInBox()) {
              long now = DateTime.UtcNow.Ticks;
              if (now - lastSpace < 3800000) {                                                                 // second tap within 380 ms
                lastSpace = 0; lock (held) held.Add(vk); Log("double space | desktop state " + ds2); LpOpen = true; Send("{\"t\":\"toggle\"}");
                if (ds2 == 1) System.Threading.ThreadPool.QueueUserWorkItem(_ => FocusDesktop());
                return (IntPtr)1;
              }
              lastSpace = now;
            }
            return CallNextHookEx(kbHook, code, wp, lp);
          }
          if (LpOpen && PageAlive() && !alt && !win && Bridged(vk) && DeskState() > 0) {
            bool again; lock (held) { again = held.Contains(vk); held.Add(vk); }                   // again = Windows' own auto-repeat
            if (again) { lock (rep) { HeldKey hk; if (rep.TryGetValue(vk, out hk) && hk.synth) return (IntPtr)1; } }   // our faster repeat has taken over
            if (ctrl && vk == 0x56) { if (!again) SendPaste(); return (IntPtr)1; }               // Ctrl+V (once per press)
            int ch = 0;
            if (!ctrl) {
              var st = new byte[256]; if (shift) st[0x10] = 0x80; if ((GetKeyState(0x14) & 1) != 0) st[0x14] = 1;
              var sb = new StringBuilder(8);
              int n = ToUnicodeEx((uint)vk, (uint)scan, st, sb, 8, 4, GetKeyboardLayout(GetWindowThreadProcessId(GetForegroundWindow(), IntPtr.Zero)));
              if (n == 1 && sb[0] >= 32) ch = sb[0];
            }
            string kj = "{\"t\":\"key\",\"vk\":" + vk + ",\"ch\":" + ch + ",\"ctrl\":" + (ctrl ? 1 : 0) + ",\"shift\":" + (shift ? 1 : 0) + "}";
            if (Repeatable(vk, ch)) lock (rep) { HeldKey hk; long t0 = DateTime.UtcNow.Ticks; if (rep.TryGetValue(vk, out hk)) hk.last = t0; else rep[vk] = new HeldKey { json = kj, down = t0, last = t0 }; }
            Send(kj);
            return (IntPtr)1;
          }
          return CallNextHookEx(kbHook, code, wp, lp);
        };
        kbHook = SetWindowsHookEx(13, kbProc, GetModuleHandle(null), 0);
        Log("keyboard listener: " + (kbHook != IntPtr.Zero));
        Log("mouse-scroll listener: " + (hook != IntPtr.Zero));
        Application.Run();
      } catch (Exception e) { Log("swipe thread error: " + e.Message); }
    });
    t.IsBackground = true; t.SetApartmentState(System.Threading.ApartmentState.STA); t.Start();
  }
  TouchSwipe() {
    var cp = new CreateParams(); cp.Style = unchecked((int)0x80000000); cp.ExStyle = 0x80; CreateHandle(cp);   // hidden tool window
    var rid = new RAWINPUTDEVICE[] {
      new RAWINPUTDEVICE { usUsagePage = 0x0D, usUsage = 0x05, dwFlags = 0x100, hwndTarget = Handle },          // touchpad contacts
      new RAWINPUTDEVICE { usUsagePage = 0x01, usUsage = 0x02, dwFlags = 0x100, hwndTarget = Handle },          // mouse channel (horizontal scroll)
      new RAWINPUTDEVICE { usUsagePage = 0x0C, usUsage = 0x01, dwFlags = 0x100, hwndTarget = Handle } };        // consumer keys (diagnostics)
    bool ok = RegisterRawInputDevices(rid, 3, (uint)Marshal.SizeOf(typeof(RAWINPUTDEVICE)));
    Log("touchpad listener registered: " + ok);
  }
  protected override void WndProc(ref Message m) { if (m.Msg == 0x00FF) { try { OnInput(m.LParam); } catch (Exception e) { Log("input error: " + e.Message); } } base.WndProc(ref m); }

  Dev GetDev(IntPtr h) {
    Dev d; if (devs.TryGetValue(h, out d)) return d;
    d = new Dev(); uint sz = 0; GetRawInputDeviceInfo(h, 0x20000005, IntPtr.Zero, ref sz);
    d.pp = Marshal.AllocHGlobal((int)sz); GetRawInputDeviceInfo(h, 0x20000005, d.pp, ref sz);
    HIDP_CAPS caps; HidP_GetCaps(d.pp, out caps); d.page = caps.UsagePage;
    ushort n = caps.NumberInputValueCaps; IntPtr vc = Marshal.AllocHGlobal(72 * Math.Max(1, (int)n));
    HidP_GetValueCaps(0, vc, ref n, d.pp);
    for (int i = 0; i < n; i++) {
      IntPtr c = vc + 72 * i; ushort page = (ushort)Marshal.ReadInt16(c, 0), lc = (ushort)Marshal.ReadInt16(c, 6), usage = (ushort)Marshal.ReadInt16(c, 56);
      if (page == 0x01 && usage == 0x30) { d.fingers.Add(lc); d.xMax = Math.Max(d.xMax, Marshal.ReadInt32(c, 44)); }
    }
    Marshal.FreeHGlobal(vc); devs[h] = d;
    if (d.page == 0x0D) Log("touchpad found: finger slots " + d.fingers.Count + ", width " + d.xMax);
    return d;
  }
  void OnInput(IntPtr hRaw) {
    uint hdr = (uint)(8 + 2 * IntPtr.Size), size = 0;
    GetRawInputData(hRaw, 0x10000003, IntPtr.Zero, ref size, hdr);
    IntPtr buf = Marshal.AllocHGlobal((int)size);
    try {
      if (GetRawInputData(hRaw, 0x10000003, buf, ref size, hdr) != size) return;
      int type = Marshal.ReadInt32(buf, 0);
      if (type == 0) {                                                               // RIM_TYPEMOUSE
        ushort flags = (ushort)Marshal.ReadInt16(buf, (int)hdr + 4);
        if ((flags & 0x0800) != 0) HWheel(Marshal.ReadInt16(buf, (int)hdr + 6), "raw-mouse");   // RI_MOUSE_HWHEEL
        return;
      }
      if (type != 2) return;                                                         // RIM_TYPEHID
      IntPtr dev = Marshal.ReadIntPtr(buf, 8); Dev d = GetDev(dev);
      if (d.page != 0x0D) {
        if (KeyLog) { int o2 = (int)hdr; uint rs = (uint)Marshal.ReadInt32(buf, o2); var bytes = new byte[Math.Min(rs, 16)]; Marshal.Copy(buf + o2 + 8, bytes, 0, bytes.Length);
          Log("consumer key report page 0x" + d.page.ToString("X2") + ": " + BitConverter.ToString(bytes)); }
        return;
      }
      int off = (int)hdr; uint repSize = (uint)Marshal.ReadInt32(buf, off), repCount = (uint)Marshal.ReadInt32(buf, off + 4);
      for (uint r = 0; r < repCount; r++) Handle1(d, buf + off + 8 + (int)(r * repSize), repSize);
    } finally { Marshal.FreeHGlobal(buf); }
  }
  void Handle1(Dev d, IntPtr rep, uint len) {
    Reports++; DateTime now = DateTime.Now; uint v;
    if (HidP_GetUsageValue(0, 0x0D, 0, 0x54, out v, d.pp, rep, len) == 0x110000 && v > 0) { if (v != count) { count = (int)v; Reset(); } countAt = now; }
    if ((now - countAt).TotalMilliseconds > 250) { count = 0; Reset(); }
    if (count != 2) return;
    touchAt = now;
    var btn = new ushort[16];
    foreach (ushort lc in d.fingers) {
      uint id, x, n = 16;
      // only fingers that are actually touching (tip switch, usage 0x42); idle slots carry stale positions
      if (HidP_GetUsages(0, 0x0D, lc, btn, ref n, d.pp, rep, len) != 0x110000) continue;
      bool tip = false; for (int k = 0; k < n; k++) if (btn[k] == 0x42) tip = true;
      if (!tip) continue;
      if (HidP_GetUsageValue(0, 0x01, lc, 0x30, out x, d.pp, rep, len) != 0x110000) continue;
      if (HidP_GetUsageValue(0, 0x0D, lc, 0x51, out id, d.pp, rep, len) != 0x110000) id = lc;
      if (!startX.ContainsKey(id)) startX[id] = (int)x; lastX[id] = (int)x;
    }
    if (startX.Count < 1) return;
    // swipe = a touching finger travels ~10% of the pad sideways, and no finger goes the other way
    int need = d.xMax / 10, best = 0;
    foreach (var kv in startX) { int dx = lastX[kv.Key] - kv.Value; if (Math.Abs(dx) > Math.Abs(best)) best = dx; }
    if (Math.Abs(best) < need) return;
    foreach (var kv in startX) { int dx = lastX[kv.Key] - kv.Value; if (Math.Sign(dx) != Math.Sign(best) && Math.Abs(dx) > need / 2) return; }
    fired = true; Fire(best < 0, "touchpad");
    foreach (var k in new List<uint>(lastX.Keys)) startX[k] = lastX[k];          // re-arm: keep sliding to fire again
  }
  DateTime lastFire = DateTime.MinValue;
  readonly HashSet<string> seen = new HashSet<string>();
  void Fire(bool left, string src) {
    DateTime now = DateTime.Now; if ((now - lastFire).TotalMilliseconds < 160) return; lastFire = now; firedAt = now; Fires++;
    int ds = DeskState(); if (ds == 1) FocusDesktop();
    string cls = FgClass(GetForegroundWindow()); bool desktop = DeskState() == 2;
    Log("swipe " + (left ? "LEFT" : "RIGHT") + " via " + src + " | front window: " + cls + (desktop ? " -> sent" : " -> ignored (not desktop)"));
    if (desktop || (LpOpen && DeskState() > 0)) {
      if (PageAlive()) { if (left && !LpOpen) LpOpen = true; Send("{\"t\":\"swipe\",\"dir\":\"" + (left ? "left" : "right") + "\"}"); }
      else { byte vk = (byte)(left ? 0x7C : 0x7D); keybd_event(vk, 0, 0, UIntPtr.Zero); keybd_event(vk, 0, 2, UIntPtr.Zero); }   // F13 / F14 fallback
    }
  }
  int hAcc; DateTime hAt = DateTime.MinValue, touchAt = DateTime.MinValue;
  [DllImport("user32.dll", EntryPoint = "GetAsyncKeyState")] static extern short AsyncKey(int vk);
  [DllImport("user32.dll", EntryPoint = "WindowFromPoint")] static extern IntPtr WinAt(PtX p);
  [DllImport("user32.dll", EntryPoint = "SendMessageW")] static extern IntPtr SendMsg(IntPtr h, int m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] static extern uint GetDoubleClickTime();
  [DllImport("user32.dll", EntryPoint = "GetAncestor")] static extern IntPtr AncestorOf(IntPtr h, uint f);
  [StructLayout(LayoutKind.Sequential)] struct PtX { public int x, y; }
  static bool DeskAt(int x, int y, out IntPtr h) {                     // the empty desktop (or its icon list) is under the pointer
    h = WinAt(new PtX { x = x, y = y }); string c = h == IntPtr.Zero ? "" : FgClass(h);
    if (c == "SysListView32" || c == "SHELLDLL_DefView" || c == "WorkerW" || c == "Progman") return true;
    string rc = h == IntPtr.Zero ? "" : FgClass(AncestorOf(h, 2)); return rc == "WorkerW" || rc == "Progman";   // (icons hidden: the wallpaper window itself, inside the desktop)
  }
  DateTime vAt = DateTime.MinValue, vFired = DateTime.MinValue; int vAcc;
  public void VWheel(int delta, int x, int y) {
    IntPtr h; if (LpOpen || !DeskAt(x, y, out h)) return;
    DateTime now = DateTime.Now; if ((now - vAt).TotalMilliseconds > 400) vAcc = 0; vAt = now; vAcc += delta;
    if (Math.Abs(vAcc) < 120 || (now - vFired).TotalMilliseconds < 650) return;
    vFired = now; bool np = vAcc < 0; vAcc = 0;                       // down (toward you): Now Playing; up: the clock
    if (PageAlive()) { Log("scroll " + (np ? "down -> Now Playing" : "up -> clock")); Send("{\"t\":\"page\",\"to\":\"" + (np ? "np" : "clock") + "\"}"); }
  }
  DateTime cAt = DateTime.MinValue; int cX, cY;
  public void LClick(int x, int y) {
    DateTime now = DateTime.Now; bool dbl = (now - cAt).TotalMilliseconds <= GetDoubleClickTime() && Math.Abs(x - cX) <= 6 && Math.Abs(y - cY) <= 6;
    cAt = dbl ? DateTime.MinValue : now; cX = x; cY = y;
    IntPtr h; if (!dbl || LpOpen || !DeskAt(x, y, out h)) return;
    System.Threading.ThreadPool.QueueUserWorkItem(_ => {
      System.Threading.Thread.Sleep(60);                               // the desktop has handled the click by now
      bool onIcon = FgClass(h) == "SysListView32" && SendMsg(h, 0x1032, IntPtr.Zero, IntPtr.Zero) != IntPtr.Zero;   // LVM_GETSELECTEDCOUNT: an icon got picked
      if (onIcon || LpOpen || !PageAlive()) return;
      Log("double-click on the empty desktop -> Launchpad"); LpOpen = true; Send("{\"t\":\"toggle\"}");
    });
  }
  public void HWheel(int delta, string src) {
    if (seen.Add(src)) Log("first horizontal scroll seen via " + src + " (delta " + delta + ")");
    DateTime now = DateTime.Now;
    if ((now - touchAt).TotalMilliseconds < 500) return;          // the touchpad reader is already handling this gesture
    if ((now - hAt).TotalMilliseconds > 300) hAcc = 0; hAt = now; hAcc += delta;
    if (Math.Abs(hAcc) >= 240) { Fire(hAcc > 0, src); hAcc = 0; }   // fingers moving left scroll the page right (+)
  }
  void Reset() {
    if (!fired && startX.Count >= 2) {
      var parts = new List<string>(); foreach (var kv in startX) parts.Add("finger " + kv.Key + " dx=" + (lastX[kv.Key] - kv.Value));
      Log("two fingers lifted without a swipe: " + string.Join(", ", parts.ToArray()));
    }
    startX.Clear(); lastX.Clear(); fired = false;
  }
}
public static class VCol {
  [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr h);
  [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr h, IntPtr dc);
  [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr dc);
  [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleBitmap(IntPtr dc, int w, int h);
  [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr dc, IntPtr o);
  [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr o);
  [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr dc);
  [DllImport("gdi32.dll")] static extern bool StretchBlt(IntPtr d, int dx, int dy, int dw, int dh, IntPtr s, int sx, int sy, int sw, int sh, uint op);
  [DllImport("gdi32.dll")] static extern int SetStretchBltMode(IntPtr dc, int m);
  [DllImport("gdi32.dll")] static extern int GetDIBits(IntPtr dc, IntPtr bmp, uint start, uint lines, byte[] bits, ref BMI bi, uint usage);
  [StructLayout(LayoutKind.Sequential)] struct BMI { public int size, w, h; public short planes, bits; public int comp, img, xp, yp, used, imp, c0; }
  public static string Edges(int x, int y, int w, int h) {
    const int CW = 24, CH = 14;
    IntPtr sdc = GetDC(IntPtr.Zero), mdc = CreateCompatibleDC(sdc), bmp = CreateCompatibleBitmap(sdc, CW, CH), old = SelectObject(mdc, bmp);
    SetStretchBltMode(mdc, 4); StretchBlt(mdc, 0, 0, CW, CH, sdc, x, y, w, h, 0x00CC0020);
    SelectObject(mdc, old);
    var bi = new BMI { size = 40, w = CW, h = -CH, planes = 1, bits = 32 }; var px = new byte[CW * CH * 4];
    GetDIBits(mdc, bmp, 0, CH, px, ref bi, 0);
    DeleteObject(bmp); DeleteDC(mdc); ReleaseDC(IntPtr.Zero, sdc);
    Func<int, int, int, int, string> avg = (c0, c1, r0, r1) => { int r = 0, g = 0, b = 0, n = 0; for (int k = r0; k <= r1; k++) for (int c = c0; c <= c1; c++) { int i = (k * CW + c) * 4; b += px[i]; g += px[i + 1]; r += px[i + 2]; n++; } return "[" + (r / n) + "," + (g / n) + "," + (b / n) + "]"; };
    var sb = new StringBuilder("{\"l\":" + avg(0, 1, 0, CH - 1) + ",\"r\":" + avg(CW - 2, CW - 1, 0, CH - 1) + ",\"t\":[");
    for (int j = 0; j < 12; j++) { if (j > 0) sb.Append(','); sb.Append(avg(j * 2, j * 2 + 1, 0, 1)); }
    sb.Append("],\"b\":[");
    for (int j = 0; j < 12; j++) { if (j > 0) sb.Append(','); sb.Append(avg(j * 2, j * 2 + 1, CH - 2, CH - 1)); }
    sb.Append("],\"tl\":" + avg(0, 3, 0, 3) + ",\"tr\":" + avg(CW - 4, CW - 1, 0, 3) + ",\"c\":[");   // the top corners; the whole frame in 12 columns
    for (int j = 0; j < 12; j++) { if (j > 0) sb.Append(','); sb.Append(avg(j * 2, j * 2 + 1, 0, CH - 1)); }
    return sb.Append("]}").ToString();
  }
  public static string Cols(int x, int y, int w, int h) {
    const int CW = 12, CH = 6;
    IntPtr sdc = GetDC(IntPtr.Zero), mdc = CreateCompatibleDC(sdc), bmp = CreateCompatibleBitmap(sdc, CW, CH), old = SelectObject(mdc, bmp);
    SetStretchBltMode(mdc, 4); StretchBlt(mdc, 0, 0, CW, CH, sdc, x, y, w, h, 0x00CC0020);   // HALFTONE: a true average of each slice
    SelectObject(mdc, old);
    var bi = new BMI { size = 40, w = CW, h = -CH, planes = 1, bits = 32 }; var px = new byte[CW * CH * 4];
    GetDIBits(mdc, bmp, 0, CH, px, ref bi, 0);
    DeleteObject(bmp); DeleteDC(mdc); ReleaseDC(IntPtr.Zero, sdc);
    var sb = new StringBuilder("{\"c\":[");
    for (int c = 0; c < CW; c++) {
      int r = 0, g = 0, b = 0; for (int k = 0; k < CH; k++) { int i = (k * CW + c) * 4; b += px[i]; g += px[i + 1]; r += px[i + 2]; }
      if (c > 0) sb.Append(','); sb.Append('[').Append(r / CH).Append(',').Append(g / CH).Append(',').Append(b / CH).Append(']');
    }
    return sb.Append("]}").ToString();
  }
}
'@
[TouchSwipe]::LogPath = $null   # set to a file path to debug swipe detection
if (Test-Path (Join-Path $PSScriptRoot 'winkey.off')) { [TouchSwipe]::WinKey = $false }   # turned off with the dock's Windows button
[TouchSwipe]::Start()
# Launchpad over your open windows (the Windows key opens it): its own always-ready window, started once
$overlay = Join-Path $PSScriptRoot 'overlay.ps1'
if (Test-Path $overlay) { Start-Process powershell.exe -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-STA', '-File', "`"$overlay`"" -WindowStyle Hidden }
# ---- Launchpad search, like Windows search: your files (Windows' own search index), recent files, web suggestions,
#      Microsoft Store apps. Read-only look-ups, answered on the fast channel's worker threads (never blocks the keys).
Add-Type -ReferencedAssemblies System.Data, System.Xml, System.Web.Extensions @'
using System; using System.Collections.Generic; using System.Data.OleDb; using System.IO; using System.Net; using System.Text; using System.Runtime.InteropServices;
public static class Finder {
  const string UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  static readonly string Home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
  static readonly string OneDrive = Environment.GetEnvironmentVariable("OneDrive") ?? "";
  static Finder() { ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12; }
  public static string J(string s) {
    if (s == null) return "null"; var sb = new StringBuilder("\"");
    foreach (char c in s) { if (c == '"') sb.Append("\\\""); else if (c == '\\') sb.Append("\\\\"); else if (c < 32) sb.AppendFormat("\\u{0:x4}", (int)c); else sb.Append(c); }
    return sb.Append('"').ToString();
  }
  static int Num(string s, int def, int lo, int hi) { int v; if (!int.TryParse(s, out v)) v = def; return Math.Max(lo, Math.Min(hi, v)); }
  public static bool Serve(HttpListenerRequest req, HttpListenerResponse res) {
    string p = req.Url.AbsolutePath, json; var q = req.QueryString;
    try {
      if (p == "/files") json = Files(q["q"] ?? "", q["kind"] ?? "", Num(q["n"], 8, 1, 30), q["ph"] ?? "");
      else if (p == "/recent") json = Recent(Num(q["n"], 12, 1, 40), null, null);
      else if (p == "/suggest") json = Suggest(q["q"] ?? "");
      else if (p == "/store") json = Store(q["q"] ?? "", Num(q["n"], 4, 1, 12));
      else if (p == "/thumb") { ServeThumb(q["p"] ?? "", Num(q["s"], 64, 16, 768), q["i"] == "1", res); return true; }
      else if (p == "/go") {                                         // an app from Launchpad, straight away
        string id; if (!appIds.TryGetValue(q["k"] ?? "", out id)) { res.StatusCode = 404; res.Close(); return true; }
        IntPtr w = IntPtr.Zero; try { w = WindowOf(id); } catch { }
        res.StatusCode = 204; res.AddHeader("X-Shadow", w != IntPtr.Zero ? "switched" : "opened"); res.Close();
        if (w != IntPtr.Zero) Front(w); else Open("shell:AppsFolder\\" + id); return true;
      }
      else if (p == "/goweb") {                                      // a web search, straight away
        string e = q["e"] ?? "g", u, t = (q["q"] ?? "").Trim(); if (!engines.TryGetValue(e, out u)) engines.TryGetValue("g", out u);
        if (u == null || t.Length == 0) { res.StatusCode = 404; res.Close(); return true; }
        res.StatusCode = 204; res.Close(); Open(u + Uri.EscapeDataString(t.Length > 400 ? t.Substring(0, 400) : t)); return true;
      }
      else return false;
    } catch (Exception e) { json = "{\"error\":" + J(e.Message) + "}"; }
    var b = Encoding.UTF8.GetBytes(json); res.ContentType = "application/json"; res.StatusCode = 200; res.ContentLength64 = b.Length;
    res.OutputStream.Write(b, 0, b.Length); res.Close(); return true;
  }

  // ---- opening things: the helper hands over Launchpad's apps (key -> app id) and the search engines; nothing else can be opened ----
  static volatile Dictionary<string, string> appIds = new Dictionary<string, string>(), engines = new Dictionary<string, string>();
  static Dictionary<string, string> Map(System.Collections.Hashtable h) { var d = new Dictionary<string, string>(); foreach (System.Collections.DictionaryEntry e in h) d[Convert.ToString(e.Key)] = Convert.ToString(e.Value); return d; }
  public static void SetApps(System.Collections.Hashtable h) { appIds = Map(h); WarmExes(); }
  public static void SetEngines(System.Collections.Hashtable h) { engines = Map(h); }
  static void Open(string target) {
    try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(target) { UseShellExecute = true }); }
    catch { try { System.Diagnostics.Process.Start("explorer.exe", "\"" + target + "\""); } catch { } }
  }

  // ---- an app that's already open: find its window (the way the dock matches them) and bring it forward ----
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool attach);
  [DllImport("user32.dll")] static extern void SwitchToThisWindow(IntPtr h, bool alt);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int size);
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr h, int flags, StringBuilder s, ref int n);
  [DllImport("shell32.dll")] static extern int SHGetPropertyStoreForWindow(IntPtr h, ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out IPropertyStore ps);
  [DllImport("shell32.dll", CharSet = CharSet.Unicode)] static extern int SHGetKnownFolderPath([MarshalAs(UnmanagedType.LPStruct)] Guid id, uint flags, IntPtr token, out IntPtr path);
  [DllImport("ole32.dll")] static extern int PropVariantClear(ref PROPVARIANT p);
  [StructLayout(LayoutKind.Sequential)] struct PROPERTYKEY { public Guid fmtid; public uint pid; }
  [StructLayout(LayoutKind.Sequential)] struct PROPVARIANT { public ushort vt, r1, r2, r3; public IntPtr p, p2; }
  [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IPropertyStore { int GetCount(out uint c); int GetAt(uint i, out PROPERTYKEY k); int GetValue(ref PROPERTYKEY k, out PROPVARIANT v); int SetValue(ref PROPERTYKEY k, ref PROPVARIANT v); int Commit(); }

  // each app's program (app id -> exe), worked out once in the background so a switch never waits for it
  static volatile Dictionary<string, string> exeOfId = new Dictionary<string, string>();
  static volatile Dictionary<string, int> idsOfExe = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
  static int warmGen;
  static void WarmExes() {
    int gen = System.Threading.Interlocked.Increment(ref warmGen); var ids = new List<string>(appIds.Values);
    var t = new System.Threading.Thread(() => {
      var map = new Dictionary<string, string>(); var count = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
      object ns = null;
      try { var sh = Activator.CreateInstance(Type.GetTypeFromProgID("Shell.Application")); ns = sh.GetType().InvokeMember("Namespace", System.Reflection.BindingFlags.InvokeMethod, null, sh, new object[] { "shell:AppsFolder" }); } catch { }
      foreach (var id in ids) {
        if (gen != warmGen) return;
        string exe = ResolveKnown(id);
        if (exe == null && ns != null && !id.Contains("!")) {
          try { var it = ns.GetType().InvokeMember("ParseName", System.Reflection.BindingFlags.InvokeMethod, null, ns, new object[] { id });
                if (it != null) exe = it.GetType().InvokeMember("Path", System.Reflection.BindingFlags.GetProperty, null, it, null) as string; } catch { }
        }
        if (exe != null && exe.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) && File.Exists(exe)) { map[id] = exe; int c; count.TryGetValue(exe, out c); count[exe] = c + 1; }
      }
      exeOfId = map; idsOfExe = count;
    });
    t.IsBackground = true; t.SetApartmentState(System.Threading.ApartmentState.STA); t.Start();
  }
  static string ResolveKnown(string id) {                               // "{6D809377-...}\App\app.exe" -> "C:\Program Files\App\app.exe"
    var m = System.Text.RegularExpressions.Regex.Match(id, @"^\{([0-9A-Fa-f\-]{36})\}\\(.*)$");
    if (!m.Success) return id.Contains(":\\") ? id : null;
    IntPtr p; if (SHGetKnownFolderPath(new Guid(m.Groups[1].Value), 0, IntPtr.Zero, out p) != 0) return null;
    string root = Marshal.PtrToStringUni(p); Marshal.FreeCoTaskMem(p); return Path.Combine(root, m.Groups[2].Value);
  }
  static string ExeOf(uint pid) {
    IntPtr ph = OpenProcess(0x1000, false, pid); if (ph == IntPtr.Zero) return null;
    try { var sb = new StringBuilder(1024); int n = 1024; return QueryFullProcessImageName(ph, 0, sb, ref n) ? sb.ToString() : null; } finally { CloseHandle(ph); }
  }
  static string Aumid(IntPtr h) {
    var iid = new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"); IPropertyStore ps;
    if (SHGetPropertyStoreForWindow(h, ref iid, out ps) != 0 || ps == null) return null;
    try {
      var k = new PROPERTYKEY { fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), pid = 5 }; PROPVARIANT v;
      if (ps.GetValue(ref k, out v) != 0) return null;
      string s = v.vt == 31 ? Marshal.PtrToStringUni(v.p) : null; PropVariantClear(ref v); return s;
    } catch { return null; } finally { Marshal.ReleaseComObject(ps); }
  }
  // the app's front-most window (windows come top to bottom), or none
  static IntPtr WindowOf(string id) {
    string exe; exeOfId.TryGetValue(id, out exe); if (exe == null) exe = ResolveKnown(id);
    int shared; bool exeOk = exe != null && (!idsOfExe.TryGetValue(exe, out shared) || shared <= 1);   // a program several apps share (a browser's web apps) can't say which
    string fam = id.Contains("!") ? id.Split('!')[0] : null;
    var known = new HashSet<string>(appIds.Values, StringComparer.OrdinalIgnoreCase);
    uint me = (uint)System.Diagnostics.Process.GetCurrentProcess().Id; IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h) || GetWindow(h, 4) != IntPtr.Zero) return true;                    // visible, not owned by another window
      int ex = GetWindowLong(h, -20); if ((ex & 0x80) != 0 && (ex & 0x40000) == 0) return true;   // tool windows
      int cloaked; if (DwmGetWindowAttribute(h, 14, out cloaked, 4) == 0 && cloaked != 0) return true;   // on another desktop / suspended
      if (GetWindowTextLength(h) == 0) return true;
      var c = new StringBuilder(128); GetClassName(h, c, 128); string cls = c.ToString();
      if (cls == "Progman" || cls == "WorkerW" || cls == "Shell_TrayWnd" || cls == "Shell_SecondaryTrayWnd" || cls == "Windows.UI.Core.CoreWindow") return true;
      uint pid; GetWindowThreadProcessId(h, out pid); if (pid == me) return true;
      string au = Aumid(h);
      if (au != null) {                                                                           // its app id, or one of an app's (Chrome.UserData.Profile1 is Chrome's)
        string best = null; foreach (var k in known) if ((best == null || k.Length > best.Length) && (au.Equals(k, StringComparison.OrdinalIgnoreCase) || au.StartsWith(k + ".", StringComparison.OrdinalIgnoreCase))) best = k;
        if (best != null) { if (string.Equals(best, id, StringComparison.OrdinalIgnoreCase)) { found = h; return false; } return true; }   // this app's, or another app's
      }
      string we = ExeOf(pid); if (we == null || we.EndsWith("\\Lively.exe", StringComparison.OrdinalIgnoreCase)) return true;
      if (exeOk && !we.EndsWith("ApplicationFrameHost.exe", StringComparison.OrdinalIgnoreCase) && string.Equals(we, exe, StringComparison.OrdinalIgnoreCase)) { found = h; return false; }
      if (fam != null) {                                                                          // a Store app: WindowsApps\Name_1.2.3.0_x64__publisher\...
        var m = System.Text.RegularExpressions.Regex.Match(we, @"\\WindowsApps\\([^\\_]+)_[^\\]*_([a-z0-9]{13})\\", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (m.Success && string.Equals(m.Groups[1].Value + "_" + m.Groups[2].Value, fam, StringComparison.OrdinalIgnoreCase)) { found = h; return false; }
      }
      return true;
    }, IntPtr.Zero);
    return found;
  }
  static void Front(IntPtr w) {
    if (IsIconic(w)) ShowWindow(w, 9);                                                            // minimised: put it back where it was
    IntPtr fg = GetForegroundWindow(); uint pid, me = GetCurrentThreadId(), other = fg == IntPtr.Zero ? 0 : GetWindowThreadProcessId(fg, out pid);
    bool att = other != 0 && other != me && AttachThreadInput(me, other, true);
    BringWindowToTop(w); SetForegroundWindow(w);
    if (att) AttachThreadInput(me, other, false);
    if (GetForegroundWindow() != w) SwitchToThisWindow(w, true);                                  // Windows refused: ask the way Alt+Tab does
  }

  // ---- a file's thumbnail or icon, as Explorer draws it (made once, then kept in launcher\thumbs) ----
  public static string ThumbDir;
  static readonly object thumbLock = new object();
  static void ServeThumb(string path, int size, bool iconOnly, HttpListenerResponse res) {
    byte[] png = null;
    try {
      bool isDir = Directory.Exists(path);
      if (path.Length > 0 && path.Length < 1000 && Path.IsPathRooted(path) && (isDir || File.Exists(path))) {
        DateTime m = isDir ? Directory.GetLastWriteTimeUtc(path) : File.GetLastWriteTimeUtc(path);
        string key; using (var md5 = System.Security.Cryptography.MD5.Create()) key = BitConverter.ToString(md5.ComputeHash(Encoding.UTF8.GetBytes(path.ToLowerInvariant() + "|" + m.Ticks + "|" + size + "|" + iconOnly))).Replace("-", "");
        string dir = ThumbDir ?? Path.Combine(Path.GetTempPath(), "ShadowThumbs"); Directory.CreateDirectory(dir);
        string file = Path.Combine(dir, key + ".png");
        if (!File.Exists(file)) {
          Exception err = null;
          var t = new System.Threading.Thread(() => {                    // shell thumbnail makers want a single-threaded apartment
            try {
              Type si = null; foreach (var a in AppDomain.CurrentDomain.GetAssemblies()) { si = a.GetType("ShellIcon"); if (si != null) break; }
              string tmp = file + "." + System.Threading.Thread.CurrentThread.ManagedThreadId + ".tmp";
              si.GetMethod("SaveThumb").Invoke(null, new object[] { path, tmp, size, iconOnly });
              lock (thumbLock) { if (!File.Exists(file)) File.Move(tmp, file); else File.Delete(tmp); }
            } catch (Exception e) { err = e; }
          });
          t.SetApartmentState(System.Threading.ApartmentState.STA); t.IsBackground = true; t.Start();
          if (!t.Join(6000) || err != null) throw err ?? new Exception("timeout");
        }
        png = File.ReadAllBytes(file);
      }
    } catch { png = null; }
    if (png == null) { res.StatusCode = 404; res.Close(); return; }
    res.ContentType = "image/png"; res.Headers["Cache-Control"] = "max-age=86400"; res.StatusCode = 200; res.ContentLength64 = png.Length;
    res.OutputStream.Write(png, 0, png.Length); res.Close();
  }

  // ---- files: names first (every word must appear), then text inside documents; your own folders, newest first ----
  static string Like(string w) { var sb = new StringBuilder(); foreach (char c in w) if (c != '\'' && c != '%' && c != '_' && c != '[' && c != ']' && c != '"') sb.Append(c); return sb.ToString(); }
  static readonly Dictionary<string, string> Kinds = new Dictionary<string, string> {
    { "docs", "System.Kind = 'document'" }, { "photos", "System.Kind = 'picture'" }, { "music", "System.Kind = 'music'" },
    { "videos", "System.Kind = 'video'" }, { "folders", "System.Kind = 'folder'" } };
  static readonly Dictionary<string, KeyValuePair<DateTime, string>> filesCache = new Dictionary<string, KeyValuePair<DateTime, string>>();
  // ph = "n": the quick pass - names, through the index (words that start with what you typed); ph = "c": the slower pass - names that
  // merely contain it, and documents whose text mentions it; no ph: both
  public static string Files(string q, string kind, int n, string ph) {
    string ck = q.Trim().ToLowerInvariant() + "|" + kind + "|" + n + "|" + ph; KeyValuePair<DateTime, string> hit;
    lock (filesCache) { if (filesCache.TryGetValue(ck, out hit) && (DateTime.UtcNow - hit.Key).TotalSeconds < 30) return hit.Value; }
    string json = FilesNow(q, kind, n, ph);
    lock (filesCache) { if (filesCache.Count > 300) filesCache.Clear(); filesCache[ck] = new KeyValuePair<DateTime, string>(DateTime.UtcNow, json); }
    return json;
  }
  static string FilesNow(string q, string kind, int n, string ph) {
    var words = new List<string>(); foreach (var w in q.Trim().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries)) { var e = Like(w); if (e.Length > 0) words.Add(e); }
    if (words.Count == 0 || q.Trim().Length < 2) return "[]";
    string where = "SCOPE='file:" + Home.Replace('\\', '/') + "' AND System.ItemPathDisplay NOT LIKE '%\\AppData\\%' AND System.ItemPathDisplay NOT LIKE '%\\.%'" +
      " AND System.ItemPathDisplay NOT LIKE '%\\node_modules\\%' AND System.ItemPathDisplay NOT LIKE '%\\site-packages\\%'" +
      " AND System.ItemPathDisplay NOT LIKE '%\\intermediates\\%' AND System.ItemPathDisplay NOT LIKE '%\\__pycache__\\%' AND System.ItemPathDisplay NOT LIKE '%\\venv\\%'" +
      " AND System.ItemPathDisplay NOT LIKE '%\\CrossDevice\\%'";   // tool clutter and the phone's mirrored storage, not your files
    string k; if (Kinds.TryGetValue(kind, out k)) where += " AND " + k;
    var nameW = new StringBuilder(); foreach (var w in words) nameW.Append(" AND System.ItemNameDisplay LIKE '%" + w + "%'");
    var fastW = new StringBuilder(" AND CONTAINS(System.ItemNameDisplay, '"); for (int wi = 0; wi < words.Count; wi++) fastW.Append((wi > 0 ? " AND " : "") + "\"" + words[wi] + "*\""); fastW.Append("')");
    const string cols = "SELECT TOP 60 System.ItemNameDisplay, System.ItemPathDisplay, System.KindText, System.DateModified, System.Size, System.ItemType FROM SystemIndex WHERE ";
    var found = new List<object[]>(); var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    using (var c = new OleDbConnection("Provider=Search.CollatorDSO;Extended Properties=\"Application=Windows\";")) {
      c.Open();
      if (ph != "c") try { Read(c, cols + where + fastW + " ORDER BY System.DateModified DESC", found, seen, false); } catch { }     // quick: ~0.1 s
      if (ph != "n") Read(c, cols + where + nameW + " ORDER BY System.DateModified DESC", found, seen, false);                    // names containing it anywhere: ~0.5 s
      if (ph != "n" && found.Count < n && q.Trim().Length >= 3 && (kind == "" || kind == "docs")) {   // then documents that mention it
        var cw = new StringBuilder(); foreach (var w in words) cw.Append(" AND CONTAINS(System.Search.Contents, '\"" + w + "*\"')");
        try { Read(c, "SELECT TOP " + (n * 2) + " System.ItemNameDisplay, System.ItemPathDisplay, System.KindText, System.DateModified, System.Size, System.ItemType FROM SystemIndex WHERE " + where + cw + " ORDER BY System.DateModified DESC", found, seen, true); } catch { }
      }
    }
    string ql = q.Trim().ToLowerInvariant();
    found.Sort((a, b) => {                                                                // name starts with it > a word starts with it > anywhere; then newest
      int sa = Score((string)a[0], ql, (bool)a[6]), sb = Score((string)b[0], ql, (bool)b[6]);
      return sa != sb ? sb.CompareTo(sa) : ((DateTime)b[3]).CompareTo((DateTime)a[3]);
    });
    var o = new StringBuilder("["); int i = 0;
    foreach (var r in found) { if (i++ >= n) break; if (i > 1) o.Append(','); o.Append(Item(r)); }
    return o.Append(']').ToString();
  }
  static int Score(string name, string q, bool content) {
    if (content) return 0; string n = name.ToLowerInvariant();
    if (n.StartsWith(q)) return 3; if (n.Contains(" " + q) || n.Contains("_" + q) || n.Contains("-" + q)) return 2; return 1;
  }
  static void Read(OleDbConnection c, string sql, List<object[]> found, HashSet<string> seen, bool content) {
    using (var cmd = new OleDbCommand(sql, c)) using (var r = cmd.ExecuteReader()) {
      while (r.Read()) {
        string path = r.IsDBNull(1) ? null : r.GetValue(1).ToString(); if (path == null || !seen.Add(path)) continue;
        string kind = r.IsDBNull(2) ? "" : r.GetValue(2).ToString();
        DateTime d = r.IsDBNull(3) ? DateTime.MinValue : Convert.ToDateTime(r.GetValue(3));
        long size = r.IsDBNull(4) ? 0 : Convert.ToInt64(r.GetValue(4));
        string type = r.IsDBNull(5) ? "" : r.GetValue(5).ToString();
        found.Add(new object[] { r.IsDBNull(0) ? Path.GetFileName(path) : r.GetValue(0).ToString(), path, kind, d, size, type, content });
      }
    }
  }
  static string Item(object[] r) {
    string path = (string)r[1], type = (string)r[5]; bool dir = type == "Directory" || type == "File folder" || Directory.Exists(path);
    return "{\"n\":" + J((string)r[0]) + ",\"p\":" + J(path) + ",\"k\":" + J((string)r[2]) + ",\"x\":" + J(dir ? "" : Path.GetExtension(path).ToLowerInvariant()) +
      ",\"d\":" + J(((DateTime)r[3]) == DateTime.MinValue ? "" : ((DateTime)r[3]).ToString("o")) + ",\"s\":" + (long)r[4] + ",\"dir\":" + (dir ? "true" : "false") +
      ",\"od\":" + (OneDrive.Length > 0 && path.StartsWith(OneDrive, StringComparison.OrdinalIgnoreCase) ? "true" : "false") + ",\"c\":" + ((bool)r[6] ? "true" : "false") + "}";
  }

  // ---- recent files (the shortcuts Windows keeps in Recent), optionally only those an app opens ----
  public static void Warm() { System.Threading.Tasks.Task.Run(() => { try { FilesNow("readme", "", 1, ""); } catch { } try { RecentList(); } catch { } }); }
  static List<KeyValuePair<string, DateTime>> recent; static DateTime recentAt;
  static readonly object recentLock = new object();
  static List<KeyValuePair<string, DateTime>> RecentList() {
    lock (recentLock) {
      if (recent != null && (DateTime.UtcNow - recentAt).TotalSeconds < 20) return recent;
      var list = new List<KeyValuePair<string, DateTime>>(); var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
      var files = new DirectoryInfo(Environment.GetFolderPath(Environment.SpecialFolder.Recent)).GetFiles("*.lnk");
      Array.Sort(files, (a, b) => b.LastWriteTimeUtc.CompareTo(a.LastWriteTimeUtc));
      var t = Type.GetTypeFromProgID("WScript.Shell"); object sh = Activator.CreateInstance(t);
      try {
        int k = 0;
        foreach (var f in files) {
          if (k++ > 150) break;
          try {
            object sc = t.InvokeMember("CreateShortcut", System.Reflection.BindingFlags.InvokeMethod, null, sh, new object[] { f.FullName });
            string tp = (string)sc.GetType().InvokeMember("TargetPath", System.Reflection.BindingFlags.GetProperty, null, sc, null);
            Marshal.ReleaseComObject(sc);
            if (string.IsNullOrEmpty(tp) || !seen.Add(tp)) continue;
            if (tp.IndexOf("\\AppData\\", StringComparison.OrdinalIgnoreCase) >= 0) continue;
            if (!File.Exists(tp) && !Directory.Exists(tp)) continue;
            list.Add(new KeyValuePair<string, DateTime>(tp, f.LastWriteTime));
          } catch { }
        }
      } finally { Marshal.ReleaseComObject(sh); }
      recent = list; recentAt = DateTime.UtcNow; return list;
    }
  }
  [DllImport("shlwapi.dll", CharSet = CharSet.Unicode)] static extern int AssocQueryString(int flags, int str, string assoc, string extra, StringBuilder outp, ref int len);
  static string Assoc(string ext, int what) { int n = 1024; var sb = new StringBuilder(n); return AssocQueryString(0, what, ext, null, sb, ref n) == 0 ? sb.ToString() : ""; }
  public static string Recent(int n, string appId, string exe) {                           // appId / exe: only files that open in that app
    var o = new StringBuilder("["); int i = 0; var memo = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
    foreach (var kv in RecentList()) {
      string path = kv.Key; bool dir = Directory.Exists(path);
      if (!string.IsNullOrEmpty(appId) || !string.IsNullOrEmpty(exe)) {
        if (dir) continue; string ext = Path.GetExtension(path); if (ext.Length == 0) continue; bool ok;
        if (!memo.TryGetValue(ext, out ok)) {
          string handler = Assoc(ext, 2).Trim('"');                                       // 2 = the program that opens it, 21 = its app ID (Store apps)
          ok = (!string.IsNullOrEmpty(exe) && handler.Length > 0 && string.Equals(handler, exe, StringComparison.OrdinalIgnoreCase))
            || (!string.IsNullOrEmpty(appId) && string.Equals(Assoc(ext, 21), appId, StringComparison.OrdinalIgnoreCase));
          memo[ext] = ok;
        }
        if (!ok) continue;
      }
      if (i++ >= n) break; if (i > 1) o.Append(',');
      long size = 0; try { if (!dir) size = new FileInfo(path).Length; } catch { }
      o.Append("{\"n\":" + J(Path.GetFileName(path.TrimEnd('\\')) == "" ? path : Path.GetFileName(path.TrimEnd('\\'))) + ",\"p\":" + J(path) + ",\"k\":" + J(dir ? "Folder" : "") +
        ",\"x\":" + J(dir ? "" : Path.GetExtension(path).ToLowerInvariant()) + ",\"d\":" + J(kv.Value.ToString("o")) + ",\"s\":" + size + ",\"dir\":" + (dir ? "true" : "false") +
        ",\"od\":" + (OneDrive.Length > 0 && path.StartsWith(OneDrive, StringComparison.OrdinalIgnoreCase) ? "true" : "false") + ",\"c\":false}");
    }
    return o.Append(']').ToString();
  }

  // ---- the web: Google's suggestions + DuckDuckGo's instant answer, passed through as they come ----
  static string Get(string url) {
    var r = (HttpWebRequest)WebRequest.Create(url); r.UserAgent = UA; r.Timeout = 5000; r.ReadWriteTimeout = 5000;
    using (var resp = r.GetResponse()) using (var s = new StreamReader(resp.GetResponseStream(), Encoding.UTF8)) return s.ReadToEnd();
  }
  static string JsonOrNull(string s) { s = (s ?? "").Trim(); return s.StartsWith("[") || s.StartsWith("{") ? s : "null"; }
  public static string Suggest(string q) {
    q = q.Trim(); if (q.Length == 0 || q.Length > 200) return "{\"g\":null,\"d\":null}";
    string e = Uri.EscapeDataString(q), g = "null", d = "null";
    var tg = System.Threading.Tasks.Task.Run(() => { try { return JsonOrNull(Get("https://suggestqueries.google.com/complete/search?client=firefox&ie=utf8&oe=utf8&q=" + e)); } catch { return "null"; } });
    var td = System.Threading.Tasks.Task.Run(() => { try { return JsonOrNull(Get("https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&no_redirect=1&q=" + e)); } catch { return "null"; } });
    g = tg.Result; d = td.Result;
    return "{\"g\":" + g + ",\"d\":" + d + "}";
  }

  // ---- Microsoft Store: the same catalogue search winget uses (msstore source) ----
  public static string Store(string q, int n) {
    q = q.Trim(); if (q.Length < 2 || q.Length > 100) return "[]";
    string market = "US"; try { market = System.Globalization.RegionInfo.CurrentRegion.TwoLetterISORegionName; } catch { }
    try { var geo = Microsoft.Win32.Registry.GetValue(@"HKEY_CURRENT_USER\Control Panel\International\Geo", "Name", null) as string; if (!string.IsNullOrEmpty(geo) && geo.Length == 2) market = geo; } catch { }   // Settings > Country or region: the Store's own market
    string body = "{\"MaximumResults\":" + n + ",\"Filters\":[{\"PackageMatchField\":\"Market\",\"RequestMatch\":{\"KeyWord\":" + J(market) + ",\"MatchType\":\"CaseInsensitive\"}}],\"Query\":{\"KeyWord\":" + J(q) + ",\"MatchType\":\"Substring\"}}";
    var r = (HttpWebRequest)WebRequest.Create("https://storeedgefd.dsx.mp.microsoft.com/v9.0/manifestSearch"); r.Method = "POST"; r.ContentType = "application/json"; r.UserAgent = UA; r.Timeout = 8000;
    var b = Encoding.UTF8.GetBytes(body); using (var s = r.GetRequestStream()) s.Write(b, 0, b.Length);
    var js = new System.Web.Script.Serialization.JavaScriptSerializer { MaxJsonLength = 1 << 24 };
    var ids = new List<string>(); var names = new Dictionary<string, string[]>();
    using (var resp = r.GetResponse()) using (var s = new StreamReader(resp.GetResponseStream(), Encoding.UTF8)) {
      var root = js.Deserialize<Dictionary<string, object>>(s.ReadToEnd()); object data;
      if (root != null && root.TryGetValue("Data", out data) && data is System.Collections.IList)
        foreach (Dictionary<string, object> d in (System.Collections.IList)data) {
          string id = Str(d, "PackageIdentifier"); if (id.Length == 0 || ids.Contains(id)) continue;
          ids.Add(id); names[id] = new[] { Str(d, "PackageName"), Str(d, "Publisher") };
        }
    }
    if (ids.Count == 0) return "[]";
    // the Store's catalogue: logo, description and rating for each
    var info = new Dictionary<string, string[]>();
    try {
      string cat = Get("https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=" + string.Join(",", ids) + "&market=" + market + "&languages=en-US");
      var root = js.Deserialize<Dictionary<string, object>>(cat); object prods;
      if (root != null && root.TryGetValue("Products", out prods) && prods is System.Collections.IList)
        foreach (Dictionary<string, object> pr in (System.Collections.IList)prods) {
          string id = Str(pr, "ProductId"), logo = "", desc = "", rating = "", count = "", cat2 = "";
          var lps = pr.ContainsKey("LocalizedProperties") ? pr["LocalizedProperties"] as System.Collections.IList : null;
          if (lps != null && lps.Count > 0) {
            var lp = (Dictionary<string, object>)lps[0];
            desc = Str(lp, "ShortDescription"); if (desc.Length == 0) desc = Str(lp, "ProductDescription");
            if (desc.Length > 420) desc = desc.Substring(0, 420).TrimEnd() + "…";
            int best = 0; var imgs = lp.ContainsKey("Images") ? lp["Images"] as System.Collections.IList : null;
            if (imgs != null) foreach (Dictionary<string, object> im in imgs) {
              string purpose = Str(im, "ImagePurpose"); int w = 0; int.TryParse(Str(im, "Width"), out w);
              if ((purpose == "Logo" || purpose == "Tile") && w > best && w <= 300) { best = w; logo = Str(im, "Uri"); }
            }
            if (logo.StartsWith("//")) logo = "https:" + logo;
          }
          var mps = pr.ContainsKey("MarketProperties") ? pr["MarketProperties"] as System.Collections.IList : null;
          if (mps != null && mps.Count > 0) {
            var usage = ((Dictionary<string, object>)mps[0]).ContainsKey("UsageData") ? ((Dictionary<string, object>)mps[0])["UsageData"] as System.Collections.IList : null;
            if (usage != null) foreach (Dictionary<string, object> u in usage) if (Str(u, "AggregateTimeSpan") == "AllTime" || rating.Length == 0) { rating = Str(u, "AverageRating"); count = Str(u, "RatingCount"); }
          }
          var props = pr.ContainsKey("Properties") ? pr["Properties"] as Dictionary<string, object> : null;
          if (props != null) cat2 = Str(props, "Category");
          info[id] = new[] { logo, desc, rating, count, cat2 };
        }
    } catch { }
    var o = new StringBuilder("["); bool first = true;
    foreach (var id in ids) {
      string[] nm = names[id], inf; info.TryGetValue(id, out inf); inf = inf ?? new[] { "", "", "", "", "" };
      if (!first) o.Append(','); first = false;
      o.Append("{\"id\":" + J(id) + ",\"name\":" + J(nm[0]) + ",\"pub\":" + J(nm[1]) + ",\"logo\":" + J(inf[0]) + ",\"desc\":" + J(inf[1]) + ",\"rating\":" + J(inf[2]) + ",\"count\":" + J(inf[3]) + ",\"cat\":" + J(inf[4]) + "}");
    }
    return o.Append(']').ToString();
  }
  static string Str(Dictionary<string, object> d, string k) { object v; return d != null && d.TryGetValue(k, out v) && v != null ? Convert.ToString(v, System.Globalization.CultureInfo.InvariantCulture) : ""; }
}
'@
[Finder]::ThumbDir = Join-Path $PSScriptRoot 'thumbs'
[Finder]::Warm()       # the first look at Recent resolves ~150 shortcuts: do it now, not on the first search
[TouchSwipe]::Extra = [Delegate]::CreateDelegate([Func[Net.HttpListenerRequest, Net.HttpListenerResponse, bool]], [Finder].GetMethod('Serve'))
[TouchSwipe]::StartEvents($port + 1, $token)          # 47614: the instant key / swipe channel

$iconDir = Join-Path $PSScriptRoot 'icons'; New-Item -ItemType Directory -Force $iconDir | Out-Null
$skip = '(?i)uninstall|read ?me|release notes|documentation|module docs|manuals?\b|help\b|website|faq|licen[cs]e|visit java|check for updates|telemetry|recovery drive|odbc|iscsi|component services|computer management|event viewer|local security|performance monitor|print management|resource monitor|services$|system configuration|system information|windows memory diagnostic|windows fax|steps recorder|disk cleanup|defragment|windows powershell \(x86\)|windows powershell ise|registry editor'
# ---- ordering: most used first (Windows' own usage records + launches from Launchpad), then the most useful apps ----
$skip2 = '(?i)^(about java|configure java|office language preferences|telemetry log|spreadsheet compare|install additional tools|get started)'
$tiers = [ordered]@{
    '100' = 'File Explorer', 'Google Chrome', 'Microsoft Edge', 'Settings', 'WhatsApp', 'Spotify'
    '60'  = 'Visual Studio Code', 'Terminal', 'Calculator', 'Notepad', 'Snipping Tool', 'Word', 'Excel', 'PowerPoint', 'OneNote', 'Outlook',
          'Photos', 'Task Manager', 'Clock', 'Microsoft To Do', 'Sticky Notes', 'Telegram Desktop', 'Discord', 'Steam', 'YouTube Music', 'Claude', 'ChatGPT'
    '25'  = 'Calendar', 'Media Player', 'VLC media player', 'Camera', 'Paint', 'Microsoft Store', 'Phone Link', 'Weather', 'Maps', 'Microsoft Teams',
          'Control Panel', 'Windows Security', 'Sound Recorder', 'Lively Wallpaper'
    '-40' = 'Character Map', 'Get Help', 'Feedback Hub', 'Windows Tools', 'Run', 'Magnifier', 'Narrator', 'On-Screen Keyboard', 'Voice access',
          'Windows Media Player Legacy', 'Remote Desktop Connection', 'Quick Assist', 'Windows Backup', 'Windows PowerShell', 'ODBC*', 'IDLE*',
          'Python 3* (64-bit)', 'Live captions', 'Dev Home', 'Git CMD', 'Git GUI', 'Node.js*', 'WSL Settings', 'Hyper-V*', 'Intel*'
}
function Tier([string]$name) { foreach ($t in $tiers.Keys) { foreach ($pat in $tiers[$t]) { if ($name -like $pat) { return [int]$t } } }; return 0 }
$usageFile = Join-Path $PSScriptRoot 'usage.json'; $own = @{}
if (Test-Path $usageFile) { try { (Get-Content $usageFile -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $own[$_.Name] = [int]$_.Value } } catch {} }
function Rot13([string]$t) { $c = $t.ToCharArray(); for ($i = 0; $i -lt $c.Length; $i++) { $n = [int]$c[$i]; if ($n -ge 65 -and $n -le 90) { $c[$i] = [char](65 + ($n - 52) % 26) } elseif ($n -ge 97 -and $n -le 122) { $c[$i] = [char](97 + ($n - 84) % 26) } }; return -join $c }
function Ua-Scores($apps) {
    $byId = @{}; $byLeaf = @{}; $byName = @{}
    foreach ($a in $apps) { $id = $a.AppID.ToLower(); $byId[$id] = $a.AppID; $byName[$a.Name.ToLower()] = $a.AppID; if ($id -match '\\([^\\]+\.exe)$') { $byLeaf[$Matches[1]] = $a.AppID } }
    $score = @{}
    foreach ($k in Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\UserAssist' -ErrorAction SilentlyContinue) {
        $c = Get-Item "$($k.PSPath)\Count" -ErrorAction SilentlyContinue; if (-not $c) { continue }
        foreach ($v in $c.GetValueNames()) {
            $b = $c.GetValue($v); if ($b -isnot [byte[]] -or $b.Length -lt 16) { continue }
            $pts = [BitConverter]::ToInt32($b, 4) * 3 + [BitConverter]::ToInt32($b, 12) / 60000      # runs, minutes in focus
            if ($pts -le 0) { continue }
            $n = (Rot13 $v).ToLower(); $hit = $byId[$n]
            if (-not $hit -and $n -match '^(.+)\.userdata\.profile\d+$') { $hit = $byId[$Matches[1]] }                           # Chrome profiles
            if (-not $hit -and $n -match '\\windowsapps\\([^_\\]+)_[^\\]*__([a-z0-9]+)\\') {                                     # Store app exes
                $pre = "$($Matches[1])_$($Matches[2])!"; $hit = ($byId.Keys | Where-Object { $_.StartsWith($pre) } | Select-Object -First 1); if ($hit) { $hit = $byId[$hit] } }
            if (-not $hit -and $n -match '\\([^\\]+\.exe)$') { $hit = $byLeaf[$Matches[1]] }
            if (-not $hit -and $n -match '([^\\]+)\.lnk$') { $hit = $byName[$Matches[1]] }
            if ($hit) { $score[$hit] = [double]$score[$hit] + $pts }
        }
    }
    return $score
}
$lpApps = @(); $lpAt = [datetime]::MinValue; $lpByK = @{}; $uaScore = @{}
function Lp-Apps {
    if (((Get-Date) - $script:lpAt).TotalMinutes -gt 30 -or -not $script:lpApps) {
        $seen = @{}; $sha = [Security.Cryptography.SHA1]::Create()
        $list = @(Get-StartApps | Where-Object { $_.Name -notmatch $skip -and $_.Name -notmatch $skip2 -and $_.AppID -notmatch '^(https?:|.*\.(url|chm|txt|html?|pdf)$)' } |
            Where-Object { if ($seen[$_.Name]) { $false } else { $seen[$_.Name] = 1; $true } })
        $byK = @{}
        foreach ($a in $list) {
            $k = -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($a.AppID)) | ForEach-Object { $_.ToString('x2') })
            $a | Add-Member -NotePropertyName K -NotePropertyValue $k -Force
            $a | Add-Member -NotePropertyName Tier -NotePropertyValue (Tier $a.Name) -Force
            $byK[$k] = $a
        }
        try { $script:uaScore = Ua-Scores $list } catch { $script:uaScore = @{} }
        $script:lpApps = $list; $script:lpByK = $byK; $script:lpAt = Get-Date
        try { $ids = @{}; foreach ($kv in $byK.GetEnumerator()) { $ids[$kv.Key] = [string]$kv.Value.AppID }; [Finder]::SetApps($ids) } catch {}   # the fast channel opens these at once
    }
    return $script:lpApps
}
function Lp-Score($a) { return [double]$a.Tier + [double]$script:uaScore[$a.AppID] + 12 * [double]$script:own[$a.AppID] }
$lpJson = $null; $lpJsonAt = [datetime]::MinValue
function Lp-Json {
    [void](Lp-Apps); if ($script:lpJson -and $script:lpJsonAt -eq $script:lpAt) { return $script:lpJson }
    $sorted = Lp-Apps | Sort-Object @{ Expression = { Lp-Score $_ }; Descending = $true }, Name
    $items = foreach ($a in $sorted) { '{"k":"' + $a.K + '","name":' + (ConvertTo-Json $a.Name -Compress) + '}' }
    $script:lpJson = '[' + ($items -join ',') + ']'; $script:lpJsonAt = $script:lpAt
    return $script:lpJson
}
$dockJson = $null; $dockJsonAt = [datetime]::MinValue
function Dock-Json {
    [void](Lp-Apps); if ($script:dockJson -and $script:dockJsonAt -eq $script:lpAt) { return $script:dockJson }
    $targets = @{}; $ws = New-Object -ComObject WScript.Shell
    Get-ChildItem $startDirs -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object {
        try { $t = $ws.CreateShortcut($_.FullName).TargetPath; if ($t -match '\.exe$' -and -not $targets.ContainsKey($_.BaseName)) { $targets[$_.BaseName] = $t } } catch {}
    }
    $sorted = Lp-Apps | Sort-Object @{ Expression = { Lp-Score $_ }; Descending = $true }, Name
    $items = foreach ($a in $sorted) {
        '{"k":"' + $a.K + '","name":' + (ConvertTo-Json $a.Name -Compress) + ',"id":' + (ConvertTo-Json $a.AppID -Compress) + ',"exe":' + (ConvertTo-Json ([string]$targets[$a.Name]) -Compress) + '}'
    }
    $script:dockJson = '[' + ($items -join ',') + ']'; $script:dockJsonAt = $script:lpAt
    return $script:dockJson
}
function Lp-Find([string]$k) { [void](Lp-Apps); if ($k -and $script:lpByK.ContainsKey($k)) { return $script:lpByK[$k] }; return $null }
function Lp-Icon([string]$k) {
    $a = Lp-Find $k; if (-not $a) { return $null }
    $png = Join-Path $iconDir "$($a.K).png"
    if (-not (Test-Path $png)) { [ShellIcon]::Save("shell:AppsFolder\$($a.AppID)", $png, 256) }
    return $png
}
function Lp-Launch([string]$k) {
    $a = Lp-Find $k; if (-not $a) { return $null }           # only apps from the Start-menu list can be opened
    $psi = New-Object Diagnostics.ProcessStartInfo "shell:AppsFolder\$($a.AppID)"; $psi.UseShellExecute = $true
    try { [void][Diagnostics.Process]::Start($psi) } catch { Start-Process 'explorer.exe' "shell:AppsFolder\$($a.AppID)" }
    return $a
}
function Lp-Count($a) {
    $script:own[$a.AppID] = 1 + [int]$script:own[$a.AppID]; $script:lpJson = $null
    try { ($script:own | ConvertTo-Json -Compress) | Set-Content -Encoding utf8 $usageFile } catch {}
}

$layoutFile = Join-Path $PSScriptRoot 'layout.json'
function Lp-Uninstall($a) {
    $id = $a.AppID
    if ($id -match '^(Microsoft\.Windows\.|windows\.immersivecontrolpanel|Microsoft\.AutoGenerated|MSEdge$)' -or
        $a.Name -in 'File Explorer', 'Settings', 'Control Panel', 'Run', 'Task Manager', 'Windows Security', 'Microsoft Store', 'Microsoft Edge', 'Command Prompt', 'Windows PowerShell') { return 'system' }
    if ($id -match '^([^!]+)!') {                                                     # Store app: remove the package for this user
        $fam = $Matches[1]; $pkg = Get-AppxPackage | Where-Object { $_.PackageFamilyName -eq $fam } | Select-Object -First 1
        if ($pkg) {
            if ($pkg.NonRemovable -or $pkg.SignatureKind -eq 'System') { return 'system' }
            Start-Process powershell.exe -WindowStyle Hidden -ArgumentList '-NoProfile', '-Command', "Remove-AppxPackage -Package '$($pkg.PackageFullName)'"
            $script:lpAt = [datetime]::MinValue; return 'store'
        }
    }
    $keys = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
    $n = $a.Name
    $e = Get-ItemProperty $keys -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -and $_.UninstallString -and
        ($_.DisplayName -eq $n -or $_.DisplayName.StartsWith($n, 'OrdinalIgnoreCase') -or $n.StartsWith([string]$_.DisplayName, 'OrdinalIgnoreCase')) } | Select-Object -First 1
    if ($e) {                                                                          # desktop app: run its own uninstaller (it asks before removing anything)
        $u = ([string]$e.UninstallString).Trim()
        if ($u -match '(?i)^msiexec(\.exe)?\s+(.*)$') { Start-Process 'msiexec.exe' ($Matches[2] -replace '(?i)/I\s*\{', '/X{') }
        elseif ($u -match '^"([^"]+)"\s*(.*)$' -or $u -match '^(.+?\.exe)\s*(.*)$') { if ($Matches[2]) { Start-Process $Matches[1] $Matches[2] } else { Start-Process $Matches[1] } }
        else { Start-Process 'ms-settings:appsfeatures' ; return 'settings' }
        $script:lpAt = [datetime]::MinValue; return 'uninstaller'
    }
    Start-Process 'ms-settings:appsfeatures'; return 'settings'
}

# ---- quick actions for Launchpad search (fixed lists; nothing arbitrary can be run) ----
$settingsPages = @{ wifi = 'network-wifi'; network = 'network'; bluetooth = 'bluetooth'; display = 'display'; sound = 'sound'; battery = 'batterysaver'; power = 'powersleep'
    update = 'windowsupdate'; apps = 'appsfeatures'; notifications = 'notifications'; focus = 'quiethours'; personalization = 'personalization'; background = 'personalization-background'
    touchpad = 'devices-touchpad'; mouse = 'mousetouchpad'; keyboard = 'keyboard'; storage = 'storagesense'; privacy = 'privacy'; accounts = 'yourinfo'; time = 'dateandtime'
    language = 'regionlanguage'; printers = 'printers'; vpn = 'network-vpn'; hotspot = 'network-mobilehotspot'; nightlight = 'nightlight'; about = 'about'; colors = 'colors'
    themes = 'themes'; taskbar = 'taskbar'; defaultapps = 'defaultapps'; startup = 'startupapps'; gaming = 'gaming-gamebar'; accessibility = 'easeofaccess'; home = '' }
$sysPages = @{                                                          # Launchpad search: deep Windows pages (Control Panel and tools)
    lid = @('control.exe', '/name Microsoft.PowerOptions /page pageGlobalSettings'); powerplan = @('control.exe', '/name Microsoft.PowerOptions')
    soundcpl = @('control.exe', 'mmsys.cpl'); recording = @('control.exe', 'mmsys.cpl,,1'); sounds = @('control.exe', 'mmsys.cpl,,2')
    devmgmt = @('devmgmt.msc'); diskmgmt = @('diskmgmt.msc'); envvars = @('rundll32.exe', 'sysdm.cpl,EditEnvironmentVariables')
    sysadv = @('SystemPropertiesAdvanced.exe'); perf = @('SystemPropertiesPerformance.exe'); protection = @('SystemPropertiesProtection.exe'); remote = @('SystemPropertiesRemote.exe')
    ncpa = @('control.exe', 'ncpa.cpl'); appwiz = @('control.exe', 'appwiz.cpl'); netplwiz = @('netplwiz.exe'); mousecpl = @('control.exe', 'main.cpl'); keyboardcpl = @('control.exe', 'keyboard')
    timedate = @('control.exe', 'timedate.cpl'); inetcpl = @('control.exe', 'inetcpl.cpl'); firewall = @('control.exe', 'firewall.cpl'); credman = @('control.exe', '/name Microsoft.CredentialManager')
    folderopts = @('control.exe', 'folders'); screensaver = @('control.exe', 'desk.cpl,,@screensaver'); intl = @('control.exe', 'intl.cpl'); features = @('optionalfeatures.exe')
    services = @('services.msc'); taskschd = @('taskschd.msc'); eventvwr = @('eventvwr.msc'); cleanmgr = @('cleanmgr.exe'); defrag = @('dfrgui.exe'); sysinfo = @('msinfo32.exe')
    resmon = @('resmon.exe'); fonts = @('control.exe', 'fonts'); control = @('control.exe'); colorcal = @('dccw.exe'); mobility = @('mblctr.exe') }
$folders = @{ downloads = 'shell:Downloads'; documents = 'shell:Personal'; desktop = 'shell:Desktop'; pictures = 'shell:My Pictures'; music = 'shell:My Music'
    videos = 'shell:My Video'; recycle = 'shell:RecycleBinFolder'; home = 'shell:UsersFilesFolder'; thispc = 'shell:MyComputerFolder'; screenshots = 'shell:Screenshots'; onedrive = 'shell:OneDrive' }
$engines = @{ g = 'https://www.google.com/search?q='; yt = 'https://www.youtube.com/results?search_query='; maps = 'https://www.google.com/maps/search/'
    wiki = 'https://en.wikipedia.org/w/index.php?search='; define = 'https://www.google.com/search?q=define+'; scholar = 'https://scholar.google.com/scholar?q='
    translate = 'https://translate.google.com/?sl=auto&tl=en&text='; gh = 'https://github.com/search?q='; amazon = 'https://www.amazon.in/s?k=' }
try { [Finder]::SetEngines($engines) } catch {}                         # web searches open from the fast channel, at once
$sites = @{ gmail = 'https://mail.google.com'; youtube = 'https://www.youtube.com'; drive = 'https://drive.google.com'; calendar = 'https://calendar.google.com'
    github = 'https://github.com'; classroom = 'https://classroom.google.com'; docs = 'https://docs.google.com'; sheets = 'https://sheets.google.com'; slides = 'https://slides.google.com'
    keep = 'https://keep.google.com'; netflix = 'https://www.netflix.com'; chatgpt = 'https://chatgpt.com'; claude = 'https://claude.ai'; notion = 'https://www.notion.so'
    instagram = 'https://www.instagram.com'; x = 'https://x.com'; reddit = 'https://www.reddit.com'; linkedin = 'https://www.linkedin.com'; photos = 'https://photos.google.com'
    maps = 'https://maps.google.com'; translate = 'https://translate.google.com'; spotify = 'https://open.spotify.com'; whatsapp = 'https://web.whatsapp.com' }
$keys = @{ playpause = 0xB3; next = 0xB0; prev = 0xB1; stop = 0xB2; mute = 0xAD; voldown = 0xAE; volup = 0xAF }

function Send-File($res, [string]$path, [string]$type) {
    $b = [IO.File]::ReadAllBytes($path)
    $res.AddHeader('Access-Control-Allow-Origin', '*'); $res.AddHeader('Cache-Control', 'max-age=86400'); $res.ContentType = $type
    $res.StatusCode = 200; $res.OutputStream.Write($b, 0, $b.Length); $res.Close()
}

$mutex = New-Object System.Threading.Mutex($false, 'ShadowWallpaperHelper')
if (-not $mutex.WaitOne(0)) { exit }

$dockScript = Join-Path $PSScriptRoot 'dock.ps1'
if ((Test-Path $dockScript) -and -not (Test-Path (Join-Path $PSScriptRoot 'dock.off'))) {
    Start-Process powershell.exe -WindowStyle Hidden -ArgumentList "-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$dockScript`""
}
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
[void](Lp-Apps)   # warm the app list and usage scores before the first request
function Send-Json($res, [string]$json) {
    $b = [Text.Encoding]::UTF8.GetBytes($json)
    $res.AddHeader('Access-Control-Allow-Origin', '*'); $res.ContentType = 'application/json'
    $res.StatusCode = 200; $res.OutputStream.Write($b, 0, $b.Length); $res.Close()
}
$waiters = New-Object System.Collections.ArrayList; $evBuf = New-Object System.Collections.ArrayList
$pending = $listener.GetContextAsync()
while ($listener.IsListening) {
    if (-not $pending.Wait(30)) {
        $ev = $null
        while ([TouchSwipe]::Events.TryDequeue([ref]$ev)) {
            $ticks, $json = $ev -split [char]1, 2
            if (([datetime]::UtcNow.Ticks - [long]$ticks) -lt 15000000) {                      # drop anything older than 1.5 s
                if ($json -eq '{"t":"paste"}') { $txt = [string](Get-Clipboard -Raw); if ($txt.Length -gt 500) { $txt = $txt.Substring(0, 500) }; $json = '{"t":"paste","text":' + (ConvertTo-Json $txt -Compress) + '}' }
                [void]$evBuf.Add($json)
            }
        }
        if ($waiters.Count) { [TouchSwipe]::Seen() }
        if ($waiters.Count -and $evBuf.Count) {
            $body = '{"evs":[' + ($evBuf -join ',') + ']}'; $evBuf.Clear()
            foreach ($w in @($waiters)) { try { Send-Json $w.res $body } catch {} }; $waiters.Clear()
        }
        foreach ($w in @($waiters)) { if (((Get-Date) - $w.at).TotalSeconds -gt 20) { try { Send-Json $w.res '{}' } catch {}; [void]$waiters.Remove($w) } }
        if (((Get-Date) - $strayAt).TotalSeconds -ge 20) { $strayAt = Get-Date; try { [void][Fg]::HideStray() } catch {} }
        if (((Get-Date) - $googleSyncAt).TotalHours -ge 4) { $googleSyncAt = Get-Date; if (Test-Path (Join-Path $PSScriptRoot 'google-token.dat')) { Start-Google 'Sync' } }
        continue
    }
    $ctx = $pending.Result; $pending = $listener.GetContextAsync()
    $req = $ctx.Request; $res = $ctx.Response; $status = 404
    try {
        if ($req.QueryString['t'] -ne $token) { $status = 403 }
        elseif ($req.Url.AbsolutePath -eq '/state') { Send-Json $res ('{"desktop":' + ($(if ([TouchSwipe]::DeskState() -gt 0) { 'true' } else { 'false' })) + ',"covered":' + ($(if ([Fg]::Covered()) { 'true' } else { 'false' })) + '}'); continue }
        elseif ($req.Url.AbsolutePath -eq '/apps')  { Send-Json $res (Apps-Json); continue }
        elseif ($req.Url.AbsolutePath -eq '/winkey') {                    # the dock's Windows button: Windows key opens Launchpad, on / off (remembered)
            $off = Join-Path $PSScriptRoot 'winkey.off'; $on = $req.QueryString['on']
            if ($on -eq '1') { [TouchSwipe]::WinKey = $true; Remove-Item $off -ErrorAction SilentlyContinue } elseif ($on -eq '0') { [TouchSwipe]::WinKey = $false; Set-Content $off '' }
            Send-Json $res ('{"on":' + $(if ([TouchSwipe]::WinKey) { 'true' } else { 'false' }) + '}'); continue
        }
        elseif ($req.Url.AbsolutePath -eq '/media') { Send-Json $res (Media-Json); continue }
        elseif ($req.Url.AbsolutePath -eq '/mediaart') {
            $a = Media-Art
            if ($a) { $res.AddHeader('Access-Control-Allow-Origin', '*'); $res.AddHeader('Cache-Control', 'max-age=3600'); $res.ContentType = $a.type; $res.StatusCode = 200; $res.OutputStream.Write($a.bytes, 0, $a.bytes.Length); $res.Close(); continue }
        }
        elseif ($req.Url.AbsolutePath -eq '/ytmin') { [void][Fg]::MinimiseApp('YouTube Music'); [void][TouchSwipe]::FocusDesktop(); $status = 204 }
        elseif ($req.Url.AbsolutePath -eq '/ytlib') { Send-Json $res (YtLib-Json); continue }
        elseif ($req.Url.AbsolutePath -eq '/gsignin') { Start-Google 'SignIn'; $status = 204 }
        elseif ($req.Url.AbsolutePath -eq '/gsync') { Start-Google 'Sync'; $status = 204 }
        elseif ($req.Url.AbsolutePath -eq '/launchpad') { Send-Json $res (Lp-Json); continue }
        elseif ($req.Url.AbsolutePath -eq '/dockapps')  { Send-Json $res (Dock-Json); continue }
        elseif ($req.Url.AbsolutePath -eq '/icon') {
            $png = Lp-Icon $req.QueryString['k']
            if ($png) { Send-File $res $png 'image/png'; continue }
        }
        elseif ($req.Url.AbsolutePath -eq '/power') {                     # Launchpad's power button (over your apps): sleep / lock / restart / shut down
            $act = $req.QueryString['a']; $res.StatusCode = 204; $res.AddHeader('Access-Control-Allow-Origin', '*'); $res.Close()
            switch ($act) {
                'lock'     { Start-Process rundll32.exe 'user32.dll,LockWorkStation' }
                'sleep'    { Add-Type -AssemblyName System.Windows.Forms; [void][System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend, $false, $false) }
                'restart'  { Start-Process shutdown.exe '/r /t 0' -WindowStyle Hidden }
                'shutdown' { Start-Process shutdown.exe '/s /t 0' -WindowStyle Hidden }
            }
            continue
        }
        elseif ($req.Url.AbsolutePath -eq '/launch') {
            $a = Lp-Find $req.QueryString['k']
            if ($a) { $res.StatusCode = 204; $res.AddHeader('Access-Control-Allow-Origin', '*'); $res.Close(); if ($req.QueryString['count'] -ne '1') { [void](Lp-Launch $a.K) }; Lp-Count $a; continue }
        }
        elseif ($req.Url.AbsolutePath -eq '/web') {
            $q = [string]$req.QueryString['q']; $e = [string]$req.QueryString['e']; if (-not $engines.ContainsKey($e)) { $e = 'g' }
            if ($q) { Start-Process ($engines[$e] + [uri]::EscapeDataString($q.Substring(0, [Math]::Min(400, $q.Length)))); $status = 204 }
        }
        elseif ($req.Url.AbsolutePath -eq '/site')     { $u = $sites[[string]$req.QueryString['s']]; if ($u) { Start-Process $u; $status = 204 } }
        elseif ($req.Url.AbsolutePath -eq '/settings') { $p = [string]$req.QueryString['p']; if ($settingsPages.ContainsKey($p)) { Start-Process "ms-settings:$($settingsPages[$p])"; $status = 204 } }
        elseif ($req.Url.AbsolutePath -eq '/folder')   { $f = $folders[[string]$req.QueryString['f']]; if ($f) { Start-Process 'explorer.exe' $f; $status = 204 } }
        # ---- Launchpad search like Windows search: open a found file, show it in its folder, any Settings page, a Store page, app actions ----
        elseif ($req.Url.AbsolutePath -eq '/openf' -or $req.Url.AbsolutePath -eq '/reveal') {
            $p = [string]$req.QueryString['p']
            if ($p -and $p.Length -lt 1000 -and [IO.Path]::IsPathRooted($p) -and (Test-Path -LiteralPath $p)) {
                $script = $p -match '(?i)\.(ps1|psm1|bat|cmd|vbs|vbe|js|jse|wsf|wsh|hta|scr|msi|reg)$'          # scripts are only shown, never run from here
                if ($req.Url.AbsolutePath -eq '/reveal' -or $script) { Start-Process 'explorer.exe' "/select,`"$p`"" } else { Start-Process -FilePath $p }
                $status = 204
            }
        }
        elseif ($req.Url.AbsolutePath -eq '/sys') {                          # classic Windows pages search can open (fixed list: nothing else can be run)
            $c = $sysPages[[string]$req.QueryString['id']]
            if ($c) { if ($c.Count -gt 1) { Start-Process $c[0] $c[1] } else { Start-Process $c[0] }; $status = 204 }
        }
        elseif ($req.Url.AbsolutePath -eq '/mss') { $u = [string]$req.QueryString['u']; if ($u -cmatch '^ms-settings:[a-z0-9\-]*$') { Start-Process $u; $status = 204 } }
        elseif ($req.Url.AbsolutePath -eq '/storeopen') { $id = [string]$req.QueryString['id']; if ($id -cmatch '^[A-Z0-9]{12}$') { Start-Process "ms-windows-store://pdp/?productid=$id"; $status = 204 } }
        elseif ($req.Url.AbsolutePath -eq '/appverbs') {                     # what Windows offers for this app: run as administrator, file location, pin to Start
            $a = Lp-Find $req.QueryString['k']; $out = @(); $exe = ''
            if ($a) { try { $it = (New-Object -ComObject Shell.Application).Namespace('shell:AppsFolder').ParseName($a.AppID)
                if ($it) { if ($it.Path -match '(?i)\.exe$') { $exe = $it.Path }
                    foreach ($v in $it.Verbs()) { $n = ($v.Name -replace '&', '').Trim(); if ($n -in 'Run as administrator', 'Open file location', 'Pin to Start', 'Unpin from Start') { $out += $n } } } } catch {} }
            Send-Json $res ('{"verbs":' + (ConvertTo-Json @($out) -Compress) + ',"exe":' + (ConvertTo-Json $exe -Compress) + '}'); continue
        }
        elseif ($req.Url.AbsolutePath -eq '/appverb') {
            $a = Lp-Find $req.QueryString['k']; $want = [string]$req.QueryString['v']
            if ($a -and $want -in 'Run as administrator', 'Open file location', 'Pin to Start', 'Unpin from Start') {
                try { $it = (New-Object -ComObject Shell.Application).Namespace('shell:AppsFolder').ParseName($a.AppID)
                    foreach ($v in $it.Verbs()) { if (($v.Name -replace '&', '').Trim() -eq $want) { $v.DoIt(); $status = 204; break } } } catch {}
                if ($want -eq 'Run as administrator' -and $status -eq 204) { Lp-Count $a }
            }
        }
        elseif ($req.Url.AbsolutePath -eq '/apprecent') {                    # this app's recent files (like its jump list)
            $a = Lp-Find $req.QueryString['k']; $json = '[]'
            if ($a) { $exe = ''; try { $it = (New-Object -ComObject Shell.Application).Namespace('shell:AppsFolder').ParseName($a.AppID); if ($it.Path -match '(?i)\.exe$') { $exe = $it.Path } } catch {}
                try { $json = [Finder]::Recent(4, $a.AppID, $exe) } catch {} }
            Send-Json $res $json; continue
        }
        elseif ($req.Url.AbsolutePath -eq '/ytblip') {
            $s = Pick-Session
            if ($s -and [string]$s.SourceAppUserModelId -match '_crx_cinhi' -and [string]$s.GetPlaybackInfo().PlaybackStatus -eq 'Playing') {
                [void](Await-Op ($s.TryPauseAsync()) ([bool])); Start-Sleep -Milliseconds 90; [void](Await-Op ($s.TryPlayAsync()) ([bool]))
            }
            $status = 204
        }
        elseif ($req.Url.AbsolutePath -eq '/key') {
            # play/pause/next/previous go to the player the wallpaper shows (a media key would go to whatever Windows picks)
            $k = [string]$req.QueryString['k']; $s = $script:shownSession; $done = $false
            if ($s -and @('playpause', 'next', 'prev') -contains $k) {
                try { if ($k -eq 'playpause') { [void]$s.TryTogglePlayPauseAsync() } elseif ($k -eq 'next') { [void]$s.TrySkipNextAsync() } else { [void]$s.TrySkipPreviousAsync() }; $done = $true } catch {}
            }
            if (-not $done) { $v = $keys[$k]; if ($v) { [Fg]::Tap([byte]$v) } }
            $status = 204
        }
        elseif ($req.Url.AbsolutePath -eq '/wait') { [void]$waiters.Add([pscustomobject]@{ res = $res; at = Get-Date }); [TouchSwipe]::Seen(); continue }
        elseif ($req.Url.AbsolutePath -eq '/layout') {
            if ($req.HttpMethod -eq 'POST') {
                $body = (New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)).ReadToEnd()
                if ($body.Length -lt 400000) { try { [void]($body | ConvertFrom-Json); [IO.File]::WriteAllText($layoutFile, $body, [Text.UTF8Encoding]::new($false)); $status = 204 } catch { $status = 400 } }
                $res.AddHeader('Access-Control-Allow-Origin', '*')
            } else { Send-Json $res ($(if (Test-Path $layoutFile) { [IO.File]::ReadAllText($layoutFile) } else { '{}' })); continue }
        }
        elseif ($req.Url.AbsolutePath -eq '/uninstall') {
            $a = Lp-Find $req.QueryString['k']
            if ($a) { $how = try { Lp-Uninstall $a } catch { 'settings' }; Send-Json $res ('{"how":"' + $how + '"}'); continue }
        }
        elseif ($req.Url.AbsolutePath -eq '/lpstate') { [TouchSwipe]::LpOpen = ($req.QueryString['open'] -eq '1'); $status = 204 }
        elseif ($req.Url.AbsolutePath -eq '/ytplay') {
            $v = [string]$req.QueryString['v']; $l = [string]$req.QueryString['list']; $c = [string]$req.QueryString['c']; $id = '^[A-Za-z0-9_-]{1,80}$'
            $u = if ($v -match $id) { "https://music.youtube.com/watch?v=$v" + $(if ($l -match $id) { "&list=$l" } else { '' }) }
                 elseif ($l -match $id) { "https://music.youtube.com/watch?list=$l" }
                 elseif ($c -match $id) { "https://music.youtube.com/channel/$c" }
            if ($u) { Open-YTM $u ($u -notmatch '/channel/'); $status = 204 }
        }
        elseif ($req.Url.AbsolutePath -eq '/lock')     { Start-Process 'rundll32.exe' 'user32.dll,LockWorkStation'; $status = 204 }
        elseif ($req.Url.AbsolutePath -eq '/clip') {
            $t = [string]$req.QueryString['text']; if ($t -and $t.Length -le 2000) { Set-Clipboard -Value $t; $status = 204 }
        }
        elseif ($req.Url.AbsolutePath -match '^/open/([a-z]+)$' -and $names.ContainsKey($Matches[1])) {
            $status = if (Open-App $Matches[1]) { 204 } else { 404 }
        }
    } catch { $status = 500 }
    $res.StatusCode = $status; $res.Close()
}
