# GPU Lifetime & Ownership Matrix

This document tracks WebGL/WebGPU resource lifetimes across the project's streaming decorative systems. Streaming creation/destruction of meshes without strict ownership can leak memory across long journeys and restarts. 

## Matrix

| System | Resource Type | Ownership | Teardown Entry Point | Gaps / Status |
|--------|---------------|-----------|----------------------|---------------|
| `foliage_streaming` | InstancedMesh / Mats | Shared/Pool | `foliage_streaming.ts` / cull | Fixed (uses disposeObject) |
| `geological` | Meshes / Mats | Owned | `cull` / `deactivate` | Fixed (uses disposeObject) |
| `candy_belt` | Meshes / Mats | Shared Mats / Owned Geos | `candy_belt_manager.ts` | Fixed (uses disposeObject) |
| `Space Pets Swarm` | InstancedMesh / Mats | Owned | `cleanup` | Needs `disposeObject` migration |
| `Wind Currents` | InstancedMesh / Mats | Owned | `cleanup` | Needs `disposeObject` migration |
| `Sky-Rail Terminal` | Meshes / Mats | Owned | `cleanup` | Needs `disposeObject` migration |
| `Cloud Castles` | Meshes / Mats | Owned | `castle.dispose` | Needs `disposeObject` migration |
| `Flower Constellations` | Meshes / Mats | Owned | `constellation.cleanup` | Needs `disposeObject` migration |

## Ownership Rules
1. **Owned Resources:** Resources created exclusively for a single mesh/system must be cleaned up via `disposeObject(mesh)` on teardown.
2. **Shared Caches:** Materials (e.g., `foliageMaterials`) and geometries shared across multiple meshes must be marked with `markShared()` to prevent them from being disposed on single mesh death.
3. **Level Transitions:** Calling `disposeLevelStreamingResources()` safely cleans up all dynamic entities and resets system-local budgets.
