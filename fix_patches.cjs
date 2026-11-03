const fs = require('fs');
let code = fs.readFileSync('src/endless/patches.ts', 'utf8');

const additions = `    prismaticCrystals: on('prismaticCrystals'),
    stardustVortex: fromTwin('stardustVortex', { density: 1.5 }),
    bioluminescentSpores: on('bioluminescentSpores'),
    quantumMirrors: on('quantumMirrors'),
    celestialClockworks: fromTwin('celestialClockworks', { density: 1.0, speed: 1.0 }),
    galacticLeylines: fromTwin('galacticLeylines', { density: 1.0, speed: 1.0 }),
    chronoTesseracts: fromTwin('chronoTesseracts', { density: 1.0, speed: 1.0 }),
    holographicDataStreams: on('holographicDataStreams'),
    cosmicWebFilaments: on('cosmicWebFilaments'),
    magneticPlasmaArcs: fromTwin('magneticPlasmaArcs', { density: 1.5, speed: 1.2 }),
    pulsarLighthouse: fromTwin('pulsarLighthouse', { density: 1.0, speed: 1.0 }),
    orbitalMegastructures: fromTwin('orbitalMegastructures', { density: 1.0, speed: 1.0 }),
    ascendantMonoliths: fromTwin('ascendantMonoliths', { density: 1.0 }),
    echoingVoidRipples: fromTwin('echoingVoidRipples', { density: 1.0, speed: 1.0 }),
    astralResonanceRings: fromTwin('astralResonanceRings', { density: 1.0, speed: 1.0 }),
    radiantHalos: fromTwin('radiantHalos', { density: 1.0, speed: 1.0 }),
    voidLatticeNetworks: fromTwin('voidLatticeNetworks', { density: 1.0, speed: 1.0 }),
    quantumFoamBubbles: fromTwin('quantumFoamBubbles', { density: 1.0, speed: 1.0 }),
    etherealSupernovaRemnants: fromTwin('etherealSupernovaRemnants', { density: 1.0, speed: 1.0 }),
    quantumSingularityCore: fromTwin('quantumSingularityCore', { density: 1.0, speed: 1.0 }),
    dimensionalFractures: fromTwin('dimensionalFractures', { density: 1.0, speed: 1.0 }),
    cosmicStringHorizons: fromTwin('cosmicStringHorizons', { density: 1.0, speed: 1.0 }),
    etherealPrismaticRibbons: fromTwin('etherealPrismaticRibbons', { density: 1.0, speed: 1.0 }),
`;

code = code.replace("    boss: (cfg, ctx) => {", additions + "    boss: (cfg, ctx) => {");
fs.writeFileSync('src/endless/patches.ts', code);
