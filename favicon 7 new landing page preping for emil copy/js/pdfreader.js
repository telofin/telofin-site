// ============================================================
// Clarity by Telofin™ — pdfreader.js
// Universal PDF reader engine.
//
// DEPENDENCIES:
//   PDF.js — loaded via CDN in app.html BEFORE this file:
//   <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
//   After that tag, set the worker:
//   <script>pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';</script>
//
// ADD TO app.html script block (after features.js):
//   <script src="js/pdfreader.js"></script>
//
// ADD TO app.html — one modal block (see _pdfModalHTML at bottom):
//   Call pdfInjectModal() once on page load, or paste the HTML directly.
//
// VAULT HOOK — in renderDocumentVault, after successful storageUpload:
//   pdfMaybeImport(file, clientId);
//
// TAB HOOKS — each tab's upload input calls:
//   pdfHandleUpload(file, 'bank'|'cc'|'pl'|'bs'|'register'|'donation')
//
// PUBLIC API:
//   pdfHandleUpload(file, hintType)  — main entry, called from any tab
//   pdfMaybeImport(file, clientId)   — vault entry, offers import after store
//   pdfInjectModal()                 — injects modal HTML once on load
// ============================================================

// ── GLOBALS ──────────────────────────────────────────────────
var _PDF_RESULT   = null;  // last parsed result, used by confirm handler
var _PDF_HINT     = null;  // caller-supplied type hint
var _PDF_FILE     = null;  // raw File reference

// ── FINGERPRINT LIBRARY ──────────────────────────────────────
var _PDF_PRINTS = {

  bank: {
    weight: 0,
    universal: [
      'checking account','savings account','account summary',
      'beginning balance','ending balance','available balance',
      'deposits and additions','withdrawals and deductions',
      'daily balance','statement period','account number',
      'routing number','overdraft','direct deposit',
      'electronic deposit','electronic withdrawal',
      'online transfer','mobile deposit','atm withdrawal',
      'service charge','monthly fee','interest paid',
      'account activity','transaction history'
    ],
    institutions: {
      'Chase':         ['jpmorgan chase','chase bank','chase.com','visit chase','total checking','chase sapphire checking'],
      'Bank of America':['bank of america','bankofamerica.com','bofa','merrill','preferred rewards'],
      'Wells Fargo':   ['wells fargo','wellsfargo.com','everyday checking','way2save'],
      'TD Bank':       ['td bank','tdbank.com','td checking','td savings','td beyond'],
      'PNC':           ['pnc bank','pnc.com','virtual wallet','pnc checking'],
      'US Bank':       ['u.s. bank','usbank.com','us bank checking','us bancorp'],
      'Regions':       ['regions bank','regions.com','lifegreen checking'],
      'Citizens':      ['citizens bank','citizensbank.com','citizens checking'],
      'Truist':        ['truist','truist.com','suntrust','bb&t'],
      'Ally':          ['ally bank','ally.com','ally interest checking'],
      'Capital One':   ['capital one 360','360 checking','capitalone.com/bank'],
      'Navy Federal':  ['navy federal','navyfederal.org','nfcu'],
      'USAA':          ['usaa','usaa.com','usaa checking'],
      'Huntington':    ['huntington','huntington.com','asterisk-free checking'],
      'KeyBank':       ['keybank','key.com','keychecking'],
      'Comerica':      ['comerica','comerica.com'],
      'Synovus':       ['synovus','synovus.com'],
      'First Republic':['first republic','firstrepublic.com'],
      'Silicon Valley':['silicon valley bank','svb.com'],
      'Signature':     ['signature bank']
    }
  },

  cc: {
    weight: 0,
    universal: [
      'minimum payment due','payment due date','credit limit',
      'available credit','statement balance','new balance',
      'previous balance','purchases','cash advances',
      'fees charged','interest charged','payment thank you',
      'payment received','payment posted','rewards earned',
      'points earned','cash back earned','past due amount',
      'foreign transaction fee','annual percentage rate','apr',
      'variable apr','closing date','billing period','billing cycle',
      'posting date','post date','transaction date','merchant',
      'reference number','authorization code','overlimit',
      'returned payment','minimum payment warning','late payment',
      'pay by phone','paperless statement','account ending',
      'promotional rate','balance transfer','purchase apr',
      'cash advance apr','penalty apr','grace period',
      'finance charge','periodic rate'
    ],
    institutions: {
      'Chase':         ['jpmorgan chase','chase sapphire','chase freedom','ink business','slate','amazon rewards','ultimate rewards','marriott bonvoy','united mileageplus','ihg rewards','hyatt'],
      'Amex':          ['american express','amex','membership rewards','gold card','platinum card','blue cash','everyday preferred','hilton honors','delta skymiles','pay over time','amex.com','member since'],
      'Capital One':   ['capital one','venture rewards','quicksilver','savor','spark business','creditwise','capitalone.com'],
      'Discover':      ['discover it','cashback match','discover.com','fico score','5% cashback','rotating categories'],
      'Citi':          ['citibank','citi ','thankyou points','double cash','custom cash','citi.com','citicards.com','costco anywhere'],
      'Wells Fargo':   ['wells fargo','active cash','autograph card','reflect card','wellsfargo.com','go far rewards'],
      'Bank of America':['bank of america','cash rewards','travel rewards','customized cash','preferred rewards','bankofamerica.com','alaska airlines'],
      'US Bank':       ['u.s. bank','altitude','cash+ visa','usbank.com'],
      'Barclays':      ['barclays','barclaysus.com','arrival plus','wyndham rewards','jetblue plus'],
      'Synchrony':     ['synchrony','synchronybank.com','care credit','amazon store card','paypal credit'],
      'Brex':          ['brex','brex.com','brex card'],
      'Ramp':          ['ramp','ramp.com','ramp card'],
      'Divvy':         ['divvy','divvy.co','divvy card'],
      'Bill':          ['bill.com','divvy spend'],
      'Expensify':     ['expensify','expensify card']
    }
  },

  pl: {
    weight: 0,
    universal: [
      'profit & loss','profit and loss','income statement',
      'statement of activities','total income','total revenue',
      'total expenses','net income','net loss','net profit',
      'gross profit','gross margin','operating expenses',
      'operating income','other income','other expenses',
      'cost of goods sold','cost of services','total operating',
      'ordinary income','ordinary loss','net ordinary income',
      'total other income','total other expense','net other income',
      'earnings before','ebitda','year to date','ytd',
      'period ending','accrual basis','cash basis','jan','feb',
      'jan - dec','fiscal year'
    ],
    sources: {
      'QuickBooks': ['quickbooks','intuit','qbo','profit & loss detail','profit & loss summary'],
      'Xero':       ['xero','xero.com','profit & loss — xero'],
      'FreshBooks': ['freshbooks','freshbooks.com'],
      'Wave':       ['wave accounting','waveapps.com','wave financial'],
      'Sage':       ['sage','sage intacct','sage 50','sage 100'],
      'Zoho':       ['zoho books','zoho.com'],
      'NetSuite':   ['netsuite','oracle netsuite'],
      'Excel':      ['microsoft excel','sheet1','workbook','xlsx']
    }
  },

  bs: {
    weight: 0,
    universal: [
      'balance sheet','statement of financial position',
      'statement of financial condition',
      'total assets','total liabilities','total equity',
      'stockholders equity','shareholders equity','net assets',
      'retained earnings','current assets','current liabilities',
      'long-term','non-current','accounts receivable','accounts payable',
      'cash and cash equivalents','prepaid expenses',
      'property and equipment','accumulated depreciation',
      'notes payable','deferred revenue','unrestricted',
      'temporarily restricted','permanently restricted',
      'total net assets','fund balance','as of','as at'
    ],
    sources: {
      'QuickBooks': ['quickbooks','intuit','balance sheet detail','balance sheet summary'],
      'Xero':       ['xero','xero.com'],
      'FreshBooks': ['freshbooks'],
      'Wave':       ['wave accounting','waveapps.com'],
      'Sage':       ['sage intacct','sage 50'],
      'NetSuite':   ['netsuite','oracle netsuite']
    }
  },

  register: {
    weight: 0,
    universal: [
      'account register','transaction detail','transaction report',
      'check register','general ledger detail','transaction list',
      'running balance','cleared','reconciled','uncleared',
      'split','memo','payee','check number','ref no',
      'clr','num','date','amount','balance',
      'debit','credit','deposit','payment','transfer'
    ],
    sources: {
      'QuickBooks': ['quickbooks','intuit','account quickreport','transaction detail by account'],
      'Xero':       ['xero','account transactions'],
      'Wave':       ['wave accounting']
    }
  },

  donation: {
    weight: 0,
    universal: [
      'donation','donor','campaign','fund','fundraiser',
      'gross amount','net amount','platform fee','processing fee',
      'contribution','gift','pledge','recurring donation',
      'one-time donation','anonymous','tribute','in honor of',
      'in memory of','dedication','tax receipt','tax deductible',
      'donor name','donor email','donation date','donation amount',
      'payment method','transaction id','payout'
    ],
    sources: {
      'Zeffy':      ['zeffy','zeffy.com'],
      'CheddarUp':  ['cheddarup','cheddar up','cheddarup.com'],
      'PayPal':     ['paypal','paypal.com','paypal giving fund'],
      'Stripe':     ['stripe','stripe.com','stripe payments'],
      'GoFundMe':   ['gofundme','go fund me','gofundme.com'],
      'Givebutter': ['givebutter','givebutter.com'],
      'Donorbox':   ['donorbox','donorbox.org'],
      'Bloomerang':  ['bloomerang','bloomerang.co'],
      'Salesforce': ['salesforce','nonprofit success pack','npsp'],
      'Network for Good':['network for good','networkforgood.com'],
      'Classy':     ['classy','classy.org'],
      'Fundly':     ['fundly','fundly.com'],
      'Mightycause':['mightycause','mightycause.com'],
      'Flipcause':  ['flipcause','flipcause.com'],
      'Aplos':      ['aplos','aplos.com']
    }
  }

};

