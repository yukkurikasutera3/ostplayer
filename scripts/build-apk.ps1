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
$apk = Get-ChildItem -Path "android\app\build\outputs\apk\debug" -Filter "*.apk" | Select-Object -First 1
if ($apk) {
    if (-not (Test-Path "dist")) { New-Item -ItemType Directory -Force -Path "dist" | Out-Null }
    $distApk = "dist\OST-Player-v3.4.0-debug.apk"
    Copy-Item -Path $apk.FullName -Destination $distApk -Force
    Write-Host "SUCCESS! Generated APK:" $distApk "Size:" $apk.Length "bytes"
} else {
    Write-Host "No APK found in output directory."
}
