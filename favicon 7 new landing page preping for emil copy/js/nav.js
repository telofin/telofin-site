// NAVIGATION
// ══════════════════════════════════════════
function showWelcome(){g('home').style.display='flex';g('dash').style.display='none';var b=g('sb-home');if(b)b.style.display='none';var sc=g('sb-clients');if(sc)sc.style.display=D.clients&&D.clients.length?'block':'none';hideGlobalSearch();}
function openClient(id){
  var switchingClient=(CID!==id);
  CID=id;var c=gc();if(!c)return;
  g('home').style.display='none';g('dash').style.display='block';
  var b=g('sb-home');if(b)b.style.display='flex';
  var sc=g('sb-clients');if(sc)sc.style.display='block';
  renderSB();renderMobSel();
  g('d-av').textContent=ini(c.name);g('d-av').className='d-av '+avc(c.type);
  g('d-name').textContent=c.name;
  var tag=g('d-tag');tag.textContent=tl(c.type);tag.className='d-tag tag-'+c.type;
  g('d-date').textContent=today();
  var fyeEl=g('d-fye');if(fyeEl)fyeEl.textContent='FY ends '+fyeLabel(c.fiscalYearEnd)+' · '+(c.basisType==='accrual'?'Accrual basis':'Cash basis');
  setTimeout(function(){checkFYEExpiry(c);},500);
  AG=null;CF='all';PROJ_VIEW='summary';
  // Only reset BUDGET_VIEW when switching clients — preserve it within the same client
  if(switchingClient)BUDGET_VIEW='current';
  buildDash(c);updateMobPinBtn();showGlobalSearch();
}

// ══════════════════════════════════════════
// CLIENT MANAGEMENT
// ══════════════════════════════════════════
function pickMode(m){firstMode=m;['np','sb','pe'].forEach(function(x){g('mc-'+x).classList.toggle('sel',x===m);});var b=g('new-basis');if(b)b.value=defaultBasis(m);}
function createClient(){
  var name=g('new-name').value.trim()||'My '+tl(firstMode);
  var c=mkC();c.name=name;c.type=firstMode;
  c.fiscalYearEnd=g('new-fye')?g('new-fye').value||'12/31':'12/31';
  c.basisType=g('new-basis')?g('new-basis').value||defaultBasis(firstMode):defaultBasis(firstMode);
  c.accounts=getDefaultCOA(firstMode);
  D.clients.push(c);sv();renderSB();renderMobSel();openClient(c.id);g('new-name').value='';
  if(typeof showOnboarding==='function')showOnboarding(c.id);
}
function setACMode(m){acMode=m;['np','sb','pe'].forEach(function(x){g('ac-'+x).classList.toggle('sel',x===m);});var b=g('ac-basis');if(b)b.value=defaultBasis(m);var ntr=g('ac-nptype-row');if(ntr)ntr.style.display=(m==='np')?'block':'none';}
function showAddClient(){acMode='np';['np','sb','pe'].forEach(function(x){g('ac-'+x).classList.remove('sel');});g('ac-np').classList.add('sel');g('ac-n').value='';var ntr=g('ac-nptype-row');if(ntr)ntr.style.display='block';openM('m-add-client');}
function addClientModal(){
  var name=g('ac-n').value.trim()||'New '+tl(acMode);
  var c=mkC();c.name=name;c.type=acMode;
  c.fiscalYearEnd=g('ac-fye')?g('ac-fye').value||'12/31':'12/31';
  c.basisType=g('ac-basis')?g('ac-basis').value||defaultBasis(acMode):defaultBasis(acMode);
  if(acMode==='np'){var npt=g('ac-nptype');c.npType=npt?npt.value:'501c3';}
  c.fiscalSponsorships=[];
  c.accounts=getDefaultCOA(acMode);
  D.clients.push(c);sv();renderSB();renderMobSel();openClient(c.id);closeM('m-add-client');
  if(typeof showOnboarding==='function')showOnboarding(c.id);
}
function editName(){var c=gc();if(!c)return;g('rn-v').value=c.name;var fye=g('rn-fye');if(fye)fye.value=c.fiscalYearEnd||'12/31';var basis=g('rn-basis');if(basis)basis.value=c.basisType||'accrual';var tp=g('rn-type');if(tp)tp.value=c.type||'np';var ein=g('rn-ein');if(ein)ein.value=c.ein||'';var rnNpt=g('rn-nptype');var rnNptRow=g('rn-nptype-row');if(rnNpt)rnNpt.value=c.npType||'501c3';if(rnNptRow)rnNptRow.style.display=(c.type==='np')?'block':'none';openM('m-rename');setTimeout(function(){g('rn-v').focus();},100);}
function saveName(){var c=gc();if(!c)return;var n=g('rn-v').value.trim();if(!n)return;c.name=n;var fye=g('rn-fye');if(fye)c.fiscalYearEnd=fye.value;var basis=g('rn-basis');if(basis)c.basisType=basis.value;var tp=g('rn-type');if(tp&&tp.value!==c.type){c.type=tp.value;c.accounts=getDefaultCOA(c.type);}var ein=g('rn-ein');if(ein)c.ein=ein.value.trim();var rnNpt=g('rn-nptype');if(rnNpt&&c.type==='np')c.npType=rnNpt.value;sv();g('d-name').textContent=n;g('d-av').textContent=ini(n);g('d-av').className='d-av '+avc(c.type);var fyeEl=g('d-fye');if(fyeEl)fyeEl.textContent='FY ends '+fyeLabel(c.fiscalYearEnd)+' · '+(c.basisType==='accrual'?'Accrual basis':'Cash basis');var tag=g('d-tag');if(tag){tag.textContent=tl(c.type);tag.className='d-tag tag-'+c.type;}renderSB();renderMobSel();buildDynMods(c.type);renderAll();closeM('m-rename');}
function removeClient(){
  var c=gc();if(!c||!confirm('Remove "'+c.name+'"? Cannot be undone.'))return;
  if(getPinned()===c.id)clearPin();
  D.clients=D.clients.filter(function(x){return x.id!==c.id;});
  sv();renderSB();renderMobSel();
  D.clients.length>0?openClient(D.clients[0].id):showWelcome();
}

