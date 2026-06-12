// ============================================================
// Clarity by Telofin™ — bank.js
// Bank tab: PDF template mapper + pending transaction queue +
// approval flow that posts to expenses/income/revenue.
//
// WIRE INTO app.html:
//   <script src="js/bank.js"></script>  — after features.js
//
// ADDS TO nav.js getTabs():
//   ['bank','🏦 Bank']  — added to np, sb, pe tab lists
//
// DATA ON CLIENT OBJECT:
//   c.bankTransactions  [] — pending transactions awaiting approval
//   c.bankTemplates     [] — PDF layout templates per bank
//
// PUBLIC API:
//   renderBank(c)              — renders the bank tab panel
//   bankHandlePDF(file)        — entry point from import modal
//   bankApproveSelected()      — posts checked transactions
//   bankApproveOne(id)         — posts a single transaction
// ============================================================

// ── GLOBALS ───────────────────────────────────────────────────
var _BANK_PDF_FILE     = null;   // current PDF file being mapped
var _BANK_PDF_DOC      = null;   // PDF.js document object
var _BANK_PDF_PAGE     = 1;      // current page being displayed
var _BANK_MAP_STEP     = 0;      // current step in template wizard
var _BANK_MAP_TEMPLATE = null;   // template being built
var _BANK_CANVAS       = null;   // canvas element for PDF render
var _BANK_SCALE        = 1.5;    // render scale for readability

// ── WIZARD STEPS ──────────────────────────────────────────────
var _BANK_STEPS = [
  { key: 'bankName',     label: 'Bank name',           prompt: 'Type your bank name below, then click the bank name as it appears on the PDF.' },
  { key: 'openingBal',   label: 'Opening balance',     prompt: 'Click the opening balance amount.' },
  { key: 'closingBal',   label: 'Closing balance',     prompt: 'Click the closing balance amount.' },
  { key: 'periodStart',  label: 'Start date',          prompt: 'Click the statement start date.' },
  { key: 'periodEnd',    label: 'End date',            prompt: 'Click the statement end date.' },
  { key: 'txnDate',      label: 'Transaction date',    prompt: 'Click the date of any transaction row.' },
  { key: 'txnDesc',      label: 'Description',         prompt: 'Click the description of that same transaction.' },
  { key: 'txnDebit',     label: 'Debit / Expense',     prompt: 'Click the debit or expense amount for that transaction. This is money going OUT — withdrawals, payments, expenses.' },
  { key: 'txnCredit',    label: 'Credit / Deposit',    prompt: 'Click the credit or deposit amount for that transaction. This is money coming IN — deposits, income, refunds. Skip if your bank uses a single amount column with +/− signs.' },
];

// ── RENDER BANK TAB ───────────────────────────────────────────
function renderBank(c) {
  var p = g('p-bank'); if (!p || !c) return;
  if (!c.bankTransactions) c.bankTransactions = [];
  if (!c.bankTemplates)    c.bankTemplates    = [];

  var pending   = c.bankTransactions.filter(function(t){ return !t.approved && !t.deleted && !t._ccId; });
  var approved  = c.bankTransactions.filter(function(t){ return t.approved && !t._ccId; });
  var templates = c.bankTemplates;

  // ── Category options ──────────────────────────────────────
  var expCats = _bankExpCats(c);
  var incCats = _bankIncCats(c);

  // ── COA account lists ────────────────────────────────────
  var expAccts = (c.accounts || []).filter(function(a){ return a.type === 'Expense' && a.active !== false; });
  var incAccts = (c.accounts || []).filter(function(a){ return (a.type === 'Income' || a.type === 'Revenue') && a.active !== false; });
  var vendorNames   = (c.vendors   || []).map(function(v){ return v.name; });
  var customerNames = (c.customers || []).map(function(cu){ return cu.name; });

  // ── Pending table ─────────────────────────────────────────
  var pendingRows = '';
  if (pending.length) {
    pendingRows = pending.map(function(t, i) {
      var isInc = t.type === 'credit';
      var catOpts = (isInc ? incCats : expCats).map(function(cat) {
        return '<option value="' + escHtml(cat) + '"' + (t.category === cat ? ' selected' : '') + '>' + escHtml(cat) + '</option>';
      }).join('');

      var acctList = isInc ? incAccts : expAccts;
      var acctStyle = t.acctCode ? 'width:100%;max-width:150px' : 'width:100%;max-width:150px;border-color:var(--red)';
      var acctOpts = '<option value="">— Select account * —</option>'
        + acctList.map(function(a){
            return '<option value="' + escHtml(a.code) + '"' + (t.acctCode === a.code ? ' selected' : '') + '>'
              + escHtml(a.code + ' ' + a.name) + '</option>';
          }).join('')
        + '<option value="__new__">+ Add new account…</option>';

      var partyList = isInc ? customerNames : vendorNames;
      var partyLabel = isInc ? 'Customer' : 'Vendor';
      var partyOpts = '<option value="">— ' + partyLabel + ' (optional) —</option>'
        + partyList.map(function(n){
            return '<option value="' + escHtml(n) + '"' + (t.vendorName === n ? ' selected' : '') + '>' + escHtml(n) + '</option>';
          }).join('')
        + '<option value="__new__">+ Add new ' + partyLabel.toLowerCase() + '…</option>';

      var sel = 'style="font-size:11px;padding:3px 5px;border:1px solid var(--border);border-radius:5px;background:var(--soft);color:var(--text);width:100%;max-width:150px"';

      var grants = c.grants || [];
      var grantOpts = '<option value="">— Link grant —</option>'
        + grants.map(function(gr){
            return '<option value="' + gr.id + '"' + (t.grantId === gr.id ? ' selected' : '') + '>' + escHtml(gr.name) + '</option>';
          }).join('')
        + '<option value="__new__">+ New grant…</option>';

      var grantDropStyle = 'font-size:11px;padding:3px 5px;border-radius:5px;width:100%;max-width:140px;font-family:\'DM Sans\',sans-serif;'
        + (t.grantId ? 'border:1px solid var(--np);background:var(--np-bg);color:var(--np);' : 'border:1px solid var(--border);background:var(--soft);color:var(--text);');

      var grantCol = '<td style="min-width:160px">'
        + '<select onchange="bankSetGrant(\'' + t.id + '\',this.value)" style="' + grantDropStyle + '">' + grantOpts + '</select>'
        + (!isInc && t.grantId
            ? '<div style="display:flex;align-items:center;gap:3px;margin-top:3px">'
              + '<input type="number" min="0" max="100" placeholder="%" value="' + (t.grantPct != null ? t.grantPct : '') + '"'
              + ' onchange="bankSetGrantPct(\'' + t.id + '\',this.value)"'
              + ' style="width:48px;font-size:11px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;background:var(--soft);color:var(--text)">'
              + '<span style="font-size:10px;color:var(--muted)">% of exp</span>'
              + '</div>'
            : '')
        + '</td>';

      return '<tr id="btr-' + t.id + '">'        + '<td style="width:26px"><input type="checkbox" class="bank-chk" data-id="' + t.id + '" style="width:14px;height:14px;cursor:pointer"></td>'        + '<td style="font-size:11px;color:var(--muted);white-space:nowrap">' + escHtml(t.date || '—') + '</td>'        + '<td style="font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escHtml(t.description) + '">' + escHtml(t.description) + '</td>'        + '<td><select onchange="bankSetType(\'' + t.id + '\',this.value)" ' + sel + '>'        + '<option value="debit"' + (t.type === 'debit' ? ' selected' : '') + '>Expense</option>'        + '<option value="credit"' + (t.type === 'credit' ? ' selected' : '') + '>Income</option>'        + '</select></td>'        + '<td><select onchange="bankSetCat(\'' + t.id + '\',this.value)" ' + sel + '>' + catOpts + '</select></td>'        + grantCol        + '<td><select onchange="bankSetParty(\'' + t.id + '\',this.value,\'' + (isInc ? 'customer' : 'vendor') + '\')" ' + sel + '>' + partyOpts + '</select></td>'        + '<td><select onchange="bankSetAcct(\'' + t.id + '\',this.value,\'' + (isInc ? 'income' : 'expense') + '\')" style="font-size:11px;padding:3px 5px;border:1px solid var(--border);border-radius:5px;background:var(--soft);color:var(--text);' + acctStyle + '">' + acctOpts + '</select></td>'        + '<td style="font-size:12px;font-weight:500;text-align:right;white-space:nowrap" class="' + (isInc ? 'vg' : 'vr') + '">'        + (isInc ? '+' : '−') + fmt(t.amount) + '</td>'        + '<td style="text-align:right;white-space:nowrap">'        + '<button onclick="bankApproveOne(\'' + t.id + '\')" style="font-size:11px;padding:4px 9px;border:none;border-radius:5px;background:var(--green);color:#fff;cursor:pointer;font-family:\'DM Sans\',sans-serif">✓ Post</button>'        + ' <button onclick="bankDeletePending(\'' + t.id + '\')" style="font-size:11px;padding:4px 7px;border:1px solid var(--border);border-radius:5px;background:none;color:var(--muted);cursor:pointer">✕</button>'        + '</td>'        + '</tr>';
    }).join('');
  }

    // ── Template list ─────────────────────────────────────────
  var tplRows = templates.length
    ? templates.map(function(t, i) {
        return '<div style="display:flex;align-items:center;gap:.75rem;padding:.6rem .75rem;border-radius:8px;background:var(--bg);margin-bottom:.4rem">'
          + '<span style="font-size:18px">🏦</span>'
          + '<div style="flex:1"><div style="font-size:13px;font-weight:500">' + escHtml(t.bankName) + '</div>'
          + '<div style="font-size:11px;color:var(--muted)">Created ' + (t.createdAt ? t.createdAt.slice(0,10) : '') + ' · ' + (t.usageCount || 0) + ' imports</div></div>'
          + '<button onclick="bankDeleteTemplate(' + i + ')" style="font-size:11px;padding:3px 8px;border:1px solid var(--border);border-radius:5px;background:none;color:var(--muted);cursor:pointer">Remove</button>'
          + '</div>';
      }).join('')
    : '<div style="font-size:12px;color:var(--muted);padding:.5rem 0">No layouts saved yet. Import a statement to set one up.</div>';

  // ── Render ────────────────────────────────────────────────
  p.innerHTML =
    '<div style="padding:1.25rem">'

    // Header
    + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem;margin-bottom:1.25rem">'
    + '<div><div style="font-size:17px;font-weight:600">🏦 Bank Statements</div>'
    + '<div style="font-size:12px;color:var(--muted);margin-top:2px">Import, review, and post transactions to your books</div></div>'
    + '<button onclick="bankOpenUpload()" style="padding:8px 18px;border:none;border-radius:8px;background:var(--np);color:#fff;cursor:pointer;font-size:13px;font-weight:500;font-family:\'DM Sans\',sans-serif">+ Import Statement</button>'
    + '</div>'

    // Pending transactions
    + '<div class="card" style="margin-bottom:1.25rem">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;flex-wrap:wrap;gap:.5rem">'
    + '<div style="font-size:14px;font-weight:600">Pending Review'
    + (pending.length ? ' <span style="background:var(--amber-bg);color:var(--amber);font-size:11px;padding:2px 8px;border-radius:10px;font-weight:500;margin-left:4px">' + pending.length + '</span>' : '')
    + '</div>'
    + (pending.length ? '<div style="display:flex;gap:.5rem;flex-wrap:wrap">'
      + '<label style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="bank-chk-all" onchange="bankToggleAll(this.checked)" style="width:14px;height:14px"> Select all</label>'
      + '<button onclick="bankApproveSelected()" style="padding:6px 14px;border:none;border-radius:7px;background:var(--green);color:#fff;cursor:pointer;font-size:12px;font-weight:500;font-family:\'DM Sans\',sans-serif">✓ Post selected</button>'
      + '<button onclick="bankDeleteSelected()" style="padding:6px 14px;border:1px solid var(--border);border-radius:7px;background:none;color:var(--muted);cursor:pointer;font-size:12px;font-family:\'DM Sans\',sans-serif">✕ Remove selected</button>'
      + '</div>' : '')
    + '</div>'
    + (pending.length
      ? '<div style="overflow-x:auto"><table style="font-size:12px;width:100%">'
        + '<thead><tr style="border-bottom:1px solid var(--border);">'
        + '<th style="width:26px;padding-bottom:.5rem"></th>'
        + '<th style="text-align:left;padding-bottom:.5rem;color:var(--muted);font-weight:500;font-size:11px">DATE</th>'
        + '<th style="text-align:left;padding-bottom:.5rem;color:var(--muted);font-weight:500;font-size:11px">DESCRIPTION</th>'
        + '<th style="text-align:left;padding-bottom:.5rem;color:var(--muted);font-weight:500;font-size:11px">TYPE</th>'
        + '<th style="text-align:left;padding-bottom:.5rem;color:var(--muted);font-weight:500;font-size:11px">CATEGORY</th>'
        + '<th style="text-align:left;padding-bottom:.5rem;color:var(--muted);font-weight:500;font-size:11px">GRANT</th>'
        + '<th style="text-align:left;padding-bottom:.5rem;color:var(--muted);font-weight:500;font-size:11px">VENDOR / CUSTOMER</th>'
        + '<th style="text-align:left;padding-bottom:.5rem;color:var(--muted);font-weight:500;font-size:11px">ACCOUNT</th>'
        + '<th style="text-align:right;padding-bottom:.5rem;color:var(--muted);font-weight:500;font-size:11px">AMOUNT</th>'
        + '<th style="text-align:right;padding-bottom:.5rem;color:var(--muted);font-weight:500;font-size:11px">ACTION</th>'
        + '</tr></thead>'
        + '<tbody>' + pendingRows + '</tbody>'
        + '</table></div>'
      : '<div style="text-align:center;padding:2.5rem;color:var(--muted)">'
        + '<div style="font-size:2rem;margin-bottom:.75rem">✓</div>'
        + '<div id="bank-drop-zone" ondragover="bankDragOver(event)" ondragleave="bankDragLeave(event)" ondrop="bankDrop(event)" onclick="bankOpenUpload()" style="text-align:center;padding:2.5rem 1.25rem;color:var(--muted);border:2px dashed var(--border);border-radius:12px;cursor:pointer;transition:border-color .15s,background .15s">'        + '<div style="font-size:2.5rem;margin-bottom:.75rem">📄</div>'        + '<div style="font-size:14px;font-weight:500;color:var(--text);margin-bottom:.35rem">Drop a bank statement here</div>'        + '<div style="font-size:12px;margin-bottom:1rem">or click to browse for a PDF</div>'        + '<button onclick="event.stopPropagation();bankOpenUpload()" style="padding:7px 18px;border:none;border-radius:7px;background:var(--np);color:#fff;cursor:pointer;font-size:12px;font-weight:500;font-family:\'DM Sans\',sans-serif">+ Import Statement</button>'        + '</div>')
    + '</div>'

    // Templates section
    + '<div class="card">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">'
    + '<div style="font-size:14px;font-weight:600">Bank Layouts</div>'
    + '</div>'
    + '<div style="font-size:12px;color:var(--muted);margin-bottom:.75rem;line-height:1.6">Clarity remembers where your bank puts dates, amounts, and descriptions on their PDFs. After the first import, future statements from the same bank load automatically.</div>'
    + tplRows
    + '</div>'

    + '</div>';

  // ── Wire drag-drop on panel ──────────────────────────────────
  var _bankPanel = g('p-bank');
  if (_bankPanel && !_bankPanel._bankDragWired) {
    _bankPanel._bankDragWired = true;
    _bankPanel.addEventListener('dragover', function(e) {
      e.preventDefault();
      if (document.getElementById('bank-drop-zone')) bankDragOver(e);
    });
    _bankPanel.addEventListener('dragleave', function(e) {
      if (document.getElementById('bank-drop-zone')) bankDragLeave(e);
    });
    _bankPanel.addEventListener('drop', function(e) {
      e.preventDefault();
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file && file.name.toLowerCase().endsWith('.pdf')) bankHandlePDF(file);
      else if (file) alert('Please drop a PDF file.');
    });
  }
}

