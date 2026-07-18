
// ══════════════════════════════════════════
// SAMPLE DATA
// ══════════════════════════════════════════
function hasData(){
  if(!D.clients||!D.clients.length)return false;
  return D.clients.some(function(c){
    return(c.income&&c.income.length)||(c.expenses&&c.expenses.length)||
           (c.revenue&&c.revenue.length)||(c.grants&&c.grants.length)||
           (c.donors&&c.donors.length)||(c.budgetItems&&c.budgetItems.length);
  });
}

function loadSampleData(){
  if(localStorage.getItem('clarity-sample-loaded')==='true')return;
  try{localStorage.setItem('clarity-sample-loaded','true');}catch(e){}
  var now=new Date();
  var yr=now.getFullYear();
  var mo=function(offset){var d=new Date(yr,now.getMonth()+offset,1);return(d.getMonth()+1).toString().padStart(2,'0')+'/01/'+d.getFullYear();};

  // ── Nonprofit sample ──────────────────
  var np=D.clients.find(function(c){return c.type==='np';});
  if(!np){np=mkC();np.name='My Nonprofit';np.type='np';D.clients.push(np);}
  {
    var gid1=uid(),gid2=uid();
    np.grants=[
      {id:gid1,name:'Smith Family Foundation Grant',funder:'Smith Family Foundation',awarded:25000,status:'In Progress',deadline:mo(3),match:'',restrict:'Program expenses only — no admin overhead.'},
      {id:gid2,name:'Community Impact Fund',funder:'City Community Foundation',awarded:10000,status:'Awarded',deadline:mo(6),match:'1:1 match required',restrict:'Youth programming only.'}
    ];
    np.income=[
      {id:uid(),name:'Annual Fund Drive',cat:'Individual Donations',status:'Received',proj:15000,recv:12400,recurring:'None'},
      {id:uid(),name:'Spring Gala Tickets',cat:'Events',status:'Received',proj:8000,recv:9200,recurring:'None'},
      {id:uid(),name:'Corporate Sponsorship — Acme Co',cat:'Corporate',status:'Prospecting',proj:5000,recv:0,recurring:'None'}
    ];
    np.expenses=[
      {id:uid(),desc:'Program Coordinator Salary',cat:'Personnel',amt:3500,date:mo(-1),fund:'',grantId:gid1,reconciled:true,recurring:'Monthly'},
      {id:uid(),desc:'Youth Workshop Supplies',cat:'Program',amt:780,date:mo(-1),fund:'Youth Fund',grantId:gid2,reconciled:true,recurring:'None'},
      {id:uid(),desc:'Office Rent',cat:'Operations',amt:1200,date:mo(0),fund:'',grantId:'',reconciled:false,recurring:'Monthly'},
      {id:uid(),desc:'Accounting Software',cat:'Admin',amt:89,date:mo(0),fund:'',grantId:'',reconciled:true,recurring:'Monthly'},
      {id:uid(),desc:'Board Meeting Catering',cat:'Admin',amt:245,date:mo(-2),fund:'',grantId:'',reconciled:true,recurring:'None'}
    ];
    np.budgetItems=[
      {cat:'Individual Donations',type:'Income',amt:15000},
      {cat:'Events',type:'Income',amt:8000},
      {cat:'Personnel',type:'Expense',amt:42000},
      {cat:'Program',type:'Expense',amt:12000},
      {cat:'Operations',type:'Expense',amt:14400},
      {cat:'Admin',type:'Expense',amt:4000}
    ];
    np.donors=[
      {id:uid(),name:'Margaret Rivera',email:'mrivera@email.com',phone:'(215) 555-0142',address:'412 Oak St, Philadelphia PA',notes:'Board member. Prefers email updates.',donations:[
        {amt:2500,date:'01/15/'+yr,fund:'Annual Fund',rec:'Yes',ty:'Yes',rst:'unrestricted',audit:[]},
        {amt:1000,date:'06/10/'+(yr-1),fund:'Annual Fund',rec:'Yes',ty:'Yes',rst:'unrestricted',audit:[]}
      ]},
      {id:uid(),name:'Thomas Chen',email:'tchen@email.com',phone:'(610) 555-0198',address:'88 Maple Ave, Ardmore PA',notes:'Major donor prospect. Interested in youth programs.',donations:[
        {amt:5000,date:'03/01/'+yr,fund:'Youth Programming',rec:'No',ty:'Yes',rst:'temporarily_restricted',audit:[]}
      ]},
      {id:uid(),name:'Sunrise Community Church',email:'office@sunrisechurch.org',phone:'(215) 555-0210',address:'1200 Church Rd, Jenkintown PA',notes:'Organizational donor. Annual gift each spring.',donations:[
        {amt:1500,date:'04/01/'+yr,fund:'General Operating',rec:'No',ty:'No',rst:'unrestricted',audit:[]}
      ]}
    ];
    np.actions=[
      {text:'Submit Q2 grant report to Smith Family Foundation',due:mo(2),who:'Executive Director',pri:'High',done:false},
      {text:'Send thank you letter to Sunrise Community Church',due:mo(1),who:'Development',pri:'High',done:false},
      {text:'Follow up with Acme Co on sponsorship proposal',due:mo(1),who:'ED',pri:'Medium',done:false}
    ];
    np.journal=[
      {text:'Q1 close — strong individual giving, behind on corporate. Need to accelerate Acme follow-up before end of quarter.',date:'April 1, '+yr},
      {text:'Smith grant mid-year check-in went well. Funder pleased with program outcomes. On track for renewal.',date:'March 15, '+yr}
    ];
  }

  // ── Small business sample ─────────────
  var sb=D.clients.find(function(c){return c.type==='sb';});
  if(!sb){sb=mkC();sb.name='My Small Business';sb.type='sb';D.clients.push(sb);}
  {
    sb.revenue=[
      {id:uid(),name:'Consulting Retainer — Apex LLC',cat:'Consulting',proj:8000,act:8000,conf:'Confirmed',recurring:'Monthly'},
      {id:uid(),name:'Project: Website Redesign',cat:'Project Work',proj:12000,act:9500,conf:'Confirmed',recurring:'None'},
      {id:uid(),name:'Training Workshop',cat:'Training',proj:3500,act:0,conf:'Likely',recurring:'None'}
    ];
    sb.expenses=[
      {id:uid(),desc:'Office Lease',cat:'Facilities',amt:1800,freq:'Monthly',fixed:'Fixed',reconciled:true,recurring:'Monthly'},
      {id:uid(),desc:'Payroll — Part Time',cat:'Personnel',amt:2400,freq:'Monthly',fixed:'Fixed',reconciled:true,recurring:'Monthly'},
      {id:uid(),desc:'Adobe Creative Cloud',cat:'Software',amt:55,freq:'Monthly',fixed:'Fixed',reconciled:true,recurring:'Monthly'},
      {id:uid(),desc:'Client Entertainment',cat:'Business Dev',amt:320,freq:'One-time',fixed:'Variable',reconciled:false,recurring:'None'},
      {id:uid(),desc:'Contractor Invoice — Design',cat:'Contractors',amt:1500,freq:'One-time',fixed:'Variable',reconciled:true,recurring:'None'}
    ];
    sb.budgetItems=[
      {cat:'Consulting',type:'Income',amt:96000},
      {cat:'Project Work',type:'Income',amt:48000},
      {cat:'Facilities',type:'Expense',amt:21600},
      {cat:'Personnel',type:'Expense',amt:28800},
      {cat:'Software',type:'Expense',amt:660},
      {cat:'Contractors',type:'Expense',amt:18000}
    ];
    sb.actions=[
      {text:'Send invoice to Apex LLC for April retainer',due:mo(1),who:'',pri:'High',done:false},
      {text:'Follow up on training workshop proposal',due:mo(1),who:'',pri:'Medium',done:false},
      {text:'Review Q1 P&L before accountant meeting',due:mo(0),who:'',pri:'High',done:true}
    ];
    sb.journal=[
      {text:'Q1 revenue slightly under plan — project delays pushed recognition to Q2. Margins solid. Watching contractor costs.',date:'April 1, '+yr}
    ];
  }

  // ── Personal sample ───────────────────
  var pe=D.clients.find(function(c){return c.type==='pe';});
  if(!pe){pe=mkC();pe.name='My Personal';pe.type='pe';D.clients.push(pe);}
  {
    pe.income=[
      {id:uid(),name:'Salary — Primary Job',cat:'Employment',amt:5200,freq:'Monthly',date:mo(0),recurring:'Monthly'},
      {id:uid(),name:'Freelance Design',cat:'Side Income',amt:800,freq:'Monthly',date:mo(0),recurring:'None'},
      {id:uid(),name:'Tax Refund',cat:'Other',amt:1200,freq:'One-time',date:'02/28/'+yr,recurring:'None'}
    ];
    pe.expenses=[
      {id:uid(),desc:'Rent',cat:'Housing',amt:1650,freq:'Monthly',date:mo(0),reconciled:true,recurring:'Monthly'},
      {id:uid(),desc:'Groceries',cat:'Food',amt:420,freq:'Monthly',date:mo(0),reconciled:true,recurring:'None'},
      {id:uid(),desc:'Car Payment',cat:'Transportation',amt:385,freq:'Monthly',date:mo(0),reconciled:true,recurring:'Monthly'},
      {id:uid(),desc:'Streaming Services',cat:'Entertainment',amt:45,freq:'Monthly',date:mo(0),reconciled:true,recurring:'Monthly'},
      {id:uid(),desc:'Gym Membership',cat:'Health',amt:49,freq:'Monthly',date:mo(0),reconciled:false,recurring:'Monthly'},
      {id:uid(),desc:'Utilities',cat:'Housing',amt:130,freq:'Monthly',date:mo(0),reconciled:true,recurring:'Monthly'}
    ];
    pe.budgetItems=[
      {cat:'Employment',type:'Income',amt:5200},
      {cat:'Housing',type:'Expense',amt:1780},
      {cat:'Food',type:'Expense',amt:450},
      {cat:'Transportation',type:'Expense',amt:385},
      {cat:'Entertainment',type:'Expense',amt:60},
      {cat:'Health',type:'Expense',amt:49}
    ];
    pe.actions=[
      {text:'Set up emergency fund — target $5,000',due:mo(3),who:'',pri:'High',done:false},
      {text:'Review streaming subscriptions — cancel unused',due:mo(1),who:'',pri:'Low',done:false}
    ];
    pe.journal=[
      {text:'Starting to track spending more carefully. Biggest surprises: food and random online purchases. Setting a $400 grocery budget.',date:'April 1, '+yr}
    ];
  }

  sv();
}

