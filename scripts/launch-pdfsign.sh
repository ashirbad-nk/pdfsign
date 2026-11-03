#!/usr/bin/env bash
set -e

# Find script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Ensure Node.js is on PATH (handles NVM, Volta, standard PATH)
if ! command -v node &>/dev/null; then
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
  elif [ -d "$HOME/.nvm/versions/node" ]; then
    LATEST_NODE=$(ls -td "$HOME/.nvm/versions/node/"* 2>/dev/null | head -n 1)
    if [ -n "$LATEST_NODE" ]; then
      export PATH="$LATEST_NODE/bin:$PATH"
    fi
  fi
fi

if ! command -v node &>/dev/null; then
  echo "Error: Node.js could not be found. Please install Node.js." >&2
  exit 1
fi

exec node "$SCRIPT_DIR/desktop-server.mjs" "$@"
