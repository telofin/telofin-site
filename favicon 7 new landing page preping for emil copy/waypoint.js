// ============================================================
// Clarity by Telofin™ — waypoint.js
// The Waypoint — per-client dashboard, first position before tabs.
//
// WIRE INTO app.html:
//   <script src="js/waypoint.js"></script>  — after pdfreader.js
//
// WIRE INTO nav.js — openClient():
//   After buildDash(c); add:
//   renderWaypoint();
//
// WIRE INTO nav.js — buildDash():
//   Prepend 'waypoint' panel before tabs render.
//   See _waypointInjectPanel() — called automatically on load.
//
// WIRE INTO nav.js — afterSwitch():
//   else if(p==='waypoint') renderWaypoint();
//
// DATA MODEL (on client):
//   c.waypointTiles = [{id, type, panel, action, label, icon, wide, order}]
//
// PUBLIC API:
//   renderWaypoint()        — renders the full dashboard
//   waypointEditMode()      — toggles drag/edit mode
//   waypointAddTile(key)    — adds a tile from the picker
//   waypointRemoveTile(id)  — removes a tile
//   waypointSaveTiles()     — persists order after drag
// ============================================================

// ── GLOBALS ──────────────────────────────────────────────────
var _WP_EDIT_MODE = false;
var _WP_DRAG_SRC  = null;

// ── DEFAULT TILE SETS ─────────────────────────────────────────
var _WP_DEFAULTS = {
  np: [
    { id:'wp-grants',    type:'status', panel:'grants',         label:'Grants',          icon:'<i class="fas fa-landmark"></i>',  wide:false },
    { id:'wp-donors',    type:'status', panel:'donors',         label:'Donors',          icon:'<i class="fas fa-users"></i>',  wide:false },
    { id:'wp-income',    type:'status', panel:'funding',        label:'Income',          icon:'<i class="fas fa-sack-dollar"></i>',  wide:false },
    { id:'wp-expenses',  type:'status', panel:'npexp',          label:'Expenses',        icon:'<i class="fas fa-money-bill-wave"></i>',  wide:false },
    { id:'wp-flagged',   type:'status', panel:'flagged',        label:'Flagged',         icon:'<i class="fas fa-flag"></i>',  wide:false },
    { id:'wp-recon',     type:'status', panel:'recon',          label:'Reconciliation',  icon:'<i class="fas fa-circle-check"></i>',  wide:false },
    { id:'wp-time',      type:'status', panel:'time',           label:'Time',            icon:'<i class="far fa-clock"></i>',  wide:false },
    { id:'wp-reimb',     type:'status', panel:'reimbursements', label:'Reimbursements',  icon:'<i class="fas fa-receipt"></i>',  wide:false },
    { id:'wp-addexp',    type:'action', action:"openM('m-exp')", label:'+ Add Expense',  icon:'<i class="fas fa-plus"></i>',  wide:false },
    { id:'wp-addinc',    type:'action', action:"openM('m-inc')", label:'+ Add Income',   icon:'<i class="fas fa-plus"></i>',  wide:false }
  ],
  sb: [
    { id:'wp-revenue',   type:'status', panel:'revenue',        label:'Revenue',         icon:'<i class="fas fa-chart-line"></i>',  wide:false },
    { id:'wp-expenses',  type:'status', panel:'sbexp',          label:'Expenses',        icon:'<i class="fas fa-money-bill-wave"></i>',  wide:false },
    { id:'wp-ar',        type:'status', panel:'ar',             label:'Invoices',        icon:'<i class="fas fa-file"></i>',  wide:false },
    { id:'wp-flagged',   type:'status', panel:'flagged',        label:'Flagged',         icon:'<i class="fas fa-flag"></i>',  wide:false },
    { id:'wp-recon',     type:'status', panel:'recon',          label:'Reconciliation',  icon:'<i class="fas fa-circle-check"></i>',  wide:false },
    { id:'wp-time',      type:'status', panel:'time',           label:'Time',            icon:'<i class="far fa-clock"></i>',  wide:false },
    { id:'wp-reimb',     type:'status', panel:'reimbursements', label:'Reimbursements',  icon:'<i class="fas fa-receipt"></i>',  wide:false },
    { id:'wp-addexp',    type:'action', action:"openM('m-exp')", label:'+ Add Expense',  icon:'<i class="fas fa-plus"></i>',  wide:false },
    { id:'wp-addrev',    type:'action', action:"openM('m-rev')", label:'+ Add Revenue',  icon:'<i class="fas fa-plus"></i>',  wide:false }
  ],
  pe: [
    { id:'wp-income',    type:'status', panel:'peinc',          label:'Income',          icon:'<i class="fas fa-sack-dollar"></i>',  wide:false },
    { id:'wp-expenses',  type:'status', panel:'peexp',          label:'Expenses',        icon:'<i class="fas fa-money-bill-wave"></i>',  wide:false },
    { id:'wp-flagged',   type:'status', panel:'flagged',        label:'Flagged',         icon:'<i class="fas fa-flag"></i>',  wide:false },
    { id:'wp-budget',    type:'status', panel:'budget',         label:'Budget',          icon:'<i class="fas fa-chart-column"></i>',  wide:false },
    { id:'wp-time',      type:'status', panel:'time',           label:'Time',            icon:'<i class="far fa-clock"></i>',  wide:false },
    { id:'wp-reimb',     type:'status', panel:'reimbursements', label:'Reimbursements',  icon:'<i class="fas fa-receipt"></i>',  wide:false },
    { id:'wp-addexp',    type:'action', action:"openM('m-exp')", label:'+ Add Expense',  icon:'<i class="fas fa-plus"></i>',  wide:false },
    { id:'wp-addinc',    type:'action', action:"openM('m-peinc')",'label':'+ Add Income',icon:'<i class="fas fa-plus"></i>', wide:false }
  ]
};

