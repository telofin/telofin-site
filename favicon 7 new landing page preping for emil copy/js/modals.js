// MODALS
// ══════════════════════════════════════════

// STABILITY FIX-3 & FIX-4: closeM() now null-checks the element and always
// resets EI and DONOR_EI regardless of which modal is being closed.
// EI/DONOR_EI must only be set immediately before openM(), never held across renders.
function openM(id){
  var el=g(id);if(el)el.classList.add('open');
  if(id==='m-import'){updateTpl(g('imp-type')?g('imp-type').value:'expenses');_importPending=null;if(g('imp-preview')){g('imp-preview').style.display='none';g('imp-preview').innerHTML='';}if(g('imp-preview-actions'))g('imp-preview-actions').style.display='none';if(g('imp-go-btn'))g('imp-go-btn').style.display='';if(g('imp-file'))g('imp-file').value='';if(g('imp-pdf-file'))g('imp-pdf-file').value='';}
  if(id==='m-proc'){
    var c=gc();var sel=g('proc-grant');if(sel&&c){
      var grants=c.grants||[];
      sel.innerHTML='<option value="">— None —</option>'+grants.map(function(gr){return'<option value="'+escHtml(gr.id)+'">'+escHtml(gr.name)+'</option>';}).join('');
      if(PROC_EI>=0&&c.procurement[PROC_EI])sel.value=c.procurement[PROC_EI].grantId||'';
    }
  }
  // Populate COA dropdowns in transaction modals
  var acctMods={
    'm-exp':{'sel':'e-acct','cat':'e-c','filter':null},
    'm-inc':{'sel':'i-acct','cat':'i-c','filter':'Income'},
    'm-rev':{'sel':'r-acct','cat':'r-c','filter':'Income'},
    'm-peinc':{'sel':'pi-acct','cat':'pi-c','filter':'Income'},
    'm-grant':{'sel':'g-acct','cat':null,'filter':null},
    'm-je':{'sel':'je-acct','cat':null,'filter':null}
    // m-bill intentionally not listed here — bill-acct is populated by the dedicated
    // _billPopulateAcctOptions() (features.js), which groups Asset/Liability/Expense
    // accounts by type. That used to run first and then get silently overwritten by this
    // generic Liability-only populator every time openM('m-bill') fired.
  };
  if(acctMods[id]){
    var c2=gc();var cfg=acctMods[id];var sel2=g(cfg.sel);
    if(sel2&&c2){
      sel2.innerHTML=acctOpts(c2,cfg.filter);
      sel2.onchange=function(){
        var acct=(c2.accounts||[]).find(function(a){return a.code===sel2.value;});
        if(acct&&cfg.cat&&g(cfg.cat))g(cfg.cat).value=acct.cat;
      };
    }
    // Populate project dropdown if projects exist
  var projDropMods=['m-exp','m-inc','m-rev','m-peinc'];
  if(projDropMods.indexOf(id)>=0){
    var c3=gc();var psel=g('e-proj')||g('i-proj')||g('r-proj')||g('pi-proj');
    var pselId=id==='m-exp'?'e-proj':id==='m-inc'?'i-proj':id==='m-rev'?'r-proj':'pi-proj';
    var psel2=g(pselId);
    if(psel2&&c3)psel2.innerHTML=projOpts(c3);
    // Populate bank/CC picker
    var bselId=id==='m-exp'?'e-bank':id==='m-inc'?'i-bank':id==='m-rev'?'r-bank':'pi-bank';
    var bsel2=g(bselId);
    if(bsel2&&c3){
      var banks2=c3.bankAccounts||[];var ccs2=c3.creditCards||[];
      var bsAssets2=(c3.balanceSheet&&c3.balanceSheet.assets||[]);
      var cashAssets2=bsAssets2.filter(function(a){return isCashTypeAccount(a.name);});
      // Also surface COA Asset accounts not yet in bankAccounts — so users who set up
      // accounts via COA don't have to re-add them here
      var bankNames=banks2.map(function(b){return b.name.toLowerCase();});
      var coaAssets=(c3.accounts||[]).filter(function(a){
        return a.type==='Asset'&&a.name.toLowerCase().indexOf('depreciation')<0
          &&!bankNames.some(function(n){return n===a.name.toLowerCase();});
      });
      bsel2.style.display='';
      bsel2.innerHTML='<option value="">— Select account —</option>'
        +banks2.map(function(b){return'<option value="bank:'+b.id+'">'+b.name+'</option>';}).join('')
        +coaAssets.map(function(a){return'<option value="coaasset:'+a.id+'">'+a.name+'</option>';}).join('')
        +ccs2.map(function(cc){return'<option value="cc:'+cc.id+'">'+cc.name+' (CC charge)</option>';}).join('')
        +(cashAssets2.length?cashAssets2.map(function(a){return'<option value="bsasset:'+a.id+'">'+a.name+' (cash asset)</option>';}).join(''):'')
        +'<option value="__addbank__">＋ Add account…</option>';
      // Wire the inline "Add account" option + COA asset auto-promote
      bsel2.onchange=function(){
        if(bsel2.value==='__addbank__'){
          var aname=prompt('Account name (e.g. Checking, Savings, Cash on Hand):');
          if(!aname||!aname.trim()){bsel2.value='';return;}
          aname=aname.trim();
          if(!c3.bankAccounts)c3.bankAccounts=[];
          var newBank={id:uid(),name:aname,type:'bank',last4:''};
          c3.bankAccounts.push(newBank);
          if(!c3.accounts)c3.accounts=[];
          var coaEx=c3.accounts.find(function(a){return a.name===aname&&a.type==='Asset';});
          if(!coaEx){var usedA=c3.accounts.filter(function(a){return a.code.indexOf('1')===0;}).map(function(a){return parseInt(a.code)||0;});var nCode=String(usedA.length?(Math.max.apply(null,usedA)+10):1010);c3.accounts.push({id:uid(),code:nCode,name:aname,type:'Asset',cat:aname});c3.accounts.sort(function(a,b){return a.code.localeCompare(b.code);});}
          sv();
          bsel2.value='bank:'+newBank.id;
          bsel2.onchange=null;
          return;
        }
        if(bsel2.value&&bsel2.value.indexOf('coaasset:')===0){
          // Promote COA asset to bankAccounts so it shows as bank: going forward
          var coaId=bsel2.value.slice(9);
          var coaAcct=(c3.accounts||[]).find(function(a){return a.id===coaId;});
          if(coaAcct){
            if(!c3.bankAccounts)c3.bankAccounts=[];
            var promoted={id:uid(),name:coaAcct.name,type:'bank',last4:''};
            c3.bankAccounts.push(promoted);
            sv();
            bsel2.value='bank:'+promoted.id;
          }
          bsel2.onchange=null;
        }
      };
    }
    // Populate tax jurisdiction dropdown for revenue modal
    if(id==='m-rev'){
      var jurSel2=g('r-taxjur');
      if(jurSel2&&c3){
        var savedJurs=(c3.taxJurisdictions||[]);
        jurSel2.innerHTML='<option value="">No sales tax</option>'
          +savedJurs.map(function(j){
            return'<option value="'+escHtml(j.name)+'" data-rate="'+j.rate+'">'+escHtml(j.name)+' ('+j.rate+'%)</option>';
          }).join('');
      }
    }
  }
    if(cfg.cat){
      // FIX-2: e-c in m-exp is now a select dropdown — skip datalist, handled by populateExpCatDropdown below
      if(id!=='m-exp'){
        var catTypeFilter=cfg.filter||(id==='m-exp'?'Expense':null);
        populateCatSuggestions(cfg.cat,catTypeFilter);
      }
    }
  }
  // FIX-2: Populate expense category dropdown from COA
  if(id==='m-exp'){
    var _ec=g('e-c');
    if(_ec&&_ec.tagName==='SELECT'){
      var _ecCur=_ec.getAttribute('data-pending-val')||_ec.value||'';
      _ec.removeAttribute('data-pending-val');
      populateExpCatDropdown('e-c',_ecCur);
    }
    // Populate grant dropdown for NP expense modal
    var _egid=g('e-gid');
    if(_egid&&_egid.tagName==='SELECT'){
      var _egc=gc();
      var _egrants=(_egc&&_egc.grants||[]).filter(function(gr){return gr.status!=='Closed';});
      _egid.innerHTML='<option value="">— No grant —</option>'+_egrants.map(function(gr){
        return '<option value="'+gr.id+'">'+escHtml(gr.name)+'</option>';
      }).join('');
      // Restore pending grant selection (set before openM was called)
      var _pendingGid=_egid.getAttribute('data-pending-gid');
      if(_pendingGid!==null&&_pendingGid!==undefined){
        _egid.value=_pendingGid;
        _egid.removeAttribute('data-pending-gid');
      } else if(EI>=0&&_egc&&_egc.expenses&&_egc.expenses[EI]&&_egc.expenses[EI].grantId){
        _egid.value=_egc.expenses[EI].grantId;
        var _gpctEl=g('e-gpct');
        if(_gpctEl)_gpctEl.value=_egc.expenses[EI].grantPct!=null?_egc.expenses[EI].grantPct:'';
      }
    }
  }
  // Populate income/revenue category dropdowns from COA
  if(id==='m-inc'){var _ic=g('i-c');if(_ic&&_ic.tagName==='SELECT'){var _icCur=_ic.getAttribute('data-pending-val')||_ic.value||'';_ic.removeAttribute('data-pending-val');populateIncCatDropdown('i-c',_icCur,'Income');
    // Wire: when category = Grant, auto-select matching grant in i-gid
    var _icOrigChange=_ic.onchange;
    _ic.onchange=function(){
      if(_icOrigChange)_icOrigChange.call(this);
      var _gidSel=g('i-gid');var _nc=gc();
      if(_ic.value==='Grant'&&_gidSel&&_nc&&_nc.grants&&_nc.grants.length){
        // If no grant selected yet, highlight the dropdown and flash it
        if(!_gidSel.value){
          _gidSel.style.borderColor='var(--np)';
          _gidSel.style.boxShadow='0 0 0 2px var(--np-bg)';
          setTimeout(function(){_gidSel.style.borderColor='';_gidSel.style.boxShadow='';},2500);
          // Try to auto-select if only one grant exists
          if(_nc.grants.length===1){_gidSel.value=_nc.grants[0].id;}
        }
      }
    };
  }
    // Populate grant dropdown
    var _igid=g('i-gid');if(_igid){var _igc=gc();var _igrants=(_igc&&_igc.grants||[]).filter(function(gr){return gr.status!=='Closed';});_igid.innerHTML='<option value="">— None —</option>'+_igrants.map(function(gr){return'<option value="'+gr.id+'">'+escHtml(gr.name)+'</option>';}).join('');if(EI>=0&&_igc&&_igc.income[EI])_igid.value=_igc.income[EI].grantId||'';}
  }
  if(id==='m-rev'){var _rc=g('r-c');if(_rc&&_rc.tagName==='SELECT'){var _rcCur=_rc.getAttribute('data-pending-val')||_rc.value||'';_rc.removeAttribute('data-pending-val');populateIncCatDropdown('r-c',_rcCur,'Income');};}
  if(id==='m-peinc'){var _pic=g('pi-c');if(_pic&&_pic.tagName==='SELECT'){var _picCur=_pic.getAttribute('data-pending-val')||_pic.value||'';_pic.removeAttribute('data-pending-val');populateIncCatDropdown('pi-c',_picCur,'Income');};}
  // FIX-5: Populate budget category + group dropdowns
  if(id==='m-budget'){
    var _bc=g('b-c'),_bg=g('b-g');
    if(_bc&&_bc.tagName==='SELECT'){var _btType=g('b-t')&&g('b-t').value||'';populateBudgetCatDropdown('b-c',_bc.getAttribute('data-pending-val')||_bc.value||'',_btType);_bc.removeAttribute('data-pending-val');}
    if(_bg&&_bg.tagName==='SELECT'){populateBudgetGroupDropdown('b-g',_bg.getAttribute('data-pending-val')||_bg.value||'');_bg.removeAttribute('data-pending-val');}
    // Always reset Save button to saveBudget — proposed flows override this AFTER openM returns
    var _bsBtn=document.getElementById('budget-sv-btn');
    if(_bsBtn)_bsBtn.onclick=function(){saveBudget();};
  }
  // Populate fund dropdowns for NP modals
  if(id==='m-inc'||id==='m-exp'||id==='m-budget'||id==='m-coa'){
    var cFund=gc();if(cFund&&cFund.type==='np'){
      var fundSelMap={'m-inc':'i-fund','m-exp':'e-f','m-budget':'b-fund','m-coa':'acct-fund'};
      var fsid=fundSelMap[id];var fsel=g(fsid);
      if(fsel&&fsel.tagName==='SELECT'){
        var fcur=fsel.value;
        fsel.innerHTML=fundOpts(fcur,true);
        // Show hint when no funds exist yet
        var hintId=fsid+'-hint';
        var oldHint=document.getElementById(hintId);
        if(oldHint)oldHint.remove();
        if(!(cFund.funds&&cFund.funds.length)){
          var hint=document.createElement('div');
          hint.id=hintId;
          hint.style.cssText='font-size:11px;color:var(--np);margin-top:3px;';
          hint.textContent='No funds yet — go to the Funds tab to add them.';
          if(fsel.parentNode)fsel.parentNode.appendChild(hint);
        }
      }
    }
  }
}

