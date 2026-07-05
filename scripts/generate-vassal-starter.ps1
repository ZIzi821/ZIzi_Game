param(
  [string]$OutputDir = "vassal-starter"
)

Add-Type -AssemblyName System.Drawing

$script:Side = 42.0
$script:XSpacing = 63.0
$script:YSpacing = 73.0
$script:FirstX = 72.0
$script:FirstY = 72.0
$script:Cols = 20
$script:Rows = 15

function New-Bitmap {
  param(
    [int]$Width,
    [int]$Height,
    [scriptblock]$Draw,
    [string]$Path
  )

  $bitmap = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  try {
    & $Draw $graphics $Width $Height
    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function New-Brush {
  param([string]$Color)
  return New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($Color))
}

function New-Pen {
  param([string]$Color, [float]$Width = 1.0)
  return New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml($Color), $Width)
}

function Get-HexCenter {
  param([int]$Q, [int]$R)
  $x = $script:FirstX + ($Q * $script:XSpacing)
  $y = $script:FirstY + ($R * $script:YSpacing) + (($Q % 2) * ($script:YSpacing / 2.0))
  return @{ X = $x; Y = $y }
}

function Get-HexPoints {
  param([double]$Cx, [double]$Cy, [double]$Size)
  $points = New-Object "System.Drawing.PointF[]" 6
  for ($i = 0; $i -lt 6; $i++) {
    $angle = [Math]::PI / 180.0 * (60.0 * $i)
    $points[$i] = New-Object System.Drawing.PointF(
      [float]($Cx + $Size * [Math]::Cos($angle)),
      [float]($Cy + $Size * [Math]::Sin($angle))
    )
  }
  return $points
}

function Get-Terrain {
  param([int]$Q, [int]$R)

  $forestA = ([Math]::Pow($Q - 4, 2) + [Math]::Pow($R - 4, 2)) -lt 12
  $forestB = ([Math]::Pow($Q - 15, 2) + [Math]::Pow($R - 10, 2)) -lt 16
  $hill = (($Q - $R) -ge 4 -and ($Q - $R) -le 6 -and $R -gt 2 -and $R -lt 13)
  $marsh = (($Q - 9) * ($Q - 9) + ($R - 11) * ($R - 11)) -lt 8

  if ($forestA -or $forestB) { return "forest" }
  if ($hill) { return "hill" }
  if ($marsh) { return "marsh" }
  return "open"
}

function Draw-HexMap {
  param($G, [int]$Width, [int]$Height)

  $paper = New-Brush "#d8d0bf"
  $G.FillRectangle($paper, 0, 0, $Width, $Height)
  $paper.Dispose()

  $terrainColors = @{
    open = "#cfc696"
    forest = "#6f8f57"
    hill = "#b79b67"
    marsh = "#8fb2a3"
  }

  for ($r = 0; $r -lt $script:Rows; $r++) {
    for ($q = 0; $q -lt $script:Cols; $q++) {
      $center = Get-HexCenter $q $r
      $terrain = Get-Terrain $q $r
      $brush = New-Brush $terrainColors[$terrain]
      $points = Get-HexPoints $center.X $center.Y $script:Side
      $G.FillPolygon($brush, $points)
      $brush.Dispose()
    }
  }

  $roadPenOuter = New-Pen "#7e6e56" 8
  $roadPenInner = New-Pen "#d9c894" 4
  $roadCenters = @(
    @(0, 8), @(2, 8), @(4, 7), @(6, 7), @(8, 8), @(10, 8), @(12, 7), @(14, 7), @(16, 6), @(19, 6)
  )
  foreach ($pen in @($roadPenOuter, $roadPenInner)) {
    for ($i = 0; $i -lt $roadCenters.Count - 1; $i++) {
      $a = Get-HexCenter $roadCenters[$i][0] $roadCenters[$i][1]
      $b = Get-HexCenter $roadCenters[$i + 1][0] $roadCenters[$i + 1][1]
      $G.DrawLine($pen, [float]$a.X, [float]$a.Y, [float]$b.X, [float]$b.Y)
    }
  }
  $roadPenOuter.Dispose()
  $roadPenInner.Dispose()

  $riverPen = New-Pen "#2d7fa3" 11
  $riverPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $riverPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $riverPath = @(
    @(2, 0), @(3, 2), @(5, 3), @(6, 5), @(8, 6), @(9, 8), @(11, 10), @(13, 11), @(15, 13), @(16, 14)
  )
  for ($i = 0; $i -lt $riverPath.Count - 1; $i++) {
    $a = Get-HexCenter $riverPath[$i][0] $riverPath[$i][1]
    $b = Get-HexCenter $riverPath[$i + 1][0] $riverPath[$i + 1][1]
    $G.DrawLine($riverPen, [float]$a.X, [float]$a.Y, [float]$b.X, [float]$b.Y)
  }
  $riverPen.Dispose()

  $gridPen = New-Pen "#252525" 1.25
  $coordBrush = New-Brush "#2c2b24"
  $coordFont = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
  $coordFormat = New-Object System.Drawing.StringFormat
  $coordFormat.Alignment = [System.Drawing.StringAlignment]::Center
  $coordFormat.LineAlignment = [System.Drawing.StringAlignment]::Center

  for ($r = 0; $r -lt $script:Rows; $r++) {
    for ($q = 0; $q -lt $script:Cols; $q++) {
      $center = Get-HexCenter $q $r
      $points = Get-HexPoints $center.X $center.Y $script:Side
      $G.DrawPolygon($gridPen, $points)
      $label = "{0:D2}{1:D2}" -f ($q + 1), ($r + 1)
      $G.DrawString($label, $coordFont, $coordBrush, [float]$center.X, [float]($center.Y + 24), $coordFormat)
    }
  }

  $cityBrush = New-Brush "#6d5042"
  $majorCityBrush = New-Brush "#7f3532"
  $cityPen = New-Pen "#1f1a16" 2
  $cityFont = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
  $cities = @(
    @{ q = 5; r = 5; name = "Alpha"; major = $false },
    @{ q = 12; r = 8; name = "Bravo"; major = $true },
    @{ q = 17; r = 4; name = "Cross"; major = $false }
  )
  foreach ($city in $cities) {
    $center = Get-HexCenter $city.q $city.r
    $brush = if ($city.major) { $majorCityBrush } else { $cityBrush }
    $G.FillRectangle($brush, [float]($center.X - 15), [float]($center.Y - 14), 30, 28)
    $G.DrawRectangle($cityPen, [float]($center.X - 15), [float]($center.Y - 14), 30, 28)
    $G.DrawString($city.name, $cityFont, $coordBrush, [float]$center.X, [float]($center.Y - 30), $coordFormat)
  }

  $titleFont = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
  $smallFont = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Regular)
  $G.DrawString("VASSAL Starter Hex Map 20x15", $titleFont, $coordBrush, 24, 16)
  $G.DrawString("Grid: flat-topped | X offset 72 | Y offset 72 | Hex width 63 | Hex height 73", $smallFont, $coordBrush, 24, 43)

  $gridPen.Dispose()
  $coordBrush.Dispose()
  $coordFont.Dispose()
  $coordFormat.Dispose()
  $cityBrush.Dispose()
  $majorCityBrush.Dispose()
  $cityPen.Dispose()
  $cityFont.Dispose()
  $titleFont.Dispose()
  $smallFont.Dispose()
}

