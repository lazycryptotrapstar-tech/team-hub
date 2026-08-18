/* ============================================================
   VENUE MAPS
   Phase-1 note: these are the legacy hand-built maps (UT Dallas +
   Carpenter Park), moved verbatim from the single-file app.
   Phase 2 replaces both with a generic renderer driven by
   data/venues.json.
============================================================ */

function buildUTDMap(utdFields) {
    // utdFields: { 7: [{date,time,opp,...}], 9: [...] }

    function fieldColor(num) {
        if (utdFields[num]) return { fill:'#ffcc00', stroke:'#00234b', sw:2.5, text:'#00234b', sub:'rgba(0,35,75,0.6)' };
        return { fill:'#1a5c30', stroke:'rgba(255,255,255,0.3)', sw:0.8, text:'rgba(255,255,255,0.8)', sub:'rgba(255,255,255,0.35)' };
    }

    function field(num, x, y, w, h) {
        var c = fieldColor(num);
        var cx = x + w/2, cy = y + h/2;
        var badge = utdFields[num] ? '<text x="'+cx+'" y="'+(y+10)+'" text-anchor="middle" font-family="Nunito" font-size="7" font-weight="900" fill="'+c.text+'">★</text>' : '';
        return '<g onclick="utdFieldClick('+num+')" style="cursor:pointer;">' +
            '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="3" fill="'+c.fill+'" stroke="'+c.stroke+'" stroke-width="'+c.sw+'" style="transition:filter 0.15s;" id="utdf-'+num+'"/>' +
            '<line x1="'+(x+3)+'" y1="'+cy+'" x2="'+(x+w-3)+'" y2="'+cy+'" stroke="rgba(255,255,255,0.18)" stroke-width="0.6"/>' +
            '<rect x="'+(cx-10)+'" y="'+(y+4)+'" width="20" height="12" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="0.5"/>' +
            '<rect x="'+(cx-10)+'" y="'+(y+h-16)+'" width="20" height="12" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="0.5"/>' +
            badge +
            '<text x="'+cx+'" y="'+(cy + (utdFields[num]?4:2))+'" text-anchor="middle" dominant-baseline="middle" font-family="Bebas Neue,Nunito" font-size="'+(utdFields[num]?13:11)+'" font-weight="900" fill="'+c.text+'">UTD-'+num+'</text>' +
            '</g>';
    }

    // Layout: viewBox 0 0 340 452
    var fw = 72, fh = 86, gap = 8;
    var ux = 12, uy = 22;

    var svgFields = '';
    svgFields += field(3, ux,           uy,           fw, fh);
    svgFields += field(2, ux+fw+gap,    uy,           fw, fh);
    svgFields += field(1, ux+2*(fw+gap),uy,           fw, fh);
    svgFields += field(6, ux,           uy+fh+gap,    fw, fh);
    svgFields += field(5, ux+fw+gap,    uy+fh+gap,    fw, fh);
    svgFields += field(4, ux+2*(fw+gap),uy+fh+gap,    fw, fh);
    var ly = uy + 2*(fh+gap) + 28;
    svgFields += field(8, ux,           ly,           fw, fh);
    svgFields += field(7, ux+fw+gap,    ly,           fw, fh);
    svgFields += field(10, ux,          ly+fh+gap,    fw, fh);
    svgFields += field(9,  ux+fw+gap,   ly+fh+gap,    fw, fh);

    var fieldStY = uy + 2*(fh+gap) + 4;
    var lotUX = ux + 2*(fw+gap) + fw + 6;
    var lotUY = ly;
    var lotUH = 2*fh + gap;

    var infoRows = '';
    Object.keys(utdFields).sort().forEach(function(num) {
        utdFields[num].forEach(function(m) {
            infoRows += '<div class="utd-info-row">' +
                '<span class="utd-field-badge">UTD-'+num+'</span>' +
                '<div class="utd-info-detail"><strong>'+m.date+' · '+m.time+'</strong><br>vs #'+m.rank+' '+m.opp+'</div>' +
                '</div>';
        });
    });

    var svg = '<svg viewBox="0 0 340 452" xmlns="http://www.w3.org/2000/svg" class="utd-svg">' +
        '<rect width="340" height="452" fill="#2d3a2d"/>' +
        '<rect x="6" y="16" width="'+(3*fw+2*gap+12)+'" height="'+(2*fh+gap+12)+'" rx="5" fill="#243324" opacity="0.8"/>' +
        '<rect x="6" y="'+(fieldStY+20)+'" width="'+(2*fw+gap+12)+'" height="'+(2*fh+gap+12+fh+gap)+'" rx="5" fill="#243324" opacity="0.8"/>' +
        '<rect x="0" y="0" width="340" height="16" fill="#5a5848" opacity="0.8"/>' +
        '<text x="130" y="11" text-anchor="middle" font-family="Nunito" font-size="7" font-weight="700" fill="rgba(255,255,255,0.65)" letter-spacing="1">LOOP ROAD SW</text>' +
        '<rect x="0" y="'+fieldStY+'" width="340" height="22" fill="#5a5848" opacity="0.9"/>' +
        '<text x="160" y="'+(fieldStY+15)+'" text-anchor="middle" font-family="Nunito" font-size="8" font-weight="700" fill="rgba(255,255,255,0.7)" letter-spacing="2">FIELD ST</text>' +
        '<rect x="'+(ux+2*(fw+gap)+fw+4)+'" y="'+(uy+fh+gap)+'" width="14" height="20" rx="2" fill="#3a4a6a"/>' +
        '<text x="'+(ux+2*(fw+gap)+fw+11)+'" y="'+(uy+fh+gap+23)+'" text-anchor="middle" font-family="Nunito" font-size="6" fill="rgba(255,255,255,0.5)">PAV</text>' +
        '<rect x="'+lotUX+'" y="'+lotUY+'" width="'+(340-lotUX-6)+'" height="'+lotUH+'" rx="4" fill="#1e3a8a" opacity="0.85"/>' +
        '<text x="'+(lotUX+(340-lotUX-6)/2)+'" y="'+(lotUY+22)+'" text-anchor="middle" font-family="Bebas Neue,Nunito" font-size="14" fill="#ffcc00" letter-spacing="1">P</text>' +
        '<text x="'+(lotUX+(340-lotUX-6)/2)+'" y="'+(lotUY+36)+'" text-anchor="middle" font-family="Nunito" font-size="8" font-weight="900" fill="white">LOT U</text>' +
        '<text x="'+(lotUX+(340-lotUX-6)/2)+'" y="'+(lotUY+50)+'" text-anchor="middle" font-family="Nunito" font-size="7" fill="rgba(255,255,255,0.65)">Park Here</text>' +
        '<text x="'+(lotUX+(340-lotUX-6)/2)+'" y="'+(lotUY+63)+'" text-anchor="middle" font-family="Nunito" font-size="6" fill="rgba(255,255,255,0.45)">Enter from Field St</text>' +
        '<path d="M '+lotUX+' '+(lotUY+lotUH/2)+' L '+(ux+2*(fw+gap)+fw+6)+' '+(lotUY+lotUH/2)+'" fill="none" stroke="rgba(255,204,0,0.5)" stroke-width="1.5" stroke-dasharray="3 2" marker-end="url(#arrowU)"/>' +
        '<rect x="0" y="435" width="340" height="17" fill="rgba(0,0,0,0.4)"/>' +
        '<rect x="8" y="439" width="8" height="8" rx="1" fill="#ffcc00" stroke="#00234b" stroke-width="1.2"/>' +
        '<text x="20" y="446" font-family="Nunito" font-size="7.5" font-weight="900" fill="#ffcc00">Your Field</text>' +
        '<rect x="85" y="439" width="8" height="8" rx="1" fill="#1a5c30" stroke="rgba(255,255,255,0.3)" stroke-width="0.8"/>' +
        '<text x="97" y="446" font-family="Nunito" font-size="7.5" fill="rgba(255,255,255,0.6)">Other Fields</text>' +
        '<text x="335" y="446" font-family="Nunito" font-size="6.5" fill="rgba(255,255,255,0.3)" text-anchor="end">6701 Floyd Rd · Richardson TX</text>' +
        '<defs><marker id="arrowU" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="rgba(255,204,0,0.5)"/></marker></defs>' +
        svgFields +
        '</svg>';

    var infoPanel = Object.keys(utdFields).length > 0
        ? '<div class="utd-info-panel">' + infoRows + '</div>'
        : '';

    return '<div class="utd-map-section">' +
        '<div class="tourn-sub-label" style="margin-top:28px;">📍 Venue Map · UT Dallas</div>' +
        '<div class="utd-map-wrap">' + svg + infoPanel + '</div>' +
        '<div class="utd-parking-note">&#128663; <strong>Park in Lot U</strong> — enter from Field St (east side of complex). <strong>Do not use Lot J.</strong></div>' +
        '</div>';
}

