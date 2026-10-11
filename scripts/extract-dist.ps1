$ErrorActionPreference = "Stop"
$root = Get-Location

$zipPath = [System.IO.Path]::Combine($root.Path, "dist", "OST-Player-v3.9.1-win32-x64.zip")
$targetFolder = [System.IO.Path]::Combine($root.Path, "dist", "OST-Player-v3.9.1-win32-x64")
$defaultPackFolder = [System.IO.Path]::Combine($root.Path, "dist", "OST Player-win32-x64")
$oldFolder = [System.IO.Path]::Combine($root.Path, "dist", "OST-Player-v3.4.0-win32-x64")

Add-Type -AssemblyName System.IO.Compression.FileSystem

if (-not (Test-Path -LiteralPath $zipPath)) {
    Write-Error "Zip file not found: $zipPath"
}

# 1. Cleanly extract to dist\OST-Player-v3.9.1-win32-x64
if (Test-Path -LiteralPath $targetFolder) {
    Remove-Item -LiteralPath $targetFolder -Recurse -Force
}
[System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $targetFolder)
Write-Host "Successfully extracted to: $targetFolder"

# 2. Sync to dist\OST Player-win32-x64 (robocopy)
if (Test-Path -LiteralPath $defaultPackFolder) {
    robocopy $targetFolder $defaultPackFolder /E /IS /IT /NP /R:3 /W:1 > $null
    Write-Host "Successfully synced to: $defaultPackFolder"
}

# 3. Sync to dist\OST-Player-v3.4.0-win32-x64 if present
if (Test-Path -LiteralPath $oldFolder) {
    robocopy $targetFolder $oldFolder /E /IS /IT /NP /R:3 /W:1 > $null
    Write-Host "Successfully synced to: $oldFolder"
}

Write-Host "All extracted dist folders updated to v3.9.1!"
