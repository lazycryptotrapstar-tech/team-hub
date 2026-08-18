/* ============================================================
   TEAM HUB — FAMILY APP
   Four pillars-era tabs: Story · Standings · Schedule · Tournament
============================================================ */

let currentTeamId = null, TEAM_CONFIG = null;
let currentTab = 'schedule';
let standingsView = 'table';   // table | stats
let tournView = 'bracket';     // bracket | map
let tournMapDay = 'All';
let mapFieldGames = {};

/* ============================================================
   THEME + NAV
============================================================ */
function applyTheme() {
    document.documentElement.style.setProperty('--primary', TEAM_CONFIG.branding.primaryColor);
    document.documentElement.style.setProperty('--secondary', TEAM_CONFIG.branding.secondaryColor);
    document.title = TEAM_CONFIG.branding.name + ' – Team Hub';
}

function getTabs() {
    return [
        { id: 'schedule',   label: 'Schedule',   icon: '📅' },
        { id: 'standings',  label: 'Standings',  icon: '🏆' },
        { id: 'story',      label: 'Story',      icon: '📖' },
        { id: 'tournament', label: 'Tournament', icon: '🎯' },
    ];
}

function renderSeasonPulse() {
    const l = TEAM_CONFIG.league, r = TEAM_CONFIG.record, nm = TEAM_CONFIG.nextMatch;
    const streak = getStreak(TEAM_CONFIG.matches);
    const streakLabel = streak.count >= 2
        ? (streak.type==='W' ? '🔥' : streak.type==='L' ? '❄️' : '🛡️') + ' ' + streak.count + '-Match ' + (streak.type==='W' ? 'Win' : streak.type==='L' ? 'Losing' : 'Unbeaten') + ' Streak'
        : r.wins + '-' + r.losses + '-' + r.draws;
    const el = document.getElementById('seasonPulse');
    if (!el) return;
    const nextLabel = nm
        ? `${nm.date} · ${nm.time} · vs #${nm.oppRank} ${nm.oppName}`
        : 'Season complete';
    el.innerHTML = `
        <div class="pulse-item" style="flex:1;"><span class="pulse-icon">📍</span><span class="pulse-label">Rank&nbsp;</span><span class="pulse-val">#${l.rank || '—'}</span></div>
        <div class="pulse-item" style="flex:1;"><span class="pulse-icon">⭐</span><span class="pulse-label">Pts&nbsp;</span><span class="pulse-val">${l.points}</span></div>
        <div class="pulse-item" style="flex:2;"><span class="pulse-icon">🏃</span><span class="pulse-label">Form&nbsp;</span><span class="pulse-val white">${streakLabel}</span></div>
        <div class="pulse-item" style="flex:3;border-right:none;"><span class="pulse-icon">📅</span><span class="pulse-label">Next&nbsp;</span><span class="pulse-val silver">${nextLabel}</span></div>`;
}

function renderTeamSwitcher() {
    const c = document.getElementById('team-switcher');
    c.innerHTML = Object.keys(TEAMS).map(id =>
        `<button onclick="switchTeam('${id}')" class="team-switcher-btn ${id === currentTeamId ? 'active' : ''}">${TEAMS[id].branding.name}</button>`
    ).join('');
}

function renderNavBars() {
    const tabs = getTabs();
    document.getElementById('desktopTabNav').innerHTML = tabs.map(t =>
        `<button onclick="switchTab('${t.id}')" id="tab_${t.id}" class="tab-btn ${currentTab === t.id ? 'tab-active' : ''}">${t.label}</button>`
    ).join('');
    document.getElementById('bottomNavInner').innerHTML = tabs.map(t =>
        `<button onclick="switchTab('${t.id}')" id="bnav_${t.id}" class="bnav-btn ${currentTab === t.id ? 'active' : ''}"><span class="bnav-icon">${t.icon}</span>${t.label}</button>`
    ).join('');
}

function switchTeam(id) {
    tournView = 'bracket'; tournMapDay = 'All';
    currentTeamId = id; TEAM_CONFIG = TEAMS[id];
    applyTheme(); renderTeamSwitcher(); renderSeasonPulse(); renderNavBars(); render();
}

function switchTab(tab) {
    currentTab = tab;
    const card = document.getElementById('main-content');
    card.classList.add('switching');
    setTimeout(() => { render(); card.classList.remove('switching'); }, 120);
}

