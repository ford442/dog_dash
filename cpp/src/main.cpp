// main.cpp
// Dog Dash — C++ WASM entry point.
//
// All translation units are included here so the project can be compiled with
// a single `emcc` command or via the CMakeLists.txt.  The #include trick keeps
// the build simple for beginners while still keeping each subsystem in its own
// file for readability.
//
// Exported symbols (all declared extern "C" in their respective headers):
//   Collision   : allocAsteroids, checkCollision
//                 allocSporeClouds, checkSporeCollision
//                 allocBossHitboxes, checkBossCollision
//   Physics     : allocPhysicsBodies, stepPhysics,
//                 getBodyPositionX, getBodyPositionY,
//                 setBodyPosition, addBodyAcceleration, getBodyRadius
//   Noise       : simplexNoise2D, simplexNoise3D,
//                 fractalNoise2D, fractalNoise3D
//   Spatial hash: allocEntities, getEntityPtr, getEntityCount,
//                 rebuildGrid, queryRadius, queryRadiusSimd, queryRadiusFirst,
//                 getQueryResultPtr, getQueryCount, simdSupported
//                 (mirror of assembly/spatial_hash.ts — the shipping path)
//
// Not mirrored (AssemblyScript only): allocObjects / freeObjects /
// getObjectPtr and the GPU-chore buffers (allocChoreValues, ...).

#include "collision.cpp"
#include "spatial_hash.cpp"
#include "physics.cpp"
#include "noise.cpp"
