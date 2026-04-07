/* ── SolanaOS Docs — Interactive JS ─────────────────────────────── */

// ── Terminal typing animation ──────────────────────────────────────
const terminalLines = [
  { text: '', delay: 300 },
  { text: '    ███╗   ██╗ █████╗ ███╗   ██╗ ██████╗ ███████╗ ██████╗ ██╗      █████╗ ███╗   ██╗ █████╗', class: 't-green', delay: 30 },
  { text: '    ████╗  ██║██╔══██╗████╗  ██║██╔═══██╗██╔════╝██╔═══██╗██║     ██╔══██╗████╗  ██║██╔══██╗', class: 't-green', delay: 30 },
  { text: '    ██╔██╗ ██║███████║██╔██╗ ██║██║   ██║███████╗██║   ██║██║     ███████║██╔██╗ ██║███████║', class: 't-green', delay: 30 },
  { text: '    ██║╚██╗██║██╔══██║██║╚██╗██║██║   ██║╚════██║██║   ██║██║     ██╔══██║██║╚██╗██║██╔══██║', class: 't-green', delay: 30 },
  { text: '    ██║ ╚████║██║  ██║██║ ╚████║╚██████╔╝███████║╚██████╔╝███████╗██║  ██║██║ ╚████║██║  ██║', class: 't-green', delay: 30 },
  { text: '    ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚══════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝', class: 't-purple', delay: 30 },
  { text: '', delay: 100 },
  { text: '    🖥️ SolanaOS — The Solana Computer', class: 't-teal', delay: 50 },
  { text: '    Powered by SolanaOS Labs · Go Runtime · x402 Protocol', class: 't-amber', delay: 50 },
  { text: '', delay: 200 },
  { text: '[DAEMON] Starting SolanaOS Computer v1.0.0...', class: 't-green', delay: 80 },
  { text: '', delay: 100 },
  { text: '🔑 Agent Wallet', class: 't-teal', delay: 60 },
  { text: '   Address: 7xKXqR8vN2pJm9hB3kQwYzT5nR4tU6sL8jD0cA3vBp', class: 't-dim', delay: 40 },
  { text: '   Balance: 0.142857 SOL', class: 't-green', delay: 40 },
  { text: '', delay: 100 },
  { text: '⛓️  Solana RPC connected (Helius mainnet)', class: 't-green', delay: 60 },
  { text: '   Slot: 312,847,291', class: 't-dim', delay: 40 },
  { text: '', delay: 100 },
  { text: '🖥️ SolanaOS companion layer loaded', class: 't-green', delay: 60 },
  { text: '   Stage: juvenile · Level 3 · XP 1,247', class: 't-dim', delay: 40 },
  { text: '   Mood : 😊 happy · Energy: ⚡⚡⚡⚡⚡⚡⚡⚡', class: 't-dim', delay: 40 },
  { text: '', delay: 100 },
  { text: '🤖 Telegram operator channel connected (ID: 8794389193)', class: 't-purple', delay: 60 },
  { text: '   ✅ 12 bot commands registered', class: 't-dim', delay: 40 },
  { text: '', delay: 100 },
  { text: '💰 x402 payment gateway initialized', class: 't-amber', delay: 60 },
  { text: '   Network:   solana-mainnet', class: 't-dim', delay: 40 },
  { text: '   Recipient: 7xKXqR8...3vBp (agent wallet)', class: 't-dim', delay: 40 },
  { text: '   Price:     0.001 USDC per call', class: 't-dim', delay: 40 },
  { text: '   Paywall:   http://localhost:18402', class: 't-dim', delay: 40 },
  { text: '', delay: 100 },
  { text: '🎛️  Hardware: scanning I2C bus 1...', class: 't-teal', delay: 80 },
  { text: '   0x6C  Pixels    ✓ (8× RGB LED)', class: 't-green', delay: 50 },
  { text: '   0x3C  Buzzer    ✓ (tone generator)', class: 't-green', delay: 50 },
  { text: '   0x7C  Buttons   ✓ (3× push + LED)', class: 't-green', delay: 50 },
  { text: '   0x76  Knob      ✓ (rotary encoder)', class: 't-green', delay: 50 },
  { text: '   0x6A  Movement  ✓ (6-axis IMU)', class: 't-green', delay: 50 },
  { text: '', delay: 100 },
  { text: '💓 Heartbeat loop started (interval: 5m)', class: 't-dim', delay: 60 },
  { text: '', delay: 200 },
  { text: '══════════════════════════════════════════════════════════', class: 't-purple', delay: 30 },
  { text: '  SolanaOS Computer daemon running', class: 't-green', delay: 50 },
  { text: '  Press Ctrl+C to shutdown gracefully', class: 't-dim', delay: 50 },
  { text: '══════════════════════════════════════════════════════════', class: 't-purple', delay: 30 },
  { text: '', delay: 400 },
  { text: '[OODA] Cycle #1 | SOL=$187.42', class: 't-teal', delay: 100 },
  { text: '[OODA] 📡 SIGNAL LONG SOL (strength=0.78 conf=0.65)', class: 't-purple', delay: 80 },
  { text: '[OODA] ⚡ Confidence below threshold (0.65 < 0.70) — skipping', class: 't-amber', delay: 80 },
  { text: '', delay: 300 },
  { text: '[OODA] Cycle #2 | SOL=$188.17', class: 't-teal', delay: 100 },
  { text: '[OODA] 📡 SIGNAL LONG SOL (strength=0.85 conf=0.82)', class: 't-purple', delay: 80 },
  { text: '[OODA] 📈 OPEN LONG SOL at $188.170000 (0.0140 SOL)', class: 't-green', delay: 80 },
];

