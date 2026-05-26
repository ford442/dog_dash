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

#include "collision.cpp"
#include "physics.cpp"
#include "noise.cpp"
