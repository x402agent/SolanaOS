"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Monitor,
  Server,
  Shield,
  Terminal,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import {
  loadBrowserGatewaySettings,
  saveBrowserGatewaySettings,
  type BrowserGatewaySettings,
} from "@/lib/gateway/gateway-settings-store";

/* ── Helpers ───────────────────────────────────────────────── */

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="ml-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/40 transition hover:bg-white/10 hover:text-white"
      aria-label="Copy"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
};

const CodeBlock = ({ children }: { children: string }) => (
  <div className="group flex items-center rounded-md border border-[#9945FF]/20 bg-black/60 px-3 py-2">
    <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[12px] text-[#14F195]">
      {children}
    </code>
    <CopyButton text={children} />
  </div>
);

const StepBadge = ({ n, done }: { n: number; done: boolean }) => (
  <div
    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold transition-colors ${
      done
        ? "bg-[#14F195]/20 text-[#14F195]"
        : "border border-[#9945FF]/40 bg-[#9945FF]/10 text-[#9945FF]"
    }`}
  >
    {done ? <Check className="h-3.5 w-3.5" /> : n}
  </div>
);

/* ── Collapsible install methods ───────────────────────────── */

const installMethods = [
  {
    id: "npm",
    label: "npm (recommended)",
    command: "npx solanaos-computer@latest install --with-web",
  },
  {
    id: "source",
    label: "Build from source",
    command: "git clone https://github.com/x402agent/SolanaOS.git && cd SolanaOS && make build",
  },
  {
    id: "fly",
    label: "Deploy to Fly.io (cloud)",
    command: "bash scripts/fly-deploy.sh daemon --app my-solanaos",
  },
] as const;

const exposeMethods = [
  {
    id: "tailscale",
    label: "Tailscale (zero-config VPN)",
    desc: "Install Tailscale on your machine. Gateway auto-detects your Tailscale IP.",
    command: "solanaos gateway start",
    urlHint: "wss://<your-tailnet-host>:18790",
  },
  {
    id: "ngrok",
    label: "ngrok (quick tunnel)",
    desc: "Expose your local gateway with a public URL in one command.",
    command: "ngrok tcp 18790",
    urlHint: "wss://<ngrok-host>:<port>",
  },
  {
    id: "fly",
    label: "Fly.io (always-on cloud)",
    desc: "Deploy the gateway to Fly.io for 24/7 uptime.",
    command: "bash scripts/fly-deploy.sh daemon --app my-solanaos",
    urlHint: "wss://my-solanaos.fly.dev:18790",
  },
  {
    id: "local",
    label: "Local network only",
    desc: "Connect from the same machine or LAN. No public exposure.",
    command: "solanaos gateway start --no-tailscale",
    urlHint: "ws://localhost:18790",
  },
] as const;

/* ── Main Page ─────────────────────────────────────────────── */

export default function GatewaySetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [openInstall, setOpenInstall] = useState<string | null>("npm");
  const [openExpose, setOpenExpose] = useState<string | null>("tailscale");
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "success" | "error">("idle");
  const [testError, setTestError] = useState("");

  // Load saved settings on mount
  useEffect(() => {
    const saved = loadBrowserGatewaySettings();
    if (saved.gatewayUrl) setGatewayUrl(saved.gatewayUrl);
    if (saved.token) setToken(saved.token);
    if (saved.lastConnected) setStep(3);
  }, []);

  const testConnection = useCallback(async () => {
    if (!gatewayUrl.trim()) return;
    setTesting(true);
    setTestResult("idle");
    setTestError("");

    try {
      const wsUrl = gatewayUrl.trim();
      const ws = new WebSocket(wsUrl);
      const timeout = setTimeout(() => {
        ws.close();
        setTesting(false);
        setTestResult("error");
        setTestError("Connection timed out after 8 seconds.");
      }, 8000);

      ws.onopen = () => {
        clearTimeout(timeout);
        // Send a hello frame
        ws.send(
          JSON.stringify({
            type: "req",
            id: "test-1",
            method: "hello",
            params: { clientName: "solanaos-gateway-setup", token },
          })
        );
      };

      ws.onmessage = (ev) => {
        clearTimeout(timeout);
        ws.close();
        setTesting(false);
        setTestResult("success");
        // Save to localStorage
        saveBrowserGatewaySettings({
          gatewayUrl: wsUrl,
          token,
          lastConnected: new Date().toISOString(),
        });
        setStep(3);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        ws.close();
        setTesting(false);
        setTestResult("error");
        setTestError(
          "Could not connect. Check the URL and ensure your gateway is running."
        );
      };

      ws.onclose = (ev) => {
        if (testResult === "idle" && !testing) return; // already handled
        clearTimeout(timeout);
        if (ev.code !== 1000) {
          setTesting(false);
          setTestResult("error");
          setTestError(
            ev.reason || `Connection closed (code ${ev.code}).`
          );
        }
      };
    } catch (err) {
      setTesting(false);
      setTestResult("error");
      setTestError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [gatewayUrl, token, testing, testResult]);

  const goToOffice = useCallback(() => {
    // Save settings and redirect
    saveBrowserGatewaySettings({
      gatewayUrl: gatewayUrl.trim(),
      token,
      lastConnected: new Date().toISOString(),
    });
    router.push("/office");
  }, [gatewayUrl, token, router]);

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-y-auto bg-[#0a0a14] pb-20">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(153,69,255,0.08),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(20,241,149,0.05),transparent_50%)]" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(transparent 95%, rgba(153,69,255,0.12) 96%), linear-gradient(90deg, transparent 95%, rgba(20,241,149,0.08) 96%)",
            backgroundSize: "30px 30px",
          }}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 w-full max-w-2xl px-6 pt-12">
        <div className="mb-2 font-mono text-[10px] font-medium tracking-[0.2em] text-[#9945FF]">
          SOLANAOS GATEWAY
        </div>
        <h1 className="font-display text-4xl tracking-wide text-white sm:text-5xl">
          Start Your Gateway
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/60">
          Run a SolanaOS gateway on your machine or in the cloud, then connect
          from this dashboard to control your agents, wallets, and trading
          workflows.
        </p>

        {/* Feature pills */}
        <div className="mt-5 flex flex-wrap gap-2">
          {[
            { icon: Zap, label: "Real-time agents" },
            { icon: Shield, label: "Self-custodial" },
            { icon: Server, label: "Your infrastructure" },
            { icon: Monitor, label: "Any device" },
          ].map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[11px] text-white/50"
            >
              <Icon className="h-3 w-3 text-[#14F195]/70" />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Quick Join — shared public gateway */}
      <div className="relative z-10 mt-8 w-full max-w-2xl px-6">
        <div className="rounded-xl border border-[#14F195]/20 bg-[#14F195]/[0.04] p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#14F195]/15">
              <Zap className="h-4 w-4 text-[#14F195]" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-white">
                Quick Join — Public Gateway
              </h2>
              <p className="mt-1 text-xs text-white/50">
                Connect instantly to the shared SolanaOS gateway. No setup
                required — create your agents and start building right away.
              </p>
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#14F195] px-5 py-2.5 text-sm font-bold text-[#0a0a14] transition hover:bg-[#14F195]/90"
                onClick={() => {
                  saveBrowserGatewaySettings({
                    gatewayUrl: "wss://my-solanaos.fly.dev:18790",
                    token: "",
                    lastConnected: new Date().toISOString(),
                  });
                  router.push("/office");
                }}
              >
                <Terminal className="h-4 w-4" />
                Enter the Office
              </button>
            </div>
          </div>
        </div>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] font-medium tracking-[0.15em] text-white/30">
            OR SET UP YOUR OWN
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative z-10 flex w-full max-w-2xl gap-1.5 px-6">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              s <= step ? "bg-[#9945FF]" : "bg-white/10"
            }`}
          />
        ))}
      </div>

      {/* Step 1: Install */}
      <section className="relative z-10 mt-8 w-full max-w-2xl px-6">
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
          <div className="flex items-start gap-3">
            <StepBadge n={1} done={step > 1} />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-white">
                Install & Start the Gateway
              </h2>
              <p className="mt-1 text-xs text-white/50">
                Choose your install method. The gateway is a single Go binary
                (&lt;10MB).
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {installMethods.map((m) => (
              <div key={m.id} className="rounded-lg border border-white/5 bg-black/30">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left"
                  onClick={() =>
                    setOpenInstall(openInstall === m.id ? null : m.id)
                  }
                >
                  <span className="text-xs font-medium text-white/80">
                    {m.label}
                  </span>
                  {openInstall === m.id ? (
                    <ChevronUp className="h-3.5 w-3.5 text-white/40" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-white/40" />
                  )}
                </button>
                {openInstall === m.id && (
                  <div className="border-t border-white/5 px-4 py-3">
                    <CodeBlock>{m.command}</CodeBlock>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4">
            <p className="text-xs text-white/40">
              After installing, start the gateway:
            </p>
            <div className="mt-2">
              <CodeBlock>solanaos gateway start</CodeBlock>
            </div>
          </div>

          {step === 1 && (
            <button
              type="button"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#9945FF] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#9945FF]/80"
              onClick={() => setStep(2)}
            >
              Gateway is running
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </section>

      {/* Step 2: Connect */}
      <section className="relative z-10 mt-4 w-full max-w-2xl px-6">
        <div
          className={`rounded-xl border border-white/8 bg-white/[0.02] p-5 transition-opacity ${
            step < 2 ? "pointer-events-none opacity-40" : ""
          }`}
        >
          <div className="flex items-start gap-3">
            <StepBadge n={2} done={step > 2} />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-white">
                Connect to Your Gateway
              </h2>
              <p className="mt-1 text-xs text-white/50">
                Expose your gateway and enter the connection details below.
              </p>
            </div>
          </div>

          {/* Expose methods */}
          <div className="mt-4 space-y-2">
            {exposeMethods.map((m) => (
              <div key={m.id} className="rounded-lg border border-white/5 bg-black/30">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left"
                  onClick={() =>
                    setOpenExpose(openExpose === m.id ? null : m.id)
                  }
                >
                  <span className="text-xs font-medium text-white/80">
                    {m.label}
                  </span>
                  {openExpose === m.id ? (
                    <ChevronUp className="h-3.5 w-3.5 text-white/40" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-white/40" />
                  )}
                </button>
                {openExpose === m.id && (
                  <div className="space-y-2 border-t border-white/5 px-4 py-3">
                    <p className="text-[11px] text-white/50">{m.desc}</p>
                    <CodeBlock>{m.command}</CodeBlock>
                    <p className="text-[10px] text-white/35">
                      URL format:{" "}
                      <code className="text-[#14F195]/60">{m.urlHint}</code>
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Connection form */}
          <div className="mt-5 space-y-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-white/70">
                Gateway URL
              </span>
              <input
                className="h-9 rounded-md border border-white/10 bg-white/5 px-3 font-mono text-sm text-white outline-none placeholder:text-white/25 focus:border-[#14F195]/50"
                type="text"
                value={gatewayUrl}
                onChange={(e) => {
                  setGatewayUrl(e.target.value);
                  setTestResult("idle");
                }}
                placeholder="wss://your-gateway:18790"
                spellCheck={false}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-white/70">
                Gateway Token
              </span>
              <div className="relative">
                <input
                  className="h-9 w-full rounded-md border border-white/10 bg-white/5 px-3 pr-9 font-mono text-sm text-white outline-none placeholder:text-white/25 focus:border-[#14F195]/50"
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    setTestResult("idle");
                  }}
                  placeholder="your-gateway-token"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-1 my-auto flex h-7 w-7 items-center justify-center rounded text-white/40 hover:text-white"
                  onClick={() => setShowToken((p) => !p)}
                  aria-label={showToken ? "Hide token" : "Show token"}
                >
                  {showToken ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-white/30">
                Found in{" "}
                <code className="text-white/40">~/.solanaos/solanaos.json</code>{" "}
                → <code className="text-white/40">auth.token</code>
              </p>
            </label>

            <button
              type="button"
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-[#9945FF] px-4 text-xs font-semibold text-white transition hover:bg-[#9945FF]/80 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={testConnection}
              disabled={testing || !gatewayUrl.trim()}
            >
              {testing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Testing connection...
                </>
              ) : testResult === "success" ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#14F195]" />
                  Connected!
                </>
              ) : (
                <>
                  <Wifi className="h-3.5 w-3.5" />
                  Test Connection
                </>
              )}
            </button>

            {testResult === "error" && (
              <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {testError}
              </p>
            )}

            {testResult === "success" && (
              <div className="flex items-center gap-2 rounded-md border border-[#14F195]/20 bg-[#14F195]/5 px-3 py-2">
                <CheckCircle2 className="h-4 w-4 text-[#14F195]" />
                <p className="text-xs text-[#14F195]">
                  Gateway is reachable. Settings saved to your browser.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Step 3: Enter */}
      <section className="relative z-10 mt-4 w-full max-w-2xl px-6">
        <div
          className={`rounded-xl border border-white/8 bg-white/[0.02] p-5 transition-opacity ${
            step < 3 ? "pointer-events-none opacity-40" : ""
          }`}
        >
          <div className="flex items-start gap-3">
            <StepBadge n={3} done={false} />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-white">
                Enter Your Workspace
              </h2>
              <p className="mt-1 text-xs text-white/50">
                Your gateway is connected. Open the 3D office to manage your
                agents, trade, and build.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#14F195] px-4 py-3 text-sm font-bold text-[#0a0a14] transition hover:bg-[#14F195]/90"
            onClick={goToOffice}
          >
            <Terminal className="h-4 w-4" />
            Enter SolanaOS Office
          </button>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { label: "Dashboard", href: "/office" },
              { label: "Agents", href: "/agents" },
            ].map(({ label, href }) => (
              <button
                key={label}
                type="button"
                className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-2 text-center text-[11px] font-medium text-white/60 transition hover:bg-white/5 hover:text-white"
                onClick={() => {
                  saveBrowserGatewaySettings({
                    gatewayUrl: gatewayUrl.trim(),
                    token,
                    lastConnected: new Date().toISOString(),
                  });
                  router.push(href);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Help footer */}
      <div className="relative z-10 mt-8 w-full max-w-2xl px-6">
        <div className="border-t border-white/5 pt-4">
          <p className="text-[11px] text-white/30">
            Need help?{" "}
            <a
              href="https://go.solanaos.net"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#14F195]/50 hover:text-[#14F195]"
            >
              Docs
              <ExternalLink className="ml-0.5 inline h-2.5 w-2.5" />
            </a>
            {" · "}
            <a
              href="https://github.com/x402agent/SolanaOS"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#14F195]/50 hover:text-[#14F195]"
            >
              GitHub
              <ExternalLink className="ml-0.5 inline h-2.5 w-2.5" />
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