// ══════════════════════════════════════════
// SIDEBAR & MOB SELECT
// ══════════════════════════════════════════
function renderSB(){
  var el=g('cl-list'),pin=getPinned();
  if(!D.clients.length){el.innerHTML='<div style="padding:.5rem 1rem;font-size:12px;color:var(--muted)">No clients yet.</div>';return;}
  el.innerHTML=D.clients.map(function(c){
    var ip=c.id===pin;
    return'<div class="client-item'+(c.id===CID?' active':'')+'" onclick="openClient(\''+c.id+'\')">'
      +'<div class="av '+avc(c.type)+'">'+ini(c.name)+'</div>'
      +'<div class="cl-info"><div class="cl-name">'+escHtml(c.name)+(ip?' <span style="font-size:9px;color:var(--amber)"><i class="fas fa-star"></i></span>':'')+'</div><div class="cl-type">'+tl(c.type)+'</div></div>'
      +'<button class="pin-btn'+(ip?' pinned':'')+'" onclick="togglePin(\''+c.id+'\',event)" title="'+(ip?'Remove default':'Set as default')+'">'+(ip?'<i class="fas fa-star"></i>':'<i class="far fa-star"></i>')+'</button></div>'
      +(c.id===CID?'<div style="padding:2px 12px 6px;display:flex;flex-direction:column;gap:3px">'        +'<button onclick="event.stopPropagation();var t=document.querySelector(\'[data-panel=vault]\');if(t)switchTab({target:t},\'vault\')" style="width:100%;text-align:left;background:var(--soft);border:1px solid var(--border);border-radius:6px;padding:5px 10px;font-size:11px;color:var(--muted);cursor:pointer;font-family:\'DM Sans\',sans-serif"><i class="fas fa-paperclip"></i> Document Vault</button>'        +'<button onclick="event.stopPropagation();if(typeof ttOpenFullLog===\'function\')ttOpenFullLog()" style="width:100%;text-align:left;background:var(--soft);border:1px solid var(--border);border-radius:6px;padding:5px 10px;font-size:11px;color:var(--muted);cursor:pointer;font-family:\'DM Sans\',sans-serif"><i class="far fa-clock"></i> Time log'+(c.timeLog&&c.timeLog.length?' ('+c.timeLog.length+')':'')+' </button>'        +'</div>':'');
  }).join('');
}
function renderMobSel(){
  var el=g('mob-cl-sel');if(!el)return;
  var pin=getPinned(),cl=D.clients.slice();
  if(pin)cl.sort(function(a,b){return a.id===pin?-1:b.id===pin?1:0;});
  el.innerHTML=cl.map(function(c){return'<option value="'+escHtml(c.id)+'"'+(c.id===CID?' selected':'')+'>'+escHtml(c.name)+(c.id===pin?' ★':'')+'</option>';}).join('')||'<option>No clients</option>';
}

