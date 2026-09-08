$ErrorActionPreference = 'Stop'
$projectDir = $PSScriptRoot
$serverEntry = Join-Path $projectDir 'server.mjs'
$port = 5200
$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
  $owned = $false
  foreach ($listener in $existing) {
    $owner = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
    if ($owner.CommandLine -and $owner.CommandLine.Contains($serverEntry)) { $owned = $true }
  }
  if (-not $owned) { throw 'Port 5200 belongs to another app. Close that app or choose another port with node server.mjs --port PORT --dist .' }
} else {
  $nodeExe = (Get-Command node.exe -ErrorAction Stop).Source
  $logDir = Join-Path $projectDir '.logs'
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  Start-Process -FilePath $nodeExe -ArgumentList @(('"{0}"' -f $serverEntry), '--dist', ('"{0}"' -f $projectDir), '--port', '5200') -WorkingDirectory $projectDir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'server.stdout.log') -RedirectStandardError (Join-Path $logDir 'server.stderr.log') | Out-Null
}
$ready = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
  try { $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5200/' -TimeoutSec 2; if ($response.StatusCode -eq 200) { $ready = $true; break } } catch {}
  Start-Sleep -Milliseconds 250
}
if (-not $ready) { throw 'The Last Dead did not start. Check .logs/server.stderr.log.' }
Start-Process 'http://127.0.0.1:5200/'
