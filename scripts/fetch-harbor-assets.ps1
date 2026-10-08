$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$archive = Join-Path $repo '.art-source/harbor'
New-Item -ItemType Directory -Force $archive | Out-Null
$packs = @{
  'car-kit' = 'https://kenney.nl/media/pages/assets/car-kit/1a312ec241-1775131960/kenney_car-kit.zip'
  'industrial' = 'https://kenney.nl/media/pages/assets/city-kit-industrial/0ec35b139d-1788171848/kenney_city-kit-industrial_2.0.zip'
}
foreach ($pack in $packs.Keys) {
  $zip = Join-Path $archive "$pack.zip"
  Invoke-WebRequest $packs[$pack] -OutFile $zip
  Expand-Archive -LiteralPath $zip -DestinationPath (Join-Path $archive $pack) -Force
}
node (Join-Path $PSScriptRoot 'prepare-harbor-assets.mjs')
