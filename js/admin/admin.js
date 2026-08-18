/* ============================================================
   TEAM HUB ADMIN
   Edits data/teams.json in the browser and publishes it to the repo.
   Nothing here runs on the family site — admin.html is a separate
   page and is not linked from it.
============================================================ */

const DRAFT_KEY = 'hub_admin_draft';

let DRAFT = null;        // working copy of teams.json
let BASELINE = null;      // JSON string as loaded from the live site (conflict check)
let editTeamId = null;
let panel = 'games';
let dirty = false;
let statusTimer = null;

/* ---- helpers ---- */
const h = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const $ = id => document.getElementById(id);
const team = () => DRAFT.teams[editTeamId];

function serialize(data) { return JSON.stringify(data, null, 2) + '\n'; }

function status(msg, kind) {
    const el = $('statusBar');
    el.textContent = msg;
    el.className = 'status-bar ' + (kind || '');
    if (statusTimer) clearTimeout(statusTimer);
    if (kind !== 'error' && kind !== 'busy') {
        statusTimer = setTimeout(() => { el.textContent = ''; el.className = 'status-bar'; }, 6000);
    }
}

function markDirty() {
    dirty = true;
    DRAFT.updatedAt = new Date().toISOString().slice(0, 10);
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), data: DRAFT }));
    renderDirtyFlag();
    renderSummary();
}

function renderDirtyFlag() {
    const el = $('draftFlag');
    el.textContent = dirty ? '● Unpublished changes — saved in this browser' : 'No unpublished changes';
    el.className = 'draft-flag' + (dirty ? ' is-dirty' : '');
    $('publishBtn').disabled = !dirty;
}

/* ============================================================
   LOAD
============================================================ */
function boot() {
    Promise.all([
        fetch('data/teams.json', { cache: 'no-store' }).then(r => r.json()),
        loadVenues().catch(() => ({})),
    ]).then(([teams]) => {
        BASELINE = serialize(teams);
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) {
            try {
                const d = JSON.parse(saved);
                DRAFT = d.data;
                dirty = true;
                const when = new Date(d.savedAt).toLocaleString();
                status('Picked up where you left off — draft from ' + when + '. Discard it to start from what is live.', '');
            } catch (e) { DRAFT = teams; }
        } else {
            DRAFT = teams;
        }
        editTeamId = Object.keys(DRAFT.teams)[0];
        renderAll();
    }).catch(err => {
        document.querySelector('.admin-main').innerHTML =
            '<div class="empty-note"><strong>Could not load team data.</strong><br>' + h(err.message) +
            '<br><span class="hint">If you opened this file directly, serve it instead (npx serve).</span></div>';
    });
}

function discardDraft() {
    if (!confirm('Discard your unpublished changes and reload what is live?')) return;
    localStorage.removeItem(DRAFT_KEY);
    location.reload();
}

/* ============================================================
   CHROME
============================================================ */
function renderAll() {
    renderTeamPicker();
    renderPanelNav();
    renderDirtyFlag();
    renderSummary();
    renderPanel();
    renderTokenBanner();
}

function renderTeamPicker() {
    $('teamPicker').innerHTML = Object.keys(DRAFT.teams).map(id =>
        `<button class="team-btn ${id === editTeamId ? 'active' : ''}" onclick="pickTeam('${h(id)}')">${h(DRAFT.teams[id].branding.name)}</button>`
    ).join('') + `<button class="team-btn add" onclick="addTeam()">+ Team</button>`;
}

function pickTeam(id) { editTeamId = id; renderAll(); }

function renderPanelNav() {
    const panels = [
        { id: 'games', label: 'Games' },
        { id: 'standings', label: 'Standings' },
        { id: 'tournament', label: 'Tournament' },
        { id: 'info', label: 'Team Info' },
        { id: 'story', label: 'Storyline' },
    ];
    $('panelNav').innerHTML = panels.map(p =>
        `<button class="panel-btn ${p.id === panel ? 'active' : ''}" onclick="setPanel('${p.id}')">${p.label}</button>`
    ).join('');
}

function setPanel(p) { panel = p; renderPanelNav(); renderPanel(); }

