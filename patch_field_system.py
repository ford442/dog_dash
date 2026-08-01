import re

with open('src/candy_obstacles/candy_field_system.ts', 'r') as f:
    content = f.read()

# Add this.deactivate() to constructor
content = content.replace("        this.initLayers();\n    }", "        this.initLayers();\n        this.deactivate();\n    }")

# Update update() signature and forwarding
update_old = """    update(delta: number, cameraX: number) {
        if (!this.active) return;
        this.layers.forEach(l => l.update(delta, cameraX));
    }"""

update_new = """    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;
        this.layers.forEach(l => l.update(delta, cameraX, playerPos));
    }"""

content = content.replace(update_old, update_new)

with open('src/candy_obstacles/candy_field_system.ts', 'w') as f:
    f.write(content)
