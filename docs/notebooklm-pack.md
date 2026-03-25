# SolanaOS NotebookLM Pack

Generate the NotebookLM source pack with:

```bash
bash scripts/notebooklm-pack.sh
```

The script writes a flat Markdown pack to `build/notebooklm/` so NotebookLM can ingest the core SolanaOS docs and a lightweight runtime snapshot without needing the full repo tree.

## Included Source Files

- `10-root-readme.md` for the root project overview
- `11-strategy.md` for trading parameters, venue logic, and risk rules
- `12-soul.md` for identity, memory, and epistemological framing
- `13-security.md` for secret handling and disclosure policy
- `14-hardware.md` for Modulino wiring, HAL behavior, and deploy notes
- `15-nanohub-readme.md` for NanoHub registry and CLI workflows
- `16-vision.md` for the product vision and roadmap
- `20-runtime-snapshot.md` for a best-effort local CLI snapshot
- `21-command-cheatsheet.md` for CLI and Telegram command reference

## Runtime Snapshot Policy

The generated pack is intentionally conservative:

- it captures `solanaos version`, `solanaos status`, root help, and `solanaos solana --help`
- it does not intentionally embed private keys
- it avoids publishing raw wallet addresses and secret-presence inventory in the index summary

Review `build/notebooklm/20-runtime-snapshot.md` before sharing a generated pack outside your machine.

## Suggested NotebookLM Prompt

Use this notebook to answer:

1. What SolanaOS is and how the daemon, Telegram bot, OODA loop, NanoBot UI, gateway, Honcho memory, Hyperliquid and Aster perps, x402 payments, and hardware layer fit together as one system.
2. What commands exist for live operation, debugging, trading, memory management, and fleet control across Telegram, CLI, and the gateway API.
3. What the current local runtime state implies about readiness, risk exposure, and next operational steps.
4. How NanoHub, the Souls library, the skills system, and the docs site relate to the core Go runtime.
5. How the epistemological model in `SOUL.md` and `strategy.md` maps to durable learning and trading decisions.
6. What the Tailscale mesh, gateway pairing, and Seeker app enable for cross-device operator control.

## Related Docs

- [docs/command-cheatsheet.md](./command-cheatsheet.md)
- [strategy.md](../strategy.md)
- [SOUL.md](../SOUL.md)
- [docs/honcho-integration.md](./honcho-integration.md)