// ── SUGGESTED ACCOUNTS PER TRANSACTION CATEGORY ─────────────
var _PDF_ACCT_SUGGESTIONS = {
  // CC categories → suggested expense account codes
  interest:     { code:'6100', label:'Interest Expense' },
  annual_fee:   { code:'6200', label:'Bank & CC Fees' },
  late_fee:     { code:'6200', label:'Bank & CC Fees' },
  foreign_fee:  { code:'6200', label:'Bank & CC Fees' },
  cash_advance: { code:'6300', label:'Cash Advance' },
  payment:      { code:'2100', label:'Credit Card Payable' },
  credit:       { code:'',     label:'— return/refund —' },
  // Bank categories
  service_charge:{ code:'6200', label:'Bank & CC Fees' },
  interest_income:{ code:'4900', label:'Interest Income' }
};

// ── TEXT EXTRACTION ──────────────────────────────────────────
async function _pdfExtractText(file) {
  if (!window.pdfjsLib) throw new Error('PDF.js not loaded.');
  var ab = await file.arrayBuffer();
  var doc = await pdfjsLib.getDocument({ data: ab }).promise;
  var lines = [];
  var total = doc.numPages;
  for (var p = 1; p <= total; p++) {
    _pdfShowStatus('Reading page ' + p + ' of ' + total + '…');
    var page = await doc.getPage(p);
    var tc   = await page.getTextContent();
    // Group items by approximate Y position → natural reading lines
    var byY = {};
    tc.items.forEach(function(item) {
      var y = Math.round(item.transform[5]);
      if (!byY[y]) byY[y] = [];
      byY[y].push(item.str);
    });
    Object.keys(byY).sort(function(a,b){return b-a;}).forEach(function(y){
      var line = byY[y].join(' ').trim();
      if (line) lines.push(line);
    });
  }
  return lines;
}

// ── IDENTIFIER ───────────────────────────────────────────────
function _pdfIdentify(lines, hint) {
  var text = lines.join(' ').toLowerCase();

  // Reset weights
  Object.keys(_PDF_PRINTS).forEach(function(k){ _PDF_PRINTS[k].weight = 0; });

  // Score each bucket
  Object.keys(_PDF_PRINTS).forEach(function(bucket) {
    var fp = _PDF_PRINTS[bucket];
    // Universal keywords — 2pts each
    fp.universal.forEach(function(kw){
      if (text.indexOf(kw) >= 0) fp.weight += 2;
    });
    // Institution/source keywords — 5pts each (stronger signal)
    var srcKey = bucket === 'bank' || bucket === 'cc' ? 'institutions' : 'sources';
    if (fp[srcKey]) {
      Object.keys(fp[srcKey]).forEach(function(name){
        fp[srcKey][name].forEach(function(kw){
          if (text.indexOf(kw) >= 0) fp.weight += 5;
        });
      });
    }
  });

  // Apply hint bonus — caller knows context
  if (hint && _PDF_PRINTS[hint]) _PDF_PRINTS[hint].weight += 15;

  // Find winner
  var best = null, bestW = 0;
  Object.keys(_PDF_PRINTS).forEach(function(k){
    if (_PDF_PRINTS[k].weight > bestW) { bestW = _PDF_PRINTS[k].weight; best = k; }
  });

  // Max possible = universal*2 + top institution*5 — use relative confidence
  var total = Object.keys(_PDF_PRINTS).reduce(function(s,k){return s+_PDF_PRINTS[k].weight;},0);
  var confidence = total > 0 ? Math.round((_PDF_PRINTS[best].weight / total) * 100) : 0;

  // Detect institution/source name
  var institution = _pdfDetectInstitution(text, best);

  return { type: best, confidence: confidence, institution: institution };
}

function _pdfDetectInstitution(text, bucket) {
  var fp = _PDF_PRINTS[bucket];
  if (!fp) return '';
  var srcKey = (bucket === 'bank' || bucket === 'cc') ? 'institutions' : 'sources';
  var src = fp[srcKey];
  if (!src) return '';
  var best = '', bestCount = 0;
  Object.keys(src).forEach(function(name){
    var count = 0;
    src[name].forEach(function(kw){ if (text.indexOf(kw) >= 0) count++; });
    if (count > bestCount) { bestCount = count; best = name; }
  });
  return best;
}

// ── PARSERS ──────────────────────────────────────────────────

