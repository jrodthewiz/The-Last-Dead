param([Parameter(Mandatory)][ValidateSet('Duals','Duals Playtest','The Last Dead','PickleDash')][string]$Game, [switch]$Probe)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
. (Join-Path $PSScriptRoot 'BrowserLifetime.ps1')
$configPath = Join-Path $env:LOCALAPPDATA 'WolfGames\Launchers\games.json'
if (-not (Test-Path -LiteralPath $configPath)) { $configPath = Join-Path $PSScriptRoot 'games.json' }
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$isPlaytest = $Game -eq 'Duals Playtest'
$root = if ($isPlaytest) { $config.Duals } else { $config.$Game }
$owner = 'taskbar-' + [Guid]::NewGuid().ToString('N')
$owned = [System.Collections.Generic.List[object]]::new()
$managed = $false
$instanceId = $null
$launchFailure = $null
$logDir = Join-Path $env:LOCALAPPDATA ('WolfGames\logs\' + $Game)
New-Item -ItemType Directory -Force $logDir | Out-Null

function Start-OwnedServer($entry, $arguments, $label) {
    $process = Start-Process -FilePath (Get-Command node.exe -ErrorAction Stop).Source -ArgumentList (@(('"{0}"' -f $entry)) + $arguments) -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir "$label.stdout.log") -RedirectStandardError (Join-Path $logDir "$label.stderr.log")
    $owned.Add([pscustomobject]@{ Process = $process; Started = $process.StartTime })
}
try {
    $chrome = @("${env:ProgramFiles}\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $chrome) { throw 'Google Chrome is required for these game windows.' }
    if (-not (Test-Path -LiteralPath $root)) { throw "Game folder missing: $root" }
    if ($Game -eq 'Duals' -or $isPlaytest) {
        $manager = Join-Path $root 'scripts\agent-dev-instances.py'
        # A test game session owns its full stack. Stable mode prevents source
        # watchers/HMR from restarting the server and invalidating fresh lobbies.
        if ($isPlaytest) {
            # Private map tests can share a compatible watch stack. Source edits
            # update the frontend and restart the authority server normally.
            $result = & python -X utf8 $manager acquire --root $root --owner $owner --mode watch --cpu 4
        } else {
            $result = & python -X utf8 $manager acquire --root $root --owner $owner --mode stable --exclusive --cpu 4
        }
        if ($LASTEXITCODE -ne 0) { throw "Duals could not start: $result" }
        $managed = $true
        $instance = ($result -join "`n") | ConvertFrom-Json
        $instanceId = $instance.id
        $url = $instance.viteUrl + '?dualsLaunchSession=' + [Uri]::EscapeDataString($owner)
        if ($isPlaytest) { $url += '&tool=playtest' }
    } elseif ($Game -eq 'PickleDash') {
        $label = 'desktop-' + [Guid]::NewGuid().ToString('N')
        Start-OwnedServer (Join-Path $root 'server\desktop-dev.mjs') @() $label
        $url = $null
        for ($attempt = 0; $attempt -lt 120; $attempt++) {
            if ($owned[$owned.Count - 1].Process.HasExited) { throw "PickleDash server exited. See $logDir" }
            $stdout = Join-Path $logDir "$label.stdout.log"
            if (Test-Path -LiteralPath $stdout) {
                $text = Get-Content -LiteralPath $stdout -Raw
                if ($text -match 'PICKLEDASH_DESKTOP_URL=(http://127\.0\.0\.1:[0-9]+/)') { $url = $Matches[1]; break }
            }
            Start-Sleep -Milliseconds 250
        }
        if (-not $url) { throw "PickleDash did not report its assigned port. See $logDir" }
    } else {
        . (Join-Path $root 'scripts\start-menu-last-dead.ps1')
        $url = Start-LastDeadWindowServer
    }
    # The managed acquire already verified both endpoints and their identity.
    $ready = $managed
    for ($attempt = 0; -not $ready -and $attempt -lt 60; $attempt++) {
        foreach ($record in $owned) { if ($record.Process.HasExited) { throw "Game server exited. See $logDir" } }
        try { if ((Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2).StatusCode -eq 200) { $ready = $true; break } } catch {}
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw "Game startup timed out. See $logDir" }
    if ($Probe) {
        [pscustomobject]@{ Game=$Game; Url=$url; Ready=$true; StartedProcesses=$owned.Count } | ConvertTo-Json -Compress
        return
    }
    # Share the Duals profile to keep the selected fighter and gameplay settings.
    $profileGame = if ($isPlaytest) { 'Duals' } else { $Game }
    $profile = Join-Path $env:LOCALAPPDATA ('WolfGames\profiles\' + $profileGame)
    # The game is the interactive window; server helpers above remain hidden.
    Start-Process -FilePath $chrome -ArgumentList @(('--user-data-dir="{0}"' -f $profile),('--app="{0}"' -f $url),'--no-first-run','--no-default-browser-check','--disable-background-mode') | Out-Null
    Wait-GameBrowserWindow -Profile $profile
    $renewal = [pscustomobject]@{ At = (Get-Date).AddMinutes(5) }
    Wait-GameBrowserWindowClosed -Profile $profile -OnTick {
        if ($managed -and (Get-Date) -ge $renewal.At) {
            & python -X utf8 $manager renew --root $root --owner $owner --id $instanceId | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'Duals server lease could not be renewed.' }
            $renewal.At = (Get-Date).AddMinutes(5)
        }
    }
} catch {
    $launchFailure = $_.Exception.Message
} finally {
    foreach ($record in $owned) {
        $live = Get-Process -Id $record.Process.Id -ErrorAction SilentlyContinue
        if ($live -and $live.StartTime -eq $record.Started) { Stop-Process -Id $live.Id -ErrorAction SilentlyContinue }
    }
    if ($managed) {
        try {
            & python -X utf8 $manager release --root $root --owner $owner --id $instanceId | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'Duals server lease could not be released.' }
            if (-not $isPlaytest) {
                # Stops both frontend and backend; never stops another owner's lease.
                & python -X utf8 $manager stop --root $root --id $instanceId 2>> (Join-Path $logDir 'shared-server.log') | Out-Null
                if ($LASTEXITCODE -ne 0) { throw 'Duals stack shutdown was not confirmed. See shared-server.log.' }
            }
        } catch {
            $launchFailure = (@($launchFailure, $_.Exception.Message) | Where-Object { $_ }) -join "`n"
        }
    }
}
if ($launchFailure) {
    if ($Probe) { throw $launchFailure }
    [System.Windows.Forms.MessageBox]::Show($launchFailure, "$Game launcher") | Out-Null
}

