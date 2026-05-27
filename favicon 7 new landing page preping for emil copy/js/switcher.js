// ============================================================
// Clarity by Telofin™ — switcher.js
// Onboarding wizard for clients switching from another system.
//
// WIRE INTO app.html:
//   <script src="js/switcher.js"></script>  — after timetracking.js
//
// CALLED FROM nav.js — createClient() and addClientModal():
//   Already hooked — both call showOnboarding(c.id) if function exists.
//
// FLOW:
//   Step 1 — Welcome: explains what they need, the worst part about
//            switching is losing history. This solves that.
//   Step 2 — How many years? 1 / 2 / 3 / More than 3
//   Step 3 (if >3 years) — Reach out screen, captures info, emails Danielle
//   Step 3 (if ≤3 years) — Year-by-year import loop:
//            For each year:
//              a) Upload Balance Sheet (PDF reader)
//              b) Upload P&L (PDF reader)
//              c) Upload account registers (PDF reader, one per account)
//            Progress bar shows years completed
//   Step 4 — Done screen, summary of what was imported
//
// DATA MODEL (on client):
//   c.switcherComplete  = bool
//   c.switcherYears     = number
//   c.historicalReports = [{type, file, importedAt, data, year}]
//   c.switcherContact   = {name, email, phone, yearsNeeded, notes, sentAt}
//
// PUBLIC API:
//   showOnboarding(clientId)   — entry point, called after client creation
//   switcherNext()             — advance to next step
//   switcherBack()             — go back one step
//   switcherSkip()             — skip entire wizard
// ============================================================

// ── STATE ─────────────────────────────────────────────────────
var _SW_STEP        = 1;
var _SW_YEARS       = 0;
var _SW_CUR_YEAR    = 0;      // which year index we're on (0-based)
var _SW_CUR_DOC     = 0;      // which doc within the year (0=BS, 1=PL, 2=registers)
var _SW_CLIENT_ID   = null;
var _SW_YEAR_LIST   = [];     // [{year, bs:bool, pl:bool, registers:[]}]

// ── ENTRY POINT ───────────────────────────────────────────────
function showOnboarding(clientId) {
  _SW_CLIENT_ID = clientId || CID;
  _SW_STEP      = 1;
  _SW_YEARS     = 0;
  _SW_CUR_YEAR  = 0;
  _SW_CUR_DOC   = 0;
  _SW_YEAR_LIST = [];
  _swInjectModal();
  _swInjectStyles();
  _swRender();
  if (typeof openM === 'function') openM('m-switcher');
}

// ── MODAL INJECTION ───────────────────────────────────────────
function _swInjectModal() {
  if (document.getElementById('m-switcher')) return;
  var div = document.createElement('div');
  div.innerHTML =
    '<div class="overlay" id="m-switcher" onclick="if(event.target===this)_swConfirmClose()">'
    + '<div class="modal" style="max-width:580px;max-height:90vh;overflow-y:auto">'
    + '<div class="m-head">'
    + '<span class="m-title" id="sw-title">Getting started</span>'
    + '<button class="m-x" onclick="_swConfirmClose()">&#215;</button>'
    + '</div>'
    + '<div class="m-body" id="sw-body"></div>'
    + '</div></div>';
  document.body.appendChild(div.firstChild);
}

function _swInjectStyles(){
  if(document.getElementById('sw-styles'))return;
  var s=document.createElement('style');
  s.id='sw-styles';
  s.textContent=''
    +'@media(max-width:768px){'
    +'#m-switcher .modal{margin:0!important;border-radius:12px 12px 0 0!important;position:fixed!important;bottom:0!important;left:0!important;right:0!important;max-width:100%!important;max-height:88vh!important}'
    +'#m-switcher .m-body .f-row label{font-size:12px}'
    +'}'
    +'@media(max-width:480px){'
    +'#m-switcher .year-grid{grid-template-columns:1fr!important}'
    +'}';
  document.head.appendChild(s);
}

