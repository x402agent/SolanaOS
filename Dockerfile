# syntax=docker/dockerfile:1
# ──────────────────────────────────────────────────────────────────────
# SolanaOS :: Multi-Stage Docker Build
# Final image: ~15MB (Alpine + 8.3MB binary)
# ──────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────────────
FROM golang:1.25.7-alpine AS builder

RUN apk add --no-cache git make

WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN make build

# ── Stage 1.5: Agent Registry Helper Dependencies ────────────────────
FROM node:22-alpine AS registry-deps

WORKDIR /opt/solanaos-scripts
COPY scripts/package.json ./
RUN npm install --omit=dev --ignore-scripts

# ── Stage 2: Runtime ──────────────────────────────────────────────────
FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata i2c-tools nodejs sqlite

WORKDIR /app

COPY --from=builder /src/build/solanaos /app/solanaos
COPY scripts /app/scripts
COPY --from=registry-deps /opt/solanaos-scripts/node_modules /app/scripts/node_modules

# Create workspace directories
RUN mkdir -p /root/.solanaos/workspace/vault/decisions \
             /root/.solanaos/workspace/vault/lessons \
             /root/.solanaos/workspace/vault/trades \
             /root/.solanaos/workspace/vault/research \
             /root/.solanaos/workspace/vault/inbox \
             /root/.solanaos/wallet \
             /root/.solanaos/registry \
             /root/.config/solana

# Copy .env.example as reference
COPY .env.example /app/.env.example

# Run as non-root user
RUN adduser -D -u 1000 solanaos && chown -R solanaos:solanaos /app /root/.solanaos /root/.config
USER solanaos

EXPOSE 18790

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD /app/solanaos version || exit 1

ENTRYPOINT ["/app/solanaos"]
CMD ["daemon"]