function populateCatSuggestions(inputId,typeFilter){
  var c=gc();if(!c)return;
  var listId=inputId+'-dl';
  var old=document.getElementById(listId);if(old)old.remove();
  var dl=document.createElement('datalist');dl.id=listId;
  var seen={};
  (c.budgetItems||[]).forEach(function(b){
    if(!typeFilter||b.type===typeFilter){if(!seen[b.cat]){seen[b.cat]=1;var o=document.createElement('option');o.value=b.cat;dl.appendChild(o);}}
  });
  (c.accounts||[]).forEach(function(a){
    var t=a.cat||a.name;
    if(!typeFilter||(typeFilter==='Expense'&&a.type==='Expense')||(typeFilter==='Income'&&a.type==='Income')){
      if(!seen[t]){seen[t]=1;var o=document.createElement('option');o.value=t;dl.appendChild(o);}
    }
  });
  var inp=document.getElementById(inputId);
  if(inp&&dl.childNodes.length){document.body.appendChild(dl);inp.setAttribute('list',listId);}
}
function quickNewAcct(selId,defaultType){
  var c=gc();if(!c.accounts)c.accounts=[];
  var name=prompt('New account name:');if(!name||!name.trim())return;
  name=name.trim();
  var type=prompt('Account type (Income / Expense / Asset / Liability / Equity):',defaultType||'Expense');
  if(!type)return;
  type=type.trim();
  var validTypes=['Income','Expense','Asset','Liability','Equity'];
  if(validTypes.indexOf(type)<0)type=defaultType||'Expense';
  // Auto-assign next code
  var prefix={Income:'4',Expense:'5',Asset:'1',Liability:'2',Equity:'3'}[type]||'5';
  var used=c.accounts.filter(function(a){return a.code.indexOf(prefix)=== 0;}).map(function(a){return parseInt(a.code)||0;});
  var code=String(used.length?(Math.max.apply(null,used)+10):parseInt(prefix+'010'));
  var item={id:uid(),code:code,name:name,type:type,cat:name};
  c.accounts.push(item);
  c.accounts.sort(function(a,b){return a.code.localeCompare(b.code);});
  sv();
  // Re-populate the dropdown and select the new account
  var sel=document.getElementById(selId);
  if(sel){sel.innerHTML=acctOpts(c,null);sel.value=code;}
}
// ── FIX-2: Expense category dropdown — pulls from COA (Expense + Income for contra-revenue) ─
// ── SEARCHABLE SELECT ─────────────────────────────────────────────────────
// Injects a live search input above any <select> so users can type to filter.
// Call after populating the select's options.
function makeSearchable(sel){
  if(!sel||!sel.parentNode)return;
  // Remove any existing search input for this select
  var existingId='srch-'+sel.id;
  var old=document.getElementById(existingId);if(old)old.remove();
  var inp=document.createElement('input');
  inp.type='text';inp.id=existingId;inp.placeholder='Type to filter…';
  inp.style.cssText='width:100%;padding:5px 10px;font-size:12px;border:1px solid var(--border);border-bottom:none;border-radius:7px 7px 0 0;background:var(--surface);color:var(--text);font-family:DM Sans,sans-serif;outline:none;box-sizing:border-box;';
  sel.style.borderRadius='0 0 7px 7px';
  sel.parentNode.insertBefore(inp,sel);
  // Store all original options for reset
  var allOptions=Array.from(sel.options).map(function(o){return{value:o.value,text:o.text,selected:o.selected,disabled:o.disabled,group:o.parentElement&&o.parentElement.tagName==='OPTGROUP'?o.parentElement.label:''};});
  inp.oninput=function(){
    var q=inp.value.toLowerCase().trim();
    // Rebuild options filtered by query
    Array.from(sel.options).forEach(function(o){
      if(o.value===''||o.value==='__new__'||o.value==='__addbank__'||o.disabled){o.style.display='';return;}
      var match=o.text.toLowerCase().indexOf(q)>=0;
      o.style.display=match?'':'none';
    });
    // Auto-select first visible non-placeholder match when user types
    if(q){
      for(var i=0;i<sel.options.length;i++){
        var o=sel.options[i];
        if(o.style.display!=='none'&&o.value&&o.value!==''&&o.value!=='__new__'&&o.value!=='__addbank__'&&!o.disabled){
          sel.value=o.value;sel.dispatchEvent(new Event('change'));break;
        }
      }
    }
  };
  inp.onkeydown=function(e){
    // Enter confirms current selection and moves focus to next field
    if(e.key==='Enter'){e.preventDefault();inp.value='';sel.focus();}
    // Escape clears filter
    if(e.key==='Escape'){inp.value='';inp.oninput();}
  };
}

function populateExpCatDropdown(selId,currentVal){
  var sel=document.getElementById(selId);if(!sel||sel.tagName!=='SELECT')return;
  var c=gc();if(!c)return;
  var accts=c.accounts||[];
  // Expense accounts first, then Income (for contra-revenue), grouped
  var expAccts=accts.filter(function(a){return a.type==='Expense';});
  var incAccts=accts.filter(function(a){return a.type==='Income';});
  var html='<option value="">— Select category —</option>';
  if(expAccts.length){
    html+='<optgroup label="── Expense Accounts">';
    expAccts.forEach(function(a){
      var v=a.cat||a.name;
      html+='<option value="'+v+'" data-code="'+a.code+'"'+(v===currentVal?' selected':'')+'>'+a.code+' '+a.name+'</option>';
    });
    html+='</optgroup>';
  }
  if(incAccts.length){
    html+='<optgroup label="── Income / Contra-Revenue">';
    incAccts.forEach(function(a){
      var v=a.cat||a.name;
      html+='<option value="'+v+'" data-code="'+a.code+'"'+(v===currentVal?' selected':'')+'>'+a.code+' '+a.name+'</option>';
    });
    html+='</optgroup>';
  }
  html+='<option value="__new__">＋ New category…</option>';
  sel.innerHTML=html;
  // Sync to e-acct on change
  sel.onchange=function(){
    if(sel.value==='__new__'){
      var name=prompt('New category name:');if(!name||!name.trim()){sel.value=currentVal||'';return;}
      name=name.trim();
      var type=prompt('Type (Expense or Income):','Expense');
      type=(type&&type.trim())||'Expense';
      if(type!=='Income')type='Expense';
      var prefix=type==='Income'?'4':'5';
      var used=c.accounts.filter(function(a){return a.code.indexOf(prefix)===0;}).map(function(a){return parseInt(a.code)||0;});
      var code=String(used.length?(Math.max.apply(null,used)+10):parseInt(prefix+'010'));
      var item={id:uid(),code:code,name:name,type:type,cat:name};
      c.accounts.push(item);c.accounts.sort(function(a,b){return a.code.localeCompare(b.code);});
      sv();
      populateExpCatDropdown(selId,name);sel.value=name;
      var acctSel=g('e-acct');if(acctSel){acctSel.innerHTML=acctOpts(c,null);acctSel.value=code;}
      return;
    }
    // Sync e-acct to match chosen category
    var opt=sel.options[sel.selectedIndex];
    var code=opt?opt.getAttribute('data-code'):'';
    var acctSel=g('e-acct');
    if(acctSel){
      if(code){
        // Category maps to a COA account — select it
        acctSel.value=code;
      } else {
        // No matching COA account — auto-suggest next available expense code
        var _c2=gc();
        if(_c2){
          var _used=(_c2.accounts||[]).filter(function(a){return a.code&&a.code.indexOf('5')===0;}).map(function(a){return parseInt(a.code)||0;});
          var _next=_used.length?(Math.max.apply(null,_used)+10):5010;
          // Add a temporary placeholder option so the user sees the suggestion
          var _existing=Array.from(acctSel.options).find(function(o){return o.value===String(_next);});
          if(!_existing){
            var _ph=document.createElement('option');
            _ph.value=String(_next);
            _ph.textContent='(new) '+_next+' — '+sel.value;
            _ph.setAttribute('data-temp','1');
            acctSel.appendChild(_ph);
          }
          acctSel.value=String(_next);
        }
      }
    }
  };
  // If currentVal not in list, set blank
  if(currentVal&&!Array.from(sel.options).some(function(o){return o.value===currentVal;})){
    var legOpt=document.createElement('option');legOpt.value=currentVal;legOpt.textContent=currentVal+' (legacy)';legOpt.selected=true;
    try{if(sel.options[1])sel.insertBefore(legOpt,sel.options[1]);else sel.appendChild(legOpt);}catch(e){sel.appendChild(legOpt);}
  }
  makeSearchable(sel);
}