// Generic date parser from a string fragment
function _pdfParseDate(s) {
  if (!s) return null;
  // MM/DD/YYYY or MM-DD-YYYY
  var m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    var yr = m[3].length === 2 ? '20' + m[3] : m[3];
    return m[1].padStart(2,'0') + '/' + m[2].padStart(2,'0') + '/' + yr;
  }
  // Month DD YYYY or DD Month YYYY
  var months = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  var m2 = s.toLowerCase().match(/(\w{3,9})\s+(\d{1,2}),?\s+(\d{4})/);
  if (m2 && months[m2[1].slice(0,3)]) {
    return months[m2[1].slice(0,3)].toString().padStart(2,'0') + '/' + m2[2].padStart(2,'0') + '/' + m2[3];
  }
  return null;
}

// Parse dollar amount from string — handles ($1,234.56), -$1,234.56, 1,234.56
function _pdfParseAmt(s) {
  if (!s) return null;
  var neg = /^\(/.test(s.trim()) || /^-/.test(s.trim());
  var clean = s.replace(/[$,\(\)\s]/g,'').replace(/^-/,'');
  var n = parseFloat(clean);
  if (isNaN(n)) return null;
  return neg ? -n : n;
}

// ── BANK PARSER ───────────────────────────────────────────────
// Strategy:
//   Pass 1 — scan every line for a dollar amount with cents (XX.XX)
//   Pass 2 — for each amount line, look backward up to 6 lines for a date
//   Pass 3 — everything between the date and the amount is the description
//   Pass 4 — detect debit/credit column layout vs signed-amount layout
//   Pass 5 — skip header/footer/balance lines using keyword blocklist
//   Pass 6 — deduplicate by date+amount+desc to handle running balance columns
//
// This handles:
//   - Single-line rows:  "05/01  PAYROLL DEPOSIT  4,200.00"
//   - Multi-line rows:   date on one line, desc on next, amount on next
//   - Two-column layout: separate debit and credit columns
//   - Running balance:   third number column ignored (it is the balance)
//   - Continuation lines: description wraps to next line

function _pdfParseBank(lines) {
  var txns = [];
  var summary = { openingBalance: null, closingBalance: null, totalDebits: 0, totalCredits: 0 };
  var period  = { start: null, end: null };

  // ── Keywords that appear on amount-containing lines but are NOT transactions ──
  var SKIP_RE = /beginning balance|ending balance|opening balance|closing balance|starting balance|available balance|current balance|ledger balance|collected balance|previous balance|total deposit|total withdrawal|total debit|total credit|total transaction|service charge total|subtotal|carried forward|brought forward|account summary|statement period|daily balance|minimum balance|average balance|interest rate|annual percentage|account number|routing number|page \d|continued on|continued from|date.*description.*amount/i;

  // ── Amount regex — finds dollar amounts with cents ──
  // Matches: 1,234.56  $1,234.56  (1,234.56)  -1,234.56
  var AMT_RE = /[\$\(]?[\d]{1,3}(?:,\d{3})*\.\d{2}\)?/g;

  // ── Date regex ──
  var DATE_RE = /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/;
  var DATE_RE_LONG = /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})/i;

  function parseAmt(s) {
    if (!s) return null;
    var neg = /^\(/.test(s.trim()) || /^-/.test(s.trim());
    var clean = s.replace(/[$,()\s]/g,'').replace(/^-/,'');
    var n = parseFloat(clean);
    if (isNaN(n)) return null;
    return neg ? -n : n;
  }

  function parseDate(s) {
    if (!s) return null;
    var m = s.match(DATE_RE);
    if (m) {
      var yr = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : new Date().getFullYear().toString();
      return m[1].padStart(2,'0') + '/' + m[2].padStart(2,'0') + '/' + yr;
    }
    var months = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
    var m2 = s.match(DATE_RE_LONG);
    if (m2) {
      var mo = months[m2[1].slice(0,3).toLowerCase()];
      if (mo) return mo.toString().padStart(2,'0') + '/' + m2[2].padStart(2,'0') + '/' + m2[3];
    }
    return null;
  }

  // ── Scan header (first 40 lines) for period and balances ──
  lines.slice(0, 40).forEach(function(line) {
    var ll = line.toLowerCase();
    if (/beginning balance|opening balance|starting balance/.test(ll)) {
      var matches = line.match(AMT_RE);
      if (matches) summary.openingBalance = Math.abs(parseAmt(matches[matches.length - 1]));
    }
    if (/ending balance|closing balance/.test(ll)) {
      var matches2 = line.match(AMT_RE);
      if (matches2) summary.closingBalance = Math.abs(parseAmt(matches2[matches2.length - 1]));
    }
  });

  // ── Build a date index: for each line, what date does it start with? ──
  var lineDates = lines.map(function(line) { return parseDate(line); });

  // ── PASS 1 — find all lines that contain at least one dollar amount ──
  var seen = {};  // dedup key → true

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    // Skip obvious non-transaction lines
    if (SKIP_RE.test(line)) continue;

    // Find amounts on this line
    AMT_RE.lastIndex = 0;
    var amtMatches = [];
    var am;
    while ((am = AMT_RE.exec(line)) !== null) {
      amtMatches.push({ str: am[0], idx: am.index });
    }
    if (!amtMatches.length) continue;

    // Skip lines that are pure balance/header rows (3+ amounts = likely balance row)
    if (amtMatches.length >= 3) {
      // Could be debit|credit|balance layout — use first two, skip last
      // But first check if this line itself has a date
      if (!parseDate(line)) continue;
    }

    // ── Find the date for this transaction ──
    var txnDate = null;
    var descLines = [];
    var dateLineIdx = -1;

    // Check if this line itself starts with a date
    var selfDate = parseDate(line);
    if (selfDate) {
      txnDate = selfDate;
      dateLineIdx = i;
      // Description is everything between the date and the first amount
      var afterDate = line.replace(DATE_RE, '').trim();
      // Remove the amount(s) from the end
      afterDate = afterDate.replace(/[\$\(]?[\d]{1,3}(?:,\d{3})*\.\d{2}\)?[\s\-]*[\$\(]?[\d]{0,3}(?:,\d{3})*\.?\d{0,2}\)??\s*$/,'').trim();
      if (afterDate && afterDate.length > 1) descLines.push(afterDate);
    } else {
      // Look backward up to 6 lines for a date
      for (var j = i - 1; j >= Math.max(0, i - 6); j--) {
        if (lineDates[j]) {
          txnDate = lineDates[j];
          dateLineIdx = j;
          // Everything between date line and amount line is description
          for (var k = j; k <= i; k++) {
            var dline = lines[k];
            // Remove date from date line
            if (k === j) dline = dline.replace(DATE_RE, '').trim();
            // Remove amounts from amount line
            if (k === i) dline = dline.replace(/[\$\(]?[\d]{1,3}(?:,\d{3})*\.\d{2}\)?/g,'').trim();
            if (dline && dline.length > 1) descLines.push(dline);
          }
          break;
        }
      }
    }

    if (!txnDate) continue;

    // ── Determine amount and type ──
    // For two-column layouts (debit | credit), take the rightmost non-balance amount
    var amt = null;
    var type = 'debit';

    if (amtMatches.length === 1) {
      amt = parseAmt(amtMatches[0].str);
      type = (amt !== null && amt < 0) ? 'debit' : 'credit';
      if (amt !== null) amt = Math.abs(amt);
    } else if (amtMatches.length >= 3) {
      // Three-column layout: deposits | withdrawals | balance (or similar)
      // Skip the last column (running balance) — use first two only
      var a1 = parseAmt(amtMatches[0].str);
      var a2 = parseAmt(amtMatches[1].str);
      var a1ok = a1 !== null && Math.abs(a1) > 0;
      var a2ok = a2 !== null && Math.abs(a2) > 0;
      if (a1ok && !a2ok) {
        // Only deposits column has a value — it's a credit (money in)
        amt = Math.abs(a1);
        type = 'credit';
      } else if (!a1ok && a2ok) {
        // Only withdrawals column has a value — it's a debit (money out)
        amt = Math.abs(a2);
        type = 'debit';
      } else if (a1ok && a2ok) {
        // Both have values — use position: left = deposits, right = withdrawals
        if (amtMatches[0].idx < amtMatches[1].idx) {
          amt = Math.abs(a1); type = 'credit';
        } else {
          amt = Math.abs(a2); type = 'debit';
        }
      }
    } else if (amtMatches.length === 2) {
      // Likely debit | credit columns — one will be empty/zero
      var a1 = parseAmt(amtMatches[0].str);
      var a2 = parseAmt(amtMatches[1].str);
      // The balance column (last) is often larger — heuristic: use first non-null
      // that is less than 50000 (reasonable single transaction)
      if (a1 !== null && Math.abs(a1) < 50000 && Math.abs(a1) > 0) {
        amt = Math.abs(a1);
        type = 'debit';
      }
      if (a2 !== null && Math.abs(a2) < 50000 && Math.abs(a2) > 0 && amt === null) {
        amt = Math.abs(a2);
        type = 'credit';
      }
      // If both columns have values, the layout is debit | credit — take whichever is non-zero
      if (a1 && a2 && Math.abs(a1) > 0 && Math.abs(a2) > 0) {
        // Use position to decide: left column = debit, right column = credit
        if (amtMatches[0].idx < amtMatches[1].idx) {
          amt  = Math.abs(a1);
          type = 'debit';
        }
      }
    }

    if (amt === null || amt === 0) continue;

    // ── Build description ──
    var desc = descLines.join(' ').replace(/\s{2,}/g,' ').trim();
    // Clean up stray punctuation and numbers left over from regex removal
    desc = desc.replace(/^\W+/,'').replace(/\W+$/,'').trim();
    if (!desc || desc.length < 2) desc = 'Transaction';

    // ── Dedup ──
    var dedupKey = txnDate + '|' + amt.toFixed(2) + '|' + desc.slice(0,20);
    if (seen[dedupKey]) continue;
    seen[dedupKey] = true;

    // ── Auto-categorize ──
    var dl = desc.toLowerCase();
    var cat = 'Uncategorized';
    if (/payroll|direct deposit|salary|wages|ach credit|ach deposit/.test(dl))       cat = 'Payroll';
    else if (/rent|lease/.test(dl))                                                    cat = 'Rent';
    else if (/utility|utilities|electric|gas|water|sewer|pge|con ed|eversource/.test(dl)) cat = 'Utilities';
    else if (/insurance|ins pmt/.test(dl))                                             cat = 'Insurance';
    else if (/service charge|monthly fee|maintenance fee|account fee|bank fee/.test(dl)) cat = 'Bank Fees';
    else if (/interest paid|interest credit|interest earned/.test(dl))                cat = 'Interest Income';
    else if (/atm|cash withdrawal|cash advance/.test(dl))                              cat = 'Cash';
    else if (/transfer|zelle|venmo|paypal|cashapp/.test(dl))                          cat = 'Transfer';
    else if (/amazon|walmart|target|costco|sam's club/.test(dl))                     cat = 'Supplies';
    else if (/office depot|staples|officemax/.test(dl))                               cat = 'Office Supplies';
    else if (/verizon|at&t|t-mobile|sprint|comcast|spectrum|xfinity/.test(dl))       cat = 'Utilities';
    else if (/usps|fedex|ups|dhl|postage|shipping/.test(dl))                          cat = 'Postage & Shipping';
    else if (/google|microsoft|adobe|dropbox|zoom|slack|quickbooks|intuit/.test(dl)) cat = 'Software';
    else if (/travel|hotel|airline|delta|united|american air|southwest|uber|lyft|airbnb/.test(dl)) cat = 'Travel';
    else if (/restaurant|café|cafe|coffee|starbucks|dunkin|doordash|grubhub|seamless/.test(dl)) cat = 'Meals';
    else if (/medical|pharmacy|cvs|walgreens|doctor|hospital|dental|vision/.test(dl)) cat = 'Medical';
    else if (/donation|charitable|nonprofit|nfp/.test(dl))                            cat = 'Donations';
    else if (/loan|mortgage|payment to/.test(dl))                                     cat = 'Loan Payment';
    else if (/tax|irs|revenue service|department of revenue/.test(dl))               cat = 'Taxes';

    // Override category for credits
    if (type === 'credit' && cat === 'Uncategorized') cat = 'Other Income';

    if (type === 'debit') summary.totalDebits  += amt;
    else                   summary.totalCredits += amt;

    txns.push({
      date:        txnDate,
      description: desc,
      amount:      amt,
      type:        type,
      category:    cat,
      raw:         line
    });
  }

  // Sort by date
  txns.sort(function(a, b) {
    return new Date(a.date) - new Date(b.date);
  });

  return { transactions: txns, period: period, summary: summary };
}

