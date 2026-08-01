import re

with open('src/create_game_systems.ts', 'r') as f:
    content = f.read()

# Add to return value properly
content = content.replace("cloudCastlesSystem,\n        derelictBuoyManager,", "cloudCastlesSystem,\n        candyFieldSystem,\n        derelictBuoyManager,")

with open('src/create_game_systems.ts', 'w') as f:
    f.write(content)
