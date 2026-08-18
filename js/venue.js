/* ============================================================
   VENUE ENGINE
   One renderer for every venue. Venues are data (data/venues.json):
   canvas, zones (roads/parking/areas/landmarks), fields, markers.
   Adding a venue means adding data — never code.
============================================================ */

let VENUES = {};          // id -> venue definition
let venueFieldGames = {}; // fieldId -> [games] for the venue currently on screen
let activeVenueId = null;

/* Field state colors — shared vocabulary across all venues */
const FIELD_STATES = {
    ours:     { fill:'#ffcc00', stroke:'#00234b',              sw:2.5, text:'#00234b',            sub:'rgba(0,35,75,0.6)',        badge:'★' },
    final:    { fill:'#1a3a6b', stroke:'#93c5fd',              sw:2,   text:'#bfdbfe',            sub:'rgba(191,219,254,0.6)',    badge:'F' },
    semi:     { fill:'#1a3a6b', stroke:'#93c5fd',              sw:1.8, text:'#bfdbfe',            sub:'rgba(191,219,254,0.7)',    badge:'' },
    active:   { fill:'#1a5c30', stroke:'rgba(255,255,255,0.45)', sw:1.2, text:'rgba(255,255,255,0.85)', sub:'rgba(255,255,255,0.45)', badge:'' },
    inactive: { fill:'#1a5c30', stroke:'rgba(255,255,255,0.3)', sw:0.8, text:'rgba(255,255,255,0.8)',  sub:'rgba(255,255,255,0.35)', badge:'' },
    empty:    { fill:'#1a3d24', stroke:'rgba(255,255,255,0.1)', sw:0.8, text:'rgba(255,255,255,0.2)',  sub:'rgba(255,255,255,0.1)',  badge:'' },
};

function loadVenues() {
    return fetch('data/venues.json', { cache: 'no-store' })
        .then(r => { if (!r.ok) throw new Error('venues.json ' + r.status); return r.json(); })
        .then(json => {
            VENUES = {};
            (json.venues || []).forEach(v => { VENUES[v.id] = v; });
            return VENUES;
        });
}

function getVenue(id) { return VENUES[id] || null; }

/* Resolve which field a game sits on: structured ref wins, then the
   venue's own location patterns against free text. */
function resolveField(venue, game) {
    if (!venue) return null;
    if (game.venueId === venue.id && game.fieldId) return String(game.fieldId);
    const text = game.locText || game.loc || game.field || '';
    for (const pat of (venue.locationPatterns || [])) {
        const m = text.match(new RegExp(pat, 'i'));
        if (m && m[1]) {
            const raw = m[1].toUpperCase();
            // normalize numeric ids ("07" -> "7")
            return /^\d+$/.test(raw) ? String(parseInt(raw, 10)) : raw;
        }
    }
    for (const f of (venue.fields || [])) {
        if ((f.aliases || []).some(a => text.toLowerCase().includes(a.toLowerCase()))) return f.id;
    }
    return null;
}

/* Find the venue a set of games belongs to (first one that matches). */
function detectVenue(games, preferredId) {
    if (preferredId && VENUES[preferredId]) return VENUES[preferredId];
    for (const v of Object.values(VENUES)) {
        if (games.some(g => resolveField(v, g))) return v;
    }
    return null;
}

/* Group games by field for a venue. */
function groupGamesByField(venue, games) {
    const byField = {};
    games.forEach(g => {
        const fid = resolveField(venue, g);
        if (!fid) return;
        if (!byField[fid]) byField[fid] = [];
        byField[fid].push(g);
    });
    return byField;
}

/* emptyState lets a venue choose how "no games here" reads: a season
   schedule shows the whole complex normally ('inactive'), a tournament
   map dims unused fields ('empty') so the active ones pop. */
function fieldState(games, emptyState) {
    if (!games || !games.length) return emptyState || 'inactive';
    if (games.some(g => g.isOurs)) return 'ours';
    if (games.some(g => g.label === 'Final')) return 'final';
    if (games.some(g => g.label && g.label.indexOf('Semi') >= 0)) return 'semi';
    return 'active';
}

