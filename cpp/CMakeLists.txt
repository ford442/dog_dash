cmake_minimum_required(VERSION 3.20)
project(dog_dash_cpp CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ---------------------------------------------------------------------------
# WASM compile flags live in cpp/build.sh ONLY.
# emcc is invoked directly there (--no-entry, STANDALONE_WASM, EXPORTED_FUNCTIONS,
# ALLOW_MEMORY_GROWTH, INITIAL_MEMORY, -msimd128 on --release). Do not re-list
# those flags here — a second copy drifted from build.sh and was unused.
# This file builds native host tests / benches only.
#
#   npm run test:cpp-native
#   (= cmake -S cpp -B cpp/build_native && cmake --build cpp/build_native && ctest)
# ---------------------------------------------------------------------------

option(BUILD_NATIVE_TESTS "Build native host tests and benches" ON)

if (BUILD_NATIVE_TESTS AND NOT EMSCRIPTEN)
    if (NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
        set(CMAKE_BUILD_TYPE Release)
    endif()
    enable_testing()

    add_executable(test_noise tests/test_noise.cpp)
    target_include_directories(test_noise PRIVATE src)
    add_test(NAME NoiseTest COMMAND test_noise)

    # Golden parity vs the shipping AssemblyScript spatial hash.
    add_executable(test_spatial_hash tests/test_spatial_hash.cpp src/spatial_hash.cpp)
    target_include_directories(test_spatial_hash PRIVATE src)
    add_test(NAME SpatialHashGolden
             COMMAND test_spatial_hash ${CMAKE_CURRENT_SOURCE_DIR}/../tests/fixtures/spatial_hash/golden.txt)

    # queryRadius microbench — run by hand; never a CI gate.
    add_executable(bench_spatial_hash tests/bench_spatial_hash.cpp src/spatial_hash.cpp)
    target_include_directories(bench_spatial_hash PRIVATE src)
endif()