// ── CATEGORY HELPERS ──────────────────────────────────────────
function _bankExpCats(c) {
  var base = ['Uncategorized','Payroll','Rent','Utilities','Insurance','Bank Fees',
    'Software','Office Supplies','Travel','Meals','Medical','Postage & Shipping',
    'Supplies','Loan Payment','Taxes','Cash','Transfer','Donations'];
  if (c && c.coa) {
    var fromCOA = c.coa.filter(function(a){ return a.type === 'Expense'; })
                       .map(function(a){ return a.cat || a.name; });
    fromCOA.forEach(function(cat){ if (base.indexOf(cat) < 0) base.unshift(cat); });
  }
  return base;
}

function _bankIncCats(c) {
  var base = ['Other Income','Payroll Deposit','Transfer In','Grant','Donation',
    'Sales Revenue','Services Revenue','Interest Income','Refund','Loan Proceeds'];
  if (c && c.coa) {
    var fromCOA = c.coa.filter(function(a){ return a.type === 'Income'; })
                       .map(function(a){ return a.cat || a.name; });
    fromCOA.forEach(function(cat){ if (base.indexOf(cat) < 0) base.unshift(cat); });
  }
  return base;
}

// ── TRANSACTION ACTIONS ───────────────────────────────────────
function bankSetType(id, type) {
  var c = gc(); if (!c || !c.bankTransactions) return;
  var t = c.bankTransactions.find(function(x){ return x.id === id; });
  if (!t) return;
  t.type = type;
  // Reset category when type changes
  t.category = type === 'credit' ? 'Other Income' : 'Uncategorized';
  sv();
  renderBank(c);
}

function bankSetCat(id, cat) {
  var c = gc(); if (!c || !c.bankTransactions) return;
  var t = c.bankTransactions.find(function(x){ return x.id === id; });
  if (!t) return;
  t.category = cat;
  // Auto-match COA account from category if not already set
  if (!t.acctCode && c.accounts && c.accounts.length) {
    var match = c.accounts.find(function(a){
      return (a.cat === cat || a.name === cat) && a.active !== false;
    });
    if (match) t.acctCode = match.code;
  }
  sv();
  renderBank(c);
}

function bankSetGrant(id, val) {
  var c = gc(); if (!c) return;
  var t = (c.bankTransactions || []).find(function(x){ return x.id === id; });
  if (!t) return;
  if (val === '__new__') { bankNewGrant(id); return; }
  t.grantId = val || '';
  if (!t.grantId) t.grantPct = null; // clear % when grant cleared
  sv();
  renderBank(c); // re-render so % field appears/disappears
}

function bankSetGrantPct(id, val) {
  var c = gc(); if (!c) return;
  var t = (c.bankTransactions || []).find(function(x){ return x.id === id; });
  if (!t) return;
  var n = parseFloat(val);
  t.grantPct = (!isNaN(n) && n >= 0 && n <= 100) ? n : null;
  sv();
}

function bankNewGrant(txnId) {
  // Store the pending txnId so saveGrant() can link it after saving
  window._bankPendingGrantTxnId = txnId;
  EI = -1;
  // Ensure dynamic modals are built so m-grant exists
  var c = gc();
  if (!g('m-grant') && typeof buildDynMods === 'function' && c) buildDynMods(c.type);
  openM('m-grant');
  setTimeout(function(){
    var st = g('g-st'); if (st) st.value = 'Awarded';
  }, 50);
}

function bankSetParty(id, val, partyType) {
  var c = gc(); if (!c) return;
  var t = (c.bankTransactions || []).find(function(x){ return x.id === id; });
  if (!t) return;

  if (val === '__new__') {
    // Show a small inline modal instead of a ugly prompt
    var existing = document.getElementById('bank-party-modal');
    if (existing) existing.parentNode.removeChild(existing);
    var modal = document.createElement('div');
    modal.id = 'bank-party-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center';
    modal.innerHTML = '<div style="background:var(--surface);border-radius:14px;padding:1.5rem;width:320px;box-shadow:0 8px 32px rgba(0,0,0,.2);font-family:\'DM Sans\',sans-serif">'
      + '<div style="font-size:15px;font-weight:600;margin-bottom:1rem;color:var(--text)">Add new ' + partyType + '</div>'
      + '<label style="font-size:12px;color:var(--muted);display:block;margin-bottom:.3rem">' + (partyType === 'vendor' ? 'Vendor' : 'Customer') + ' name *</label>'
      + '<input id="bpm-name" type="text" placeholder="e.g. ' + (partyType === 'vendor' ? 'Office Depot' : 'Smith Foundation') + '" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:\'DM Sans\',sans-serif;box-sizing:border-box;background:var(--soft);color:var(--text)">'
      + (partyType === 'vendor' ? '<label style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:.4rem;margin-top:.75rem"><input type="checkbox" id="bpm-1099"> 1099 vendor</label>' : '')
      + '<div style="display:flex;gap:.5rem;margin-top:1.25rem;justify-content:flex-end">'
      + '<button onclick="document.getElementById(\'bank-party-modal\').remove();renderBank(gc())" style="padding:7px 16px;border:1px solid var(--border);border-radius:8px;background:none;cursor:pointer;font-size:13px;font-family:\'DM Sans\',sans-serif;color:var(--text)">Cancel</button>'
      + '<button onclick="bankSaveNewParty(\'' + id + '\',\'' + partyType + '\')" style="padding:7px 16px;border:none;border-radius:8px;background:var(--green);color:#fff;cursor:pointer;font-size:13px;font-weight:500;font-family:\'DM Sans\',sans-serif">Add ' + partyType + '</button>'
      + '</div></div>';
    document.body.appendChild(modal);
    setTimeout(function(){ var n=document.getElementById('bpm-name');if(n)n.focus(); }, 50);
    return;
  }

  t.vendorName = val;
  sv();
}

function bankSaveNewParty(txnId, partyType) {
  var c = gc(); if (!c) return;
  var nameEl = document.getElementById('bpm-name');
  var name = nameEl ? nameEl.value.trim() : '';
  if (!name) { nameEl && (nameEl.style.borderColor = 'var(--red)'); return; }
  var is1099El = document.getElementById('bpm-1099');
  var is1099 = is1099El ? is1099El.checked : false;
  if (partyType === 'vendor') {
    if (!c.vendors) c.vendors = [];
    if (!c.vendors.find(function(v){ return v.name.toLowerCase() === name.toLowerCase(); })) {
      c.vendors.push({ id: uid(), name: name, is1099: is1099, defaultCat: '' });
    }
  } else {
    if (!c.customers) c.customers = [];
    if (!c.customers.find(function(cu){ return cu.name.toLowerCase() === name.toLowerCase(); })) {
      c.customers.push({ id: uid(), name: name });
    }
  }
  var t = (c.bankTransactions || []).find(function(x){ return x.id === txnId; });
  if (t) t.vendorName = name;
  sv();
  var modal = document.getElementById('bank-party-modal');
  if (modal) modal.parentNode.removeChild(modal);
  renderBank(gc());
  _bankToast((partyType === 'vendor' ? 'Vendor' : 'Customer') + ' "' + name + '" added.');
}

function bankSetAcct(id, val, acctType) {
  var c = gc(); if (!c) return;
  var t = (c.bankTransactions || []).find(function(x){ return x.id === id; });
  if (!t) return;

  if (val === '__new__') {
    // Store pending txnId and type so saveAcct() can link back
    window._bankPendingAcctTxnId = id;
    window._bankPendingAcctType = acctType;
    // Ensure dynamic modals are built so m-coa exists
    if (!g('m-coa') && typeof buildDynMods === 'function') buildDynMods(c.type);
    // Pre-select the right type in the COA modal
    if (typeof resetAcctForm === 'function') resetAcctForm();
    setTimeout(function(){
      var typeEl = g('acct-type');
      if (typeEl) {
        typeEl.value = acctType === 'income' ? 'Income' : 'Expense';
        if (typeof typeEl.onchange === 'function') typeEl.onchange();
      }
    }, 50);
    openM('m-coa');
    return;
  }

  t.acctCode = val;
  sv();
}

function bankToggleAll(checked) {
  document.querySelectorAll('.bank-chk').forEach(function(cb){ cb.checked = checked; });
}

function bankApproveOne(id) {
  var c = gc(); if (!c) return;
  var t = (c.bankTransactions || []).find(function(x){ return x.id === id; });
  if (!t) return;
  // Account is required
  if (!t.acctCode) {
    var row = document.getElementById('btr-' + id);
    var acctSel = row && row.querySelector('select[onchange*="bankSetAcct"]');
    if (acctSel) {
      acctSel.style.borderColor = 'var(--red)';
      acctSel.style.boxShadow = '0 0 0 2px rgba(192,57,43,.2)';
      setTimeout(function(){ acctSel.style.borderColor=''; acctSel.style.boxShadow=''; }, 2500);
    }
    _bankToast('⚠ Select an account before posting.');
    return;
  }
  _bankPost(c, t);
  t.approved = true;
  t.postedAt = new Date().toISOString();
  sv(); renderAll();
  setTimeout(function(){ renderBank(gc()); _bankRefreshActivePanel(gc()); }, 50);
  _bankToast('Posted: ' + t.description + ' — ' + fmt(t.amount));
}

function bankApproveSelected() {
  var c = gc(); if (!c) return;
  var checked = [];
  document.querySelectorAll('.bank-chk:checked').forEach(function(cb){
    checked.push(cb.getAttribute('data-id'));
  });
  if (!checked.length) { alert('Select at least one transaction.'); return; }
  // Check all selected have an account
  var missing = [];
  checked.forEach(function(id) {
    var t = (c.bankTransactions || []).find(function(x){ return x.id === id; });
    if (t && !t.approved && !t.acctCode) missing.push(t.description || id);
  });
  if (missing.length) {
    alert('⚠ The following transactions are missing an account code:\n\n' + missing.join('\n') + '\n\nPlease select an account for each before posting.');
    return;
  }
  var count = 0;
  checked.forEach(function(id) {
    var t = (c.bankTransactions || []).find(function(x){ return x.id === id; });
    if (!t || t.approved) return;
    _bankPost(c, t);
    t.approved = true;
    t.postedAt = new Date().toISOString();
    count++;
  });
  sv(); renderAll();
  setTimeout(function(){ renderBank(gc()); _bankRefreshActivePanel(gc()); }, 50);
  _bankToast(count + ' transaction' + (count !== 1 ? 's' : '') + ' posted to your books.');
}

function _bankRefreshActivePanel(c) {
  if (!c) return;
  var panels = [
    { id: 'p-npexp',    fn: function(){ if (typeof renderNpExp   === 'function') renderNpExp(c);   } },
    { id: 'p-sbexp',    fn: function(){ if (typeof renderSbExp   === 'function') renderSbExp(c);   } },
    { id: 'p-peexp',    fn: function(){ if (typeof renderPeExp   === 'function') renderPeExp(c);   } },
    { id: 'p-sbrev',    fn: function(){ if (typeof renderRev     === 'function') renderRev(c);     } },
    { id: 'p-npinc',    fn: function(){ if (typeof renderNpInc   === 'function') renderNpInc(c);   } },
    { id: 'p-cashflow', fn: function(){ if (typeof renderCF      === 'function') renderCF(c);      } },
    { id: 'p-recon',    fn: function(){ if (typeof renderReconciliation === 'function') renderReconciliation(c); } }
  ];
  panels.forEach(function(p) {
    var el = g(p.id);
    if (el && el.style.display !== 'none' && el.innerHTML.trim()) {
      try { p.fn(); } catch(e) {}
    }
  });
}

function bankDeletePending(id) {
  var c = gc(); if (!c) return;
  var idx = (c.bankTransactions || []).findIndex(function(x){ return x.id === id; });
  if (idx < 0) return;
  c.bankTransactions.splice(idx, 1);
  sv(); renderBank(c);
}

function bankDeleteSelected() {
  var c = gc(); if (!c) return;
  var checked = [];
  document.querySelectorAll('.bank-chk:checked').forEach(function(cb){
    checked.push(cb.getAttribute('data-id'));
  });
  if (!checked.length) { alert('Select at least one transaction.'); return; }
  c.bankTransactions = (c.bankTransactions || []).filter(function(t){
    return checked.indexOf(t.id) < 0;
  });
  sv(); renderBank(c);
}

function bankDeleteTemplate(idx) {
  var c = gc(); if (!c) return;
  if (!confirm('Remove this template? Future statements from this bank will need to be re-mapped.')) return;
  (c.bankTemplates || []).splice(idx, 1);
  sv(); renderBank(c);
}

