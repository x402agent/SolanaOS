# Bitaxe To SolanaOS To Seeker

Safe local-first install guide for a new user running their own Bitaxe miner with SolanaOS and a Solana Seeker.

This flow is designed to keep control local:

- the Bitaxe stays on your LAN
- SolanaOS runs on your own machine
- Seeker pairs to the SolanaOS gateway with a setup code
- the miner itself is never exposed directly to the public internet

## What You Need

- Bitaxe Gamma, Supra, or similar AxeOS-based miner
- home WiFi access
- a Bitcoin payout address you control
- a Mac or Linux machine for SolanaOS
- a Solana Seeker or the Android SolanaOS app

## Safe Network Model

Use this model unless you have a specific reason not to:

- Bitaxe on home WiFi
- SolanaOS on the same LAN
- Seeker connected through the SolanaOS gateway setup code
- optional remote access through Tailscale only

Do not:

- port-forward the Bitaxe AxeOS UI
- expose MawdAxe `:8420` directly to the internet
- expose the SolanaOS control API `:7777` publicly
- reuse someone else’s BTC payout address

## Step 1: Put The Bitaxe On Your WiFi

1. Power on the Bitaxe.
2. Join its temporary WiFi hotspot, usually `Bitaxe_XXXXXX`.
3. Open `http://192.168.4.1`.
4. Enter your home WiFi SSID and password.
5. Restart the miner and reconnect your laptop to your normal WiFi.

If the hotspot does not appear, hold the boot button for about 5 seconds to factory reset and try again.

## Step 2: Run The Safe Quickstart

From the SolanaOS repo root:

```bash
bash scripts/bitaxe-quickstart.sh --wallet bc1qYOUR_BTC_ADDRESS
```

What this does:

- scans your LAN for a Bitaxe
- verifies the device really looks like AxeOS
- configures the miner with your own BTC payout address
- writes local Bitaxe settings into the SolanaOS `.env`
- generates a Seeker setup bundle in `~/.solanaos/connect/`

If your miner is already configured and you do not want the script touching pool settings:

```bash
bash scripts/bitaxe-quickstart.sh --host 192.168.1.42 --skip-pool-config
```

If you want a different pool:

```bash
bash scripts/bitaxe-quickstart.sh \
  --wallet bc1qYOUR_BTC_ADDRESS \
  --pool stratum+tcp://mine.ocean.xyz:4243
```

## Step 3: Confirm The Local SolanaOS Config

The quickstart writes the local Bitaxe settings into the project `.env`.

The main values are:

```bash
BITAXE_HOST=192.168.1.42
BITAXE_ENABLED=true
BITAXE_POLL_INTERVAL=10
BITAXE_AUTO_TUNE=true
BITAXE_MAX_TEMP_C=72
BITAXE_COOL_TEMP_C=50
BITAXE_MAX_FREQ_MHZ=600
BITAXE_MIN_FREQ_MHZ=400
BITAXE_PET_NAME=MawdPet
BITAXE_POOL_URL=solo.ckpool.org
BITAXE_POOL_PORT=3333
BITAXE_POOL_USER=bc1qYOUR_BTC_ADDRESS
```

Verify the miner directly:

```bash
curl http://192.168.1.42/api/system/info
```

You should see JSON including fields like `ASICModel`, `hashRate`, and `temp`.

## Step 4: Start SolanaOS Locally

Start the runtime on your own machine:

```bash
solanaos daemon
```

In another terminal, start the Seeker gateway on LAN mode:

```bash
solanaos gateway start --no-tailscale
```

Why `--no-tailscale` here:

- it keeps the first-time pairing simple on the same LAN
- it avoids accidental confusion about which host the Seeker should reach
- you can move to Tailscale later if you want remote access

If you run SolanaOS as a LaunchAgent on macOS, restart it with:

```bash
launchctl kickstart -k gui/$(id -u)/com.solanaos.daemon
```

## Step 5: Pair The Seeker Or Android App

The quickstart generates:

```bash
cat ~/.solanaos/connect/setup-code.txt
cat ~/.solanaos/connect/solanaos-connect.json
```

On the Seeker or Android app:

1. Open `Connect`
2. Choose `Setup Code`
3. Paste the contents of `setup-code.txt`
4. Confirm the pairing

This is the safe path because the device connects to the SolanaOS gateway, not directly to the miner.

## Step 6: Verify Mining Inside SolanaOS

Check the local SolanaOS miner surface:

```bash
curl http://127.0.0.1:7777/api/miner
```

Expected shape:

```json
{
  "online": true,
  "ASICModel": "BM1370",
  "hashRate": 1200.5,
  "temp": 58.3,
  "power": 15.2
}
```

You should also see Bitaxe startup lines in the SolanaOS daemon logs.

## Step 7: Use The Hub Safely

If you want the SolanaOS Hub mining dashboard:

- first keep everything local
- only use a LAN URL or Tailscale URL
- do not publish `http://your-ip:8420` to the public internet

Examples of acceptable URLs:

- `http://192.168.1.42:8420`
- `http://your-host.tailnet-name.ts.net:8420`

Unsafe examples:

- public cloud reverse proxy to `:8420`
- home router port-forward to the Bitaxe or MawdAxe API

## Optional: Standalone MawdAxe

If you want the standalone fleet API instead of the Bitaxe support already built into SolanaOS:

```bash
cd mawdbot-bitaxe
cp .env.example .env
go run ./cmd/mawdaxe
```

That is optional. A new single-miner user does not need it just to get Bitaxe working with SolanaOS and Seeker.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Quickstart cannot find a miner | Re-run with `--host 192.168.1.X` after confirming AxeOS is reachable |
| `/api/system/info` fails | The Bitaxe is not on your WiFi yet, or the IP changed |
| `/api/miner` is offline | Check `BITAXE_HOST` in `.env` and restart `solanaos daemon` |
| Seeker cannot pair | Re-run `scripts/write-connect-bundle.sh` or the quickstart and make sure the gateway is running on `18790` |
| Hub mining page cannot connect | Use a LAN or Tailscale URL and set the API key if you enabled one |
| Miner is too hot | Improve airflow and lower frequency; keep sustained temps below the warning zone |

## Recommended First-Time Commands

```bash
# 1. Discover + configure the miner using your own wallet
bash scripts/bitaxe-quickstart.sh --wallet bc1qYOUR_BTC_ADDRESS

# 2. Start SolanaOS locally
solanaos daemon

# 3. Start the local Seeker gateway
solanaos gateway start --no-tailscale

# 4. Open the setup code
cat ~/.solanaos/connect/setup-code.txt

# 5. Verify Bitaxe inside SolanaOS
curl http://127.0.0.1:7777/api/miner
```
