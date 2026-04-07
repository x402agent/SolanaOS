# ╔══════════════════════════════════════════════════════════════════════╗
# ║  SolanaOS :: Makefile                                               ║
# ║  Build targets for x86_64, ARM64 (NVIDIA Orin Nano), RISC-V        ║
# ╠══════════════════════════════════════════════════════════════════════╣
# ║  make start          One-shot: build + start all services           ║
# ║  make dev            One-shot: start all services + UI dev server   ║
# ║  make stop           Stop all background services                   ║
# ║  make status         Show running service status                    ║
# ║  make build          Build for current platform                     ║
# ║  make slim           Build extra-slim daemon binary profile         ║
# ║  make size-report    Compare standard vs slim binary sizes          ║
# ║  make orin           Cross-compile for NVIDIA Orin Nano (arm64)     ║
# ║  make tui            Build TUI launcher                             ║
# ║  make all            Build all targets                              ║
# ║  make docker         Build Docker image                             ║
# ║  make docker-up      Docker Compose: start all services             ║
# ║  make docker-down    Docker Compose: stop all services              ║
# ║  make clean          Remove build artifacts                         ║
# ║  make install        Install to /usr/local/bin                      ║
# ║  make test           Run tests                                      ║
# ║  make build-control-api Build the SolanaOS Control API binary       ║
# ║  make scan-i2c       Scan I2C bus for Modulino® sensors             ║
# ╚══════════════════════════════════════════════════════════════════════╝

VERSION   := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT    := $(shell git rev-parse --short HEAD 2>/dev/null || echo "none")
BUILDTIME := $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
GO        ?= $(shell if [ -x /opt/homebrew/bin/go ]; then echo /opt/homebrew/bin/go; elif [ -x /usr/local/go/bin/go ]; then echo /usr/local/go/bin/go; else command -v go 2>/dev/null || echo go; fi)
GOVERSION := $(shell $(GO) version 2>/dev/null | cut -d' ' -f3 || echo "unknown")

MODULE    := github.com/x402agent/Solana-Os-Go
PKG_VER   := $(MODULE)/pkg/config

LDFLAGS   := -s -w \
  -X $(PKG_VER).Version=$(VERSION) \
  -X $(PKG_VER).GitCommit=$(COMMIT) \
  -X $(PKG_VER).BuildTime=$(BUILDTIME) \
  -X $(PKG_VER).GoVersion=$(GOVERSION)

SLIM_LDFLAGS := -s -w -buildid= \
  -X $(PKG_VER).Version=$(VERSION) \
  -X $(PKG_VER).GitCommit=$(COMMIT) \
  -X $(PKG_VER).BuildTime=$(BUILDTIME) \
  -X $(PKG_VER).GoVersion=$(GOVERSION)

# Shared build settings
GOCACHE_DIR ?= /tmp/go-build
GOTMPDIR_DIR ?= /tmp
HOST_GOMODCACHE_DIR := $(HOME)/go/pkg/mod
LOCAL_GOMODCACHE_DIR ?= $(CURDIR)/.cache/gomod
ifneq ("$(wildcard $(HOST_GOMODCACHE_DIR)/cache/download)","")
GO_PROXY_DEFAULT := file://$(HOST_GOMODCACHE_DIR)/cache/download,https://proxy.golang.org,direct
else
GO_PROXY_DEFAULT := https://proxy.golang.org,direct
endif
GOMODCACHE_DIR ?= $(LOCAL_GOMODCACHE_DIR)
GOPROXY_URL ?= $(GO_PROXY_DEFAULT)
GOENVVARS := GOCACHE=$(GOCACHE_DIR) GOTMPDIR=$(GOTMPDIR_DIR) GOMODCACHE=$(GOMODCACHE_DIR) GOPROXY=$(GOPROXY_URL)
GOBUILD   := $(GOENVVARS) $(GO) build -trimpath -ldflags "$(LDFLAGS)"
GOBUILD_SLIM := $(GOENVVARS) $(GO) build -trimpath -tags "netgo osusergo" -ldflags "$(SLIM_LDFLAGS)"
GOTEST    := $(GOENVVARS) $(GO) test -v -race