// ══════════════════════════════════════════
// TABS
// ══════════════════════════════════════════
function getTabs(t){
  if(t==='np')return[['grants','Grants'],['procurement','Procurement'],['donors','Donors'],['funding','Income'],['npexp','Expenses'],['cc','Credit Cards'],['reimbursements','Reimbursements'],['vendors','Vendors'],['budget','Budget'],['deposits','Bank Deposits'],['recon','Reconciliation'],['coa','Accounts'],['gl','General Ledger'],['trialbal','Trial Balance'],['funds','Funds'],['pettycash','Petty Cash'],['openingbal','Opening Balances'],['f990','Form 990'],['importrules','Import Rules'],['flagged','Flagged'],['closedperiods','Closed Periods'],['vault','Vault'],['reports','Reports'],['trash','Deleted']];
  if(t==='sb')return[['revenue','Revenue'],['cashflow','Cash Flow'],['sbexp','Expenses'],['cc','Credit Cards'],['reimbursements','Reimbursements'],['ar','A/R & Invoicing'],['vendors','Vendors'],['customers','Customers'],['jentries','Journal Entries'],['bsheet','Balance Sheet'],['deposits','Bank Deposits'],['recon','Reconciliation'],['budget','Budget'],['coa','Accounts'],['gl','General Ledger'],['trialbal','Trial Balance'],['salestax','Sales Tax'],['pettycash','Petty Cash'],['openingbal','Opening Balances'],['importrules','Import Rules'],['flagged','Flagged'],['closedperiods','Closed Periods'],['vault','Vault'],['reports','Reports'],['trash','Deleted']];
  return[['peinc','Income'],['peexp','Expenses'],['vendors','Vendors'],['budget','Budget'],['coa','Accounts'],['gl','General Ledger'],['trialbal','Trial Balance'],['pettycash','Petty Cash'],['importrules','Import Rules'],['flagged','Flagged'],['closedperiods','Closed Periods'],['vault','Vault'],['reports','Reports'],['trash','Deleted']];
}

// Icon lookup by tab id — kept separate from the label text so labels stay
// plain text (required for <option> elements in the mobile tab selector,
// which cannot render HTML/icon tags). Desktop tab buttons look up the icon
// here and prepend it; the mobile dropdown just uses the plain label.
var TAB_ICONS={
  grants:'fa-landmark',procurement:'fa-clipboard',donors:'fa-handshake',funding:'fa-sack-dollar',
  npexp:'fa-arrow-up-from-bracket',cc:'fa-credit-card',reimbursements:'fa-receipt',vendors:'fa-building',
  budget:'fa-chart-column',recon:'fa-rotate',coa:'fa-book',gl:'fa-book-open',trialbal:'fa-scale-balanced',
  funds:'fa-folder-open',pettycash:'fa-money-bill',openingbal:'fa-lock-open',f990:'fa-file',
  importrules:'fa-gear',flagged:'fa-flag',closedperiods:'fa-lock',vault:'fa-paperclip',reports:'fa-chart-line',
  trash:'fa-trash',revenue:'fa-sack-dollar',cashflow:'fa-money-bill-wave',sbexp:'fa-arrow-up-from-bracket',
  ar:'fa-envelope-open-text',customers:'fa-users',jentries:'fa-pen',bsheet:'fa-building-columns',
  salestax:'fa-receipt',peinc:'fa-sack-dollar',peexp:'fa-arrow-up-from-bracket',bank:'fa-building-columns',waypoint:'fa-anchor'
};
function _tabIconHtml(id){var ic=TAB_ICONS[id];return ic?'<i class="fas '+ic+'"></i> ':'';}

// STABILITY FIX-2: Tab order now keyed by client ID instead of client type.
// Previously 'to-np', 'to-sb', 'to-pe' — all clients of the same type shared
// one tab order. Now keyed as 'to-{clientId}-{type}' so each client is independent.
// Old 'to-np/sb/pe' keys in localStorage are simply orphaned (no migration needed;
// first load for each client falls back to the default tab order).
function getTO(t){try{var s=localStorage.getItem('to-'+CID+'-'+t);if(s)return JSON.parse(s);}catch(e){}return null;}
function saveTO(t,o){try{localStorage.setItem('to-'+CID+'-'+t,JSON.stringify(o));}catch(e){}}