function _swConfirmClose() {
  if (_SW_STEP > 1 && _SW_STEP < 10) {
    if (!confirm('Exit the import wizard? You can restart it from Settings anytime.')) return;
  }
  switcherSkip();
}

// ── RENDER DISPATCHER ─────────────────────────────────────────
function _swRender() {
  var title = document.getElementById('sw-title');
  var body  = document.getElementById('sw-body');
  if (!title || !body) return;

  switch(_SW_STEP) {
    case 1:  _swStep1(title, body);  break;
    case 2:  _swStep2(title, body);  break;
    case 3:  _swStep3(title, body);  break;  // >3 years — reach out
    case 4:  _swStep4(title, body);  break;  // year-by-year import
    case 10: _swDone(title, body);   break;
    default: _swStep1(title, body);
  }
}

// ── STEP 1 — WELCOME ──────────────────────────────────────────
function _swStep1(title, body) {
  title.textContent = '👋 Welcome to Clarity';
  var c = _swGetClient();
  var clientName = c ? c.name : 'your organization';

  body.innerHTML =
    '<div style="font-size:15px;font-weight:500;margin-bottom:.75rem;line-height:1.5">'
    + 'The worst part about switching accounting software is losing your history.'
    + '</div>'
    + '<div style="font-size:13px;color:var(--muted);margin-bottom:1.25rem;line-height:1.7">'
    + 'Clarity makes it easy to bring your data with you — so <strong style="color:var(--text)">'
    + escHtml(clientName) + '</strong> starts with a complete picture, not a blank slate.'
    + '</div>'
    + '<div style="background:var(--soft);border-radius:10px;padding:1rem 1.25rem;margin-bottom:1.25rem">'
    + '<div style="font-size:11px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.6rem">Here\'s what you\'ll need</div>'
    + '<div style="font-size:12px;line-height:2;color:var(--text)">'
    + '<div>📋 <strong>Balance Sheet</strong> — for each year you want to import</div>'
    + '<div>📊 <strong>Profit & Loss</strong> — for each year you want to import</div>'
    + '<div>📒 <strong>Account Registers</strong> — transaction-level detail per account</div>'
    + '</div>'
    + '<div style="font-size:11px;color:var(--muted);margin-top:.6rem;line-height:1.5">'
    + 'Export these from your current software as PDFs. QuickBooks, Xero, FreshBooks, Wave, '
    + 'and Excel exports all work. Clarity will read them automatically.'
    + '</div>'
    + '</div>'
    + '<div style="background:var(--green-bg);border:1px solid var(--green);border-radius:10px;padding:.75rem 1rem;margin-bottom:1.5rem;font-size:12px;color:var(--text);line-height:1.6">'
    + '✓ Up to <strong>3 years</strong> of history you can import yourself — free, right now.<br>'
    + '✓ Need more than 3 years? We\'ll help you import it for a small fee.'
    + '</div>'
    + _swFooter('Skip for now', 'switcherSkip()', 'Get started', 'switcherNext()');
}

// ── STEP 2 — HOW MANY YEARS ───────────────────────────────────
function _swStep2(title, body) {
  title.textContent = 'How many years of history?';
  var curYear = new Date().getFullYear();

  body.innerHTML =
    '<div style="font-size:13px;color:var(--muted);margin-bottom:1.25rem;line-height:1.6">'
    + 'Choose how many fiscal years you want to bring into Clarity. '
    + 'You can always import more later.'
    + '</div>'
    + '<div class="year-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:1.5rem">'
    + _swYearCard(1, curYear-1+' only',          '1 year')
    + _swYearCard(2, (curYear-2)+' – '+(curYear-1), '2 years')
    + _swYearCard(3, (curYear-3)+' – '+(curYear-1), '3 years')
    + _swYearCardBig()
    + '</div>'
    + _swFooter('Back', 'switcherBack()', null, null);
}

