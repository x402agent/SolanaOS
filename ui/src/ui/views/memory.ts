import { html, nothing } from "lit";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MemoryStatus = {
  vault: { enabled: boolean };
  honcho: { enabled: boolean };
  dreaming: {
    enabled: boolean;
    lastSweepAt?: string;
    lastPromoted?: number;
    lastStaged?: number;
    status?: string;
    diaryEntry?: string;
  };
};

export type MemoryProps = {
  loading: boolean;
  status: MemoryStatus | null;
  error: string | null;
  sweeping: boolean;
  sweepResult: string | null;
  diaryEntry: string | null;
  onRefresh: () => void;
  onSweepNow: () => void;
  onLoadDiary: () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSweepAge(isoTs: string | undefined): string {
  if (!isoTs) return "never";
  const ms = Date.now() - new Date(isoTs).getTime();
  if (ms < 0) return "just now";
  const mins = Math.floor(ms / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

// ── Render ────────────────────────────────────────────────────────────────────

export function renderMemory(props: MemoryProps) {
  const d = props.status?.dreaming;
  const dreamingEnabled = d?.enabled ?? false;

  return html`
    <section class="grid grid-cols-2">

      <!-- ── Vault (local memory) ──────────────────────────────── -->
      <div class="card">
        <div class="card-title">ClawVault</div>
        <div class="card-sub">
          Local markdown knowledge graph — decisions, lessons, trades, research, tasks.
        </div>

        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">Status</div>
            <div class="stat-value">
              ${props.status?.vault.enabled
                ? html`<span class="pill success">active</span>`
                : html`<span class="pill muted">offline</span>`}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">Tiers</div>
            <div class="stat-value mono">known · learned · inferred</div>
          </div>
        </div>

        <div class="card-title" style="margin-top: 20px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em;">
          Categories
        </div>
        <div class="mono muted" style="font-size: 12px; margin-top: 6px; line-height: 1.8;">
          vault/decisions/ &nbsp;— trade decisions with rationale<br />
          vault/lessons/ &nbsp;&nbsp;&nbsp;— promoted long-term insights<br />
          vault/trades/ &nbsp;&nbsp;&nbsp;&nbsp;— outcomes and P&amp;L<br />
          vault/research/ &nbsp;&nbsp;— experiment logs<br />
          vault/tasks/ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;— pending agent tasks<br />
          vault/inbox/ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;— raw incoming observations
        </div>

        <div style="margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
            ${props.loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        ${props.error
          ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`
          : nothing}
      </div>

      <!-- ── Honcho v3 ──────────────────────────────────────────── -->
      <div class="card">
        <div class="card-title">Honcho v3</div>
        <div class="card-sub">
          Cross-session memory with dialectic user modeling — sessions, peers, conclusions, semantic recall.
        </div>

        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">Status</div>
            <div class="stat-value">
              ${props.status?.honcho.enabled
                ? html`<span class="pill success">connected</span>`
                : html`<span class="pill muted">disabled</span>`}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">API</div>
            <div class="stat-value mono">api.honcho.dev</div>
          </div>
        </div>

        <div class="card-title" style="margin-top: 20px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em;">
          Stores
        </div>
        <div class="mono muted" style="font-size: 12px; margin-top: 6px; line-height: 1.8;">
          Sessions &nbsp;&nbsp;&nbsp;— per-chat turn history &amp; summaries<br />
          Peers &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;— user + agent representations<br />
          Conclusions — durable trading preferences &amp; behavior<br />
          Search &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;— semantic recall across all observations
        </div>

        <div class="card-title" style="margin-top: 20px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em;">
          Configuration
        </div>
        <div class="mono muted" style="font-size: 12px; margin-top: 6px; line-height: 1.8;">
          HONCHO_API_KEY=hch-v3-pws0...z4<br />
          HONCHO_WORKSPACE_ID=solanaos<br />
          HONCHO_SESSION_STRATEGY=per-chat<br />
          HONCHO_DIALECTIC_ENABLED=true
        </div>

        <div class="card-title" style="margin-top: 20px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em;">
          Telegram Commands
        </div>
        <div class="mono muted" style="font-size: 12px; margin-top: 6px; line-height: 1.8;">
          /honcho_status &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/honcho_context<br />
          /honcho_sessions &nbsp;&nbsp;&nbsp;/honcho_summaries<br />
          /honcho_search &lt;q&gt; &nbsp;/honcho_conclusions<br />
          /profile &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/card
        </div>
      </div>

      <!-- ── Dreaming ───────────────────────────────────────────── -->
      <div class="card" style="grid-column: 1 / -1;">
        <div class="row" style="justify-content: space-between; align-items: flex-start;">
          <div>
            <div class="card-title">Dreaming</div>
            <div class="card-sub">
              Background memory consolidation — light → REM → deep phases, nightly at 3 AM.
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button
              class="btn"
              ?disabled=${props.sweeping || !dreamingEnabled}
              @click=${props.onSweepNow}
            >
              ${props.sweeping ? "Running sweep…" : "Run sweep now"}
            </button>
            <button class="btn secondary" @click=${props.onLoadDiary}>
              Load diary
            </button>
          </div>
        </div>

        <!-- Status stats -->
        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">Enabled</div>
            <div class="stat-value">
              ${dreamingEnabled
                ? html`<span class="pill success">yes</span>`
                : html`<span class="pill muted">no</span>`}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">Last sweep</div>
            <div class="stat-value">${formatSweepAge(d?.lastSweepAt)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Signals staged</div>
            <div class="stat-value">${d?.lastStaged ?? "—"}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Promoted</div>
            <div class="stat-value">${d?.lastPromoted ?? "—"}</div>
          </div>
        </div>

        ${d?.status
          ? html`<div class="muted" style="font-size: 12px; margin-top: 8px;">${d.status}</div>`
          : nothing}

        <!-- Phase model -->
        <div class="card-title" style="margin-top: 20px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em;">
          Phase model
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px;">
          ${renderPhaseCard("Light", "Scores recent vault signals (48h window), deduplicates, stages candidates.", false)}
          ${renderPhaseCard("REM", "Extracts recurring trading themes and adds recency-decayed reinforcement boosts.", false)}
          ${renderPhaseCard("Deep", "Ranks by 6 weighted signals + phase boosts. Promotes qualifying entries to vault/lessons.", true)}
        </div>

        <!-- Ranking signals -->
        <div class="card-title" style="margin-top: 20px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em;">
          Deep ranking signals
        </div>
        <div style="margin-top: 10px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 16px;">
          ${[
            ["Relevance", "0.30", "Vault quality score"],
            ["Frequency", "0.24", "Recall / link count"],
            ["Trade signal", "0.15", "Tied to trade or PnL"],
            ["Recency", "0.15", "Decay over 24h half-life"],
            ["Diversity", "0.10", "Unique tag contexts"],
            ["Tag richness", "0.06", "Concept-tag density"],
          ].map(
            ([label, weight, desc]) => html`
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <div style="font-size: 12px; font-weight: 600;">${label} <span class="mono muted">${weight}</span></div>
                <div class="muted" style="font-size: 11px;">${desc}</div>
              </div>
            `,
          )}
        </div>

        <!-- Sweep result -->
        ${props.sweepResult
          ? html`
              <div class="callout success" style="margin-top: 16px; white-space: pre-wrap;">
                ${props.sweepResult}
              </div>
            `
          : nothing}

        <!-- Dream diary -->
        ${props.diaryEntry || d?.diaryEntry
          ? html`
              <div class="card-title" style="margin-top: 20px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em;">
                Dream diary
              </div>
              <div
                class="muted"
                style="margin-top: 8px; font-style: italic; font-size: 13px; line-height: 1.6; white-space: pre-wrap; border-left: 2px solid var(--accent, #14F195); padding-left: 12px;"
              >
                ${props.diaryEntry ?? d?.diaryEntry}
              </div>
            `
          : nothing}

        <!-- Config reference -->
        <div class="card-title" style="margin-top: 20px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em;">
          Enable in config.json
        </div>
        <pre class="mono muted" style="font-size: 11px; margin-top: 8px; line-height: 1.6; overflow-x: auto;"
>{
  "dreaming": {
    "enabled": true,
    "schedule": "0 3 * * *",
    "min_score": 0.55,
    "channel": "telegram",
    "chat_id": "YOUR_TELEGRAM_ID"
  }
}</pre>

        <!-- Telegram commands -->
        <div class="card-title" style="margin-top: 20px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em;">
          Telegram commands
        </div>
        <div class="mono muted" style="font-size: 12px; margin-top: 6px; line-height: 1.8;">
          /dreaming &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;— status + last checkpoint<br />
          /dreaming now &nbsp;&nbsp;&nbsp;&nbsp;— run sweep immediately<br />
          /dreaming diary &nbsp;&nbsp;— latest diary entry<br />
          /dreaming help &nbsp;&nbsp;&nbsp;— full command reference<br />
          /dream &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;— vault reflect + inbox promote
        </div>
      </div>

    </section>
  `;
}

function renderPhaseCard(name: string, description: string, writesLessons: boolean) {
  return html`
    <div
      style="
        border: 1px solid var(--border, rgba(255,255,255,0.08));
        border-radius: 8px;
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      "
    >
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-weight: 700; font-size: 13px;">${name}</span>
        ${writesLessons
          ? html`<span class="pill success" style="font-size: 10px;">writes lessons</span>`
          : html`<span class="pill muted" style="font-size: 10px;">read-only</span>`}
      </div>
      <div class="muted" style="font-size: 12px; line-height: 1.5;">${description}</div>
    </div>
  `;
}
