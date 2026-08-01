import re

with open('src/deferred_system_stubs.ts', 'r') as f:
    content = f.read()

stub_import = "import type { CandyFieldSystem } from './candy_obstacles/candy_field_system';\n"
content = stub_import + content

stub_func = """
export function createCandyFieldSystemStub(): CandyFieldSystem {
    return {
        active: false,
        activate: () => undefined,
        deactivate: () => undefined,
        update: () => undefined,
        setVisible: () => undefined
    } as unknown as CandyFieldSystem;
}
"""

content += stub_func

with open('src/deferred_system_stubs.ts', 'w') as f:
    f.write(content)