function _swYearCard(years, sub, label) {
  var sel = _SW_YEARS === years;
  return '<button onclick="_swSelectYears('+years+')" style="padding:1rem;border:2px solid '
    + (sel?'var(--np)':'var(--border)')
    + ';border-radius:10px;background:'+(sel?'var(--np-bg)':'var(--surface)')
    + ';cursor:pointer;text-align:left;font-family:\'DM Sans\',sans-serif;transition:border-color .15s">'
    + '<div style="font-size:18px;font-weight:700;color:'+(sel?'var(--np)':'var(--text)')+'">'+label+'</div>'
    + '<div style="font-size:11px;color:var(--muted);margin-top:3px">'+sub+'</div>'
    + '</button>';
}

function _swYearCardBig() {
  var sel = _SW_YEARS === 99;
  return '<button onclick="_swSelectYears(99)" style="padding:1rem;border:2px solid '
    + (sel?'var(--amber)':'var(--border)')
    + ';border-radius:10px;background:'+(sel?'var(--amber-bg)':'var(--surface)')
    + ';cursor:pointer;text-align:left;font-family:\'DM Sans\',sans-serif;grid-column:1/-1">'
    + '<div style="font-size:15px;font-weight:600;color:'+(sel?'var(--amber)':'var(--text)')+'">More than 3 years</div>'
    + '<div style="font-size:11px;color:var(--muted);margin-top:3px">We\'ll help you import it — small fee applies for large historical imports</div>'
    + '</button>';
}

function _swSelectYears(n) {
  _SW_YEARS = n;
  _swRender();
  // Auto-advance if selection made
  setTimeout(function(){
    if (_SW_YEARS > 0) switcherNext();
  }, 300);
}

// ── STEP 3 — MORE THAN 3 YEARS (REACH OUT) ───────────────────
function _swStep3(title, body) {
  title.textContent = 'Let\'s get your full history imported';

  body.innerHTML =
    '<div style="font-size:13px;color:var(--muted);margin-bottom:1rem;line-height:1.7">'
    + 'Importing more than 3 years of data takes care and attention — '
    + 'especially making sure reconciliation history comes through cleanly. '
    + 'We handle this personally so nothing gets lost.'
    + '</div>'
    + '<div style="background:var(--soft);border-radius:10px;padding:1rem 1.25rem;margin-bottom:1.25rem;font-size:12px;line-height:1.8">'
    + '<div>📦 We\'ll review your existing reports and registers</div>'
    + '<div>🔍 Verify reconciliation status on each account</div>'
    + '<div>✅ Import everything cleanly into your Clarity file</div>'
    + '<div>📞 Walk you through the result together</div>'
    + '</div>'
    + '<div class="f-row"><label>Your name</label>'
    + '<input id="sw-contact-name" type="text" placeholder="Jane Smith"></div>'
    + '<div class="f-row"><label>Email</label>'
    + '<input id="sw-contact-email" type="email" placeholder="jane@organization.org"></div>'
    + '<div class="f-row"><label>Phone <span style="color:var(--muted);font-weight:400">(optional)</span></label>'
    + '<input id="sw-contact-phone" type="tel" placeholder="(555) 000-0000"></div>'
    + '<div class="f-row"><label>Approximate years of history</label>'
    + '<input id="sw-contact-years" type="number" min="4" max="30" placeholder="e.g. 7"></div>'
    + '<div class="f-row"><label>Anything else we should know? <span style="color:var(--muted);font-weight:400">(optional)</span></label>'
    + '<textarea id="sw-contact-notes" rows="3" placeholder="Software you\'re switching from, any quirks in your data..." style="width:100%;padding:8px;border:1px solid var(--border);border-radius:7px;font-size:13px;font-family:\'DM Sans\',sans-serif;background:var(--soft);color:var(--text);resize:vertical"></textarea></div>'
    + '<div id="sw-contact-status" style="font-size:12px;margin-bottom:.75rem;display:none"></div>'
    + _swFooter('Back', 'switcherBack()', 'Send request', '_swSendContact()');
}