function showSamplePrompt(){
  var el=g('sample-prompt');
  if(el)el.style.display='block';
}

function acceptSample(){
  loadSampleData();
  var el=g('sample-prompt');if(el)el.style.display='none';
  processRecurring();
  renderSB();renderMobSel();
  var pin=getPinned(),startId=pin&&D.clients.find(function(c){return c.id===pin;})?pin:D.clients[0].id;
  openClient(startId);
}

function declineSample(){
  try{localStorage.setItem('clarity-sample-loaded','true');}catch(e){}
  var el=g('sample-prompt');if(el)el.style.display='none';
}

function clearSampleData(){
  if(!confirm('This will remove all sample data. Continue?'))return;
  D.clients.forEach(function(c){
    c.donors=[];
    c.income=[];
    c.expenses=[];
    c.revenue=[];
    c.budgetItems=[];
    c.grants=[];
  });
  localStorage.removeItem('clarity-sample-loaded');
  sv();
  renderAll();
}

// ══════════════════════════════════════════
// LOAD
// ══════════════════════════════════════════
// ── STARTUP HELPERS ────────────────────────────────────────────────────────
// Collects healAcctCodeDuplicates() summaries from the most recent migrateD()
// call, so the one-time notice UI (see welcome.js-style pattern) can show
// what changed. Cleared at the top of every migrateD() run.
var _ACCT_HEAL_SUMMARIES=[];
// migrateD(): runs all migration steps on D in-place. Safe to call multiple times.
function migrateD(){
  _ACCT_HEAL_SUMMARIES=[];
  if(!D.clients)D.clients=[];
  // Fix old names & ensure donors array
  var fix={'My nonprofit':'My Nonprofit','My small business':'My Small Business','My personal':'My Personal','New nonprofit':'New Nonprofit','New small business':'New Small Business','New personal':'New Personal'};
  D.clients.forEach(function(c){if(fix[c.name])c.name=fix[c.name];if(!c.donors)c.donors=[];c.donors.forEach(function(d){if(!d.id)d.id=uid();});if(!c.fiscalYearEnd)c.fiscalYearEnd='12/31';if(!c.basisType)c.basisType=defaultBasis(c.type);if(!c.invoices)c.invoices=[];if(!c.journalEntries)c.journalEntries=[];if(!c.balanceSheet)c.balanceSheet={assets:[],liabilities:[],equity:[]};if(!c.reconciliations)c.reconciliations=[];if(!c.procurement)c.procurement=[];if(!c.accounts||!c.accounts.length)c.accounts=getDefaultCOA(c.type);if(!c.bills)c.bills=[];if(!c.loans)c.loans=[];if(!c.importRules)c.importRules=[];if(!c.payroll)c.payroll=[];if(!c.proposedBudget)c.proposedBudget=[];if(!c.adoptedBudgets)c.adoptedBudgets=[];if(!c.proposedBudgets)c.proposedBudgets=[];if(!c.projects)c.projects=[];if(!c.bankAccounts)c.bankAccounts=[];if(!c.creditCards)c.creditCards=[];if(!c.funds)c.funds=[];if(!c.mileage)c.mileage=[];if(!c.fixedAssets)c.fixedAssets=[];
      // Migrate legacy single proposedBudget into proposedBudgets array
      if(c.proposedBudget.length&&!c.proposedBudgets.length){var nextYr='FY '+(new Date().getFullYear()+1);c.proposedBudgets.push({fy:nextYr,items:c.proposedBudget.slice()});c.proposedBudget=[];}
      // Sync all existing budget lines to COA (retroactive)
      (c.budgetItems||[]).forEach(function(b){syncBudgetToCOA(c,b.cat,b.type,b.group||b.type);});
      // Backfill acctCode on existing transactions where blank but category matches COA
      (c.expenses||[]).forEach(function(e){if(!e.acctCode&&e.cat){var code=lookupAcctByCAT(c,e.cat,'Expense');if(code)e.acctCode=code;}});
      (c.income||[]).forEach(function(r){if(!r.acctCode&&r.cat){var code=lookupAcctByCAT(c,r.cat,'Income');if(code)r.acctCode=code;}});
      (c.revenue||[]).forEach(function(r){if(!r.acctCode&&r.cat){var code=lookupAcctByCAT(c,r.cat,'Income');if(code)r.acctCode=code;}});
      // Normalize all transaction dates (fix any Excel serial numbers stored)
      (c.expenses||[]).forEach(function(e){if(e.date&&/^\d{4,5}$/.test(String(e.date))){var d=parseDate(e.date);if(d)e.date=fmtDate(e.date);}});
      (c.income||[]).forEach(function(r){if(r.date&&/^\d{4,5}$/.test(String(r.date))){var d=parseDate(r.date);if(d)r.date=fmtDate(r.date);}});
      (c.revenue||[]).forEach(function(r){if(r.date&&/^\d{4,5}$/.test(String(r.date))){var d=parseDate(r.date);if(d)r.date=fmtDate(r.date);}});
      // ── MIGRATION: Ensure all balance sheet assets/liabilities/equity have stable IDs
      ['assets','liabilities','equity'].forEach(function(sec){
        (c.balanceSheet[sec]||[]).forEach(function(item){if(!item.id)item.id=uid();});
      });
      // ── MIGRATION: bsAssetIdx (array position) → bsAssetId (stable ID)
      // Any transaction that has bsAssetIdx but no bsAssetId needs to be upgraded.
      // We resolve the old index against the current asset array to find the matching id.
      function migrateBsIdx(txns){
        (txns||[]).forEach(function(t){
          if(t.bsAssetIdx!==undefined&&t.bsAssetIdx>=0&&!t.bsAssetId){
            var asset=(c.balanceSheet.assets||[])[t.bsAssetIdx];
            if(asset&&asset.id){t.bsAssetId=asset.id;}
            delete t.bsAssetIdx;
          }
        });
      }
      migrateBsIdx(c.expenses||[]);
      migrateBsIdx(c.income||[]);
      migrateBsIdx(c.revenue||[]);
      // ── MIGRATION: Coerce budget amt strings → numbers
      (c.budgetItems||[]).forEach(function(b){if(typeof b.amt==='string')b.amt=Number(b.amt)||0;});
      (c.proposedBudgets||[]).forEach(function(pb){(pb.items||[]).forEach(function(b){if(typeof b.amt==='string')b.amt=Number(b.amt)||0;});});
      (c.adoptedBudgets||[]).forEach(function(ab){(ab.items||[]).forEach(function(b){if(typeof b.amt==='string')b.amt=Number(b.amt)||0;});});
      // ── MIGRATION: Coerce all transaction numeric fields stored as strings
      (c.expenses||[]).forEach(function(e){if(typeof e.amt==='string')e.amt=Number(e.amt)||0;});
      (c.income||[]).forEach(function(r){
        if(typeof r.amt==='string')r.amt=Number(r.amt)||0;
        if(typeof r.proj==='string')r.proj=Number(r.proj)||0;
        if(typeof r.recv==='string')r.recv=Number(r.recv)||0;
      });
      (c.revenue||[]).forEach(function(r){
        if(typeof r.proj==='string')r.proj=Number(r.proj)||0;
        if(typeof r.act==='string')r.act=Number(r.act)||0;
      });
      (c.grants||[]).forEach(function(gr){if(typeof gr.awarded==='string')gr.awarded=Number(gr.awarded)||0;});
      // ── MIGRATION: Seed audit trail on existing transactions
      (c.expenses||[]).forEach(function(e){if(!e.audit)e.audit=[];});
      (c.income||[]).forEach(function(r){if(!r.audit)r.audit=[];});
      (c.revenue||[]).forEach(function(r){if(!r.audit)r.audit=[];});
      // ── MIGRATION: Seed audit trail on existing proposed budget items
      (c.proposedBudgets||[]).forEach(function(pb){(pb.items||[]).forEach(function(b){if(!b.audit)b.audit=[];});});
      // ── MIGRATION: Seed functional and receiptUrl on existing expenses
      (c.expenses||[]).forEach(function(e){
        if(e.functional===undefined)e.functional='';
        if(e.receiptUrl===undefined)e.receiptUrl='';
        if(e.voided===undefined)e.voided=false;
        if(e.isReversal===undefined)e.isReversal=false;
      });
      // ── MIGRATION: Seed voided flags on income and revenue
      (c.income||[]).forEach(function(r){if(r.voided===undefined)r.voided=false;if(r.isReversal===undefined)r.isReversal=false;});
      (c.revenue||[]).forEach(function(r){if(r.voided===undefined)r.voided=false;if(r.isReversal===undefined)r.isReversal=false;});
      // ── MIGRATION: Seed restrictionReleases array
      if(!c.restrictionReleases)c.restrictionReleases=[];
      // ── MIGRATION: Seed fundTransfers array
      if(!c.fundTransfers)c.fundTransfers=[];
      // ── MIGRATION: Seed in-kind auction fields on existing donations
      (c.donors||[]).forEach(function(d){(d.donations||[]).forEach(function(dn){
        if(dn.itemDescription===undefined)dn.itemDescription='';
        if(dn.auctioned===undefined)dn.auctioned=false;
        if(dn.auctionDate===undefined)dn.auctionDate='';
        if(dn.auctionSalePrice===undefined)dn.auctionSalePrice=0;
        if(dn.auctionBuyerName===undefined)dn.auctionBuyerName='';
      });});
      // ── MIGRATION: openingBalance — make BS asset balances self-healing
      // Current asset.amt becomes openingBalance; display balance is computed live from transactions.
      // This runs once — if openingBalance already exists, skip.
      (c.balanceSheet.assets||[]).forEach(function(a){
        if(a.openingBalance===undefined){
          a.openingBalance=Number(a.amt||0);
          delete a.amt;
        }
      });
      if(!c.ledgerEntries)c.ledgerEntries=[];
      if(!c.deprPosted)c.deprPosted={};
      if(c.closedThrough===undefined)c.closedThrough=null;
      if(!c.vendors)c.vendors=[];
      if(!c.customers)c.customers=[];
      if(!c.pettyCash)c.pettyCash=[];
      if(!c.taxJurisdictions)c.taxJurisdictions=[];
      // ── MIGRATION: Document vault
      if(!c.documents)c.documents=[];
      // ── MIGRATION: Nonprofit type (501(c) subtype) and fiscal sponsorships
      if(c.type==='np'&&!c.npType)c.npType='501c3';
      if(!c.fiscalSponsorships)c.fiscalSponsorships=[];
      // ── MIGRATION: Invoice URL/path on bills
      (c.bills||[]).forEach(function(b){if(b.invoiceUrl===undefined)b.invoiceUrl='';if(b.invoicePath===undefined)b.invoicePath='';});
      // ── MIGRATION: relabel net-asset accounts to GAAP (ASU 2016-14) 2-class terminology.
      // Only renames if the name still matches the old default exactly, so a user's own
      // custom account name is never overwritten. Codes are unchanged — no data migration needed.
      (function(){
        var relabel={'3010':{from:'Unrestricted net assets',to:'Net assets without donor restrictions'},
          '3020':{from:'Temp. restricted net assets',to:'Net assets with donor restrictions'},
          '3030':{from:'Perm. restricted net assets',to:'Net assets with donor restrictions — endowment'}};
        (c.accounts||[]).forEach(function(a){
          var r=relabel[a.code];
          if(r&&a.name===r.from)a.name=r.to;
        });
      })();
      if(!c.ledgerEntries.length)migrateToLedger(c);
      // ── MIGRATION: heal duplicate Chart-of-Accounts codes (one-time per client)
      var healSummary=healAcctCodeDuplicates(c);
      if(healSummary)_ACCT_HEAL_SUMMARIES.push(healSummary);
      // ── MIGRATION: heal expense/income records coded to the wrong account type
      var typeHealSummary=healAcctTypeMismatches(c);
      if(typeHealSummary)_ACCT_HEAL_SUMMARIES.push(typeHealSummary);
      // ── MIGRATION: heal petty cash/bad debt expenses miscoded to a hardcoded, wrong account
      var opExpHealSummary=healMiscodedOperationalExpenses(c);
      if(opExpHealSummary)_ACCT_HEAL_SUMMARIES.push(opExpHealSummary);
      // ── MIGRATION: heal donations logged via the Donors tab that never posted to income/ledger
      var donationHealSummary=healMissingDonationIncome(c);
      if(donationHealSummary)_ACCT_HEAL_SUMMARIES.push(donationHealSummary);
      // ── MIGRATION: heal donation-coded income entries never linked back to the Donors tab
      var donorLinkHealSummary=healMissingDonorLinks(c);
      if(donorLinkHealSummary)_ACCT_HEAL_SUMMARIES.push(donorLinkHealSummary);
      // ── MIGRATION: backfill missing donation ids (needed for Supabase dual-write, silent)
      healMissingDonationIds(c);
      // ── MIGRATION: de-duplicate ledger entries (a re-post bug could stack identical lines,
      //    inflating the GL/balance sheet while income & donor records stayed correct)
      healDuplicateLedger(c);
    });
  // Deduplicate: remove empty default clients if a data-filled one of same type exists
  var seen={};D.clients=D.clients.filter(function(cl){var k=cl.type;if(seen[k]){var hasD=(cl.income&&cl.income.length)||(cl.expenses&&cl.expenses.length)||(cl.revenue&&cl.revenue.length)||(cl.grants&&cl.grants.length)||(cl.donors&&cl.donors.length);return hasD;}seen[k]=true;return true;});
}

