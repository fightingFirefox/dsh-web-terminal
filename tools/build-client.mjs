// Build lib/client.js with esbuild's JS API.

#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

import { build } from 'esbuild'

const requireFromRoot = createRequire(import.meta.url)

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..')
const packageDir = repoRoot
const entryPoint = join(packageDir, 'client-src', 'index.tsx')
const outputFile = join(packageDir, 'lib', 'client.js')

const args = new Set(process.argv.slice(2))
const minify = !args.has('--no-minify')

const PLUGIN_ID = 'dsh-web-terminal'

const EXTERNALS = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react-dom/client',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-dockkit',
  'zod',
  '@tanstack/react-virtual',
]

function indent(text, spaces) {
  const prefix = ' '.repeat(spaces)
  return text
    .split('\n')
    .map((line) => (line === '' ? line : prefix + line))
    .join('\n')
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
}

async function main() {
  const startedAt = Date.now()


  const packageJson = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8'))
  const version = packageJson.version
  if (typeof version !== 'string' || version === '') {
    throw new Error('package.json version is missing')
  }
  const result = await build({
    entryPoints: [entryPoint],
    absWorkingDir: repoRoot,
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'browser',
    target: ['chrome110', 'edge110'],
    jsx: 'automatic',
    minify,
    sourcemap: false,
    legalComments: 'none',
    charset: 'ascii',
    logLevel: 'warning',
    loader: { '.css': 'text' },
    define: {
      'process.env.NODE_ENV': JSON.stringify(minify ? 'production' : 'development'),
      __PLUGIN_VERSION__: JSON.stringify(version),
    },
    external: EXTERNALS,
  })

  if (result.outputFiles.length !== 1) {
    throw new Error(`expected exactly one output file, got ${result.outputFiles.length}`)
  }
  const bundle = result.outputFiles[0].text


  const requiredExternals = [
    'react',
    'react/jsx-runtime',
    '@deepseek-ai/dsh-client-ui-primitives',
  ]
  for (const external of requiredExternals) {
    if (!bundle.includes(`require("${external}")`)) {
      throw new Error(`bundle is missing the external require("${external}") reference`)
    }
  }
  if (bundle.includes('window.__ModuleLoader__')) {
    throw new Error('bundle unexpectedly contains the ModuleLoader wrapper already')
  }

  const wrapper = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(PLUGIN_ID)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

${indent(bundle.trimEnd(), 4)}

    return module.exports;
  },
});
`

  await mkdir(dirname(outputFile), { recursive: true })
  await writeFile(outputFile, wrapper, 'utf8')


  const written = await readFile(outputFile, 'utf8')
  try {

    new Function(written)
  } catch (error) {
    throw new Error(`generated bundle is not valid JavaScript: ${error instanceof Error ? error.message : error}`)
  }

  const bytes = Buffer.byteLength(written)
  const gzipped = gzipSync(Buffer.from(written)).length
  const relativeOutput = relative(repoRoot, outputFile)
  console.log(
    `[build-client] wrote ${relativeOutput} (${formatBytes(bytes)}, gzip ${formatBytes(gzipped)}) in ${Date.now() - startedAt}ms${minify ? '' : ' [no-minify]'}`,
  )
  console.log(`[build-client] externals: ${EXTERNALS.join(', ')}`)
  console.log(`[build-client] version: ${version}`)
  console.log(`[build-client] esbuild: ${requireFromRoot('esbuild/package.json').version}`)
}

main().catch((error) => {
  console.error('[build-client] build failed')
  console.error(error)
  process.exitCode = 1
})
