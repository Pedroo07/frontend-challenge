import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const baseUrl = 'http://127.0.0.1:4173'
const reportsDir = join(process.cwd(), 'lighthouse-reports')
mkdirSync(reportsDir, { recursive: true })

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
process.env.CHROME_PATH = chromePath

const server = spawn(
  process.execPath,
  [
    './node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '4173',
    '--strictPort',
  ],
  { stdio: 'inherit' }
)

async function waitForServer() {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite Preview encerrou com código ${server.exitCode}.`)
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {
      await delay(200)
    }
  }
  throw new Error('Vite Preview não ficou disponível em 30 segundos.')
}

function runLighthouseCommand(url, preset, outputPathBase) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32'
    const cmd = isWindows ? 'npx.cmd' : 'npx'
    const args = [
      'lighthouse',
      url,
      '--chrome-flags=--headless=new --no-sandbox',
      preset === 'desktop' ? '--preset=desktop' : '--form-factor=mobile',
      '--only-categories=performance,accessibility,best-practices,seo',
      '--output=json',
      '--output=html',
      `--output-path=${outputPathBase}`,
      '--quiet',
    ]

    const child = spawn(cmd, args, {
      shell: true,
      env: { ...process.env, CHROME_PATH: chromePath },
      stdio: ['ignore', 'ignore', 'inherit'],
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Lighthouse encerrou com código ${code}`))
    })
  })
}

function median(values) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

async function runAudits() {
  const targets = [
    { name: 'home-desktop', label: 'Início (Desktop)', url: `${baseUrl}/`, preset: 'desktop' },
    { name: 'home-mobile', label: 'Início (Mobile)', url: `${baseUrl}/`, preset: 'mobile' },
    { name: 'detail-desktop', label: 'Detalhes NFT (Desktop)', url: `${baseUrl}/nfts/nft-aurora-017`, preset: 'desktop' },
    { name: 'detail-mobile', label: 'Detalhes NFT (Mobile)', url: `${baseUrl}/nfts/nft-aurora-017`, preset: 'mobile' },
  ]

  const summary = []

  for (const target of targets) {
    console.log(`\n==================================================`)
    console.log(`Iniciando auditoria: ${target.label} (3 medições)...`)
    console.log(`==================================================`)

    const runs = []

    for (let i = 1; i <= 3; i++) {
      console.log(`  -> Executando medição ${i}/3...`)
      const outputPathBase = join(reportsDir, `${target.name}-run${i}`)
      await runLighthouseCommand(target.url, target.preset, outputPathBase)

      const jsonContent = JSON.parse(readFileSync(`${outputPathBase}.report.json`, 'utf-8'))
      const perf = Math.round((jsonContent.categories.performance?.score ?? 0) * 100)
      const a11y = Math.round((jsonContent.categories.accessibility?.score ?? 0) * 100)
      const bp = Math.round((jsonContent.categories['best-practices']?.score ?? 0) * 100)
      const seo = Math.round((jsonContent.categories.seo?.score ?? 0) * 100)

      const lcp = Math.round(jsonContent.audits['largest-contentful-paint']?.numericValue ?? 0)
      const cls = Number((jsonContent.audits['cumulative-layout-shift']?.numericValue ?? 0).toFixed(3))
      const tbt = Math.round(jsonContent.audits['total-blocking-time']?.numericValue ?? 0)

      runs.push({ perf, a11y, bp, seo, lcp, cls, tbt })
      console.log(`     Perf: ${perf} | A11y: ${a11y} | BP: ${bp} | SEO: ${seo} | LCP: ${lcp}ms | CLS: ${cls} | TBT: ${tbt}ms`)
    }

    const medianResult = {
      label: target.label,
      perf: median(runs.map((r) => r.perf)),
      a11y: median(runs.map((r) => r.a11y)),
      bp: median(runs.map((r) => r.bp)),
      seo: median(runs.map((r) => r.seo)),
      lcp: median(runs.map((r) => r.lcp)),
      cls: median(runs.map((r) => r.cls)),
      tbt: median(runs.map((r) => r.tbt)),
    }

    summary.push(medianResult)
  }

  console.log('\n\n========================================================================================')
  console.log('RESUMO FINAL DA AUDITORIA LIGHTHOUSE (MEDIANAS DE 3 MEDIÇÕES)')
  console.log('========================================================================================')
  console.table(summary)
  console.log(`Relatórios HTML e JSON salvos em: ${reportsDir}\n`)
}

try {
  await waitForServer()
  await runAudits()
} catch (err) {
  console.error('Erro na execução do Lighthouse:', err)
  process.exitCode = 1
} finally {
  if (server.exitCode === null) {
    server.kill()
    await new Promise((resolve) => server.once('exit', resolve))
  }
}