// ── CC PARSER ────────────────────────────────────────────────
function _pdfParseCC(lines) {
  var txns = [];
  var period = { start: null, end: null };
  var summary = { openingBalance: null, closingBalance: null, totalCharges: 0, totalPayments: 0, totalFees: 0, totalInterest: 0 };

  // Header scan
  var fullText = lines.join(' ');
  var prevM = fullText.match(/previous balance[\s:$]+([\d,]+\.\d{2})/i);
  if (prevM) summary.openingBalance = parseFloat(prevM[1].replace(/,/g,''));
  var newM = fullText.match(/new balance[\s:$]+([\d,]+\.\d{2})/i);
  if (newM) summary.closingBalance = parseFloat(newM[1].replace(/,/g,''));

  // Period
  var billingM = fullText.match(/billing period[:\s]+(\w+[\s\d,\/\-]+)\s+(?:to|through|-)\s+(\w+[\s\d,\/\-]+)/i);
  if (billingM) {
    period.start = _pdfParseDate(billingM[1]);
    period.end   = _pdfParseDate(billingM[2]);
  }

  // Transaction lines — CC format: date + post_date + description + amount
  // Pattern 1: "MM/DD MM/DD Description Amount"
  var re1 = /^(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})?\s*(.+?)\s+([\-\$\(]?[\d,]+\.\d{2}\)?)$/;
  // Pattern 2: "MM/DD/YYYY Description Amount"
  var re2 = /^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+([\-\$\(]?[\d,]+\.\d{2}\)?)$/;

  lines.forEach(function(line){
    var date = null, postDate = null, desc = '', amt = null, raw = line;

    var m1 = line.match(re1);
    var m2 = !m1 && line.match(re2);

    if (m1) {
      date = _pdfParseDate(m1[1] + '/' + new Date().getFullYear());
      postDate = m1[2] ? _pdfParseDate(m1[2] + '/' + new Date().getFullYear()) : date;
      desc = m1[3].trim();
      amt  = _pdfParseAmt(m1[4]);
    } else if (m2) {
      date = _pdfParseDate(m2[1]);
      desc = m2[2].trim();
      amt  = _pdfParseAmt(m2[3]);
    }

    if (!date || amt === null) return;

    // Categorize
    var dl = desc.toLowerCase();
    var category = 'purchase';
    if (/payment|thank you|pymt received|autopay/i.test(dl))      category = 'payment';
    else if (/annual fee/i.test(dl))                               category = 'annual_fee';
    else if (/late fee|returned payment fee/i.test(dl))            category = 'late_fee';
    else if (/foreign transaction|foreign fee/i.test(dl))          category = 'foreign_fee';
    else if (/cash advance/i.test(dl))                             category = 'cash_advance';
    else if (/interest charge|finance charge/i.test(dl))           category = 'interest';
    else if (/credit|return|refund|reversal/i.test(dl) && amt < 0) category = 'credit';

    // Payments are negative on statement (reduce balance)
    if (category === 'payment') {
      summary.totalPayments += Math.abs(amt);
    } else if (category === 'interest') {
      summary.totalInterest += Math.abs(amt);
    } else if (category === 'annual_fee' || category === 'late_fee' || category === 'foreign_fee') {
      summary.totalFees += Math.abs(amt);
    } else if (category === 'purchase') {
      summary.totalCharges += Math.abs(amt);
    }

    // Suggested account
    var suggested = _PDF_ACCT_SUGGESTIONS[category] || { code: '', label: '— select account —' };
    // Override with client COA if available
    var c = gc();
    if (c && c.accounts && suggested.code) {
      var match = c.accounts.find(function(a){ return a.code === suggested.code; });
      if (!match) suggested = { code: '', label: '— select account —' };
    }

    txns.push({
      date: date, postDate: postDate || date,
      description: desc, amount: amt,
      category: category,
      suggestedCode: suggested.code,
      suggestedLabel: suggested.label,
      confirmed: false,
      raw: raw
    });
  });

  return { transactions: txns, period: period, summary: summary };
}