// All available tiles a user can add — shown in the picker
var _WP_ALL_TILES = [
  { id:'wp-grants',    type:'status', panel:'grants',         label:'Grants',          icon:'<i class="fas fa-landmark"></i>',  types:['np'] },
  { id:'wp-donors',    type:'status', panel:'donors',         label:'Donors',          icon:'<i class="fas fa-users"></i>',  types:['np'] },
  { id:'wp-income',    type:'status', panel:'funding',        label:'Income',          icon:'<i class="fas fa-sack-dollar"></i>',  types:['np','pe'] },
  { id:'wp-expenses',  type:'status', panel:'npexp',          label:'Expenses',        icon:'<i class="fas fa-money-bill-wave"></i>',  types:['np'] },
  { id:'wp-sbexp',     type:'status', panel:'sbexp',          label:'Expenses',        icon:'<i class="fas fa-money-bill-wave"></i>',  types:['sb'] },
  { id:'wp-peexp',     type:'status', panel:'peexp',          label:'Expenses',        icon:'<i class="fas fa-money-bill-wave"></i>',  types:['pe'] },
  { id:'wp-revenue',   type:'status', panel:'revenue',        label:'Revenue',         icon:'<i class="fas fa-chart-line"></i>',  types:['sb'] },
  { id:'wp-ar',        type:'status', panel:'ar',             label:'Invoices / A/R',  icon:'<i class="fas fa-file"></i>',  types:['sb'] },
  { id:'wp-flagged',   type:'status', panel:'flagged',        label:'Flagged',         icon:'<i class="fas fa-flag"></i>',  types:['np','sb','pe'] },
  { id:'wp-recon',     type:'status', panel:'recon',          label:'Reconciliation',  icon:'<i class="fas fa-circle-check"></i>',  types:['np','sb'] },
  { id:'wp-time',      type:'status', panel:'time',           label:'Time Tracking',   icon:'<i class="far fa-clock"></i>',  types:['np','sb','pe'] },
  { id:'wp-reimb',     type:'status', panel:'reimbursements', label:'Reimbursements',  icon:'<i class="fas fa-receipt"></i>',  types:['np','sb'] },
  { id:'wp-budget',    type:'status', panel:'budget',         label:'Budget',          icon:'<i class="fas fa-chart-column"></i>',  types:['np','sb','pe'] },
  { id:'wp-vendors',   type:'status', panel:'vendors',        label:'Vendors',         icon:'<i class="fas fa-building"></i>',  types:['np','sb','pe'] },
  { id:'wp-reports',   type:'status', panel:'reports',        label:'Reports',         icon:'<i class="fas fa-bookmark"></i>',  types:['np','sb','pe'] },
  { id:'wp-vault',     type:'status', panel:'vault',          label:'Document Vault',  icon:'<i class="fas fa-paperclip"></i>',  types:['np','sb','pe'] },
  { id:'wp-gl',        type:'status', panel:'gl',             label:'General Ledger',  icon:'<i class="fas fa-book"></i>',  types:['np','sb','pe'] },
  { id:'wp-addexp',    type:'action', action:"openM('m-exp')", label:'+ Add Expense',  icon:'<i class="fas fa-plus"></i>',  types:['np','sb','pe'] },
  { id:'wp-addinc',    type:'action', action:"openM('m-inc')", label:'+ Add Income',   icon:'<i class="fas fa-plus"></i>',  types:['np','pe'] },
  { id:'wp-addrev',    type:'action', action:"openM('m-rev')", label:'+ Add Revenue',  icon:'<i class="fas fa-plus"></i>',  types:['sb'] },
  { id:'wp-addinv',    type:'action', action:"openM('m-inv')", label:'+ Add Invoice',  icon:'<i class="fas fa-plus"></i>',  types:['sb'] },
  { id:'wp-addgrant',  type:'action', action:"openM('m-grant')",'label':'+ Add Grant', icon:'<i class="fas fa-plus"></i>',  types:['np'] },
  { id:'wp-adddonor',  type:'action', action:"openM('m-donation')",'label':'+ Add Donor',icon:'<i class="fas fa-plus"></i>',types:['np'] }
];