// ── POST TO BOOKS ─────────────────────────────────────────────
function _bankPost(c, t) {
  var id = uid();
  // Derive the bankId from RECON_ACCT or from the transaction's bankName.
  // Priority: 1) RECON_ACCT if it points to a specific bank
  //           2) Look up bank account by t.bankName
  //           3) Leave unset — recon filter handles untagged items
  var tagBankId = null;
  if (typeof RECON_ACCT === 'string' && RECON_ACCT.indexOf('bank:') === 0) {
    var _bid = RECON_ACCT.slice(5);
    if (_bid && _bid !== 'default') tagBankId = _bid;
  }
  if (!tagBankId && t.bankName && c.bankAccounts && c.bankAccounts.length) {
    var _ba = c.bankAccounts.find(function(b){
      return b.name && b.name.toLowerCase() === (t.bankName||'').toLowerCase();
    });
    if (_ba) tagBankId = _ba.id;
  }

  // Skip if already imported (duplicate detection)
  if(typeof _bankTxnExists==='function'&&_bankTxnExists(c,t.id))return;

  if (t.type === 'credit') {
    // Income / Revenue
    if (c.type === 'sb') {
      if (!c.revenue) c.revenue = [];
      var revItem = {
        id: id, name: t.description, act: t.amount,
        date: t.date, cat: t.category,
        acctCode: t.acctCode || '',
        vendor1099: t.vendorName || '',
        reconciled: false, fromBank: true, bankTxnId: t.id
      };
      if (tagBankId) revItem.bankId = tagBankId;
      c.revenue.push(revItem);
    } else {
      if (!c.income) c.income = [];
      var incItem = {
        id: id, name: t.description, recv: t.amount, proj: t.amount,
        date: t.date, cat: t.category,
        acctCode: t.acctCode || '',
        vendor1099: t.vendorName || '',
        reconciled: false, fromBank: true, bankTxnId: t.id,
        bankName: t.bankName || ''
      };
      if (tagBankId) incItem.bankId = tagBankId;
      // Link grant: prefer manually selected, then auto-match by name
      if (t.category === 'Grant') {
        if (t.grantId) {
          incItem.grantId = t.grantId;
          incItem.fromGrantId = t.grantId;
        } else if (c.grants && c.grants.length) {
          var _dl = t.description.toLowerCase();
          var _matched = c.grants.find(function(gr){
            return _dl.indexOf((gr.name||'').toLowerCase()) >= 0
              || (gr.name||'').toLowerCase().indexOf(_dl) >= 0
              || (gr.funder && _dl.indexOf(gr.funder.toLowerCase()) >= 0);
          });
          if (_matched) { incItem.grantId = _matched.id; incItem.fromGrantId = _matched.id; }
        }
        // If an auto-created income entry already exists for this grant (recv=0),
        // update it instead of creating a duplicate
        if (incItem.grantId) {
          var _existingInc = (c.income||[]).find(function(r){
            return r.fromGrantId === incItem.grantId && Number(r.recv||0) === 0 && !r.fromBank;
          });
          if (_existingInc) {
            _existingInc.recv = t.amount;
            _existingInc.bankId = incItem.bankId || '';
            _existingInc.bankTxnId = t.id;
            _existingInc.fromBank = true;
            _existingInc.date = t.date || _existingInc.date;
            sv(); renderAll();
            return; // Don't push a new income entry
          }
        }
      }
      c.income.push(incItem);
    }
  } else {
    // Expense
    if (!c.expenses) c.expenses = [];
    var expItem = {
      id: id, desc: t.description, amt: t.amount,
      date: t.date, cat: t.category,
      acctCode: t.acctCode || '',
      vendor1099: t.vendorName || '',
      reconciled: false, fromBank: true, bankTxnId: t.id,
      bankName: t.bankName || ''
    };
    if (tagBankId) expItem.bankId = tagBankId;
    if (t.grantId) {
      expItem.grantId = t.grantId;
      if (t.grantPct != null) expItem.grantPct = t.grantPct;
    }
    c.expenses.push(expItem);
  }
}

// ── UPLOAD ENTRY POINT ────────────────────────────────────────
function bankDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  var dz = document.getElementById('bank-drop-zone');
  if (dz) {
    dz.style.borderColor = 'var(--np)';
    dz.style.background  = 'var(--np-bg)';
  }
}

function bankDragLeave(e) {
  e.preventDefault();
  var dz = document.getElementById('bank-drop-zone');
  if (dz) {
    dz.style.borderColor = '';
    dz.style.background  = '';
  }
}

function bankDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  var dz = document.getElementById('bank-drop-zone');
  if (dz) { dz.style.borderColor = ''; dz.style.background = ''; }
  var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    alert('Please drop a PDF file.');
    return;
  }
  bankHandlePDF(file);
}

var _BANK_HANDLING = false;

function bankOpenUpload() {
  if (_BANK_HANDLING) return;
  if (document.getElementById('bank-file-input')) return;
  var fi = document.createElement('input');
  fi.type = 'file';
  fi.accept = '.pdf';
  fi.id = 'bank-file-input';
  fi.style.display = 'none';
  fi.onchange = function() {
    var file = fi.files && fi.files[0];
    if (fi.parentNode) fi.parentNode.removeChild(fi);
    if (file) bankHandlePDF(file);
  };
  fi.addEventListener('cancel', function() {
    if (fi.parentNode) fi.parentNode.removeChild(fi);
  });
  document.body.appendChild(fi);
  fi.click();
}

// ── MAIN PDF HANDLER ──────────────────────────────────────────
async function bankHandlePDF(file) {
  if (_BANK_HANDLING) return;
  if (!file) return;
  _BANK_HANDLING = true;
  _BANK_PDF_FILE = file;
  var c = gc();
  if (!c) { _BANK_HANDLING = false; return; }

  if (!window.pdfjsLib) {
    alert('PDF reader not loaded. Please refresh and try again.');
    _BANK_HANDLING = false;
    return;
  }

  var templates = c.bankTemplates || [];

  if (!templates.length) {
    _BANK_HANDLING = false;
    _bankStartMapper(file, c, null);
    return;
  }
  if (templates.length === 1) {
    _bankRunTemplate(file, c, templates[0]);
    return;
  }
  _BANK_HANDLING = false;
  _bankShowTemplatePicker(file, c, templates);
}

// ── RUN A KNOWN TEMPLATE AGAINST A PDF ───────────────────────
async function _bankRunTemplate(file, c, tpl) {
  _bankShowProgress('Reading ' + file.name + '…');
  try {
    var lines = await _bankExtractLines(file);
    var txns  = _bankApplyTemplate(lines, tpl, file.name);
    _bankShowProgress('');
    if (txns.length) {
      _bankStoreKeywords(tpl, lines);
      _bankAddPending(c, txns, tpl.bankName, file.name);
      tpl.usageCount = (tpl.usageCount || 0) + 1;
      tpl.lastUsed = new Date().toISOString();
      sv();
      renderBank(c);
      var btn = document.querySelector('[data-panel="bank"]');
      if (btn) switchTab({ target: btn }, 'bank');
      _bankToast(txns.length + ' transactions imported from ' + tpl.bankName + '. Review and post below.');
    } else {
      if (confirm('No transactions found using the template for ' + tpl.bankName + '.\n\nWould you like to re-map this bank statement?')) {
        _bankStartMapper(file, c, tpl);
      }
    }
  } catch(e) {
    _bankShowProgress('');
    alert('Error reading PDF: ' + (e.message || e));
  } finally {
    _BANK_HANDLING = false;
  }
}
function _bankShowTemplatePicker(file, c, templates) {
  var existing = document.getElementById('bank-tpl-picker');
  if (existing) existing.parentNode.removeChild(existing);

  var div = document.createElement('div');
  div.innerHTML = '<div class="overlay open" id="bank-tpl-picker" style="z-index:10001">'
    + '<div class="modal" style="max-width:480px;padding:0;overflow:hidden">'

    // Header
    + '<div style="display:flex;align-items:center;justify-content:space-between;padding:.9rem 1.25rem;border-bottom:1px solid var(--border)">'
    + '<div><div style="font-size:15px;font-weight:600">🏦 Which bank is this statement from?</div>'
    + '<div style="font-size:11px;color:var(--muted);margin-top:2px">' + escHtml(file.name) + '</div></div>'
    + '<button class="cx" onclick="var m=document.getElementById(\'bank-tpl-picker\');if(m)m.parentNode.removeChild(m)">&#215;</button>'
    + '</div>'

    // Template list
    + '<div style="padding:1rem 1.25rem;display:flex;flex-direction:column;gap:.5rem">'
    + templates.map(function(tpl, i) {
        return '<button onclick="bankPickerSelect(' + i + ')" style="'
          + 'display:flex;align-items:center;gap:.75rem;padding:.75rem 1rem;'
          + 'border:1px solid var(--border);border-radius:10px;background:var(--surface);'
          + 'cursor:pointer;text-align:left;width:100%;font-family:\'DM Sans\',sans-serif;'
          + 'transition:border-color .15s,background .15s" '
          + 'onmouseover="this.style.borderColor=\'var(--np)\';this.style.background=\'var(--np-bg)\'" '
          + 'onmouseout="this.style.borderColor=\'var(--border)\';this.style.background=\'var(--surface)\'">'
          + '<span style="font-size:22px">🏦</span>'
          + '<div style="flex:1">'
          + '<div style="font-size:13px;font-weight:600;color:var(--text)">' + escHtml(tpl.bankName) + '</div>'
          + '<div style="font-size:11px;color:var(--muted);margin-top:1px">'
          + (tpl.usageCount ? tpl.usageCount + ' import' + (tpl.usageCount !== 1 ? 's' : '') : 'Not used yet')
          + (tpl.lastUsed ? ' · Last used ' + tpl.lastUsed.slice(0, 10) : '')
          + '</div></div>'
          + '<span style="font-size:18px;color:var(--muted)">›</span>'
          + '</button>';
      }).join('')
    + '</div>'

    // Footer — option to map as new bank
    + '<div style="padding:.75rem 1.25rem;border-top:1px solid var(--border);text-align:center">'
    + '<button onclick="bankPickerNew()" style="font-size:12px;color:var(--muted);background:none;border:none;cursor:pointer;font-family:\'DM Sans\',sans-serif;text-decoration:underline">This is a different bank — map it as new</button>'
    + '</div>'

    + '</div></div>';
  document.body.appendChild(div.firstChild);
}

function bankPickerSelect(i) {
  var c = gc(); if (!c) return;
  var tpl = (c.bankTemplates || [])[i]; if (!tpl) return;
  var modal = document.getElementById('bank-tpl-picker');
  if (modal) modal.parentNode.removeChild(modal);
  _bankRunTemplate(_BANK_PDF_FILE, c, tpl);
}

function bankPickerNew() {
  var modal = document.getElementById('bank-tpl-picker');
  if (modal) modal.parentNode.removeChild(modal);
  _bankStartMapper(_BANK_PDF_FILE, gc(), null);
}

// ── FIND MATCHING TEMPLATE ────────────────────────────────────
function _bankFindTemplate(c, file) {
  if (!c || !c.bankTemplates || !c.bankTemplates.length) return null;
  for (var i = 0; i < c.bankTemplates.length; i++) {
    var tpl = c.bankTemplates[i];
    if (!tpl.bankName) continue;
    if (tpl.keywords && tpl.keywords.length) {
      var fname = (file.name || '').toLowerCase();
      if (tpl.keywords.some(function(kw){ return fname.indexOf(kw.toLowerCase()) >= 0; })) return tpl;
    }
    var words = tpl.bankName.toLowerCase().split(/\s+/).filter(function(w){ return w.length > 3; });
    var fname2 = (file.name || '').toLowerCase();
    if (words.length && words.every(function(w){ return fname2.indexOf(w) >= 0; })) return tpl;
  }
  return null;
}

function _bankStoreKeywords(tpl, lines) {
  if (!tpl || !lines) return;
  var words = {};
  lines.slice(0, 30).forEach(function(line) {
    (line.text || '').split(/\s+/).forEach(function(w) {
      var clean = w.replace(/[^a-zA-Z]/g, '');
      if (clean.length > 4) words[clean.toLowerCase()] = true;
    });
  });
  tpl.keywords = Object.keys(words).slice(0, 10);
}

// ── EXTRACT TEXT LINES ────────────────────────────────────────
async function _bankExtractLines(file) {
  var ab  = await file.arrayBuffer();
  var doc = await pdfjsLib.getDocument({ data: ab }).promise;
  var lines = [];
  for (var p = 1; p <= doc.numPages; p++) {
    var page = await doc.getPage(p);
    var tc   = await page.getTextContent();
    // Group by Y position (3px buckets) and sort by X for correct reading order
    var byY  = {};
    tc.items.forEach(function(item) {
      var y = Math.round(item.transform[5] / 3) * 3;
      if (!byY[y]) byY[y] = [];
      byY[y].push({ str: item.str, x: item.transform[4], x1: item.transform[4] + (item.width||0), y: item.transform[5], page: p });
    });
    Object.keys(byY).sort(function(a,b){ return b - a; }).forEach(function(y) {
      var items = byY[y].sort(function(a,b){ return a.x - b.x; });
      var line  = items.map(function(i){ return i.str; }).join(' ').trim();
      if (line) lines.push({ text: line, y: Number(y), page: p, items: items });
    });
  }
  return lines;
}

