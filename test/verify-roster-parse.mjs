/* The roster paste box has to read a real TeamSnap roster page, which on
   select-all-copy is a block per player: the player's name, then parent
   names, emails and phone numbers, then the shirt number alone on a line.
   Only the player and the number may survive.

   Every name below is invented. Never put a real roster in this repo —
   the lineup feature is coach-only and on-device precisely because these
   are children's names, and this file is public. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..') + path.sep;
const src = fs.readFileSync(repo + 'js/lineup.js', 'utf8');

// lift the parser out of lineup.js without a DOM
const start = src.indexOf('const ROSTER_NOISE');
const end = src.indexOf('function lineupImportRoster');
if (start === -1 || end === -1) {
    console.error('FAIL: could not find the parser block in js/lineup.js');
    process.exit(1);
}
const { parseRoster } = new Function(src.slice(start, end) + '\nreturn {parseRoster};')();

let fail = 0;
const check = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); fail++; } };

/* ---- 1. a copied TeamSnap roster page ---- */
const teamsnapPage = `Roster
Add
Clear
Total Players: 5
Export
Name
Contact Info
# / Position
Manager
Ada Placeholder
Parent One
parent.one@example.com
+1 (720) 862-5068
#28
Edit
Delete
Bea Sample
Invite To Join
#99
Edit
Delete
Cara Keeper
Parent Two
p.two@example.com - Dad
4692158559 - Dad
Other Parent
other@example.com - Mom
8179039787
#18 - GK
Edit
Delete
Dana Twin
Parent Three
three@example.com - Mom
(469) 316-5845 - Mom
#2
Edit
Delete
Edie Twin
Invite To Join
#2
Edit
Delete
Non-Players
Total Non-Players: 2
Name
Contact Info
Coach Someone
Coach Someone
coach@example.com
Edit
Manager Person

Team Owner

Manager Person
mgr@example.com`;

const a = parseRoster(teamsnapPage);
check(a.length === 5, `TeamSnap page yields 5 players, got ${a.length}`);
check(a[0].num === '28' && a[0].name === 'Ada Placeholder', 'player with contacts parsed');
check(a[1].num === '99' && a[1].name === 'Bea Sample', 'Invite-To-Join player parsed, UI word dropped');
check(a[2].num === '18' && a[2].name === 'Cara Keeper' && a[2].pos === 'GK', 'GK position captured');
check(!a.some(p => /@/.test(p.name)), 'no email addresses leaked into names');
check(!a.some(p => /Parent|Other/.test(p.name)), 'no parent names leaked in');
check(!a.some(p => /Coach|Manager Person/.test(p.name)), 'Non-Players section excluded');
check(!a.some(p => /\d{3}[^a-z]*\d{4}/.test(p.name)), 'no phone numbers leaked into names');

/* Two players on one shirt number is real — it happens on the live roster.
   Both must survive; the app keys players by id, not by number. */
const twos = a.filter(p => p.num === '2');
check(twos.length === 2, `both #2 players kept, got ${twos.length}`);
check(twos[0].name !== twos[1].name, 'the two #2 players stay distinct');

/* ---- 2. plain one-per-line pastes ---- */
const plain = `7  Ava Martin
12 Mia Chen
Zoe Patel 4
#9 Nora Diaz
Unnumbered Player`;
const b = parseRoster(plain);
check(b.length === 5, `plain lines yield 5, got ${b.length}`);
check(b[0].num === '7' && b[0].name === 'Ava Martin', 'leading number');
check(b[2].num === '4' && b[2].name === 'Zoe Patel', 'trailing number');
check(b[3].num === '9' && b[3].name === 'Nora Diaz', 'hash-prefixed inline number');
check(b[4].name === 'Unnumbered Player' && !b[4].num, 'a player with no number still imports');

/* "#9 Nora Diaz" must not be read as a block-mode number line, or the
   parser swallows the preceding lines as that player's contact block. */
check(!b.some(p => /\n/.test(p.name)), 'inline numbers do not trigger block mode');

/* ---- 3. empty and junk input ---- */
check(parseRoster('').length === 0, 'empty input yields nothing');
check(parseRoster('Roster\nAdd\nClear\nExport').length === 0, 'UI chrome alone yields nothing');

console.log(fail
    ? `\n${fail} check(s) failed`
    : `OK: roster parser handled ${a.length + b.length} players across both paste shapes, dropped every contact detail`);
process.exit(fail ? 1 : 0);