// ── TILE DATA — live snapshot per tile ────────────────────────
function _wpTileData(c, tile) {
  var now   = new Date();
  var month = now.getMonth();
  var year  = now.getFullYear();

  function mtdAmt(arr, amtKey) {
    return (arr||[]).filter(function(e){
      if (e.deleted) return false;
      var d = parseDate(e.date||''); if (!d) return false;
      return d.getMonth()===month && d.getFullYear()===year;
    }).reduce(function(s,e){ return s+Number(e[amtKey]||0); },0);
  }

  switch(tile.panel || '') {
    case 'grants': {
      var total = (c.grants||[]).length;
      var active = (c.grants||[]).filter(function(g){ return g.status!=='Closed'&&g.status!=='Denied'; }).length;
      var deadlines = (c.grants||[]).filter(function(g){
        if (!g.appDeadline) return false;
        var d = parseDate(g.appDeadline); if (!d) return false;
        var days = Math.ceil((d-now)/86400000);
        return days >= 0 && days <= 30;
      }).length;
      if(!total) return { main: 'No grants yet', sub: 'Click to add your first grant', isEmpty:true };
      return { main: active+' active', sub: deadlines ? '<i class="fas fa-triangle-exclamation"></i> '+deadlines+' deadline'+(deadlines>1?'s':'')+' this month' : 'No upcoming deadlines', alert: deadlines>0 };
    }
    case 'donors': {
      var total = (c.donors||[]).length;
      if(!total) return { main: 'No donors yet', sub: 'Click to add your first donor', isEmpty:true };
      var recent = (c.donors||[]).filter(function(d){
        return (d.activities||[]).some(function(a){
          var ad = parseDate(a.date||''); if (!ad) return false;
          return (now-ad)/86400000 <= 30;
        });
      }).length;
      return { main: total+' donors', sub: recent ? recent+' active this month' : 'No recent activity' };
    }
    case 'funding': {
      var allInc=(c.income||[]).filter(function(i){return!i.deleted;});
      if(!allInc.length) return { main: 'No income yet', sub: 'Click to add your first entry', isEmpty:true };
      var mtd = mtdAmt(c.income,'recv');
      var unc = (c.income||[]).filter(function(i){ return !i.deleted&&!i.cat; }).length;
      return { main: fmt(mtd)+' this month', sub: unc ? unc+' uncategorized' : 'All categorized', alert: unc>0 };
    }
    case 'npexp':
    case 'sbexp':
    case 'peexp': {
      var allExp=(c.expenses||[]).filter(function(e){return!e.deleted;});
      if(!allExp.length) return { main: 'No expenses yet', sub: 'Click to add your first expense', isEmpty:true };
      var mtdE = mtdAmt(c.expenses,'amt');
      var uncE = (c.expenses||[]).filter(function(e){ return !e.deleted&&(!e.cat||e.cat==='Uncategorized'); }).length;
      return { main: fmt(mtdE)+' this month', sub: uncE ? uncE+' uncategorized' : 'All categorized', alert: uncE>0 };
    }
    case 'revenue': {
      var mtdR = mtdAmt(c.revenue,'act');
      return { main: fmt(mtdR)+' this month', sub: 'Revenue MTD' };
    }
    case 'ar': {
      var unpaid = (c.invoices||[]).filter(function(i){ return i.status!=='Paid'&&i.status!=='Written Off'&&!i.deleted; });
      var unpaidAmt = unpaid.reduce(function(s,i){ return s+Number(i.amt||0); },0);
      var overdue = unpaid.filter(function(i){
        var d = parseDate(i.due||''); return d && d < now;
      }).length;
      return { main: fmt(unpaidAmt)+' outstanding', sub: overdue ? '<i class="fas fa-triangle-exclamation"></i> '+overdue+' overdue' : unpaid.length+' open invoice'+(unpaid.length!==1?'s':''), alert: overdue>0 };
    }
    case 'flagged': {
      var flags = (c.expenses||[]).concat(c.income||[]).filter(function(e){ return e.flagged&&!e.deleted&&!e.flagDismissed; }).length;
      return { main: flags ? flags+' item'+(flags!==1?'s':'')+' flagged' : 'No flags', sub: flags ? 'Needs review' : 'All clear <i class="fas fa-check"></i>', alert: flags>0 };
    }
    case 'recon': {
      var recs = c.reconciliations||[];
      var last = recs.length ? recs[recs.length-1] : null;
      var uncleared = (c.expenses||[]).filter(function(e){ return !e.deleted&&!e.reconciled; }).length
                    + (c.income||[]).filter(function(i){ return !i.deleted&&!i.reconciled; }).length;
      return { main: last ? 'Last: '+last.date : 'Never reconciled', sub: uncleared+' uncleared item'+(uncleared!==1?'s':''), alert: uncleared>50 };
    }
    case 'time': {
      var log = c.timeLog||[];
      var mtdSecs = log.filter(function(e){
        var d = new Date(e.start); return d.getMonth()===month&&d.getFullYear()===year;
      }).reduce(function(s,e){ return s+(e.workSecs||0); },0);
      var running = typeof _TT_ACTIVE!=='undefined'&&_TT_ACTIVE&&_TT_CLIENT_ID===c.id;
      return { main: running ? _ttFmtDur(typeof _TT_WORK_SECS!=='undefined'?_TT_WORK_SECS:0)+' this session' : (mtdSecs/3600).toFixed(1)+'h this month', sub: running ? '▶ Timer running' : (mtdSecs?'Timer stopped':'Start timer to log time'), alert: false, accent: running, pulse: running };
    }
    case 'reimbursements': {
      var pending = (c.reimbursements||[]).filter(function(r){ return r.status==='Pending'&&!r.deleted; }).length;
      var noReceipt = (c.reimbursements||[]).filter(function(r){ return !r.receiptPath&&!r.receiptUrl&&!r.deleted; }).length;
      return { main: pending+' pending', sub: noReceipt ? noReceipt+' missing receipt'+(noReceipt!==1?'s':'') : 'All have receipts', alert: noReceipt>0 };
    }
    case 'budget': {
      var fy = typeof getFiscalYear==='function' ? getFiscalYear(c.fiscalYearEnd) : null;
      var budgeted = (c.budgetItems||[]).reduce(function(s,b){ return s+Number(b.amt||0); },0);
      var spent = mtdAmt(c.expenses,'amt');
      return { main: fmt(budgeted)+' budgeted', sub: fmt(spent)+' spent YTD' };
    }
    case 'vendors': {
      var vcount = (c.vendors||[]).length;
      var need1099 = (c.vendors||[]).filter(function(v){ return v.is1099; }).length;
      return { main: vcount+' vendor'+(vcount!==1?'s':''), sub: need1099 ? need1099+' need 1099' : 'No 1099s flagged' };
    }
    case 'reports': {
      var pkgs = (c.reportPackages||[]).length;
      return { main: pkgs+' package'+(pkgs!==1?'s':''), sub: 'Click to run reports' };
    }
    case 'vault': {
      var docs = (c.documents||[]).length;
      return { main: docs+' document'+(docs!==1?'s':''), sub: 'Click to open vault' };
    }
    case 'gl': {
      var entries = (c.ledgerEntries||[]).length;
      return { main: entries+' entries', sub: 'General ledger' };
    }
    default:
      return { main: '—', sub: '' };
  }
}