// ── APPLY TEMPLATE TO EXTRACT TRANSACTIONS ────────────────────
function _bankApplyTemplate(lines, tpl, fileName) {
  var txns = [];

  // Template stores column X positions from the mapping clicks
  // txnDateX, txnDescX, txnAmtX — and the Y band where transactions live
  var dateX   = tpl.txnDateX;
  var descX   = tpl.txnDescX;
  var debitX  = tpl.txnDebitX;
  var creditX = tpl.txnCreditX;
  // Fallback: if old single-column template, use txnAmtX for debit
  if (debitX === undefined || debitX === null) debitX = tpl.txnAmtX;
  var colTol  = 60; // pixels of tolerance for column matching

  // Auto-categorization
  function autoCat(desc, type) {
    var dl = (desc || '').toLowerCase();
    if (type === 'credit') {
      if (/payroll|direct deposit|ach credit|salary|wages/.test(dl)) return 'Payroll Deposit';
      if (/interest/.test(dl))                                        return 'Interest Income';
      if (/grant/.test(dl))                                           return 'Grant';
      if (/donation|contrib/.test(dl))                               return 'Donation';
      return 'Other Income';
    }
    if (/payroll|paycheck|adp|paychex/.test(dl))                     return 'Payroll';
    if (/rent|lease/.test(dl))                                        return 'Rent';
    if (/utility|electric|gas|water|pge|con ed/.test(dl))            return 'Utilities';
    if (/insurance/.test(dl))                                         return 'Insurance';
    if (/service charge|monthly fee|bank fee|maintenance fee/.test(dl)) return 'Bank Fees';
    if (/amazon|walmart|target|costco/.test(dl))                     return 'Supplies';
    if (/verizon|at&t|t-mobile|comcast|spectrum/.test(dl))          return 'Utilities';
    if (/google|microsoft|adobe|zoom|slack|dropbox/.test(dl))       return 'Software';
    if (/transfer|zelle|venmo|paypal/.test(dl))                     return 'Transfer';
    if (/atm|cash withdrawal/.test(dl))                              return 'Cash';
    if (/loan|mortgage/.test(dl))                                    return 'Loan Payment';
    if (/tax|irs/.test(dl))                                          return 'Taxes';
    if (/travel|hotel|airline|uber|lyft/.test(dl))                  return 'Travel';
    if (/restaurant|café|coffee|starbucks|doordash/.test(dl))       return 'Meals';
    return 'Uncategorized';
  }

  // Skip lines
  var SKIP = /beginning balance|ending balance|opening balance|closing balance|total deposit|total withdrawal|total debit|total credit|account summary|statement period|available balance|service charge total|subtotal|page \d/i;

  var AMT_RE = /[\$\(]?\d{1,3}(?:,\d{3})*\.\d{2}\)?/g;

  function parseAmt(s) {
    if (!s) return null;
    var neg = /^\(/.test(s.trim()) || /^-/.test(s.trim());
    var n   = parseFloat(s.replace(/[$,()\s]/g,'').replace(/^-/,''));
    return isNaN(n) ? null : (neg ? -n : n);
  }

  function parseDate(s) {
    if (!s) return null;
    var m = s.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
    if (m) {
      var yr = m[3] ? (m[3].length === 2 ? '20'+m[3] : m[3]) : new Date().getFullYear();
      return m[1].padStart(2,'0')+'/'+m[2].padStart(2,'0')+'/'+yr;
    }
    var months = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
    var m2 = s.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2}),?\s+(\d{4})/i);
    if (m2 && months[m2[1].toLowerCase().slice(0,3)]) {
      return months[m2[1].toLowerCase().slice(0,3)].toString().padStart(2,'0')+'/'+m2[2].padStart(2,'0')+'/'+m2[3];
    }
    return null;
  }

  // If we have column positions from template, use them
  if (dateX !== undefined && descX !== undefined && (debitX !== null && debitX !== undefined)) {
    var seen = {};
    lines.forEach(function(line) {
      if (SKIP.test(line.text)) return;

      var dateItem   = line.items.find(function(it){ return Math.abs(it.x - dateX)  < colTol; });
      var descItem   = line.items.find(function(it){ return Math.abs(it.x - descX)  < colTol; });
      var debitItem  = line.items.find(function(it){ return Math.abs(it.x - debitX) < colTol; });
      var creditItem = (creditX !== null && creditX !== undefined)
        ? line.items.find(function(it){ return Math.abs(it.x - creditX) < colTol; })
        : null;

      if (!dateItem) return;
      if (!debitItem && !creditItem) return;

      var date = parseDate(dateItem.str);
      if (!date) return;

      // Two-column layout: debit = expense, credit = income
      var amt  = null;
      var type = 'debit';
      var da   = debitItem  ? parseAmt(debitItem.str)  : null;
      var ca   = creditItem ? parseAmt(creditItem.str) : null;

      if (da !== null && Math.abs(da) > 0 && ca !== null && Math.abs(ca) > 0) {
        // Both columns have a value — debit (expense) wins
        amt = Math.abs(da); type = 'debit';
      } else if (da !== null && Math.abs(da) > 0) {
        amt = Math.abs(da); type = 'debit';
      } else if (ca !== null && Math.abs(ca) > 0) {
        amt = Math.abs(ca); type = 'credit';
      }

      if (!amt || amt === 0) return;

      var desc = descItem
        ? descItem.str
        : line.text.replace(dateItem.str,'')
            .replace(debitItem  ? debitItem.str  : '','')
            .replace(creditItem ? creditItem.str : '','').trim();
      desc = desc.replace(/\s{2,}/g,' ').trim();
      if (!desc) desc = 'Transaction';

      var key = date + '|' + amt.toFixed(2) + '|' + desc.slice(0,15);
      if (seen[key]) return;
      seen[key] = true;

      txns.push({
        id: uid(), date: date, description: desc,
        amount: amt, type: type,
        category: autoCat(desc, type),
        sourceFile: fileName, approved: false
      });
    });
  } else {
    // Fallback: scan every line for amount + nearest date
    var dateLine = {};
    lines.forEach(function(line, i) {
      dateLine[i] = parseDate(line.text);
    });

    var seen = {};
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (SKIP.test(line.text)) continue;

      AMT_RE.lastIndex = 0;
      var amts = [];
      var am;
      while ((am = AMT_RE.exec(line.text)) !== null) amts.push(am[0]);
      if (!amts.length) continue;

      var txnDate = null;
      var descParts = [];

      var selfDate = parseDate(line.text);
      if (selfDate) {
        txnDate = selfDate;
        var afterDate = line.text.replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/, '').trim();
        afterDate = afterDate.replace(AMT_RE, '').trim();
        if (afterDate.length > 1) descParts.push(afterDate);
      } else {
        for (var j = i-1; j >= Math.max(0, i-6); j--) {
          if (dateLine[j]) { txnDate = dateLine[j]; break; }
        }
        var cleanLine = line.text.replace(AMT_RE, '').trim();
        if (cleanLine.length > 1) descParts.push(cleanLine);
      }

      if (!txnDate) continue;

      var amt = parseAmt(amts[0]);
      if (amt === null || amt === 0) continue;

      // Determine type using column X position hint if available,
      // otherwise fall back to sign (negative = debit, positive = credit).
      // Note: most bank PDFs show debits as positive numbers with no sign,
      // so sign-only detection is unreliable — that's why template mapping matters.
      var type;
      var amtMatch = AMT_RE.exec(line.text); // re-exec to get match index
      AMT_RE.lastIndex = 0;
      // Find x position of the amount token in this line's items
      var amtStr = amts[0];
      var amtItem = line.items.find(function(it){ return it.str === amtStr || it.str.replace(/[$,\s]/g,'') === amtStr.replace(/[$,\s]/g,''); });
      if (amtItem && debitX !== null && debitX !== undefined && creditX !== null && creditX !== undefined) {
        // Both columns known — pick whichever is closer
        var dDist = Math.abs(amtItem.x - debitX);
        var cDist = Math.abs(amtItem.x - creditX);
        type = dDist <= cDist ? 'debit' : 'credit';
      } else if (amtItem && debitX !== null && debitX !== undefined) {
        type = Math.abs(amtItem.x - debitX) < colTol ? 'debit' : 'credit';
      } else {
        // No column hints — use sign; negatives and parentheticals are debits
        type = amt < 0 ? 'debit' : 'credit';
      }
      var absAmt = Math.abs(amt);

      var key = txnDate + '|' + absAmt.toFixed(2) + '|' + desc.slice(0,15);
      if (seen[key]) continue;
      seen[key] = true;

      txns.push({
        id: uid(), date: txnDate, description: desc,
        amount: absAmt, type: type,
        category: autoCat(desc, type),
        sourceFile: fileName, approved: false
      });
    }
  }

  txns.sort(function(a,b){ return new Date(a.date) - new Date(b.date); });

  // Diagnostic — always log so we can see what happened
  console.log('[bank] Template columns — dateX:', dateX, 'descX:', descX, 'debitX:', debitX, 'creditX:', creditX);
  console.log('[bank] Lines scanned:', lines.length, '| Transactions found:', txns.length);
  if (txns.length) {
    console.log('[bank] Types:', txns.map(function(t){ return t.type + ':' + t.amount; }).join(', '));
  } else {
    console.warn('[bank] Zero transactions extracted. First 15 lines:');
    lines.slice(0, 15).forEach(function(l, i){ console.log('  line', i, JSON.stringify(l.text), '| items:', l.items.map(function(it){ return Math.round(it.x) + ':' + it.str; }).join(', ')); });
  }

  return txns;
}

// ── ADD TO PENDING ────────────────────────────────────────────
function _bankAddPending(c, txns, bankName, fileName) {
  if (!c.bankTransactions) c.bankTransactions = [];
  txns.forEach(function(t) { c.bankTransactions.push(t); });
}

// ── TEMPLATE MAPPER ───────────────────────────────────────────
async function _bankStartMapper(file, c, existingTpl) {
  _BANK_PDF_FILE     = file;
  _BANK_MAP_STEP     = 0;
  _BANK_MAP_TEMPLATE = existingTpl ? JSON.parse(JSON.stringify(existingTpl)) : {
    bankName: '', keywords: [], createdAt: new Date().toISOString(), usageCount: 0,
    openingBalX: null, openingBalY: null,
    closingBalX: null, closingBalY: null,
    periodStartX: null, periodStartY: null,
    periodEndX: null,   periodEndY: null,
    txnDateX: null, txnDescX: null, txnDebitX: null, txnCreditX: null,
    mappedText: {}
  };

  // Build mapper modal
  _bankInjectMapperModal();
  var modal = g('bank-mapper-modal');
  if (!modal) return;
  modal.classList.add('open');

  // Load PDF into canvas
  try {
    var ab  = await file.arrayBuffer();
    _BANK_PDF_DOC = await pdfjsLib.getDocument({ data: ab }).promise;
    await _bankRenderPage(1);
    _bankShowStep(0);
  } catch(e) {
    alert('Could not open PDF: ' + (e.message || e));
    modal.classList.remove('open');
  }
}

function _bankInjectMapperModal() {
  if (g('bank-mapper-modal')) return;
  var div = document.createElement('div');
  div.innerHTML =
    '<div class="overlay" id="bank-mapper-modal" style="z-index:10000">'
    + '<div class="modal" style="max-width:900px;max-height:92vh;display:flex;flex-direction:column;padding:0;overflow:hidden">'

    // Header
    + '<div style="display:flex;align-items:center;justify-content:space-between;padding:.9rem 1.25rem;border-bottom:1px solid var(--border);flex-shrink:0">'
    + '<div><div style="font-size:15px;font-weight:600">🏦 Set Up Bank Import</div>'
    + '<div style="font-size:11px;color:var(--muted)">Teach Clarity where to find information on your bank\'s PDF</div></div>'
    + '<button class="cx" onclick="bankMapperCancel()" style="flex-shrink:0">&#215;</button>'
    + '</div>'

    // Step indicator
    + '<div id="bank-map-steps" style="display:flex;gap:0;border-bottom:1px solid var(--border);flex-shrink:0;overflow-x:auto;padding:.6rem 1.25rem;gap:.4rem"></div>'

    // Prompt
    + '<div id="bank-map-prompt" style="padding:.75rem 1.25rem;background:var(--np-bg);border-bottom:1px solid var(--border);flex-shrink:0">'
    + '<div id="bank-map-step-counter" style="font-size:13px;font-weight:500;color:var(--np)">Step 1 of ' + _BANK_STEPS.length + '</div>'
    + '<div id="bank-map-prompt-text" style="font-size:13px;margin-top:2px"></div>'
    + '</div>'

    // Bank name row (shown on step 0) — filled dynamically by _bankPopulateNameRow()
    + '<div id="bank-name-row" style="padding:.75rem 1.25rem;border-bottom:1px solid var(--border);flex-shrink:0;display:none"></div>'

    // Canvas area
    + '<div id="bank-canvas-wrap" style="flex:1;overflow:auto;position:relative;background:#888;cursor:crosshair">'
    + '<canvas id="bank-pdf-canvas" style="display:block"></canvas>'
    + '<div id="bank-map-dot" style="position:absolute;width:18px;height:18px;border-radius:50%;background:var(--np);border:2px solid #fff;pointer-events:none;display:none;transform:translate(-50%,-50%);box-shadow:0 2px 8px rgba(0,0,0,.3)"></div>'
    + '</div>'

    // Footer buttons
    + '<div style="display:flex;align-items:center;justify-content:space-between;padding:.75rem 1.25rem;border-top:1px solid var(--border);flex-shrink:0">'
    + '<div style="display:flex;gap:.5rem">'
    + '<button onclick="bankMapperPrev()" id="bank-map-prev" style="padding:7px 16px;border:1px solid var(--border);border-radius:7px;background:none;cursor:pointer;font-size:13px;font-family:\'DM Sans\',sans-serif;color:var(--text)">← Back</button>'
    + '<button onclick="bankMapperSkip()" style="padding:7px 16px;border:1px solid var(--border);border-radius:7px;background:none;cursor:pointer;font-size:13px;font-family:\'DM Sans\',sans-serif;color:var(--muted)">Skip this field</button>'
    + '</div>'
    + '<div style="display:flex;gap:.5rem">'
    + '<div id="bank-map-page-nav" style="display:flex;align-items:center;gap:.5rem;font-size:12px;color:var(--muted)">'
    + '<button onclick="bankMapperPagePrev()" style="padding:4px 8px;border:1px solid var(--border);border-radius:5px;background:none;cursor:pointer;font-size:11px">◄</button>'
    + '<span id="bank-map-page-label">Page 1</span>'
    + '<button onclick="bankMapperPageNext()" style="padding:4px 8px;border:1px solid var(--border);border-radius:5px;background:none;cursor:pointer;font-size:11px">►</button>'
    + '</div>'
    + '<button onclick="bankMapperNext()" id="bank-map-next" style="padding:7px 16px;border:none;border-radius:7px;background:var(--np);color:#fff;cursor:pointer;font-size:13px;font-weight:500;font-family:\'DM Sans\',sans-serif">Next →</button>'
    + '<button onclick="bankMapperFinish()" id="bank-map-finish" style="padding:7px 16px;border:none;border-radius:7px;background:var(--green);color:#fff;cursor:pointer;font-size:13px;font-weight:500;font-family:\'DM Sans\',sans-serif;display:none">Save Template & Import</button>'
    + '</div>'
    + '</div>'

    + '</div></div>';
  document.body.appendChild(div.firstChild);

  // Wire canvas click
  var canvas = g('bank-pdf-canvas');
  if (canvas) {
    canvas.addEventListener('click', function(e) {
      var rect = canvas.getBoundingClientRect();
      var x = (e.clientX - rect.left) / _BANK_SCALE;
      var y = (e.clientY - rect.top)  / _BANK_SCALE;
      _bankMapClick(x, y, e.clientX - rect.left, e.clientY - rect.top);
    });
  }
}

async function _bankRenderPage(pageNum) {
  if (!_BANK_PDF_DOC) return;
  _BANK_PDF_PAGE = pageNum;
  var page   = await _BANK_PDF_DOC.getPage(pageNum);
  var vp     = page.getViewport({ scale: _BANK_SCALE });
  var canvas = g('bank-pdf-canvas'); if (!canvas) return;
  _BANK_CANVAS = canvas;
  canvas.width  = vp.width;
  canvas.height = vp.height;
  var ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  var lbl = g('bank-map-page-label');
  if (lbl) lbl.textContent = 'Page ' + pageNum + ' of ' + _BANK_PDF_DOC.numPages;
}

