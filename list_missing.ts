import { RECIPE_PATCHES } from './src/endless/patches.js';
import { ENV_SYSTEM_DESCRIPTORS } from './src/env_system_descriptors.js';

const expected = Object.keys(ENV_SYSTEM_DESCRIPTORS);
const actual = Object.keys(RECIPE_PATCHES);

const missing = expected.filter(k => !actual.includes(k));
console.log("MISSING KEYS:");
missing.forEach(k => console.log(k));
