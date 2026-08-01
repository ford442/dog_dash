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

content = content.replace("            case 'cloudCastles': {\n                const { CloudCastlesSystem } = await import('./cloud_castles_system');\n                installEnvPartial({ cloudCastlesSystem: new CloudCastlesSystem(scene) });\n                break;\n            }", "            case 'cloudCastles': {\n                const { CloudCastlesSystem } = await import('./cloud_castles_system');\n                installEnvPartial({ cloudCastlesSystem: new CloudCastlesSystem(scene) });\n                break;\n            }\n" + case_code)

content = content.replace("if (isEnvironmentEnabled(env.dayNightCycle)) keys.add('dayNightCycle');", "if (isEnvironmentEnabled(env.dayNightCycle)) keys.add('dayNightCycle');\n    if (isEnvironmentEnabled(env.candyPlanetRing)) keys.add('candyPlanetRing');")

with open('src/level_systems_loader.ts', 'w') as f:
    f.write(content)