/* Live derived numbers, so the effect of an edit is visible immediately */
function renderSummary() {
    if (!DRAFT || !team()) return;
    HUB_DATA = DRAFT;
    let d;
    try { d = deriveTeam(editTeamId, team()); }
    catch (e) { $('summaryStrip').innerHTML = '<span class="sum-warn">Cannot compute yet: ' + h(e.message) + '</span>'; return; }
    const nm = d.nextMatch;
    $('summaryStrip').innerHTML = [
        ['Record', d.record.wins + '-' + d.record.losses + '-' + d.record.draws],
        ['Points', d.league.points],
        ['Rank', d.league.rank ? '#' + d.league.rank + ' of ' + d.league.totalTeams : '—'],
        ['PPG', d.league.ppg],
        ['Goal Diff', d.league.goalDiff],
        ['Goals', d.goals.for + ' / ' + d.goals.against],
        ['Played', d.matches.length],
        ['Upcoming', d.remainingSchedule.length],
        ['Next', nm ? nm.date + ' vs ' + nm.oppName : '—'],
    ].map(([k, v]) => `<div class="sum-item"><span class="sum-k">${k}</span><span class="sum-v">${h(v)}</span></div>`).join('');
}

function renderPanel() {
    const el = $('panelBody');
    if (panel === 'games')       el.innerHTML = gamesPanel();
    else if (panel === 'standings')  el.innerHTML = standingsPanel();
    else if (panel === 'tournament') el.innerHTML = tournamentPanel();
    else if (panel === 'info')       el.innerHTML = infoPanel();
    else if (panel === 'story')      el.innerHTML = storyPanel();
}

/* ============================================================
   GAMES
============================================================ */
function venueOptions(selected) {
    const ids = Object.keys(VENUES || {});
    return '<option value="">— none —</option>' + ids.map(id =>
        `<option value="${h(id)}"${id === selected ? ' selected' : ''}>${h(VENUES[id].shortName || VENUES[id].name)}</option>`
    ).join('');
}
function fieldOptions(venueId, selected) {
    const v = VENUES && VENUES[venueId];
    if (!v) return '<option value="">—</option>';
    return '<option value="">— field —</option>' + v.fields.map(f =>
        `<option value="${h(f.id)}"${String(f.id) === String(selected) ? ' selected' : ''}>${h((v.fieldLabelPrefix || '') + (f.label || f.id))}</option>`
    ).join('');
}

function gamesPanel() {
    const games = team().games || [];
    const rows = games.map((g, i) => {
        const played = g.status === 'played';
        return `<tr>
            <td><input type="date" value="${h(g.date)}" onchange="setGame(${i},'date',this.value)"></td>
            <td><input type="time" value="${h(g.time || '')}" onchange="setGame(${i},'time',this.value)"></td>
            <td><input class="wide" type="text" value="${h(g.opponent)}" onchange="setGame(${i},'opponent',this.value)" placeholder="Opponent"></td>
            <td><input class="num" type="number" min="1" value="${g.oppRank != null ? g.oppRank : ''}" onchange="setGame(${i},'oppRank',this.value)"></td>
            <td>
                <select onchange="setGame(${i},'status',this.value)">
                    <option value="scheduled"${!played ? ' selected' : ''}>Scheduled</option>
                    <option value="played"${played ? ' selected' : ''}>Played</option>
                </select>
            </td>
            <td class="score-cell">
                <input class="num" type="number" min="0" ${played ? '' : 'disabled'} value="${played && g.score ? g.score.us : ''}" onchange="setScore(${i},'us',this.value)">
                <span class="dash">–</span>
                <input class="num" type="number" min="0" ${played ? '' : 'disabled'} value="${played && g.score ? g.score.them : ''}" onchange="setScore(${i},'them',this.value)">
            </td>
            <td><select onchange="setGame(${i},'venueId',this.value)">${venueOptions(g.venueId)}</select></td>
            <td><select onchange="setGame(${i},'fieldId',this.value)">${fieldOptions(g.venueId, g.fieldId)}</select></td>
            <td class="center"><input type="checkbox" ${g.highlight ? 'checked' : ''} onchange="setGame(${i},'highlight',this.checked)" title="Feature this game"></td>
            <td class="center"><button class="row-del" onclick="deleteGame(${i})" title="Delete game">✕</button></td>
        </tr>`;
    }).join('');

    return `<div class="panel-head">
        <div><h2>Games</h2><p class="panel-sub">Your record, goals, form, the season timeline and the story are all worked out from this list. Your position and points come from the league's own table — that's the <strong>Standings</strong> tab.</p></div>
        <button class="btn" onclick="addGame()">+ Add game</button>
    </div>
    ${games.length ? `<div class="table-wrap"><table class="grid">
        <thead><tr>
            <th>Date</th><th>Time</th><th>Opponent</th><th>Rank</th><th>Status</th>
            <th>Score (us–them)</th><th>Venue</th><th>Field</th><th title="Feature on the site">★</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table></div>` : '<div class="empty-note">No games yet. Add the first one.</div>'}
    <p class="hint">A game marked <strong>Played</strong> needs a score. Leave the venue blank if it is somewhere without a map — families still get the address and a directions link.</p>`;
}