function utdFieldClick(num) {
    document.querySelectorAll('[id^="utdf-"]').forEach(function(r){ r.style.filter=''; });
    var sel = document.getElementById('utdf-'+num);
    if (sel) sel.style.filter = 'brightness(1.3) drop-shadow(0 0 5px rgba(255,204,0,0.7))';
}

function buildVenueMapSVG(){
    function state(id){const g=mapFieldGames[id]||[];if(!g.length)return 'inactive';if(g.some(function(x){return x.isOurs;}))return 'ours';if(g.some(function(x){return x.label==='Final';}))return 'final';if(g.some(function(x){return x.label&&x.label.indexOf('Semi')>=0;}))return 'semi';return 'active';}
    const C={ours:{fill:'#ffcc00',stroke:'#00234b',sw:3,text:'#00234b',ltext:'rgba(0,35,75,0.6)'},final:{fill:'#1a3a6b',stroke:'#93c5fd',sw:2,text:'#bfdbfe',ltext:'rgba(191,219,254,0.6)'},semi:{fill:'#1a3a6b',stroke:'#93c5fd',sw:1.8,text:'#bfdbfe',ltext:'rgba(191,219,254,0.7)'},active:{fill:'#1a5c30',stroke:'rgba(255,255,255,0.45)',sw:1.2,text:'rgba(255,255,255,0.85)',ltext:'rgba(255,255,255,0.45)'},inactive:{fill:'#1a3d24',stroke:'rgba(255,255,255,0.1)',sw:0.8,text:'rgba(255,255,255,0.2)',ltext:'rgba(255,255,255,0.1)'}};
    const fields=[{id:'E',x:25,y:58,w:58,h:44,label:'E',size:'9v9'},{id:'F',x:148,y:18,w:58,h:44,label:'F',size:'9v9'},{id:'G',x:216,y:18,w:58,h:44,label:'G',size:'9v9'},{id:'H',x:298,y:22,w:64,h:48,label:'H',size:'9v9'},{id:'A',x:140,y:83,w:88,h:112,label:'A',size:'11v11'},{id:'B',x:238,y:83,w:88,h:112,label:'B',size:'11v11'},{id:'D',x:140,y:205,w:88,h:112,label:'D',size:'11v11'},{id:'C',x:238,y:205,w:88,h:112,label:'C',size:'11v11'},{id:'L',x:330,y:258,w:72,h:100,label:'L',size:'11v11'},{id:'M',x:410,y:258,w:72,h:100,label:'M',size:'11v11'}];
    const svgFields=fields.map(function(f){const s=state(f.id),c=C[s],cx=f.x+f.w/2,cy=f.y+f.h/2,big=f.size==='11v11';const mk=big?`<line x1="${f.x+3}" y1="${cy}" x2="${f.x+f.w-3}" y2="${cy}" stroke="rgba(255,255,255,0.15)" stroke-width="0.7"/><rect x="${cx-11}" y="${f.y+4}" width="22" height="15" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="0.7"/><rect x="${cx-11}" y="${f.y+f.h-19}" width="22" height="15" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="0.7"/><circle cx="${cx}" cy="${cy}" r="6" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.6"/>` :`<line x1="${f.x+3}" y1="${cy}" x2="${f.x+f.w-3}" y2="${cy}" stroke="rgba(255,255,255,0.12)" stroke-width="0.6"/>`;const badge=s==='ours'?'★':s==='final'?'F':'';const badgeEl=badge?`<text x="${cx}" y="${f.y+(big?12:10)}" font-family="Nunito" font-size="${big?9:7}" text-anchor="middle" fill="${c.text}">${badge}</text>`:'';return `<g onclick="showMapField('${f.id}')" style="cursor:pointer;" class="map-field-group"><rect id="mf-${f.id}" class="mf-rect" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="3" fill="${c.fill}" stroke="${c.stroke}" stroke-width="${c.sw}" style="transition:filter 0.2s;"/>${mk}${badgeEl}<text x="${cx}" y="${cy+(badge?3:1)}" font-family="Nunito" font-size="${big?20:14}" font-weight="900" fill="${c.text}" text-anchor="middle" dominant-baseline="middle">${f.label}</text><text x="${cx}" y="${cy+(big?16:12)}" font-family="Nunito" font-size="6" font-weight="700" fill="${c.ltext}" text-anchor="middle">${f.size}</text></g>`;}).join('');
    return `<svg viewBox="0 0 490 375" xmlns="http://www.w3.org/2000/svg" class="venue-svg"><rect width="490" height="375" fill="#3a4a36"/><rect x="20" y="12" width="370" height="330" rx="5" fill="#2a3826" opacity="0.7"/><rect x="22" y="80" width="108" height="260" rx="2" fill="#4a4a42" opacity="0.75"/><text x="76" y="225" font-family="Nunito" font-size="9" font-weight="700" fill="rgba(255,255,255,0.2)" text-anchor="middle" transform="rotate(-90 76 225)" letter-spacing="2">PARKING</text><rect x="138" y="193" width="190" height="14" fill="#5a5a48" opacity="0.6"/><rect x="326" y="80" width="14" height="240" fill="#5a5a48" opacity="0.5"/><rect x="318" y="248" width="172" height="120" rx="5" fill="#2a3826" opacity="0.7"/><rect x="484" y="0" width="6" height="375" fill="#5a5850" opacity="0.8"/><rect x="112" y="207" width="24" height="14" rx="2" fill="#1e3a8a"/><text x="124" y="217" font-family="Nunito" font-size="7" font-weight="900" fill="white" text-anchor="middle">HQ</text><circle cx="120" cy="160" r="9" fill="#dc2626" opacity="0.9"/><text x="120" y="164" font-family="Nunito" font-size="11" font-weight="900" fill="white" text-anchor="middle">+</text><text x="477" y="190" font-family="Nunito" font-size="7" fill="rgba(255,255,255,0.25)" text-anchor="middle" transform="rotate(90 477 190)" letter-spacing="1">COIT RD</text>${svgFields}<rect x="0" y="358" width="490" height="17" fill="rgba(0,0,0,0.35)"/><rect x="8" y="362" width="9" height="9" rx="1" fill="#ffcc00" stroke="#00234b" stroke-width="1.5"/><text x="21" y="370" font-family="Nunito" font-size="7.5" font-weight="900" fill="#ffcc00">Our Games</text><rect x="96" y="362" width="9" height="9" rx="1" fill="#1a3a6b" stroke="#93c5fd" stroke-width="1.5"/><text x="109" y="370" font-family="Nunito" font-size="7.5" fill="rgba(255,255,255,0.6)">Knockouts</text><rect x="174" y="362" width="9" height="9" rx="1" fill="#1a5c30" stroke="rgba(255,255,255,0.4)" stroke-width="1"/><text x="187" y="370" font-family="Nunito" font-size="7.5" fill="rgba(255,255,255,0.6)">Other Games</text><text x="482" y="370" font-family="Nunito" font-size="7" fill="rgba(255,255,255,0.3)" text-anchor="end">6701 Coit Rd · Plano TX 75024</text></svg>`;
}

function showMapField(letter){document.querySelectorAll('.mf-rect').forEach(function(r){r.style.filter='';});var sel=document.getElementById('mf-'+letter);if(sel)sel.style.filter='brightness(1.4) drop-shadow(0 0 6px rgba(255,204,0,0.9))';var games=mapFieldGames[letter]||[];var el=document.getElementById('mapFieldInfo');if(!el)return;if(!games.length){el.className='vfi vfi-empty';el.innerHTML='<span>No games on Field <strong>'+letter+'</strong>'+(tournMapDay&&tournMapDay!=='All'?' on '+tournMapDay:'')+' this day</span>';return;}el.className='vfi';el.innerHTML='<div class="vfi-field-title">Field '+letter+'</div>'+games.map(function(g){return '<div class="vfi-game'+(g.isOurs?' vfi-ours':'')+'"><div class="vfi-label">'+(g.isOurs?'⭐ ':'')+g.label+'</div><div class="vfi-teams">'+g.home+'<span class="vfi-vs">vs</span>'+g.away+'</div><div class="vfi-meta">'+g.date+' · '+g.time+(g.score?' &nbsp;·&nbsp; <strong>'+g.score+'</strong>':'')+' </div></div>';}).join('');}
