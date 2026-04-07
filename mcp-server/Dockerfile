# SolanaOS MCP Server — Fly.io Dockerfile
# Adapted from Claude Code's mcp-server/Dockerfile
# Deploy: fly launch --name solanaos-mcp && fly deploy

FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files and install deps
COPY mcp-server/package.json mcp-server/tsconfig.json ./
RUN npm install

# Copy source and build
COPY mcp-server/src ./src
RUN npm run build

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Copy only production deps
COPY mcp-server/package.json ./
RUN npm install --omit=dev

# Copy built dist
COPY --from=builder /app/dist ./dist

# Copy SOUL.md and skills directory (for MCP resources)
COPY SOUL.md ./SOUL.md
COPY skills ./skills

# Environment defaults
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

# Health check for Fly.io
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["node", "dist/http.js"]
