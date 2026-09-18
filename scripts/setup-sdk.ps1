# Android SDK Setup and APK Build Script
$ErrorActionPreference = "Stop"
$sdkDir = "$env:LOCALAPPDATA\Android\Sdk"
$cmdlineLatest = "$sdkDir\cmdline-tools\latest"
$zipPath = "$env:TEMP\cmdtools.zip"

Write-Host "=== Step 1: Setting up Android SDK Directory ==="
if (-not (Test-Path "$sdkDir\cmdline-tools")) {
    New-Item -ItemType Directory -Force -Path "$sdkDir\cmdline-tools" | Out-Null
}

if (-not (Test-Path "$cmdlineLatest\bin\sdkmanager.bat")) {
    Write-Host "Downloading Google Android Command-line Tools via curl..."
    $url = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
    & curl.exe -L -o "$zipPath" "$url"
    
    Write-Host "Extracting Command-line Tools..."
    Expand-Archive -Path "$zipPath" -DestinationPath "$sdkDir\cmdline-tools" -Force
    
    if (Test-Path "$sdkDir\cmdline-tools\cmdline-tools") {
        if (Test-Path $cmdlineLatest) { Remove-Item -Recurse -Force $cmdlineLatest }
        Rename-Item -Path "$sdkDir\cmdline-tools\cmdline-tools" -NewName "latest" -Force
    }
    Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue
    Write-Host "Command-line Tools successfully installed to $cmdlineLatest"
} else {
    Write-Host "Command-line Tools already installed at $cmdlineLatest"
}

Write-Host "=== Step 2: Configuring android/local.properties ==="
$localProps = "android\local.properties"
$escapedSdk = $sdkDir.Replace("\", "\\")
"sdk.dir=$escapedSdk" | Out-File -FilePath $localProps -Encoding utf8 -Force
Write-Host "Configured $localProps with sdk.dir=$escapedSdk"

Write-Host "=== Step 3: Installing Android SDK Packages (Platform 34, Build-Tools) ==="
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
$sdkmanager = "$cmdlineLatest\bin\sdkmanager.bat"

Write-Host "Accepting licenses..."
"y`ny`ny`ny`ny`ny`ny" | & $sdkmanager --licenses --sdk_root="$sdkDir"

Write-Host "Installing platform-tools, platforms;android-34, build-tools;34.0.0..."
& $sdkmanager --sdk_root="$sdkDir" "platform-tools" "platforms;android-34" "build-tools;34.0.0"

Write-Host "=== Step 4: Building Android Debug APK ==="
Set-Location "android"
& .\gradlew.bat assembleDebug

Write-Host "=== APK BUILD COMPLETE! ==="
Get-ChildItem -Path "app\build\outputs\apk\debug" -Filter "*.apk" | ForEach-Object {
    Write-Host "Generated APK: $($_.FullName) (Size: $($_.Length) bytes)"
}
