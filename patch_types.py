import re

with open('src/level_manager/types.ts', 'r') as f:
    content = f.read()

# Add to LevelEnvironmentPorts
ports_old = "cloudCastlesSystem: { activate: (config?: any) => void; deactivate: () => void; update: (delta: number, cameraX: number, playerPos?: THREE.Vector3) => void; cleanup: () => void; };\n}"
ports_new = "cloudCastlesSystem: { activate: (config?: any) => void; deactivate: () => void; update: (delta: number, cameraX: number, playerPos?: THREE.Vector3) => void; cleanup: () => void; };\n    candyFieldSystem: { activate: () => void; deactivate: () => void; update: (delta: number, cameraX: number, playerPos?: THREE.Vector3) => void; };\n}"
content = content.replace(ports_old, ports_new)

with open('src/level_manager/types.ts', 'w') as f:
    f.write(content)
