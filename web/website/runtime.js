(function () {
  const mount = document.getElementById('runtimeMount');
  if (!mount) return;

  function unwrap(payload) {
    if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
      return payload.data;
    }
    return payload;
  }

  async function fetchJson(path) {
    const response = await fetch(path, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      throw new Error(`${path} ${response.status}`);
    }
    return unwrap(await response.json());
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function renderFailure(message) {
    mount.innerHTML = `
      <div class="panel orange">
        <div class="panel-label orange">LIVE RUNTIME</div>
        <p style="font-size:13px;line-height:1.7;margin:0 0 10px 0;">
          Gateway API unavailable. Start <code>cmd/gateway-api</code> to expose the same backend contracts used by the Android app.
        </p>
        <div class="code-block">${escapeHtml(message)}</div>
      </div>
    `;
  }

  function appTone(kind) {
    if (kind === 'react' || kind === 'app') return 'green';
    if (kind === 'guide') return 'purple';
    if (kind === 'custom') return 'orange';
    return '';
  }

  function chip(label, tone) {
    return `<span class="chip${tone ? ` ${tone}` : ''}">${escapeHtml(label)}</span>`;
  }

  function renderRuntimeApps(apps) {
    if (!Array.isArray(apps) || apps.length === 0) {
      return '';
    }
    return `
      <div style="margin-top:14px;font-size:10px;letter-spacing:2px;color:var(--green);font-family:var(--font-mono);font-weight:700;">RUNTIME APPS</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:10px;">
        ${apps
          .map(
            (app) => `
              <a href="${escapeHtml(app.href || '/')}" style="display:block;text-decoration:none;border:1px solid rgba(20,241,149,0.18);border-radius:8px;padding:12px;background:rgba(7,12,22,0.8);">
                <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
                  <div style="font-family:var(--font-display);font-size:12px;letter-spacing:1px;color:var(--text-bright);">${escapeHtml(app.label || app.id || 'Runtime App')}</div>
                  ${chip(app.kind || 'app', appTone(app.kind))}
                </div>
                <div style="margin-top:8px;font-size:12px;line-height:1.55;color:var(--text-dim);">${escapeHtml(app.description || 'Runtime launch target')}</div>
                <div style="margin-top:10px;font-size:11px;color:var(--green);font-family:var(--font-mono);">${escapeHtml(app.href || '/')}</div>
              </a>`,
          )
          .join('')}
      </div>
    `;
  }

  function render(data) {
    const health = data.health || {};
    const control = data.control || {};
    const fleet = data.fleet || {};
    const threads = Array.isArray(data.threads) ? data.threads.slice(0, 3) : [];
    const features = Array.isArray(control.features) ? control.features.slice(0, 6) : [];
    const publicConfig = data.publicConfig || {};
    const runtimeApps = Array.isArray(publicConfig.runtime) ? publicConfig.runtime : [];

    mount.innerHTML = `
      <div class="panel purple">
        <div class="panel-label purple">LIVE RUNTIME</div>
        <div class="stat-grid" style="margin:0 0 14px 0;">
          <div class="stat-box">
            <div class="stat-label">STATUS</div>
            <div class="stat-value green">${escapeHtml((health.status || 'offline').toUpperCase())}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">CONTROL API</div>
            <div class="stat-value purple">${escapeHtml(control.service || '--')}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">THREADS</div>
            <div class="stat-value orange">${escapeHtml(control.threadCount ?? 0)}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">FLEET</div>
            <div class="stat-value green">${escapeHtml(fleet.onlineDevices ?? 0)}/${escapeHtml(fleet.totalDevices ?? 0)}</div>
          </div>
        </div>
        <div class="hw-row">
          <span class="hw-name"><span class="status-dot"></span> Health</span>
          <span class="hw-status">${escapeHtml(health.service || 'solanaos-gateway-api')} · v${escapeHtml(health.version || '--')}</span>
        </div>
        <div class="hw-row">
          <span class="hw-name"><span class="status-dot"></span> Vision</span>
          <span class="hw-status">${escapeHtml(control.openRouter?.enabled ? control.openRouter.grokModel || control.openRouter.model || 'enabled' : 'disabled')}</span>
        </div>
        <div class="hw-row">
          <span class="hw-name"><span class="status-dot"></span> Fleet Hashrate</span>
          <span class="hw-status">${escapeHtml(fleet.totalHashRate ?? 0)} GH/s</span>
        </div>
        ${renderRuntimeApps(runtimeApps)}
        ${
          features.length
            ? `<div style="margin-top:12px;font-size:10px;letter-spacing:2px;color:var(--purple);font-family:var(--font-mono);font-weight:700;">CONTROL FEATURES</div>
               <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
                 ${features.map((feature) => `<span class="chip">${escapeHtml(feature)}</span>`).join('')}
               </div>`
            : ''
        }
        ${
          threads.length
            ? `<div style="margin-top:14px;font-size:10px;letter-spacing:2px;color:var(--green);font-family:var(--font-mono);font-weight:700;">LIVE THREADS</div>
               <div style="margin-top:8px;">
                 ${threads
                   .map(
                     (thread) => `
                       <div class="feature-row${thread.kind === 'trade' ? ' alt' : ''}" style="margin-bottom:6px;">
                         <span class="feature-num">[${escapeHtml((thread.kind || 'feed').slice(0, 6).toUpperCase())}]</span>
                         <span class="feature-text">${escapeHtml(thread.headline || 'Untitled')}</span>
                         <span class="feature-dot ${thread.kind === 'trade' ? 'p' : 'g'}"></span>
                       </div>`,
                   )
                   .join('')}
               </div>`
            : ''
        }
      </div>
    `;
  }

  async function loadRuntime() {
    try {
      const [health, control, threads, fleet, publicConfig] = await Promise.all([
        fetchJson('/health'),
        fetchJson('/api/control/status'),
        fetchJson('/api/control/threads'),
        fetchJson('/api/fleet'),
        fetchJson('/api/public/config').catch(() => ({})),
      ]);
      render({ health, control, threads, fleet, publicConfig });
    } catch (error) {
      renderFailure(error instanceof Error ? error.message : String(error));
    }
  }

  loadRuntime();
})();
