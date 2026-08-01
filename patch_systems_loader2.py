import re

with open('src/level_systems_loader.ts', 'r') as f:
    content = f.read()

content = content.replace("    | 'dayNightCycle'\n    | 'cloudCastlesSystem'\n    | 'candyFieldSystem';", "    | 'dayNightCycle'\n    | 'cloudCastlesSystem'\n    | 'candyFieldSystem'\n    | 'candyPlanetRing';")

# Ensure candyPlanetRing maps correctly inside loadSystem
mapping_old = "    cloudCastles: 'cloudCastlesSystem',\n    candyPlanetRing: 'candyFieldSystem'\n};"
mapping_new = "    cloudCastles: 'cloudCastlesSystem',\n    candyPlanetRing: 'candyFieldSystem'\n};"

with open('src/level_systems_loader.ts', 'w') as f:
    f.write(content)
