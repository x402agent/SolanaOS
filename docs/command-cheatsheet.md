# SolanaOS Command Cheat Sheet

Use `solanaos` in installed environments. For local repo builds, replace it with `./build/solanaos`. For the web console binary, use `./build/solanaos-web`.

## Core Runtime

```bash
solanaos version
solanaos status
solanaos solana wallet
solanaos daemon
solanaos daemon --seeker --pet-name Seeker
solanaos daemon --no-telegram --no-ooda
solanaos ooda --interval 60
solanaos ooda --sim --interval 30
solanaos pet
solanaos nanobot
solanaos menubar
solanaos onboard
```

## Gateway And Mesh

```bash
solanaos gateway start
solanaos gateway start --port 19001
solanaos gateway start --no-tailscale
solanaos gateway stop
solanaos gateway setup-code
cat ~/.nanosolana/connect/setup-code.txt
solanaos node run --bridge <TAILSCALE_IP>:18790
solanaos node pair --bridge <TAILSCALE_IP>:18790 --display-name "Orin Nano"
```

## Solana Tools

```bash
solanaos solana health
solanaos solana wallet
solanaos solana balance <pubkey>
solanaos solana trending
solanaos solana research <mint>
solanaos solana swap
solanaos solana register
solanaos solana registry
```

## Hardware

```bash
solanaos hardware scan --bus 1
solanaos hardware test --bus 1
solanaos hardware monitor --bus 1 --interval 200
solanaos hardware demo --bus 1
solanaos ooda --hw-bus 1 --interval 30
```

## Web Console

```bash
solanaos-web --no-browser
```

## Telegram Commands: Memory

```text
/status
/wallet
/pet
/memory
/recall <query>
/remember <fact>
/ask_memory <question>
/forget <query>
/memory_search <query>
/memory_sessions
/honcho_status
/honcho_context [query]
/honcho_sessions [page] [size]
/honcho_summaries
/honcho_search <query>
/honcho_messages [page] [size]
/honcho_conclusions [query]
/dream
/profile
/card
/user_model
/learn_status
/model
/new
```

## Telegram Commands: Trading (Spot)

```text
/trending
/ooda
/sim
/live
/strategy
/set <param> <value>
/trades
/buy <symbol|mint> <amount_sol> [slippage_bps]
/sell <symbol|mint> <amount|pct%|all> [slippage_bps]
/research <mint>
```

## Telegram Commands: Hyperliquid Perps

```text
/hl
/hl_balance
/hl_positions
/hl_orders
/hl_stream
/hl_mid <COIN>
/hl_fills [COIN]
/hl_candles <COIN> [interval] [hours]
/hl_open <COIN> <long|short> [size] [slippage%]
/hl_order <COIN> <long|short> <size> <price> [gtc|alo|ioc] [reduce]
/hl_close <COIN> [size]
/hl_cancel
/hl_leverage <COIN> <LEV> [cross|isolated]
/positions
```

## Telegram Commands: Aster Perps

```text
/perps
/aster
/aster_account
/aster_positions
/aster_orders [symbol]
/aster_trades <symbol>
/aster_income [symbol] [incomeType]
/along <symbol> [size_pct] [confidence] [thesis]
/ashort <symbol> [size_pct] [confidence] [thesis]
/aclose <symbol> [reason]
```

## Telegram Commands: Skills And Registry

```text
/skills
/skill <name>
/skill_find <query>
/skill_use <name>
/skill_create <name> <desc>
/skills_count
/registry
/registry_sync
```

## Telegram Commands: LLM And Media

```text
/model
/mimo <prompt>
/web <query>
/xsearch <query>
/vision <image_url> [question]
/image <prompt>
/video <prompt>
/multi <query>
/grok
```

## Natural Language Examples

```text
show my aster account
show my aster positions
what's trending on aster right now?
long btc on aster 10%
close sol on aster
show my hyperliquid balance
open a 0.01 btc long on hyperliquid
what risk preferences have I shown?
what did I trade last week?
```

## NanoHub CLI

```bash
npx @nanosolana/nanohub --help
npx @nanosolana/nanohub login
npx @nanosolana/nanohub search solana
npx @nanosolana/nanohub install <slug>
npx @nanosolana/nanohub publish ./my-skill \
  --slug my-skill \
  --name "My Skill" \
  --version 1.0.0 \
  --tags latest,solana
```

## Related Docs

- `strategy.md` is the canonical strategy and risk document.
- [docs/HARDWARE.md](./HARDWARE.md) covers Modulino wiring and hardware workflows.
- [docs/honcho-integration.md](./honcho-integration.md) covers the Honcho memory model and env setup.
- [docs/cli-guide.md](./cli-guide.md) covers broader CLI behavior and operational context.
