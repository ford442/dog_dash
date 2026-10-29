/**
 * Which `Math.random()` call sites actually reach gameplay?
 *
 * Gives every `src/` file its own Math.random stream (seeded by file name),
 * then bisects: salt half the candidate files, re-run the replay, and
 * recurse into whichever half changes the end snapshot / trajectory. A file
 * that changes it leaks randomness into gameplay and must use the run RNG
 * (`run_seed/`). Detection is probabilistic — a perturbation that happens
 * not to change the outcome is invisible — so a clean result means "no
 * leak observed on this path", which is why the replay suite also runs
 * every fixture under a different global Math.random stream.
 *
 *   node --import tsx tests/replay/taint_math_random.ts <fixture.json> [--steps N] [--jobs 8]
 *   node --import tsx tests/replay/taint_math_random.ts <fixture.json> --sites   # list live call sites
 *
 * A dev diagnostic, not part of `npm run check` (it costs one replay per file).
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { decodeInputTrace } from '../../src/ghost_run/input_trace';
import { runReplay, type ReplayFixture } from './headless_sim';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SELF = fileURLToPath(import.meta.url);

function arg(name: string): string | undefined {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

function hashString(s: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
    return h >>> 0;
}

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

type CallSite = { getFileName(): string | null; getLineNumber(): number | null };

/** File (and line) of whoever called Math.random. */
function callerSite(): { file: string; line: number } {
    const original = Error.prepareStackTrace;
    Error.prepareStackTrace = (_e, stack) => stack;
    const holder: { stack?: CallSite[] } = {};
    Error.captureStackTrace(holder, Math.random);
    const stack = holder.stack ?? [];
    Error.prepareStackTrace = original;
    const frame = stack[0];
    const raw = frame?.getFileName() ?? '<native>';
    const file = raw.startsWith('file://') ? fileURLToPath(raw) : raw;
    return { file: relative(ROOT, file), line: frame?.getLineNumber() ?? 0 };
}

async function child(fixturePath: string, saltFiles: Set<string>, salt: number, steps: number, listSites: boolean): Promise<void> {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as ReplayFixture;
    const inputs = decodeInputTrace(fixture.recording.inputs ?? []);
    const streams = new Map<string, () => number>();
    const sites = new Map<string, number>();

    Math.random = () => {
        const { file, line } = callerSite();
        if (listSites) {
            const key = `${file}:${line}`;
            sites.set(key, (sites.get(key) ?? 0) + 1);
        }
        let stream = streams.get(file);
        if (!stream) {
            stream = mulberry32(hashString(file) ^ (saltFiles.has(file) ? Math.imul(salt, 0x9e3779b9) : 0));
            streams.set(file, stream);
        }
        return stream();
    };

    const result = await runReplay({
        seed: fixture.recording.seed,
        chapter: fixture.chapter,
        steps: Math.min(steps, inputs.length),
        inputFor: (step) => inputs[step] ?? 0
    });
    const out = listSites
        ? { sites: [...sites.entries()].sort((a, b) => b[1] - a[1]) }
        : { snapshot: result.snapshot, checkpoints: result.checkpoints };
    process.stdout.write('\n' + JSON.stringify(out) + '\n', () => process.exit(0));
}

let maxJobs = Math.max(1, cpus().length - 1);
let activeJobs = 0;
const waiting: Array<() => void> = [];

async function runChild(fixturePath: string, extra: string[]): Promise<unknown> {
    if (activeJobs >= maxJobs) await new Promise<void>((r) => waiting.push(r));
    activeJobs++;
    try {
        return await spawnChild(fixturePath, extra);
    } finally {
        activeJobs--;
        waiting.shift()?.();
    }
}

function spawnChild(fixturePath: string, extra: string[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const proc = spawn(process.execPath, ['--import', 'tsx', SELF, fixturePath, '--child', ...extra], {
            cwd: ROOT,
            stdio: ['ignore', 'pipe', 'ignore']
        });
        let out = '';
        proc.stdout.on('data', (d) => { out += d; });
        proc.on('close', (code) => {
            const last = out.trim().split('\n').pop() ?? '';
            try { resolve(JSON.parse(last)); } catch { reject(new Error(`child exited ${code}: ${last.slice(0, 200)}`)); }
        });
    });
}

async function parent(fixturePath: string): Promise<void> {
    const steps = arg('--steps') ?? '1000000';
    maxJobs = Number(arg('--jobs') ?? maxJobs);
    const listed = (await runChild(fixturePath, ['--sites', '--steps', steps])) as { sites: [string, number][] };
    if (process.argv.includes('--sites')) {
        for (const [site, n] of listed.sites) console.log(`${String(n).padStart(8)}  ${site}`);
        return;
    }
    const files = [...new Set(listed.sites.map(([s]) => s.slice(0, s.lastIndexOf(':'))))].filter((f) => f.startsWith('src/'));
    const baseline = JSON.stringify(await runChild(fixturePath, ['--steps', steps]));
    console.log(`${files.length} src/ files call Math.random during the run; bisecting (${maxJobs} jobs)...`);

    // Group bisection: salt a whole set of files at once (far more likely to
    // perturb the run than one file), recurse into halves that diverge.
    // Two salts per probe, since one perturbation can miss by luck.
    const SALTS = [1, 2];
    const listFile = join(tmpdir(), `taint-${process.pid}-`);
    let probe = 0;
    async function diverges(set: string[]): Promise<boolean> {
        for (const salt of SALTS) {
            const path = `${listFile}${probe++}.json`;
            writeFileSync(path, JSON.stringify(set));
            const res = JSON.stringify(await runChild(fixturePath, ['--salt-files', path, '--salt', String(salt), '--steps', steps]));
            if (res !== baseline) return true;
        }
        return false;
    }
    const tainted: string[] = [];
    async function bisect(set: string[]): Promise<void> {
        if (!(await diverges(set))) return;
        if (set.length === 1) {
            tainted.push(set[0]);
            console.log(`  GAMEPLAY  ${set[0]}`);
            return;
        }
        const mid = Math.ceil(set.length / 2);
        const [a, b] = [set.slice(0, mid), set.slice(mid)];
        const before = tainted.length;
        await Promise.all([bisect(a), bisect(b)]);
        if (tainted.length === before) {
            console.log(`  GAMEPLAY (only in combination)  ${set.join(', ')}`);
            tainted.push(...set);
        }
    }
    await bisect(files);
    console.log(tainted.length === 0
        ? 'No file\'s Math.random reaches gameplay on this path.'
        : `${tainted.length} file(s) leak Math.random into gameplay:\n${[...new Set(tainted)].sort().map((f) => '  ' + f).join('\n')}`);
}

const fixturePath = process.argv[2];
if (!fixturePath) {
    console.error('usage: taint_math_random.ts <fixture.json> [--steps N] [--jobs N] [--sites]');
    process.exit(2);
}
if (process.argv.includes('--child')) {
    const listPath = arg('--salt-files');
    const saltFiles = new Set<string>(listPath ? JSON.parse(readFileSync(listPath, 'utf8')) as string[] : []);
    await child(fixturePath, saltFiles, Number(arg('--salt') ?? '1'), Number(arg('--steps') ?? '1000000'), process.argv.includes('--sites'));
} else {
    await parent(fixturePath);
}
