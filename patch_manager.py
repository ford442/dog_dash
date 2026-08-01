import re

with open('src/level_manager/manager.ts', 'r') as f:
    content = f.read()

# Add to LevelManager
content = content.replace("private readonly candyManager: CandyBeltManager;", "private readonly candyManager: CandyBeltManager;\n    readonly candyFieldSystem: { activate: () => void; deactivate: () => void; update: (delta: number, cameraX: number, playerPos?: THREE.Vector3) => void; };")

content = content.replace("this.candyManager = options.candyManager;", "this.candyManager = options.candyManager;\n        this.candyFieldSystem = options.candyFieldSystem;")

with open('src/level_manager/manager.ts', 'w') as f:
    f.write(content)

with open('src/level_manager/types.ts', 'r') as f:
    content = f.read()

content = content.replace("candyManager: CandyBeltManager;", "candyManager: CandyBeltManager;\n    candyFieldSystem: { activate: () => void; deactivate: () => void; update: (delta: number, cameraX: number, playerPos?: THREE.Vector3) => void; };")

with open('src/level_manager/types.ts', 'w') as f:
    f.write(content)

with open('src/main/startup.ts', 'r') as f:
    content = f.read()

content = content.replace("cloudCastlesSystem: gameSystems.cloudCastlesSystem,", "cloudCastlesSystem: gameSystems.cloudCastlesSystem,\n        candyFieldSystem: gameSystems.candyFieldSystem,")

with open('src/main/startup.ts', 'w') as f:
    f.write(content)
