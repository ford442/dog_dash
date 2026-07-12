#!/usr/bin/env node
/**
 * Extract line ranges from a source file into a new module file.
 * Usage: node tools/split_file.cjs <src> <dest> <startLine> <endLine> [header]
 */
const fs = require('fs');
const path = require('path');

const [src, dest, startStr, endStr, ...headerParts] = process.argv.slice(2);
if (!src || !dest || !startStr || !endStr) {
    console.error('Usage: split_file.cjs <src> <dest> <startLine> <endLine> [header]');
    process.exit(1);
}

const start = parseInt(startStr, 10);
const end = parseInt(endStr, 10);
const header = headerParts.join(' ');

const lines = fs.readFileSync(src, 'utf8').split('\n');
const chunk = lines.slice(start - 1, end);
const dir = path.dirname(dest);
fs.mkdirSync(dir, { recursive: true });

const content = (header ? header + '\n\n' : '') + chunk.join('\n') + '\n';
fs.writeFileSync(dest, content);
console.log(`Wrote ${dest} (${chunk.length} lines)`);