function setGame(i, field, value) {
    const g = team().games[i];
    if (field === 'oppRank') g.oppRank = value === '' ? null : parseInt(value, 10);
    else if (field === 'highlight') { if (value) g.highlight = true; else delete g.highlight; }
    else if (field === 'status') {
        g.status = value;
        if (value === 'played' && !g.score) g.score = { us: 0, them: 0 };
        if (value === 'scheduled') delete g.score;
        renderPanel();
    }
    else if (field === 'venueId') {
        if (value) g.venueId = value; else { delete g.venueId; delete g.fieldId; }
        renderPanel();
    }
    else if (field === 'fieldId') { if (value) g.fieldId = value; else delete g.fieldId; }
    else if (value === '') delete g[field];
    else g[field] = value;
    markDirty();
}

function setScore(i, side, value) {
    const g = team().games[i];
    if (!g.score) g.score = { us: 0, them: 0 };
    g.score[side] = value === '' ? 0 : parseInt(value, 10);
    markDirty();
}

function addGame() {
    const games = team().games;
    let n = 1;
    const used = new Set(games.map(g => g.id));
    while (used.has(`${editTeamId}-g${String(n).padStart(2, '0')}`)) n++;
    games.push({
        id: `${editTeamId}-g${String(n).padStart(2, '0')}`,
        date: new Date().toISOString().slice(0, 10),
        time: '',
        opponent: '',
        status: 'scheduled',
        competition: 'league',
    });
    markDirty();
    renderPanel();
}

function deleteGame(i) {
    const g = team().games[i];
    if (!confirm(`Delete ${g.opponent || 'this game'}${g.date ? ' on ' + g.date : ''}?`)) return;
    team().games.splice(i, 1);
    markDirty();
    renderPanel();
}

/* ============================================================
   STANDINGS
============================================================ */
function standingsPanel() {
    const st = team().standings || (team().standings = { rows: [], source: 'manual' });
    const pc = team().pointsConfig || { win: 3, draw: 1, loss: 0 };
    const rows = (st.rows || []).map((r, i) => {
        const gd = (r.gf || 0) - (r.ga || 0);
        const pts = (r.w || 0) * pc.win + (r.d || 0) * pc.draw + (r.l || 0) * pc.loss;
        const isOurs = r.name === st.ourRowName;
        return `<tr class="${isOurs ? 'ours' : ''}">
            <td><input class="num" type="number" min="1" value="${r.rank}" onchange="setRow(${i},'rank',this.value)"></td>
            <td><input class="wide" type="text" value="${h(r.name)}" onchange="setRow(${i},'name',this.value)"></td>
            <td><input class="num" type="number" min="0" value="${r.mp}" onchange="setRow(${i},'mp',this.value)"></td>
            <td><input class="num" type="number" min="0" value="${r.w}" onchange="setRow(${i},'w',this.value)"></td>
            <td><input class="num" type="number" min="0" value="${r.d}" onchange="setRow(${i},'d',this.value)"></td>
            <td><input class="num" type="number" min="0" value="${r.l}" onchange="setRow(${i},'l',this.value)"></td>
            <td><input class="num" type="number" min="0" value="${r.gf}" onchange="setRow(${i},'gf',this.value)"></td>
            <td><input class="num" type="number" min="0" value="${r.ga}" onchange="setRow(${i},'ga',this.value)"></td>
            <td class="calc" id="gd-${i}">${gd > 0 ? '+' + gd : gd}</td>
            <td class="calc strong" id="pts-${i}">${pts}</td>
            <td class="center"><input type="radio" name="ourRow" ${isOurs ? 'checked' : ''} onchange="setOurRow(${i})" title="This is our team"></td>
            <td class="center"><button class="row-del" onclick="deleteRow(${i})">✕</button></td>
        </tr>`;
    }).join('');

    return `<div class="panel-head">
        <div><h2>League Table</h2><p class="panel-sub">Goal difference and points are worked out from wins, draws and losses — you never type them.</p></div>
        <button class="btn" onclick="addRow()">+ Add club</button>
    </div>
    ${(st.rows || []).length ? `<div class="table-wrap"><table class="grid">
        <thead><tr>
            <th>#</th><th>Club</th><th>MP</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th>
            <th class="calc-th">GD</th><th class="calc-th">Pts</th><th title="Which row is us">Us</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table></div>` : '<div class="empty-note">No league table yet. Add the clubs, or paste one in once import lands.</div>'}
    <p class="hint">Mark which row is your team with the <strong>Us</strong> button — that is what highlights it on the site and drives your rank and points.</p>`;
}