function _bankShowStep(step) {
  _BANK_MAP_STEP = step;
  var stepInfo = _BANK_STEPS[step];
  if (!stepInfo) return;

  // Update prompt
  var prompt = g('bank-map-prompt');
  var promptText = g('bank-map-prompt-text');
  var stepCounter = g('bank-map-step-counter');
  if (prompt) prompt.style.background = 'var(--np-bg)';
  if (promptText) promptText.textContent = stepInfo.prompt;
  if (stepCounter) stepCounter.textContent = 'Step ' + (step + 1) + ' of ' + _BANK_STEPS.length;

  // Update step header
  var stepsEl = g('bank-map-steps');
  if (stepsEl) {
    stepsEl.innerHTML = _BANK_STEPS.map(function(s, i) {
      var done = _BANK_MAP_TEMPLATE.mappedText && _BANK_MAP_TEMPLATE.mappedText[s.key];
      var active = i === step;
      return '<div style="display:flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:500;white-space:nowrap;'
        + (active ? 'background:var(--np);color:#fff' : done ? 'background:var(--green-bg);color:var(--green)' : 'color:var(--muted)') + '">'
        + (done && !active ? '✓ ' : (i+1) + '. ')
        + s.label + '</div>';
    }).join('');
  }

  // Show/hide bank name row — populate dropdown on step 0
  var nameRow = g('bank-name-row');
  if (nameRow) {
    if (step === 0) { _bankPopulateNameRow(nameRow); nameRow.style.display = 'block'; }
    else { nameRow.style.display = 'none'; }
  }

  // Show/hide buttons
  var prev   = g('bank-map-prev');
  var next   = g('bank-map-next');
  var finish = g('bank-map-finish');
  // txnDate is step 5 — once user has mapped a transaction date, they can finish
  var canFinish = step >= 7 && _BANK_MAP_TEMPLATE && _BANK_MAP_TEMPLATE.bankName;
  if (prev)   prev.style.display   = step > 0 ? '' : 'none';
  if (next)   next.style.display   = step < _BANK_STEPS.length - 1 ? '' : 'none';
  if (finish) finish.style.display = canFinish ? '' : 'none';

  // Clear dot
  var dot = g('bank-map-dot');
  if (dot) dot.style.display = 'none';
}

function _bankMapClick(pdfX, pdfY, canvasX, canvasY) {
  var step = _BANK_STEPS[_BANK_MAP_STEP];
  if (!step) return;

  // Show dot on canvas
  var dot = g('bank-map-dot');
  if (dot) {
    dot.style.display = 'block';
    dot.style.left    = canvasX + 'px';
    dot.style.top     = canvasY + 'px';
  }

  // Store position and detected text (position-based for now)
  if (!_BANK_MAP_TEMPLATE.mappedText) _BANK_MAP_TEMPLATE.mappedText = {};

  if (step.key === 'bankName') {
    var sel2 = g('bank-name-select');
    var ni2  = g('bank-name-input');
    var rn   = (sel2 && sel2.value && sel2.value !== '__new__') ? sel2.value.trim() : (ni2 ? ni2.value.trim() : '');
    _BANK_MAP_TEMPLATE.bankName = rn || 'My Bank';
    _BANK_MAP_TEMPLATE.mappedText[step.key] = _BANK_MAP_TEMPLATE.bankName;
  } else if (step.key === 'txnDate') {
    _BANK_MAP_TEMPLATE.txnDateX = pdfX;
    _BANK_MAP_TEMPLATE.mappedText[step.key] = 'x=' + Math.round(pdfX);
  } else if (step.key === 'txnDesc') {
    _BANK_MAP_TEMPLATE.txnDescX = pdfX;
    _BANK_MAP_TEMPLATE.mappedText[step.key] = 'x=' + Math.round(pdfX);
  } else if (step.key === 'txnDebit') {
    _BANK_MAP_TEMPLATE.txnDebitX = pdfX;
    _BANK_MAP_TEMPLATE.mappedText[step.key] = 'x=' + Math.round(pdfX);
  } else if (step.key === 'txnCredit') {
    _BANK_MAP_TEMPLATE.txnCreditX = pdfX;
    _BANK_MAP_TEMPLATE.mappedText[step.key] = 'x=' + Math.round(pdfX);
  } else if (step.key === 'openingBal') {
    _BANK_MAP_TEMPLATE.openingBalX = pdfX;
    _BANK_MAP_TEMPLATE.openingBalY = pdfY;
    _BANK_MAP_TEMPLATE.mappedText[step.key] = 'x=' + Math.round(pdfX);
  } else if (step.key === 'closingBal') {
    _BANK_MAP_TEMPLATE.closingBalX = pdfX;
    _BANK_MAP_TEMPLATE.closingBalY = pdfY;
    _BANK_MAP_TEMPLATE.mappedText[step.key] = 'x=' + Math.round(pdfX);
  } else if (step.key === 'periodStart') {
    _BANK_MAP_TEMPLATE.periodStartX = pdfX;
    _BANK_MAP_TEMPLATE.mappedText[step.key] = 'x=' + Math.round(pdfX);
  } else if (step.key === 'periodEnd') {
    _BANK_MAP_TEMPLATE.periodEndX = pdfX;
    _BANK_MAP_TEMPLATE.mappedText[step.key] = 'x=' + Math.round(pdfX);
  }

  // Auto-advance after click (except first step which needs bank name typed first)
  if (step.key !== 'bankName') {
    setTimeout(function() { bankMapperNext(); }, 400);
  }
}

function _bankPopulateNameRow(container) {
  var c = gc();
  var currentName = (_BANK_MAP_TEMPLATE && _BANK_MAP_TEMPLATE.bankName) || '';
  var seen = {}, options = [];
  function addOpt(name, group) {
    var key = (name || '').trim().toLowerCase();
    if (!key || seen[key]) return;
    seen[key] = true;
    options.push({ name: name.trim(), group: group });
  }
  ((c && c.bankTemplates) || []).forEach(function(t){ if (t.bankName) addOpt(t.bankName, 'Saved layouts'); });
  ((c && c.bankAccounts)  || []).forEach(function(b){ if (b.name)     addOpt(b.name,     'Bank accounts'); });
  ((c && c.accounts)      || []).filter(function(a){
    return (a.type === 'Asset' || a.type === 'Bank' || a.type === 'Cash') && a.active !== false;
  }).forEach(function(a){ addOpt(a.name || a.cat, 'Chart of accounts'); });

  var s = 'padding:6px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;font-family:\'DM Sans\',sans-serif;background:var(--surface);color:var(--text)';
  var html = '<div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap"><label style="font-size:12px;font-weight:500;white-space:nowrap">Bank account:</label>';
  if (options.length) {
    var groups = {};
    options.forEach(function(o){ if (!groups[o.group]) groups[o.group] = []; groups[o.group].push(o.name); });
    html += '<select id="bank-name-select" onchange="bankNameSelectChange(this.value)" style="flex:1;' + s + '">';
    html += '<option value="">— Select a bank account —</option>';
    Object.keys(groups).forEach(function(grp) {
      html += '<optgroup label="' + escHtml(grp) + '">';
      groups[grp].forEach(function(n){ html += '<option value="' + escHtml(n) + '"' + (n === currentName ? ' selected' : '') + '>' + escHtml(n) + '</option>'; });
      html += '</optgroup>';
    });
    html += '<option value="__new__">✏ Enter a new name…</option></select>';
    var showInp = currentName && !seen[currentName.toLowerCase()];
    html += '<input id="bank-name-input" type="text" placeholder="e.g. First National Checking" value="' + escHtml(showInp ? currentName : '') + '" style="flex:1;' + s + ';display:' + (showInp ? 'block' : 'none') + '">';
  } else {
    html += '<input id="bank-name-input" type="text" placeholder="e.g. Chase Business Checking" value="' + escHtml(currentName) + '" style="flex:1;' + s + '">';
  }
  html += '</div>';
  container.innerHTML = html;
  if (currentName && !seen[currentName.toLowerCase()]) {
    var sel = g('bank-name-select');
    if (sel) sel.value = '__new__';
    var inp = g('bank-name-input');
    if (inp) inp.style.display = 'block';
  }
}

function bankNameSelectChange(val) {
  var inp = g('bank-name-input');
  if (val === '__new__') {
    if (inp) { inp.style.display = 'block'; inp.value = ''; inp.focus(); }
  } else {
    if (inp) { inp.style.display = 'none'; inp.value = ''; }
    if (_BANK_MAP_TEMPLATE && val) {
      _BANK_MAP_TEMPLATE.bankName = val;
      if (!_BANK_MAP_TEMPLATE.mappedText) _BANK_MAP_TEMPLATE.mappedText = {};
      _BANK_MAP_TEMPLATE.mappedText['bankName'] = val;
    }
  }
}

function bankMapperNext() {
  if (_BANK_MAP_STEP === 0) {
    var sel = g('bank-name-select');
    var inp = g('bank-name-input');
    var name = (sel && sel.value && sel.value !== '__new__') ? sel.value.trim() : (inp ? inp.value.trim() : '');
    if (!name) {
      var target = (sel && sel.value === '__new__' && inp) ? inp : (sel || inp);
      if (target) {
        target.style.borderColor = 'var(--red)';
        if (target.tagName === 'INPUT') { target.placeholder = 'Please enter a bank name first'; target.focus(); }
        setTimeout(function(){ target.style.borderColor = ''; if (target.tagName === 'INPUT') target.placeholder = 'e.g. First National Community Bank'; }, 2500);
      }
      return;
    }
    _BANK_MAP_TEMPLATE.bankName = name;
    if (!_BANK_MAP_TEMPLATE.mappedText) _BANK_MAP_TEMPLATE.mappedText = {};
    _BANK_MAP_TEMPLATE.mappedText['bankName'] = name;
  }
  if (_BANK_MAP_STEP < _BANK_STEPS.length - 1) { _bankShowStep(_BANK_MAP_STEP + 1); }
}

function bankMapperPrev() {
  if (_BANK_MAP_STEP > 0) _bankShowStep(_BANK_MAP_STEP - 1);
}

function bankMapperSkip() {
  if (_BANK_MAP_STEP < _BANK_STEPS.length - 1) { _bankShowStep(_BANK_MAP_STEP + 1); }
}

async function bankMapperPagePrev() {
  if (_BANK_PDF_DOC && _BANK_PDF_PAGE > 1) {
    await _bankRenderPage(_BANK_PDF_PAGE - 1);
  }
}

async function bankMapperPageNext() {
  if (_BANK_PDF_DOC && _BANK_PDF_PAGE < _BANK_PDF_DOC.numPages) {
    await _bankRenderPage(_BANK_PDF_PAGE + 1);
  }
}

async function bankMapperFinish() {
  var c = gc(); if (!c) return;
  if (!_BANK_MAP_TEMPLATE.bankName) {
    alert('Please enter a bank name before saving.');
    return;
  }

  // Save template
  if (!c.bankTemplates) c.bankTemplates = [];
  // Replace existing if same bank name
  var existIdx = c.bankTemplates.findIndex(function(t){
    return t.bankName === _BANK_MAP_TEMPLATE.bankName;
  });
  if (existIdx >= 0) c.bankTemplates[existIdx] = _BANK_MAP_TEMPLATE;
  else c.bankTemplates.push(_BANK_MAP_TEMPLATE);

  // Save file and template refs before closing modal
  var _file = _BANK_PDF_FILE;
  var _tpl  = JSON.parse(JSON.stringify(_BANK_MAP_TEMPLATE));

  // Now extract and import
  bankMapperCancel();
  _bankShowProgress('Extracting transactions…');
  try {
    var lines = await _bankExtractLines(_file);
    var txns  = _bankApplyTemplate(lines, _tpl, _file.name);
    _bankShowProgress('');
    if (txns.length) {
      _bankAddPending(c, txns, _tpl.bankName, _file.name);
      sv();
      renderBank(c);
      var btn = document.querySelector('[data-panel="bank"]');
      if (btn) switchTab({ target: btn }, 'bank');
      _bankToast(txns.length + ' transactions imported from ' + _tpl.bankName + '. Review and post below.');
    } else {
      sv(); // save template even if no transactions found
      renderBank(c);
      _bankToast('Template saved for ' + _tpl.bankName + '. No transactions were detected — you can try importing again.');
    }
  } catch(e) {
    _bankShowProgress('');
    sv();
    alert('Template saved, but extraction failed: ' + (e.message || e));
  }
}

function bankMapperCancel() {
  var modal = g('bank-mapper-modal');
  if (modal) modal.classList.remove('open');
  _BANK_PDF_FILE = null;
  _BANK_PDF_DOC  = null;
  _BANK_MAP_TEMPLATE = null;
}

// ── PROGRESS OVERLAY ──────────────────────────────────────────
function _bankShowProgress(msg) {
  var existing = g('bank-progress');
  if (!msg) { if (existing) existing.parentNode.removeChild(existing); return; }
  if (!existing) {
    existing = document.createElement('div');
    existing.id = 'bank-progress';
    existing.style.cssText =
      'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);'
      + 'background:var(--surface);border:1px solid var(--border);border-radius:12px;'
      + 'padding:1.25rem 2rem;font-size:13px;z-index:99999;'
      + 'box-shadow:0 4px 20px rgba(0,0,0,.12);font-family:\'DM Sans\',sans-serif;'
      + 'display:flex;align-items:center;gap:.75rem;color:var(--text)';
    document.body.appendChild(existing);
  }
  existing.innerHTML = '<span style="font-size:18px">⏳</span>' + escHtml(msg);
}

// ── TOAST ─────────────────────────────────────────────────────
function _bankToast(msg) {
  var t = document.createElement('div');
  t.style.cssText =
    'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);'
    + 'background:var(--text);color:var(--surface);padding:10px 18px;'
    + 'border-radius:8px;font-size:13px;z-index:99999;max-width:480px;'
    + 'text-align:center;line-height:1.5;font-family:\'DM Sans\',sans-serif;'
    + 'box-shadow:0 2px 12px rgba(0,0,0,.2)';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function(){ t.style.transition='opacity .4s'; t.style.opacity='0'; }, 4000);
  setTimeout(function(){ if (t.parentNode) t.parentNode.removeChild(t); }, 4500);
}

// ── PATCH getTabs TO ADD BANK TAB ─────────────────────────────
(function() {
  if (typeof getTabs !== 'function' || getTabs._bankPatched) return;
  var _origGetTabs = getTabs;
  getTabs = function(t) {
    var tabs = _origGetTabs(t);
    // Insert 'bank' tab after 'waypoint' (index 1) or at position 1
    var wp = tabs.findIndex(function(tab){ return tab[0] === 'waypoint'; });
    var insertAt = wp >= 0 ? wp + 1 : 1;
    // Don't add twice
    if (tabs.findIndex(function(tab){ return tab[0] === 'bank'; }) >= 0) return tabs;
    tabs.splice(insertAt, 0, ['bank', '🏦 Bank']);
    return tabs;
  };
  getTabs._bankPatched = true;
})();

