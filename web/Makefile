# SolanaOS Web — Makefile
# Adapted from PicoClaw web/Makefile

.PHONY: all frontend backend clean dev orin

all: frontend backend

# Build frontend (Vite + React)
frontend:
	cd frontend && npm install && npm run build

# Build Go backend
backend:
	go build -o ../build/solanaos-web ./backend/
	ln -sf solanaos-web ../build/solanaos-web

# Dev mode — run both frontend and backend
dev:
	@echo "Starting SolanaOS Web Console..."
	@echo "Frontend: http://localhost:5173"
	@echo "Backend:  http://localhost:18800"
	cd frontend && npm run dev &
	go run ./backend/

# Cross-compile backend for ARM64 (Orin Nano)
orin:
	GOOS=linux GOARCH=arm64 go build -o ../build/solanaos-web-orin ./backend/
	ln -sf solanaos-web-orin ../build/solanaos-web-orin

clean:
	rm -rf frontend/dist frontend/node_modules
	rm -f ../build/solanaos-web ../build/solanaos-web-orin ../build/solanaos-web ../build/solanaos-web-orin
