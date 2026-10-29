# dsh-web-terminal - installer for the DSH web profile (PowerShell 7).
#
#   pwsh -NoProfile -File install.ps1 [-Force]
#
# Copies this repository into <DSH_HOME>/profiles/web/node_modules, installs the
# two runtime dependencies, registers the bundle and writes the config row that
# makes agent commands stream into the visible panel.
$ErrorActionPreference = 'Stop'
$force = $false
foreach ($a in $args) { if ($a -eq '-Force') { $force = $true } }

$src = $PSScriptRoot
$homeDir = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$profileRoot = Join-Path $homeDir 'profiles\web'
if (-not (Test-Path $profileRoot)) { throw "DSH web profile not found: $profileRoot (run 'dsh web' once first)" }
$dest = Join-Path $profileRoot 'node_modules\dsh-web-terminal'

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Copy-Item (Join-Path $profileRoot 'package.json') (Join-Path $profileRoot "package.json.bak-dsh-web-terminal-$stamp")
if (Test-Path (Join-Path $profileRoot 'cordis.patch.yml')) {
  Copy-Item (Join-Path $profileRoot 'cordis.patch.yml') (Join-Path $profileRoot "cordis.patch.yml.bak-dsh-web-terminal-$stamp")
}

if ((Test-Path $dest) -and -not $force) { throw "already installed at $dest (pass -Force to overwrite)" }
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Force -Path $dest | Out-Null

Copy-Item (Join-Path $src 'lib') $dest -Recurse
foreach ($f in 'package.json','cordis.patch.yml','README.md','LICENSE','NOTICE','icon.svg') {
  $p = Join-Path $src $f
  if (Test-Path $p) { Copy-Item $p $dest }
}

$depRoot = Join-Path $dest 'node_modules\@xterm'
New-Item -ItemType Directory -Force -Path $depRoot | Out-Null
$missing = @()
foreach ($dep in 'headless','addon-serialize') {
  $from = Join-Path $src "node_modules\@xterm\$dep"
  if (Test-Path $from) { Copy-Item $from (Join-Path $depRoot $dep) -Recurse }
  else { $missing += $dep }
}
if ($missing.Count -gt 0) {
  Write-Host "installing runtime dependencies with npm: $($missing -join ', ')"
  Push-Location $dest
  try {
    npm install --omit=dev --no-audit --no-fund --loglevel=error
    if ($LASTEXITCODE -ne 0) { throw "npm install failed (exit $LASTEXITCODE)" }
  } finally { Pop-Location }
}

$pkgPath = Join-Path $profileRoot 'package.json'
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json -AsHashtable
$pkg.dependencies['dsh-web-terminal'] = 'file:' + $src.Replace('\','/')
$bundles = @($pkg.dsh.profile.bundles | Where-Object { $_ -ne 'dsh-web-terminal' })
$bundles += 'dsh-web-terminal'
$pkg.dsh.profile.bundles = $bundles
($pkg | ConvertTo-Json -Depth 30) | Set-Content $pkgPath -Encoding utf8

$patchPath = Join-Path $profileRoot 'cordis.patch.yml'
$patch = if (Test-Path $patchPath) { Get-Content $patchPath -Raw } else { '' }
if ($patch -notmatch 'id:\s*dsh-web-terminal') {
  $block = @'

# dsh-web-terminal - Claude-styled visible terminal panel (web profile).
# interceptShellTools: agent commands run inside the panel and the right
# sidebar opens automatically when one starts.
- id: dsh-web-terminal
  name: dsh-web-terminal
  config:
    interceptShellTools: true
    interceptMinVisibleMs: 1200
    autoCloseCommandDelayMs: 8000
    autoCloseFailedDelayMs: 30000
    autoCloseToolTerminals: true
    historySize: 20
    historyPersist: true
'@
  $patch = $patch.TrimEnd() + $block
  Set-Content $patchPath $patch -Encoding utf8
}

Write-Host ""
Write-Host "installed -> $dest"
Write-Host "profile   -> $profileRoot (bundles += dsh-web-terminal)"
Write-Host "backup    -> package.json.bak-dsh-web-terminal-$stamp"
Write-Host "Now fully quit DSH and run 'dsh web' again."
