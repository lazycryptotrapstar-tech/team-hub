/* Parsing other people's tables is guesswork, so the guesses are pinned
   here against the shapes a league site actually copies out as. */
import fs from 'fs';
import vm from 'vm';
import { fileURLToPath } from 'url';
import path from 'path';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..') + path.sep;
const importJs = fs.readFileSync(repo + 'js/admin/import.js', 'utf8');

const el = () => ({ value: '', innerHTML: '', textContent: '', files: [], className: '' });
const ctx = {
  console, FileReader: class {}, Date,
  document: { getElementById: el, querySelector: el, querySelectorAll: () => [] },
  // admin globals the import module leans on
  $: el, status(){}, markDirty(){}, renderPanel(){}, renderAll(){}, editTeamId: 'u13',
  detectVenue: () => null, resolveField: () => null,
  team: () => ({ branding: { season: 'Spring 2026' }, games: [], standings: { rows: [] } }),
};
vm.createContext(ctx);
vm.runInContext(importJs, ctx);

let pass = 0, fail = 0;
const check = (label, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++;
  else { fail++; console.log(`  FAIL ${label}\n       got:  ${g}\n       want: ${w}`); }
};

/* ---- dates ---- */
console.log('\n[dates]');
check('ISO passes through', ctx.parseDate('2026-03-21', 2026), '2026-03-21');
check('US slashes', ctx.parseDate('3/21/26', 2026), '2026-03-21');
check('slashes, no year, spring month', ctx.parseDate('3/21', 2026), '2026-03-21');
// a season runs Aug-Jul, so an August date belongs to the year before it ends
check('bare August lands in the autumn', ctx.parseDate('8/23', 2026), '2025-08-23');
check('"Mar 21"', ctx.parseDate('Mar 21', 2026), '2026-03-21');
check('"Sept 7" autumn', ctx.parseDate('Sept 7', 2026), '2025-09-07');
check('"Nov 11, 2025"', ctx.parseDate('Nov 11, 2025', 2026), '2025-11-11');
check('rubbish is rejected', ctx.parseDate('next tuesday', 2026), null);

/* ---- times ---- */
console.log('\n[times]');
check('6:30 PM', ctx.parseTime('6:30 PM'), '18:30');
check('9:30 AM', ctx.parseTime('9:30 AM'), '09:30');
check('12:00 PM is noon', ctx.parseTime('12:00 PM'), '12:00');
check('12:30 AM is after midnight', ctx.parseTime('12:30 AM'), '00:30');
check('24h passes through', ctx.parseTime('18:30'), '18:30');
check('empty', ctx.parseTime(''), '');

/* ---- league table, as copied out of a standings page ---- */
console.log('\n[league table]');
const table = `Pos	Club	MP	W	D	L	GF	GA	GD	Pts
1	Coppell FC 13G Oland Red	14	12	0	2	53	12	+41	36
2	FCD FC DIVAS XIII	13	10	1	2	34	14	+20	31
11	Sting McNeal 13G	14	6	1	7	23	25	-2	19`;
const st = ctx.parseStandings(table);
check('header row skipped', st.length, 3);
check('first club', [st[0].rank, st[0].name, st[0].mp, st[0].w, st[0].d, st[0].l, st[0].gf, st[0].ga],
      [1, 'Coppell FC 13G Oland Red', 14, 12, 0, 2, 53, 12]);
check('our row', [st[2].rank, st[2].name, st[2].w, st[2].l], [11, 'Sting McNeal 13G', 6, 7]);
check('clean rows carry no warning', st[0].note, '');

// two-space separated, which is what an HTML table gives you
const spaced = `1  Coppell FC 13G Oland Red  14  12  0  2  53  12  +41  36
2  Sting G13 E Rodriguez  15  9  4  2  45  16  +29  31`;
const st2 = ctx.parseStandings(spaced);
check('space-separated parses', st2.length, 2);
check('name with digits stays whole', st2[1].name, 'Sting G13 E Rodriguez');

