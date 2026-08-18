/* ============================================================
   IMPORT
   Paste a league table or a run of fixtures straight off the league
   site, or drop in a CSV. Everything lands in a review list first —
   nothing reaches the site until it has been looked at and accepted.
============================================================ */

let IMPORT_ROWS = [];     // staged rows awaiting review
let IMPORT_KIND = null;   // 'standings' | 'games'

const MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, sept:9, oct:10, nov:11, dec:12 };

/* ---- shared helpers ---- */

function splitRows(text) {
    return String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
}

/* Split a line into cells: tabs and commas win, otherwise runs of 2+ spaces,
   which is what a copy-pasted HTML table gives you. */
function splitCells(line) {
    if (line.includes('\t')) return line.split('\t').map(c => c.trim());
    if ((line.match(/,/g) || []).length >= 3) return parseCsvLine(line);
    if (/\s{2,}/.test(line)) return line.split(/\s{2,}/).map(c => c.trim());
    return line.split(/\s+/);
}

function parseCsvLine(line) {
    const out = []; let cur = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (quoted) {
            if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (c === '"') quoted = false;
            else cur += c;
        } else if (c === '"') quoted = true;
        else if (c === ',') { out.push(cur.trim()); cur = ''; }
        else cur += c;
    }
    out.push(cur.trim());
    return out;
}

/* Dates arrive as "2026-03-21", "3/21/26", "Mar 21" or "Sat Mar 21".
   Season-aware: a bare month/day with no year is placed in the season
   that actually contains it, so August lands in the previous year. */
function parseDate(raw, seasonHintYear) {
    const s = String(raw || '').trim();
    if (!s) return null;
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    m = s.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
    if (m) {
        const mo = +m[1], d = +m[2];
        let y = m[3] ? +m[3] : null;
        if (y != null && y < 100) y += 2000;
        if (y == null) y = yearFor(mo, seasonHintYear);
        return `${y}-${pad(mo)}-${pad(d)}`;
    }
    m = s.match(/([a-z]{3,4})\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?/i);
    if (m) {
        const mo = MONTHS[m[1].toLowerCase().slice(0, 4)] || MONTHS[m[1].toLowerCase().slice(0, 3)];
        if (!mo) return null;
        const y = m[3] ? +m[3] : yearFor(mo, seasonHintYear);
        return `${y}-${pad(mo)}-${pad(+m[2])}`;
    }
    return null;
}
function pad(n) { return String(n).padStart(2, '0'); }

/* A season runs Aug–Jul, so months Aug-Dec belong to the earlier year */
function yearFor(month, seasonEndYear) {
    const end = seasonEndYear || new Date().getFullYear();
    return month >= 7 ? end - 1 : end;
}

function parseTime(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    let m = s.match(/^(\d{1,2}):(\d{2})\s*([ap])\.?m?\.?$/i);
    if (m) {
        let h = +m[1];
        if (m[3].toLowerCase() === 'p' && h !== 12) h += 12;
        if (m[3].toLowerCase() === 'a' && h === 12) h = 0;
        return `${pad(h)}:${m[2]}`;
    }
    m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (m) return `${pad(+m[1])}:${m[2]}`;
    return '';
}

/* ---- what kind of paste is this? ---- */

function detectKind(text) {
    const lines = splitRows(text);
    if (!lines.length) return null;
    let standingsLike = 0, gameLike = 0;
    for (const line of lines) {
        const cells = splitCells(line);
        const nums = cells.filter(c => /^-?\d+$/.test(c)).length;
        // a table row is mostly numbers: MP W D L GF GA GD Pts
        if (cells.length >= 6 && nums >= 4) standingsLike++;
        // a fixture has a date in it
        if (parseDate(cells[0]) || /\b\d{1,2}[\/\-]\d{1,2}\b/.test(line) ||
            /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(line)) gameLike++;
    }
    if (standingsLike >= 2 && standingsLike >= gameLike) return 'standings';
    if (gameLike >= 1) return 'games';
    return null;
}

/* ---- league table ---- */