// ── FIX-5: Budget category + group dropdowns ─────────────────────────────────
// Option values use "CODE::CATNAME" so duplicate names across Income/Expense are unique.
// saveBudget/saveProposedBudget split on "::" to recover the plain cat name for storage.
function populateBudgetCatDropdown(selId,currentVal,currentType){
  var sel=document.getElementById(selId);if(!sel||sel.tagName!=='SELECT')return;
  var c=gc();if(!c)return;
  var accts=c.accounts||[];
  var expAccts=accts.filter(function(a){return a.type==='Expense';});
  var incAccts=accts.filter(function(a){return a.type==='Income';});
  // Decode currentVal — may be "CODE::CAT" (new format) or plain name (legacy)
  var _cvCode='',_cvCat=currentVal||'';
  if(currentVal&&currentVal.indexOf('::')>=0){var _p=currentVal.split('::');_cvCode=_p[0];_cvCat=_p.slice(1).join('::');}
  function makeVal(a){return a.code+'::'+(a.cat||a.name);}
  function isSelected(a){
    var cat=a.cat||a.name;
    if(_cvCode)return a.code===_cvCode&&cat===_cvCat;
    if(!_cvCat)return false;
    if(cat!==_cvCat)return false;
    return currentType?a.type===currentType:true;
  }
  var html='<option value="">— Select line item —</option>';
  if(expAccts.length){
    html+='<optgroup label="── Expense">';
    expAccts.forEach(function(a){var v=makeVal(a);html+='<option value="'+v+'" data-acct-type="Expense"'+(isSelected(a)?' selected':'')+'>'+a.code+' '+a.name+'</option>';});
    html+='</optgroup>';
  }
  if(incAccts.length){
    html+='<optgroup label="── Income">';
    incAccts.forEach(function(a){var v=makeVal(a);html+='<option value="'+v+'" data-acct-type="Income"'+(isSelected(a)?' selected':'')+'>'+a.code+' '+a.name+'</option>';});
    html+='</optgroup>';
  }
  html+='<option value="__new__">＋ New category…</option>';
  sel.innerHTML=html;
  // Legacy fallback: plain name with no code prefix and nothing selected
  if(_cvCat&&sel.value===''){
    var legOpt=document.createElement('option');legOpt.value=_cvCat;legOpt.textContent=_cvCat+' (existing)';legOpt.selected=true;
    if(sel.options[1])if(sel.options[1])if(sel.options[1])sel.insertBefore(legOpt,sel.options[1]);else sel.appendChild(legOpt);else sel.appendChild(legOpt);else sel.appendChild(legOpt);sel.value=_cvCat;
  }
  function syncType(){
    var opt=sel.options[sel.selectedIndex];
    var acctType=opt&&opt.getAttribute('data-acct-type');
    if(acctType){var bt=g('b-t');if(bt)bt.value=acctType;}
  }
  if(_cvCat)syncType();
  sel.onchange=function(){
    if(sel.value==='__new__'){
      var name=prompt('New category name:');if(!name||!name.trim()){sel.value='';return;}
      name=name.trim();
      var type=g('b-t')?g('b-t').value:'Expense';
      syncBudgetToCOA(c,name,type,type);sv();
      populateBudgetCatDropdown(selId,name,type);
      return;
    }
    syncType();
  };
  makeSearchable(sel);
}

function populateBudgetGroupDropdown(selId,currentVal){
  var sel=document.getElementById(selId);if(!sel||sel.tagName!=='SELECT')return;
  var c=gc();if(!c)return;
  // Always include groups from current budgetItems as the base,
  // then merge in any additional groups already in the proposed draft
  var baseItems=c.budgetItems||[];
  var propItems=BUDGET_VIEW==='proposed'?((c.proposedBudgets||[]).find(function(p){return p.fy===PROPOSED_FY;})||{items:[]}).items:[];
  var allItems=baseItems.concat(propItems);
  var groups=[];
  allItems.forEach(function(b){
    // Backfill missing group — same logic as renderBudgetMultiYear
    var gk=b.group||b.type||'Expense';
    if(gk&&groups.indexOf(gk)<0)groups.push(gk);
  });
  // If still no groups, seed from COA account types as a fallback
  if(!groups.length){
    var hasInc=(c.accounts||[]).some(function(a){return a.type==='Income';});
    var hasExp=(c.accounts||[]).some(function(a){return a.type==='Expense';});
    if(hasInc)groups.push('Income');
    if(hasExp)groups.push('Expense');
  }
  groups.sort();
  var html='<option value="">— Select group —</option>';
  groups.forEach(function(g){html+='<option value="'+g+'"'+(g===currentVal?' selected':'')+'>'+g+'</option>';});
  html+='<option value="__new__">＋ New group…</option>';
  if(currentVal&&groups.indexOf(currentVal)<0&&currentVal!==''){
    var legOpt='<option value="'+currentVal+'" selected>'+currentVal+'</option>';
    html=html.replace('<option value="">— Select group —</option>','<option value="">— Select group —</option>'+legOpt);
  }
  sel.innerHTML=html;
  sel.onchange=function(){
    if(sel.value!=='__new__')return;
    var name=prompt('New group name:');if(!name||!name.trim()){sel.value=currentVal||'';return;}
    sel.innerHTML=sel.innerHTML+'<option value="'+name.trim()+'" selected>'+name.trim()+'</option>';
    sel.value=name.trim();
  };
}

function populateIncCatDropdown(selId,currentVal,typeFilter){
  var sel=document.getElementById(selId);if(!sel||sel.tagName!=='SELECT')return;
  var c=gc();if(!c)return;
  var accts=c.accounts||[];
  var incAccts=accts.filter(function(a){return a.type==='Income';});
  var html='<option value="">— Select category —</option>';
  if(incAccts.length){
    html+='<optgroup label="── Income Accounts">';
    incAccts.forEach(function(a){var v=a.cat||a.name;html+='<option value="'+v+'" data-code="'+a.code+'"'+(v===currentVal?' selected':'')+'>'+a.code+' '+a.name+'</option>';});
    html+='</optgroup>';
  }
  html+='<option value="__new__">＋ New category…</option>';
  sel.innerHTML=html;
  if(currentVal&&!Array.from(sel.options).some(function(o){return o.value===currentVal;})){
    var legOpt=document.createElement('option');legOpt.value=currentVal;legOpt.textContent=currentVal+' (legacy)';legOpt.selected=true;
    try{if(sel.options[1])sel.insertBefore(legOpt,sel.options[1]);else sel.appendChild(legOpt);}catch(e){sel.appendChild(legOpt);}
  }
  sel.onchange=function(){
    if(sel.value!=='__new__')return;
    // Show an inline mini-form below the select instead of a browser prompt
    var existing=sel.parentNode.querySelector('.inc-cat-new-row');
    if(existing){existing.querySelector('input').focus();return;}
    var row=document.createElement('div');
    row.className='inc-cat-new-row';
    row.style.cssText='display:flex;gap:6px;margin-top:6px;align-items:center';
    var inp=document.createElement('input');
    inp.type='text';inp.placeholder='e.g. Ticket Sales, Workshop Fees…';
    inp.style.cssText="flex:1;padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;font-family:'DM Sans',sans-serif;background:var(--surface);color:var(--text)";
    var btn=document.createElement('button');
    btn.textContent='Add';
    btn.style.cssText="padding:7px 14px;background:var(--np);color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:13px;font-family:'DM Sans',sans-serif;white-space:nowrap";
    var cancel=document.createElement('button');
    cancel.textContent='Cancel';
    cancel.style.cssText="padding:7px 10px;background:none;border:1px solid var(--border);border-radius:7px;cursor:pointer;font-size:13px;font-family:'DM Sans',sans-serif;color:var(--muted)";
    function doAdd(){
      var name=inp.value.trim();if(!name){inp.focus();return;}
      var prefix='4';
      var used=(c.accounts||[]).filter(function(a){return a.code&&a.code.indexOf(prefix)===0;}).map(function(a){return parseInt(a.code)||0;});
      var code=String(used.length?(Math.max.apply(null,used)+10):parseInt(prefix+'100'));
      var item={id:uid(),code:code,name:name,type:'Income',cat:name};
      c.accounts.push(item);c.accounts.sort(function(a,b){return(a.code||'').localeCompare(b.code||'');});
      sv();
      if(row.parentNode)row.parentNode.removeChild(row);
      populateIncCatDropdown(selId,name,typeFilter);sel.value=name;
      // Sync acct code selector if present
      var acctSelId=selId==='i-c'?'i-acct':selId==='r-c'?'r-acct':selId==='pi-c'?'pi-acct':null;
      if(acctSelId){var acctSel=g(acctSelId);if(acctSel){acctSel.innerHTML=acctOpts(c,'Income');acctSel.value=code;}}
    }
    btn.onclick=doAdd;
    cancel.onclick=function(){if(row.parentNode)row.parentNode.removeChild(row);sel.value=currentVal||'';};
    inp.onkeydown=function(e){if(e.key==='Enter')doAdd();if(e.key==='Escape')cancel.onclick();};
    row.appendChild(inp);row.appendChild(btn);row.appendChild(cancel);
    sel.parentNode.appendChild(row);
    setTimeout(function(){inp.focus();},50);
  };
  makeSearchable(sel);
}

