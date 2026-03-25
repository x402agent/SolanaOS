#!/usr/bin/env python3
"""
deploy_pipeline.py — Full pipeline: pump.md → Convex → Netlify rebuild

Runs after each pump.fun scan to:
1. Push token data to Convex (nanohub real-time backend)
2. Trigger Netlify build hook (rebuilds the nanohub frontend)
3. Optionally deploy pump-terminal.html via Netlify API
4. Git commit + push pump.md (triggers CI/CD)

Usage:
    python3 deploy_pipeline.py [--source browser|cli|remote-trigger] [--skip-netlify] [--skip-convex]

Environment:
    NETLIFY_BUILD_HOOK_URL - Netlify build hook URL (from Netlify dashboard)
    NETLIFY_AUTH_TOKEN     - Netlify personal access token (for CLI deploys)
    NETLIFY_SITE_ID        - Netlify site ID (65b49620-476e-448c-a497-f218b3cdeb35)
    CONVEX_SITE_URL        - Convex HTTP endpoint
"""
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError

SCRIPTS_DIR = Path(__file__).parent
PROJECT_ROOT = Path(os.path.expanduser("~/Downloads/nanosolana-go"))
PUMP_MD = PROJECT_ROOT / "pump.md"
NANOHUB_DIR = PROJECT_ROOT / "nanohub"
ENV_FILE = PROJECT_ROOT / ".env"
NANOHUB_ENV = NANOHUB_DIR / ".env.local"

DEFAULT_NETLIFY_SITE_ID = "65b49620-476e-448c-a497-f218b3cdeb35"
DEFAULT_CONVEX_SITE_URL = "https://artful-frog-940.convex.site"


def load_env(path):
    env = {}
    if path.is_file():
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip("\"'")
    return env


def get_env(key, *fallback_files, default=None):
    for f in fallback_files:
        env = load_env(f)
        if key in env:
            return env[key]
    return os.environ.get(key, default)


def log(msg, level="INFO"):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    icons = {"INFO": "ℹ️", "OK": "✅", "WARN": "⚠️", "ERR": "❌", "SKIP": "⏭️"}
    print(f"[{ts}] {icons.get(level, '•')} {msg}")


def step_push_convex(source="browser"):
    """Step 1: Push pump.md data to Convex."""
    log("Pushing token data to Convex...")
    script = SCRIPTS_DIR / "push_to_convex.py"
    if not script.exists():
        log(f"push_to_convex.py not found at {script}", "ERR")
        return False
    result = subprocess.run(
        [sys.executable, str(script), "--source", source],
        capture_output=True, text=True, timeout=30
    )
    if result.returncode == 0:
        for line in result.stdout.strip().split("\n"):
            print(f"   {line}")
        log("Convex push complete", "OK")
        return True
    else:
        log(f"Convex push failed: {result.stderr}", "ERR")
        return False


def step_trigger_netlify_build():
    """Step 2: Trigger Netlify build hook to rebuild the frontend."""
    hook_url = get_env("NETLIFY_BUILD_HOOK_URL", ENV_FILE, NANOHUB_ENV)
    if not hook_url:
        log("NETLIFY_BUILD_HOOK_URL not set — skipping build trigger", "SKIP")
        log("  → Set it in .env: NETLIFY_BUILD_HOOK_URL=https://api.netlify.com/build_hooks/YOUR_HOOK_ID")
        log("  → Create one at: https://app.netlify.com/sites/YOUR_SITE/configuration/deploys#build-hooks")
        return False
    log("Triggering Netlify build hook...")
    try:
        payload = json.dumps({
            "trigger_title": f"pump.fun scan @ {datetime.now(timezone.utc).strftime('%H:%M UTC')}",
        }).encode()
        req = Request(hook_url, data=payload, method="POST")
        req.add_header("Content-Type", "application/json")
        resp = urlopen(req, timeout=10)
        log(f"Netlify build triggered (HTTP {resp.status})", "OK")
        return True
    except Exception as e:
        log(f"Netlify build hook failed: {e}", "ERR")
        return False