function parseStandings(text) {
    const rows = [];
    for (const line of splitRows(text)) {
        const cells = splitCells(line).filter(c => c !== '');
        if (cells.length < 5) continue;
        if (/^(pos|rank|#|club|team|pl|mp|gp)\b/i.test(cells[0]) && !/^\d+$/.test(cells[0])) continue; // header

        let rank = null, i = 0;
        if (/^\d+$/.test(cells[0])) { rank = +cells[0]; i = 1; }

        // the club name is the run of non-numeric cells
        const nameParts = [];
        while (i < cells.length && !/^-?\d+$/.test(cells[i])) nameParts.push(cells[i++]);
        const name = nameParts.join(' ').replace(/\s+/g, ' ').trim();
        const nums = cells.slice(i).filter(c => /^[+-]?\d+$/.test(c)).map(Number);
        if (!name || nums.length < 4) continue;

        // Usual orders: MP W D L GF GA GD PTS  ·  MP W D L GF GA PTS  ·  MP W L D ...
        let mp, w, d, l, gf, ga;
        if (nums.length >= 8)      [mp, w, d, l, gf, ga] = nums;
        else if (nums.length === 7) [mp, w, d, l, gf, ga] = nums;
        else if (nums.length === 6) [mp, w, d, l, gf, ga] = nums;
        else if (nums.length === 5) { [mp, w, d, l] = nums; gf = 0; ga = 0; }
        else continue;

        rows.push({
            accept: true, kind: 'standings',
            rank: rank ?? rows.length + 1,
            name, mp: n(mp), w: n(w), d: n(d), l: n(l), gf: n(gf), ga: n(ga),
            note: (n(w) + n(d) + n(l)) !== n(mp) ? 'W+D+L does not match games played' : '',
        });
    }
    return rows;
}
function n(v) { return Number.isFinite(v) ? v : 0; }

/* ---- fixtures and results ---- */

function parseGames(text, seasonEndYear) {
    const rows = [];
    for (const line of splitRows(text)) {
        if (/^(date|day|opponent|result)\b/i.test(line)) continue;
        const cells = splitCells(line);

        const date = parseDate(cells[0], seasonEndYear) || parseDate(line.slice(0, 24), seasonEndYear);
        if (!date) continue;

        // Peel the line apart in a fixed order, removing each piece as it is
        // taken. Order matters: the kickoff time has to go before the score,
        // or "6:30 PM" reads as a 6–30 scoreline, and the ground has to be
        // taken with its field number before stray "#" are cleaned up.
        let rest = cells.slice(1).join(' ') || line.replace(cells[0], '');

        const timeMatch = rest.match(/\b\d{1,2}:\d{2}\s*(?:[apAP]\.?[mM]?\.?)?/);
        const time = parseTime(timeMatch ? timeMatch[0] : '');
        if (timeMatch) rest = rest.replace(timeMatch[0], ' ');

        // grounds we know, taken whole so "UT Dallas #07" keeps its field
        // The trailing bit must look like a field id — a number, or a single
        // letter — or "ALC Field 3" gets read as the ground "ALC Fie".
        const locMatch = rest.match(
            /((?:UT\s*Dallas|UTD|Carpenter\s*Park|Railroad(?:\s*Park)?|Toyota(?:\s*Soccer)?(?:\s*Center)?|Fairview|Soccer\s*Spectrum|Spectrum|Craig\s*Ranch|Russell\s*Creek|ALC)(?:\s+Field)?\s*[-–·]?\s*#?\s*(?:\d{1,2}[AB]?|[A-M])?)(?=\s|$|[,·|])/i);
        let loc = '';
        if (locMatch) { loc = locMatch[1].replace(/\s{2,}/g, ' ').trim(); rest = rest.replace(locMatch[1], ' '); }

        // "3 - 1", "3-1", "W 3-1" — a colon is never a scoreline separator
        const sc = rest.match(/\b([WLDwld])?\s*(\d{1,2})\s*[-–]\s*(\d{1,2})\b/);
        let score = null;
        if (sc) {
            let us = +sc[2], them = +sc[3];
            // a W/L flag that disagrees with the numbers means it is listed opponent-first
            const flag = sc[1] && sc[1].toUpperCase();
            if (flag === 'W' && us < them) [us, them] = [them, us];
            if (flag === 'L' && us > them) [us, them] = [them, us];
            score = { us, them };
            rest = rest.replace(sc[0], ' ');
        }

        const rank = (rest.match(/#(\d{1,2})\b/) || [])[1];

        // whatever is left is the opponent. Note "H"/"A" are NOT stripped as
        // home/away markers — they are far more often a coach's initial,
        // as in "Sting Attack G13 H Pantoja".
        let opp = rest
            .replace(/#\d{1,2}\b/g, ' ')
            .replace(/\b(vs\.?|at|@|home|away)\b/gi, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim()
            .replace(/^[\-–·,]+|[\-–·,]+$/g, '')
            .trim();

        if (!opp) continue;
        rows.push({
            accept: true, kind: 'game',
            date, time, opponent: opp, oppRank: rank ? +rank : null,
            score, status: score ? 'played' : 'scheduled', locText: loc,
            note: '',
        });
    }
    return rows;
}

/* ---- staging ---- */

function runImport() {
    const text = $('importText').value;
    if (!text.trim()) { status('Paste something first, or choose a file.', 'error'); return; }

    const forced = $('importKind').value;
    const kind = forced === 'auto' ? detectKind(text) : forced;
    if (!kind) {
        IMPORT_ROWS = []; IMPORT_KIND = null;
        renderPanel();
        status("Could not tell what that is. Pick a type from the dropdown and try again.", 'error');
        return;
    }

    const seasonYear = seasonEndYear();
    IMPORT_KIND = kind;
    IMPORT_ROWS = kind === 'standings' ? parseStandings(text) : parseGames(text, seasonYear);

    // flag rows that already exist so nothing gets silently doubled up
    if (kind === 'games') {
        const have = new Set((team().games || []).map(g => g.date + '|' + norm(g.opponent)));
        IMPORT_ROWS.forEach(r => {
            if (have.has(r.date + '|' + norm(r.opponent))) { r.duplicate = true; r.accept = false; r.note = 'Already on the schedule'; }
        });
    } else {
        const have = new Set(((team().standings || {}).rows || []).map(r => norm(r.name)));
        IMPORT_ROWS.forEach(r => { if (have.has(norm(r.name))) r.note = r.note || 'Replaces the current row'; });
    }

    renderPanel();
    status(IMPORT_ROWS.length
        ? `Read ${IMPORT_ROWS.length} ${kind === 'standings' ? 'club' : 'game'} row${IMPORT_ROWS.length === 1 ? '' : 's'}. Check them, then add.`
        : 'Nothing usable in that paste — check the format and try again.',
        IMPORT_ROWS.length ? 'ok' : 'error');
}

function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

/* The year the current season ends in, so bare dates land correctly */
function seasonEndYear() {
    const y = (team().branding.season || '').match(/(20\d{2})/);
    if (y) return +y[1];
    const dates = (team().games || []).map(g => g.date).filter(Boolean).sort();
    if (dates.length) return +dates[dates.length - 1].slice(0, 4);
    return new Date().getFullYear();
}

function readImportFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { $('importText').value = reader.result; runImport(); };
    reader.readAsText(file);
}

function setImportRow(i, field, value) {
    const r = IMPORT_ROWS[i];
    if (field === 'accept') { r.accept = !!value; renderImportSummary(); return; }
    if (field === 'score') {
        const m = String(value).match(/(\d{1,2})\D+(\d{1,2})/);
        r.score = m ? { us: +m[1], them: +m[2] } : null;
        r.status = r.score ? 'played' : 'scheduled';
    } else if (['rank','mp','w','d','l','gf','ga','oppRank'].includes(field)) {
        r[field] = value === '' ? (field === 'oppRank' ? null : 0) : parseInt(value, 10);
    } else r[field] = value;
    markDirty();
}

function clearImport() { IMPORT_ROWS = []; IMPORT_KIND = null; $('importText') && ($('importText').value = ''); renderPanel(); }

/* ---- commit into the draft ---- */

function applyImport() {
    const rows = IMPORT_ROWS.filter(r => r.accept);
    if (!rows.length) { status('No rows ticked.', 'error'); return; }

    if (IMPORT_KIND === 'standings') {
        const st = team().standings || (team().standings = { rows: [], source: 'manual' });
        const byName = new Map((st.rows || []).map(r => [norm(r.name), r]));
        rows.forEach(r => {
            const existing = byName.get(norm(r.name));
            const rec = { rank: r.rank, name: r.name, mp: r.mp, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga };
            if (existing) Object.assign(existing, rec); else st.rows.push(rec);
        });
        st.rows.sort((a, b) => a.rank - b.rank);
        st.source = 'import';
        st.updatedAt = new Date().toISOString().slice(0, 10);
    } else {
        const games = team().games || (team().games = []);
        let seq = games.length;
        rows.forEach(r => {
            const g = {
                id: `${editTeamId}-i${String(++seq).padStart(2, '0')}`,
                date: r.date, opponent: r.opponent, status: r.status, competition: 'league',
            };
            if (r.time) g.time = r.time;
            if (r.oppRank != null) g.oppRank = r.oppRank;
            if (r.score) g.score = r.score;
            if (r.locText) {
                g.locText = r.locText;
                const v = detectVenue([{ locText: r.locText }]);
                if (v) { g.venueId = v.id; const f = resolveField(v, { locText: r.locText }); if (f) g.fieldId = f; }
            }
            games.push(g);
        });
        games.sort((a, b) => (a.date < b.date ? -1 : 1));
    }

    const n = rows.length;
    clearImport();
    markDirty();
    renderAll();
    status(`Added ${n} row${n === 1 ? '' : 's'} to the draft. Nothing is on the site until you publish.`, 'ok');
}
