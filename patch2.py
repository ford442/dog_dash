import re

with open('src/candy_obstacles/candy_parallax.ts', 'r') as f:
    content = f.read()

# Add imports for TSL
tsl_imports = """import { MeshStandardNodeMaterial, MeshPhysicalNodeMaterial } from 'three/webgpu';
import { uniform, distance, positionWorld, smoothstep, time, mix, color, vec4 } from 'three/tsl';
"""
content = re.sub(r"import \* as THREE from 'three';", "import * as THREE from 'three';\n" + tsl_imports, content)

# Add uPlayerPos uniform to class
content = re.sub(
    r"private time: number = 0;",
    "private time: number = 0;\n    private uPlayerPos: ReturnType<typeof uniform>;",
    content
)

# Initialize uPlayerPos in constructor
content = re.sub(
    r"this\.flavors = \[\];",
    "this.flavors = [];\n        this.uPlayerPos = uniform(new THREE.Vector3(0, -999, 0));",
    content
)

# Replace material creation to use Node materials
material_code = """
    private createCandyMaterial(type: string): THREE.Material {
        const colors = CANDY_COLORS[CandyFlavor.STRAWBERRY];

        // Base distance calculation for player glow
        const distToPlayer = distance(positionWorld, this.uPlayerPos);
        const glowIntensity = smoothstep(15.0, 0.0, distToPlayer);
        const glowColor = color(0xffffff).mul(glowIntensity.mul(0.6));

        switch (type) {
            case 'gummy': {
                const mat = new MeshPhysicalNodeMaterial({
                    color: colors.primary,
                    transmission: 0.3,
                    thickness: 1.0,
                    roughness: 0.2,
                    clearcoat: 0.8,
                    transparent: true,
                    opacity: 0.85
                });
                mat.emissiveNode = glowColor;
                return mat as unknown as THREE.Material;
            }
            case 'lollipop': {
                const mat = new MeshStandardNodeMaterial({
                    color: colors.primary,
                    roughness: 0.3,
                    metalness: 0.2
                });
                mat.emissiveNode = glowColor;
                return mat as unknown as THREE.Material;
            }
            case 'jellybean': {
                const mat = new MeshPhysicalNodeMaterial({
                    color: colors.primary,
                    roughness: 0.15,
                    clearcoat: 0.8
                });
                mat.emissiveNode = glowColor;
                return mat as unknown as THREE.Material;
            }
            case 'cotton_candy': {
                const mat = new MeshStandardNodeMaterial({
                    color: colors.primary,
                    roughness: 0.9,
                    transparent: true,
                    opacity: 0.6
                });
                mat.emissiveNode = glowColor;
                return mat as unknown as THREE.Material;
            }
            default: {
                const mat = new MeshStandardNodeMaterial({
                    color: colors.primary,
                    roughness: 0.4
                });
                mat.emissiveNode = glowColor;
                return mat as unknown as THREE.Material;
            }
        }
    }
"""

content = re.sub(
    r"    private createCandyMaterial\(type: string\): THREE.Material \{[\s\S]*?        \}[\s\S]*?    \}",
    material_code.strip(),
    content,
    flags=re.MULTILINE
)

# Update update() method to take playerPos
content = re.sub(
    r"update\(delta: number, cameraX: number\)",
    "update(delta: number, cameraX: number, playerPos?: THREE.Vector3)",
    content
)

# Update uPlayerPos.value
content = re.sub(
    r"this\.time \+= delta;",
    "this.time += delta;\n        if (playerPos) {\n            this.uPlayerPos.value.copy(playerPos);\n        }",
    content
)

with open('src/candy_obstacles/candy_parallax.ts', 'w') as f:
    f.write(content)
