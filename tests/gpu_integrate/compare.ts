/**
 * Golden-snapshot comparison, kept free of Three/particles imports so the
 * Playwright parity spec can load it in Node cheaply.
 */

export interface Snapshot {
    step: number;
    system: 'particles' | 'debris';
    /** Live entries after the step. */
    count: number;
    /** Draw slots on the mesh (`mesh.count`). */
    drawn: number;
    /** `drawn * 16` instance-matrix floats. */
    matrices: number[];
    /** `drawn * 3` instance colours (particles only). */
    colors?: number[];
}

/**
 * Per-component tolerances. Matrix entries 12–14 are the translation (the
 * integrated position); 0–10 are the rotation·scale basis, which carries the
 * GPU's sin/cos error. A single number applies to everything.
 */
export type Tolerance = number | { translation: number; basis: number; colors?: number };

/**
 * Compares a run against the golden snapshots. Counts and draw counts must be
 * exact (they come from the CPU lifecycle in every mode); floats within `tol`.
 * Returns human-readable mismatches, empty when parity holds.
 */
export function compareSnapshots(actual: Snapshot[], golden: Snapshot[], tolerance: Tolerance): string[] {
    const tol = typeof tolerance === 'number'
        ? { translation: tolerance, basis: tolerance, colors: tolerance }
        : { colors: 1e-6, ...tolerance };
    const problems: string[] = [];
    if (actual.length !== golden.length) {
        return [`snapshot count ${actual.length} != golden ${golden.length}`];
    }
    const worst = { translation: 0, basis: 0, colors: 0 };
    for (let n = 0; n < golden.length; n++) {
        const a = actual[n]!;
        const g = golden[n]!;
        const tag = `${g.system}@${g.step}`;
        if (a.count !== g.count) problems.push(`${tag}: count ${a.count} != ${g.count}`);
        if (a.drawn !== g.drawn) problems.push(`${tag}: drawn ${a.drawn} != ${g.drawn}`);
        const check = (name: 'matrices' | 'colors', av: number[] | undefined, gv: number[] | undefined) => {
            if (!gv) return;
            if (!av || av.length !== gv.length) {
                problems.push(`${tag}: ${name} length ${av?.length} != ${gv.length}`);
                return;
            }
            for (let i = 0; i < gv.length; i++) {
                const d = Math.abs(av[i]! - gv[i]!);
                const kind = name === 'colors' ? 'colors' : (i % 16 >= 12 ? 'translation' : 'basis');
                worst[kind] = Math.max(worst[kind], d);
                if (d > tol[kind]) {
                    problems.push(`${tag}: ${name}[${i}] (${kind}) ${av[i]} vs ${gv[i]} (|Δ| ${d.toExponential(2)} > ${tol[kind]})`);
                    return;
                }
            }
        };
        check('matrices', a.matrices, g.matrices);
        check('colors', a.colors, g.colors);
    }
    if (problems.length === 0 && typeof process !== 'undefined' && process.env?.GPU_INTEGRATE_VERBOSE) {
        const fmt = (k: keyof typeof worst) => `${k} ${worst[k].toExponential(2)} (tol ${tol[k]})`;
        console.log(`[gpu-integrate parity] worst |Δ|: ${fmt('translation')}, ${fmt('basis')}, ${fmt('colors')}`);
    }
    return problems;
}