// ── RENDER / ROUTE ──────────────────────────────────────────────────────────
// renderApp(): routes to the right screen based on D state.
// Safe to call multiple times — always shows the correct view.
// migrateToLedger(c): walk all existing transactions and build ledgerEntries[].
// De-duplicates ledgerEntries: if the same source posted identical ACTIVE lines more than
// once (the re-post bug that inflated the GL while income/donor records stayed correct),
// keep the first and supersede the rest. Idempotent — safe on every load. Splits and
// multi-line postings differ in their lines signature, so they're never collapsed.
function healDuplicateLedger(c){
  if(!c||!c.ledgerEntries||!c.ledgerEntries.length)return 0;
  var seen={},removed=0;
  c.ledgerEntries.forEach(function(e){
    if(e.superseded||e.sourceType==='void'||!e.sourceId||!e.lines||!e.lines.length)return;
    var sig=e.sourceId+'|'+e.lines.map(function(l){return (l.accountCode||'')+':'+(l.dr||0)+':'+(l.cr||0);}).join(',');
    if(seen[sig]){e.superseded=true;removed++;if(typeof dwUpsertLedgerEntry==='function')dwUpsertLedgerEntry(c,e);}
    else{seen[sig]=true;}
  });
  return removed;
}

// Idempotent — skips any transaction whose id already has a ledger entry.
// Called manually via "Rebuild ledger" button, or automatically in migrateD
// for clients whose ledgerEntries[] is empty.
function migrateToLedger(c){
  if(!c)return;
  if(!c.ledgerEntries)c.ledgerEntries=[];
  // Build set of already-posted sourceIds so we never double-post
  var posted={};
  c.ledgerEntries.forEach(function(e){if(e.sourceId)posted[e.sourceId]=true;});

  var cashCode=_defaultCashCode(c);
  var apCode=_defaultAPCode(c);
  var arCode=_defaultARCode(c);

  // ── Expenses ──────────────────────────────────────────────────────────────
  (c.expenses||[]).forEach(function(e){
    if(!e.id||posted[e.id])return;
    if(e.deleted||e.voided||e.isReversal)return;
    var debit=e.acctCode||'5010';
    var credit=cashCode;
    postToLedger(c,debit,credit,Number(e.amt||0),(e.desc||'Expense'),'expense',e.id);
    posted[e.id]=true;
  });

  // ── NP Income ─────────────────────────────────────────────────────────────
  // Build a set of grantIds already covered by a recv>0 entry so placeholders (recv=0)
  // from the same grant don't also get posted and create a double-credit.
  var _grantIdPosted={};
  (c.income||[]).forEach(function(r){
    if(r.grantId&&Number(r.recv||r.amt||0)>0)_grantIdPosted[r.grantId]=(_grantIdPosted[r.grantId]||0)+1;
  });
  (c.income||[]).forEach(function(r){
    if(!r.id||posted[r.id])return;
    if(r.deleted||r.voided||r.isReversal)return;
    // Skip recv=0 placeholders — nothing to post yet
    if(Number(r.recv||r.amt||0)===0)return;
    // Skip duplicate: if this grantId already has another entry with recv>0 that was posted
    // (covers the case where _bankPost failed to merge and two entries both have recv>0)
    if(r.grantId&&_grantIdPosted[r.grantId]>1){
      // Only post the fromBank entry (most authoritative); skip the manual placeholder
      if(!r.fromBank){posted[r.id]=true;return;}
    }
    var credit=r.acctCode||'4010';
    var debit=cashCode;
    postToLedger(c,debit,credit,Number(r.recv||r.amt||0),(r.name||'Income'),'income',r.id);
    posted[r.id]=true;
  });

  // ── SB/PE Revenue ─────────────────────────────────────────────────────────
  (c.revenue||[]).forEach(function(r){
    if(!r.id||posted[r.id])return;
    if(r.deleted||r.voided||r.isReversal)return;
    var credit=r.acctCode||'4010';
    postToLedger(c,cashCode,credit,Number(r.act||0),(r.name||'Revenue'),'revenue',r.id);
    posted[r.id]=true;
  });

  // ── Invoices (AR) ─────────────────────────────────────────────────────────
  (c.invoices||[]).forEach(function(inv){
    if(!inv.id||posted[inv.id])return;
    postToLedger(c,arCode,'4010',Number(inv.amt||0),(inv.desc||inv.client||'Invoice'),'invoice',inv.id);
    posted[inv.id]=true;
  });

  // ── Journal Entries ───────────────────────────────────────────────────────
  (c.journalEntries||[]).forEach(function(je){
    if(!je.id||posted[je.id])return;
    // Journal entries already have debit/credit lines — post each pair
    var lines=je.lines||[];
    var drLines=lines.filter(function(l){return Number(l.dr||0)>0;});
    var crLines=lines.filter(function(l){return Number(l.cr||0)>0;});
    // Simple 1-dr / 1-cr: use postToLedger
    if(drLines.length===1&&crLines.length===1){
      postToLedger(c,drLines[0].accountCode||drLines[0].acct,crLines[0].accountCode||crLines[0].acct,
        Number(drLines[0].dr||0),(je.memo||'Journal entry'),'je',je.id);
    } else {
      // Compound entry — post directly as a multi-line ledger entry
      if(!c.ledgerEntries)c.ledgerEntries=[];
      c.ledgerEntries.push({
        id:uid(),date:je.date||todayNum(),memo:je.memo||'Journal entry',
        sourceType:'je',sourceId:je.id,createdAt:new Date().toISOString(),
        lines:lines.map(function(l){return{accountCode:l.accountCode||l.acct||'',
          dr:Number(l.dr||0),cr:Number(l.cr||0)};})
      });
    }
    posted[je.id]=true;
  });
}