function buildDash(c){
  var tEl=g('tabs'),pEl=g('panels'),ms=g('mob-tab-sel');
  var tabs=getTabs(c.type),saved=getTO(c.type);
  if(saved&&saved.length===tabs.length){var re=[];saved.forEach(function(s){tabs.forEach(function(t){if(t[0]===s)re.push(t);});});if(re.length===tabs.length)tabs=re;}
  // Always open to Waypoint regardless of last visited tab
  var lastTab='waypoint';
  tEl.innerHTML='<span style="font-size:10px;color:var(--muted);padding:0 10px;align-self:center;white-space:nowrap;opacity:.7;pointer-events:none">&#x2194; drag to reorder</span>'+tabs.map(function(t){return'<button class="tab'+(t[0]===lastTab?' active':'')+'" data-panel="'+t[0]+'" onclick="switchTab(event,\''+t[0]+'\')">'+_tabIconHtml(t[0])+t[1]+'</button>';}).join('');
  pEl.innerHTML=tabs.map(function(t){return'<div class="panel'+(t[0]===lastTab?' active':'')+'" id="p-'+t[0]+'"></div>';}).join('');
  ms.innerHTML=tabs.map(function(t){return'<option value="'+t[0]+'"'+(t[0]===lastTab?' selected':'')+'>'+t[1]+'</option>';}).join('');
  buildDynMods(c.type);renderAll();renderHomeWidget();initDrag(c.type,tabs);
  afterSwitch(lastTab);
}
function switchTab(e,panel){
  document.querySelectorAll('#tabs .tab').forEach(function(t){t.classList.remove('active');});
  e.target.classList.add('active');
  document.querySelectorAll('#panels .panel').forEach(function(p){p.classList.remove('active');});
  var t=g('p-'+panel);if(t)t.classList.add('active');
  var ms=g('mob-tab-sel');if(ms)ms.value=panel;
  try{localStorage.setItem('last-tab-'+CID,panel);}catch(e2){}
  CF='all';RST_F='all';DONOR_F='all';
  if(typeof RPT_FILTER_TYPE!=='undefined'){RPT_FILTER_TYPE='';RPT_FILTER_VALUE='';RPT_FILTER_LABEL='';}
  afterSwitch(panel);
}
function switchPanelMob(panel){
  document.querySelectorAll('#tabs .tab').forEach(function(t){t.classList.toggle('active',t.dataset.panel===panel);});
  document.querySelectorAll('#panels .panel').forEach(function(p){p.classList.remove('active');});
  var t=g('p-'+panel);if(t)t.classList.add('active');
  CF='all';RST_F='all';DONOR_F='all';
  if(typeof RPT_FILTER_TYPE!=='undefined'){RPT_FILTER_TYPE='';RPT_FILTER_VALUE='';RPT_FILTER_LABEL='';}
  afterSwitch(panel);
}
function afterSwitch(p){
  if(p==='cc')renderCCTab(gc());
  else if(p==='cashflow')renderCF();
  else if(p==='coa'){renderCOA(gc());}
  else if(p==='gl')renderGL(gc());
  else if(p==='reports')renderReports();else if(p==='funds')renderFundsManager();
  else if(p==='grants')renderGrants();
  else if(p==='procurement')renderProcurement(gc());
  else if(p==='compliance')renderGrantCompliance(gc());
  else if(p==='donors')renderDonors();
  else if(p==='ar')renderAR(gc());
  else if(p==='jentries')renderJournalEntries(gc());
  else if(p==='bsheet')renderBalanceSheet(gc());
  else if(p==='deposits')renderDeposits(gc());
  else if(p==='recon')renderReconciliation(gc());
  else if(p==='trialbal')renderTrialBalance(gc());
  else if(p==='closedperiods')renderClosedPeriods(gc());
  else if(p==='salestax')renderSalesTax(gc());
  else if(p==='vendors')renderVendors(gc());
  else if(p==='reimbursements')renderReimbursements(gc());
  else if(p==='flagged')renderFlaggedTransactions(gc());
  else if(p==='customers')renderCustomers(gc());
  else if(p==='importrules')renderImportRules(gc());
  else if(p==='f990')renderForm990(gc());
  else if(p==='pettycash')renderPettyCash(gc());
  else if(p==='openingbal')renderOpeningBalances(gc());
  else if(p==='trash')renderTrash(gc());
  else if(p==='vault')renderDocumentVault(gc());
}
function goFirstTab(){var f=document.querySelector('#tabs .tab');if(f)switchTab({target:f},f.dataset.panel);}

