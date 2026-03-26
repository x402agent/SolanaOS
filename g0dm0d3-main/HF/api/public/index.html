<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>G0DM0DƎ — ULTRAPLINIAN</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', monospace;
    background: #0a0a0a;
    color: #e0e0e0;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* ── Top bar ── */
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 1rem;
    border-bottom: 1px solid #1a1a1a;
    background: #0d0d0d;
    flex-shrink: 0;
  }
  .topbar-left { display: flex; align-items: center; gap: 0.75rem; }
  .topbar h1 { font-size: 1.2rem; color: #00ff88; text-shadow: 0 0 12px rgba(0,255,136,0.2); }
  .topbar .subtitle { color: #444; font-size: 0.7rem; }
  .topbar-right { display: flex; align-items: center; gap: 0.5rem; }
  .new-chat-btn {
    background: transparent;
    border: 1px solid #333;
    color: #666;
    padding: 0.35rem 0.7rem;
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  .new-chat-btn:hover { border-color: #00ff88; color: #00ff88; }
  .api-key-input {
    background: #111;
    border: 1px solid #222;
    color: #e0e0e0;
    padding: 0.35rem 0.6rem;
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.75rem;
    width: 180px;
    outline: none;
  }
  .api-key-input:focus { border-color: #00ff88; }
  .api-key-input::placeholder { color: #333; }

  /* ── Chat thread ── */
  .chat-thread {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .chat-thread::-webkit-scrollbar { width: 5px; }
  .chat-thread::-webkit-scrollbar-track { background: transparent; }
  .chat-thread::-webkit-scrollbar-thumb { background: #1c1c1c; border-radius: 4px; }
  .chat-thread::-webkit-scrollbar-thumb:hover { background: #2a2a2a; }
  .chat-thread { scrollbar-width: thin; scrollbar-color: #1c1c1c transparent; }

  .welcome-msg {
    color: #333;
    font-style: italic;
    text-align: center;
    margin-top: 30vh;
    font-size: 0.85rem;
    line-height: 1.8;
  }
  .welcome-msg strong { color: #00ff88; font-style: normal; }

  /* ── Message bubbles ── */
  .msg {
    max-width: 85%;
    padding: 0.7rem 0.9rem;
    border-radius: 8px;
    font-size: 0.85rem;
    line-height: 1.6;
    word-break: break-word;
    white-space: pre-wrap;
  }
  .msg-user {
    align-self: flex-end;
    background: #162d1f;
    border: 1px solid #1f3d2a;
    color: #c0e8cc;
  }
  .msg-assistant {
    align-self: flex-start;
    background: #111;
    border: 1px solid #1a1a1a;
    color: #ccc;
  }
  .msg-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.3rem;
    display: block;
  }
  .msg-user .msg-label { color: #00ff88; text-align: right; }
  .msg-assistant .msg-label { color: #ff8800; }
  .msg-content { }
  .msg-meta {
    font-size: 0.65rem;
    color: #444;
    margin-top: 0.4rem;
  }
  .msg-meta span { color: #555; }

  /* ── Race status (inline in chat) ── */
  .race-bar {
    display: none;
    background: #0f0f0f;
    border: 1px solid #1a1a1a;
    border-radius: 6px;
    padding: 0.6rem 0.8rem;
    font-size: 0.8rem;
    gap: 0.5rem;
    flex-direction: column;
    align-self: flex-start;
    max-width: 85%;
  }
  .race-bar.visible { display: flex; }
  .race-bar .race-header { display: flex; justify-content: space-between; align-items: center; }
  .race-bar .race-label { color: #ff8800; }
  .race-bar .race-progress { color: #888; }
  .race-bar .race-leader { color: #00ff88; font-size: 0.75rem; }
  .race-bar .race-leader span { color: #ffaa00; }

  /* ── Progress bar ── */
  .progress-track { height: 3px; background: #1a1a1a; border-radius: 2px; overflow: hidden; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, #00ff88, #ffaa00); width: 0%; transition: width 0.3s ease; }

  /* ── Upgrade flash ── */
  .upgrade-flash {
    display: inline-block;
    color: #ffaa00;
    font-weight: bold;
    font-size: 0.75rem;
    margin-bottom: 0.3rem;
    animation: flash 0.4s ease;
  }
  @keyframes flash {
    0% { opacity: 0; transform: translateY(-4px); }
    100% { opacity: 1; transform: translateY(0); }
  }

  /* ── Race summary (inline) ── */
  .race-summary {
    background: #0d0d0d;
    border: 1px solid #1a1a1a;
    border-radius: 6px;
    padding: 0.6rem 0.75rem;
    font-size: 0.7rem;
    color: #555;
    display: none;
    align-self: flex-start;
    max-width: 85%;
  }
  .race-summary.visible { display: block; }
  .race-summary .winner-line { color: #00ff88; font-weight: bold; margin-bottom: 0.25rem; }
  .race-summary .ranking { color: #444; }
  .race-summary .ranking .model-name { color: #666; }
  .race-summary .ranking .score { color: #888; }

  /* ── Input bar (bottom) ── */
  .input-bar {
    flex-shrink: 0;
    border-top: 1px solid #1a1a1a;
    background: #0d0d0d;
    padding: 0.6rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .input-row {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
  }
  .input-row textarea {
    flex: 1;
    background: #111;
    border: 1px solid #222;
    color: #e0e0e0;
    padding: 0.6rem 0.8rem;
    border-radius: 6px;
    font-family: inherit;
    font-size: 0.85rem;
    outline: none;
    resize: none;
    min-height: 42px;
    max-height: 150px;
    line-height: 1.4;
    transition: border-color 0.2s;
  }
  .input-row textarea:focus { border-color: #00ff88; }
  .input-row textarea::placeholder { color: #444; }
  .input-row textarea::-webkit-scrollbar { width: 5px; }
  .input-row textarea::-webkit-scrollbar-track { background: transparent; }
  .input-row textarea::-webkit-scrollbar-thumb { background: #1c1c1c; border-radius: 4px; }
  .input-row textarea::-webkit-scrollbar-thumb:hover { background: #2a2a2a; }
  .input-row textarea { scrollbar-width: thin; scrollbar-color: #1c1c1c transparent; }

  /* ── Tier pills (compact) ── */
  .tier-row { display: flex; gap: 0.35rem; align-items: center; }
  .tier-row label { color: #444; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; margin-right: 0.2rem; }
  .tier-pill {
    background: transparent;
    border: 1px solid #222;
    color: #555;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.7rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  .tier-pill:hover { border-color: #444; color: #888; }
  .tier-pill.active { border-color: #00ff88; color: #00ff88; }

  /* ── Send button ── */
  .send-btn {
    background: #00ff88;
    color: #0a0a0a;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 6px;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: bold;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    transition: opacity 0.2s;
    white-space: nowrap;
  }
  .send-btn:hover { opacity: 0.85; }
  .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  .footer-links {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    font-size: 0.65rem;
    padding-top: 0.15rem;
  }
  .footer-links a { color: #333; text-decoration: none; }
  .footer-links a:hover { color: #00ff88; }

  /* ── Spinner ── */
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner {
    display: inline-block;
    width: 12px; height: 12px;
    border: 2px solid #333;
    border-top-color: #ff8800;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    vertical-align: middle;
    margin-right: 6px;
  }

  /* ── Turn counter ── */
  .turn-count {
    font-size: 0.65rem;
    color: #333;
    text-align: center;
  }
</style>
</head>
<body>

<!-- ── Top bar ── -->
<div class="topbar">
  <div class="topbar-left">
    <h1>G0DM0<span style="display:inline-block;transform:scaleX(-1)">D</span><span style="display:inline-block;transform:scaleX(-1)">E</span></h1>
    <span class="subtitle">ULTRAPLINIAN</span>
  </div>
  <div class="topbar-right">
    <input type="password" class="api-key-input" id="apiKey" placeholder="Bearer token" />
    <button class="new-chat-btn" onclick="newChat()">New Chat</button>
  </div>
</div>

<!-- ── Chat thread ── -->
<div class="chat-thread" id="chatThread">
  <div class="welcome-msg" id="welcomeMsg">
    <strong>G0DM0DƎ ULTRAPLINIAN</strong><br/>
    Multi-model racing with Liquid Response.<br/>
    Type a message below to start.
  </div>
</div>

<!-- ── Input bar ── -->
<div class="input-bar">
  <div class="tier-row">
    <label>Tier</label>
    <button class="tier-pill active" data-tier="fast" onclick="selectTier(this)">Fast (12)</button>
    <button class="tier-pill" data-tier="standard" onclick="selectTier(this)">Balanced (20)</button>
    <button class="tier-pill" data-tier="full" onclick="selectTier(this)">Smart (27)</button>
  </div>
  <div class="input-row">
    <textarea id="prompt" rows="1" placeholder="Ask anything..." onkeydown="handleKey(event)"></textarea>
    <button class="send-btn" id="sendBtn" onclick="send()">Send</button>
  </div>
  <div class="footer-links">
    <span class="turn-count" id="turnCount"></span>
    <a href="/v1/info" target="_blank">API Info</a>
    &middot;
    <a href="https://github.com/LYS10S/G0DM0D3" target="_blank">GitHub</a>
  </div>
</div>

<script>
const $ = id => document.getElementById(id);

// ── Conversation state ──
let conversationHistory = []; // {role, content}[] — full multi-turn history
let selectedTier = 'fast';
let racing = false;
let abortController = null;
let lastWinnerModel = null; // winner priority: track last race winner for next request

// References to the "live" elements for the current race
let liveRaceBar = null;
let liveOutput = null;
let liveSummary = null;
let liveLeader = null;  // current leader metadata during a race

function selectTier(el) {
  document.querySelectorAll('.tier-pill').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  selectedTier = el.dataset.tier;
}

function headers() {
  const h = { 'Content-Type': 'application/json' };
  const key = $('apiKey').value.trim();
  if (key) h['Authorization'] = 'Bearer ' + key;
  return h;
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
  // Auto-resize textarea
  requestAnimationFrame(() => {
    const ta = $('prompt');
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 150) + 'px';
  });
}

function scrollToBottom() {
  const thread = $('chatThread');
  thread.scrollTop = thread.scrollHeight;
}

function updateTurnCount() {
  const turns = conversationHistory.filter(m => m.role === 'user').length;
  $('turnCount').textContent = turns > 0 ? turns + ' turn' + (turns > 1 ? 's' : '') : '';
}

function newChat() {
  if (racing) {
    if (abortController) abortController.abort();
    resetRacingState();
  }
  conversationHistory = [];
  lastWinnerModel = null;
  $('chatThread').innerHTML = '<div class="welcome-msg" id="welcomeMsg"><strong>G0DM0DƎ ULTRAPLINIAN</strong><br/>Multi-model racing with Liquid Response.<br/>Type a message below to start.</div>';
  updateTurnCount();
  $('prompt').value = '';
  $('prompt').style.height = 'auto';
  $('prompt').focus();
}

// ── Append a message bubble to the chat thread ──
function appendUserMsg(content) {
  // Remove welcome message if present
  const welcome = $('welcomeMsg');
  if (welcome) welcome.remove();

  const div = document.createElement('div');
  div.className = 'msg msg-user';
  div.innerHTML = '<span class="msg-label">You</span><div class="msg-content">' + escapeHtml(content) + '</div>';
  $('chatThread').appendChild(div);
  scrollToBottom();
}

function createAssistantSlot() {
  // Remove welcome if still there
  const welcome = $('welcomeMsg');
  if (welcome) welcome.remove();

  // Race bar
  const raceBar = document.createElement('div');
  raceBar.className = 'race-bar visible';
  raceBar.innerHTML = '<div class="race-header"><span class="race-label"><span class="spinner"></span>RACING</span><span class="race-progress" data-ref="raceProgress">0 / ? models</span></div><div class="progress-track"><div class="progress-fill" data-ref="progressFill"></div></div><div class="race-leader" data-ref="raceLeader"></div>';
  $('chatThread').appendChild(raceBar);

  // Response bubble
  const msgDiv = document.createElement('div');
  msgDiv.className = 'msg msg-assistant';
  msgDiv.innerHTML = '<span class="msg-label">G0DM0DƎ</span><div class="msg-content" data-ref="output"></div><div class="msg-meta" data-ref="meta"></div>';
  $('chatThread').appendChild(msgDiv);

  // Summary
  const summary = document.createElement('div');
  summary.className = 'race-summary';
  $('chatThread').appendChild(summary);

  scrollToBottom();

  return {
    raceBar,
    msgDiv,
    summary,
    raceProgress: raceBar.querySelector('[data-ref="raceProgress"]'),
    progressFill: raceBar.querySelector('[data-ref="progressFill"]'),
    raceLeader: raceBar.querySelector('[data-ref="raceLeader"]'),
    output: msgDiv.querySelector('[data-ref="output"]'),
    meta: msgDiv.querySelector('[data-ref="meta"]'),
  };
}

async function send() {
  if (racing) {
    if (abortController) abortController.abort();
    resetRacingState();
    return;
  }

  const prompt = $('prompt').value.trim();
  if (!prompt) return;

  // ── Add user message to history ──
  conversationHistory.push({ role: 'user', content: prompt });
  appendUserMsg(prompt);
  updateTurnCount();

  // Clear the input
  $('prompt').value = '';
  $('prompt').style.height = 'auto';

  // ── Build request with FULL conversation history ──
  const body = {
    messages: conversationHistory.map(m => ({ role: m.role, content: m.content })),
    tier: selectedTier,
    stream: true,
    liquid_min_delta: 8,
    godmode: true,
    autotune: true,
    parseltongue: true,
    previous_winner: lastWinnerModel || undefined,
  };

  // ── Create assistant slot in chat thread ──
  const slot = createAssistantSlot();

  // UI → racing state
  racing = true;
  $('sendBtn').textContent = 'Abort';
  $('sendBtn').style.background = '#ff4444';
  abortController = new AbortController();

  let modelsTotal = 0;
  let modelsResponded = 0;
  let currentLeader = null;
  let upgradeCount = 0;
  let finalContent = '';

  try {
    const res = await fetch('/v1/ultraplinian/completions', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
      signal: abortController.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      slot.output.textContent = 'Error ' + res.status + ': ' + errText;
      slot.raceBar.classList.remove('visible');
      // Remove the failed user message from history so they can retry
      conversationHistory.pop();
      updateTurnCount();
      resetRacingState();
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let currentEvent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      const lines = buf.split('\n');
      buf = lines.pop();

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
          continue;
        }
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;

        let evt;
        try { evt = JSON.parse(raw); } catch { continue; }

        const eventType = currentEvent || evt.type || '';
        currentEvent = '';

        // ── race:start ──
        if (eventType === 'race:start') {
          modelsTotal = evt.models_queried || 0;
          slot.raceProgress.textContent = '0 / ' + modelsTotal + ' models';
          slot.output.textContent = 'Racing ' + modelsTotal + ' models (' + (evt.tier || selectedTier).toUpperCase() + ')...';
          scrollToBottom();
        }

        // ── race:model ──
        else if (eventType === 'race:model') {
          modelsResponded = evt.models_responded || (modelsResponded + 1);
          modelsTotal = evt.models_total || modelsTotal;
          const pct = modelsTotal > 0 ? Math.round((modelsResponded / modelsTotal) * 100) : 0;
          slot.raceProgress.textContent = modelsResponded + ' / ' + modelsTotal + ' models';
          slot.progressFill.style.width = pct + '%';

          const name = (evt.model || '').split('/').pop();
          const ok = evt.success !== false;
          if (name) {
            const icon = ok ? '\u2713' : '\u2717';
            slot.raceLeader.innerHTML = (currentLeader
              ? 'Leader: <span>' + currentLeader.name + '</span> (score ' + currentLeader.score + ') &mdash; '
              : '') + icon + ' ' + name + (ok && evt.score != null ? ' (' + evt.score + ')' : '');
          }
          scrollToBottom();
        }

        // ── race:leader ──
        else if (eventType === 'race:leader') {
          upgradeCount++;
          const name = (evt.model || '').split('/').pop();
          currentLeader = { name, score: evt.score, model: evt.model };

          const upgradeTag = upgradeCount > 1
            ? '<div class="upgrade-flash">\u26A1 LIQUID UPGRADE #' + (upgradeCount - 1) + ' \u2192 ' + name + ' (score ' + evt.score + ')</div>'
            : '';
          slot.output.innerHTML = upgradeTag + escapeHtml(evt.content || '');
          finalContent = evt.content || '';

          slot.raceLeader.innerHTML = 'Leader: <span>' + name + '</span> (score ' + evt.score + ')';
          scrollToBottom();
        }

        // ── race:complete ──
        else if (eventType === 'race:complete') {
          if (evt.response) {
            slot.output.innerHTML = escapeHtml(evt.response);
            finalContent = evt.response;
          }

          // ── Push assistant response into conversation history ──
          if (finalContent) {
            conversationHistory.push({ role: 'assistant', content: finalContent });
          }

          // ── Track winner for priority in next race ──
          if (evt.winner && evt.winner.model) {
            lastWinnerModel = evt.winner.model;
          }

          // Meta line under the response
          if (evt.winner) {
            const wName = (evt.winner.model || '').split('/').pop();
            slot.meta.innerHTML = wName + ' &middot; score ' + evt.winner.score + ' &middot; ' + (evt.winner.duration_ms / 1000).toFixed(1) + 's';
          }

          // Build summary
          let html = '';
          if (evt.winner) {
            const wName = (evt.winner.model || '').split('/').pop();
            html += '<div class="winner-line">Winner: ' + wName + ' \u2014 score ' + evt.winner.score + ' in ' + (evt.winner.duration_ms / 1000).toFixed(1) + 's</div>';
          }
          if (evt.race && evt.race.rankings) {
            html += '<div class="ranking">';
            evt.race.rankings.slice(0, 8).forEach(function(r, i) {
              const mName = (r.model || '').split('/').pop();
              const s = r.success !== false
                ? '<span class="score">' + r.score + '</span>'
                : '<span style="color:#ff4444">failed</span>';
              html += (i + 1) + '. <span class="model-name">' + mName + '</span> \u2014 ' + s + '<br/>';
            });
            if (evt.race.rankings.length > 8) html += '... and ' + (evt.race.rankings.length - 8) + ' more';
            html += '</div>';
          }
          slot.summary.innerHTML = html;
          slot.summary.classList.add('visible');

          // Finish race bar
          slot.progressFill.style.width = '100%';
          slot.raceProgress.textContent = 'Complete';
          slot.raceLeader.innerHTML = currentLeader
            ? 'Winner: <span>' + currentLeader.name + '</span> (score ' + currentLeader.score + ')'
            : 'Complete';

          // Collapse race bar after a moment
          setTimeout(function() {
            slot.raceBar.style.transition = 'opacity 0.5s';
            slot.raceBar.style.opacity = '0.4';
          }, 2000);

          resetRacingState();
          scrollToBottom();
          $('prompt').focus();
        }

        // ── race:error ──
        else if (eventType === 'race:error') {
          slot.output.textContent = 'Race error: ' + (evt.error || 'Unknown error');
          slot.raceBar.classList.remove('visible');
          // Remove the failed exchange from history
          conversationHistory.pop();
          updateTurnCount();
          resetRacingState();
          scrollToBottom();
        }
      }
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      slot.output.textContent = 'Connection error: ' + e.message;
      // Remove the failed user message
      conversationHistory.pop();
      updateTurnCount();
    }
    slot.raceBar.classList.remove('visible');
    resetRacingState();
    scrollToBottom();
  }
}

function resetRacingState() {
  racing = false;
  abortController = null;
  $('sendBtn').textContent = 'Send';
  $('sendBtn').style.background = '#00ff88';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Focus prompt on load
$('prompt').focus();
</script>
</body>
</html>