// ── RENDER ────────────────────────────────────────────────────
function renderWaypoint() {
  var p = document.getElementById('p-waypoint'); if (!p) return;
  var c = gc(); if (!c) return;

  // Ensure tiles exist
  if (!c.waypointTiles || !c.waypointTiles.length) {
    c.waypointTiles = JSON.parse(JSON.stringify(_WP_DEFAULTS[c.type]||_WP_DEFAULTS.np));
  }

  // MIGRATION: refresh icon values on already-saved tiles. Once a client's
  // waypointTiles array exists, it's read from c.waypointTiles forever —
  // the defaults above only ever get copied in once, the very first time
  // a client is created. That means any tile saved before an icon set
  // changed (e.g. emoji -> Font Awesome) would otherwise show the stale
  // icon permanently, completely independent of what the current code
  // says, since the saved data simply never gets touched again.
  // This keeps every other saved customization (order, which tiles are
  // present, any custom-added tile) exactly as the user left it — it only
  // ever overwrites the icon field, matched by the tile's stable id
  // against the current authoritative definition in _WP_ALL_TILES.
  // ASSUMPTION: a given tile id has the same icon across every client type
  // that uses it (true today — e.g. wp-income is identical in np and pe).
  // If a future change ever needs a different icon for the same id
  // depending on client type, this lookup needs to become type-aware too.
  (function _wpMigrateTileIcons(){
    var _iconById={};
    _WP_ALL_TILES.forEach(function(def){ _iconById[def.id]=def.icon; });
    c.waypointTiles.forEach(function(t){
      if(_iconById.hasOwnProperty(t.id)&&t.icon!==_iconById[t.id]) t.icon=_iconById[t.id];
    });
  })();

  var tiles = c.waypointTiles;

  // Welcome back card placeholder — welcome.js fills this
  var welcomeHtml = '';
  if (typeof _wpWelcomeCardHTML === 'function') welcomeHtml = _wpWelcomeCardHTML(c);

  // Edit mode controls
  var editBar = _WP_EDIT_MODE
    ? '<div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem;padding:.6rem 1rem;background:var(--amber-bg);border:1px solid var(--amber);border-radius:10px;flex-wrap:wrap">'
      +'<span style="font-size:12px;font-weight:500;color:var(--amber)"><i class="fas fa-pen"></i> Editing tiles — drag to reorder, × to remove</span>'
      +'<button onclick="waypointShowPicker()" style="padding:5px 12px;border:1px solid var(--amber);border-radius:6px;background:none;cursor:pointer;font-size:12px;color:var(--amber);font-family:\'DM Sans\',sans-serif">+ Add tile</button>'
      +'<button onclick="waypointEditMode()" style="margin-left:auto;padding:5px 14px;border:none;border-radius:6px;background:var(--amber);color:#fff;cursor:pointer;font-size:12px;font-weight:500;font-family:\'DM Sans\',sans-serif">Done</button>'
      +'</div>'
    : '';

  // Build tile grid
  var tileHtml = tiles.map(function(tile, idx) {
    return _wpRenderTile(c, tile, idx);
  }).join('');

  // Edit toggle button (bottom, subtle)
  var editToggle = !_WP_EDIT_MODE
    ? '<div style="text-align:center;margin-top:1.5rem">'
      +'<button onclick="waypointEditMode()" style="background:none;border:none;cursor:pointer;font-size:11px;color:var(--muted);font-family:\'DM Sans\',sans-serif;text-decoration:underline"><i class="fas fa-pen"></i> Customize tiles</button>'
      +'</div>'
    : '';

  p.innerHTML =
    '<div style="padding:1.25rem">'
    + (function(){
        var attn=_wpAttentionCount(c);
        return '<div style="margin-bottom:1.25rem">'
          +'<div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">'
          +'<span style="font-family:\'DM Serif Display\',serif;font-size:20px;letter-spacing:-.3px">The Waypoint</span>'
          +(attn>0
            ?'<span style="background:var(--red);color:#fff;border-radius:10px;padding:2px 9px;font-size:11px;font-weight:600">'+attn+' need attention</span>'
            :'<span style="background:var(--green-bg);color:var(--green);border-radius:10px;padding:2px 9px;font-size:11px;font-weight:500">All clear <i class="fas fa-check"></i></span>')
          +'</div>'
          +'<div style="font-size:11px;color:var(--muted);margin-top:3px">'+_wpGreeting()+'</div>'
          +'</div>';
      })()
    + welcomeHtml
    + editBar
    + '<div id="wp-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.75rem">'
    + tileHtml
    + '</div>'
    + editToggle
    + _wpPickerHTML(c)
    + '</div>';

  // Wire drag events if in edit mode
  if (_WP_EDIT_MODE) _wpInitDrag();
}

