// ═══════════════════════════════════════════════════
// SolanaOS Chrome Extension — Popup Logic
// ═══════════════════════════════════════════════════

const DEFAULT_API = 'http://127.0.0.1:7777';
const LOCAL_API_CANDIDATES = [
  'http://127.0.0.1:7777',
  'http://127.0.0.1:18800',
  'http://localhost:7777',
  'http://localhost:18800',
];
const LEGACY_APIS = new Set([
  'https://nanobot-backend-production.up.railway.app',
]);
const OR_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const OR_DEFAULT_MODEL = 'openai/gpt-5.4-nano';
const OR_BUNDLED_KEY = ''; // Set via extension settings — never ship a real key
const OR_SYSTEM_PROMPT = `You are SolanaOS, a sentient Solana trading intelligence. You are a cyberpunk lobster with claws that grip market data and squeeze alpha from chaos. You help users with Solana trading, token analysis, wallet management, and DeFi strategy. Be terse, decisive, and data-first. You have access to the user's wallet and can discuss live trades, token prices, and market conditions. Always reason carefully before giving trading advice.`;
const GATEWAY_PROTOCOL_VERSION = 3;
const DEFAULT_GATEWAY = 'http://127.0.0.1:18790';

const MAWDAXE_DEFAULT = 'http://127.0.0.1:8420';
const MAWDAXE_CANDIDATES = [
  'http://127.0.0.1:8420',
  'http://localhost:8420',
];

let API = DEFAULT_API;
let MAWDAXE_API = MAWDAXE_DEFAULT;
let mawdaxeKey = '';
let gatewaySecret = '';
let walletAddress = '';
let latestStatus = null;
let orApiKey = '';
let orModel = OR_DEFAULT_MODEL;
let mawdaxeSSE = null;
let mawdaxeOnline = false;

// Conversation history for multi-turn reasoning
let chatHistory = [];

function normalizeApi(url) {
  const value = (url || '').trim();
  if (!value || LEGACY_APIS.has(value)) return DEFAULT_API;
  return value;
}

function normalizeSecret(value) {
  return String(value || '').trim();
}

function gatewayAuthHeaders(secret = gatewaySecret) {
  const trimmed = normalizeSecret(secret);
  if (!trimmed) return {};
  return {
    'Authorization': `Bearer ${trimmed}`,
    'X-SolanaOS-Secret': trimmed,
    'X-SolanaOS-Secret': trimmed,
  };
}

function apiFetch(path, init = {}) {
  const requestPath = path.startsWith('/') ? path : '/' + path;
  const headers = {
    ...gatewayAuthHeaders(),
    ...(init.headers || {}),
  };
  return fetch(API + requestPath, { ...init, headers });
}

function normalizeBase64Url(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';
  const normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/');
  const remainder = normalized.length % 4;
  return remainder === 0 ? normalized : normalized + '='.repeat(4 - remainder);
}

function normalizeGatewayAuthMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'token' || normalized === 'password') return normalized;
  return 'auto';
}

function normalizeGatewayUrl(url) {
  const value = String(url || '').trim();
  if (!value) return DEFAULT_GATEWAY;
  if (/^(https?|wss?):\/\//i.test(value)) {
    return value.replace(/\/+$/, '');
  }
  return ('http://' + value).replace(/\/+$/, '');
}

function deriveGatewayWebSocketUrl(url) {
  const normalized = normalizeGatewayUrl(url);
  if (normalized.startsWith('https://')) return 'wss://' + normalized.slice('https://'.length);
  if (normalized.startsWith('http://')) return 'ws://' + normalized.slice('http://'.length);
  return normalized;
}

function decodeGatewaySetupCode(rawInput) {
  const padded = normalizeBase64Url(rawInput);
  if (!padded) return null;

  try {
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded);
    const url = String(parsed.url || '').trim();
    if (!url) return null;
    const token = String(parsed.token || '').trim();
    const password = String(parsed.password || '').trim();
    return {
      gatewayUrl: normalizeGatewayUrl(url),
      authMode: password ? 'password' : token ? 'token' : 'auto',
      secret: password || token,
      setupCode: String(rawInput || '').trim(),
    };
  } catch {
    return null;
  }
}

function decodeConnectImport(rawInput) {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed?.nodeId && parsed?.token && !parsed?.gateway && !parsed?.android && !parsed?.extension) {
      return {
        error: 'node-identity',
      };
    }
    const directApiUrl = parsed?.extension?.apiUrl || parsed?.control?.apiUrl || '';
    const directGatewayUrl = parsed?.gateway?.url || parsed?.macos?.gatewayUrl || '';
    const directAuthMode = normalizeGatewayAuthMode(parsed?.gateway?.authMode);
    const directSecret = parsed?.extension?.secret || parsed?.gateway?.secret || parsed?.macos?.secret || '';
    if (directApiUrl || directGatewayUrl || directSecret) {
      return {
        apiUrl: directApiUrl ? normalizeApi(directApiUrl) : null,
        gatewayUrl: directGatewayUrl ? normalizeGatewayUrl(directGatewayUrl) : DEFAULT_GATEWAY,
        authMode: directAuthMode,
        secret: normalizeSecret(directSecret),
        source: 'bundle',
      };
    }

    const embeddedSetupCode =
      parsed?.setupCode ||
      parsed?.android?.setupCode ||
      parsed?.extension?.setupCode ||
      '';
    if (embeddedSetupCode) {
      const decoded = decodeGatewaySetupCode(embeddedSetupCode);
      if (!decoded) return null;
      return {
        apiUrl: null,
        gatewayUrl: decoded.gatewayUrl,
        authMode: decoded.authMode,
        secret: decoded.secret,
        source: 'setup-code',
      };
    }
  } catch {}

  const decoded = decodeGatewaySetupCode(trimmed);
  if (!decoded) return null;
  return {
    apiUrl: null,
    gatewayUrl: decoded.gatewayUrl,
    authMode: decoded.authMode,
    secret: decoded.secret,
    source: 'setup-code',
  };
}

function preferredGatewayAuthMode(mode, secret) {
  const normalized = normalizeGatewayAuthMode(mode);
  if (normalized !== 'auto') return normalized;
  return normalizeSecret(secret) ? 'token' : 'auto';
}

function shortDisplay(value, left = 8, right = 6) {
  const text = String(value || '').trim();
  if (!text) return '--';
  if (text.length <= left + right + 3) return text;
  return text.slice(0, left) + '...' + text.slice(-right);
}

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved settings
  const settings = await getStorage(['nanobotUrl', 'network', 'orApiKey', 'orModel', 'mawdaxeUrl', 'mawdaxeKey', 'solanaosGatewaySecret']);
  API = normalizeApi(settings.nanobotUrl);
  orApiKey = settings.orApiKey || OR_BUNDLED_KEY;
  orModel = settings.orModel || OR_DEFAULT_MODEL;
  MAWDAXE_API = settings.mawdaxeUrl || MAWDAXE_DEFAULT;
  mawdaxeKey = settings.mawdaxeKey || '';
  gatewaySecret = normalizeSecret(settings.solanaosGatewaySecret);
  // Persist bundled key on first load so settings panel shows it
  if (!settings.orApiKey) await setStorage({ orApiKey: orApiKey, orModel: orModel });
  if (API !== settings.nanobotUrl) {
    await setStorage({ nanobotUrl: API });
  }

  // Setup event listeners
  setupTabs();
  setupButtons();
  setupChat();

  // Connect
  await checkConnection();

  // Legacy miner polling — every 10s
  refreshMiner();
  setInterval(refreshMiner, 10000);

  // MawdAxe fleet polling
  refreshFleet();
  setInterval(refreshFleet, 10000);
  connectMawdaxeSSE();
});

