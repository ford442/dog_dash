import re

with open('src/level_manager/environment_plugins.ts', 'r') as f:
    content = f.read()

plugin = """        {
            flag: 'dayNightCycle',
            activate: (config: any) => host.dayNightCycleSystem.activate(typeof config === 'object' ? config : undefined),
            deactivate: () => host.dayNightCycleSystem.deactivate()
        },
        {
            flag: 'candyPlanetRing',
            activate: () => host.candyFieldSystem.activate(),
            deactivate: () => host.candyFieldSystem.deactivate()
        },"""

content = content.replace("        {\n            flag: 'dayNightCycle',\n            activate: (config: any) => host.dayNightCycleSystem.activate(typeof config === 'object' ? config : undefined),\n            deactivate: () => host.dayNightCycleSystem.deactivate()\n        },", plugin)

with open('src/level_manager/environment_plugins.ts', 'w') as f:
    f.write(content)
