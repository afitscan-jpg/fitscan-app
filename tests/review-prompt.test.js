// node tests/review-prompt.test.js — offline check of the review-prompt rules.
const ts = require('typescript'); const fs = require('fs'); const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src/lib/review-prompt.ts'), 'utf8');
// strip the storage/runtime half: only the pure decision is under test here
const pure = src.split('// ── storage')[0].replace(/^import .*$/m, '');
const out = ts.transpileModule(pure, { compilerOptions: { module: 'commonjs', target: 'es2020' } }).outputText;
const m = {}; new Function('exports', 'require', out)(m, require);
const { shouldPromptReview } = m;
const day = 86_400_000; const now = new Date('2026-10-20T12:00:00Z');
const ago = (d) => new Date(now.getTime() - d * day).toISOString();
const base = { state: { firstOpenAt: ago(10), lastPromptAt: null, lastPromptVersion: null }, now, totalLogs: 12, appVersion: '1.0.0', moment: 'log_success', promptedThisSession: false };
let fails = 0; const t = (n, c) => { console.log((c ? 'ok    ' : 'FAIL  ') + n); if (!c) fails++; };
t('earned: day 10, 12 logs, log success -> prompt', shouldPromptReview(base) === true);
t('weekly insight is also a success moment', shouldPromptReview({ ...base, moment: 'weekly_insight' }) === true);
t('day 2 -> no', shouldPromptReview({ ...base, state: { ...base.state, firstOpenAt: ago(2) } }) === false);
t('day 3 exactly -> yes', shouldPromptReview({ ...base, state: { ...base.state, firstOpenAt: ago(3) } }) === true);
t('4 logs -> no', shouldPromptReview({ ...base, totalLogs: 4 }) === false);
t('5 logs -> yes', shouldPromptReview({ ...base, totalLogs: 5 }) === true);
t('no first-open record -> no', shouldPromptReview({ ...base, state: { ...base.state, firstOpenAt: null } }) === false);
t('prompted 30 days ago -> no', shouldPromptReview({ ...base, state: { ...base.state, lastPromptAt: ago(30), lastPromptVersion: '0.9.0' } }) === false);
t('prompted 91 days ago, older version -> yes', shouldPromptReview({ ...base, state: { ...base.state, lastPromptAt: ago(91), lastPromptVersion: '0.9.0' } }) === true);
t('prompted 91 days ago, SAME version -> no', shouldPromptReview({ ...base, state: { ...base.state, lastPromptAt: ago(91), lastPromptVersion: '1.0.0' } }) === false);
t('already prompted this session -> no', shouldPromptReview({ ...base, promptedThisSession: true }) === false);
t('garbage dates -> no', shouldPromptReview({ ...base, state: { ...base.state, firstOpenAt: 'nope' } }) === false);
t('an unknown moment never prompts', shouldPromptReview({ ...base, moment: 'button' }) === false);
console.log(fails ? 'FAILED ' + fails : 'ALL PASSED'); process.exit(fails ? 1 : 0);
