// SolanaOS Chrome Extension — Background Service Worker
// Manages connection state and badge updates

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

function normalizeSecret(value) {
  return String(value || '').trim();
}

function gatewayAuthHeaders(secret) {
  const trimmed = normalizeSecret(secret);
  if (!trimmed) return {};
  return {
    'Authorization': `Bearer ${trimmed}`,
    'X-SolanaOS-Secret': trimmed,
    'X-SolanaOS-Secret': trimmed,
  };
}

async function migrateSettings() {
  return new Promise(resolve => {
    chrome.storage.local.get(['nanobotUrl', 'solanaosGatewaySecret', 'seekerGatewayUrl', 'seekerGatewayToken', 'seekerGatewayAuthMode'], data => {
      const url = normalizeApi(data.nanobotUrl);
      const updates = {
        solanaosGatewaySecret: normalizeSecret(data.solanaosGatewaySecret),
        seekerGatewayToken: normalizeSecret(data.seekerGatewayToken),
        seekerGatewayAuthMode: ['token', 'password'].includes(String(data.seekerGatewayAuthMode || '').trim().toLowerCase())
          ? String(data.seekerGatewayAuthMode).trim().toLowerCase()
          : 'auto',
      };
      if (data.seekerGatewayUrl) {
        updates.seekerGatewayUrl = String(data.seekerGatewayUrl).trim().replace(/\/+$/, '');
      }
      if (url !== data.nanobotUrl) {
        updates.nanobotUrl = url;
      }
      chrome.storage.local.set(updates, resolve);
    });
  });
}

function normalizeApi(url) {
  const value = (url || '').trim();
  if (!value || LEGACY_APIS.has(value)) return DEFAULT_API;
  return value;
}

async function getNanobotUrl() {
  return new Promise(resolve => {
    chrome.storage.local.get(['nanobotUrl', 'solanaosGatewaySecret'], data => {
      const url = normalizeApi(data.nanobotUrl);
      if (url !== data.nanobotUrl) {
        chrome.storage.local.set({ nanobotUrl: url });
      }
      resolve({
        url,
        secret: normalizeSecret(data.solanaosGatewaySecret),
      });
    });
  });
}

async function resolveReachableApi(preferred, secret) {
  const candidates = [];
  if (preferred) candidates.push(preferred);
  for (const api of LOCAL_API_CANDIDATES) {
    if (!candidates.includes(api)) candidates.push(api);
  }

  for (const api of candidates) {
    try {
      const r = await fetch(api + '/api/status', {
        signal: AbortSignal.timeout(1200),
        headers: gatewayAuthHeaders(secret),
      });
      if (r.ok || r.status === 401) {
        if (api !== preferred) {
          chrome.storage.local.set({ nanobotUrl: api });
        }
        return api;
      }
    } catch {}
  }

  return preferred || DEFAULT_API;
}

// Check server status periodically
async function checkStatus() {
  const { url: savedApi, secret } = await getNanobotUrl();
  const SOLANAOS_API = await resolveReachableApi(savedApi, secret);
  try {
    const r = await fetch(SOLANAOS_API + '/api/status', {
      signal: AbortSignal.timeout(3000),
      headers: gatewayAuthHeaders(secret),
    });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const d = await r.json();
    const badge = deriveBadge(d);
    chrome.action.setBadgeText({ text: badge.text });
    chrome.action.setBadgeBackgroundColor({ color: badge.color });
    
    // Store status for popup
    chrome.storage.local.set({ 
      nanobotOnline: true, 
      lastStatus: d,
      lastCheck: Date.now() 
    });
  } catch {
    chrome.action.setBadgeText({ text: '' });
    chrome.storage.local.set({ 
      nanobotOnline: false, 
      lastCheck: Date.now() 
    });
  }
}

function deriveBadge(status) {
  if (!status) return { text: '', color: '#14F195' };
  if (status.daemon === 'stale') return { text: '!', color: '#f59e0b' };
  if (status.oodaMode === 'live') return { text: 'L', color: '#14F195' };
  if (status.oodaMode === 'simulated') return { text: 'S', color: '#9945FF' };
  if (status.daemon === 'alive') return { text: '●', color: '#14F195' };
  return { text: 'N', color: '#00D1FF' };
}

// Check every 30 seconds
chrome.alarms.create('solanaos-status', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'solanaos-status') checkStatus();
});

// Check on install/startup
chrome.runtime.onInstalled.addListener(() => {
  migrateSettings().then(checkStatus);
});
chrome.runtime.onStartup.addListener(() => {
  migrateSettings().then(checkStatus);
});

// Also migrate immediately when the service worker loads.
migrateSettings().then(checkStatus);

// Handle messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CHECK_STATUS') {
    checkStatus().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'GET_SETTINGS') {
    chrome.storage.local.get([
      'heliusApiKey',
      'nanobotUrl',
      'network',
      'solanaosGatewaySecret',
      'seekerGatewayUrl',
      'seekerGatewayToken',
      'seekerGatewayAuthMode',
    ], (data) => {
      sendResponse(data);
    });
    return true;
  }
  if (msg.type === 'SAVE_SETTINGS') {
    chrome.storage.local.set(msg.data, () => sendResponse({ ok: true }));
    return true;
  }
});
