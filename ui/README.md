# SolanaOS Control UI

Browser-based control panel for SolanaOS. Built with [Lit](https://lit.dev/) and [Vite](https://vite.dev/).

## Prerequisites

- Node.js 18+
- A running SolanaOS gateway (`solanaos gateway start`)

## Quick Start

```bash
# 1. Start the gateway (separate terminal)
solanaos gateway start --bind 0.0.0.0

# 2. Install dependencies
cd ui
npm install

# 3. Start the dev server
npm run dev
```

Open `http://localhost:5173` in your browser. The UI automatically connects to the gateway via WebSocket.

## How It Works

The Vite dev server (port 5173) proxies WebSocket upgrade requests to the SolanaOS gateway (port 18790). Regular HTTP requests (HTML, JS, CSS) are served by Vite as usual. Vite's own HMR WebSocket is excluded from proxying.

The UI auto-detects the gateway URL from the page origin (`ws://<current host>`), so no manual URL configuration is needed during development.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SOLANAOS_GATEWAY_HOST` | `127.0.0.1` | Gateway host for the dev proxy |
| `SOLANAOS_GATEWAY_PORT` | `18790` | Gateway port for the dev proxy |
| `OPENCLAW_CONTROL_UI_BASE_PATH` | `./` | Base path for the built assets |

Example with a remote gateway:

```bash
SOLANAOS_GATEWAY_HOST=100.122.9.113 npm run dev
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with gateway proxy |
| `npm run build` | Production build to `../dist/control-ui/` |
| `npm run preview` | Preview the production build |
| `npm test` | Run tests with Vitest |

## Architecture

```
ui/
  src/
    main.ts              Entry point
    styles.css            Global styles
    ui/
      app.ts              Main application component
      gateway.ts           WebSocket client (GatewayBrowserClient)
      app-gateway.ts       Gateway connection manager
      storage.ts           Settings persistence (localStorage)
      ...
  vite.config.ts          Dev server + WS proxy config
  vitest.config.ts        Test config
```

The gateway bridge server (`pkg/gateway/bridge.go`) accepts both raw TCP (JSON-line) and WebSocket connections on the same port. The UI uses WebSocket; CLI nodes use raw TCP.