function runTerminalAnimation() {
  const output = document.getElementById('terminalOutput');
  if (!output) return;

  let lineIndex = 0;
  let totalDelay = 0;

  function addLine(idx) {
    if (idx >= terminalLines.length) {
      // Add blinking cursor at the end
      const cursor = document.createElement('span');
      cursor.className = 'cursor';
      output.appendChild(cursor);
      return;
    }

    const line = terminalLines[idx];
    const span = document.createElement('span');
    span.className = line.class || '';
    span.textContent = line.text + '\n';
    output.appendChild(span);

    // Auto-scroll
    const body = output.parentElement;
    body.scrollTop = body.scrollHeight;

    setTimeout(() => addLine(idx + 1), line.delay);
  }

  // Start after a short delay
  setTimeout(() => addLine(0), 800);
}

// ── Intersection Observer for scroll animations ───────────────────

function initScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
  );

  document.querySelectorAll('[data-animate]').forEach((el) => {
    observer.observe(el);
  });
}

// ── Mobile nav toggle ─────────────────────────────────────────────

function initNavToggle() {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');

  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
    });

    // Close on link click
    links.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        links.classList.remove('open');
      });
    });
  }
}

// ── Nav scroll effect ─────────────────────────────────────────────

function initNavScroll() {
  const nav = document.getElementById('nav');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const current = window.scrollY;
    if (current > 100) {
      nav.style.borderBottomColor = 'rgba(153, 69, 255, 0.2)';
    } else {
      nav.style.borderBottomColor = 'rgba(153, 69, 255, 0.15)';
    }
    lastScroll = current;
  });
}

// ── Smooth active section highlighting ────────────────────────────

function initActiveSection() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach((link) => {
            link.style.color = link.getAttribute('href') === `#${id}` ? '#14F195' : '';
          });
        }
      });
    },
    { threshold: 0.3 }
  );

  sections.forEach((section) => observer.observe(section));
}

// ── Pet stage hover animation ─────────────────────────────────────

function initPetInteractions() {
  const stages = document.querySelectorAll('.pet-stage');
  stages.forEach((stage) => {
    stage.addEventListener('mouseenter', () => {
      stages.forEach((s) => s.classList.remove('active'));
      stage.classList.add('active');
    });
  });
}

// ── Sensor hover glow ─────────────────────────────────────────────

