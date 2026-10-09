# Package and compress clean distribution zip for Windows x64
$ErrorActionPreference = "Stop"

$pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
$ver = $pkg.version

$zipPath = "dist\OST-Player-v" + $ver + "-win32-x64.zip"
$srcFolder = "dist\OST Player-win32-x64"

Write-Host "Building Electron package to ensure dist files are completely up to date..."
$packSuccess = $true
try {
    & npm.cmd run pack
    if ($LASTEXITCODE -ne 0) { $packSuccess = $false }
} catch {
    $packSuccess = $false
}

if (-not $packSuccess) {
    Write-Warning "Full electron-packager build encountered file lock (OST Player may be running). Syncing updated files into existing package..."
    $appTarget = "$srcFolder\resources\app"
    if (Test-Path $appTarget) {
        Copy-Item -Path "index.html" -Destination "$appTarget\index.html" -Force
        Copy-Item -Path "package.json" -Destination "$appTarget\package.json" -Force
        Copy-Item -Path "preload.js" -Destination "$appTarget\preload.js" -Force
        Copy-Item -Path "main.js" -Destination "$appTarget\main.js" -Force
        if (Test-Path "desktop") { Copy-Item -Path "desktop" -Destination "$appTarget" -Recurse -Force }
        if (Test-Path "src") { Copy-Item -Path "src" -Destination "$appTarget" -Recurse -Force }
    }
}

if (-not (Test-Path $srcFolder)) {
    Write-Error "Source folder $srcFolder does not exist."
}

if (Test-Path $zipPath) {
    Write-Host "Removing existing zip archive to avoid duplicate entry accumulation..."
    Remove-Item $zipPath -Force
}

Write-Host "Compressing $srcFolder to $zipPath..."
$stageFolder = Join-Path $env:TEMP ("ost_staging_" + [guid]::NewGuid().ToString("N"))
try {
    Copy-Item -Path $srcFolder -Destination $stageFolder -Recurse -Force
    Compress-Archive -Path "$stageFolder\*" -DestinationPath $zipPath -CompressionLevel Optimal
} finally {
    if (Test-Path $stageFolder) { Remove-Item $stageFolder -Recurse -Force -ErrorAction SilentlyContinue }
}

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