// ── PATCH afterSwitch TO RENDER BANK TAB ─────────────────────
(function() {
  if (typeof afterSwitch !== 'function' || afterSwitch._bankPatched) return;
  var _origAfterSwitch = afterSwitch;
  afterSwitch = function(p) {
    if (p === 'bank') { renderBank(gc()); return; }
    _origAfterSwitch(p);
  };
  afterSwitch._bankPatched = true;
})();

// ── PATCH IMPORT MODAL PDF HANDLER ────────────────────────────
// Override impHandlePDF in modals.js to route to bank tab instead
(function() {
  window.addEventListener('load', function() {
    // Replace impHandlePDF with bank-aware version
    window.impHandlePDF = function(input) {
      var file = input && input.files && input.files[0];
      if (!file) return;
      if (typeof closeM === 'function') closeM('m-import');
      setTimeout(function() {
        bankHandlePDF(file);
      }, 150);
    };
  });
})();


// ══════════════════════════════════════════════════════════════
// CREDIT CARD TAB
// renderCCTab(c) — called by afterSwitch('cc') in nav.js
//
// Shows all credit cards with balances, import wizard, review queue.
// Charges post to c.expenses with ccId set.
// Payments post to c.journalEntries (debit bank, credit CC liability).
// ══════════════════════════════════════════════════════════════

function renderCCTab(c) {
  var p = g('p-cc'); if (!p || !c) return;
  // Ensure dynamic modals are built (m-cc lives in buildDynMods)
  if (!g('m-cc') && typeof buildDynMods === 'function') buildDynMods(c.type);

  if (!(c.creditCards || []).length) {
    p.innerHTML = '<div style="max-width:520px;margin:3rem auto;text-align:center">'
      + '<div style="font-size:2rem;margin-bottom:1rem">💳</div>'
      + '<div style="font-size:16px;font-weight:600;margin-bottom:.5rem">No credit cards set up yet</div>'
      + '<div style="font-size:13px;color:var(--muted);margin-bottom:1.5rem">Add a card to track charges, import statements, and reconcile your balance.</div>'
      + '<button class="sv-btn" onclick="openAddCC()" style="max-width:200px;margin:0 auto">+ Add credit card</button>'
      + '</div>';
    return;
  }

  var html = '';

  // ── Per-card section ──────────────────────────────────────
  (c.creditCards || []).forEach(function(cc, ci) {
    var allCharges = (c.expenses || []).filter(function(e){ return e.ccId === cc.id && !e.deleted && !e.voided; });
    var unpaid = allCharges.filter(function(e){ return !e.ccPaid; });
    var paid   = allCharges.filter(function(e){ return e.ccPaid; });
    var balance = unpaid.reduce(function(s,e){ return s + Number(e.amt||0); }, 0);
    var limit = Number(cc.limit || 0);
    var util = limit > 0 ? Math.min(100, Math.round((balance/limit)*100)) : null;

    // Pending import queue for this card
    var pending = (c.bankTransactions || []).filter(function(t){ return t._ccId === cc.id && !t.approved; });

    var chargeRows = unpaid.slice().sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); }).map(function(e) {
      var oi = (c.expenses||[]).indexOf(e);
      return '<tr>'
        + '<td style="color:var(--muted);font-size:11px">' + (e.date||'—') + '</td>'
        + '<td>' + escHtml(e.desc||'—') + '</td>'
        + '<td style="color:var(--muted);font-size:11px">' + escHtml(e.cat||'—') + '</td>'
        + '<td style="color:var(--muted);font-size:11px">' + escHtml(e.vendor1099||'—') + '</td>'
        + '<td class="vr">' + fmt(e.amt) + '</td>'
        + '<td><div class="row-acts">'
        + '<button class="e-btn" style="color:var(--green)" onclick="markCCPaid(' + oi + ')" title="Mark cleared">&#10003;</button>'
        + rb('expenses', oi)
        + '</div></td></tr>';
    }).join('');

    html += '<div class="card" style="border-left:3px solid var(--blue);margin-bottom:1.25rem">'
      // Card header
      + '<div class="c-head">'
      + '<span class="c-title">' + escHtml(cc.name) + (cc.last4 ? ' \u00b7\u00b7\u00b7' + cc.last4 : '') + '</span>'
      + '<div style="display:flex;gap:6px;align-items:center">'
      + (limit ? '<span style="font-size:11px;color:var(--muted)">' + fmt(balance) + ' / ' + fmt(limit) + '</span>' : '<span style="font-size:11px;color:var(--muted)">Balance: ' + fmt(balance) + '</span>')
      + '<button class="add-btn" onclick="openCCCharge(\'' + cc.id + '\')">+ Charge</button>'
      + '<button class="add-btn" style="font-size:11px;background:var(--blue)" onclick="ccImportOpenUpload(\'' + cc.id + '\')">&#8679; Import Statement</button>'
      + '<button class="e-btn" style="border:1px solid var(--border);border-radius:7px;padding:4px 9px;font-size:12px" onclick="editCC(' + ci + ')">&#9998;</button>'
      + '<button class="d-btn" style="border:1px solid var(--red-bg);border-radius:7px;padding:4px 9px;font-size:12px" onclick="deleteCC(\'' + cc.id + '\')">&#215;</button>'
      + '</div></div>'

      // Utilization bar
      + (util !== null ? '<div style="margin-bottom:.5rem"><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:3px"><span>Utilization</span><span>' + util + '%</span></div><div class="pbar" style="height:6px"><div class="pfill" style="width:' + util + '%;background:' + (util>80?'var(--red)':util>50?'var(--amber)':'var(--blue)') + '"></div></div></div>' : '')

      // Pending import queue
      + (pending.length ? _ccRenderPendingQueue(c, cc.id, pending) : '')

      // Unpaid charges
      + '<div style="margin-top:.75rem">'
      + '<div style="font-size:12px;font-weight:500;color:var(--muted);margin-bottom:.4rem">Unpaid charges</div>'
      + (unpaid.length
          ? '<table><thead><tr><th style="width:10%">Date</th><th style="width:30%">Description</th><th style="width:14%">Category</th><th style="width:14%">Vendor</th><th style="width:10%">Amount</th><th></th></tr></thead><tbody>' + chargeRows + '</tbody></table>'
          : '<div style="font-size:12px;color:var(--green);padding:.25rem 0">&#10003; No unpaid charges</div>')
      + '</div>'
      + '</div>';
  });

  // Add card button — clean bottom row
  html += '<div style="margin-top:2rem;padding-top:1rem;border-top:1px solid var(--border);padding-bottom:3rem">'
    + '<button class="add-btn" style="font-size:12px;padding:7px 16px" onclick="openAddCC()">+ Add credit card</button>'
    + '</div>';

  p.innerHTML = html;
}

// ── PENDING IMPORT QUEUE ──────────────────────────────────────
function _ccRenderPendingQueue(c, ccId, pending) {
  var safeId = ccId.replace(/[^a-zA-Z0-9]/g,'_');
  var rows = pending.map(function(t) {
    var ti = (c.bankTransactions||[]).indexOf(t);
    var typeLabel = t.type === 'cc_payment' ? '<span class="badge b-blue" style="font-size:10px">Payment</span>' : '<span class="badge b-amber" style="font-size:10px">Charge</span>';
    return '<tr>'
      + '<td style="width:26px"><input type="checkbox" class="cc-chk-' + safeId + '" data-ti="' + ti + '" style="width:13px;height:13px;cursor:pointer"></td>'
      + '<td style="color:var(--muted);font-size:11px">' + (t.date||'—') + '</td>'
      + '<td>' + escHtml(t.description||t.desc||'—') + '</td>'
      + '<td>' + typeLabel + '</td>'
      + '<td class="vr">' + fmt(t.amount||t.amt) + '</td>'
      + '<td><div class="row-acts">'
      + '<button class="sv-btn" style="font-size:11px;padding:3px 10px" onclick="ccApproveOne(' + ti + ')">Post</button>'
      + '<button class="d-btn" onclick="ccRejectOne(' + ti + ')" title="Remove">&#215;</button>'
      + '</div></td></tr>';
  }).join('');

  return '<div style="background:var(--np-bg);border:1px solid rgba(15,110,86,.15);border-radius:8px;padding:.75rem;margin:.5rem 0">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;flex-wrap:wrap;gap:.5rem">'
    + '<div style="font-size:12px;font-weight:500;color:var(--np)">' + pending.length + ' imported transaction' + (pending.length!==1?'s':'') + ' pending review</div>'
    + '<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">'
    + '<label style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:3px;cursor:pointer"><input type="checkbox" id="cc-chk-all-' + safeId + '" onchange="ccToggleAll(\'' + safeId + '\',this.checked)" style="width:13px;height:13px"> Select all</label>'
    + '<button class="sv-btn" style="font-size:11px;padding:3px 12px" onclick="ccApproveSelected(\'' + ccId + '\',\'' + safeId + '\')">Post selected</button>'
    + '<button class="sv-btn" style="font-size:11px;padding:3px 12px" onclick="ccApproveAll(\'' + ccId + '\')">Post all</button>'
    + '</div></div>'
    + '<table><thead><tr><th style="width:26px"></th><th style="width:10%">Date</th><th style="width:36%">Description</th><th style="width:12%">Type</th><th style="width:12%">Amount</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>'
    + '</div>';
}

// ── POST ACTIONS ──────────────────────────────────────────────
function ccApproveOne(ti) {
  var c = gc(); if (!c) return;
  var t = c.bankTransactions && c.bankTransactions[ti]; if (!t) return;
  _ccPostOne(c, t);
  c.bankTransactions.splice(ti, 1);
  sv(); renderCCTab(c);
}

function ccApproveAll(ccId) {
  var c = gc(); if (!c) return;
  var pending = (c.bankTransactions||[]).filter(function(t){ return t._ccId===ccId && !t.approved; });
  pending.forEach(function(t){ _ccPostOne(c, t); });
  c.bankTransactions = (c.bankTransactions||[]).filter(function(t){ return !(t._ccId===ccId && !t.approved); });
  sv(); renderCCTab(c);
}

function ccToggleAll(safeId, checked) {
  document.querySelectorAll('.cc-chk-' + safeId).forEach(function(cb){ cb.checked = checked; });
}

function ccApproveSelected(ccId, safeId) {
  var c = gc(); if (!c) return;
  var checked = [];
  document.querySelectorAll('.cc-chk-' + safeId + ':checked').forEach(function(cb){
    checked.push(Number(cb.getAttribute('data-ti')));
  });
  if (!checked.length) { alert('Select at least one transaction.'); return; }
  // Sort descending so splicing by index doesn't shift positions
  checked.sort(function(a,b){ return b-a; });
  checked.forEach(function(ti) {
    var t = c.bankTransactions && c.bankTransactions[ti]; if (!t) return;
    _ccPostOne(c, t);
    c.bankTransactions.splice(ti, 1);
  });
  sv(); renderCCTab(c);
  _bankToast(checked.length + ' transaction' + (checked.length!==1?'s':'') + ' posted.');
}

function ccRejectOne(ti) {
  var c = gc(); if (!c) return;
  if (!confirm('Remove this transaction from the import queue?')) return;
  c.bankTransactions.splice(ti, 1);
  sv(); renderCCTab(c);
}

function _ccPostOne(c, t) {
  if (!c.expenses)      c.expenses      = [];
  if (!c.journalEntries) c.journalEntries = [];
  var ccId = t._ccId;
  var cc = (c.creditCards||[]).find(function(x){ return x.id===ccId; });
  var cardName = cc ? cc.name : 'Credit Card';

  if (t.type === 'cc_payment') {
    // Payment: debit bank account, credit CC liability
    var bankName = (t._bankAcctName) || 'Checking Account';
    c.journalEntries.push({
      id: uid(), date: t.date,
      type: 'Credit Card Payment',
      memo: t.description || t.desc || 'Credit Card Payment',
      debitAcct: bankName,
      creditAcct: cardName + ' Payable',
      amt: t.amount || t.amt,
      notes: 'Imported from CC statement', ccId: ccId
    });
  } else {
    // Charge: expense with ccId
    c.expenses.push({
      id: uid(), desc: t.description || t.desc,
      amt: t.amount || t.amt, date: t.date,
      cat: t.category || 'Uncategorized',
      ccId: ccId, ccPaid: false, reconciled: false, fromImport: true
    });
  }
}

// ── PULL MISSING CC TRANSACTIONS ─────────────────────────────
// Shows expenses with ccId that came in through manual entry (not import)
// so the user can see everything in one place
function ccPullMissing() {
  var c = gc(); if (!c) return;
  if (!(c.creditCards||[]).length) { alert('No credit cards set up.'); return; }

  // Find all expenses with ccId not already in bankTransactions pending queue
  var pending = (c.bankTransactions||[]).map(function(t){ return t.id; });
  var ccIds = (c.creditCards||[]).map(function(cc){ return cc.id; });
  var missing = (c.expenses||[]).filter(function(e){
    return e.ccId && ccIds.indexOf(e.ccId) >= 0 && !e.fromImport;
  });

  if (!missing.length) {
    alert('No manually-entered CC transactions found — everything is already here.');
    return;
  }

  // Build modal
  var rows = missing.map(function(e, i) {
    var cc = (c.creditCards||[]).find(function(x){ return x.id===e.ccId; });
    return '<tr>'
      + '<td><input type="checkbox" class="cc-pull-chk" data-idx="' + (c.expenses||[]).indexOf(e) + '" checked></td>'
      + '<td style="font-size:11px;color:var(--muted)">' + (e.date||'—') + '</td>'
      + '<td>' + escHtml(e.desc||'—') + '</td>'
      + '<td style="font-size:11px;color:var(--muted)">' + escHtml(cc?cc.name:'—') + '</td>'
      + '<td class="vr">' + fmt(e.amt) + '</td>'
      + '</tr>';
  }).join('');

  var m = document.createElement('div');
  m.className = 'overlay open';
  m.id = 'cc-pull-modal';
  m.style.zIndex = '10002';
  m.innerHTML = '<div class="modal" style="max-width:620px">'
    + '<button class="cx" onclick="document.getElementById(\'cc-pull-modal\').remove()">&#215;</button>'
    + '<div class="m-title">Pull missing CC transactions</div>'
    + '<div style="font-size:13px;color:var(--muted);margin-bottom:1rem">These were entered manually. Select any to mark as imported so they appear in the CC tab history.</div>'
    + '<table><thead><tr><th style="width:4%"></th><th style="width:10%">Date</th><th style="width:38%">Description</th><th style="width:18%">Card</th><th style="width:14%">Amount</th></tr></thead>'
    + '<tbody>' + rows + '</tbody></table>'
    + '<div style="margin-top:1rem;display:flex;gap:.5rem;justify-content:flex-end">'
    + '<button class="lnk" onclick="document.getElementById(\'cc-pull-modal\').remove()">Cancel</button>'
    + '<button class="sv-btn" onclick="ccPullConfirm()">Mark as imported</button>'
    + '</div></div>';
  document.body.appendChild(m);
}

