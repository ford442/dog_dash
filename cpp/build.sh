#!/usr/bin/env bash
# build.sh — Build the Dog Dash C++ WASM module with Emscripten.
#
# Prerequisites
# -------------
# Install emsdk once and activate it:
#   git clone https://github.com/emscripten-core/emsdk.git
#   cd emsdk && ./emsdk install latest && ./emsdk activate latest
#   source ./emsdk_env.sh
#
# Or set EMSDK to your checkout:
#   export EMSDK="$HOME/emsdk"
#   source "$EMSDK/emsdk_env.sh"
#
# Or run via Docker (no local emsdk required):
#   ./cpp/build.sh --docker [--release]
#
# Usage
# -----
#   ./cpp/build.sh [--release]       default: debug/unoptimised
#   ./cpp/build.sh --release         optimised (-O3 + SIMD)
#   ./cpp/build.sh --docker          build inside emscripten/emsdk image

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SRC="$SCRIPT_DIR/src/main.cpp"
OUT_DIR="$REPO_ROOT/build"
OUT_WASM="$OUT_DIR/game_cpp.wasm"
PUBLIC_OUT="$REPO_ROOT/public/build/game_cpp.wasm"

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
BUILD_MODE="debug"
USE_DOCKER=0

for arg in "$@"; do
    case "$arg" in
        --release) BUILD_MODE="release" ;;
        --docker)  USE_DOCKER=1 ;;
        *)
            echo "Unknown argument: $arg" >&2
            echo "Usage: $0 [--release] [--docker]" >&2
            exit 1
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Docker build (no local emsdk required)
# ---------------------------------------------------------------------------
if [[ "$USE_DOCKER" -eq 1 ]]; then
  RELEASE_FLAG=""
  if [[ "$BUILD_MODE" == "release" ]]; then
    RELEASE_FLAG="--release"
  fi

  echo "🐳 Building C++ WASM via Docker (emscripten/emsdk)…"
  docker run --rm \
    -v "$REPO_ROOT:/src" \
    -w /src \
    emscripten/emsdk \
    bash cpp/build.sh "$RELEASE_FLAG"
  exit $?
fi

# ---------------------------------------------------------------------------
# Locate Emscripten (EMSDK env, PATH, or common install locations)
# ---------------------------------------------------------------------------
ensure_emscripten() {
  if command -v emcc >/dev/null 2>&1; then
    return 0
  fi

  local emsdk_root="${EMSDK:-}"

  if [[ -z "$emsdk_root" && -n "${EMSCRIPTEN:-}" ]]; then
    emsdk_root="$(cd "$(dirname "$EMSCRIPTEN")/.." && pwd)"
  fi

  if [[ -z "$emsdk_root" ]]; then
    local candidates=(
      "$REPO_ROOT/emsdk"
      "$HOME/emsdk"
      "$HOME/.emsdk"
      "/opt/emsdk"
    )
    for candidate in "${candidates[@]}"; do
      if [[ -f "$candidate/emsdk_env.sh" ]]; then
        emsdk_root="$candidate"
        break
      fi
    done
  fi

  if [[ -n "$emsdk_root" && -f "$emsdk_root/emsdk_env.sh" ]]; then
    # shellcheck disable=SC1091
    source "$emsdk_root/emsdk_env.sh"
  fi

  if ! command -v emcc >/dev/null 2>&1; then
    cat >&2 <<'EOF'
❌ emcc not found.

Install and activate Emscripten, then re-run this script:

  git clone https://github.com/emscripten-core/emsdk.git
  cd emsdk && ./emsdk install latest && ./emsdk activate latest
  source ./emsdk_env.sh

Or point EMSDK at your checkout:

  export EMSDK=/path/to/emsdk
  source "$EMSDK/emsdk_env.sh"

Or build without a local emsdk install:

  ./cpp/build.sh --docker [--release]

See cpp/README.md for details.
EOF
    exit 1
  fi
}

ensure_emscripten

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

if [[ "$BUILD_MODE" == "release" ]]; then
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
