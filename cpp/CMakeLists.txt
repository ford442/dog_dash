cmake_minimum_required(VERSION 3.20)
project(dog_dash_cpp CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ---------------------------------------------------------------------------
# Source files
# ---------------------------------------------------------------------------
set(SOURCES
    src/main.cpp
)

# ---------------------------------------------------------------------------
# Emscripten WASM target
# ---------------------------------------------------------------------------
# Use with:  emcmake cmake .. && emmake make
# Output: build/game_cpp.wasm (standalone, no JS glue)

set(EXPORTED_FUNCTIONS
    "_allocAsteroids"
    "_checkCollision"
    "_allocSporeClouds"
    "_checkSporeCollision"
    "_allocBossHitboxes"
    "_checkBossCollision"
    "_allocPhysicsBodies"
    "_stepPhysics"
    "_getBodyPositionX"
    "_getBodyPositionY"
    "_setBodyPosition"
    "_addBodyAcceleration"
    "_getBodyRadius"
    "_simplexNoise2D"
    "_simplexNoise3D"
    "_fractalNoise2D"
    "_fractalNoise3D"
)

# Join into a JSON array string for Emscripten
string(JOIN "," EXPORTS_CSV ${EXPORTED_FUNCTIONS})
set(EXPORTS_JSON "[${EXPORTS_CSV}]")

add_executable(game_cpp ${SOURCES})

set_target_properties(game_cpp PROPERTIES
    SUFFIX ".wasm"
    OUTPUT_NAME "game_cpp"
)

target_include_directories(game_cpp PRIVATE src)

if (EMSCRIPTEN)
    target_link_options(game_cpp PRIVATE
        "SHELL:--no-entry"
        "SHELL:-s STANDALONE_WASM=1"
        "SHELL:-s ALLOW_MEMORY_GROWTH=1"
        "SHELL:-s INITIAL_MEMORY=1048576"
        "SHELL:-s EXPORTED_FUNCTIONS=${EXPORTS_JSON}"
    )

    # Optimised release build
    if (CMAKE_BUILD_TYPE STREQUAL "Release")
        target_compile_options(game_cpp PRIVATE -O3 -msimd128)
        target_link_options(game_cpp PRIVATE "SHELL:-O3" "SHELL:-msimd128")
    endif()
endif()

# ---------------------------------------------------------------------------
# Native test/benchmark target (host compiler, no Emscripten)
# ---------------------------------------------------------------------------
option(BUILD_NATIVE_TESTS "Build native unit-test binary" OFF)

if (BUILD_NATIVE_TESTS AND NOT EMSCRIPTEN)
    add_executable(dog_dash_test
        src/collision.cpp
        src/physics.cpp
        src/noise.cpp
        tests/test_collision.cpp
        tests/test_physics.cpp
        tests/test_noise.cpp
    )
    target_include_directories(dog_dash_test PRIVATE src)
    target_compile_options(dog_dash_test PRIVATE -O2)
endif()
