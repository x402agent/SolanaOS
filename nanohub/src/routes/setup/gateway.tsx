import { createFileRoute, Link } from '@tanstack/react-router'
import { Cpu, Download, FileCode, Play, Server } from 'lucide-react'
import { useState } from 'react'
import { CopyBlock, SetupStepper, type SetupStep } from '../../components/SetupStepper'

export const Route = createFileRoute('/setup/gateway')({
  component: GatewaySetup,
})

function GatewaySetup() {
  const [step, setStep] = useState(0)

  const steps: SetupStep[] = [
    {
      title: 'Install Binary',
      icon: <Download className="gallery-panel-icon" aria-hidden="true" />,
      content: (
        <div className="setup-body">
          <p className="gallery-copy-text">
            Install the SolanaOS gateway binary on your machine. One command, under 10 MB.
          </p>

          <h3 className="setup-subtitle">Quick Install (recommended)</h3>
          <CopyBlock
            code={`curl -fsSL https://raw.githubusercontent.com/x402agent/Solana-Os-Go/newnew/install.sh | sh`}
            label="Copy install command"
          />

          <h3 className="setup-subtitle">Build From Source</h3>
          <CopyBlock
            code={`git clone https://github.com/x402agent/Solana-Os-Go.git
cd Solana-Os-Go
mkdir -p build
go build -o build/solanaos .`}
            label="Copy build commands"
          />
          <p className="gallery-copy-text">Requires Go 1.25+.</p>

          <h3 className="setup-subtitle">Supported Platforms</h3>
          <div className="setup-info-grid">
            <div className="setup-info-card">
              <span className="setup-info-label">NVIDIA Orin Nano</span>
              <span className="setup-info-value">ARM64, CUDA, I2C</span>
            </div>
            <div className="setup-info-card">
              <span className="setup-info-label">Solana Seeker</span>
              <span className="setup-info-value">SMS, SE, dApp Store</span>
            </div>
            <div className="setup-info-card">
              <span className="setup-info-label">Raspberry Pi 5</span>
              <span className="setup-info-value">ARM64, GPIO, I2C</span>
            </div>
            <div className="setup-info-card">
              <span className="setup-info-label">x86_64 Server</span>
              <span className="setup-info-value">USB, Docker</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Configure Environment',
      icon: <FileCode className="gallery-panel-icon" aria-hidden="true" />,
      content: (
        <div className="setup-body">
          <p className="gallery-copy-text">
            Create a <code>.env</code> file in your project root with the runtime keys the gateway actually uses for Seeker pairing, Solana data, and optional operator surfaces.
          </p>
          <CopyBlock
            code={`# Solana Tracker
SOLANA_TRACKER_API_KEY=your_solanatracker_key
SOLANA_TRACKER_RPC_URL=https://rpc-mainnet.solanatracker.io/?api_key=your_solanatracker_key
SOLANA_TRACKER_WSS_URL=wss://rpc-mainnet.solanatracker.io/?api_key=your_solanatracker_key
SOLANA_TRACKER_DATA_API_KEY=your_solanatracker_data_key

# LLM
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=minimax/minimax-m2.7
OPENROUTER_OMNI_MODEL=xiaomi/mimo-v2-pro
OPENROUTER_MIMO_MODEL=xiaomi/mimo-v2-pro
LLM_PROVIDER=openrouter

# Telegram (optional)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ID=your_numeric_telegram_user_id

# xAI (optional)
XAI_API_KEY=your_xai_key

# Optional Helius fallback
HELIUS_API_KEY=your_helius_key
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your_helius_key`}
            label="Copy .env template"
          />
          <div className="setup-callout">
            Never commit your <code>.env</code> file to git. The installer will create one from <code>.env.example</code> if it does not exist, and the SolanaOS CLI reads it automatically on startup.
          </div>
        </div>
      ),
    },
    {
      title: 'Connect Hardware (Optional)',
      icon: <Cpu className="gallery-panel-icon" aria-hidden="true" />,
      content: (
        <div className="setup-body">
          <p className="gallery-copy-text">
            If you have I2C peripherals connected, the gateway auto-detects them via <code>periph.io</code>. No driver installation needed.
          </p>

          <h3 className="setup-subtitle">Supported Hardware</h3>
          <div className="setup-command-grid">
            {[
              ['PIXELS', '8x RGB LED array'],
              ['BUZZER', 'Piezo buzzer notifications'],
              ['KNOB', 'PEC11 rotary encoder'],
              ['IMU', 'LSM6DS0X 6-axis motion sensor'],
              ['ToF', 'VL53L4CD time-of-flight range sensor'],
            ].map(([name, desc]) => (
              <div key={name} className="setup-command-item">
                <code>{name}</code>
                <span>{desc}</span>
              </div>
            ))}
          </div>

          <p className="gallery-copy-text">
            Hardware is fully optional — the gateway works standalone for Solana operations, Telegram, and AI features.
          </p>
        </div>
      ),
    },
    {
      title: 'Start Gateway',
      icon: <Play className="gallery-panel-icon" aria-hidden="true" />,
      content: (
        <div className="setup-body">
          <p className="gallery-copy-text">
            Start the native Seeker bridge, then print the setup code that the Android app and Seeker onboarding flow expect.
          </p>

          <h3 className="setup-subtitle">Recommended Run Path</h3>
          <CopyBlock
            code={`~/.nanosolana/bin/solanaos gateway start
~/.nanosolana/bin/solanaos gateway setup-code
cat ~/.nanosolana/connect/setup-code.txt`}
            label="Copy gateway commands"
          />

          <h3 className="setup-subtitle">If You Built From Source</h3>
          <CopyBlock
            code={`./build/solanaos gateway start
./build/solanaos gateway setup-code`}
            label="Copy source-run commands"
          />

          <div className="setup-callout">
            For LAN-only pairing on local Wi-Fi, use <code>solanaos gateway start --no-tailscale</code> and then regenerate the setup code.
          </div>

          <p className="gallery-copy-text">You should see output like:</p>
          <pre className="setup-terminal">
            <code>{`SolanaOS native gateway listening on 100.88.46.29:18790
Setup code saved to ~/.nanosolana/connect/setup-code.txt
Bridge URL: http://100.88.46.29:18790
Use: solanaos gateway setup-code`}</code>
          </pre>

          <h3 className="setup-subtitle">Pair Your Seeker</h3>
          <div className="setup-info-grid">
            <div className="setup-info-card">
              <span className="setup-info-label">Setup Code</span>
              <span className="setup-info-value">Paste into onboarding or Connect</span>
            </div>
            <div className="setup-info-card">
              <span className="setup-info-label">Connect File</span>
              <span className="setup-info-value">~/.nanosolana/connect/setup-code.txt</span>
            </div>
            <div className="setup-info-card">
              <span className="setup-info-label">LAN Mode</span>
              <span className="setup-info-value">Use --no-tailscale on local Wi-Fi</span>
            </div>
          </div>

          <div className="setup-next-steps">
            <p className="gallery-copy-text">Gateway is running. Next steps:</p>
            <div className="setup-next-links">
              <Link to="/setup/telegram" className="btn">
                Set up Telegram Bot
              </Link>
              <Link to="/setup/metaplex" className="btn">
                Register Metaplex Agent
              </Link>
              <Link to="/dashboard" className="btn btn-primary">
                Pair Your Seeker
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
            <Server className="h-4 w-4" aria-hidden="true" />
            Terminal Gateway
          </span>
          <h1 className="section-title">Install SolanaOS Gateway</h1>
          <p className="hero-subtitle">
            Run the SolanaOS gateway on your terminal to connect your Seeker, hardware peripherals, and Telegram bot.
          </p>
        </div>
      </div>
      <SetupStepper steps={steps} currentStep={step} onStepChange={setStep} />
    </main>
  )
}