def step_deploy_terminal_html():
    """Step 3: Deploy pump-terminal.html as a Netlify deploy (optional)."""
    auth_token = get_env("NETLIFY_AUTH_TOKEN", ENV_FILE, NANOHUB_ENV)
    site_id = get_env("NETLIFY_SITE_ID", ENV_FILE, NANOHUB_ENV, default=DEFAULT_NETLIFY_SITE_ID)
    terminal_html = PROJECT_ROOT / "pump-terminal.html"
    if not auth_token:
        log("NETLIFY_AUTH_TOKEN not set — skipping static deploy", "SKIP")
        log("  → Get one at: https://app.netlify.com/user/applications#personal-access-tokens")
        return False
    if not terminal_html.exists():
        log("pump-terminal.html not found — skipping", "SKIP")
        return False
    log("Deploying pump-terminal.html to Netlify...")
    try:
        import hashlib
        content = terminal_html.read_bytes()
        sha1 = hashlib.sha1(content).hexdigest()
        deploy_payload = json.dumps({"files": {"/index.html": sha1}}).encode()
        req = Request(
            f"https://api.netlify.com/api/v1/sites/{site_id}/deploys",
            data=deploy_payload, method="POST"
        )
        req.add_header("Content-Type", "application/json")
        req.add_header("Authorization", f"Bearer {auth_token}")
        resp = urlopen(req, timeout=15)
        deploy = json.loads(resp.read())
        deploy_id = deploy.get("id")
        if deploy.get("required", []):
            upload_req = Request(
                f"https://api.netlify.com/api/v1/deploys/{deploy_id}/files/index.html",
                data=content, method="PUT"
            )
            upload_req.add_header("Content-Type", "application/octet-stream")
            upload_req.add_header("Authorization", f"Bearer {auth_token}")
            urlopen(upload_req, timeout=30)
        url = deploy.get("deploy_ssl_url") or deploy.get("deploy_url", "")
        log(f"Deployed → {url}", "OK")
        return True
    except Exception as e:
        log(f"Netlify deploy failed: {e}", "ERR")
        return False


def step_honcho_ingest():
    """Step 5: Ingest scan data into Honcho epistemological memory."""
    log("Ingesting scan into Honcho memory bank...")
    script = SCRIPTS_DIR / "honcho_memory.py"
    if not script.exists():
        log(f"honcho_memory.py not found at {script}", "ERR")
        return False
    result = subprocess.run(
        [sys.executable, str(script), "ingest"],
        capture_output=True, text=True, timeout=60
    )
    if result.returncode == 0:
        for line in result.stdout.strip().split("\n"):
            print(f"   {line}")
        log("Honcho memory ingest complete", "OK")
        return True
    else:
        log(f"Honcho ingest failed: {result.stderr}", "ERR")
        return False


def step_git_commit_push():
    """Step 4: Commit pump.md and push (triggers CI/CD workflow)."""
    log("Committing pump.md to git...")
    try:
        os.chdir(PROJECT_ROOT)
        result = subprocess.run(["git", "diff", "--name-only", "pump.md"],
                                capture_output=True, text=True, timeout=5)
        if not result.stdout.strip():
            log("pump.md unchanged — skipping commit", "SKIP")
            return False
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        subprocess.run(["git", "add", "pump.md"], check=True, timeout=5)
        subprocess.run(["git", "commit", "-m", f"pump: scan {now}"],
                        check=True, capture_output=True, timeout=10)
        subprocess.run(["git", "push"], check=True, capture_output=True, timeout=30)
        log("Committed and pushed pump.md", "OK")
        return True
    except subprocess.CalledProcessError as e:
        log(f"Git push failed: {getattr(e, 'stderr', e)}", "WARN")
        return False
    except Exception as e:
        log(f"Git error: {e}", "WARN")
        return False


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Deploy pipeline: pump.md → Convex → Netlify")
    parser.add_argument("--source", default="browser", choices=["browser", "cli", "remote-trigger"])
    parser.add_argument("--skip-convex", action="store_true")
    parser.add_argument("--skip-netlify", action="store_true")
    parser.add_argument("--skip-git", action="store_true")
    parser.add_argument("--skip-terminal", action="store_true")
    parser.add_argument("--skip-honcho", action="store_true")
    args = parser.parse_args()

    print()
    log("═══ PUMP.FUN DEPLOY PIPELINE ═══")
    log(f"Source: {args.source}")
    log(f"pump.md: {PUMP_MD}")
    print()

    if not PUMP_MD.exists():
        log("pump.md not found — run the scanner first", "ERR")
        sys.exit(1)

    results = {}

    if not args.skip_convex:
        results["convex"] = step_push_convex(args.source)
    else:
        log("Convex push skipped (--skip-convex)", "SKIP")

    if not args.skip_netlify:
        results["netlify_hook"] = step_trigger_netlify_build()
    else:
        log("Netlify build hook skipped (--skip-netlify)", "SKIP")

    if not args.skip_terminal:
        results["terminal_deploy"] = step_deploy_terminal_html()
    else:
        log("Terminal deploy skipped (--skip-terminal)", "SKIP")

    if not args.skip_honcho:
        results["honcho"] = step_honcho_ingest()
    else:
        log("Honcho memory skipped (--skip-honcho)", "SKIP")

    if not args.skip_git:
        results["git"] = step_git_commit_push()
    else:
        log("Git push skipped (--skip-git)", "SKIP")

    print()
    log("═══ PIPELINE SUMMARY ═══")
    for step, ok in results.items():
        status = "✅" if ok else "⚠️  skipped/failed"
        log(f"  {step}: {status}")
    ok_count = sum(1 for v in results.values() if v)
    log(f"Pipeline complete: {ok_count}/{len(results)} steps succeeded")


if __name__ == "__main__":
    main()
