import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const frontendDir = path.resolve(__dirname, '..')
const repoRoot = path.resolve(frontendDir, '..', '..')
const docsSourceDir = path.join(repoRoot, 'docs-site')
const publicDir = path.join(frontendDir, 'public')
const docsAssetsDir = path.join(publicDir, 'docs-assets')
const commandsSourcePath = path.join(frontendDir, 'commands.html')

await mkdir(path.join(publicDir, 'docs'), { recursive: true })
await mkdir(path.join(publicDir, 'guide'), { recursive: true })
await mkdir(path.join(publicDir, 'hardware'), { recursive: true })
await mkdir(path.join(publicDir, 'commands'), { recursive: true })
await mkdir(docsAssetsDir, { recursive: true })

const docsStyle = readFile(path.join(docsSourceDir, 'style.css'), 'utf8')
const guideStyle = readFile(path.join(docsSourceDir, 'guide.css'), 'utf8')
const docsMain = readFile(path.join(docsSourceDir, 'main.js'), 'utf8')

function rewriteSharedMarkup(html) {
  return html
    .replaceAll('href="/style.css"', 'href="/docs-assets/style.css"')
    .replaceAll('href="/guide.css"', 'href="/docs-assets/guide.css"')
    .replaceAll('src="/main.js"', 'src="/docs-assets/main.js"')
    .replaceAll('href="https://solanaos.net"', 'href="/"')
    .replaceAll('href="https://docs.solanaos.net"', 'href="/docs"')
}

function rewriteGuideLikePage(html) {
  return rewriteSharedMarkup(html)
    .replaceAll('href="/" class="nav-brand"', 'href="/docs" class="nav-brand"')
    .replaceAll('<a href="/">Home</a>', '<a href="/docs">Docs Home</a>')
}

function rewriteBranding(content) {
  return content
    .replaceAll('https://nanohub-web-production.up.railway.app', 'https://seeker.solanaos.net')
    .replaceAll('https://www.npmjs.com/package/solanaos-cli', 'https://www.npmjs.com/package/solanaos-computer')
    .replaceAll('npx solanaos-cli install --with-web', 'npx solanaos-computer@latest install --with-web')
    .replaceAll('npx solanaos-cli install', 'npx solanaos-computer@latest install')
    .replaceAll('npm install -g solanaos-cli', 'npm install -g solanaos-computer')
    .replaceAll('npx @nanosolana/nanohub', 'npx @solanaos/nanohub')
    .replaceAll('@nanosolana/nanohub', '@solanaos/nanohub')
    .replaceAll('~/nanosolana/build/nanosolana', '~/solanaos/build/solanaos')
    .replaceAll('~/.solanaos/bin/nanosolana', '~/.solanaos/bin/solanaos')
    .replaceAll('./build/nanosolana', './build/solanaos')
    .replaceAll('build/solanaos-', 'build/solanaos-')
    .replaceAll('nanosolana go', 'npx solanaos-computer@latest install --with-web')
    .replaceAll('solanaos go', 'npx solanaos-computer@latest install --with-web')
    .replaceAll('npx npx solanaos-computer@latest install --with-web', 'npx solanaos-computer@latest install --with-web')
    .replaceAll('solanaos init', 'solanaos onboard')
    .replaceAll('solanaos birth', 'solanaos solana wallet')
    .replaceAll('solanaos run', 'solanaos daemon')
    .replaceAll('solanaos scan', 'solanaos solana health')
    .replaceAll('solanaos register', 'solanaos solana register')
    .replaceAll('solanaos registry', 'solanaos solana registry')
    .replaceAll('solanaos doctor', 'solanaos status')
    .replace(/\bnanosolana\b(?!-go|-cli|\.com)/g, 'solanaos')
    .replaceAll('~/.solanaos/', '~/.solanaos/')
    .replaceAll('npm run solanaos -- go', 'npm run install:one-shot:web')
}

const docsIndex = rewriteBranding(rewriteSharedMarkup(
  await readFile(path.join(docsSourceDir, 'index.html'), 'utf8')
))
const guidePage = rewriteBranding(rewriteGuideLikePage(
  await readFile(path.join(docsSourceDir, 'guide.html'), 'utf8')
))
const hardwarePage = rewriteBranding(rewriteGuideLikePage(
  await readFile(path.join(docsSourceDir, 'hardware.html'), 'utf8')
))
const commandsPage = rewriteBranding(await readFile(commandsSourcePath, 'utf8'))
const docsMainRewritten = rewriteBranding(
  (await docsMain)
    .replaceAll("Start SolanaOS Control with `./build/nanosolana nanobot` or the full daemon and keep the API reachable.", "Start SolanaOS Control with `./build/solanaos nanobot` or use the one-shot installer and keep the API reachable.")
)

await Promise.all([
  writeFile(path.join(docsAssetsDir, 'style.css'), await docsStyle),
  writeFile(path.join(docsAssetsDir, 'guide.css'), await guideStyle),
  writeFile(path.join(docsAssetsDir, 'main.js'), docsMainRewritten),
  writeFile(path.join(publicDir, 'docs', 'index.html'), docsIndex),
  writeFile(path.join(publicDir, 'guide', 'index.html'), guidePage),
  writeFile(path.join(publicDir, 'hardware', 'index.html'), hardwarePage),
  writeFile(path.join(publicDir, 'commands', 'index.html'), commandsPage),
  writeFile(path.join(publicDir, 'commands.html'), commandsPage),
])