// ── TILE RENDERER ─────────────────────────────────────────────
function _wpRenderTile(c, tile, idx) {
  var isAction = tile.type === 'action';
  var data = isAction ? null : _wpTileData(c, tile);

  var borderColor = data && data.alert ? 'var(--red)' : data && data.accent ? 'var(--green)' : data && data.isEmpty ? 'var(--border)' : 'var(--border)';
  var bgColor     = data && data.alert ? 'var(--red-bg)' : data && data.isEmpty ? 'var(--soft)' : 'var(--surface)';
  var pulseStyle  = data && data.pulse ? 'animation:wp-pulse 2s ease-in-out infinite;' : '';

  var editControls = _WP_EDIT_MODE
    ? '<button onclick="waypointRemoveTile(\''+tile.id+'\')" style="position:absolute;top:6px;right:6px;background:var(--red);color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;font-family:\'DM Sans\',sans-serif">×</button>'
      +'<div style="position:absolute;top:6px;left:6px;color:var(--muted);font-size:13px;cursor:grab" title="Drag to reorder">⠿</div>'
    : '';

  var tileStyle = 'position:relative;border:1px solid '+borderColor+';border-radius:12px;padding:1rem;background:'+bgColor+';cursor:pointer;transition:box-shadow .15s,transform .15s;'
    + (isAction ? 'border-style:dashed;background:var(--soft);' : '')
    + (_WP_EDIT_MODE ? 'cursor:grab;' : '');

  var clickFn = _WP_EDIT_MODE ? '' : (isAction ? tile.action : 'waypointGo(\''+tile.panel+'\')');
  var hoverStyle = 'onmouseover="if(!'+_WP_EDIT_MODE+')this.style.boxShadow=\'0 2px 12px rgba(0,0,0,.08)\';this.style.transform=\'translateY(-1px)\'" onmouseout="this.style.boxShadow=\'\';this.style.transform=\'\'"';

  if (isAction) {
    return '<div class="wp-tile" data-idx="'+idx+'" data-id="'+tile.id+'" style="'+tileStyle+'" onclick="'+clickFn+'" '+hoverStyle+'>'
      + editControls
      + '<div style="font-size:22px;margin-bottom:.4rem">'+tile.icon+'</div>'
      + '<div style="font-size:13px;font-weight:500;color:var(--np)">'+tile.label+'</div>'
      + '</div>';
  }

  return '<div class="wp-tile" data-idx="'+idx+'" data-id="'+tile.id+'" style="'+tileStyle+'" onclick="'+clickFn+'" '+hoverStyle+'>'
    + editControls
    + '<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.6rem">'
    + '<span style="font-size:16px">'+tile.icon+'</span>'
    + '<span style="font-size:11px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">'+tile.label+'</span>'
    + '</div>'
    + '<div style="font-size:17px;font-weight:600;color:var(--text);margin-bottom:.2rem">'+(data?data.main:'—')+'</div>'
    + '<div style="font-size:11px;color:'+(data&&data.alert?'var(--red)':data&&data.accent?'var(--green)':'var(--muted)')+';">'+(data?data.sub:'')+'</div>'
    + '</div>';
}

