$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$entry=Join-Path $root 'server.mjs'
$global:launcherFixture=@{reuse=$true;started=$false}
function Get-NetTCPConnection { param($State,$ErrorAction) [pscustomobject]@{LocalAddress='127.0.0.1';LocalPort=54321;OwningProcess=10} }
function Get-CimInstance { param($ClassName,$Filter,$ErrorAction) $cmd=if($global:launcherFixture.reuse){'node "'+$entry.Replace('\','/')+'"'}else{'node C:\other\server.mjs'}; [pscustomobject]@{ProcessId=10;CommandLine=$cmd} }
function Invoke-WebRequest { param([switch]$UseBasicParsing,$Uri,$TimeoutSec) [pscustomobject]@{StatusCode=200} }
function Start-Process {
 param($FilePath,$ArgumentList,$WorkingDirectory,$WindowStyle,$RedirectStandardOutput,$RedirectStandardError,[switch]$PassThru)
 if(-not $PassThru){throw 'NoBrowser opened a browser'}
 if($WindowStyle -ne 'Hidden'){throw 'Helper must be hidden'}
 if($ArgumentList[-1] -ne '5200'){throw 'Preferred port lost'}
 $global:launcherFixture.started=$true
 Set-Content -LiteralPath $RedirectStandardOutput -Value 'http://127.0.0.1:54322/'
 [pscustomobject]@{Id=99;HasExited=$false;StartTime=Get-Date}
}
& (Join-Path $root 'start.ps1') -NoBrowser
if($global:launcherFixture.started){throw 'Fallback server was not reused'}
$global:launcherFixture.reuse=$false
& (Join-Path $root 'start.ps1') -NoBrowser
if(-not $global:launcherFixture.started){throw 'Server did not start'}
Write-Output 'PASS: shared launcher reuses any owned port and reads the actual assigned URL'
