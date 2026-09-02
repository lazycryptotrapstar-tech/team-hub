/* Each team's crest and favicon are generated from its name and colour,
   so the naming rules have to hold for teams that don't exist yet. */
import fs from 'fs';
import vm from 'vm';
import { fileURLToPath } from 'url';
import path from 'path';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..') + path.sep;
const appJs = fs.readFileSync(repo + 'js/app.js', 'utf8');

// Enough of a DOM that app.js can load; boot() then no-ops against the stubs.
const el = () => ({ innerHTML: '', className: '', style: {}, classList: { add(){}, remove(){}, contains(){return false;} },
                    querySelector: () => null, querySelectorAll: () => [], setAttribute(){}, appendChild(){}, textContent: '' });
const quiet = () => new Promise(() => {}); // never settles, so boot() just parks
const ctx = {
  console,
  fetch: () => Promise.reject(new Error('offline in test')),
  // these live in data.js / venue.js; app.js only calls them
  loadHubData: quiet, loadVenues: quiet,
  localStorage: { getItem: () => null, setItem(){}, removeItem(){}, key: () => null, length: 0 },
  setTimeout, clearTimeout,
  document: {
    documentElement: { style: { setProperty(){} } },
    getElementById: el, querySelector: el, querySelectorAll: () => [],
    createElement: el, body: el(),
  },
};
Object.defineProperty(ctx, 'Object', { value: Object });
vm.createContext(ctx);
vm.runInContext(appJs, ctx);

let pass = 0, fail = 0;
const check = (label, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++;
  else { fail++; console.log(`  FAIL ${label}\n       got:  ${g}\n       want: ${w}`); }
};

/* ---- crest text ---- */
console.log('\n[crest text]');
const I = n => ctx.teamInitials(n);
// the two real teams differ only by age group, so that is what must show
check('Sting McNeal 13G', I('Sting McNeal 13G'), '13G');
check('Sting McNeal 14G', I('Sting McNeal 14G'), '14G');
check('the two are distinct', I('Sting McNeal 13G') !== I('Sting McNeal 14G'), true);
check('U-prefixed age', I('Rangers U12 Boys'), '12');
check('U13 no gender', I('Coppell U13'), '13');
check('spaced code', I('Solar 14 G Byars'), '14G');
// no age code: fall back to initials, skipping club-type words
check('falls back to initials', I('Dallas Cosmos Red'), 'DC');
check('skips FC', I('FC Dallas White'), 'DW');
check('single word', I('Cosmos'), 'C');
check('empty name', I(''), 'TH');
check('always uppercase', I('sting mcneal'), 'SM');
check('never longer than 3', I('Atletico Dallas Youth 13-GA Blanton').length <= 3, true);

/* ---- crest markup ---- */
console.log('\n[crest svg]');
const crest = ctx.teamCrest({ branding: { name: 'Sting McNeal 13G' } }, 46);
check('renders the code', crest.includes('>13G<'), true);
check('inherits crest ink', crest.includes('var(--crest-ink,var(--accent))'), true);
check('no undefined', /undefined|NaN/.test(crest), false);
const mark = ctx.productMark(30);
check('product mark uses the accent', mark.includes('var(--accent)'), true);
check('product mark is square', /width="30" height="30"/.test(mark), true);

/* ---- form pips ---- */
console.log('\n[form pips]');
const m = (res) => ({ res, date: 'Mar 01', opp: 'X', score: '1 - 0' });
// six games in; the opening W should fall off, leaving L D W W L
const pips = ctx.formPips([m('W'),m('L'),m('D'),m('W'),m('W'),m('L')]);
check('shows only the last five', (pips.match(/form-pip /g) || []).length, 5);
check('drops the oldest game', [
  (pips.match(/pip-W/g)||[]).length,
  (pips.match(/pip-L/g)||[]).length,
  (pips.match(/pip-D/g)||[]).length,
], [2, 2, 1]);
check('no games renders nothing', ctx.formPips([]), '');
check('fewer than five is fine', (ctx.formPips([m('W'),m('D')]).match(/form-pip /g) || []).length, 2);

console.log(`\n${'='.repeat(50)}\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