function ccPullConfirm() {
  var c = gc(); if (!c) return;
  var checked = document.querySelectorAll('.cc-pull-chk:checked');
  if (!checked.length) { alert('Select at least one transaction.'); return; }
  checked.forEach(function(cb) {
    var idx = parseInt(cb.getAttribute('data-idx'));
    if (c.expenses[idx]) c.expenses[idx].fromImport = true;
  });
  var m = document.getElementById('cc-pull-modal');
  if (m) m.remove();
  sv(); renderCCTab(c);
}

// ── CC PDF IMPORT WIZARD ──────────────────────────────────────
var _CC_HANDLING     = false;
var _CC_PDF_FILE     = null;
var _CC_TARGET_ID    = null;
var _CC_MAP_TEMPLATE = null;
var _CC_PDF_DOC      = null;
var _CC_PDF_PAGE     = 1;
var _CC_MAP_STEP     = 0;

var _CC_STEPS = [
  { key: 'cardName',   label: 'Card name',       prompt: 'Enter your card name below then click Next.' },
  { key: 'txnDate',    label: 'Transaction date', prompt: 'Click the date of any transaction row on the PDF.' },
  { key: 'txnDesc',    label: 'Description',      prompt: 'Click the description of that same transaction.' },
  { key: 'txnCharge',  label: 'Charge column',    prompt: 'Click a charge amount — money spent on the card.' },
  { key: 'txnPayment', label: 'Payment column',   prompt: 'Click a payment amount — money paid TO the card. Skip if your statement uses a single amount column.' }
];

function ccImportOpenUpload(ccId) {
  if (_CC_HANDLING) return;
  if (document.getElementById('cc-file-input-' + ccId)) return;
  var fi = document.createElement('input');
  fi.type = 'file'; fi.accept = '.pdf';
  fi.id = 'cc-file-input-' + ccId;
  fi.style.display = 'none';
  fi.onchange = function() {
    var file = fi.files && fi.files[0];
    if (fi.parentNode) fi.parentNode.removeChild(fi);
    if (file) ccHandlePDF(file, ccId);
  };
  fi.addEventListener('cancel', function(){ if (fi.parentNode) fi.parentNode.removeChild(fi); });
  document.body.appendChild(fi);
  fi.click();
}

async function ccHandlePDF(file, ccId) {
  if (_CC_HANDLING) return;
  if (!file || !ccId) return;
  _CC_HANDLING = true;
  _CC_PDF_FILE = file; _CC_TARGET_ID = ccId;
  var c = gc();
  if (!c) { _CC_HANDLING = false; return; }
  if (!window.pdfjsLib) { alert('PDF reader not loaded. Please refresh and try again.'); _CC_HANDLING = false; return; }
  if (!c.ccTemplates) c.ccTemplates = {};
  var tpl = c.ccTemplates[ccId];
  if (!tpl) { _CC_HANDLING = false; _ccStartMapper(file, c, ccId, null); }
  else { await _ccRunTemplate(file, c, ccId, tpl); }
}

async function _ccRunTemplate(file, c, ccId, tpl) {
  _bankShowProgress('Reading ' + file.name + '…');
  try {
    var lines = await _bankExtractLines(file);
    var result = _ccApplyTemplate(lines, tpl);
    _bankShowProgress('');
    var total = result.charges.length + result.payments.length;
    if (total) {
      _ccAddPendingQueue(c, ccId, result.charges, result.payments, tpl);
      sv(); renderCCTab(c);
      var btn = document.querySelector('[data-panel="cc"]');
      if (btn) switchTab({ target: btn }, 'cc');
      _bankToast(total + ' transactions imported from ' + tpl.cardName + '. Review and post below.');
    } else {
      if (confirm('No transactions found using the saved layout for ' + tpl.cardName + '.\n\nRe-map this statement?')) {
        _ccStartMapper(file, c, ccId, tpl); return;
      }
    }
  } catch(e) {
    _bankShowProgress('');
    alert('Error reading PDF: ' + (e.message || e));
  } finally { _CC_HANDLING = false; }
}