function closeM(id){
  var el=g(id);
  if(el)el.classList.remove('open');
  // Always reset edit indices — safe to do even when not in an edit flow
  EI=-1;
  DONOR_EI=-1;
  DONATION_EI=-1;
  if(typeof _editItemId!=='undefined')_editItemId=null;
  ['del-exp-btn','del-inc-btn','del-rev-btn'].forEach(function(bid){var b=g(bid);if(b)b.style.display='none';});
}
document.addEventListener('click',function(e){if(e.target.classList.contains('overlay'))closeM(e.target.id);});
function openInstall(){var ua=navigator.userAgent,ios=/iPad|iPhone|iPod/.test(ua)&&!window.MSStream,and=/Android/.test(ua);g('inst-ios').style.display=ios?'block':'none';g('inst-android').style.display=and?'block':'none';g('inst-desk').style.display=(!ios&&!and)?'block':'none';openM('m-install');}
function openFB(){['fb-n','fb-e','fb-m'].forEach(function(id){g(id).value='';});g('fb-ok').style.display='none';openM('m-fb');}
function joinWaitlistWelcome(){
  var email=g('welcome-waitlist-email').value.trim();
  if(!email){alert('Please enter your email.');return;}
  var fd=new FormData();fd.append('email',email);fd.append('message','[Pro Waitlist - Welcome] '+email);
  fetch('https://formspree.io/f/mbdzezpk',{method:'POST',body:fd,headers:{'Accept':'application/json'}})
  .then(function(r){if(r.ok){g('welcome-waitlist-ok').style.display='block';g('welcome-waitlist-email').value='';}else alert('Something went wrong.');})
  .catch(function(){alert('Something went wrong.');});
}
function joinWaitlist(){
  var email=g('waitlist-email').value.trim();
  if(!email){alert('Please enter your email.');return;}
  var btn=document.querySelector('#m-upgrade .go-btn');if(btn){btn.textContent='Joining...';btn.disabled=true;}
  var fd=new FormData();fd.append('email',email);fd.append('message','[Pro Waitlist] '+email);
  fetch('https://formspree.io/f/mbdzezpk',{method:'POST',body:fd,headers:{'Accept':'application/json'}})
  .then(function(r){
    if(btn){btn.textContent='Join the waitlist →';btn.disabled=false;}
    if(r.ok){g('waitlist-ok').style.display='block';g('waitlist-email').value='';setTimeout(function(){closeM('m-upgrade');g('waitlist-ok').style.display='none';},2500);}
    else alert('Something went wrong. Please try again.');
  }).catch(function(){if(btn){btn.textContent='Join the waitlist →';btn.disabled=false;}alert('Something went wrong.');});
}
function sendFB(){
  var msg=g('fb-m').value.trim();if(!msg){alert('Please share your feedback.');return;}
  var btn=document.querySelector('#m-fb .sv-btn');if(!btn)return;btn.textContent='Sending...';btn.disabled=true;
  var fd=new FormData();fd.append('name',g('fb-n').value.trim()||'Anonymous');fd.append('email',g('fb-e').value.trim()||'');fd.append('message',msg);
  fetch('https://formspree.io/f/mbdzezpk',{method:'POST',body:fd,headers:{'Accept':'application/json'}})
  .then(function(r){btn.textContent='Send feedback';btn.disabled=false;if(r.ok){g('fb-ok').style.display='block';setTimeout(function(){closeM('m-fb');},2500);}else alert('Something went wrong.');})
  .catch(function(){btn.textContent='Send feedback';btn.disabled=false;alert('Something went wrong.');});
}
function sendContact(){
  var n=g('ct-n').value.trim(),e=g('ct-e').value.trim(),m=g('ct-m').value.trim();
  if(!n||!e||!m){alert('Please fill in all fields.');return;}
  var btn=document.querySelector('#m-contact .sv-btn');if(!btn)return;btn.textContent='Sending...';btn.disabled=true;
  var fd=new FormData();fd.append('name',n);fd.append('email',e);fd.append('message','[Contact] '+m);
  fetch('https://formspree.io/f/mbdzezpk',{method:'POST',body:fd,headers:{'Accept':'application/json'}})
  .then(function(r){btn.textContent='Send message';btn.disabled=false;if(r.ok){g('ct-ok').style.display='block';setTimeout(function(){closeM('m-contact');g('ct-ok').style.display='none';['ct-n','ct-e','ct-m'].forEach(function(id){g(id).value='';});},2000);}else alert('Something went wrong.');})
  .catch(function(){btn.textContent='Send message';btn.disabled=false;alert('Something went wrong.');});
}
// ── PDF IMPORT FORMAT SWITCHER ────────────────────────────────
function impSwitchFormat(fmt){
  var csvSection=g('imp-csv-section');
  var pdfSection=g('imp-pdf-section');
  var csvTab=g('imp-tab-csv');
  var pdfTab=g('imp-tab-pdf');
  var csvStyle="padding:5px 14px;border:1px solid var(--np);border-radius:7px;background:var(--np);color:#fff;font-size:12px;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:500";
  var inactiveStyle="padding:5px 14px;border:1px solid var(--border);border-radius:7px;background:none;font-size:12px;cursor:pointer;font-family:'DM Sans',sans-serif;color:var(--text)";
  var goBtn=g('imp-go-btn');
  var previewBtn=g('imp-confirm-btn');
  var previewSection=g('imp-preview-actions');
  if(fmt==='pdf'){
    if(csvSection)csvSection.style.display='none';
    if(pdfSection)pdfSection.style.display='block';
    if(csvTab)csvTab.style.cssText=inactiveStyle;
    if(pdfTab)pdfTab.style.cssText=csvStyle.replace('var(--np)','var(--np)');
    if(goBtn)goBtn.style.display='none';
    if(previewSection)previewSection.style.display='none';
    var pi=g('imp-pdf-file');if(pi)pi.value='';
  }else{
    if(csvSection)csvSection.style.display='block';
    if(pdfSection)pdfSection.style.display='none';
    if(csvTab)csvTab.style.cssText=csvStyle;
    if(pdfTab)pdfTab.style.cssText=inactiveStyle;
    if(goBtn)goBtn.style.display='';
  }
}

function impHandlePDF(input){
  var file=input&&input.files&&input.files[0];
  if(!file)return;
  // Close the import modal, hand off to the PDF reader engine
  closeM('m-import');
  setTimeout(function(){
    if(typeof pdfHandleUpload==='function'){
      pdfHandleUpload(file,'bank');
    }else{
      alert('PDF reader not loaded. Make sure pdfreader.js is included.');
    }
  },200);
}

function impSavePDFToVault(input){
  var file=input&&input.files&&input.files[0];
  if(!file)return;
  if(!isSignedIn()){alert('Please sign in to save documents to your vault.');return;}
  var c=gc();if(!c){alert('Please open a client first.');return;}
  closeM('m-import');
  storageUpload(c.id,file).then(function(res){
    if(res.error){alert('Could not save to vault: '+res.error);return;}
    if(!c.documents)c.documents=[];
    c.documents.push({
      id:uid(),name:file.name,category:'Statement',
      path:res.path,size:file.size,mimeType:file.type,
      uploadedAt:new Date().toISOString(),notes:'',linkedTo:''
    });
    sv();
    if(typeof renderDocumentVault==='function')renderDocumentVault(c);
    // Show toast
    var t=document.createElement('div');
    t.style.cssText="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--text);color:var(--surface);padding:10px 18px;border-radius:8px;font-size:13px;z-index:99999;font-family:'DM Sans',sans-serif;box-shadow:0 2px 12px rgba(0,0,0,.2)";
    t.textContent='Saved to document vault.';
    document.body.appendChild(t);
    setTimeout(function(){t.style.transition='opacity .4s';t.style.opacity='0';},2500);
    setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},3000);
  });
}

