param([ValidateRange(1,65535)][int]$Port = 5200, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$logDir = Join-Path $root '.logs'
$owned = [System.Collections.Generic.List[object]]::new()
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
function Start-OwnedServer($entry, $arguments, $label) {
    $process = Start-Process -FilePath (Get-Command node.exe -ErrorAction Stop).Source -ArgumentList (@(('"{0}"' -f $entry)) + $arguments) -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir "$label.stdout.log") -RedirectStandardError (Join-Path $logDir "$label.stderr.log")
    $owned.Add([pscustomobject]@{ Process = $process; Started = $process.StartTime })
}
. (Join-Path $root 'scripts/start-menu-last-dead.ps1')
$selectedUrl = Start-LastDeadWindowServer -PreferredPort $Port
Write-Host "The Last Dead: $selectedUrl"
if (-not $NoBrowser) { Start-Process $selectedUrl }
