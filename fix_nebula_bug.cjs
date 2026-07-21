const fs = require('fs');

let neb = fs.readFileSync('src/pastel_nebula.ts', 'utf-8');
neb = neb.replace(
    "        let needsUpdate = false;\n\n        for(let i=0; i<this.count; i++) {\n            const idx = i*3;\n            let x = this.positions[idx];\n\n            if (x < limitBack) {\n                x += this.width + margin * 2;\n                this.positions[idx] = x;\n                needsUpdate = true;\n            } else if (x > limitFront) {\n                x -= (this.width + margin * 2);\n                this.positions[idx] = x;\n                needsUpdate = true;\n            }",
    "        let instanceMatrixNeedsUpdate = false;\n\n        for(let i=0; i<this.count; i++) {\n            const idx = i*3;\n            let x = this.positions[idx];\n            let needsUpdate = false;\n\n            if (x < limitBack) {\n                x += this.width + margin * 2;\n                this.positions[idx] = x;\n                needsUpdate = true;\n                instanceMatrixNeedsUpdate = true;\n            } else if (x > limitFront) {\n                x -= (this.width + margin * 2);\n                this.positions[idx] = x;\n                needsUpdate = true;\n                instanceMatrixNeedsUpdate = true;\n            }"
);
neb = neb.replace(
    "        if (needsUpdate) {\n            this.mesh.instanceMatrix.needsUpdate = true;\n        }",
    "        if (instanceMatrixNeedsUpdate) {\n            this.mesh.instanceMatrix.needsUpdate = true;\n        }"
);
fs.writeFileSync('src/pastel_nebula.ts', neb);
