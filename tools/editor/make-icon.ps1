Add-Type -AssemblyName System.Drawing

$size = 64
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.Clear([System.Drawing.Color]::Transparent)

$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = 14
$rect = New-Object System.Drawing.Rectangle(1, 1, ($size - 2), ($size - 2))
$path.AddArc($rect.X, $rect.Y, $r, $r, 180, 90)
$path.AddArc(($rect.Right - $r), $rect.Y, $r, $r, 270, 90)
$path.AddArc(($rect.Right - $r), ($rect.Bottom - $r), $r, $r, 0, 90)
$path.AddArc($rect.X, ($rect.Bottom - $r), $r, $r, 90, 90)
$path.CloseFigure()

$bg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 15, 18, 24))
$g.FillPath($bg, $path)

$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 226, 180, 95), 2)
$g.DrawPath($pen, $path)

$font = New-Object System.Drawing.Font("Segoe UI", 30, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 226, 180, 95))
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$textRect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
$g.DrawString("D", $font, $brush, $textRect, $format)

$g.Dispose()

$icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
$stream = [System.IO.File]::Create("C:\Users\qw691\Documents\Qoder\2026-11-09\90925176\tools\editor\icon.ico")
$icon.Save($stream)
$stream.Close()
$bmp.Dispose()
Write-Output "icon written"
