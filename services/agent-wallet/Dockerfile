# NanoSolana Agent Wallet — Multi-stage Docker build
# Produces a <15MB container with the wallet API binary

FROM golang:1.25-alpine AS builder

WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" \
    -o /agent-wallet ./services/agent-wallet/cmd

# ── Runtime ──────────────────────────────────────────────────────
FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata
RUN adduser -D -u 1000 wallet

COPY --from=builder /agent-wallet /usr/local/bin/agent-wallet

USER wallet
WORKDIR /home/wallet

EXPOSE 8420

ENV WALLET_API_PORT=8420

ENTRYPOINT ["agent-wallet"]
