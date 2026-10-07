# Build Android Debug APK
$ErrorActionPreference = "Stop"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"

Write-Host "Syncing web assets..."
node scripts/prepare-mobile.js
npx cap sync android

Write-Host "Building APK with Gradle..."
Set-Location "android"
& .\gradlew.bat assembleDebug
Set-Location ".."

Write-Host "Checking output APK..."
$pkgJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$ver = $pkgJson.version
$apk = Get-ChildItem -Path "android\app\build\outputs\apk\debug" -Filter "*.apk" | Select-Object -First 1
if ($apk) {
    if (-not (Test-Path "dist")) { New-Item -ItemType Directory -Force -Path "dist" | Out-Null }
    $distApk = "dist\OST-Player-v" + $ver + "-debug.apk"
    Copy-Item -Path $apk.FullName -Destination $distApk -Force
    Write-Host "[BUILD SUCCESS] Generated APK: $distApk (Size: $($apk.Length) bytes)"
} else {
    Write-Host "[BUILD ERROR] No APK found in output directory."
}