function updateTpl(type){
  var bn=g('bank-import-note');if(bn)bn.style.display=type==='bank'?'block':'none';
  var l=g('tpl-link');if(!l)return;
  if(type==='bank'){l.style.display='none';}
  else{
    l.style.display='block';
    var labels={expenses:'Expenses',income:'Income / Revenue',budget:'Budget',donors:'Donors',cc:'CC Charges'};
    l.textContent='Download '+(labels[type]||type)+' template';
    l.onclick=function(e){e.preventDefault();dlTpl(type);};
    l.href='#';
  }
  // Bank/CC account selector (show for expenses, income, bank)
  var bankRow=g('imp-bank-row');
  var ccRow=g('imp-cc-row');
  var c=gc();
  if(bankRow&&c){
    var showBank=(type==='expenses'||type==='income'||type==='bank');
    bankRow.style.display=showBank?'block':'none';
    var bsel=g('imp-bank');
    if(bsel){
      var banks=(c.bankAccounts||[]);var ccs=(c.creditCards||[]);
      bsel.innerHTML='<option value="">— Default account —</option>'
        +banks.map(function(b){return'<option value="bank:'+b.id+'">'+b.name+'</option>';}).join('')
        +ccs.map(function(cc){return'<option value="cc:'+cc.id+'">'+cc.name+' (CC)</option>';}).join('');
    }
  }
  if(ccRow&&c){
    ccRow.style.display=type==='cc'?'block':'none';
    var ccsel=g('imp-cc-id');
    if(ccsel){
      ccsel.innerHTML='<option value="">— Select card —</option>'
        +(c.creditCards||[]).map(function(cc){return'<option value="'+cc.id+'">'+cc.name+'</option>';}).join('');
    }
  }
}
function dlTpl(type){
  var cols={
    expenses:[['Date','Payee','Category','Total','Check #','Fund','Account'],['03/15/2026','Staples','Admin',150.00,'5917','General Operating',''],['03/09/2026','Ashley Travers','--Split--',611.00,'5911','','']],
    income:[['Name','Category','Amount','Projected','Date','Fund','Account'],['Spring Gala Tickets','Events',5000,5000,'03/01/2026','General Operating','']],
    budget:[['Group','Line item','Type','Amount'],['Budgeted Income','Membership Dues','Income',2400],['Budgeted Income','Donations','Income',5000],['Operational Expenses','Supplies','Expense',1200]],
    donors:[['Name','Email','Amount','Date','Fund'],['Jane Smith','jane@example.com',500,'03/15/2026','General Operating']],
    payroll:[['Employee','Gross wages','Federal tax','State tax','FICA','Net pay','Pay date','Pay period'],['Jane Smith',5000,620,200,382.50,3797.50,'03/15/2026','03/01-03/15']],
    cc:[['Date','Description','Amount','Category'],['03/15/2026','Amazon - Office Supplies',49.99,'Admin'],['03/16/2026','Zoom Subscription',15.00,'Software']]
  };
  var data=cols[type]||cols.expenses;
  var wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),'Template');
  XLSX.writeFile(wb,type+'-template.xlsx');
}

// ══════════════════════════════════════════
// IMPORT
// ══════════════════════════════════════════
// _importPending holds parsed items ready to commit after user confirms
var _importPending=null;
var _splitQueue=[];// holds --Split-- rows waiting for user categorization
var _splitIdx=0;// current split being reviewed

function doImport(){
  var file=g('imp-file').files[0];if(!file){alert('Please select a file.');return;}
  var type=g('imp-type').value,c=gc();if(!c)return;
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      var rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
      if(!rows.length){alert('No data rows found in file.');return;}
      var type=g('imp-type').value,c=gc();

      // Bank type uses its own review flow — pass through unchanged
      if(type==='bank'){
        var bankRows=[];
        rows.forEach(function(row){
          var keys=Object.keys(row),fk=function(terms){return keys.find(function(k){return terms.some(function(t){return k.toLowerCase().includes(t);});})||keys[0];};
          var amt=Number(row[fk(['amount','amt'])]||0);
          var debitAmt=Number(row[fk(['debit','withdrawal'])]||0);
          var creditAmt=Number(row[fk(['credit','deposit'])]||0);
          var desc=String(row[fk(['desc','description','memo','name','payee'])]||'');
          var date=String(row[fk(['date','posted','transaction date'])]||'');
          if(!desc)return;
          var absAmt=Math.abs(amt)||debitAmt||creditAmt;if(!absAmt)return;
          var isDebit=amt<0||debitAmt>0;
          bankRows.push({desc:desc,date:date,amt:absAmt,isDebit:isDebit,raw:row});
        });
        if(!bankRows.length){alert('No transactions found. Check your CSV has date, description, and amount columns.');return;}
        closeM('m-import');
        openBankReview(bankRows,c);
        return;
      }

      // Donors: validate NP early
      if(type==='donors'&&c.type!=='np'){alert('Donor import is only available for nonprofit clients.');return;}
      // CC: validate card selected early
      if(type==='cc'){var ccSel=g('imp-cc-id')&&g('imp-cc-id').value;if(!ccSel){alert('Please select a credit card for this import.');return;}}

      // Build preview rows — ALL rows, scrollable, editable (writes back to _importPending.rows)
      var previewCols=Object.keys(rows[0]);
      var th=previewCols.map(function(k){return'<th style="padding:4px 8px;white-space:nowrap;text-align:left;border-bottom:2px solid var(--border);font-size:11px;color:var(--muted);background:var(--bg)">'+k+'</th>';}).join('');
      var tb=rows.map(function(row,ri){
        return'<tr>'+previewCols.map(function(k){
          var val=String(row[k]||'');
          return'<td style="padding:2px 4px;border-bottom:1px solid var(--border)">'
            +'<input type="text" value="'+val.replace(/"/g,'&quot;')+'" '
            +'oninput="_importPending&&(_importPending.rows['+ri+'][\''+k.replace(/'/g,"\\'")+'\']=this.value)" '
            +'style="width:100%;min-width:80px;font-size:11px;padding:3px 5px;border:1px solid transparent;border-radius:4px;background:transparent;color:var(--text);font-family:DM Sans,sans-serif" '
            +'onfocus="this.style.borderColor=\'var(--np)\';this.style.background=\'var(--surface)\'" '
            +'onblur="this.style.borderColor=\'transparent\';this.style.background=\'transparent\'">'
            +'</td>';
        }).join('')+'</tr>';
      }).join('');
      g('imp-preview').innerHTML='<div style="padding:6px 8px;font-weight:600;font-size:11px;color:var(--text);display:flex;align-items:center;gap:8px">'
        +'<span>'+rows.length+' row'+(rows.length!==1?'s':'')+' — review &amp; edit before importing:</span>'
        +'<span style="font-size:10px;color:var(--muted);font-weight:400">Click any cell to edit</span></div>'
        +'<div style="overflow:auto;max-height:340px;border:1px solid var(--border);border-radius:8px">'
        +'<table style="width:100%;border-collapse:collapse"><thead><tr style="position:sticky;top:0;z-index:1">'+th+'</tr></thead><tbody>'+tb+'</tbody></table></div>';
      g('imp-preview').style.display='block';
      g('imp-preview-actions').style.display='flex';
      g('imp-go-btn').style.display='none';

      // Stash raw rows + context for confirmImport
      _importPending={rows:rows,type:type,c:c};

    }catch(err){alert('Error reading file. Please use a valid Excel or CSV file.');}
  };
  reader.readAsArrayBuffer(file);
}

function cancelImportPreview(){
  _importPending=null;
  g('imp-preview').style.display='none';
  g('imp-preview-actions').style.display='none';
  g('imp-go-btn').style.display='';
  g('imp-file').value='';
}

// ══════════════════════════════════════════════════════════════════════════════
// SUSPICIOUS ACTIVITY FLAG ENGINE
// Runs at import time — deterministic rule-based, no AI.
// Flags are stored on the transaction as flagged/flagReason/flagSeverity.
// Users can dismiss with a note (stored in audit). Client can add custom terms.
// ══════════════════════════════════════════════════════════════════════════════

// Default red flag terms — never deletable by client, only suppressible
var _DEFAULT_FLAG_TERMS=[
  // Structuring / cash (red)
  {term:'cash withdrawal',severity:'red',reason:'Cash withdrawal'},
  {term:'atm',severity:'red',reason:'ATM withdrawal'},
  {term:'wire transfer',severity:'red',reason:'Wire transfer'},
  {term:'western union',severity:'red',reason:'Wire/money transfer service'},
  {term:'moneygram',severity:'red',reason:'Wire/money transfer service'},
  // Gambling (red)
  {term:'casino',severity:'red',reason:'Gambling — casino'},
  {term:'gambling',severity:'red',reason:'Gambling'},
  {term:'lottery',severity:'red',reason:'Lottery'},
  {term:'betmgm',severity:'red',reason:'Online gambling'},
  {term:'draftkings',severity:'red',reason:'Online gambling'},
  {term:'fanduel',severity:'red',reason:'Online gambling'},
  // Gift cards / prepaid (red)
  {term:'gift card',severity:'red',reason:'Gift card purchase'},
  {term:'prepaid card',severity:'red',reason:'Prepaid card purchase'},
  {term:'vanilla visa',severity:'red',reason:'Prepaid card purchase'},
  {term:'green dot',severity:'red',reason:'Prepaid card purchase'},
  // P2P payments on org accounts (yellow)
  {term:'venmo',severity:'yellow',reason:'P2P payment (Venmo) — verify business purpose'},
  {term:'zelle',severity:'yellow',reason:'P2P payment (Zelle) — verify business purpose'},
  {term:'cash app',severity:'yellow',reason:'P2P payment (Cash App) — verify business purpose'},
  {term:'paypal',severity:'yellow',reason:'PayPal — verify business purpose'},
  // Vague descriptions (yellow)
  {term:'miscellaneous',severity:'yellow',reason:'Vague description — miscellaneous'},
  {term:'various',severity:'yellow',reason:'Vague description — various'},
  {term:'other expense',severity:'yellow',reason:'Vague description — other expense'},
  // Personal retail on org accounts (yellow)
  {term:'walmart',severity:'yellow',reason:'Retail — verify business purpose'},
  {term:'target',severity:'yellow',reason:'Retail — verify business purpose'},
  {term:'amazon',severity:'yellow',reason:'Amazon — verify business purpose'},
  {term:'costco',severity:'yellow',reason:'Wholesale retail — verify business purpose'},
  // Adult (red)
  {term:'adult',severity:'red',reason:'Adult entertainment'},
  {term:'strip club',severity:'red',reason:'Adult entertainment'},
];

function _getFlagThreshold(c){
  return Number((c&&c.flagThreshold)||9999);
}

function checkSuspiciousActivity(c,item,desc,amt){
  // desc: transaction description string, amt: numeric amount
  if(!desc&&!amt)return null;
  var d=(desc||'').toLowerCase();
  var a=Number(amt||0);
  var threshold=_getFlagThreshold(c);

  // 1. Structuring check — at or just under reporting threshold
  if(a>0&&a<=threshold&&a>=(threshold-500)){
    return{flagged:true,flagReason:'Amount of '+fmt(a)+' is at or just under the $'+threshold.toLocaleString()+' reporting threshold — possible structuring',flagSeverity:'red'};
  }
  // 2. Over threshold — large transaction
  if(a>threshold){
    return{flagged:true,flagReason:'Large transaction: '+fmt(a)+' exceeds $'+threshold.toLocaleString()+' threshold',flagSeverity:'red'};
  }

  // 3. Client custom terms (checked first so client can override defaults)
  var customTerms=(c&&c.flagTerms)||[];
  for(var ci=0;ci<customTerms.length;ci++){
    var ct=customTerms[ci];
    if(d.indexOf((ct.term||'').toLowerCase())>=0){
      return{flagged:true,flagReason:ct.reason||('Matched custom term: '+ct.term),flagSeverity:ct.severity||'yellow'};
    }
  }

  // 4. Default terms
  for(var di=0;di<_DEFAULT_FLAG_TERMS.length;di++){
    var dt=_DEFAULT_FLAG_TERMS[di];
    // Check if client has suppressed this default term
    var suppressed=(c&&c.flagSuppressed||[]).indexOf(dt.term)>=0;
    if(!suppressed&&d.indexOf(dt.term)>=0){
      return{flagged:true,flagReason:dt.reason,flagSeverity:dt.severity};
    }
  }
  return null;
}