# Output directories
BUILD_DIR := ./build
BIN_CLI   := $(BUILD_DIR)/solanaos
BIN_TUI   := $(BUILD_DIR)/solanaos-tui
BIN_SLIM  := $(BUILD_DIR)/solanaos-slim
BIN_CONTROL_API   := $(BUILD_DIR)/solanaos-control-api
BIN_AGENT_WALLET  := $(BUILD_DIR)/agent-wallet
BIN_GATEWAY_API   := $(BUILD_DIR)/gateway-api

.PHONY: all build build-control-api run-control-api test-control-api build-agent-wallet start-agent-wallet stop-agent-wallet build-gateway-api build-mcp start-mcp stop-mcp npm-sync slim size-report orin tui docker docker-fly docker-up docker-down clean install test lint deps scan-i2c npm-pack seeker-install seeker-logcat connect-bundle start dev stop status help

# ── Default ───────────────────────────────────────────────────────────

all: build tui

# ── One-Shot Start ────────────────────────────────────────────────────

start:
	@bash start.sh

dev:
	@bash start.sh --with-ui

stop:
	@bash start.sh --stop

status:
	@bash start.sh --status

# ── Docker Compose ────────────────────────────────────────────────────

docker-up:
	@echo "🐳 Starting SolanaOS via Docker Compose..."
	@[ -f .env ] || (cp .env.example .env && echo "Created .env — edit before running agents")
	docker compose up -d
	@echo "✓ Services starting:"
	@echo "  Gateway:          http://localhost:8080"
	@echo "  MCP root:         http://localhost:3001/mcp"
	@echo "  solana-claude MCP: http://localhost:3000/mcp"
	@echo ""
	@echo "  Logs: docker compose logs -f"
	@echo "  Stop: make docker-down"

docker-down:
	@echo "🛑 Stopping SolanaOS Docker Compose services..."
	docker compose down
	@echo "✓ Done"

# ── Build for current platform ────────────────────────────────────────

build:
	@echo "⚡ Building SolanaOS binary..."
	@mkdir -p $(BUILD_DIR)
	@mkdir -p $(GOCACHE_DIR) $(GOTMPDIR_DIR) $(GOMODCACHE_DIR)
	$(GOBUILD) -o $(BIN_CLI) .
	@ln -sf solanaos $(BUILD_DIR)/nanosolana
	@echo "✓ $(BIN_CLI) built"
	@ls -lh $(BIN_CLI)

build-agent-wallet:
	@echo "⚡ Building Agent Wallet service..."
	@mkdir -p $(BUILD_DIR)
	@mkdir -p $(GOCACHE_DIR) $(GOTMPDIR_DIR) $(GOMODCACHE_DIR)
	$(GOBUILD) -o $(BIN_AGENT_WALLET) ./services/agent-wallet/cmd
	@echo "✓ $(BIN_AGENT_WALLET) built"
	@ls -lh $(BIN_AGENT_WALLET)

start-agent-wallet: build-agent-wallet
	@echo "🔑 Starting Agent Wallet (port $${WALLET_API_PORT:-8421})..."
	@[ -f .env ] && set -a && . ./.env && set +a; \
	 $(BIN_AGENT_WALLET) & echo $$! > /tmp/agent-wallet.pid
	@echo "✓ Agent Wallet running (pid $$(cat /tmp/agent-wallet.pid))"
	@echo "  API:  http://localhost:$${WALLET_API_PORT:-8421}/v1/health"
	@echo "  Keys: ~/.nanosolana/signers/{dev,trade}.enc"

stop-agent-wallet:
	@if [ -f /tmp/agent-wallet.pid ]; then \
	  PID=$$(cat /tmp/agent-wallet.pid); \
	  kill $$PID 2>/dev/null && echo "✓ Agent Wallet stopped (pid $$PID)" || echo "already stopped"; \
	  rm -f /tmp/agent-wallet.pid; \
	else \
	  echo "no agent-wallet.pid found"; \
	fi

