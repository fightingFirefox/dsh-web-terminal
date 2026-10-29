#!/usr/bin/env node
// Wrap the esbuild output in the DSH ModuleLoader envelope.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const bundlePath = join(root, 'lib', 'bundle.cjs')
const outPath = join(root, 'lib', 'client.js')

const pluginJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const PLUGIN_ID = 'dsh-web-terminal'

const bundle = (await readFile(bundlePath, 'utf8')).trimEnd()

for (const external of ['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives']) {
  if (!bundle.includes(`require("${external}")`)) {
    throw new Error(`bundle is missing the external require("${external}") reference`)
  }
}
if (bundle.includes('window.__ModuleLoader__')) {
  throw new Error('bundle contains the ModuleLoader wrapper already')
}

const indent = (text, spaces) => {
  const prefix = ' '.repeat(spaces)
  return text.split('\n').map((line) => (line === '' ? line : prefix + line)).join('\n')
}

const wrapper = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(PLUGIN_ID)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

${indent(bundle, 4)}

    return module.exports;
  },
});
`

await mkdir(dirname(outPath), { recursive: true })
await writeFile(outPath, wrapper, 'utf8')

const gz = gzipSync(Buffer.from(wrapper, 'utf8')).length
console.log(
  `[wrap-bundle] ${pluginJson.version} -> lib/client.js  ` +
  `${(wrapper.length / 1024).toFixed(1)} KiB raw, ${(gz / 1024).toFixed(1)} KiB gzip`,
)