function setRow(i, field, value) {
    const r = team().standings.rows[i];
    if (field === 'name') {
        const wasOurs = team().standings.ourRowName === r.name;
        r.name = value;
        if (wasOurs) team().standings.ourRowName = value; // keep the "us" link when a club is renamed
    } else {
        r[field] = value === '' ? 0 : parseInt(value, 10);
    }
    const pc = team().pointsConfig;
    const gd = (r.gf || 0) - (r.ga || 0);
    const gdEl = $('gd-' + i), ptsEl = $('pts-' + i);
    if (gdEl) gdEl.textContent = gd > 0 ? '+' + gd : gd;
    if (ptsEl) ptsEl.textContent = (r.w || 0) * pc.win + (r.d || 0) * pc.draw + (r.l || 0) * pc.loss;
    markDirty();
}

function setOurRow(i) {
    team().standings.ourRowName = team().standings.rows[i].name;
    markDirty();
    renderPanel();
}

function addRow() {
    const rows = team().standings.rows;
    rows.push({ rank: rows.length + 1, name: '', mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 });
    markDirty();
    renderPanel();
}

function deleteRow(i) {
    const r = team().standings.rows[i];
    if (!confirm(`Remove ${r.name || 'this club'} from the table?`)) return;
    team().standings.rows.splice(i, 1);
    markDirty();
    renderPanel();
}

/* ============================================================
   TOURNAMENT
============================================================ */
function tournamentPanel() {
    const t = team().tournaments || (team().tournaments = { history: [], current: null });
    const ct = t.current;
    const hist = t.history || [];

    const currentHTML = ct ? `
        <div class="field-grid">
            ${textField('Name', ct.name, "setTourn('name',this.value)")}
            ${textField('Dates', ct.dates, "setTourn('dates',this.value)")}
            ${textField('Location', ct.location, "setTourn('location',this.value)")}
            ${textField('Format', ct.format, "setTourn('format',this.value)")}
            ${textField('Our team name (as the bracket spells it)', ct.group ? ct.group.ourTeam : '', "setTourn('ourTeam',this.value)")}
        </div>
        <h3 class="sub-h">Group matches</h3>
        ${(ct.group && ct.group.matches || []).length ? `<div class="table-wrap"><table class="grid">
            <thead><tr><th>Day</th><th>Time</th><th>Home</th><th>Away</th><th>Score</th><th>Field / location</th><th></th></tr></thead>
            <tbody>${(ct.group.matches).map((m, i) => `<tr>
                <td><input type="text" value="${h(m.date)}" onchange="setTMatch(${i},'date',this.value)" placeholder="Sat Apr 11"></td>
                <td><input type="text" value="${h(m.time)}" onchange="setTMatch(${i},'time',this.value)" placeholder="9:30 AM"></td>
                <td><input class="wide" type="text" value="${h(m.home)}" onchange="setTMatch(${i},'home',this.value)"></td>
                <td><input class="wide" type="text" value="${h(m.away)}" onchange="setTMatch(${i},'away',this.value)"></td>
                <td><input class="num2" type="text" value="${h(m.score || '')}" onchange="setTMatch(${i},'score',this.value)" placeholder="2 - 1"></td>
                <td><input class="wide" type="text" value="${h(m.field || '')}" onchange="setTMatch(${i},'field',this.value)" placeholder="Carpenter Park D · #209"></td>
                <td class="center"><button class="row-del" onclick="deleteTMatch(${i})">✕</button></td>
            </tr>`).join('')}</tbody>
        </table></div>` : '<div class="empty-note">No group matches yet.</div>'}
        <button class="btn small" onclick="addTMatch()">+ Add match</button>
        <p class="hint">The field text is what lights up the venue map — write it the way the tournament does (for example “Carpenter Park D · #209”).</p>
    ` : `<div class="empty-note">No tournament running.<br><button class="btn" onclick="addTournament()">+ Add a tournament</button></div>`;

    return `<div class="panel-head"><div><h2>Tournament</h2><p class="panel-sub">The bracket families see, and the record book underneath it.</p></div>
        ${ct ? '<button class="btn danger-ghost" onclick="removeTournament()">Remove current</button>' : ''}</div>
    ${currentHTML}
    <h3 class="sub-h">Tournament history</h3>
    ${hist.length ? `<div class="table-wrap"><table class="grid">
        <thead><tr><th>Name</th><th>When</th><th>Result</th><th>Record (W-L-D)</th><th>Notes</th><th></th></tr></thead>
        <tbody>${hist.map((h, i) => `<tr>
            <td><input class="wide" type="text" value="${h(h.name)}" onchange="setHist(${i},'name',this.value)"></td>
            <td><input type="text" value="${h(h.date)}" onchange="setHist(${i},'date',this.value)" placeholder="Feb 2026"></td>
            <td><input type="text" value="${h(h.result)}" onchange="setHist(${i},'result',this.value)" placeholder="Champion 🏆"></td>
            <td><input class="num2" type="text" value="${h(h.record)}" onchange="setHist(${i},'record',this.value)" placeholder="2-1-0"></td>
            <td><input class="wide" type="text" value="${h(h.notes || '')}" onchange="setHist(${i},'notes',this.value)"></td>
            <td class="center"><button class="row-del" onclick="deleteHist(${i})">✕</button></td>
        </tr>`).join('')}</tbody>
    </table></div>` : '<div class="empty-note">No tournament history yet.</div>'}
    <button class="btn small" onclick="addHist()">+ Add past tournament</button>`;
}

