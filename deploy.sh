#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
TOOL_DIR="$REPO_DIR/tool"
PM2_NAME="trialscout"
ENTRY="src/runner/server.js"
NGINX_SRC="$REPO_DIR/nginx/default"
NGINX_DEST="/etc/nginx/sites-available/default"
FRONTEND_REPO="git@github.com:lahnstrom/vis-nordic.git"
FRONTEND_DIR="/var/www/metaresearch"

SERVER="root@164.92.210.200"
REMOTE_DIR="/root/detection-tool"

usage() {
  cat <<EOF
Usage: ./deploy.sh [OPTIONS]

Deploy TrialScout to the server ($SERVER).

Options:
  --setup           First-time setup: install PM2 globally, configure startup,
                    install Playwright dependencies
  --with-frontend   Clone and build vis-nordic frontend into $FRONTEND_DIR
  --remote          Run deploy on the remote server via SSH
  --help            Show this help message

Without flags (run ON the server):
  1. Pulls latest code from origin/main
  2. Installs production npm dependencies
  3. Checks that tool/.env exists
  4. Updates nginx config if changed
  5. Restarts (or starts) the PM2 process

From your local machine:
  ./deploy.sh --remote              # SSH in and deploy
  ./deploy.sh --remote --with-frontend
EOF
  exit 0
}

# --- Parse flags ---
SETUP=false
WITH_FRONTEND=false
REMOTE=false

for arg in "$@"; do
  case "$arg" in
    --setup) SETUP=true ;;
    --with-frontend) WITH_FRONTEND=true ;;
    --remote) REMOTE=true ;;
    --help) usage ;;
    *) echo "Unknown option: $arg"; usage ;;
  esac
done

# --- Remote mode: SSH into server and run deploy there ---
if $REMOTE; then
  REMOTE_ARGS=""
  $SETUP && REMOTE_ARGS="$REMOTE_ARGS --setup"
  $WITH_FRONTEND && REMOTE_ARGS="$REMOTE_ARGS --with-frontend"
  echo "==> Deploying to $SERVER"
  ssh "$SERVER" "cd $REMOTE_DIR && ./deploy.sh$REMOTE_ARGS"
  exit $?
fi

# --- First-time setup ---
if $SETUP; then
  echo "==> First-time setup"
  npm install -g pm2
  pm2 startup systemd -u root --hp /root | tail -1 | bash || true
  npx playwright install-deps
  echo "==> Setup complete"
fi

# --- Pull latest code ---
echo "==> Pulling latest code"
cd "$REPO_DIR"
git pull origin main

# --- Install dependencies ---
echo "==> Installing dependencies"
cd "$TOOL_DIR"
npm install --production

# --- Check .env ---
if [ ! -f "$TOOL_DIR/.env" ]; then
  echo "ERROR: $TOOL_DIR/.env not found."
  echo "Copy .env.example and fill in your API keys:"
  echo "  cp $TOOL_DIR/.env.example $TOOL_DIR/.env"
  exit 1
fi

# --- Nginx config ---
if [ -f "$NGINX_SRC" ]; then
  if ! diff -q "$NGINX_SRC" "$NGINX_DEST" > /dev/null 2>&1; then
    echo "==> Updating nginx config"
    cp "$NGINX_SRC" "$NGINX_DEST"
    nginx -t && systemctl reload nginx
  else
    echo "==> Nginx config unchanged"
  fi
fi

# --- PM2 process ---
echo "==> Restarting PM2 process"
if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
  pm2 restart "$PM2_NAME"
else
  pm2 start "$ENTRY" --name "$PM2_NAME" --cwd "$TOOL_DIR"
fi
pm2 save

# --- Optional frontend ---
if $WITH_FRONTEND; then
  echo "==> Building frontend"
  TEMP_DIR=$(mktemp -d)
  git clone --depth 1 "$FRONTEND_REPO" "$TEMP_DIR"
  cd "$TEMP_DIR"
  npm install
  npm run build
  rm -rf "$FRONTEND_DIR"
  mkdir -p "$FRONTEND_DIR"
  cp -r build/* "$FRONTEND_DIR/"
  rm -rf "$TEMP_DIR"
  echo "==> Frontend deployed to $FRONTEND_DIR"
fi

echo "==> Deploy complete"
