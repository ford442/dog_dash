import re

with open('src/endless/patches.ts', 'r') as f:
    content = f.read()

errors = [
  'quantumMirrors', 'cosmicWebFilaments', 'magneticPlasmaArcs', 'orbitalMegastructures',
  'astralResonanceRings', 'dimensionalFractures', 'etherealPrismaticRibbons', 'stardustVortex',
  'celestialClockworks', 'galacticLeylines', 'chronoTesseracts', 'ascendantMonoliths',
  'echoingVoidRipples', 'quantumFoamBubbles', 'cosmicCyberGrid', 'pulsarLighthouse',
  'voidLatticeNetworks', 'etherealSupernovaRemnants', 'quantumSingularityCore', 'cosmicStringHorizons',
  'radiantHalos', 'energyRifts', 'bioluminescentSpores', 'holographicDataStreams', 'prismaticCrystals'
]

additions = ''
for err in errors:
    if f"    {err}:" not in content:
        additions += f"    {err}: on('{err}'),\n"

new_content = content.replace('export const RECIPE_PATCHES: Record<EnvDescriptorKey, Patch> = {', 'export const RECIPE_PATCHES: Record<EnvDescriptorKey, Patch> = {\n' + additions)

with open('src/endless/patches.ts', 'w') as f:
    f.write(new_content)
