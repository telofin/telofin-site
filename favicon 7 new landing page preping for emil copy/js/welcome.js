// ============================================================
// Clarity by Telofin™ — welcome.js
// Session bookmark + welcome back card.
//
// WIRE INTO app.html:
//   <script src="js/welcome.js"></script>  — after waypoint.js
//
// FEEDS INTO:
//   waypoint.js — _wpWelcomeCardHTML() hook already in place
//
// HOW IT WORKS:
//   - Session memory is per-client, in-memory only (never persisted)
//   - editItem() is patched to capture last touched record
//   - switchTab() is patched to capture last active tab
//   - openClient() is patched to show welcome back card on return
//   - Idle threshold from timetracking.js auto-sets bookmark flag
//   - Manual 🔖 button calls wcBookmark() from the header area
//
// DATA SHAPE (_WC_SESSIONS[clientId]):
//   {
//     clientId,
//     lastTab,          // panel id e.g. 'npexp'
//     lastTabLabel,     // human label e.g. 'Expenses'
//     lastTxnId,        // item id
//     lastTxnDesc,      // description string
//     lastTxnAmt,       // formatted string e.g. '$1,200.00'
//     lastTxnType,      // 'expenses'|'income'|'revenue' etc
//     lastTxnIdx,       // array index — for highlight
//     leftAt,           // Date — when they switched away
//     bookmarked        // bool — manually bookmarked
//   }
// ============================================================

// ── SESSION STORE (in-memory, never sv()) ─────────────────────
var _WC_SESSIONS  = {};   // keyed by clientId
var _WC_DISMISSED = {};   // keyed by clientId — card dismissed this session

// ── CAPTURE HELPERS ───────────────────────────────────────────
function _wcRecord(clientId, patch) {
  if (!_WC_SESSIONS[clientId]) _WC_SESSIONS[clientId] = { clientId: clientId };
  Object.keys(patch).forEach(function(k){ _WC_SESSIONS[clientId][k] = patch[k]; });
}

function _wcTimeAgo(date) {
  if (!date) return '';
  var diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return Math.floor(diff/60) + ' min ago';
  if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
  return Math.floor(diff/86400) + 'd ago';
}

// ── PATCH editItem ────────────────────────────────────────────
// Captures the last record the bookkeeper opened
(function(){
  if (typeof editItem !== 'function' || editItem._wcPatched) return;
  var _orig = editItem;
  editItem = function(type, i) {
    // Capture before opening modal
    var c = gc();
    if (c) {
      var item = c[type] && c[type][i];
      if (item) {
        var desc = item.desc || item.name || item.text || '—';
        var amt  = item.amt  !== undefined ? '$' + Number(item.amt).toFixed(2)
                 : item.recv !== undefined ? '$' + Number(item.recv).toFixed(2)
                 : item.act  !== undefined ? '$' + Number(item.act).toFixed(2)
                 : '';
        _wcRecord(c.id, {
          lastTxnId:   item.id || null,
          lastTxnDesc: desc,
          lastTxnAmt:  amt,
          lastTxnType: type,
          lastTxnIdx:  i
        });
      }
    }
    _orig(type, i);
  };
  editItem._wcPatched = true;
})();

// ── PATCH switchTab ───────────────────────────────────────────
// Captures which tab the bookkeeper is on
(function(){
  if (typeof switchTab !== 'function' || switchTab._wcPatched) return;
  var _orig = switchTab;
  switchTab = function(e, panel) {
    var c = gc();
    if (c && panel && panel !== 'waypoint') {
      // Get human label from tab button
      var btn = document.querySelector('#tabs .tab[data-panel="'+panel+'"]');
      var label = btn ? btn.textContent.trim() : panel;
      _wcRecord(c.id, { lastTab: panel, lastTabLabel: label });
    }
    _orig(e, panel);
  };
  switchTab._wcPatched = true;
})();

// ── PATCH openClient ──────────────────────────────────────────
// Records leftAt when switching away, triggers welcome card on return
(function(){
  if (typeof openClient !== 'function' || openClient._wcPatched) return;
  var _orig = openClient;
  openClient = function(id) {
    // Record leftAt for the client we're leaving
    var prev = typeof CID !== 'undefined' ? CID : null;
    if (prev && prev !== id && _WC_SESSIONS[prev]) {
      _WC_SESSIONS[prev].leftAt = new Date();
    }
    // Clear dismissed flag for the client we're entering
    // so the card shows fresh on every visit
    _WC_DISMISSED[id] = false;
    _orig(id);
  };
  openClient._wcPatched = true;
})();

