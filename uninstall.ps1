# Remove dsh-web-terminal from the DSH web profile, then restart DSH.
$ErrorActionPreference = 'Stop'
$homeDir = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$profileRoot = Join-Path $homeDir 'profiles\web'
$dest = Join-Path $profileRoot 'node_modules\dsh-web-terminal'
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }

$pkgPath = Join-Path $profileRoot 'package.json'
if (Test-Path $pkgPath) {
  $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json -AsHashtable
  if ($pkg.dependencies.ContainsKey('dsh-web-terminal')) { $pkg.dependencies.Remove('dsh-web-terminal') }
  $pkg.dsh.profile.bundles = @($pkg.dsh.profile.bundles | Where-Object { $_ -ne 'dsh-web-terminal' })
  ($pkg | ConvertTo-Json -Depth 30) | Set-Content $pkgPath -Encoding utf8
}
Write-Host "removed dsh-web-terminal; restart DSH."
