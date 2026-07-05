<#
  One-shot launcher: starts the backend, boots the Android emulator (if not
  already running), forwards the ports it needs, starts Metro, builds +
  installs the app, and opens it.

  Usage (from the repo root, in PowerShell):
    .\run-app.ps1
#>
$ErrorActionPreference = "Stop"
$root       = $PSScriptRoot
$backendDir = Join-Path $root "apps\backend"
$mobileDir  = Join-Path $root "apps\mobile"

function Wait-Http200($url, $timeoutSec = 90) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
      if ($r.StatusCode -eq 200) { return $true }
    } catch {}
    Start-Sleep -Seconds 2
  }
  return $false
}

# --- Sanity check: backend needs its own .env with a DB connection ---
if (-not (Test-Path (Join-Path $backendDir ".env"))) {
  Write-Host "Missing apps\backend\.env - copy apps\backend\.env.example to apps\backend\.env" -ForegroundColor Red
  Write-Host "and fill in at least DATABASE_URL, JWT_SECRET, PORT before running this." -ForegroundColor Red
  exit 1
}

# --- 0. Dependencies (npm workspaces: always install from the repo root, so a
#        package.json change anywhere is picked up - a merely-present
#        node_modules folder can still be missing packages added since the
#        last install) ---
Write-Host "==> Dependencies" -ForegroundColor Cyan
Set-Location $root
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "    npm install failed - see the output above." -ForegroundColor Red; exit 1 }

# --- 1. Backend ---
Write-Host "==> Backend" -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*\HRMS\*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Set-Location $backendDir
npm run build
$env:NODE_ENV = "development"
Start-Process -FilePath "node" -ArgumentList "dist/main.js" -WindowStyle Hidden `
  -RedirectStandardOutput "$backendDir\backend.log" -RedirectStandardError "$backendDir\backend.err.log"

if (Wait-Http200 "http://localhost:3000/api/v1/health" 60) {
  Write-Host "    up: http://localhost:3000/api/v1/health" -ForegroundColor Green
} else {
  Write-Host "    backend did not respond in time - check apps\backend\backend.err.log" -ForegroundColor Yellow
}

# --- 2. Emulator ---
Write-Host "==> Emulator" -ForegroundColor Cyan
$already = (& adb devices) -match "device$"
if (-not $already) {
  # `emulator -list-avds` interleaves INFO/WARNING banner lines with the
  # actual AVD names on stdout, so filter those out before picking one.
  $avd = (& emulator -list-avds 2>$null) |
    Where-Object { $_ -and ($_ -notmatch '^(INFO|WARNING|ERROR)\s*\|') } |
    Select-Object -First 1
  if (-not $avd) {
    Write-Host "    No AVD found. Create one via Android Studio > Device Manager, then re-run." -ForegroundColor Red
    exit 1
  }
  Write-Host "    booting '$avd'..."
  Start-Process -FilePath "emulator" -ArgumentList "-avd `"$avd`" -gpu swiftshader_indirect -no-boot-anim" -WindowStyle Minimized
  & adb wait-for-device
  do { Start-Sleep -Seconds 3; $booted = (& adb shell getprop sys.boot_completed 2>$null) } while ($booted -notmatch "1")
}
Write-Host "    device ready" -ForegroundColor Green

# --- 3. Port forwarding (Metro + backend, both reachable from the emulator) ---
& adb reverse tcp:8081 tcp:8081 | Out-Null
& adb reverse tcp:3000 tcp:3000 | Out-Null

# --- 4. Metro ---
Write-Host "==> Metro" -ForegroundColor Cyan
Get-CimInstance Win32_Process -Filter "name='node.exe'" |
  Where-Object { $_.CommandLine -match 'react-native start|cli.js start' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Set-Location $mobileDir
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx react-native start > metro.log 2>&1" -WindowStyle Minimized

$metroOk = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    if ((Invoke-WebRequest -Uri "http://localhost:8081/status" -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200) { $metroOk = $true; break }
  } catch {}
  Start-Sleep -Seconds 2
}
if ($metroOk) {
  Write-Host "    up: http://localhost:8081" -ForegroundColor Green
} else {
  Write-Host "    Metro is slow to start - continuing anyway" -ForegroundColor Yellow
}

# --- 5. Build + install (first run takes a few minutes; later runs are fast) ---
Write-Host "==> Build + install (first run takes a few minutes)" -ForegroundColor Cyan
Set-Location (Join-Path $mobileDir "android")
& .\gradlew.bat app:installDebug
if ($LASTEXITCODE -ne 0) { Write-Host "    Gradle build failed - see the output above." -ForegroundColor Red; exit 1 }

# --- 6. Launch ---
Write-Host "==> Launching" -ForegroundColor Cyan
& adb shell monkey -p com.mobile -c android.intent.category.LAUNCHER 1 | Out-Null

Write-Host ""
Write-Host "Ready. Logins (password Admin@123): admin@hrms.com / hr@hrms.com / manager@hrms.com / employee@hrms.com" -ForegroundColor Green
Set-Location $root