// a row that does not add up should say so rather than be silently taken
const wrong = `4  Someone FC  14  9  9  9  20  10  +10  36`;
check('inconsistent row flagged', /does not match/.test(ctx.parseStandings(wrong)[0].note), true);

/* ---- fixtures and results ---- */
console.log('\n[fixtures]');
const fixtures = `Mar 21  #4 Sting Attack G13 H Pantoja  2 - 5  UT Dallas #07
Apr 14  6:30 PM  #17 Sting G13 Hubbard  UT Dallas #07
Aug 23  #12 Frisco Fusion 13G NPL NTX Blue  W 3 - 1`;
const g = ctx.parseGames(fixtures, 2026);
check('three fixtures', g.length, 3);
check('played game', [g[0].date, g[0].opponent, g[0].score.us, g[0].score.them, g[0].status],
      ['2026-03-21', 'Sting Attack G13 H Pantoja', 2, 5, 'played']);
check('rank picked up', g[0].oppRank, 4);
check('ground picked up', g[0].locText, 'UT Dallas #07');
check('upcoming game has no score', [g[1].status, g[1].score], ['scheduled', null]);
check('kickoff parsed', g[1].time, '18:30');
check('autumn date lands in the right year', g[2].date, '2025-08-23');
// "W 3 - 1" is a win, so the bigger number is ours
check('W keeps us in front', [g[2].score.us, g[2].score.them], [3, 1]);

// "L 1 - 3" listed opponent-first still records as our loss
const loss = ctx.parseGames('Oct 04  #3 Sting G13 E Rodriguez  L 3 - 1', 2026);
check('L flips to a loss', [loss[0].score.us, loss[0].score.them], [1, 3]);

// grounds written various ways must come out whole, and not eat the opponent
console.log('\n[grounds]');
for (const [line, wantOpp, wantLoc] of [
  ['Sep 12  9:00 AM  #8 Solar Byars 14G  ALC Field 3',            'Solar Byars 14G', 'ALC Field 3'],
  ['Sep 12  #8 Solar Byars 14G  UT Dallas #07',                   'Solar Byars 14G', 'UT Dallas #07'],
  ['Sep 12  #8 Solar Byars 14G  Railroad Park #12',               'Solar Byars 14G', 'Railroad Park #12'],
  ['Sep 12  #8 Solar Byars 14G  Carpenter Park D',                'Solar Byars 14G', 'Carpenter Park D'],
  ['Sep 12  #8 Solar Byars 14G  Toyota Soccer Center 18A',        'Solar Byars 14G', 'Toyota Soccer Center 18A'],
  ['Sep 12  #8 Solar Byars 14G',                                  'Solar Byars 14G', ''],
]) {
  const r = ctx.parseGames(line, 2026)[0];
  check(`opponent from "${wantLoc || 'no ground'}"`, r.opponent, wantOpp);
  check(`ground from "${wantLoc || 'no ground'}"`, r.locText, wantLoc);
}

// csv out of a spreadsheet
const csv = `date,opponent,score,location
2026-02-03,LC United 13G Evans,2 - 1,UT Dallas #09
2026-02-22,NTX Lioness Select 13G,1 - 0,`;
const gc = ctx.parseGames(csv, 2026);
check('csv rows parse', gc.length, 2);
check('csv opponent', gc[0].opponent, 'LC United 13G Evans');
check('csv score', [gc[0].score.us, gc[0].score.them], [2, 1]);

/* ---- telling the two apart ---- */
console.log('\n[detection]');
check('table looks like a table', ctx.detectKind(table), 'standings');
check('fixtures look like fixtures', ctx.detectKind(fixtures), 'games');
check('prose is neither', ctx.detectKind('hello there, nothing here'), null);
check('empty is neither', ctx.detectKind(''), null);

/* ---- nothing is trusted blindly ---- */
console.log('\n[safety]');
check('every parsed row starts accepted but reviewable', st.every(r => r.accept === true), true);
check('rows carry their kind', [st[0].kind, g[0].kind], ['standings', 'game']);
check('garbage in gives nothing out', ctx.parseGames('just some words here', 2026).length, 0);

console.log(`\n${'='.repeat(50)}\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