function setTourn(field, value) {
    const ct = team().tournaments.current;
    if (field === 'ourTeam') { ct.group = ct.group || { matches: [] }; ct.group.ourTeam = value; }
    else ct[field] = value;
    markDirty();
}
function setTMatch(i, field, value) {
    const m = team().tournaments.current.group.matches[i];
    if (value === '' && (field === 'score' || field === 'field')) m[field] = field === 'score' ? null : '';
    else m[field] = value;
    markDirty();
}
function addTMatch() {
    const ct = team().tournaments.current;
    ct.group = ct.group || { name: 'Group', ourTeam: '', matches: [] };
    ct.group.matches = ct.group.matches || [];
    ct.group.matches.push({ date: '', time: '', home: '', away: '', score: null, field: '' });
    markDirty(); renderPanel();
}
function deleteTMatch(i) {
    team().tournaments.current.group.matches.splice(i, 1);
    markDirty(); renderPanel();
}
function addTournament() {
    team().tournaments.current = {
        name: '', dates: '', location: '', format: '', bracketSet: false,
        group: { name: 'Group A', ourTeam: team().branding.name, teams: [], matches: [] },
    };
    markDirty(); renderPanel();
}
function removeTournament() {
    if (!confirm('Remove the current tournament from the site?')) return;
    team().tournaments.current = null;
    markDirty(); renderPanel();
}
function setHist(i, field, value) { team().tournaments.history[i][field] = value; markDirty(); }
function addHist() {
    team().tournaments.history = team().tournaments.history || [];
    team().tournaments.history.push({ name: '', date: '', result: '', record: '0-0-0', notes: '' });
    markDirty(); renderPanel();
}
function deleteHist(i) { team().tournaments.history.splice(i, 1); markDirty(); renderPanel(); }

/* ============================================================
   TEAM INFO
============================================================ */
function textField(label, value, handler, type) {
    return `<label class="field"><span>${h(label)}</span>
        <input type="${type || 'text'}" value="${h(value == null ? '' : value)}" onchange="${handler}"></label>`;
}

function infoPanel() {
    const b = team().branding;
    const pc = team().pointsConfig || (team().pointsConfig = { win: 3, draw: 1, loss: 0, drawsAllowed: true });
    const terms = b.terms || (b.terms = {});
    return `<div class="panel-head"><div><h2>Team Info</h2><p class="panel-sub">Name, colours and how the sport counts points.</p></div></div>
    <div class="field-grid">
        ${textField('Team name', b.name, "setBrand('name',this.value)")}
        ${textField('League / division', b.league, "setBrand('league',this.value)")}
        ${textField('Season', b.season, "setBrand('season',this.value)")}
        ${textField('Motto', b.motto, "setBrand('motto',this.value)")}
        ${textField('Website', b.website, "setBrand('website',this.value)")}
        ${textField('Sport', b.sport, "setBrand('sport',this.value)")}
        ${textField('Primary colour', b.primaryColor, "setBrand('primaryColor',this.value)", 'color')}
        ${textField('Accent colour', b.secondaryColor, "setBrand('secondaryColor',this.value)", 'color')}
        ${textField('Last updated (shown in the footer)', team().lastUpdate, "setTeamField('lastUpdate',this.value)")}
    </div>
    <h3 class="sub-h">Scoring</h3>
    <div class="field-grid">
        ${textField('Points for a win', pc.win, "setPoints('win',this.value)", 'number')}
        ${textField('Points for a draw', pc.draw, "setPoints('draw',this.value)", 'number')}
        ${textField('Points for a loss', pc.loss, "setPoints('loss',this.value)", 'number')}
        <label class="field checkbox"><span>Draws possible in this sport</span>
            <input type="checkbox" ${pc.drawsAllowed !== false ? 'checked' : ''} onchange="setPoints('drawsAllowed',this.checked)"></label>
    </div>
    <h3 class="sub-h">Wording</h3>
    <div class="field-grid">
        ${textField('Word for a game', terms.match || 'Match', "setTerm('match',this.value)")}
        ${textField('Word for scoring', terms.goalsFor || 'Goals', "setTerm('goalsFor',this.value)")}
        ${textField('Word for conceding', terms.goalsAgainst || 'GA', "setTerm('goalsAgainst',this.value)")}
    </div>
    <p class="hint">Turning off draws hides the D column in the league table — for sports where every game has a winner.</p>`;
}