function applyFlag(item,flagResult){
  if(!flagResult)return item;
  item.flagged=true;
  item.flagReason=flagResult.flagReason;
  item.flagSeverity=flagResult.flagSeverity;
  item.flaggedAt=new Date().toISOString();
  return item;
}

function dismissFlag(type,id){
  var c=gc();if(!c)return;
  var arr=type==='income'?(c.type==='sb'?c.revenue:c.income):c.expenses;
  var item=(arr||[]).find(function(x){return x.id===id;});
  if(!item)return;
  var note=prompt('Add a note for dismissing this flag (optional):');
  if(note===null)return;// cancelled
  item.flagged=false;
  item.flagDismissed=true;
  item.flagDismissedAt=new Date().toISOString();
  item.flagDismissNote=note||'';
  (item.audit=item.audit||[]).push({field:'flag-dismissed',oldValue:item.flagReason||'',newValue:'Dismissed'+(note?' — '+note:''),timestamp:new Date().toISOString()});
  sv();
  if(typeof renderAll==='function')renderAll();
  if(typeof renderFlaggedTransactions==='function')renderFlaggedTransactions(c);
}

function confirmImport(){
  if(!_importPending)return;
  var rows=_importPending.rows,type=_importPending.type,c=_importPending.c;
  var count=0;
  _splitQueue=[];_splitIdx=0;// reset split queue for this import
  rows.forEach(function(row){
    var keys=Object.keys(row),fk=function(terms){return keys.find(function(k){return terms.some(function(t){return k.toLowerCase().includes(t);});})||keys[0];};
    if(type==='expenses'){
      if(!c.expenses)c.expenses=[];
      var ecat=String(row[fk(['cat','category'])]||'Imported');
      // Split rows — queue for post-import categorization
      if(ecat.toLowerCase().indexOf('split')>=0||ecat==='--Split--'){
        var splitDesc=String(row[fk(['desc','description','name','memo','payee'])]||'Imported');
        var splitAmt=Number(row[fk(['amount','amt','total'])]||0);
        var splitDate=fmtDate(String(row[fk(['date'])]||''));
        var splitRef=String(row[fk(['no','number','check','ref','#'])]||'').trim();
        _splitQueue.push({desc:splitDesc,amt:splitAmt,date:splitDate,checkNum:splitRef,lines:[],c:c,bankId:impBankId,ccId:impCcId});
        return;
      }
      var eacct=String(row[fk(['account','acct','coa'])]||'');
      var eacctCode=eacct?lookupAcctByCode(c,eacct)||lookupAcctByCAT(c,eacct,'Expense')||'':'';
      if(eacct&&!eacctCode){eacctCode=quickAddAcctFromImport(c,eacct,'Expense')||'';}
      var impBankVal=g('imp-bank')&&g('imp-bank').value||'';
      var impBankId=impBankVal.indexOf('bank:')=== 0?impBankVal.slice(5):'';
      var impCcId=impBankVal.indexOf('cc:')=== 0?impBankVal.slice(3):'';
      var eref=String(row[fk(['no','number','check','ref','#'])]||'').trim();
      var eitem={id:uid(),desc:String(row[fk(['desc','description','name','memo','payee'])]||'Imported'),cat:ecat,amt:Number(row[fk(['amount','amt','total'])]||0),date:fmtDate(String(row[fk(['date'])]||'')),freq:'One-time',fixed:'Variable',fund:String(row[fk(['fund'])]||''),acctCode:eacctCode,reconciled:false,recurring:'None'};
      if(eref)eitem.checkNum=eref;
      if(impBankId)eitem.bankId=impBankId;if(impCcId)eitem.ccId=impCcId;
      applyFlag(eitem,checkSuspiciousActivity(c,eitem,eitem.desc,eitem.amt));
      c.expenses.push(eitem);
    }
    else if(type==='income'){
      var amt=Number(row[fk(['amount','amt','actual','recv'])]||0),name=String(row[fk(['name','source'])]||'Imported'),cat=String(row[fk(['cat','category'])]||'Imported');
      var iacct=String(row[fk(['account','acct','coa'])]||'');
      var iacctCode=iacct?lookupAcctByCode(c,iacct)||lookupAcctByCAT(c,iacct,'Income')||'':'';
      if(iacct&&!iacctCode){iacctCode=quickAddAcctFromImport(c,iacct,'Income')||'';}
      var impBankVal2=g('imp-bank')&&g('imp-bank').value||'';
      var impBankId2=impBankVal2.indexOf('bank:')=== 0?impBankVal2.slice(5):'';
      if(c.type==='sb'){if(!c.revenue)c.revenue=[];var ri2={id:uid(),name:name,cat:cat,proj:Number(row[fk(['proj'])]||amt),act:amt,conf:'Confirmed',acctCode:iacctCode,recurring:'None'};if(impBankId2)ri2.bankId=impBankId2;applyFlag(ri2,checkSuspiciousActivity(c,ri2,ri2.name,ri2.act));c.revenue.push(ri2);}
      else if(c.type==='np'){if(!c.income)c.income=[];var ni={id:uid(),name:name,cat:cat,proj:Number(row[fk(['proj'])]||amt),recv:amt,status:'Received',acctCode:iacctCode,recurring:'None'};if(impBankId2)ni.bankId=impBankId2;applyFlag(ni,checkSuspiciousActivity(c,ni,ni.name,ni.recv));c.income.push(ni);}
      else{if(!c.income)c.income=[];var pei={id:uid(),name:name,cat:cat,amt:amt,freq:String(row[fk(['freq'])]||'Monthly'),acctCode:iacctCode,recurring:'None'};if(impBankId2)pei.bankId=impBankId2;applyFlag(pei,checkSuspiciousActivity(c,pei,pei.name,pei.amt));c.income.push(pei);}
    }
    else if(type==='cc'){
      var ccSel=g('imp-cc-id')&&g('imp-cc-id').value;
      if(!c.expenses)c.expenses=[];
      var ccDate=fmtDate(String(row[fk(['date','posted','transaction date'])]||''));
      var ccDesc=String(row[fk(['desc','description','memo','name','payee'])]||'Imported');
      var ccAmt=Math.abs(Number(row[fk(['amount','amt','charge','debit'])]||0));
      var ccCat=String(row[fk(['cat','category','type'])]||'Uncategorized');
      if(!ccAmt)return;
      var ccAcct=lookupAcctByCAT(c,ccCat,'Expense')||'';
      var ccItem={id:uid(),desc:ccDesc,cat:ccCat,amt:ccAmt,date:ccDate,acctCode:ccAcct,ccId:ccSel,reconciled:false,recurring:'None',freq:'One-time',fixed:'Variable'};
      applyFlag(ccItem,checkSuspiciousActivity(c,ccItem,ccItem.desc,ccItem.amt));
      c.expenses.push(ccItem);
    }
    else if(type==='donors'){
      if(!c.donors)c.donors=[];
      var dname=String(row[fk(['name','donor','full name','first'])]||'').trim();if(!dname)return;
      var demail=String(row[fk(['email'])]||'').trim();
      var damt=Number(row[fk(['amount','amt','donation','gift'])]||0);
      var ddate=String(row[fk(['date'])]||'').trim();
      var dfund=String(row[fk(['fund','campaign','restriction'])]||'').trim();
      var donor=c.donors.find(function(d){return d.name.toLowerCase()===dname.toLowerCase();});
      if(!donor){donor={id:uid(),name:dname,email:demail,phone:'',address:'',notes:'',donations:[]};c.donors.push(donor);}
      if(damt>0)donor.donations.push({amt:damt,date:ddate,fund:dfund,rec:'No',ty:'No',rst:'Unrestricted',audit:[]});
    }
    else if(type==='budget'){
      if(!c.budgetItems)c.budgetItems=[];
      var bc=String(row[fk(['cat','category','line item','item','name'])]||'').trim();
      var bt=String(row[fk(['type'])]||'').trim();
      var ba=Number(row[fk(['amount','amt','budgeted','budget'])]||0);
      var bg=String(row[fk(['group','section','heading'])]||'').trim();
      if(!bc||!ba)return;
      if(!bt||!['Income','Expense'].includes(bt)){bt=bt.toLowerCase().indexOf('inc')>=0||bt.toLowerCase().indexOf('rev')>=0?'Income':'Expense';}
      if(!bg)bg=bt;
      var ex=c.budgetItems.find(function(b){return b.cat===bc&&b.type===bt;});
      if(ex){ex.amt=ba;ex.group=bg;}else{c.budgetItems.push({cat:bc,type:bt,amt:ba,group:bg});syncBudgetToCOA(c,bc,bt,bg);}
    }
    count++;
  });
  _importPending=null;
  sv();renderAll();
  cancelImportPreview();
  if(_splitQueue.length){
    _splitIdx=0;
    closeM('m-import');
    var ok2=g('imp-ok');if(ok2){ok2.textContent=count+' rows imported. Now categorize '+_splitQueue.length+' split transaction'+(_splitQueue.length!==1?'s':'')+'.';ok2.style.display='block';setTimeout(function(){ok2.style.display='none';},3000);}
    openSplitReview();
  } else {
    var ok=g('imp-ok');ok.textContent=count+' rows imported!';ok.style.display='block';
    setTimeout(function(){closeM('m-import');ok.style.display='none';},2500);
  }
}