function Draw-Counter {
  param($G, [int]$Width, [int]$Height, [string]$Faction, [string]$UnitName, [string]$Kind, [string]$Stats)

  $G.Clear([System.Drawing.Color]::Transparent)
  $isRed = $Faction -eq "red"
  $fill = if ($isRed) { "#b63c36" } else { "#557197" }
  $edge = if ($isRed) { "#6b1715" } else { "#26384f" }
  $symbolFill = if ($isRed) { "#f4c15d" } else { "#e6dfc8" }
  $text = "#111111"

  $fillBrush = New-Brush $fill
  $symbolBrush = New-Brush $symbolFill
  $textBrush = New-Brush $text
  $edgePen = New-Pen $edge 4
  $blackPen = New-Pen "#111111" 3

  $G.FillRectangle($fillBrush, 2, 2, $Width - 4, $Height - 4)
  $G.DrawRectangle($edgePen, 2, 2, $Width - 4, $Height - 4)
  $G.FillRectangle($symbolBrush, 12, 20, $Width - 24, 24)
  $G.DrawRectangle($blackPen, 12, 20, $Width - 24, 24)

  if ($Kind -eq "armor") {
    $G.DrawEllipse($blackPen, 20, 26, $Width - 40, 12)
  }
  else {
    $G.DrawLine($blackPen, 12, 20, $Width - 12, 44)
    $G.DrawLine($blackPen, $Width - 12, 20, 12, 44)
  }

  $nameFont = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
  $statFont = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center

  $G.DrawString($UnitName, $nameFont, $textBrush, [float]($Width / 2), 11, $format)
  $G.DrawString($Stats, $statFont, $textBrush, [float]($Width / 2), 54, $format)

  $fillBrush.Dispose()
  $symbolBrush.Dispose()
  $textBrush.Dispose()
  $edgePen.Dispose()
  $blackPen.Dispose()
  $nameFont.Dispose()
  $statFont.Dispose()
  $format.Dispose()
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$mapWidth = [int][Math]::Ceiling($script:FirstX + (($script:Cols - 1) * $script:XSpacing) + $script:Side + 36)
$mapHeight = [int][Math]::Ceiling($script:FirstY + (($script:Rows - 1) * $script:YSpacing) + ($script:YSpacing / 2) + ($script:Side * [Math]::Sqrt(3) / 2) + 36)

New-Bitmap -Width $mapWidth -Height $mapHeight -Path (Join-Path $OutputDir "starter_hex_map_20x15.png") -Draw {
  param($G, $Width, $Height)
  Draw-HexMap $G $Width $Height
}

$counterSpecs = @(
  @{ Path = "blue_inf_1.png"; Faction = "blue"; UnitName = "1 INF"; Kind = "inf"; Stats = "4-4" },
  @{ Path = "blue_armor_1.png"; Faction = "blue"; UnitName = "2 ARM"; Kind = "armor"; Stats = "6-6" },
  @{ Path = "red_inf_1.png"; Faction = "red"; UnitName = "A INF"; Kind = "inf"; Stats = "3-4" },
  @{ Path = "red_armor_1.png"; Faction = "red"; UnitName = "B ARM"; Kind = "armor"; Stats = "5-6" }
)

foreach ($spec in $counterSpecs) {
  New-Bitmap -Width 64 -Height 64 -Path (Join-Path $OutputDir $spec.Path) -Draw {
    param($G, $Width, $Height)
    Draw-Counter $G $Width $Height $spec.Faction $spec.UnitName $spec.Kind $spec.Stats
  }
}

Write-Output "Generated VASSAL starter assets in $OutputDir"
Write-Output "Map image: starter_hex_map_20x15.png"
Write-Output "VASSAL grid: X offset 72, Y offset 72, Hex Height 73, Hex Width 63, Sideways unchecked"