function setBrand(field, value) { team().branding[field] = value; markDirty(); renderTeamPicker(); }
function setTeamField(field, value) { team()[field] = value; markDirty(); }
function setTerm(field, value) { team().branding.terms[field] = value; markDirty(); }
function setPoints(field, value) {
    team().pointsConfig[field] = field === 'drawsAllowed' ? !!value : parseInt(value, 10) || 0;
    markDirty(); renderSummary();
}

/* ============================================================
   STORYLINE
============================================================ */
function storyPanel() {
    const s = team().story;
    const when = s && s.generatedAt ? ' on ' + h(s.generatedAt) : '';
    const sourceLabel = !s ? 'Nothing saved — families see the automatic write-up'
        : s.source === 'ai' ? 'Written by AI' + when
        : s.source === 'template' ? 'Built from the results' + when
        : 'Written by hand' + when;
    return `<div class="panel-head">
        <div><h2>Season Storyline</h2><p class="panel-sub">What families read on the Story tab. Leave it empty and the site writes its own from the results.</p></div>
    </div>
    <div class="story-meta">${sourceLabel}</div>
    <textarea id="storyText" class="story-area" rows="14" placeholder="Write the season story, or generate one below…"
        onchange="setStory(this.value)">${h(s ? s.text : '')}</textarea>
    <div class="story-actions">
        <button class="btn" onclick="generateStory()">Write from the results</button>
        <button class="btn ai" id="aiBtn" onclick="aiStory()">✦ Write with AI</button>
        <button class="btn ghost" onclick="clearStory()">Clear</button>
        <button class="btn ghost" onclick="previewStory()">Preview what families see</button>
    </div>
    <div id="storyErr" class="story-err"></div>
    <div id="storyPreview" class="story-preview"></div>
    <p class="hint">“Write from the results” builds a recap from this team's own record with no internet needed. “Write with AI” sends only the season stats — record, rank, goals, next opponent — to the hub's AI service.</p>`;
}

function derivedTeam() { HUB_DATA = DRAFT; return deriveTeam(editTeamId, team()); }

/* Typing in the box makes it a hand-written story — generate/AI set their
   own source before re-rendering, so this only fires on real edits. */
function setStory(text) {
    const t = (text || '').trim();
    team().story = t ? { text: t, source: 'manual', generatedAt: new Date().toISOString().slice(0, 10) } : null;
    markDirty();
    renderPanel();
}

function generateStory() {
    const text = generateAutoNarrative(derivedTeam());
    $('storyText').value = text;
    team().story = { text: text, source: 'template', generatedAt: new Date().toISOString().slice(0, 10) };
    markDirty();
    renderPanel();
    status('Wrote a story from this season\'s results.', 'ok');
}

function aiStory() {
    const btn = $('aiBtn'), errBox = $('storyErr');
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span> Writing…';
    errBox.textContent = '';
    const { system, prompt } = buildStoryPrompt(derivedTeam());
    callAI(system, prompt).then(text => {
        $('storyText').value = text;
        team().story = { text: text, source: 'ai', generatedAt: new Date().toISOString().slice(0, 10) };
        markDirty();
        renderPanel();
        status('AI wrote a new story. Publish to put it on the site.', 'ok');
    }).catch(err => {
        errBox.innerHTML = 'AI could not write this one: ' + h(err.message) +
            '<br><span class="hint">The automatic write-up still works — use “Write from the results”.</span>';
        btn.disabled = false;
        btn.innerHTML = '✦ Write with AI';
    });
}