// ── SPLIT TRANSACTION REVIEW ─────────────────
function openSplitReview(){
  if(_splitIdx>=_splitQueue.length){
    _splitQueue=[];_splitIdx=0;
    var c=gc();if(c){sv();renderAll();}
    alert('All split transactions categorized!');
    return;
  }
  var sp=_splitQueue[_splitIdx];
  var remaining=_splitQueue.length-_splitIdx;
  var el=g('m-split');
  if(!el){
    var div=document.createElement('div');
    div.className='overlay';div.id='m-split';
    div.innerHTML='<div class="modal" style="max-width:520px"><div class="m-title">Categorize split transaction <span id="split-progress" style="font-size:12px;color:var(--muted)"></span></div>'
    +'<div id="split-info" style="margin-bottom:1rem;padding:.75rem;background:var(--soft);border-radius:8px;font-size:13px"></div>'
    +'<div style="font-size:12px;font-weight:600;margin-bottom:.5rem;color:var(--muted)">Split into categories (must sum to total):</div>'
    +'<div id="split-lines"></div>'
    +'<button class="add-btn" style="margin-bottom:1rem;font-size:12px" onclick="addSplitLine()">+ Add line</button>'
    +'<div id="split-remaining" style="font-size:12px;margin-bottom:.75rem;font-weight:600"></div>'
    +'<div style="display:flex;gap:8px">'
    +'<button class="sv-btn" onclick="saveSplitRow()">Save & next</button>'
    +'<button class="add-btn" onclick="skipSplitRow()" style="font-size:12px">Skip this one</button>'
    +'</div></div>';
    document.body.appendChild(div);
  }
  g('split-progress').textContent='('+(_splitIdx+1)+' of '+_splitQueue.length+')';
  g('split-info').innerHTML='<strong>'+escHtml(sp.desc||'')+'</strong>'
    +(sp.date?' &nbsp;·&nbsp; '+escHtml(sp.date):'')
    +(sp.checkNum?' &nbsp;·&nbsp; Check #'+escHtml(sp.checkNum):'')
    +'<div style="font-size:16px;font-weight:700;color:var(--green);margin-top:.25rem">Total: $'+Number(sp.amt).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</div>';
  // Start with 2 blank lines
  sp.lines=[{cat:'',amt:''}];
  renderSplitLines(sp);
  g('m-split').classList.add('open');
}

function renderSplitLines(sp){
  var linesEl=g('split-lines');if(!linesEl)return;
  linesEl.innerHTML=sp.lines.map(function(line,i){
    return'<div style="display:flex;gap:8px;margin-bottom:.4rem;align-items:center">'
    +'<input type="text" placeholder="Category" value="'+( line.cat||'')+'" oninput="_splitQueue[_splitIdx].lines['+i+'].cat=this.value" style="flex:1;font-size:12px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-family:DM Sans,sans-serif">'
    +'<input type="number" placeholder="0.00" value="'+(line.amt||'')+'" oninput="_splitQueue[_splitIdx].lines['+i+'].amt=this.value;updateSplitRemaining()" style="width:100px;font-size:12px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-family:DM Sans,sans-serif">'
    +(sp.lines.length>1?'<button onclick="_splitQueue[_splitIdx].lines.splice('+i+',1);renderSplitLines(_splitQueue[_splitIdx]);updateSplitRemaining()" style="border:none;background:none;color:var(--red);cursor:pointer;font-size:16px;padding:0 4px">×</button>':'<span style="width:24px"></span>')
    +'</div>';
  }).join('');
  updateSplitRemaining();
}

function addSplitLine(){
  var sp=_splitQueue[_splitIdx];if(!sp)return;
  sp.lines.push({cat:'',amt:''});
  renderSplitLines(sp);
  // Focus new category input
  var inputs=g('split-lines').querySelectorAll('input[type=text]');
  if(inputs.length)inputs[inputs.length-1].focus();
}

function updateSplitRemaining(){
  var sp=_splitQueue[_splitIdx];if(!sp)return;
  var used=sp.lines.reduce(function(s,l){return s+Number(l.amt||0);},0);
  var rem=Number(sp.amt)-used;
  var el=g('split-remaining');if(!el)return;
  var color=Math.abs(rem)<0.01?'var(--green)':rem>0?'var(--amber)':'var(--red)';
  el.style.color=color;
  el.textContent=Math.abs(rem)<0.01?'Fully allocated':'Remaining: $'+Math.abs(rem).toFixed(2)+(rem<0?' (over by $'+Math.abs(rem).toFixed(2)+')':'');
}

function saveSplitRow(){
  var sp=_splitQueue[_splitIdx];if(!sp)return;
  var c=sp.c;if(!c.expenses)c.expenses=[];
  var used=sp.lines.reduce(function(s,l){return s+Number(l.amt||0);},0);
  if(Math.abs(used-Number(sp.amt))>0.02){
    if(!confirm('Lines total $'+used.toFixed(2)+' but the transaction is $'+Number(sp.amt).toFixed(2)+'. Save anyway?'))return;
  }
  var hasLines=sp.lines.filter(function(l){return l.cat&&Number(l.amt||0)>0;});
  if(!hasLines.length){alert('Add at least one category line with an amount.');return;}
  hasLines.forEach(function(line){
    var eitem={id:uid(),desc:sp.desc,cat:line.cat,amt:Number(line.amt),date:sp.date,checkNum:sp.checkNum||'',fund:'',acctCode:lookupAcctByCAT(c,line.cat,'Expense')||'',reconciled:false,recurring:'None',freq:'One-time',fixed:'Variable'};
    if(sp.bankId)eitem.bankId=sp.bankId;
    if(sp.ccId)eitem.ccId=sp.ccId;
    applyFlag(eitem,checkSuspiciousActivity(c,eitem,eitem.desc,eitem.amt));
    c.expenses.push(eitem);
  });
  _splitIdx++;
  g('m-split').classList.remove('open');
  setTimeout(openSplitReview,200);
}

function skipSplitRow(){
  // Import as single uncategorized expense
  var sp=_splitQueue[_splitIdx];if(!sp)return;
  var c=sp.c;if(!c.expenses)c.expenses=[];
  var eitem={id:uid(),desc:sp.desc,cat:'Uncategorized (split)',amt:Number(sp.amt),date:sp.date,checkNum:sp.checkNum||'',fund:'',acctCode:'',reconciled:false,recurring:'None',freq:'One-time',fixed:'Variable'};
  if(sp.bankId)eitem.bankId=sp.bankId;
  applyFlag(eitem,checkSuspiciousActivity(c,eitem,eitem.desc,eitem.amt));
  c.expenses.push(eitem);
  _splitIdx++;
  g('m-split').classList.remove('open');
  setTimeout(openSplitReview,200);
}