// ── ACCOUNT-CODE DEDUP HEALING ──────────────────────────────────────────────
// One-time-per-client repair for a bug (now fixed — see _nextAcctCode in
// state.js) where auto-generated Chart-of-Accounts codes could collide once
// the numbering crossed a thousand boundary (e.g. 5990 -> 6000, then every
// account created after that also got handed code 6000), silently merging
// many unrelated categories onto one account code and corrupting Trial
// Balance / General Ledger totals for that code.
// Idempotent — guarded by c._acctDedupHealed, safe to call on every load,
// and a no-op for clients that were never affected.
// Returns a summary object if it did real work, or null if there was
// nothing to fix (so callers can skip showing a notice).
function healAcctCodeDuplicates(c){
  if(!c||c._acctDedupHealed)return null;
  c._acctDedupHealed=true;
  if(!c.accounts||!c.accounts.length)return null;

  // Step 1 — backfill any transaction still missing a stable id (leftover
  // from before ids were guaranteed on save). Needed so step 3 can post a
  // ledger entry for it, and so future edits/deletes address it correctly.
  var backfilledIds=0;
  ['expenses','income','revenue'].forEach(function(arrName){
    (c[arrName]||[]).forEach(function(item){
      if(!item.id){item.id=uid();backfilledIds++;}
    });
  });

  // Step 2 — find every account code shared by more than one account. Keep
  // the first account at its original code; give each other one a fresh,
  // real code. Relink every transaction that actually belongs to that
  // specific account (matched by category name — verified unambiguous,
  // never the now-meaningless shared code) plus its posted ledger lines.
  var byCode={};
  c.accounts.forEach(function(a){(byCode[a.code]=byCode[a.code]||[]).push(a);});
  var recoded=[];
  Object.keys(byCode).forEach(function(code){
    var group=byCode[code];
    if(group.length<2)return;
    group.slice(1).forEach(function(dupAcct){
      var oldCode=dupAcct.code;
      var newCode=_nextAcctCode(c,dupAcct.type);
      dupAcct.code=newCode;
      ['expenses','income','revenue'].forEach(function(arrName){
        (c[arrName]||[]).forEach(function(item){
          if(item.acctCode!==oldCode)return;
          if(item.cat!==dupAcct.cat&&item.cat!==dupAcct.name)return;
          item.acctCode=newCode;
          (c.ledgerEntries||[]).forEach(function(le){
            if(le.sourceId!==item.id)return;
            (le.lines||[]).forEach(function(l){if(l.accountCode===oldCode)l.accountCode=newCode;});
          });
          recoded.push({desc:item.desc||item.name||'',cat:item.cat,amt:Number(item.amt||item.recv||item.act||0),oldCode:oldCode,newCode:newCode});
        });
      });
    });
  });
  if(recoded.length)c.accounts.sort(function(a,b){return a.code.localeCompare(b.code);});

  // Step 2b — a transaction can be left sitting on one of the old shared
  // codes above even after step 2, if its category never matched any of the
  // colliding accounts by name (e.g. it was typed slightly differently, or
  // the account it truly belongs to already existed elsewhere in the COA
  // under its own real code all along). For anything still on an old shared
  // code, fall back to the same category lookup the app already trusts for
  // this exact purpose elsewhere (see the acctCode backfill above in
  // migrateD) — but only relink if it resolves to a *different*, real
  // account, so nothing is touched unless we have an unambiguous match.
  var oldSharedCodes=Object.keys(byCode).filter(function(code){return byCode[code].length>1;});
  if(oldSharedCodes.length){
    ['expenses','income','revenue'].forEach(function(arrName){
      var acctType=arrName==='expenses'?'Expense':'Income';
      (c[arrName]||[]).forEach(function(item){
        if(oldSharedCodes.indexOf(item.acctCode)<0)return;
        var match=lookupAcctByCAT(c,item.cat,acctType);
        if(!match||match===item.acctCode)return;
        var oldCode=item.acctCode;
        item.acctCode=match;
        (c.ledgerEntries||[]).forEach(function(le){
          if(le.sourceId!==item.id)return;
          (le.lines||[]).forEach(function(l){if(l.accountCode===oldCode)l.accountCode=match;});
        });
        recoded.push({desc:item.desc||item.name||'',cat:item.cat,amt:Number(item.amt||item.recv||item.act||0),oldCode:oldCode,newCode:match});
      });
    });
  }

  // Step 2c — anything still left on an old shared code at this point
  // belongs to a category that never had its own Chart-of-Accounts entry at
  // all (not a mismatch — genuinely missing). Create one, the same way the
  // app already does for any other brand-new category (see syncBudgetToCOA),
  // then relink. Skip whichever account is the rightful keeper of the old
  // code — its own transactions should stay put.
  var created=[];
  if(oldSharedCodes.length){
    ['expenses','income','revenue'].forEach(function(arrName){
      var coaType=arrName==='expenses'?'Expense':'Income';
      (c[arrName]||[]).forEach(function(item){
        if(oldSharedCodes.indexOf(item.acctCode)<0)return;
        var keeper=byCode[item.acctCode][0];
        if(item.cat===keeper.cat||item.cat===keeper.name)return;// belongs here for real
        if(!item.cat)return;// nothing to name a new account after
        var newAcct=c.accounts.find(function(a){return a.type===coaType&&(a.cat===item.cat||a.name===item.cat);});
        if(!newAcct){
          newAcct={id:uid(),code:_nextAcctCode(c,coaType),name:item.cat,type:coaType,cat:item.cat,fromBudget:true};
          c.accounts.push(newAcct);
          created.push(newAcct);
        }
        var oldCode=item.acctCode;
        item.acctCode=newAcct.code;
        (c.ledgerEntries||[]).forEach(function(le){
          if(le.sourceId!==item.id)return;
          (le.lines||[]).forEach(function(l){if(l.accountCode===oldCode)l.accountCode=newAcct.code;});
        });
        recoded.push({desc:item.desc||item.name||'',cat:item.cat,amt:Number(item.amt||item.recv||item.act||0),oldCode:oldCode,newCode:newAcct.code});
      });
    });
    if(created.length)c.accounts.sort(function(a,b){return a.code.localeCompare(b.code);});
  }

  // Step 3 — post ledger entries for anything that never got one (this is
  // what the missing ids in step 1 were silently blocking). migrateToLedger
  // is already idempotent — it skips anything already posted.
  var beforeIds={};(c.ledgerEntries||[]).forEach(function(le){beforeIds[le.id]=true;});
  migrateToLedger(c);
  var newEntries=(c.ledgerEntries||[]).filter(function(le){return!beforeIds[le.id];});
  var newlyPostedTotal=newEntries.reduce(function(s,le){
    var line=(le.lines||[]).find(function(l){return Number(l.dr||0)>0;});
    return s+(line?Number(line.dr||0):0);
  },0);

  if(!recoded.length&&!backfilledIds&&!newEntries.length)return null;
  return{
    clientId:c.id,clientName:c.name,
    backfilledIds:backfilledIds,
    recoded:recoded,
    newlyPostedCount:newEntries.length,
    newlyPostedTotal:newlyPostedTotal
  };
}