function _swSendContact() {
  var name  = (document.getElementById('sw-contact-name')||{}).value||'';
  var email = (document.getElementById('sw-contact-email')||{}).value||'';
  var phone = (document.getElementById('sw-contact-phone')||{}).value||'';
  var years = (document.getElementById('sw-contact-years')||{}).value||'';
  var notes = (document.getElementById('sw-contact-notes')||{}).value||'';
  var status = document.getElementById('sw-contact-status');

  if (!name.trim() || !email.trim()) {
    if (status){ status.style.display='block'; status.style.color='var(--red)'; status.textContent='Please enter your name and email.'; }
    return;
  }

  // Save contact info on client
  var c = _swGetClient();
  if (c) {
    c.switcherContact = {
      name: name.trim(), email: email.trim(), phone: phone.trim(),
      yearsNeeded: years, notes: notes.trim(),
      sentAt: new Date().toISOString()
    };
    sv();
  }

  // Send via Formspree (same pattern as existing contact forms)
  var btn = document.querySelector('#m-switcher .m-body button:last-child');
  if (btn){ btn.textContent = 'Sending…'; btn.disabled = true; }

  fetch('https://formspree.io/f/telofin-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      name: name, email: email, phone: phone,
      years: years, notes: notes,
      client: c ? c.name : '', type: c ? c.type : ''
    })
  }).then(function(res){
    if (status){
      status.style.display = 'block';
      if (res.ok){
        status.style.color   = 'var(--green)';
        status.textContent   = '✓ Request sent! We\'ll be in touch within 1 business day.';
        if (btn){ btn.textContent='Sent ✓'; }
        setTimeout(function(){ _SW_STEP=10; _swRender(); }, 2000);
      } else {
        status.style.color  = 'var(--red)';
        status.textContent  = 'Could not send — please email hello@telofin.com directly.';
        if (btn){ btn.textContent='Send request'; btn.disabled=false; }
      }
    }
  }).catch(function(){
    if (status){
      status.style.display = 'block';
      status.style.color   = 'var(--red)';
      status.textContent   = 'Could not connect — please email hello@telofin.com directly.';
    }
    if (btn){ btn.textContent='Send request'; btn.disabled=false; }
  });
}

