# Android Command Line Tools Automated Setup
$sdkDir = "$env:LOCALAPPDATA\Android\Sdk"
$cmdlineDir = "$sdkDir\cmdline-tools\latest"

if (-not (Test-Path $cmdlineDir)) {
    Write-Host "Creating SDK directory: $sdkDir"
    New-Item -ItemType Directory -Force -Path "$sdkDir\cmdline-tools" | Out-Null
    
    $zipPath = "$env:TEMP\commandlinetools.zip"
    $url = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
    
    Write-Host "Downloading Android Command-line Tools from Google..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $zipPath
    
    Write-Host "Extracting Command-line Tools..."
    Expand-Archive -Path $zipPath -DestinationPath "$sdkDir\cmdline-tools" -Force
    
    if (Test-Path "$sdkDir\cmdline-tools\cmdline-tools") {
        Rename-Item -Path "$sdkDir\cmdline-tools\cmdline-tools" -NewName "latest" -Force
    }
    Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue
    Write-Host "Android Command-line Tools installed to $cmdlineDir"
}

# Write android/local.properties
$localPropertiesPath = "android\local.properties"
$escapedSdkPath = $sdkDir.Replace("\", "\\")
"sdk.dir=$escapedSdkPath" | Out-File -FilePath $localPropertiesPath -Encoding utf8 -Force
Write-Host "Updated android\local.properties with sdk.dir=$escapedSdkPath"

# Accept licenses and install platform-tools and platform 34
$sdkmanager = "$sdkDir\cmdline-tools\latest\bin\sdkmanager.bat"
if (Test-Path $sdkmanager) {
    $env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
    Write-Host "Accepting Android SDK licenses..."
    "y`ny`ny`ny`ny`ny`ny" | & $sdkmanager --licenses --sdk_root="$sdkDir"
    Write-Host "Installing platform-tools, platforms;android-34, build-tools;34.0.0..."
    & $sdkmanager --sdk_root="$sdkDir" "platform-tools" "platforms;android-34" "build-tools;34.0.0"
}
Write-Host "Android SDK Setup Complete!"
