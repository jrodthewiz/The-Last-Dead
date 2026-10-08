# Loaded by the installed Wolf Games launcher. Its existing ownership list
# cleans up only a server started for this window, never a reused server.
function Start-LastDeadWindowServer([int]$PreferredPort = 0) {
    $entry = Join-Path $root 'server.mjs'
    $pattern = '(?i)(?:^|[\s"])' + [regex]::Escape($entry) + '(?:[\s"]|$)'
    $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop)
    $matchingIds = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction Stop | Where-Object {
        $_.CommandLine -and $_.CommandLine.Replace('/', '\') -match $pattern
    } | ForEach-Object { $_.ProcessId })
    foreach ($listener in $listeners) {
        if ($listener.LocalAddress -notin @('127.0.0.1','0.0.0.0','::')) { continue }
        if ($listener.OwningProcess -notin $matchingIds) { continue }
        try {
            $candidateUrl = "http://127.0.0.1:$($listener.LocalPort)/"
            if ((Invoke-WebRequest -UseBasicParsing -Uri $candidateUrl -TimeoutSec 2).StatusCode -eq 200) { return $candidateUrl }
        } catch { continue }
    }
    # Let the OS allocate an available port atomically, avoiding port races.
    $label = 'game-' + [Guid]::NewGuid().ToString('N')
    Start-OwnedServer $entry @('--dist',('"{0}"' -f $root),'--port',"$PreferredPort") $label
    $record = $owned[$owned.Count - 1]
    $stdout = Join-Path $logDir "$label.stdout.log"
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ($record.Process.HasExited) { throw "The Last Dead server exited. See $logDir" }
        if (Test-Path -LiteralPath $stdout) {
            $text = Get-Content -LiteralPath $stdout -Raw
            if ($text -match 'http://(?:127\.0\.0\.1|0\.0\.0\.0):([0-9]+)/') { return "http://127.0.0.1:$($Matches[1])/" }
        }
        Start-Sleep -Milliseconds 250
    }
    throw "The Last Dead did not report its assigned port. See $logDir"
}