// ── STEP 4 — YEAR BY YEAR IMPORT ─────────────────────────────
function _swStep4(title, body) {
  // Build year list on first entry
  if (!_SW_YEAR_LIST.length) {
    var curYear = new Date().getFullYear();
    for (var i = 0; i < _SW_YEARS; i++) {
      _SW_YEAR_LIST.push({
        year: curYear - 1 - i,
        bs: false, pl: false, registers: []
      });
    }
  }

  var yr    = _SW_YEAR_LIST[_SW_CUR_YEAR];
  var total = _SW_YEARS;
  var done  = _SW_YEAR_LIST.filter(function(y){ return y.bs && y.pl; }).length;

  title.textContent = 'Import ' + yr.year + ' — Year ' + (_SW_CUR_YEAR+1) + ' of ' + total;

  // Progress bar
  var pct = Math.round((done / total) * 100);
  var progressBar =
    '<div style="margin-bottom:1.25rem">'
    + '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px">'
    + '<span>Overall progress</span><span>'+done+' of '+total+' year'+(total>1?'s':'')+' complete</span>'
    + '</div>'
    + '<div style="height:6px;background:var(--soft);border-radius:3px">'
    + '<div style="height:6px;background:var(--green);border-radius:3px;width:'+pct+'%;transition:width .4s"></div>'
    + '</div></div>';

  // Year tabs
  var yearTabs = '<div style="display:flex;gap:.4rem;margin-bottom:1rem;flex-wrap:wrap">'
    + _SW_YEAR_LIST.map(function(y, i){
        var complete = y.bs && y.pl;
        var active   = i === _SW_CUR_YEAR;
        return '<button onclick="_swGoYear('+i+')" style="padding:4px 12px;border:1px solid '
          + (active?'var(--np)':complete?'var(--green)':'var(--border)')
          + ';border-radius:20px;background:'
          + (active?'var(--np)':complete?'var(--green-bg)':'var(--soft)')
          + ';color:'+(active?'#fff':complete?'var(--green)':'var(--muted)')
          + ';font-size:11px;cursor:pointer;font-family:\'DM Sans\',sans-serif">'
          + (complete?'✓ ':'')+y.year+'</button>';
      }).join('')
    + '</div>';

  // Document upload cards for this year
  var docs = _swDocCards(yr);

  // Next year / finish button
  var allYearsDone = _SW_YEAR_LIST.every(function(y){ return y.bs && y.pl; });
  var isLastYear   = _SW_CUR_YEAR === _SW_YEARS - 1;
  var primaryLabel = allYearsDone ? 'Finish import' : (isLastYear ? 'Finish import' : 'Next year →');
  var primaryFn    = allYearsDone || isLastYear ? '_swFinish()' : '_swNextYear()';

  body.innerHTML =
    progressBar
    + yearTabs
    + docs
    + '<div style="font-size:11px;color:var(--muted);margin-bottom:1rem;line-height:1.6">'
    + '💡 Account registers contain the full transaction detail per account. '
    + 'Export one register per account from your current software — checking, savings, credit cards, etc.'
    + '</div>'
    + _swFooter(
        _SW_CUR_YEAR > 0 ? '← Previous year' : 'Back',
        _SW_CUR_YEAR > 0 ? '_swPrevYear()' : 'switcherBack()',
        primaryLabel,
        primaryFn
      );
}

function _swDocCards(yr) {
  return '<div style="display:flex;flex-direction:column;gap:.75rem;margin-bottom:1rem">'
    + _swDocCard(yr, 'bs',  '📋 Balance Sheet',   yr.bs)
    + _swDocCard(yr, 'pl',  '📊 Profit & Loss',   yr.pl)
    + _swRegisterCard(yr)
    + '</div>';
}

function _swDocCard(yr, docType, label, done) {
  return '<div style="border:1px solid '+(done?'var(--green)':'var(--border)')+';border-radius:10px;padding:.875rem 1rem;background:'+(done?'var(--green-bg)':'var(--surface)')+'">'
    + '<div style="display:flex;align-items:flex-start;gap:.75rem;flex-wrap:wrap">'
    + '<div style="flex:1">'
    + '<div style="font-size:13px;font-weight:500">'+(done?'✅ ':'')+label+' — '+yr.year+'</div>'
    + '<div style="font-size:11px;color:var(--muted);margin-top:2px">'
    + (done ? 'Imported successfully' : 'Upload the PDF export from your accounting software')
    + '</div></div>'
    + (done
        ? '<span style="font-size:11px;color:var(--green);font-weight:500">Done</span>'
        : '<label style="padding:5px 12px;border:1px solid var(--border);border-radius:6px;background:var(--soft);font-size:12px;cursor:pointer;font-family:\'DM Sans\',sans-serif;color:var(--text);white-space:nowrap">'
          + 'Choose PDF'
          + '<input type="file" accept=".pdf" style="display:none" onchange="_swHandleDoc(this,\''+docType+'\','+yr.year+')">'
          + '</label>')
    + '</div></div>';
}

