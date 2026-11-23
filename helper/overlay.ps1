# Launchpad over your open windows. A full-screen, always-on-top, see-through window: Windows blurs whatever is behind it
# live (a video keeps playing) - only as big as Launchpad's panel - and the wallpaper page in Launchpad-only mode (index.html?overlay=1) draws Launchpad on top.
#  - a "tool window" (not in the taskbar or Alt+Tab): browsers don't count it as covering them, so they keep drawing
#  - no redirection bitmap + the browser placed straight on the window: the page's transparent parts really are transparent
#  - while closed it shrinks to one invisible pixel (instead of hiding), so it stays warm and opens instantly
# The helper signals it (the Windows key) through the named event Local\ShadowLaunchpadToggle.
param([string]$WallDir = (Join-Path (Split-Path $PSScriptRoot -Parent) 'wallpaper'))   # the installed wallpaper (with its launch-config.js)
$ErrorActionPreference = 'Stop'
$log = Join-Path $PSScriptRoot 'overlay.log'
function Log([string]$m) { try { Add-Content $log ((Get-Date -Format 'HH:mm:ss.fff ') + $m) } catch {} }
try {
    $created = $false; $mutex = New-Object System.Threading.Mutex($true, 'Local\ShadowLaunchpadOverlay', [ref]$created)
    if (-not $created) { exit 0 }                                         # one overlay at a time
    Add-Type -AssemblyName System.Windows.Forms, System.Drawing
    $wv = @("$env:ProgramFiles\Lively Wallpaper\Plugins\WebView2", "$env:LOCALAPPDATA\Programs\Lively Wallpaper\Plugins\WebView2") |
          Where-Object { Test-Path (Join-Path $_ 'Microsoft.Web.WebView2.Core.dll') } | Select-Object -First 1
    if (-not $wv) { Log 'no WebView2 library (Lively not installed?)'; exit 1 }
    [void][Reflection.Assembly]::LoadFrom("$wv\Microsoft.Web.WebView2.Core.dll")
    [Microsoft.Web.WebView2.Core.CoreWebView2Environment]::SetLoaderDllFolderPath($wv)
    Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing @'
using System; using System.Runtime.InteropServices; using System.Drawing; using System.Drawing.Imaging; using System.IO;
// see-through (no redirection bitmap) + a tool window (browsers behind keep drawing; not in the taskbar / Alt+Tab)
public class OverlayForm : System.Windows.Forms.Form {
  protected override System.Windows.Forms.CreateParams CreateParams { get { var cp = base.CreateParams; cp.ExStyle |= 0x00200000 | 0x00000080; return cp; } }
  protected override bool ShowWithoutActivation { get { return true; } }
}
public static class Ov {
  [StructLayout(LayoutKind.Sequential)] struct AccentPolicy { public int State, Flags, Color, Anim; }
  [StructLayout(LayoutKind.Sequential)] struct CompAttr { public int Attr; public IntPtr Data; public int Size; }
  [DllImport("user32.dll")] static extern int SetWindowCompositionAttribute(IntPtr h, ref CompAttr d);
  [DllImport("user32.dll")] static extern IntPtr SetProcessDpiAwarenessContext(IntPtr v);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr p);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool attach);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] static extern int SetWindowRgn(IntPtr h, IntPtr rgn, bool redraw);
  [DllImport("gdi32.dll")] static extern IntPtr CreateRectRgn(int a, int b, int c, int d);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int hh, uint f);
  [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr h, int a, ref int v, int s);
  // the window itself is only as big as Launchpad's panel (Windows blurs the whole window, a region doesn't cut the blur)
  public static void Place(IntPtr h, int x, int y, int w, int hh) { SetWindowPos(h, new IntPtr(-1), x, y, w, hh, 0x0010 | 0x0200); }   // topmost, no activate, no owner z-order
  public static void Round(IntPtr h) { int v = 1; DwmSetWindowAttribute(h, 33, ref v, 4); int none = unchecked((int)0xFFFFFFFE); DwmSetWindowAttribute(h, 34, ref none, 4); }   // rounded corners, and no Windows 11 border (it drew a box while the genie runs)                                             // Windows 11 rounded corners
  [DllImport("gdi32.dll")] static extern IntPtr CreateRoundRectRgn(int a, int b, int c, int d, int w, int h);
  // the visible part of the window: a rounded rectangle, scaled around its centre (s = 1: the whole panel) - used for the open / close animation
  public static void Shape(IntPtr h, int w, int hh, int r, double s) {
    int sw = (int)Math.Round(w * s), sh = (int)Math.Round(hh * s), x = (w - sw) / 2, y = (hh - sh) / 2, rr = (int)Math.Round(r * 2 * s);
    SetWindowRgn(h, CreateRoundRectRgn(x, y, x + sw + 1, y + sh + 1, rr, rr), true);
  }
  public static IntPtr Fg() { return GetForegroundWindow(); }
  public static System.Threading.Tasks.Task<string> ShotAsync(Rectangle b) { return System.Threading.Tasks.Task.Run(() => Shot(b)); }   // off the window's thread: Launchpad starts zooming meanwhile
  [DllImport("dwmapi.dll")] static extern int DwmFlush();
  public static void Vsync() { try { DwmFlush(); } catch { } }               // wait for the screen's next frame
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int k);
  [StructLayout(LayoutKind.Sequential)] struct PT { public int x, y; }
  [StructLayout(LayoutKind.Sequential)] struct RC { public int l, t, r, b; }
  [DllImport("user32.dll")] static extern bool GetCursorPos(out PT p);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RC r);
  // a mouse button is down somewhere outside this window
  public static bool ClickOutside(IntPtr h) {
    if ((GetAsyncKeyState(0x01) & 0x8000) == 0 && (GetAsyncKeyState(0x02) & 0x8000) == 0) return false;
    PT p; RC r; GetCursorPos(out p); GetWindowRect(h, out r);
    return p.x < r.l || p.x >= r.r || p.y < r.t || p.y >= r.b;
  }
  // CSS cubic-bezier(x1,y1,x2,y2) at progress p - the same curve the page's zoom uses
  public static double Bez(double x1, double y1, double x2, double y2, double p) {
    if (p <= 0) return 0; if (p >= 1) return 1;
    double lo = 0, hi = 1, t = p;
    for (int i = 0; i < 40; i++) { t = (lo + hi) / 2; double x = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t; if (x < p) lo = t; else hi = t; }
    return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  }
  [StructLayout(LayoutKind.Sequential)] struct Margins { public int l, r, t, b; }
  [DllImport("dwmapi.dll")] static extern int DwmExtendFrameIntoClientArea(IntPtr h, ref Margins m);
  // Windows 11's own backdrop (the kind Settings / Start use) instead of the old accent blur
  // off: no frame, no Windows shadow either (it drew a shadowy box around the window while the genie ran)
  public static int Backdrop(IntPtr h, bool on) {
    int nc = on ? 2 : 1; DwmSetWindowAttribute(h, 2, ref nc, 4);                 // DWMWA_NCRENDERING_POLICY: enabled / disabled
    int e = on ? -1 : 0; var m = new Margins { l = e, r = e, t = e, b = e }; DwmExtendFrameIntoClientArea(h, ref m);
    int dark = 1; DwmSetWindowAttribute(h, 20, ref dark, 4); int v = on ? 3 : 1; return DwmSetWindowAttribute(h, 38, ref v, 4);
  }
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  public static void DpiAware() { try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch { } }   // per-monitor v2: real pixels
  // Windows' blur of what is behind: acrylic, lightly tinted (what is behind stays visible and moving)
  public static int Blur(IntPtr h, bool on) {
    var a = new AccentPolicy { State = on ? 4 : 0, Flags = 2, Color = 0x0CC4C4C8 }; int sz = Marshal.SizeOf(a); IntPtr p = Marshal.AllocHGlobal(sz); Marshal.StructureToPtr(a, p, false);
    var d = new CompAttr { Attr = 19, Data = p, Size = sz }; int r = SetWindowCompositionAttribute(h, ref d); Marshal.FreeHGlobal(p); return r;
  }
  // the screen as it is (half size), as a JPEG data URL - for the glass search bar to bend
  public static string Shot(Rectangle b) {
    using (var full = new Bitmap(b.Width, b.Height)) {
      using (var g = Graphics.FromImage(full)) g.CopyFromScreen(b.Location, Point.Empty, b.Size);
      using (var sm = new Bitmap(full, b.Width / 2, b.Height / 2)) using (var ms = new MemoryStream()) {
        var enc = Array.Find(ImageCodecInfo.GetImageEncoders(), e => e.MimeType == "image/jpeg"); var p = new EncoderParameters(1); p.Param[0] = new EncoderParameter(Encoder.Quality, 70L);
        sm.Save(ms, enc, p); return "data:image/jpeg;base64," + Convert.ToBase64String(ms.ToArray());
      }
    }
  }  // to the front even though the key was pressed elsewhere (borrowing the foreground window's input for a moment)
  public static void Front(IntPtr h) {
    IntPtr fg = GetForegroundWindow(); uint me = GetCurrentThreadId(), other = fg == IntPtr.Zero ? 0 : GetWindowThreadProcessId(fg, IntPtr.Zero);
    bool att = other != 0 && other != me && AttachThreadInput(me, other, true);
    BringWindowToTop(h); SetForegroundWindow(h);
    if (att) AttachThreadInput(me, other, false);
  }
}
// Launchpad's own frosted glass: what is behind the panel, captured small (blur hides the detail) ~30 times a second and handed to
// the page, which blurs it. The overlay window is left out of screen captures, so it sees the apps behind it, not itself.
public static class LiveBg {
  [DllImport("user32.dll")] static extern bool SetWindowDisplayAffinity(IntPtr h, uint a);
  [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr h);
  [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr h, IntPtr dc);
  [DllImport("gdi32.dll")] static extern bool StretchBlt(IntPtr d, int dx, int dy, int dw, int dh, IntPtr s, int sx, int sy, int sw, int sh, uint op);
  [DllImport("gdi32.dll")] static extern int SetStretchBltMode(IntPtr dc, int m);
  public static bool Exclude(IntPtr h) { return SetWindowDisplayAffinity(h, 0x11); }   // WDA_EXCLUDEFROMCAPTURE
  public static volatile int X, Y, W, H;
  static volatile bool run; static System.Threading.Thread th;
  static ImageCodecInfo jpg = Array.Find(ImageCodecInfo.GetImageEncoders(), e => e.MimeType == "image/jpeg");
  public static string Grab() {
    int w = W, h = H; if (w < 8 || h < 8) return null;
    int bw = Math.Max(8, w / 6), bh = Math.Max(8, h / 6);
    using (var bmp = new Bitmap(bw, bh)) {
      using (var g = Graphics.FromImage(bmp)) {
        IntPtr dc = g.GetHdc(), sdc = GetDC(IntPtr.Zero);
        SetStretchBltMode(dc, 4);                                                  // HALFTONE: a smooth average, not dropped pixels
        StretchBlt(dc, 0, 0, bw, bh, sdc, X, Y, w, h, 0x00CC0020);
        ReleaseDC(IntPtr.Zero, sdc); g.ReleaseHdc(dc);
      }
      using (var ms = new MemoryStream()) {
        var p = new EncoderParameters(1); p.Param[0] = new EncoderParameter(Encoder.Quality, 72L);
        bmp.Save(ms, jpg, p); return "data:image/jpeg;base64," + Convert.ToBase64String(ms.ToArray());
      }
    }
  }
  public static void Start(System.Windows.Forms.Control ui, object webview) {
    if (run) return; run = true;
    var post = webview.GetType().GetMethod("PostWebMessageAsString");
    th = new System.Threading.Thread(() => {
      var sw = System.Diagnostics.Stopwatch.StartNew(); long next = 0;
      while (run) {
        string f = null; try { f = Grab(); } catch { }
        if (f != null && run) { try { ui.BeginInvoke((Action)(() => { try { if (run) post.Invoke(webview, new object[] { "bg:" + f }); } catch { } })); } catch { } }
        next += 33; long wait = next - sw.ElapsedMilliseconds; if (wait < 0) { next = sw.ElapsedMilliseconds; wait = 0; }
        System.Threading.Thread.Sleep((int)Math.Max(1, wait));
      }
    }) { IsBackground = true, Priority = System.Threading.ThreadPriority.AboveNormal };
    th.Start();
  }
  public static void Stop() { run = false; }
}
'@
    [Ov]::DpiAware()
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $form = New-Object OverlayForm
    $form.FormBorderStyle = 'None'; $form.StartPosition = 'Manual'; $form.Bounds = $screen; $form.TopMost = $true; $form.ShowInTaskbar = $false; $form.Text = 'Launchpad'
    $script:prevFg = [IntPtr]::Zero; $script:launched = $false; $script:panel = $null; $script:ctl = $null; $script:envT = $null; $script:ctlT = $null; $script:ready = $false; $script:open = $false; $script:vis = $false; $script:shownAt = [datetime]::MinValue
    $script:bdOk = $true
    function Frost([bool]$on) {
        if ($on) { return }                                              # the page draws its own frosted glass now (LiveBg)                                          # Windows 11's backdrop; the older accent blur if this Windows doesn't have it
        if ($script:bdOk) { if ([Ov]::Backdrop($form.Handle, $on) -eq 0) { return }; $script:bdOk = $false }
        [void][Ov]::Blur($form.Handle, $on)
    }
    # the window sits over part of the screen; the page inside is laid out for the whole screen and shifted so it lines up
    function Place-Overlay([int]$x, [int]$y, [int]$w, [int]$h) {
        $x = [Math]::Max(0, $x); $y = [Math]::Max(0, $y); $w = [Math]::Max(1, [Math]::Min($w, $screen.Width - $x)); $h = [Math]::Max(1, [Math]::Min($h, $screen.Height - $y))
        if ($script:ctl) { $script:ctl.Bounds = New-Object System.Drawing.Rectangle (-$x), (-$y), $screen.Width, $screen.Height }
        [Ov]::Place($form.Handle, $x, $y, $w, $h)
        if ($script:ctl) { $script:ctl.NotifyParentWindowPositionChanged() }
    }
    function Place-Tiny { Place-Overlay ($screen.Width - 1) ($screen.Height - 1) 1 1 }   # closed: one pixel in the corner (still "on screen", so the page stays warm)
    # the panel at a scale around its centre (1 = Launchpad's full panel)
    $script:scale = 1.0
    function Place-Scaled {
        $v = $script:panel; if (-not $v) { $w0 = [int]($screen.Width * .5); $h0 = [int]($screen.Height * .74); $v = @([int](($screen.Width - $w0) / 2), [int]($screen.Height * .12), $w0, $h0) }
        $x = [double]$v[0]; $y = [double]$v[1]; $w = [double]$v[2]; $h = [double]$v[3]; $s = $script:scale
        $ox = $screen.Width / 2; $oy = $screen.Height * .97                     # the zoom's centre: bottom middle, like the page's
        $m = if ($s -lt .999) { [Math]::Min($w, $h) * .03 * $s } else { 0 }     # a hair of slack while moving, so the frosted panel never trims Launchpad
        Place-Overlay ([int]($ox + ($x - $ox) * $s - $m)) ([int]($oy + ($y - $oy) * $s - $m)) ([int]($w * $s + 2 * $m)) ([int]($h * $s + 2 * $m))
    }
    # open / close: the frosted panel zooms with Launchpad (same curves and timings as the page: up out of the bottom, back down into it)
    # frame by frame, in step with the screen (DwmFlush waits for each frame), so the panel moves as smoothly as the page
    $script:anim = $null; $script:animId = 0
    function Animate([double]$from, [double]$to, [int]$ms, $bez, $done) {
        $id = ++$script:animId; $script:anim = $id; $sw = [Diagnostics.Stopwatch]::StartNew(); $lead = 16
        do {
            $p = [Math]::Min(1.0, ($sw.Elapsed.TotalMilliseconds + $lead) / $ms)
            $script:scale = $from + ($to - $from) * [Ov]::Bez($bez[0], $bez[1], $bez[2], $bez[3], $p); Place-Scaled
            [System.Windows.Forms.Application]::DoEvents()                 # the page's messages keep flowing (a close can cut an open short)
            if ($script:animId -ne $id) { return }
            [Ov]::Vsync()
        } while ($p -lt 1)
        $script:anim = $null; if ($done) { & $done }
    }
    function Later($sb) { [void]$form.BeginInvoke([Action]$sb) }        # run once the current event is over (not inside the browser's own callback)
    $zoomIn = @(.16, 1, .3, 1); $zoomOut = @(.5, 0, .75, .35)
    function Set-Capture {                                                # the part of the screen behind the panel
        $v = $script:panel; if (-not $v) { $w0 = [int]($screen.Width * .5); $h0 = [int]($screen.Height * .74); $v = @([int](($screen.Width - $w0) / 2), [int]($screen.Height * .12), $w0, $h0) }
        [LiveBg]::X = [int]$v[0]; [LiveBg]::Y = [int]$v[1]; [LiveBg]::W = [int]$v[2]; [LiveBg]::H = [int]$v[3]
    }
    function Close-Overlay {
        [LiveBg]::Stop()
        $script:open = $false; $script:vis = $false; $script:anim = $null; $script:animId++
        $mine = [Ov]::Fg() -eq $form.Handle
        Place-Tiny; Frost $false
        # keyboard back to the app you were in (Space pauses the video again) - unless you clicked another app, or opened one
        if ($mine -and -not $script:launched -and $script:prevFg -ne [IntPtr]::Zero -and [Ov]::IsWindow($script:prevFg)) { [Ov]::Front($script:prevFg) }
        Log 'closed'
    }
    # the browser, placed straight on the window (created on the window's own thread, step by step)
    $boot = New-Object System.Windows.Forms.Timer; $boot.Interval = 20
    $boot.add_Tick({
        if (-not $script:envT) { $script:envT = [Microsoft.Web.WebView2.Core.CoreWebView2Environment]::CreateAsync($null, (Join-Path (Split-Path $PSScriptRoot -Parent) 'overlay-webview'), $null); return }
        if ($script:envT.IsFaulted) { Log ('browser start failed, retrying: ' + $script:envT.Exception.InnerException.Message); $script:envT = $null; $boot.Interval = 2000; return }
        if ($script:ctlT -and $script:ctlT.IsFaulted) { Log ('browser view failed, retrying: ' + $script:ctlT.Exception.InnerException.Message); $script:ctlT = $null; $script:envT = $null; $boot.Interval = 2000; return }
        $boot.Interval = 20
        if (-not $script:ctlT) { if ($script:envT.IsCompleted) { $script:ctlT = $script:envT.Result.CreateCoreWebView2ControllerAsync($form.Handle) }; return }
        if (-not $script:ctlT.IsCompleted) { return }
        $boot.Stop()
        $c = $script:ctlT.Result; $script:ctl = $c
        $c.DefaultBackgroundColor = [System.Drawing.Color]::Transparent
        $c.IsVisible = $true; Place-Tiny
        $w = $c.CoreWebView2
        $w.SetVirtualHostNameToFolderMapping('shadow-overlay.localhost', $WallDir, [Microsoft.Web.WebView2.Core.CoreWebView2HostResourceAccessKind]::Allow)
        $w.Settings.AreDefaultContextMenusEnabled = $false; $w.Settings.IsZoomControlEnabled = $false; $w.Settings.IsStatusBarEnabled = $false
        $w.add_WebMessageReceived({ param($s2, $m) $msg = $m.TryGetWebMessageAsString()
            if ($msg -like 'panel:*') { $script:panel = $msg.Substring(6).Split(','); Set-Capture; if ($script:vis -and -not $script:anim) { Place-Scaled }; return }
            # the genie (the page draws it): the window covers the panel down to the bottom of the screen while it runs, no blur;
            # once Launchpad settles the page sends its panel and asks for the blur
            if ($msg -eq 'vis') { if ($script:open) { $script:vis = $true; $script:scale = 1.0; $failsafe.Stop() }; return }
            if ($msg -like 'place:*') { if ($script:open) { $v = $msg.Substring(6).Split(','); Place-Overlay ([int]$v[0]) ([int]$v[1]) ([int]$v[2]) ([int]$v[3]) }; return }
            if ($msg -eq 'frost:1') { if ($script:open) { Frost $true }; return }
            if ($msg -eq 'genieout') { $script:vis = $false; $script:animId++; $script:anim = $null; Frost $false; return }
            if ($msg -eq 'launch') { $script:launched = $true }
            elseif ($msg -eq 'shown') { if ($script:t0) { Log ("shown after {0} ms" -f $script:t0.ElapsedMilliseconds) } }
            if ($msg -eq 'shown') { if ($script:open -and -not $script:vis) { $script:vis = $true; Later { Frost $true; Animate 0.1 1.0 400 $zoomIn $null } } }   # Launchpad is zooming in: the frosted panel zooms with it
            elseif ($msg -eq 'closing') { if ($script:vis) { $script:vis = $false; Later { Animate $script:scale 0.1 260 $zoomOut { Frost $false; Place-Tiny } } } }   # ...and back down with it
            elseif ($msg -eq 'hide') { Close-Overlay } })
        $w.add_NavigationCompleted({ $script:ready = $true; Log 'page ready' })
        $w.Navigate('https://shadow-overlay.localhost/index.html?overlay=1')
    })
    # clicked into another app: Launchpad goes (not in its first second: letting go of the Windows key hands focus back for a moment)
    $form.add_Deactivate({ if ($script:open -and ([datetime]::Now - $script:shownAt).TotalMilliseconds -gt 1000) { [void]$script:ctl.CoreWebView2.ExecuteScriptAsync('window.lpHide && lpHide()') } })
    $failsafe = New-Object System.Windows.Forms.Timer; $failsafe.Interval = 400      # the page never said 'shown': show the panel anyway
    $failsafe.add_Tick({ $failsafe.Stop(); if ($script:open -and -not $script:vis) { $script:vis = $true; Frost $true; Animate 0.1 1.0 400 $zoomIn $null } })
    $shotWait = New-Object System.Windows.Forms.Timer; $shotWait.Interval = 10
    $shotWait.add_Tick({
        if (-not $script:shotT -or -not $script:shotT.IsCompleted) { return }
        $shotWait.Stop(); $t = $script:shotT; $script:shotT = $null
        if ($t.Status -eq 'RanToCompletion' -and $script:open) { [void]$script:ctl.CoreWebView2.ExecuteScriptAsync("window.__overlayBgSet && __overlayBgSet('" + $t.Result + "')") }
    })
    $peek = New-Object System.Windows.Forms.Timer; $peek.Interval = 1100
    $peekRun = New-Object System.Windows.Forms.Timer; $peekRun.Interval = 900
    $peekRun.add_Tick({ $peekRun.Stop(); [void]$script:ctl.CoreWebView2.ExecuteScriptAsync($script:peekJs) })
    $peek.add_Tick({ $peek.Stop(); try { $fs = [IO.File]::Create((Join-Path $PSScriptRoot 'peek.png')); $script:peekT = $script:ctl.CoreWebView2.CapturePreviewAsync([Microsoft.Web.WebView2.Core.CoreWebView2CapturePreviewImageFormat]::Png, $fs); $script:peekFs = $fs; $peekDone.Start() } catch { Log ('peek: ' + $_.Exception.Message) } })
    $peekDone = New-Object System.Windows.Forms.Timer; $peekDone.Interval = 50
    $peekDone.add_Tick({ if ($script:peekT.IsCompleted) { $peekDone.Stop(); $script:peekFs.Close(); Log 'peek saved' } })
    $outside = New-Object System.Windows.Forms.Timer; $outside.Interval = 30
    $outside.add_Tick({
        if (-not ($script:open -and $script:vis) -or $script:anim) { return }
        $fg = [Ov]::Fg(); if ($fg -eq $form.Handle) { $script:hadFg = $true }
        $age = ([datetime]::Now - $script:shownAt).TotalMilliseconds
        if ($age -gt 350 -and ([Ov]::ClickOutside($form.Handle) -or ($script:hadFg -and $fg -ne $form.Handle -and $fg -ne [IntPtr]::Zero))) {
            [void]$script:ctl.CoreWebView2.ExecuteScriptAsync('window.lpHide && lpHide()')
        }
    })
    $refocus = New-Object System.Windows.Forms.Timer; $refocus.Interval = 250
    $refocus.add_Tick({ $refocus.Stop(); if ($script:open) { [Ov]::Front($form.Handle); $script:ctl.MoveFocus([Microsoft.Web.WebView2.Core.CoreWebView2MoveFocusReason]::Programmatic) } })
    $signal = New-Object System.Threading.EventWaitHandle($false, [System.Threading.EventResetMode]::AutoReset, 'Local\ShadowLaunchpadToggle')
    $poll = New-Object System.Windows.Forms.Timer; $poll.Interval = 10
    $poll.add_Tick({
        if (-not $signal.WaitOne(0)) { return }
        if (-not $script:ready) { Log 'not ready yet'; return }
        if ($script:open) { [void]$script:ctl.CoreWebView2.ExecuteScriptAsync('window.lpHide && lpHide()'); return }
        $script:t0 = [Diagnostics.Stopwatch]::StartNew(); $script:shotT = [Ov]::ShotAsync($screen); $shotWait.Start()   # the screen under the glass search bar (taken while Launchpad is still tiny)                                       # the screen as it is, before the window opens over it
        $script:prevFg = [Ov]::Fg(); if ($script:prevFg -eq $form.Handle) { $script:prevFg = [IntPtr]::Zero }; $script:launched = $false
        $script:open = $true; $script:vis = $false; $script:hadFg = $false; $script:shownAt = [datetime]::Now
        Set-Capture; [LiveBg]::Start($form, $script:ctl.CoreWebView2)    # the frosted glass starts filling straight away
        [void]$script:ctl.CoreWebView2.ExecuteScriptAsync('window.__overlayGo && __overlayGo()')   # the page says 'shown' once Launchpad has drawn
        [Ov]::Front($form.Handle); $script:ctl.MoveFocus([Microsoft.Web.WebView2.Core.CoreWebView2MoveFocusReason]::Programmatic)   # keys go to Launchpad straight away
        $failsafe.Stop(); $failsafe.Start()
        $refocus.Start(); Log 'opened'
        if (Test-Path (Join-Path $PSScriptRoot 'peek.test')) {          # (testing) optionally run peek.js on the page first, then take the picture
            $pj = Join-Path $PSScriptRoot 'peek.js'; if (Test-Path $pj) { $script:peekJs = Get-Content $pj -Raw; $peekRun.Start(); $peek.Interval = 3600 } else { $peek.Interval = 1100 }
            $peek.Start()
        }   # (testing) a picture of the page itself, since screenshots can't see this window
    })
    $form.add_Shown({ [Ov]::Round($form.Handle); [void][Ov]::Backdrop($form.Handle, $false); Log ('left out of captures: ' + [LiveBg]::Exclude($form.Handle)); $boot.Start(); $poll.Start(); $outside.Start() })   # stays full screen until the browser is placed on it, then shrinks
    Log "starting (WebView2 from $wv, page from $WallDir)"
    [System.Windows.Forms.Application]::Run($form)
} catch { Log ("error: " + $_.Exception.Message) }