// ── ACCOUNT-TYPE MISMATCH HEALING ───────────────────────────────────────────
// One-time-per-client repair for a bug (now fixed — lookupAcctByCAT in
// state.js is type-aware) where an expense/income/revenue record could get
// silently coded to an account of the WRONG type — e.g. an expense (buying
// supplies for a fundraiser) attaching to that same-named event's INCOME
// account instead of a distinct expense account, because the lookup only
// matched on category name and never checked Income vs Expense. This is a
// different root cause from the duplicate-code bug (healAcctCodeDuplicates
// above) — that one was many accounts sharing one code; this one is a
// record pointed at a real, valid, but wrong-type account.
// Idempotent — guarded by c._acctTypeMismatchHealed, safe to call on every
// load, a no-op for clients that were never affected.
function healAcctTypeMismatches(c){
  if(!c||c._acctTypeMismatchHealed)return null;
  c._acctTypeMismatchHealed=true;
  if(!c.accounts||!c.accounts.length)return null;

  var acctByCode={};c.accounts.forEach(function(a){acctByCode[a.code]=a;});
  var typeFor={expenses:'Expense',income:'Income',revenue:'Income'};
  var recoded=[];

  ['expenses','income','revenue'].forEach(function(arrName){
    var correctType=typeFor[arrName];
    (c[arrName]||[]).forEach(function(item){
      if(!item.acctCode||!item.cat)return;
      var curAcct=acctByCode[item.acctCode];
      // No account, or already the right type — nothing to fix. A wrong
      // account with a DIFFERENT category name is a separate, deliberate
      // choice (e.g. manually recoded) — only type mismatches are in scope.
      if(!curAcct||curAcct.type===correctType)return;
      var correct=c.accounts.find(function(a){return a.type===correctType&&(a.cat===item.cat||a.name===item.cat);});
      if(!correct){
        correct={id:uid(),code:_nextAcctCode(c,correctType),name:item.cat,type:correctType,cat:item.cat,fromBudget:true};
        c.accounts.push(correct);
        acctByCode[correct.code]=correct;
      }
      var oldCode=item.acctCode;
      item.acctCode=correct.code;
      (c.ledgerEntries||[]).forEach(function(le){
        if(le.sourceId!==item.id)return;
        (le.lines||[]).forEach(function(l){if(l.accountCode===oldCode)l.accountCode=correct.code;});
      });
      recoded.push({desc:item.desc||item.name||'',cat:item.cat,amt:Number(item.amt||item.recv||item.act||0),oldCode:oldCode,newCode:correct.code});
    });
  });
  if(recoded.length)c.accounts.sort(function(a,b){return a.code.localeCompare(b.code);});

  if(!recoded.length)return null;
  return{
    clientId:c.id,clientName:c.name,
    backfilledIds:0,
    recoded:recoded,
    newlyPostedCount:0,
    newlyPostedTotal:0
  };
}