// ── P&L PARSER ───────────────────────────────────────────────
function _pdfParsePL(lines) {
  var rows = [];
  var period = { start: null, end: null };
  // Look for date range in first 20 lines
  lines.slice(0,20).forEach(function(line){
    var d = _pdfParseDate(line);
    if (d && !period.start) period.start = d;
    else if (d) period.end = d;
  });
  // Extract label + amount rows
  var amtRe = /^(.+?)\s+([\-\$\(]?[\d,]+\.\d{2}\)?)$/;
  lines.forEach(function(line){
    var m = line.match(amtRe);
    if (!m) return;
    var label = m[1].trim();
    var amt   = _pdfParseAmt(m[2]);
    if (amt === null) return;
    // Determine if income or expense by label
    var isTotal = /^total/i.test(label);
    var type = /income|revenue|grant|contribution|donation|support/i.test(label) ? 'income' : 'expense';
    rows.push({ label: label, amount: amt, type: type, isTotal: isTotal });
  });
  return { rows: rows, period: period };
}

// ── BALANCE SHEET PARSER ──────────────────────────────────────
function _pdfParseBS(lines) {
  var rows = [];
  var asOf = null;
  lines.slice(0,20).forEach(function(line){
    var d = _pdfParseDate(line); if (d) asOf = d;
  });
  var amtRe = /^(.+?)\s+([\-\$\(]?[\d,]+\.\d{2}\)?)$/;
  var section = 'assets';
  lines.forEach(function(line){
    var ll = line.toLowerCase();
    if (/liabilit/i.test(ll))  section = 'liabilities';
    if (/equity|net assets/i.test(ll)) section = 'equity';
    var m = line.match(amtRe);
    if (!m) return;
    var amt = _pdfParseAmt(m[2]); if (amt === null) return;
    rows.push({ label: m[1].trim(), amount: amt, section: section, isTotal: /^total/i.test(m[1]) });
  });
  return { rows: rows, asOf: asOf };
}

// ── REGISTER PARSER ───────────────────────────────────────────
function _pdfParseRegister(lines) {
  var txns = [];
  var dateRe = /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+([\-\$\(]?[\d,]+\.\d{2}\)?)\s*([\-\$\(]?[\d,]+\.\d{2}\)?)?$/;
  lines.forEach(function(line){
    var m = line.match(dateRe); if (!m) return;
    var date = _pdfParseDate(m[1]); if (!date) return;
    var amt = _pdfParseAmt(m[3]);
    var reconciled = /\*|R|C/.test(m[2]);
    txns.push({ date: date, description: m[2].trim(), amount: amt, reconciled: reconciled, raw: line });
  });
  return { transactions: txns };
}

// ── DONATION PARSER ───────────────────────────────────────────
function _pdfParseDonation(lines) {
  var txns = [];
  var dateRe = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;
  var amtRe  = /\$([\d,]+\.\d{2})/g;
  lines.forEach(function(line){
    var dm = line.match(dateRe); if (!dm) return;
    var date = _pdfParseDate(dm[1]); if (!date) return;
    var amounts = [];
    var am; amtRe.lastIndex = 0;
    while ((am = amtRe.exec(line)) !== null) amounts.push(parseFloat(am[1].replace(/,/g,'')));
    if (!amounts.length) return;
    // Gross, fee, net pattern
    var gross = amounts[0] || 0;
    var fee   = amounts.length >= 3 ? amounts[1] : 0;
    var net   = amounts.length >= 3 ? amounts[2] : amounts[1] || gross;
    txns.push({ date: date, description: line, gross: gross, fee: fee, net: net, raw: line });
  });
  return { transactions: txns };
}

// ── PAYMENT MATCH ENGINE ──────────────────────────────────────
// Checks existing bank transactions for a potential CC payment match
function _pdfFindPaymentMatch(amt, dateStr) {
  var c = gc(); if (!c) return null;
  var txnDate = parseDate(dateStr); if (!txnDate) return null;
  var target = Math.abs(amt);
  var candidates = [];
  // Check expenses (payments out of bank to CC)
  (c.expenses || []).forEach(function(e, i){
    if (e.deleted || e.matchId) return;
    var diff = Math.abs(Number(e.amt || 0) - target);
    if (diff > 0.01) return;
    var eDate = parseDate(e.date); if (!eDate) return;
    var daysDiff = Math.abs((eDate - txnDate) / 86400000);
    if (daysDiff <= 5) candidates.push({ type: 'expense', index: i, item: e, daysDiff: daysDiff });
  });
  if (!candidates.length) return null;
  // Return closest date match
  candidates.sort(function(a,b){ return a.daysDiff - b.daysDiff; });
  return candidates[0];
}

// ── MAIN ENTRY POINTS ─────────────────────────────────────────