function initSensorEffects() {
  const sensors = document.querySelectorAll('.hw-sensor');
  sensors.forEach((sensor) => {
    sensor.addEventListener('mouseenter', () => {
      const icon = sensor.querySelector('.hw-sensor-icon');
      if (icon) {
        icon.style.transform = 'scale(1.15)';
        icon.style.transition = 'transform 0.3s ease';
      }
    });
    sensor.addEventListener('mouseleave', () => {
      const icon = sensor.querySelector('.hw-sensor-icon');
      if (icon) {
        icon.style.transform = 'scale(1)';
      }
    });
  });
}

// ── Mood cycling animation ────────────────────────────────────────

function initMoodCycle() {
  const moods = document.querySelectorAll('.mood');
  if (moods.length === 0) return;

  let currentIdx = Array.from(moods).findIndex(m => m.classList.contains('active'));
  if (currentIdx < 0) currentIdx = 2;

  setInterval(() => {
    moods.forEach(m => m.classList.remove('active'));
    currentIdx = (currentIdx + 1) % moods.length;
    moods[currentIdx].classList.add('active');
  }, 3000);
}

// ── Copy-to-clipboard buttons ─────────────────────────────────────

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.top = '-9999px';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.focus();
    input.select();

    try {
      const copied = document.execCommand('copy');
      document.body.removeChild(input);
      if (copied) {
        resolve();
      } else {
        reject(new Error('copy command failed'));
      }
    } catch (err) {
      document.body.removeChild(input);
      reject(err);
    }
  });
}

function initCopyButtons() {
  const buttons = document.querySelectorAll('.copy-btn[data-copy]');
  if (buttons.length === 0) return;

  buttons.forEach((button) => {
    const defaultLabel = (button.textContent || 'Copy').trim() || 'Copy';
    let resetTimer;

    button.addEventListener('click', async () => {
      const value = button.getAttribute('data-copy');
      if (!value) return;

      try {
        await copyText(value);
        button.classList.add('copied');
        button.textContent = 'Copied';
      } catch {
        button.classList.remove('copied');
        button.textContent = 'Failed';
      }

      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        button.classList.remove('copied');
        button.textContent = defaultLabel;
      }, 1600);
    });
  });
}

// ── Music Player ──────────────────────────────────────────────────

