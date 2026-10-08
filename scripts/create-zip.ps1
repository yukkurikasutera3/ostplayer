# Package and compress clean distribution zip for Windows x64
$ErrorActionPreference = "Stop"

$pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
$ver = $pkg.version

$zipPath = "dist\OST-Player-v" + $ver + "-win32-x64.zip"
$srcFolder = "dist\OST Player-win32-x64"

if (-not (Test-Path $srcFolder)) {
    Write-Error "Source folder $srcFolder does not exist. Run 'npm run pack' first."
}

if (Test-Path $zipPath) {
    Write-Host "Removing existing zip archive to avoid duplicate entry accumulation..."
    Remove-Item $zipPath -Force
}

Write-Host "Compressing $srcFolder to $zipPath..."
Compress-Archive -Path "$srcFolder\*" -DestinationPath $zipPath -CompressionLevel Optimal

$zipInfo = Get-Item $zipPath
$zipSizeMB = [math]::Round($zipInfo.Length / 1MB, 2)

Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
$count = $z.Entries.Count
$uncompressed = 0
foreach ($e in $z.Entries) { $uncompressed += $e.Length }
$uncompressedMB = [math]::Round($uncompressed / 1MB, 2)
$z.Dispose()

Write-Host "[ZIP SUCCESS] Generated clean zip: $zipPath"
Write-Host "  Compressed Size: $zipSizeMB MB"
Write-Host "  Uncompressed Size: $uncompressedMB MB"
Write-Host "  Total File Entries: $count"