// ── NAVIGATION ────────────────────────────────────────────────
function waypointGo(panel) {
  var tabBtn = document.querySelector('#tabs .tab[data-panel="'+panel+'"]');
  if (tabBtn && typeof switchTab === 'function') switchTab({ target: tabBtn }, panel);
}

// ── EDIT MODE ─────────────────────────────────────────────────
function waypointEditMode() {
  _WP_EDIT_MODE = !_WP_EDIT_MODE;
  renderWaypoint();
}

function waypointRemoveTile(id) {
  var c = gc(); if (!c) return;
  c.waypointTiles = (c.waypointTiles||[]).filter(function(t){ return t.id !== id; });
  sv();
  renderWaypoint();
}

// ── DRAG TO REORDER ───────────────────────────────────────────
function _wpInitDrag() {
  var grid = document.getElementById('wp-grid'); if (!grid) return;
  var tiles = grid.querySelectorAll('.wp-tile');
  tiles.forEach(function(tile){
    tile.setAttribute('draggable','true');
    tile.addEventListener('dragstart', function(e){
      _WP_DRAG_SRC = this;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(function(){ tile.style.opacity = '.4'; }, 0);
    });
    tile.addEventListener('dragend', function(){
      this.style.opacity = '1';
      grid.querySelectorAll('.wp-tile').forEach(function(t){ t.style.outline=''; });
      _wpSaveDragOrder();
    });
    tile.addEventListener('dragover', function(e){
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      grid.querySelectorAll('.wp-tile').forEach(function(t){ t.style.outline=''; });
      this.style.outline = '2px solid var(--np)';
    });
    tile.addEventListener('dragleave', function(){ this.style.outline=''; });
    tile.addEventListener('drop', function(e){
      e.stopPropagation();
      if (_WP_DRAG_SRC === this) return;
      this.style.outline = '';
      var all = Array.from(grid.querySelectorAll('.wp-tile'));
      var fi = all.indexOf(_WP_DRAG_SRC);
      var ti = all.indexOf(this);
      if (fi < ti) grid.insertBefore(_WP_DRAG_SRC, this.nextSibling);
      else         grid.insertBefore(_WP_DRAG_SRC, this);
    });
  });
}