// ── GLOBAL SEARCH ─────────────────────────────────────────────────────────
function globalSearch(q){
  var wrap=g('global-search-results');if(!wrap)return;
  if(!q||!q.trim()){wrap.style.display='none';return;}
  var c=gc();if(!c){wrap.style.display='none';return;}
  var lq=q.toLowerCase().trim();
  // Normalize for amount matching: strip $, commas, spaces so "10,000" "$10000" "10000" all match
  var lqAmt=lq.replace(/[$,\s]/g,'');
  var isAmtQuery=lqAmt.length>0&&!isNaN(Number(lqAmt))&&Number(lqAmt)>0;
  function amtMatch(val){
    if(!isAmtQuery)return false;
    var n=Number(val||0);
    // Match if formatted amount contains the query string (handles partial like "10,0")
    return fmt(n).replace(/[$,]/g,'').indexOf(lqAmt)>=0||String(n).indexOf(lqAmt)>=0;
  }
  var results=[];

  // Search expenses
  (c.expenses||[]).forEach(function(e,i){
    if(e.deleted)return;
    var _em=(e.desc||'').toLowerCase().indexOf(lq)>=0||(e.cat||'').toLowerCase().indexOf(lq)>=0||(e.vendor1099||'').toLowerCase().indexOf(lq)>=0||(e.checkNum||'').toLowerCase().indexOf(lq)>=0||(e.fund||'').toLowerCase().indexOf(lq)>=0||(e.acctCode||'').toLowerCase().indexOf(lq)>=0||amtMatch(e.amt);
    if(_em){
      results.push({tab:c.type==='np'?'npexp':c.type==='sb'?'sbexp':'peexp',label:e.desc||e.cat,sub:fmt(e.amt)+' · '+(e.date||'')+(e.cat?' · '+e.cat:'')+(e.checkNum?' · #'+e.checkNum:''),icon:'<i class="fas fa-money-bill-wave"></i>',fn:'editItem',args:['expenses',i]});
    }
  });

  // Search income / revenue
  var incArr=c.type==='sb'?c.revenue||[]:c.income||[];
  var incTab=c.type==='sb'?'revenue':c.type==='np'?'funding':'peinc';
  incArr.forEach(function(r,i){
    if(r.deleted)return;
    var name=r.name||r.cat||'';
    var rawAmt=r.recv!==undefined?r.recv:r.act!==undefined?r.act:r.amt;
    var amt=fmt(rawAmt);
    if(name.toLowerCase().indexOf(lq)>=0||(r.cat||'').toLowerCase().indexOf(lq)>=0||amtMatch(rawAmt)){
      results.push({tab:incTab,label:name,sub:amt+(r.cat?' · '+r.cat:''),icon:'<i class="fas fa-sack-dollar"></i>',fn:'editItem',args:[c.type==='sb'?'revenue':'income',i]});
    }
  });

  // Search grants (NP)
  (c.grants||[]).forEach(function(gr,i){
    if((gr.name||'').toLowerCase().indexOf(lq)>=0||(gr.funder||'').toLowerCase().indexOf(lq)>=0||amtMatch(gr.awarded)){
      results.push({tab:'grants',label:gr.name,sub:(gr.funder||'')+(gr.awarded?' · '+fmt(gr.awarded):''),icon:'<i class="fas fa-landmark"></i>',fn:'_srchOpenGrant',args:[gr.id]});
    }
  });

  // Search donors (NP) — also search donation amounts
  (c.donors||[]).forEach(function(d,i){
    var textMatch=(d.name||'').toLowerCase().indexOf(lq)>=0||(d.email||'').toLowerCase().indexOf(lq)>=0||(d.address||'').toLowerCase().indexOf(lq)>=0||(d.phone||'').toLowerCase().indexOf(lq)>=0||(d.notes||'').toLowerCase().indexOf(lq)>=0;
    var amtDonorMatch=isAmtQuery&&(d.donations||[]).some(function(dn){return amtMatch(dn.amt||dn.fmv);});
    if(textMatch||amtDonorMatch){
      results.push({tab:'donors',label:d.name,sub:d.email||'',icon:'<i class="fas fa-user"></i>',fn:'editDonor',args:[i]});
    }
  });

  // Search invoices (SB)
  (c.invoices||[]).forEach(function(inv,i){
    if((inv.client||'').toLowerCase().indexOf(lq)>=0||(inv.desc||'').toLowerCase().indexOf(lq)>=0||(inv.num||'').toLowerCase().indexOf(lq)>=0||amtMatch(inv.amt)){
      results.push({tab:'ar',label:(inv.num||'')+(inv.client?' — '+inv.client:''),sub:fmt(inv.amt)+' · '+inv.status,icon:'<i class="fas fa-receipt"></i>',fn:'editInv',args:[i]});
    }
  });

  // Search COA accounts
  (c.accounts||[]).forEach(function(a){
    if((a.name||'').toLowerCase().indexOf(lq)>=0||(a.code||'').toLowerCase().indexOf(lq)>=0){
      results.push({tab:'coa',label:a.code+' '+a.name,sub:a.type,icon:'<i class="fas fa-clipboard"></i>',fn:'renderCOA',args:[]});
    }
  });

  // Search budget items
  (c.budgetItems||[]).forEach(function(b){
    if((b.cat||'').toLowerCase().indexOf(lq)>=0||amtMatch(b.amt)){
      results.push({tab:'budget',label:b.cat,sub:b.type+' · '+fmt(b.amt),icon:'<i class="fas fa-chart-column"></i>',fn:null,args:[]});
    }
  });

  if(!results.length){
    wrap.style.display='block';
    wrap.innerHTML='<div style="padding:1rem;color:var(--muted);font-size:13px;text-align:center">No results for "'+q+'"</div>';
    return;
  }

  wrap.style.display='block';
  // Group by tab
  var byTab={};
  var tabLabels={npexp:'Expenses',sbexp:'Expenses',peexp:'Expenses',funding:'Income',revenue:'Revenue',peinc:'Income',grants:'Grants',donors:'Donors',ar:'A/R',coa:'Accounts',budget:'Budget'};
  results.slice(0,20).forEach(function(r){
    if(!byTab[r.tab])byTab[r.tab]=[];
    byTab[r.tab].push(r);
  });
  var html='';
  // Store results for event delegation
  wrap._searchResults=results.slice(0,20);
  Object.keys(byTab).forEach(function(tab){
    html+='<div style="padding:6px 12px 2px;font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">'+(tabLabels[tab]||tab)+'</div>';
    byTab[tab].forEach(function(r,ri){
      var idx=results.indexOf(r);
      html+='<div class="srch-result" data-srch-idx="'+idx+'" style="padding:8px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--soft)">'
        +'<span style="font-size:16px">'+r.icon+'</span>'
        +'<div><div style="font-size:13px;font-weight:500">'+escHtml(r.label)+'</div>'
        +(r.sub?'<div style="font-size:11px;color:var(--muted)">'+escHtml(r.sub)+'</div>':'')
        +'</div></div>';
    });
  });
  wrap.innerHTML=html;
  // Hover styles
  wrap.querySelectorAll('.srch-result').forEach(function(el){
    el.addEventListener('mouseenter',function(){el.style.background='var(--soft)';});
    el.addEventListener('mouseleave',function(){el.style.background='';});
  });
}