// ── CAPTURE ACTIVE TAB ON CLIENT OPEN ────────────────────────
// When openClient fires, the tab renders after a tick.
// We capture whichever tab is active after render as the starting lastTab,
// but only if no session exists yet for this client.
(function(){
  if (typeof openClient !== 'function') return;
  var _origOC2 = openClient;
  openClient = function(id) {
    _origOC2(id);
    setTimeout(function(){
      if (_WC_SESSIONS[id] && _WC_SESSIONS[id].lastTab) return; // already have one
      var activeTab = document.querySelector('#tabs .tab.active');
      if (activeTab) {
        var panel = activeTab.getAttribute('data-panel') || '';
        var label = activeTab.textContent.trim();
        if (panel && panel !== 'waypoint') {
          _wcRecord(id, { lastTab: panel, lastTabLabel: label });
        }
      }
    }, 200);
  };
})();

// ── IDLE HOOK ─────────────────────────────────────────────────
// Hooks into timetracking.js idle detection to auto-bookmark on idle.
// Uses a deferred init that runs after all scripts load — no polling,
// no race condition. Safe even if timetracking.js is not present.
function _wcInitIdleHook() {
  if (typeof _ttUpdateBar !== 'function') return; // timetracking not loaded
  if (_ttUpdateBar._wcPatched) return;            // already hooked
  var _origUpdateBar = _ttUpdateBar;
  window._ttUpdateBar = function() {
    _origUpdateBar();
    if (typeof _TT_IS_IDLE !== 'undefined' && _TT_IS_IDLE) {
      var c = gc(); if (!c) return;
      if (_WC_SESSIONS[c.id]) {
        _WC_SESSIONS[c.id].bookmarked = true;
        _WC_SESSIONS[c.id].leftAt     = new Date();
        _wcShowBookmarkConfirm();
      }
    }
  };
  window._ttUpdateBar._wcPatched = true;
}

// Defer until after all scripts have loaded
window.addEventListener('load', _wcInitIdleHook);

// ── MANUAL BOOKMARK ───────────────────────────────────────────
function wcBookmark() {
  var c = gc(); if (!c) return;
  // Capture the current active tab if lastTab hasn't been set yet
  // (bookmarker may not have switched tabs in this session)
  var patch = { bookmarked: true, leftAt: new Date() };
  if (!(_WC_SESSIONS[c.id] && _WC_SESSIONS[c.id].lastTab)) {
    var activeTab = document.querySelector('#tabs .tab.active');
    if (activeTab) {
      var panel = activeTab.getAttribute('data-panel') || '';
      var label = activeTab.textContent.trim();
      if (panel && panel !== 'waypoint') {
        patch.lastTab      = panel;
        patch.lastTabLabel = label;
      }
    }
  }
  _wcRecord(c.id, patch);
  _wcShowBookmarkConfirm();
}

function _wcShowBookmarkConfirm() {
  // Brief toast — "Bookmarked ✓" — no friction
  var t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:var(--text);color:var(--surface);'
    + 'padding:8px 16px;border-radius:8px;font-size:12px;z-index:99999;font-family:\'DM Sans\',sans-serif;'
    + 'display:flex;align-items:center;gap:6px;box-shadow:0 2px 12px rgba(0,0,0,.15)';
  t.innerHTML = '🔖 Bookmarked';
  document.body.appendChild(t);
  setTimeout(function(){ t.style.transition='opacity .4s'; t.style.opacity='0'; }, 1800);
  setTimeout(function(){ if (t.parentNode) t.parentNode.removeChild(t); }, 2300);
}

// ── WELCOME BACK CARD HTML ────────────────────────────────────
// Called by waypoint.js — _wpWelcomeCardHTML(c)
function _wpWelcomeCardHTML(c) {
  if (!c) return '';
  var sess = _WC_SESSIONS[c.id];

  // Nothing to show if no prior session or already dismissed
  if (!sess || !sess.lastTab || _WC_DISMISSED[c.id]) return '';

  var timeAgo  = sess.leftAt ? _wcTimeAgo(sess.leftAt) : '';
  var tabLabel = sess.lastTabLabel || sess.lastTab || '';
  var hasTxn   = !!(sess.lastTxnDesc && sess.lastTxnDesc !== '—');

  return '<div id="wc-card" style="'
    + 'background:var(--surface);border:1px solid var(--border);border-radius:12px;'
    + 'padding:1rem 1.25rem;margin-bottom:1.25rem;'
    + 'display:flex;align-items:center;gap:1rem;flex-wrap:wrap;'
    + 'box-shadow:0 1px 6px rgba(0,0,0,.06)">'
    // Left — context
    + '<div style="flex:1;min-width:0">'
    + '<div style="font-size:13px;font-weight:500;margin-bottom:.2rem">'
    + '👋 Welcome back'+(timeAgo?' <span style="font-size:11px;color:var(--muted);font-weight:400">· '+timeAgo+'</span>':'')
    + '</div>'
    + '<div style="font-size:12px;color:var(--muted)">'
    + 'Last working in <strong style="color:var(--text)">'+escHtml(tabLabel)+'</strong>'
    + (hasTxn
        ? ' &nbsp;·&nbsp; '+escHtml(sess.lastTxnDesc)+(sess.lastTxnAmt?' <span style="color:var(--green)">'+sess.lastTxnAmt+'</span>':'')
        : '')
    + (sess.bookmarked ? ' &nbsp;<span style="font-size:10px">🔖</span>' : '')
    + '</div>'
    + '</div>'
    // Right — actions
    + '<div class="wc-btns" style="display:flex;gap:.5rem;flex-wrap:wrap">'
    + '<button onclick="wcGoBack()" style="padding:7px 14px;border:none;border-radius:7px;'
    + 'background:var(--np);color:#fff;cursor:pointer;font-size:12px;font-weight:500;'
    + 'font-family:\'DM Sans\',sans-serif;flex:1;min-width:130px">Take me back</button>'
    + '<button onclick="wcDismiss()" style="padding:7px 14px;border:1px solid var(--border);'
    + 'border-radius:7px;background:none;cursor:pointer;font-size:12px;'
    + 'font-family:\'DM Sans\',sans-serif;color:var(--text);flex:1;min-width:130px">No, take me to the Waypoint</button>'
    + '</div>'
    + '</div>';
}

