const fs = require('fs');
const file = 'tools/typecheck_baseline.cjs';
let text = fs.readFileSync(file, 'utf8');
text = text.replace(
`function readBaseline() {
    if (!fs.existsSync(BASELINE_PATH)) {
        return new Set();
    }
    const text = fs.readFileSync(BASELINE_PATH, 'utf8');
    const errors = new Set();
    for (const line of text.split('\\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        errors.add(trimmed);
    }
    return errors;
}`,
`function readBaseline() {
    if (!fs.existsSync(BASELINE_PATH)) {
        return new Set();
    }
    const text = fs.readFileSync(BASELINE_PATH, 'utf8');
    const errors = new Set();
    let isCountZero = false;
    for (const line of text.split('\\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('# Count: 0')) {
            isCountZero = true;
        }
        if (!trimmed || trimmed.startsWith('#')) continue;
        errors.add(trimmed);
    }
    if (isCountZero && errors.size > 0) {
        console.error('Typecheck baseline claims Count: 0 but has error lines. Empty baseline is the policy going forward.');
        process.exit(1);
    }
    if (errors.size > 0) {
        console.error('Typecheck baseline must be empty going forward. Found ' + errors.size + ' errors.');
        process.exit(1);
    }
    return errors;
}`);
fs.writeFileSync(file, text);