function headerHTML(subtitle, wm) {
    const r = TEAM_CONFIG.record;
    return `<div class="card-header" data-watermark="${wm || (r.wins + '-' + r.losses + '-' + r.draws)}">
        <div style="z-index:1;position:relative;">
            <div class="header-stars">★ ★ ★ ★ ★</div>
            <div class="header-team-name">${TEAM_CONFIG.branding.name}</div>
            <div class="header-subtitle">${subtitle}</div>
            <span class="header-badge">${TEAM_CONFIG.branding.season}</span>
        </div>
        <div class="header-right">
            <div class="header-division-label">League / Division</div>
            <div class="header-division">${TEAM_CONFIG.branding.league}</div>
            <div class="header-record">${r.wins} – ${r.losses} – ${r.draws}</div>
        </div>
    </div>`;
}

function footerHTML(label) {
    return `<div class="card-footer">
        <div><div class="footer-verify">${label}</div><div class="footer-date">Last Update: ${TEAM_CONFIG.lastUpdate}</div></div>
        <div><div class="footer-motto">${TEAM_CONFIG.branding.motto}</div><div class="footer-website">${TEAM_CONFIG.branding.website}</div></div>
    </div>`;
}

/* ============================================================
   STANDINGS TAB  (League Table / Team Stats)
============================================================ */
function switchStandingsView(v) {
    standingsView = v;
    renderStandingsTab(document.getElementById('main-content'));
}

function standingsSubnav() {
    return `<div class="stats-subnav">
        <button class="stats-subnav-btn ${standingsView==='table'?'active':''}" onclick="switchStandingsView('table')">🏆 League Table</button>
        <button class="stats-subnav-btn ${standingsView==='stats'?'active':''}" onclick="switchStandingsView('stats')">📊 Team Stats</button>
    </div>`;
}

function renderStandingsTab(container) {
    if (standingsView === 'stats') { renderStatsReport(container); return; }
    renderLeagueTable(container);
}

function renderLeagueTable(container) {
    const drawsOn = TEAM_CONFIG.pointsConfig.drawsAllowed !== false;
    const rows = TEAM_CONFIG.standings.map(t => {
        const gdNum = parseInt(t.gd, 10);
        const gdClass = gdNum > 0 ? 'gd-pos' : (gdNum < 0 ? 'gd-neg' : '');
        return `<tr class="${t.isOurs ? 'current-team' : ''}">
            <td class="st-rank">${t.rank}</td>
            <td class="st-name${t.isOurs ? ' st-name-us' : ''}">${t.name}</td>
            <td class="st-num">${t.mp}</td>
            <td class="st-num st-w">${t.w}</td>
            ${drawsOn ? `<td class="st-num st-d">${t.d}</td>` : ''}
            <td class="st-num st-l">${t.l}</td>
            <td class="st-num">${t.gf}</td>
            <td class="st-num">${t.ga}</td>
            <td class="st-num ${gdClass}">${t.gd}</td>
            <td class="st-pts">${t.pts}</td>
        </tr>`;
    }).join('');

    const emptyMsg = '<div style="text-align:center;padding:48px 24px;font-family:Nunito,sans-serif;color:rgba(0,35,75,0.60);font-size:14px;">No standings imported yet.</div>';

    container.innerHTML = `${headerHTML('Standings & Records', 'TABLE')}
    ${standingsSubnav()}
    <div class="content-area">
        <div class="st-card">
            <div class="st-card-header">
                <span class="st-card-title">League Table</span>
                <span class="st-card-sub">${TEAM_CONFIG.standings.length} Teams · ${TEAM_CONFIG.branding.league}</span>
            </div>
            ${TEAM_CONFIG.standings.length === 0 ? emptyMsg : `<div class="st-scroll">
                <table class="st-table">
                    <thead><tr>
                        <th class="st-th-rank">#</th>
                        <th class="st-th-name">Club</th>
                        <th title="Matches Played">MP</th>
                        <th title="Wins">W</th>
                        ${drawsOn ? '<th title="Draws">D</th>' : ''}
                        <th title="Losses">L</th>
                        <th title="Goals For">GF</th>
                        <th title="Goals Against">GA</th>
                        <th title="Goal Difference">GD</th>
                        <th title="Points">Pts</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`}
        </div>
    </div>${footerHTML('Standings & Records')}`;
}

