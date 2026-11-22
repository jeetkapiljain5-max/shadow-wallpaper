# Draws Shadow Wallpaper's app icon (a rounded tile of the wallpaper's monochrome stripes) as shadow.ico
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot 'shadow.ico'
function Draw([int]$n) {
    $b = New-Object System.Drawing.Bitmap $n, $n; $g = [System.Drawing.Graphics]::FromImage($b)
    $g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'; $g.Clear([System.Drawing.Color]::Transparent)
    $r = $n * .225; $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, 2 * $r, 2 * $r, 180, 90); $path.AddArc($n - 2 * $r, 0, 2 * $r, 2 * $r, 270, 90)
    $path.AddArc($n - 2 * $r, $n - 2 * $r, 2 * $r, 2 * $r, 0, 90); $path.AddArc(0, $n - 2 * $r, 2 * $r, 2 * $r, 90, 90); $path.CloseFigure()
    $g.SetClip($path)
    $tones = 40, 110, 200, 245, 170, 70, 135, 230, 95, 30           # stripe brightness, like the wallpaper
    $w = $n / $tones.Count
    for ($i = 0; $i -lt $tones.Count; $i++) {
        $t = $tones[$i]; $lo = [Math]::Max(0, $t - 70)
        $br = New-Object System.Drawing.Drawing2D.LinearGradientBrush ([System.Drawing.PointF]::new(0, 0)), ([System.Drawing.PointF]::new(0, $n)), ([System.Drawing.Color]::FromArgb(255, $t, $t, $t)), ([System.Drawing.Color]::FromArgb(255, $lo, $lo, $lo))
        $g.FillRectangle($br, [float]($i * $w), 0, [float]($w + 1), $n); $br.Dispose()
    }
    $hl = New-Object System.Drawing.Drawing2D.LinearGradientBrush ([System.Drawing.PointF]::new(0, 0)), ([System.Drawing.PointF]::new(0, $n * .5)), ([System.Drawing.Color]::FromArgb(70, 255, 255, 255)), ([System.Drawing.Color]::FromArgb(0, 255, 255, 255))
    $g.FillRectangle($hl, 0, 0, $n, $n * .5)                         # glass sheen
    $g.ResetClip()
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(90, 255, 255, 255)), ([Math]::Max(1, $n / 128)); $g.DrawPath($pen, $path)
    $g.Dispose(); $ms = New-Object IO.MemoryStream; $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose(); return ,$ms.ToArray()
}
$sizes = 16, 24, 32, 48, 64, 128, 256; $imgs = $sizes | ForEach-Object { ,(Draw $_) }
$o = New-Object IO.MemoryStream; $wr = New-Object IO.BinaryWriter $o
$wr.Write([uint16]0); $wr.Write([uint16]1); $wr.Write([uint16]$sizes.Count)
$off = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $s = $sizes[$i]; $d = $imgs[$i]
    $wr.Write([byte]($s % 256)); $wr.Write([byte]($s % 256)); $wr.Write([byte]0); $wr.Write([byte]0)
    $wr.Write([uint16]1); $wr.Write([uint16]32); $wr.Write([uint32]$d.Length); $wr.Write([uint32]$off); $off += $d.Length
}
foreach ($d in $imgs) { $wr.Write($d) }
$wr.Flush(); [IO.File]::WriteAllBytes($out, $o.ToArray()); "wrote $out ($($o.Length) bytes)"
