#!/usr/bin/env bash
set -euo pipefail

SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_ROOT"

export NPM_CONFIG_PRODUCTION=false
export NODE_ENV=development

echo "Repo root: $SCRIPT_ROOT"

echo "Installing workspace dependencies..."
npm ci --include=dev

echo "Building client..."
npm run build --workspace client

echo "Verifying Express..."
node -e "import('express').then(() => console.log('Express installed successfully')).catch(err => { console.error(err); process.exit(1); })"

echo "Build complete."
