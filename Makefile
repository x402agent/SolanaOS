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
BIN_CONTROL_API := $(BUILD_DIR)/solanaos-control-api

.PHONY: all build build-control-api run-control-api test-control-api slim size-report orin tui docker docker-fly docker-up docker-down clean install test lint deps scan-i2c npm-pack seeker-install seeker-logcat connect-bundle start dev stop status

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

install: build tui
	@echo "📦 Installing SolanaOS to /usr/local/bin..."
	install -m 755 $(BIN_CLI) /usr/local/bin/solanaos
	install -m 755 $(BIN_TUI) /usr/local/bin/solanaos-tui
	ln -sf /usr/local/bin/solanaos /usr/local/bin/nanosolana
	ln -sf /usr/local/bin/solanaos-tui /usr/local/bin/nanosolana-tui
	@echo "✓ Installed solanaos and solanaos-tui (compat aliases: nanosolana, nanosolana-tui)"

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
	@echo "  build       Build for current platform"
	@echo "  slim        Build slim profile (CGO off, netgo/osusergo tags)"
	@echo "  size-report Build standard + slim and print size deltas"
	@echo "  tui         Build TUI launcher"
	@echo "  all         Build CLI + TUI"
	@echo "  orin        Cross-compile for NVIDIA Orin Nano (linux/arm64)"
	@echo "  rpi         Cross-compile for Raspberry Pi (linux/arm64)"
	@echo "  riscv       Cross-compile for RISC-V (linux/riscv64)"
	@echo "  macos       Build for macOS Apple Silicon"
	@echo "  cross       All cross-compilation targets"
	@echo "  docker      Build Docker image"
	@echo "  docker-fly  Build the Fly.io image"
	@echo "  npm-pack    Dry-run pack the solanaos-cli npm package"