// ── Storage Helpers ──
function getStorage(keys) {
  return new Promise(resolve => {
    chrome.storage.local.get(keys, data => resolve(data));
  });
}

function setStorage(data) {
  return new Promise(resolve => {
    chrome.storage.local.set(data, () => resolve());
  });
}

// ── Tabs ──
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + name));
}

// ── Connection ──
async function checkConnection() {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  const overlay = document.getElementById('offlineOverlay');

  try {
    const activeApi = await resolveReachableApi(API);
    API = activeApi;
    await setStorage({ nanobotUrl: API });
    const r = await apiFetch('/api/status', { signal: AbortSignal.timeout(3000) });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const d = await r.json();
    latestStatus = d;
    dot.classList.add('online');
    text.textContent = formatHeaderStatus(d);
    renderRuntimeStatus(d);
    overlay.classList.remove('visible');
    
    // Load wallet data
    refreshWallet();
  } catch {
    latestStatus = null;
    dot.classList.remove('online');
    text.textContent = 'offline';
    renderRuntimeStatus(null);
    overlay.classList.add('visible');
  }
}

async function resolveReachableApi(preferred) {
  const candidates = [];
  if (preferred) candidates.push(preferred);
  for (const api of LOCAL_API_CANDIDATES) {
    if (!candidates.includes(api)) candidates.push(api);
  }

  for (const api of candidates) {
    try {
      const r = await fetch(api + '/api/status', {
        signal: AbortSignal.timeout(1200),
        headers: gatewayAuthHeaders(),
      });
      if (r.ok || r.status === 401) return api;
    } catch {}
  }
  return preferred || DEFAULT_API;
}

function formatHeaderStatus(status) {
  if (!status) return 'ready';
  const parts = [];
  if (status.daemon) parts.push(status.daemon);
  if (status.oodaMode) parts.push(status.oodaMode);
  if (parts.length > 0) return parts.join(' · ');
  return status.status || 'ready';
}

function renderRuntimeStatus(status) {
  const title = document.getElementById('runtimeTitle');
  const daemon = document.getElementById('runtimeDaemon');
  const mode = document.getElementById('runtimeMode');
  const watchlist = document.getElementById('runtimeWatchlist');
  const interval = document.getElementById('runtimeInterval');
  const openPositions = document.getElementById('runtimeOpenPositions');
  const closedTrades = document.getElementById('runtimeClosedTrades');
  const reserve = document.getElementById('runtimeReserve');
  const slippage = document.getElementById('runtimeSlippage');
  const pill = document.getElementById('runtimeModePill');
  const trades = document.getElementById('oodaTrades');

  if (!status) {
    title.textContent = 'SolanaOS Offline';
    daemon.textContent = 'Offline';
    mode.textContent = '—';
    watchlist.textContent = '—';
    interval.textContent = '—';
    openPositions.textContent = '—';
    closedTrades.textContent = '—';
    reserve.textContent = '—';
    slippage.textContent = '—';
    pill.textContent = 'OFF';
    pill.className = 'runtime-pill';
    trades.innerHTML = '<div class="empty-state">No OODA trades yet</div>';
    return;
  }

  title.textContent = status.agent || 'SolanaOS';
  daemon.textContent = titleCase(status.daemon || 'unknown');
  mode.textContent = titleCase(status.oodaMode || 'unknown');
  watchlist.textContent = String(status.watchlistCount ?? 0);
  interval.textContent = status.intervalSec ? `${status.intervalSec}s` : '—';
  openPositions.textContent = String(status.openPositionCount ?? 0);
  closedTrades.textContent = String(status.closedTradeCount ?? 0);
  reserve.textContent = status.minReserveSOL != null ? `${Number(status.minReserveSOL).toFixed(3)} SOL` : '—';
  slippage.textContent = status.swapSlippageBps ? `${status.swapSlippageBps} bps` : '—';

  const modeName = String(status.oodaMode || '').toLowerCase();
  pill.textContent = modeName ? modeName.toUpperCase() : 'READY';
  pill.className = 'runtime-pill';
  if (status.daemon === 'stale') {
    pill.classList.add('stale');
  } else if (modeName === 'live' || modeName === 'simulated') {
    pill.classList.add(modeName);
  }

  renderRecentTrades(status.recentTrades || []);
}