// Called from any tab upload input
async function pdfHandleUpload(file, hintType) {
  if (!file) return;
  _PDF_FILE = file;
  _PDF_HINT = hintType || null;

  // Ensure modal is in the DOM before anything else — status display depends on it
  pdfInjectModal();

  // Non-PDF — route to CSV handler if it exists
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    if (typeof csvHandleUpload === 'function') csvHandleUpload(file, hintType);
    else alert('Please upload a PDF file. For CSV files use the CSV import option.');
    return;
  }

  // Show the modal immediately so user knows something is happening
  var _el = document.getElementById('pdf-modal');
  var _body = document.getElementById('pdf-modal-body');
  if (_el && _body) {
    _body.innerHTML = '<div style="text-align:center;padding:2rem;font-size:13px;color:var(--muted)">Reading ' + file.name + '…<br><br><span style="font-size:11px">This may take a few seconds</span></div>';
    _el.classList.add('open');
  }
  _pdfShowStatus('Reading ' + file.name + '…');

  try {
    var lines = await _pdfExtractText(file);
    if (!lines.length) {
      _pdfShowStatus('');
      // Scanned/image PDF — show vault save option instead of dead-end alert
      var _eb = document.getElementById('pdf-modal-body');
      if (_eb) {
        _eb.innerHTML =
          '<div style="background:var(--soft);border:1px solid var(--border);border-radius:10px;padding:1rem;margin-bottom:.75rem">'
          +'<div style="font-size:13px;font-weight:500;margin-bottom:.35rem">This PDF could not be read</div>'
          +'<div style="font-size:12px;color:var(--muted);line-height:1.6;margin-bottom:.75rem">It appears to be a scanned or image-based document. Clarity cannot extract text from image PDFs. Save it to your vault and enter transactions manually.</div>'
          +'<button onclick="_pdfSaveToVaultOnly()" style="padding:7px 16px;border:none;border-radius:7px;background:var(--np);color:#fff;cursor:pointer;font-size:12px;font-weight:500;font-family:\'DM Sans\',sans-serif">Save to document vault</button>'
          +'</div>'
          +'<div style="display:flex;gap:.5rem;justify-content:flex-end">'
          +'<button onclick="pdfCancel()" style="padding:7px 16px;border:1px solid var(--border);border-radius:7px;background:none;cursor:pointer;font-size:13px;font-family:\'DM Sans\',sans-serif;color:var(--text)">Cancel</button>'
          +'</div>';
      }
      return;
    }

    var id = _pdfIdentify(lines, hintType);

    // Parse based on identified type
    var parsed;
    if      (id.type === 'bank')     parsed = _pdfParseBank(lines);
    else if (id.type === 'cc')       parsed = _pdfParseCC(lines);
    else if (id.type === 'pl')       parsed = _pdfParsePL(lines);
    else if (id.type === 'bs')       parsed = _pdfParseBS(lines);
    else if (id.type === 'register') parsed = _pdfParseRegister(lines);
    else if (id.type === 'donation') parsed = _pdfParseDonation(lines);
    else { parsed = { transactions: [], rows: [] }; }

    _PDF_RESULT = { type: id.type, institution: id.institution, confidence: id.confidence, file: file.name, parsed: parsed, lines: lines };

    _pdfShowStatus('');

    // Low confidence — show bucket picker first
    if (id.confidence < 50) {
      _pdfShowPicker(id);
    } else {
      _pdfShowConfirm();
    }

  } catch(e) {
    _pdfShowStatus('');
    alert('PDF read error: ' + (e.message || e));
    console.error('[pdfreader]', e);
  }
}

// Called from vault after file stored — offers import
function pdfMaybeImport(file, clientId) {
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) return;
  // Small delay so vault UI settles first
  setTimeout(function(){
    var msg = 'This looks like it might contain importable data.\n\nWould you like Clarity to read it and offer to import the transactions or report data?';
    if (confirm(msg)) pdfHandleUpload(file, null);
  }, 800);
}

// ── UI — BUCKET PICKER ────────────────────────────────────────
function _pdfShowPicker(id) {
  pdfInjectModal();
  var el = document.getElementById('pdf-modal'); if (!el) return;
  var buckets = [
    { key:'bank',     icon:'🏦', label:'Bank statement' },
    { key:'cc',       icon:'💳', label:'Credit card statement' },
    { key:'pl',       icon:'📊', label:'Profit & Loss report' },
    { key:'bs',       icon:'📋', label:'Balance sheet' },
    { key:'register', icon:'📒', label:'Account register' },
    { key:'donation', icon:'💝', label:'Donation report' }
  ];
  document.getElementById('pdf-modal-body').innerHTML =
    '<div style="margin-bottom:1rem">'
    + '<div style="font-size:13px;font-weight:500;margin-bottom:.25rem">What kind of document is this?</div>'
    + '<div style="font-size:12px;color:var(--muted)">We weren\'t sure — pick the type and we\'ll read it correctly.</div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">'
    + buckets.map(function(b){
        return '<button onclick="pdfPickerSelect(\''+b.key+'\')" style="padding:.75rem;border:1px solid var(--border);border-radius:8px;background:var(--soft);cursor:pointer;font-size:13px;text-align:left;font-family:\'DM Sans\',sans-serif;color:var(--text)">'
          + b.icon + ' ' + b.label + '</button>';
      }).join('')
    + '</div>';
  el.classList.add('open');
}

function pdfPickerSelect(type) {
  if (!_PDF_RESULT) return;
  // Re-parse with the chosen type
  var lines = _PDF_RESULT.lines;
  var parsed;
  if      (type === 'bank')     parsed = _pdfParseBank(lines);
  else if (type === 'cc')       parsed = _pdfParseCC(lines);
  else if (type === 'pl')       parsed = _pdfParsePL(lines);
  else if (type === 'bs')       parsed = _pdfParseBS(lines);
  else if (type === 'register') parsed = _pdfParseRegister(lines);
  else if (type === 'donation') parsed = _pdfParseDonation(lines);
  else parsed = {};
  _PDF_RESULT.type = type;
  _PDF_RESULT.parsed = parsed;
  _pdfShowConfirm();
}