function _ccApplyTemplate(lines, tpl) {
  var charges = [], payments = [];
  var dateX = tpl.txnDateX, descX = tpl.txnDescX, chargeX = tpl.txnChargeX, paymentX = tpl.txnPaymentX;
  var dateTol = 80, amtTol = 80;
  var SKIP = /beginning balance|ending balance|opening balance|closing balance|previous balance|new balance|minimum payment|payment due|total charges|total payments|total fees|subtotal|statement period|account summary|credit limit|available credit|page \d/i;

  function parseAmt(s) {
    if (!s) return null;
    var neg = /^\(/.test(s.trim());
    var n = parseFloat(s.replace(/[$,()\s]/g,'').replace(/^-/,''));
    return isNaN(n) ? null : (neg ? -n : n);
  }
  function isAmtStr(s) {
    return s && /^\$?[\d,]+(\.\d{1,2})?$/.test(s.trim().replace(/[()]/g,''));
  }
  function parseDateCC(s) {
    if (!s) return null;
    var m = s.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
    if (m) { var yr = m[3] ? (m[3].length===2?'20'+m[3]:m[3]) : new Date().getFullYear(); return m[1].padStart(2,'0')+'/'+m[2].padStart(2,'0')+'/'+yr; }
    return null;
  }
  function autoCat(desc) {
    var dl=(desc||'').toLowerCase();
    if(/amazon|walmart|target|costco|staples|office depot/.test(dl))return'Supplies';
    if(/hotel|marriott|hilton|hyatt|airbnb/.test(dl))return'Travel';
    if(/airline|delta|united|southwest|american air|flight/.test(dl))return'Travel';
    if(/uber|lyft|taxi/.test(dl))return'Travel';
    if(/restaurant|cafe|coffee|starbucks|doordash|grubhub|panera|chipotle|cheesecake/.test(dl))return'Meals';
    if(/google|microsoft|adobe|zoom|slack|dropbox|aws|netflix|spotify|apple\.com/.test(dl))return'Software';
    if(/verizon|at&t|t-mobile|comcast|spectrum|internet/.test(dl))return'Utilities';
    if(/insurance/.test(dl))return'Insurance';
    if(/rent|lease/.test(dl))return'Rent';
    if(/cvs|walgreens|pharmacy/.test(dl))return'Health';
    if(/shell|bp|exxon|chevron|mobil|sunoco/.test(dl))return'Gas & Fuel';
    return'Uncategorized';
  }

  // Match amounts on both x0 and x1 (right edge) — handles right-aligned columns
  function findAmtItem(items, targetX) {
    if (targetX === null || targetX === undefined) return null;
    var best = null, bestDist = amtTol;
    items.forEach(function(it) {
      if (!isAmtStr(it.str)) return;
      var d = Math.min(Math.abs(it.x - targetX), Math.abs((it.x1||it.x) - targetX));
      if (d < bestDist) { bestDist = d; best = it; }
    });
    return best;
  }

  var seen = {};
  lines.forEach(function(line) {
    if (SKIP.test(line.text)) return;
    var items = line.items;

    // Date — left-aligned, must parse as date
    var dateItem = null;
    items.forEach(function(it) {
      if (!dateItem && Math.abs(it.x - dateX) < dateTol && parseDateCC(it.str)) dateItem = it;
    });
    if (!dateItem) return;
    var date = parseDateCC(dateItem.str); if (!date) return;

    var chargeItem = findAmtItem(items, chargeX);
    var payItem    = findAmtItem(items, paymentX);

    // If both columns resolved to the same item, assign to whichever column is closer
    if (chargeItem && payItem && chargeItem === payItem) {
      var dCharge = Math.min(Math.abs(chargeItem.x-chargeX), Math.abs((chargeItem.x1||chargeItem.x)-chargeX));
      var dPay    = Math.min(Math.abs(payItem.x-paymentX),   Math.abs((payItem.x1||payItem.x)-paymentX));
      if (dCharge <= dPay) payItem = null; else chargeItem = null;
    }
    if (!chargeItem && !payItem) return;

    // Description: items between date column and leftmost amount
    var amtXLeft = Math.min(
      chargeItem ? chargeItem.x : 9999,
      payItem    ? payItem.x    : 9999
    );
    var descItems = items.filter(function(it) {
      return it !== dateItem && it !== chargeItem && it !== payItem
          && it.x > (dateX + 20) && it.x < (amtXLeft - 5);
    });
    var desc = descItems.map(function(it){ return it.str; }).join(' ').trim();
    if (!desc) {
      desc = line.text;
      [dateItem.str, chargeItem?chargeItem.str:'', payItem?payItem.str:''].forEach(function(tok){
        if (tok) desc = desc.replace(tok,'');
      });
      desc = desc.replace(/\s{2,}/g,' ').trim();
    }
    desc = desc || 'CC Transaction';

    var ca = chargeItem ? parseAmt(chargeItem.str) : null;
    var pa = payItem    ? parseAmt(payItem.str)    : null;

    var key = date+'|'+(ca||pa||0).toFixed(2)+'|'+desc.slice(0,15);
    if (seen[key]) return; seen[key] = true;
    if (pa!==null && Math.abs(pa)>0) payments.push({id:uid(),date:date,description:desc,amount:Math.abs(pa),type:'cc_payment'});
    if (ca!==null && Math.abs(ca)>0) charges.push({id:uid(),date:date,description:desc,amount:Math.abs(ca),category:autoCat(desc),type:'charge'});
  });

  console.log('[cc] Charges:',charges.length,'| Payments:',payments.length);
  return { charges:charges, payments:payments };
}

function _ccAddPendingQueue(c, ccId, charges, payments, tpl) {
  if (!c.bankTransactions) c.bankTransactions = [];
  var bankAcctName = (tpl && tpl.bankAcctName) || '';
  charges.forEach(function(t) {
    c.bankTransactions.push({ id:t.id, date:t.date, description:t.description, amount:t.amount, type:'charge', category:t.category, _ccId:ccId, approved:false });
  });
  payments.forEach(function(t) {
    c.bankTransactions.push({ id:t.id, date:t.date, description:t.description, amount:t.amount, type:'cc_payment', _ccId:ccId, _bankAcctName:bankAcctName, approved:false });
  });
}

// ── MAPPER MODAL ──────────────────────────────────────────────
async function _ccStartMapper(file, c, ccId, existingTpl) {
  _CC_PDF_FILE=file; _CC_TARGET_ID=ccId; _CC_MAP_STEP=0;
  var cc=(c.creditCards||[]).find(function(x){return x.id===ccId;});
  _CC_MAP_TEMPLATE = existingTpl ? JSON.parse(JSON.stringify(existingTpl)) : {
    cardName: cc?cc.name:'', ccId:ccId, createdAt:new Date().toISOString(),
    txnDateX:null, txnDescX:null, txnChargeX:null, txnPaymentX:null, bankAcctName:'', mappedText:{}
  };
  _ccInjectMapperModal(c);
  var modal=document.getElementById('cc-mapper-modal');
  if(!modal)return;
  modal.classList.add('open');
  try {
    var ab=await file.arrayBuffer();
    _CC_PDF_DOC=await pdfjsLib.getDocument({data:ab}).promise;
    await _ccRenderPage(1);
    _ccShowStep(0);
  } catch(e) {
    alert('Could not open PDF: '+(e.message||e));
    modal.classList.remove('open');
    _CC_HANDLING=false;
  }
}

function _ccInjectMapperModal(c) {
  var existing=document.getElementById('cc-mapper-modal');
  if(existing)existing.parentNode.removeChild(existing);
  var bankOpts='<option value="">— select bank account —</option>';
  ((c&&c.bankAccounts)||[]).forEach(function(b){bankOpts+='<option value="'+escHtml(b.name)+'">'+escHtml(b.name)+'</option>';});
  ((c&&c.accounts)||[]).filter(function(a){return(a.type==='Asset'||a.type==='Bank'||a.type==='Cash')&&a.active!==false;}).forEach(function(a){bankOpts+='<option value="'+escHtml(a.name||a.cat)+'">'+escHtml(a.name||a.cat)+'</option>';});

  var div=document.createElement('div');
  div.innerHTML='<div class="overlay" id="cc-mapper-modal" style="z-index:10000">'
    +'<div class="modal" style="max-width:900px;max-height:92vh;display:flex;flex-direction:column;padding:0;overflow:hidden">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;padding:.9rem 1.25rem;border-bottom:1px solid var(--border);flex-shrink:0">'
    +'<div><div style="font-size:15px;font-weight:600">&#x1F4B3; Set Up Credit Card Import</div>'
    +'<div style="font-size:11px;color:var(--muted)">Map your statement once — Clarity handles every import after that</div></div>'
    +'<button class="cx" onclick="ccMapperCancel()">&#215;</button></div>'
    +'<div id="cc-map-steps" style="display:flex;border-bottom:1px solid var(--border);flex-shrink:0;overflow-x:auto;padding:.6rem 1.25rem;gap:.4rem"></div>'
    +'<div id="cc-map-prompt" style="padding:.75rem 1.25rem;background:var(--np-bg);border-bottom:1px solid var(--border);flex-shrink:0">'
    +'<div id="cc-map-step-counter" style="font-size:13px;font-weight:500;color:var(--np)">Step 1 of '+_CC_STEPS.length+'</div>'
    +'<div id="cc-map-prompt-text" style="font-size:13px;margin-top:2px"></div></div>'
    +'<div id="cc-step0-row" style="padding:.75rem 1.25rem;border-bottom:1px solid var(--border);flex-shrink:0;display:none">'
    +'<div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;margin-bottom:.5rem">'
    +'<label style="font-size:12px;font-weight:500;white-space:nowrap">Card name:</label>'
    +'<input id="cc-name-input" type="text" placeholder="e.g. Chase Sapphire" style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;font-family:\'DM Sans\',sans-serif;background:var(--surface);color:var(--text)"></div>'
    +'<div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">'
    +'<label style="font-size:12px;font-weight:500;white-space:nowrap">Payments come from:</label>'
    +'<select id="cc-bank-select" style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;font-family:\'DM Sans\',sans-serif;background:var(--surface);color:var(--text)">'+bankOpts+'</select></div></div>'
    +'<div id="cc-canvas-wrap" style="flex:1;overflow:auto;position:relative;background:#888;cursor:crosshair">'
    +'<canvas id="cc-pdf-canvas" style="display:block"></canvas>'
    +'<div id="cc-map-dot" style="position:absolute;width:18px;height:18px;border-radius:50%;background:var(--blue);border:2px solid #fff;pointer-events:none;display:none;transform:translate(-50%,-50%);box-shadow:0 2px 8px rgba(0,0,0,.3)"></div></div>'
    +'<div style="display:flex;align-items:center;justify-content:space-between;padding:.75rem 1.25rem;border-top:1px solid var(--border);flex-shrink:0">'
    +'<div style="display:flex;gap:.5rem">'
    +'<button onclick="ccMapperPrev()" id="cc-map-prev" style="padding:7px 16px;border:1px solid var(--border);border-radius:7px;background:none;cursor:pointer;font-size:13px;font-family:\'DM Sans\',sans-serif;color:var(--text)">&#8592; Back</button>'
    +'<button onclick="ccMapperSkip()" style="padding:7px 16px;border:1px solid var(--border);border-radius:7px;background:none;cursor:pointer;font-size:13px;font-family:\'DM Sans\',sans-serif;color:var(--muted)">Skip this field</button>'
    +'</div>'
    +'<div style="display:flex;gap:.5rem;align-items:center">'
    +'<div style="display:flex;align-items:center;gap:.5rem;font-size:12px;color:var(--muted)">'
    +'<button onclick="ccMapperPagePrev()" style="padding:4px 8px;border:1px solid var(--border);border-radius:5px;background:none;cursor:pointer;font-size:11px">&#9668;</button>'
    +'<span id="cc-map-page-label">Page 1</span>'
    +'<button onclick="ccMapperPageNext()" style="padding:4px 8px;border:1px solid var(--border);border-radius:5px;background:none;cursor:pointer;font-size:11px">&#9658;</button></div>'
    +'<button onclick="ccMapperNext()" id="cc-map-next" style="padding:7px 16px;border:none;border-radius:7px;background:var(--np);color:#fff;cursor:pointer;font-size:13px;font-weight:500;font-family:\'DM Sans\',sans-serif">Next &#8594;</button>'
    +'<button onclick="ccMapperFinish()" id="cc-map-finish" style="padding:7px 16px;border:none;border-radius:7px;background:var(--green);color:#fff;cursor:pointer;font-size:13px;font-weight:500;font-family:\'DM Sans\',sans-serif;display:none">Save &amp; Import</button>'
    +'</div></div></div></div>';
  document.body.appendChild(div.firstChild);
  var canvas=document.getElementById('cc-pdf-canvas');
  if(canvas){canvas.addEventListener('click',function(e){var rect=canvas.getBoundingClientRect();_ccMapClick((e.clientX-rect.left)/_BANK_SCALE,(e.clientY-rect.top)/_BANK_SCALE,e.clientX-rect.left,e.clientY-rect.top);});}
}

async function _ccRenderPage(pageNum) {
  if(!_CC_PDF_DOC)return;
  _CC_PDF_PAGE=pageNum;
  var page=await _CC_PDF_DOC.getPage(pageNum);
  var vp=page.getViewport({scale:_BANK_SCALE});
  var canvas=document.getElementById('cc-pdf-canvas');if(!canvas)return;
  canvas.width=vp.width;canvas.height=vp.height;
  await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
  var lbl=document.getElementById('cc-map-page-label');
  if(lbl)lbl.textContent='Page '+pageNum+' of '+_CC_PDF_DOC.numPages;
}

function _ccShowStep(step) {
  _CC_MAP_STEP=step;
  var stepInfo=_CC_STEPS[step];if(!stepInfo)return;
  var el=document.getElementById('cc-map-prompt-text');if(el)el.textContent=stepInfo.prompt;
  var sc=document.getElementById('cc-map-step-counter');if(sc)sc.textContent='Step '+(step+1)+' of '+_CC_STEPS.length;
  var stepsEl=document.getElementById('cc-map-steps');
  if(stepsEl){stepsEl.innerHTML=_CC_STEPS.map(function(s,i){var done=_CC_MAP_TEMPLATE.mappedText&&_CC_MAP_TEMPLATE.mappedText[s.key];var active=i===step;return'<div style="display:flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:500;white-space:nowrap;'+(active?'background:var(--blue);color:#fff':done?'background:var(--green-bg);color:var(--green)':'color:var(--muted)')+'">'+(done&&!active?'&#10003; ':((i+1)+'. '))+s.label+'</div>';}).join('');}
  var row0=document.getElementById('cc-step0-row');
  if(row0){row0.style.display=step===0?'block':'none';if(step===0){var inp=document.getElementById('cc-name-input');if(inp&&_CC_MAP_TEMPLATE.cardName)inp.value=_CC_MAP_TEMPLATE.cardName;var sel=document.getElementById('cc-bank-select');if(sel&&_CC_MAP_TEMPLATE.bankAcctName)sel.value=_CC_MAP_TEMPLATE.bankAcctName;}}
  var canFinish=step>=3&&_CC_MAP_TEMPLATE&&_CC_MAP_TEMPLATE.cardName&&_CC_MAP_TEMPLATE.txnDateX!==null;
  var prev=document.getElementById('cc-map-prev');var next=document.getElementById('cc-map-next');var finish=document.getElementById('cc-map-finish');
  if(prev)prev.style.display=step>0?'':'none';
  if(next)next.style.display=step<_CC_STEPS.length-1?'':'none';
  if(finish)finish.style.display=canFinish?'':'none';
  var dot=document.getElementById('cc-map-dot');if(dot)dot.style.display='none';
}

function _ccMapClick(pdfX,pdfY,canvasX,canvasY) {
  var step=_CC_STEPS[_CC_MAP_STEP];if(!step)return;
  var dot=document.getElementById('cc-map-dot');if(dot){dot.style.display='block';dot.style.left=canvasX+'px';dot.style.top=canvasY+'px';}
  if(!_CC_MAP_TEMPLATE.mappedText)_CC_MAP_TEMPLATE.mappedText={};
  if(step.key==='txnDate')    {_CC_MAP_TEMPLATE.txnDateX   =pdfX;_CC_MAP_TEMPLATE.mappedText[step.key]='x='+Math.round(pdfX);}
  else if(step.key==='txnDesc')    {_CC_MAP_TEMPLATE.txnDescX   =pdfX;_CC_MAP_TEMPLATE.mappedText[step.key]='x='+Math.round(pdfX);}
  else if(step.key==='txnCharge')  {_CC_MAP_TEMPLATE.txnChargeX =pdfX;_CC_MAP_TEMPLATE.mappedText[step.key]='x='+Math.round(pdfX);}
  else if(step.key==='txnPayment') {_CC_MAP_TEMPLATE.txnPaymentX=pdfX;_CC_MAP_TEMPLATE.mappedText[step.key]='x='+Math.round(pdfX);}
  if(step.key!=='cardName')setTimeout(function(){ccMapperNext();},400);
}

function ccMapperNext() {
  if(_CC_MAP_STEP===0){
    var inp=document.getElementById('cc-name-input');
    var name=inp?inp.value.trim():'';
    if(!name){if(inp){inp.style.borderColor='var(--red)';inp.placeholder='Please enter a card name first';inp.focus();setTimeout(function(){inp.style.borderColor='';inp.placeholder='e.g. Chase Sapphire';},2500);}return;}
    _CC_MAP_TEMPLATE.cardName=name;
    var sel=document.getElementById('cc-bank-select');if(sel&&sel.value)_CC_MAP_TEMPLATE.bankAcctName=sel.value;
    if(!_CC_MAP_TEMPLATE.mappedText)_CC_MAP_TEMPLATE.mappedText={};
    _CC_MAP_TEMPLATE.mappedText['cardName']=name;
  }
  if(_CC_MAP_STEP<_CC_STEPS.length-1)_ccShowStep(_CC_MAP_STEP+1);
}

function ccMapperPrev(){if(_CC_MAP_STEP>0)_ccShowStep(_CC_MAP_STEP-1);}
function ccMapperSkip(){if(_CC_MAP_STEP<_CC_STEPS.length-1)_ccShowStep(_CC_MAP_STEP+1);}
async function ccMapperPagePrev(){if(_CC_PDF_DOC&&_CC_PDF_PAGE>1)await _ccRenderPage(_CC_PDF_PAGE-1);}
async function ccMapperPageNext(){if(_CC_PDF_DOC&&_CC_PDF_PAGE<_CC_PDF_DOC.numPages)await _ccRenderPage(_CC_PDF_PAGE+1);}

async function ccMapperFinish() {
  var c=gc();if(!c)return;
  if(!_CC_MAP_TEMPLATE.cardName){alert('Please enter a card name.');return;}
  if(_CC_MAP_TEMPLATE.txnDateX===null||_CC_MAP_TEMPLATE.txnChargeX===null){alert('Please map at least the date and charge columns.');return;}
  if(!c.ccTemplates)c.ccTemplates={};
  c.ccTemplates[_CC_TARGET_ID]=_CC_MAP_TEMPLATE;
  var _file=_CC_PDF_FILE;var _tpl=JSON.parse(JSON.stringify(_CC_MAP_TEMPLATE));var _ccId=_CC_TARGET_ID;
  ccMapperCancel();
  _bankShowProgress('Extracting transactions…');
  try {
    var lines=await _bankExtractLines(_file);
    var result=_ccApplyTemplate(lines,_tpl);
    _bankShowProgress('');
    var total=result.charges.length+result.payments.length;
    if(total){
      _ccAddPendingQueue(c,_ccId,result.charges,result.payments,_tpl);
      sv();
      var btn=document.querySelector('[data-panel="cc"]');if(btn)switchTab({target:btn},'cc');
      else renderCCTab(c);
      _bankToast(total+' transactions imported from '+_tpl.cardName+'. Review and post below.');
    } else {
      sv();renderCCTab(c);
      _bankToast('Layout saved for '+_tpl.cardName+'. No transactions found — try importing again.');
    }
  } catch(e){_bankShowProgress('');sv();alert('Layout saved, but extraction failed: '+(e.message||e));}
  finally{_CC_HANDLING=false;}
}

function ccMapperCancel(){
  var modal=document.getElementById('cc-mapper-modal');if(modal)modal.classList.remove('open');
  _CC_PDF_FILE=null;_CC_PDF_DOC=null;_CC_MAP_TEMPLATE=null;_CC_HANDLING=false;
}

// ══════════════════════════════════════════════════════════════
// CC CARD CRUD — saveCC, editCC, deleteCC, openCCCharge, markCCPaid
// ══════════════════════════════════════════════════════════════

function openAddCC() {
  var c = gc(); if (!c) return;
  // Always ensure buildDynMods has run so m-cc exists in the DOM
  if (typeof buildDynMods === 'function') buildDynMods(c.type);
  EI = -1;
  // Clear form fields
  if (g('cc-name'))    { g('cc-name').value = '';    g('cc-name').style.borderColor = ''; }
  if (g('cc-network')) g('cc-network').value = 'Visa';
  if (g('cc-last4'))   g('cc-last4').value = '';
  if (g('cc-limit'))   g('cc-limit').value = '';
  openM('m-cc');
}

function saveCC() {
  var c = gc(); if (!c) return;
  var name = (g('cc-name') && g('cc-name').value.trim()) || '';
  if (!name) { if (g('cc-name')) { g('cc-name').style.borderColor = 'var(--red)'; setTimeout(function(){ g('cc-name').style.borderColor = ''; }, 2000); } return; }
  var network = g('cc-network') ? g('cc-network').value : 'Visa';
  var last4   = g('cc-last4')   ? g('cc-last4').value.trim().replace(/\D/g,'').slice(-4) : '';
  var limit   = g('cc-limit')   ? Number(g('cc-limit').value || 0) : 0;

  if (!c.creditCards) c.creditCards = [];
  var idx = resolveEI(c.creditCards);
  if (idx >= 0) {
    // Edit existing
    c.creditCards[idx].name    = name;
    c.creditCards[idx].network = network;
    c.creditCards[idx].last4   = last4;
    c.creditCards[idx].limit   = limit;
  } else {
    // New card
    c.creditCards.push({ id: uid(), name: name, network: network, last4: last4, limit: limit });
  }
  EI = -1;
  sv();
  closeM('m-cc');
  renderCCTab(c);
}

function editCC(ci) {
  var c = gc(); if (!c) return;
  var cc = (c.creditCards || [])[ci]; if (!cc) return;
  EI = ci;
  if (!g('m-cc') && typeof buildDynMods === 'function') buildDynMods(c.type);
  if (g('cc-name'))    g('cc-name').value    = cc.name    || '';
  if (g('cc-network')) g('cc-network').value = cc.network || 'Visa';
  if (g('cc-last4'))   g('cc-last4').value   = cc.last4   || '';
  if (g('cc-limit'))   g('cc-limit').value   = cc.limit   || '';
  openM('m-cc');
}

function deleteCC(ccId) {
  var c = gc(); if (!c) return;
  var cc = (c.creditCards || []).find(function(x){ return x.id === ccId; });
  if (!cc) return;
  if (!confirm('Delete "' + cc.name + '"? This will not delete associated charges.')) return;
  c.creditCards = c.creditCards.filter(function(x){ return x.id !== ccId; });
  sv();
  renderCCTab(c);
}

function openCCCharge(ccId) {
  var c = gc(); if (!c) return;
  // Ensure the expense modal exists
  if (!g('m-exp') && typeof buildDynMods === 'function') buildDynMods(c.type);
  EI = -1;
  // Pre-clear form fields that are safe to touch
  ['e-d','e-a','e-dt','e-ref','e-vendor','e-tin','e-url'].forEach(function(id){ var el = g(id); if (el) el.value = ''; });
  if (g('e-gid')) g('e-gid').value = '';
  if (g('e-c')) g('e-c').value = (g('e-c').options[0] || {}).value || '';
  if (g('e-f')) g('e-f').value = '';
  if (g('e-proj')) g('e-proj').value = '';
  if (g('e-1099')) g('e-1099').value = '';
  // Tag the expense as a CC charge so saveExp() can stamp ccId
  if (g('e-gid')) g('e-gid').setAttribute('data-ccid', ccId);
  // Set date to today
  if (g('e-dt')) {
    var now = new Date();
    var mm = String(now.getMonth()+1).padStart(2,'0');
    var dd = String(now.getDate()).padStart(2,'0');
    var yyyy = now.getFullYear();
    g('e-dt').value = mm + '/' + dd + '/' + yyyy;
  }
  openM('m-exp');
}

function markCCPaid(expIdx) {
  var c = gc(); if (!c) return;
  var e = (c.expenses || [])[expIdx]; if (!e) return;
  e.ccPaid = true;
  sv();
  renderCCTab(c);
}
