import re

with open('src/level_systems_loader.ts', 'r') as f:
    content = f.read()

content = content.replace("    | 'dayNightCycle';", "    | 'dayNightCycle'\n    | 'cloudCastles'\n    | 'candyPlanetRing';")

with open('src/level_systems_loader.ts', 'w') as f:
    f.write(content)
