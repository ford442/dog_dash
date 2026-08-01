import re

with open('src/create_game_systems.ts', 'r') as f:
    content = f.read()

# Add stub import
stub_imports_old = "createCloudCastlesSystemStub\n} from './deferred_system_stubs';"
stub_imports_new = "createCloudCastlesSystemStub,\n    createCandyFieldSystemStub\n} from './deferred_system_stubs';"
content = content.replace(stub_imports_old, stub_imports_new)

# Add type import
type_imports_old = "import type { CloudCastlesSystem } from './cloud_castles_system';"
type_imports_new = "import type { CloudCastlesSystem } from './cloud_castles_system';\nimport type { CandyFieldSystem } from './candy_obstacles';"
content = content.replace(type_imports_old, type_imports_new)

# Add to GameSystems
game_sys_old = "cloudCastlesSystem: CloudCastlesSystem;\n}"
game_sys_new = "cloudCastlesSystem: CloudCastlesSystem;\n    candyFieldSystem: CandyFieldSystem;\n}"
content = content.replace(game_sys_old, game_sys_new)

# Add to LevelEnvironmentSystemExports
exports_old = "cloudCastlesSystem: CloudCastlesSystem;\n};"
exports_new = "cloudCastlesSystem: CloudCastlesSystem;\n    candyFieldSystem: CandyFieldSystem;\n};"
content = content.replace(exports_old, exports_new)

# Initialize as stub
init_old = "const cloudCastlesSystem = createCloudCastlesSystemStub();"
init_new = "const cloudCastlesSystem = createCloudCastlesSystemStub();\n    const candyFieldSystem = createCandyFieldSystemStub();"
content = content.replace(init_old, init_new)

# Return value
ret_old = "cloudCastlesSystem,\n    };\n}"
ret_new = "cloudCastlesSystem,\n        candyFieldSystem,\n    };\n}"
content = content.replace(ret_old, ret_new)

with open('src/create_game_systems.ts', 'w') as f:
    f.write(content)
