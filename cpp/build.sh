#!/usr/bin/env bash
# build.sh — Build the Dog Dash C++ WASM module with Emscripten.
#
# Prerequisites
# -------------
# Install emsdk once and activate it:
#   git clone https://github.com/emscripten-core/emsdk.git
#   cd emsdk && ./emsdk install latest && ./emsdk activate latest
#   source ./emsdk/emsdk_env.sh
#
# Or run via the official Docker image:
#   docker run --rm -v "$PWD":/src emscripten/emsdk emcc ...
#
# Usage
# -----
#   ./cpp/build.sh [--release]       default: debug/unoptimised
#   ./cpp/build.sh --release         optimised (-O3 + SIMD)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SRC="$SCRIPT_DIR/src/main.cpp"
OUT_DIR="$REPO_ROOT/build"
OUT_WASM="$OUT_DIR/game_cpp.wasm"
PUBLIC_OUT="$REPO_ROOT/public/build/game_cpp.wasm"

mkdir -p "$OUT_DIR"

# ---------------------------------------------------------------------------
# Exported symbols
# ---------------------------------------------------------------------------
EXPORTS='["_allocAsteroids","_checkCollision","_allocSporeClouds","_checkSporeCollision","_allocBossHitboxes","_checkBossCollision","_allocPhysicsBodies","_stepPhysics","_getBodyPositionX","_getBodyPositionY","_setBodyPosition","_addBodyAcceleration","_getBodyRadius","_simplexNoise2D","_simplexNoise3D","_fractalNoise2D","_fractalNoise3D"]'

# ---------------------------------------------------------------------------
# Build flags
# ---------------------------------------------------------------------------
COMMON_FLAGS=(
    --no-entry
    -s STANDALONE_WASM=1
    -s "EXPORTED_FUNCTIONS=$EXPORTS"
    -s ALLOW_MEMORY_GROWTH=1
    -s INITIAL_MEMORY=1048576    # 1 MiB — enough for game buffers
    -std=c++17
    -I"$SCRIPT_DIR/src"
)

if [[ "${1:-}" == "--release" ]]; then
    OPT_FLAGS=(-O3 -msimd128 -DNDEBUG)
    echo "🔨 Building C++ WASM (release, SIMD)…"
else
    OPT_FLAGS=(-O0 -g)
    echo "🔨 Building C++ WASM (debug)…"
fi

# ---------------------------------------------------------------------------
# Compile
# ---------------------------------------------------------------------------
emcc "$SRC" "${COMMON_FLAGS[@]}" "${OPT_FLAGS[@]}" -o "$OUT_WASM"

echo "✅ C++ WASM written to $OUT_WASM"

# Copy to public/build so Vite can serve it
mkdir -p "$(dirname "$PUBLIC_OUT")"
cp "$OUT_WASM" "$PUBLIC_OUT"
echo "📦 Copied to $PUBLIC_OUT"
