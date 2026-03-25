import { createFileRoute, Link } from '@tanstack/react-router'
import { Bot, CheckCircle, Hash, MessageCircle, Settings } from 'lucide-react'
import { useState } from 'react'
import { CopyBlock, SetupStepper, type SetupStep } from '../../components/SetupStepper'

export const Route = createFileRoute('/setup/telegram')({
  component: TelegramSetup,
})

function TelegramSetup() {
  const [step, setStep] = useState(0)

  const steps: SetupStep[] = [
    {
      title: 'Create Bot with BotFather',
      icon: <Bot className="gallery-panel-icon" aria-hidden="true" />,
      content: (
        <div className="setup-body">
          <p className="gallery-copy-text">
            Open Telegram and start a chat with{' '}
            <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="setup-link">
              @BotFather
            </a>
            . Send the <code>/newbot</code> command and follow the prompts.
          </p>
          <ol className="setup-steps-list">
            <li>Open Telegram and search for <strong>@BotFather</strong></li>
            <li>Send <code>/newbot</code></li>
            <li>Choose a display name (e.g. <strong>SolanaOS Agent</strong>)</li>
            <li>Choose a username ending in <code>bot</code> (e.g. <strong>my_solanaos_bot</strong>)</li>
            <li>BotFather will reply with your <strong>bot token</strong> — save it</li>
          </ol>
          <div className="setup-callout">
            <strong>Keep your bot token secret.</strong> Anyone with the token can control your bot.
          </div>
        </div>
      ),
    },
    {
      title: 'Get Your Chat ID',
      icon: <Hash className="gallery-panel-icon" aria-hidden="true" />,
      content: (
        <div className="setup-body">
          <p className="gallery-copy-text">
            Send any message to your new bot, then use the Telegram API to find your chat ID.
          </p>
          <ol className="setup-steps-list">
            <li>Open your new bot in Telegram and send any message (e.g. "hello")</li>
            <li>Run this command in your terminal, replacing <code>YOUR_BOT_TOKEN</code>:</li>
          </ol>
          <CopyBlock code={`curl -s https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates | python3 -m json.tool`} />
          <p className="gallery-copy-text">
            Look for <code>"chat": {"{"}"id": 123456789{"}"}</code> in the response — that number is your Chat ID.
          </p>
          <div className="setup-callout">
            For group chats, the chat ID will be negative (e.g. <code>-1001234567890</code>).
          </div>
        </div>
      ),
    },
    {
      title: 'Configure Environment',
      icon: <Settings className="gallery-panel-icon" aria-hidden="true" />,
      content: (
        <div className="setup-body">
          <p className="gallery-copy-text">
            Add your bot token and chat ID to the gateway's <code>.env</code> file.
          </p>
          <CopyBlock
            code={`# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Optional: allow multiple users (comma-separated)
TELEGRAM_ALLOWED_USERS=user_id_1,user_id_2`}
            label="Copy .env block"
          />
          <p className="gallery-copy-text">
            The bot auto-starts with the SolanaOS gateway. No separate process needed.
          </p>
          <div className="setup-info-grid">
            <div className="setup-info-card">
              <span className="setup-info-label">Library</span>
              <span className="setup-info-value">telego v1.7.0</span>
            </div>
            <div className="setup-info-card">
              <span className="setup-info-label">Polling</span>
              <span className="setup-info-value">Long Polling</span>
            </div>
            <div className="setup-info-card">
              <span className="setup-info-label">Rate Limit</span>
              <span className="setup-info-value">30 msg/sec</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Test Connection',
      icon: <CheckCircle className="gallery-panel-icon" aria-hidden="true" />,
      content: (
        <div className="setup-body">
          <p className="gallery-copy-text">
            Start the gateway and send <code>/status</code> to your bot. You should get a system status response.
          </p>
          <CopyBlock code={`./solanaos start --gateway`} label="Copy start command" />

          <h3 className="setup-subtitle">Available Commands</h3>
          <div className="setup-command-grid">
            {[
              ['/status', 'System status overview'],
              ['/trending', 'Trending Solana tokens'],
              ['/swap', 'Execute token swap'],
              ['/price', 'Token price lookup'],
              ['/portfolio', 'Wallet portfolio'],
              ['/companion', 'AI companion mode'],
              ['/ooda', 'OODA trading loop status'],
              ['/memory', 'Agent memory context'],
              ['/hardware', 'Connected hardware info'],
              ['/help', 'List all commands'],
            ].map(([cmd, desc]) => (
              <div key={cmd} className="setup-command-item">
                <code>{cmd}</code>
                <span>{desc}</span>
              </div>
            ))}
          </div>

          <div className="setup-next-steps">
            <p className="gallery-copy-text">Telegram bot is ready. Next steps:</p>
            <div className="setup-next-links">
              <Link to="/setup/gateway" className="btn">
                Set up Gateway
              </Link>
              <Link to="/dashboard" className="btn btn-primary">
                Go to Dashboard
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
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Telegram Bot
          </span>
          <h1 className="section-title">Set Up Your Telegram Bot</h1>
          <p className="hero-subtitle">
            Connect SolanaOS to Telegram for remote monitoring, trading commands, and AI companion access from any device.
          </p>
        </div>
      </div>
      <SetupStepper steps={steps} currentStep={step} onStepChange={setStep} />
    </main>
  )
}
