import { useEffect, useMemo, useRef, useState } from "react";
import { IntegratedTerminal, ModalTerminal, Swap, WidgetTerminal } from "jupiverse-kit";
import { UnifiedWalletButton, useWallet } from "@jup-ag/wallet-adapter";
import { toast } from "sonner";

const T = {
  bg: "#05070D",
  surface: "#0C0F1A",
  surfaceStrong: "#111525",
  border: "rgba(20,241,149,0.12)",
  borderStrong: "rgba(20,241,149,0.22)",
  green: "#14F195",
  purple: "#9945FF",
  orange: "#FF7400",
  danger: "#FF4444",
  greenSoft: "rgba(20,241,149,0.08)",
  purpleSoft: "rgba(153,69,255,0.08)",
  orangeSoft: "rgba(255,116,0,0.08)",
  dangerSoft: "rgba(255,68,68,0.08)",
  text: "#E8EDF5",
  textSec: "#8B95A8",
  textTert: "#4A5568",
  codeBg: "#080B14",
  mono: "'Share Tech Mono', monospace",
  display: "'Orbitron', sans-serif",
};

const TABS = [
  { id: "connect", icon: "✓", label: "Connect" },
  { id: "solana", icon: "✦", label: "Solana" },
  { id: "grok", icon: "⌕", label: "Grok" },
  { id: "chat", icon: "◌", label: "Chat" },
  { id: "arcade", icon: "◈", label: "Arcade" },
  { id: "voice", icon: "◉", label: "Voice" },
  { id: "ore", icon: "⚒", label: "ORE" },
  { id: "screen", icon: "▣", label: "Screen" },
  { id: "settings", icon: "⚙", label: "Settings" },
];

const JUPITER_VIEW_MODES = [
  { id: "integrated", label: "Integrated" },
  { id: "swap", label: "Swap" },
  { id: "modal", label: "Modal" },
  { id: "widget", label: "Widget" },
];

function Bot({ c = "#FF7400", c2 = "#FF8C2A", eye = "#1a1a2e", sz = 48, happy, className = "" }) {
  return (
    <svg width={sz} height={sz * 1.08} viewBox="0 0 60 65" className={className}>
      <rect x="10" y="10" width="40" height="36" rx="4" fill={c} />
      <rect x="12" y="12" width="36" height="32" rx="3" fill={c2} />
      {happy ? (
        <>
          <path d="M18,22L24,26L18,30" fill="none" stroke={eye} strokeWidth="2" strokeLinecap="round" />
          <path d="M42,22L36,26L42,30" fill="none" stroke={eye} strokeWidth="2" strokeLinecap="round" />
          <path d="M22,35Q30,40 38,35" fill="none" stroke={eye} strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <polygon points="18,22 24,26 18,30" fill={eye} />
          <polygon points="42,22 36,26 42,30" fill={eye} />
          <rect x="24" y="34" width="12" height="2" rx="1" fill={eye} opacity="0.4" />
        </>
      )}
      <rect x="2" y="24" width="10" height="8" rx="3" fill={c} />
      <rect x="48" y="24" width="10" height="8" rx="3" fill={c} />
      <rect x="16" y="46" width="10" height="12" rx="3" fill={c} />
      <rect x="34" y="46" width="10" height="12" rx="3" fill={c} />
      <rect x="14" y="54" width="14" height="6" rx="2" fill={c === "#FF7400" ? "#E06600" : "#7B30E0"} />
      <rect x="32" y="54" width="14" height="6" rx="2" fill={c === "#FF7400" ? "#E06600" : "#7B30E0"} />
    </svg>
  );
}

function OBot(props) {
  return <Bot {...props} />;
}

function PBot(props) {
  return <Bot c="#9945FF" c2="#AB60FF" eye="#14F195" {...props} />;
}

