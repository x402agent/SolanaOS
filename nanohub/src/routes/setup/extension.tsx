import { createFileRoute, Link } from '@tanstack/react-router'
import { CheckCircle, Chrome, Download, Puzzle, Settings } from 'lucide-react'
import { useState } from 'react'
import { CopyBlock, SetupStepper, type SetupStep } from '../../components/SetupStepper'

export const Route = createFileRoute('/setup/extension')({
  component: ExtensionSetup,
})

function ExtensionSetup() {
  const [step, setStep] = useState(0)

  const steps: SetupStep[] = [
    {
      title: 'Install Extension',
      icon: <Download className="gallery-panel-icon" aria-hidden="true" />,
      content: (
        <div className="setup-body">
          <p className="gallery-copy-text">
            The SolanaOS Chrome Extension gives you wallet, chat, tools, Seeker pairing, and miner control from your browser toolbar.
          </p>
          <ol className="setup-steps-list">
            <li>Open <code>chrome://extensions</code> in Chrome</li>
            <li>Enable <strong>Developer mode</strong> (toggle in top right)</li>
            <li>Click <strong>Load unpacked</strong></li>
            <li>Select the <code>chrome-extension/</code> folder from the SolanaOS repo</li>
            <li>Click the SolanaOS icon in your toolbar</li>
          </ol>
          <CopyBlock
            code={`# Clone the repo if you haven't already
git clone https://github.com/x402agent/Solana-Os-Go.git

# The extension is at:
# Solana-Os-Go/chrome-extension/`}
            label="Copy clone command"
          />
          <div className="setup-callout">
            The extension is a <strong>Manifest V3</strong> Chrome extension. No build step needed — load the folder directly.
          </div>
        </div>
      ),
    },
    {
      title: 'Connect to Gateway',
      icon: <Settings className="gallery-panel-icon" aria-hidden="true" />,
      content: (
        <div className="setup-body">
          <p className="gallery-copy-text">
            The extension auto-connects to your local SolanaOS daemon. Click the gear icon to configure.
          </p>
          <h3 className="setup-subtitle">Default Connection</h3>
          <p className="gallery-copy-text">
            The extension tries these endpoints automatically:
          </p>
          <div className="setup-info-grid">
            <div className="setup-info-card">
              <span className="setup-info-label">Control API</span>
              <span className="setup-info-value">127.0.0.1:7777</span>
            </div>
            <div className="setup-info-card">
              <span className="setup-info-label">Web Backend</span>
              <span className="setup-info-value">127.0.0.1:18800</span>
            </div>
            <div className="setup-info-card">
              <span className="setup-info-label">Gateway</span>
              <span className="setup-info-value">127.0.0.1:18790</span>
            </div>
            <div className="setup-info-card">
              <span className="setup-info-label">MawdAxe</span>
              <span className="setup-info-value">127.0.0.1:8420</span>
            </div>
          </div>
          <h3 className="setup-subtitle">Remote / Tailscale</h3>
          <p className="gallery-copy-text">
            To connect to a remote gateway, click the <strong>gear icon</strong> in the extension and enter your Tailscale or LAN IP. If your gateway uses a secret, enter it in the <strong>Gateway Secret</strong> field.
          </p>
          <div className="setup-callout">
            For Tailscale: use the machine's Tailscale IP (e.g. <code>100.X.X.X:7777</code>). Make sure the extension's <code>host_permissions</code> in <code>manifest.json</code> include your IP range.
          </div>
        </div>
      ),
    },
    {
      title: 'Extension Tabs',
      icon: <Puzzle className="gallery-panel-icon" aria-hidden="true" />,
      content: (
        <div className="setup-body">
          <p className="gallery-copy-text">
            The extension popup has 5 tabs:
          </p>
          <div className="setup-command-grid">
            {[
              ['Wallet', 'Agent runtime status, SOL balance, wallet address, OODA mode, daemon health'],
              ['Seeker', 'Pair your Solana Seeker device via QR code or setup code'],
              ['Miner', 'BitAxe fleet status — hashrate, temperature, shares, pet state'],
              ['Chat', 'Send messages to your SolanaOS agent, view responses'],
              ['Tools', 'Quick actions — restart daemon, toggle OODA, open web UI'],
            ].map(([tab, desc]) => (
              <div key={tab} className="setup-command-item">
                <code>{tab}</code>
                <span>{desc}</span>
              </div>
            ))}
          </div>
          <h3 className="setup-subtitle">Customization</h3>
          <p className="gallery-copy-text">
            Edit these files to customize the extension:
          </p>
          <div className="setup-command-grid">
            {[
              ['popup.html', 'Layout and structure of the popup UI'],
              ['popup.css', 'Styling — colors, fonts, layout'],
              ['popup.js', 'Tab logic, API calls, real-time updates'],
              ['background.js', 'Connection management, badge updates, auto-discovery'],
              ['manifest.json', 'Permissions, host access, extension metadata'],
            ].map(([file, desc]) => (
              <div key={file} className="setup-command-item">
                <code>{file}</code>
                <span>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: 'Verify & Use',
      icon: <CheckCircle className="gallery-panel-icon" aria-hidden="true" />,
      content: (
        <div className="setup-body">
          <p className="gallery-copy-text">
            Make sure the SolanaOS daemon is running, then click the extension icon. The status dot should turn <strong style={{ color: '#00ff40' }}>green</strong>.
          </p>
          <CopyBlock code={`# Start the daemon first
./build/solanaos daemon

# Or if installed via npm:
~/.nanosolana/bin/solanaos daemon`} label="Copy start command" />

          <h3 className="setup-subtitle">Status Indicators</h3>
          <div className="setup-info-grid">
            <div className="setup-info-card">
              <span className="setup-info-label" style={{ color: '#00ff40' }}>Green</span>
              <span className="setup-info-value">Connected</span>
            </div>
            <div className="setup-info-card">
              <span className="setup-info-label" style={{ color: '#ffc800' }}>Yellow</span>
              <span className="setup-info-value">Connecting</span>
            </div>
            <div className="setup-info-card">
              <span className="setup-info-label" style={{ color: '#ff2200' }}>Red</span>
              <span className="setup-info-value">Disconnected</span>
            </div>
          </div>

          <h3 className="setup-subtitle">Quick Actions</h3>
          <p className="gallery-copy-text">
            Use the <strong>popout button</strong> (↗) to open the full web UI. Use the <strong>settings button</strong> (⚙️) to change the gateway URL.
          </p>

          <div className="setup-next-steps">
            <div className="setup-next-links">
              <Link to="/dashboard" className="btn btn-primary">
                Go to Dashboard
              </Link>
              <Link to="/setup/gateway" className="btn">
                Set up Gateway
              </Link>
              <Link to="/mining" className="btn">
                Mining Dashboard
              </Link>
            </div>
          </div>
        </div>
      ),
    },
  ]

  return (
    <main className="section">
      <div className="setup-hero">
        <div className="setup-hero-copy">
          <span className="hero-badge">
            <Chrome className="h-4 w-4" aria-hidden="true" />
            Chrome Extension
          </span>
          <h1 className="section-title">Install the SolanaOS Extension</h1>
          <p className="hero-subtitle">
            Wallet, chat, tools, Seeker pairing, and BitAxe miner control from your browser toolbar. Connects to your local SolanaOS daemon.
          </p>
        </div>
      </div>
      <SetupStepper steps={steps} currentStep={step} onStepChange={setStep} />
    </main>
  )
}