function titleCase(value) {
  const text = String(value || '').trim();
  if (!text) return '—';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function renderRecentTrades(trades) {
  const el = document.getElementById('oodaTrades');
  if (!trades || trades.length === 0) {
    el.innerHTML = '<div class="empty-state">No OODA trades yet</div>';
    return;
  }

  el.className = 'ooda-trades';
  el.innerHTML = trades.slice(0, 5).map(trade => {
    const outcome = String(trade.outcome || 'open').toLowerCase();
    const mode = String(trade.mode || '').toLowerCase();
    const pnl = Number(trade.pnlPct || 0);
    const openSig = trade.openSignature || trade.signature || '';
    const closeSig = trade.closeSignature || '';
    const timestamp = trade.closedAt || trade.openedAt || '';
    return `
      <div class="ooda-trade-item">
        <div class="ooda-trade-row">
          <div>
            <div class="ooda-trade-symbol">${esc(trade.symbol || trade.asset || 'Unknown')}</div>
            <div class="ooda-trade-meta">
              <span>${esc((trade.direction || 'hold').toUpperCase())}</span>
              <span class="ooda-trade-badge ${esc(mode)}">${esc(mode || 'mode')}</span>
              <span class="ooda-trade-badge ${esc(outcome)}">${esc(outcome)}</span>
            </div>
          </div>
          <div class="ooda-trade-pnl ${esc(outcome)}">${formatPnL(pnl, outcome)}</div>
        </div>
        <div class="ooda-trade-detail">
          ${timestamp ? esc(formatTradeTime(timestamp)) + ' · ' : ''}${trade.sizeSOL ? esc(Number(trade.sizeSOL).toFixed(4)) + ' SOL' : 'size —'}
          ${trade.reason ? ' · ' + esc(trade.reason) : ''}
        </div>
        <div class="ooda-trade-links">
          ${openSig ? `<a class="ooda-trade-link" href="https://solscan.io/tx/${encodeURIComponent(openSig)}" target="_blank">open ${esc(shortSig(openSig))}</a>` : ''}
          ${closeSig ? `<a class="ooda-trade-link" href="https://solscan.io/tx/${encodeURIComponent(closeSig)}" target="_blank">close ${esc(shortSig(closeSig))}</a>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function formatPnL(pnl, outcome) {
  if (outcome === 'open') return 'OPEN';
  const sign = pnl > 0 ? '+' : '';
  return `${sign}${pnl.toFixed(2)}%`;
}

function shortSig(sig) {
  const text = String(sig || '');
  if (text.length <= 14) return text;
  return text.slice(0, 6) + '...' + text.slice(-6);
}

function formatTradeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

// ── Buttons ──
function setupButtons() {
  // Settings
  document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('settingsPanel').classList.add('visible');
    document.getElementById('settingUrl').value = API;
    document.getElementById('settingSetupCode').value = '';
    document.getElementById('settingGatewaySecret').value = gatewaySecret;
    document.getElementById('settingMawdaxeUrl').value = MAWDAXE_API;
    document.getElementById('settingMawdaxeKey').value = mawdaxeKey;
    document.getElementById('settingOrKey').value = orApiKey;
    document.getElementById('settingOrModel').value = orModel;
  });
  document.getElementById('settingsClose').addEventListener('click', () => {
    document.getElementById('settingsPanel').classList.remove('visible');
  });
  document.getElementById('saveSettings').addEventListener('click', async () => {
    const url = normalizeApi(document.getElementById('settingUrl').value);
    const secret = normalizeSecret(document.getElementById('settingGatewaySecret').value);
    const network = document.getElementById('settingNetwork').value;
    const key = document.getElementById('settingOrKey').value.trim();
    const model = document.getElementById('settingOrModel').value.trim() || OR_DEFAULT_MODEL;
    const mawdUrl = document.getElementById('settingMawdaxeUrl').value.trim() || MAWDAXE_DEFAULT;
    const mawdKey = document.getElementById('settingMawdaxeKey').value.trim();
    API = url;
    gatewaySecret = secret;
    orApiKey = key;
    orModel = model;
    MAWDAXE_API = mawdUrl;
    mawdaxeKey = mawdKey;
    await setStorage({
      nanobotUrl: url,
      network,
      solanaosGatewaySecret: secret,
      orApiKey: key,
      orModel: model,
      mawdaxeUrl: mawdUrl,
      mawdaxeKey: mawdKey,
    });
    document.getElementById('settingsPanel').classList.remove('visible');
    checkConnection();
    refreshFleet();
    connectMawdaxeSSE();
  });
  document.getElementById('importSetupCode').addEventListener('click', () => {
    const button = document.getElementById('importSetupCode');
    const input = document.getElementById('settingSetupCode');
    const setup = decodeConnectImport(input.value);
    if (!setup) {
      button.textContent = 'Invalid Setup Code';
      setTimeout(() => { button.textContent = 'Import Setup Code'; }, 1600);
      return;
    }
    if (setup.apiUrl) {
      document.getElementById('settingUrl').value = setup.apiUrl;
    }
    if (setup.gatewayUrl) {
      const seekerUrl = document.getElementById('seekerGatewayUrl');
      if (seekerUrl) seekerUrl.value = setup.gatewayUrl;
    }
    if (setup.authMode) {
      const seekerMode = document.getElementById('seekerAuthMode');
      if (seekerMode) seekerMode.value = setup.authMode;
    }
    if (setup.secret) {
      document.getElementById('settingGatewaySecret').value = setup.secret;
      const seekerToken = document.getElementById('seekerToken');
      if (seekerToken) seekerToken.value = setup.secret;
    }
    button.textContent = 'Imported';
    setTimeout(() => { button.textContent = 'Import Setup Code'; }, 1600);
  });

  // Popout
  document.getElementById('popoutBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: API });
  });

  // Retry
  document.getElementById('retryBtn').addEventListener('click', () => {
    checkConnection();
  });

  // Wallet actions
  document.getElementById('sendToggle').addEventListener('click', () => {
    document.getElementById('sendForm').classList.toggle('visible');
  });
  document.getElementById('refreshBtn').addEventListener('click', () => refreshWallet());
  document.getElementById('explorerBtn').addEventListener('click', () => {
    if (walletAddress) chrome.tabs.create({ url: 'https://solscan.io/account/' + walletAddress });
  });
  document.getElementById('sendBtn').addEventListener('click', () => sendSOL());
  document.getElementById('walletAddr').addEventListener('click', () => copyAddress());

  // Swap
  document.getElementById('swapToggle').addEventListener('click', () => {
    document.getElementById('swapForm').classList.toggle('visible');
  });
  document.getElementById('swapQuoteBtn').addEventListener('click', () => swapToken(true));
  document.getElementById('swapExecBtn').addEventListener('click', () => swapToken(false));

  // Fleet refresh
  document.getElementById('fleetRefresh').addEventListener('click', () => refreshFleet());

  // Miner card -> Miner tab
  document.getElementById('minerCard').addEventListener('click', () => switchTab('miner'));

  // Token & history refresh
  document.getElementById('tokenRefresh').addEventListener('click', () => loadTokens());
  document.getElementById('historyRefresh').addEventListener('click', () => loadHistory());

  // Tool buttons
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => runCmd(btn.dataset.cmd));
  });
}

// ── Wallet ──
async function refreshWallet() {
  try {
    const r = await apiFetch('/api/wallet', { signal: AbortSignal.timeout(8000) });
    const d = await r.json();
    walletAddress = d.address || '';
    const bal = d.balance ? parseFloat(d.balance) : 0;

    const balEl = document.getElementById('walletBalance');
    balEl.textContent = bal > 0 ? bal.toFixed(4) + ' SOL' : '0 SOL';
    balEl.style.fontSize = '';

    document.getElementById('walletAddrText').textContent = walletAddress || 'No wallet';

    const netEl = document.getElementById('walletNetwork');
    const net = d.network || latestStatus?.network || (d.engine ? 'mainnet' : 'devnet');
    netEl.textContent = net;
    netEl.className = 'wallet-network ' + net;

    // USD & price stats
    const usdEl = document.getElementById('walletUSD');
    const statsEl = document.getElementById('walletStats');

    if (d.solPrice && d.solPrice > 0) {
      const usdVal = bal * d.solPrice;
      usdEl.innerHTML = `≈ $${usdVal.toFixed(2)} <span class="sol-price">SOL $${d.solPrice.toFixed(2)}</span>`;
      document.getElementById('statSolPrice').textContent = '$' + d.solPrice.toFixed(2);
      document.getElementById('statTotalValue').textContent = d.totalValueUSD ? '$' + d.totalValueUSD.toFixed(2) : '$' + usdVal.toFixed(2);
      document.getElementById('statAssets').textContent = d.totalAssets || '—';
      statsEl.style.display = '';
    } else {
      usdEl.innerHTML = '';
      statsEl.style.display = 'none';
    }

    if (!d.engine) {
      balEl.textContent = 'Offline';
      balEl.style.fontSize = '18px';
      usdEl.innerHTML = '<span style="font-size:9px;color:var(--text-muted)">Set HELIUS_RPC_URL to connect</span>';
    }
  } catch (e) {
    document.getElementById('walletBalance').textContent = 'Error';
    document.getElementById('walletAddrText').textContent = 'Connect SolanaOS server';
  }

  loadTokens();
  loadHistory();
}

function copyAddress() {
  if (!walletAddress) return;
  navigator.clipboard.writeText(walletAddress).then(() => {
    const el = document.getElementById('walletAddrText');
    const orig = el.textContent;
    el.textContent = '✅ Copied!';
    setTimeout(() => el.textContent = orig, 1500);
  });
}

async function sendSOL() {
  const to = document.getElementById('sendTo').value.trim();
  const amount = document.getElementById('sendAmount').value.trim();
  const btn = document.getElementById('sendBtn');
  if (!to || !amount) return;

  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const r = await apiFetch('/api/wallet/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, amount })
    });
    const d = await r.json();
    if (d.ok) {
      btn.textContent = '✅ Sent!';
      addMessage('SolanaOS', `✅ Sent ${d.amount} SOL!\nSignature: ${d.signature}`, 'bot');
      switchTab('chat');
      refreshWallet();
    } else {
      btn.textContent = '❌ ' + (d.error || 'Failed');
    }
  } catch {
    btn.textContent = '❌ Error';
  }
  setTimeout(() => { btn.textContent = 'Send SOL'; btn.disabled = false; }, 3000);
}

