#!/usr/bin/env bash
set -euo pipefail

SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_ROOT"

export NPM_CONFIG_PRODUCTION=false
export NODE_ENV=development

echo "Repo root: $SCRIPT_ROOT"

echo "Building client..."
if [ ! -d "client" ]; then
  echo "client directory not found in $SCRIPT_ROOT" >&2
  exit 1
fi
cd client
npm install
npm run build
cd "$SCRIPT_ROOT"

echo "Installing server deps..."
if [ ! -d "server" ]; then
  echo "server directory not found in $SCRIPT_ROOT" >&2
  exit 1
fi
cd server
npm install

echo "Build complete."
