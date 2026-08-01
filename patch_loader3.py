import re

with open('src/level_systems_loader.ts', 'r') as f:
    content = f.read()

# I forgot to map candyPlanetRing in the loader case
case_code = """
            case 'candyPlanetRing': {
                const { CandyFieldSystem } = await import('./candy_obstacles');
                installEnvPartial({ candyFieldSystem: new CandyFieldSystem(scene) });
                break;
            }
"""

content = content.replace("            case 'dayNightCycle': {\n                const { DayNightCycleSystem } = await import('./day_night_cycle');\n                installEnvPartial({ dayNightCycleSystem: new DayNightCycleSystem(scene, camera) });\n                break;\n            }", "            case 'dayNightCycle': {\n                const { DayNightCycleSystem } = await import('./day_night_cycle');\n                installEnvPartial({ dayNightCycleSystem: new DayNightCycleSystem(scene, camera) });\n                break;\n            }" + case_code)

with open('src/level_systems_loader.ts', 'w') as f:
    f.write(content)