function _swRegisterCard(yr) {
  var count = yr.registers.length;
  return '<div style="border:1px solid '+(count?'var(--green)':'var(--border)')+';border-radius:10px;padding:.875rem 1rem;background:'+(count?'var(--green-bg)':'var(--surface)')+'">'
    + '<div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">'
    + '<div style="flex:1">'
    + '<div style="font-size:13px;font-weight:500">'+(count?'✅ ':'')+' 📒 Account Registers — '+yr.year+'</div>'
    + '<div style="font-size:11px;color:var(--muted);margin-top:2px">'
    + (count ? count+' register'+(count>1?'s':'')+' imported' : 'One PDF per account — checking, savings, credit cards, etc.')
    + '</div></div>'
    + '<label style="padding:5px 12px;border:1px solid var(--border);border-radius:6px;background:var(--soft);font-size:12px;cursor:pointer;font-family:\'DM Sans\',sans-serif;color:var(--text);white-space:nowrap">'
    + (count ? '+ Add another' : 'Choose PDF')
    + '<input type="file" accept=".pdf" style="display:none" onchange="_swHandleDoc(this,\'register\','+yr.year+')">'
    + '</label>'
    + '</div></div>';
}

// ── DOCUMENT UPLOAD HANDLER ───────────────────────────────────
// Uses _PDF_SW_CALLBACK — a stable callback slot on the pdfreader
// that switcher sets before calling pdfHandleUpload. The reader
// calls it after a confirmed import. No window method override needed.
var _PDF_SW_CALLBACK = null;

function _swHandleDoc(input, docType, year) {
  var file = input && input.files && input.files[0]; if (!file) return;
  var yr = _SW_YEAR_LIST.find(function(y){ return y.year === year; }); if (!yr) return;
  input.value = ''; // allow re-selection of same file

  if (typeof pdfHandleUpload !== 'function') {
    alert('PDF reader not loaded. Please refresh and try again.'); return;
  }

  var hint = docType === 'bs' ? 'bs' : docType === 'pl' ? 'pl' : 'register';

  // Register callback — called by pdfreader AFTER confirmed import
  _PDF_SW_CALLBACK = function(fileName) {
    _PDF_SW_CALLBACK = null; // clear immediately — single-use
    // Mark doc complete
    if (docType === 'bs')           yr.bs = true;
    else if (docType === 'pl')      yr.pl = true;
    else if (docType === 'register') yr.registers.push(fileName || file.name);
    // Tag the historical report with the year
    var c = _swGetClient();
    if (c && c.historicalReports && c.historicalReports.length) {
      c.historicalReports[c.historicalReports.length-1].year = year;
      sv();
    }
    // Re-open switcher after pdf modal closes
    setTimeout(function(){
      if (typeof openM === 'function') openM('m-switcher');
      _swRender();
    }, 400);
  };

  pdfHandleUpload(file, hint);
}

// ── YEAR NAVIGATION ───────────────────────────────────────────
function _swGoYear(i) {
  _SW_CUR_YEAR = i;
  _swRender();
}

function _swNextYear() {
  if (_SW_CUR_YEAR < _SW_YEARS - 1){ _SW_CUR_YEAR++; _swRender(); }
  else _swFinish();
}

function _swPrevYear() {
  if (_SW_CUR_YEAR > 0){ _SW_CUR_YEAR--; _swRender(); }
}

function _swFinish() {
  var c = _swGetClient(); if (!c) return;
  c.switcherComplete = true;
  c.switcherYears    = _SW_YEARS;
  sv();
  _SW_STEP = 10;
  _swRender();
}