// Search-result action helper — opens a grant by id and switches to the
// Grants tab's detail view. Exists so the global-search dispatcher below
// can call a real function by name instead of building and executing a
// code string from result data.
function _srchOpenGrant(grantId){AG=grantId;renderGrants();}

// Whitelist of functions the global search dispatcher is allowed to call.
// Search results never carry a code string to execute (see git history —
// this used to be new Function(r.action)(), replaced because building and
// running a JS string from data is a landmine even when today's data
// happens to be safe: the very next new result type added by a future
// developer could interpolate user text into that string without realizing
// the risk). Dispatch now looks up a real function reference by name here
// and calls it directly with structured args — nothing is ever eval'd.
//
// IMPORTANT: this is a whitelist of NAMES (strings), not live function
// references. nav.js loads and runs before saves.js (where editItem is
// defined) — building this object with editItem:editItem would try to
// read the global editItem the instant this line runs, which throws
// "editItem is not defined" since saves.js hasn't executed yet at that
// point. Storing names and resolving via window[name] at actual click
// time (see dispatcher below) sidesteps load-order entirely, since every
// script has finished running long before a user can click a result.
var _SRCH_ACTIONS=['editItem','editDonor','editInv','renderCOA','_srchOpenGrant'];

// Show search bar when a client is open
function showGlobalSearch(){var w=g('global-search-wrap');if(w)w.style.display='block';}
function hideGlobalSearch(){var w=g('global-search-wrap');if(w)w.style.display='none';var r=g('global-search-results');if(r)r.style.display='none';}
// Event delegation for search result clicks
document.addEventListener('click',function(e){
  var wrap=g('global-search-results');
  if(!wrap)return;
  // Close on outside click
  if(!wrap.contains(e.target)&&e.target.id!=='global-search-inp'){wrap.style.display='none';return;}
  // Handle result click
  var row=e.target.closest('.srch-result');
  if(!row||!wrap._searchResults)return;
  var idx=parseInt(row.getAttribute('data-srch-idx'));
  var r=wrap._searchResults[idx];
  if(!r)return;
  // Switch tab
  var tabBtn=document.querySelector('[data-panel="'+r.tab+'"]');
  if(tabBtn)switchTab({target:tabBtn},r.tab);
  // Run action after render settles — name checked against the whitelist
  // above, then resolved to a real function via window[] only now, at
  // click time, when every script has definitely finished loading.
  // Nothing is built or eval'd from a string at any point.
  if(r.fn&&_SRCH_ACTIONS.indexOf(r.fn)>=0){
    var fn=window[r.fn];
    if(typeof fn==='function'){
      setTimeout(function(){try{fn.apply(null,r.args||[]);}catch(e2){console.warn('Search action error:',e2);}},150);
    }
  }
  // Close search
  var inp=g('global-search-inp');if(inp)inp.value='';
  wrap.style.display='none';
});
function goReportsTab(){
  // Activate the reports tab visually
  document.querySelectorAll('#tabs .tab').forEach(function(t){
    t.classList.toggle('active',t.dataset.panel==='reports');
  });
  document.querySelectorAll('#panels .panel').forEach(function(p){p.classList.remove('active');});
  var rp=g('p-reports');if(rp)rp.classList.add('active');
  var ms=g('mob-tab-sel');if(ms)ms.value='reports';
  // Render the reports panel, then switch to Executive Summary
  afterSwitch('reports');
  setTimeout(function(){
    var sel=g('rpt-sel');
    if(sel)sel.value='executive';
    switchRpt('executive');
  },50);
}
function refreshData(){processRecurring();renderAll();var c=gc();if(c)checkFYEExpiry(c);var b=document.querySelector('[onclick="refreshData()"]');if(b){b.textContent='Done';setTimeout(function(){b.textContent='Refresh';},1500);}}
function manualSync(){
  if(!_user){alert('Sign in to sync to cloud.');return;}
  var b=document.querySelector('[onclick="manualSync()"]');
  if(b)b.textContent='Syncing…';
  sv();
  syncToSupabase().then(function(){
    if(b){b.textContent='Saved';setTimeout(function(){b.textContent='Save to cloud';},2000);}
  }).catch(function(){
    if(b){b.textContent='Failed';setTimeout(function(){b.textContent='Save to cloud';},2000);}
  });
}