function renderStatsReport(container) {
    const g = TEAM_CONFIG.goals;
    const totalGoals = g.for + g.against;
    const gfP = totalGoals ? ((g.for / totalGoals) * 100).toFixed(1) : 0;
    const gaP = totalGoals ? ((g.against / totalGoals) * 100).toFixed(1) : 0;
    const r = TEAM_CONFIG.record, l = TEAM_CONFIG.league, nm = TEAM_CONFIG.nextMatch;
    const terms = TEAM_CONFIG.branding.terms || {};
    const matchRows = TEAM_CONFIG.matches.map(m =>
        `<tr class="${m.highlight ? 'highlight-row' : ''}">
            <td class="date-cell">${m.date}</td>
            <td>${m.rank ? `<span class="opp-rank">#${m.rank}</span>` : ''}${m.opp}</td>
            <td class="score-cell center">${m.score}</td>
            <td class="center"><span class="res-badge res-${m.res}">${m.res}</span></td>
        </tr>`
    ).join('');

    const nextCard = nm ? `<div class="next-match-card">
        <div class="nm-top-row" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
            <div style="flex:1;"><div class="next-match-eyebrow">Next ${terms.match || 'Match'} Details</div><div class="next-match-opp">#${nm.oppRank} ${nm.oppName}</div><div class="next-match-meta">${nm.date} &nbsp;·&nbsp; ${nm.time}</div></div>
            <div style="text-align:right;flex-shrink:0;"><div class="opp-stats-label">Opp Rank</div><div class="opp-stats-rank">${nm.oppRank} <span style="font-size:13px;color:rgba(255,255,255,0.3);font-family:'Nunito', sans-serif;font-weight:600;">of ${nm.oppTotalTeams}</span></div>${nm.oppRecord ? `<div class="opp-stats-label" style="margin-top:4px;">Record: ${nm.oppRecord}</div>` : ''}</div>
        </div>
        ${nm.lastMatch ? `<div class="nm-last-row" style="background:rgba(255,255,255,0.05);border-radius:2px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px;border-top:1px solid rgba(255,255,255,0.07);padding-top:12px;">
            <span style="font-family:'Nunito', sans-serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.35);font-weight:700;white-space:nowrap;">Opp Last ${terms.match || 'Match'}</span>
            <span style="flex:1;color:rgba(255,255,255,0.65);font-size:12px;text-align:center;">${nm.lastMatch.date} &nbsp;<span style="color:rgba(255,255,255,0.35);">#${nm.lastMatch.rank}</span> ${nm.lastMatch.opp}</span>
            <span style="font-family:'Nunito', sans-serif;font-weight:700;font-size:14px;color:white;white-space:nowrap;">${nm.lastMatch.score}</span>
            <span class="res-badge res-${nm.lastMatch.res}" style="flex-shrink:0;">${nm.lastMatch.res}</span>
        </div>` : ''}
    </div>` : '';

    container.innerHTML = `${headerHTML('Standings & Records')}
    ${standingsSubnav()}
    <div class="content-area stats-grid" style="display:grid;grid-template-columns:1fr 2fr;gap:28px;">
        <div style="display:flex;flex-direction:column;gap:20px;">
            <div>
                <div class="section-title">Season Record <span>${r.wins}-${r.losses}-${r.draws}</span></div>
                <div class="record-grid">
                    <div class="record-card wins"><div class="record-label wins">Wins</div><div class="record-num wins">${r.wins}</div></div>
                    <div class="record-card losses"><div class="record-label losses">Losses</div><div class="record-num losses">${r.losses}</div></div>
                    <div class="record-card draws"><div class="record-label draws">Draws</div><div class="record-num draws">${r.draws}</div></div>
                </div>
            </div>
            <div>
                <div class="section-title">League Status</div>
                <div class="rank-strip">
                    <div><div class="rank-label">League Rank</div><div class="rank-num">${l.rank || '—'} <span class="rank-sub">of ${l.totalTeams}</span></div></div>
                    <div style="text-align:right;"><div class="rank-label">Points</div><div class="rank-num">${l.points}</div></div>
                </div>
                <div class="stat-item"><span class="stat-label">PPG</span><span class="stat-val gold">${l.ppg}</span></div>
                <div class="stat-item"><span class="stat-label">Goal Diff</span><span class="stat-val gold">${l.goalDiff}</span></div>
            </div>
            <div style="background:white;border-radius:3px;padding:16px;">
                <div class="section-title" style="margin-bottom:16px;">Scoring</div>
                <div class="progress-wrap">
                    <div class="progress-header"><span>${terms.goalsFor || 'Goals'} For</span><strong style="color:#15803d;font-size:14px;">${g.for}</strong></div>
                    <div class="progress-track"><div class="progress-fill" style="width:${gfP}%;background:#16a34a;"></div></div>
                </div>
                <div class="progress-wrap" style="margin-top:12px;">
                    <div class="progress-header"><span>${terms.goalsFor || 'Goals'} Against</span><strong style="color:#b91c1c;font-size:14px;">${g.against}</strong></div>
                    <div class="progress-track"><div class="progress-fill" style="width:${gaP}%;background:#3b82f6;"></div></div>
                </div>
            </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:20px;">
            <div>
                <div class="section-title">${terms.match || 'Match'} History</div>
                <div class="match-table-wrap"><table class="match-table"><thead><tr><th>Date</th><th>Opponent</th><th class="center">Score</th><th class="center">Res</th></tr></thead><tbody>${matchRows}</tbody></table></div>
            </div>
            ${nextCard}
        </div>
    </div>${footerHTML('Standings & Records')}`;
}

/* ============================================================
   STORY TAB  (AI storylines)
============================================================ */
function renderStory(container) {
    const l = TEAM_CONFIG.league;
    const avail = TEAM_CONFIG.remainingSchedule.length * TEAM_CONFIG.pointsConfig.win;
    const maxPts = l.points + avail;
    const momentum = computeMomentum(TEAM_CONFIG.matches);
    const played = TEAM_CONFIG.matches.length;
    const gpg  = played ? (TEAM_CONFIG.goals.for  / played).toFixed(2) : '0.00';
    const gapg = played ? (TEAM_CONFIG.goals.against / played).toFixed(2) : '0.00';
    const completedDots = TEAM_CONFIG.matches.map(m =>
        `<div class="tl-dot ${m.res}" title="${m.date} vs ${m.opp}: ${m.score}"></div>`
    ).join('');
    const futureDots = TEAM_CONFIG.remainingSchedule.map(m =>
        `<div class="tl-dot future" title="${m.date} vs ${m.opp}"></div>`
    ).join('');
    const narrative = getStoryText(TEAM_CONFIG);
    const isPublished = !storyAiText[currentTeamId] && TEAM_CONFIG.story && TEAM_CONFIG.story.text;

    container.innerHTML = `${headerHTML('Season Story', 'STORY')}
    <div class="content-area">
        <div class="story-grid">
            <div class="story-left-col">
                <div class="story-section-title">Season Timeline</div>
                <div class="story-timeline">${completedDots}${futureDots}</div>
                <div class="tl-legend">
                    <span><span class="tl-dot-pip" style="background:#16a34a;"></span>Win</span>
                    <span><span class="tl-dot-pip" style="background:#dc2626;"></span>Loss</span>
                    <span><span class="tl-dot-pip" style="background:#ca8a04;"></span>Draw</span>
                    <span><span class="tl-dot-pip" style="border:2px dashed rgba(0,35,75,0.2);"></span>Upcoming</span>
                </div>
                <div class="momentum-wrap">
                    <div class="momentum-header">
                        <span class="momentum-title">Momentum · Last 5</span>
                        <span class="momentum-label-val" style="color:${momentum.color};">${momentum.label}</span>
                    </div>
                    <div class="momentum-track">
                        <div class="momentum-fill" id="momentumFill" style="width:0%;background:${momentum.color};"></div>
                    </div>
                    <div class="momentum-sublabel">${momentum.sublabel} &nbsp;·&nbsp; ${momentum.score} / ${momentum.max} pts from last 5</div>
                </div>
                <div class="story-section-title">The Story So Far</div>
                <p class="story-narrative" id="storyNarrativeText">${narrative.replace(/\n\n/g, '</p><p class="story-narrative" style="margin-top:12px;">')}</p>
                <div style="margin-top:14px;">
                    <button class="ai-story-btn" id="aiStoryBtn" onclick="enhanceStoryWithAI()">&#10022; ${isPublished ? 'Rewrite with AI' : 'Enhance with AI'}</button>
                    <div class="story-ai-result" id="storyAiResult"></div>
                </div>
            </div>
            <div class="story-right-col">
                <div class="story-section-title">By The Numbers</div>
                <div class="story-stat-cards">
                    <div class="story-stat-card">
                        <div class="story-stat-card-val">${played}</div>
                        <div class="story-stat-card-lbl">Played</div>
                    </div>
                    <div class="story-stat-card gold">
                        <div class="story-stat-card-val">${gpg}</div>
                        <div class="story-stat-card-lbl">GF / Game</div>
                    </div>
                    <div class="story-stat-card">
                        <div class="story-stat-card-val">${gapg}</div>
                        <div class="story-stat-card-lbl">GA / Game</div>
                    </div>
                    <div class="story-stat-card gold">
                        <div class="story-stat-card-val">${l.ppg}</div>
                        <div class="story-stat-card-lbl">PPG</div>
                    </div>
                </div>
                <div class="story-section-title" style="margin-top:20px;">Path Forward</div>
                <div class="story-path-card pts-card">
                    <div class="story-path-label">Current Points</div>
                    <div class="story-path-val">${l.points}</div>
                </div>
                <div class="story-path-card avail-card">
                    <div>
                        <div class="story-path-label" style="color:#7c5900;">Points Available</div>
                        <div class="story-path-sub">${TEAM_CONFIG.remainingSchedule.length} game${TEAM_CONFIG.remainingSchedule.length!==1?'s':''} remaining</div>
                    </div>
                    <div class="story-path-val" style="color:#92400e;">+${avail}</div>
                </div>
                <div class="story-path-card max-card">
                    <div>
                        <div class="story-path-label" style="color:#166534;">Max Potential</div>
                        <div class="story-path-sub" style="color:#15803d;">Win all remaining</div>
                    </div>
                    <div class="story-path-val" style="color:#15803d;">${maxPts}</div>
                </div>
            </div>
        </div>
    </div>${footerHTML('Season Analysis & Projections') +
        '<div class="cross-tab-nudge">' +
        '<a class="cross-nudge-btn" onclick="switchTab(\'schedule\')">📅 View Schedule</a>' +
        '<a class="cross-nudge-btn" onclick="switchTab(\'standings\')">🏆 Standings</a>' +
        '</div>'}`;
    setTimeout(() => { const f = document.getElementById('momentumFill'); if (f) f.style.width = momentum.pct + '%'; }, 200);
}

/* ============================================================
   SCHEDULE TAB  (games + venue map)
============================================================ */
function renderSchedule(container) {
    var schedule = TEAM_CONFIG.remainingSchedule;
    var cardsHTML = schedule.length === 0
        ? '<div style="text-align:center;padding:48px 24px;font-family:Nunito,sans-serif;color:rgba(0,35,75,0.60);font-size:14px;">No remaining games — season complete.</div>'
        : schedule.map(function(m, i) {
            var isNext = i === 0;
            var dateParts = m.date.split(' ');
            return '<div class="sched-card' + (isNext ? ' sched-card-next' : '') + '">' +
                '<div class="sched-card-top">' +
                    '<div class="sched-card-date-block">' +
                        '<div class="sched-card-day">' + dateParts[0] + '</div>' +
                        '<div class="sched-card-dt">' + dateParts.slice(1).join(' ') + '</div>' +
                    '</div>' +
                    (isNext ? '<span class="sched-next-pill">Next Up</span>' : '') +
                '</div>' +
                '<div class="sched-card-opp">' +
                    (m.rank ? '<span class="sched-card-rank">#' + m.rank + '</span>' : '') +
                    '<span class="sched-card-opp-name">' + m.opp + '</span>' +
                '</div>' +
                '<div class="sched-card-meta">' +
                    '<div class="sched-meta-item"><span>&#128336;</span> ' + m.time + '</div>' +
                    (m.loc ? '<div class="sched-meta-item"><span>&#128205;</span> ' + m.loc + '</div>' : '') +
                '</div>' +
            '</div>';
        }).join('');

    // Build UTD field highlights from schedule locations
    var utdFields = {};
    schedule.forEach(function(m) {
        var num = null;
        if (m.game && m.game.venueId === 'utd' && m.game.fieldId) num = parseInt(m.game.fieldId, 10);
        else { var match = (m.loc||'').match(/UT\s*Dallas\s*#?(\d+)/i); if (match) num = parseInt(match[1], 10); }
        if (num) {
            if (!utdFields[num]) utdFields[num] = [];
            utdFields[num].push(m);
        }
    });

    container.innerHTML = headerHTML('Schedule', 'SCHED') +
        '<div class="content-area">' +
        '<div class="section-title" style="margin-bottom:16px;">Remaining Games <span>' + schedule.length + '</span></div>' +
        '<div class="sched-cards">' + cardsHTML + '</div>' +
        (Object.keys(utdFields).length ? buildUTDMap(utdFields) : '') +
        '</div>' + footerHTML('Official Schedule');
}

/* ============================================================
   TOURNAMENT TAB  (bracket + venue map)
============================================================ */
function renderTournament(container) {
    const td = TEAM_CONFIG.tournaments;
    if (!td) { container.innerHTML = headerHTML('Tournament','TOURN')+'<div class="content-area"><p style="color:rgba(0,35,75,0.65);font-family:Nunito,sans-serif;">No tournament data.</p></div>'+footerHTML('Tournament'); return; }
    if (tournView==='map') { renderTournMap(container, td); return; }
    renderTournBracket(container, td);
}

function tournSubnav() {
    return `<div class="stats-subnav">
        <button class="stats-subnav-btn ${tournView==='bracket'||tournView===''?'active':''}" onclick="switchTournView('bracket')">🏆 Bracket</button>
        <button class="stats-subnav-btn ${tournView==='map'?'active':''}" onclick="switchTournView('map')">🗺️ Venue Map</button>
    </div>`;
}

function switchTournView(v) { tournView = v; renderTournament(document.getElementById('main-content')); }

function renderTournBracket(container, td) {
    const hist = td.history || [];
    let tW=0, tL=0, tD=0;
    hist.forEach(t => { const p=(t.record||'').split('-'); tW+=parseInt(p[0])||0; tL+=parseInt(p[1])||0; tD+=parseInt(p[2])||0; });

    const histSummary = hist.length > 0
        ? `<span class="tourn-hist-summary">${hist.length} played &nbsp;&middot;&nbsp; ${tW}W ${tL}L ${tD}D</span>`
        : '';

    const histHTML = hist.length === 0
        ? '<div style="font-family:Nunito,sans-serif;font-size:13px;color:rgba(0,35,75,0.55);padding:16px;text-align:center;">No tournament history recorded yet.</div>'
        : hist.map(t => {
            const bc = (t.result.includes('Champion')||t.result.includes('🏆')) ? 'champ' : (t.result.includes('Runner')||t.result.includes('🥈')) ? 'runner' : 'other';
            return `<div class="tourn-hist-row">
                <div class="tourn-hist-left">
                    <div class="tourn-hist-name">${t.name}</div>
                    <div class="tourn-hist-meta">${t.date}${t.notes?' · '+t.notes:''}</div>
                </div>
                <div class="tourn-hist-right">
                    <span class="tourn-badge ${bc}">${t.result}</span>
                    <span class="tourn-hist-rec">${t.record}</span>
                </div>
            </div>`;
        }).join('');

    let currentHTML = '';
    const ct = td.current;
    if (ct) {
        const grp = ct.group;
        const groupCards = (grp.matches||[]).map(m => {
            const isOurs = m.home === grp.ourTeam || m.away === grp.ourTeam;
            const sc = m.score ? `<span class="tc-score">${m.score}</span>` : '';
            return `<div class="tc-card${isOurs ? ' tc-card-ours' : ''}">
                <div class="tc-card-top">
                    <div class="tc-date-block">
                        <div class="tc-day">${m.date.split(' ')[0]}</div>
                        <div class="tc-dt">${m.date.split(' ').slice(1).join(' ')}</div>
                    </div>
                    <div class="tc-time-field">
                        <div class="tc-time">&#128336; ${m.time}</div>
                        <div class="tc-field">&#128205; ${m.field}</div>
                    </div>
                    ${sc}
                </div>
                <div class="tc-matchup">
                    <span class="tc-team${m.home===grp.ourTeam?' tc-us':''}">${m.home}</span>
                    <span class="tc-vs">vs</span>
                    <span class="tc-team${m.away===grp.ourTeam?' tc-us':''}">${m.away}</span>
                </div>
            </div>`;
        }).join('');

        const br = ct.bracket;
        const bracketHTML = br ? `
            <div class="tc-knockout">
                <div class="tc-ko-col">
                    <div class="tc-ko-label">Semifinals &amp; Consolation</div>
                    ${br.semis.map(s => `
                    <div class="tc-ko-card${s.slot==='Consolation'?' tc-consolation':''}">
                        <div class="tc-ko-top">
                            <span class="tc-ko-slot">${s.slot}</span>
                            <span class="tc-ko-time">${s.time}</span>
                        </div>
                        ${s.field ? `<div class="tc-ko-field">&#128205; ${s.field}</div>` : ''}
                        <div class="tc-ko-matchup">
                            <div class="tc-ko-team">${s.teamA}</div>
                            <div class="tc-vs" style="margin:4px 0;font-size:9px;">vs</div>
                            <div class="tc-ko-team">${s.teamB}</div>
                        </div>
                        ${s.score ? `<div class="tc-ko-result">${s.score}</div>` : ''}
                    </div>`).join('')}
                </div>
                <div class="tc-ko-connector">
                    <svg viewBox="0 0 50 140" preserveAspectRatio="none">
                        <path d="M0,35 H25 V105 H0" fill="none" stroke="rgba(255,204,0,0.35)" stroke-width="2"/>
                        <path d="M25,70 H50" fill="none" stroke="rgba(255,204,0,0.35)" stroke-width="2"/>
                    </svg>
                </div>
                <div class="tc-ko-col">
                    <div class="tc-ko-label">Final</div>
                    <div class="tc-ko-card tc-final">
                        <div class="tc-ko-top">
                            <span class="tc-ko-slot">&#127942; Final</span>
                            <span class="tc-ko-time">${br.final.time}</span>
                        </div>
                        ${br.final.field ? `<div class="tc-ko-field">&#128205; ${br.final.field}</div>` : ''}
                        <div class="tc-ko-matchup">
                            <div class="tc-ko-team">${br.final.teamA}</div>
                            <div class="tc-vs" style="margin:4px 0;font-size:9px;">vs</div>
                            <div class="tc-ko-team">${br.final.teamB}</div>
                        </div>
                        ${br.final.score ? `<div class="tc-ko-result">${br.final.score}</div>` : ''}
                    </div>
                </div>
            </div>` : '';

        currentHTML = `
            <div class="tourn-section">
                <div class="tourn-section-header">
                    <div>
                        <div class="tourn-section-title">${ct.name}</div>
                        <div class="tourn-section-meta">${ct.dates} &nbsp;·&nbsp; ${ct.location}</div>
                    </div>
                    <span class="tourn-format-badge">${ct.format}</span>
                </div>
                <div class="tourn-sub-label">&#128205; ${grp.name} — Group Stage</div>
                <div class="tc-group">${groupCards}</div>
                <div class="tourn-sub-label" style="margin-top:24px;">&#127942; Knockout Bracket</div>
                ${bracketHTML}
            </div>`;
    }

    container.innerHTML = headerHTML('Tournament','TOURN') + tournSubnav() +
        '<div class="content-area">' +
        currentHTML +
        '<div class="tourn-hist-title-row">' +
            '<div class="tourn-sub-label" style="margin-top:24px;margin-bottom:0;">&#128203; Tournament History</div>' +
            histSummary +
        '</div>' +
        '<div class="tourn-hist-list" style="margin-top:12px;">' + histHTML + '</div>' +
        '</div>' +
        footerHTML('Tournament Record');
}

function renderTournMap(container, td) {
    const ct = td ? td.current : null;
    const isUTD = td && td.venueType === 'utd';
    if (isUTD) {
        var utdFields = {};
        (ct && ct.group && ct.group.matches || []).forEach(function(m) {
            var match = (m.field||'').match(/UT\s*Dallas\s*#?(\d+)/i);
            if (match) {
                var num = parseInt(match[1], 10);
                if (!utdFields[num]) utdFields[num] = [];
                utdFields[num].push({ date: m.date, time: m.time, opp: m.away === ct.group.ourTeam ? m.home : m.away, rank: '', loc: m.field });
            }
        });
        container.innerHTML = headerHTML('Tournament','TOURN') + tournSubnav() +
            '<div class="content-area">' +
            (ct ? '<div class="tourn-map-header"><div class="tourn-section-title" style="color:var(--primary);font-size:15px;">' + ct.name + '</div>' +
            '<div style="font-family:Nunito,sans-serif;font-size:12px;color:rgba(0,35,75,0.65);margin-bottom:10px;">' + ct.location + '</div></div>' : '') +
            '<div class="map-day-callout"><span class="map-day-callout-label">&#9733; Gold fields = your games</span><span class="map-day-callout-sub">All tournament fields shown</span></div>' +
            buildUTDMap(utdFields) +
            '</div>' + footerHTML('Venue Map');
        return;
    }
    const allGames = [];
    (ct&&ct.group&&ct.group.matches||[]).forEach(function(m){allGames.push({day:m.date,isOurs:m.home===ct.group.ourTeam||m.away===ct.group.ourTeam,field:m.field,date:m.date,time:m.time,home:m.home,away:m.away,score:m.score,label:(m.home===ct.group.ourTeam||m.away===ct.group.ourTeam)?'Our Match · Group Stage':'Group Stage'});});
    const brItems=[...((ct&&ct.bracket&&ct.bracket.semis)||[])];
    if(ct&&ct.bracket&&ct.bracket.final) brItems.push(ct.bracket.final);
    brItems.forEach(function(s){const parts=(s.time||'').split(' · ');allGames.push({day:parts[0],isOurs:false,field:s.field,date:parts[0],time:parts[1]||s.time,home:s.teamA,away:s.teamB,score:s.score,label:s.slot});});
    const seen={};const days=['All'];
    allGames.forEach(function(g){if(g.day&&!seen[g.day]){seen[g.day]=1;days.push(g.day);}});
    const activeDay=tournMapDay||'All';
    mapFieldGames={};
    const filtered=activeDay==='All'?allGames:allGames.filter(function(g){return g.day===activeDay;});
    filtered.forEach(function(g){const m=(g.field||'').match(/Carpenter Park\s*-?\s*([A-M])\b/i);if(!m)return;const letter=m[1].toUpperCase();if(!mapFieldGames[letter])mapFieldGames[letter]=[];mapFieldGames[letter].push(g);});
    const dayBtns=days.map(function(d){return '<button class="map-day-btn'+(d===activeDay?' active':'')+'" onclick="setMapDay(\''+d+'\')">'+d+'</button>';}).join('');
    container.innerHTML=`${headerHTML('Tournament','TOURN')}${tournSubnav()}<div class="content-area">${ct?`<div class="tourn-map-header"><div class="tourn-section-title" style="color:var(--primary);font-size:15px;">${ct.name}</div><div style="font-family:Nunito,sans-serif;font-size:12px;color:rgba(0,35,75,0.65);margin-bottom:10px;">${ct.location}</div></div>`:''}<div class="map-day-callout"><span class="map-day-callout-label">&#9733; Gold fields = your games</span><span class="map-day-callout-sub">Select a day to see only that day's fields</span></div><div class="map-day-bar">${dayBtns}</div><div class="venue-map-outer">${buildVenueMapSVG()}<div id="mapFieldInfo" class="vfi vfi-empty"><span>Tap any field to see${activeDay==='All'?' all':' '+activeDay} games</span></div></div></div>${footerHTML('Venue Map')}`;
}

function setMapDay(day){tournMapDay=day;renderTournament(document.getElementById('main-content'));}

/* ============================================================
   ROUTER + BOOT
============================================================ */
function render() {
    renderNavBars();
    const c = document.getElementById('main-content');
    if      (currentTab === 'story')       renderStory(c);
    else if (currentTab === 'standings')   renderStandingsTab(c);
    else if (currentTab === 'schedule')    renderSchedule(c);
    else if (currentTab === 'tournament')  renderTournament(c);
    else renderSchedule(c);
}

// Legacy keys from the pre-refocus app (RSVP, streaks, badges, acks)
function purgeLegacyStorage() {
    ['hub_rsvp', 'hub_checkin', 'hub_seen_badges'].forEach(k => localStorage.removeItem(k));
    Object.keys(localStorage).forEach(k => { if (k.indexOf('hub_ack_') === 0) localStorage.removeItem(k); });
}

function boot() {
    purgeLegacyStorage();
    loadHubData().then(() => {
        const ids = Object.keys(TEAMS);
        if (!ids.length) throw new Error('No teams in data/teams.json');
        currentTeamId = ids[0];
        TEAM_CONFIG = TEAMS[currentTeamId];
        applyTheme();
        renderTeamSwitcher();
        renderSeasonPulse();
        render();
    }).catch(err => {
        document.getElementById('main-content').innerHTML =
            '<div style="padding:40px;text-align:center;font-family:Nunito,sans-serif;color:#b91c1c;">' +
            '<strong>Could not load team data.</strong><br><span style="font-size:13px;color:rgba(0,35,75,0.6);">' +
            err.message + '</span><br><span style="font-size:12px;color:rgba(0,35,75,0.45);margin-top:8px;display:inline-block;">' +
            'If you opened this file directly, run a local server instead (npx serve).</span></div>';
        console.error(err);
    });
}

boot();