build-gateway-api:
	@echo "⚡ Building Gateway API binary..."
	@mkdir -p $(BUILD_DIR)
	@mkdir -p $(GOCACHE_DIR) $(GOTMPDIR_DIR) $(GOMODCACHE_DIR)
	$(GOBUILD) -o $(BIN_GATEWAY_API) ./cmd/gateway-api
	@echo "✓ $(BIN_GATEWAY_API) built"
	@ls -lh $(BIN_GATEWAY_API)

build-mcp:
	@echo "⚡ Building SolanaOS MCP server..."
	@[ -d mcp-server ] || (echo "mcp-server/ not found" && exit 1)
	cd mcp-server && npm install --silent && npm run build
	@echo "✓ mcp-server/dist built"

start-mcp:
	@echo "🔌 Starting SolanaOS MCP server (HTTP mode, port $${MCP_PORT:-3001})..."
	@[ -f mcp-server/dist/http.js ] || $(MAKE) build-mcp
	@[ -f .env ] && set -a && . ./.env && set +a; \
	 node mcp-server/dist/http.js & echo $$! > /tmp/solanaos-pids/mcp.pid
	@echo "✓ MCP server running at http://localhost:$${MCP_PORT:-3001}/mcp"

stop-mcp:
	@if [ -f /tmp/solanaos-pids/mcp.pid ]; then \
	  PID=$$(cat /tmp/solanaos-pids/mcp.pid); \
	  kill $$PID 2>/dev/null && echo "✓ MCP server stopped (pid $$PID)" || echo "already stopped"; \
	  rm -f /tmp/solanaos-pids/mcp.pid; \
	else echo "no mcp.pid found"; fi

npm-sync:
	@echo "📦 Syncing new/npm → npm (canonical)..."
	@for pkg in solanaos solanaos-installer mawdbot-installer; do \
	  SRC="new/npm/$$pkg/package.json"; \
	  DST="npm/$$pkg/package.json"; \
	  [ -f "$$SRC" ] || continue; \
	  NEW_VER=$$(node -p "require('./$$SRC').version" 2>/dev/null); \
	  OLD_VER=$$(node -p "require('./$$DST').version" 2>/dev/null); \
	  if [ "$$NEW_VER" != "$$OLD_VER" ]; then \
	    echo "  ⚠️  $$pkg: npm/=$$OLD_VER new/npm/=$$NEW_VER — update npm/ manually then re-run"; \
	  else \
	    echo "  ✓  $$pkg: v$$OLD_VER in sync"; \
	  fi; \
	done

build-control-api:
	@echo "⚡ Building SolanaOS Control API..."
	@mkdir -p $(BUILD_DIR)
	@mkdir -p $(GOCACHE_DIR) $(GOTMPDIR_DIR) $(GOMODCACHE_DIR)
	$(GOBUILD) -o $(BIN_CONTROL_API) ./cmd/solanaos-control-api
	@echo "✓ $(BIN_CONTROL_API) built"
	@ls -lh $(BIN_CONTROL_API)

run-control-api:
	@mkdir -p $(GOCACHE_DIR) $(GOTMPDIR_DIR) $(GOMODCACHE_DIR)
	$(GOENVVARS) $(GO) run ./cmd/solanaos-control-api --addr :18789

slim:
	@echo "🪶 Building slim SolanaOS binary profile..."
	@mkdir -p $(BUILD_DIR)
	@mkdir -p $(GOCACHE_DIR) $(GOTMPDIR_DIR) $(GOMODCACHE_DIR)
	CGO_ENABLED=0 $(GOBUILD_SLIM) -o $(BIN_SLIM) .
	@ln -sf solanaos-slim $(BUILD_DIR)/nanosolana-slim
	@echo "✓ $(BIN_SLIM) built"
	@ls -lh $(BIN_SLIM)
	@echo "ℹ️ Optional extra compression: upx --best --lzma $(BIN_SLIM)"