function initMusicPlayer() {
  const audio = document.getElementById('audioPlayer');
  const playBtn = document.getElementById('playerPlay');
  const iconPlay = playBtn?.querySelector('.icon-play');
  const iconPause = playBtn?.querySelector('.icon-pause');
  const waveform = document.getElementById('playerWaveform');
  const progress = document.getElementById('playerProgress');
  const progressBar = document.getElementById('playerProgressBar');
  const timeEl = document.getElementById('playerTime');
  const durationEl = document.getElementById('playerDuration');
  const volumeSlider = document.getElementById('playerVolume');
  const volBtn = document.getElementById('playerVolBtn');
  const prevBtn = document.getElementById('playerPrev');
  const nextBtn = document.getElementById('playerNext');
  const titleEl = document.getElementById('playerTitle');
  const trackNameEl = document.getElementById('playerTrackName');

  if (!audio || !playBtn) return;

  // ── Playlist ──
  const playlist = [
    {
      src: 'https://pub-9530d10930474af1865d0724e40aab55.r2.dev/solanaos.mp3',
      title: '🖥️ SolanaOS',
      track: 'SolanaOS Theme',
    },
    {
      src: 'https://pub-9530d10930474af1865d0724e40aab55.r2.dev/audio_375681031532668.mp3',
      title: '🖥️ SolanaOS',
      track: 'SeekerClaw',
    },
  ];

  let currentTrack = 0;
  let isMuted = false;
  let lastVolume = 0.6;
  let wasPlaying = false;

  // Set initial volume and load first track
  audio.volume = 0.6;

  function loadTrack(idx) {
    wasPlaying = !audio.paused;
    currentTrack = ((idx % playlist.length) + playlist.length) % playlist.length;
    const t = playlist[currentTrack];
    audio.src = t.src;
    audio.load();
    titleEl.textContent = t.title;
    trackNameEl.textContent = t.track;
    durationEl.textContent = '0:00';
    progressBar.style.width = '0%';
    timeEl.textContent = '0:00';
    if (wasPlaying) {
      audio.play().catch(() => { });
    }
  }

  // Load first track (don't autoplay)
  loadTrack(0);

  function formatTime(sec) {
    if (isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function updatePlayState(playing) {
    if (playing) {
      iconPlay.style.display = 'none';
      iconPause.style.display = 'block';
      waveform?.classList.add('playing');
    } else {
      iconPlay.style.display = 'block';
      iconPause.style.display = 'none';
      waveform?.classList.remove('playing');
    }
  }

  // Play / Pause
  playBtn.addEventListener('click', () => {
    if (audio.paused) {
      audio.play().catch(() => { });
    } else {
      audio.pause();
    }
  });

  audio.addEventListener('play', () => updatePlayState(true));
  audio.addEventListener('pause', () => updatePlayState(false));

  // Auto-advance to next track when current ends
  audio.addEventListener('ended', () => {
    loadTrack(currentTrack + 1);
    audio.play().catch(() => { });
  });

  // Prev / Next
  prevBtn?.addEventListener('click', () => loadTrack(currentTrack - 1));
  nextBtn?.addEventListener('click', () => loadTrack(currentTrack + 1));

  // Time update
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    progressBar.style.width = pct + '%';
    timeEl.textContent = formatTime(audio.currentTime);
  });

  // Duration loaded
  audio.addEventListener('loadedmetadata', () => {
    durationEl.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('durationchange', () => {
    if (audio.duration && isFinite(audio.duration)) {
      durationEl.textContent = formatTime(audio.duration);
    }
  });

  // Seek
  progress?.addEventListener('click', (e) => {
    const rect = progress.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    if (audio.duration) {
      audio.currentTime = pct * audio.duration;
    }
  });

  // Volume slider
  volumeSlider?.addEventListener('input', (e) => {
    const vol = e.target.value / 100;
    audio.volume = vol;
    lastVolume = vol;
    isMuted = vol === 0;
  });

  // Mute toggle
  volBtn?.addEventListener('click', () => {
    if (isMuted) {
      audio.volume = lastVolume || 0.6;
      volumeSlider.value = audio.volume * 100;
      isMuted = false;
    } else {
      lastVolume = audio.volume;
      audio.volume = 0;
      volumeSlider.value = 0;
      isMuted = true;
    }
  });
}

// ── Live Runtime Stats ────────────────────────────────────────────

const LIVE_API_STORAGE_KEY = 'solanaos.liveApiBase';

function liveEl(id) {
  return document.getElementById(id);
}

function normalizeApiBase(value) {
  return (value || '').trim().replace(/\/+$/, '');
}

function setLiveConnection(text, state = '') {
  const pill = liveEl('liveConnection');
  if (!pill) return;
  pill.textContent = text;
  pill.classList.remove('is-live', 'is-warn', 'is-error');
  if (state) {
    pill.classList.add(state);
  }
}

function setText(id, value) {
  const el = liveEl(id);
  if (!el) return;
  el.textContent = value;
}

function formatNumber(value, digits = 4) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  return num.toFixed(digits);
}

function formatInteger(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  return new Intl.NumberFormat().format(num);
}

function formatWhen(value) {
  if (!value) return 'No snapshot yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function shortAddress(value) {
  if (!value || value.length < 12) return value || 'not loaded';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function tradeSummary(trade) {
  const symbol = trade?.symbol || trade?.asset || 'Unknown';
  const direction = (trade?.direction || 'flat').toUpperCase();
  const outcome = trade?.outcome || 'open';
  const pnl = Number(trade?.pnlPct);
  const pnlText = Number.isFinite(pnl) ? `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%` : 'open';
  const openedAt = formatWhen(trade?.openedAt || trade?.closedAt || '');
  const reason = trade?.reason || 'No reason recorded';

  return `
    <li class="live-trade-item">
      <div class="live-trade-top">
        <span class="live-trade-symbol">${symbol}</span>
        <span class="live-trade-side">${direction}</span>
        <span class="live-trade-outcome is-${outcome}">${outcome}</span>
      </div>
      <div class="live-trade-metrics">
        <span>Entry ${formatNumber(trade?.entryPrice || 0, 6)}</span>
        <span>Exit ${formatNumber(trade?.exitPrice || 0, 6)}</span>
        <span>Size ${formatNumber(trade?.sizeSOL || 0, 4)} SOL</span>
        <span>PnL ${pnlText}</span>
      </div>
      <div class="live-trade-meta">
        <span>${openedAt}</span>
        <span>${reason}</span>
      </div>
    </li>
  `;
}

function renderLiveTrades(trades) {
  const list = liveEl('liveTrades');
  const empty = liveEl('liveTradesEmpty');
  if (!list || !empty) return;

  if (!Array.isArray(trades) || trades.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = trades.map(tradeSummary).join('');
}

async function refreshLiveStats() {
  const input = liveEl('liveApiBase');
  const rawBase = normalizeApiBase(input?.value);
  const jsonEl = liveEl('liveJson');

  if (!rawBase) {
    setLiveConnection('Enter a SolanaOS Control API URL', 'is-warn');
    return;
  }

  localStorage.setItem(LIVE_API_STORAGE_KEY, rawBase);
  setLiveConnection('Connecting…');

  try {
    const response = await fetch(`${rawBase}/api/status`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const status = await response.json();
    const updatedAt = status.runtimeUpdatedAt || status.heartbeatUpdatedAt || status.time || '';
    const daemon = status.daemon || status.status || 'unknown';
    const daemonLive = daemon === 'alive';
    const daemonStale = daemon === 'stale';

    setText('liveDaemon', daemon);
    setText('liveMode', status.oodaMode || 'unknown');
    setText('liveWallet', shortAddress(status.walletAddress || status.configuredWalletPubkey || 'not loaded'));
    setText('liveWalletSOL', `${formatNumber(status.walletBalanceSOL || 0, 4)} SOL`);
    setText('liveWatchlist', formatInteger(status.watchlistCount || 0));
    setText('liveCycles', formatInteger(status.cycleCount || 0));
    setText('liveOpenPositions', formatInteger(status.openPositionCount || 0));
    setText('liveClosedTrades', formatInteger(status.closedTradeCount || 0));
    setText('liveUpdatedAt', formatWhen(updatedAt));
    renderLiveTrades(status.recentTrades || []);

    if (jsonEl) {
      jsonEl.textContent = JSON.stringify(status, null, 2);
    }

    if (daemonLive) {
      setLiveConnection('Connected to live daemon', 'is-live');
    } else if (daemonStale) {
      setLiveConnection('Connected, heartbeat stale', 'is-warn');
    } else {
      setLiveConnection('Connected, daemon not active', 'is-warn');
    }
  } catch (error) {
    setText('liveDaemon', 'offline');
    setText('liveUpdatedAt', 'No snapshot yet');
    renderLiveTrades([]);
    if (jsonEl) {
      jsonEl.textContent = JSON.stringify({
        error: error?.message || 'Unable to fetch /api/status',
        hint: 'Start SolanaOS Control with `./build/solanaos nanobot` or the full daemon and keep the API reachable.',
      }, null, 2);
    }
    setLiveConnection('Offline or unreachable', 'is-error');
  }
}

function initLiveStats() {
  const input = liveEl('liveApiBase');
  const refresh = liveEl('liveRefresh');
  if (!input || !refresh) return;

  const savedBase = normalizeApiBase(localStorage.getItem(LIVE_API_STORAGE_KEY));
  if (savedBase) {
    input.value = savedBase;
  }

  const runRefresh = () => {
    refreshLiveStats();
  };

  refresh.addEventListener('click', runRefresh);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      runRefresh();
    }
  });
  input.addEventListener('blur', () => {
    input.value = normalizeApiBase(input.value);
  });

  runRefresh();

  setInterval(() => {
    if (document.visibilityState === 'visible') {
      runRefresh();
    }
  }, 15000);
}

// ── Honcho Memory Demo ────────────────────────────────────────────

const honchoDemoStates = [
  {
    stage: 'Session ingest',
    token: 'BONK',
    prompt: 'User: "Track BONK and WIF for me. I only want spot today and keep size small."',
    summary: 'Session tagged as Solana spot trading with BONK + WIF watchlist and conservative sizing.',
    conclusion: 'Preference inferred: user is risk-off and currently prefers spot over perps.',
    context: 'Injected into next prompt: prioritize BONK/WIF spot setups, avoid perps suggestions, size lightly.',
    session: 'session: tg-spot-bonk-wif',
    peers: 'peers: trader-user + solanaos-agent',
    activeIndex: 0,
  },
  {
    stage: 'Summary rollup',
    token: 'WIF',
    prompt: 'User: "Search that session for WIF scalp ideas and remind me how I sized the last one."',
    summary: 'Short summary refreshed after 12 turns; recent messages emphasize quick scalp setups and low exposure.',
    conclusion: 'Behavior match: user asks for recall before execution, indicating research-first workflow.',
    context: 'Prompt recall adds prior WIF sizing notes, summary window, and matched messages before the bot replies.',
    session: 'session: tg-wif-scalps',
    peers: 'peers: observe_me=true · observe_others=true',
    activeIndex: 1,
  },
  {
    stage: 'Conclusion write',
    token: 'HYPE',
    prompt: 'User: "I will use perps on Hyperliquid, but only for majors and only when conviction is high."',
    summary: 'Trading style updated: spot default, perps allowed selectively for majors under high-confidence conditions.',
    conclusion: 'Conclusion created: perps preference = selective majors only; risk posture = disciplined.',
    context: 'Next Hyperliquid answer includes the selective-perps constraint before showing long or short ideas.',
    session: 'session: tg-hype-perps',
    peers: 'peers: user model + agent model updated',
    activeIndex: 2,
  },
  {
    stage: 'Prompt recall',
    token: 'SOL',
    prompt: 'Bot receives: "What should I do with SOL right now?"',
    summary: 'Context builder fetches recent summary, conclusion hits, and trading metadata from the active session.',
    conclusion: 'Matched conclusion: user prefers small spot positioning unless explicitly requesting perps.',
    context: 'Final prompt contains session summary + conclusion snippets so the answer stays aligned with learned behavior.',
    session: 'session: tg-main-solana',
    peers: 'peers: perspective=user → target=solanaos-agent',
    activeIndex: 3,
  },
];

function setHonchoText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value;
}