// ── MISCODED PETTY CASH / BAD DEBT / IN-KIND EXPENSE HEALING ─────────────────
// One-time-per-client repair for a bug (now fixed — see savePettyCash() in
// features.js, writeBadDebt() in saves.js, and _postDonationLedger() in
// renders.js) where all three posted to a hardcoded numeric account code that
// was never actually reserved for that purpose in either default COA: petty
// cash disbursements landed in '5210' — "Utilities" (NP) / "Office supplies"
// (SB); bad debt write-offs landed in c.type==='np'?'5800':'5900' —
// "Depreciation" (NP) / "Cost of goods sold" (SB); in-kind donation expenses
// landed in '5400' — "Marketing & outreach" (NP), instead of NP's own default
// "5410 In-kind expense" line. Every use of any of the three miscoded a real
// expense category, not just a collision risk. All three now post to their
// own dedicated account via _ensureDedicatedCOA() (state.js), matching the
// pattern already used for postDepreciation()/saveLoan()/saveAsset(). This
// heals already-posted history.
// Conservative like healAcctTypeMismatches() above — only recodes an item still
// sitting on the exact known-wrong hardcoded code, so an item a user later
// re-categorized on purpose (via the inline account picker) is left alone.
// Idempotent — guarded by c._opExpMiscodeHealed, safe to call on every load.
function healMiscodedOperationalExpenses(c){
  if(!c||c._opExpMiscodeHealed)return null;
  c._opExpMiscodeHealed=true;
  if(!c.expenses||!c.expenses.length)return null;
  var recoded=[];
  (c.expenses||[]).forEach(function(item){
    if(item.deleted)return;
    var isPettyCash=!!item.pettyCashId&&item.acctCode==='5210';
    var isBadDebt=Array.isArray(item.audit)&&item.audit.some(function(a){return a.action==='bad_debt_writeoff';})&&(item.acctCode==='5800'||item.acctCode==='5900');
    var isInKind=!!item.inkindRef&&item.acctCode==='5400';
    if(!isPettyCash&&!isBadDebt&&!isInKind)return;
    var correctCode=isPettyCash
      ?_ensureDedicatedCOA(c,'Petty cash expense','Expense','Petty Cash')
      :isBadDebt
      ?_ensureDedicatedCOA(c,'Bad debt expense','Expense','Bad Debt')
      :_ensureDedicatedCOA(c,'In-kind expense','Expense','In-Kind Expense');
    var oldCode=item.acctCode;
    if(oldCode===correctCode)return;
    item.acctCode=correctCode;
    (c.ledgerEntries||[]).forEach(function(le){
      if(le.sourceId!==item.id)return;
      (le.lines||[]).forEach(function(l){if(l.accountCode===oldCode)l.accountCode=correctCode;});
    });
    recoded.push({desc:item.desc||'',cat:item.cat,amt:Number(item.amt||0),oldCode:oldCode,newCode:correctCode});
  });
  if(!recoded.length)return null;
  return{
    clientId:c.id,clientName:c.name,
    backfilledIds:0,
    recoded:recoded,
    newlyPostedCount:0,
    newlyPostedTotal:0
  };
}

// ── MISSING DONATION INCOME HEALING ──────────────────────────────────────────
// One-time-per-client repair for a bug (now fixed — see _postDonationLedger in
// renders.js) where donations logged through the main Donors tab never created
// an income entry or ledger posting — they only lived in c.donors[].donations[],
// so they showed up correctly in donor reports/LYBUNT/thank-you letters but never
// reached the Trial Balance, Balance Sheet, P&L, or 990 gross-receipts figures.
// Idempotent — guarded by c._donationIncomeHealed, safe to call on every load,
// and a no-op for clients that were never affected.
// Returns a summary object if it did real work, or null if there was nothing to fix.
function healMissingDonationIncome(c){
  if(!c||c._donationIncomeHealed)return null;
  c._donationIncomeHealed=true;
  if(!c.donors||!c.donors.length)return null;
  if(!c.income)c.income=[];

  // Backfill incomeRef/expenseRef links on legacy in-kind donations (they already posted
  // income/expense entries under the old code, just without a link back to find them by
  // later — matched the same way the old edit-in-place code used to, by description).
  c.donors.forEach(function(d){
    (d.donations||[]).forEach(function(dn){
      if(dn.inkind==='Yes'&&!dn.incomeRef){
        var desc=(dn.itemDescription||'In-kind donation')+' — '+(d.name||'Unknown donor');
        var incMatch=(c.income||[]).find(function(r){return r.inkindRef&&r.name===desc;});
        if(incMatch)dn.incomeRef=incMatch.id;
        var expMatch=(c.expenses||[]).find(function(e){return e.inkindRef&&e.desc===desc;});
        if(expMatch)dn.expenseRef=expMatch.id;
      }
    });
  });

  // Backfill missing income entries for cash donations logged via the Donors tab.
  var backfilled=[],linked=0;
  c.donors.forEach(function(d){
    (d.donations||[]).forEach(function(dn){
      if(dn.incomeRef)return;// already linked
      if(dn.inkind==='Yes')return;// handled above
      var donorName=d.name||'Unknown donor';
      var amt=Number(dn.amt||0);
      if(!amt)return;
      // Look for a plausible existing match first (e.g. also entered via bank import)
      // so this doesn't create a duplicate — same heuristic as the live duplicate-check
      // in saveDonation().
      var donorNameLc=donorName.toLowerCase();
      var match=(c.income||[]).find(function(r){
        if(r.donationRef||r.inkindRef)return false;// don't match against entries this healer/fix already created
        var amtMatch=Math.abs(Number(r.recv||r.amt||0)-amt)<0.01;
        var dateDiff=r.date&&dn.date?Math.abs(new Date(r.date)-new Date(dn.date))/(1000*60*60*24):999;
        var rName=(r.vendor1099||r.name||'').toLowerCase();
        var nameMatch=!donorNameLc||rName.indexOf(donorNameLc)>=0||donorNameLc.indexOf(rName)>=0;
        return amtMatch&&dateDiff<=5&&nameMatch;
      });
      if(match){dn.incomeRef=match.id;linked++;return;}
      var _n=(typeof normalizeRst==='function')?normalizeRst(dn.rst):(dn.rst||'unrestricted');
      var netClass=_n==='permanently_restricted'?'with_restriction_perm':_n==='temporarily_restricted'?'with_restriction':'without_restriction';
      var incItem={id:uid(),name:donorName,cat:'Individual donation',status:'Received',proj:amt,recv:amt,date:dn.date||'',fund:dn.fund||'',acctCode:'4010',donationRef:true,netClass:netClass,donorId:d.id,audit:[]};
      c.income.push(incItem);
      if(typeof dwUpsertIncome==='function')dwUpsertIncome(c,incItem);
      dn.incomeRef=incItem.id;
      backfilled.push({amt:amt,donor:donorName});
    });
  });

  // Post ledger entries for everything just created (migrateToLedger is idempotent).
  if(backfilled.length)migrateToLedger(c);

  // Flag existing in-kind expenses hardcoded to 'fundraising' before the functional-category
  // selector existed (see saveDonation() in renders.js), so the user can review and reclassify —
  // not auto-changed here, since there's no way to know the correct category retroactively.
  var inkindFundraising=(c.expenses||[]).filter(function(e){return e.inkindRef&&e.functional==='fundraising';});
  var inkindFundraisingTotal=inkindFundraising.reduce(function(s,e){return s+Number(e.amt||0);},0);

  if(!backfilled.length&&!linked&&!inkindFundraising.length)return null;
  return{
    clientId:c.id,clientName:c.name,recoded:[],
    donationsBackfilled:backfilled.length,
    donationsBackfilledTotal:backfilled.reduce(function(s,b){return s+b.amt;},0),
    donationsLinked:linked,
    inkindFundraisingCount:inkindFundraising.length,
    inkindFundraisingTotal:inkindFundraisingTotal
  };
}