// ── UI — CONFIRM SCREEN ───────────────────────────────────────
function _pdfShowConfirm() {
  pdfInjectModal();
  var el = document.getElementById('pdf-modal'); if (!el) return;
  var r  = _PDF_RESULT; if (!r) return;
  var p  = r.parsed;

  var typeLabels = { bank:'Bank statement', cc:'Credit card statement', pl:'Profit & Loss', bs:'Balance sheet', register:'Account register', donation:'Donation report' };
  var txns = p.transactions || p.rows || [];
  var count = txns.length;

  // Build preview table
  var previewRows = '';
  var cols = '';

  if (r.type === 'bank' || r.type === 'register') {
    cols = '<tr><th>Date</th><th>Description</th><th>Amount</th><th>Type</th></tr>';
    previewRows = txns.slice(0,8).map(function(t){
      return '<tr><td>'+t.date+'</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escHtml(t.description)+'</td>'
        +'<td style="color:'+(t.amount<0?'var(--red)':'var(--green)')+'">$'+Math.abs(t.amount||0).toFixed(2)+'</td>'
        +'<td style="font-size:11px;color:var(--muted)">'+( t.type||'—')+'</td></tr>';
    }).join('');
  } else if (r.type === 'cc') {
    cols = '<tr><th>Date</th><th>Description</th><th>Amount</th><th>Category</th><th>Suggested account</th></tr>';
    previewRows = txns.slice(0,8).map(function(t){
      var c2 = gc();
      var acctOpts = '<option value="">— select —</option>'
        + (c2 && c2.accounts ? c2.accounts.map(function(a){
            return '<option value="'+a.code+'"'+(a.code===t.suggestedCode?' selected':'')+'>'+a.code+' '+escHtml(a.name)+'</option>';
          }).join('') : '');
      return '<tr>'
        +'<td>'+t.date+'</td>'
        +'<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escHtml(t.description)+'</td>'
        +'<td style="color:'+(t.amount<0?'var(--green)':'var(--red)')+'">$'+Math.abs(t.amount||0).toFixed(2)+'</td>'
        +'<td style="font-size:11px"><span style="background:var(--soft);border-radius:4px;padding:2px 6px">'+t.category+'</span></td>'
        +'<td><select style="font-size:11px;padding:3px;border:1px solid var(--border);border-radius:4px;background:var(--soft);color:var(--text);max-width:160px">'+acctOpts+'</select></td>'
        +'</tr>';
    }).join('');
  } else if (r.type === 'pl' || r.type === 'bs') {
    cols = '<tr><th>Label</th><th>Amount</th><th>Type</th></tr>';
    previewRows = txns.slice(0,8).map(function(t){
      return '<tr><td>'+escHtml(t.label||'')+'</td>'
        +'<td>$'+Math.abs(t.amount||0).toFixed(2)+'</td>'
        +'<td style="font-size:11px;color:var(--muted)">'+(t.section||t.type||'—')+'</td></tr>';
    }).join('');
  } else if (r.type === 'donation') {
    cols = '<tr><th>Date</th><th>Gross</th><th>Fee</th><th>Net</th></tr>';
    previewRows = txns.slice(0,8).map(function(t){
      return '<tr><td>'+t.date+'</td><td>$'+t.gross.toFixed(2)+'</td><td style="color:var(--red)">$'+t.fee.toFixed(2)+'</td><td style="color:var(--green)">$'+t.net.toFixed(2)+'</td></tr>';
    }).join('');
  }

  // Payment match alerts for CC
  var matchAlerts = '';
  if (r.type === 'cc') {
    var payments = (p.transactions||[]).filter(function(t){ return t.category === 'payment'; });
    payments.forEach(function(t){
      var match = _pdfFindPaymentMatch(t.amount, t.date);
      if (match) {
        matchAlerts += '<div style="background:var(--amber-bg);border:1px solid var(--amber);border-radius:8px;padding:.6rem .9rem;margin-bottom:.5rem;font-size:12px">'
          +'💡 Payment of $'+Math.abs(t.amount).toFixed(2)+' on '+t.date
          +' may match <strong>'+escHtml(match.item.desc||'expense')+'</strong> in your books. '
          +'<span style="color:var(--muted)">Confirm during reconciliation.</span></div>';
      }
    });
  }

  // Summary bar
  var summary = '';
  if (r.type === 'cc' && p.summary) {
    var s = p.summary;
    summary = '<div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:.75rem;font-size:12px">'
      +'<span>Charges: <strong>$'+s.totalCharges.toFixed(2)+'</strong></span>'
      +'<span>Payments: <strong style="color:var(--green)">$'+s.totalPayments.toFixed(2)+'</strong></span>'
      +'<span>Interest: <strong style="color:var(--red)">$'+s.totalInterest.toFixed(2)+'</strong></span>'
      +'<span>Fees: <strong style="color:var(--amber)">$'+s.totalFees.toFixed(2)+'</strong></span>'
      +'</div>';
  }
  if (r.type === 'bank' && p.summary) {
    var sb2 = p.summary;
    summary = '<div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:.75rem;font-size:12px">'
      +(sb2.openingBalance!==null?'<span>Opening: <strong>$'+sb2.openingBalance.toFixed(2)+'</strong></span>':'')
      +(sb2.closingBalance!==null?'<span>Closing: <strong>$'+sb2.closingBalance.toFixed(2)+'</strong></span>':'')
      +'<span>Debits: <strong style="color:var(--red)">$'+sb2.totalDebits.toFixed(2)+'</strong></span>'
      +'<span>Credits: <strong style="color:var(--green)">$'+sb2.totalCredits.toFixed(2)+'</strong></span>'
      +'</div>';
  }

  document.getElementById('pdf-modal-body').innerHTML =
    '<div style="margin-bottom:.75rem">'
    +'<div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">'
    +'<span style="font-size:13px;font-weight:500">'+typeLabels[r.type]||r.type+'</span>'
    +(r.institution?'<span style="background:var(--soft);border-radius:10px;padding:2px 9px;font-size:11px">'+escHtml(r.institution)+'</span>':'')
    +'<span style="font-size:11px;color:var(--muted)">'+count+' item'+(count!==1?'s':'')+' found in '+escHtml(r.file)+'</span>'
    +'<button onclick="pdfPickerSelect(\''+r.type+'\')" style="font-size:11px;color:var(--muted);background:none;border:none;cursor:pointer;text-decoration:underline;font-family:\'DM Sans\',sans-serif">Wrong type?</button>'
    +'</div></div>'
    + matchAlerts
    + summary
    +(count
      ? '<div style="overflow-x:auto;max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-bottom:.75rem">'
        +'<table style="font-size:12px"><thead>'+cols+'</thead><tbody>'+previewRows+'</tbody></table>'
        +(count>8?'<div style="padding:.5rem .75rem;font-size:11px;color:var(--muted);border-top:1px solid var(--border)">Showing first 8 of '+count+' items</div>':'')
        +'</div>'
      : '<div style="background:var(--soft);border:1px solid var(--border);border-radius:10px;padding:1rem;margin-bottom:.75rem">'
        +'<div style="font-size:13px;font-weight:500;margin-bottom:.35rem">No transactions could be read from this file</div>'
        +'<div style="font-size:12px;color:var(--muted);line-height:1.6;margin-bottom:.75rem">This usually means the PDF is scanned or image-based. Your file will be saved to your document vault so you can reference it and enter transactions manually.</div>'
        +'<button onclick="_pdfSaveToVaultOnly()" style="padding:7px 16px;border:none;border-radius:7px;background:var(--np);color:#fff;cursor:pointer;font-size:12px;font-weight:500;font-family:\'DM Sans\',sans-serif">Save to document vault</button>'
        +'</div>')
    +'<div style="display:flex;gap:.5rem;justify-content:flex-end">'
    +'<button onclick="pdfCancel()" style="padding:7px 16px;border:1px solid var(--border);border-radius:7px;background:none;cursor:pointer;font-size:13px;font-family:\'DM Sans\',sans-serif;color:var(--text)">Cancel</button>'
    +(count?'<button onclick="pdfConfirmImport()" style="padding:7px 16px;border:none;border-radius:7px;background:var(--green);color:#fff;cursor:pointer;font-size:13px;font-weight:500;font-family:\'DM Sans\',sans-serif">Import '+count+' item'+(count!==1?'s':'')+'</button>':'')
    +'</div>';

  el.classList.add('open');
}

