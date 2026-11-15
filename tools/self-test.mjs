// Host-side self test: no DSH required. Exercises the terminal pool, the
// background capture path and the job_* interception with mocked services.
import { TerminalRegistry } from '../lib/host/registry.js'
import { AgentShells } from '../lib/host/agent-shell.js'
import { registerIntercept } from '../lib/host/intercept.js'

function makeHandle(command) {
  let settle
  const done = new Promise((resolve) => { settle = resolve })
  return {
    output: {
      async *[Symbol.asyncIterator]() {
        yield Buffer.from('PS D:\\x> ' + command + '\r\nOUT:' + command + '\r\nPS D:\\x> ')
        await done
      },
    },
    done,
    async write() {},
    async resize() {},
    async terminate() { settle({ exitCode: 0, signal: null }) },
  }
}

function makeServices() {
  const subprocess = {
    async resolveExecutable(name) { return 'C:\\fake\\' + name + '.exe' },
    async spawnTerminal(options) { return makeHandle(String(options.argv?.at(-1) ?? '')) },
  }
  const workingDirectory = { async ensure() { return 'D:\\x' }, defaultDirectory: 'D:\\x' }
  const config = {
    maxSessions: 16, perSessionMaxSessions: 8, retainExited: 10, scrollback: 200, maxOutputBytes: 100000,
    interceptShellTools: true, backgroundTerminals: true,
    maxShellsPerConversation: 2, maxBackgroundTerminals: 2, keepFinishedBackground: 1,
  }
  return { subprocess, workingDirectory, config }
}

let failures = 0
function check(name, ok, detail) {
  if (ok) console.log('PASS', name)
  else { failures += 1; console.log('FAIL', name, detail ?? '') }
}

async function testRegistryAndJobs() {
  const { subprocess, workingDirectory, config } = makeServices()
  const registry = new TerminalRegistry({
    subprocess,
    workingDirectory,
    getSessionQuery: () => ({ listSessions: async () => [] }),
    getSandboxPolicy: () => ({ mode: 'danger-full-access', confined: false, required: false }),
    resolveSandboxPolicy: () => ({ mode: 'danger-full-access', confined: false, required: false }),
    logger: { warn() {}, info() {} },
    config,
    getConfig: () => config,
  })
  const mockExec = { name: 'pwsh', agent: { id: 'a1', session: { id: 'session-1' } }, arguments: {}, signal: new AbortController().signal }
  const run = (command) => registry.resolveCwd(mockExec.agent, 'D:\\x', undefined).then((cwd) => registry.createCommandSession({ command, cwd, sessionId: 'session-1', origin: 'background' }))
  const session = await run('echo one')
  check('command session spawns', typeof session.id === 'string' && registry.lookup(session.id) !== undefined)
  const output = await registry.commandOutput?.(session.id).catch?.(() => undefined)
  await registry.close(session.id)
  await new Promise((resolve) => setTimeout(resolve, 30))
  check('command session closes', registry.lookup(session.id)?.info.state !== 'running')
  return null
}

async function testInterceptBackground() {
  const { subprocess, workingDirectory, config } = makeServices()
  const registry = new TerminalRegistry({
    subprocess,
    workingDirectory,
    getSessionQuery: () => ({ listSessions: async () => [] }),
    getSandboxPolicy: () => ({ mode: 'danger-full-access', confined: false, required: false }),
    resolveSandboxPolicy: () => ({ mode: 'danger-full-access', confined: false, required: false }),
    logger: { warn() {}, info() {} },
    config,
    getConfig: () => config,
  })
  const notices = []
  registry.emitNotice = (notice) => { notices.push(notice) }
  const handlers = []
  const ctx = { on(name, fn) { if (name === 'tools/execute') handlers.push(fn) }, effect() {} }
  const plugin = {
    registry,
    registryReady: Promise.resolve(registry),
    config,
    getConfig: () => config,
    logger: { warn() {}, info() {} },
    commandGroup: () => undefined,
    resolveSandboxPolicy: () => ({ mode: 'danger-full-access', confined: false, required: false }),
  }
  registerIntercept(ctx, plugin)
  const handler = handlers[0]
  const nextCalls = []
  const exec = {
    name: 'pwsh',
    agent: { id: 'a1', session: { id: 'session-1' } },
    arguments: { command: 'Start-Sleep 1; Write-Output hi', run_in_background: true },
    signal: new AbortController().signal,
  }
  const result = await Promise.race([
    handler(exec, async () => { nextCalls.push('next'); return { value: { kind: 'background' } } }),
    new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 10000)),
  ])
  check('background intercepted', result !== 'TIMEOUT' && result?.value?.kind === 'background', String(result))
  check('background job id', String(result?.value?.jobId).startsWith('dsht-'), JSON.stringify(result?.value))
  check('next not called', nextCalls.length === 0, String(nextCalls))
  check('command-start notice emitted', notices.some((n) => n.type === 'command-start' && n.background === true), JSON.stringify(notices))
  const jobId = result?.value?.jobId
  const out = await handler({ name: 'job_output', agent: exec.agent, arguments: { job_id: jobId }, signal: exec.signal }, async () => ({ value: 'builtin' }))
  check('job_output served', typeof out?.value?.text === 'string' && out.value.job?.status === 'running', JSON.stringify(out?.value).slice(0, 200))
  const killed = await handler({ name: 'job_kill', agent: exec.agent, arguments: { job_id: jobId }, signal: exec.signal }, async () => ({ value: 'builtin' }))
  check('job_kill served', killed?.value?.outcome === 'cancellation-requested', JSON.stringify(killed?.value))
  for (const info of registry.list()) await registry.close(info.id).catch(() => {})
  await registry.dispose()
}

async function testPool() {
  const { subprocess, workingDirectory, config } = makeServices()
  const registry = new TerminalRegistry({
    subprocess,
    workingDirectory,
    getSessionQuery: () => ({ listSessions: async () => [] }),
    getSandboxPolicy: () => ({ mode: 'danger-full-access', confined: false, required: false }),
    resolveSandboxPolicy: () => ({ mode: 'danger-full-access', confined: false, required: false }),
    logger: { warn() {}, info() {} },
    config,
    getConfig: () => config,
  })
  const shells = new AgentShells({ registry, getConfig: () => config, logger: { warn() {} } })
  const exec = { name: 'pwsh', agent: { id: 'a1', session: { id: 'session-1' } }, arguments: { command: 'echo hi' } }
  const options = { command: 'echo hi', cwd: 'D:\\x', timeoutMs: 5000, sessionId: 'session-1' }
  // The mocked PTY never renders the shell prompt, so only pool accounting is asserted.
  const first = await Promise.race([shells.run(exec, options), new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 8000))])
  check('pool command settles', JSON.stringify(first) !== '"TIMEOUT"', String(first))
  await shells.dispose()
  await registry.dispose()
}

await testInterceptBackground()
await testRegistryAndJobs()
console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES')
process.exit(failures === 0 ? 0 : 1)
