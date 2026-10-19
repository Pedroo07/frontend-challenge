import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const baseUrl = 'http://127.0.0.1:4173'
const server = spawn(process.execPath, [
  './node_modules/vite/bin/vite.js',
  'preview',
  '--host',
  '127.0.0.1',
  '--port',
  '4173',
  '--strictPort',
], { stdio: 'inherit' })

async function waitForServer() {
  const deadline = Date.now() + 30_000

  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite Preview encerrou com código ${server.exitCode}.`)

    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {
      await delay(150)
    }
  }

  throw new Error('Vite Preview não ficou disponível em 30 segundos.')
}

function runPlaywright() {
  return new Promise((resolve, reject) => {
    const runner = spawn(process.execPath, ['./node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], {
      stdio: 'inherit',
      env: process.env,
    })
    runner.once('error', reject)
    runner.once('exit', (code) => resolve(code ?? 1))
  })
}

try {
  await waitForServer()
  process.exitCode = await runPlaywright()
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  if (server.exitCode === null) {
    server.kill()
    await new Promise((resolve) => server.once('exit', resolve))
  }
}
