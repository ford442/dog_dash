import re

with open('src/level_manager/types.ts', 'r') as f:
    content = f.read()

# Fix types.ts: reduce the types to the bare minimum
content = content.replace("moonPalaceSystem: MoonPalaceSystem;", "moonPalaceSystem: { levelDistance: number; activate: () => void; deactivate: () => void; };")
content = content.replace("wishLanternSystem: WishLanternSystem;", "wishLanternSystem: { activate: () => void; deactivate: () => void; update: (delta: number, cameraX: number, playerPos?: THREE.Vector3) => void; };")
content = content.replace("weatherSystem: WeatherSystem;", "weatherSystem: { activate: () => void; deactivate: () => void; update: (delta: number, cameraX: number, playerPos?: THREE.Vector3) => void; };")

# Don't forget imports
content = content.replace("import type { MoonPalaceSystem } from '../moon_palace';\n", "")
content = content.replace("import type { WishLanternSystem } from '../wish_lanterns';\n", "")
content = content.replace("import type { WeatherSystem } from '../weather_system';\n", "")

with open('src/level_manager/types.ts', 'w') as f:
    f.write(content)

with open('src/level_manager/environment_plugins.ts', 'r') as f:
    content = f.read()

# Fix environment_plugins.ts: remove redeclarations
content = content.replace("    moonPalaceSystem: { levelDistance: number; activate: () => void; deactivate: () => void; } & Record<string, any>;\n", "")
content = content.replace("    wishLanternSystem: { activate: () => void; deactivate: () => void };\n", "")
content = content.replace("    weatherSystem: { activate: () => void; deactivate: () => void };\n", "")
content = content.replace("    dancingJellyMossSystem: { activate: (config?: any) => void; deactivate: () => void };\n", "")
content = content.replace("    dynamicStarfieldSystem: { activate: (config?: any) => void; deactivate: () => void };\n", "")
content = content.replace("    dayNightCycleSystem: { activate: (config?: any) => void; deactivate: () => void };\n", "")
content = content.replace("    cloudCastlesSystem: { activate: (config?: any) => void; deactivate: () => void; cleanup: () => void };\n", "")

with open('src/level_manager/environment_plugins.ts', 'w') as f:
    f.write(content)