function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ---- SVG pieces ---- */

function renderZone(z) {
    const label = z.label ? esc(z.label) : '';
    switch (z.type) {
        case 'road': {
            const t = label ? `<text x="${z.labelX != null ? z.labelX : z.x + z.w/2}" y="${z.labelY != null ? z.labelY : z.y + z.h*0.7}" text-anchor="middle" font-family="Nunito" font-size="${z.h >= 20 ? 8 : 7}" font-weight="700" fill="rgba(255,255,255,0.68)" letter-spacing="${z.letterSpacing || 1}"${z.rotate ? ` transform="rotate(${z.rotate} ${z.labelX} ${z.labelY})"` : ''}>${label}</text>` : '';
            return `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" fill="#5a5848" opacity="0.85"/>${t}`;
        }
        case 'parking': {
            if (z.plain) {
                return `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="2" fill="#4a4a42" opacity="0.75"/>` +
                    (label ? `<text x="${z.labelX}" y="${z.labelY}" font-family="Nunito" font-size="9" font-weight="700" fill="rgba(255,255,255,0.2)" text-anchor="middle" transform="rotate(${z.rotate || 0} ${z.labelX} ${z.labelY})" letter-spacing="2">${label}</text>` : '');
            }
            const cx = z.x + z.w/2;
            return `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="4" fill="#1e3a8a" opacity="0.85"/>` +
                `<text x="${cx}" y="${z.y+22}" text-anchor="middle" font-family="Bebas Neue,Nunito" font-size="14" fill="#ffcc00" letter-spacing="1">P</text>` +
                `<text x="${cx}" y="${z.y+36}" text-anchor="middle" font-family="Nunito" font-size="8" font-weight="900" fill="white">${label}</text>` +
                (z.sublabel ? `<text x="${cx}" y="${z.y+50}" text-anchor="middle" font-family="Nunito" font-size="7" fill="rgba(255,255,255,0.65)">${esc(z.sublabel)}</text>` : '') +
                (z.note ? `<text x="${cx}" y="${z.y+63}" text-anchor="middle" font-family="Nunito" font-size="6" fill="rgba(255,255,255,0.45)">${esc(z.note)}</text>` : '');
        }
        case 'landmark':
            return `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="2" fill="#3a4a6a"/>` +
                (label ? (z.w >= 20
                    ? `<text x="${z.x+z.w/2}" y="${z.y+z.h*0.72}" font-family="Nunito" font-size="7" font-weight="900" fill="white" text-anchor="middle">${label}</text>`
                    : `<text x="${z.x+z.w/2}" y="${z.y+z.h+7}" text-anchor="middle" font-family="Nunito" font-size="6" fill="rgba(255,255,255,0.5)">${label}</text>`) : '');
        case 'medical':
            return `<circle cx="${z.x}" cy="${z.y}" r="${z.r || 9}" fill="#dc2626" opacity="0.9"/>` +
                `<text x="${z.x}" y="${z.y+4}" font-family="Nunito" font-size="11" font-weight="900" fill="white" text-anchor="middle">+</text>`;
        case 'area':
        default:
            return `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="5" fill="#243324" opacity="0.75"/>`;
    }
}

