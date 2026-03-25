import { createFileRoute, Link } from '@tanstack/react-router'
import { CheckCircle, Cpu, Download, Shield, Wifi } from 'lucide-react'
import { useState } from 'react'
import { CopyBlock, SetupStepper, type SetupStep } from '../../components/SetupStepper'

export const Route = createFileRoute('/setup/mining')({
  component: MiningSetup,
})

function MiningSetup() {
  const [step, setStep] = useState(0)

  const steps: SetupStep[] = [
    {
      title: 'Put Bitaxe On WiFi',
      icon: <Wifi className="gallery-panel-icon" aria-hidden="true" />,
      content: (
        <div className="setup-body">
          <p className="gallery-copy-text">
            Power on the Bitaxe, join its temporary hotspot, open <code>http://192.168.4.1</code>, and move it onto your home WiFi.
          </p>
          <div className="setup-info-grid">
            <div className="setup-info-card">
              <span className="setup-info-label">Hotspot</span>
              <span className="setup-info-value">Bitaxe_XXXXXX</span>
            </div>
            <div className="setup-info-card">
              <span className="setup-info-label">AxeOS setup</span>
              <span className="setup-info-value">http://192.168.4.1</span>
            </div>
            <div className="setup-info-card">
              <span className="setup-info-label">Need a reset?</span>
              <span className="setup-info-value">Hold boot 5s</span>
            </div>
          </div>
          <div className="setup-callout">
            Keep the miner on your LAN. Do not expose AxeOS or the miner API directly to the public internet.
          </div>
        </div>
      ),
    },
    {
      title: 'Run Safe Quickstart',
      icon: <Download className="gallery-panel-icon" aria-hidden="true" />,
      content: (
        <div className="setup-body">
          <p className="gallery-copy-text">
            The SolanaOS quickstart discovers the miner, configures your pool with your own BTC payout address, writes local Bitaxe env vars, and generates the Seeker setup bundle.
          </p>
          <CopyBlock
            code={`bash scripts/bitaxe-quickstart.sh --wallet bc1qYOUR_BTC_ADDRESS`}
            label="Copy quickstart"
          />
          <h3 className="setup-subtitle">Already configured in AxeOS?</h3>
          <CopyBlock
            code={`bash scripts/bitaxe-quickstart.sh --host 192.168.1.42 --skip-pool-config`}
            label="Copy no-pool-change path"
          />
          <h3 className="setup-subtitle">Use a different pool</h3>
          <CopyBlock
            code={`bash scripts/bitaxe-quickstart.sh \\
  --wallet bc1qYOUR_BTC_ADDRESS \\
  --pool stratum+tcp://mine.ocean.xyz:4243`}
            label="Copy custom pool path"
          />
          <div className="setup-callout">
            This script does not silently configure a default BTC wallet. You must supply your own address or skip the pool update.
          </div>
        </div>
      ),
    },
    {
      title: 'Start SolanaOS',
      icon: <Cpu className="gallery-panel-icon" aria-hidden="true" />,
      content: (
        <div className="setup-body">
          <p className="gallery-copy-text">
            Run SolanaOS locally, then start the Seeker gateway in LAN mode so the app pairs to your machine instead of directly to the miner.
          </p>
          <CopyBlock
            code={`solanaos daemon
solanaos gateway start --no-tailscale`}
            label="Copy local runtime commands"
          />
          <h3 className="setup-subtitle">Generated local config</h3>
          <CopyBlock
            code={`BITAXE_HOST=192.168.1.42
BITAXE_ENABLED=true
BITAXE_POLL_INTERVAL=10
BITAXE_AUTO_TUNE=true
BITAXE_MAX_TEMP_C=72
BITAXE_COOL_TEMP_C=50
BITAXE_MAX_FREQ_MHZ=600
BITAXE_MIN_FREQ_MHZ=400
BITAXE_PET_NAME=MawdPet`}
            label="Copy Bitaxe env example"
          />
          <div className="setup-info-grid">
            <div className="setup-info-card">
              <span className="setup-info-label">Gateway</span>
              <span className="setup-info-value">port 18790</span>
            </div>
            <div className="setup-info-card">
              <span className="setup-info-label">Control API</span>
              <span className="setup-info-value">127.0.0.1:7777</span>
            </div>
            <div className="setup-info-card">
              <span className="setup-info-label">Miner check</span>
              <span className="setup-info-value">/api/miner</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Pair Seeker Safely',
      icon: <Shield className="gallery-panel-icon" aria-hidden="true" />,
      content: (
        <div className="setup-body">
          <p className="gallery-copy-text">
            Pair the Seeker or Android app using the generated setup code. This keeps the miner behind SolanaOS instead of exposing it directly.
          </p>
          <CopyBlock
            code={`cat ~/.nanosolana/connect/setup-code.txt
cat ~/.nanosolana/connect/solanaos-connect.json`}
            label="Copy setup bundle commands"
          />
          <p className="gallery-copy-text">
            In the app: <strong>Connect → Setup Code</strong> and paste <code>setup-code.txt</code>.
          </p>
          <h3 className="setup-subtitle">Verify locally</h3>
          <CopyBlock
            code={`curl http://127.0.0.1:7777/api/miner`}
            label="Copy miner verification"
          />
          <div className="setup-callout">
            If you later connect the Mining dashboard, use only a LAN URL or a Tailscale URL. Do not port-forward <code>:8420</code> publicly.
          </div>
          <div className="setup-next-steps">
            <div className="setup-next-links">
              <Link to="/mining" className="btn btn-primary">
                Open Mining Dashboard
              </Link>
              <Link to="/setup/gateway" className="btn">
                Open Gateway Setup
              </Link>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Optional Standalone MawdAxe',
      icon: <CheckCircle className="gallery-panel-icon" aria-hidden="true" />,
      content: (
        <div className="setup-body">
          <p className="gallery-copy-text">
            Most new single-miner users do not need standalone MawdAxe. Use it only if you want the separate fleet API and dashboard surface.
          </p>
          <CopyBlock
            code={`cd mawdbot-bitaxe
cp .env.example .env
go run ./cmd/mawdaxe`}
            label="Copy standalone MawdAxe path"
          />
          <div className="setup-info-grid">
            <div className="setup-info-card">
              <span className="setup-info-label">API</span>
              <span className="setup-info-value">http://127.0.0.1:8420</span>
            </div>
            <div className="setup-info-card">
              <span className="setup-info-label">Live stream</span>
              <span className="setup-info-value">SSE at /ws</span>
            </div>
            <div className="setup-info-card">
              <span className="setup-info-label">Public exposure</span>
              <span className="setup-info-value">Avoid it</span>
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
            <Cpu className="h-4 w-4" aria-hidden="true" />
            BitAxe Mining
          </span>
          <h1 className="section-title">Set Up Bitaxe With SolanaOS</h1>
          <p className="hero-subtitle">
            Safe local-first onboarding for your own Bitaxe miner, paired to SolanaOS and Seeker through the SolanaOS gateway instead of exposing the miner directly.
          </p>
        </div>
      </div>
      <SetupStepper steps={steps} currentStep={step} onStepChange={setStep} />
    </main>
  )
}
