# SolanaOS Control — Railway Dockerfile
# Build the backend and the branded frontend in one image.

FROM node:20-alpine AS frontend-builder
WORKDIR /src/web/frontend
COPY web/frontend/package*.json ./
RUN npm ci
COPY web/frontend ./
RUN npm run build

FROM golang:1.26-alpine AS backend-builder
WORKDIR /src
COPY go.mod go.sum ./
COPY pkg ./pkg
COPY web/backend ./web/backend
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/solanaos-web ./web/backend

FROM alpine:3.21
RUN apk add --no-cache ca-certificates

WORKDIR /app
COPY --from=backend-builder /out/solanaos-web ./solanaos-web
COPY --from=frontend-builder /src/web/frontend/dist ./web/frontend/dist

RUN mkdir -p /root/.nanosolana && \
    echo '{"agent":"SolanaOS Control","version":"1.0.0"}' > /root/.nanosolana/config.json

ENV PORT=18800
EXPOSE 18800

CMD ["./solanaos-web", "--public", "--no-browser"]
