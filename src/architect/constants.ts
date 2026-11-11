/**
 * Architect Lab limits shared by the schema, the course builder and the Lab
 * UI. Tiny on purpose: the boot path imports it.
 */

/** Level index a sandbox course runs as: clear of campaign (1–6) and Endless (101+) chapters. */
export const ARCHITECT_LEVEL_INDEX = 200;

/** `v` of the seed JSON this build reads and writes. */
export const ARCHITECT_SEED_VERSION = 1;

export const ARCHITECT_MAX_PLACEMENTS = 24;

/** A sandbox is 500–800 m: long enough for a few beats, short enough to retry. */
export const SANDBOX_MIN_LENGTH = 500;
export const SANDBOX_MAX_LENGTH = 800;

/** Pasted seed text larger than this is refused before `JSON.parse` (24 placements fit in ~2 KB). */
export const ARCHITECT_MAX_SEED_CHARS = 8192;
