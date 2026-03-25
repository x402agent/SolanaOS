# SolanaOS macOS App

Native macOS companion app and menu-bar control surface for SolanaOS.

This app sits on top of the existing OpenClaw macOS codebase, but its public release surface is SolanaOS: local gateway control, shared connect handoff, Seeker onboarding, Hub links, Souls links, and strategy-builder access.

## What it is

- menu-bar companion for the local SolanaOS runtime
- local gateway monitor and launcher
- shared handoff consumer for `~/.nanosolana/connect/solanaos-connect.json`
- macOS-side operator UI for the same runtime used by Seeker, the browser extension, and the Hub

## Install Options

### 1. DMG installer

```bash
./scripts/package-macos.sh
./scripts/package-macos.sh --sign
./scripts/package-macos.sh --notarize
```

The DMG should contain:

- `SolanaOS.app`
- the bundled `solanaos` runtime
- the menu-bar companion UI

If you already have SolanaOS installed via CLI or npm, the app auto-imports the gateway URL and secret from:

- `~/.nanosolana/connect/solanaos-connect.json`

### 2. CLI install

```bash
curl -fsSL https://raw.githubusercontent.com/x402agent/SolanaOS/newnew/install.sh | bash
cat ~/.nanosolana/connect/setup-code.txt
```

### 3. npm install

```bash
npx solanaos-computer@latest install --with-web
```

## Shared runtime files

These are the main cross-device handoff files used by macOS, Android, Seeker, and web surfaces:

- `~/.nanosolana/connect/solanaos-connect.json`
- `~/.nanosolana/connect/setup-code.txt`

The setup code is the same payload used by Android onboarding and browser-based connect flows.

## Useful public links

- Hub: https://seeker.solanaos.net
- Souls: https://souls.solanaos.net
- Dashboard: https://seeker.solanaos.net/dashboard
- Strategy Builder: https://seeker.solanaos.net/strategy
- Docs: https://go.solanaos.net
- GitHub: https://github.com/x402agent/SolanaOS

## Build from source

```bash
cd apps/macos
swift build --product SolanaOS
swift build --product solanaos-mac
```

Compatibility aliases are still present:

```bash
swift build --product OpenClaw
swift build --product openclaw-mac
```

## Key source areas

- `Package.swift` — public products and package manifest
- `SolanaOSMenuBar.swift` — standalone menu-bar sample/controller
- `Sources/OpenClaw/MenuBar.swift` — main macOS app entrypoint
- `Sources/OpenClaw/AppState.swift` — main state and runtime coordination
- `Sources/OpenClaw/SolanaOSGatewaySettings.swift` — gateway config and health checks
- `Sources/OpenClaw/SolanaOSInstallHandoff.swift` — shared connect bundle import

## Current architecture note

The internal module and target graph still uses `OpenClaw*` names in many places. That is deliberate for now: it preserves the working macOS codebase and test suite while exposing SolanaOS-branded products for public release.

## Signing and notarization

```bash
export SIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="your@email.com"
export APPLE_TEAM_ID="TEAMID"
export APPLE_APP_PASSWORD="app-specific-password"

./scripts/package-macos.sh --notarize
```

## Release checks

```bash
cd apps/macos
swift test
swift build --product SolanaOS
```
