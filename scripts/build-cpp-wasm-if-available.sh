#!/usr/bin/env bash
# build-cpp-wasm-if-available.sh
# Experimental: build the C++ WASM module when Emscripten is available; otherwise skip.
#
# Used by `npm run build:all-wasm`. The default AssemblyScript pipeline
# (predev / prebuild) never requires emsdk — see docs/WASM_BACKENDS.md.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

has_emscripten() {
  if command -v emcc >/dev/null 2>&1; then
    return 0
  fi

  if [[ -n "${EMSDK:-}" && -f "${EMSDK}/emsdk_env.sh" ]]; then
    return 0
  fi

  if [[ -n "${EMSCRIPTEN:-}" ]]; then
    return 0
  fi

  local candidates=(
    "$REPO_ROOT/emsdk"
    "$HOME/emsdk"
    "$HOME/.emsdk"
    "/opt/emsdk"
  )
  for candidate in "${candidates[@]}"; do
    if [[ -f "$candidate/emsdk_env.sh" ]]; then
      return 0
    fi
  done

  return 1
}

if ! has_emscripten; then
  echo "ℹ️  Skipping C++ WASM build (Emscripten not found)."
  echo "   Install emsdk or run: npm run build:cpp-wasm:docker"
  exit 0
fi

exec bash "$REPO_ROOT/cpp/build.sh" --release