function clearStory() {
    if (!confirm('Clear the storyline? Families will see the automatic write-up instead.')) return;
    team().story = null;
    markDirty();
    renderPanel();
}

function previewStory() {
    const d = derivedTeam();
    const text = getStoryText(d);
    $('storyPreview').innerHTML = '<div class="preview-label">What families see</div>' +
        text.split('\n\n').map(p => `<p>${h(p)}</p>`).join('');
}

/* ============================================================
   TEAMS
============================================================ */
function addTeam() {
    const id = (prompt('Short id for the new team (letters and numbers, e.g. u15):') || '').trim().toLowerCase();
    if (!id) return;
    if (!/^[a-z0-9-]+$/.test(id)) { alert('Use only letters, numbers and dashes.'); return; }
    if (DRAFT.teams[id]) { alert('That id is already used.'); return; }
    DRAFT.teams[id] = {
        branding: {
            name: id.toUpperCase(), league: '', season: '', motto: '', website: '',
            primaryColor: '#00234b', secondaryColor: '#ffcc00', sport: 'Soccer',
            terms: { match: 'Match', goalsFor: 'Goals', goalsAgainst: 'GA' },
        },
        pointsConfig: { win: 3, draw: 1, loss: 0, drawsAllowed: true },
        lastUpdate: new Date().toISOString().slice(0, 10),
        games: [],
        standings: { updatedAt: '', source: 'manual', ourRowName: '', rows: [] },
        leagueSource: { provider: null, url: null },
        tournaments: { history: [], current: null },
        story: null,
    };
    editTeamId = id;
    markDirty();
    renderAll();
}

/* ============================================================
   VALIDATION
============================================================ */
function validate() {
    const problems = [];
    Object.keys(DRAFT.teams).forEach(id => {
        const t = DRAFT.teams[id];
        const who = t.branding.name || id;
        if (!t.branding.name) problems.push({ level: 'error', msg: `Team "${id}" has no name.` });

        const ids = new Set();
        (t.games || []).forEach((g, i) => {
            const where = `${who} · game ${i + 1}`;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(g.date || '')) problems.push({ level: 'error', msg: `${where}: needs a date.` });
            if (!g.opponent) problems.push({ level: 'error', msg: `${where}: needs an opponent.` });
            if (g.status === 'played') {
                if (!g.score || g.score.us == null || g.score.them == null || isNaN(g.score.us) || isNaN(g.score.them))
                    problems.push({ level: 'error', msg: `${where}: marked played but has no score.` });
            }
            if (g.time && !/^\d{2}:\d{2}$/.test(g.time)) problems.push({ level: 'error', msg: `${where}: time looks wrong.` });
            if (g.id) { if (ids.has(g.id)) problems.push({ level: 'error', msg: `${where}: duplicate game id ${g.id}.` }); ids.add(g.id); }
            if (g.fieldId && !g.venueId) problems.push({ level: 'warn', msg: `${where}: has a field but no venue.` });
        });

        const rows = (t.standings && t.standings.rows) || [];
        const ranks = new Set(), names = new Set();
        rows.forEach((r, i) => {
            const where = `${who} · table row ${i + 1}`;
            if (!r.name) problems.push({ level: 'error', msg: `${where}: club has no name.` });
            if (ranks.has(r.rank)) problems.push({ level: 'warn', msg: `${where}: two clubs share position ${r.rank}.` });
            ranks.add(r.rank);
            if (names.has(r.name)) problems.push({ level: 'warn', msg: `${where}: "${r.name}" appears twice.` });
            names.add(r.name);
            const played = (r.w || 0) + (r.d || 0) + (r.l || 0);
            if (r.mp != null && played !== r.mp)
                problems.push({ level: 'warn', msg: `${where}: ${r.name} shows ${r.mp} played but W+D+L is ${played}.` });
        });
        if (rows.length && !t.standings.ourRowName)
            problems.push({ level: 'warn', msg: `${who}: no row marked as your team, so it will not highlight.` });
        else if (rows.length && !rows.some(r => r.name === t.standings.ourRowName))
            problems.push({ level: 'error', msg: `${who}: the row marked as your team ("${t.standings.ourRowName}") is not in the table.` });
    });
    return problems;
}