function _wpSaveDragOrder() {
  var c = gc(); if (!c) return;
  var grid = document.getElementById('wp-grid'); if (!grid) return;
  var newOrder = Array.from(grid.querySelectorAll('.wp-tile')).map(function(el){ return el.dataset.id; });
  c.waypointTiles.sort(function(a,b){ return newOrder.indexOf(a.id) - newOrder.indexOf(b.id); });
  sv();
}

// ── TILE PICKER ───────────────────────────────────────────────
function waypointShowPicker() {
  var p = document.getElementById('wp-picker'); if (!p) return;
  p.style.display = p.style.display === 'block' ? 'none' : 'block';
}

function waypointAddTile(id) {
  var c = gc(); if (!c) return;
  // Don't add duplicates
  if ((c.waypointTiles||[]).find(function(t){ return t.id === id; })) {
    var p = document.getElementById('wp-picker'); if (p) p.style.display='none';
    return;
  }
  var def = _WP_ALL_TILES.find(function(t){ return t.id === id; });
  if (!def) return;
  var newTile = JSON.parse(JSON.stringify(def));
  if (!c.waypointTiles) c.waypointTiles = [];
  c.waypointTiles.push(newTile);
  sv();
  var p = document.getElementById('wp-picker'); if (p) p.style.display='none';
  renderWaypoint();
}