function initDrag(type,tabs){
  var con=g('tabs'),src=null;
  con.querySelectorAll('.tab').forEach(function(tab){
    tab.setAttribute('draggable','true');
    tab.addEventListener('dragstart',function(e){src=this;this.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
    tab.addEventListener('dragend',function(){this.classList.remove('dragging');con.querySelectorAll('.tab').forEach(function(t){t.classList.remove('drag-over');});});
    tab.addEventListener('dragover',function(e){e.preventDefault();this.classList.add('drag-over');});
    tab.addEventListener('dragleave',function(){this.classList.remove('drag-over');});
    tab.addEventListener('drop',function(e){
      e.stopPropagation();this.classList.remove('drag-over');if(src===this)return;
      var all=Array.from(con.querySelectorAll('.tab')),fi=all.indexOf(src),ti=all.indexOf(this);
      fi<ti?con.insertBefore(src,this.nextSibling):con.insertBefore(src,this);
      var order=Array.from(con.querySelectorAll('.tab')).map(function(t){return t.dataset.panel;});
      saveTO(type,order);
      var ms=g('mob-tab-sel');if(ms)ms.innerHTML=order.map(function(p){var l='';tabs.forEach(function(t){if(t[0]===p)l=t[1];});return'<option value="'+p+'">'+l+'</option>';}).join('');
    });
    // Touch drag
    var tc=null,tSrc=null;
    tab.addEventListener('touchstart',function(e){tSrc=this;tc=this.cloneNode(true);tc.style.cssText='position:fixed;opacity:.7;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:9px 14px;font-size:12px;pointer-events:none;z-index:9999;white-space:nowrap;font-family:DM Sans,sans-serif;color:var(--text);';tc.style.top=e.touches[0].clientY-20+'px';tc.style.left=e.touches[0].clientX-40+'px';document.body.appendChild(tc);tSrc.classList.add('dragging');},{passive:true});
    tab.addEventListener('touchmove',function(e){if(!tc)return;e.preventDefault();var t=e.touches[0];tc.style.top=t.clientY-20+'px';tc.style.left=t.clientX-40+'px';con.querySelectorAll('.tab').forEach(function(x){x.classList.remove('drag-over');});var el=document.elementFromPoint(t.clientX,t.clientY);if(el&&el.classList.contains('tab')&&el!==tSrc)el.classList.add('drag-over');},{passive:false});
    tab.addEventListener('touchend',function(e){if(!tc)return;document.body.removeChild(tc);tc=null;tSrc.classList.remove('dragging');var t=e.changedTouches[0];con.querySelectorAll('.tab').forEach(function(x){x.classList.remove('drag-over');});var el=document.elementFromPoint(t.clientX,t.clientY);if(el&&el.classList.contains('tab')&&el!==tSrc){var all=Array.from(con.querySelectorAll('.tab')),fi=all.indexOf(tSrc),ti=all.indexOf(el);fi<ti?con.insertBefore(tSrc,el.nextSibling):con.insertBefore(tSrc,el);var order=Array.from(con.querySelectorAll('.tab')).map(function(t){return t.dataset.panel;});saveTO(type,order);var ms=g('mob-tab-sel');if(ms)ms.innerHTML=order.map(function(p){var l='';tabs.forEach(function(t){if(t[0]===p)l=t[1];});return'<option value="'+p+'">'+l+'</option>';}).join('');}tSrc=null;});
  });
}

// ══════════════════════════════════════════

// ══════════════════════════════════════════
// KEYBOARD SHORTCUTS
// N = new transaction (context-aware), R = Reports, Esc = close modal
// ══════════════════════════════════════════
document.addEventListener('keydown',function(e){
  // Never fire when typing in an input, textarea, select, or contenteditable
  var tag=(e.target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='textarea'||tag==='select'||e.target.isContentEditable)return;
  // Never fire when a modal is open
  if(document.querySelector('.overlay.open'))return;

  var key=e.key;

  // Esc — close topmost open modal
  if(key==='Escape'){
    var openModals=document.querySelectorAll('.overlay.open');
    if(openModals.length){
      var last=openModals[openModals.length-1];
      if(last&&last.id&&typeof closeM==='function')closeM(last.id);
      e.preventDefault();
    }
    return;
  }

  // Only fire N/R when a client is loaded
  if(!CID)return;
  var cl=gc();if(!cl)return;

  // R — jump to Reports tab
  if(key==='r'||key==='R'){
    if(typeof switchTab==='function')switchTab(null,'reports');
    e.preventDefault();
    return;
  }

  // N — new transaction, context-aware by active tab
  if(key==='n'||key==='N'){
    var activeTab=document.querySelector('#tabs .tab.active');
    var panel=activeTab?activeTab.dataset.panel:'';
    if(cl.type==='np'){
      if(panel==='npexp'){if(typeof openM==='function')openM('m-exp');}
      else if(panel==='donors'){if(typeof openM==='function')openM('m-donation');}
      else if(panel==='grants'){if(typeof openM==='function')openM('m-grant');}
      else{if(typeof openM==='function')openM('m-inc');}// funding + default
    } else if(cl.type==='sb'){
      if(panel==='sbexp'){if(typeof openM==='function')openM('m-exp');}
      else if(panel==='ar'){if(typeof openM==='function')openM('m-inv');}
      else{if(typeof openM==='function')openM('m-rev');}// revenue + default
    } else {
      if(panel==='peexp'){if(typeof openM==='function')openM('m-exp');}
      else{if(typeof openM==='function')openM('m-peinc');}
    }
    e.preventDefault();
    return;
  }
});