// ── BANK IMPORT REVIEW ENGINE ─────────────
var BANK_ROWS=[],BANK_IDX=0,BANK_CLIENT=null;
function applyRule(c,desc){
  var rules=c.importRules||[];
  return rules.find(function(r){return desc.toLowerCase().indexOf(r.keyword.toLowerCase())>=0;});
}
function matchBill(c,desc,amt){
  return(c.bills||[]).find(function(b){return b.status!=='Paid'&&(Math.abs(Number(b.amt)-amt)<0.02)&&(desc.toLowerCase().indexOf((b.vendor||'').toLowerCase())>=0||(b.vendor||'').toLowerCase().indexOf(desc.toLowerCase().split(' ')[0])>=0);});
}
function matchLoan(c,desc){
  var liabAccts=(c.accounts||[]).filter(function(a){return a.type==='Liability';});
  var matchedAcct=liabAccts.find(function(a){return desc.toLowerCase().indexOf(a.name.toLowerCase())>=0||desc.toLowerCase().indexOf((a.cat||'').toLowerCase())>=0;});
  if(!matchedAcct)return null;
  return(c.loans||[]).find(function(l){return desc.toLowerCase().indexOf(l.name.toLowerCase())>=0||(l.acctCode&&l.acctCode===matchedAcct.code);});
}
function openBankReview(rows,c){
  BANK_ROWS=rows;BANK_IDX=0;BANK_CLIENT=c;
  renderBankReviewRow();
  openM('m-bank-review');
}
function renderBankReviewRow(){
  var c=BANK_CLIENT;var rows=BANK_ROWS;
  var remaining=rows.filter(function(r){return!r._done;});
  var el=g('bank-review-body');if(!el)return;
  var prog=g('bank-review-prog');if(prog)prog.textContent=(rows.length-remaining.length)+' of '+rows.length+' categorized';
  if(!remaining.length){
    el.innerHTML='<div style="text-align:center;padding:2rem"><div style="font-size:32px;margin-bottom:.5rem"><i class="fas fa-check"></i></div><div style="font-size:14px;font-weight:500;color:var(--green)">All transactions categorized!</div><button class="go-btn" style="margin-top:1.25rem" onclick="commitBankImport()">Import '+rows.length+' transactions</button></div>';
    return;
  }
  var row=remaining[0];var ri=rows.indexOf(row);
  // Auto-detect
  var rule=applyRule(c,row.desc);
  var billMatch=row.isDebit?matchBill(c,row.desc,row.amt):null;
  var loanMatch=row.isDebit?matchLoan(c,row.desc):null;
  var accts=c.accounts||[];
  var matchedAcct=rule?accts.find(function(a){return a.code===rule.acctCode;}):accts.find(function(a){return row.desc.toLowerCase().indexOf(a.name.toLowerCase())>=0;});
  // Pre-fill suggestion
  if(!row._cat&&rule){row._cat=rule.cat;row._acct=rule.acctCode;row._confirmed=false;}
  else if(!row._cat&&matchedAcct){row._cat=matchedAcct.cat||'';row._acct=matchedAcct.code;row._confirmed=false;}
  var acctOpts='<option value="">— Uncategorized —</option>'+accts.map(function(a){return'<option value="'+a.code+'"'+(row._acct===a.code?' selected':'')+'>'+a.code+' '+a.name+'</option>';}).join('');
  var suggestion=rule?'<span class="badge b-green" style="margin-left:6px">Rule: '+rule.keyword+'</span>':billMatch?'<span class="badge b-amber">Matches bill: '+billMatch.vendor+'</span>':loanMatch?'<span class="badge b-blue">Possible loan payment: '+loanMatch.name+'</span>':'';
  el.innerHTML='<div style="margin-bottom:1.25rem">'
  +'<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:.75rem">'
  +'<div><div style="font-size:15px;font-weight:500">'+row.desc+suggestion+'</div><div style="font-size:12px;color:var(--muted);margin-top:3px">'+(row.date||'No date')+' · <span class="'+(row.isDebit?'vr':'vg')+'">'+(row.isDebit?'-':'+')+''+fmt(row.amt)+'</span></div></div>'
  +'<div style="font-size:11px;color:var(--muted)">'+remaining.length+' remaining</div></div>'
  // Loan payment confirmation
  +(loanMatch&&row.isDebit?'<div style="background:var(--blue-bg);border-radius:8px;padding:.875rem;margin-bottom:.75rem;font-size:13px"><strong>Is this a loan payment?</strong> If yes, interest will be auto-split using the amortization schedule.<div style="display:flex;gap:8px;margin-top:.75rem"><button class="sv-btn" style="background:var(--blue);padding:6px 14px;font-size:12px" onclick="confirmLoanPayment('+ri+',\''+loanMatch.name.replace(/'/g,'')+'\')">Yes — split interest/principal</button><button class="add-btn" onclick="dismissLoan('+ri+')">No — regular expense</button></div></div>':'')
  // Bill match confirmation
  +(billMatch&&row.isDebit?'<div style="background:var(--amber-bg);border-radius:8px;padding:.875rem;margin-bottom:.75rem;font-size:13px"><strong>Matches open bill:</strong> '+billMatch.vendor+' '+fmt(billMatch.amt)+'<div style="display:flex;gap:8px;margin-top:.75rem"><button class="sv-btn" style="background:var(--amber);padding:6px 14px;font-size:12px" onclick="confirmBillMatch('+ri+',\''+billMatch.id+'\')">Yes — mark bill paid</button><button class="add-btn" onclick="dismissBill('+ri+')">No — separate transaction</button></div></div>':'')
  // Category fields
  +'<div class="fr"><div class="fl" style="margin-bottom:0"><label style="font-size:11px;color:var(--muted)">Account (COA)</label><div class="sw" style="width:100%"><select id="br-acct" style="width:100%" onchange="var a=BANK_CLIENT.accounts.find(function(x){return x.code===this.value;}.bind(this));if(a){g(\'br-cat\').value=a.cat||\'\';}BANK_ROWS['+ri+']._acct=this.value;">'+acctOpts+'</select></div></div><div class="fl" style="margin-bottom:0"><label style="font-size:11px;color:var(--muted)">Category</label><input type="text" id="br-cat" value="'+(row._cat||'')+'" placeholder="e.g. Software" oninput="BANK_ROWS['+ri+']._cat=this.value" style="font-size:13px"></div></div>'
  +'<div class="fl" style="margin-top:.75rem;margin-bottom:0"><label style="font-size:11px;color:var(--muted)">Save as rule? (keyword to auto-apply next time)</label><input type="text" id="br-rule" placeholder="e.g. Adobe, Verizon, Chase" style="font-size:13px"></div>'
  +'<div style="display:flex;gap:8px;margin-top:1rem;flex-wrap:wrap">'
  +'<button class="sv-btn" onclick="confirmBankRow('+ri+')">Confirm →</button>'
  +'<button class="add-btn" onclick="skipBankRow('+ri+')">Skip</button>'
  +'<button class="add-btn" onclick="confirmAllRemaining()">Confirm all as uncategorized</button>'
  +'</div></div>';
}
function confirmBankRow(ri){
  var row=BANK_ROWS[ri];
  var cat=g('br-cat')&&g('br-cat').value.trim();
  var acct=g('br-acct')&&g('br-acct').value;
  var ruleKw=g('br-rule')&&g('br-rule').value.trim();
  row._cat=cat||'Uncategorized';row._acct=acct;row._done=true;
  // Save rule if provided
  if(ruleKw&&BANK_CLIENT){
    if(!BANK_CLIENT.importRules)BANK_CLIENT.importRules=[];
    var exists=BANK_CLIENT.importRules.find(function(r){return r.keyword.toLowerCase()===ruleKw.toLowerCase();});
    if(!exists)BANK_CLIENT.importRules.push({keyword:ruleKw,cat:cat,acctCode:acct});
    sv();
  }
  renderBankReviewRow();
}
function skipBankRow(ri){BANK_ROWS[ri]._done=true;BANK_ROWS[ri]._skip=true;renderBankReviewRow();}
function confirmAllRemaining(){BANK_ROWS.forEach(function(r){if(!r._done){r._done=true;r._cat='Uncategorized';r._acct='';}});renderBankReviewRow();}
function confirmLoanPayment(ri,loanName){
  var c=BANK_CLIENT;var row=BANK_ROWS[ri];
  var loan=(c.loans||[]).find(function(l){return l.name===loanName;});
  if(!loan)return;
  var nextNum=(loan.posted||[]).length+1;
  var amort=calcAmort(Number(loan.principal),Number(loan.rate),Number(loan.term));
  var pmtRow=amort.rows[nextNum-1];
  if(pmtRow){
    row._isLoan=true;row._loanName=loanName;row._loanNum=nextNum;
    row._interest=Number(pmtRow.interest.toFixed(2));row._principal=Number(pmtRow.principal.toFixed(2));
    row._cat='Loan Payment';row._acct='2200';
  }
  row._done=true;renderBankReviewRow();
}
function dismissLoan(ri){BANK_ROWS[ri]._loanMatch=null;renderBankReviewRow();}
function confirmBillMatch(ri,billId){
  var row=BANK_ROWS[ri];row._billId=billId;row._done=true;row._cat='Accounts Payable';row._acct='2010';
  renderBankReviewRow();
}
function dismissBill(ri){BANK_ROWS[ri]._billId=null;renderBankReviewRow();}
function commitBankImport(){
  var c=BANK_CLIENT;if(!c)return;
  // FIX-6: Determine which bank account this import is for and stamp bankId on all transactions
  var _importBankId='';
  if(RECON_ACCT&&RECON_ACCT.indexOf('bank:')===0)_importBankId=RECON_ACCT.slice(5);
  var posted=0;
  BANK_ROWS.forEach(function(row){
    if(row._skip)return;
    if(row._isLoan){
      var loan=(c.loans||[]).find(function(l){return l.name===row._loanName;});
      if(!c.expenses)c.expenses=[];
      var lExp={id:uid(),desc:row.desc,cat:'Loan Payment',amt:row.amt,date:row.date,acctCode:'2200',reconciled:true,recurring:'None',freq:'One-time',fixed:'Fixed',notes:'Interest: '+fmt(row._interest)+' | Principal: '+fmt(row._principal)};
      if(_importBankId)lExp.bankId=_importBankId;
      applyFlag(lExp,checkSuspiciousActivity(c,lExp,lExp.desc,lExp.amt));
      c.expenses.push(lExp);
      if(row._interest>0.01){var iExp={id:uid(),desc:'Interest — '+row._loanName+' pmt #'+row._loanNum,cat:'Interest',amt:row._interest,date:row.date,acctCode:'5700',reconciled:true,recurring:'None',freq:'One-time',fixed:'Fixed'};if(_importBankId)iExp.bankId=_importBankId;c.expenses.push(iExp);}
      if(loan){if(!loan.posted)loan.posted=[];loan.posted.push(row._loanNum);}
    }else if(row._billId){
      var bill=(c.bills||[]).find(function(b){return b.id===row._billId;});
      if(bill){bill.status='Paid';bill.paidDate=row.date;}
      if(!c.expenses)c.expenses=[];
      var bExp={id:uid(),desc:row.desc,cat:row._cat||'Accounts Payable',amt:row.amt,date:row.date,acctCode:row._acct||'2010',reconciled:true,recurring:'None',freq:'One-time',fixed:'Variable'};
      if(_importBankId)bExp.bankId=_importBankId;
      applyFlag(bExp,checkSuspiciousActivity(c,bExp,bExp.desc,bExp.amt));
      c.expenses.push(bExp);
    }else if(row.isDebit){
      if(!c.expenses)c.expenses=[];
      var dExp={id:uid(),desc:row.desc,cat:row._cat||'Uncategorized',amt:row.amt,date:row.date,acctCode:row._acct||'',reconciled:true,recurring:'None',freq:'One-time',fixed:'Variable'};
      if(_importBankId)dExp.bankId=_importBankId;
      applyFlag(dExp,checkSuspiciousActivity(c,dExp,dExp.desc,dExp.amt));
      c.expenses.push(dExp);
    }else{
      if(c.type==='sb'){if(!c.revenue)c.revenue=[];var rRev={id:uid(),name:row.desc,cat:row._cat||'Uncategorized',proj:row.amt,act:row.amt,conf:'Confirmed',acctCode:row._acct||'',recurring:'None'};if(_importBankId)rRev.bankId=_importBankId;applyFlag(rRev,checkSuspiciousActivity(c,rRev,rRev.name,rRev.act));c.revenue.push(rRev);}
      else{if(!c.income)c.income=[];var rInc={id:uid(),name:row.desc,cat:row._cat||'Uncategorized',amt:row.amt,recv:row.amt,proj:row.amt,date:row.date,acctCode:row._acct||'',status:'Received',recurring:'None'};if(_importBankId)rInc.bankId=_importBankId;applyFlag(rInc,checkSuspiciousActivity(c,rInc,rInc.name,rInc.recv));c.income.push(rInc);}
    }
    posted++;
    // Check if this matches a payroll net pay — auto-reconcile
    if(row.isDebit){
      var pr=(c.payroll||[]).find(function(p){return!p.reconciled&&Math.abs(Number(p.net)-row.amt)<1;});
      if(pr)pr.reconciled=true;
    }
  });
  sv();renderAll();closeM('m-bank-review');
  alert(posted+' transactions imported successfully.');
}
// ── END BANK IMPORT ENGINE ────────────────

// ══════════════════════════════════════════