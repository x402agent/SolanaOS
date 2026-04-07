import React, { useState, useRef, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';

function encodeSetupCode(payload: { url: string; token?: string; password?: string }): string {
  const json = JSON.stringify(payload);
  const base64 = btoa(json);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const SetupPage: React.FC = () => {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('18790');
  const [tls, setTls] = useState(false);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [downloads, setDownloads] = useState<any>(null);
  const [status, setStatus] = useState('Loading runtime setup…');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const scheme = tls ? 'wss' : 'ws';
  const gatewayUrl = host.trim() ? `${scheme}://${host.trim()}:${port || '18790'}` : '';

  const payload: { url: string; token?: string; password?: string } = { url: gatewayUrl };
  if (token.trim()) payload.token = token.trim();
  if (password.trim()) payload.password = password.trim();

  const setupCode = gatewayUrl ? encodeSetupCode(payload) : '';

  const renderQR = useCallback(() => {
    if (!canvasRef.current || !setupCode) return;
    QRCode.toCanvas(canvasRef.current, setupCode, {
      width: 280,
      margin: 2,
      color: { dark: '#14f195', light: '#08090f' },
      errorCorrectionLevel: 'M',
    });
  }, [setupCode]);

  useEffect(() => {
    renderQR();
  }, [renderQR]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [setupResponse, downloadsResponse] = await Promise.all([
          fetch('/api/setup-code').then((res) => res.json()),
          fetch('/api/setup/downloads').then((res) => res.json()),
        ]);
        if (cancelled) return;
        if (setupResponse.host) setHost(setupResponse.host);
        if (setupResponse.port) setPort(String(setupResponse.port));
        if (typeof setupResponse.tls === 'boolean') setTls(setupResponse.tls);
        if (setupResponse.token) setToken(setupResponse.token);
        if (setupResponse.password) setPassword(setupResponse.password);
        setDownloads(downloadsResponse);
        setStatus(setupResponse.url ? `Gateway target detected: ${setupResponse.url}` : 'Enter a gateway host to generate setup code');
      } catch {
        if (!cancelled) setStatus('Runtime defaults unavailable. Enter gateway details manually.');
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCopy = () => {
    if (!setupCode) return;
    navigator.clipboard.writeText(setupCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-cyber-black text-white font-mono flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-solana-green text-xs tracking-[0.3em] uppercase mb-2">SolanaOS</div>
          <h1 className="text-2xl font-bold tracking-tight">Gateway Setup</h1>
          <p className="text-white/40 text-xs mt-2">
            Generate a QR code to pair your Android device
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-white/50 text-[10px] uppercase tracking-widest mb-1">Gateway Host</label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="192.168.1.100 or my-gateway.example.com"
              className="w-full bg-cyber-gray border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-solana-purple/60 transition-colors"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-white/50 text-[10px] uppercase tracking-widest mb-1">Port</label>
              <input
                type="text"
                value={port}
                onChange={(e) => setPort(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="18790"
                className="w-full bg-cyber-gray border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-solana-purple/60 transition-colors"
              />
            </div>
            <div className="flex items-end pb-1">
              <button
                onClick={() => setTls(!tls)}
                className={`px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                  tls
                    ? 'bg-solana-green/10 border-solana-green/40 text-solana-green'
                    : 'bg-cyber-gray border-cyber-border text-white/40'
                }`}
              >
                {tls ? 'TLS ON' : 'TLS OFF'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-white/50 text-[10px] uppercase tracking-widest mb-1">Token <span className="text-white/20">(optional)</span></label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Bearer token for gateway auth"
              className="w-full bg-cyber-gray border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-solana-purple/60 transition-colors"
            />
          </div>

          <div>
            <label className="block text-white/50 text-[10px] uppercase tracking-widest mb-1">Password <span className="text-white/20">(optional)</span></label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Gateway password"
              className="w-full bg-cyber-gray border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-solana-purple/60 transition-colors"
            />
          </div>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center">
          {setupCode ? (
            <>
              <div className="border border-cyber-border rounded-xl p-4 bg-cyber-gray/50 mb-4">
                <canvas ref={canvasRef} />
              </div>
              <p className="text-white/30 text-[10px] text-center mb-3">
                Scan with the SolanaOS app &rarr; Gateway setup step
              </p>
              <button
                onClick={handleCopy}
                className="px-4 py-2 rounded-lg border border-solana-purple/30 text-solana-purple text-xs hover:bg-solana-purple/10 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy setup code'}
              </button>
              <p className="mt-3 text-white/40 text-[11px] text-center">
                {status}
              </p>
              <div className="mt-4 w-full bg-cyber-gray border border-cyber-border rounded-lg p-3 break-all text-[10px] text-white/30 max-h-20 overflow-auto">
                {setupCode}
              </div>
            </>
          ) : (
            <div className="border border-cyber-border border-dashed rounded-xl p-12 text-center text-white/20 text-xs">
              {status}
            </div>
          )}
        </div>

        {downloads ? (
          <div className="mt-8 space-y-4">
            <div className="rounded-xl border border-cyber-border bg-cyber-gray/40 p-4">
              <div className="text-solana-green text-[10px] uppercase tracking-widest mb-2">Install Everything</div>
              <div className="space-y-2 text-xs text-white/70">
                <a className="block text-solana-purple hover:text-solana-green transition-colors" href={downloads.npmPackage} target="_blank" rel="noreferrer">
                  NPM package: solanaos-computer
                </a>
                <div className="bg-cyber-black border border-cyber-border rounded-lg p-3 break-all text-[11px]">
                  {downloads.runtime?.oneShot}
                </div>
                <div className="bg-cyber-black border border-cyber-border rounded-lg p-3 break-all text-[11px]">
                  {downloads.runtime?.shell}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-cyber-border bg-cyber-gray/40 p-4">
              <div className="text-solana-green text-[10px] uppercase tracking-widest mb-2">Android App</div>
              <div className="space-y-2 text-xs text-white/70">
                <a className="block text-solana-purple hover:text-solana-green transition-colors" href={downloads.android?.releases} target="_blank" rel="noreferrer">
                  Download latest GitHub release
                </a>
                <div className="bg-cyber-black border border-cyber-border rounded-lg p-3 break-all text-[11px]">
                  {downloads.android?.buildCommand}
                </div>
                <div className="text-white/40">APK output: {downloads.android?.apkPath}</div>
              </div>
            </div>

            <div className="rounded-xl border border-cyber-border bg-cyber-gray/40 p-4">
              <div className="text-solana-green text-[10px] uppercase tracking-widest mb-2">Gateway + Web</div>
              <div className="space-y-2 text-xs text-white/70">
                <div className="bg-cyber-black border border-cyber-border rounded-lg p-3 break-all text-[11px]">
                  {downloads.gateway?.runCommand}
                </div>
                <div className="bg-cyber-black border border-cyber-border rounded-lg p-3 break-all text-[11px]">
                  {downloads.web?.makeDev}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div className="mt-8 text-center">
          <a href="/" className="text-white/30 text-[10px] hover:text-white/60 transition-colors">
            &larr; Back to console
          </a>
        </div>
      </div>
    </div>
  );
};
