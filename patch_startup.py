import re

with open('src/main/startup.ts', 'r') as f:
    content = f.read()

content = content.replace("cloudCastlesSystem: systems.cloudCastlesSystem\n        },", "cloudCastlesSystem: systems.cloudCastlesSystem,\n            candyFieldSystem: systems.candyFieldSystem\n        },")
content = content.replace("cloudCastlesSystem: systems.cloudCastlesSystem\n    });", "cloudCastlesSystem: systems.cloudCastlesSystem,\n        candyFieldSystem: systems.candyFieldSystem\n    });")

with open('src/main/startup.ts', 'w') as f:
    f.write(content)
