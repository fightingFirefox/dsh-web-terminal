<#
  Build the browser half without node's child_process (some sandboxes refuse
  spawn with piped stdio). Runs the esbuild CLI directly, then wraps the output
  in the DSH ModuleLoader envelope.

  Usage: pwsh -NoProfile -File tools/build-cli.ps1 [-NoMinify]
#>
param([switch]$NoMinify)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root 'node_modules\@esbuild\win32-x64\esbuild.exe'
if (-not (Test-Path $exe)) { throw "esbuild binary missing, run npm install first: $exe" }
$out = Join-Path $root 'lib\bundle.cjs'
$flags = @(
  'client-src/index.tsx', '--bundle', '--format=cjs', '--platform=browser',
  '--target=chrome110,edge110', '--jsx=automatic',
  '--legal-comments=none', '--charset=ascii', '--loader:.css=text',
  '--define:process.env.NODE_ENV="production"',
  '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:react-dom/client',
  '--external:@deepseek-ai/dsh-client-ui-primitives', '--external:@deepseek-ai/dsh-client-store',
  '--external:@deepseek-ai/dsh-client-ui-slots', '--external:@deepseek-ai/dsh-client-ui-dockkit',
  '--external:zod', '--external:@tanstack/react-virtual',
  "--outfile=$out"
)
$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$flags += ('--define:__PLUGIN_VERSION__="' + $version + '"')
if (-not $NoMinify) { $flags += '--minify' }
Push-Location $root
try {
  & $exe @flags
  if ($LASTEXITCODE -ne 0) { throw "esbuild failed with exit $LASTEXITCODE" }
  node tools/wrap-bundle.mjs
  if ($LASTEXITCODE -ne 0) { throw "wrap-bundle failed with exit $LASTEXITCODE" }
} finally { Pop-Location }