// ── MISSING DONOR-LINK HEALING ───────────────────────────────────────────────
// One-time-per-client repair for a bug (now fixed — see _syncIncomeToDonorTab in renders.js)
// where income entries added directly on the Income tab and coded to the "Individual
// Donations" account never created or linked a Donors-tab record — so they showed up
// correctly on financial statements but were invisible to donor reports, LYBUNT, thank-you
// letter tracking, and Schedule B. Explicitly skips anything already covered by another path
// (fromBank, donationRef, inkindRef) so this never creates a duplicate alongside a donation
// the Bank tab or Donors tab already linked their own way.
// Idempotent — guarded by c._donorLinkHealedV2, safe to call on every load.
// (V2, not V1: the detection logic underneath this — _isDonationAcct — was broadened after the
// first version shipped, from matching only the default "Individual Donations" label to also
// catching common custom variants like "Donations". Anyone whose books already burned the V1
// guard flag before that broadening would otherwise never get re-scanned with the better logic,
// even though nothing was actually fixed for them yet — so this is a fresh flag, not a reuse.)
// Donation records were the only record type in this app with no stable .id — only their
// donor + array position identified them, since saveDonation() never called uid() for them
// (unlike every other record type). That's not a problem for anything in-app (edits use the
// in-memory array index, DONATION_EI), but it blocks Supabase dual-write, which needs a
// stable id to upsert against. Silent, invisible-to-the-user backfill — never surfaced in the
// healing notice UI, since there's nothing for the owner to actually see or act on.
function healMissingDonationIds(c){
  if(!c||c._donationIdsHealed)return null;
  c._donationIdsHealed=true;
  if(!c.donors||!c.donors.length)return null;
  c.donors.forEach(function(d){
    (d.donations||[]).forEach(function(dn){
      if(!dn.id)dn.id=uid();
    });
  });
  return null;
}

// Returns a summary object if it did real work, or null if there was nothing to fix.
function healMissingDonorLinks(c){
  if(!c||c._donorLinkHealedV2)return null;
  c._donorLinkHealedV2=true;
  if(c.type!=='np')return null;
  if(!c.income||!c.income.length)return null;
  if(!c.donors)c.donors=[];

  var linked=0,created=[],needsReview=[];
  c.income.forEach(function(item){
    if(item.grantId)return;
    if(item.fromBank||item.donationRef||item.inkindRef)return;// already covered elsewhere
    if(typeof _isDonationAcct!=='function'||!_isDonationAcct(c,item.acctCode))return;
    var donorName=(item.name||'').trim();
    if(!donorName)return;
    var amt=Number(item.recv||item.proj||0);
    if(!amt)return;
    var donorNameLc=donorName.toLowerCase();
    // Only link against a donor who already exists by that exact name — never invent a new
    // donor from historical data. A income entry's "name" field on this account isn't always
    // a person (e.g. a batch "Annual Fund Drive" total), and there's no bookkeeper present to
    // ask right now, unlike the live saveInc() sync where the entry was just typed on purpose.
    var existingDonor=c.donors.find(function(d){return d.name.toLowerCase()===donorNameLc;});
    if(!existingDonor){
      needsReview.push({amt:amt,name:donorName,date:item.date||''});
      return;
    }
    // Look for a plausible existing donation already logged separately pre-fix, so this
    // links instead of duplicating — same heuristic as the other healers' duplicate-checks.
    var match=null;
    (existingDonor.donations||[]).forEach(function(dn){
      if(match||dn.incomeRef)return;
      var amtMatch=Math.abs(Number(dn.amt||0)-amt)<0.01;
      var dateDiff=dn.date&&item.date?Math.abs(new Date(dn.date)-new Date(item.date))/(1000*60*60*24):999;
      if(amtMatch&&dateDiff<=5)match=dn;
    });
    if(match){
      match.incomeRef=item.id;
      item.donorId=existingDonor.id;
      item.donationRef=true;
      linked++;
    }else if(typeof _syncIncomeToDonorTab==='function'){
      _syncIncomeToDonorTab(c,item);
      created.push({amt:amt,donor:donorName});
    }
  });

  if(!linked&&!created.length&&!needsReview.length)return null;
  return{
    clientId:c.id,clientName:c.name,recoded:[],
    donorLinksCreated:created.length,
    donorLinksCreatedTotal:created.reduce(function(s,x){return s+x.amt;},0),
    donorLinksMatched:linked,
    donorLinksNeedReview:needsReview.length,
    donorLinksNeedReviewTotal:needsReview.reduce(function(s,x){return s+x.amt;},0),
    donorLinksNeedReviewItems:needsReview
  };
}

function renderApp(){
  // New user: show welcome, no clients
  if(!D.clients||!D.clients.length){
    g('home').style.display='flex';
    var sc=g('sb-clients');if(sc)sc.style.display='none';
    var sampleLoaded=false;try{sampleLoaded=localStorage.getItem('clarity-sample-loaded')==='true';}catch(e){}
    if(!sampleLoaded){showSamplePrompt();}
    return;
  }
  // Has clients but no transactions yet
  if(!hasData()){
    var sampleLoaded2=false;try{sampleLoaded2=localStorage.getItem('clarity-sample-loaded')==='true';}catch(e){}
    g('home').style.display='flex';
    var sc2=g('sb-clients');if(sc2)sc2.style.display='block';
    if(!sampleLoaded2){showSamplePrompt();}
    renderSB();renderMobSel();
    return;
  }
  // Returning user with data — render immediately, then run housekeeping
  renderSB();renderMobSel();
  var pin=getPinned(),startId=pin&&D.clients.find(function(c){return c.id===pin;})?pin:D.clients[0].id;
  openClient(startId);
}

// ── LOAD ────────────────────────────────────────────────────────────────────
// load(): read localStorage → migrate → render immediately.
// Cloud sync (stale-while-revalidate) is handled separately in features.js.
function _showSkeleton(){
  var sk=document.getElementById('clarity-skeleton');
  if(sk)return;// already shown
  sk=document.createElement('div');
  sk.id='clarity-skeleton';
  sk.style.cssText='position:fixed;inset:0;background:var(--bg,#f7f6f2);display:flex;align-items:center;justify-content:center;z-index:99999;flex-direction:column;gap:12px';
  sk.innerHTML='<div style="font-size:22px;font-weight:600;color:var(--np,#0F6E56);letter-spacing:-.5px">Clarity</div>'
    +'<div style="width:32px;height:32px;border:3px solid var(--border,#e8e6e0);border-top-color:var(--np,#0F6E56);border-radius:50%;animation:clarity-spin .7s linear infinite"></div>'
    +'<style>@keyframes clarity-spin{to{transform:rotate(360deg)}}</style>';
  document.body.appendChild(sk);
}
function _hideSkeleton(){
  var sk=document.getElementById('clarity-skeleton');
  if(sk){sk.style.opacity='0';sk.style.transition='opacity .2s';setTimeout(function(){if(sk.parentNode)sk.parentNode.removeChild(sk);},200);}
}

