$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$logDir=Join-Path $root '.logs/launcher-repair'
$owned=[System.Collections.Generic.List[object]]::new()
. (Join-Path $root 'scripts/start-menu-last-dead.ps1')
$global:lastDeadMenuTest=@{reuse=$true;started=$false}
function Get-NetTCPConnection { param($State,$ErrorAction) [pscustomobject]@{LocalAddress='127.0.0.1';LocalPort=5200;OwningProcess=10} }
function Get-CimInstance { param($ClassName,$Filter,$ErrorAction) $entry=if($global:lastDeadMenuTest.reuse){Join-Path $root 'server.mjs'}else{'C:\other-game\server.mjs'}; [pscustomobject]@{ProcessId=10;CommandLine=('node "{0}"' -f $entry.Replace('\','/'))} }
function Invoke-WebRequest { param([switch]$UseBasicParsing,$Uri,$TimeoutSec) [pscustomobject]@{StatusCode=200} }
function Start-OwnedServer($entry,$arguments,$label) {
 if($arguments[-1] -ne '0'){throw 'Must allocate a port atomically'}
 $global:lastDeadMenuTest.started=$true
 $owned.Add([pscustomobject]@{Process=[pscustomobject]@{HasExited=$false}})
 Set-Content -LiteralPath (Join-Path $logDir "$label.stdout.log") -Value 'http://127.0.0.1:54321/'
}
$url=Start-LastDeadWindowServer
if($url -ne 'http://127.0.0.1:5200/' -or $global:lastDeadMenuTest.started){throw 'Reuse failed'}
Write-Output 'PASS: existing game reused without ownership transfer'
$global:lastDeadMenuTest.reuse=$false
$url=Start-LastDeadWindowServer
if($url -ne 'http://127.0.0.1:54321/' -or -not $global:lastDeadMenuTest.started){throw 'Free port launch failed'}
Write-Output 'PASS: unrelated occupied port preserved; assigned port used'
