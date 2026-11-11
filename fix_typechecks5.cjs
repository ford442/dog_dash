const fs = require('fs');

let start = fs.readFileSync('src/main/startup.ts', 'utf8');

// Insert carefully to not break spacing
// Insert in env: { ... }
start = start.replace(
    "galacticLeylinesSystem: systems.galacticLeylinesSystem,",
    "galacticLeylinesSystem: systems.galacticLeylinesSystem,\n            chronoTesseractsSystem: systems.chronoTesseractsSystem,"
);

// Insert in the root of options
start = start.replace(
    "galacticLeylinesSystem: systems.galacticLeylinesSystem,",
    "galacticLeylinesSystem: systems.galacticLeylinesSystem,\n        chronoTesseractsSystem: systems.chronoTesseractsSystem,"
);

fs.writeFileSync('src/main/startup.ts', start);