size-report: build slim
	@echo "📏 Binary size report"
	@ls -lh $(BIN_CLI) $(BIN_SLIM)
	@echo ""
	@echo "Raw byte counts:"
	@wc -c $(BIN_CLI) $(BIN_SLIM)
	@std=$$(wc -c < $(BIN_CLI)); \
		slim=$$(wc -c < $(BIN_SLIM)); \
		delta=$$((std-slim)); \
		pct=$$(awk "BEGIN { if ($$std == 0) print 0; else printf \"%.2f\", ($$delta*100)/$$std }"); \
		echo "Reduction: $$delta bytes ($$pct%)"

tui:
	@echo "⚡ Building SolanaOS TUI Launcher..."
	@mkdir -p $(BUILD_DIR)
	@mkdir -p $(GOCACHE_DIR) $(GOTMPDIR_DIR) $(GOMODCACHE_DIR)
	$(GOBUILD) -o $(BIN_TUI) ./cmd/mawdbot-tui
	@ln -sf solanaos-tui $(BUILD_DIR)/nanosolana-tui
	@echo "✓ $(BIN_TUI) built"
	@ls -lh $(BIN_TUI)

# ── NVIDIA Orin Nano (Linux ARM64) ────────────────────────────────────
# The Orin Nano runs Ubuntu 22.04 aarch64 (Jetson Linux / JetPack 6.x)
# CGO enabled for I2C syscalls (hardware/modulino.go)

orin:
	@echo "⚡ Cross-compiling SolanaOS for NVIDIA Orin Nano (linux/arm64)..."
	@mkdir -p $(BUILD_DIR)
	@mkdir -p $(GOCACHE_DIR) $(GOTMPDIR_DIR) $(GOMODCACHE_DIR)
	GOOS=linux GOARCH=arm64 CGO_ENABLED=0 \
		$(GOBUILD) -o $(BUILD_DIR)/solanaos-orin .
	GOOS=linux GOARCH=arm64 CGO_ENABLED=0 \
		$(GOBUILD) -o $(BUILD_DIR)/solanaos-tui-orin ./cmd/mawdbot-tui
	@ln -sf solanaos-orin $(BUILD_DIR)/nanosolana-orin
	@ln -sf solanaos-tui-orin $(BUILD_DIR)/nanosolana-tui-orin
	@echo "✓ Orin Nano binaries:"
	@ls -lh $(BUILD_DIR)/solanaos-orin $(BUILD_DIR)/solanaos-tui-orin
	@echo ""
	@echo "📦 Deploy to Orin Nano:"
	@echo "  scp $(BUILD_DIR)/solanaos-orin user@orin-nano:~/solanaos"
	@echo "  scp $(BUILD_DIR)/solanaos-tui-orin user@orin-nano:~/solanaos-tui"

# ── Raspberry Pi / Generic ARM ────────────────────────────────────────

rpi:
	@echo "⚡ Cross-compiling SolanaOS for Raspberry Pi (linux/arm64)..."
	@mkdir -p $(BUILD_DIR)
	@mkdir -p $(GOCACHE_DIR) $(GOTMPDIR_DIR) $(GOMODCACHE_DIR)
	GOOS=linux GOARCH=arm64 CGO_ENABLED=0 \
		$(GOBUILD) -o $(BUILD_DIR)/solanaos-rpi .
	@ln -sf solanaos-rpi $(BUILD_DIR)/nanosolana-rpi
	@echo "✓ $(BUILD_DIR)/solanaos-rpi built"

# ── RISC-V ────────────────────────────────────────────────────────────

riscv:
	@echo "⚡ Cross-compiling SolanaOS for RISC-V (linux/riscv64)..."
	@mkdir -p $(BUILD_DIR)
	@mkdir -p $(GOCACHE_DIR) $(GOTMPDIR_DIR) $(GOMODCACHE_DIR)
	GOOS=linux GOARCH=riscv64 CGO_ENABLED=0 \
		$(GOBUILD) -o $(BUILD_DIR)/solanaos-riscv .
	@ln -sf solanaos-riscv $(BUILD_DIR)/nanosolana-riscv
	@echo "✓ $(BUILD_DIR)/solanaos-riscv built"

