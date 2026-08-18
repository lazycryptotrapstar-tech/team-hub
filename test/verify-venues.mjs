/* Venue data must reproduce the geometry of the original hand-built maps
   (v1-legacy buildUTDMap / buildVenueMapSVG), and field resolution must
   still work off the free-text location strings the app has always used. */
import fs from 'fs';
import vm from 'vm';
import { fileURLToPath } from 'url';
import path from 'path';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..') + path.sep;
const venuesDoc = JSON.parse(fs.readFileSync(repo + 'data/venues.json', 'utf8'));
const venueJs = fs.readFileSync(repo + 'js/venue.js', 'utf8');

// Load venue.js with a stubbed DOM/fetch so we can call its pure functions
const ctx = {
  console,
  fetch: () => Promise.reject(new Error('no fetch in test')),
  document: { querySelectorAll: () => [], getElementById: () => null },
};
vm.createContext(ctx);
vm.runInContext(venueJs, ctx);
// VENUES is a lexical binding inside the script, so populate it in-context
ctx.__venuesDoc = venuesDoc;
vm.runInContext('VENUES = {}; __venuesDoc.venues.forEach(v => { VENUES[v.id] = v; });', ctx);
const inCtxVenue = id => vm.runInContext(`VENUES[${JSON.stringify(id)}]`, ctx);

let pass = 0, fail = 0;
const check = (label, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++;
  else { fail++; console.log(`  FAIL ${label}\n       got:  ${g}\n       want: ${w}`); }
};

/* ---- UT Dallas: legacy geometry was computed from these constants ---- */
const fw = 72, fh = 86, gap = 8, ux = 12, uy = 22;
const ly = uy + 2 * (fh + gap) + 28;
const LEGACY_UTD = {
  3:[ux,uy], 2:[ux+fw+gap,uy], 1:[ux+2*(fw+gap),uy],
  6:[ux,uy+fh+gap], 5:[ux+fw+gap,uy+fh+gap], 4:[ux+2*(fw+gap),uy+fh+gap],
  8:[ux,ly], 7:[ux+fw+gap,ly], 10:[ux,ly+fh+gap], 9:[ux+fw+gap,ly+fh+gap],
};
const utd = inCtxVenue("utd");
console.log('\n[utd] ' + utd.name);
check('canvas', [utd.canvas.w, utd.canvas.h], [340, 452]);
check('field count', utd.fields.length, 10);
for (const f of utd.fields) {
  check(`field UTD-${f.id} box`, [f.x, f.y, f.w, f.h], [...LEGACY_UTD[f.id], fw, fh]);
}
check('Field St road y', utd.zones.find(z => z.label === 'FIELD ST').y, uy + 2*(fh+gap) + 4);
const lotU = utd.zones.find(z => z.type === 'parking');
check('Lot U origin', [lotU.x, lotU.y], [ux + 2*(fw+gap) + fw + 6, ly]);
check('address', utd.address, '6701 Floyd Rd · Richardson TX');
check('has parking note', /Lot U/.test(utd.parkingNote) && /Lot J/.test(utd.parkingNote), true);

/* ---- Carpenter Park: legacy field array, verbatim ---- */
const LEGACY_CARPENTER = [
  {id:'E',x:25,y:58,w:58,h:44,size:'9v9'},{id:'F',x:148,y:18,w:58,h:44,size:'9v9'},
  {id:'G',x:216,y:18,w:58,h:44,size:'9v9'},{id:'H',x:298,y:22,w:64,h:48,size:'9v9'},
  {id:'A',x:140,y:83,w:88,h:112,size:'11v11'},{id:'B',x:238,y:83,w:88,h:112,size:'11v11'},
  {id:'D',x:140,y:205,w:88,h:112,size:'11v11'},{id:'C',x:238,y:205,w:88,h:112,size:'11v11'},
  {id:'L',x:330,y:258,w:72,h:100,size:'11v11'},{id:'M',x:410,y:258,w:72,h:100,size:'11v11'},
];
const cp = inCtxVenue("carpenter");
console.log(`\n[carpenter] ${cp.name}`);
check('canvas', [cp.canvas.w, cp.canvas.h], [490, 375]);
check('field count', cp.fields.length, 10);
for (const want of LEGACY_CARPENTER) {
  const f = cp.fields.find(x => x.id === want.id);
  check(`field ${want.id}`, [f.x, f.y, f.w, f.h, f.size], [want.x, want.y, want.w, want.h, want.size]);
}
check('address', cp.address, '6701 Coit Rd · Plano TX 75024');

