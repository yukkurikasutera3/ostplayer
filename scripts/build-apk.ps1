# Build Android Debug APK
$ErrorActionPreference = "Stop"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"

$rootDir = (Get-Location).Path

Write-Host "Syncing web assets..."
node scripts/prepare-mobile.js
npx cap sync android

Write-Host "Building APK with Gradle..."
Set-Location -LiteralPath "$rootDir\android"
& .\gradlew.bat assembleDebug
Set-Location -LiteralPath $rootDir

Write-Host "Checking output APK..."
$pkgJson = Get-Content (Join-Path $rootDir "package.json") -Raw | ConvertFrom-Json
$ver = $pkgJson.version
$apkDir = Join-Path $rootDir "android\app\build\outputs\apk\debug"
$apk = Get-ChildItem -LiteralPath $apkDir -Filter "*.apk" | Select-Object -First 1
if ($apk) {
    $distDir = Join-Path $rootDir "dist"
    if (-not (Test-Path -LiteralPath $distDir)) { New-Item -ItemType Directory -Force -Path $distDir | Out-Null }
    $distApk = Join-Path $distDir ("OST-Player-v" + $ver + "-debug.apk")
    Copy-Item -LiteralPath $apk.FullName -Destination $distApk -Force
    Write-Host "[BUILD SUCCESS] Generated APK: $distApk (Size: $($apk.Length) bytes)"
} else {
    Write-Host "[BUILD ERROR] No APK found in output directory."
}
