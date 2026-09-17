cmake_minimum_required(VERSION 3.20)
project(dog_dash_cpp CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ---------------------------------------------------------------------------
# WASM compile flags live in cpp/build.sh ONLY.
# emcc is invoked directly there (--no-entry, STANDALONE_WASM, EXPORTED_FUNCTIONS,
# ALLOW_MEMORY_GROWTH, INITIAL_MEMORY, -msimd128 on --release). Do not re-list
# those flags here — a second copy drifted from build.sh and was unused.
# ---------------------------------------------------------------------------

option(BUILD_NATIVE_TESTS "Build native host tests" OFF)

if (BUILD_NATIVE_TESTS AND NOT EMSCRIPTEN)
    add_executable(test_noise tests/test_noise.cpp)
    target_include_directories(test_noise PRIVATE src)
    enable_testing()
    add_test(NAME NoiseTest COMMAND test_noise)
endif()