// ── IMPORT DISPATCH ───────────────────────────────────────────
function pdfConfirmImport() {
  var r = _PDF_RESULT; if (!r) return;
  var c = gc(); if (!c) { alert('No client open.'); return; }

  if (r.type === 'bank')     _pdfImportBank(c, r.parsed);
  else if (r.type === 'cc')  _pdfImportCC(c, r.parsed);
  else if (r.type === 'pl' || r.type === 'bs') _pdfImportReport(c, r);
  else if (r.type === 'register') _pdfImportRegister(c, r.parsed);
  else if (r.type === 'donation') _pdfImportDonation(c, r.parsed);

  // Fire switcher callback if one is registered (single-use, cleared inside callback)
  if (typeof _PDF_SW_CALLBACK === 'function') {
    try { _PDF_SW_CALLBACK(r.file); } catch(e) { _PDF_SW_CALLBACK = null; }
  }

  pdfCancel();
}

function _pdfImportBank(c, parsed) {
  if (!c.expenses) c.expenses = [];
  if (!c.income)   c.income   = [];
  var imported = 0;
  (parsed.transactions || []).forEach(function(t){
    if (!t.date || t.amount === null) return;
    var id = uid();
    if (t.amount < 0 || t.type === 'debit') {
      c.expenses.push({ id:id, desc:t.description, amt:Math.abs(t.amount), date:t.date, cat:t.category==='service_charge'?'Bank Fees':'Uncategorized', acctCode:'', reconciled:false, fromImport:true });
    } else {
      c.income.push({ id:id, name:t.description, recv:t.amount, proj:t.amount, date:t.date, cat:'Other Income', acctCode:'', reconciled:false, fromImport:true });
    }
    imported++;
  });
  sv();
  if (typeof renderAll === 'function') renderAll();
  _pdfToast(imported + ' bank transactions imported. Review and categorize in your Expenses / Income tabs.');
}

function _pdfImportCC(c, parsed) {
  if (!c.expenses) c.expenses = [];
  var imported = 0;
  (parsed.transactions || []).forEach(function(t){
    if (!t.date || t.amount === null) return;
    if (t.category === 'payment') {
      // Log payment as a transfer — not a regular expense
      c.expenses.push({ id:uid(), desc:'CC Payment — '+t.description, amt:Math.abs(t.amount), date:t.date, cat:'Credit Card Payment', acctCode:t.suggestedCode||'2100', reconciled:false, fromImport:true, ccPayment:true });
    } else if (t.category === 'credit') {
      // Credit/refund — negative expense
      c.expenses.push({ id:uid(), desc:t.description, amt:-Math.abs(t.amount), date:t.date, cat:'CC Refund', acctCode:t.suggestedCode||'', reconciled:false, fromImport:true });
    } else {
      c.expenses.push({ id:uid(), desc:t.description, amt:Math.abs(t.amount), date:t.date, cat:'Uncategorized', acctCode:t.suggestedCode||'', reconciled:false, fromImport:true, ccCategory:t.category });
    }
    imported++;
  });
  sv();
  if (typeof renderAll === 'function') renderAll();
  _pdfToast(imported + ' CC transactions imported. Review accounts in Expenses — suggested accounts are pre-filled.');
}

function _pdfImportReport(c, r) {
  // For switcher/historical flow — store raw parsed data on client
  if (!c.historicalReports) c.historicalReports = [];
  c.historicalReports.push({ type:r.type, institution:r.institution, file:r.file, importedAt:new Date().toISOString(), data:r.parsed });
  sv();
  _pdfToast('Historical ' + (r.type==='pl'?'P&L':'Balance Sheet') + ' saved. View it in the Switcher tab.');
}

function _pdfImportRegister(c, parsed) {
  if (!c.expenses) c.expenses = [];
  var imported = 0;
  (parsed.transactions || []).forEach(function(t){
    if (!t.date) return;
    c.expenses.push({ id:uid(), desc:t.description, amt:Math.abs(t.amount||0), date:t.date, cat:'Uncategorized', reconciled:t.reconciled||false, fromImport:true });
    imported++;
  });
  sv();
  if (typeof renderAll === 'function') renderAll();
  _pdfToast(imported + ' register transactions imported.');
}

function _pdfImportDonation(c, parsed) {
  if (!c.income) c.income = [];
  var imported = 0;
  (parsed.transactions || []).forEach(function(t){
    c.income.push({ id:uid(), name:t.description, recv:t.net, proj:t.gross, date:t.date, cat:'Donations', platformFee:t.fee, fromImport:true, reconciled:false });
    imported++;
  });
  sv();
  if (typeof renderAll === 'function') renderAll();
  _pdfToast(imported + ' donations imported. Platform fees are noted on each entry.');
}

// ── UTILITIES ─────────────────────────────────────────────────
function pdfCancel() {
  var el = document.getElementById('pdf-modal');
  if (el) el.classList.remove('open');
  _PDF_RESULT = null; _PDF_FILE = null; _PDF_HINT = null;
  // Clear switcher callback — prevents stale callback firing on next unrelated import
  if (typeof _PDF_SW_CALLBACK !== 'undefined') _PDF_SW_CALLBACK = null;
}

function _pdfShowStatus(msg) {
  var el = document.getElementById('pdf-status');
  if (el) { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }
}

function _pdfToast(msg) {
  var t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--text);color:var(--surface);padding:10px 18px;border-radius:8px;font-size:13px;z-index:99999;max-width:420px;text-align:center;line-height:1.5;font-family:\'DM Sans\',sans-serif';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function(){ if (t.parentNode) t.parentNode.removeChild(t); }, 5000);
}

// ── MODAL HTML ────────────────────────────────────────────────
// Call once on page load, or paste into app.html directly before </body>
function pdfInjectModal() {
  if (document.getElementById('pdf-modal')) return;
  var div = document.createElement('div');
  div.innerHTML =
    '<div class="overlay" id="pdf-modal" onclick="if(event.target===this)pdfCancel()">'
    +'<div class="modal" style="max-width:640px">'
    +'<div class="m-head"><span class="m-title">📄 Import from PDF</span>'
    +'<button class="m-x" onclick="pdfCancel()">&#215;</button></div>'
    +'<div class="m-body" id="pdf-modal-body"></div>'
    +'</div></div>'
    +'<div id="pdf-status" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:1rem 1.5rem;font-size:13px;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,.12)">Reading PDF…</div>';
  document.body.appendChild(div.firstChild);
  document.body.appendChild(div.lastChild);
}

// Auto-inject on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', pdfInjectModal);
} else {
  pdfInjectModal();
}

// ── VAULT-ONLY SAVE (for unreadable PDFs) ────────────────────
function _pdfSaveToVaultOnly() {
  var file = _PDF_FILE;
  var c = gc();
  if (!file || !c) { pdfCancel(); return; }
  if (!isSignedIn()) {
    alert('Please sign in to save documents to your vault.');
    pdfCancel();
    showAuthScreen();
    return;
  }
  storageUpload(c.id, file).then(function(res) {
    if (res.error) { alert('Could not save to vault: ' + res.error); return; }
    if (!c.documents) c.documents = [];
    c.documents.push({
      id: uid(), name: file.name, category: 'Bank Statement',
      path: res.path, size: file.size, mimeType: file.type,
      uploadedAt: new Date().toISOString(),
      notes: 'Uploaded via PDF import — transactions entered manually',
      linkedTo: ''
    });
    sv();
    pdfCancel();
    if (typeof renderDocumentVault === 'function') renderDocumentVault(c);
    _pdfToast('Saved to your document vault. Find it in the Documents tab.');
  });
}