function renderField(venue, f, games) {
    const st = fieldState(games, venue.emptyState);
    const c = FIELD_STATES[st];
    const cx = f.x + f.w/2, cy = f.y + f.h/2;
    const big = f.w >= 80 || f.h >= 80;
    const label = (venue.fieldLabelPrefix || '') + (f.label || f.id);
    const isHot = st === 'ours' || st === 'final' || st === 'semi';

    // pitch markings scale to the field box
    const boxW = Math.min(22, f.w * 0.26), boxH = Math.min(15, f.h * 0.17);
    let marks = `<line x1="${f.x+3}" y1="${cy}" x2="${f.x+f.w-3}" y2="${cy}" stroke="rgba(255,255,255,0.16)" stroke-width="0.6"/>`;
    if (big) {
        marks += `<rect x="${cx-boxW/2}" y="${f.y+4}" width="${boxW}" height="${boxH}" fill="none" stroke="rgba(255,255,255,0.13)" stroke-width="0.6"/>` +
                 `<rect x="${cx-boxW/2}" y="${f.y+f.h-boxH-4}" width="${boxW}" height="${boxH}" fill="none" stroke="rgba(255,255,255,0.13)" stroke-width="0.6"/>` +
                 `<circle cx="${cx}" cy="${cy}" r="6" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.6"/>`;
    }
    const badge = c.badge
        ? `<text x="${cx}" y="${f.y + (big ? 12 : 10)}" text-anchor="middle" font-family="Nunito" font-size="${big ? 9 : 7}" font-weight="900" fill="${c.text}">${c.badge}</text>`
        : '';
    const nameSize = venue.showFieldSize ? (big ? 20 : 14) : (isHot ? 13 : 11);
    const sizeLabel = venue.showFieldSize && f.size
        ? `<text x="${cx}" y="${cy + (big ? 16 : 12)}" font-family="Nunito" font-size="6" font-weight="700" fill="${c.sub}" text-anchor="middle">${esc(f.size)}</text>`
        : '';

    return `<g onclick="venueFieldClick('${esc(f.id)}')" style="cursor:pointer;" class="map-field-group">` +
        `<rect id="vf-${esc(f.id)}" class="vf-rect" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="3" fill="${c.fill}" stroke="${c.stroke}" stroke-width="${c.sw}" style="transition:filter 0.2s;"/>` +
        marks + badge +
        `<text x="${cx}" y="${cy + (c.badge ? 3 : 1)}" text-anchor="middle" dominant-baseline="middle" font-family="${venue.showFieldSize ? 'Nunito' : 'Bebas Neue,Nunito'}" font-size="${nameSize}" font-weight="900" fill="${c.text}">${esc(label)}</text>` +
        sizeLabel +
        `</g>`;
}

function renderLegend(venue) {
    const W = venue.canvas.w, H = venue.canvas.h;
    const barY = H - 17;
    let out = `<rect x="0" y="${barY}" width="${W}" height="17" fill="rgba(0,0,0,0.4)"/>`;
    let x = 8;
    (venue.legend || []).forEach(item => {
        const c = FIELD_STATES[item.state] || FIELD_STATES.inactive;
        out += `<rect x="${x}" y="${barY+4}" width="9" height="9" rx="1" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.2"/>`;
        out += `<text x="${x+13}" y="${barY+11.5}" font-family="Nunito" font-size="7.5"${item.state==='ours'?' font-weight="900"':''} fill="${item.state==='ours'?'#ffcc00':'rgba(255,255,255,0.6)'}">${esc(item.label)}</text>`;
        x += 13 + esc(item.label).length * 4.6 + 14;
    });
    out += `<text x="${W-5}" y="${barY+11.5}" font-family="Nunito" font-size="6.5" fill="rgba(255,255,255,0.3)" text-anchor="end">${esc(venue.address)}</text>`;
    return out;
}

/* Build the venue SVG. gamesByField: { fieldId: [games] } */
function buildVenueSVG(venue, gamesByField) {
    const W = venue.canvas.w, H = venue.canvas.h;
    const zones = (venue.zones || []).map(renderZone).join('');
    const fields = (venue.fields || []).map(f => renderField(venue, f, gamesByField[f.id])).join('');
    const markers = (venue.markers || []).map(m => {
        if (m.type !== 'arrow') return '';
        return `<path d="M ${m.from[0]} ${m.from[1]} L ${m.to[0]} ${m.to[1]}" fill="none" stroke="rgba(255,204,0,0.5)" stroke-width="1.5" stroke-dasharray="3 2" marker-end="url(#vArrow)"/>`;
    }).join('');

    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="venue-svg">` +
        `<defs><marker id="vArrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="rgba(255,204,0,0.5)"/></marker></defs>` +
        `<rect width="${W}" height="${H}" fill="${venue.canvas.bg}"/>` +
        zones + markers + fields + renderLegend(venue) +
        `</svg>`;
}

