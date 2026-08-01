import re

with open('src/level_systems_loader.ts', 'r') as f:
    content = f.read()

# Add the case block to loadSystem()
case_block = """
            case 'candyPlanetRing': {
                const { CandyFieldSystem } = await import('./candy_obstacles');
                installEnvPartial({ candyFieldSystem: new CandyFieldSystem(scene) });
                break;
            }
"""

# Insert before `case 'cloudCastles':`
content = content.replace("            case 'cloudCastles':", case_block + "            case 'cloudCastles':")

with open('src/level_systems_loader.ts', 'w') as f:
    f.write(content)
