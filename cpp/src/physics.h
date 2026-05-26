// physics.h — public API for physics.cpp
#pragma once
#include <cstdint>

extern "C" {

uintptr_t allocPhysicsBodies(int count);
void  stepPhysics(int count, float dt, float gravity);

float getBodyPositionX(int index);
float getBodyPositionY(int index);
void  setBodyPosition(int index, float x, float y);
void  addBodyAcceleration(int index, float ax, float ay);
float getBodyRadius(int index);

} // extern "C"