# ── macOS (Apple Silicon) ─────────────────────────────────────────────

macos:
	@echo "⚡ Building SolanaOS for macOS (darwin/arm64)..."
	@mkdir -p $(BUILD_DIR)
	@mkdir -p $(GOCACHE_DIR) $(GOTMPDIR_DIR) $(GOMODCACHE_DIR)
	GOOS=darwin GOARCH=arm64 \
		$(GOBUILD) -o $(BUILD_DIR)/solanaos-macos .
	@ln -sf solanaos-macos $(BUILD_DIR)/nanosolana-macos
	@echo "✓ $(BUILD_DIR)/solanaos-macos built"

# ── All platforms ─────────────────────────────────────────────────────

cross: build orin rpi riscv macos
	@echo ""
	@echo "⚡ SolanaOS — all cross-compilation complete:"
	@ls -lh $(BUILD_DIR)/

# ── Docker ────────────────────────────────────────────────────────────

docker:
	@echo "🐳 Building SolanaOS Docker image..."
	docker build -t solanaos:$(VERSION) -t solanaos:latest -t nanosolana:$(VERSION) -t nanosolana:latest .
	@echo "✓ Docker images built: solanaos:$(VERSION) (compat: nanosolana:$(VERSION))"

docker-fly:
	@echo "🐳 Building Fly.io image..."
	docker build -f Dockerfile.fly -t solanaos-fly:$(VERSION) -t solanaos-fly:latest .
	@echo "✓ Fly image built: solanaos-fly:$(VERSION)"

docker-orin:
	@echo "🐳 Building SolanaOS Docker image for Orin Nano (linux/arm64)..."
	docker buildx build --platform linux/arm64 \
		-t solanaos:$(VERSION)-orin \
		-t solanaos:latest-orin \
		-t nanosolana:$(VERSION)-orin \
		-t nanosolana:latest-orin .
	@echo "✓ Docker image built: solanaos:$(VERSION)-orin (compat tag also published)"

# ── Install ───────────────────────────────────────────────────────────

install: build tui build-agent-wallet build-gateway-api
	@echo "📦 Installing SolanaOS to /usr/local/bin..."
	install -m 755 $(BIN_CLI) /usr/local/bin/solanaos
	install -m 755 $(BIN_TUI) /usr/local/bin/solanaos-tui
	install -m 755 $(BIN_AGENT_WALLET) /usr/local/bin/agent-wallet
	install -m 755 $(BIN_GATEWAY_API) /usr/local/bin/solanaos-gateway
	ln -sf /usr/local/bin/solanaos /usr/local/bin/nanosolana
	ln -sf /usr/local/bin/solanaos-tui /usr/local/bin/nanosolana-tui
	@echo "✓ Installed: solanaos, solanaos-tui, agent-wallet, solanaos-gateway"
	@echo "  Compat aliases: nanosolana, nanosolana-tui"

# ── Test ──────────────────────────────────────────────────────────────

test:
	@echo "🧪 Running tests..."
	$(GOTEST) ./...

test-control-api:
	@echo "🧪 Running SolanaOS Control API tests..."
	$(GOTEST) ./pkg/controlapi/... ./cmd/solanaos-control-api/...

lint:
	@echo "🔍 Running linter..."
	golangci-lint run ./...

# ── Dependencies ──────────────────────────────────────────────────────

deps:
	@echo "📦 Installing dependencies..."
	$(GO) mod download
	$(GO) mod tidy

seeker-install:
	@$(MAKE) -C apps/android seeker-install

seeker-logcat:
	@$(MAKE) -C apps/android seeker-logcat

connect-bundle:
	@bash ./scripts/write-connect-bundle.sh \
		--workspace "$(HOME)/.nanosolana" \
		--install-dir "$(CURDIR)" \
		--env-file "$(CURDIR)/.env"