function renderProblems(problems) {
    const box = $('problems');
    if (!problems.length) { box.innerHTML = ''; box.className = 'problems'; return true; }
    const errs = problems.filter(p => p.level === 'error');
    box.className = 'problems open';
    box.innerHTML = `<div class="problems-head">${errs.length ? `${errs.length} thing${errs.length > 1 ? 's' : ''} to fix first` : 'Worth a look'}</div>` +
        problems.map(p => `<div class="problem ${p.level}">${p.level === 'error' ? '✕' : '!'} ${h(p.msg)}</div>`).join('');
    return errs.length === 0;
}

/* ============================================================
   PUBLISH
============================================================ */
function openSetup() { $('setupModal').classList.add('open'); renderSetup(); }
function closeSetup() { $('setupModal').classList.remove('open'); renderTokenBanner(); }

function renderSetup() {
    const c = getRepoConfig();
    $('cfgOwner').value = c.owner;
    $('cfgRepo').value = c.repo;
    $('cfgBranch').value = c.branch;
    $('cfgToken').value = hasToken() ? '••••••••••••••••••••' : '';
    $('setupResult').textContent = '';
}

function saveSetup() {
    setRepoConfig({
        owner: $('cfgOwner').value.trim(),
        repo: $('cfgRepo').value.trim(),
        branch: $('cfgBranch').value.trim() || 'main',
    });
    const t = $('cfgToken').value.trim();
    if (t && !/^•+$/.test(t)) setToken(t);
    $('setupResult').textContent = 'Checking…';
    verifyAccess().then(info => {
        $('setupResult').className = 'setup-result ok';
        $('setupResult').innerHTML = `Connected to <strong>${h(info.repo)}</strong>.` +
            (info.canWrite ? ' This token can publish.' : ' <strong>But it cannot write</strong> — give it Contents: Read and write.');
        renderTokenBanner();
    }).catch(err => {
        $('setupResult').className = 'setup-result err';
        $('setupResult').textContent = err.message;
    });
}

function forgetToken() {
    if (!confirm('Remove the saved token from this browser?')) return;
    clearToken();
    renderSetup();
    renderTokenBanner();
}

function renderTokenBanner() {
    const c = getRepoConfig();
    $('repoLabel').textContent = `${c.owner}/${c.repo} · ${c.branch}`;
    const b = $('tokenBanner');
    if (hasToken()) { b.style.display = 'none'; }
    else {
        b.style.display = '';
        b.innerHTML = 'No access token saved, so publishing is off. <button class="link" onclick="openSetup()">Set it up</button> — or use <button class="link" onclick="exportJSON()">Download the file</button> and commit it yourself.';
    }
}

function exportJSON() {
    downloadFile('teams.json', serialize(DRAFT));
    status('Downloaded teams.json — drop it into data/ in the repo and commit.', 'ok');
}

async function publish() {
    const problems = validate();
    if (!renderProblems(problems)) { status('Fix the errors above, then publish.', 'error'); return; }

    const content = serialize(DRAFT);
    if (content === BASELINE) { status('Nothing to publish — this matches what is live.', ''); return; }

    const teamNames = Object.keys(DRAFT.teams).map(id => DRAFT.teams[id].branding.name).join(', ');
    const message = prompt('Describe this update (goes in the commit):', `Update team data — ${teamNames}`);
    if (message === null) return;

    $('publishBtn').disabled = true;
    status('Publishing…', 'busy');
    try {
        const res = await publishFile('data/teams.json', content, message || 'Update team data', { baseContent: BASELINE });
        if (res.unchanged) { status('GitHub already has exactly this. Nothing to do.', 'ok'); }
        else {
            BASELINE = content;
            dirty = false;
            localStorage.removeItem(DRAFT_KEY);
            status('Published. The site rebuilds in about a minute — refresh it then.', 'ok');
        }
        renderDirtyFlag();
    } catch (err) {
        if (err.code === 'CONFLICT') {
            const overwrite = confirm(
                'Someone else changed this file on GitHub since you loaded it.\n\n' +
                'OK = publish yours anyway (their change is replaced, but stays in the repo history)\n' +
                'Cancel = leave it alone so you can reload and redo your edits'
            );
            if (overwrite) {
                try {
                    await publishFile('data/teams.json', content, message || 'Update team data', { force: true });
                    BASELINE = content; dirty = false;
                    localStorage.removeItem(DRAFT_KEY);
                    status('Published, replacing the newer version on GitHub.', 'ok');
                    renderDirtyFlag();
                } catch (e2) { status(e2.message, 'error'); }
            } else {
                status('Left GitHub alone. Reload the page to pick up their version.', '');
            }
        } else {
            status(err.message, 'error');
        }
    } finally {
        $('publishBtn').disabled = !dirty;
    }
}

boot();
