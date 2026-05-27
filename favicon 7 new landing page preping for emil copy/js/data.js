
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
// migrateD(): runs all migration steps on D in-place. Safe to call multiple times.
function migrateD(){
  if(!D.clients)D.clients=[];
  // Fix old names & ensure donors array
  var fix={'My nonprofit':'My Nonprofit','My small business':'My Small Business','My personal':'My Personal','New nonprofit':'New Nonprofit','New small business':'New Small Business','New personal':'New Personal'};
  D.clients.forEach(function(c){if(fix[c.name])c.name=fix[c.name];if(!c.donors)c.donors=[];c.donors.forEach(function(d){if(!d.id)d.id=uid();});if(!c.fiscalYearEnd)c.fiscalYearEnd='12/31';if(!c.basisType)c.basisType=defaultBasis(c.type);if(!c.invoices)c.invoices=[];if(!c.journalEntries)c.journalEntries=[];if(!c.balanceSheet)c.balanceSheet={assets:[],liabilities:[],equity:[]};if(!c.reconciliations)c.reconciliations=[];if(!c.procurement)c.procurement=[];if(!c.accounts||!c.accounts.length)c.accounts=getDefaultCOA(c.type);if(!c.bills)c.bills=[];if(!c.loans)c.loans=[];if(!c.importRules)c.importRules=[];if(!c.payroll)c.payroll=[];if(!c.proposedBudget)c.proposedBudget=[];if(!c.adoptedBudgets)c.adoptedBudgets=[];if(!c.proposedBudgets)c.proposedBudgets=[];if(!c.projects)c.projects=[];if(!c.bankAccounts)c.bankAccounts=[];if(!c.creditCards)c.creditCards=[];if(!c.funds)c.funds=[];if(!c.mileage)c.mileage=[];if(!c.fixedAssets)c.fixedAssets=[];
      // Migrate legacy single proposedBudget into proposedBudgets array
      if(c.proposedBudget.length&&!c.proposedBudgets.length){var nextYr='FY '+(new Date().getFullYear()+1);c.proposedBudgets.push({fy:nextYr,items:c.proposedBudget.slice()});c.proposedBudget=[];}
      // Sync all existing budget lines to COA (retroactive)
      (c.budgetItems||[]).forEach(function(b){syncBudgetToCOA(c,b.cat,b.type,b.group||b.type);});
      // Backfill acctCode on existing transactions where blank but category matches COA
      (c.expenses||[]).forEach(function(e){if(!e.acctCode&&e.cat){var code=lookupAcctByCAT(c,e.cat);if(code)e.acctCode=code;}});
      (c.income||[]).forEach(function(r){if(!r.acctCode&&r.cat){var code=lookupAcctByCAT(c,r.cat);if(code)r.acctCode=code;}});
      (c.revenue||[]).forEach(function(r){if(!r.acctCode&&r.cat){var code=lookupAcctByCAT(c,r.cat);if(code)r.acctCode=code;}});
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
      if(!c.ledgerEntries.length)migrateToLedger(c);
    });
  // Deduplicate: remove empty default clients if a data-filled one of same type exists
  var seen={};D.clients=D.clients.filter(function(cl){var k=cl.type;if(seen[k]){var hasD=(cl.income&&cl.income.length)||(cl.expenses&&cl.expenses.length)||(cl.revenue&&cl.revenue.length)||(cl.grants&&cl.grants.length)||(cl.donors&&cl.donors.length);return hasD;}seen[k]=true;return true;});
}

// ── RENDER / ROUTE ──────────────────────────────────────────────────────────
// renderApp(): routes to the right screen based on D state.
// Safe to call multiple times — always shows the correct view.
// migrateToLedger(c): walk all existing transactions and build ledgerEntries[].
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
  (c.income||[]).forEach(function(r){
    if(!r.id||posted[r.id])return;
    if(r.deleted||r.voided||r.isReversal)return;
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
    try{migrateD();}catch(e){
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
}

// ══════════════════════════════════════════