# ── Hardware ──────────────────────────────────────────────────────────

scan-i2c:
	@echo "🔍 Scanning I2C bus for Modulino® sensors..."
	@i2cdetect -y 1 2>/dev/null || echo "i2cdetect not available — install i2c-tools"
	@echo ""
	@echo "Expected Modulino® addresses:"
	@echo "  0x29 — Distance (VL53L4CD)"
	@echo "  0x3C — Buzzer (PKLCS1212E)"
	@echo "  0x44 — Thermo (HS3003)"
	@echo "  0x6A — Movement (LSM6DSOX)"
	@echo "  0x6C — Pixels (LC8822)"
	@echo "  0x76 — Knob (PEC11J)"
	@echo "  0x7C — Buttons (3x push)"

# ── Clean ─────────────────────────────────────────────────────────────

clean:
	@echo "🧹 Cleaning..."
	@rm -rf $(BUILD_DIR)
	@echo "✓ Clean"

npm-pack:
	@echo "📦 Verifying solanaos-cli npm package..."
	@PATH="/opt/homebrew/bin:/usr/local/bin:$$PATH"; \
		cd npm/solanaos-installer && npm pack --dry-run

# ── Help ──────────────────────────────────────────────────────────────

help:
	@echo "SolanaOS — Makefile targets:"
	@echo ""
	@echo "  ── Build ──────────────────────────────────────────────"
	@echo "  build               Build solanaos binary (current platform)"
	@echo "  build-agent-wallet  Build agent-wallet service binary"
	@echo "  build-gateway-api   Build standalone gateway-api binary"
	@echo "  build-control-api   Build solanaos-control-api binary"
	@echo "  build-mcp           Build solanaos-mcp TypeScript server"
	@echo "  tui                 Build TUI launcher"
	@echo "  slim                Build slim profile (CGO off, netgo/osusergo)"
	@echo "  all                 Build solanaos + TUI"
	@echo ""
	@echo "  ── Start / Stop ───────────────────────────────────────"
	@echo "  start               Build + start all services (via start.sh)"
	@echo "  dev                 Start all services + web UI dev server"
	@echo "  stop                Stop all background services"
	@echo "  status              Show running service status"
	@echo "  start-agent-wallet  Build + start agent-wallet in background"
	@echo "  stop-agent-wallet   Stop agent-wallet"
	@echo "  start-mcp           Build + start MCP server (HTTP, port 3001)"
	@echo "  stop-mcp            Stop MCP server"
	@echo ""
	@echo "  ── npm ────────────────────────────────────────────────"
	@echo "  npm-pack            Dry-run pack solanaos-cli npm package"
	@echo "  npm-sync            Check npm/ vs new/npm/ version drift"
	@echo ""
	@echo "  ── Cross-compile ──────────────────────────────────────"
	@echo "  orin                Cross-compile for NVIDIA Orin Nano (arm64)"
	@echo "  rpi                 Cross-compile for Raspberry Pi (arm64)"
	@echo "  riscv               Cross-compile for RISC-V"
	@echo "  macos               Build for macOS Apple Silicon"
	@echo "  cross               All cross-compilation targets"
	@echo ""
	@echo "  ── Docker ─────────────────────────────────────────────"
	@echo "  docker              Build Docker image"
	@echo "  docker-fly          Build Fly.io image"
	@echo "  docker-up           Start all services via Docker Compose"
	@echo "  docker-down         Stop Docker Compose services"
	@echo ""
	@echo "  ── Other ──────────────────────────────────────────────"
	@echo "  install             Install all binaries to /usr/local/bin"
	@echo "  test                Run Go tests"
	@echo "  lint                Run golangci-lint"
	@echo "  deps                go mod download + tidy"
	@echo "  size-report         Compare standard vs slim binary sizes"
	@echo "  scan-i2c            Scan I2C bus for Modulino sensors"
	@echo "  connect-bundle      Regenerate Seeker connect bundle"
	@echo "  clean               Remove build/ artifacts"
