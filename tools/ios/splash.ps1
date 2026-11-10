# Generates iOS launch screens from the app icon (dark background, centred emblem + wordmark).
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$iconPath = Join-Path $root 'public/icons/app-icon-1024.png'
$outDir = Join-Path $root 'public/splash'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Add-Type -AssemblyName System.Drawing
$icon = [System.Drawing.Image]::FromFile($iconPath)
$bg = [System.Drawing.Color]::FromArgb(255, 7, 8, 11)

function Draw-SpacedText($g, $text, $font, $brush, $centerX, $top, $spacing) {
  $widths = @()
  foreach ($ch in $text.ToCharArray()) { $widths += $g.MeasureString([string]$ch, $font).Width }
  $total = ($widths | Measure-Object -Sum).Sum + $spacing * ($text.Length - 1)
  $x = $centerX - $total / 2
  for ($i = 0; $i -lt $text.Length; $i++) {
    $g.DrawString([string]$text[$i], $font, $brush, [single]$x, [single]$top)
    $x += $widths[$i] + $spacing
  }
}

$sizes = @(
  @(1290, 2796), @(1179, 2556), @(1284, 2778), @(1170, 2532),
  @(1125, 2436), @(1242, 2688), @(828, 1792), @(750, 1334),
  @(2048, 2732), @(1668, 2388), @(1668, 2224), @(1640, 2360)
)

foreach ($size in $sizes) {
  $width = $size[0]
  $height = $size[1]
  $bmp = New-Object System.Drawing.Bitmap($width, $height)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear($bg)

  # Cap the emblem size so the icon is downscaled (clean) instead of blurry-upscaled.
  $side = [int]([Math]::Min(420, [Math]::Min($width, $height) * 0.22))
  $x = [int](($width - $side) / 2)
  $y = [int]($height * 0.4)
  $g.DrawImage($icon, $x, $y, $side, $side)

  $titleFont = New-Object System.Drawing.Font('Georgia', [single]($side * 0.15), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 226, 180, 95))
  Draw-SpacedText $g 'DIMENSION' $titleFont $titleBrush ($width / 2) ($y + $side + $side * 0.14) ($side * 0.035)

  $subFont = New-Object System.Drawing.Font('Segoe UI', [single]($side * 0.055), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(190, 160, 158, 152))
  Draw-SpacedText $g 'MINECRAFT MMORPG' $subFont $subBrush ($width / 2) ($y + $side + $side * 0.36) ($side * 0.03)

  $name = "apple-splash-$($width)x$($height).png"
  $bmp.Save((Join-Path $outDir $name), [System.Drawing.Imaging.ImageFormat]::Png)

  $titleFont.Dispose()
  $subFont.Dispose()
  $titleBrush.Dispose()
  $subBrush.Dispose()
  $g.Dispose()
  $bmp.Dispose()
  Write-Output $name
}

$icon.Dispose()
