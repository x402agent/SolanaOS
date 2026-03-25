export const solanaOsCatalog = {
  "generatedAt": "2026-03-25T03:15:11.501Z",
  "repositoryUrl": "https://github.com/x402agent/Solana-Os-Go",
  "siteUrl": "https://seeker.solanaos.net",
  "skillsHubUrl": "https://seeker.solanaos.net/solanaos",
  "troubleshootingUrl": "https://seeker.solanaos.net/setup/troubleshooting",
  "packageCount": 59,
  "skillCount": 87,
  "bundledMobileSkills": [
    {
      "slug": "seeker-daemon-ops",
      "title": "Daemon Ops",
      "summary": "Bring up the Seeker daemon, validate commands, and recover common runtime issues."
    },
    {
      "slug": "session-logs",
      "title": "Session Logs",
      "summary": "Recover historical context from local SolanaOS session logs."
    },
    {
      "slug": "solana-research-brief",
      "title": "Research Brief",
      "summary": "Produce compact token briefs directly from the runtime."
    },
    {
      "slug": "pumpfun-trading",
      "title": "Pump Trading",
      "summary": "Reference pump.fun trade flow and risk controls from mobile."
    },
    {
      "slug": "github",
      "title": "GitHub",
      "summary": "Operate PRs, issues, and CI from a phone-first terminal flow."
    },
    {
      "slug": "summarize",
      "title": "Summarize",
      "summary": "Summarize articles, files, and videos without leaving the device."
    },
    {
      "slug": "weather",
      "title": "Weather",
      "summary": "Fast current weather and short forecast checks."
    }
  ],
  "featuredSections": [
    {
      "title": "Core Runtime",
      "summary": "The main SolanaOS computer loop: agent state, config, sessions, storage, and orchestration.",
      "packages": [
        "agent",
        "agentregistry",
        "config",
        "daemon",
        "routing",
        "runtimeenv",
        "session",
        "state",
        "storage"
      ]
    },
    {
      "title": "Gateway & API",
      "summary": "Public and private control surfaces for apps, dashboards, remote gateways, and Seeker pairing.",
      "packages": [
        "gateway",
        "controlapi",
        "node",
        "identity",
        "health"
      ]
    },
    {
      "title": "Seeker & Mobile",
      "summary": "Phone-native packages for Seeker bridge, mobile voice, and the on-device SolanaOS experience.",
      "packages": [
        "seeker",
        "voice",
        "channels",
        "nanobot"
      ]
    },
    {
      "title": "Markets & Trading",
      "summary": "Chain access, market data, strategies, launches, perps, payments, and miner-linked finance flows.",
      "packages": [
        "solana",
        "onchain",
        "strategy",
        "hyperliquid",
        "aster",
        "pumplaunch",
        "x402",
        "bitaxe",
        "tamagochi"
      ]
    }
  ],
  "packages": [
    {
      "name": "acp",
      "path": "pkg/acp",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/acp",
      "fileCount": 3,
      "sizeBytes": 14004,
      "category": "Utilities",
      "summary": "acp package from the SolanaOS computer runtime.",
      "keyFiles": [
        "compressor.go",
        "redact.go",
        "server.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/acp"
    },
    {
      "name": "agent",
      "path": "pkg/agent",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/agent",
      "fileCount": 17,
      "sizeBytes": 114666,
      "category": "Core Runtime",
      "summary": "Iterative agent loop, prompts, scratchpad, tool execution, and live OODA context.",
      "keyFiles": [
        "agent.go",
        "channels.go",
        "compressor.go",
        "hooks.go",
        "insights.go",
        "killswitch.go",
        "live_context.go",
        "model_metadata.go",
        "ooda.go",
        "prompt_caching.go",
        "prompts.go",
        "redact.go",
        "runtime_snapshot.go",
        "scratchpad.go",
        "smart_routing.go",
        "title_generator.go",
        "toolexec.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/agent"
    },
    {
      "name": "agentregistry",
      "path": "pkg/agentregistry",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/agentregistry",
      "fileCount": 3,
      "sizeBytes": 18466,
      "category": "Core Runtime",
      "summary": "On-chain agent registration, sync state, and public Seeker hub metadata wiring.",
      "keyFiles": [
        "handlers.go",
        "service.go",
        "state.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/agentregistry"
    },
    {
      "name": "aster",
      "path": "pkg/aster",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/aster",
      "fileCount": 27,
      "sizeBytes": 1163717,
      "category": "Markets",
      "summary": "Aster market integrations, docs, and perpetuals data access.",
      "keyFiles": [
        "client.go",
        "futures.go",
        "market.go",
        "tools.go",
        "trader.go",
        "types.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/aster"
    },
    {
      "name": "auth",
      "path": "pkg/auth",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/auth",
      "fileCount": 1,
      "sizeBytes": 1926,
      "category": "Operator Interfaces",
      "summary": "Authentication helpers for runtime and linked surfaces.",
      "keyFiles": [
        "auth.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/auth"
    },
    {
      "name": "autoreply",
      "path": "pkg/autoreply",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/autoreply",
      "fileCount": 2,
      "sizeBytes": 6579,
      "category": "Operator Interfaces",
      "summary": "Automatic reply behaviors for chat and operator command flows.",
      "keyFiles": [
        "autoreply_test.go",
        "autoreply.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/autoreply"
    },
    {
      "name": "bitaxe",
      "path": "pkg/bitaxe",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/bitaxe",
      "fileCount": 3,
      "sizeBytes": 27960,
      "category": "Hardware",
      "summary": "Bitaxe miner APIs, monitoring, and miner control primitives.",
      "keyFiles": [
        "agent.go",
        "client.go",
        "pet.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/bitaxe"
    },
    {
      "name": "blockchain",
      "path": "pkg/blockchain",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/blockchain",
      "fileCount": 1,
      "sizeBytes": 27913,
      "category": "Utilities",
      "summary": "blockchain package from the SolanaOS computer runtime.",
      "keyFiles": [
        "queries.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/blockchain"
    },
    {
      "name": "browseruse",
      "path": "pkg/browseruse",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/browseruse",
      "fileCount": 3,
      "sizeBytes": 27665,
      "category": "Operator Interfaces",
      "summary": "Browser-use integration for agentic browser tasks and automation.",
      "keyFiles": [
        "browseruse_test.go",
        "browseruse.go",
        "providers.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/browseruse"
    },
    {
      "name": "bus",
      "path": "pkg/bus",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/bus",
      "fileCount": 1,
      "sizeBytes": 4541,
      "category": "Core Runtime",
      "summary": "Internal event bus used across daemon, node, and operator flows.",
      "keyFiles": [
        "bus.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/bus"
    },
    {
      "name": "channels",
      "path": "pkg/channels",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/channels",
      "fileCount": 7,
      "sizeBytes": 59270,
      "category": "Operator Interfaces",
      "summary": "Telegram, Discord, and X channel formatting and delivery logic.",
      "keyFiles": [
        "channels.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/channels"
    },
    {
      "name": "commands",
      "path": "pkg/commands",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/commands",
      "fileCount": 1,
      "sizeBytes": 5428,
      "category": "Core Runtime",
      "summary": "Shared command definitions and runtime invocation helpers.",
      "keyFiles": [
        "commands.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/commands"
    },
    {
      "name": "config",
      "path": "pkg/config",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/config",
      "fileCount": 5,
      "sizeBytes": 77279,
      "category": "Core Runtime",
      "summary": "Global SolanaOS configuration, defaults, public site URLs, and env overrides.",
      "keyFiles": [
        "config_test.go",
        "config.go",
        "dotenv.go",
        "site.go",
        "version.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/config"
    },
    {
      "name": "constants",
      "path": "pkg/constants",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/constants",
      "fileCount": 1,
      "sizeBytes": 1068,
      "category": "Core Runtime",
      "summary": "Shared constants for runtime-wide behavior and naming.",
      "keyFiles": [
        "constants.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/constants"
    },
    {
      "name": "controlapi",
      "path": "pkg/controlapi",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/controlapi",
      "fileCount": 18,
      "sizeBytes": 46674,
      "category": "Gateway & API",
      "summary": "Public control API services exposed to apps, dashboards, and remote clients.",
      "keyFiles": [
        "router_test.go",
        "router.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/controlapi"
    },
    {
      "name": "cron",
      "path": "pkg/cron",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/cron",
      "fileCount": 2,
      "sizeBytes": 2014,
      "category": "Automation",
      "summary": "Scheduled job execution support for recurring runtime tasks.",
      "keyFiles": [
        "cron.go",
        "schedule.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/cron"
    },
    {
      "name": "daemon",
      "path": "pkg/daemon",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/daemon",
      "fileCount": 18,
      "sizeBytes": 459282,
      "category": "Gateway & API",
      "summary": "The operator daemon: chat, miner commands, gateway orchestration, and runtime control.",
      "keyFiles": [
        "browseruse_handlers.go",
        "chart_rug_scope_handlers.go",
        "coding_nl.go",
        "cua_handlers.go",
        "daemon_test.go",
        "daemon.go",
        "desktop_handlers.go",
        "e2b_handlers.go",
        "github_handlers.go",
        "hl_handlers.go",
        "hl_stream.go",
        "honcho_handlers.go",
        "media_nl.go",
        "personality.go",
        "remote_control_handlers.go",
        "skill_handlers.go",
        "twitter_gateway.go",
        "x_commands.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/daemon"
    },
    {
      "name": "delegation",
      "path": "pkg/delegation",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/delegation",
      "fileCount": 1,
      "sizeBytes": 7029,
      "category": "Automation",
      "summary": "Subtask delegation and parallel execution helpers.",
      "keyFiles": [
        "delegation.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/delegation"
    },
    {
      "name": "devices",
      "path": "pkg/devices",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/devices",
      "fileCount": 1,
      "sizeBytes": 3226,
      "category": "Hardware",
      "summary": "Device models and capability descriptors for runtime-managed hardware.",
      "keyFiles": [
        "devices.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/devices"
    },
    {
      "name": "e2b",
      "path": "pkg/e2b",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/e2b",
      "fileCount": 3,
      "sizeBytes": 32500,
      "category": "Automation",
      "summary": "E2B integration for isolated execution environments.",
      "keyFiles": [
        "browser_agent.go",
        "client.go",
        "desktop.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/e2b"
    },
    {
      "name": "fileutil",
      "path": "pkg/fileutil",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/fileutil",
      "fileCount": 1,
      "sizeBytes": 1657,
      "category": "Utilities",
      "summary": "Filesystem helpers for runtime-safe file operations.",
      "keyFiles": [
        "fileutil.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/fileutil"
    },
    {
      "name": "gateway",
      "path": "pkg/gateway",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/gateway",
      "fileCount": 13,
      "sizeBytes": 77655,
      "category": "Gateway & API",
      "summary": "Gateway transport, discovery, auth, pairing, and remote connection handling.",
      "keyFiles": [
        "bridge_test.go",
        "bridge.go",
        "coding_sessions_test.go",
        "coding_sessions.go",
        "contracts_test.go",
        "contracts.go",
        "mesh_ipfs.go",
        "remote_test.go",
        "remote.go",
        "spawn.go",
        "tailscale_test.go",
        "tailscale.go",
        "ws.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/gateway"
    },
    {
      "name": "hardware",
      "path": "pkg/hardware",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/hardware",
      "fileCount": 2,
      "sizeBytes": 35648,
      "category": "Hardware",
      "summary": "Hardware abstractions and device-level integration points.",
      "keyFiles": [
        "adapter.go",
        "modulino.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/hardware"
    },
    {
      "name": "health",
      "path": "pkg/health",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/health",
      "fileCount": 2,
      "sizeBytes": 3328,
      "category": "Gateway & API",
      "summary": "Health checks and readiness reporting for runtime services.",
      "keyFiles": [
        "health.go",
        "summary.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/health"
    },
    {
      "name": "heartbeat",
      "path": "pkg/heartbeat",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/heartbeat",
      "fileCount": 1,
      "sizeBytes": 1738,
      "category": "Automation",
      "summary": "Heartbeat writing and liveness signaling for agents and devices.",
      "keyFiles": [
        "heartbeat.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/heartbeat"
    },
    {
      "name": "honcho",
      "path": "pkg/honcho",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/honcho",
      "fileCount": 2,
      "sizeBytes": 29622,
      "category": "Intelligence",
      "summary": "Honcho memory and social cognition integration.",
      "keyFiles": [
        "client_test.go",
        "client.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/honcho"
    },
    {
      "name": "hyperliquid",
      "path": "pkg/hyperliquid",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/hyperliquid",
      "fileCount": 5,
      "sizeBytes": 36022,
      "category": "Markets",
      "summary": "Hyperliquid streams, triggers, and perp-side market execution helpers.",
      "keyFiles": [
        "api.go",
        "hl.go",
        "signing.go",
        "types.go",
        "ws.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/hyperliquid"
    },
    {
      "name": "identity",
      "path": "pkg/identity",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/identity",
      "fileCount": 1,
      "sizeBytes": 1478,
      "category": "Gateway & API",
      "summary": "Identity primitives for device, gateway, and agent ownership.",
      "keyFiles": [
        "identity.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/identity"
    },
    {
      "name": "learning",
      "path": "pkg/learning",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/learning",
      "fileCount": 6,
      "sizeBytes": 35688,
      "category": "Intelligence",
      "summary": "Learning loops, evidence capture, and skill improvement state.",
      "keyFiles": [
        "learning.go",
        "review.go",
        "session_search.go",
        "skillforge.go",
        "user_model.go",
        "util.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/learning"
    },
    {
      "name": "llm",
      "path": "pkg/llm",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/llm",
      "fileCount": 5,
      "sizeBytes": 62268,
      "category": "Intelligence",
      "summary": "LLM clients, orchestration helpers, and model-facing runtime utilities.",
      "keyFiles": [
        "anthropic.go",
        "openrouter_test.go",
        "openrouter.go",
        "xai_test.go",
        "xai.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/llm"
    },
    {
      "name": "logger",
      "path": "pkg/logger",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/logger",
      "fileCount": 1,
      "sizeBytes": 2385,
      "category": "Utilities",
      "summary": "Structured logging helpers for SolanaOS services.",
      "keyFiles": [
        "logger.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/logger"
    },
    {
      "name": "mcp",
      "path": "pkg/mcp",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/mcp",
      "fileCount": 1,
      "sizeBytes": 2528,
      "category": "Operator Interfaces",
      "summary": "Model Context Protocol glue for exposing runtime tools.",
      "keyFiles": [
        "mcp.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/mcp"
    },
    {
      "name": "media",
      "path": "pkg/media",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/media",
      "fileCount": 2,
      "sizeBytes": 10360,
      "category": "Operator Interfaces",
      "summary": "Media parsing and attachment handling helpers.",
      "keyFiles": [
        "media.go",
        "pdf.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/media"
    },
    {
      "name": "memory",
      "path": "pkg/memory",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/memory",
      "fileCount": 7,
      "sizeBytes": 58683,
      "category": "Intelligence",
      "summary": "Persistent epistemic memory engine for known, learned, and inferred state.",
      "keyFiles": [
        "epistemological.go",
        "honcho_adapter.go",
        "honcho_vault.go",
        "memory.go",
        "recorder.go",
        "types.go",
        "vault.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/memory"
    },
    {
      "name": "migrate",
      "path": "pkg/migrate",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/migrate",
      "fileCount": 1,
      "sizeBytes": 2052,
      "category": "Utilities",
      "summary": "Migration helpers for runtime state and storage evolution.",
      "keyFiles": [
        "migrate.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/migrate"
    },
    {
      "name": "nanobot",
      "path": "pkg/nanobot",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/nanobot",
      "fileCount": 5,
      "sizeBytes": 81327,
      "category": "Operator Interfaces",
      "summary": "NanoBot server and web API layers for SolanaOS bot experiences.",
      "keyFiles": [
        "auth.go",
        "das_api.go",
        "server.go",
        "wallet_api.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/nanobot"
    },
    {
      "name": "node",
      "path": "pkg/node",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/node",
      "fileCount": 3,
      "sizeBytes": 21687,
      "category": "Gateway & API",
      "summary": "Node bridge logic used by the mobile/desktop runtime surfaces.",
      "keyFiles": [
        "client.go",
        "mdns.go",
        "state.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/node"
    },
    {
      "name": "onchain",
      "path": "pkg/onchain",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/onchain",
      "fileCount": 6,
      "sizeBytes": 53074,
      "category": "Markets",
      "summary": "On-chain engine and registry-facing Solana execution primitives.",
      "keyFiles": [
        "engine.go",
        "jupiter.go",
        "pinata.go",
        "registration_file.go",
        "registry_mainnet.go",
        "registry.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/onchain"
    },
    {
      "name": "pinata",
      "path": "pkg/pinata",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/pinata",
      "fileCount": 5,
      "sizeBytes": 49574,
      "category": "Utilities",
      "summary": "pinata package from the SolanaOS computer runtime.",
      "keyFiles": [
        "client.go",
        "deploy.go",
        "groups.go",
        "hub.go",
        "mesh.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/pinata"
    },
    {
      "name": "providers",
      "path": "pkg/providers",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/providers",
      "fileCount": 1,
      "sizeBytes": 6052,
      "category": "Intelligence",
      "summary": "Model provider abstractions for OpenAI, OpenRouter, and other backends.",
      "keyFiles": [
        "providers.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/providers"
    },
    {
      "name": "pumplaunch",
      "path": "pkg/pumplaunch",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/pumplaunch",
      "fileCount": 2,
      "sizeBytes": 6003,
      "category": "Markets",
      "summary": "Pump launch flows, state, and token launch orchestration.",
      "keyFiles": [
        "service.go",
        "state.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/pumplaunch"
    },
    {
      "name": "research",
      "path": "pkg/research",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/research",
      "fileCount": 2,
      "sizeBytes": 18935,
      "category": "Intelligence",
      "summary": "Research trajectory capture and research-ready data tooling.",
      "keyFiles": [
        "research.go",
        "trajectories.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/research"
    },
    {
      "name": "routing",
      "path": "pkg/routing",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/routing",
      "fileCount": 1,
      "sizeBytes": 3493,
      "category": "Core Runtime",
      "summary": "Routing logic for requests, sessions, and runtime pathways.",
      "keyFiles": [
        "routing.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/routing"
    },
    {
      "name": "runtimeenv",
      "path": "pkg/runtimeenv",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/runtimeenv",
      "fileCount": 1,
      "sizeBytes": 4110,
      "category": "Core Runtime",
      "summary": "Runtime environment resolution and execution context helpers.",
      "keyFiles": [
        "runtimeenv.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/runtimeenv"
    },
    {
      "name": "seeker",
      "path": "pkg/seeker",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/seeker",
      "fileCount": 4,
      "sizeBytes": 24999,
      "category": "Seeker & Mobile",
      "summary": "Solana Seeker bridge, mobile integration, and Seeker-specific runtime hooks.",
      "keyFiles": [
        "agent.go",
        "bridge.go",
        "deploy.go",
        "ipfs.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/seeker"
    },
    {
      "name": "session",
      "path": "pkg/session",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/session",
      "fileCount": 2,
      "sizeBytes": 3712,
      "category": "Core Runtime",
      "summary": "Session state and conversation lifecycle management.",
      "keyFiles": [
        "session.go",
        "types.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/session"
    },
    {
      "name": "skills",
      "path": "pkg/skills",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/skills",
      "fileCount": 2,
      "sizeBytes": 24947,
      "category": "Operator Interfaces",
      "summary": "Skill loading, indexing, and install-time package discovery.",
      "keyFiles": [
        "manager.go",
        "skills.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/skills"
    },
    {
      "name": "solana",
      "path": "pkg/solana",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/solana",
      "fileCount": 11,
      "sizeBytes": 162224,
      "category": "Markets",
      "summary": "Solana clients, wallets, trackers, Jupiter, RPC, and market data plumbing.",
      "keyFiles": [
        "birdeye_tools.go",
        "birdeye_types.go",
        "birdeye_v3.go",
        "clients.go",
        "datastream.go",
        "programs.go",
        "rpc.go",
        "solanatracker.go",
        "tracker_swap.go",
        "tx.go",
        "wallet.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/solana"
    },
    {
      "name": "state",
      "path": "pkg/state",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/state",
      "fileCount": 1,
      "sizeBytes": 1562,
      "category": "Core Runtime",
      "summary": "Shared state containers for runtime components.",
      "keyFiles": [
        "state.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/state"
    },
    {
      "name": "steel",
      "path": "pkg/steel",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/steel",
      "fileCount": 1,
      "sizeBytes": 9422,
      "category": "Utilities",
      "summary": "steel package from the SolanaOS computer runtime.",
      "keyFiles": [
        "client.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/steel"
    },
    {
      "name": "storage",
      "path": "pkg/storage",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/storage",
      "fileCount": 1,
      "sizeBytes": 4002,
      "category": "Core Runtime",
      "summary": "Storage backends and persistence helpers.",
      "keyFiles": [
        "supabase.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/storage"
    },
    {
      "name": "strategy",
      "path": "pkg/strategy",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/strategy",
      "fileCount": 1,
      "sizeBytes": 10922,
      "category": "Markets",
      "summary": "Trading strategy configuration, heuristics, and decision inputs.",
      "keyFiles": [
        "strategy.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/strategy"
    },
    {
      "name": "tailscale",
      "path": "pkg/tailscale",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/tailscale",
      "fileCount": 1,
      "sizeBytes": 4081,
      "category": "Utilities",
      "summary": "tailscale package from the SolanaOS computer runtime.",
      "keyFiles": [
        "mesh.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/tailscale"
    },
    {
      "name": "tamagochi",
      "path": "pkg/tamagochi",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/tamagochi",
      "fileCount": 1,
      "sizeBytes": 12485,
      "category": "Hardware",
      "summary": "TamaGOchi miner companion logic and pet state.",
      "keyFiles": [
        "tamagochi.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/tamagochi"
    },
    {
      "name": "tools",
      "path": "pkg/tools",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/tools",
      "fileCount": 1,
      "sizeBytes": 6691,
      "category": "Intelligence",
      "summary": "Tool registry and execution surface for agents.",
      "keyFiles": [
        "tools.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/tools"
    },
    {
      "name": "trading",
      "path": "pkg/trading",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/trading",
      "fileCount": 1,
      "sizeBytes": 17050,
      "category": "Utilities",
      "summary": "trading package from the SolanaOS computer runtime.",
      "keyFiles": [
        "engine.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/trading"
    },
    {
      "name": "utils",
      "path": "pkg/utils",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/utils",
      "fileCount": 1,
      "sizeBytes": 2392,
      "category": "Utilities",
      "summary": "General-purpose utility helpers shared across the runtime.",
      "keyFiles": [
        "utils.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/utils"
    },
    {
      "name": "voice",
      "path": "pkg/voice",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/voice",
      "fileCount": 1,
      "sizeBytes": 2319,
      "category": "Seeker & Mobile",
      "summary": "Voice capture, wake flow, realtime voice, and TTS integration.",
      "keyFiles": [
        "voice.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/voice"
    },
    {
      "name": "x402",
      "path": "pkg/x402",
      "importPath": "github.com/x402agent/Solana-Os-Go/pkg/x402",
      "fileCount": 1,
      "sizeBytes": 17148,
      "category": "Markets",
      "summary": "x402 payment, monetization, and facilitator integration.",
      "keyFiles": [
        "x402.go"
      ],
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/pkg/x402"
    }
  ],
  "skills": [
    {
      "name": "1password",
      "path": "skills/1password",
      "fileCount": 3,
      "sizeBytes": 4348,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/1password",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/1password.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-1password",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install 1password",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install 1password",
        "bun": "bunx @nanosolana/nanohub@latest install 1password"
      }
    },
    {
      "name": "apple-notes",
      "path": "skills/apple-notes",
      "fileCount": 1,
      "sizeBytes": 2094,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/apple-notes",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/apple-notes.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-apple-notes",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install apple-notes",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install apple-notes",
        "bun": "bunx @nanosolana/nanohub@latest install apple-notes"
      }
    },
    {
      "name": "apple-reminders",
      "path": "skills/apple-reminders",
      "fileCount": 1,
      "sizeBytes": 3129,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/apple-reminders",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/apple-reminders.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-apple-reminders",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install apple-reminders",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install apple-reminders",
        "bun": "bunx @nanosolana/nanohub@latest install apple-reminders"
      }
    },
    {
      "name": "bear-notes",
      "path": "skills/bear-notes",
      "fileCount": 1,
      "sizeBytes": 2664,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/bear-notes",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/bear-notes.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-bear-notes",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install bear-notes",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install bear-notes",
        "bun": "bunx @nanosolana/nanohub@latest install bear-notes"
      }
    },
    {
      "name": "blogwatcher",
      "path": "skills/blogwatcher",
      "fileCount": 1,
      "sizeBytes": 1417,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/blogwatcher",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/blogwatcher.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-blogwatcher",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install blogwatcher",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install blogwatcher",
        "bun": "bunx @nanosolana/nanohub@latest install blogwatcher"
      }
    },
    {
      "name": "blucli",
      "path": "skills/blucli",
      "fileCount": 1,
      "sizeBytes": 1022,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/blucli",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/blucli.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-blucli",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install blucli",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install blucli",
        "bun": "bunx @nanosolana/nanohub@latest install blucli"
      }
    },
    {
      "name": "bluebubbles",
      "path": "skills/bluebubbles",
      "fileCount": 1,
      "sizeBytes": 3090,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/bluebubbles",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/bluebubbles.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-bluebubbles",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install bluebubbles",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install bluebubbles",
        "bun": "bunx @nanosolana/nanohub@latest install bluebubbles"
      }
    },
    {
      "name": "browse",
      "path": "skills/browse",
      "fileCount": 1,
      "sizeBytes": 9685,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/browse",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/browse.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-browse",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install browse",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install browse",
        "bun": "bunx @nanosolana/nanohub@latest install browse"
      }
    },
    {
      "name": "camsnap",
      "path": "skills/camsnap",
      "fileCount": 1,
      "sizeBytes": 1091,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/camsnap",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/camsnap.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-camsnap",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install camsnap",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install camsnap",
        "bun": "bunx @nanosolana/nanohub@latest install camsnap"
      }
    },
    {
      "name": "canvas",
      "path": "skills/canvas",
      "fileCount": 1,
      "sizeBytes": 5541,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/canvas",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/canvas.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-canvas",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install canvas",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install canvas",
        "bun": "bunx @nanosolana/nanohub@latest install canvas"
      }
    },
    {
      "name": "clawhub",
      "path": "skills/clawhub",
      "fileCount": 1,
      "sizeBytes": 1617,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/clawhub",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/clawhub.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-clawhub",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install clawhub",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install clawhub",
        "bun": "bunx @nanosolana/nanohub@latest install clawhub"
      }
    },
    {
      "name": "coding-agent",
      "path": "skills/coding-agent",
      "fileCount": 1,
      "sizeBytes": 12952,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/coding-agent",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/coding-agent.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-coding-agent",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install coding-agent",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install coding-agent",
        "bun": "bunx @nanosolana/nanohub@latest install coding-agent"
      }
    },
    {
      "name": "cua",
      "path": "skills/cua",
      "fileCount": 1,
      "sizeBytes": 14745,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/cua",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/cua.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-cua",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install cua",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install cua",
        "bun": "bunx @nanosolana/nanohub@latest install cua"
      }
    },
    {
      "name": "discord",
      "path": "skills/discord",
      "fileCount": 1,
      "sizeBytes": 3448,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/discord",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/discord.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-discord",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install discord",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install discord",
        "bun": "bunx @nanosolana/nanohub@latest install discord"
      }
    },
    {
      "name": "e2b",
      "path": "skills/e2b",
      "fileCount": 1,
      "sizeBytes": 10660,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/e2b",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/e2b.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-e2b",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install e2b",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install e2b",
        "bun": "bunx @nanosolana/nanohub@latest install e2b"
      }
    },
    {
      "name": "eightctl",
      "path": "skills/eightctl",
      "fileCount": 1,
      "sizeBytes": 1096,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/eightctl",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/eightctl.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-eightctl",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install eightctl",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install eightctl",
        "bun": "bunx @nanosolana/nanohub@latest install eightctl"
      }
    },
    {
      "name": "gateway-node-ops",
      "path": "skills/gateway-node-ops",
      "fileCount": 1,
      "sizeBytes": 2220,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/gateway-node-ops",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/gateway-node-ops.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-gateway-node-ops",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install gateway-node-ops",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install gateway-node-ops",
        "bun": "bunx @nanosolana/nanohub@latest install gateway-node-ops"
      }
    },
    {
      "name": "gemini",
      "path": "skills/gemini",
      "fileCount": 1,
      "sizeBytes": 936,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/gemini",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/gemini.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-gemini",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install gemini",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install gemini",
        "bun": "bunx @nanosolana/nanohub@latest install gemini"
      }
    },
    {
      "name": "gh-issues",
      "path": "skills/gh-issues",
      "fileCount": 1,
      "sizeBytes": 34341,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/gh-issues",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/gh-issues.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-gh-issues",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install gh-issues",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install gh-issues",
        "bun": "bunx @nanosolana/nanohub@latest install gh-issues"
      }
    },
    {
      "name": "gifgrep",
      "path": "skills/gifgrep",
      "fileCount": 1,
      "sizeBytes": 2187,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/gifgrep",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/gifgrep.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-gifgrep",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install gifgrep",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install gifgrep",
        "bun": "bunx @nanosolana/nanohub@latest install gifgrep"
      }
    },
    {
      "name": "github",
      "path": "skills/github",
      "fileCount": 1,
      "sizeBytes": 4127,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/github",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/github.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-github",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install github",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install github",
        "bun": "bunx @nanosolana/nanohub@latest install github"
      }
    },
    {
      "name": "gog",
      "path": "skills/gog",
      "fileCount": 1,
      "sizeBytes": 4574,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/gog",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/gog.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-gog",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install gog",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install gog",
        "bun": "bunx @nanosolana/nanohub@latest install gog"
      }
    },
    {
      "name": "goplaces",
      "path": "skills/goplaces",
      "fileCount": 1,
      "sizeBytes": 1540,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/goplaces",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/goplaces.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-goplaces",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install goplaces",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install goplaces",
        "bun": "bunx @nanosolana/nanohub@latest install goplaces"
      }
    },
    {
      "name": "healthcheck",
      "path": "skills/healthcheck",
      "fileCount": 1,
      "sizeBytes": 10620,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/healthcheck",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/healthcheck.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-healthcheck",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install healthcheck",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install healthcheck",
        "bun": "bunx @nanosolana/nanohub@latest install healthcheck"
      }
    },
    {
      "name": "himalaya",
      "path": "skills/himalaya",
      "fileCount": 3,
      "sizeBytes": 12501,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/himalaya",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/himalaya.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-himalaya",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install himalaya",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install himalaya",
        "bun": "bunx @nanosolana/nanohub@latest install himalaya"
      }
    },
    {
      "name": "imsg",
      "path": "skills/imsg",
      "fileCount": 1,
      "sizeBytes": 2979,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/imsg",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/imsg.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-imsg",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install imsg",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install imsg",
        "bun": "bunx @nanosolana/nanohub@latest install imsg"
      }
    },
    {
      "name": "mcporter",
      "path": "skills/mcporter",
      "fileCount": 1,
      "sizeBytes": 1676,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/mcporter",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/mcporter.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-mcporter",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install mcporter",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install mcporter",
        "bun": "bunx @nanosolana/nanohub@latest install mcporter"
      }
    },
    {
      "name": "model-usage",
      "path": "skills/model-usage",
      "fileCount": 4,
      "sizeBytes": 15449,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/model-usage",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/model-usage.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-model-usage",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install model-usage",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install model-usage",
        "bun": "bunx @nanosolana/nanohub@latest install model-usage"
      }
    },
    {
      "name": "nano-banana-pro",
      "path": "skills/nano-banana-pro",
      "fileCount": 3,
      "sizeBytes": 10877,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/nano-banana-pro",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/nano-banana-pro.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-nano-banana-pro",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install nano-banana-pro",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install nano-banana-pro",
        "bun": "bunx @nanosolana/nanohub@latest install nano-banana-pro"
      }
    },
    {
      "name": "nano-pdf",
      "path": "skills/nano-pdf",
      "fileCount": 1,
      "sizeBytes": 956,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/nano-pdf",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/nano-pdf.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-nano-pdf",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install nano-pdf",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install nano-pdf",
        "bun": "bunx @nanosolana/nanohub@latest install nano-pdf"
      }
    },
    {
      "name": "notion",
      "path": "skills/notion",
      "fileCount": 1,
      "sizeBytes": 5383,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/notion",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/notion.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-notion",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install notion",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install notion",
        "bun": "bunx @nanosolana/nanohub@latest install notion"
      }
    },
    {
      "name": "obsidian",
      "path": "skills/obsidian",
      "fileCount": 1,
      "sizeBytes": 2533,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/obsidian",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/obsidian.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-obsidian",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install obsidian",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install obsidian",
        "bun": "bunx @nanosolana/nanohub@latest install obsidian"
      }
    },
    {
      "name": "openai-image-gen",
      "path": "skills/openai-image-gen",
      "fileCount": 3,
      "sizeBytes": 19335,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/openai-image-gen",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/openai-image-gen.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-openai-image-gen",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install openai-image-gen",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install openai-image-gen",
        "bun": "bunx @nanosolana/nanohub@latest install openai-image-gen"
      }
    },
    {
      "name": "openai-whisper",
      "path": "skills/openai-whisper",
      "fileCount": 1,
      "sizeBytes": 914,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/openai-whisper",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/openai-whisper.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-openai-whisper",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install openai-whisper",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install openai-whisper",
        "bun": "bunx @nanosolana/nanohub@latest install openai-whisper"
      }
    },
    {
      "name": "openai-whisper-api",
      "path": "skills/openai-whisper-api",
      "fileCount": 2,
      "sizeBytes": 2641,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/openai-whisper-api",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/openai-whisper-api.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-openai-whisper-api",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install openai-whisper-api",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install openai-whisper-api",
        "bun": "bunx @nanosolana/nanohub@latest install openai-whisper-api"
      }
    },
    {
      "name": "openclaw-claude-code-skill-main",
      "path": "skills/openclaw-claude-code-skill-main",
      "fileCount": 21,
      "sizeBytes": 119775,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/openclaw-claude-code-skill-main",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/openclaw-claude-code-skill-main.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-openclaw-claude-code-skill-main",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install openclaw-claude-code-skill-main",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install openclaw-claude-code-skill-main",
        "bun": "bunx @nanosolana/nanohub@latest install openclaw-claude-code-skill-main"
      }
    },
    {
      "name": "openhue",
      "path": "skills/openhue",
      "fileCount": 1,
      "sizeBytes": 2462,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/openhue",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/openhue.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-openhue",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install openhue",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install openhue",
        "bun": "bunx @nanosolana/nanohub@latest install openhue"
      }
    },
    {
      "name": "oracle",
      "path": "skills/oracle",
      "fileCount": 1,
      "sizeBytes": 5075,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/oracle",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/oracle.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-oracle",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install oracle",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install oracle",
        "bun": "bunx @nanosolana/nanohub@latest install oracle"
      }
    },
    {
      "name": "ordercli",
      "path": "skills/ordercli",
      "fileCount": 1,
      "sizeBytes": 2391,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/ordercli",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/ordercli.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-ordercli",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install ordercli",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install ordercli",
        "bun": "bunx @nanosolana/nanohub@latest install ordercli"
      }
    },
    {
      "name": "pdf-to-markdown",
      "path": "skills/pdf-to-markdown",
      "fileCount": 1,
      "sizeBytes": 6521,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pdf-to-markdown",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pdf-to-markdown.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pdf-to-markdown",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pdf-to-markdown",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pdf-to-markdown",
        "bun": "bunx @nanosolana/nanohub@latest install pdf-to-markdown"
      }
    },
    {
      "name": "peekaboo",
      "path": "skills/peekaboo",
      "fileCount": 1,
      "sizeBytes": 5972,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/peekaboo",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/peekaboo.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-peekaboo",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install peekaboo",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install peekaboo",
        "bun": "bunx @nanosolana/nanohub@latest install peekaboo"
      }
    },
    {
      "name": "pump-admin-ops",
      "path": "skills/pump-admin-ops",
      "fileCount": 1,
      "sizeBytes": 2743,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pump-admin-ops",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pump-admin-ops.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pump-admin-ops",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pump-admin-ops",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pump-admin-ops",
        "bun": "bunx @nanosolana/nanohub@latest install pump-admin-ops"
      }
    },
    {
      "name": "pump-ai-agents",
      "path": "skills/pump-ai-agents",
      "fileCount": 1,
      "sizeBytes": 3272,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pump-ai-agents",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pump-ai-agents.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pump-ai-agents",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pump-ai-agents",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pump-ai-agents",
        "bun": "bunx @nanosolana/nanohub@latest install pump-ai-agents"
      }
    },
    {
      "name": "pump-bonding-curve",
      "path": "skills/pump-bonding-curve",
      "fileCount": 1,
      "sizeBytes": 4936,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pump-bonding-curve",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pump-bonding-curve.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pump-bonding-curve",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pump-bonding-curve",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pump-bonding-curve",
        "bun": "bunx @nanosolana/nanohub@latest install pump-bonding-curve"
      }
    },
    {
      "name": "pump-build-release",
      "path": "skills/pump-build-release",
      "fileCount": 1,
      "sizeBytes": 2504,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pump-build-release",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pump-build-release.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pump-build-release",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pump-build-release",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pump-build-release",
        "bun": "bunx @nanosolana/nanohub@latest install pump-build-release"
      }
    },
    {
      "name": "pump-claims-readonly",
      "path": "skills/pump-claims-readonly",
      "fileCount": 1,
      "sizeBytes": 8245,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pump-claims-readonly",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pump-claims-readonly.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pump-claims-readonly",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pump-claims-readonly",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pump-claims-readonly",
        "bun": "bunx @nanosolana/nanohub@latest install pump-claims-readonly"
      }
    },
    {
      "name": "pump-fee-sharing",
      "path": "skills/pump-fee-sharing",
      "fileCount": 1,
      "sizeBytes": 3561,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pump-fee-sharing",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pump-fee-sharing.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pump-fee-sharing",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pump-fee-sharing",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pump-fee-sharing",
        "bun": "bunx @nanosolana/nanohub@latest install pump-fee-sharing"
      }
    },
    {
      "name": "pump-fee-system",
      "path": "skills/pump-fee-system",
      "fileCount": 1,
      "sizeBytes": 3253,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pump-fee-system",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pump-fee-system.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pump-fee-system",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pump-fee-system",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pump-fee-system",
        "bun": "bunx @nanosolana/nanohub@latest install pump-fee-system"
      }
    },
    {
      "name": "pump-mcp-server",
      "path": "skills/pump-mcp-server",
      "fileCount": 1,
      "sizeBytes": 3175,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pump-mcp-server",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pump-mcp-server.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pump-mcp-server",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pump-mcp-server",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pump-mcp-server",
        "bun": "bunx @nanosolana/nanohub@latest install pump-mcp-server"
      }
    },
    {
      "name": "pump-rust-vanity",
      "path": "skills/pump-rust-vanity",
      "fileCount": 1,
      "sizeBytes": 4029,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pump-rust-vanity",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pump-rust-vanity.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pump-rust-vanity",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pump-rust-vanity",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pump-rust-vanity",
        "bun": "bunx @nanosolana/nanohub@latest install pump-rust-vanity"
      }
    },
    {
      "name": "pump-sdk-core",
      "path": "skills/pump-sdk-core",
      "fileCount": 1,
      "sizeBytes": 4131,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pump-sdk-core",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pump-sdk-core.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pump-sdk-core",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pump-sdk-core",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pump-sdk-core",
        "bun": "bunx @nanosolana/nanohub@latest install pump-sdk-core"
      }
    },
    {
      "name": "pump-security",
      "path": "skills/pump-security",
      "fileCount": 1,
      "sizeBytes": 3580,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pump-security",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pump-security.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pump-security",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pump-security",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pump-security",
        "bun": "bunx @nanosolana/nanohub@latest install pump-security"
      }
    },
    {
      "name": "pump-shell-scripts",
      "path": "skills/pump-shell-scripts",
      "fileCount": 1,
      "sizeBytes": 2861,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pump-shell-scripts",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pump-shell-scripts.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pump-shell-scripts",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pump-shell-scripts",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pump-shell-scripts",
        "bun": "bunx @nanosolana/nanohub@latest install pump-shell-scripts"
      }
    },
    {
      "name": "pump-solana-architecture",
      "path": "skills/pump-solana-architecture",
      "fileCount": 1,
      "sizeBytes": 4071,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pump-solana-architecture",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pump-solana-architecture.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pump-solana-architecture",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pump-solana-architecture",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pump-solana-architecture",
        "bun": "bunx @nanosolana/nanohub@latest install pump-solana-architecture"
      }
    },
    {
      "name": "pump-solana-dev",
      "path": "skills/pump-solana-dev",
      "fileCount": 1,
      "sizeBytes": 3666,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pump-solana-dev",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pump-solana-dev.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pump-solana-dev",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pump-solana-dev",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pump-solana-dev",
        "bun": "bunx @nanosolana/nanohub@latest install pump-solana-dev"
      }
    },
    {
      "name": "pump-solana-wallet",
      "path": "skills/pump-solana-wallet",
      "fileCount": 1,
      "sizeBytes": 3047,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pump-solana-wallet",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pump-solana-wallet.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pump-solana-wallet",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pump-solana-wallet",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pump-solana-wallet",
        "bun": "bunx @nanosolana/nanohub@latest install pump-solana-wallet"
      }
    },
    {
      "name": "pump-testing",
      "path": "skills/pump-testing",
      "fileCount": 1,
      "sizeBytes": 2839,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pump-testing",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pump-testing.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pump-testing",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pump-testing",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pump-testing",
        "bun": "bunx @nanosolana/nanohub@latest install pump-testing"
      }
    },
    {
      "name": "pump-token-incentives",
      "path": "skills/pump-token-incentives",
      "fileCount": 1,
      "sizeBytes": 3153,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pump-token-incentives",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pump-token-incentives.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pump-token-incentives",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pump-token-incentives",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pump-token-incentives",
        "bun": "bunx @nanosolana/nanohub@latest install pump-token-incentives"
      }
    },
    {
      "name": "pump-token-lifecycle",
      "path": "skills/pump-token-lifecycle",
      "fileCount": 1,
      "sizeBytes": 4758,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pump-token-lifecycle",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pump-token-lifecycle.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pump-token-lifecycle",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pump-token-lifecycle",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pump-token-lifecycle",
        "bun": "bunx @nanosolana/nanohub@latest install pump-token-lifecycle"
      }
    },
    {
      "name": "pump-ts-vanity",
      "path": "skills/pump-ts-vanity",
      "fileCount": 1,
      "sizeBytes": 2969,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pump-ts-vanity",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pump-ts-vanity.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pump-ts-vanity",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pump-ts-vanity",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pump-ts-vanity",
        "bun": "bunx @nanosolana/nanohub@latest install pump-ts-vanity"
      }
    },
    {
      "name": "pump-website",
      "path": "skills/pump-website",
      "fileCount": 1,
      "sizeBytes": 3522,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pump-website",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pump-website.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pump-website",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pump-website",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pump-website",
        "bun": "bunx @nanosolana/nanohub@latest install pump-website"
      }
    },
    {
      "name": "pumpfun-analytics",
      "path": "skills/pumpfun-analytics",
      "fileCount": 1,
      "sizeBytes": 3184,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pumpfun-analytics",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pumpfun-analytics.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pumpfun-analytics",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pumpfun-analytics",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pumpfun-analytics",
        "bun": "bunx @nanosolana/nanohub@latest install pumpfun-analytics"
      }
    },
    {
      "name": "pumpfun-fees",
      "path": "skills/pumpfun-fees",
      "fileCount": 1,
      "sizeBytes": 2450,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pumpfun-fees",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pumpfun-fees.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pumpfun-fees",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pumpfun-fees",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pumpfun-fees",
        "bun": "bunx @nanosolana/nanohub@latest install pumpfun-fees"
      }
    },
    {
      "name": "pumpfun-launcher",
      "path": "skills/pumpfun-launcher",
      "fileCount": 1,
      "sizeBytes": 2533,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pumpfun-launcher",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pumpfun-launcher.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pumpfun-launcher",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pumpfun-launcher",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pumpfun-launcher",
        "bun": "bunx @nanosolana/nanohub@latest install pumpfun-launcher"
      }
    },
    {
      "name": "pumpfun-token-scanner",
      "path": "skills/pumpfun-token-scanner",
      "fileCount": 7,
      "sizeBytes": 69279,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pumpfun-token-scanner",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pumpfun-token-scanner.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pumpfun-token-scanner",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pumpfun-token-scanner",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pumpfun-token-scanner",
        "bun": "bunx @nanosolana/nanohub@latest install pumpfun-token-scanner"
      }
    },
    {
      "name": "pumpfun-trading",
      "path": "skills/pumpfun-trading",
      "fileCount": 1,
      "sizeBytes": 2659,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/pumpfun-trading",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/pumpfun-trading.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-pumpfun-trading",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install pumpfun-trading",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install pumpfun-trading",
        "bun": "bunx @nanosolana/nanohub@latest install pumpfun-trading"
      }
    },
    {
      "name": "sag",
      "path": "skills/sag",
      "fileCount": 1,
      "sizeBytes": 2299,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/sag",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/sag.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-sag",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install sag",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install sag",
        "bun": "bunx @nanosolana/nanohub@latest install sag"
      }
    },
    {
      "name": "seeker-daemon-ops",
      "path": "skills/seeker-daemon-ops",
      "fileCount": 1,
      "sizeBytes": 902,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/seeker-daemon-ops",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/seeker-daemon-ops.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-seeker-daemon-ops",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install seeker-daemon-ops",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install seeker-daemon-ops",
        "bun": "bunx @nanosolana/nanohub@latest install seeker-daemon-ops"
      }
    },
    {
      "name": "session-logs",
      "path": "skills/session-logs",
      "fileCount": 1,
      "sizeBytes": 3443,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/session-logs",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/session-logs.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-session-logs",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install session-logs",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install session-logs",
        "bun": "bunx @nanosolana/nanohub@latest install session-logs"
      }
    },
    {
      "name": "sherpa-onnx-tts",
      "path": "skills/sherpa-onnx-tts",
      "fileCount": 2,
      "sizeBytes": 8226,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/sherpa-onnx-tts",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/sherpa-onnx-tts.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-sherpa-onnx-tts",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install sherpa-onnx-tts",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install sherpa-onnx-tts",
        "bun": "bunx @nanosolana/nanohub@latest install sherpa-onnx-tts"
      }
    },
    {
      "name": "skill-creator",
      "path": "skills/skill-creator",
      "fileCount": 7,
      "sizeBytes": 61486,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/skill-creator",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/skill-creator.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-skill-creator",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install skill-creator",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install skill-creator",
        "bun": "bunx @nanosolana/nanohub@latest install skill-creator"
      }
    },
    {
      "name": "slack",
      "path": "skills/slack",
      "fileCount": 1,
      "sizeBytes": 2509,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/slack",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/slack.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-slack",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install slack",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install slack",
        "bun": "bunx @nanosolana/nanohub@latest install slack"
      }
    },
    {
      "name": "solana-research-brief",
      "path": "skills/solana-research-brief",
      "fileCount": 1,
      "sizeBytes": 813,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/solana-research-brief",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/solana-research-brief.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-solana-research-brief",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install solana-research-brief",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install solana-research-brief",
        "bun": "bunx @nanosolana/nanohub@latest install solana-research-brief"
      }
    },
    {
      "name": "solanaos",
      "path": "skills/solanaos",
      "fileCount": 1,
      "sizeBytes": 6249,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/solanaos",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/solanaos.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-solanaos",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install solanaos",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install solanaos",
        "bun": "bunx @nanosolana/nanohub@latest install solanaos"
      }
    },
    {
      "name": "songsee",
      "path": "skills/songsee",
      "fileCount": 1,
      "sizeBytes": 1316,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/songsee",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/songsee.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-songsee",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install songsee",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install songsee",
        "bun": "bunx @nanosolana/nanohub@latest install songsee"
      }
    },
    {
      "name": "sonoscli",
      "path": "skills/sonoscli",
      "fileCount": 1,
      "sizeBytes": 2457,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/sonoscli",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/sonoscli.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-sonoscli",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install sonoscli",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install sonoscli",
        "bun": "bunx @nanosolana/nanohub@latest install sonoscli"
      }
    },
    {
      "name": "spotify-player",
      "path": "skills/spotify-player",
      "fileCount": 1,
      "sizeBytes": 1688,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/spotify-player",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/spotify-player.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-spotify-player",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install spotify-player",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install spotify-player",
        "bun": "bunx @nanosolana/nanohub@latest install spotify-player"
      }
    },
    {
      "name": "summarize",
      "path": "skills/summarize",
      "fileCount": 1,
      "sizeBytes": 2234,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/summarize",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/summarize.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-summarize",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install summarize",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install summarize",
        "bun": "bunx @nanosolana/nanohub@latest install summarize"
      }
    },
    {
      "name": "swarm-orchestrator",
      "path": "skills/swarm-orchestrator",
      "fileCount": 1,
      "sizeBytes": 3630,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/swarm-orchestrator",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/swarm-orchestrator.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-swarm-orchestrator",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install swarm-orchestrator",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install swarm-orchestrator",
        "bun": "bunx @nanosolana/nanohub@latest install swarm-orchestrator"
      }
    },
    {
      "name": "things-mac",
      "path": "skills/things-mac",
      "fileCount": 1,
      "sizeBytes": 3561,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/things-mac",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/things-mac.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-things-mac",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install things-mac",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install things-mac",
        "bun": "bunx @nanosolana/nanohub@latest install things-mac"
      }
    },
    {
      "name": "tmux",
      "path": "skills/tmux",
      "fileCount": 3,
      "sizeBytes": 8607,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/tmux",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/tmux.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-tmux",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install tmux",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install tmux",
        "bun": "bunx @nanosolana/nanohub@latest install tmux"
      }
    },
    {
      "name": "trello",
      "path": "skills/trello",
      "fileCount": 1,
      "sizeBytes": 2691,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/trello",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/trello.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-trello",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install trello",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install trello",
        "bun": "bunx @nanosolana/nanohub@latest install trello"
      }
    },
    {
      "name": "video-frames",
      "path": "skills/video-frames",
      "fileCount": 2,
      "sizeBytes": 2310,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/video-frames",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/video-frames.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-video-frames",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install video-frames",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install video-frames",
        "bun": "bunx @nanosolana/nanohub@latest install video-frames"
      }
    },
    {
      "name": "voice-call",
      "path": "skills/voice-call",
      "fileCount": 1,
      "sizeBytes": 1169,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/voice-call",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/voice-call.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-voice-call",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install voice-call",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install voice-call",
        "bun": "bunx @nanosolana/nanohub@latest install voice-call"
      }
    },
    {
      "name": "wacli",
      "path": "skills/wacli",
      "fileCount": 1,
      "sizeBytes": 2389,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/wacli",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/wacli.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-wacli",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install wacli",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install wacli",
        "bun": "bunx @nanosolana/nanohub@latest install wacli"
      }
    },
    {
      "name": "weather",
      "path": "skills/weather",
      "fileCount": 1,
      "sizeBytes": 2289,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/weather",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/weather.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-weather",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install weather",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install weather",
        "bun": "bunx @nanosolana/nanohub@latest install weather"
      }
    },
    {
      "name": "xurl",
      "path": "skills/xurl",
      "fileCount": 1,
      "sizeBytes": 14722,
      "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/tree/main/skills/xurl",
      "downloadUrl": "https://seeker.solanaos.net/downloads/skills/xurl.zip",
      "catalogUrl": "https://seeker.solanaos.net/solanaos#skill-xurl",
      "install": {
        "npm": "npx @nanosolana/nanohub@latest install xurl",
        "pnpm": "pnpm dlx @nanosolana/nanohub@latest install xurl",
        "bun": "bunx @nanosolana/nanohub@latest install xurl"
      }
    }
  ],
  "backend": {
    "recommended": true,
    "summary": "Use web/backend as the public SolanaOS control/API layer. Keep the backend .env private and expose only the built service, not raw secrets.",
    "entries": [
      {
        "name": "main.go",
        "path": "web/backend/main.go",
        "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/blob/main/web/backend/main.go",
        "role": "HTTP server and dashboard bootstrap"
      },
      {
        "name": "gateway_access.go",
        "path": "web/backend/gateway_access.go",
        "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/blob/main/web/backend/gateway_access.go",
        "role": "Gateway auth and access wiring"
      },
      {
        "name": "Dockerfile",
        "path": "web/backend/Dockerfile",
        "sourceUrl": "https://github.com/x402agent/Solana-Os-Go/blob/main/web/backend/Dockerfile",
        "role": "Container entrypoint for deploys"
      }
    ]
  }
} as const