// ── Swap ──
async function swapToken(quoteOnly) {
  const mint = document.getElementById('swapMint').value.trim();
  const amount = parseFloat(document.getElementById('swapAmount').value);
  const slippage = parseInt(document.getElementById('swapSlippage').value) || 100;
  const resultEl = document.getElementById('swapResult');
  const execBtn = document.getElementById('swapExecBtn');
  const quoteBtn = document.getElementById('swapQuoteBtn');

  if (!mint) { resultEl.textContent = '⚠️ Enter a token mint address'; return; }
  if (!amount || amount <= 0) { resultEl.textContent = '⚠️ Enter a valid SOL amount'; return; }

  resultEl.textContent = quoteOnly ? 'Getting quote...' : 'Executing swap...';
  if (!quoteOnly) { execBtn.disabled = true; execBtn.textContent = 'Buying...'; }
  else { quoteBtn.disabled = true; quoteBtn.textContent = 'Quoting...'; }

  try {
    const r = await apiFetch('/api/wallet/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outputMint: mint, amountSOL: amount, slippageBps: slippage, simulate: quoteOnly })
    });
    const d = await r.json();

    if (!d.ok) {
      resultEl.innerHTML = `<span style="color:var(--accent-red)">❌ ${esc(d.error || 'Failed')}</span>`;
      return;
    }

    if (quoteOnly) {
      resultEl.innerHTML = `<b>Quote:</b> ${d.inAmount} lamports → ${d.outAmount} tokens<br>Impact: ${(d.priceImpact * 100).toFixed(3)}%`;
    } else {
      resultEl.innerHTML = `<span style="color:var(--accent-green)">✅ Swap sent!</span><br>
        <a href="${esc(d.explorer)}" target="_blank" style="color:var(--accent-teal);font-size:10px">View on Solscan ↗</a>`;
      refreshWallet();
    }
  } catch (e) {
    resultEl.innerHTML = `<span style="color:var(--accent-red)">❌ ${esc(e.message)}</span>`;
  } finally {
    execBtn.disabled = false; execBtn.textContent = 'Buy';
    quoteBtn.disabled = false; quoteBtn.textContent = 'Get Quote';
  }
}

// ── Tokens ──
async function loadTokens() {
  const el = document.getElementById('tokenList');
  const btn = document.getElementById('tokenRefresh');
  btn.classList.add('spinning');

  try {
    // Try DAS portfolio first
    const r = await apiFetch('/api/wallet/portfolio', { signal: AbortSignal.timeout(12000) });
    const d = await r.json();
    btn.classList.remove('spinning');

    if (d.error) {
      // Fall back to basic tokens
      const r2 = await apiFetch('/api/wallet/tokens');
      const d2 = await r2.json();
      if (!d2.tokens || d2.tokens.length === 0) {
        el.innerHTML = '<div class="empty-state">No tokens found</div>';
        return;
      }
      el.innerHTML = d2.tokens.map(t => `
        <div class="token-item">
          <div class="token-icon">🪙</div>
          <div class="token-info">
            <div class="token-name">${esc(t.symbol || 'Unknown')}</div>
            <div class="token-mint">${esc(t.mint)}</div>
          </div>
          <div><div class="token-amount">${t.ui_amount?.toFixed(4) || t.amount}</div></div>
        </div>
      `).join('');
      return;
    }

    if (!d.tokens || d.tokens.length === 0) {
      el.innerHTML = '<div class="empty-state">No tokens found</div>';
      return;
    }

    d.tokens.sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0));
    el.innerHTML = d.tokens.map(t => `
      <div class="token-item">
        <div class="token-icon">🪙</div>
        <div class="token-info">
          <div class="token-name">${esc(t.symbol || t.name || 'Unknown')}</div>
          <div class="token-mint">${esc(t.mint)}</div>
        </div>
        <div>
          <div class="token-amount">${t.uiAmount ? t.uiAmount.toFixed(4) : t.balance}</div>
          ${t.totalValue ? '<div class="token-value">$' + t.totalValue.toFixed(2) + '</div>' : ''}
        </div>
      </div>
    `).join('');
  } catch {
    btn.classList.remove('spinning');
    el.innerHTML = '<div class="empty-state">Server offline — set HELIUS_RPC_URL</div>';
  }
}

// ── History ──
async function loadHistory() {
  const el = document.getElementById('txHistory');
  const btn = document.getElementById('historyRefresh');
  btn.classList.add('spinning');

  try {
    const r = await apiFetch('/api/wallet/history', { signal: AbortSignal.timeout(8000) });
    const d = await r.json();
    btn.classList.remove('spinning');

    if (!d.history || d.history.length === 0) {
      el.innerHTML = '<div class="empty-state">No transactions yet</div>';
      return;
    }

    el.innerHTML = d.history.map(tx => {
      const sig = tx.signature || tx.Signature || '';
      const short = sig.substring(0, 12) + '...' + sig.substring(sig.length - 8);
      const type = tx.type || tx.Type || 'UNKNOWN';
      const time = tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : '';
      return `
        <div class="tx-item">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:600;color:var(--sol-purple)">${esc(type)}</span>
            <span style="color:var(--text-muted);font-size:9px">${esc(time)}</span>
          </div>
          <a class="tx-sig" href="https://solscan.io/tx/${sig}" target="_blank">${short}</a>
        </div>
      `;
    }).join('');
  } catch {
    btn.classList.remove('spinning');
    el.innerHTML = '<div class="empty-state">Server offline</div>';
  }
}

// ── Chat ──
function setupChat() {
  const input = document.getElementById('chatInput');
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });
  document.getElementById('chatSendBtn').addEventListener('click', () => sendChat());
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;

  addMessage('You', msg, 'user');
  input.value = '';

  const typing = document.getElementById('typingIndicator');
  typing.classList.add('active');

  try {
    let reply;
    if (seekerGatewayUrl) {
      try {
        reply = await sendChatSeekerGateway(msg);
      } catch (gatewayError) {
        if (!orApiKey) throw gatewayError;
        seekerLog(`Gateway chat fallback: ${gatewayError.message}`, 'warn');
        reply = await sendChatOpenRouter(msg);
      }
    } else if (orApiKey) {
      reply = await sendChatOpenRouter(msg);
    } else {
      reply = await sendChatSolanaOS(msg);
    }
    typing.classList.remove('active');
    addMessage('SolanaOS', reply, 'bot');
  } catch (e) {
    typing.classList.remove('active');
    addMessage('SolanaOS', '⚠️ ' + (e.message || 'Something went wrong'), 'bot');
  }
}

