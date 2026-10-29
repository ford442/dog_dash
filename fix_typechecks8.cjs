const fs = require('fs');
let start = fs.readFileSync('src/main/startup.ts', 'utf8');

// The original file before any of my modifications:
// let's just make sure there are NO chronoTesseractsSystem: systems.chronoTesseractsSystem, in it at all
while(start.includes("chronoTesseractsSystem: systems.chronoTesseractsSystem,")) {
    start = start.replace("chronoTesseractsSystem: systems.chronoTesseractsSystem,", "");
}

// Ensure no empty spaces are left
start = start.replace(/\n\s*\n/g, '\n');

// Now, precisely insert them.
const split = start.split('galacticLeylinesSystem: systems.galacticLeylinesSystem,');
if (split.length === 3) {
    start = split[0] +
            'galacticLeylinesSystem: systems.galacticLeylinesSystem,\n            chronoTesseractsSystem: systems.chronoTesseractsSystem,' +
            split[1] +
            'galacticLeylinesSystem: systems.galacticLeylinesSystem,\n        chronoTesseractsSystem: systems.chronoTesseractsSystem,' +
            split[2];
}

fs.writeFileSync('src/main/startup.ts', start);