// ── STEP 10 — DONE ────────────────────────────────────────────
function _swDone(title, body) {
  title.textContent = '🎉 You\'re all set';
  var c = _swGetClient();
  var imported = c ? (c.historicalReports||[]).length : 0;
  var bsCount  = (c&&c.historicalReports||[]).filter(function(r){return r.type==='bs';}).length;
  var plCount  = (c&&c.historicalReports||[]).filter(function(r){return r.type==='pl';}).length;
  var regCount = (c&&c.historicalReports||[]).filter(function(r){return r.type==='register';}).length;

  body.innerHTML =
    '<div style="text-align:center;padding:1rem 0 1.5rem">'
    + '<div style="font-size:48px;margin-bottom:.75rem">✅</div>'
    + '<div style="font-size:16px;font-weight:500;margin-bottom:.5rem">'
    + (c?escHtml(c.name)+' is':'Your client is')+' ready to go'
    + '</div>'
    + '<div style="font-size:13px;color:var(--muted);line-height:1.7;margin-bottom:1.5rem">'
    + 'Your historical data has been imported into Clarity. '
    + 'Head to Reports to review your imported history.'
    + '</div>'
    + '</div>'
    + '<div style="background:var(--soft);border-radius:10px;padding:1rem 1.25rem;margin-bottom:1.5rem">'
    + '<div style="font-size:11px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.6rem">What was imported</div>'
    + '<div style="font-size:12px;line-height:2">'
    + (bsCount  ? '<div>📋 '+bsCount+' Balance Sheet'+(bsCount>1?'s':'')+'</div>' : '')
    + (plCount  ? '<div>📊 '+plCount+' Profit & Loss report'+(plCount>1?'s':'')+'</div>' : '')
    + (regCount ? '<div>📒 '+regCount+' Account register'+(regCount>1?'s':'')+'</div>' : '')
    + (!imported ? '<div style="color:var(--muted)">No documents imported — you can always add them later from any tab.</div>' : '')
    + '</div></div>'
    + '<div style="display:flex;justify-content:flex-end">'
    + '<button onclick="switcherSkip()" style="padding:9px 20px;border:none;border-radius:7px;background:var(--np);color:#fff;font-size:13px;font-weight:500;cursor:pointer;font-family:\'DM Sans\',sans-serif">Go to The Waypoint →</button>'
    + '</div>';
}

// ── NAVIGATION ────────────────────────────────────────────────
function switcherNext() {
  if (_SW_STEP === 1) { _SW_STEP = 2; _swRender(); return; }
  if (_SW_STEP === 2) {
    if (!_SW_YEARS){ alert('Please select how many years you want to import.'); return; }
    _SW_STEP = _SW_YEARS === 99 ? 3 : 4;
    _swRender(); return;
  }
}

function switcherBack() {
  if (_SW_STEP <= 1){ switcherSkip(); return; }
  if (_SW_STEP === 4) _SW_STEP = 2;
  else if (_SW_STEP === 3) _SW_STEP = 2;
  else _SW_STEP--;
  _swRender();
}

function switcherSkip() {
  if (typeof closeM === 'function') closeM('m-switcher');
  // Go to waypoint
  setTimeout(function(){
    var wp = document.querySelector('#tabs .tab[data-panel="waypoint"]');
    if (wp && typeof switchTab === 'function') switchTab({ target: wp }, 'waypoint');
  }, 200);
}

// ── HELPERS ───────────────────────────────────────────────────
function _swGetClient() {
  if (!_SW_CLIENT_ID) return gc();
  for (var i = 0; i < D.clients.length; i++){
    if (D.clients[i].id === _SW_CLIENT_ID) return D.clients[i];
  }
  return gc();
}

function _swFooter(backLabel, backFn, nextLabel, nextFn) {
  return '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:1.25rem;padding-top:.75rem;border-top:1px solid var(--soft)">'
    + '<button onclick="'+backFn+'" style="padding:7px 14px;border:1px solid var(--border);border-radius:7px;background:none;cursor:pointer;font-size:13px;font-family:\'DM Sans\',sans-serif;color:var(--text)">'+backLabel+'</button>'
    + (nextLabel
        ? '<button onclick="'+nextFn+'" style="padding:7px 18px;border:none;border-radius:7px;background:var(--np);color:#fff;font-size:13px;font-weight:500;cursor:pointer;font-family:\'DM Sans\',sans-serif">'+nextLabel+'</button>'
        : '<span></span>')
    + '</div>';
}
