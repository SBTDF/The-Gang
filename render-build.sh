#!/usr/bin/env bash
set -euo pipefail

echo "Building client..."
cd client
npm ci
npm run build

echo "Installing server deps..."
cd ../server
npm ci

echo "Build complete."