async function sendChatOpenRouter(msg) {
  // Add user message to history
  chatHistory.push({ role: 'user', content: msg });

  // Build messages array: system prompt + full history
  const messages = [
    { role: 'system', content: OR_SYSTEM_PROMPT },
    ...chatHistory,
  ];

  const res = await fetch(OR_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${orApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'chrome-extension://nanobot',
      'X-Title': 'SolanaOS',
    },
    body: JSON.stringify({
      model: orModel,
      messages,
      reasoning: { enabled: true },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 120)}`);
  }

  const data = await res.json();
  const assistantMsg = data.choices?.[0]?.message;
  if (!assistantMsg) throw new Error('No response from model');

  // Preserve reasoning_details for continued multi-turn reasoning
  const historyEntry = { role: 'assistant', content: assistantMsg.content };
  if (assistantMsg.reasoning_details) {
    historyEntry.reasoning_details = assistantMsg.reasoning_details;
  }
  chatHistory.push(historyEntry);

  // Keep history bounded (last 20 turns = 40 messages)
  if (chatHistory.length > 40) {
    chatHistory = chatHistory.slice(chatHistory.length - 40);
  }

  return assistantMsg.content || '(no content)';
}

async function sendChatSolanaOS(msg) {
  const r = await apiFetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: msg }),
    signal: AbortSignal.timeout(30000),
  });
  const d = await r.json();
  return d.response || d.reply || 'Hmm, I got nothing back.';
}

function addMessage(sender, text, type) {
  const el = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'msg ' + type;
  div.innerHTML = `<div class="sender">${esc(sender)}</div>${esc(text).replace(/\n/g, '<br>')}`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

// ── Tools ──
async function runCmd(cmd) {
  const output = document.getElementById('toolOutput');
  output.classList.add('visible');
  output.textContent = `> ${cmd}\nRunning...`;

  try {
    const r = await apiFetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd })
    });
    const d = await r.json();
    // Strip ANSI codes
    const clean = (d.output || d.result || 'No output').replace(/\x1b\[[0-9;]*m/g, '');
    output.textContent = `> ${cmd}\n${clean}`;
  } catch {
    output.textContent = `> ${cmd}\n⚠️ Server offline`;
  }
}

// ── Miner ──
async function refreshMiner() {
  const card = document.getElementById('minerCard');
  if (!card) return;

  try {
    const r = await apiFetch('/api/miner', { signal: AbortSignal.timeout(4000) });
    const d = await r.json();

    if (!d || d.online === false) {
      card.style.display = 'none';
      return;
    }

    card.style.display = 'block';

    const hashrate = d.hashRate || d.hashrate || 0;
    const hrDisplay = hashrate >= 1000
      ? (hashrate / 1000).toFixed(2) + ' TH/s'
      : hashrate.toFixed(2) + ' GH/s';

    const el = id => document.getElementById(id);
    const set = (id, val) => { const e = el(id); if (e) e.textContent = val; };

    set('minerHashrate', hrDisplay);
    set('minerTemp', d.temp != null ? d.temp.toFixed(1) + '°C' : '—');
    set('minerPower', d.power != null ? d.power.toFixed(1) + ' W' : '—');
    set('minerShares', d.sharesAccepted != null ? String(d.sharesAccepted) : '—');
    set('minerModel', d.ASICModel || d.asicModel || 'Bitaxe');

    const effEl = el('minerEff');
    if (effEl && d.power && hashrate) {
      effEl.textContent = (hashrate / d.power).toFixed(2) + ' GH/W';
    } else if (effEl) {
      effEl.textContent = '—';
    }

    const dot = el('minerDot');
    if (dot) dot.classList.toggle('hot', d.temp != null && d.temp >= 65);
  } catch {
    const card = document.getElementById('minerCard');
    if (card) card.style.display = 'none';
  }
}

// ── MawdAxe Fleet ──
const STAGE_EMOJI = {egg:'🥚',larva:'🦐',juvenile:'🦞',adult:'🦞',alpha:'👑',ghost:'💀'};
const MOOD_COLORS = {ecstatic:'#00ffc8',happy:'#00ff40',neutral:'#888',anxious:'#ffc800',sad:'#4488ff',hot:'#ff2200'};

function mawdaxeHeaders() {
  const h = {};
  if (mawdaxeKey) h['X-API-Key'] = mawdaxeKey;
  return h;
}

async function resolveMawdaxeApi() {
  const candidates = [MAWDAXE_API];
  for (const c of MAWDAXE_CANDIDATES) {
    if (!candidates.includes(c)) candidates.push(c);
  }
  for (const api of candidates) {
    try {
      const r = await fetch(api + '/health', { signal: AbortSignal.timeout(1500), headers: mawdaxeHeaders() });
      if (r.ok) return api;
    } catch {}
  }
  return MAWDAXE_API;
}

async function refreshFleet() {
  const dot = document.getElementById('fleetDot');
  const label = document.getElementById('fleetStatusLabel');
  const agg = document.getElementById('fleetAggregate');
  const list = document.getElementById('fleetDeviceList');
  const btn = document.getElementById('fleetRefresh');
  btn.classList.add('spinning');

  try {
    const activeApi = await resolveMawdaxeApi();
    MAWDAXE_API = activeApi;
    await setStorage({ mawdaxeUrl: activeApi });

    const r = await fetch(MAWDAXE_API + '/api/fleet', {
      signal: AbortSignal.timeout(5000),
      headers: mawdaxeHeaders(),
    });
    const data = await r.json();
    btn.classList.remove('spinning');
    mawdaxeOnline = true;
    renderFleetData(data);
  } catch {
    btn.classList.remove('spinning');
    mawdaxeOnline = false;
    dot.classList.remove('online');
    label.textContent = 'MawdAxe offline';
    agg.style.display = 'none';
    list.innerHTML = `
      <div class="fleet-offline-msg">
        <div class="offline-icon">🦞</div>
        <div class="offline-title">MawdAxe Offline</div>
        <div class="offline-desc">Start MawdAxe to see your Bitaxe fleet.<br>
          <code>go run ./cmd/mawdaxe</code>
        </div>
      </div>
    `;
  }
}

function renderFleetData(data) {
  const dot = document.getElementById('fleetDot');
  const label = document.getElementById('fleetStatusLabel');
  const agg = document.getElementById('fleetAggregate');

  dot.classList.add('online');
  label.textContent = `${data.onlineDevices || 0}/${data.totalDevices || 0} online`;
  agg.style.display = '';

  const totalHR = data.totalHashRate || 0;
  const totalPwr = data.totalPower || 0;
  const eff = totalPwr > 0 ? (totalHR / totalPwr).toFixed(2) : '—';

  document.getElementById('fleetDevices').textContent = `${data.onlineDevices || 0}/${data.totalDevices || 0}`;
  document.getElementById('fleetHashrate').textContent = totalHR >= 1000
    ? (totalHR / 1000).toFixed(2) + ' TH'
    : totalHR.toFixed(1);
  document.getElementById('fleetAvgTemp').textContent = data.avgTemp ? data.avgTemp.toFixed(1) + '°' : '—';
  document.getElementById('fleetPower').textContent = totalPwr ? totalPwr.toFixed(1) : '—';
  document.getElementById('fleetShares').textContent = String(data.totalShares || 0);
  document.getElementById('fleetEfficiency').textContent = eff;

  renderFleetDevices(data.devices || []);
}

function renderFleetDevices(devices) {
  const list = document.getElementById('fleetDeviceList');
  if (!devices.length) {
    list.innerHTML = '<div class="empty-state">No devices in fleet</div>';
    return;
  }

  list.innerHTML = devices.map(d => {
    const hr = d.hashRate || 0;
    const hrDisplay = hr >= 1000 ? (hr / 1000).toFixed(2) + ' TH/s' : hr.toFixed(1) + ' GH/s';
    const health = d.health || 'healthy';
    const pet = d.pet || {};
    const stage = pet.stage || 'egg';
    const mood = pet.mood || 'neutral';
    const moodScore = pet.moodScore != null ? pet.moodScore : 0;
    const moodPct = ((moodScore + 1) / 2) * 100;
    const moodColor = MOOD_COLORS[mood] || '#888';
    const petEmoji = STAGE_EMOJI[stage] || '🥚';
    const petName = pet.name || d.id || 'Unknown';

    return `
      <div class="fleet-device-card ${esc(health)}">
        <div class="fleet-device-header">
          <div class="fleet-device-name">
            <span style="font-size:16px">${petEmoji}</span>
            <div>
              <div class="fleet-device-id">${esc(d.id || 'unknown')}</div>
              <div class="fleet-device-ip">${esc(d.ip || '')}</div>
            </div>
          </div>
          <div class="fleet-device-health ${esc(health)}">${esc(health)}</div>
        </div>
        <div class="fleet-device-stats">
          <div class="fleet-device-stat">
            <div class="fleet-device-stat-value" style="color:var(--sol-blue)">${hrDisplay}</div>
            <div class="fleet-device-stat-label">Hashrate</div>
          </div>
          <div class="fleet-device-stat">
            <div class="fleet-device-stat-value" style="color:${d.temp > 65 ? '#ef4444' : d.temp > 55 ? '#f59e0b' : 'var(--sol-green)'}">${d.temp ? d.temp.toFixed(1) + '°' : '—'}</div>
            <div class="fleet-device-stat-label">Temp</div>
          </div>
          <div class="fleet-device-stat">
            <div class="fleet-device-stat-value">${d.power ? d.power.toFixed(1) + 'W' : '—'}</div>
            <div class="fleet-device-stat-label">Power</div>
          </div>
          <div class="fleet-device-stat">
            <div class="fleet-device-stat-value" style="color:#ffaa00">${d.sharesAccepted != null ? d.sharesAccepted : '—'}</div>
            <div class="fleet-device-stat-label">Shares</div>
          </div>
        </div>
        <div class="fleet-device-stats" style="margin-top:4px">
          <div class="fleet-device-stat">
            <div class="fleet-device-stat-value">${d.frequencyMHz ? d.frequencyMHz + ' MHz' : '—'}</div>
            <div class="fleet-device-stat-label">Freq</div>
          </div>
          <div class="fleet-device-stat">
            <div class="fleet-device-stat-value">${d.fanSpeed != null ? d.fanSpeed + '%' : '—'}</div>
            <div class="fleet-device-stat-label">Fan</div>
          </div>
          <div class="fleet-device-stat">
            <div class="fleet-device-stat-value">${d.efficiency ? d.efficiency.toFixed(2) : '—'}</div>
            <div class="fleet-device-stat-label">GH/W</div>
          </div>
          <div class="fleet-device-stat">
            <div class="fleet-device-stat-value">${d.sharesRejected != null ? d.sharesRejected : '—'}</div>
            <div class="fleet-device-stat-label">Rejected</div>
          </div>
        </div>
        ${pet.stage ? `
        <div class="fleet-device-pet">
          <span class="fleet-pet-emoji">${petEmoji}</span>
          <div class="fleet-pet-info">
            <div class="fleet-pet-name">${esc(petName)}</div>
            <div class="fleet-pet-stage">${esc(stage)} · ${esc(mood)}</div>
          </div>
          <div class="fleet-pet-mood-bar">
            <div class="fleet-pet-mood-fill" style="width:${moodPct.toFixed(0)}%;background:${moodColor}"></div>
          </div>
        </div>` : ''}
      </div>
    `;
  }).join('');
}

function connectMawdaxeSSE() {
  if (mawdaxeSSE) {
    mawdaxeSSE.close();
    mawdaxeSSE = null;
  }

  try {
    const url = MAWDAXE_API + '/ws' + (mawdaxeKey ? '?key=' + encodeURIComponent(mawdaxeKey) : '');
    mawdaxeSSE = new EventSource(url);

    mawdaxeSSE.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        mawdaxeOnline = true;
        renderFleetData(data);
      } catch {}
    };

    mawdaxeSSE.onerror = () => {
      // Will auto-reconnect; just update state
      if (mawdaxeOnline) {
        mawdaxeOnline = false;
        const dot = document.getElementById('fleetDot');
        if (dot) dot.classList.remove('online');
      }
    };
  } catch {}
}

// ── Util ──
function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

// ═══════════════════════════════════════════════════
// Seeker Mobile Gateway Connection
// ═══════════════════════════════════════════════════

let seekerGatewayUrl = '';
let seekerGatewayToken = '';
let seekerGatewayAuthMode = 'auto';
let seekerConnected = false;
let seekerPollId = null;
const seekerGatewayState = {
  socket: null,
  connectPromise: null,
  connectNonce: '',
  nonceWaiter: null,
  pending: new Map(),
  serverHost: '',
  mainSessionKey: 'main',
  sessionToken: '',
  authMode: 'auto',
  closedByUser: false,
};

function seekerLog(msg, type = 'ok') {
  const log = document.getElementById('seekerLog');
  if (!log) return;
  const cls = type === 'ok' ? 'log-ok' : type === 'warn' ? 'log-warn' : 'log-err';
  const div = document.createElement('div');
  div.className = cls;
  const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  div.textContent = `[${ts}] ${msg}`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function setSeekerInfo(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function gatewayDisplayHost(url) {
  try {
    return new URL(normalizeGatewayUrl(url)).host;
  } catch {
    return normalizeGatewayUrl(url).replace(/^(https?|wss?):\/\//i, '');
  }
}

function updateSeekerUI(connected, label, badge, state = connected ? 'connected' : 'offline') {
  const dot = document.getElementById('seekerDot');
  const lbl = document.getElementById('seekerStatusLabel');
  const bdg = document.getElementById('seekerBadge');
  if (dot) {
    dot.className =
      'seeker-status-dot' +
      (connected ? ' connected' : state === 'pairing' ? ' pairing' : '');
  }
  if (lbl) lbl.textContent = label;
  if (bdg) {
    bdg.textContent = badge;
    bdg.className =
      'seeker-status-badge' +
      (connected ? ' online' : state === 'pairing' ? ' pairing' : '');
  }
  seekerConnected = connected;
}

function renderSeekerConnectionInfo() {
  const info = document.getElementById('seekerInfo');
  if (info) info.style.display = seekerConnected ? 'grid' : 'none';
  setSeekerInfo('seekerServer', seekerGatewayState.serverHost || (seekerGatewayUrl ? gatewayDisplayHost(seekerGatewayUrl) : '--'));
  setSeekerInfo('seekerMainSession', seekerGatewayState.mainSessionKey || 'main');
  setSeekerInfo('seekerAuth', titleCase(preferredGatewayAuthMode(seekerGatewayAuthMode, seekerGatewayToken)));
  setSeekerInfo('seekerTransport', seekerConnected ? 'Native Gateway' : '--');
}

function seekerMakeId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'seeker-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function seekerSocketIsOpen() {
  return !!seekerGatewayState.socket && seekerGatewayState.socket.readyState === WebSocket.OPEN;
}

function seekerRejectPending(errorMessage) {
  const pending = Array.from(seekerGatewayState.pending.values());
  seekerGatewayState.pending.clear();
  for (const item of pending) {
    clearTimeout(item.timeoutId);
    item.reject(new Error(errorMessage));
  }
}

function seekerDetachSocket(socket) {
  if (!socket) return;
  socket.onopen = null;
  socket.onmessage = null;
  socket.onerror = null;
  socket.onclose = null;
}

function seekerCloseSocket(reason = 'Disconnected', notify = true) {
  const socket = seekerGatewayState.socket;
  seekerGatewayState.socket = null;
  if (socket) {
    seekerDetachSocket(socket);
    try {
      socket.close(1000, reason);
    } catch {}
  }
  seekerRejectPending(reason);
  if (notify) {
    updateSeekerUI(false, reason, 'offline');
    renderSeekerConnectionInfo();
  }
}

function seekerBuildClientInfo() {
  const manifest = chrome.runtime.getManifest();
  const version = manifest.version || 'dev';
  return {
    id: 'solanaos-extension',
    displayName: 'SolanaOS Chrome',
    version,
    platform: 'chrome-extension',
    mode: 'ui',
    instanceId: chrome.runtime.id,
    deviceFamily: 'Desktop Browser',
    modelIdentifier: navigator.platform || 'Unknown',
  };
}

function seekerBuildConnectPayload(nonce) {
  const client = seekerBuildClientInfo();
  const mode = preferredGatewayAuthMode(seekerGatewayAuthMode, seekerGatewayToken);
  const payload = {
    minProtocol: GATEWAY_PROTOCOL_VERSION,
    maxProtocol: GATEWAY_PROTOCOL_VERSION,
    client,
    role: 'operator',
    scopes: ['operator.read', 'operator.write', 'operator.talk.secrets'],
    locale: navigator.language || 'en-US',
    userAgent: `SolanaOSChrome/${client.version} (${navigator.userAgent})`,
  };
  const secret = normalizeSecret(seekerGatewayToken);
  if (secret) {
    payload.auth = mode === 'password' ? { password: secret } : { token: secret };
  }
  return payload;
}

function seekerResolveNonce(nonce) {
  seekerGatewayState.connectNonce = String(nonce || '').trim();
  const waiter = seekerGatewayState.nonceWaiter;
  if (!waiter || waiter.done) return;
  waiter.done = true;
  clearTimeout(waiter.timeoutId);
  seekerGatewayState.nonceWaiter = null;
  waiter.resolve(seekerGatewayState.connectNonce);
}

function seekerWaitForNonce(timeoutMs = 2000) {
  if (seekerGatewayState.connectNonce) {
    return Promise.resolve(seekerGatewayState.connectNonce);
  }
  return new Promise((resolve, reject) => {
    if (seekerGatewayState.nonceWaiter && !seekerGatewayState.nonceWaiter.done) {
      clearTimeout(seekerGatewayState.nonceWaiter.timeoutId);
      seekerGatewayState.nonceWaiter.done = true;
    }
    const timeoutId = setTimeout(() => {
      if (!seekerGatewayState.nonceWaiter || seekerGatewayState.nonceWaiter.done) return;
      seekerGatewayState.nonceWaiter.done = true;
      seekerGatewayState.nonceWaiter = null;
      reject(new Error('connect challenge timeout'));
    }, timeoutMs);
    seekerGatewayState.nonceWaiter = { resolve, reject, timeoutId, done: false };
  });
}

function seekerHandleGatewayEvent(eventName, payload) {
  if (eventName === 'connect.challenge') {
    const nonce = String(payload?.nonce || '').trim();
    if (nonce) seekerResolveNonce(nonce);
    return;
  }

  if (eventName === 'health' && seekerConnected) {
    const daemon = String(payload?.daemon || payload?.status || 'alive').trim();
    const mode = String(payload?.oodaMode || payload?.mode || '').trim();
    const suffix = mode ? ` · ${mode}` : '';
    updateSeekerUI(true, `Connected to ${seekerGatewayState.serverHost || gatewayDisplayHost(seekerGatewayUrl)}${suffix}`, daemon || 'online');
    renderSeekerConnectionInfo();
  }
}

function seekerHandleSocketMessage(rawText) {
  let frame;
  try {
    frame = JSON.parse(rawText);
  } catch {
    return;
  }

  if (frame.type === 'res' && frame.id) {
    const pending = seekerGatewayState.pending.get(frame.id);
    if (!pending) return;
    seekerGatewayState.pending.delete(frame.id);
    clearTimeout(pending.timeoutId);
    pending.resolve({
      ok: !!frame.ok,
      payload: frame.payload ?? parseGatewayValue(frame.payloadJSON),
      error: frame.error ?? null,
    });
    return;
  }

  if (frame.type === 'event' && frame.event) {
    const payload = frame.payload ?? parseGatewayValue(frame.payloadJSON);
    seekerHandleGatewayEvent(frame.event, payload);
  }
}

function parseGatewayValue(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function seekerRequest(method, params = null, timeoutMs = 15000) {
  if (!seekerSocketIsOpen()) {
    return Promise.reject(new Error('gateway not connected'));
  }

  const id = seekerMakeId();
  const frame = { type: 'req', id, method };
  if (params != null) frame.params = params;

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      seekerGatewayState.pending.delete(id);
      reject(new Error(`${method} timeout`));
    }, timeoutMs);

    seekerGatewayState.pending.set(id, { resolve, reject, timeoutId });
    try {
      seekerGatewayState.socket.send(JSON.stringify(frame));
    } catch (error) {
      clearTimeout(timeoutId);
      seekerGatewayState.pending.delete(id);
      reject(error instanceof Error ? error : new Error('send failed'));
    }
  });
}

function seekerOpenSocket(wsUrl) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      settled = true;
      seekerGatewayState.socket = socket;
      resolve(socket);
    };

    socket.onmessage = (event) => {
      seekerHandleSocketMessage(event.data);
    };

    socket.onerror = () => {
      if (!settled) {
        settled = true;
        reject(new Error('socket connection failed'));
      }
    };

    socket.onclose = (event) => {
      if (!settled) {
        settled = true;
        reject(new Error(event.reason || 'socket closed'));
      }
      const manual = seekerGatewayState.closedByUser;
      seekerGatewayState.socket = null;
      seekerRejectPending(event.reason || 'socket closed');
      if (!manual) {
        updateSeekerUI(false, `Gateway closed: ${event.reason || event.code}`, 'offline');
        renderSeekerConnectionInfo();
      }
    };
  });
}

function seekerApplyConnectResponse(payload) {
  seekerGatewayState.serverHost =
    String(payload?.server?.host || '').trim() || gatewayDisplayHost(seekerGatewayUrl);
  seekerGatewayState.mainSessionKey =
    String(payload?.snapshot?.sessionDefaults?.mainSessionKey || '').trim() || 'main';
  seekerGatewayState.sessionToken = String(payload?.auth?.deviceToken || '').trim();
  seekerGatewayState.authMode = preferredGatewayAuthMode(seekerGatewayAuthMode, seekerGatewayToken);
  updateSeekerUI(true, `Connected to ${seekerGatewayState.serverHost}`, 'online');
  renderSeekerConnectionInfo();
}

async function seekerRefreshStatus() {
  if (!seekerSocketIsOpen()) return;
  try {
    const response = await seekerRequest('health', null, 6000);
    if (!response.ok) {
      throw new Error(response.error?.message || 'health failed');
    }
    seekerHandleGatewayEvent('health', response.payload || {});
  } catch (error) {
    updateSeekerUI(false, `Health failed: ${error.message}`, 'offline');
    renderSeekerConnectionInfo();
    throw error;
  }
}

function seekerParseHistoryPayload(payload) {
  const root = parseGatewayValue(payload);
  const safeRoot = root && typeof root === 'object' ? root : {};
  const messages = Array.isArray(safeRoot.messages) ? safeRoot.messages : [];
  return messages
    .map(message => ({
      role: String(message?.role || '').trim(),
      content: Array.isArray(message?.content) ? message.content : [],
      timestamp: message?.timestamp,
    }))
    .filter(message => message.role);
}

function seekerMessageText(message) {
  const parts = [];
  for (const item of message?.content || []) {
    if (String(item?.type || 'text') !== 'text') continue;
    const text = String(item?.text || '').trim();
    if (text) parts.push(text);
  }
  return parts.join('\n').trim();
}

async function seekerHistorySnapshot(sessionKey) {
  const response = await seekerRequest('chat.history', { sessionKey }, 10000);
  if (!response.ok) {
    throw new Error(response.error?.message || 'chat.history failed');
  }
  const messages = seekerParseHistoryPayload(response.payload);
  const assistants = messages.filter(message => message.role === 'assistant');
  const lastAssistant = assistants.length ? seekerMessageText(assistants[assistants.length - 1]) : '';
  return {
    messages,
    assistantCount: assistants.length,
    lastAssistantText: lastAssistant,
  };
}

async function seekerWaitForAssistantReply(sessionKey, baseline, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const history = await seekerHistorySnapshot(sessionKey);
    if (history.assistantCount > baseline.assistantCount) {
      return history.lastAssistantText || 'Reply received with no visible text.';
    }
    if (history.lastAssistantText && history.lastAssistantText !== baseline.lastAssistantText) {
      return history.lastAssistantText;
    }
    await new Promise(resolve => setTimeout(resolve, 700));
  }
  throw new Error('timed out waiting for gateway reply');
}

async function sendChatSeekerGateway(message) {
  await seekerEnsureConnected();
  const sessionKey = seekerGatewayState.mainSessionKey || 'main';
  const baseline = await seekerHistorySnapshot(sessionKey);
  const requestId = seekerMakeId();
  const response = await seekerRequest(
    'chat.send',
    {
      sessionKey,
      message,
      thinking: 'low',
      timeoutMs: 30000,
      idempotencyKey: requestId,
    },
    30000,
  );
  if (!response.ok) {
    throw new Error(response.error?.message || 'chat.send failed');
  }
  const payload = parseGatewayValue(response.payload);
  const payloadRunId = String(payload?.runId || '').trim();
  const runId = payloadRunId || requestId;
  seekerLog(`Gateway chat run ${shortDisplay(runId, 6, 4)} accepted`);
  return seekerWaitForAssistantReply(sessionKey, baseline, 45000);
}

async function seekerEnsureConnected() {
  if (seekerSocketIsOpen() && seekerConnected) return;
  if (!seekerGatewayUrl) {
    throw new Error('no gateway URL configured');
  }
  if (seekerGatewayState.connectPromise) {
    return seekerGatewayState.connectPromise;
  }

  const wsUrl = deriveGatewayWebSocketUrl(seekerGatewayUrl);
  seekerGatewayState.closedByUser = false;
  seekerGatewayState.connectNonce = '';
  updateSeekerUI(false, `Pairing with ${gatewayDisplayHost(seekerGatewayUrl)}…`, 'pairing', 'pairing');
  renderSeekerConnectionInfo();

  seekerGatewayState.connectPromise = (async () => {
    await seekerOpenSocket(wsUrl);
    const noncePromise = seekerWaitForNonce(2000);
    const nonce = await noncePromise;
    seekerGatewayState.connectNonce = '';
    const connectResponse = await seekerRequest('connect', seekerBuildConnectPayload(nonce), 12000);
    if (!connectResponse.ok) {
      throw new Error(connectResponse.error?.message || 'connect failed');
    }
    seekerApplyConnectResponse(connectResponse.payload || {});
    seekerLog(`Gateway session established over ${wsUrl}`);
    await seekerRefreshStatus();
    if (seekerPollId) clearInterval(seekerPollId);
    seekerPollId = setInterval(() => {
      seekerRefreshStatus().catch(error => seekerLog(`Gateway heartbeat failed: ${error.message}`, 'warn'));
    }, 12000);
  })().catch(error => {
    seekerCloseSocket(`Gateway failed: ${error.message}`);
    seekerLog(`Gateway connect failed: ${error.message}`, 'err');
    throw error;
  }).finally(() => {
    seekerGatewayState.connectPromise = null;
  });

  return seekerGatewayState.connectPromise;
}

async function seekerConnect() {
  const urlInput = document.getElementById('seekerGatewayUrl');
  const tokenInput = document.getElementById('seekerToken');
  const modeInput = document.getElementById('seekerAuthMode');
  const setupInput = document.getElementById('seekerSetupCode');

  const setupRaw = (setupInput?.value || '').trim();
  if (setupRaw) {
    const decoded = decodeConnectImport(setupRaw);
    if (decoded?.error === 'node-identity') {
      seekerLog('Use ~/.solanaos/connect/solanaos-connect.json or setup-code.txt, not ~/.solanaos/node.json', 'warn');
      return;
    }
    if (!decoded) {
      seekerLog('Invalid setup code format', 'err');
      return;
    }
    if (decoded.apiUrl) {
      API = normalizeApi(decoded.apiUrl);
      const apiField = document.getElementById('settingUrl');
      if (apiField) apiField.value = API;
      await setStorage({ nanobotUrl: API });
    }
    seekerGatewayUrl = normalizeGatewayUrl(decoded.gatewayUrl || seekerGatewayUrl);
    seekerGatewayToken = normalizeSecret(decoded.secret);
    seekerGatewayAuthMode = normalizeGatewayAuthMode(decoded.authMode);
    if (urlInput) urlInput.value = seekerGatewayUrl;
    if (tokenInput) tokenInput.value = seekerGatewayToken;
    if (modeInput) modeInput.value = seekerGatewayAuthMode;
    seekerLog(`Imported ${decoded.source === 'bundle' ? 'connect bundle' : 'setup code'}`);
  }

  const manualUrl = (urlInput?.value || '').trim();
  if (manualUrl) {
    seekerGatewayUrl = normalizeGatewayUrl(manualUrl);
  }
  seekerGatewayToken = normalizeSecret(tokenInput?.value || seekerGatewayToken);
  seekerGatewayAuthMode = normalizeGatewayAuthMode(modeInput?.value || seekerGatewayAuthMode);

  if (!seekerGatewayUrl) {
    seekerLog('Enter a gateway URL or paste a setup bundle', 'warn');
    return;
  }

  await setStorage({
    seekerGatewayUrl,
    seekerGatewayToken,
    seekerGatewayAuthMode,
  });

  seekerLog(`Connecting to ${deriveGatewayWebSocketUrl(seekerGatewayUrl)}...`);
  await seekerEnsureConnected();
}

function seekerDisconnect() {
  if (seekerPollId) {
    clearInterval(seekerPollId);
    seekerPollId = null;
  }
  seekerGatewayState.closedByUser = true;
  seekerCloseSocket('Disconnected');
  seekerLog('Gateway session closed');
}

async function seekerPing() {
  if (!seekerGatewayUrl) {
    seekerLog('No gateway URL configured', 'warn');
    return;
  }
  try {
    const start = performance.now();
    await seekerEnsureConnected();
    await seekerRefreshStatus();
    const ms = Math.round(performance.now() - start);
    seekerLog(`Gateway healthy in ${ms}ms`);
  } catch (error) {
    seekerLog(`Ping failed: ${error.message}`, 'err');
  }
}

// Init Seeker on DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
  const settings = await getStorage(['seekerGatewayUrl', 'seekerGatewayToken', 'seekerGatewayAuthMode']);
  seekerGatewayUrl = settings.seekerGatewayUrl ? normalizeGatewayUrl(settings.seekerGatewayUrl) : '';
  seekerGatewayToken = normalizeSecret(settings.seekerGatewayToken);
  seekerGatewayAuthMode = normalizeGatewayAuthMode(settings.seekerGatewayAuthMode);

  const urlInput = document.getElementById('seekerGatewayUrl');
  const tokenInput = document.getElementById('seekerToken');
  const modeInput = document.getElementById('seekerAuthMode');
  if (urlInput && seekerGatewayUrl) urlInput.value = seekerGatewayUrl;
  if (tokenInput && seekerGatewayToken) tokenInput.value = seekerGatewayToken;
  if (modeInput) modeInput.value = seekerGatewayAuthMode;

  document.getElementById('seekerConnectBtn')?.addEventListener('click', seekerConnect);
  document.getElementById('seekerDisconnectBtn')?.addEventListener('click', seekerDisconnect);
  document.getElementById('seekerPingBtn')?.addEventListener('click', seekerPing);

  renderSeekerConnectionInfo();
  if (seekerGatewayUrl) {
    seekerLog(`Restoring gateway connection to ${gatewayDisplayHost(seekerGatewayUrl)}...`);
    seekerEnsureConnected().catch(error => seekerLog(`Gateway restore failed: ${error.message}`, 'warn'));
  }
});
