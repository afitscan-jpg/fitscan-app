// node tests/kcal-total.test.js — a total is the sum of the per-row DISPLAYED kcal.
const ts = require('typescript'); const fs = require('fs'); const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src/lib/kcal.ts'), 'utf8');
const out = ts.transpileModule(src, { compilerOptions: { module: 'commonjs', target: 'es2020' } }).outputText;
const m = {}; new Function('exports', 'require', out)(m, require);
const { sumShownKcal } = m;
let fails = 0; const t = (n, c) => { console.log((c ? 'ok    ' : 'FAIL  ') + n); if (!c) fails++; };

t('99.6 × 2: rows show 100 + 100, total is 200 (not round(199.2) = 199)', sumShownKcal([99.6, 99.6]) === 200);
t('a single row equals its own display', sumShownKcal([199.2]) === 199 && Math.round(199.2) === 199);
t('rounding happens per row, not on the sum: 0.4 + 0.4 + 0.4 = 0', sumShownKcal([0.4, 0.4, 0.4]) === 0);
t('integers pass through unchanged', sumShownKcal([120, 80, 250]) === 450);
t('non-numbers count as 0', sumShownKcal([NaN, undefined, '12', 7.5]) === 20);
t('empty is 0', sumShownKcal([]) === 0);

console.log(fails ? `\n${fails} FAILED` : '\nall ok'); process.exit(fails ? 1 : 0);
