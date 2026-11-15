$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$sourcePath = Join-Path $PSScriptRoot '../../../branding/linis-purple.png'
$outputDir = Join-Path $PSScriptRoot '../extension/icons'
$sourceImage = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $sourcePath).Path)
try {
    foreach ($size in @(16, 32, 48, 128)) {
        $bitmap = New-Object System.Drawing.Bitmap($size, $size)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.Clear([System.Drawing.Color]::Transparent)
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $attributes = New-Object System.Drawing.Imaging.ImageAttributes
            try {
                $attributes.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
                $rectangle = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
                $graphics.DrawImage($sourceImage, $rectangle, 0, 0, $sourceImage.Width, $sourceImage.Height, [System.Drawing.GraphicsUnit]::Pixel, $attributes)
                $bitmap.Save((Join-Path $outputDir "linis-purple$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
            } finally { $attributes.Dispose() }
        } finally { $graphics.Dispose(); $bitmap.Dispose() }
    }
} finally { $sourceImage.Dispose() }