/* Click a field -> glow it and show its games in the side panel */
function venueFieldClick(fieldId) {
    document.querySelectorAll('.vf-rect').forEach(r => { r.style.filter = ''; });
    const sel = document.getElementById('vf-' + fieldId);
    if (sel) sel.style.filter = 'brightness(1.35) drop-shadow(0 0 6px rgba(255,204,0,0.8))';
    showFieldInfo(fieldId);
}

/* Fill the side panel without the click glow (used to pre-select on render) */
function showFieldInfo(fieldId) {
    const el = document.getElementById('venueFieldInfo');
    if (!el) return;
    const venue = getVenue(activeVenueId);
    const games = venueFieldGames[fieldId] || [];
    const prefix = venue && venue.fieldLabelPrefix ? venue.fieldLabelPrefix : 'Field ';
    if (!games.length) {
        el.className = 'vfi vfi-empty';
        el.innerHTML = `<span>No games on <strong>${prefix}${esc(fieldId)}</strong></span>`;
        return;
    }
    el.className = 'vfi';
    el.innerHTML = `<div class="vfi-field-title">${prefix}${esc(fieldId)}</div>` + games.map(g => {
        const teams = g.home && g.away
            ? `${esc(g.home)}<span class="vfi-vs">vs</span>${esc(g.away)}`
            : `vs ${g.rank ? '#' + esc(g.rank) + ' ' : ''}${esc(g.opp || g.opponent || '')}`;
        return `<div class="vfi-game${g.isOurs ? ' vfi-ours' : ''}">` +
            (g.label ? `<div class="vfi-label">${g.isOurs ? '⭐ ' : ''}${esc(g.label)}</div>` : '') +
            `<div class="vfi-teams">${teams}</div>` +
            `<div class="vfi-meta">${esc(g.date)} · ${esc(g.time)}${g.score ? ' &nbsp;·&nbsp; <strong>' + esc(g.score) + '</strong>' : ''}</div>` +
            `</div>`;
    }).join('');
}

/* Full venue map section: heading + svg + info panel + parking note.
   opts: { title, dayBar, showPanel } */
function buildVenueSection(venue, games, opts) {
    opts = opts || {};
    activeVenueId = venue.id;
    venueFieldGames = groupGamesByField(venue, games);
    const svg = buildVenueSVG(venue, venueFieldGames);
    const panel = opts.showPanel === false ? '' :
        `<div id="venueFieldInfo" class="vfi vfi-empty"><span>${esc(opts.panelHint || 'Tap any field to see its games')}</span></div>`;
    return '<div class="venue-map-section">' +
        (opts.title === null ? '' : `<div class="tourn-sub-label" style="margin-top:28px;">📍 Venue Map · ${esc(opts.title || venue.shortName || venue.name)}</div>`) +
        (opts.dayBar || '') +
        `<div class="venue-map-outer">${svg}${panel}</div>` +
        (venue.parkingNote ? `<div class="venue-parking-note">🚗 ${venue.parkingNote}</div>` : '') +
        '</div>';
}

/* Fallback when a game's venue isn't in venues.json */
function buildUnknownVenueCard(locTexts) {
    const list = [...new Set(locTexts.filter(Boolean))];
    if (!list.length) return '';
    return '<div class="venue-map-section">' +
        '<div class="tourn-sub-label" style="margin-top:28px;">📍 Venue</div>' +
        '<div class="venue-unknown">' + list.map(l =>
            `<div class="venue-unknown-row"><span>📍</span> ${esc(l)}` +
            ` <a class="venue-dir-link" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l)}" target="_blank" rel="noopener">Directions</a></div>`
        ).join('') +
        '</div></div>';
}
