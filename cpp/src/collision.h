// collision.h — public API for collision.cpp
#pragma once
#include <cstdint>

extern "C" {

// Asteroid collision (2-D circles)
uintptr_t allocAsteroids(int count);
int checkCollision(float playerX, float playerY, float playerRadius, int objectCount);

// Spore-cloud collision (3-D spheres)
uintptr_t allocSporeClouds(int count);
int checkSporeCollision(float playerX, float playerY, float playerZ,
                        float playerRadius, int objectCount);

// Boss hitbox collision (2-D circles)
uintptr_t allocBossHitboxes(int count);
int checkBossCollision(float projX, float projY, float projRadius, int hitboxCount);

} // extern "C"
