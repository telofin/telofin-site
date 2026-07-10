// ══════════════════════════════════════════
// STATE
// ══════════════════════════════════════════
var _recurPosted=[];
var STORE='clarity-v2',D={clients:[]},CID=null,acMode='np',firstMode='np',EI=-1,DONOR_EI=-1,DONATION_EI=-1,AG=null,CF='all',RST_F='all',DONOR_F='all',SRCH={},_plan='free',RECON_ACCT='bank',REIMB_EI=-1;
// Keyed by panel id, same convention as SRCH — sort/date-range state for list views (Expenses).
var SORT_STATE={},DATE_RANGE={};

// ══════════════════════════════════════════
// CORE HELPERS
// ══════════════════════════════════════════
var _svSyncTimer=null;
function sv(){
  try{localStorage.setItem(STORE,JSON.stringify(D));}catch(e){
    // Fix 8: localStorage quota warning
    if(e&&(e.name==='QuotaExceededError'||e.code===22||e.code===1014)){
      console.warn('[clarity] localStorage quota exceeded — data not saved locally. Cloud sync still active.');
      var qw=document.getElementById('quota-warning');
      if(!qw){qw=document.createElement('div');qw.id='quota-warning';qw.style.cssText='position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#c0392b;color:#fff;padding:10px 18px;border-radius:8px;font-size:12px;z-index:99999;max-width:340px;text-align:center;line-height:1.5';qw.innerHTML='<i class="fas fa-triangle-exclamation"></i> Storage limit reached. Your data is syncing to the cloud, but local backup is full. Sign in to ensure your data is safe.';document.body.appendChild(qw);setTimeout(function(){if(qw.parentNode)qw.parentNode.removeChild(qw);},7000);}
    }
  }
  if(_user){
    // Show pending indicator immediately — Supabase sync fires after 1.5s quiet
    var _sm=document.getElementById('sb-sync-msg');
    if(_sm&&typeof _lastSynced!=='undefined')_sm.textContent='Saving…';
    // Debounce Supabase sync — batch rapid saves into one write every 1.5s
    clearTimeout(_svSyncTimer);
    _svSyncTimer=setTimeout(function(){try{syncToSupabase();}catch(e){}},1500);
  }
}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2);}

// numToWords(amount): the standard legal "amount in words" line printed on a check —
// e.g. 1234.56 -> "One thousand two hundred thirty-four and 56/100". Cents are always
// shown as a fraction over 100, never spelled out, per standard check-writing convention.
function numToWords(amount){
  var n=Math.floor(Math.abs(Number(amount)||0));
  var cents=Math.round((Math.abs(Number(amount)||0)-n)*100);
  var ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
    'Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  var tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  var scales=['','Thousand','Million','Billion'];
  function threeDigits(x){
    var s='';
    if(x>=100){s+=ones[Math.floor(x/100)]+' Hundred';x=x%100;if(x)s+=' ';}
    if(x>=20){s+=tens[Math.floor(x/10)];if(x%10)s+='-'+ones[x%10].toLowerCase();}
    else if(x>0){s+=ones[x];}
    return s;
  }
  var words='';
  if(n===0){
    words='Zero';
  }else{
    var groups=[];
    var rem=n;
    while(rem>0){groups.push(rem%1000);rem=Math.floor(rem/1000);}
    for(var i=groups.length-1;i>=0;i--){
      if(groups[i]===0)continue;
      words+=(words?' ':'')+threeDigits(groups[i])+(scales[i]?' '+scales[i]:'');
    }
  }
  return words+' and '+(cents<10?'0':'')+cents+'/100';
}

// Next available COA code for a given account type. Scoped by a.type (not by
// string-matching the code's leading digit) so it keeps working correctly
// once codes cross a thousand boundary (e.g. 5990 -> 6000) — the old
// per-callsite versions of this logic all matched codes by string prefix,
// which silently stopped counting codes once they crossed into the next
// thousand, handing out the same "next" code to every account created after
// that point. Collision-avoidance loop is a backstop for any stray/manual
// code that doesn't fit the normal increment-by-10 pattern.
function _nextAcctCode(c,coaType){
  var prefix={Income:'4',Expense:'5',Asset:'1',Liability:'2',Equity:'3'}[coaType]||'5';
  var used=(c.accounts||[]).filter(function(a){return a.type===coaType;}).map(function(a){return parseInt(a.code)||0;});
  var next=used.length?Math.max.apply(null,used)+10:parseInt(prefix+'010');
  var taken={};(c.accounts||[]).forEach(function(a){taken[a.code]=true;});
  while(taken[String(next)])next++;
  return String(next);
}
// _ensureDedicatedCOA(c, name, type, cat): finds an existing account by exact name+type
// match, or creates one via _nextAcctCode. Returns the code either way. Generalizes the
// "auto-provision a dedicated COA account on first use" pattern bank accounts and credit
// cards already use (saveBankAcct()/bank.js saveCC()) — reused here for fixed assets, loans,
// accumulated depreciation, and interest expense, all of which need either a per-item
// dedicated account or a shared one that may not exist in every client's default COA (NP's
// default COA has none of these at all; PE has specific loan types but no generic bucket).
function _ensureDedicatedCOA(c,name,type,cat){
  if(!c.accounts)c.accounts=[];
  var existing=c.accounts.find(function(a){return a.name===name&&a.type===type;});
  if(existing){
    // A matched default-COA account may be sitting inactive (never used by this client
    // before) — reactivate it now that something is actually posting to it, otherwise it'd
    // silently receive entries while staying hidden from the Chart of Accounts view.
    if(existing.active===false)existing.active=true;
    return existing.code;
  }
  var code=_nextAcctCode(c,type);
  c.accounts.push({id:uid(),code:code,name:name,type:type,cat:cat||name});
  c.accounts.sort(function(a,b){return a.code.localeCompare(b.code);});
  return code;
}

