#!/usr/bin/env node
/**
 * TypeScript error baseline ratchet for Dog Dash.
 *
 * Compares `tsc --noEmit` output against a tracked baseline so CI fails only
 * when new type errors are introduced. Run with --update to refresh the baseline
 * after fixing errors (ratchet down).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(ROOT, '.github', 'typecheck-baseline.txt');
const ERROR_LINE = /^(.+\(\d+,\d+\)): error (TS\d+: .+)$/;

function runTypecheck() {
    try {
        execSync('npx tsc --noEmit', {
            cwd: ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        return '';
    } catch (err) {
        const stdout = err.stdout || '';
        const stderr = err.stderr || '';
        return `${stdout}${stderr}`;
    }
}

function parseErrors(output) {
    const errors = new Set();
    for (const line of output.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const match = trimmed.match(ERROR_LINE);
        if (match) {
            errors.add(`${match[1]}: ${match[2]}`);
        }
    }
    return errors;
}

function readBaseline() {
    if (!fs.existsSync(BASELINE_PATH)) {
        return new Set();
    }
    const text = fs.readFileSync(BASELINE_PATH, 'utf8');
    const errors = new Set();
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        errors.add(trimmed);
    }
    return errors;
}

function writeBaseline(errors) {
    const sorted = [...errors].sort();
    const header = [
        '# TypeScript error baseline — do not edit by hand unless you know what you are doing.',
        '# Regenerate with: npm run typecheck:baseline:update',
        `# Count: ${sorted.length}`,
        '',
    ].join('\n');
    fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
    fs.writeFileSync(BASELINE_PATH, `${header}${sorted.join('\n')}\n`, 'utf8');
}

function main() {
    const update = process.argv.includes('--update');
    const output = runTypecheck();
    const current = parseErrors(output);
    const baseline = readBaseline();

    if (update || baseline.size === 0) {
        writeBaseline(current);
        console.log(`Typecheck baseline updated: ${current.size} error(s) recorded at ${path.relative(ROOT, BASELINE_PATH)}`);
        process.exit(0);
    }

    const newErrors = [...current].filter((line) => !baseline.has(line)).sort();
    const fixedErrors = [...baseline].filter((line) => !current.has(line)).sort();

    console.log(`Typecheck: ${current.size} error(s) (${baseline.size} in baseline)`);

    if (fixedErrors.length > 0) {
        console.log(`\nFixed since baseline (${fixedErrors.length}) — run npm run typecheck:baseline:update to ratchet down:`);
        for (const line of fixedErrors.slice(0, 20)) {
            console.log(`  - ${line}`);
        }
        if (fixedErrors.length > 20) {
            console.log(`  ... and ${fixedErrors.length - 20} more`);
        }
    }

    if (newErrors.length > 0) {
        console.error(`\nNew type errors not in baseline (${newErrors.length}):`);
        for (const line of newErrors) {
            console.error(`  + ${line}`);
        }
        console.error('\nFix the errors above or revert the change. CI blocks new strict-mode violations.');
        process.exit(1);
    }

    console.log('Typecheck baseline OK — no new errors.');
    process.exit(0);
}

main();
