import re

with open('src/level_manager/environment_plugins.ts', 'r') as f:
    content = f.read()

content = content.replace("moonPalaceSystem: { levelDistance: number; activate: () => void; deactivate: () => void };", "moonPalaceSystem: { levelDistance: number; activate: () => void; deactivate: () => void; update: () => void; cleanup: () => void; } | any;")

with open('src/level_manager/environment_plugins.ts', 'w') as f:
    f.write(content)