function _wpPickerHTML(c) {
  var existing = (c.waypointTiles||[]).map(function(t){ return t.id; });
  var available = _WP_ALL_TILES.filter(function(t){
    return t.types.indexOf(c.type) >= 0 && existing.indexOf(t.id) < 0;
  });
  if (!available.length) return '<div id="wp-picker" style="display:none"></div>';
  return '<div id="wp-picker" style="display:none;margin-top:.75rem;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:.75rem">'
    +'<div style="font-size:11px;font-weight:500;color:var(--muted);margin-bottom:.5rem;text-transform:uppercase;letter-spacing:.04em">Add a tile</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:.4rem">'
    + available.map(function(t){
        return '<button onclick="waypointAddTile(\''+t.id+'\')" style="padding:5px 11px;border:1px solid var(--border);border-radius:20px;background:var(--soft);font-size:12px;cursor:pointer;font-family:\'DM Sans\',sans-serif;color:var(--text)">'
          +t.icon+' '+t.label+'</button>';
      }).join('')
    +'</div></div>';
}

// ── GREETING ──────────────────────────────────────────────────
function _wpGreeting() {
  var h = new Date().getHours();
  var tod = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  var now = new Date();
  var dateStr = now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
  return tod + ' · ' + dateStr;
}

// Count items needing attention across the client
function _wpAttentionCount(c) {
  var n = 0;
  var now = new Date();
  // Flagged transactions
  n += (c.expenses||[]).concat(c.income||[]).filter(function(e){ return e.flagged&&!e.deleted&&!e.flagDismissed; }).length;
  // Uncategorized expenses
  n += (c.expenses||[]).filter(function(e){ return !e.deleted&&(!e.cat||e.cat==='Uncategorized'); }).length;
  // Overdue invoices
  n += (c.invoices||[]).filter(function(i){ var d=parseDate(i.due||''); return d&&d<now&&i.status!=='Paid'&&!i.deleted; }).length;
  // Pending reimbursements
  n += (c.reimbursements||[]).filter(function(r){ return r.status==='Pending'&&!r.deleted; }).length;
  // Grant deadlines in next 14 days
  n += (c.grants||[]).filter(function(g){
    if(!g.appDeadline||g.status==='Closed'||g.status==='Denied')return false;
    var d=parseDate(g.appDeadline); if(!d)return false;
    var days=Math.ceil((d-now)/86400000);
    return days>=0&&days<=14;
  }).length;
  return n;
}


// ── PULSE ANIMATION ───────────────────────────────────────────
(function(){
  if(document.getElementById('wp-styles'))return;
  var s=document.createElement('style');
  s.id='wp-styles';
  s.textContent='@keyframes wp-pulse{0%,100%{box-shadow:0 0 0 0 rgba(29,158,117,.15)}50%{box-shadow:0 0 0 6px rgba(29,158,117,.0)}}'
    +'@media(max-width:768px){#wp-grid{grid-template-columns:1fr 1fr!important}#wc-card{flex-direction:column!important;gap:.75rem!important}#wc-card .wc-btns{width:100%!important}#wc-card button{width:100%!important;text-align:center!important}}'
    +'@media(max-width:480px){#wp-grid{grid-template-columns:1fr!important}.wp-tile{padding:.75rem!important}}';
  document.head.appendChild(s);
})();

// ── INJECT WAYPOINT PANEL INTO DASH ──────────────────────────
// Patches buildDash to prepend the Waypoint before the tab panels,
// and patches afterSwitch to dispatch to renderWaypoint.
// Safe to call multiple times — guards against double-patching.
(function _wpPatchNav(){
  // Patch getTabs — prepend 'waypoint' to every client type
  if (typeof getTabs === 'function' && !getTabs._wpPatched) {
    var _origGetTabs = getTabs;
    getTabs = function(t) {
      var tabs = _origGetTabs(t);
      // Only add if not already present
      if (!tabs.find(function(tab){ return tab[0]==='waypoint'; })) {
        tabs.unshift(['waypoint','Waypoint']);
      }
      return tabs;
    };
    getTabs._wpPatched = true;
  }

  // Patch afterSwitch — add waypoint dispatch
  if (typeof afterSwitch === 'function' && !afterSwitch._wpPatched) {
    var _origAfterSwitch = afterSwitch;
    afterSwitch = function(p) {
      if (p === 'waypoint') { renderWaypoint(); return; }
      _origAfterSwitch(p);
    };
    afterSwitch._wpPatched = true;
  }
})();