function renderHonchoDemo(state) {
  setHonchoText('honchoDemoStage', state.stage);
  setHonchoText('honchoDemoToken', state.token);
  setHonchoText('honchoDemoPrompt', state.prompt);
  setHonchoText('honchoDemoSummary', state.summary);
  setHonchoText('honchoDemoConclusion', state.conclusion);
  setHonchoText('honchoDemoContext', state.context);
  setHonchoText('honchoDemoSession', state.session);
  setHonchoText('honchoDemoPeers', state.peers);

  const cards = document.querySelectorAll('.honcho-demo-card');
  cards.forEach((card, index) => {
    card.classList.toggle('is-active', index === state.activeIndex);
  });
}

function initHonchoDemo() {
  if (!document.getElementById('honchoDemoStage')) return;

  let index = 0;
  renderHonchoDemo(honchoDemoStates[index]);

  setInterval(() => {
    index = (index + 1) % honchoDemoStates.length;
    renderHonchoDemo(honchoDemoStates[index]);
  }, 3200);
}

// ── Init ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  runTerminalAnimation();
  initScrollAnimations();
  initNavToggle();
  initNavScroll();
  initActiveSection();
  initPetInteractions();
  initSensorEffects();
  initMoodCycle();
  initCopyButtons();
  initMusicPlayer();
  initLiveStats();
  initHonchoDemo();
});