/* ---- Field resolution off the free-text strings used in real data ---- */
console.log('\n[resolution]');
const R = (venue, game) => ctx.resolveField(venue, game);
check('"UT Dallas #07" -> 7',  R(utd, { locText: 'UT Dallas #07' }), '7');
check('"UT Dallas #09" -> 9',  R(utd, { locText: 'UT Dallas #09' }), '9');
check('"UT Dallas #10" -> 10', R(utd, { locText: 'UT Dallas #10' }), '10');
check('structured ref wins',   R(utd, { venueId: 'utd', fieldId: '5', locText: 'UT Dallas #07' }), '5');
check('"Carpenter Park D · #209" -> D', R(cp, { field: 'Carpenter Park D · #209' }), 'D');
check('"Carpenter Park M · #212" -> M', R(cp, { field: 'Carpenter Park M · #212' }), 'M');
check('non-matching venue -> null', R(cp, { locText: 'UT Dallas #07' }), null);
check('unknown text -> null', R(utd, { locText: 'Some Other Park 3' }), null);

/* ---- detectVenue picks the right venue from a game list ---- */
check('detect utd from schedule', ctx.detectVenue([{ locText: 'UT Dallas #07' }]).id, 'utd');
check('detect carpenter from tournament', ctx.detectVenue([{ field: 'Carpenter Park A · #211' }]).id, 'carpenter');
check('detect none for unknown', ctx.detectVenue([{ locText: 'Nowhere Field 1' }]), null);
check('venueType hint honored', ctx.detectVenue([], 'utd').id, 'utd');

/* ---- state coloring ---- */
console.log('\n[states]');
check('ours wins over others', ctx.fieldState([{ isOurs: false, label: 'Final' }, { isOurs: true }]), 'ours');
check('final', ctx.fieldState([{ label: 'Final' }]), 'final');
check('semi',  ctx.fieldState([{ label: 'Semi-Finals' }]), 'semi');
check('active', ctx.fieldState([{ label: 'Group Stage' }]), 'active');
// "no games" styling is per-venue: schedule venues stay legible, tournament venues dim
check('no games defaults to inactive', ctx.fieldState([]), 'inactive');
check('no games honors venue emptyState', ctx.fieldState([], 'empty'), 'empty');
check('utd shows unused fields normally', utd.emptyState, 'inactive');
check('carpenter dims unused fields', cp.emptyState, 'empty');

/* ---- SVG renders, is well-formed, and highlights the right field ---- */
console.log('\n[render]');
for (const v of [utd, cp]) {
  const games = {}; games[v.fields[7].id] = [{ isOurs: true, date: 'Sat', time: '9:00 AM' }];
  const svg = ctx.buildVenueSVG(v, games);
  check(`${v.id}: viewBox`, /viewBox="0 0 \d+ \d+"/.test(svg), true);
  check(`${v.id}: one rect per field`, (svg.match(/class="vf-rect"/g) || []).length, v.fields.length);
  check(`${v.id}: highlighted field uses the team accent`, svg.includes('fill="var(--accent)"'), true);
  check(`${v.id}: tags balanced`, (svg.match(/<g /g)||[]).length, (svg.match(/<\/g>/g)||[]).length);
  check(`${v.id}: no undefined/NaN`, /undefined|NaN/.test(svg), false);
}

console.log(`\n${'='.repeat(50)}\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