// ── FUND HELPERS ────────────────────────
function getFunds(){var c=gc();return c&&c.funds?c.funds:[];}
function fundOpts(selectedVal,includeBlank){
  var opts=includeBlank?'<option value="">— None —</option>':'';
  getFunds().forEach(function(f){opts+='<option value="'+escHtml(f.name)+'"'+(f.name===selectedVal?' selected':'')+'>'+escHtml(f.name)+(f.type?' ('+f.type+')':'')+'</option>';});
  return opts;
}
function renderFundsManager(){
  var c=gc();if(!c)return;
  var funds=c.funds||[];
  var p=g('p-funds');if(!p)return;
  var rows=funds.map(function(f,i){return'<tr><td style="font-weight:500">'+escHtml(f.name)+'</td><td><span class="badge '+(f.type==='Restricted'?'b-amber':f.type==='Capital'?'b-blue':'b-green')+'">'+f.type+'</span></td><td style="color:var(--muted);font-size:11px">'+escHtml(f.desc||'—')+'</td><td><div class="row-acts"><button class="e-btn" onclick="editFund('+i+')">&#9998;</button><button class="d-btn" onclick="deleteFund('+i+')">&#215;</button></div></td></tr>';}).join('');
  p.innerHTML=FB()+XB()+'<div class="xbar" style="margin-bottom:.75rem"><button class="xbtn p" onclick="FUND_EI=-1;resetFundForm();openM(\'m-fund\')">+ Add fund</button></div>'
  +'<div class="card"><div class="c-head"><span class="c-title">Funds</span><span style="font-size:11px;color:var(--muted)">Define unrestricted, restricted, and capital funds</span></div>'
  +(funds.length?'<table><thead><tr><th>Fund name</th><th>Type</th><th>Description</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>':ES('No funds defined yet','Add General Operating, Restricted, or Capital funds to track money across your organization.','FUND_EI=-1;openM(\'m-fund\')'))
  +'</div>';
}
var FUND_EI=-1;
function resetFundForm(){['fund-name','fund-desc'].forEach(function(id){var el=g(id);if(el)el.value='';});var t=g('fund-type');if(t)t.value='Unrestricted';}
function saveFund(){
  var c=gc();if(!c.funds)c.funds=[];
  var name=g('fund-name').value.trim();if(!name){alert('Fund name is required.');return;}
  var item={id:FUND_EI>=0?(c.funds[FUND_EI].id||uid()):uid(),name:name,type:g('fund-type').value,desc:g('fund-desc').value.trim()};
  if(FUND_EI>=0)c.funds[FUND_EI]=item;else{if(c.funds.find(function(f){return f.name===name;})){alert('A fund with that name already exists.');return;}c.funds.push(item);}
  FUND_EI=-1;sv();renderFundsManager();refreshFundDropdowns();closeM('m-fund');resetFundForm();
}
function editFund(i){var c=gc();if(!c.funds[i])return;FUND_EI=i;var f=c.funds[i];g('fund-name').value=f.name||'';g('fund-type').value=f.type||'Unrestricted';g('fund-desc').value=f.desc||'';openM('m-fund');}
function deleteFund(i){var c=gc();if(!c.funds||!c.funds[i])return;if(!confirm('Delete fund "'+c.funds[i].name+'"? This won\'t remove the fund tag from existing transactions.'))return;c.funds.splice(i,1);sv();renderFundsManager();}
function refreshFundDropdowns(){
  // Rebuild all live fund selects in currently open modals
  ['i-fund','e-f','b-fund','acct-fund'].forEach(function(id){
    var el=g(id);if(!el||el.tagName!=='SELECT')return;
    var cur=el.value;el.innerHTML=fundOpts(cur,true);
  });
}
function fmt(n){return'$'+Number(n||0).toLocaleString();}
// ── NUMERIC VALIDATION ───────────────────────────────────────────
// validateAmt(val, opts) — returns error string or null if valid.
// opts.allowZero  : true  → zero is accepted (default false)
// opts.allowNeg   : true  → negative values accepted (default false)
// opts.label      : field label for error message (default 'Amount')
function validateAmt(val,opts){
  opts=opts||{};
  var label=opts.label||'Amount';
  var n=Number(val);
  if(val===''||val===null||val===undefined){return label+' is required.';}
  if(isNaN(n)||!isFinite(n)){return label+' must be a valid number.';}
  if(!opts.allowNeg&&n<0){return label+' cannot be negative.';}
  if(!opts.allowZero&&n===0){return label+' must be greater than zero.';}
  return null;// valid
}
// isDateLocked(c, dateStr) — returns true if dateStr (MM/DD/YYYY) falls on or before c.closedThrough.
// Call at top of every save path that writes a dated transaction.
function isDateLocked(c,dateStr){
  if(!c||!c.closedThrough||!dateStr)return false;
  // Parse as local date to avoid UTC shift
  function _toMs(s){var p=s.split('/');if(p.length!==3)return NaN;return new Date(Number(p[2]),Number(p[0])-1,Number(p[1])).getTime();}
  var txMs=_toMs(dateStr);
  var ctMs=_toMs(c.closedThrough);
  if(isNaN(txMs)||isNaN(ctMs))return false;
  return txMs<=ctMs;
}
// periodLockAlert(dateStr) — shows a standard alert and returns true (caller should abort save).
function periodLockAlert(dateStr){
  alert('Period locked\n\nTransactions dated on or before '+dateStr+' cannot be added or edited because this period has been closed.\n\nTo make changes, go to Settings → Closed Periods and remove or adjust the lock date.');
  return true;
}
function fmtAmt(el){var next=el.nextElementSibling;if(!next||!next.classList.contains('amt-fmt')){var d=document.createElement('div');d.className='amt-fmt';d.style.cssText='font-size:11px;color:var(--green);font-weight:500;margin-top:2px;min-height:14px';el.parentNode.insertBefore(d,el.nextSibling);next=d;}next.textContent=el.value?'$'+Number(el.value).toLocaleString():'';}
function pct(a,b){return b>0?Math.round((a/b)*100):0;}
function today(){return new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});}
function todayNum(){var d=new Date();return(d.getMonth()+1).toString().padStart(2,'0')+'/'+d.getDate().toString().padStart(2,'0')+'/'+d.getFullYear();}
function todayKey(){var d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function ini(n){var p=(n||'').trim().split(' '),s='';for(var i=0;i<p.length;i++){if(p[i])s+=p[i][0];}return s.slice(0,2).toUpperCase()||'?';}
function gc(){for(var i=0;i<D.clients.length;i++){if(D.clients[i].id===CID)return D.clients[i];}return null;}
function mkC(){return{id:uid(),name:'',type:'np',fiscalYearEnd:'12/31',basisType:'accrual',income:[],expenses:[],journal:[],actions:[],revenue:[],budgetItems:[],proposedBudget:[],proposedBudgets:[],adoptedBudgets:[],grants:[],donors:[],invoices:[],journalEntries:[],balanceSheet:{assets:[],liabilities:[],equity:[]},reconciliations:[],procurement:[],accounts:[],bills:[],loans:[],importRules:[],payroll:[],projects:[],bankAccounts:[],creditCards:[],funds:[],mileage:[],fixedAssets:[],ledgerEntries:[],deprPosted:{},closedThrough:null,vendors:[],customers:[],pettyCash:[],taxJurisdictions:[]};}
function defaultBasis(type){return type==='np'?'accrual':'cash';}
// basisInc(c, r): returns the income amount for item r using client's basisType.
//   cash:    NP=recv, SB=act, PE=amt
//   accrual: NP=proj, SB=proj, PE=amt (PE has no accrual concept)
// Pass optional overrideBasis to use a specific basis regardless of client setting.
function basisInc(c,r,overrideBasis){
  // Priority: explicit override > RPT_BASIS session toggle > client default
  var basis=overrideBasis||(typeof RPT_BASIS!=='undefined'&&RPT_BASIS?RPT_BASIS:null)||(c&&c.basisType)||'cash';
  if(!c||!r)return 0;
  if(c.type==='sb')return basis==='accrual'?Number(r.proj||0):Number(r.act||0);
  if(c.type==='np')return basis==='accrual'?Number(r.proj||0):Number(r.recv||0);
  return Number(r.amt||r.recv||r.act||0);// PE has no accrual concept
}

// ============================================================
// DOUBLE-ENTRY POSTING ENGINE  (Phase 1-B)
// ============================================================
// Account normal balance sides:
//   Asset / Expense  -> debit side (dr increases balance)
//   Liability / Equity / Income -> credit side (cr increases balance)
function _acctNormalSide(acctType){
  if(!acctType)return 'dr';
  var t=(acctType+'').toLowerCase();
  if(t==='asset'||t==='expense')return 'dr';
  return 'cr';
}

// Resolve an account object from COA by code, cat, or name.
function _resolveAcctObj(c,codeOrCat){
  if(!codeOrCat)return null;
  var accts=c.accounts||[];
  return accts.find(function(a){return a.code===codeOrCat||a.cat===codeOrCat||a.name===codeOrCat;})||null;
}

// postToLedger(c, debitCode, creditCode, amt, memo, sourceType, sourceId)
// Records one balanced double-entry ledger entry.
//   c          : client object (mutated in place)
//   debitCode  : COA code of the account to debit
//   creditCode : COA code of the account to credit
//   amt        : positive number
//   memo       : string description
//   sourceType : 'expense'|'income'|'revenue'|'je'|'void'|'recurring'|'depreciation'
//   sourceId   : id of the originating transaction (for cross-reference)
// Returns the ledger entry, or null if amt is zero/invalid.
function postToLedger(c,debitCode,creditCode,amt,memo,sourceType,sourceId){
  if(!c)return null;
  var n=Number(amt||0);
  if(!isFinite(n)||n===0)return null;
  if(!c.ledgerEntries)c.ledgerEntries=[];
  // COA TYPE GUARD: warn if debit/credit targets look reversed.
  // Expenses and payments legitimately credit Asset accounts (cash out) and
  // income legitimately debits Asset accounts (cash in), so those are excluded.
  // Only warn on genuinely suspicious patterns.
  if(c.accounts){
    var _drAcct=(c.accounts||[]).find(function(a){return a.code===debitCode;});
    var _crAcct=(c.accounts||[]).find(function(a){return a.code===creditCode;});
    var _expenseType=sourceType==='expense'||sourceType==='payment'||sourceType==='reimbursement';
    var _incomeType=sourceType==='income'||sourceType==='revenue'||sourceType==='invoice';
    // Debiting a credit-normal account is only suspicious if it's not an income/receipt entry
    // AND not a payment paying down a liability (e.g. paying a bill debits Accounts Payable).
    if(_drAcct&&_acctNormalSide(_drAcct.type)==='cr'&&!_incomeType&&!(_expenseType&&(_drAcct.type+'').toLowerCase()==='liability')){
      console.warn('[COA guard] Debiting a credit-normal account:',debitCode,_drAcct.name,'type:',_drAcct.type,'memo:',memo);
    }
    // Crediting a debit-normal account is only suspicious if it's not an expense/payment entry
    if(_crAcct&&_acctNormalSide(_crAcct.type)==='dr'&&!_expenseType){
      console.warn('[COA guard] Crediting a debit-normal account:',creditCode,_crAcct.name,'type:',_crAcct.type,'memo:',memo);
    }
  }
  var entry={
    id:uid(),
    date:todayNum(),
    memo:memo||'',
    sourceType:sourceType||'',
    sourceId:sourceId||'',
    createdAt:new Date().toISOString(),
    lines:[
      {accountCode:debitCode,dr:Math.abs(n),cr:0},
      {accountCode:creditCode,dr:0,cr:Math.abs(n)}
    ]
  };
  c.ledgerEntries.push(entry);
  if(typeof dwUpsertLedgerEntry==='function')dwUpsertLedgerEntry(c,entry);
  return entry;
}

// updateLedgerEntry: for edits — supersedes prior entries and posts a fresh one.
function updateLedgerEntry(c,sourceId,debitCode,creditCode,newAmt,memo,sourceType){
  if(!c||!sourceId)return;
  if(!c.ledgerEntries)c.ledgerEntries=[];
  c.ledgerEntries.forEach(function(e){
    if(e.sourceId===sourceId&&!e.superseded){
      e.superseded=true;
      if(typeof dwUpsertLedgerEntry==='function')dwUpsertLedgerEntry(c,e);
    }
  });
  postToLedger(c,debitCode,creditCode,newAmt,memo,sourceType,sourceId);
}

// voidLedgerEntry: creates reversal entries (swap dr/cr) for all active entries matching sourceId.
function voidLedgerEntry(c,sourceId){
  if(!c||!sourceId||!c.ledgerEntries)return;
  var toReverse=c.ledgerEntries.filter(function(e){return e.sourceId===sourceId&&!e.superseded;});
  toReverse.forEach(function(e){
    var rev={
      id:uid(),
      date:todayNum(),
      memo:'VOID: '+e.memo,
      sourceType:'void',
      sourceId:sourceId,
      reversalOf:e.id,
      createdAt:new Date().toISOString(),
      lines:e.lines.map(function(l){return{accountCode:l.accountCode,dr:l.cr,cr:l.dr};})
    };
    c.ledgerEntries.push(rev);
    e.superseded=true;
    if(typeof dwUpsertLedgerEntry==='function'){dwUpsertLedgerEntry(c,e);dwUpsertLedgerEntry(c,rev);}
  });
}

// Convenience helpers for common account codes
function _defaultCashCode(c){
  var cash=(c.accounts||[]).find(function(a){return a.type==='Asset'&&(a.code==='1010'||a.cat==='Cash');});
  return cash?cash.code:'1010';
}
function _defaultAPCode(c){
  var ap=(c.accounts||[]).find(function(a){return a.code==='2010'||a.cat==='Payables';});
  return ap?ap.code:'2010';
}
function _defaultARCode(c){
  var ar=(c.accounts||[]).find(function(a){return a.code==='1200'||a.cat==='Receivables';});
  return ar?ar.code:'1200';
}
// _defaultSTaxCode(c) — returns the Sales Tax Payable account code (2350) if it exists in COA.
function _defaultSTaxCode(c){
  var st=(c.accounts||[]).find(function(a){return a.cat==='Sales Tax'||a.code==='2350';});
  return st?st.code:'2350';
}

// MULTI-JURISDICTION SALES TAX
// Starter list -- rates as of 2024. ALWAYS verify with your tax authority before filing.
var STARTER_JURISDICTIONS=[
  {name:'Alabama',rate:4.00,freq:'monthly',authority:'Alabama Dept. of Revenue'},
  {name:'Arizona',rate:5.60,freq:'monthly',authority:'Arizona Dept. of Revenue'},
  {name:'Arkansas',rate:6.50,freq:'monthly',authority:'Arkansas DFA'},
  {name:'California',rate:7.25,freq:'quarterly',authority:'California CDTFA'},
  {name:'Colorado',rate:2.90,freq:'monthly',authority:'Colorado Dept. of Revenue'},
  {name:'Connecticut',rate:6.35,freq:'monthly',authority:'Connecticut DRS'},
  {name:'Florida',rate:6.00,freq:'monthly',authority:'Florida Dept. of Revenue'},
  {name:'Georgia',rate:4.00,freq:'monthly',authority:'Georgia Dept. of Revenue'},
  {name:'Illinois',rate:6.25,freq:'monthly',authority:'Illinois Dept. of Revenue'},
  {name:'Indiana',rate:7.00,freq:'monthly',authority:'Indiana DOR'},
  {name:'Kansas',rate:6.50,freq:'monthly',authority:'Kansas Dept. of Revenue'},
  {name:'Kentucky',rate:6.00,freq:'monthly',authority:'Kentucky DOR'},
  {name:'Louisiana',rate:4.45,freq:'monthly',authority:'Louisiana DOR'},
  {name:'Maryland',rate:6.00,freq:'monthly',authority:'Maryland Comptroller'},
  {name:'Massachusetts',rate:6.25,freq:'monthly',authority:'Massachusetts DOR'},
  {name:'Michigan',rate:6.00,freq:'monthly',authority:'Michigan Treasury'},
  {name:'Minnesota',rate:6.875,freq:'quarterly',authority:'Minnesota Dept. of Revenue'},
  {name:'Missouri',rate:4.225,freq:'monthly',authority:'Missouri DOR'},
  {name:'Nevada',rate:6.85,freq:'monthly',authority:'Nevada DOR'},
  {name:'New Jersey',rate:6.625,freq:'monthly',authority:'New Jersey Division of Taxation'},
  {name:'New Mexico',rate:5.00,freq:'monthly',authority:'New Mexico TRD'},
  {name:'New York',rate:4.00,freq:'quarterly',authority:'New York Dept. of Tax & Finance'},
  {name:'New York City',rate:8.875,freq:'quarterly',authority:'NYC Dept. of Finance'},
  {name:'North Carolina',rate:4.75,freq:'monthly',authority:'NC Dept. of Revenue'},
  {name:'Ohio',rate:5.75,freq:'monthly',authority:'Ohio Dept. of Taxation'},
  {name:'Oklahoma',rate:4.50,freq:'monthly',authority:'Oklahoma Tax Commission'},
  {name:'Pennsylvania',rate:6.00,freq:'monthly',authority:'Pennsylvania Dept. of Revenue'},
  {name:'Philadelphia',rate:8.00,freq:'monthly',authority:'Philadelphia Dept. of Revenue'},
  {name:'South Carolina',rate:6.00,freq:'monthly',authority:'SC Dept. of Revenue'},
  {name:'Tennessee',rate:7.00,freq:'monthly',authority:'Tennessee Dept. of Revenue'},
  {name:'Texas',rate:6.25,freq:'monthly',authority:'Texas Comptroller'},
  {name:'Utah',rate:4.85,freq:'monthly',authority:'Utah State Tax Commission'},
  {name:'Virginia',rate:5.30,freq:'monthly',authority:'Virginia Dept. of Taxation'},
  {name:'Washington',rate:6.50,freq:'monthly',authority:'Washington Dept. of Revenue'},
  {name:'Wisconsin',rate:5.00,freq:'monthly',authority:'Wisconsin Dept. of Revenue'}
];
function taxJurOpts(c){
  var jurs=(c&&c.taxJurisdictions)||[];
  if(!jurs.length)return'<option value="">No jurisdictions saved yet</option>';
  return'<option value="">-- Select jurisdiction --</option>'
    +jurs.map(function(j){return'<option value="'+escHtml(j.name)+'" data-rate="'+j.rate+'">'+escHtml(j.name)+' ('+j.rate+'%)</option>';}).join('');
}

// getTrialBalance(c) — returns array of {code,name,type,dr,cr,balance,normalSide}
// Sums all non-superseded ledger entries. Grand total dr === grand total cr if books balance.
function getTrialBalance(c,asOfDate){
  if(!c)return[];
  // asOfDate: 'YYYY-MM-DD' string or null (all entries)
  var asOf=asOfDate?new Date(asOfDate+' 23:59:59'):null;
  var map={};
  (c.ledgerEntries||[]).forEach(function(e){
    if(e.superseded)return;
    if(asOf){
      var eDate=e.date?new Date(String(e.date).length===8
        ?String(e.date).slice(0,4)+'-'+String(e.date).slice(4,6)+'-'+String(e.date).slice(6,8)
        :e.date):null;
      if(eDate&&eDate>asOf)return;
    }
    (e.lines||[]).forEach(function(l){
      if(!l.accountCode)return;
      if(!map[l.accountCode])map[l.accountCode]={dr:0,cr:0};
      map[l.accountCode].dr+=Number(l.dr||0);
      map[l.accountCode].cr+=Number(l.cr||0);
    });
  });
  var accts=c.accounts||[];
  var rows=Object.keys(map).map(function(code){
    var acct=accts.find(function(a){return a.code===code;})||{name:code,type:'Unknown'};
    var side=_acctNormalSide(acct.type);
    var dr=map[code].dr,cr=map[code].cr;
    var balance=side==='dr'?dr-cr:cr-dr;
    return{code:code,name:acct.name||code,type:acct.type||'Unknown',dr:dr,cr:cr,balance:balance,normalSide:side};
  });
  rows.sort(function(a,b){return a.code.localeCompare(b.code);});
  return rows;
}

// getBSFromLedger(c)
// Derives a classified balance sheet directly from ledgerEntries[].
// Returns { assets, liabilities, equity, netIncome, totalAssets, totalLiab, totalEquity, totalEquityPlusIncome, balanced }
// Income and Expense accounts are temporary — their net flows into equity as current-period net income.
// This is the GAAP-correct view: it will always agree with getTrialBalance().
function getBSFromLedger(c){
  if(!c)return{assets:[],liabilities:[],equity:[],netIncome:0,totalAssets:0,totalLiab:0,totalEquity:0,totalEquityPlusIncome:0,balanced:false};
  var tb=getTrialBalance(c);
  var assets=[],liabilities=[],equity=[],incomeAccts=[],expenseAccts=[];
  tb.forEach(function(r){
    var t=(r.type||'').toLowerCase();
    if(t==='asset')assets.push(r);
    else if(t==='liability')liabilities.push(r);
    else if(t==='equity')equity.push(r);
    else if(t==='income'||t==='revenue')incomeAccts.push(r);
    else if(t==='expense')expenseAccts.push(r);
    // Unknown accounts: bucket by normal side to avoid losing them
    else if(r.normalSide==='dr')assets.push(r);
    else liabilities.push(r);
  });
  var totalAssets=assets.reduce(function(s,r){return s+r.balance;},0);
  var totalLiab=liabilities.reduce(function(s,r){return s+r.balance;},0);
  var totalEquity=equity.reduce(function(s,r){return s+r.balance;},0);
  var totalIncome=incomeAccts.reduce(function(s,r){return s+r.balance;},0);
  var totalExpense=expenseAccts.reduce(function(s,r){return s+r.balance;},0);
  // Net income = income - expenses (current period, not yet closed to equity)
  var netIncome=totalIncome-totalExpense;
  // Total equity including current period earnings
  var totalEquityPlusIncome=totalEquity+netIncome;
  // Balanced: assets = liabilities + equity + net income (within $0.01 rounding)
  var balanced=Math.abs(totalAssets-(totalLiab+totalEquityPlusIncome))<0.01;
  return{
    assets:assets,liabilities:liabilities,equity:equity,
    incomeAccts:incomeAccts,expenseAccts:expenseAccts,
    netIncome:netIncome,totalIncome:totalIncome,totalExpense:totalExpense,
    totalAssets:totalAssets,totalLiab:totalLiab,
    totalEquity:totalEquity,totalEquityPlusIncome:totalEquityPlusIncome,
    balanced:balanced
  };
}

// ══════════════════════════════════════════
// CASH FLOW STATEMENT
// ══════════════════════════════════════════
// _isCashAcct(a): true if the account is a cash/bank-type account.
function _isCashAcct(a){
  if(!a)return false;
  if((a.cat||'')==='Cash')return true;
  return isCashTypeAccount(a.name);
}
// _cfSection(a): classifies a non-cash account into 'operating' | 'investing' | 'financing'
// for cash flow purposes. Uses an explicit a.cf tag on the COA account when present
// (see COA_TEMPLATES below), otherwise infers from type/cat/name. Defaults to 'operating' —
// income, expenses, AR/AP, prepaid, accrued, sales tax, and net-asset/retained-earnings
// accounts are all operating unless tagged otherwise.
function _cfSection(a){
  if(!a)return'operating';
  if(a.cf)return a.cf;
  var cat=(a.cat||'').toLowerCase(),name=(a.name||'').toLowerCase();
  if(cat.indexOf('fixed asset')>=0||cat.indexOf('investment')>=0||name.indexOf('fixed asset')>=0)return'investing';
  if(cat.indexOf('loan')>=0||cat.indexOf('credit card')>=0||cat.indexOf('mortgage')>=0||name.indexOf('loan')>=0)return'financing';
  if(name.indexOf('owner draw')>=0||name.indexOf('owner contribut')>=0||name.indexOf('paid-in capital')>=0)return'financing';
  return'operating';
}
// getCashFlowStatement(c, startDate, endDate)
// Builds a period cash flow statement, both direct and indirect presentations of the
// operating section, from Date objects startDate/endDate (e.g. from getFiscalYear()).
//
// UPDATE (CLARITY_TODO queue item 2 — postings now exist): saveAsset()/saveLoan()/
// postLoanPayment() now post to c.ledgerEntries[] too (each fixed asset and loan gets its own
// dedicated COA account via _ensureDedicatedCOA). Investing/financing here still deliberately
// read from c.fixedAssets[]/c.loans[] + the amortization schedule rather than the ledger —
// that source was already correct and this wasn't rewritten alongside the posting fix, to
// avoid touching a delicate, already-correct calculation in the same pass. The unpostedGap
// check below (ending cash vs. computed net change) is the built-in proof the two sources now
// agree: it should compute to ~0 for any client with loan/asset activity, since the schedule
// and the ledger are describing the same cash movements. Fully re-sourcing investing/financing
// from ledgerEntries directly remains a nice-to-have unification for later — not required for
// correctness, since both sources already tie out.
function getCashFlowStatement(c,startDate,endDate){
  var empty={
    direct:{operating:[],opTotal:0},
    indirect:{netIncome:0,addbacks:[],addbackTotal:0,workingCapital:[],wcTotal:0,opTotal:0},
    investing:[],financing:[],invTotal:0,finTotal:0,
    netChange:0,openingCash:0,endingCash:0,unpostedGap:0,reconciled:true,diff:0
  };
  if(!c||!startDate||!endDate)return empty;
  function mdY(d){return(d.getMonth()+1).toString().padStart(2,'0')+'/'+d.getDate().toString().padStart(2,'0')+'/'+d.getFullYear();}
  var startStr=mdY(startDate),endStr=mdY(endDate);
  var accts=c.accounts||[];
  function acct(code){return accts.find(function(a){return a.code===code;})||null;}
  function inPeriod(d){return d&&d>=startDate&&d<=endDate;}

  var entries=(c.ledgerEntries||[]).filter(function(e){return!e.superseded&&inPeriod(parseDate(e.date));});

  // ── DIRECT METHOD (operating only — see data caveat above) ──────────────
  var dOp={};
  function bump(label,amt){if(!dOp[label])dOp[label]=0;dOp[label]+=amt;}
  entries.forEach(function(e){
    var lines=e.lines||[];
    var cashDelta=0,nonCash=[];
    lines.forEach(function(l){
      var a=acct(l.accountCode);
      var net=Number(l.dr||0)-Number(l.cr||0);
      if(_isCashAcct(a))cashDelta+=net;else nonCash.push({acct:a,net:net,mag:Math.abs(net)});
    });
    if(Math.abs(cashDelta)<0.005||!nonCash.length)return;
    var magTotal=nonCash.reduce(function(s,n){return s+n.mag;},0)||1;
    nonCash.forEach(function(n){
      var a=n.acct;
      if(_cfSection(a)!=='operating')return; // investing/financing handled separately below
      var share=cashDelta*(n.mag/magTotal);
      var t=(a&&a.type||'').toLowerCase(),cat=a?(a.cat||a.name):'Other';
      var label;
      if(t==='income')label='Cash received — '+cat;
      else if(t==='expense')label='Cash paid — '+cat;
      else if(a&&/receivable/i.test(a.cat||''))label='Collections on accounts receivable';
      else if(a&&/payable/i.test(a.cat||''))label='Payments on accounts payable';
      else label='Cash — '+cat;
      bump(label,share);
    });
  });
  var dOperating=Object.keys(dOp).sort().map(function(k){return{label:k,amt:dOp[k]};});

  // ── Loan interest (schedule-sourced, see data caveat) — included in operating for both methods ──
  var loanInterest=0;
  (c.loans||[]).forEach(function(loan){
    if(typeof calcAmort!=='function'||!loan.startDate)return;
    var amort=calcAmort(Number(loan.principal||0),Number(loan.rate||0),Number(loan.term||0));
    var posted=loan.posted||[];
    amort.rows.forEach(function(r){
      if(posted.indexOf(r.num)<0)return;
      var due=parseDate(loan.startDate);if(!due)return;due.setMonth(due.getMonth()+r.num);
      if(inPeriod(due))loanInterest+=r.interest;
    });
  });
  if(loanInterest>0.005){dOperating.push({label:'Interest paid on loans',amt:-loanInterest});dOp['Interest paid on loans']=-loanInterest;}
  var dOpTotal=dOperating.reduce(function(s,r){return s+r.amt;},0);

  // ── INVESTING & FINANCING (feature-array sourced — see data caveat) ─────
  var investing=[],financing=[];
  var assetPurchases=(c.fixedAssets||[]).filter(function(a){return inPeriod(parseDate(a.date));})
    .reduce(function(s,a){return s+Number(a.cost||0);},0);
  if(assetPurchases>0.005)investing.push({label:'Purchase of fixed assets',amt:-assetPurchases});
  var invTotal=investing.reduce(function(s,r){return s+r.amt;},0);

  var loanProceeds=0,loanPrincipal=0;
  (c.loans||[]).forEach(function(loan){
    if(inPeriod(parseDate(loan.startDate)))loanProceeds+=Number(loan.principal||0);
    if(typeof calcAmort!=='function'||!loan.startDate)return;
    var amort=calcAmort(Number(loan.principal||0),Number(loan.rate||0),Number(loan.term||0));
    var posted=loan.posted||[];
    amort.rows.forEach(function(r){
      if(posted.indexOf(r.num)<0)return;
      var due=parseDate(loan.startDate);if(!due)return;due.setMonth(due.getMonth()+r.num);
      if(inPeriod(due))loanPrincipal+=r.principal;
    });
  });
  if(loanProceeds>0.005)financing.push({label:'Proceeds from loans',amt:loanProceeds});
  if(loanPrincipal>0.005)financing.push({label:'Principal payments on debt',amt:-loanPrincipal});
  var finTotal=financing.reduce(function(s,r){return s+r.amt;},0);

  // ── INDIRECT METHOD: net income + non-cash addbacks + working capital changes ──
  var incomeCodes=accts.filter(function(a){return(a.type||'').toLowerCase()==='income';}).map(function(a){return a.code;});
  var expenseCodes=accts.filter(function(a){return(a.type||'').toLowerCase()==='expense';}).map(function(a){return a.code;});
  var incomeTotal=0,expenseTotal=0;
  entries.forEach(function(e){(e.lines||[]).forEach(function(l){
    if(incomeCodes.indexOf(l.accountCode)>=0)incomeTotal+=Number(l.cr||0)-Number(l.dr||0);
    if(expenseCodes.indexOf(l.accountCode)>=0)expenseTotal+=Number(l.dr||0)-Number(l.cr||0);
  });});
  var netIncome=incomeTotal-expenseTotal-loanInterest; // loan interest isn't in the ledger (see caveat) — fold it in here too

  var deprAmt=entries.filter(function(e){return e.sourceType==='depreciation';})
    .reduce(function(s,e){return s+(e.lines||[]).reduce(function(ls,l){return ls+Number(l.dr||0);},0);},0);
  var addbacks=deprAmt>0.005?[{label:'Depreciation & amortization',amt:deprAmt}]:[];
  var addbackTotal=addbacks.reduce(function(s,r){return s+r.amt;},0);

  var dayBefore=addDays(startStr,-1);
  var wcAccts=accts.filter(function(a){
    var t=(a.type||'').toLowerCase();
    return(t==='asset'||t==='liability')&&_cfSection(a)==='operating'&&!_isCashAcct(a);
  });
  var tbStart=getTrialBalance(c,dayBefore),tbEnd=getTrialBalance(c,endStr);
  function balOf(tb,code){var r=tb.find(function(x){return x.code===code;});return r?r.balance:0;}
  var workingCapital=[];
  wcAccts.forEach(function(a){
    var delta=balOf(tbEnd,a.code)-balOf(tbStart,a.code);
    if(Math.abs(delta)<0.005)return;
    var isAsset=(a.type||'').toLowerCase()==='asset';
    workingCapital.push({label:(isAsset?'(Increase) decrease in ':'Increase (decrease) in ')+(a.cat||a.name),amt:isAsset?-delta:delta});
  });
  var wcTotal=workingCapital.reduce(function(s,r){return s+r.amt;},0);
  var iOpTotal=netIncome+addbackTotal+wcTotal;

  var diff=Math.round((dOpTotal-iOpTotal)*100)/100;
  var reconciled=Math.abs(diff)<0.5;

  var cashCodes=accts.filter(_isCashAcct).map(function(a){return a.code;});
  var openingCash=cashCodes.reduce(function(s,code){return s+balOf(tbStart,code);},0);
  // "Ending cash" always ties to the real ledger balance (what the Balance Sheet shows) — never
  // derived as opening+netChange, since netChange includes fixed-asset/loan activity that (per the
  // data caveat above) hasn't actually posted to the ledger's cash accounts yet. Any gap between
  // computed netChange and the ledger's actual cash movement is surfaced explicitly below rather
  // than silently absorbed, so this statement never shows a cash figure that disagrees with the books.
  var endingCash=cashCodes.reduce(function(s,code){return s+balOf(tbEnd,code);},0);
  var netChange=dOpTotal+invTotal+finTotal;
  var actualLedgerChange=endingCash-openingCash;
  var unpostedGap=Math.round((netChange-actualLedgerChange)*100)/100;

  return{
    direct:{operating:dOperating,opTotal:dOpTotal},
    indirect:{netIncome:netIncome,addbacks:addbacks,addbackTotal:addbackTotal,workingCapital:workingCapital,wcTotal:wcTotal,opTotal:iOpTotal},
    investing:investing,financing:financing,invTotal:invTotal,finTotal:finTotal,
    netChange:netChange,openingCash:openingCash,endingCash:endingCash,
    unpostedGap:unpostedGap,
    reconciled:reconciled,diff:diff
  };
}


// Splits currently-uncosed income (all unsuperseded ledger lines hitting Income-type accounts)
// by net-asset restriction class, using the netClass tag saved on the originating c.income[]/
// c.revenue[] record (see _postDonationLedger in renders.js). Entries with no matching source
// record (manual journal entries, bank imports, invoices, etc.) default to 'without_restriction' —
// the standard assumption for exchange/program-service revenue. Uses the exact same ledger-line
// universe as getTrialBalance() (unsuperseded, no date filter) so the buckets sum to exactly
// lbs.totalIncome — required for the closing entry's debits to still equal its credits.
function _splitIncomeByRestriction(c){
  var buckets={without_restriction:0,with_restriction:0,with_restriction_perm:0};
  var srcById={};
  (c.income||[]).forEach(function(r){srcById[r.id]=r;});
  (c.revenue||[]).forEach(function(r){srcById[r.id]=r;});
  (c.ledgerEntries||[]).forEach(function(e){
    if(e.superseded)return;
    var src=srcById[e.sourceId];
    var cls=(src&&src.netClass)||'without_restriction';
    (e.lines||[]).forEach(function(l){
      if(!l.accountCode)return;
      var a=(c.accounts||[]).find(function(x){return x.code===l.accountCode;});
      if(!a||(a.type||'').toLowerCase()!=='income')return;
      var net=Number(l.cr||0)-Number(l.dr||0);// income is credit-normal
      if(!net)return;
      buckets[cls]=(buckets[cls]||0)+net;
    });
  });
  return buckets;
}
// Posts GAAP year-end closing entries to ledgerEntries[].
// Zeroes all Income and Expense account balances into the appropriate equity account.
//   NP:  Cr/Dr → split across 3010/3020/3030 by donor-restriction class (see _splitIncomeByRestriction)
//   SB:  Cr/Dr → 3020 Retained earnings
//   PE:  Cr/Dr → 3010 Net worth
// Also records a human-readable summary in c.journalEntries[] for the JE panel.
// Guards: requires ledger entries, blocks if already closed for this FY, respects period lock.
// Returns { ok:bool, message:string, netIncome:number }
function postClosingEntries(c, fyLabel){
  if(!c)return{ok:false,message:'No client.'};
  if(!c.ledgerEntries||!c.ledgerEntries.length)return{ok:false,message:'No ledger entries found. Save some transactions first.'};

  // Idempotency guard — never close the same FY twice
  if(!c.closingHistory)c.closingHistory=[];
  var alreadyClosed=c.closingHistory.find(function(h){return h.fy===fyLabel;});
  if(alreadyClosed)return{ok:false,message:'Closing entries for '+fyLabel+' were already posted on '+alreadyClosed.postedOn+'. Each fiscal year can only be closed once.'};

  // Period lock guard — closing date is fiscal year end
  var fy=getFiscalYear(c.fiscalYearEnd);
  var fyEndStr=(fy.end.getMonth()+1).toString().padStart(2,'0')+'/'+(fy.end.getDate()).toString().padStart(2,'0')+'/'+fy.end.getFullYear();
  // Use prior FY end for the actual closing date (we're closing the period that just ended)
  var priorFYEnd=new Date(fy.end);priorFYEnd.setFullYear(priorFYEnd.getFullYear()-1);
  var closeDate=(priorFYEnd.getMonth()+1).toString().padStart(2,'0')+'/'+(priorFYEnd.getDate()).toString().padStart(2,'0')+'/'+priorFYEnd.getFullYear();

  if(isDateLocked(c,closeDate))return{ok:false,message:'The closing date ('+closeDate+') falls in a locked period. Clear the period lock before posting closing entries.'};

  // Get current trial balance partition
  var lbs=getBSFromLedger(c);
  var incomeAccts=lbs.incomeAccts||[];
  var expenseAccts=lbs.expenseAccts||[];

  // Skip if nothing to close
  if(!incomeAccts.length&&!expenseAccts.length)return{ok:false,message:'No income or expense account balances to close. Post some transactions first.'};
  var netIncome=lbs.netIncome;

  // Determine the retained earnings / net assets target account
  // NP → 3010 Unrestricted net assets
  // SB → 3020 Retained earnings
  // PE → 3010 Net worth
  var retainedCode=c.type==='sb'?'3020':'3010';
  var retainedName=(c.accounts||[]).find(function(a){return a.code===retainedCode;})||{name:retainedCode==='3020'?'Retained earnings':'Net assets / equity'};

  // Build ledger lines for the compound closing entry
  // Income accounts have a credit normal balance — to close, debit each one
  // Expense accounts have a debit normal balance — to close, credit each one
  // The plug goes to retained earnings (credit if net income positive, debit if net loss)
  var lines=[];
  incomeAccts.forEach(function(r){
    if(Math.abs(r.balance)<0.01)return;
    // Income balance is cr-side; to close: debit income acct, credit retained earnings
    lines.push({accountCode:r.code,dr:r.balance,cr:0,_note:r.name});
  });
  expenseAccts.forEach(function(r){
    if(Math.abs(r.balance)<0.01)return;
    // Expense balance is dr-side; to close: credit expense acct, debit retained earnings
    lines.push({accountCode:r.code,dr:0,cr:r.balance,_note:r.name});
  });
  // Plug: net income → net-asset account(s).
  // NP: split by donor-restriction class so restricted contributions don't get swept into
  // "without donor restrictions" — expenses reduce unrestricted net assets by default.
  // SB/PE: single plug to retained earnings / net worth, unchanged.
  if(c.type==='np'){
    var _restrictBuckets=_splitIncomeByRestriction(c);
    var _plugTargets=[
      {code:'3010',amt:(_restrictBuckets.without_restriction||0)-lbs.totalExpense},
      {code:'3020',amt:_restrictBuckets.with_restriction||0},
      {code:'3030',amt:_restrictBuckets.with_restriction_perm||0}
    ];
    _plugTargets.forEach(function(t){
      if(Math.abs(t.amt)<0.01)return;
      var tAcct=(c.accounts||[]).find(function(a){return a.code===t.code;})||{name:t.code};
      if(t.amt>0){
        lines.push({accountCode:t.code,dr:0,cr:t.amt,_note:tAcct.name+' (net income)'});
      }else{
        lines.push({accountCode:t.code,dr:Math.abs(t.amt),cr:0,_note:tAcct.name+' (net loss)'});
      }
    });
  }else if(Math.abs(netIncome)>=0.01){
    if(netIncome>0){
      lines.push({accountCode:retainedCode,dr:0,cr:netIncome,_note:retainedName.name+' (net income)'});
    }else{
      lines.push({accountCode:retainedCode,dr:Math.abs(netIncome),cr:0,_note:retainedName.name+' (net loss)'});
    }
  }

  if(!lines.length)return{ok:false,message:'No non-zero balances to close.'};

  // Verify the entry balances (total dr = total cr) before posting
  var totalDr=lines.reduce(function(s,l){return s+Number(l.dr||0);},0);
  var totalCr=lines.reduce(function(s,l){return s+Number(l.cr||0);},0);
  if(Math.abs(totalDr-totalCr)>0.01)return{ok:false,message:'Closing entry would not balance (Dr: $'+totalDr.toFixed(2)+' Cr: $'+totalCr.toFixed(2)+'). Please contact support.'};

  // Post compound ledger entry
  if(!c.ledgerEntries)c.ledgerEntries=[];
  var closeId='close:'+fyLabel+':'+uid();
  var closingEntry={
    id:uid(),
    date:closeDate,
    memo:'Year-end closing — '+fyLabel,
    sourceType:'closing',
    sourceId:closeId,
    createdAt:new Date().toISOString(),
    lines:lines.map(function(l){return{accountCode:l.accountCode,dr:Number(l.dr||0),cr:Number(l.cr||0)};})
  };
  c.ledgerEntries.push(closingEntry);

  // Post readable summary to journalEntries[] for the JE panel
  if(!c.journalEntries)c.journalEntries=[];
  var jeMemo='Year-end closing entries — '+fyLabel+' (Net '+(netIncome>=0?'income':'loss')+': $'+Math.abs(netIncome).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+')';
  var _naLines=lines.filter(function(l){return l.accountCode==='3010'||l.accountCode==='3020'||l.accountCode==='3030';});
  var _closeCreditLabel=c.type==='np'&&_naLines.length
    ?_naLines.map(function(l){var a=(c.accounts||[]).find(function(x){return x.code===l.accountCode;});return a?a.code+' '+a.name:l.accountCode;}).join(', ')
    :retainedCode+' '+retainedName.name;
  c.journalEntries.push({
    id:uid(),
    date:closeDate,
    type:'Year-end closing',
    memo:jeMemo,
    debitAcct:incomeAccts.length?incomeAccts.map(function(r){return r.code+' '+r.name;}).join(', '):'—',
    creditAcct:_closeCreditLabel,
    debitCode:retainedCode,
    creditCode:'',
    amt:Math.abs(netIncome),
    notes:'Auto-posted by Clarity year-end close. '+lines.length+' accounts closed.'+(c.type==='np'?' Split across net-asset classes by donor restriction.':''),
    audit:[{field:'created',oldValue:'',newValue:'Year-end closing entry auto-posted',timestamp:new Date().toISOString()}],
    isClosingEntry:true,
    closingFY:fyLabel
  });

  // Record in closing history
  c.closingHistory.push({fy:fyLabel,postedOn:todayNum(),netIncome:netIncome,accountsClosed:lines.length,closeDate:closeDate,ledgerEntryId:closingEntry.id});

  var _closeSummaryLabel=c.type==='np'?'the appropriate net-asset accounts (by donor restriction)':retainedName.name;
  return{ok:true,message:'Closing entries posted for '+fyLabel+'. Net '+(netIncome>=0?'income':'loss')+': $'+Math.abs(netIncome).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'. '+lines.length+' account(s) zeroed to '+_closeSummaryLabel+'.',netIncome:netIncome,closeDate:closeDate};
}

// postDepreciation(c): compute and post one period of depreciation for each fixed asset.
// Guard: uses c.deprPosted{} keyed by assetId+yearMonth — never posts twice in same month.
// Debit:  Depreciation Expense (resolved by name, see below)
// Credit: Accumulated Depreciation (resolved by name, see below)
// Returns true if any entries were posted.
function postDepreciation(c){
  if(!c||!c.fixedAssets||!c.fixedAssets.length)return false;
  if(!c.deprPosted)c.deprPosted={};
  // PERIOD LOCK GUARD — don't auto-post depreciation into a locked period
  if(isDateLocked(c,todayNum()))return false;
  var now=new Date();now.setHours(0,0,0,0);
  var nowYear=now.getFullYear(),nowMonth=now.getMonth();// 0-based
  var monthKey=nowYear+'-'+(nowMonth+1);
  // Resolved by exact name match rather than a hardcoded numeric code — a client's default
  // '5610'/'5800' Depreciation account can get squatted by an unrelated auto-numbered account
  // (e.g. a budget line) over the account's lifetime, which would otherwise silently post
  // depreciation into the wrong expense line. _ensureDedicatedCOA reuses the real account by
  // name if present, or creates one, exactly like the credit side already does below.
  var debitCode=_ensureDedicatedCOA(c,'Depreciation','Expense','Depreciation');
  // Previously fell back to crediting the SAME account as the debit when no 1610 existed —
  // true for every NP client, since NP's default COA has no accumulated-depreciation line —
  // which posted Dr 5610 / Cr 5610, a net-zero no-op that still marked the period as posted,
  // permanently hiding that month's depreciation. Now auto-provisions a real account instead.
  var creditCode=_ensureDedicatedCOA(c,'Accumulated depreciation','Asset','Fixed Assets');
  var anyPosted=false;
  c.fixedAssets.forEach(function(a){
    if(!a.id||!a.cost||!a.life)return;
    var key=a.id+':'+monthKey;
    if(c.deprPosted[key])return;// already posted this month for this asset
    // Parse placed-in-service date
    var placed=a.date?parseDate(a.date):null;
    if(!placed)placed=new Date();
    placed.setHours(0,0,0,0);
    // Not yet in service
    if(placed>now)return;
    // PARTIAL-YEAR CONVENTION: in the placed month, prorate by days remaining in month
    var placedYear=placed.getFullYear(),placedMonth=placed.getMonth();
    var isPlacedMonth=(placedYear===nowYear&&placedMonth===nowMonth);
    // Months owned (integer, for fully-depreciated check)
    var monthsOwned=(nowYear-placedYear)*12+(nowMonth-placedMonth);
    var lifeMonths=Math.round(Number(a.life||0)*12);
    if(monthsOwned>=lifeMonths)return;// fully depreciated
    // Compute monthly amount based on method
    var monthlyDepr;
    if(a.method==='ddb'){
      // Double-declining balance: apply DDB rate to current book value
      // Book value = cost minus accumulated DDB depreciation through prior months
      var rate=2/Number(a.life||1);
      var bv=Number(a.cost||0);
      var salvage=Number(a.salvage||0);
      // Recompute BV by walking prior months (fast enough for typical asset counts)
      for(var m=0;m<monthsOwned;m++){
        var annDepr=bv*rate;
        var monDepr=annDepr/12;
        // Switch to SL when SL > DDB (standard DDB/SL crossover)
        var remainMonths=lifeMonths-m;
        var slDepr=remainMonths>0?(bv-salvage)/remainMonths:0;
        if(slDepr>monDepr)monDepr=slDepr;
        bv=Math.max(salvage,bv-monDepr);
      }
      // Current month DDB amount
      var annDeprNow=bv*rate;
      monthlyDepr=annDeprNow/12;
      var remainNow=lifeMonths-monthsOwned;
      var slNow=remainNow>0?(bv-salvage)/remainNow:0;
      if(slNow>monthlyDepr)monthlyDepr=slNow;
      monthlyDepr=Math.max(0,Math.min(monthlyDepr,bv-salvage));
    }else if(a.method==='macrs'){
      // MACRS GDS -- IRS half-year convention table percentages
      // Year 1 gets half a year's deduction regardless of placement date
      // Table: {life: [yr1%, yr2%, yr3%, ...]}
      var MACRS_TABLE={
        3:[33.33,44.45,14.81,7.41],
        5:[20.00,32.00,19.20,11.52,11.52,5.76],
        7:[14.29,24.49,17.49,12.49,8.93,8.92,8.93,4.46],
        10:[10.00,18.00,14.40,11.52,9.22,7.37,6.55,6.55,6.56,6.55,3.28],
        15:[5.00,9.50,8.55,7.70,6.93,6.23,5.90,5.90,5.91,5.90,5.91,5.90,5.91,5.90,5.91,2.95],
        20:[3.750,7.219,6.677,6.177,5.713,5.285,4.888,4.522,4.462,4.461,4.462,4.461,4.462,4.461,4.462,4.461,4.462,4.461,4.462,4.461,2.231]
      };
      var macrsLife=Number(a.life||5);
      // Find nearest MACRS class (3,5,7,10,15,20)
      var macrsClasses=[3,5,7,10,15,20];
      var macrsClass=macrsClasses.reduce(function(prev,cur){return Math.abs(cur-macrsLife)<Math.abs(prev-macrsLife)?cur:prev;});
      var pcts=MACRS_TABLE[macrsClass]||MACRS_TABLE[5];
      // Recovery year = 1-based year of ownership (half-year convention: year 1 starts at placement)
      // monthsOwned is 0 in placed month; recovery year = floor(monthsOwned/12)+1 capped at pcts.length
      var recoveryYear=Math.min(Math.floor(monthsOwned/12)+1,pcts.length);
      var annualPct=pcts[recoveryYear-1]/100;
      monthlyDepr=Number(a.cost||0)*annualPct/12;
      // Half-year convention: year 1 and final year each get half the annual amount
      // This is already baked into the IRS table percentages above
    }else{
      // Straight-line (default): use pre-computed annualDepr
      monthlyDepr=Number(a.annualDepr||((Number(a.cost||0)-Number(a.salvage||0))/Number(a.life||1)))/12;
    }
    monthlyDepr=Math.round(monthlyDepr*100)/100;
    if(monthlyDepr<=0)return;
    // Partial-year convention: first month prorated by days (SL/DDB only; MACRS uses half-year conv built into table)
    if(isPlacedMonth&&a.method!=='macrs'){
      var daysInMonth=new Date(placedYear,placedMonth+1,0).getDate();
      var daysRemaining=daysInMonth-placed.getDate()+1;// include placed day
      monthlyDepr=Math.round(monthlyDepr*(daysRemaining/daysInMonth)*100)/100;
    }
    if(monthlyDepr<=0)return;
    postToLedger(c,debitCode,creditCode,monthlyDepr,
      'Depreciation — '+a.name+' ('+monthKey+')'+(isPlacedMonth?' [partial month]':''),'depreciation',key);
    c.deprPosted[key]=true;
    anyPosted=true;
  });
  return anyPosted;
}



// ── CASH ON HAND ────────────────────────────────────────────────
// Returns the best available cash balance:
// 1. Sum of all bank account reconciliation closing balances (most accurate — from real statements)
// 2. Fall back to balance sheet assets tagged as cash/bank/checking, minus expenses debited to those accounts
// Does NOT include credit card balances (those are liabilities, not assets)
// FIX-6: Cash-type accounts (cash on hand, cash box, petty cash, safe) now properly
//         reduce when expenses are tagged to them, even without a reconciliation closing balance.
function isCashTypeAccount(name){
  var n=(name||'').toLowerCase();
  return n.includes('cash')||n.includes('safe')||n.includes('petty')||n.includes('checking')||n.includes('bank');
}
function getCashOnHand(c){
  if(!c)return 0;
  var banks=(c.bankAccounts||[]);

  // Determine which bank accounts have a valid recon closing balance
  var reconByBankId={};
  banks.forEach(function(b){
    var key='reconState_bank:'+b.id;
    var rs=c[key];
    if(rs&&Number(rs.closeBal||0)>0)reconByBankId[b.id]=Number(rs.closeBal);
  });
  // Legacy default account
  var legacyRs=c['reconState_bank'];
  if(legacyRs&&Number(legacyRs.closeBal||0)>0)reconByBankId['default']=Number(legacyRs.closeBal);

  var fromRecon=Object.keys(reconByBankId).reduce(function(s,k){return s+reconByBankId[k];},0);
  if(fromRecon>0)return fromRecon;

  // Fall back: balance sheet cash/bank assets — balance is derived live from transactions
  var bs=c.balanceSheet||{assets:[],liabilities:[],equity:[]};
  return bs.assets.reduce(function(s,a){
    return isCashTypeAccount(a.name)?s+computeBSAssetBalance(c,a.id):s;
  },0);
}


var COA_TEMPLATES={
np:[
  {code:'1010',name:'Checking account',type:'Asset',cat:'Cash'},
  {code:'1020',name:'Savings account',type:'Asset',cat:'Cash'},
  {code:'1200',name:'Accounts receivable',type:'Asset',cat:'Receivables'},
  {code:'1500',name:'Prepaid expenses',type:'Asset',cat:'Prepaid'},
  {code:'2010',name:'Accounts payable',type:'Liability',cat:'Payables'},
  {code:'2100',name:'Accrued liabilities',type:'Liability',cat:'Accrued'},
  // 3010/3020/3030 net-asset codes left untagged (cf undefined -> falls back to 'operating' in _cfSection):
  // net assets roll up from net income, already captured in the operating section, so they're not their own financing flow.
  // GAAP (ASU 2016-14) presents net assets in two classes on the face of the statements —
  // "without donor restrictions" and "with donor restrictions." 3030 is kept as internal detail
  // for permanently-restricted/endowment corpus; the Balance Sheet subtotals 3020+3030 together
  // as "Net assets with donor restrictions" to satisfy the 2-class presentation requirement.
  {code:'3010',name:'Net assets without donor restrictions',type:'Equity',cat:'Net Assets'},
  {code:'3020',name:'Net assets with donor restrictions',type:'Equity',cat:'Net Assets'},
  {code:'3030',name:'Net assets with donor restrictions — endowment',type:'Equity',cat:'Net Assets'},
  {code:'3999',name:'Opening balance equity',type:'Equity',cat:'Equity'},
  {code:'4010',name:'Individual donations',type:'Income',cat:'Individual Donations',f990:'Part VIII Line 1'},
  {code:'4020',name:'Corporate sponsorships',type:'Income',cat:'Corporate',f990:'Part VIII Line 1'},
  {code:'4030',name:'Grant revenue',type:'Income',cat:'Grants',f990:'Part VIII Line 1'},
  {code:'4040',name:'Event revenue',type:'Income',cat:'Events',f990:'Part VIII Line 8'},
  {code:'4050',name:'In-kind contributions',type:'Income',cat:'In-Kind',f990:'Part VIII Line 1'},
  {code:'4060',name:'Program service revenue',type:'Income',cat:'Program Revenue',f990:'Part VIII Line 2'},
  {code:'4070',name:'Investment income',type:'Income',cat:'Investment',f990:'Part VIII Line 3'},
  {code:'5010',name:'Salaries & wages',type:'Expense',cat:'Personnel',f990:'Part IX Line 5'},
  {code:'5020',name:'Payroll taxes & benefits',type:'Expense',cat:'Personnel',f990:'Part IX Line 8'},
  {code:'5100',name:'Program supplies',type:'Expense',cat:'Program',f990:'Part IX Line 24'},
  {code:'5110',name:'Program contractors',type:'Expense',cat:'Program',f990:'Part IX Line 11'},
  {code:'5200',name:'Office rent',type:'Expense',cat:'Operations',f990:'Part IX Line 16'},
  {code:'5210',name:'Utilities',type:'Expense',cat:'Operations',f990:'Part IX Line 17'},
  {code:'5220',name:'Insurance',type:'Expense',cat:'Operations',f990:'Part IX Line 23'},
  {code:'5300',name:'Accounting & legal',type:'Expense',cat:'Admin',f990:'Part IX Line 11'},
  {code:'5310',name:'Software & subscriptions',type:'Expense',cat:'Admin',f990:'Part IX Line 24'},
  {code:'5320',name:'Board & meeting expenses',type:'Expense',cat:'Admin',f990:'Part IX Line 24'},
  {code:'5400',name:'Marketing & outreach',type:'Expense',cat:'Marketing',f990:'Part IX Line 12'},
  {code:'5410',name:'In-kind expense',type:'Expense',cat:'In-Kind Expense',f990:'Part IX Line 24'},
  {code:'5500',name:'Travel & conferences',type:'Expense',cat:'Travel',f990:'Part IX Line 17'},
  {code:'5600',name:'Bank fees & charges',type:'Expense',cat:'Bank Fees',f990:'Part IX Line 24'},
  {code:'5610',name:'Depreciation',type:'Expense',cat:'Depreciation',f990:'Part IX Line 22'}
],
// (fixed assets / investments / loans not part of the default np COA today —
//  if/when they're added, tag them cf:'investing' or cf:'financing' as done below for sb/pe)
sb:[
  {code:'1010',name:'Checking account',type:'Asset',cat:'Cash'},
  {code:'1020',name:'Savings account',type:'Asset',cat:'Cash'},
  {code:'1200',name:'Accounts receivable',type:'Asset',cat:'Receivables'},
  {code:'1300',name:'Inventory',type:'Asset',cat:'Inventory'},
  {code:'1500',name:'Prepaid expenses',type:'Asset',cat:'Prepaid'},
  {code:'1600',name:'Fixed assets',type:'Asset',cat:'Fixed Assets',cf:'investing'},
  {code:'1610',name:'Accumulated depreciation',type:'Asset',cat:'Fixed Assets'},
  {code:'2010',name:'Accounts payable',type:'Liability',cat:'Payables'},
  {code:'2100',name:'Credit cards payable',type:'Liability',cat:'Credit Cards',cf:'financing'},
  {code:'2200',name:'Loans payable',type:'Liability',cat:'Loans',cf:'financing'},
  {code:'2300',name:'Accrued liabilities',type:'Liability',cat:'Accrued'},
  {code:'2350',name:'Sales tax payable',type:'Liability',cat:'Sales Tax'},
  {code:'3010',name:'Owner equity',type:'Equity',cat:'Equity',cf:'financing'},
  {code:'3020',name:'Retained earnings',type:'Equity',cat:'Equity'},
  {code:'3030',name:'Owner draws',type:'Equity',cat:'Equity',cf:'financing'},
  {code:'3999',name:'Opening balance equity',type:'Equity',cat:'Equity'},
  {code:'4010',name:'Product sales',type:'Income',cat:'Product Sales'},
  {code:'4020',name:'Service revenue',type:'Income',cat:'Services'},
  {code:'4030',name:'Subscription revenue',type:'Income',cat:'Subscriptions'},
  {code:'4040',name:'Consulting revenue',type:'Income',cat:'Consulting'},
  {code:'4050',name:'Shipping & handling income',type:'Income',cat:'Shipping Income'},
  {code:'4060',name:'Licensing & royalties',type:'Income',cat:'Licensing'},
  {code:'4070',name:'Rental income',type:'Income',cat:'Rental Income'},
  {code:'4080',name:'Interest income',type:'Income',cat:'Interest Income'},
  {code:'4090',name:'Other income',type:'Income',cat:'Other Income'},
  {code:'4900',name:'Returns & allowances',type:'Income',cat:'Returns & Allowances'},
  {code:'5010',name:'Salaries & wages',type:'Expense',cat:'Personnel'},
  {code:'5020',name:'Payroll taxes',type:'Expense',cat:'Personnel'},
  {code:'5100',name:'Rent',type:'Expense',cat:'Facilities'},
  {code:'5110',name:'Utilities',type:'Expense',cat:'Facilities'},
  {code:'5200',name:'Software & subscriptions',type:'Expense',cat:'Software'},
  {code:'5210',name:'Office supplies',type:'Expense',cat:'Admin'},
  {code:'5300',name:'Contractors',type:'Expense',cat:'Contractors'},
  {code:'5400',name:'Marketing & advertising',type:'Expense',cat:'Marketing'},
  {code:'5500',name:'Travel & meals',type:'Expense',cat:'Travel'},
  {code:'5600',name:'Insurance',type:'Expense',cat:'Insurance'},
  {code:'5700',name:'Interest expense',type:'Expense',cat:'Interest'},
  {code:'5710',name:'Bank fees & charges',type:'Expense',cat:'Bank Fees'},
  {code:'5800',name:'Depreciation',type:'Expense',cat:'Depreciation'},
  {code:'5900',name:'Cost of goods sold',type:'Expense',cat:'COGS'}
],
pe:[
  {code:'1010',name:'Checking account',type:'Asset',cat:'Cash'},
  {code:'1020',name:'Savings account',type:'Asset',cat:'Cash'},
  {code:'1030',name:'Investment account',type:'Asset',cat:'Investments',cf:'investing'},
  {code:'2010',name:'Credit card',type:'Liability',cat:'Credit Cards',cf:'financing'},
  {code:'2100',name:'Auto loan',type:'Liability',cat:'Loans',cf:'financing'},
  {code:'2200',name:'Student loan',type:'Liability',cat:'Loans',cf:'financing'},
  {code:'2300',name:'Mortgage',type:'Liability',cat:'Loans',cf:'financing'},
  {code:'3010',name:'Net worth',type:'Equity',cat:'Equity'},
  {code:'3999',name:'Opening balance equity',type:'Equity',cat:'Equity'},
  {code:'4010',name:'Salary',type:'Income',cat:'Employment'},
  {code:'4020',name:'Side income',type:'Income',cat:'Side Income'},
  {code:'4030',name:'Investment income',type:'Income',cat:'Investment'},
  {code:'5010',name:'Housing',type:'Expense',cat:'Housing'},
  {code:'5020',name:'Utilities',type:'Expense',cat:'Housing'},
  {code:'5100',name:'Groceries',type:'Expense',cat:'Food'},
  {code:'5110',name:'Dining out',type:'Expense',cat:'Food'},
  {code:'5200',name:'Transportation',type:'Expense',cat:'Transportation'},
  {code:'5300',name:'Health & medical',type:'Expense',cat:'Health'},
  {code:'5400',name:'Entertainment',type:'Expense',cat:'Entertainment'},
  {code:'5500',name:'Bank fees & charges',type:'Expense',cat:'Bank Fees'},
  {code:'5510',name:'Personal care',type:'Expense',cat:'Personal'},
  {code:'5600',name:'Education',type:'Expense',cat:'Education'}
]};

function getDefaultCOA(type){return COA_TEMPLATES[type]?COA_TEMPLATES[type].map(function(a){return Object.assign({id:uid()},a);}):[];}
function acctByCode(c,code){return(c.accounts||[]).find(function(a){return a.code===code;});}
function acctOpts(c,typeFilter){
  var accts=(c.accounts||[]).filter(function(a){return a.active!==false;});// hide inactive
  if(typeFilter)accts=accts.filter(function(a){return a.type===typeFilter;});
  return'<option value="">— No account —</option>'+accts.map(function(a){return'<option value="'+a.code+'">'+a.code+' '+escHtml(a.name)+(a.f990?' (990: '+escHtml(a.f990)+')':'')+'</option>';}).join('');
}
function isPro(){return _plan==='pro';}
function requirePro(msg){if(isPro())return true;g('upgrade-reason').textContent=msg||'This is a Pro feature.';openM('m-upgrade');return false;}
function clientLimitOk(){if(isPro())return true;if(D.clients.length>=2){g('upgrade-reason').textContent='Free accounts include up to 2 clients. Upgrade to Pro for unlimited clients.';openM('m-upgrade');return false;}return true;}
function fyeLabel(fye){var map={'01/31':'Jan 31','02/28':'Feb 28','03/31':'Mar 31','04/30':'Apr 30','05/31':'May 31','06/30':'Jun 30','07/31':'Jul 31','08/31':'Aug 31','09/30':'Sep 30','10/31':'Oct 31','11/30':'Nov 30','12/31':'Dec 31 (calendar year)'};return map[fye]||fye;}
function getFiscalYear(fye,refDate){
  var now=refDate||new Date();
  var parts=(fye||'12/31').split('/');
  var fyMo=parseInt(parts[0])-1,fyDay=parseInt(parts[1]);
  var fyEnd=new Date(now.getFullYear(),fyMo,fyDay);
  if(now>fyEnd)fyEnd=new Date(now.getFullYear()+1,fyMo,fyDay);
  var fyStart=new Date(fyEnd.getFullYear()-1,fyMo,fyDay+1);
  return{start:fyStart,end:fyEnd,label:(fyStart.getFullYear()===fyEnd.getFullYear()?fyEnd.getFullYear():'FY '+fyEnd.getFullYear())};
}
function checkFYEExpiry(c){
  if(!c||!c.fiscalYearEnd)return;
  var now=new Date();
  var parts=c.fiscalYearEnd.split('/');
  var fyMo=parseInt(parts[0])-1,fyDay=parseInt(parts[1]);
  var thisYearFYE=new Date(now.getFullYear(),fyMo,fyDay);
  var lastKey='fye-checked-'+c.id+'-'+now.getFullYear();
  try{if(localStorage.getItem(lastKey))return;}catch(e){}
  var daysPast=Math.floor((now-thisYearFYE)/(1000*60*60*24));
  if(daysPast<0||daysPast>30)return;
  var unreconciled=(c.expenses||[]).filter(function(e){return!e.reconciled;});
  var unreconInc=(c.income||[]).concat(c.revenue||[]).filter(function(r){return r.reconciled===false;});
  var total=unreconciled.length+unreconInc.length;
  if(total===0){try{localStorage.setItem(lastKey,'done');}catch(e){}return;}
  openFYEModal(c,unreconciled,unreconInc,lastKey);
}
function openFYEReview(){
  // Manual trigger — bypasses the 30-day window check
  var c=gc();if(!c)return;
  var unreconciled=(c.expenses||[]).filter(function(e){return!e.reconciled;});
  var unreconInc=(c.income||[]).concat(c.revenue||[]).filter(function(r){return r.reconciled===false;});
  var lastKey='fye-checked-'+c.id+'-'+new Date().getFullYear();
  openFYEModal(c,unreconciled,unreconInc,lastKey);
}
function openFYEModal(c,unreconExp,unreconInc,lastKey){
  var el=g('m-fye');if(!el)return;
  // Categorize unreconciled items
  var outChecks=unreconExp.filter(function(e){return e.cat&&(e.cat.toLowerCase().indexOf('check')>=0||e.cat.toLowerCase().indexOf('payable')>=0||e.acctCode==='2010')||(!e.date);});
  var errors=unreconExp.filter(function(e){return outChecks.indexOf(e)<0;});
  var deposits=unreconInc;
  var total=unreconExp.length+unreconInc.length;
  var html='<p style="font-size:13px;color:var(--muted);margin-bottom:1rem;line-height:1.6">Fiscal year end has passed for <strong>'+escHtml(c.name)+'</strong>. <strong>'+total+' unreconciled transaction'+(total===1?'':'s')+'</strong> need attention:</p>';
  // Breakdown
  html+='<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:1rem;font-size:12px">';
  if(outChecks.length)html+='<div style="background:var(--bg);border-radius:8px;padding:.5rem .75rem"><span class="badge b-amber">Outstanding checks</span> <strong>'+outChecks.length+'</strong> — issued but not cleared. <em>Carry forward.</em></div>';
  if(deposits.length)html+='<div style="background:var(--bg);border-radius:8px;padding:.5rem .75rem"><span class="badge b-blue">Deposits in transit</span> <strong>'+deposits.length+'</strong> — recorded but not on statement. <em>Carry forward.</em></div>';
  if(errors.length)html+='<div style="background:var(--bg);border-radius:8px;padding:.5rem .75rem"><span class="badge b-red">Possible errors</span> <strong>'+errors.length+'</strong> — unreconciled expenses with no clear reason. <em>Review.</em></div>';
  html+='</div>';
  html+='<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:1.25rem">';
  html+='<button class="sv-btn" style="background:var(--green)" onclick="fyeAction(\'reconcile\',\''+lastKey+'\')"><i class="fas fa-check"></i> Mark all as reconciled</button>';
  html+='<button class="sv-btn" style="background:var(--amber)" onclick="fyeAction(\'carry\',\''+lastKey+'\')">→ Carry forward outstanding checks + deposits in transit</button>';
  html+='<button class="sv-btn" style="background:var(--red)" onclick="fyeAction(\'delete\',\''+lastKey+'\')"><i class="fas fa-xmark"></i> Delete all unreconciled</button>';
  html+='</div>';
  html+='<button class="lnk" onclick="closeM(\'m-fye\')">Remind me later</button>';
  g('fye-body').innerHTML=html;
  openM('m-fye');
}
function fyeAction(action,lastKey){
  var c=gc();if(!c)return;
  if(action==='reconcile'){
    (c.expenses||[]).forEach(function(e){e.reconciled=true;});
    (c.income||[]).forEach(function(r){r.reconciled=true;});
    (c.revenue||[]).forEach(function(r){r.reconciled=true;});
  }else if(action==='delete'){
    // FIX-3: Reverse balance sheet cash asset deltas for any tagged transactions before deleting
    (c.expenses||[]).forEach(function(e){if(!e.reconciled&&e.bsAssetId)applyBSAssetDelta(c,e.bsAssetId,Number(e.amt||0));});
    if(c.type==='np')(c.income||[]).forEach(function(r){if(r.reconciled===false&&r.bsAssetId)applyBSAssetDelta(c,r.bsAssetId,-Number(r.recv||r.amt||0));});
    if(c.type==='sb')(c.revenue||[]).forEach(function(r){if(r.reconciled===false&&r.bsAssetId)applyBSAssetDelta(c,r.bsAssetId,-Number(r.act||0));});
    c.expenses=(c.expenses||[]).filter(function(e){return e.reconciled;});
    if(c.type==='np')c.income=(c.income||[]).filter(function(r){return r.reconciled!==false;});
    if(c.type==='sb')c.revenue=(c.revenue||[]).filter(function(r){return r.reconciled!==false;});
  }else if(action==='carry'){
    (c.expenses||[]).forEach(function(e){
      if(!e.reconciled){
        var isCheck=e.cat&&(e.cat.toLowerCase().indexOf('check')>=0||e.cat.toLowerCase().indexOf('payable')>=0||e.acctCode==='2010')||(!e.date);
        e.fyeNote=isCheck?'Outstanding check carried forward from prior fiscal year':'Unreconciled expense carried forward from prior fiscal year';
      }
    });
    (c.income||[]).concat(c.revenue||[]).forEach(function(r){if(r.reconciled===false)r.fyeNote='Deposit in transit carried forward from prior fiscal year';});
  }
  try{localStorage.setItem(lastKey,'done');}catch(e){}
  // Auto-promote proposed budget to current on FYE
  if(c.proposedBudget&&c.proposedBudget.length){
    var fy=getFiscalYear(c.fiscalYearEnd);
    if(!c.adoptedBudgets)c.adoptedBudgets=[];
    if(c.budgetItems&&c.budgetItems.length)c.adoptedBudgets.push({fy:fy.label,items:c.budgetItems.slice(),adoptedOn:today()});
    c.budgetItems=c.proposedBudget.slice();
    c.proposedBudget=[];
    alert('Your proposed budget has been automatically adopted for the new fiscal year!');
  }
  sv();renderAll();closeM('m-fye');
}
function tl(t){return t==='np'?'Nonprofit':t==='sb'?'Small business':'Personal';}
function il(t){return t==='np'?'Income':t==='pe'?'Income':'Revenue';}
function nl(t){return t==='np'?'Net surplus / deficit':t==='sb'?'Net profit / loss':'Net income';}
function avc(t){return t==='np'?'av-np':t==='sb'?'av-sb':'av-pe';}
function g(id){return document.getElementById(id);}

// ══════════════════════════════════════════
// PIN
// ══════════════════════════════════════════
function getPinned(){try{return localStorage.getItem('clarity-pinned')||null;}catch(e){return null;}}
function setPinned(id){try{localStorage.setItem('clarity-pinned',id);}catch(e){}}
function clearPin(){try{localStorage.removeItem('clarity-pinned');}catch(e){}}
function togglePin(id,e){e.stopPropagation();getPinned()===id?clearPin():setPinned(id);renderSB();renderMobSel();}
function pinCurrentClient(){var c=gc();if(!c)return;getPinned()===c.id?clearPin():setPinned(c.id);renderSB();renderMobSel();updateMobPinBtn();}
function updateMobPinBtn(){
  var btn=g('mob-pin-btn');if(!btn)return;
  var c=gc();if(!c){btn.style.display='none';return;}
  var ip=getPinned()===c.id;
  btn.innerHTML=ip?'<i class="fas fa-star"></i> Default':'<i class="far fa-star"></i> Set as default';
  btn.style.color=ip?'var(--amber)':'';
  btn.style.borderColor=ip?'var(--amber-bg)':'';
  btn.style.display=window.innerWidth<=768?'inline-block':'none';
}
window.addEventListener('resize',updateMobPinBtn);

// ══════════════════════════════════════════
// DATES
// ══════════════════════════════════════════
function parseDate(s){
  if(!s)return null;
  // Handle Excel serial number dates (e.g. 46082)
  if(typeof s==='number'||(/^\d{4,5}$/.test(String(s).trim()))){
    var n=Number(s);if(n>40000&&n<60000){var d=new Date(Date.UTC(1899,11,30));d.setUTCDate(d.getUTCDate()+n);return d;}
  }
  var p;
  if(String(s).indexOf('/')>-1){p=String(s).split('/');if(p.length===3){var y=p[2].length===2?'20'+p[2]:p[2];return new Date(+y,+p[0]-1,+p[1]);}}
  if(String(s).indexOf('-')>-1){p=String(s).split('-');if(p.length===3)return new Date(+p[0],+p[1]-1,+p[2]);}
  return null;
}
function addDays(s,n){var d=parseDate(s);if(!d)return todayNum();d.setDate(d.getDate()+n);return(d.getMonth()+1).toString().padStart(2,'0')+'/'+d.getDate().toString().padStart(2,'0')+'/'+d.getFullYear();}
function addMonths(s,n){var d=parseDate(s);if(!d)return todayNum();d.setMonth(d.getMonth()+n);return(d.getMonth()+1).toString().padStart(2,'0')+'/'+d.getDate().toString().padStart(2,'0')+'/'+d.getFullYear();}
function nextSched(r,f){if(r==='Weekly')return addDays(f,7);if(r==='Bi-weekly')return addDays(f,14);if(r==='Monthly')return addMonths(f,1);if(r==='Quarterly')return addMonths(f,3);if(r==='Annual')return addMonths(f,12);return null;}
function fmtDate(s){if(!s)return'—';var d=parseDate(s);if(!d||isNaN(d))return String(s);return(d.getMonth()+1).toString().padStart(2,'0')+'/'+d.getDate().toString().padStart(2,'0')+'/'+d.getFullYear();}
function lookupAcctByCode(c,code){if(!code)return null;var a=(c.accounts||[]).find(function(a){return a.code===String(code).trim();});return a?a.code:null;}
// type (optional): when given ('Income'|'Expense'|...), only matches an
// account of that type — prevents e.g. an expense whose category name is
// shared with an income account (common for fundraiser events: "Winter
// Bash" income vs "Winter Bash" costs) from silently attaching to the
// wrong side of the books. Omit type to match any account by name (old
// behavior, kept for callers that don't know/care about type).
function lookupAcctByCAT(c,cat,type){if(!cat)return null;var a=(c.accounts||[]).find(function(a){return(a.cat===cat||a.name===cat)&&(!type||a.type===type);});return a?a.code:null;}
function quickAddAcctFromImport(c,nameOrCode,defaultType){
  // Silent auto-create — don't prompt during bulk import, just create
  if(!c.accounts)c.accounts=[];
  var existing=(c.accounts||[]).find(function(a){return a.name===nameOrCode||a.code===nameOrCode;});
  if(existing)return existing.code;
  var coaType=defaultType||'Expense';
  var code=_nextAcctCode(c,coaType);
  c.accounts.push({id:uid(),code:code,name:nameOrCode,type:coaType,cat:nameOrCode,fromImport:true});
  c.accounts.sort(function(a,b){return a.code.localeCompare(b.code);});
  return code;
}
function dKey(s){var d=parseDate(s);return d?d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate():null;}
function isPast(s){var d=parseDate(s);if(!d)return false;var n=new Date();n.setHours(0,0,0,0);d.setHours(0,0,0,0);return d<=n;}
function autoDate(el){
  var v=el.value.replace(/[^0-9]/g,'');
  if(!v.length)return;
  if(v.length>=8){
    var mm=v.slice(0,2),dd=v.slice(2,4),yy=v.slice(4,8);
    if(+mm>=1&&+mm<=12&&+dd>=1&&+dd<=31&&+yy>=2020&&+yy<=2099){
      el.value=mm+'/'+dd+'/'+yy;
      el.style.borderColor='';
    }else{
      el.style.borderColor='var(--red,#c0392b)';
      el.title='Invalid date. Use MM/DD/YYYY (month 01–12, day 01–31, year 2020–2099).';
    }
    return;
  }
  if(v.length>4)el.value=v.slice(0,2)+'/'+v.slice(2,4)+'/'+v.slice(4);
  else if(v.length>2)el.value=v.slice(0,2)+'/'+v.slice(2);
  else el.value=v;
  el.style.borderColor='';
  el.title='';
}

// ══════════════════════════════════════════
// RECURRING
// ══════════════════════════════════════════
function processRecurring(){
  _recurPosted=[];
  var tk=todayKey();
  // Floor: never generate recurring entries more than 12 months back
  var _floor=new Date();_floor.setFullYear(_floor.getFullYear()-1);
  D.clients.forEach(function(c){
    // Daily guard — skip this client if already processed today
    var _prKey='clarity-pr-'+c.id;
    try{if(localStorage.getItem(_prKey)===tk)return;}catch(e){}
    function catchUp(items,setDate,amtKey,sign){
      var add=[];
      items.forEach(function(item){
        if(!item.recurring||item.recurring==='None')return;
        // End-date guard: stop if template has expired
        if(item.recurEndDate){var _end=parseDate(item.recurEndDate);if(_end&&_end<new Date())return;}
        // Occurrence cap guard: stop if max count reached
        if(item.recurCount&&item.recurCount>0){var _posted=Number(item.recurPostedCount||0);if(_posted>=item.recurCount)return;}
        var last=item.recurKey||(item.date||'');
        var next=nextSched(item.recurring,last);
        if(!next)return;
        // Skip if next date is older than 12-month floor — prevents runaway catchup on stale items
        if(new Date(next)<_floor){item.recurKey=tk;return;}
        // Secondary guard: if recurKey is recent (within 2 days), localStorage was likely
        // cleared but the item was already processed. Skip to prevent duplicate posting.
        if(item.recurKey){
          var _rk=parseDate(item.recurKey);
          var _2dAgo=new Date();_2dAgo.setDate(_2dAgo.getDate()-2);
          if(_rk&&_rk>=_2dAgo){return;}
        }
        var safety=0;
        while(isPast(next)&&safety<52){
          safety++;
          // Re-check end date and count cap on each iteration
          if(item.recurEndDate){var _endI=parseDate(item.recurEndDate);if(_endI&&parseDate(next)>_endI)break;}
          if(item.recurCount&&item.recurCount>0){if(Number(item.recurPostedCount||0)>=item.recurCount)break;}
          var nk=dKey(next);
          if(nk===tk&&item.recurKey===tk)break;
          // PERIOD LOCK GUARD — skip auto-posts into locked periods
          if(isDateLocked(c,next))break;
          var copy=JSON.parse(JSON.stringify(item));
          copy.id=uid();if(setDate)copy.date=next;copy.recurKey=nk;copy.recurring='None';
          add.push(copy);item.recurKey=nk;
          // Increment the posted count on the template
          item.recurPostedCount=(Number(item.recurPostedCount||0)+1);
          _recurPosted.push({clientId:c.id,clientName:c.name,desc:copy.desc||copy.name||'Recurring entry',amt:Number(copy[amtKey]||0),date:next,type:amtKey==='amt'?'expense':'income'});
          // Post to double-entry ledger — mirrors the pattern used in saveExp/saveInc/saveRev
          if(amtKey==='amt'){
            // Expense: Dr expense acct / Cr cash
            postToLedger(c,copy.acctCode||'5010',_defaultCashCode(c),Number(copy.amt||0),(copy.desc||'Recurring expense'),'expense',copy.id);
          }else if(amtKey==='recv'){
            // NP income: Dr cash / Cr income acct
            postToLedger(c,_defaultCashCode(c),copy.acctCode||'4010',Number(copy.recv||copy.amt||0),(copy.name||'Recurring income'),'income',copy.id);
          }else if(amtKey==='act'){
            // SB revenue: Dr cash / Cr revenue acct
            postToLedger(c,_defaultCashCode(c),copy.acctCode||'4010',Number(copy.act||0),(copy.name||'Recurring revenue'),'revenue',copy.id);
          }
          // FIX-4: apply balance sheet delta for each recurring copy that targets a cash asset
          if(copy.bsAssetId){
            var delta=Number(copy[amtKey]||0)*sign;
            if(delta!==0)applyBSAssetDelta(c,copy.bsAssetId,delta);
          }
          next=nextSched(item.recurring,next);if(!next)break;
        }
      });
      return add;
    }
    catchUp(c.expenses||[],true,'amt',-1).forEach(function(e){c.expenses.push(e);if(typeof dwUpsertExpense==='function')dwUpsertExpense(c,e);});
    catchUp(c.income||[],true,'recv',1).forEach(function(i){c.income.push(i);if(typeof dwUpsertIncome==='function')dwUpsertIncome(c,i);});
    catchUp(c.revenue||[],false,'act',1).forEach(function(r){c.revenue.push(r);if(typeof dwUpsertRevenue==='function')dwUpsertRevenue(c,r);});
    // Post monthly depreciation for all fixed assets (guard inside prevents double-posting)
    if(postDepreciation(c))_recurPosted.push({clientId:c.id,clientName:c.name,desc:'Depreciation posted',amt:0,date:tk,type:'depreciation'});
    try{localStorage.setItem(_prKey,tk);}catch(e){}
  });
  if(_recurPosted.length)sv();// only write if something was actually posted
}
