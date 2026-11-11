const fs = require('fs');
let start = fs.readFileSync('src/main/startup.ts', 'utf8');

// Insert exactly once in `env: { ... }` block and exactly once in outer block
const split = start.split('galacticLeylinesSystem: systems.galacticLeylinesSystem,');
if (split.length === 3) {
    start = split[0] +
            'galacticLeylinesSystem: systems.galacticLeylinesSystem,\n            chronoTesseractsSystem: systems.chronoTesseractsSystem,' +
            split[1] +
            'galacticLeylinesSystem: systems.galacticLeylinesSystem,\n        chronoTesseractsSystem: systems.chronoTesseractsSystem,' +
            split[2];
}

fs.writeFileSync('src/main/startup.ts', start);
