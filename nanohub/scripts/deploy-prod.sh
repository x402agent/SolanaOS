#!/usr/bin/env bash
set -euo pipefail

if [[ -f ".env.deploy" ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.deploy
  set +a
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "Error: bun is required but not installed." >&2
  exit 1
fi

if ! command -v vercel >/dev/null 2>&1; then
  echo "Error: vercel CLI is required but not installed." >&2
  exit 1
fi

if [[ -z "${CONVEX_DEPLOY_KEY:-}" ]]; then
  echo "Error: CONVEX_DEPLOY_KEY is not set." >&2
  exit 1
fi

if [[ -z "${CONVEX_SITE_URL:-}" ]]; then
  echo "Error: CONVEX_SITE_URL is not set." >&2
  exit 1
fi

if [[ -z "${VITE_CONVEX_URL:-}" ]]; then
  echo "Error: VITE_CONVEX_URL is not set." >&2
  exit 1
fi

if [[ -z "${VITE_CONVEX_SITE_URL:-}" ]]; then
  echo "Error: VITE_CONVEX_SITE_URL is not set." >&2
  exit 1
fi

if [[ -z "${SITE_URL:-}" ]]; then
  echo "Error: SITE_URL is not set." >&2
  exit 1
fi

if [[ -z "${VITE_APP_BUILD_SHA:-}" ]]; then
  if command -v git >/dev/null 2>&1; then
    VITE_APP_BUILD_SHA="$(git rev-parse --short HEAD)"
    export VITE_APP_BUILD_SHA
    echo "VITE_APP_BUILD_SHA not set; using git SHA: ${VITE_APP_BUILD_SHA}"
  else
    echo "Error: VITE_APP_BUILD_SHA is not set and git is unavailable to infer it." >&2
    exit 1
  fi
fi

run_vercel() {
  if [[ -n "${VERCEL_TOKEN:-}" ]]; then
    vercel "$@" --token "$VERCEL_TOKEN"
  else
    vercel "$@"
  fi
}

echo "==> Updating vercel.json /api rewrite"
bun run deploy:prep "$CONVEX_SITE_URL"

echo "==> Installing dependencies"
bun install --frozen-lockfile

echo "==> Deploying Convex"
echo "==> Stamping Convex build metadata"
bunx convex env set APP_BUILD_SHA "$VITE_APP_BUILD_SHA" --prod
bunx convex env set APP_DEPLOYED_AT "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" --prod

echo "==> Deploying Convex functions"
bun run convex:deploy

echo "==> Verifying Convex contract"
bun run verify:convex-contract -- --prod

echo "==> Building web app"
bun run build

echo "==> Pulling Vercel project settings"
run_vercel pull --yes --environment=production

echo "==> Building Vercel output"
run_vercel build --prod

echo "==> Deploying to Vercel production"
run_vercel deploy --prebuilt --prod

echo "Deploy complete."