function readPublicEnv(keys, fallback = "") {
  const env = import.meta.env || {};
  for (const key of keys) {
    const value = env[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
}

const JUPITER_RPC_URL = readPublicEnv(["VITE_RPC_URL", "NEXT_PUBLIC_RPC_URL"], "https://api.mainnet-beta.solana.com");
const JUPITER_REFERRAL_KEY = readPublicEnv(["VITE_REFERRAL_KEY", "NEXT_PUBLIC_REFERRAL_KEY", "NEXT_PUBLIC_REFERRAL_ACCOUNT"], "");
const JUPITER_SWAP_API_KEY = readPublicEnv(["VITE_JUP_SWAP_V1_API_KEY", "NEXT_PUBLIC_JUP_SWAP_V1_API_KEY"], "");

function Panel({ children, tone = "green", style, ...props }) {
  const color = tone === "purple" ? T.purple : tone === "orange" ? T.orange : tone === "danger" ? T.danger : T.green;
  return (
    <div
      style={{
        background: `${color}08`,
        border: `1px solid ${color}33`,
        borderRadius: 8,
        padding: "14px 16px",
        marginBottom: 12,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

function Label({ children, tone = "green" }) {
  const color = tone === "purple" ? T.purple : tone === "orange" ? T.orange : tone === "danger" ? T.danger : T.green;
  return (
    <div
      style={{
        fontSize: 10,
        letterSpacing: 3,
        color,
        textTransform: "uppercase",
        marginBottom: 8,
        opacity: 0.7,
        fontFamily: T.mono,
      }}
    >
      {children}
    </div>
  );
}

function Pill({ label, active = true, tone = "green" }) {
  const color = tone === "purple" ? T.purple : tone === "orange" ? T.orange : tone === "danger" ? T.danger : T.green;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${color}${active ? "66" : "22"}`,
        background: active ? `${color}15` : "transparent",
        fontSize: 10,
        letterSpacing: 1,
        color: active ? color : T.textTert,
        fontFamily: T.mono,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 6,
          background: active ? color : T.textTert,
          boxShadow: active ? `0 0 8px ${color}` : "none",
        }}
      />
      {label}
    </span>
  );
}

function Metric({ label, value, tone = "green" }) {
  const color = tone === "purple" ? T.purple : tone === "orange" ? T.orange : tone === "danger" ? T.danger : T.green;
  return (
    <div style={{ flex: 1, textAlign: "center", padding: "10px 6px", border: `1px solid ${color}22`, borderRadius: 6 }}>
      <div style={{ fontSize: 9, color: T.textSec, marginBottom: 4, fontFamily: T.mono, letterSpacing: 1 }}>{label}</div>
      <div style={{ fontFamily: T.display, fontSize: 15, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function Btn({ children, tone = "green", full, style, ...props }) {
  const color = tone === "purple" ? T.purple : tone === "orange" ? T.orange : tone === "danger" ? T.danger : T.green;
  return (
    <button
      style={{
        padding: "10px 14px",
        background: `${color}15`,
        border: `1px solid ${color}`,
        color,
        borderRadius: 4,
        cursor: props.disabled ? "not-allowed" : "pointer",
        fontFamily: T.display,
        fontSize: 10,
        letterSpacing: 2,
        opacity: props.disabled ? 0.45 : 1,
        width: full ? "100%" : "auto",
        textTransform: "uppercase",
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}

function Input({ value, onChange, placeholder, type = "text", style }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      type={type}
      style={{
        width: "100%",
        padding: "10px 12px",
        background: "rgba(0,0,0,0.3)",
        border: `1px solid ${T.borderStrong}`,
        borderRadius: 4,
        color: T.green,
        fontSize: 13,
        fontFamily: T.mono,
        outline: "none",
        caretColor: T.green,
        ...style,
      }}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3, style }) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: "100%",
        padding: "10px 12px",
        background: "rgba(0,0,0,0.3)",
        border: `1px solid ${T.borderStrong}`,
        borderRadius: 4,
        color: T.green,
        fontSize: 13,
        fontFamily: T.mono,
        outline: "none",
        resize: "vertical",
        caretColor: T.green,
        ...style,
      }}
    />
  );
}

function formatRelative(isoString) {
  if (!isoString) return "--";
  const value = new Date(isoString).getTime();
  if (Number.isNaN(value)) return isoString;
  const diff = Math.max(0, Date.now() - value);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function fmtNumber(value, digits = 0) {
  const number = Number(value);
  if (Number.isNaN(number)) return "--";
  return number.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtCompact(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return "--";
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(number);
}

function fmtSol(value) {
  const number = Number(value);
  return Number.isNaN(number) ? "--" : `${number.toFixed(4)} SOL`;
}

function shortAddress(value) {
  if (!value) return "--";
  if (value.length <= 10) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function formatHost(value) {
  try {
    return new URL(value).host;
  } catch {
    return value || "--";
  }
}

function JupiterTerminalCard() {
  const [viewMode, setViewMode] = useState("integrated");
  const { connected, connecting, publicKey, wallet } = useWallet();
  const walletAddress = publicKey?.toBase58?.() || "";
  const walletName = wallet?.adapter?.name || wallet?.name || "Wallet Picker";

  const handleSuccess = ({ txid }) => {
    toast.success(`Swap successful: ${txid}`);
  };

  const handleSwapError = ({ error }) => {
    toast.error(error?.message || "Jupiter swap failed");
  };

  const terminalSharedProps = {
    rpcUrl: JUPITER_RPC_URL,
    onSuccess: handleSuccess,
    onSwapError: handleSwapError,
    strictTokenList: true,
  };

  return (
    <Panel tone="purple">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <Label tone="purple">Jupiter Terminal</Label>
          <div style={{ fontSize: 11, fontFamily: T.mono, color: T.textSec, lineHeight: 1.6 }}>
            Live swap UI wired through Jupiverse Kit with Solana Mobile Wallet Adapter registration for Android wallet handoff.
          </div>
        </div>
        <div style={{ minWidth: 150 }}>
          <UnifiedWalletButton
            buttonClassName="!w-full !min-h-[42px] !rounded-md !border !border-[#9945FF] !bg-[rgba(153,69,255,0.14)] !text-white"
            currentUserClassName="!min-h-[42px] !rounded-md !border !border-[#14F195] !bg-[rgba(20,241,149,0.12)] !text-white"
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        <Pill label={connected ? "Wallet Connected" : connecting ? "Connecting" : "Wallet Idle"} active={connected || connecting} tone={connected ? "green" : "orange"} />
        <Pill label={walletName} active={connected} tone="purple" />
        <Pill label={JUPITER_REFERRAL_KEY ? "Referral On" : "Referral Off"} active={Boolean(JUPITER_REFERRAL_KEY)} tone="orange" />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Metric label="Wallet" value={shortAddress(walletAddress)} tone="green" />
        <Metric label="RPC" value={formatHost(JUPITER_RPC_URL)} tone="purple" />
        <Metric label="Mode" value={viewMode.toUpperCase()} tone="orange" />
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {JUPITER_VIEW_MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setViewMode(mode.id)}
            style={{
              padding: "6px 10px",
              borderRadius: 4,
              border: `1px solid ${viewMode === mode.id ? T.purple : T.border}`,
              background: viewMode === mode.id ? T.purpleSoft : "transparent",
              color: viewMode === mode.id ? T.purple : T.textSec,
              fontFamily: T.display,
              fontSize: 9,
              letterSpacing: 1,
              cursor: "pointer",
              textTransform: "uppercase",
            }}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {viewMode === "integrated" ? (
        <div style={{ minHeight: 568, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden", background: T.codeBg }}>
          <IntegratedTerminal
            {...terminalSharedProps}
            containerStyles={{
              zIndex: 100,
              width: "100%",
              height: "568px",
              display: "flex",
            }}
          />
        </div>
      ) : null}

      {viewMode === "swap" ? (
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, background: T.codeBg, padding: 12 }}>
          <Swap
            rpcUrl={JUPITER_RPC_URL}
            referralKey={JUPITER_REFERRAL_KEY || undefined}
            platformFeeBps={20}
            apiKey={JUPITER_SWAP_API_KEY || undefined}
          />
        </div>
      ) : null}

      {viewMode === "modal" ? (
        <div style={{ paddingTop: 4 }}>
          <ModalTerminal
            {...terminalSharedProps}
            buttonText="Launch Jupiter Terminal"
            buttonClassName="bg-black/10 hover:bg-black/20 rounded-3xl flex items-center justify-center w-full h-[100px] relative mt-2 border border-white/10"
          />
        </div>
      ) : null}

      {viewMode === "widget" ? (
        <div>
          <div style={{ fontSize: 11, fontFamily: T.mono, color: T.textSec, lineHeight: 1.6, marginBottom: 10 }}>
            Widget mode mounts a floating Jupiter launcher into the viewport so mobile users can keep the rest of SolanaOS visible.
          </div>
          <WidgetTerminal {...terminalSharedProps} widgetPosition="bottom-right" widgetSize="default" />
        </div>
      ) : null}

      <div style={{ marginTop: 10, fontSize: 10, fontFamily: T.mono, color: T.textSec, lineHeight: 1.6 }}>
        Android Chrome requires wallet association to start from a user gesture. Use the wallet button above before swapping.
      </div>
    </Panel>
  );
}

function fmtHash(value) {
  const number = Number(value);
  return Number.isNaN(number) ? "--" : `${number.toFixed(0)} GH/s`;
}

function unwrapApi(payload) {
  if (payload && typeof payload === "object" && "success" in payload) {
    if (!payload.success) {
      throw new Error(payload.error || "Request failed");
    }
    return payload.data;
  }
  return payload;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error || payload?.message || `${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  return unwrapApi(payload);
}

async function requestBlob(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `${response.status} ${response.statusText}`);
  }
  return response.blob();
}

const SUPABASE_SESSION_KEY = "solanaos.supabase.session";

function loadSupabaseSession() {
  try {
    const raw = window.localStorage.getItem(SUPABASE_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_err) {
    return null;
  }
}

function saveSupabaseSession(session) {
  if (!session) {
    window.localStorage.removeItem(SUPABASE_SESSION_KEY);
    return;
  }
  window.localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(session));
}

function useRuntime() {
  const [health, setHealth] = useState(null);
  const [status, setStatus] = useState(null);
  const [config, setConfig] = useState(null);
  const [threads, setThreads] = useState([]);
  const [intents, setIntents] = useState([]);
  const [fleet, setFleet] = useState(null);
  const [setupCode, setSetupCode] = useState(null);
  const [downloads, setDownloads] = useState(null);
  const [voice, setVoice] = useState(null);
  const [connectors, setConnectors] = useState([]);
  const [publicConfig, setPublicConfig] = useState(null);
  const [gatewayAccess, setGatewayAccess] = useState(null);
  const [convexHealth, setConvexHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState(null);

  const refresh = async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      const [
        nextHealth,
        nextStatus,
        nextConfig,
        nextThreads,
        nextIntents,
        nextFleet,
        nextSetupCode,
        nextDownloads,
        nextVoice,
        nextConnectors,
        nextPublicConfig,
        nextGatewayAccess,
        nextConvexHealth,
      ] = await Promise.all([
        requestJson("/health"),
        requestJson("/api/control/status"),
        requestJson("/api/control/openrouter/config"),
        requestJson("/api/control/threads"),
        requestJson("/api/control/intents"),
        requestJson("/api/fleet"),
        requestJson("/api/setup-code"),
        requestJson("/api/setup/downloads"),
        requestJson("/api/xai/status").catch(() => null),
        requestJson("/api/connectors").catch(() => []),
        requestJson("/api/public/config").catch(() => null),
        requestJson("/api/gateway/access").catch(() => null),
        requestJson("/api/convex/health").catch(() => null),
      ]);
      setHealth(nextHealth);
      setStatus(nextStatus);
      setConfig(nextConfig);
      setThreads(Array.isArray(nextThreads) ? nextThreads : []);
      setIntents(Array.isArray(nextIntents) ? nextIntents : []);
      setFleet(nextFleet);
      setSetupCode(nextSetupCode);
      setDownloads(nextDownloads);
      setVoice(nextVoice);
      setConnectors(Array.isArray(nextConnectors) ? nextConnectors : []);
      setPublicConfig(nextPublicConfig);
      setGatewayAccess(nextGatewayAccess);
      setConvexHealth(nextConvexHealth);
      setLastSync(new Date());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Runtime request failed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    refresh(false);
    const timer = window.setInterval(() => refresh(true), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const postThread = async (input) => {
    const created = await requestJson("/api/control/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    setThreads((current) => [created, ...current]);
    setStatus((current) => (current ? { ...current, threadCount: current.threadCount + 1 } : current));
    return created;
  };

  const stageIntent = async (url, payload) => {
    const created = await requestJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setIntents((current) => [created, ...current]);
    setStatus((current) => (current ? { ...current, stagedIntentCount: current.stagedIntentCount + 1 } : current));
    return created;
  };

  const updateFleet = async (deviceId, action, method = "POST", payload = null) => {
    const result = await requestJson(`/api/fleet/device/${deviceId}/${action}`, {
      method,
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    await refresh(true);
    return result;
  };

  const analyzeVision = async (payload) =>
    requestJson("/api/control/openrouter/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

  const quoteTrade = async (payload) =>
    requestJson("/api/control/trade/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

  const createVoiceSession = async (payload) =>
    requestJson("/api/xai/realtime/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });

  const speakTTS = async (payload) =>
    requestBlob("/api/xai/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

  return {
    health,
    status,
    config,
    threads,
    intents,
    fleet,
    setupCode,
    downloads,
    voice,
    connectors,
    publicConfig,
    gatewayAccess,
    convexHealth,
    loading,
    refreshing,
    error,
    lastSync,
    refresh: () => refresh(false),
    postThread,
    quoteTrade,
    stageTrade: (payload) => stageIntent("/api/control/trade/stage", payload),
    launchPumpfun: (payload) => stageIntent("/api/control/pumpfun/launch", payload),
    pumpSwap: (mode, payload) => stageIntent(`/api/control/pumpfun/${mode}`, payload),
    createTokenMill: (payload) => stageIntent("/api/control/tokenmill/market", payload),
    analyzeVision,
    updateFleet,
    createVoiceSession,
    speakTTS,
  };
}

function AuthBridgeCard({ runtime }) {
  const supabase = runtime.publicConfig?.supabase;
  const convex = runtime.convexHealth || runtime.publicConfig?.convex;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState(() => loadSupabaseSession());
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const updateSession = (nextSession) => {
    setSession(nextSession);
    saveSupabaseSession(nextSession);
  };

  const fetchUser = async (accessToken) => {
    const response = await fetch(`${supabase.url}/auth/v1/user`, {
      headers: {
        apikey: supabase.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Supabase user lookup failed (${response.status})`);
    }
    return response.json();
  };

  useEffect(() => {
    if (!supabase?.configured) return;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    if (!accessToken) return;
    const refreshToken = hash.get("refresh_token") || "";
    fetchUser(accessToken)
      .then((user) => {
        updateSession({ accessToken, refreshToken, user });
        setStatus(`Signed in as ${user.email || user.id}`);
        if (window.location.hash) {
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        }
      })
      .catch((err) => {
        setStatus(err instanceof Error ? err.message : "Supabase callback failed");
      });
  }, [supabase?.configured, supabase?.anonKey, supabase?.url]);

  const sendMagicLink = async () => {
    if (!supabase?.configured || !email.trim()) return;
    try {
      setBusy(true);
      setStatus("Sending magic link…");
      const response = await fetch(`${supabase.url}/auth/v1/otp`, {
        method: "POST",
        headers: {
          apikey: supabase.anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          create_user: true,
          data: { source: "solanaos-web" },
          options: { emailRedirectTo: `${window.location.origin}/app/` },
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error_description || payload.msg || `Supabase magic link failed (${response.status})`);
      }
      setStatus(`Magic link sent to ${email.trim()}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Magic link failed");
    } finally {
      setBusy(false);
    }
  };

  const signInPassword = async () => {
    if (!supabase?.configured || !email.trim() || !password) return;
    try {
      setBusy(true);
      setStatus("Signing in…");
      const response = await fetch(`${supabase.url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          apikey: supabase.anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error_description || payload.error || `Supabase sign-in failed (${response.status})`);
      }
      updateSession({
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token,
        user: payload.user || null,
      });
      setStatus(`Signed in as ${payload.user?.email || email.trim()}`);
      setPassword("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Password sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    if (!supabase?.configured || !session?.accessToken) {
      updateSession(null);
      return;
    }
    try {
      setBusy(true);
      await fetch(`${supabase.url}/auth/v1/logout`, {
        method: "POST",
        headers: {
          apikey: supabase.anonKey,
          Authorization: `Bearer ${session.accessToken}`,
        },
      });
    } finally {
      updateSession(null);
      setStatus("Signed out");
      setBusy(false);
    }
  };

  return (
    <Panel tone="purple">
      <Label tone="purple">Supabase + Convex</Label>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <Pill label={supabase?.configured ? "Supabase Ready" : "Supabase Missing"} active={!!supabase?.configured} tone={supabase?.configured ? "green" : "danger"} />
        <Pill label={convex?.siteUrl ? "Convex Ready" : "Convex Missing"} active={!!convex?.siteUrl} tone={convex?.siteUrl ? "purple" : "danger"} />
        <Pill label={session?.user?.email ? "User Signed In" : "No Session"} active={!!session?.user?.email} tone={session?.user?.email ? "green" : "orange"} />
      </div>

      <div style={{ fontSize: 11, fontFamily: T.mono, color: T.textSec, lineHeight: 1.7, marginBottom: 10 }}>
        Supabase URL: {supabase?.url || "--"}
        <br />
        Convex Health: {convex?.status || (convex?.siteUrl ? "configured" : "missing")}
        <br />
        Wallet Sync: {runtime.publicConfig?.convex?.walletSyncUrl || "--"}
      </div>

      {session?.user?.email ? (
        <>
          <div style={{ fontSize: 12, fontFamily: T.mono, color: T.text, marginBottom: 8 }}>
            Signed in as {session.user.email}
          </div>
          <Btn tone="orange" full onClick={signOut} disabled={busy}>
            Sign Out
          </Btn>
        </>
      ) : (
        <>
          <Input value={email} onChange={setEmail} placeholder="email@example.com" style={{ marginBottom: 8 }} />
          <Input value={password} onChange={setPassword} placeholder="Password (optional)" type="password" style={{ marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <Btn tone="green" full onClick={sendMagicLink} disabled={busy || !supabase?.configured || !email.trim()} style={{ flex: 1 }}>
              Magic Link
            </Btn>
            <Btn tone="purple" full onClick={signInPassword} disabled={busy || !supabase?.configured || !email.trim() || !password} style={{ flex: 1 }}>
              Password Sign In
            </Btn>
          </div>
        </>
      )}

      {status ? <div style={{ marginTop: 8, fontSize: 11, fontFamily: T.mono, color: T.text }}>{status}</div> : null}
    </Panel>
  );
}

function RuntimeRail({ runtime }) {
  return (
    <>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        <Pill label={runtime.health?.status || "Offline"} active={runtime.health?.status === "healthy"} tone={runtime.health?.status === "healthy" ? "green" : "danger"} />
        <Pill label={runtime.status?.service || "control-api"} active tone="purple" />
        <Pill label={runtime.refreshing ? "Syncing" : "Live"} active tone="orange" />
        {runtime.lastSync ? <Pill label={`Updated ${runtime.lastSync.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`} active tone="green" /> : null}
      </div>
      {runtime.error ? (
        <div style={{ padding: "8px 10px", background: T.dangerSoft, border: `1px solid ${T.danger}`, borderRadius: 6, marginBottom: 12, fontSize: 11, fontFamily: T.mono, color: T.text }}>
          {runtime.error}
        </div>
      ) : null}
    </>
  );
}

function ConnectScreen({ runtime }) {
  const connected = runtime.health?.status === "healthy";
  return (
    <div style={{ padding: "0 16px" }}>
      <RuntimeRail runtime={runtime} />
      <Panel>
        <Label>Gateway Status</Label>
        <div style={{ fontSize: 18, fontFamily: T.display, color: connected ? T.green : T.danger, marginBottom: 6 }}>{connected ? "CONNECTED" : "DISCONNECTED"}</div>
        <div style={{ fontSize: 11, fontFamily: T.mono, color: T.textSec, lineHeight: 1.7 }}>
          Service: {runtime.health?.service || "solanaos-gateway-api"}
          <br />
          Version: {runtime.health?.version || "--"}
          <br />
          Control API: {runtime.health?.controlAPI || "/api/control/status"}
          <br />
          Fleet API: {runtime.health?.fleetAPI || "/api/fleet"}
        </div>
      </Panel>

      <Panel tone="purple">
        <Label tone="purple">Setup Pairing</Label>
        <div style={{ fontSize: 28, fontFamily: T.display, letterSpacing: 3, color: T.green, textAlign: "center", marginBottom: 10 }}>
          {runtime.setupCode?.code ? runtime.setupCode.code.slice(0, 12) : "LOADING"}
        </div>
        <div style={{ fontSize: 11, fontFamily: T.mono, color: T.textSec, lineHeight: 1.7 }}>
          URL: {runtime.setupCode?.url || "--"}
          <br />
          Expires: {runtime.setupCode?.expiresAt ? new Date(runtime.setupCode.expiresAt).toLocaleString() : "--"}
        </div>
      </Panel>

      <Panel tone="orange">
        <Label tone="orange">Control Surface</Label>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <Metric label="Threads" value={fmtNumber(runtime.status?.threadCount ?? 0)} tone="green" />
          <Metric label="Staged" value={fmtNumber(runtime.status?.stagedIntentCount ?? 0)} tone="purple" />
          <Metric label="Features" value={fmtNumber(runtime.status?.features?.length ?? 0)} tone="orange" />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(runtime.status?.features || []).map((feature) => (
            <Pill key={feature} label={feature} active tone="purple" />
          ))}
        </div>
      </Panel>

      <Panel>
        <Label>Gateway Access</Label>
        <div style={{ fontSize: 11, fontFamily: T.mono, color: T.textSec, lineHeight: 1.7 }}>
          Bind: {runtime.gatewayAccess?.bind || "--"}
          <br />
          Auth: {runtime.gatewayAccess?.auth_mode || "--"}
          <br />
          Tailscale: {runtime.gatewayAccess?.tailscale_mode || "--"}
          <br />
          URL: {runtime.gatewayAccess?.tailscale_url || runtime.setupCode?.url || "--"}
        </div>
      </Panel>

      <AuthBridgeCard runtime={runtime} />

      <Panel tone="orange">
        <Label tone="orange">Install + Download</Label>
        <div style={{ fontSize: 11, fontFamily: T.mono, color: T.textSec, lineHeight: 1.8, marginBottom: 10 }}>
          Android releases, one-shot installer, and gateway boot commands are exposed from the same backend so setup stays in sync with runtime state.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <a href="/app/setup" style={{ flex: 1, textDecoration: "none" }}>
            <Btn tone="green" full style={{ width: "100%" }}>Open Setup</Btn>
          </a>
          <a href={runtime.downloads?.android?.releases || "https://github.com/x402agent/Solana-Os-Go/releases/latest"} target="_blank" rel="noreferrer" style={{ flex: 1, textDecoration: "none" }}>
            <Btn tone="purple" full style={{ width: "100%" }}>Android Release</Btn>
          </a>
        </div>
        <div style={{ background: T.codeBg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 10px", fontSize: 11, fontFamily: T.mono, color: T.green }}>
          {runtime.downloads?.runtime?.oneShot || "npx solanaos-computer@latest install --with-web"}
        </div>
      </Panel>
    </div>
  );
}

function SolanaScreen({ runtime }) {
  const [threadAuthor, setThreadAuthor] = useState("seeker.web");
  const [threadHeadline, setThreadHeadline] = useState("Runtime note");
  const [threadBody, setThreadBody] = useState("Website control surface is posting through the same control API Android uses.");
  const [threadStatus, setThreadStatus] = useState("");

  const [tradeFrom, setTradeFrom] = useState("SOL");
  const [tradeTo, setTradeTo] = useState("JUP");
  const [tradeAmount, setTradeAmount] = useState("0.75");
  const [tradeSlippage, setTradeSlippage] = useState("50");
  const [tradeStatus, setTradeStatus] = useState("");

  const [pumpName, setPumpName] = useState("Seeker Signal");
  const [pumpSymbol, setPumpSymbol] = useState("SEEKR");
  const [pumpDescription, setPumpDescription] = useState("Launched from the shared SolanaOS control API.");
  const [pumpAmount, setPumpAmount] = useState("0.10");
  const [pumpStatus, setPumpStatus] = useState("");

  const [tokenMillName, setTokenMillName] = useState("Runtime Vault");
  const [tokenMillCurve, setTokenMillCurve] = useState("Exponential");
  const [tokenMillSeed, setTokenMillSeed] = useState("5");
  const [tokenMillStatus, setTokenMillStatus] = useState("");

  const createThread = async () => {
    try {
      const created = await runtime.postThread({
        author: threadAuthor,
        headline: threadHeadline,
        body: threadBody,
        kind: "thread",
        stats: "web",
      });
      setThreadStatus(`Posted ${created.id}`);
    } catch (err) {
      setThreadStatus(err instanceof Error ? err.message : "Thread request failed");
    }
  };

  const quoteTrade = async () => {
    try {
      const quote = await runtime.quoteTrade({
        fromToken: tradeFrom,
        toToken: tradeTo,
        amount: Number(tradeAmount),
        slippageBps: Number(tradeSlippage),
      });
      setTradeStatus(`Quote ${quote.inAmount} -> ${quote.outAmount} via ${quote.provider} (${quote.routeCount || 0} routes)`);
    } catch (err) {
      setTradeStatus(err instanceof Error ? err.message : "Quote failed");
    }
  };

  const stageTrade = async () => {
    try {
      const intent = await runtime.stageTrade({
        fromToken: tradeFrom,
        toToken: tradeTo,
        amount: Number(tradeAmount),
        slippageBps: Number(tradeSlippage),
      });
      setTradeStatus(`Staged ${intent.id}`);
    } catch (err) {
      setTradeStatus(err instanceof Error ? err.message : "Trade staging failed");
    }
  };

  const launchPump = async () => {
    try {
      const intent = await runtime.launchPumpfun({
        name: pumpName,
        symbol: pumpSymbol,
        description: pumpDescription,
        amountSol: Number(pumpAmount),
      });
      setPumpStatus(`Staged ${intent.id}`);
    } catch (err) {
      setPumpStatus(err instanceof Error ? err.message : "Pump launch failed");
    }
  };

  const createMarket = async () => {
    try {
      const intent = await runtime.createTokenMill({
        name: tokenMillName,
        curvePreset: tokenMillCurve,
        seedSol: Number(tokenMillSeed),
      });
      setTokenMillStatus(`Staged ${intent.id}`);
    } catch (err) {
      setTokenMillStatus(err instanceof Error ? err.message : "TokenMill request failed");
    }
  };

  return (
    <div style={{ padding: "0 16px" }}>
      <RuntimeRail runtime={runtime} />
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Metric label="Service" value={runtime.status?.service?.replace("solanaos-", "") || "--"} tone="green" />
        <Metric label="Threads" value={fmtNumber(runtime.status?.threadCount ?? 0)} tone="purple" />
        <Metric label="Intents" value={fmtNumber(runtime.status?.stagedIntentCount ?? 0)} tone="orange" />
      </div>

      <Panel>
        <Label>Post Thread</Label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <Input value={threadAuthor} onChange={setThreadAuthor} placeholder="Author" />
          <Input value={threadHeadline} onChange={setThreadHeadline} placeholder="Headline" />
        </div>
        <TextArea value={threadBody} onChange={setThreadBody} placeholder="Body" rows={4} />
        <Btn tone="green" full onClick={createThread} style={{ marginTop: 8 }}>
          Post Through Control API
        </Btn>
        {threadStatus ? <div style={{ marginTop: 8, fontSize: 11, fontFamily: T.mono, color: T.green }}>{threadStatus}</div> : null}
      </Panel>

      <Panel tone="purple">
        <Label tone="purple">Jupiter Trade</Label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <Input value={tradeFrom} onChange={setTradeFrom} placeholder="From token" />
          <Input value={tradeTo} onChange={setTradeTo} placeholder="To token" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <Input value={tradeAmount} onChange={setTradeAmount} placeholder="Amount" />
          <Input value={tradeSlippage} onChange={setTradeSlippage} placeholder="Slippage bps" />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn tone="purple" full onClick={quoteTrade} style={{ flex: 1 }}>
            Quote
          </Btn>
          <Btn tone="green" full onClick={stageTrade} style={{ flex: 1 }}>
            Stage
          </Btn>
        </div>
        {tradeStatus ? <div style={{ marginTop: 8, fontSize: 11, fontFamily: T.mono, color: T.text }}>{tradeStatus}</div> : null}
      </Panel>

      <JupiterTerminalCard />

      <Panel tone="orange">
        <Label tone="orange">Pumpfun Launch</Label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <Input value={pumpName} onChange={setPumpName} placeholder="Name" />
          <Input value={pumpSymbol} onChange={setPumpSymbol} placeholder="Symbol" />
        </div>
        <TextArea value={pumpDescription} onChange={setPumpDescription} placeholder="Description" rows={3} />
        <Input value={pumpAmount} onChange={setPumpAmount} placeholder="Amount SOL" style={{ marginTop: 8 }} />
        <Btn tone="orange" full onClick={launchPump} style={{ marginTop: 8 }}>
          Stage Launch
        </Btn>
        {pumpStatus ? <div style={{ marginTop: 8, fontSize: 11, fontFamily: T.mono, color: T.orange }}>{pumpStatus}</div> : null}
      </Panel>

      <Panel>
        <Label>Token Mill</Label>
        <Input value={tokenMillName} onChange={setTokenMillName} placeholder="Market name" style={{ marginBottom: 8 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Input value={tokenMillCurve} onChange={setTokenMillCurve} placeholder="Curve preset" />
          <Input value={tokenMillSeed} onChange={setTokenMillSeed} placeholder="Seed SOL" />
        </div>
        <Btn tone="green" full onClick={createMarket} style={{ marginTop: 8 }}>
          Create Market
        </Btn>
        {tokenMillStatus ? <div style={{ marginTop: 8, fontSize: 11, fontFamily: T.mono, color: T.green }}>{tokenMillStatus}</div> : null}
      </Panel>
    </div>
  );
}

function GrokScreen({ runtime }) {
  const [prompt, setPrompt] = useState("Give short live commentary about what matters in this frame.");
  const [imageBase64, setImageBase64] = useState("");
  const [mimeType, setMimeType] = useState("image/png");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState("");
  const inputRef = useRef(null);

  const readFile = async (file) => {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Unable to read image"));
      reader.readAsDataURL(file);
    });
    const value = String(dataUrl);
    const [, mime = "image/png", base64 = ""] = value.match(/^data:(.*?);base64,(.*)$/) || [];
    setMimeType(mime);
    setImageBase64(base64);
    setStatus(`Loaded ${file.name}`);
  };

  const analyze = async () => {
    try {
      setStatus("Analyzing frame...");
      const response = await runtime.analyzeVision({ prompt, imageBase64, mimeType });
      setResult(response.comment);
      setStatus(`Model ${response.model}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Vision request failed");
    }
  };

  return (
    <div style={{ padding: "0 16px" }}>
      <RuntimeRail runtime={runtime} />
      <Panel tone="purple">
        <Label tone="purple">Vision Router</Label>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <Metric label="Enabled" value={runtime.config?.enabled ? "YES" : "NO"} tone={runtime.config?.enabled ? "green" : "danger"} />
          <Metric label="LLM" value={runtime.config?.model || "--"} tone="purple" />
          <Metric label="Vision" value={runtime.config?.grokModel || "--"} tone="orange" />
        </div>
        <TextArea value={prompt} onChange={setPrompt} placeholder="Prompt" rows={3} />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) readFile(file);
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <Btn tone="purple" full onClick={() => inputRef.current?.click()} style={{ flex: 1 }}>
            Attach Frame
          </Btn>
          <Btn tone="green" full onClick={analyze} disabled={!imageBase64} style={{ flex: 1 }}>
            Analyze
          </Btn>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, fontFamily: T.mono, color: T.textSec }}>{status || "Attach an image to call /api/control/openrouter/vision"}</div>
      </Panel>
      {result ? (
        <Panel tone="orange">
          <Label tone="orange">Commentary</Label>
          <div style={{ fontSize: 13, lineHeight: 1.7, fontFamily: T.mono, color: T.text }}>{result}</div>
        </Panel>
      ) : null}
    </div>
  );
}

function ChatScreen({ runtime }) {
  const [headline, setHeadline] = useState("Operator note");
  const [body, setBody] = useState("Seeker web console and Android runtime are sharing one thread feed.");
  const [sendStatus, setSendStatus] = useState("");

  const send = async () => {
    try {
      const created = await runtime.postThread({
        author: "chat.runtime",
        headline,
        body,
        kind: "chat",
        stats: "gateway",
      });
      setSendStatus(`Posted ${created.id}`);
      setBody("");
    } catch (err) {
      setSendStatus(err instanceof Error ? err.message : "Post failed");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "0 16px" }}>
      <RuntimeRail runtime={runtime} />
      <Panel>
        <Label>Runtime Feed</Label>
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {runtime.threads.map((thread) => (
            <div key={thread.id} style={{ padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                <span style={{ color: T.purple, fontFamily: T.display, fontSize: 12 }}>{thread.headline}</span>
                <span style={{ color: T.textSec, fontFamily: T.mono, fontSize: 10 }}>{formatRelative(thread.createdAt)}</span>
              </div>
              <div style={{ color: T.textSec, fontFamily: T.mono, fontSize: 11, marginBottom: 4 }}>{thread.author} · {thread.kind} · {thread.stats}</div>
              <div style={{ color: T.text, fontFamily: T.mono, fontSize: 12, lineHeight: 1.6 }}>{thread.body}</div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel tone="purple">
        <Label tone="purple">Post Into Feed</Label>
        <Input value={headline} onChange={setHeadline} placeholder="Headline" style={{ marginBottom: 8 }} />
        <TextArea value={body} onChange={setBody} placeholder="Message" rows={4} />
        <Btn tone="green" full onClick={send} style={{ marginTop: 8 }}>
          Send
        </Btn>
        {sendStatus ? <div style={{ marginTop: 8, fontSize: 11, color: T.green, fontFamily: T.mono }}>{sendStatus}</div> : null}
      </Panel>
    </div>
  );
}

function SigLine() {
  const points = useMemo(() => {
    const entries = [];
    for (let x = 0; x <= 100; x += 0.8) {
      entries.push(`${x},${50 + Math.sin(x * 0.3) * 20 + Math.sin(x * 0.7) * 10 + Math.random() * 8}`);
    }
    return entries.join(" ");
  }, []);

  return (
    <svg width="100%" height="24" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ opacity: 0.25 }}>
      <polyline fill="none" stroke={T.green} strokeWidth="2" points={points} />
    </svg>
  );
}

const PIECES = { wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙", bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟" };
const boardIndex = (row, column) => row * 8 + column;
const boardRow = (value) => value >> 3;
const boardCol = (value) => value & 7;
const boardNotation = (value) => String.fromCharCode(97 + boardCol(value)) + (8 - boardRow(value));

function initChessBoard() {
  const board = Array(64).fill(null);
  const backRow = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  for (let column = 0; column < 8; column += 1) {
    board[boardIndex(0, column)] = `b${backRow[column]}`;
    board[boardIndex(1, column)] = "bP";
    board[boardIndex(6, column)] = "wP";
    board[boardIndex(7, column)] = `w${backRow[column]}`;
  }
  return board;
}

function isInCheck(board, color) {
  const king = board.findIndex((piece) => piece === `${color}K`);
  if (king < 0) return true;
  const enemy = color === "w" ? "b" : "w";
  for (let i = 0; i < 64; i += 1) {
    const piece = board[i];
    if (!piece || piece[0] !== enemy) continue;
    const fromRow = boardRow(i);
    const fromCol = boardCol(i);
    const kingRow = boardRow(king);
    const kingCol = boardCol(king);
    const deltaRow = kingRow - fromRow;
    const deltaCol = kingCol - fromCol;

    if (piece[1] === "P") {
      const direction = enemy === "w" ? -1 : 1;
      if (deltaRow === direction && Math.abs(deltaCol) === 1) return true;
      continue;
    }

    if (piece[1] === "N") {
      if ((Math.abs(deltaRow) === 2 && Math.abs(deltaCol) === 1) || (Math.abs(deltaRow) === 1 && Math.abs(deltaCol) === 2)) return true;
      continue;
    }

    if (piece[1] === "K") {
      if (Math.abs(deltaRow) <= 1 && Math.abs(deltaCol) <= 1) return true;
      continue;
    }

    const directions =
      piece[1] === "B"
        ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
        : piece[1] === "R"
          ? [[-1, 0], [1, 0], [0, -1], [0, 1]]
          : [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

    for (const [stepRow, stepCol] of directions) {
      let nextRow = fromRow + stepRow;
      let nextCol = fromCol + stepCol;
      while (nextRow >= 0 && nextRow < 8 && nextCol >= 0 && nextCol < 8) {
        if (nextRow === kingRow && nextCol === kingCol) return true;
        if (board[boardIndex(nextRow, nextCol)]) break;
        nextRow += stepRow;
        nextCol += stepCol;
      }
    }
  }
  return false;
}

function getLegalMoves(board, from, turn, castle = { wK: true, wQ: true, bK: true, bQ: true }, enPassant = null) {
  const piece = board[from];
  if (!piece || piece[0] !== turn[0]) return [];
  const fromRow = boardRow(from);
  const fromCol = boardCol(from);
  const type = piece[1];
  const color = piece[0];
  const enemy = color === "w" ? "b" : "w";
  const moves = [];

  const add = (to) => {
    if (to < 0 || to >= 64) return;
    const target = board[to];
    if (!target || target[0] === enemy) moves.push(to);
  };

  const addSlide = (stepRow, stepCol) => {
    let nextRow = fromRow + stepRow;
    let nextCol = fromCol + stepCol;
    while (nextRow >= 0 && nextRow < 8 && nextCol >= 0 && nextCol < 8) {
      const targetIndex = boardIndex(nextRow, nextCol);
      const target = board[targetIndex];
      if (!target) {
        moves.push(targetIndex);
      } else {
        if (target[0] === enemy) moves.push(targetIndex);
        break;
      }
      nextRow += stepRow;
      nextCol += stepCol;
    }
  };

  if (type === "P") {
    const direction = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    const forward = boardIndex(fromRow + direction, fromCol);
    if (forward >= 0 && forward < 64 && !board[forward]) {
      moves.push(forward);
      const doubleForward = boardIndex(fromRow + direction * 2, fromCol);
      if (fromRow === startRow && !board[doubleForward]) moves.push(doubleForward);
    }
    for (const offset of [-1, 1]) {
      const captureCol = fromCol + offset;
      if (captureCol < 0 || captureCol >= 8) continue;
      const diagonal = boardIndex(fromRow + direction, captureCol);
      if (diagonal < 0 || diagonal >= 64) continue;
      if (board[diagonal] && board[diagonal][0] === enemy) moves.push(diagonal);
      if (diagonal === enPassant) moves.push(diagonal);
    }
  } else if (type === "N") {
    for (const [stepRow, stepCol] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
      const nextRow = fromRow + stepRow;
      const nextCol = fromCol + stepCol;
      if (nextRow >= 0 && nextRow < 8 && nextCol >= 0 && nextCol < 8) add(boardIndex(nextRow, nextCol));
    }
  } else if (type === "B") {
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([stepRow, stepCol]) => addSlide(stepRow, stepCol));
  } else if (type === "R") {
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([stepRow, stepCol]) => addSlide(stepRow, stepCol));
  } else if (type === "Q") {
    [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]].forEach(([stepRow, stepCol]) => addSlide(stepRow, stepCol));
  } else if (type === "K") {
    for (const [stepRow, stepCol] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
      const nextRow = fromRow + stepRow;
      const nextCol = fromCol + stepCol;
      if (nextRow >= 0 && nextRow < 8 && nextCol >= 0 && nextCol < 8) add(boardIndex(nextRow, nextCol));
    }

    if (color === "w" && from === boardIndex(7, 4) && !isInCheck(board, color)) {
      if (castle.wK && !board[boardIndex(7, 5)] && !board[boardIndex(7, 6)]) {
        const kingSideBoard = [...board];
        kingSideBoard[boardIndex(7, 5)] = kingSideBoard[from];
        kingSideBoard[from] = null;
        if (!isInCheck(kingSideBoard, color)) {
          kingSideBoard[boardIndex(7, 6)] = kingSideBoard[boardIndex(7, 5)];
          kingSideBoard[boardIndex(7, 5)] = null;
          if (!isInCheck(kingSideBoard, color)) moves.push(boardIndex(7, 6));
        }
      }
      if (castle.wQ && !board[boardIndex(7, 1)] && !board[boardIndex(7, 2)] && !board[boardIndex(7, 3)]) {
        const queenSideBoard = [...board];
        queenSideBoard[boardIndex(7, 3)] = queenSideBoard[from];
        queenSideBoard[from] = null;
        if (!isInCheck(queenSideBoard, color)) {
          queenSideBoard[boardIndex(7, 2)] = queenSideBoard[boardIndex(7, 3)];
          queenSideBoard[boardIndex(7, 3)] = null;
          if (!isInCheck(queenSideBoard, color)) moves.push(boardIndex(7, 2));
        }
      }
    }

    if (color === "b" && from === boardIndex(0, 4) && !isInCheck(board, color)) {
      if (castle.bK && !board[boardIndex(0, 5)] && !board[boardIndex(0, 6)]) {
        const kingSideBoard = [...board];
        kingSideBoard[boardIndex(0, 5)] = kingSideBoard[from];
        kingSideBoard[from] = null;
        if (!isInCheck(kingSideBoard, color)) {
          kingSideBoard[boardIndex(0, 6)] = kingSideBoard[boardIndex(0, 5)];
          kingSideBoard[boardIndex(0, 5)] = null;
          if (!isInCheck(kingSideBoard, color)) moves.push(boardIndex(0, 6));
        }
      }
      if (castle.bQ && !board[boardIndex(0, 1)] && !board[boardIndex(0, 2)] && !board[boardIndex(0, 3)]) {
        const queenSideBoard = [...board];
        queenSideBoard[boardIndex(0, 3)] = queenSideBoard[from];
        queenSideBoard[from] = null;
        if (!isInCheck(queenSideBoard, color)) {
          queenSideBoard[boardIndex(0, 2)] = queenSideBoard[boardIndex(0, 3)];
          queenSideBoard[boardIndex(0, 3)] = null;
          if (!isInCheck(queenSideBoard, color)) moves.push(boardIndex(0, 2));
        }
      }
    }
  }

  return moves.filter((to) => {
    const nextBoard = [...board];
    nextBoard[to] = nextBoard[from];
    nextBoard[from] = null;
    if (enPassant === to && type === "P") nextBoard[boardIndex(fromRow, boardCol(to))] = null;
    return !isInCheck(nextBoard, color);
  });
}

function hasAnyLegalMove(board, turn, castle, enPassant) {
  for (let i = 0; i < 64; i += 1) {
    if (board[i] && board[i][0] === turn[0] && getLegalMoves(board, i, turn, castle, enPassant).length > 0) return true;
  }
  return false;
}

function ChessScreen() {
  const [board, setBoard] = useState(initChessBoard);
  const [turn, setTurn] = useState("w");
  const [selected, setSelected] = useState(null);
  const [legal, setLegal] = useState([]);
  const [moveLog, setMoveLog] = useState([]);
  const [status, setStatus] = useState("Normal");
  const [flipped, setFlipped] = useState(false);
  const [castle, setCastle] = useState({ wK: true, wQ: true, bK: true, bQ: true });
  const [enPassant, setEnPassant] = useState(null);

  const handleSquare = (square) => {
    if (status === "Checkmate" || status === "Stalemate") return;
    if (selected !== null && legal.includes(square)) {
      const nextBoard = [...board];
      const piece = nextBoard[selected];
      const capture = Boolean(nextBoard[square]) || (piece[1] === "P" && square === enPassant);
      nextBoard[square] = piece;
      nextBoard[selected] = null;

      if (piece[1] === "P" && square === enPassant) nextBoard[boardIndex(boardRow(selected), boardCol(square))] = null;
      if (piece[1] === "P" && (boardRow(square) === 0 || boardRow(square) === 7)) nextBoard[square] = `${piece[0]}Q`;

      if (piece[1] === "K" && Math.abs(boardCol(square) - boardCol(selected)) === 2) {
        if (boardCol(square) === 6) {
          nextBoard[boardIndex(boardRow(square), 5)] = nextBoard[boardIndex(boardRow(square), 7)];
          nextBoard[boardIndex(boardRow(square), 7)] = null;
        }
        if (boardCol(square) === 2) {
          nextBoard[boardIndex(boardRow(square), 3)] = nextBoard[boardIndex(boardRow(square), 0)];
          nextBoard[boardIndex(boardRow(square), 0)] = null;
        }
      }

      const nextEnPassant = piece[1] === "P" && Math.abs(boardRow(square) - boardRow(selected)) === 2 ? boardIndex((boardRow(square) + boardRow(selected)) / 2, boardCol(selected)) : null;
      const nextCastle = { ...castle };
      if (piece[1] === "K") {
        if (piece[0] === "w") {
          nextCastle.wK = false;
          nextCastle.wQ = false;
        } else {
          nextCastle.bK = false;
          nextCastle.bQ = false;
        }
      }
      if (piece[1] === "R") {
        if (selected === 63) nextCastle.wK = false;
        if (selected === 56) nextCastle.wQ = false;
        if (selected === 7) nextCastle.bK = false;
        if (selected === 0) nextCastle.bQ = false;
      }
      if (square === 63) nextCastle.wK = false;
      if (square === 56) nextCastle.wQ = false;
      if (square === 7) nextCastle.bK = false;
      if (square === 0) nextCastle.bQ = false;

      const nextTurn = turn === "w" ? "b" : "w";
      const check = isInCheck(nextBoard, nextTurn);
      const hasMoves = hasAnyLegalMove(nextBoard, nextTurn, nextCastle, nextEnPassant);
      const nextStatus = !hasMoves && check ? "Checkmate" : !hasMoves ? "Stalemate" : check ? "Check" : "Normal";

      setMoveLog((current) => [...current, `${boardNotation(selected)}${capture ? "x" : "-"}${boardNotation(square)}`]);
      setBoard(nextBoard);
      setTurn(nextTurn);
      setCastle(nextCastle);
      setEnPassant(nextEnPassant);
      setStatus(nextStatus);
      setSelected(null);
      setLegal([]);
      return;
    }

    if (board[square] && board[square][0] === turn[0]) {
      setSelected(square);
      setLegal(getLegalMoves(board, square, turn, castle, enPassant));
      return;
    }

    setSelected(null);
    setLegal([]);
  };

  const reset = () => {
    setBoard(initChessBoard());
    setTurn("w");
    setSelected(null);
    setLegal([]);
    setMoveLog([]);
    setStatus("Normal");
    setFlipped(false);
    setCastle({ wK: true, wQ: true, bK: true, bQ: true });
    setEnPassant(null);
  };

  return (
    <div style={{ padding: "0 16px" }}>
      <Panel>
        <Label>Chess · {turn === "w" ? "White" : "Black"} To Move</Label>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <Pill label={status} active={status !== "Normal"} tone={status === "Checkmate" ? "orange" : status === "Check" ? "purple" : "green"} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", aspectRatio: "1 / 1", border: `1px solid ${T.borderStrong}`, borderRadius: 6, overflow: "hidden" }}>
          {Array.from({ length: 8 }, (_, renderRow) =>
            Array.from({ length: 8 }, (_, renderColumn) => {
              const logicalRow = flipped ? 7 - renderRow : renderRow;
              const logicalColumn = flipped ? 7 - renderColumn : renderColumn;
              const square = boardIndex(logicalRow, logicalColumn);
              const isDark = (logicalRow + logicalColumn) % 2 === 1;
              const isSelected = square === selected;
              const isLegal = legal.includes(square);
              const piece = board[square];

              return (
                <div
                  key={square}
                  onClick={() => handleSquare(square)}
                  style={{
                    width: "12.5%",
                    height: "12.5%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isSelected ? `${T.green}40` : isLegal ? `${T.purple}30` : isDark ? "#1a1f30" : "#111525",
                    cursor: "pointer",
                    fontSize: 26,
                    position: "relative",
                    boxShadow: isLegal ? `inset 0 0 0 2px ${T.purple}60` : "none",
                  }}
                >
                  {isLegal && !piece ? <div style={{ width: 8, height: 8, borderRadius: 4, background: `${T.purple}80` }} /> : null}
                  {piece ? <span style={{ textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>{PIECES[piece]}</span> : null}
                </div>
              );
            }),
          )}
        </div>
      </Panel>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Btn onClick={() => setFlipped((current) => !current)} tone="purple" full style={{ flex: 1 }}>Flip</Btn>
        <Btn onClick={reset} tone="orange" full style={{ flex: 1 }}>Reset</Btn>
      </div>
      {moveLog.length ? (
        <Panel tone="purple">
          <Label tone="purple">Move Log</Label>
          <div style={{ fontSize: 11, fontFamily: T.mono, color: T.green, lineHeight: 1.8, maxHeight: 100, overflowY: "auto" }}>
            {moveLog.map((move, index) => (
              <span key={`${move}-${index}`}>{index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ` : ""}{move} </span>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

const SNAKE_COLS = 18;
const SNAKE_ROWS = 28;

function SnakeScreen() {
  const canvasRef = useRef(null);
  const [snake, setSnake] = useState([{ x: 5, y: 14 }, { x: 4, y: 14 }, { x: 3, y: 14 }]);
  const [food, setFood] = useState({ x: 12, y: 10 });
  const [running, setRunning] = useState(false);
  const [crashed, setCrashed] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [tick, setTick] = useState(190);
  const directionRef = useRef("RIGHT");
  const pendingDirectionRef = useRef("RIGHT");

  const randomFood = (currentSnake) => {
    const occupied = new Set(currentSnake.map((segment) => `${segment.x},${segment.y}`));
    const free = [];
    for (let x = 0; x < SNAKE_COLS; x += 1) {
      for (let y = 0; y < SNAKE_ROWS; y += 1) {
        if (!occupied.has(`${x},${y}`)) free.push({ x, y });
      }
    }
    return free[Math.floor(Math.random() * free.length)] || { x: 0, y: 0 };
  };

  const reset = () => {
    const nextSnake = [{ x: 5, y: 14 }, { x: 4, y: 14 }, { x: 3, y: 14 }];
    setSnake(nextSnake);
    setFood(randomFood(nextSnake));
    directionRef.current = "RIGHT";
    pendingDirectionRef.current = "RIGHT";
    setScore(0);
    setTick(190);
    setCrashed(false);
    setRunning(false);
  };

  useEffect(() => {
    if (!running || crashed) return undefined;
    const timer = window.setInterval(() => {
      const canTurn = (nextDirection) => {
        const direction = directionRef.current;
        return !(
          (direction === "UP" && nextDirection === "DOWN") ||
          (direction === "DOWN" && nextDirection === "UP") ||
          (direction === "LEFT" && nextDirection === "RIGHT") ||
          (direction === "RIGHT" && nextDirection === "LEFT")
        );
      };

      const direction = canTurn(pendingDirectionRef.current) ? pendingDirectionRef.current : directionRef.current;
      directionRef.current = direction;

      setSnake((current) => {
        const head = current[0];
        const next = {
          x: head.x + (direction === "RIGHT" ? 1 : direction === "LEFT" ? -1 : 0),
          y: head.y + (direction === "DOWN" ? 1 : direction === "UP" ? -1 : 0),
        };

        if (
          next.x < 0 ||
          next.x >= SNAKE_COLS ||
          next.y < 0 ||
          next.y >= SNAKE_ROWS ||
          current.some((segment) => segment.x === next.x && segment.y === next.y)
        ) {
          setCrashed(true);
          setRunning(false);
          setBest((value) => Math.max(value, score));
          return current;
        }

        const ate = next.x === food.x && next.y === food.y;
        const nextSnake = [next, ...current];
        if (!ate) nextSnake.pop();
        if (ate) {
          setScore((value) => {
            const nextScore = value + 1;
            setBest((bestValue) => Math.max(bestValue, nextScore));
            return nextScore;
          });
          setTick((value) => Math.max(80, value - 6));
          setFood(randomFood(nextSnake));
        }
        return nextSnake;
      });
    }, tick);

    return () => window.clearInterval(timer);
  }, [crashed, food, running, score, tick]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const cell = Math.min(width / SNAKE_COLS, height / SNAKE_ROWS);
    const offsetX = (width - cell * SNAKE_COLS) / 2;
    const offsetY = (height - cell * SNAKE_ROWS) / 2;

    context.fillStyle = T.codeBg;
    context.fillRect(0, 0, width, height);
    context.strokeStyle = `${T.green}15`;
    context.lineWidth = 0.5;
    for (let x = 0; x <= SNAKE_COLS; x += 1) {
      context.beginPath();
      context.moveTo(offsetX + x * cell, offsetY);
      context.lineTo(offsetX + x * cell, offsetY + SNAKE_ROWS * cell);
      context.stroke();
    }
    for (let y = 0; y <= SNAKE_ROWS; y += 1) {
      context.beginPath();
      context.moveTo(offsetX, offsetY + y * cell);
      context.lineTo(offsetX + SNAKE_COLS * cell, offsetY + y * cell);
      context.stroke();
    }

    context.fillStyle = T.orange;
    const foodPadding = 0.18 * cell;
    context.fillRect(offsetX + food.x * cell + foodPadding, offsetY + food.y * cell + foodPadding, cell * 0.64, cell * 0.64);

    snake.forEach((segment, index) => {
      context.fillStyle = index === 0 ? T.green : T.purple;
      const padding = 0.1 * cell;
      context.fillRect(offsetX + segment.x * cell + padding, offsetY + segment.y * cell + padding, cell * 0.8, cell * 0.8);
    });

    if (crashed) {
      context.fillStyle = "rgba(0,0,0,0.6)";
      context.fillRect(0, 0, width, height);
      context.fillStyle = T.orange;
      context.font = "bold 16px Orbitron";
      context.textAlign = "center";
      context.fillText("SIGNAL LOST", width / 2, height / 2 - 10);
      context.fillStyle = T.text;
      context.font = "12px Share Tech Mono";
      context.fillText("Snake hit the frame", width / 2, height / 2 + 14);
    }
  }, [crashed, food, snake]);

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <Pill label={crashed ? "Crashed" : running ? "Live" : "Standby"} active={!crashed} tone={crashed ? "orange" : "green"} />
        <Pill label={`Speed ${191 - tick}`} active tone="purple" />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Metric label="Score" value={score} tone="green" />
        <Metric label="Best" value={best} tone="purple" />
        <Metric label="State" value={crashed ? "DOWN" : running ? "RUN" : "IDLE"} tone={crashed ? "orange" : "green"} />
      </div>
      <Panel>
        <Label>Snake Grid</Label>
        <canvas ref={canvasRef} width={360} height={560} style={{ width: "100%", borderRadius: 6, border: `1px solid ${T.border}` }} />
      </Panel>
      <Panel tone="purple">
        <Label tone="purple">Command Deck</Label>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <Btn onClick={() => setRunning((value) => !value)} disabled={crashed} tone="green" full style={{ flex: 1 }}>{running ? "Pause" : "Run"}</Btn>
          <Btn onClick={reset} tone="orange" full style={{ flex: 1 }}>Reset</Btn>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <Btn onClick={() => { pendingDirectionRef.current = "UP"; }} tone="purple">▲ Up</Btn>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={() => { pendingDirectionRef.current = "LEFT"; }} tone="purple">◄ Left</Btn>
            <Btn onClick={() => { pendingDirectionRef.current = "DOWN"; }} tone="purple">▼ Down</Btn>
            <Btn onClick={() => { pendingDirectionRef.current = "RIGHT"; }} tone="purple">► Right</Btn>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function PlatformerScreen() {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [running, setRunning] = useState(false);
  const playerRef = useRef({ x: 40, y: 200, vx: 0, vy: 0, grounded: false });
  const coinsRef = useRef([{ x: 80, y: 180 }, { x: 140, y: 160 }, { x: 200, y: 140 }, { x: 120, y: 120 }, { x: 60, y: 100 }]);
  const platformsRef = useRef([{ x: 0, y: 224, w: 256, h: 16 }, { x: 60, y: 190, w: 50, h: 8 }, { x: 130, y: 168, w: 50, h: 8 }, { x: 30, y: 140, w: 60, h: 8 }, { x: 170, y: 148, w: 50, h: 8 }, { x: 80, y: 110, w: 70, h: 8 }, { x: 190, y: 90, w: 50, h: 8 }]);
  const keysRef = useRef({ left: false, right: false, jump: false });

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      const dt = 0.016;
      player.vy += 600 * dt;
      if (player.vy > 400) player.vy = 400;

      if (keysRef.current.left) player.vx = -100;
      else if (keysRef.current.right) player.vx = 100;
      else player.vx *= 0.8;

      if (keysRef.current.jump && player.grounded) {
        player.vy = -250;
        player.grounded = false;
        keysRef.current.jump = false;
      }

      player.x += player.vx * dt;
      player.y += player.vy * dt;
      player.grounded = false;

      for (const platform of platformsRef.current) {
        if (player.x + 14 > platform.x && player.x < platform.x + platform.w && player.y + 16 > platform.y && player.y + 16 < platform.y + platform.h + 8 && player.vy > 0) {
          player.y = platform.y - 16;
          player.vy = 0;
          player.grounded = true;
        }
      }

      if (player.x < 0) player.x = 0;
      if (player.x > 242) player.x = 242;
      if (player.y > 240) {
        player.y = 200;
        player.vy = 0;
        player.x = 40;
        setLives((value) => value - 1);
      }

      coinsRef.current = coinsRef.current.filter((coin) => {
        if (Math.abs(player.x + 7 - coin.x - 4) < 12 && Math.abs(player.y + 8 - coin.y - 4) < 12) {
          setScore((value) => value + 10);
          return false;
        }
        return true;
      });

      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d");
      const scaleX = canvas.width / 256;
      const scaleY = canvas.height / 240;

      context.fillStyle = T.codeBg;
      context.fillRect(0, 0, canvas.width, canvas.height);
      platformsRef.current.forEach((platform) => {
        context.fillStyle = `${T.green}40`;
        context.fillRect(platform.x * scaleX, platform.y * scaleY, platform.w * scaleX, platform.h * scaleY);
        context.strokeStyle = T.green;
        context.strokeRect(platform.x * scaleX, platform.y * scaleY, platform.w * scaleX, platform.h * scaleY);
      });
      context.fillStyle = T.orange;
      coinsRef.current.forEach((coin) => {
        context.beginPath();
        context.arc((coin.x + 4) * scaleX, (coin.y + 4) * scaleY, 4 * scaleX, 0, Math.PI * 2);
        context.fill();
      });
      context.fillStyle = T.orange;
      context.fillRect(player.x * scaleX, player.y * scaleY, 14 * scaleX, 16 * scaleY);
      context.fillStyle = "#1a1a2e";
      context.fillRect((player.x + 3) * scaleX, (player.y + 4) * scaleY, 3 * scaleX, 3 * scaleY);
      context.fillRect((player.x + 8) * scaleX, (player.y + 4) * scaleY, 3 * scaleX, 3 * scaleY);
    }, 16);

    return () => window.clearInterval(timer);
  }, [running]);

  const reset = () => {
    playerRef.current = { x: 40, y: 200, vx: 0, vy: 0, grounded: false };
    coinsRef.current = [{ x: 80, y: 180 }, { x: 140, y: 160 }, { x: 200, y: 140 }, { x: 120, y: 120 }, { x: 60, y: 100 }];
    setScore(0);
    setLives(3);
  };

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <Pill label={running ? "Live" : "Standby"} active={running} tone="green" />
        <Pill label={`Lives: ${lives}`} active={lives > 0} tone={lives > 1 ? "purple" : "orange"} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Metric label="Score" value={score} tone="green" />
        <Metric label="Lives" value={lives} tone="purple" />
        <Metric label="Coins" value={coinsRef.current.length} tone="orange" />
      </div>
      <Panel>
        <Label>Platformer Viewport</Label>
        <canvas ref={canvasRef} width={512} height={480} style={{ width: "100%", borderRadius: 6, border: `1px solid ${T.border}` }} />
      </Panel>
      <Panel tone="purple">
        <Label tone="purple">Controls</Label>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <Btn onClick={() => setRunning((value) => !value)} tone="green" full style={{ flex: 1 }}>{running ? "Pause" : "Run"}</Btn>
          <Btn onClick={reset} tone="orange" full style={{ flex: 1 }}>Reset</Btn>
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
          <Btn onMouseDown={() => { keysRef.current.left = true; }} onMouseUp={() => { keysRef.current.left = false; }} onMouseLeave={() => { keysRef.current.left = false; }} onTouchStart={() => { keysRef.current.left = true; }} onTouchEnd={() => { keysRef.current.left = false; }} tone="purple">◄</Btn>
          <Btn onClick={() => { keysRef.current.jump = true; }} tone="green">Jump</Btn>
          <Btn onMouseDown={() => { keysRef.current.right = true; }} onMouseUp={() => { keysRef.current.right = false; }} onMouseLeave={() => { keysRef.current.right = false; }} onTouchStart={() => { keysRef.current.right = true; }} onTouchEnd={() => { keysRef.current.right = false; }} tone="purple">►</Btn>
        </div>
      </Panel>
    </div>
  );
}

function ArcadeScreen({ runtime }) {
  const [mode, setMode] = useState("Chess");
  const [status, setStatus] = useState("");
  const modes = [
    { name: "Chess", summary: "Local chess engine ported from the Seeker build for tactical downtime and handheld demos." },
    { name: "Snake", summary: "Signal-loss reflex loop with touch controls and persistent local best score." },
    { name: "Platformer", summary: "Retro platformer prototype using the same SolanaOS visual shell as the Seeker UI." },
  ];

  const activate = async (nextMode) => {
    setMode(nextMode);
    try {
      const created = await runtime.postThread({
        author: "arcade.surface",
        headline: `${nextMode} selected`,
        body: `Arcade tab switched to ${nextMode}.`,
        kind: "arcade",
        stats: "local-ui",
      });
      setStatus(`Logged ${created.id}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Unable to log arcade activity");
    }
  };

  return (
    <div style={{ padding: "0 16px" }}>
      <RuntimeRail runtime={runtime} />
      <Panel style={{ display: "flex", alignItems: "center", gap: 14, overflow: "hidden" }}>
        <div className="float-anim">
          <OBot sz={42} happy={mode !== "Snake"} />
        </div>
        <div style={{ flex: 1 }}>
          <Label>Arcade Runtime</Label>
          <div style={{ fontSize: 18, fontFamily: T.display, color: T.text, marginBottom: 6 }}>{mode.toUpperCase()}</div>
          <div style={{ fontSize: 11, fontFamily: T.mono, color: T.textSec, lineHeight: 1.7 }}>
            {modes.find((entry) => entry.name === mode)?.summary}
          </div>
        </div>
        <PBot sz={38} happy />
      </Panel>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {modes.map((entry) => (
          <button
            key={entry.name}
            onClick={() => activate(entry.name)}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 4,
              border: `1px solid ${mode === entry.name ? T.purple : T.borderStrong}`,
              background: mode === entry.name ? T.purpleSoft : "transparent",
              color: mode === entry.name ? T.purple : T.textSec,
              cursor: "pointer",
              fontFamily: T.display,
              fontSize: 10,
              letterSpacing: 1,
            }}
          >
            {entry.name}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Metric label="Threads" value={fmtNumber(runtime.status?.threadCount ?? 0)} tone="green" />
        <Metric label="Staged" value={fmtNumber(runtime.status?.stagedIntentCount ?? 0)} tone="purple" />
        <Metric label="Backend" value={runtime.health?.status === "healthy" ? "LIVE" : "OFF"} tone="orange" />
      </div>
      <div style={{ marginBottom: 12 }}>
        <SigLine />
      </div>
      {mode === "Chess" ? <ChessScreen /> : null}
      {mode === "Snake" ? <SnakeScreen /> : null}
      {mode === "Platformer" ? <PlatformerScreen /> : null}
      {status ? <Panel tone="purple"><Label tone="purple">Activity</Label><div style={{ fontSize: 12, fontFamily: T.mono, color: T.text }}>{status}</div></Panel> : null}
    </div>
  );
}

const GROK_VOICES = [
  { id: "Eve", tone: "Energetic, upbeat", type: "Female" },
  { id: "Ara", tone: "Warm, friendly", type: "Female" },
  { id: "Rex", tone: "Confident, clear", type: "Male" },
  { id: "Sal", tone: "Smooth, balanced", type: "Neutral" },
  { id: "Leo", tone: "Authoritative", type: "Male" },
];

function extractVoiceToken(payload) {
  const candidates = [
    payload?.ephemeralToken,
    payload?.secret?.client_secret?.value,
    payload?.secret?.client_secret,
    payload?.secret?.secret?.value,
    payload?.secret?.secret,
    payload?.secret?.value,
    payload?.secret?.token,
  ];
  return candidates.find((value) => typeof value === "string" && value.trim()) || "";
}

function float32ToBase64PCM16(float32Array) {
  const pcm16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64PCM16ToFloat32(base64String) {
  const binary = atob(base64String);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const pcm16 = new Int16Array(bytes.buffer);
  const output = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i += 1) {
    output[i] = pcm16[i] / 32768;
  }
  return output;
}

function VoiceScreen({ runtime }) {
  const [phase, setPhase] = useState("idle");
  const [pulse, setPulse] = useState(0);
  const [voice, setVoice] = useState("Eve");
  const [transcript, setTranscript] = useState([]);
  const [assistantDraft, setAssistantDraft] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [vadThreshold, setVadThreshold] = useState("0.85");
  const [silenceDuration, setSilenceDuration] = useState("0");
  const [sampleRate, setSampleRate] = useState("24000");
  const [toolsEnabled, setToolsEnabled] = useState({ web: true, x: true });
  const [showConfig, setShowConfig] = useState(false);
  const [showProtocol, setShowProtocol] = useState(false);
  const [status, setStatus] = useState("Waiting for xAI voice runtime");
  const [textPrompt, setTextPrompt] = useState("What's happening on Solana right now?");
  const [ttsText, setTtsText] = useState("Hello from SolanaOS. Grok voice is online.");
  const wsRef = useRef(null);
  const playbackContextRef = useRef(null);
  const playbackSourcesRef = useRef([]);
  const playbackCursorRef = useRef(0);
  const micStreamRef = useRef(null);
  const inputContextRef = useRef(null);
  const inputSourceRef = useRef(null);
  const inputProcessorRef = useRef(null);
  const inputSilenceRef = useRef(null);
  const micBufferRef = useRef([]);
  const sessionReadyRef = useRef(false);
  const assistantDraftRef = useRef("");

  useEffect(() => {
    const timer = window.setInterval(() => setPulse((current) => (current + 0.02) % 1), 16);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (runtime.voice?.defaultVoice) setVoice(runtime.voice.defaultVoice);
    if (runtime.voice?.sampleRate) setSampleRate(String(runtime.voice.sampleRate));
    if (runtime.voice?.configured) {
      setStatus("xAI voice ready. Connect to open a realtime session.");
    } else {
      setStatus("XAI_API_KEY missing on the backend. Realtime voice is unavailable.");
    }
  }, [runtime.voice]);

  useEffect(() => () => {
    stopMicCapture();
    stopPlayback();
    if (wsRef.current) {
      wsRef.current.close(1000, "component_unmount");
      wsRef.current = null;
    }
  }, []);

  const appendLog = (role, text) => {
    setTranscript((current) => [...current, { role, text }].slice(-80));
  };

  const ensurePlaybackContext = async () => {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) throw new Error("Web Audio is not supported in this browser");
    if (!playbackContextRef.current) {
      playbackContextRef.current = new AudioCtor({ sampleRate: Number(sampleRate) || 24000 });
    }
    if (playbackContextRef.current.state === "suspended") {
      await playbackContextRef.current.resume();
    }
    return playbackContextRef.current;
  };

  const stopPlayback = () => {
    playbackSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch (_err) {
        // Ignore already-finished buffers.
      }
    });
    playbackSourcesRef.current = [];
    playbackCursorRef.current = 0;
  };

  const enqueueAudio = async (delta) => {
    const context = await ensurePlaybackContext();
    const float32 = base64PCM16ToFloat32(delta);
    if (!float32.length) return;
    const buffer = context.createBuffer(1, float32.length, Number(sampleRate) || 24000);
    buffer.copyToChannel(float32, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const startAt = Math.max(context.currentTime + 0.02, playbackCursorRef.current || context.currentTime);
    source.start(startAt);
    playbackCursorRef.current = startAt + buffer.duration;
    playbackSourcesRef.current.push(source);
    source.onended = () => {
      playbackSourcesRef.current = playbackSourcesRef.current.filter((entry) => entry !== source);
    };
  };

  const sendBufferedAudio = () => {
    if (!sessionReadyRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const buffered = micBufferRef.current.splice(0);
    buffered.forEach((audio) => {
      wsRef.current.send(JSON.stringify({ type: "input_audio_buffer.append", audio }));
    });
  };

  const stopMicCapture = () => {
    if (inputProcessorRef.current) {
      inputProcessorRef.current.onaudioprocess = null;
      inputProcessorRef.current.disconnect();
      inputProcessorRef.current = null;
    }
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }
    if (inputSilenceRef.current) {
      inputSilenceRef.current.disconnect();
      inputSilenceRef.current = null;
    }
    if (inputContextRef.current) {
      inputContextRef.current.close().catch(() => {});
      inputContextRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    setMicEnabled(false);
  };

  const buildSessionConfig = () => ({
    voice,
    instructions:
      runtime.voice?.instructions ||
      "You are SolanaOS Voice, a concise Grok-powered copilot for the Seeker runtime. Keep spoken responses short, useful, and operationally aware.",
    turn_detection: {
      type: "server_vad",
      threshold: Number(vadThreshold) || 0.85,
      silence_duration_ms: Number(silenceDuration) || 0,
    },
    tools: [
      ...(toolsEnabled.web ? [{ type: "web_search" }] : []),
      ...(toolsEnabled.x ? [{ type: "x_search" }] : []),
    ],
    input_audio_transcription: { model: "grok-2-audio" },
    audio: {
      input: { format: { type: "audio/pcm", rate: Number(sampleRate) || 24000 } },
      output: { format: { type: "audio/pcm", rate: Number(sampleRate) || 24000 } },
    },
  });

  const disconnect = (reason = "Disconnected") => {
    sessionReadyRef.current = false;
    micBufferRef.current = [];
    stopMicCapture();
    stopPlayback();
    setConnected(false);
    setBusy(false);
    setPhase("idle");
    setSessionId("");
    setAssistantDraft("");
    assistantDraftRef.current = "";
    if (wsRef.current) {
      const socket = wsRef.current;
      wsRef.current = null;
      socket.onclose = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, "client_disconnect");
      }
    }
    setStatus(reason);
    appendLog("system", reason);
  };

  const handleRealtimeEvent = async (event) => {
    switch (event.type) {
      case "session.created":
        if (event.session?.id) setSessionId(event.session.id);
        setStatus("Session created. Sending session.update…");
        appendLog("system", `Session created${event.session?.id ? ` · ${event.session.id}` : ""}`);
        break;
      case "session.updated":
        sessionReadyRef.current = true;
        setConnected(true);
        setBusy(false);
        setPhase(micEnabled ? "listening" : "idle");
        setStatus("Realtime session ready");
        appendLog("system", `session.update acknowledged · ${voice} · ${sampleRate}Hz PCM`);
        sendBufferedAudio();
        break;
      case "input_audio_buffer.speech_started":
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "response.cancel" }));
        }
        stopPlayback();
        setPhase("listening");
        setStatus("Speech detected");
        break;
      case "input_audio_buffer.speech_stopped":
        setPhase("thinking");
        setStatus("Speech complete. Waiting for Grok…");
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (event.transcript) appendLog("user", event.transcript);
        break;
      case "response.created":
        setBusy(true);
        setPhase("thinking");
        setStatus("Generating response…");
        break;
      case "response.output_audio.delta":
        setPhase("speaking");
        setStatus(`Speaking · ${voice}`);
        await enqueueAudio(event.delta);
        break;
      case "response.output_audio_transcript.delta":
      case "response.text.delta":
        assistantDraftRef.current += event.delta || "";
        setAssistantDraft(assistantDraftRef.current);
        break;
      case "response.output_audio_transcript.done":
      case "response.text.done":
        if (assistantDraftRef.current.trim()) {
          appendLog("assistant", assistantDraftRef.current.trim());
        }
        assistantDraftRef.current = "";
        setAssistantDraft("");
        break;
      case "response.function_call_arguments.done":
        appendLog("system", `Tool call · ${event.name || "unknown"} ${event.arguments || ""}`.trim());
        break;
      case "response.done":
        setBusy(false);
        setPhase(micEnabled ? "listening" : "idle");
        setStatus(`Response complete${event.response?.id ? ` · ${event.response.id}` : ""}`);
        break;
      case "error":
        setBusy(false);
        setPhase(connected ? "idle" : "idle");
        setStatus(event.message || "xAI realtime error");
        appendLog("system", `Error · ${event.message || "Unknown realtime error"}`);
        break;
      default:
        break;
    }
  };

  const connectVoice = async () => {
    if (!runtime.voice?.configured) {
      setStatus("XAI_API_KEY missing on the backend");
      appendLog("system", "Cannot connect. Configure XAI_API_KEY on web/backend first.");
      return;
    }
    try {
      setBusy(true);
      setPhase("connecting");
      await ensurePlaybackContext();
      const session = await runtime.createVoiceSession({
        voice,
        instructions: runtime.voice?.instructions,
        expires_after: { seconds: 300 },
      });
      const token = extractVoiceToken(session);
      if (!token) throw new Error("xAI realtime token was not returned by the backend");
      const realtimeUrl = session.realtimeUrl || runtime.voice?.realtimeUrl || "wss://api.x.ai/v1/realtime";
      appendLog("system", `Connecting to ${realtimeUrl} · voice ${voice}`);
      const socket = new WebSocket(realtimeUrl, [`xai-client-secret.${token}`]);
      wsRef.current = socket;
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: "session.update", session: buildSessionConfig() }));
      };
      socket.onmessage = async (message) => {
        const data = typeof message.data === "string" ? message.data : await message.data.text();
        const event = JSON.parse(data);
        handleRealtimeEvent(event);
      };
      socket.onerror = () => {
        setBusy(false);
        setPhase("idle");
        setStatus("WebSocket error while connecting to xAI realtime");
        appendLog("system", "WebSocket error while connecting to xAI realtime");
      };
      socket.onclose = (event) => {
        sessionReadyRef.current = false;
        micBufferRef.current = [];
        stopMicCapture();
        stopPlayback();
        wsRef.current = null;
        setConnected(false);
        setBusy(false);
        setMicEnabled(false);
        setPhase("idle");
        setSessionId("");
        setAssistantDraft("");
        assistantDraftRef.current = "";
        setStatus(`Realtime disconnected (${event.code})`);
        appendLog("system", `Realtime disconnected (${event.code})`);
      };
    } catch (err) {
      setBusy(false);
      setPhase("idle");
      setStatus(err instanceof Error ? err.message : "Unable to connect to Grok voice");
      appendLog("system", err instanceof Error ? err.message : "Unable to connect to Grok voice");
    }
  };

  const startMicCapture = async () => {
    if (micEnabled) return;
    if (!connected || !wsRef.current) {
      setStatus("Connect the realtime session before starting the microphone");
      return;
    }
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) throw new Error("Web Audio is not supported in this browser");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioCtor({ sampleRate: Number(sampleRate) || 24000 });
      if (audioContext.state === "suspended") await audioContext.resume();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const silence = audioContext.createGain();
      silence.gain.value = 0;
      source.connect(processor);
      processor.connect(silence);
      silence.connect(audioContext.destination);
      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const chunk = float32ToBase64PCM16(input);
        if (!sessionReadyRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          micBufferRef.current.push(chunk);
          if (micBufferRef.current.length > 120) micBufferRef.current.shift();
          return;
        }
        wsRef.current.send(JSON.stringify({ type: "input_audio_buffer.append", audio: chunk }));
      };
      micStreamRef.current = stream;
      inputContextRef.current = audioContext;
      inputSourceRef.current = source;
      inputProcessorRef.current = processor;
      inputSilenceRef.current = silence;
      setMicEnabled(true);
      setPhase("listening");
      setStatus("Microphone capture live");
      appendLog("system", `Microphone started · buffering until session.updated at ${sampleRate}Hz`);
      sendBufferedAudio();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Unable to start microphone");
      appendLog("system", err instanceof Error ? err.message : "Unable to start microphone");
    }
  };

  const sendTextPrompt = () => {
    if (!connected || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !textPrompt.trim()) {
      setStatus("Connect realtime voice before sending a text turn");
      return;
    }
    stopPlayback();
    assistantDraftRef.current = "";
    setAssistantDraft("");
    wsRef.current.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: textPrompt.trim() }],
        },
      }),
    );
    wsRef.current.send(JSON.stringify({ type: "response.create" }));
    appendLog("user", textPrompt.trim());
    setPhase("thinking");
    setBusy(true);
    setStatus("Submitted text turn to Grok voice");
  };

  const playTTS = async () => {
    if (!runtime.voice?.configured) {
      setStatus("XAI_API_KEY missing on the backend");
      return;
    }
    if (!ttsText.trim()) return;
    try {
      setBusy(true);
      const blob = await runtime.speakTTS({
        text: ttsText,
        voice_id: voice.toLowerCase(),
        language: "en",
        output_format: { codec: "mp3", sample_rate: 24000, bit_rate: 128000 },
      });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
      await audio.play();
      setStatus(`TTS playback started · ${voice}`);
      appendLog("system", `TTS preview via /api/xai/tts · ${voice}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "TTS request failed");
      appendLog("system", err instanceof Error ? err.message : "TTS request failed");
    } finally {
      setBusy(false);
    }
  };

  const orbColor =
    phase === "listening"
      ? T.green
      : phase === "speaking"
        ? T.purple
        : phase === "thinking"
          ? T.orange
          : phase === "connecting"
            ? "#FFD700"
            : T.purple;
  const r1 = 1.05 + pulse * 0.25;
  const r2 = 1.2 + pulse * 0.55;
  const a1 = (1 - pulse) * 0.34;
  const a2 = (1 - pulse) * 0.22;
  const tools = [
    ...(toolsEnabled.web ? ["web_search"] : []),
    ...(toolsEnabled.x ? ["x_search"] : []),
  ];
  const configJson = JSON.stringify({ type: "session.update", session: buildSessionConfig() });

  return (
    <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <RuntimeRail runtime={runtime} />
      <Panel style={{ width: "100%" }}>
        <Label>Grok Voice Agent</Label>
        <div style={{ fontSize: 10, fontFamily: T.mono, color: T.textSec, marginBottom: 8 }}>
          xAI Realtime API · {runtime.voice?.realtimeUrl || "wss://api.x.ai/v1/realtime"} · {voice} · PCM {sampleRate}Hz
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <Metric label="Backend" value={runtime.voice?.configured ? "READY" : "MISSING"} tone={runtime.voice?.configured ? "green" : "danger"} />
          <Metric label="Session" value={connected ? "LIVE" : "IDLE"} tone={connected ? "purple" : "orange"} />
          <Metric label="Mic" value={micEnabled ? "HOT" : "OFF"} tone={micEnabled ? "green" : "orange"} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
          <svg width="240" height="240" viewBox="0 0 360 360">
            <circle cx="180" cy="180" r={108 * r2} fill="none" stroke={orbColor} strokeWidth="3" opacity={a2} />
            <circle cx="180" cy="180" r={108 * r1} fill="none" stroke={orbColor} strokeWidth="3" opacity={a1} />
            <defs>
              <radialGradient id="voice-orb-gradient" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor={orbColor} stopOpacity="0.96" />
                <stop offset="50%" stopColor={T.purple} stopOpacity="0.48" />
                <stop offset="100%" stopColor={T.surface} stopOpacity="0.78" />
              </radialGradient>
            </defs>
            <circle cx="180" cy="180" r="108" fill="url(#voice-orb-gradient)" />
            <circle cx="180" cy="180" r="108" fill="none" stroke={orbColor} strokeWidth="1" opacity="0.34" />
          </svg>
        </div>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <span
            style={{
              padding: "6px 16px",
              borderRadius: 99,
              border: `1px solid ${orbColor}33`,
              background: `${orbColor}15`,
              fontSize: 12,
              fontFamily: T.mono,
              color: T.text,
              fontWeight: 600,
            }}
          >
            {phase === "idle"
              ? connected
                ? "Connected · ready for text or mic"
                : "Tap CONNECT to start"
              : phase === "connecting"
                ? "Connecting..."
                : phase === "listening"
                  ? "Listening (server_vad)"
                  : phase === "speaking"
                    ? `Speaking · ${voice}`
                    : "Thinking..."}
          </span>
        </div>
        <div style={{ textAlign: "center", fontSize: 10, fontFamily: T.mono, color: T.textSec }}>
          {status}
          {sessionId ? <><br />Session: {sessionId}</> : null}
        </div>
      </Panel>

      <div style={{ display: "flex", gap: 4, width: "100%", marginBottom: 8, overflowX: "auto", paddingBottom: 2 }}>
        {GROK_VOICES.map((entry) => (
          <button
            key={entry.id}
            onClick={() => setVoice(entry.id)}
            style={{
              padding: "6px 10px",
              borderRadius: 3,
              border: `1px solid ${voice === entry.id ? T.purple : T.border}`,
              background: voice === entry.id ? T.purpleSoft : "transparent",
              color: voice === entry.id ? T.purple : T.textSec,
              fontFamily: T.mono,
              fontSize: 9,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <div style={{ fontWeight: 700 }}>{entry.id}</div>
            <div style={{ fontSize: 7, opacity: 0.7 }}>{entry.type} · {entry.tone}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, width: "100%", marginBottom: 8 }}>
        {!connected ? (
          <Btn onClick={connectVoice} tone="green" full disabled={busy} style={{ flex: 1 }}>
            {busy ? "CONNECTING" : "CONNECT"}
          </Btn>
        ) : (
          <>
            <Btn onClick={micEnabled ? stopMicCapture : startMicCapture} tone="green" full disabled={busy} style={{ flex: 1 }}>
              {micEnabled ? "MUTE MIC" : "START MIC"}
            </Btn>
            <Btn onClick={sendTextPrompt} tone="purple" full disabled={busy || !textPrompt.trim()} style={{ flex: 1 }}>
              SEND TEXT
            </Btn>
            <Btn onClick={() => disconnect("Disconnected by operator")} tone="orange" full style={{ flex: 1 }}>
              DISCONNECT
            </Btn>
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, width: "100%", marginBottom: 8 }}>
        <button
          onClick={() => setShowConfig((current) => !current)}
          style={{
            flex: 1,
            padding: 6,
            borderRadius: 3,
            border: `1px solid ${T.border}`,
            background: showConfig ? T.purpleSoft : "transparent",
            color: showConfig ? T.purple : T.textSec,
            fontFamily: T.mono,
            fontSize: 9,
            cursor: "pointer",
          }}
        >
          Session Config {showConfig ? "▲" : "▼"}
        </button>
        <button
          onClick={() => setShowProtocol((current) => !current)}
          style={{
            flex: 1,
            padding: 6,
            borderRadius: 3,
            border: `1px solid ${T.border}`,
            background: showProtocol ? T.orangeSoft : "transparent",
            color: showProtocol ? T.orange : T.textSec,
            fontFamily: T.mono,
            fontSize: 9,
            cursor: "pointer",
          }}
        >
          Protocol Ref {showProtocol ? "▲" : "▼"}
        </button>
      </div>

      {showConfig ? (
        <Panel style={{ width: "100%" }}>
          <Label>Session Config</Label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 8, color: T.textSec, fontFamily: T.mono, marginBottom: 2 }}>VAD Threshold</div>
              <Input value={vadThreshold} onChange={setVadThreshold} />
            </div>
            <div>
              <div style={{ fontSize: 8, color: T.textSec, fontFamily: T.mono, marginBottom: 2 }}>Silence Duration (ms)</div>
              <Input value={silenceDuration} onChange={setSilenceDuration} />
            </div>
          </div>
          <div style={{ fontSize: 8, color: T.textSec, fontFamily: T.mono, marginBottom: 2 }}>Audio Format</div>
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {["8000", "16000", "24000", "44100", "48000"].map((rate) => (
              <button
                key={rate}
                onClick={() => setSampleRate(rate)}
                style={{
                  flex: 1,
                  padding: 4,
                  borderRadius: 2,
                  border: `1px solid ${sampleRate === rate ? T.purple : T.border}`,
                  background: sampleRate === rate ? T.purpleSoft : "transparent",
                  color: sampleRate === rate ? T.purple : T.textSec,
                  fontFamily: T.mono,
                  fontSize: 8,
                  cursor: "pointer",
                }}
              >
                {rate}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 8, color: T.textSec, fontFamily: T.mono, marginBottom: 4 }}>Tools</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {[
              { key: "web", label: "Web Search" },
              { key: "x", label: "X Search" },
            ].map((tool) => (
              <button
                key={tool.key}
                onClick={() => setToolsEnabled((current) => ({ ...current, [tool.key]: !current[tool.key] }))}
                style={{
                  flex: 1,
                  padding: 6,
                  borderRadius: 3,
                  border: `1px solid ${toolsEnabled[tool.key] ? T.green : T.border}`,
                  background: toolsEnabled[tool.key] ? T.greenSoft : "transparent",
                  color: toolsEnabled[tool.key] ? T.green : T.textSec,
                  fontFamily: T.mono,
                  fontSize: 9,
                  cursor: "pointer",
                }}
              >
                {tool.label} {toolsEnabled[tool.key] ? "✓" : "○"}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 8, fontFamily: T.mono, color: T.textSec, padding: 6, background: T.codeBg, borderRadius: 3, lineHeight: 1.5, wordBreak: "break-all" }}>
            {configJson}
          </div>
        </Panel>
      ) : null}

      {showProtocol ? (
        <Panel tone="purple" style={{ width: "100%" }}>
          <Label tone="purple">Realtime Protocol</Label>
          <div style={{ fontSize: 9, fontFamily: T.mono, color: T.purple, marginBottom: 4, fontWeight: 700 }}>Client Events</div>
          {[
            "session.update → configure voice, tools, VAD, audio",
            "input_audio_buffer.append → stream base64 PCM16 chunks",
            "conversation.item.create → send text message",
            "response.create → request assistant response",
            "response.cancel → interrupt current response",
          ].map((entry) => (
            <div key={entry} style={{ fontSize: 9, fontFamily: T.mono, color: T.textSec, padding: "2px 0", borderBottom: `1px solid ${T.border}05` }}>
              <code style={{ color: T.green }}>→</code> {entry}
            </div>
          ))}
          <div style={{ fontSize: 9, fontFamily: T.mono, color: T.purple, marginTop: 8, marginBottom: 4, fontWeight: 700 }}>Server Events</div>
          {[
            "session.created / session.updated",
            "input_audio_buffer.speech_started / speech_stopped",
            "conversation.item.input_audio_transcription.completed",
            "response.output_audio.delta",
            "response.output_audio_transcript.delta",
            "response.done / error",
          ].map((entry) => (
            <div key={entry} style={{ fontSize: 9, fontFamily: T.mono, color: T.textSec, padding: "2px 0", borderBottom: `1px solid ${T.border}05` }}>
              <code style={{ color: T.orange }}>←</code> {entry}
            </div>
          ))}
          <div style={{ fontSize: 9, fontFamily: T.mono, color: T.textSec, marginTop: 8 }}>
            Backend proxy endpoints:
            <br />
            `/api/xai/status` · `/api/xai/realtime/session` · `/api/xai/tts`
          </div>
        </Panel>
      ) : null}

      <Panel tone="orange" style={{ width: "100%" }}>
        <Label tone="orange">Text + TTS</Label>
        <TextArea value={textPrompt} onChange={setTextPrompt} placeholder="Text turn for realtime Grok voice" rows={3} />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <Btn tone="purple" full onClick={sendTextPrompt} disabled={!connected || busy || !textPrompt.trim()} style={{ flex: 1 }}>
            Ask Realtime
          </Btn>
          <Btn tone="green" full onClick={playTTS} disabled={busy || !ttsText.trim()} style={{ flex: 1 }}>
            Preview TTS
          </Btn>
        </div>
        <TextArea value={ttsText} onChange={setTtsText} placeholder="Text for xAI TTS preview" rows={3} style={{ marginTop: 8 }} />
      </Panel>

      <Panel tone="purple" style={{ width: "100%" }}>
        <Label tone="purple">Voice Log</Label>
        <div style={{ fontSize: 10, fontFamily: T.mono, color: T.textSec, marginBottom: 8 }}>
          Tools: {tools.length ? tools.join(", ") : "none"} · Backend {runtime.voice?.configured ? "configured" : "missing"}
        </div>
        {assistantDraft ? (
          <div style={{ padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
            <span style={{ color: T.purple, fontWeight: 700, marginRight: 6 }}>LIVE</span>
            <span style={{ color: T.text }}>{assistantDraft}</span>
          </div>
        ) : null}
        <div style={{ maxHeight: 220, overflowY: "auto" }}>
          {transcript.length === 0 ? (
            <div style={{ fontSize: 11, fontFamily: T.mono, color: T.textSec }}>{">"} Connect to start a Grok voice session</div>
          ) : (
            transcript.map((entry, index) => (
              <div key={`${entry.role}-${index}`} style={{ padding: "4px 0", borderBottom: `1px solid ${T.border}05`, fontSize: 10, fontFamily: T.mono }}>
                <span
                  style={{
                    color: entry.role === "user" ? T.green : entry.role === "assistant" ? T.purple : T.orange,
                    fontWeight: 700,
                    marginRight: 6,
                  }}
                >
                  {entry.role === "system" ? "SYS" : entry.role === "user" ? "YOU" : voice.toUpperCase()}
                </span>
                <span style={{ color: entry.role === "system" ? T.textSec : T.text }}>{entry.text}</span>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}

function OREScreen({ runtime }) {
  const [status, setStatus] = useState("");
  const [fanDraft, setFanDraft] = useState({});

  const runAction = async (deviceId, action, method = "POST", payload = null, successLabel = action) => {
    try {
      await runtime.updateFleet(deviceId, action, method, payload);
      setStatus(`${successLabel} applied to ${deviceId}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Fleet action failed");
    }
  };

  return (
    <div style={{ padding: "0 16px" }}>
      <RuntimeRail runtime={runtime} />
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Metric label="Devices" value={fmtNumber(runtime.fleet?.totalDevices ?? 0)} tone="green" />
        <Metric label="Hashrate" value={fmtHash(runtime.fleet?.totalHashRate ?? 0)} tone="purple" />
        <Metric label="Power" value={`${fmtNumber(runtime.fleet?.totalPower ?? 0)} W`} tone="orange" />
      </div>
      {runtime.fleet?.devices?.map((device) => (
        <Panel key={device.id} tone="orange">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 16, fontFamily: T.display, color: T.text }}>{device.id}</div>
              <div style={{ fontSize: 11, fontFamily: T.mono, color: T.textSec }}>{device.ip} · {device.health}</div>
            </div>
            <div style={{ fontSize: 18, fontFamily: T.display, color: T.purple }}>{fmtHash(device.hashRate)}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
            <Metric label="Temp" value={`${fmtNumber(device.temp, 1)}°C`} tone="orange" />
            <Metric label="Fan" value={`${fmtNumber(device.fanSpeed)}%`} tone="green" />
            <Metric label="Shares" value={fmtCompact(device.sharesAccepted)} tone="purple" />
          </div>
          <div style={{ fontSize: 11, fontFamily: T.mono, color: T.textSec, marginBottom: 8 }}>
            Pool: {device.poolUrl}:{device.poolPort} · User: {device.poolUser} · Frequency: {device.frequencyMHz} MHz
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <Btn tone="purple" full onClick={() => runAction(device.id, "identify", "POST", null, "Identify")} style={{ flex: 1 }}>Identify</Btn>
            <Btn tone="danger" full onClick={() => runAction(device.id, "restart", "POST", null, "Restart")} style={{ flex: 1 }}>Restart</Btn>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
            <Input
              value={fanDraft[device.id] ?? String(device.fanSpeed)}
              onChange={(value) => setFanDraft((current) => ({ ...current, [device.id]: value }))}
              placeholder="Fan speed"
            />
            <Btn
              tone="green"
              onClick={() => runAction(device.id, "fan", "PATCH", { fanSpeed: Number(fanDraft[device.id] ?? device.fanSpeed) }, "Fan update")}
            >
              Set Fan
            </Btn>
          </div>
        </Panel>
      ))}
      {status ? <Panel><Label>Fleet Event</Label><div style={{ fontSize: 12, fontFamily: T.mono, color: T.text }}>{status}</div></Panel> : null}
    </div>
  );
}

function ScreenScreen({ runtime }) {
  const [status, setStatus] = useState("");

  const sync = async () => {
    try {
      await runtime.postThread({
        author: "canvas.surface",
        headline: "Canvas sync requested",
        body: `Operator synced canvas against ${runtime.setupCode?.url || "runtime endpoint"}.`,
        kind: "canvas",
        stats: "manual-sync",
      });
      setStatus("Canvas sync note sent to control API");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Canvas sync failed");
    }
  };

  return (
    <div style={{ padding: "0 16px" }}>
      <RuntimeRail runtime={runtime} />
      <Panel style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center", background: T.codeBg }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 20, fontFamily: T.display, color: T.purple, marginBottom: 8 }}>CANVAS READY</div>
          <div style={{ fontSize: 11, fontFamily: T.mono, color: T.textSec, lineHeight: 1.7 }}>
            Runtime target
            <br />
            {runtime.setupCode?.url || "--"}
          </div>
        </div>
      </Panel>
      <Btn tone="purple" full onClick={sync}>Sync Canvas State</Btn>
      {status ? <Panel tone="purple"><Label tone="purple">Bridge Status</Label><div style={{ fontSize: 12, fontFamily: T.mono, color: T.text }}>{status}</div></Panel> : null}
    </div>
  );
}

function SettingsScreen({ runtime }) {
  const [status, setStatus] = useState("");

  const announce = async () => {
    try {
      const created = await runtime.postThread({
        author: "settings.surface",
        headline: "Runtime settings checkpoint",
        body: `Gateway ${runtime.health?.service || "unknown"} is healthy=${String(runtime.health?.status === "healthy")}, model=${runtime.config?.model || "--"}, grok=${runtime.config?.grokModel || "--"}.`,
        kind: "settings",
        stats: runtime.health?.version || "web",
      });
      setStatus(`Logged ${created.id}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Settings note failed");
    }
  };

  return (
    <div style={{ padding: "0 16px" }}>
      <RuntimeRail runtime={runtime} />
      <Panel>
        <Label>Runtime</Label>
        {[
          ["Gateway", runtime.health?.service || "--"],
          ["Version", runtime.health?.version || "--"],
          ["Control API", runtime.health?.controlAPI || "--"],
          ["Fleet API", runtime.health?.fleetAPI || "--"],
          ["OpenRouter", runtime.config?.enabled ? "configured" : "disabled"],
          ["Model", runtime.config?.model || "--"],
          ["Vision", runtime.config?.grokModel || "--"],
        ].map(([key, value]) => (
          <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 12 }}>
            <span style={{ color: T.textSec }}>{key}</span>
            <span style={{ color: T.green }}>{value}</span>
          </div>
        ))}
      </Panel>
      <Panel tone="orange">
        <Label tone="orange">Backend Snapshot</Label>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <Metric label="Threads" value={fmtNumber(runtime.threads.length)} tone="green" />
          <Metric label="Intents" value={fmtNumber(runtime.intents.length)} tone="purple" />
          <Metric label="Fleet" value={fmtNumber(runtime.fleet?.onlineDevices ?? 0)} tone="orange" />
        </div>
        <Btn tone="orange" full onClick={announce}>Post Settings Checkpoint</Btn>
        {status ? <div style={{ marginTop: 8, fontSize: 11, fontFamily: T.mono, color: T.orange }}>{status}</div> : null}
      </Panel>
    </div>
  );
}

function renderTab(tab, runtime) {
  switch (tab) {
    case "connect":
      return <ConnectScreen runtime={runtime} />;
    case "solana":
      return <SolanaScreen runtime={runtime} />;
    case "grok":
      return <GrokScreen runtime={runtime} />;
    case "chat":
      return <ChatScreen runtime={runtime} />;
    case "arcade":
      return <ArcadeScreen runtime={runtime} />;
    case "voice":
      return <VoiceScreen runtime={runtime} />;
    case "ore":
      return <OREScreen runtime={runtime} />;
    case "screen":
      return <ScreenScreen runtime={runtime} />;
    case "settings":
      return <SettingsScreen runtime={runtime} />;
    default:
      return null;
  }
}

export default function SolanaOSApp() {
  const runtime = useRuntime();
  const [tab, setTab] = useState("connect");
  const [time, setTime] = useState("9:41");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(`${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`);
    };
    update();
    const timer = window.setInterval(update, 30000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div style={{ width: "100%", maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: T.bg, color: T.green, fontFamily: T.mono, position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #000; }
        button { transition: transform 0.1s ease, opacity 0.2s ease; }
        button:active { transform: scale(0.98); }
        input::placeholder, textarea::placeholder { color: rgba(20,241,149,0.22); }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(20,241,149,0.25); border-radius: 999px; }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes scan { 0% { top: -2px; } 100% { top: 100%; } }
        .float-anim { animation: float 3s ease-in-out infinite; }
      `}</style>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 1000 }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${T.green}10, transparent)`, animation: "scan 4s linear infinite" }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px 8px", color: T.green, position: "relative", zIndex: 1 }}>
        <span>{time}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 22, height: 10, borderRadius: 2, border: `1px solid ${T.green}`, position: "relative" }}>
            <div style={{ width: "72%", height: "100%", background: T.green }} />
          </div>
          <div style={{ width: 6, height: 6, borderRadius: 6, background: T.green, boxShadow: `0 0 8px ${T.green}` }} />
        </div>
      </div>

      <div style={{ textAlign: "center", fontFamily: T.display, fontSize: 13, letterSpacing: 3, color: T.purple, padding: "2px 0 12px", textTransform: "uppercase" }}>
        {TABS.find((entry) => entry.id === tab)?.label}
      </div>

      <div style={{ height: tab === "chat" ? "calc(100vh - 140px)" : "calc(100vh - 130px)", overflowY: "auto", overflowX: "hidden", paddingBottom: 80 }}>
        {runtime.loading ? (
          <div style={{ padding: "0 16px" }}>
            <Panel>
              <Label>Booting Runtime</Label>
              <div style={{ fontSize: 12, fontFamily: T.mono, color: T.textSec }}>Loading shared gateway, control, fleet, and setup state...</div>
            </Panel>
          </div>
        ) : (
          renderTab(tab, runtime)
        )}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: `linear-gradient(to top, ${T.bg} 80%, transparent)`, borderTop: `1px solid ${T.green}15`, zIndex: 5, overflowX: "auto", overflowY: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px 10px", minWidth: 430 }}>
          {TABS.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setTab(entry.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "3px 4px",
                color: tab === entry.id ? T.green : `${T.green}40`,
                minWidth: 0,
                flex: "0 0 auto",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: "bold", textShadow: tab === entry.id ? `0 0 8px ${T.green}` : "none" }}>{entry.icon}</span>
              <span style={{ fontSize: 7, letterSpacing: 1, fontFamily: T.display, whiteSpace: "nowrap" }}>{entry.label.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={{ position: "fixed", bottom: 3, left: "50%", transform: "translateX(-50%)", width: 100, height: 4, background: `${T.purple}50`, borderRadius: 2, zIndex: 6 }} />
    </div>
  );
}