// ── ACTIONS ───────────────────────────────────────────────────
function wcGoBack() {
  var c = gc(); if (!c) return;
  var sess = _WC_SESSIONS[c.id]; if (!sess || !sess.lastTab) return;
  wcDismiss();
  // Switch to last tab
  var tabBtn = document.querySelector('#tabs .tab[data-panel="'+sess.lastTab+'"]');
  if (tabBtn && typeof switchTab === 'function') {
    switchTab({ target: tabBtn }, sess.lastTab);
  }
  // Highlight last transaction row after panel renders
  if (sess.lastTxnId) {
    setTimeout(function(){ _wcHighlight(sess.lastTxnId); }, 350);
  }
}

function wcDismiss() {
  var c = gc(); if (!c) return;
  _WC_DISMISSED[c.id] = true;
  var card = document.getElementById('wc-card');
  if (card) {
    card.style.transition = 'opacity .3s, max-height .3s';
    card.style.opacity    = '0';
    card.style.maxHeight  = '0';
    card.style.overflow   = 'hidden';
    card.style.padding    = '0';
    card.style.margin     = '0';
    setTimeout(function(){ if (card.parentNode) card.parentNode.removeChild(card); }, 350);
  }
}

// ── ROW HIGHLIGHT ─────────────────────────────────────────────
// Finds the transaction row precisely using the item id, then pulses amber.
//
// Strategy (in order, stops at first match):
//   1. data-txn-id attribute — future-proof explicit marker
//   2. Any button inside a <tr> whose onclick contains the txnId string
//      This matches rb() pattern: onclick="editItem('expenses', 3)"
//      We find the button, walk up to its containing <tr>
//   3. No match — silently exits, tab switch already happened
//
// This avoids scanning all innerHTML and eliminates false positives.
function _wcHighlight(txnId) {
  if (!txnId) return;

  var row = null;

  // Strategy 1 — explicit data attribute (future use)
  row = document.querySelector('[data-txn-id="'+txnId+'"]');

  // Strategy 2 — find button whose onclick references this id, walk up to tr
  if (!row) {
    var btns = document.querySelectorAll('#panels button[onclick]');
    for (var i = 0; i < btns.length; i++) {
      if ((btns[i].getAttribute('onclick')||'').indexOf(txnId) >= 0) {
        // Walk up DOM to find the containing tr or div.act-item
        var el = btns[i];
        while (el && el.tagName !== 'TR' && !el.classList.contains('act-item') && el.id !== 'panels') {
          el = el.parentElement;
        }
        if (el && el.tagName === 'TR') { row = el; break; }
      }
    }
  }

  if (!row) return;

  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  var orig = row.style.background || '';
  row.style.transition = 'background 0s';
  row.style.background = 'var(--amber-bg)';
  setTimeout(function(){
    row.style.transition = 'background 2s ease';
    row.style.background = orig;
  }, 100);
  setTimeout(function(){
    row.style.transition = '';
    row.style.background = orig;
  }, 2200);
}

// ── BOOKMARK BUTTON HTML ──────────────────────────────────────
// Inject into header area — call wcBookmarkBtnHTML() anywhere in the dash header
function wcBookmarkBtnHTML() {
  return '<button onclick="wcBookmark()" title="Bookmark current position" '
    + 'style="background:none;border:1px solid var(--border);border-radius:7px;'
    + 'padding:5px 10px;cursor:pointer;font-size:13px;color:var(--muted);'
    + 'font-family:\'DM Sans\',sans-serif;transition:color .15s,border-color .15s" '
    + 'onmouseover="this.style.color=\'var(--text)\';this.style.borderColor=\'var(--text)\'" '
    + 'onmouseout="this.style.color=\'var(--muted)\';this.style.borderColor=\'var(--border)\'">🔖</button>';
}

// 🔖 Bookmark button is in static HTML (app.html) — no injection needed.