function load(){
  // Show skeleton immediately so there's never a blank screen
  _showSkeleton();
  try{
    // 1. Read from localStorage if D is empty
    if(!D.clients||!D.clients.length){
      try{var s=localStorage.getItem(STORE);if(s){var _p=JSON.parse(s);if(_p&&_p.clients)D=_p;}}catch(e){}
    }
    // 2. Run migration in-place
    try{
      migrateD();
      // migrateD() itself never persists — it only mutates D in memory.
      // That's fine for most of its steps (idempotent no-ops next time
      // regardless), but the account-code healing pass needs to actually
      // land in localStorage (and sync to the cloud if signed in) right
      // away — otherwise a user who loads the app, looks around, and
      // closes the tab without triggering any other save would see the
      // fix silently discarded and the one-time notice reappear next visit.
      if(_ACCT_HEAL_SUMMARIES.length)sv();
    }catch(e){
      console.error('[clarity] migrateD error:',e);
      // Non-fatal — continue to renderApp with whatever D we have
    }
    // 3. Render immediately — user sees their data
    try{renderApp();}catch(e){
      console.error('[clarity] renderApp error:',e);
    }
  }finally{
    // Always hide skeleton — even if something above threw
    _hideSkeleton();
  }
  // 4. Run housekeeping AFTER first paint (deferred so render is not blocked)
  if(D.clients&&D.clients.length&&hasData()){
    setTimeout(function(){
      try{processRecurring();}catch(e){console.error('[clarity] processRecurring:',e);}
      // Re-render to pick up any new recurring entries, but only the active panel
      try{if(typeof renderAll==='function')renderAll();}catch(e){}
    },0);
  }
  // 5. One-time notice if any client just had duplicate account codes healed
  if(_ACCT_HEAL_SUMMARIES.length){
    setTimeout(function(){try{_acctHealShowNotice();}catch(e){console.error('[clarity] heal notice:',e);}},300);
  }
}

// ── ACCOUNT-CODE HEAL NOTICE ─────────────────────────────────────────────────
// Shown once, right after healAcctCodeDuplicates() actually changes something
// (see migrateD()). Not blocking — informational, so a bookkeeper never sees
// their Trial Balance change between sessions with no explanation.
function _acctHealShowNotice(){
  if(document.getElementById('m-acct-heal'))return;
  var fmtAmt=function(n){return'$'+Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');};
  var body=_ACCT_HEAL_SUMMARIES.map(function(s){
    var lines='';
    if(s.recoded.length){
      var byCat={};
      s.recoded.forEach(function(r){byCat[r.cat]=(byCat[r.cat]||0)+r.amt;});
      var catRows=Object.keys(byCat).map(function(cat){
        return'<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px"><span>'+escHtml(cat)+'</span><span>'+fmtAmt(byCat[cat])+'</span></div>';
      }).join('');
      lines+='<div style="margin-bottom:.5rem"><div style="font-size:12px;color:var(--muted);margin-bottom:.25rem">'+s.recoded.length+' transaction(s) were mis-filed under a duplicate account code — moved to their correct category:</div>'+catRows+'</div>';
    }
    if(s.newlyPostedCount){
      lines+='<div style="font-size:12px;color:var(--text)"><i class="fas fa-circle-info"></i> '+s.newlyPostedCount+' expense(s) totaling '+fmtAmt(s.newlyPostedTotal)+' had never been added to your books (saved before records had permanent IDs) — they\'ve now been posted.</div>';
    }
    if(s.donationsBackfilled){
      lines+='<div style="font-size:12px;color:var(--text);margin-top:.4rem"><i class="fas fa-circle-info"></i> '+s.donationsBackfilled+' donation(s) totaling '+fmtAmt(s.donationsBackfilledTotal)+' logged through the Donors tab had never been added to your financial statements (Trial Balance, Balance Sheet, P&amp;L) — they\'ve now been posted to your books. They were already showing correctly in donor reports and thank-you letters.</div>';
    }
    if(s.inkindFundraisingCount){
      lines+='<div style="font-size:12px;color:var(--amber,#b45309);margin-top:.4rem"><i class="fas fa-triangle-exclamation"></i> '+s.inkindFundraisingCount+' existing in-kind expense(s) totaling '+fmtAmt(s.inkindFundraisingTotal)+' are tagged "Fundraising" by default from before this was selectable. Review these on the Functional Expenses report and reclassify any that were actually used for programs or management.</div>';
    }
    if(s.donorLinksCreated){
      lines+='<div style="font-size:12px;color:var(--text);margin-top:.4rem"><i class="fas fa-circle-info"></i> '+s.donorLinksCreated+' donation(s) totaling '+fmtAmt(s.donorLinksCreatedTotal)+' logged through the Income tab were never linked to the Donors tab — added there now, so donor reports, LYBUNT, and thank-you letters see them too.</div>';
    }
    if(s.donorLinksMatched){
      lines+='<div style="font-size:12px;color:var(--text);margin-top:.4rem"><i class="fas fa-circle-info"></i> '+s.donorLinksMatched+' donation(s) logged through the Income tab were matched up to an existing Donors-tab record instead of creating a duplicate.</div>';
    }
    if(s.donorLinksNeedReview){
      var _reviewRows=(s.donorLinksNeedReviewItems||[]).map(function(x){
        return'<div style="display:flex;justify-content:space-between;padding:2px 0 2px 1rem;font-size:11px"><span>'+escHtml(x.name)+(x.date?' — '+escHtml(x.date):'')+'</span><span>'+fmtAmt(x.amt)+'</span></div>';
      }).join('');
      lines+='<div style="font-size:12px;color:var(--amber,#b45309);margin-top:.4rem"><i class="fas fa-triangle-exclamation"></i> '+s.donorLinksNeedReview+' income entr'+(s.donorLinksNeedReview===1?'y':'ies')+' totaling '+fmtAmt(s.donorLinksNeedReviewTotal)+' coded to Individual Donations don\'t match any name already on your Donors tab — could be a specific donor who needs to be added there, or a batch/campaign total that isn\'t tied to one person. Nothing was changed automatically.</div>'
        +_reviewRows
        +'<div style="font-size:11px;color:var(--muted);margin-top:.4rem;padding-left:1rem;line-height:1.6"><strong>To link one:</strong> go to the Income tab, open that entry, set "Link to" (next to Source name) to <strong>Donor</strong>, then save. That creates or links the donor immediately.</div>';
    }
    return'<div style="border:1px solid var(--border);border-radius:10px;padding:.85rem 1rem;margin-bottom:.75rem">'
      +'<div style="font-weight:600;font-size:13px;margin-bottom:.4rem">'+escHtml(s.clientName)+'</div>'
      +lines+'</div>';
  }).join('');
  var div=document.createElement('div');
  div.innerHTML=
    '<div class="overlay open" id="m-acct-heal">'
    +'<div class="modal" style="max-width:520px">'
    +'<div class="m-head"><span class="m-title"><i class="fas fa-wrench"></i> We fixed an account-coding issue</span>'
    +'<button class="m-x" onclick="document.getElementById(\'m-acct-heal\').remove()">&#215;</button></div>'
    +'<div class="m-body">'
    +'<div style="font-size:12px;color:var(--muted);margin-bottom:.85rem">Some categories were sharing the same account code, which mixed unrelated transactions together on your Trial Balance and reports. This has been corrected — nothing was deleted, only recoded to the right place.</div>'
    +body
    +'<div style="display:flex;justify-content:flex-end;margin-top:.5rem">'
    +'<button onclick="document.getElementById(\'m-acct-heal\').remove()" style="padding:8px 18px;border:none;border-radius:7px;background:var(--np);color:#fff;font-size:13px;font-weight:500;cursor:pointer;font-family:\'DM Sans\',sans-serif">Got it</button>'
    +'</div></div></div></div>';
  document.body.appendChild(div.firstChild);
}

// ══════════════════════════════════════════