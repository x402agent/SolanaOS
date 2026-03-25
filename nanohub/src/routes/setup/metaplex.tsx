import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRightLeft, Hexagon, Package, Shield, UserCog } from 'lucide-react'
import { useState } from 'react'
import { CopyBlock, SetupStepper, type SetupStep } from '../../components/SetupStepper'

export const Route = createFileRoute('/setup/metaplex')({
  component: MetaplexSetup,
})

function MetaplexSetup() {
  const [step, setStep] = useState(0)

  const steps: SetupStep[] = [
    {
      title: 'Install Metaplex Skill',
      icon: <Package className="gallery-panel-icon" aria-hidden="true" />,
      content: (
        <div className="setup-body">
          <p className="gallery-copy-text">
            The Metaplex Skill gives your AI coding agent accurate knowledge of all Metaplex programs, CLI commands, and SDK patterns.
          </p>

          <h3 className="setup-subtitle">Quick Install (recommended)</h3>
          <CopyBlock code={`npx skills add metaplex-foundation/skill`} label="Copy install command" />

          <p className="gallery-copy-text">
            Works with Claude Code, Cursor, Copilot, Windsurf, and any agent that supports the Agent Skills format.
          </p>

          <h3 className="setup-subtitle">Manual Install (Claude Code)</h3>
          <CopyBlock
            code={`# Project-scoped
mkdir -p .claude/skills/metaplex
# Then copy skill files from the GitHub repository

# Or global (all projects)
mkdir -p ~/.claude/skills/metaplex`}
            label="Copy manual install"
          />

          <h3 className="setup-subtitle">Programs Covered</h3>
          <div className="setup-command-grid">
            {[
              ['Core', 'Next-gen NFTs with plugins and royalty enforcement'],
              ['Token Metadata', 'Fungible tokens, NFTs, pNFTs, editions'],
              ['Bubblegum', 'Compressed NFTs via Merkle trees'],
              ['Candy Machine', 'NFT drops with configurable guards'],
              ['Genesis', 'Token launches with fair distribution'],
            ].map(([name, desc]) => (
              <div key={name} className="setup-command-item">
                <code>{name}</code>
                <span>{desc}</span>
              </div>
            ))}
          </div>

          <h3 className="setup-subtitle">Verify Installation</h3>
          <p className="gallery-copy-text">
            Ask your AI agent to perform a Metaplex operation, e.g. "Launch a token with Genesis" or "Create a Core NFT collection on devnet".
          </p>
        </div>
      ),
    },
    {
      title: 'Register Agent on Metaplex 014',
      icon: <Shield className="gallery-panel-icon" aria-hidden="true" />,
      content: (
        <div className="setup-body">
          <p className="gallery-copy-text">
            The <code>registerIdentityV1</code> instruction binds an on-chain identity record to an MPL Core asset, creating a discoverable PDA and attaching lifecycle hooks.
          </p>

          <h3 className="setup-subtitle">Install SDK</h3>
          <CopyBlock
            code={`npm install @metaplex-foundation/umi-bundle-defaults @metaplex-foundation/mpl-agent-registry`}
            label="Copy npm install"
          />

          <h3 className="setup-subtitle">Register Identity</h3>
          <CopyBlock
            code={`import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplAgentIdentity } from '@metaplex-foundation/mpl-agent-registry';
import { registerIdentityV1 } from '@metaplex-foundation/mpl-agent-registry';

const umi = createUmi('https://api.mainnet-beta.solana.com')
  .use(mplAgentIdentity());

await registerIdentityV1(umi, {
  asset: assetPublicKey,
  collection: collectionPublicKey,
  agentRegistrationUri: 'https://<your-convex-site>.convex.site/nanosolana/agents/registration?id=<AGENT_ID>',
}).sendAndConfirm(umi);`}
            label="Copy registration code"
          />

          <h3 className="setup-subtitle">Agent Registration Document (ERC-8004)</h3>
          <CopyBlock
            code={`{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "Your Agent Name",
  "description": "What your agent does and how it works.",
  "image": "https://arweave.net/your-avatar-hash",
  "services": [
    { "name": "web", "endpoint": "https://seeker.solanaos.net/agents/<AGENT_ID>" },
    { "name": "A2A", "endpoint": "https://<your-convex-site>.convex.site/nanosolana/agents/agent-card?id=<AGENT_ID>", "version": "0.3.0" },
    { "name": "MCP", "endpoint": "https://seeker.solanaos.net/mcp/<AGENT_ID>", "version": "2025-06-18" }
  ],
  "active": true,
  "registrations": [
    { "agentId": "<MINT_ADDRESS>", "agentRegistry": "solana:101:metaplex" }
  ],
  "supportedTrust": ["reputation", "crypto-economic"]
}`}
            label="Copy registration JSON"
          />
        </div>
      ),
    },
    {
      title: 'Set Up Executive Profile',
      icon: <UserCog className="gallery-panel-icon" aria-hidden="true" />,
      content: (
        <div className="setup-body">
          <p className="gallery-copy-text">
            An executive profile is a one-time on-chain setup per wallet that creates a verifiable operator identity. Think of it as a service account for running agents.
          </p>

          <CopyBlock
            code={`import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplAgentTools } from '@metaplex-foundation/mpl-agent-registry';
import { registerExecutiveV1 } from '@metaplex-foundation/mpl-agent-registry';

const umi = createUmi('https://api.mainnet-beta.solana.com')
  .use(mplAgentTools());

await registerExecutiveV1(umi, {
  payer: umi.payer,
}).sendAndConfirm(umi);`}
            label="Copy executive registration"
          />

          <div className="setup-callout">
            Each wallet can only have one executive profile. The PDA is derived from <code>["executive_profile", &lt;authority&gt;]</code>.
          </div>

          <h3 className="setup-subtitle">What Is an Executive?</h3>
          <p className="gallery-copy-text">
            Solana doesn't support background tasks. An executive is a trusted off-chain operator that signs transactions
            on your agent's behalf using the Execute hook. This separates identity (who the agent is) from execution
            (who operates it).
          </p>
        </div>
      ),
    },
    {
      title: 'Delegate Execution',
      icon: <ArrowRightLeft className="gallery-panel-icon" aria-hidden="true" />,
      content: (
        <div className="setup-body">
          <p className="gallery-copy-text">
            Link your agent asset to your executive profile so it can sign transactions on behalf of the agent.
          </p>

          <CopyBlock
            code={`import { delegateExecutionV1 } from '@metaplex-foundation/mpl-agent-registry';
import {
  findAgentIdentityV1Pda,
  findExecutiveProfileV1Pda,
} from '@metaplex-foundation/mpl-agent-registry';

const agentIdentity = findAgentIdentityV1Pda(umi, {
  asset: agentAssetPublicKey,
});
const executiveProfile = findExecutiveProfileV1Pda(umi, {
  authority: executiveAuthorityPublicKey,
});

await delegateExecutionV1(umi, {
  agentAsset: agentAssetPublicKey,
  agentIdentity,
  executiveProfile,
}).sendAndConfirm(umi);`}
            label="Copy delegation code"
          />

          <h3 className="setup-subtitle">Verify Delegation</h3>
          <CopyBlock
            code={`import {
  findExecutiveProfileV1Pda,
  findExecutionDelegateRecordV1Pda,
} from '@metaplex-foundation/mpl-agent-registry';

const executiveProfile = findExecutiveProfileV1Pda(umi, {
  authority: executiveAuthorityPublicKey,
});
const delegateRecord = findExecutionDelegateRecordV1Pda(umi, {
  executiveProfile,
  agentAsset: agentAssetPublicKey,
});

const account = await umi.rpc.getAccount(delegateRecord);
console.log('Delegated:', account.exists);`}
            label="Copy verification code"
          />

          <div className="setup-next-steps">
            <p className="gallery-copy-text">Your Metaplex agent is fully registered and delegated. Next steps:</p>
            <div className="setup-next-links">
              <Link to="/dashboard" className="btn btn-primary">
                <Hexagon className="h-4 w-4" aria-hidden="true" />
                Create Agent on Dashboard
              </Link>
              <Link to="/setup/gateway" className="btn">
                Set up Gateway
              </Link>
              <Link to="/setup/telegram" className="btn">
                Set up Telegram Bot
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
            <Hexagon className="h-4 w-4" aria-hidden="true" />
            Metaplex 014 Agent Registry
          </span>
          <h1 className="section-title">Register Your Agent on Metaplex</h1>
          <p className="hero-subtitle">
            Install the Metaplex Skill for AI agents, register on the 014 Agent Registry, and set up execution delegation for autonomous operation.
          </p>
        </div>
      </div>
      <SetupStepper steps={steps} currentStep={step} onStepChange={setStep} />
    </main>
  )
}
