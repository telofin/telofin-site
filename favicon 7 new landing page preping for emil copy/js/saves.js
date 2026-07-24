// ITEM ACTIONS
// ══════════════════════════════════════════
// DEFER: tgAct, delItem, editItem are left as-is.
// editItem() in particular has 15+ branches and is high-risk to refactor.
function reconSaveField(field, val) {
  var c = gc(); if (!c) return;
  var stateKey = 'reconState_' + (typeof RECON_ACCT !== 'undefined' ? RECON_ACCT : 'bank:default');
  if (!c[stateKey]) c[stateKey] = {openBal:0,closeBal:0,periodStart:'',periodEnd:''};
  c[stateKey][field] = val;
  sv();
}

function tgAct(i){var c=gc();c.actions[i].done=!c.actions[i].done;sv();if(c.type==='np')renderNpAct(c);else if(c.type==='sb')renderSbAct(c);else renderPeAct(c);}
function _bankTxnExists(c,txnId){
  if(!txnId)return false;
  var exp=c.expenses||[];
  for(var i=0;i<exp.length;i++){if(exp[i].bankTxnId===txnId&&!exp[i].deleted)return true;}
  var inc=(c.income||[]).concat(c.revenue||[]);
  for(var j=0;j<inc.length;j++){if(inc[j].bankTxnId===txnId&&!inc[j].deleted)return true;}
  return false;
}

function delItem(type,i){
  var c=gc();if(!confirm('Move this item to Recently Deleted? You can restore it within 30 days.'))return;
  var item=c[type]&&c[type][i];if(!item)return;
  // FIX-2: Reverse any balance sheet cash asset delta before removing
  if(item.bsAssetId){
    var reversal=0;
    if(type==='expenses')reversal=Number(item.amt||0);
    else if(type==='income')reversal=-Number(item.recv||item.amt||0);
    else if(type==='revenue')reversal=-Number(item.act||0);
    if(reversal!==0)applyBSAssetDelta(c,item.bsAssetId,reversal);
  }
  item.deleted=true;item.deletedAt=new Date().toISOString();item.deletedType=type;
  // Post ledger reversals for all ledger entries tied to this item
  if(item.id)voidLedgerEntry(c,item.id);
  // If this income entry was mirrored onto the Donors tab (see _syncIncomeToDonorTab), remove
  // the linked donation record too — otherwise a deleted income entry leaves a stale, phantom
  // donation still inflating donor totals. Known limitation: restoring this item later (within
  // the 30-day window) does not automatically recreate the donation record.
  if(type==='income'&&item.donationRef){
    (c.donors||[]).forEach(function(d){d.donations=(d.donations||[]).filter(function(dn){return dn.incomeRef!==item.id;});});
  }
  sv();
  if(type==='expenses'&&typeof dwUpsertExpense==='function')dwUpsertExpense(c,item);
  else if(type==='income'&&typeof dwUpsertIncome==='function')dwUpsertIncome(c,item);
  else if(type==='revenue'&&typeof dwUpsertRevenue==='function')dwUpsertRevenue(c,item);
  renderAll(true);
}

function restoreItem(type,i){
  var c=gc();var item=c[type]&&c[type][i];if(!item)return;
  // Re-apply balance sheet delta if applicable
  if(item.bsAssetId){
    var reversal=0;
    if(type==='expenses')reversal=-Number(item.amt||0);
    else if(type==='income')reversal=Number(item.recv||item.amt||0);
    else if(type==='revenue')reversal=Number(item.act||0);
    if(reversal!==0)applyBSAssetDelta(c,item.bsAssetId,reversal);
  }
  delete item.deleted;delete item.deletedAt;delete item.deletedType;
  sv();renderAll(true);
}

function purgeItem(type,i){
  var c=gc();if(!confirm('Permanently delete? This cannot be undone.'))return;
  var item=c[type]&&c[type][i];
  if(item&&item.id)voidLedgerEntry(c,item.id);
  c[type].splice(i,1);sv();renderAll(true);
}

function writeBadDebt(i){
  // Write off an unpaid invoice as bad debt expense.
  // Posts: Debit Bad Debt Expense (acct 5800 NP / 5900 SB) / Credit AR (1200)
  var c=gc();if(!c||!c.invoices||!c.invoices[i])return;
  var inv=c.invoices[i];
  if(inv.status==='Paid'){alert('This invoice is already paid — only unpaid invoices can be written off.');return;}
  if(inv.badDebt){alert('This invoice has already been written off.');return;}
  // PERIOD LOCK GUARD
  if(isDateLocked(c,todayNum())){periodLockAlert(c.closedThrough);return;}
  if(!confirm('Write off "'+escHtml(inv.client||'this invoice')+'" ('+fmt(inv.amt)+') as bad debt?\n\nThis will post a Bad Debt Expense entry and mark the invoice as written off. It cannot be undone.'))return;
  // Dedicated account by name (not a hardcoded 5800/5900) — those numeric codes are
  // already taken by "Depreciation" (NP) / "Cost of goods sold" (SB) in the default
  // COA, so every bad debt write-off was silently inflating one of those categories
  // instead of its own line. See healMiscodedOperationalExpenses() (data.js).
  var badDebtCode=_ensureDedicatedCOA(c,'Bad debt expense','Expense','Bad Debt');
  var arCode=_defaultARCode(c);
  var expId=uid();
  var memo='Bad debt write-off — Invoice #'+(inv.num||inv.id)+' ('+(inv.client||'unknown')+')';
  // Post expense entry for reporting
  if(!c.expenses)c.expenses=[];
  var badDebtExpItem={
    id:expId,desc:memo,cat:'Bad Debt',amt:Number(inv.amt||0),
    date:todayNum(),acctCode:badDebtCode,recurring:'None',
    freq:'One-time',fixed:'Variable',reconciled:false,
    audit:[{action:'bad_debt_writeoff',invoiceId:inv.id,at:new Date().toISOString()}]
  };
  c.expenses.push(badDebtExpItem);
  if(typeof dwUpsertExpense==='function')dwUpsertExpense(c,badDebtExpItem);
  // Double-entry: Dr Bad Debt Expense / Cr AR
  postToLedger(c,badDebtCode,arCode,Number(inv.amt||0),memo,'expense',expId);
  // Mark invoice
  inv.status='Written Off';inv.badDebt=true;inv.badDebtDate=todayNum();
  if(typeof dwUpsertInvoice==='function')dwUpsertInvoice(c,inv);
  markDirty('ar','sbexp','reports','bs');
  sv();renderAll(true);
}

function voidItem(type,i){
  var c=gc();var item=c[type]&&c[type][i];if(!item)return;
  if(item.voided){alert('This item is already voided.');return;}
  if(!confirm('Void this entry? A reversal will be created and this item will be excluded from totals.'))return;
  // Mark original as voided
  item.voided=true;item.voidedAt=new Date().toISOString();
  // Reverse the ledger entry for this item
  if(item.id)voidLedgerEntry(c,item.id);
  // Build reversal entry — negative amount, same fields, linked back
  var rev=JSON.parse(JSON.stringify(item));
  rev.id=uid();
  rev.voided=false;rev.voidedAt=undefined;
  rev.isReversal=true;rev.reversalOf=item.id;
  if(type==='expenses'){rev.desc='[Reversal] '+item.desc;rev.amt=-Math.abs(Number(item.amt||0));}
  else if(type==='income'){rev.name='[Reversal] '+item.name;rev.recv=-Math.abs(Number(item.recv||item.amt||0));rev.proj=0;}
  else if(type==='revenue'){rev.name='[Reversal] '+item.name;rev.act=-Math.abs(Number(item.act||0));rev.proj=0;}
  rev.date=new Date().toLocaleDateString('en-US',{month:'2-digit',day:'2-digit',year:'numeric'});
  rev.reconciled=false;rev.audit=[{field:'created',oldValue:'',newValue:'Reversal entry',timestamp:new Date().toISOString()}];
  c[type].push(rev);
  // Reverse BS asset delta if applicable
  if(item.bsAssetId){
    var delta=0;
    if(type==='expenses')delta=Number(item.amt||0);
    else if(type==='income')delta=-Number(item.recv||item.amt||0);
    else if(type==='revenue')delta=-Number(item.act||0);
    if(delta!==0)applyBSAssetDelta(c,item.bsAssetId,delta);
  }
  // Void orphaned inkindRef/auctionRef auto-entries linked to this donation record
  // These are keyed by matching description prefix — mark them voided so totals stay clean
  if(type==='income'&&item.inkindRef){
    // Find the matching inkindRef expense (same desc, inkindRef:true)
    (c.expenses||[]).forEach(function(e){if(e.inkindRef&&e.desc===item.name)e.voided=true;});
  }
  if(type==='expenses'&&item.inkindRef){
    (c.income||[]).forEach(function(r){if(r.inkindRef&&r.name===item.desc)r.voided=true;});
  }
  sv();renderAll(true);
}

function unvoidItem(type,i){
  var c=gc();var item=c[type]&&c[type][i];if(!item||!item.voided)return;
  if(!confirm('Un-void this entry? The reversal entry will be deleted.'))return;
  // Remove the paired reversal entry
  var origId=item.id;
  c[type]=c[type].filter(function(r){return!(r.isReversal&&r.reversalOf===origId);});
  // Re-find item index after filter (index may have shifted)
  var newIdx=c[type].findIndex(function(r){return r.id===origId;});
  if(newIdx>=0){
    delete c[type][newIdx].voided;delete c[type][newIdx].voidedAt;
    var it=c[type][newIdx];
    // Restore orphaned inkindRef auto-entries
    if(type==='income'&&it.inkindRef){
      (c.expenses||[]).forEach(function(e){if(e.inkindRef&&e.desc===it.name)delete e.voided;});
    }
    if(type==='expenses'&&it.inkindRef){
      (c.income||[]).forEach(function(r){if(r.inkindRef&&r.name===it.desc)delete r.voided;});
    }
    // Re-apply BS asset delta
    if(it.bsAssetId){
      var delta2=0;
      if(type==='expenses')delta2=-Number(it.amt||0);
      else if(type==='income')delta2=Number(it.recv||it.amt||0);
      else if(type==='revenue')delta2=Number(it.act||0);
      if(delta2!==0)applyBSAssetDelta(c,it.bsAssetId,delta2);
    }
  }
  sv();renderAll(true);
}

function renderTrash(c){
  var p=g('p-trash');if(!p)return;
  var cutoff=new Date(Date.now()-30*24*60*60*1000).toISOString();
  var all=[];
  ['expenses','income','revenue'].forEach(function(type){
    (c[type]||[]).forEach(function(item,i){
      if(!item.deleted)return;
      // Auto-purge items older than 30 days
      if(item.deletedAt&&item.deletedAt<cutoff){c[type].splice(i,1);return;}
      all.push({item:item,type:type,i:i});
    });
  });
  if(!all.length){p.innerHTML='<div class="card"><p style="color:var(--muted);font-size:13px;text-align:center;padding:1rem">No recently deleted items.</p></div>';return;}
  var rows=all.map(function(r){
    var it=r.item;
    var desc=it.desc||it.name||'—';
    var amt=fmt(it.amt||it.recv||it.act||0);
    var when=it.deletedAt?it.deletedAt.slice(0,10):'—';
    var expires=it.deletedAt?new Date(new Date(it.deletedAt).getTime()+30*24*60*60*1000).toISOString().slice(0,10):'—';
    return'<tr><td>'+desc+'</td><td>'+r.type+'</td><td>'+(it.cat||'—')+'</td><td>'+amt+'</td><td style="color:var(--muted);font-size:11px">'+when+'</td><td style="color:var(--muted);font-size:11px">'+expires+'</td><td><button class="act-btn" onclick="restoreItem(\''+r.type+'\','+r.i+')">Restore</button> <button class="act-btn" style="color:var(--danger)" onclick="purgeItem(\''+r.type+'\','+r.i+')">Delete forever</button></td></tr>';
  }).join('');
  p.innerHTML='<div class="card"><div class="c-head"><span class="c-title">Recently Deleted</span><span style="font-size:12px;color:var(--muted)">Items are permanently deleted after 30 days</span></div><table><thead><tr><th>Description</th><th>Type</th><th>Category</th><th>Amount</th><th>Deleted</th><th>Expires</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}

function editItem(type,i){
  var c=gc();if(!c)return;EI=i;var r=c[type][i];if(typeof _editItemId!=='undefined')_editItemId=r&&r.id||null;
  // Guard: never edit a voided item or a reversal entry — it would corrupt the void/reversal pair
  if(r&&r.voided){alert('This entry has been voided and cannot be edited. Un-void it first if you need to make changes.');return;}
  if(r&&r.isReversal){alert('Reversal entries cannot be edited directly.');return;}
  // Guard: warn before editing a reconciled item — it may affect a closed period
  if(r&&r.reconciled){if(!confirm('This transaction has been reconciled.\n\nEditing it may affect a closed period. Continue?'))return;}
  if(type==='income'){if(c.type==='np'){g('i-n').value=r.name||'';var _ic=g('i-c');if(_ic)_ic.setAttribute('data-pending-val',r.cat||'');var _is=g('i-s');if(_is)_is.value=r.status||'';g('i-p').value=r.proj||'';g('i-r').value=r.recv||'';g('f-rec').value=r.recurring||'None';if(g('f-rec-end'))g('f-rec-end').value=r.recurEndDate||'';if(g('f-rec-count'))g('f-rec-count').value=r.recurCount||'';_toggleRecurOpts(r.recurring||'None');if(g('i-fund'))g('i-fund').value=r.fund||'';if(g('i-dt'))g('i-dt').value=r.date||'';if(g('i-party-type'))g('i-party-type').value=r.partyType||'';var _iacct=g('i-acct');if(_iacct){_iacct.value=r.acctCode||'';setTimeout(function(){if(_iacct.value!==r.acctCode)_iacct.value=r.acctCode||'';},50);}openM('m-inc');var _delIncBtn=g('del-inc-btn');if(_delIncBtn)_delIncBtn.style.display='';var ibank=g('i-bank');if(ibank){if(r.bankId)ibank.value='bank:'+r.bankId;else if(r.bsAssetId)ibank.value='bsasset:'+r.bsAssetId;else ibank.value='';};}else{g('pi-n').value=r.name||'';var _pic=g('pi-c');if(_pic)_pic.setAttribute('data-pending-val',r.cat||'');g('pi-a').value=r.amt||'';g('pi-f').value=r.freq||'Monthly';g('pi-d').value=r.date||'';g('f-rec').value=r.recurring||'None';if(g('f-rec-end'))g('f-rec-end').value=r.recurEndDate||'';if(g('f-rec-count'))g('f-rec-count').value=r.recurCount||'';_toggleRecurOpts(r.recurring||'None');var _piacct=g('pi-acct');if(_piacct){_piacct.value=r.acctCode||'';setTimeout(function(){if(_piacct.value!==r.acctCode)_piacct.value=r.acctCode||'';},50);}openM('m-peinc');}}
  else if(type==='revenue'){g('r-n').value=r.name||'';if(g('r-cust'))g('r-cust').value=r.customerName||'';var _rc=g('r-c');if(_rc)_rc.setAttribute('data-pending-val',r.cat||'');g('r-cf').value=r.conf||'Confirmed';g('r-p').value=r.proj||'';g('r-a').value=r.act||'';g('f-rec').value=r.recurring||'None';if(g('f-rec-end'))g('f-rec-end').value=r.recurEndDate||'';if(g('f-rec-count'))g('f-rec-count').value=r.recurCount||'';_toggleRecurOpts(r.recurring||'None');if(g('r-dt'))g('r-dt').value=r.date||'';if(g('r-taxrate'))g('r-taxrate').value=r.taxRate||0;if(g('r-taxamt'))g('r-taxamt').value=r.taxAmt||'';if(g('r-taxjur'))g('r-taxjur').value=r.taxJurisdiction||'';openM('m-rev');var rbank=g('r-bank');if(rbank){if(r.bankId)rbank.value='bank:'+r.bankId;else if(r.bsAssetId)rbank.value='bsasset:'+r.bsAssetId;else rbank.value='';}}  else if(type==='expenses'){if(c.type==='np'){g('e-d').value=r.desc||'';var _ec1=g('e-c');if(_ec1)_ec1.setAttribute('data-pending-val',r.cat||'');g('e-a').value=r.amt||'';g('e-dt').value=r.date||'';g('e-f').value=r.fund||'';var _990El=g('e-990line');if(_990El)_990El.value=r.line990||'';var _egidEl=g('e-gid');if(_egidEl)_egidEl.setAttribute('data-pending-gid',r.grantId||'');var _egpctEl2=g('e-gpct');if(_egpctEl2)_egpctEl2.value=r.grantPct!=null?r.grantPct:'';g('f-rec').value=r.recurring||'None';if(g('f-rec-end'))g('f-rec-end').value=r.recurEndDate||'';if(g('f-rec-count'))g('f-rec-count').value=r.recurCount||'';_toggleRecurOpts(r.recurring||'None');if(g('e-ref'))g('e-ref').value=r.checkNum||'';if(g('e-func'))g('e-func').value=r.functional||'';if(g('e-url'))g('e-url').value=r.receiptUrl||'';if(g('e-tin'))g('e-tin').value=r.tin1099||'';if(g('e-vendor'))g('e-vendor').value=r.vendor1099||r.desc||'';if(g('e-1099'))g('e-1099').value=r.is1099?'yes':'';var _eacct=g('e-acct');if(_eacct){_eacct.value=r.acctCode||'';setTimeout(function(){if(_eacct.value!==r.acctCode&&r.acctCode)_eacct.value=r.acctCode||'';},50);}openM('m-exp');var _expTitle=g('m-exp')&&g('m-exp').querySelector('.m-title');if(_expTitle)_expTitle.textContent='Edit expense';var _delExpBtn=g('del-exp-btn');if(_delExpBtn)_delExpBtn.style.display='';var ebank=g('e-bank');if(ebank){
  if(r.bankId){ebank.value='bank:'+r.bankId;
    // If value didn't match any option, try to find by bankName
    if(!ebank.value||ebank.selectedIndex<=0){var _bMatch=c.bankAccounts&&c.bankAccounts.find(function(b){return b.name&&r.bankName&&b.name.toLowerCase()===r.bankName.toLowerCase();});if(_bMatch)ebank.value='bank:'+_bMatch.id;}
  }else if(r.ccId)ebank.value='cc:'+r.ccId;
  else if(r.bsAssetId)ebank.value='bsasset:'+r.bsAssetId;
  else ebank.value='';
};}else if(c.type==='sb'){g('e-d').value=r.desc||'';var _ec2=g('e-c');if(_ec2)_ec2.setAttribute('data-pending-val',r.cat||'');g('e-a').value=r.amt||'';g('e-fr').value=r.freq||'Monthly';g('e-fx').value=r.fixed||'Fixed';var _subcatElSb=g('e-subcat');if(_subcatElSb)_subcatElSb.value=r.subcat||'';g('f-rec').value=r.recurring||'None';if(g('f-rec-end'))g('f-rec-end').value=r.recurEndDate||'';if(g('f-rec-count'))g('f-rec-count').value=r.recurCount||'';_toggleRecurOpts(r.recurring||'None');if(g('e-ref'))g('e-ref').value=r.checkNum||'';if(g('e-url'))g('e-url').value=r.receiptUrl||'';if(g('e-tin'))g('e-tin').value=r.tin1099||'';if(g('e-vendor'))g('e-vendor').value=r.vendor1099||r.desc||'';if(g('e-1099'))g('e-1099').value=r.is1099?'yes':'';var _eacctSb=g('e-acct');if(_eacctSb){_eacctSb.value=r.acctCode||'';setTimeout(function(){if(_eacctSb.value!==r.acctCode&&r.acctCode)_eacctSb.value=r.acctCode||'';},50);}openM('m-exp');var _expTitleSb=g('m-exp')&&g('m-exp').querySelector('.m-title');if(_expTitleSb)_expTitleSb.textContent='Edit expense';var _delExpBtnSb=g('del-exp-btn');if(_delExpBtnSb)_delExpBtnSb.style.display='';var ebankSb=g('e-bank');if(ebankSb){
  if(r.bankId){ebankSb.value='bank:'+r.bankId;
    if(!ebankSb.value||ebankSb.selectedIndex<=0){var _bMatchSb=c.bankAccounts&&c.bankAccounts.find(function(b){return b.name&&r.bankName&&b.name.toLowerCase()===r.bankName.toLowerCase();});if(_bMatchSb)ebankSb.value='bank:'+_bMatchSb.id;}
  }else if(r.ccId)ebankSb.value='cc:'+r.ccId;
  else if(r.bsAssetId)ebankSb.value='bsasset:'+r.bsAssetId;
  else ebankSb.value='';
};}else{g('e-d').value=r.desc||'';var _ec3=g('e-c');if(_ec3)_ec3.setAttribute('data-pending-val',r.cat||'');g('e-a').value=r.amt||'';g('e-fr').value=r.freq||'Monthly';g('e-dt').value=r.date||'';g('f-rec').value=r.recurring||'None';if(g('f-rec-end'))g('f-rec-end').value=r.recurEndDate||'';if(g('f-rec-count'))g('f-rec-count').value=r.recurCount||'';_toggleRecurOpts(r.recurring||'None');if(g('e-ref'))g('e-ref').value=r.checkNum||'';if(g('e-url'))g('e-url').value=r.receiptUrl||'';if(g('e-tin'))g('e-tin').value=r.tin1099||'';if(g('e-vendor'))g('e-vendor').value=r.vendor1099||r.desc||'';if(g('e-1099'))g('e-1099').value=r.is1099?'yes':'';var _eacctPe=g('e-acct');if(_eacctPe){_eacctPe.value=r.acctCode||'';setTimeout(function(){if(_eacctPe.value!==r.acctCode&&r.acctCode)_eacctPe.value=r.acctCode||'';},50);}openM('m-exp');var _expTitlePe=g('m-exp')&&g('m-exp').querySelector('.m-title');if(_expTitlePe)_expTitlePe.textContent='Edit expense';var _delExpBtnPe=g('del-exp-btn');if(_delExpBtnPe)_delExpBtnPe.style.display='';var ebankPe=g('e-bank');if(ebankPe){
  if(r.bankId){ebankPe.value='bank:'+r.bankId;
    if(!ebankPe.value||ebankPe.selectedIndex<=0){var _bMatchPe=c.bankAccounts&&c.bankAccounts.find(function(b){return b.name&&r.bankName&&b.name.toLowerCase()===r.bankName.toLowerCase();});if(_bMatchPe)ebankPe.value='bank:'+_bMatchPe.id;}
  }else if(r.bsAssetId)ebankPe.value='bsasset:'+r.bsAssetId;
  else ebankPe.value='';
}}}
  else if(type==='actions'){g('a-t').value=r.text||'';g('a-d').value=r.due||'';g('a-w').value=r.who||'';g('a-p').value=r.pri||'High';openM('m-act');}
  else if(type==='journal'){g('j-t').value=r.text||'';openM('m-jrn');}
}

// ══════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════
function uploadOrgLogo(input){
  var file=input.files[0];if(!file)return;
  var url=URL.createObjectURL(file);
  var img=new Image();
  img.onload=function(){
    var MAX=200;
    var scale=Math.min(1,MAX/Math.max(img.width,img.height));
    var canvas=document.createElement('canvas');
    canvas.width=Math.round(img.width*scale);
    canvas.height=Math.round(img.height*scale);
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    var c=gc();if(!c)return;
    c.logo=canvas.toDataURL('image/jpeg',0.7);
    URL.revokeObjectURL(url);
    sv();renderReports();
  };
  img.src=url;
}

function getActiveRpt(){var s=g('rpt-sel');return s?s.value:'pl';}

function pdfStyles(){return'<style>*{box-sizing:border-box}body{font-family:Georgia,serif;max-width:740px;margin:36px auto;color:#1a1814;font-size:12.5px;line-height:1.5}h1{font-size:22px;font-weight:400;margin:0 0 2px}h2{font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#8a8880;margin:20px 0 6px;padding-bottom:4px;border-bottom:1px solid #e8e6e0}table{width:100%;border-collapse:collapse;margin-bottom:4px}th{text-align:left;font-size:10px;color:#8a8880;padding:4px;border-bottom:1px solid #e8e6e0;text-transform:uppercase;letter-spacing:.04em}td{padding:5px 4px;border-bottom:1px solid #f0ede6;font-size:12px}.right{text-align:right}.total{font-weight:600;border-top:2px solid #1a1814}.net{font-size:15px;font-weight:700;border-top:2px solid #1a1814;padding:10px 4px}.pos{color:#1D9E75}.neg{color:#c0392b}.badge{display:inline-block;font-size:9px;padding:1px 5px;border-radius:3px;margin-left:4px;font-family:sans-serif}.b-amber{background:#fef3c7;color:#92400e}.footer{margin-top:36px;font-size:10px;color:#8a8880;border-top:1px solid #e8e6e0;padding-top:10px;display:flex;justify-content:space-between}@media print{.no-print{display:none}}</style>';}

function pdfHeader(c){
  var logo=c.logo?'<img src="'+c.logo+'" style="max-height:52px;max-width:180px;object-fit:contain;margin-bottom:6px;display:block" alt="">':"";
  return logo+'<h1>'+escHtml(c.name)+'</h1><p style="color:#8a8880;font-size:11px;margin:0 0 20px">'+tl(c.type)+' &nbsp;·&nbsp; Clarity by Telofin™ &nbsp;·&nbsp; '+today()+(c.fiscalYearEnd?' &nbsp;·&nbsp; FY ends '+fyeLabel(c.fiscalYearEnd):'')+'</p>';
}
function pdfFooter(){var yr=new Date().getFullYear();return'<div class="footer"><span>Generated by Clarity by Telofin™ · telofin.com</span><span>© '+yr+' Telofin™</span></div>'
  +'<div style="margin-top:10px;padding:8px 0;border-top:1px solid #e8e6e0;font-size:9px;color:#aaa;line-height:1.5">'
  +'<strong>IMPORTANT DISCLAIMER:</strong> This report is generated from user-entered data and is provided for informational and internal management purposes only. '
  +'Clarity by Telofin™ is bookkeeping software, not a licensed accounting, tax, legal, or financial advisory service. '
  +'The information contained herein does not constitute professional accounting, tax, or financial advice and should not be relied upon as such. '
  +'Telofin™ makes no representations or warranties, express or implied, regarding the accuracy, completeness, or fitness for any particular purpose of this report. '
  +'All figures should be independently verified by a licensed Certified Public Accountant (CPA) or qualified financial professional before use in tax filings, financial statements, loan applications, grant reports, regulatory submissions, or any other formal purpose. '
  +'By using this software you agree that Telofin™ is not liable for any errors, omissions, or decisions made in reliance on this report.'
  +'</div>';}
function pdfDisclaimer(context){
  var ctx=context||'';
  return'<div style="margin-top:20px;padding:10px 12px;background:#fffbf0;border:1px solid #e8d8a0;border-radius:4px;font-size:9.5px;color:#6b5c00;line-height:1.6">'
    +'<strong>Disclaimer:</strong> This report is for informational purposes only and is based solely on data entered by the user. '
    +(ctx?ctx+' ':'')
    +'It does not constitute professional accounting, tax, or financial advice. '
    +'All figures should be verified by a licensed CPA before use in any tax filing, financial statement, grant report, or regulatory submission. '
    +'Telofin™ is not responsible for errors, omissions, or decisions made in reliance on this report.'
    +'</div>';
}
function pdfPrintBar(){return'<br><div class="no-print" style="display:flex;gap:10px;margin-top:12px"><button onclick="window.print()" style="padding:8px 20px;background:#1a1814;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">Print / Save as PDF</button><button onclick="window.close()" style="padding:8px 18px;background:#fff;color:#1a1814;border:1px solid #e8e6e0;border-radius:6px;cursor:pointer;font-size:13px">← Close</button></div>';}

function openPDF(bodyHtml,c,title){
  var w=window.open('','_blank');
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+escHtml(c.name)+' — '+escHtml(title||'Report')+'</title>'+pdfStyles()+'</head><body>');
  w.document.write(pdfHeader(c));
  w.document.write(bodyHtml);
  w.document.write(pdfFooter()+pdfPrintBar()+'</body></html>');
  w.document.close();
}

function exportExecutiveSummary(){
  var c=gc();if(!c)return;
  var allInc=c.type==='sb'?(c.revenue||[]):(c.income||[]);
  var allExp=c.expenses||[];
  var grants=c.grants||[];
  var projects=c.projects||[];
  var budItems=c.budgetItems||[];
  var invoices=c.invoices||[];
  var bills=c.bills||[];
  var bs=c.balanceSheet||{assets:[],liabilities:[],equity:[]};
  function getAmt(r){return basisInc(c,r);}
  var iT=allInc.reduce(function(s,r){return s+getAmt(r);},0);
  var eT=allExp.reduce(function(s,e){return s+Number(e.amt||0);},0);
  var net=iT-eT;
  var netMargin=iT>0?Math.round((net/iT)*100):null;
  var budgetedInc=budItems.filter(function(b){return b.type==='Income';}).reduce(function(s,b){return s+Number(b.amt||0);},0);
  var budgetedExp=budItems.filter(function(b){return b.type==='Expense';}).reduce(function(s,b){return s+Number(b.amt||0);},0);
  var incVar=budgetedInc>0?Math.round(((iT-budgetedInc)/budgetedInc)*100):null;
  var expVar=budgetedExp>0?Math.round(((eT-budgetedExp)/budgetedExp)*100):null;
  var openInvAmt=invoices.filter(function(i){return i.status!=='Paid';}).reduce(function(s,i){return s+Number(i.amt||0);},0);
  var openBillAmt=bills.filter(function(b){return b.status!=='Paid';}).reduce(function(s,b){return s+Number(b.amt||0);},0);
  // Exclude cash/bank manual entries to avoid double-counting with getCashOnHand
  var totalAssets=bs.assets.reduce(function(s,a){
    var n=(a.name||'').toLowerCase();
    return(n.includes('cash')||n.includes('bank')||n.includes('checking'))?s:s+Number(a.amt||0);
  },0);
  var totalLiab=bs.liabilities.reduce(function(s,l){return s+Number(l.amt||0);},0);
  var cashOnHand=getCashOnHand(c);
  totalAssets+=cashOnHand;
  totalAssets+=(c.invoices||[]).filter(function(i){return i.status!=='Paid';}).reduce(function(s,i){return s+Number(i.amt||0);},0);
  totalLiab+=(c.bills||[]).filter(function(b){return b.status!=='Paid';}).reduce(function(s,b){return s+Number(b.amt||0);},0);
  function fmtN(n){return'$'+Number(Math.round(n)||0).toLocaleString();}

  var body='';
  // P&L
  var incByCat={};allInc.forEach(function(r){var k=r.cat||'Other';if(!incByCat[k])incByCat[k]=0;incByCat[k]+=getAmt(r);});
  var expByCat={};allExp.forEach(function(e){var k=e.cat||'Other';if(!expByCat[k])expByCat[k]=0;expByCat[k]+=Number(e.amt||0);});
  body+='<h2>'+(c.type==='np'?'Income':'Revenue')+'</h2>';
  body+='<table><tr><th>Category</th><th class="right">Amount</th><th>vs Budget</th></tr>';
  Object.keys(incByCat).sort().forEach(function(k){body+='<tr><td>'+k+'</td><td class="right">'+fmtN(incByCat[k])+'</td><td></td></tr>';});
  if(c.type==='np')grants.forEach(function(gr){body+='<tr><td>Grant: '+escHtml(gr.name)+'</td><td class="right">'+fmtN(gr.awarded||0)+'</td><td>'+(gr.funder||'')+'</td></tr>';});
  body+='<tr class="total"><td>Total '+(c.type==='np'?'Income':'Revenue')+'</td><td class="right">'+fmtN(iT)+'</td><td>'+(incVar!==null?'Budgeted: '+fmtN(budgetedInc)+' ('+(incVar>=0?'+':'')+incVar+'%)':'')+'</td></tr></table>';
  body+='<h2>Expenses</h2>';
  body+='<table><tr><th>Category</th><th class="right">Amount</th><th>vs Budget</th></tr>';
  Object.keys(expByCat).sort().forEach(function(k){body+='<tr><td>'+k+'</td><td class="right">'+fmtN(expByCat[k])+'</td><td></td></tr>';});
  body+='<tr class="total"><td>Total Expenses</td><td class="right">'+fmtN(eT)+'</td><td>'+(expVar!==null?'Budgeted: '+fmtN(budgetedExp)+' ('+(expVar>=0?'+':'')+expVar+'%)':'')+'</td></tr></table>';
  body+='<table style="margin-top:8px"><tr class="net"><td colspan="2">'+(c.type==='np'?'Net Surplus':'Net Income')+'</td><td class="right '+(net>=0?'pos':'neg')+'">'+fmtN(Math.abs(net))+(net<0?' (deficit)':'')+(netMargin!==null?' — '+netMargin+'% margin':'')+'</td></tr></table>';
  // Cash bridge
  body+='<h2>Where Did the '+(net>=0?'Surplus':'Loss')+' Go?</h2>';
  body+='<table><tr><th>Item</th><th class="right">Amount</th><th>Notes</th></tr>';
  body+='<tr><td>'+(c.type==='np'?'Net Surplus':'Net Income')+'</td><td class="right '+(net>=0?'pos':'neg')+'">'+fmtN(net)+'</td><td>From P&L above</td></tr>';
  if(openInvAmt>0)body+='<tr><td>&#8722; Uncollected (open invoices)</td><td class="right neg">&#8722;'+fmtN(openInvAmt)+'</td><td>Earned but not yet in your bank</td></tr>';
  if(openBillAmt>0)body+='<tr><td>+ Unpaid bills (cash still held)</td><td class="right pos">+'+fmtN(openBillAmt)+'</td><td>Owed but not yet paid out</td></tr>';
  if(c.type==='np'&&grants.length)body+='<tr><td>&#9888; Grant funds may be restricted</td><td class="right">'+fmtN(grants.reduce(function(s,g){return s+Number(g.awarded||0);},0))+'</td><td>Verify restriction terms</td></tr>';
  var cashChg=net-openInvAmt+openBillAmt;
  body+='<tr class="total"><td>Estimated cash change</td><td class="right '+(cashChg>=0?'pos':'neg')+'">'+fmtN(cashChg)+'</td><td></td></tr></table>';
  // Balance Sheet
  if(totalAssets>0||totalLiab>0){
    body+='<h2>Balance Sheet Snapshot</h2>';
    body+='<table><tr><th>Item</th><th class="right">Amount</th><th>Type</th></tr>';
    bs.assets.forEach(function(a){body+='<tr><td>'+escHtml(a.name)+'</td><td class="right">'+fmtN(a.amt)+'</td><td>Asset</td></tr>';});
    body+='<tr class="total"><td>Total Assets</td><td class="right">'+fmtN(totalAssets)+'</td><td></td></tr>';
    bs.liabilities.forEach(function(l){body+='<tr><td>'+escHtml(l.name)+'</td><td class="right">'+fmtN(l.amt)+'</td><td>Liability</td></tr>';});
    body+='<tr class="total"><td>Total Liabilities</td><td class="right">'+fmtN(totalLiab)+'</td><td></td></tr>';
    body+='<tr class="net"><td>Net '+(c.type==='np'?'Assets':'Equity')+'</td><td class="right '+(totalAssets-totalLiab>=0?'pos':'neg')+'">'+fmtN(totalAssets-totalLiab)+'</td><td></td></tr></table>';
    body+='<p style="font-size:11px;color:#8a8880">The P&L shows performance over time. The Balance Sheet shows your position right now. Cash on hand ('+fmtN(cashOnHand)+') appears under Assets on the Balance Sheet — it is separate from profit.</p>';
  }
  // Projects
  if(projects.length){
    body+='<h2>Projects / Events</h2>';
    body+='<table><tr><th>Project</th><th class="right">Budget</th><th class="right">Spent</th><th class="right">Remaining</th></tr>';
    projects.forEach(function(pr){
      var pExp=allExp.filter(function(e){return e.projectId===pr.id;}).reduce(function(s,e){return s+Number(e.amt||0);},0);
      var rem=Number(pr.budget||0)-pExp;
      body+='<tr><td>'+escHtml(pr.name)+(pr.isMultiYear?' (Multi-year)':'')+'</td><td class="right">'+fmtN(pr.budget||0)+'</td><td class="right">'+fmtN(pExp)+'</td><td class="right '+(rem>=0?'pos':'neg')+'">'+fmtN(rem)+'</td></tr>';
    });
    body+='</table>';
  }
  // Grants
  if(c.type==='np'&&grants.length){
    body+='<h2>Grant Status</h2>';
    body+='<table><tr><th>Grant</th><th>Funder</th><th class="right">Awarded</th><th class="right">Spent</th><th class="right">Remaining</th></tr>';
    grants.forEach(function(gr){
      var sp=allExp.filter(function(e){return e.grantId===gr.id;}).reduce(function(s,e){return s+Number(e.amt||0);},0);
      var rem=Number(gr.awarded||0)-sp;
      body+='<tr><td>'+escHtml(gr.name)+'</td><td>'+(gr.funder||'&#8212;')+'</td><td class="right">'+fmtN(gr.awarded||0)+'</td><td class="right">'+fmtN(sp)+'</td><td class="right '+(rem>=0?'pos':'neg')+'">'+fmtN(rem)+'</td></tr>';
    });
    body+='</table>';
  }
  // Score in PDF - respect checkbox
  var inclScore=g('exec-include-score')?g('exec-include-score').checked:true;
  var scoreBlock='';
  if(inclScore){
    var sd=window._clarityScoreData||{};
    var sc2=sd.score||0;
    var sc2col=sc2>=70?'#1D9E75':sc2>=45?'#d97706':'#c0392b';
    scoreBlock='<div style="text-align:center;padding:1.5rem;margin-bottom:1.5rem;border:2px solid '+sc2col+';border-radius:8px">'
      +'<div style="font-size:11px;color:#8a8880;text-transform:uppercase;letter-spacing:.06em">Clarity by Telofin™ Score</div>'
      +'<div style="font-size:52px;font-weight:700;color:'+sc2col+'">'+sc2+'</div>'
      +'<div style="font-size:13px;color:'+sc2col+';font-weight:600">'+(sc2>=70?'Healthy':sc2>=45?'Watch':'Risk')+'</div>'
      +'<div style="display:flex;justify-content:center;gap:16px;margin-top:.5rem;flex-wrap:wrap">'
      +['Survival','Performance','Stability','Efficiency','Resilience'].map(function(n,i){
        var s=[sd.scores&&sd.scores.survival,sd.scores&&sd.scores.performance,sd.scores&&sd.scores.stability,sd.scores&&sd.scores.efficiency,sd.scores&&sd.scores.resilience][i]||0;
        var c2=s>=70?'#1D9E75':s>=45?'#d97706':'#c0392b';
        return'<div style="text-align:center"><div style="font-size:9px;color:#8a8880">'+n+'</div><div style="font-weight:700;color:'+c2+'">'+s+'</div></div>';
      }).join('')
      +'<div style="margin-top:10px;padding:8px 10px;background:#fef3c7;border-radius:6px;font-size:9px;color:#92400e;line-height:1.5">'
      +'<strong>Important:</strong> This score is based solely on the data you have entered and may not reflect your complete financial picture. It is an internal management tool only — not an audit, review, compilation, or professional opinion. It should not be used as the sole basis for evaluating the financial health of your organization. Always consult a licensed CPA or financial advisor before making significant financial or operational decisions.'
      +'</div></div>';
  }
  openPDF(scoreBlock+body+pdfDisclaimer('This score is an internal management tool only and does not constitute a professional financial opinion or audit.'),c,'Executive Summary');
}

function doPDF(tabOverride){
  var c=gc();if(!c)return;
  // Map tab types to report types
  var tabMap={budget:'budgetexport',grants:'grants',donors:'donors',expenses:'expdetail',income:'incdetail',revenue:'incdetail',procurement:'expdetail'};
  var type=tabOverride?( tabMap[tabOverride]||tabOverride):getActiveRpt();
  var exp=c.expenses||[];
  var inc=c.type==='sb'?c.revenue||[]:c.income||[];
  var _pdfBasis=typeof RPT_BASIS!=='undefined'?(RPT_BASIS||(c.basisType||'cash')):'cash';
  function _pdfAmt(r){return c.type==='sb'?(_pdfBasis==='accrual'?Number(r.proj||0):Number(r.act||0)):c.type==='pe'?Number(r.amt||0):(_pdfBasis==='accrual'?Number(r.proj||0):Number(r.recv||0));}
  var iT=inc.reduce(function(s,r){return s+_pdfAmt(r);},0);
  if(c.type==='np')iT+=(c.grants||[]).reduce(function(s,gr){return s+_grantPnlAward(c,inc,gr);},0);
  var eT=exp.reduce(function(s,e){return s+Number(e.amt||0);},0);
  var net=iT-eT;

  function fmtN(n){return'$'+Number(n||0).toLocaleString();}
  function tRow(cells){return'<tr>'+cells.map(function(c,i){return'<td'+(i>0?' class="right"':'')+'>'+c+'</td>';}).join('')+'</tr>';}

  if(type==='pl'){
    var iR=inc.map(function(r){return tRow([escHtml(r.name||'—'),escHtml(r.cat||'—'),fmtN(_pdfAmt(r))]);}).join('');
    if(c.type==='np')(c.grants||[]).forEach(function(gr){if(_grantPnlAward(c,inc,gr)===0)return;iR+=tRow(['Grant: '+escHtml(gr.name),'Grants',fmtN(gr.awarded)]);});
    var eR=exp.map(function(e){return tRow([escHtml(e.desc||'—'),escHtml(e.cat||'—'),fmtN(e.amt)]);}).join('');
    var body='<h2>'+il(c.type)+'</h2><table><tr><th>Source</th><th>Category</th><th class="right">Amount</th></tr>'+(iR||'<tr><td colspan="3" style="color:#8a8880">No data</td></tr>')+'<tr class="total"><td colspan="2">Total</td><td class="right">'+fmtN(iT)+'</td></tr></table>';
    body+='<h2>Expenses</h2><table><tr><th>Description</th><th>Category</th><th class="right">Amount</th></tr>'+(eR||'<tr><td colspan="3" style="color:#8a8880">No data</td></tr>')+'<tr class="total"><td colspan="2">Total</td><td class="right">'+fmtN(eT)+'</td></tr></table>';
    body+='<table style="margin-top:12px"><tr class="net"><td colspan="2">'+nl(c.type)+'</td><td class="right '+(net>=0?'pos':'neg')+'">'+fmtN(Math.abs(net))+(net<0?' (deficit)':'')+'</td></tr></table>';
    openPDF(body+pdfDisclaimer('Verify all amounts with a licensed CPA before using in financial statements or tax filings.'),c,'P&L Report');

  }else if(type==='grants'){
    var rows=(c.grants||[]).map(function(gr){var sp=exp.filter(function(e){return e.grantId===gr.id;}).reduce(function(s,e){return s+Number(e.amt||0);},0),r=Number(gr.awarded||0)-sp;return tRow([escHtml(gr.name),gr.funder||'—',gr.status||'—',fmtN(gr.awarded),fmtN(sp),'<span class="'+(r>=0?'pos':'neg')+'">'+fmtN(r)+'</span>']);}).join('');
    openPDF(pdfDisclaimer('Grant amounts should be verified against actual award letters and grant agreements before reporting.')+'<h2>Grant Summary</h2><table><tr><th>Grant</th><th>Funder</th><th>Status</th><th class="right">Awarded</th><th class="right">Spent</th><th class="right">Remaining</th></tr>'+rows+'</table>',c,'Grant Summary');

  }else if(type==='budget'||type==='budgetexport'){
    var _propFY=typeof PROPOSED_FY!=='undefined'?PROPOSED_FY:'';
    var _propBuds=BUDGET_VIEW==='proposed'&&_propFY?((c.proposedBudgets||[]).find(function(p){return p.fy===_propFY;})||{items:[]}).items:null;
    var buds=_propBuds||c.budgetItems||[];
    var _budTitle=_propBuds?('Proposed Budget — '+_propFY):'Budget Summary';
    var groups={};buds.forEach(function(b){if(!groups[b.group||b.type])groups[b.group||b.type]=[];groups[b.group||b.type].push(b);});
    var iC={},eC={};
    if(c.type==='np'){(c.income||[]).forEach(function(r){iC[r.cat||'Other']=(iC[r.cat||'Other']||0)+_pdfAmt(r);});(c.expenses||[]).forEach(function(e){eC[e.cat||'Other']=(eC[e.cat||'Other']||0)+Number(e.amt||0);});}
    else if(c.type==='sb'){(c.revenue||[]).forEach(function(r){iC[r.cat||'Other']=(iC[r.cat||'Other']||0)+_pdfAmt(r);});(c.expenses||[]).forEach(function(e){eC[e.cat||'Other']=(eC[e.cat||'Other']||0)+Number(e.amt||0);});}
    else{(c.income||[]).forEach(function(r){iC[r.cat||'Other']=(iC[r.cat||'Other']||0)+Number(r.amt||0);});(c.expenses||[]).forEach(function(e){eC[e.cat||'Other']=(eC[e.cat||'Other']||0)+Number(e.amt||0);});}
    var body='<h2>Budget'+(type==='budget'?' vs Actual':'Summary')+'</h2>';
    var grandBud=0,grandAct=0;
    Object.keys(groups).forEach(function(grp){
      var items=groups[grp];var grpBud=0,grpAct=0;
      var isInc=items.some(function(b){return b.type==='Income';});
      body+='<table><tr><th colspan="'+(type==='budget'?'3':'2')+'">'+grp+'</th></tr>';
      if(type==='budget')body+='<tr><th>Line item</th><th class="right">Budgeted</th><th class="right">Actual</th></tr>';
      items.forEach(function(b){
        var act=b.type==='Income'?(iC[b.cat]||0):(eC[b.cat]||0);
        grpBud+=Number(b.amt||0);grpAct+=act;
        body+=tRow([b.cat,fmtN(b.amt)].concat(type==='budget'?[fmtN(act)]:[]));
      });
      body+='<tr class="total"><td>'+grp+' total</td><td class="right">'+fmtN(grpBud)+'</td>'+(type==='budget'?'<td class="right">'+fmtN(grpAct)+'</td>':'')+'</tr></table>';
      if(isInc){grandBud+=grpBud;grandAct+=grpAct;}else{grandBud-=grpBud;grandAct-=grpAct;}
    });
    body+='<table style="margin-top:12px"><tr class="net"><td>'+nl(c.type)+'</td><td class="right '+(grandBud>=0?'pos':'neg')+'">'+fmtN(grandBud)+'</td>'+(type==='budget'?'<td class="right '+(grandAct>=0?'pos':'neg')+'">'+fmtN(grandAct)+'</td>':'')+'</tr></table>';
    openPDF(body+pdfDisclaimer('Budget figures are projections only. Actual results may differ. Verify with a licensed CPA before use in formal reports.'),c,type==='budget'?'Budget vs Actual':_budTitle);

  }else if(type==='budgetmulti'){
    var adopted2=c.adoptedBudgets||[];var proposed2=c.proposedBudgets||[];
    var cols2=[];
    adopted2.slice().sort(function(a,b){return(a.fy||'').localeCompare(b.fy||'');}).forEach(function(ab){cols2.push({label:ab.fy,items:ab.items});});
    var fy2=getFiscalYear(c.fiscalYearEnd);
    cols2.push({label:fy2.label+' Budget',items:c.budgetItems||[]});
    proposed2.slice().sort(function(a,b){return(a.fy||'').localeCompare(b.fy||'');}).forEach(function(pb){cols2.push({label:pb.fy+' (prop.)',items:pb.items||[]});});
    var allCats2={};cols2.forEach(function(col){(col.items||[]).forEach(function(b){allCats2[b.group+'|'+b.cat+':'+b.type]={group:b.group||b.type,cat:b.cat,type:b.type};});});
    var ths2='<th>Line item</th>'+cols2.map(function(col){return'<th class="right">'+col.label+'</th>';}).join('');
    var groups2={};Object.values(allCats2).forEach(function(b){if(!groups2[b.group])groups2[b.group]=[];if(!groups2[b.group].find(function(x){return x.cat===b.cat;}))groups2[b.group].push(b);});
    var body2='<h2>Multi-year Budget Comparison</h2><div style="overflow-x:auto"><table><thead><tr>'+ths2+'</tr></thead><tbody>';
    var grandInc2=cols2.map(function(){return 0;});var grandExp2=cols2.map(function(){return 0;});
    Object.keys(groups2).forEach(function(grp){
      body2+='<tr style="background:#f5f3ee"><td colspan="'+(cols2.length+1)+'" style="font-weight:600;font-size:11px;text-transform:uppercase;color:#8a8880;padding:6px 4px">'+grp+'</td></tr>';
      var grpTots=cols2.map(function(){return 0;});
      groups2[grp].forEach(function(b){
        var cells=cols2.map(function(col,ci){var found=(col.items||[]).find(function(x){return x.cat===b.cat&&x.type===b.type;});var v=found?Number(found.amt||0):null;grpTots[ci]+=(v||0);if(b.type==='Income')grandInc2[ci]+=(v||0);else grandExp2[ci]+=(v||0);return'<td class="right">'+(v===null?'—':fmtN(v))+'</td>';}).join('');
        body2+='<tr><td style="padding-left:16px;font-size:12px">'+escHtml(b.cat)+'</td>'+cells+'</tr>';
      });
      body2+='<tr class="total"><td>'+grp+' total</td>'+grpTots.map(function(t){return'<td class="right">'+fmtN(t)+'</td>';}).join('')+'</tr>';
    });
    var nets2=grandInc2.map(function(i,ci){return i-grandExp2[ci];});
    body2+='<tr class="net"><td>'+nl(c.type)+'</td>'+nets2.map(function(n){return'<td class="right '+(n>=0?'pos':'neg')+'">'+fmtN(n)+'</td>';}).join('')+'</tr>';
    body2+='</tbody></table></div>';
    openPDF(body2+pdfDisclaimer('Budget projections are for planning purposes only and should not be used as a guarantee of future performance.'),c,'Multi-year Budget');

  }else if(type==='category'){
    var iC2={},eC2={};
    (c.type==='sb'?c.revenue||[]:c.income||[]).forEach(function(r){var k=r.cat||'Other';iC2[k]=(iC2[k]||0)+_pdfAmt(r);});
    (c.expenses||[]).forEach(function(e){var k=e.cat||'Other';eC2[k]=(eC2[k]||0)+Number(e.amt||0);});
    function catTable(obj,cls){return Object.keys(obj).sort().map(function(k){return tRow([k,fmtN(obj[k])]);}).join('');}
    openPDF(pdfDisclaimer('Figures based on user-entered data. Verify with a licensed CPA.')+'<h2>'+il(c.type)+' by Category</h2><table><tr><th>Category</th><th class="right">Amount</th></tr>'+catTable(iC2,'pos')+'</table><h2>Expenses by Category</h2><table><tr><th>Category</th><th class="right">Amount</th></tr>'+catTable(eC2,'neg')+'</table>',c,'Category Breakdown');

  }else if(type==='1099'){
    var vendors2={};(exp||[]).filter(function(e){return e.is1099;}).forEach(function(e){var v=e.vendor1099||e.desc||'Unknown';vendors2[v]=(vendors2[v]||0)+Number(e.amt||0);});
    var vendors2obj={};(exp||[]).filter(function(e){return e.is1099;}).forEach(function(e){var v=e.vendor1099||e.desc||'Unknown';if(!vendors2obj[v])vendors2obj[v]={total:0,tin:''};vendors2obj[v].total+=Number(e.amt||0);if(e.tin1099&&!vendors2obj[v].tin)vendors2obj[v].tin=e.tin1099;});
    var rows2=Object.keys(vendors2obj).sort().map(function(v){var d=vendors2obj[v];return tRow([escHtml(v),d.tin||'<span style="color:#c0392b">MISSING</span>',d.total>=600?'Required':'Under $600',fmtN(d.total)]);}).join('');
    openPDF('<h2>1099 Contractor Report</h2><table><tr><th>Vendor</th><th>EIN / TIN</th><th>Status</th><th class="right">Total paid</th></tr>'+(rows2||'<tr><td colspan="4" style="color:#8a8880">No 1099 expenses.</td></tr>')+'</table><p style="font-size:11px;color:#8a8880;margin-top:12px">Contractors paid $600+ require a 1099-NEC. File by January 31.</p>',c,'1099 Report');

  }else if(type==='expdetail'){
    var rows3=(exp||[]).slice().sort(function(a,b){return(b.date||'').localeCompare(a.date||'');}).map(function(e){return tRow([e.date||'—',escHtml(e.desc||'—'),escHtml(e.cat||'—'),fmtN(e.amt)]);}).join('');
    var tot3=exp.reduce(function(s,e){return s+Number(e.amt||0);},0);
    openPDF(pdfDisclaimer('Expense data based on user-entered records. Verify receipts and supporting documentation.')+'<h2>Expense Detail</h2><table><tr><th>Date</th><th>Description</th><th>Category</th><th class="right">Amount</th></tr>'+(rows3||'<tr><td colspan="4" style="color:#8a8880">No expenses.</td></tr>')+'<tr class="total"><td colspan="3">Total</td><td class="right">'+fmtN(tot3)+'</td></tr></table>',c,'Expense Detail');

  }else if(type==='incdetail'){
    var items2=c.type==='sb'?c.revenue||[]:c.income||[];
    var rows4=items2.map(function(r){return tRow([r.date||'—',escHtml(r.name||'—'),escHtml(r.cat||'—'),fmtN(_pdfAmt(r))]);}).join('');
    var tot4=items2.reduce(function(s,r){return s+_pdfAmt(r);},0);
    openPDF(pdfDisclaimer('Income data based on user-entered records. Verify against bank statements and source documents.')+'<h2>'+il(c.type)+' Detail</h2><table><tr><th>Date</th><th>Name</th><th>Category</th><th class="right">Amount</th></tr>'+(rows4||'<tr><td colspan="4" style="color:#8a8880">No data.</td></tr>')+'<tr class="total"><td colspan="3">Total</td><td class="right">'+fmtN(tot4)+'</td></tr></table>',c,il(c.type)+' Detail');

  }else if(type==='vendor'){
    var vmap={};(exp||[]).forEach(function(e){var v=e.vendor1099||e.desc||'Unknown';if(!vmap[v])vmap[v]=0;vmap[v]+=Number(e.amt||0);});
    var vrows=Object.keys(vmap).sort(function(a,b){return vmap[b]-vmap[a];}).map(function(v){return tRow([v,fmtN(vmap[v])]);}).join('');
    openPDF(pdfDisclaimer('Vendor totals based on expenses entered in Clarity. Verify against invoices and receipts before use in 1099 filings.')+'<h2>Vendor Summary</h2><table><tr><th>Vendor</th><th class="right">Total</th></tr>'+(vrows||'<tr><td colspan="2" style="color:#8a8880">No data.</td></tr>')+'</table>',c,'Vendor Summary');

  }else if(type==='donors'){
    var drows=(c.donors||[]).slice().sort(function(a,b){return(b.donations||[]).reduce(function(s,d){return s+Number(d.amt||0);},0)-(a.donations||[]).reduce(function(s,d){return s+Number(d.amt||0);},0);}).map(function(d){var t=(d.donations||[]).reduce(function(s,dn){return s+Number(dn.amt||0);},0);return tRow([escHtml(d.name),d.email||'—',fmtN(t)]);}).join('');
    var grand2=(c.donors||[]).reduce(function(s,d){return s+(d.donations||[]).reduce(function(s2,dn){return s2+Number(dn.amt||0);},0);},0);
    openPDF(pdfDisclaimer('Donor acknowledgment letters must comply with IRS requirements. Consult a CPA or attorney before distributing to donors.')+'<h2>Donor Report</h2><table><tr><th>Donor</th><th>Email</th><th class="right">Total given</th></tr>'+(drows||'<tr><td colspan="3" style="color:#8a8880">No donors.</td></tr>')+'<tr class="total"><td colspan="2">Total raised</td><td class="right">'+fmtN(grand2)+'</td></tr></table>',c,'Donor Report');

  }else if(type==='projpl'){
    var prows=(c.projects||[]).map(function(pr){var pe=exp.filter(function(e){return e.projectId===pr.id;}).reduce(function(s,e){return s+Number(e.amt||0);},0);var pi=((c.type==='sb'?c.revenue:c.income)||[]).filter(function(r){return r.projectId===pr.id;}).reduce(function(s,r){return s+Number(c.type==='sb'?r.act:r.recv||r.amt||0);},0);return'<tr><td>'+escHtml(pr.name)+'</td><td class="right pos">'+fmtN(pi)+'</td><td class="right neg">'+fmtN(pe)+'</td><td class="right '+(pi-pe>=0?'pos':'neg')+'">'+fmtN(pi-pe)+'</td></tr>';}).join('');
    openPDF('<h2>Project P&amp;L</h2><table><tr><th>Project</th><th class="right">Income</th><th class="right">Expenses</th><th class="right">Net</th></tr>'+(prows||'<tr><td colspan="4" style="color:#8a8880">No projects.</td></tr>')+'</table>',c,'Project P&L');

  }else if(type==='trialbal'){
    var tbRows=getTrialBalance(c);
    var tbDr=tbRows.reduce(function(s,r){return s+r.dr;},0);
    var tbCr=tbRows.reduce(function(s,r){return s+r.cr;},0);
    var tbBal=Math.abs(tbDr-tbCr)<0.01;
    var fmt3=function(n){return'$'+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});};
    var typeOrder2={Asset:1,Liability:2,Equity:3,Income:4,Revenue:4,Expense:5,Unknown:6};
    tbRows.sort(function(a,b){return(typeOrder2[a.type]||6)-(typeOrder2[b.type]||6)||a.code.localeCompare(b.code);});
    var tbBody=tbRows.map(function(r){return'<tr><td style="font-family:monospace;font-size:10px">'+escHtml(r.code)+'</td><td>'+escHtml(r.name)+'</td><td style="color:#888;font-size:10px">'+escHtml(r.type)+'</td><td class="right">'+fmt3(r.dr)+'</td><td class="right">'+fmt3(r.cr)+'</td><td class="right '+(r.balance<0?'neg':'pos')+'">'+fmt3(r.balance)+'</td></tr>';}).join('');
    var tbHtml='<h2>Trial Balance</h2><div style="font-size:11px;color:#888;margin-bottom:12px">As of '+today()+' &nbsp;&middot;&nbsp; '+escHtml(c.name)+(tbBal?' &nbsp;&middot;&nbsp; <span style="color:#1D9E75;font-weight:600">&#10003; Balanced</span>':'&nbsp;&middot;&nbsp;<span style="color:#c0392b;font-weight:700">&#9888; Out of balance</span>')+'</div>';
    tbHtml+='<table><tr><th>Code</th><th>Account</th><th>Type</th><th class="right">Debit</th><th class="right">Credit</th><th class="right">Balance</th></tr>'+tbBody+'<tr class="total"><td colspan="3">Totals</td><td class="right">'+fmt3(tbDr)+'</td><td class="right">'+fmt3(tbCr)+'</td><td class="right">'+(tbBal?'<span style="color:#1D9E75">In balance</span>':'<span style="color:#c0392b">'+fmt3(Math.abs(tbDr-tbCr))+' off</span>')+'</td></tr></table>';
    openPDF(tbHtml+pdfDisclaimer('Trial balance derived from double-entry ledger entries. Verify all postings with a licensed CPA before preparing financial statements.'),c,'Trial Balance');

  }else if(type==='cashflow'){
    // Cash Position & Runway PDF — mirrors renderCashFlowRpt() (burn rate / runway, not a GAAP cash flow statement)
    var _cpExp=(c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;});
    var _cpRev=(c.revenue||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;});
    var _cpMOut=_cpExp.reduce(function(s,e){var a=Number(e.amt||0);return s+(e.freq==='Weekly'?a*4:e.freq==='Bi-weekly'?a*2:e.freq==='Monthly'?a:e.freq==='Quarterly'?a/3:e.freq==='Annual'?a/12:a);},0);
    var _cpMIn=_cpRev.reduce(function(s,r){return s+Number(r.proj||0);},0);
    var _cpFixed=_cpExp.filter(function(e){return e.fixed==='Fixed';}).reduce(function(s,e){return s+Number(e.amt||0);},0);
    var _cpVar=_cpExp.filter(function(e){return e.fixed!=='Fixed';}).reduce(function(s,e){return s+Number(e.amt||0);},0);
    var _cpTotAct=_cpRev.reduce(function(s,r){return s+basisInc(c,r);},0);
    var _cpTotExp=_cpExp.reduce(function(s,e){return s+Number(e.amt||0);},0);
    var _cpCash=getCashOnHand(c);
    var _cpRunway=_cpMOut>0?Math.round(_cpCash/_cpMOut):null;
    function _cpTr(label,amt,bold){return'<tr'+(bold?' class="total"':'')+'><td>'+label+'</td><td class="right" style="color:'+(amt<0?'#c0392b':'#1D9E75')+'">'+fmtN(amt)+'</td></tr>';}
    var cpHtml='<h2>Cash Position &amp; Runway</h2>'
      +'<div style="font-size:11px;color:#888;margin-bottom:12px">'+escHtml(c.name)+'</div>'
      +'<h3>Cash Position</h3><table><tr><th>Item</th><th class="right">Amount</th></tr>'
      +_cpTr('Cash on hand (from reconciliation)',_cpCash,false)
      +_cpTr('Monthly projected inflow',Math.round(_cpMIn),false)
      +_cpTr('Monthly projected outflow',-Math.round(_cpMOut),false)
      +_cpTr('Monthly net',Math.round(_cpMIn)-Math.round(_cpMOut),true)
      +'</table>'
      +'<h3>Actuals to Date</h3><table><tr><th>Item</th><th class="right">Amount</th></tr>'
      +_cpTr('Total revenue (actual)',_cpTotAct,false)
      +_cpTr('Fixed expenses',-_cpFixed,false)
      +_cpTr('Variable expenses',-_cpVar,false)
      +_cpTr('Net P&L',_cpTotAct-_cpTotExp,true)
      +'</table>'
      +(_cpRunway!==null?'<h3>Runway</h3><table><tr><th>Item</th><th class="right">Amount</th></tr>'+_cpTr('Runway at current burn rate',_cpRunway,false)+'</table>':'');
    openPDF(cpHtml+pdfDisclaimer('Cash position figures are estimates based on entered transactions. Verify with a licensed CPA before use in financial reporting.'),c,'Cash Position & Runway');

  }else if(type==='cfdirect'||type==='cfindirect'){
    // Cash Flow Statement (Direct/Indirect) PDF — built from the shared getCashFlowStatement() engine
    // in state.js, so the PDF always matches the on-screen report exactly (no duplicated calc logic).
    var fy3=getFiscalYear(c.fiscalYearEnd);
    var cf=getCashFlowStatement(c,fy3.start,fy3.end);
    function _cfFmt2(n){var abs=Math.abs(n||0);var s='$'+abs.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0});return n<0?'('+s+')':s;}
    function _cfTr2(label,amt,bold){return'<tr'+(bold?' class="total"':'')+'><td>'+escHtml(label)+'</td><td class="right" style="color:'+(amt<0?'#c0392b':'#1D9E75')+'">'+_cfFmt2(amt)+'</td></tr>';}
    var opTableRows,opTotalLabel,methodLabel,extraNote;
    if(type==='cfdirect'){
      methodLabel='Direct Method';
      opTableRows=cf.direct.operating.map(function(r){return _cfTr2(r.label,r.amt);}).join('');
      opTotalLabel='Net cash from operating activities';
      extraNote='';
    }else{
      methodLabel='Indirect Method';
      opTableRows=_cfTr2('Net income',cf.indirect.netIncome)
        +cf.indirect.addbacks.map(function(r){return _cfTr2('Add: '+r.label,r.amt);}).join('')
        +cf.indirect.workingCapital.map(function(r){return _cfTr2(r.label,r.amt);}).join('');
      opTotalLabel='Net cash from operating activities';
      extraNote=cf.reconciled
        ?'<div style="font-size:10px;color:#1D9E75;margin:4px 0 12px">&#10003; Ties to the direct-method operating total.</div>'
        :'<div style="font-size:10px;color:#c0392b;margin:4px 0 12px">&#9888; Off from the direct-method operating total by '+_cfFmt2(cf.diff)+'.</div>';
    }
    var cfHtml='<h2>Statement of Cash Flows</h2>'
      +'<div style="font-size:11px;color:#888;margin-bottom:12px">'+methodLabel+' &middot; Fiscal year '+escHtml(fy3.label)+' &middot; '+escHtml(c.name)+'</div>'
      +'<h3>Operating Activities</h3><table><tr><th>Item</th><th class="right">Amount</th></tr>'
      +(opTableRows||'<tr><td colspan="2" style="color:#8a8880">No operating activity.</td></tr>')
      +_cfTr2(opTotalLabel,cf.direct.opTotal,true)
      +'</table>'+extraNote
      +'<h3>Investing Activities</h3><table><tr><th>Item</th><th class="right">Amount</th></tr>'
      +(cf.investing.map(function(r){return _cfTr2(r.label,r.amt);}).join('')||'<tr><td colspan="2" style="color:#8a8880">No investing activity.</td></tr>')
      +_cfTr2('Net cash from investing activities',cf.invTotal,true)
      +'</table>'
      +'<h3>Financing Activities</h3><table><tr><th>Item</th><th class="right">Amount</th></tr>'
      +(cf.financing.map(function(r){return _cfTr2(r.label,r.amt);}).join('')||'<tr><td colspan="2" style="color:#8a8880">No financing activity.</td></tr>')
      +_cfTr2('Net cash from financing activities',cf.finTotal,true)
      +'</table>'
      +'<h3>Net Change in Cash</h3><table><tr><th>Item</th><th class="right">Amount</th></tr>'
      +_cfTr2('Net increase (decrease) in cash',cf.netChange,false)
      +_cfTr2('Cash at beginning of period (ledger)',cf.openingCash,false)
      +_cfTr2('Cash at end of period (ledger)',cf.endingCash,true)
      +'</table>'
      +(Math.abs(cf.unpostedGap)>=0.5?'<div style="font-size:10px;color:#b8860b;margin-top:6px">&#9888; '+_cfFmt2(Math.abs(cf.unpostedGap))+' of the fixed-asset/loan activity above hasn\'t posted to the ledger\'s cash accounts yet, so it doesn\'t appear in the ledger cash balance.</div>':'');
    openPDF(cfHtml+pdfDisclaimer('Operating activity is derived from posted ledger entries; fixed-asset and loan cash flows are drawn from those records directly (see queue item on ledger-posting these). Verify all figures with a licensed CPA before use in financial reporting.'),c,'Statement of Cash Flows ('+methodLabel+')');

  }else if(type==='f990partix'){
    // Form 990 Part IX — Statement of Functional Expenses (NP only)
    // Columns: Program Services | Management & General | Fundraising | Total
    var _f9exp=(c.expenses||[]).filter(function(e){return!e.deleted&&!e.voided;});
    // Map each expense to its functional column
    function _f9col(e){
      var f=(e.functional||'').toLowerCase();
      if(f==='program')return 0;
      if(f==='management'||f==='admin')return 1;
      if(f==='fundraising')return 2;
      return 1;// default untagged to management/general
    }
    // Group by f990 line reference from COA, fallback to category
    var _f9map={};// key: line label, value: [prog, mgmt, fund]
    _f9exp.forEach(function(e){
      var acct=(c.accounts||[]).find(function(a){return a.code===e.acctCode;});
      var lineKey=acct&&acct.f990?acct.f990:('Other — '+escHtml(e.cat||'Uncategorized'));
      if(!_f9map[lineKey])_f9map[lineKey]=[0,0,0];
      _f9map[lineKey][_f9col(e)]+=Number(e.amt||0);
    });
    // Totals
    var _f9tot=[0,0,0];
    Object.keys(_f9map).forEach(function(k){
      _f9tot[0]+=_f9map[k][0];_f9tot[1]+=_f9map[k][1];_f9tot[2]+=_f9map[k][2];
    });
    var _f9grand=_f9tot[0]+_f9tot[1]+_f9tot[2];
    var fmt4=function(n){return n?'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0}):'—';};
    // Sort by line key
    var _f9keys=Object.keys(_f9map).sort();
    var _f9rows=_f9keys.map(function(k){
      var v=_f9map[k];var row_tot=v[0]+v[1]+v[2];
      return'<tr><td>'+k+'</td><td class="right">'+fmt4(v[0])+'</td><td class="right">'+fmt4(v[1])+'</td><td class="right">'+fmt4(v[2])+'</td><td class="right" style="font-weight:600">'+fmt4(row_tot)+'</td></tr>';
    }).join('');
    // Untagged warning
    var _f9untagged=_f9exp.filter(function(e){return!e.functional;}).length;
    var _f9warn=_f9untagged?'<p style="color:#c0392b;font-size:11px;margin-bottom:8px"><i class="fas fa-triangle-exclamation"></i> '+_f9untagged+' expense(s) have no functional classification and have been defaulted to Management & General. Tag expenses using the "Functional" field when recording them.</p>':'';
    var f9html='<h2>Form 990 Part IX — Statement of Functional Expenses</h2>'
      +'<div style="font-size:11px;color:#888;margin-bottom:8px">'+escHtml(c.name)+' &middot; All periods &middot; Generated '+today()+'</div>'
      +_f9warn
      +'<table>'
      +'<tr><th>Expense line</th><th class="right">Program services</th><th class="right">Management & general</th><th class="right">Fundraising</th><th class="right">Total</th></tr>'
      +(_f9rows||'<tr><td colspan="5" style="color:#8a8880">No expenses recorded.</td></tr>')
      +'<tr class="total"><td>Total functional expenses</td>'
      +'<td class="right">'+fmt4(_f9tot[0])+'</td>'
      +'<td class="right">'+fmt4(_f9tot[1])+'</td>'
      +'<td class="right">'+fmt4(_f9tot[2])+'</td>'
      +'<td class="right">'+fmt4(_f9grand)+'</td></tr>'
      +'</table>'
      +'<p style="font-size:10px;color:#aaa;margin-top:16px">Functional classification is based on the "Functional" field on each expense entry. COA account f990 field provides Part IX line references. Verify all amounts with your CPA before filing.</p>';
    openPDF(f9html+pdfDisclaimer('Form 990 data must be independently verified by a licensed CPA or nonprofit accountant before filing with the IRS.'),c,'Form 990 Part IX');

  }else if(type==='f990schedB'){
    // Schedule B -- Schedule of Contributors (NP only)
    var THRESHOLD=5000;
    var donors=(c.donors||[]).map(function(d){
      var total=(d.donations||[]).reduce(function(s,dn){return s+Number(dn.amt||0);},0);
      return{name:d.name||'Unknown',email:d.email||'',total:total};
    }).filter(function(d){return d.total>=THRESHOLD;});
    var incDonors={};
    (c.income||[]).filter(function(r){return!r.deleted&&!r.voided;}).forEach(function(r){
      var k=r.name||'Unknown';
      if(!incDonors[k])incDonors[k]=0;
      incDonors[k]+=Number(r.recv||r.proj||0);
    });
    Object.keys(incDonors).forEach(function(name){
      if(!donors.find(function(d){return d.name===name;})&&incDonors[name]>=THRESHOLD)
        donors.push({name:name,email:'',total:incDonors[name]});
    });
    donors.sort(function(a,b){return b.total-a.total;});
    var isPublic=typeof _f990SchBPublic!=='undefined'&&_f990SchBPublic;
    function fmtN(n){return'$'+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0});}
    var sbRows=donors.map(function(d,i){
      var nm=isPublic?'Contributor #'+(i+1):d.name;
      var ct=isPublic?'Redacted':(d.email||'—');
      return'<tr><td>'+nm+'</td><td>'+ct+'</td><td style="text-align:right">'+fmtN(d.total)+'</td></tr>';
    }).join('');
    var sbTotal=donors.reduce(function(s,d){return s+d.total;},0);
    var sbHtml='<h2>Form 990 Schedule B — Schedule of Contributors</h2>'
      +'<p style="font-size:12px;color:#666;margin-bottom:8px">'+(isPublic?'<strong>Public copy</strong> (names redacted)':'<strong>Internal copy</strong> (confidential — do not file with public return)')+'</p>'
      +'<p style="font-size:11px;color:#888;margin-bottom:16px">Lists all contributors who gave $5,000 or more. Verify with your CPA before filing.</p>'
      +(donors.length
        ?'<table><thead><tr><th style="width:35%">'+(isPublic?'Contributor':'Name')+'</th><th style="width:40%">'+(isPublic?'Contact':'Email')+'</th><th style="width:25%;text-align:right">Total contributions</th></tr></thead><tbody>'
          +sbRows
          +'</tbody><tfoot><tr><td colspan="2"><strong>Total</strong></td><td style="text-align:right"><strong>'+fmtN(sbTotal)+'</strong></td></tr></tfoot></table>'
        :'<p>No contributors at or above the $5,000 threshold.</p>')
      +'<p style="font-size:10px;color:#aaa;margin-top:16px">Generated by Clarity by Telofin™. Verify all amounts with your CPA before filing Form 990.</p>';
    openPDF(sbHtml+pdfDisclaimer('Schedule B data must be verified by a licensed CPA before filing. IRS rules on contributor disclosure are complex and subject to change.'),c,'Form 990 Schedule B'+(isPublic?' (Public)':' (Internal)'));

  }else if(type==='executive'){
    exportExecutiveSummary();
  }else{
    // Fallback P&L (use explicit 'pl' to avoid infinite recursion)
    doPDF('pl');
  }
}

// _grantPnlAward(c, incomeList, gr): a grant's awarded amount for P&L INCOME — but 0 if the
// grant already has a linked income entry (grantId, e.g. the auto-created "Awarded" income
// line). Without this, awarded grants that auto-created an income row are counted twice in
// the P&L. Grant-specific reports (status, close-out) still show the raw awarded amount.
function _grantPnlAward(c, incomeList, gr){
  return (incomeList||[]).some(function(r){return r.grantId===gr.id;}) ? 0 : Number(gr.awarded||0);
}
function doXL(){
  var c=gc();if(!c)return;var wb=XLSX.utils.book_new();var type=getActiveRpt();
  var exp=c.expenses||[];
  var inc=c.type==='sb'?c.revenue||[]:c.income||[];
  var header=[[c.name],['Generated: '+today()],['']];

  if(type==='pl'||type==='category'){
    var rows=header.concat([[il(c.type),'Category','Amount','Fund','Date','Reconciled']]);
    inc.forEach(function(r){var a=c.type==='sb'?r.act:c.type==='pe'?r.amt:r.recv;rows.push([r.name||'',r.cat||'',Number(a||0),r.fund||'',r.date||'',r.reconciled?'Yes':'No']);});
    if(c.type==='np')(c.grants||[]).forEach(function(gr){if(_grantPnlAward(c,inc,gr)===0)return;rows.push(['Grant: '+gr.name,'Grants',Number(gr.awarded||0)]);});
    var iT=inc.reduce(function(s,r){var a=c.type==='sb'?r.act:c.type==='pe'?r.amt:r.recv;return s+Number(a||0);},0);
    if(c.type==='np')iT+=(c.grants||[]).reduce(function(s,gr){return s+_grantPnlAward(c,inc,gr);},0);
    rows.push(['Total '+il(c.type),'',iT],['']);
    rows.push(['Expenses','Category','Amount','Fund','Date','Check #','Reconciled']);
    exp.forEach(function(e){rows.push([e.desc||'',e.cat||'',Number(e.amt||0),e.fund||'',e.date||'',e.checkNum||'',e.reconciled?'Yes':'No']);});
    var eT=exp.reduce(function(s,e){return s+Number(e.amt||0);},0);
    rows.push(['Total expenses','',eT],['',nl(c.type),iT-eT]);
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'P&L');
  }

  if(type==='budget'||type==='budgetexport'||type==='pl'){
    var buds=c.budgetItems||[];
    if(buds.length){
      var brows=header.concat([['Group','Line item','Type','Budgeted','Fund']]);
      var groups={};buds.forEach(function(b){if(!groups[b.group||b.type])groups[b.group||b.type]=[];groups[b.group||b.type].push(b);});
      Object.keys(groups).forEach(function(grp){
        var items=groups[grp];var grpTot=0;
        items.forEach(function(b){brows.push([grp,b.cat,b.type,Number(b.amt||0),b.fund||'']);grpTot+=Number(b.amt||0);});
        brows.push(['',grp+' total','',grpTot],['']);
      });
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(brows),'Budget');
    }
  }

  if(type==='grants'||(type==='pl'&&(c.grants||[]).length)){
    var gr=[['Grant','Funder','Awarded','Status','Deadline','Spent','Remaining','Match','Restrictions']];
    (c.grants||[]).forEach(function(x){var sp=exp.filter(function(e){return e.grantId===x.id;}).reduce(function(s,e){return s+Number(e.amt||0);},0);gr.push([x.name,x.funder||'',Number(x.awarded||0),x.status||'',x.deadline||'',sp,Number(x.awarded||0)-sp,x.match||'',x.restrict||'']);});
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(gr),'Grants');
  }

  if(type==='donors'||(type==='pl'&&c.type==='np'&&(c.donors||[]).length)){
    var dr=[['Donor','Email','Phone','Total Donated']];
    (c.donors||[]).forEach(function(d){var tot=(d.donations||[]).reduce(function(s,dn){return s+Number(dn.amt||0);},0);dr.push([d.name,d.email||'',d.phone||'',tot]);});
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(dr),'Donors');
    var dd=[['Donor','Amount','Date','Fund','Restriction','TY Sent']];
    (c.donors||[]).forEach(function(d){(d.donations||[]).forEach(function(dn){dd.push([d.name,Number(dn.amt||0),dn.date||'',dn.fund||'',rstLabel(dn.rst),dn.ty||'']);});});
    if(dd.length>1)XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(dd),'Donation Detail');
  }

  if(type==='expdetail'){
    var er=header.concat([['Date','Description','Category','Amount','Fund','Check #','Grant','Project','Reconciled']]);
    var grMap={};(c.grants||[]).forEach(function(gr){grMap[gr.id]=gr.name;});
    var projMap={};(c.projects||[]).forEach(function(pr){projMap[pr.id]=pr.name;});
    exp.slice().sort(function(a,b){return(b.date||'').localeCompare(a.date||'');}).forEach(function(e){er.push([e.date||'',e.desc||'',e.cat||'',Number(e.amt||0),e.fund||'',e.checkNum||'',e.grantId?grMap[e.grantId]||'':'',e.projectId?projMap[e.projectId]||'':'',e.reconciled?'Yes':'No']);});
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(er),'Expense Detail');
  }

  if(type==='incdetail'){
    var ir=header.concat([['Date','Name','Category','Projected','Received/Actual','Fund','Status','Reconciled']]);
    inc.forEach(function(r){var proj=Number(r.proj||r.amt||0);var recv=c.type==='sb'?Number(r.act||0):c.type==='pe'?Number(r.amt||0):Number(r.recv||0);ir.push([r.date||'',r.name||'',r.cat||'',proj,recv,r.fund||'',r.status||'',r.reconciled?'Yes':'No']);});
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(ir),'Income Detail');
  }

  if(type==='vendor'){
    var vmap2={};exp.forEach(function(e){var v=e.vendor1099||e.desc||'Unknown';vmap2[v]=(vmap2[v]||0)+Number(e.amt||0);});
    var vr=header.concat([['Vendor','Total']]);Object.keys(vmap2).sort(function(a,b){return vmap2[b]-vmap2[a];}).forEach(function(v){vr.push([v,vmap2[v]]);});
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(vr),'Vendor Summary');
  }

  if(type==='1099'){
    var v99={};exp.filter(function(e){return e.is1099;}).forEach(function(e){var v=e.vendor1099||e.desc||'Unknown';v99[v]=(v99[v]||0)+Number(e.amt||0);});
    var r99=header.concat([['Vendor','Total Paid','1099 Required']]);Object.keys(v99).sort().forEach(function(v){r99.push([v,v99[v],v99[v]>=600?'Yes':'No']);});
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(r99),'1099 Contractors');
  }

  if(type==='fundpl'&&c.type==='np'){
    var funds=c.funds||[];
    var allInc=c.income||[];var allExp=c.expenses||[];
    var fr=header.concat([['Fund','Type','Income','Expenses','Net']]);
    var fundNames=funds.map(function(f){return f.name;});
    fundNames.concat(['']).forEach(function(fname){
      var label=fname||'Unassigned';
      var fInc=allInc.filter(function(r){return(r.fund||'')=== fname;}).reduce(function(s,r){return s+Number(r.recv||0);},0);
      var fExp=allExp.filter(function(e){return(e.fund||'')=== fname;}).reduce(function(s,e){return s+Number(e.amt||0);},0);
      if(fInc||fExp)fr.push([label,fname?(funds.find(function(f){return f.name===fname;})||{}).type||'':'Unassigned',fInc,fExp,fInc-fExp]);
    });
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(fr),'Fund P&L');
  }

  if(type==='projpl'){
    var pr=header.concat([['Project','Income','Expenses','Net']]);
    (c.projects||[]).forEach(function(proj){var pe=exp.filter(function(e){return e.projectId===proj.id;}).reduce(function(s,e){return s+Number(e.amt||0);},0);var pi=((c.type==='sb'?c.revenue:c.income)||[]).filter(function(r){return r.projectId===proj.id;}).reduce(function(s,r){return s+Number(c.type==='sb'?r.act:r.recv||r.amt||0);},0);pr.push([proj.name,pi,pe,pi-pe]);});
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(pr),'Project P&L');
  }

  if(!wb.SheetNames.length){
    // fallback — at least add P&L
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(header),'Report');
  }
  XLSX.writeFile(wb,c.name.replace(/[^a-z0-9]/gi,'-')+'-'+type+'-report.xlsx');
}

// ══════════════════════════════════════════
// #5 — GRANT COMPLIANCE GAPS
// ══════════════════════════════════════════
function renderGrantCompliance(c){
  var p=g('p-compliance');if(!p)return;if(!c)return;
  var grants=c.grants||[];var exp=c.expenses||[];
  if(!grants.length){p.innerHTML=FB()+ES('No grants to review','Add grants first to track compliance gaps.','EI=-1;openM(\'m-grant\')');return;}
  var now=new Date();
  var cards=grants.map(function(gr){
    var gExp=exp.filter(function(e){return e.grantId===gr.id;});
    var spent=gExp.reduce(function(s,e){return s+Number(e.amt||0);},0);
    var awarded=Number(gr.awarded||0);
    var rem=awarded-spent;
    var drawPct=awarded>0?Math.round((spent/awarded)*100):0;
    var gaps=[];
    if(rem<0)gaps.push({sev:'red',msg:'Over-budget by '+fmt(Math.abs(rem))});
    if(drawPct<10&&gr.status==='In Progress')gaps.push({sev:'amber',msg:'Low drawdown ('+drawPct+'%) — funds may lapse'});
    var dl=gr.deadline?parseDate(gr.deadline):null;
    var daysLeft=dl?Math.floor((dl-now)/(1000*60*60*24)):null;
    if(daysLeft!==null&&daysLeft<30&&daysLeft>=0)gaps.push({sev:'amber',msg:'Deadline in '+daysLeft+' day'+(daysLeft===1?'':'s')});
    if(daysLeft!==null&&daysLeft<0)gaps.push({sev:'red',msg:'Deadline passed '+Math.abs(daysLeft)+' day'+(Math.abs(daysLeft)===1?'':'s')+' ago'});
    if(gr.restrict&&gExp.some(function(e){return!e.cat||e.cat==='Admin'||e.cat==='Operations';}))gaps.push({sev:'amber',msg:'Restricted grant — verify admin expenses comply'});
    var unrecon=gExp.filter(function(e){return!e.reconciled;}).length;
    if(unrecon>0)gaps.push({sev:'gray',msg:unrecon+' unreconciled expense'+(unrecon===1?'':'s')});
    if(gr.status==='Awarded'&&spent===0)gaps.push({sev:'amber',msg:'Awarded but no drawdown started'});
    var sevColor={red:'var(--red)',amber:'var(--amber)',gray:'var(--muted)'};
    var sevBg={red:'var(--red-bg)',amber:'var(--amber-bg)',gray:'var(--gray-bg)'};
    var gapHtml=gaps.length?gaps.map(function(gp){return'<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--soft)"><span style="width:8px;height:8px;border-radius:50%;background:'+sevColor[gp.sev]+';flex-shrink:0;display:inline-block"></span><span style="font-size:12px;color:'+sevColor[gp.sev]+'">'+gp.msg+'</span></div>';}).join(''):'<div style="font-size:12px;color:var(--green);padding:4px 0"><i class="fas fa-check"></i> No compliance gaps detected</div>';
    return'<div class="card" style="'+(gaps.some(function(gp){return gp.sev==='red';})?' border-left:3px solid var(--red);':'')+(gaps.some(function(gp){return gp.sev==='amber';})&&!gaps.some(function(gp){return gp.sev==='red';})?' border-left:3px solid var(--amber);':'')+'"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.75rem;gap:8px;flex-wrap:wrap"><div><div style="font-size:13px;font-weight:500">'+escHtml(gr.name)+'</div><div style="font-size:11px;color:var(--muted)">'+( gr.funder||'')+(gr.deadline?' · Due: '+gr.deadline:'')+'</div></div>'+SB(gr.status||'')+'</div><div class="metrics" style="margin-bottom:.75rem"><div class="metric"><div class="m-lbl">Awarded</div><div class="m-val">'+fmt(awarded)+'</div></div><div class="metric"><div class="m-lbl">Spent</div><div class="m-val vr">'+fmt(spent)+'</div></div><div class="metric"><div class="m-lbl">Remaining</div><div class="m-val '+(rem>=0?'vg':'vr')+'">'+fmt(rem)+'</div></div></div><div style="margin-bottom:.5rem"><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px"><span>Drawdown</span><span>'+drawPct+'%</span></div><div class="pbar" style="height:6px"><div class="pfill" style="width:'+Math.min(drawPct,100)+'%;background:'+(drawPct>90?'var(--red)':drawPct>60?'var(--amber)':'var(--green)')+'"></div></div></div>'+gapHtml+'</div>';
  }).join('');
  p.innerHTML=FB()+XB('procurement')+'<div class="insight"><div class="ins-lbl">Grant compliance gaps</div>Flags drawdown issues, restriction violations, deadline risks, and unreconciled expenses across all grants.</div>'+cards;
}

// ══════════════════════════════════════════
// #7 — MULTI-YEAR BUDGET
// ══════════════════════════════════════════
var BUDGET_FY='current';
var BUDGET_VIEW='current'; // 'current' | 'proposed' | 'adopted'
var PROPOSED_FY=''; // which future FY is being edited in proposed view

function adoptBudget(){
  var c=gc();if(!c)return;
  // Migrate legacy if needed
  if(!c.proposedBudgets)c.proposedBudgets=[];
  var prop=PROPOSED_FY?c.proposedBudgets.find(function(p){return p.fy===PROPOSED_FY;}):c.proposedBudgets[0];
  if(!prop||!prop.items.length){alert('No proposed budget to adopt. Add line items first.');return;}
  if(!confirm('Adopt '+prop.fy+' proposed budget as the new current budget?'))return;
  var fy=getFiscalYear(c.fiscalYearEnd);
  if(c.budgetItems&&c.budgetItems.length){
    if(!c.adoptedBudgets)c.adoptedBudgets=[];
    c.adoptedBudgets.push({fy:fy.label,items:c.budgetItems.slice(),adoptedOn:today()});
  }
  c.budgetItems=prop.items.slice();
  c.proposedBudgets=c.proposedBudgets.filter(function(p){return p.fy!==prop.fy;});
  sv();BUDGET_VIEW='current';renderBudgetMultiYear();
  alert(prop.fy+' budget adopted as current budget.');
}
function saveProposedBudget(){
  var c=gc();if(!c.proposedBudgets)c.proposedBudgets=[];
  var _bcRaw=g('b-c').value.trim();if(!_bcRaw)return;
  var _bcParts=_bcRaw.indexOf('::')>=0?_bcRaw.split('::'):['',_bcRaw];
  var cat=_bcParts.slice(1).join('::').trim();if(!cat)cat=_bcRaw;
  // Read type from selected option — b-t can drift
  var _bcSel=g('b-c');var _selOpt=_bcSel&&_bcSel.options[_bcSel.selectedIndex];
  var type=(_selOpt&&_selOpt.getAttribute('data-acct-type'))||g('b-t').value||'Expense';
  var grp=g('b-g').value.trim()||type;
  var amt=Number(g('b-a').value||0);
  var fy=PROPOSED_FY||('FY '+(new Date().getFullYear()+1));
  var pb=c.proposedBudgets.find(function(p){return p.fy===fy;});
  if(!pb){pb={fy:fy,items:[]};c.proposedBudgets.push(pb);}
  // Edit mode: find by original identity so category changes don't create duplicates
  var ex=EI>=0?pb.items.find(function(b){return b.cat===_BUDGET_EDIT_CAT&&b.type===_BUDGET_EDIT_TYPE;}):null;
  if(!ex)ex=pb.items.find(function(b){return b.cat===cat&&b.type===type;});
  if(ex){
    if(!ex.audit)ex.audit=[];
    var ts=new Date().toISOString();
    if(String(ex.amt)!==String(amt))ex.audit.push({field:'amt',oldValue:String(ex.amt),newValue:String(amt),timestamp:ts});
    if(ex.group!==grp)ex.audit.push({field:'group',oldValue:ex.group||'',newValue:grp,timestamp:ts});
    ex.cat=cat;ex.type=type;ex.amt=amt;ex.group=grp;ex.overspendPolicy=g('b-overspend')&&g('b-overspend').value||'warn';
  }else{
    pb.items.push({cat:cat,type:type,amt:amt,group:grp,overspendPolicy:g('b-overspend')&&g('b-overspend').value||'warn',audit:[]});
    syncBudgetToCOA(c,cat,type,grp);
  }
  EI=-1;_BUDGET_EDIT_CAT='';_BUDGET_EDIT_TYPE='';
  sv();renderBudgetMultiYear();closeM('m-budget');['b-c','b-a','b-g'].forEach(function(id){g(id).value='';});
}
function editProposedBudgetLine(oi){
  var c=gc();if(!c)return;
  var pb=c.proposedBudgets.find(function(p){return p.fy===PROPOSED_FY;});
  if(!pb||!pb.items[oi])return;
  var b=pb.items[oi];
  _BUDGET_EDIT_CAT=b.cat||'';_BUDGET_EDIT_TYPE=b.type||'Expense';
  EI=1;
  var bc=g('b-c'),bg=g('b-g');
  var _coaProp=(c.accounts||[]).find(function(a){return(a.cat===b.cat||a.name===b.cat)&&a.type===(b.type==='Income'?'Income':'Expense');});
  var _pendingProp=_coaProp?(_coaProp.code+'::'+b.cat):b.cat;
  if(bc)bc.setAttribute('data-pending-val',_pendingProp);
  if(bg)bg.setAttribute('data-pending-val',b.group||'');
  g('b-t').value=b.type||'Expense';
  g('b-a').value=b.amt||'';
  if(g('b-fund'))g('b-fund').value=b.fund||'';
  if(g('b-overspend'))g('b-overspend').value=b.overspendPolicy||'warn';
  openM('m-budget');
}
function openProposedBudgetAudit(oi){
  var c=gc();if(!c)return;
  var pb=c.proposedBudgets.find(function(p){return p.fy===PROPOSED_FY;});
  if(!pb||!pb.items[oi])return;
  var log=pb.items[oi].audit||[];
  var labels={amt:'Amount',group:'Group'};
  var rows=log.length
    ?log.map(function(e){return'<tr><td style="white-space:nowrap;font-size:10px;color:var(--muted)">'+(e.timestamp?e.timestamp.replace('T',' ').slice(0,19):'—')+'</td><td>'+(labels[e.field]||e.field)+'</td><td style="color:var(--muted)">'+(e.oldValue||'—')+'</td><td>'+(e.newValue||'—')+'</td></tr>';}).join('')
    :'<tr><td colspan="4" style="text-align:center;padding:1.5rem;color:var(--muted);font-size:12px">No edit history yet.</td></tr>';
  g('audit-log-body').innerHTML=rows;
  openM('m-audit');
}
function openBudgetFromActuals(cat,type){
  var c=gc();if(!c)return;
  var acct=(c.accounts||[]).find(function(a){return(a.cat===cat||a.name===cat)&&a.type===(type==='Income'?'Income':'Expense');});
  var pv=acct?(acct.code+'::'+cat):cat;
  EI=-1;
  var el=g('b-c');if(el)el.setAttribute('data-pending-val',pv);
  var bt=g('b-t');if(bt)bt.value=type;
  openM('m-budget');
}
function toggleBudgetDrill(safeId,cat,type){
  var row=document.getElementById('bud-drill-'+safeId);
  var body=document.getElementById('bud-drill-body-'+safeId);
  if(!row||!body)return;
  if(row.style.display!=='none'){row.style.display='none';return;}
  var c=gc();if(!c)return;
  var items=[];
  if(type==='Expense'){
    items=(c.expenses||[]).map(function(e,i){return{i:i,item:e};}).filter(function(x){return x.item.cat===cat&&!x.item.deleted&&!x.item.voided;});
  }else{
    var src=c.type==='sb'?(c.revenue||[]):(c.income||[]);
    var itype=c.type==='sb'?'revenue':'income';
    items=src.map(function(r,i){return{i:i,item:r,itype:itype};}).filter(function(x){return x.item.cat===cat&&!x.item.deleted;});
  }
  if(!items.length){body.innerHTML='<div style="font-size:12px;color:var(--muted);padding:.5rem 0">No transactions in this category yet.</div>';row.style.display='';return;}
  var rows=items.map(function(x){
    var it=x.item;
    var amt=type==='Expense'?Number(it.amt||0):(c.type==='sb'?Number(it.act||0):Number(it.recv||it.amt||0));
    var desc=escHtml(it.desc||it.name||'—');
    var date=it.date||'—';
    var editType=type==='Expense'?'expenses':(x.itype||'income');
    return'<tr style="font-size:12px"><td style="color:var(--muted);width:90px">'+date+'</td><td>'+desc+'</td><td style="text-align:right;width:90px;color:'+(type==='Expense'?'var(--red)':'var(--green)')+'">'+fmt(amt)+'</td><td style="width:60px;text-align:right"><button class="add-btn" style="font-size:10px;padding:2px 7px" onclick="editItem(\''+editType+'\','+x.i+')"><i class="fas fa-pen"></i> Edit</button></td></tr>';
  }).join('');
  body.innerHTML='<table style="width:100%;border-collapse:collapse"><thead><tr style="font-size:11px;color:var(--muted)"><th style="text-align:left;padding-bottom:4px">Date</th><th style="text-align:left">Description</th><th style="text-align:right">Amount</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>';
  row.style.display='';
}

function renderBudgetMultiYear(){
  var p=g('p-budget');if(!p)return;var c=gc();if(!c)return;
  var fy=getFiscalYear(c.fiscalYearEnd);
  var buds=c.budgetItems||[];
  buds.forEach(function(b){if(!b.group)b.group=b.type;});
  var iD={},eD={};
  var allInc=(c.type==='sb'?c.revenue||[]:c.income||[]);
  var allExp=c.expenses||[];
  function inFY(item){
    // If viewing a past adopted FY, filter by that year's items (no actuals filter needed — show all)
    var d=parseDate(item.date||item.recurKey||'');if(!d)return true;
    if(typeof BUDGET_FY!=='undefined'&&BUDGET_FY&&BUDGET_FY.indexOf('fy:')=== 0){
      var fyLabel=BUDGET_FY.slice(3);var ab=(c.adoptedBudgets||[]).find(function(a){return a.fy===fyLabel;});
      if(ab){return true;}// show all actuals when viewing historical FY
    }
    return d>=fy.start&&d<=fy.end;
  }
  var fInc=typeof BUDGET_FY!=='undefined'&&BUDGET_FY&&BUDGET_FY.indexOf('fy:')=== 0?allInc:allInc.filter(inFY);
  var fExp=typeof BUDGET_FY!=='undefined'&&BUDGET_FY&&BUDGET_FY.indexOf('fy:')=== 0?allExp:allExp.filter(inFY);
  // Use basisInc() so income actuals respect client's cash/accrual setting
  if(c.type==='np'){fInc.forEach(function(r){var k=r.cat||'Other';if(!iD[k])iD[k]=0;iD[k]+=basisInc(c,r);});(c.grants||[]).forEach(function(gr){var _ga=_grantPnlAward(c,fInc,gr);if(!_ga)return;if(!iD['Grants'])iD['Grants']=0;iD['Grants']+=_ga;});fExp.forEach(function(r){var k=r.cat||'Other';if(!eD[k])eD[k]=0;eD[k]+=Number(r.amt||0);});}
  else if(c.type==='sb'){fInc.forEach(function(r){var k=r.cat||'Other';if(!iD[k])iD[k]=0;iD[k]+=basisInc(c,r);});fExp.forEach(function(r){var k=r.cat||'Other';if(!eD[k])eD[k]=0;eD[k]+=Number(r.amt||0);});}
  else{fInc.forEach(function(r){var k=r.cat||'Other';if(!iD[k])iD[k]=0;iD[k]+=basisInc(c,r);});fExp.forEach(function(r){var k=r.cat||'Other';if(!eD[k])eD[k]=0;eD[k]+=Number(r.amt||0);});}
  var hb=buds.length>0;
  var hasActuals=(Object.keys(iD).some(function(k){return iD[k]>0;})||Object.keys(eD).some(function(k){return eD[k]>0;}));
  var showVariance=hb&&hasActuals;
  var th=showVariance?'<tr><th style="width:28%">Line item</th><th style="width:9%">Code</th><th style="width:16%">Actual</th><th style="width:16%">Budgeted</th><th style="width:16%">Variance</th><th style="width:15%"></th></tr>':hb?'<tr><th style="width:42%">Line item</th><th style="width:12%">Code</th><th style="width:28%">Budgeted</th><th style="width:18%"></th></tr>':'<tr><th style="width:42%">Line item</th><th style="width:12%">Code</th><th style="width:28%">Actual</th><th style="width:18%"></th></tr>';
  function vc(bud,act,isExp){if(bud===null)return'<td style="color:var(--muted);font-style:italic;font-size:11px">—</td><td style="color:var(--muted);font-style:italic;font-size:11px">Set budget</td>';var v=isExp?(Number(bud)-act):(act-Number(bud));return'<td>'+fmt(bud)+'</td><td class="'+(v>=0?'vpos':'vneg')+'">'+(v>=0?'+':'')+fmt(v)+'</td>';}
  // Build groups
  var groups={};
  buds.forEach(function(b){var gk=b.group||b.type;if(!groups[gk])groups[gk]={type:b.type,items:[]};groups[gk].items.push(b);});
  var budCats=buds.map(function(b){return b.cat;});
  Object.keys(iD).forEach(function(k){if(budCats.indexOf(k)<0){if(!groups['Income'])groups['Income']={type:'Income',items:[]};if(!groups['Income'].items.find(function(i){return i.cat===k;}))groups['Income'].items.push({cat:k,type:'Income',amt:null,group:'Income'});}});
  Object.keys(eD).forEach(function(k){if(budCats.indexOf(k)<0){if(!groups['Expense'])groups['Expense']={type:'Expense',items:[]};if(!groups['Expense'].items.find(function(i){return i.cat===k;}))groups['Expense'].items.push({cat:k,type:'Expense',amt:null,group:'Expense'});}});
  var grandActInc=0,grandBudInc=0,grandActExp=0,grandBudExp=0;
  var sections=Object.keys(groups).map(function(grpName){
    var grp=groups[grpName];var isExp=grp.items.every(function(b){return b.type==='Expense';});
    // Sort items within group by COA code
    grp.items.sort(function(a,b){
      var acctA=(c.accounts||[]).find(function(x){return x.cat===a.cat||x.name===a.cat;});
      var acctB=(c.accounts||[]).find(function(x){return x.cat===b.cat||x.name===b.cat;});
      return(acctA?acctA.code:'zzz').localeCompare(acctB?acctB.code:'zzz');
    });
    var grpActInc=0,grpBudInc=0,grpActExp=0,grpBudExp=0;
    var rows=grp.items.map(function(b){
      var act=b.type==='Expense'?(eD[b.cat]||0):(iD[b.cat]||0);
      var bud=b.amt!==null&&b.amt!==undefined?Number(b.amt||0):null;
      if(b.type==='Expense'){grpActExp+=act;if(bud!==null)grpBudExp+=bud;}else{grpActInc+=act;if(bud!==null)grpBudInc+=bud;}
      var bi=(c.budgetItems||[]).indexOf(b);
      // Look up account code for this budget line
      var acct2=(c.accounts||[]).find(function(a){return a.cat===b.cat||a.name===b.cat;});
      var codeCell='<td style="font-size:11px;color:var(--muted)">'+(acct2?'<span style="font-family:monospace;background:var(--soft);padding:1px 5px;border-radius:4px;cursor:pointer" onclick="editBudgetLine('+(bi>=0?bi:'EI=-1;openM(\'m-budget\')')+')" title="Edit account code">'+acct2.code+'</span>':'<span style="color:var(--border)">—</span>')+'</td>';
      // FIX-4: only show edit/delete buttons for real budget items (bi>=0); virtual actuals-only rows have bi===-1
      var acts=bi>=0
        ?'<td><div class="row-acts"><button class="e-btn" onclick="editBudgetLine('+bi+')" title="Edit">&#9998;</button><button class="d-btn" onclick="delBudgetLine('+bi+')" title="Delete">&#215;</button></div></td>'
        :'<td><div class="row-acts"><button class="add-btn" style="font-size:10px;padding:2px 7px" onclick="openBudgetFromActuals(\''+b.cat.replace(/'/g,'\\\'')+'\',\''+b.type+'\')" title="Add to budget">+ Budget</button></div></td>';
      // Planning view (no actuals): show budgeted only
      if(!showVariance&&hb)return'<tr><td style="padding-left:1rem">'+escHtml(b.cat)+'</td>'+codeCell+'<td>'+fmt(bud||0)+'</td>'+acts+'</tr>';
      var _safeId=b.cat.replace(/[^a-zA-Z0-9]/g,'-');
      var _actCell=act>0?'<span style="cursor:pointer;color:var(--blue);text-decoration:underline;font-weight:500" onclick="toggleBudgetDrill(\''+_safeId+'\',\''+b.cat.replace(/\'/g,"\\\\'")+'\'\,\''+b.type+'\')" title="Click to see transactions">'+fmt(act)+'</span>':fmt(act);
      var _drillRow='<tr id="bud-drill-'+_safeId+'" style="display:none"><td colspan="6" style="padding:0"><div id="bud-drill-body-'+_safeId+'" style="background:var(--bg);border-top:1px solid var(--border);padding:.75rem 1rem"></div></td></tr>';
      return'<tr><td style="padding-left:1rem">'+escHtml(b.cat)+'</td>'+codeCell+'<td>'+_actCell+'</td>'+(showVariance?vc(bud,act,b.type==='Expense'):'')+acts+'</tr>'+_drillRow;
    }).join('');
    grandActInc+=grpActInc;grandBudInc+=grpBudInc;grandActExp+=grpActExp;grandBudExp+=grpBudExp;
    var grpAct=isExp?(grpActExp):(grpActInc-grpActExp||grpActInc);
    var grpBud=isExp?(grpBudExp):(grpBudInc-grpBudExp||grpBudInc);
    var grpV=isExp?(grpBud-grpAct):(grpAct-grpBud);
    var totCell=(!showVariance&&hb)?'<td>'+fmt(grpBud)+'</td>':'<td>'+fmt(grpAct)+'</td>'+(showVariance?'<td>'+fmt(grpBud)+'</td><td class="'+(grpV>=0?'vpos':'vneg')+'">'+(grpV>=0?'+':'')+fmt(grpV)+'</td>':'');
    return'<div class="card" style="margin-bottom:1rem">'
    +'<div class="c-head"><span class="c-title">'+grpName+'</span><button class="add-btn" onclick="var _bg=g(\'b-g\');if(_bg)_bg.setAttribute(\'data-pending-val\',\''+grpName.replace(/'/g,'')+'\');g(\'b-t\').value=\''+(isExp?'Expense':'Income')+'\';openM(\'m-budget\')">+ Add line</button></div>'
    +'<table class="bud-tbl"><thead>'+th+'</thead><tbody>'+rows
    +'<tr class="bud-total"><td>'+grpName+' total</td>'+totCell+'</tr>'
    +'</tbody></table></div>';
  }).join('');
  var nA=(grandActInc-grandActExp),nB=(grandBudInc-grandBudExp),nV=nA-nB;
  var nextFY='FY '+(new Date().getFullYear()+1);
  var adopted=c.adoptedBudgets||[];
  // View toggle bar
  var toggleBar='<div style="display:flex;gap:6px;margin-bottom:1rem;flex-wrap:wrap">'
  +'<button class="'+(BUDGET_VIEW==='current'?'sv-btn':'add-btn')+'" style="font-size:12px;padding:6px 14px" onclick="BUDGET_VIEW=\'current\';renderBudgetMultiYear()">Current budget</button>'
  +'<button class="'+(BUDGET_VIEW==='proposed'?'sv-btn':'add-btn')+'" style="font-size:12px;padding:6px 14px" onclick="BUDGET_VIEW=\'proposed\';renderBudgetMultiYear()">Proposed'+(c.proposedBudgets&&c.proposedBudgets.length?' ('+c.proposedBudgets.length+' draft'+(c.proposedBudgets.length>1?'s':'')+')':(c.proposedBudget&&c.proposedBudget.length?' (draft)':''))+'</button>'
  +(adopted.length?'<button class="'+(BUDGET_VIEW==='adopted'?'sv-btn':'add-btn')+'" style="font-size:12px;padding:6px 14px" onclick="BUDGET_VIEW=\'adopted\';renderBudgetMultiYear()">Past adopted ('+adopted.length+')</button>':'')
  +'<button class="'+(BUDGET_VIEW==='projects'?'sv-btn':'add-btn')+'" style="font-size:12px;padding:6px 14px" onclick="BUDGET_VIEW=\'projects\';renderBudgetMultiYear()">Projects/Events'+(c.projects&&c.projects.length?' ('+c.projects.length+')':'')+'</button>'
  +'</div>';

  // Projects view
  if(BUDGET_VIEW==='projects'){
    p.innerHTML=FB()+XB('budget')+toggleBar+renderProjectsHTML(c);
    return;
  }

  // Proposed view — multi-year
  if(BUDGET_VIEW==='proposed'){
    if(!c.proposedBudgets)c.proposedBudgets=[];
    var curYear=new Date().getFullYear();
    // Ensure PROPOSED_FY is valid; default to earliest existing or next year
    var existingFYs=c.proposedBudgets.map(function(p){return p.fy;});
    if(!PROPOSED_FY||existingFYs.indexOf(PROPOSED_FY)<0){PROPOSED_FY=existingFYs.length?existingFYs[0]:'FY '+(curYear+1);}
    // FY selector tabs for proposed years
    var fyTabs=['FY '+(curYear+1),'FY '+(curYear+2),'FY '+(curYear+3)].map(function(fyl){
      var hasDraft=c.proposedBudgets.find(function(p){return p.fy===fyl;});
      return'<button class="'+(PROPOSED_FY===fyl?'sv-btn':'add-btn')+'" style="font-size:11px;padding:4px 12px" onclick="PROPOSED_FY=\''+fyl+'\';renderBudgetMultiYear()">'+fyl+(hasDraft?' <i class="fas fa-pen"></i>':'')+'</button>';
    }).join('');
    var prop=c.proposedBudgets.find(function(p){return p.fy===PROPOSED_FY;})||{fy:PROPOSED_FY,items:[]};
    var propItems=prop.items||[];
    // Sort by COA code before grouping so indexes and display order are both correct
    propItems.sort(function(a,b){
      var acctA=(c.accounts||[]).find(function(x){return x.cat===a.cat||x.name===a.cat;});
      var acctB=(c.accounts||[]).find(function(x){return x.cat===b.cat||x.name===b.cat;});
      return(acctA?acctA.code:'zzz').localeCompare(acctB?acctB.code:'zzz');
    });
    var propGroups={};
    propItems.forEach(function(b){var gk=b.group||b.type;if(!propGroups[gk])propGroups[gk]={type:b.type,items:[]};propGroups[gk].items.push(b);});
    var propTotal=propItems.reduce(function(s,b){return s+(b.type==='Income'?1:-1)*Number(b.amt||0);},0);
    var propSections=Object.keys(propGroups).map(function(grpName){
      var grp=propGroups[grpName];var isExp=grp.items.every(function(b){return b.type==='Expense';});
      var grpTot=grp.items.reduce(function(s,b){return s+Number(b.amt||0);},0);
      var rows=grp.items.map(function(b){
        var oi=propItems.indexOf(b);
        var hasAudit=b.audit&&b.audit.length>0;
        var acctP=(c.accounts||[]).find(function(a){return a.cat===b.cat||a.name===b.cat;});
        var codeCellP='<td style="font-size:11px;color:var(--muted)">'+(acctP?'<span style="font-family:monospace;background:var(--soft);padding:1px 5px;border-radius:4px;">'+acctP.code+'</span>':'<span style="color:var(--border)">—</span>')+'</td>';
        return'<tr><td style="padding-left:1rem">'+escHtml(b.cat)+'</td>'+codeCellP+'<td>'+fmt(b.amt)+'</td>'
        +'<td><div class="row-acts">'
        +(hasAudit?'<button class="e-btn" onclick="openProposedBudgetAudit('+oi+')" title="Edit history">&#128221;</button>':'')
        +'<button class="e-btn" onclick="editProposedBudgetLine('+oi+')" title="Edit">&#9998;</button>'
        +'<button class="d-btn" onclick="(function(){var c=gc();var pb=c.proposedBudgets.find(function(p){return p.fy===\''+PROPOSED_FY+'\';});if(pb)pb.items.splice('+oi+',1);sv();renderBudgetMultiYear();})()">&#215;</button>'
        +'</div></td></tr>';
      }).join('');
      return'<div class="card" style="margin-bottom:1rem">'
      +'<div class="c-head"><span class="c-title">'+grpName+'</span>'
      +'<button class="add-btn" onclick="var _bg2=g(\'b-g\');if(_bg2)_bg2.setAttribute(\'data-pending-val\',\''+grpName.replace(/'/g,'')+'\');g(\'b-t\').value=\''+(isExp?'Expense':'Income')+'\';openM(\'m-budget\')">+ Add line</button></div>'
      +'<table class="bud-tbl"><thead><tr><th style="width:42%">Line item</th><th style="width:12%">Code</th><th style="width:28%">Budgeted</th><th style="width:18%"></th></tr></thead>'
      +'<tbody>'+rows+'<tr class="bud-total"><td>'+grpName+' total</td><td>'+fmt(grpTot)+'</td><td></td></tr></tbody></table></div>';
    }).join('');
    p.innerHTML=FB()+XB('budget')+toggleBar
    +'<div style="display:flex;gap:6px;margin-bottom:1rem;flex-wrap:wrap;align-items:center"><span style="font-size:12px;color:var(--muted)">Year:</span>'+fyTabs+'</div>'
    +'<div class="insight" style="border-left-color:var(--blue)"><div class="ins-lbl">Proposed — '+PROPOSED_FY+'</div>Build this year\'s proposed budget. Adopt it to make it the active budget.'
    +(propItems.length?'<button class="sv-btn" style="margin-left:1rem;background:var(--green);font-size:12px;padding:6px 14px" onclick="adoptBudget()"><i class="fas fa-check"></i> Adopt '+PROPOSED_FY+'</button>':'')+'</div>'
    +'<div class="xbar" style="margin-bottom:.75rem"><button class="xbtn p" onclick="openM(\'m-budget\')">+ Add line item</button></div>'
    +(propItems.length?propSections+'<div class="card"><table class="bud-tbl"><tbody><tr class="bud-net"><td>'+nl(c.type)+'</td><td class="'+(propTotal>=0?'vg':'vr')+'">'+fmt(propTotal)+'</td></tr></tbody></table></div>'
    :'<div class="insight" style="border-left-color:var(--amber)"><div class="ins-lbl">No proposed budget for '+PROPOSED_FY+'</div>Click "+ Add line item" to start.</div>');
    return;
  }

  // Adopted history view
  if(BUDGET_VIEW==='adopted'){
    var adHTML=adopted.length?adopted.slice().reverse().map(function(ab,i){
      var tot=ab.items.reduce(function(s,b){return s+(b.type==='Income'?1:-1)*Number(b.amt||0);},0);
      var rows=ab.items.map(function(b){return'<tr><td style="padding-left:1rem">'+escHtml(b.cat)+'</td><td style="color:var(--muted);font-size:11px">'+b.type+'</td><td>'+fmt(b.amt)+'</td></tr>';}).join('');
      return'<div class="card" style="margin-bottom:1rem"><div class="c-head"><span class="c-title">'+ab.fy+'</span><span style="font-size:11px;color:var(--muted)">Adopted '+ab.adoptedOn+'</span></div>'
      +'<table class="bud-tbl"><thead><tr><th style="width:50%">Line item</th><th style="width:20%">Type</th><th style="width:30%">Amount</th></tr></thead><tbody>'+rows
      +'<tr class="bud-total"><td colspan="2">Net</td><td class="'+(tot>=0?'vg':'vr')+'">'+fmt(tot)+'</td></tr></tbody></table></div>';
    }).join(''):'<div class="insight"><div class="ins-lbl">No adopted budgets yet</div>Adopted budgets are archived here for reference.</div>';
    p.innerHTML=FB()+XB('budget')+toggleBar+adHTML;
    return;
  }

  // Current view (default)
  // Build FY dropdown from adopted budget history
  var adopted=c.adoptedBudgets||[];
  var fyOpts='<option value="current">'+fy.label+' (current)</option>';
  adopted.slice().reverse().forEach(function(ab){fyOpts+='<option value="fy:'+ab.fy+'"'+(BUDGET_FY==='fy:'+ab.fy?' selected':'')+'>'+ab.fy+'</option>';});
  // ── Budget summary cover card — built AFTER sections so grand totals are populated ─
  var sumInc=hb?grandBudInc:grandActInc;
  var sumExp=hb?grandBudExp:grandActExp;
  var sumNet=sumInc-sumExp;
  var coverCard='<div class="card" style="margin-bottom:1rem">'
    +'<div class="c-title" style="margin-bottom:.75rem">'+fy.label+' Budget Summary</div>'
    +'<div class="metrics">'
    +'<div class="metric"><div class="m-lbl">'+(c.type==='sb'?'Total revenue':'Total income')+(hb?' (budgeted)':' (actual)')+'</div><div class="m-val vg">'+fmt(sumInc)+'</div></div>'
    +'<div class="metric"><div class="m-lbl">Total expenses'+(hb?' (budgeted)':' (actual)')+'</div><div class="m-val vr">'+fmt(sumExp)+'</div></div>'
    +'<div class="metric"><div class="m-lbl">'+nl(c.type)+'</div><div class="m-val '+(sumNet>=0?'vg':'vr')+'">'+fmt(sumNet)+'</div></div>'
    +(showVariance?'<div class="metric"><div class="m-lbl">Actual surplus / deficit</div><div class="m-val '+(nA>=0?'vg':'vr')+'">'+fmt(nA)+'</div></div>':'')
    +'</div>'
    +(showVariance?'<div style="margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--soft);display:flex;gap:2rem;flex-wrap:wrap">'
      +'<div><span style="font-size:11px;color:var(--muted)">Budget vs actual variance: </span><span style="font-size:13px;font-weight:500;color:'+(nV>=0?'var(--green)':'var(--red)')+'">'+( nV>=0?'+':'')+fmt(nV)+'</span></div>'
      +'<div><span style="font-size:11px;color:var(--muted)">Budget utilization: </span><span style="font-size:13px;font-weight:500">'+(grandBudExp>0?Math.round((grandActExp/grandBudExp)*100):0)+'%</span></div>'
    +'</div>':'')
    +'</div>';

  var _budBasis=(typeof RPT_BASIS!=='undefined'&&RPT_BASIS)?RPT_BASIS:(c.basisType||'cash');
  var _basisBadge='<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:'+(_budBasis==='accrual'?'#e3f2fd;color:#1565c0':'#e8f5e9;color:#2e7d32')+'">'+(  _budBasis==='accrual'?'Accrual basis':'Cash basis')+'</span>';
  p.innerHTML=FB()+XB('budget')
  +toggleBar
  +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:1rem;flex-wrap:wrap"><span style="font-size:12px;color:var(--muted)">Fiscal year:</span><div class="sw"><select onchange="BUDGET_FY=this.value;renderBudgetMultiYear()">'+fyOpts+'</select></div><span style="font-size:11px;color:var(--muted)">FY ends '+fyeLabel(c.fiscalYearEnd)+'</span>'+_basisBadge+'</div>'
  +'<div class="xbar" style="margin-bottom:.75rem"><button class="xbtn p" onclick="EI=-1;openM(\'m-budget\')">+ Add line item</button>'+(c.type!=='pe'?'<button class="xbtn" onclick="openFYEReview()">FY close review</button>':'')+' </div>'
  +coverCard
  +(hb&&!hasActuals?'<div class="insight" style="border-left-color:var(--blue);margin-bottom:1rem"><div class="ins-lbl">Planning view</div>No transactions recorded yet — showing budgeted amounts only. Variance column will appear once transactions are added.</div>':'')
  +sections
  +(buds.length?'<div class="card"><table class="bud-tbl"><tbody><tr class="bud-net"><td style="font-size:14px">'+nl(c.type)+'</td>'+((!showVariance&&hb)?'<td style="font-size:14px" class="'+(nB>=0?'vg':'vr')+'">'+fmt(nB)+'</td>':'<td style="font-size:14px" class="'+(nA>=0?'vg':'vr')+'">'+fmt(nA)+'</td>'+(showVariance?'<td style="font-size:14px">'+fmt(nB)+'</td><td style="font-size:14px" class="'+(nV>=0?'vpos':'vneg')+'">'+(nV>=0?'+':'')+fmt(nV)+'</td>':''))+'</tr></tbody></table></div>':'');
}

// ══════════════════════════════════════════
// #15 — A/R + INVOICING (SB)
// ══════════════════════════════════════════
function renderAR(c){
  var p=g('p-ar');if(!p)return;if(!c)return;
  var invs=c.invoices||[];
  var filt=srchItems(invs,SRCH['p-ar']||'',['client','desc','status','num']);
  var totOut=invs.filter(function(i){return i.status!=='Paid';}).reduce(function(s,i){return s+Number(i.amt||0);},0);
  var totPaid=invs.filter(function(i){return i.status==='Paid';}).reduce(function(s,i){return s+Number(i.amt||0);},0);
  var overdue=invs.filter(function(i){return i.status!=='Paid'&&i.due&&isPast(i.due);}).length;
  // AR aging buckets
  var now=new Date();now.setHours(0,0,0,0);
  function daysPast(due){var d=parseDate(due);if(!d)return 0;d.setHours(0,0,0,0);return Math.floor((now-d)/86400000);}
  var open=invs.filter(function(i){return i.status!=='Paid';});
  var ag={cur:0,d30:0,d60:0,d90:0,d90p:0};
  open.forEach(function(i){var dp=i.due?daysPast(i.due):0;var a=Number(i.amt||0);if(dp<=0)ag.cur+=a;else if(dp<=30)ag.d30+=a;else if(dp<=60)ag.d60+=a;else if(dp<=90)ag.d90+=a;else ag.d90p+=a;});
  var agingHtml='<div class="card" style="margin-bottom:.75rem"><div class="c-title" style="margin-bottom:.75rem">A/R Aging Schedule</div><table><thead><tr><th>Current</th><th>1–30 days</th><th>31–60 days</th><th>61–90 days</th><th>90+ days</th><th>Total</th></tr></thead><tbody><tr><td style="color:var(--green)">'+fmt(ag.cur)+'</td><td style="color:'+(ag.d30>0?'var(--amber)':'var(--muted)')+'">'+fmt(ag.d30)+'</td><td style="color:'+(ag.d60>0?'var(--amber)':'var(--muted)')+'">'+fmt(ag.d60)+'</td><td style="color:'+(ag.d90>0?'var(--red)':'var(--muted)')+'">'+fmt(ag.d90)+'</td><td style="color:'+(ag.d90p>0?'var(--red)':'var(--muted)')+'">'+fmt(ag.d90p)+'</td><td style="font-weight:600">'+fmt(totOut)+'</td></tr></tbody></table></div>';
  var rows=filt.map(function(inv,fi){var oi=invs.indexOf(inv);var od=inv.status!=='Paid'&&inv.due&&isPast(inv.due);var dp=od?daysPast(inv.due):0;var ageLbl=od?(dp>90?'<span class="badge b-red">90+ days</span>':dp>60?'<span class="badge b-red">61–90d</span>':dp>30?'<span class="badge b-amber">31–60d</span>':'<span class="badge b-amber">1–30d</span>'):'';return'<tr><td style="font-weight:500">'+(inv.num||'—')+'</td><td>'+escHtml(inv.client||'—')+'</td><td>'+escHtml(inv.desc||'—')+'</td><td>'+fmt(inv.amt)+'</td><td style="color:var(--muted)">'+(inv.date||'—')+'</td><td style="color:'+(od?'var(--red)':'var(--muted)')+'">'+(inv.due||'—')+(od?' <i class="fas fa-triangle-exclamation"></i>':'')+' '+ageLbl+'</td><td>'+SB(inv.status||'Draft')+'</td><td><div class="row-acts">'+(inv.status!=='Paid'?'<button class="e-btn" onclick="markInvPaid('+oi+')" title="Mark paid"><i class="fas fa-check"></i></button><button class="e-btn" onclick="copyPayReminder('+oi+')" title="Copy payment reminder"><i class="fas fa-clipboard"></i></button><button class="e-btn" onclick="emailInv('+oi+')" title="Send via email"><i class="fas fa-envelope"></i></button>'+(od?'<button class="e-btn" onclick="writeBadDebt('+oi+')" title="Write off as bad debt" style="color:var(--red)"><i class="fas fa-xmark"></i> Bad debt</button>':''):'')+'<button class="e-btn" onclick="editInv('+oi+')" title="Edit">&#9998;</button><button class="d-btn" onclick="delInv('+oi+')" title="Delete">&#215;</button></div></td></tr>';}).join('');
  p.innerHTML=FB()+XB('ar')+srchBar('p-ar','renderAR(gc())')+'<div class="metrics"><div class="metric"><div class="m-lbl">Outstanding</div><div class="m-val va">'+fmt(totOut)+'</div></div><div class="metric"><div class="m-lbl">Collected</div><div class="m-val vg">'+fmt(totPaid)+'</div></div><div class="metric"><div class="m-lbl">Overdue</div><div class="m-val '+(overdue>0?'vr':'vg')+'">'+overdue+'</div></div></div>'+agingHtml+'<div class="card"><div class="c-head"><span class="c-title">Invoices</span><button class="add-btn" onclick="EI=-1;openM(\'m-inv\')">+ New invoice</button></div>'+(invs.length?'<table><thead><tr><th style="width:8%">#</th><th style="width:14%">Client</th><th style="width:16%">Description</th><th style="width:9%">Amount</th><th style="width:9%">Issued</th><th style="width:14%">Due / Age</th><th style="width:10%">Status</th><th style="width:20%"></th></tr></thead><tbody>'+rows+'</tbody></table>':ES('No invoices yet','Create your first invoice to track A/R.',"EI=-1;openM('m-inv')"))+'</div>';
  +'<div class="card"><div class="c-head"><span class="c-title">Invoices</span><button class="add-btn" onclick="EI=-1;openM(\'m-inv\')">+ New invoice</button></div>'
  +(invs.length?'<table><thead><tr><th style="width:8%">#</th><th style="width:16%">Client</th><th style="width:20%">Description</th><th style="width:9%">Amount</th><th style="width:10%">Issued</th><th style="width:10%">Due</th><th style="width:12%">Status</th><th style="width:15%"></th></tr></thead><tbody>'+rows+'</tbody></table>':ES('No invoices yet','Create your first invoice to track A/R.','EI=-1;openM(\'m-inv\')'))+'</div>';
}
function saveInv(){
  var c=gc();if(!c.invoices)c.invoices=[];
  // PERIOD LOCK GUARD
  var _invLockDate=g('inv-date')&&g('inv-date').value.trim();
  if(_invLockDate&&isDateLocked(c,_invLockDate)){periodLockAlert(c.closedThrough);return;}
  var amt=Number(g('inv-amt').value||0);if(!amt){alert('Please enter an amount.');return;}
  var _rINV=typeof resolveEI==='function'?resolveEI(c.invoices):(EI<c.invoices.length?EI:-1);
  var _oldInv=_rINV>=0?c.invoices[_rINV]:null;
  var item={id:_rINV>=0?(c.invoices[_rINV].id||uid()):uid(),num:g('inv-num').value||'INV-'+Date.now().toString(36).toUpperCase(),client:g('inv-client').value,desc:g('inv-desc').value,amt:amt,date:g('inv-date').value,due:g('inv-due').value,status:g('inv-status').value||'Draft',notes:g('inv-notes').value};
  // Carry forward payment/write-off tracking fields the form doesn't expose — otherwise
  // editing a Paid or Written-Off invoice (e.g. just fixing a typo) would silently wipe them.
  if(_oldInv){if(_oldInv.paidDate)item.paidDate=_oldInv.paidDate;if(_oldInv.badDebt){item.badDebt=_oldInv.badDebt;item.badDebtDate=_oldInv.badDebtDate;}if(_oldInv.status==='Paid'||_oldInv.status==='Written Off')item.status=_oldInv.status;}
  if(typeof markDirty==='function')markDirty('ar','reports','bs');
  if(_rINV>=0)c.invoices[_rINV]=item;else c.invoices.push(item);
  if(typeof dwUpsertInvoice==='function')dwUpsertInvoice(c,item);
  // ACCRUAL: an issued (Sent/Overdue) invoice recognizes revenue immediately — Dr AR / Cr
  // Revenue, same timing as Bills' Dr Expense / Cr AP. A Draft invoice hasn't been sent, so
  // it isn't a real receivable yet — no posting (and any prior posting is voided if status
  // moves back to Draft). Paid/Written-Off invoices are left alone here — their AR was
  // already cleared (markInvPaid) or written off (writeBadDebt); re-touching the ledger on a
  // routine edit would incorrectly reopen a receivable that's already settled.
  if(item.status!=='Paid'&&item.status!=='Written Off'){
    var arCode=_defaultARCode(c);
    var revCode=lookupAcctByCAT(c,'Invoiced Revenue','Income')||'4010';
    var memo='Invoice '+(item.num||item.id)+(item.client?' — '+item.client:'');
    if(item.status==='Draft')voidLedgerEntry(c,item.id);
    else updateLedgerEntry(c,item.id,arCode,revCode,item.amt,memo,'invoice');
  } else if(item.status==='Paid' && !(_oldInv&&_oldInv.status==='Paid') && !item.paidDate){
    // Form set the invoice straight to Paid (not via the Mark-paid button). Recognize the
    // receivable if it isn't already, then clear it with a cash receipt, so AR doesn't sit
    // open forever. postToLedger is idempotent, so re-recognizing is safe.
    var arCodeP=_defaultARCode(c);
    var revCodeP=lookupAcctByCAT(c,'Invoiced Revenue','Income')||'4010';
    var memoP='Invoice '+(item.num||item.id)+(item.client?' — '+item.client:'');
    postToLedger(c,arCodeP,revCodeP,item.amt,memoP,'invoice',item.id);
    postToLedger(c,_defaultCashCode(c),arCodeP,item.amt,'Received payment: Invoice '+(item.num||item.id)+(item.client?' — '+item.client:''),'invoice',item.id+':pay');
    item.paidDate=todayNum();
  }
  sv();renderAR(c);renderBalanceSheet(c);closeM('m-inv');['inv-num','inv-client','inv-desc','inv-amt','inv-date','inv-due','inv-notes'].forEach(function(id){g(id).value='';});
}
function editInv(i){var c=gc();if(!c.invoices[i])return;EI=i;if(typeof _editItemId!=='undefined')_editItemId=c.invoices[i].id||null;var inv=c.invoices[i];g('inv-num').value=inv.num||'';g('inv-client').value=inv.client||'';g('inv-desc').value=inv.desc||'';g('inv-amt').value=inv.amt||'';g('inv-date').value=inv.date||'';g('inv-due').value=inv.due||'';g('inv-status').value=inv.status||'Draft';g('inv-notes').value=inv.notes||'';openM('m-inv');}
function delInv(i){var c=gc();if(!confirm('Delete this invoice?'))return;var inv=c.invoices[i];c.invoices.splice(i,1);if(inv&&typeof dwDeleteInvoice==='function')dwDeleteInvoice(c,inv);sv();renderAR(c);}
function copyPayReminder(i){var c=gc();if(!c||!c.invoices[i])return;var inv=c.invoices[i];var txt='Subject: Invoice '+(inv.num||'')+(inv.due?' — Due '+inv.due:'')+'\n\nHi '+(inv.client||'there')+',\n\nThis is a friendly reminder that invoice '+(inv.num||'')+(inv.due?' was due on '+inv.due:'')+' for '+fmt(inv.amt)+(inv.desc?' ('+inv.desc+')':'')+'.\n\nPlease remit payment at your earliest convenience. If you have any questions, don\'t hesitate to reach out.\n\nThank you,\n'+c.name;if(navigator.clipboard){navigator.clipboard.writeText(txt).then(function(){alert('Payment reminder copied to clipboard.');});}else{var ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);alert('Payment reminder copied to clipboard.');}}

function emailInv(i){
  var c=gc();if(!c||!c.invoices[i])return;
  var inv=c.invoices[i];
  var to=encodeURIComponent(inv.email||'');
  var subject=encodeURIComponent('Invoice '+(inv.num||'')+(inv.due?' — Due '+inv.due:''));
  var body=encodeURIComponent(
    'Hi '+(inv.client||'there')+',\n\n'
    +'Please find attached invoice '+(inv.num||'')+(inv.due?' due on '+inv.due:'')+' for '+(inv.amt?'$'+Number(inv.amt).toLocaleString():'the amount discussed')+(inv.desc?' ('+inv.desc+')':'')+'.'
    +'\n\nPlease remit payment at your earliest convenience. If you have any questions, don\'t hesitate to reach out.'
    +'\n\nThank you,\n'+c.name
  );
  window.location.href='mailto:'+to+'?subject='+subject+'&body='+body;
}
function markInvPaid(i){
  var c=gc();if(!c||!c.invoices[i])return;
  // FIX-10: Determine where to deposit — pick first available bank, or first cash asset, or leave blank
  var banks2=c.bankAccounts||[];var bsAssets2=(c.balanceSheet&&c.balanceSheet.assets||[]).filter(function(a){return isCashTypeAccount(a.name);});
  var depositBankId='',depositBsAssetId='';
  if(banks2.length)depositBankId=banks2[0].id;
  else if(bsAssets2.length)depositBsAssetId=bsAssets2[0].id;
  c.invoices[i].status='Paid';c.invoices[i].paidDate=todayNum();
  if(typeof dwUpsertInvoice==='function')dwUpsertInvoice(c,c.invoices[i]);
  if(!c.revenue)c.revenue=[];
  var inv=c.invoices[i];
  // This revenue record is a display/1099-tracking row (mirrors how a paid Bill pushes an
  // expenses[] row) — revenue was already recognized on the ledger in saveInv() when the
  // invoice was Sent; this does not post it again.
  var cashCode=_defaultCashCode(c);
  var revItem={id:uid(),name:'Invoice: '+(inv.client||inv.num),cat:'Invoiced Revenue',proj:inv.amt,act:inv.amt,date:c.invoices[i].paidDate,conf:'Confirmed',recurring:'None',invoiceId:inv.id,acctCode:lookupAcctByCAT(c,'Invoiced Revenue','Income')||'4010'};
  if(depositBankId)revItem.bankId=depositBankId;
  if(depositBsAssetId){revItem.bsAssetId=depositBsAssetId;cashCode=ensureBSAssetCOA(c,depositBsAssetId)||cashCode;revItem.acctCode=cashCode;applyBSAssetDelta(c,depositBsAssetId,Number(inv.amt||0));}
  c.revenue.push(revItem);
  if(typeof dwUpsertRevenue==='function')dwUpsertRevenue(c,revItem);
  // DOUBLE ENTRY: clear the receivable recognized at Sent time -- Dr Cash / Cr AR
  var arCode=_defaultARCode(c);
  postToLedger(c,cashCode,arCode,Number(inv.amt||0),'Received payment: Invoice '+(inv.num||inv.id)+(inv.client?' — '+inv.client:''),'invoice',inv.id+':pay');
  sv();renderAR(c);renderRev(c);renderBalanceSheet(c);
}

// ══════════════════════════════════════════
// #17 — JOURNAL ENTRIES / SB ACCOUNTING
// ══════════════════════════════════════════
function renderJournalEntries(c){
  var p=g('p-jentries');if(!p)return;if(!c)return;
  var entries=c.journalEntries||[];
  var filt=srchItems(entries,SRCH['p-jentries']||'',['memo','type','debitAcct','creditAcct']);
  var rows=filt.map(function(e,fi){var oi=entries.indexOf(e);return'<tr><td style="color:var(--muted)">'+(e.date||'—')+'</td><td>'+SB(e.type||'Other')+'</td><td style="font-weight:500">'+escHtml(e.memo||'—')+'</td><td>'+escHtml(e.debitAcct||'—')+'</td><td>'+escHtml(e.creditAcct||'—')+'</td><td>'+fmt(e.amt)+'</td><td><div class="row-acts"><button class="e-btn" onclick="editJE('+oi+')">&#9998;</button><button class="d-btn" onclick="delJE('+oi+')">&#215;</button></div></td></tr>';}).join('');
  p.innerHTML=FB()+XB()+srchBar('p-jentries','renderJournalEntries(gc())')
  +'<div class="insight"><div class="ins-lbl">Journal entries</div>Record depreciation, equity changes, and other adjustments.</div>'
  +'<div class="card"><div class="c-head"><span class="c-title">Journal entries</span><button class="add-btn" onclick="EI=-1;openM(\'m-je\')">+ New entry</button></div>'
  +(entries.length?'<table><thead><tr><th style="width:11%">Date</th><th style="width:13%">Type</th><th style="width:22%">Memo</th><th style="width:16%">Debit account</th><th style="width:16%">Credit account</th><th style="width:10%">Amount</th><th style="width:12%"></th></tr></thead><tbody>'+rows+'</tbody></table>':ES('No journal entries yet','Record loan payments, depreciation, and equity changes.','EI=-1;openM(\'m-je\')'))+'</div>';
}

// ══════════════════════════════════════════
// AR PARTIAL PAYMENTS + DISPUTE FLAG
// ══════════════════════════════════════════
function recordPartialPayment(i){
  var c=gc();if(!c||!c.invoices||!c.invoices[i])return;
  var inv=c.invoices[i];
  if(inv.status==='Paid'){alert('This invoice is already fully paid.');return;}
  if(inv.badDebt){alert('This invoice has been written off.');return;}
  if(isDateLocked(c,todayNum())){periodLockAlert(c.closedThrough);return;}
  var outstanding=Number(inv.amt||0)-Number(inv.amtPaid||0);
  var input=prompt('Record partial payment\nInvoice #'+(inv.num||inv.id)+'\nOutstanding: '+fmt(outstanding)+'\n\nEnter amount:','');
  if(input===null||input==='')return;
  var pmtAmt=Number(input);
  if(isNaN(pmtAmt)||pmtAmt<=0){alert('Please enter a valid amount greater than zero.');return;}
  if(pmtAmt>outstanding+0.01){alert('Payment ('+fmt(pmtAmt)+') exceeds outstanding balance ('+fmt(outstanding)+').');return;}
  if(!inv.payments)inv.payments=[];
  inv.payments.push({id:uid(),date:todayNum(),amt:pmtAmt,note:'Partial payment'});
  inv.amtPaid=Number((Number(inv.amtPaid||0)+pmtAmt).toFixed(2));
  if(Math.abs(Number(inv.amt||0)-inv.amtPaid)<0.01){inv.status='Paid';inv.paidDate=todayNum();}
  else{inv.status='Partial';}
  if(typeof dwUpsertInvoice==='function')dwUpsertInvoice(c,inv);
  if(!c.revenue)c.revenue=[];
  var revItem={id:uid(),name:'Partial payment — Inv #'+(inv.num||inv.id)+' ('+(inv.client||'')+')',cat:'Invoiced Revenue',proj:0,act:pmtAmt,conf:'Confirmed',recurring:'None',invoiceId:inv.id,date:todayNum(),acctCode:lookupAcctByCAT(c,'Revenue','Income')||'4010'};
  c.revenue.push(revItem);
  if(typeof dwUpsertRevenue==='function')dwUpsertRevenue(c,revItem);
  postToLedger(c,_defaultCashCode(c),_defaultARCode(c),pmtAmt,'Partial payment — Inv #'+(inv.num||inv.id),'revenue',revItem.id);
  markDirty('ar','revenue','reports','bs');
  sv();renderAll(true);
}

function toggleDispute(i){
  var c=gc();if(!c||!c.invoices||!c.invoices[i])return;
  var inv=c.invoices[i];
  if(inv.disputed){
    if(!confirm('Remove dispute flag from invoice #'+(inv.num||inv.id)+'?'))return;
    inv.disputed=false;inv.disputedAt=null;inv.disputeNote='';
    if(inv.status==='Disputed')inv.status='Sent';
  }else{
    var note=prompt('Flag invoice #'+(inv.num||inv.id)+' as disputed.\n\nOptional note:','');
    if(note===null)return;
    inv.disputed=true;inv.disputedAt=new Date().toISOString();inv.disputeNote=note||'';
    if(inv.status!=='Paid')inv.status='Disputed';
  }
  if(typeof dwUpsertInvoice==='function')dwUpsertInvoice(c,inv);
  markDirty('ar','reports');
  sv();renderAR(c);
}


// saveJE(): manual Journal Entry. Was broken end-to-end — the modal only had free-text
// "Debit account"/"Credit account" inputs (no real COA code), so debitCode/creditCode were
// always empty and this never called postToLedger() at all, despite delJE() already trying
// to void a ledger entry that never existed. Fixed: je-debit-acct/je-credit-acct are now
// real account-code selects (openM()'s acctMods, modals.js), and this now posts a proper
// Dr debitCode / Cr creditCode entry — same create/edit pattern as everywhere else in this
// app (updateLedgerEntry supersedes-then-reposts on edit, sourceId=item.id).
function saveJE(){
  var c=gc();if(!c.journalEntries)c.journalEntries=[];
  var _jeLockDate=g('je-date')&&g('je-date').value.trim();
  if(_jeLockDate&&isDateLocked(c,_jeLockDate)){periodLockAlert(c.closedThrough);return;}
  var amt=Number(g('je-amt').value||0);if(!amt){alert('Please enter an amount.');return;}
  var debitCode=g('je-debit-acct')&&g('je-debit-acct').value||'';
  var creditCode=g('je-credit-acct')&&g('je-credit-acct').value||'';
  if(!debitCode||!creditCode){alert('Please select both a debit account and a credit account.');return;}
  if(debitCode===creditCode){alert('Debit and credit accounts must be different.');return;}
  var debitAcctObj=(c.accounts||[]).find(function(a){return a.code===debitCode;});
  var creditAcctObj=(c.accounts||[]).find(function(a){return a.code===creditCode;});
  var _rJE=typeof resolveEI==='function'?resolveEI(c.journalEntries):(EI<c.journalEntries.length?EI:-1);
  var _oldJE=_rJE>=0?c.journalEntries[_rJE]:null;
  var _jeWatched=['date','type','memo','debitAcct','creditAcct','debitCode','creditCode','amt','notes'];
  var item={id:_rJE>=0?(c.journalEntries[_rJE].id||uid()):uid(),date:g('je-date').value,type:g('je-type').value,memo:g('je-memo').value,
    debitAcct:debitAcctObj?(debitAcctObj.code+' '+debitAcctObj.name):debitCode,
    creditAcct:creditAcctObj?(creditAcctObj.code+' '+creditAcctObj.name):creditCode,
    debitCode:debitCode,creditCode:creditCode,amt:amt,notes:g('je-notes').value};
  // Audit trail — diff on edit, created stamp on new
  if(_rJE>=0&&_oldJE){
    var _jeLog=(_oldJE.audit||[]).slice();var _ts=new Date().toISOString();
    _jeWatched.forEach(function(f){var ov=String(_oldJE[f]===undefined||_oldJE[f]===null?'':_oldJE[f]);var nv=String(item[f]===undefined||item[f]===null?'':item[f]);if(ov!==nv)_jeLog.push({field:f,oldValue:ov,newValue:nv,timestamp:_ts});});
    item.audit=_jeLog;
  }else{
    item.audit=[{field:'created',oldValue:'',newValue:'Entry created',timestamp:new Date().toISOString()}];
  }
  if(_rJE>=0)updateLedgerEntry(c,item.id,debitCode,creditCode,amt,item.memo||'Journal entry','je');
  else postToLedger(c,debitCode,creditCode,amt,item.memo||'Journal entry','je',item.id);
  if(typeof markDirty==='function')markDirty('je','gl','trialbal','bs','reports');if(_rJE>=0)c.journalEntries[_rJE]=item;else c.journalEntries.push(item);
  if(typeof dwUpsertJE==='function')dwUpsertJE(c,item);
  sv();renderAll(true);closeM('m-je');['je-date','je-memo','je-amt','je-notes'].forEach(function(id){g(id).value='';});
}
function editJE(i){
  var c=gc();if(!c.journalEntries[i])return;EI=i;if(typeof _editItemId!=='undefined')_editItemId=c.journalEntries[i].id||null;
  var e=c.journalEntries[i];
  g('je-date').value=e.date||'';g('je-type').value=e.type||'Other';g('je-memo').value=e.memo||'';g('je-amt').value=e.amt||'';g('je-notes').value=e.notes||'';
  openM('m-je');
  // openM() just rebuilt je-debit-acct/je-credit-acct's <option> list — setting .value
  // beforehand would be wiped, same bug class already fixed for e-acct/pi-acct elsewhere.
  setTimeout(function(){
    if(g('je-debit-acct'))g('je-debit-acct').value=e.debitCode||'';
    if(g('je-credit-acct'))g('je-credit-acct').value=e.creditCode||'';
  },50);
}
function delJE(i){var c=gc();if(!confirm('Delete this entry?'))return;var je=c.journalEntries&&c.journalEntries[i];if(je&&je.id)voidLedgerEntry(c,je.id);c.journalEntries.splice(i,1);if(je&&typeof dwDeleteJE==='function')dwDeleteJE(c,je);sv();renderAll(true);}

// ══════════════════════════════════════════
// #16 — BALANCE SHEET (SB)
// ══════════════════════════════════════════
var BS_VIEW=''; // '' = auto (ledger when the client has a ledger, else hybrid) | 'hybrid' = manual+auto view | 'ledger' = derived from double-entry ledger. Auto-resolved in renderBalanceSheet so the DEFAULT ties to the trial balance instead of the hybrid view's partial cash figure.
function renderBalanceSheet(c){
  var p=g('p-bsheet');if(!p)return;if(!c)return;
  var bs=c.balanceSheet||{assets:[],liabilities:[],equity:[]};
  var accts=c.accounts||[];
  var je=c.journalEntries||[];

  // ── AUTO-COMPUTED: Accounts Receivable from open invoices ──────────────
  var arAmt=(c.invoices||[]).filter(function(i){return i.status!=='Paid';}).reduce(function(s,i){return s+Number(i.amt||0);},0);

  // ── AUTO-COMPUTED: Accounts Payable from open bills ────────────────────
  var apAmt=(c.bills||[]).filter(function(b){return b.status!=='Paid';}).reduce(function(s,b){return s+Number(b.amt||0);},0);

  // ── AUTO-COMPUTED: Cash from bank reconciliation closing balances ───────
  var reconCash=0;
  var reconByBankId2={};
  (c.bankAccounts||[]).forEach(function(b){
    var rs=c['reconState_bank:'+b.id];
    if(rs&&Number(rs.closeBal||0)>0){reconCash+=Number(rs.closeBal);reconByBankId2[b.id]=true;}
  });
  // Also legacy default account
  if(c['reconState_bank']&&Number(c['reconState_bank'].closeBal||0)>0)
    reconCash+=Number(c['reconState_bank'].closeBal);

  // ── BUILD COA-AWARE JE BUCKETS ──────────────────────────────────────────
  var jeByAcct={};
  je.forEach(function(e){
    function addJE(code,amt){if(!code)return;var a=accts.find(function(x){return x.code===code;});if(!a)return;var k=code+' '+a.name;if(!jeByAcct[k])jeByAcct[k]={type:a.type,amt:0};jeByAcct[k].amt+=amt;}
    addJE(e.debitCode,Number(e.amt||0));
    if(e.creditCode){var a2=accts.find(function(x){return x.code===e.creditCode;});if(a2)addJE(e.creditCode,-Number(e.amt||0));}
    if(!e.debitCode&&e.debitAcct&&e.debitAcct.toLowerCase().indexOf('asset')>=0){if(!jeByAcct['From JEs (Assets)'])jeByAcct['From JEs (Assets)']={type:'Asset',amt:0};jeByAcct['From JEs (Assets)'].amt+=Number(e.amt||0);}
    if(!e.creditCode&&e.creditAcct&&e.creditAcct.toLowerCase().indexOf('liabilit')>=0){if(!jeByAcct['From JEs (Liabilities)'])jeByAcct['From JEs (Liabilities)']={type:'Liability',amt:0};jeByAcct['From JEs (Liabilities)'].amt+=Number(e.amt||0);}
  });

  var jeAssets=Object.keys(jeByAcct).filter(function(k){return jeByAcct[k].type==='Asset';}).reduce(function(s,k){return s+jeByAcct[k].amt;},0);
  var jeLiab=Object.keys(jeByAcct).filter(function(k){return jeByAcct[k].type==='Liability';}).reduce(function(s,k){return s+jeByAcct[k].amt;},0);

  // ── TOTALS: assets use computeBSAssetBalance (derived live from transactions) ──
  var manualAssets=(bs.assets||[]).reduce(function(s,a){return s+computeBSAssetBalance(c,a.id);},0);
  var manualLiab=(bs.liabilities||[]).reduce(function(s,l){return s+Number(l.amt||0);},0);
  var totalAssets=manualAssets+jeAssets+reconCash+arAmt;
  var totalLiab=manualLiab+jeLiab+apAmt;
  var autoEquity=totalAssets-totalLiab;
  function secRows(items,type){
    return(items||[]).map(function(item,i){
      var bal=type==='assets'?computeBSAssetBalance(c,item.id):Number(item.amt||0);
      var isOverdraft=bal<0;
      var note=type==='assets'&&item.openingBalance!==undefined
        ?'<div style="font-size:10px;color:var(--muted)">Opening: '+fmt(item.openingBalance)+' · Net transactions: '+fmt(bal-Number(item.openingBalance||0))+'</div>'
        :'';
      return'<tr><td>'+escHtml(item.name)+note+(isOverdraft?'<span class="badge b-red" style="margin-left:6px;font-size:9px">Overdraft</span>':'')+'</td>'
        +'<td class="'+(isOverdraft?'vr':'')+'">'+fmt(bal)+'</td>'
        +'<td><div class="row-acts"><button class="e-btn" onclick="editBSItem(\''+type+'\','+i+')">&#9998;</button><button class="d-btn" onclick="delBSItem(\''+type+'\','+i+')">&#215;</button></div></td></tr>';
    }).join('');
  }
  // ── AUTO ROW HELPERS ──────────────────────────────────────────────────
  function autoRow(label,amt,note){
    return '<tr><td style="color:var(--muted);font-style:italic">'+escHtml(label)+'<span style="font-size:10px;margin-left:6px;background:var(--soft);padding:1px 5px;border-radius:4px;">auto</span>'+(note?'<div style="font-size:10px;color:var(--muted)">'+escHtml(note)+'</div>':'')+'</td><td>'+fmt(amt)+'</td><td></td></tr>';
  }
  var jeAssetRows=Object.keys(jeByAcct).filter(function(k){return jeByAcct[k].type==='Asset'&&jeByAcct[k].amt!==0;}).map(function(k){return autoRow(k,jeByAcct[k].amt,'from journal entries');}).join('');
  var jeLiabRows=Object.keys(jeByAcct).filter(function(k){return jeByAcct[k].type==='Liability'&&jeByAcct[k].amt!==0;}).map(function(k){return autoRow(k,jeByAcct[k].amt,'from journal entries');}).join('');
  var reconCashRow=reconCash>0?autoRow('Cash — Bank Accounts',reconCash,'from reconciliation closing balances'):'';
  var arRow=arAmt>0?autoRow('Accounts Receivable',arAmt,(c.invoices||[]).filter(function(i){return i.status!=='Paid';}).length+' open invoice(s)'):'';
  var apRow=apAmt>0?autoRow('Accounts Payable',apAmt,(c.bills||[]).filter(function(b){return b.status!=='Paid';}).length+' unpaid bill(s)'):'';
  // ── VIEW TOGGLE ──────────────────────────────────────────────────────────
  var hasLedger=c.ledgerEntries&&c.ledgerEntries.length>0;
  // Default view: the ledger view ties to the trial balance, so prefer it whenever a ledger
  // exists (the hybrid view's cash is only reconciled + JE deltas and can badly understate
  // real cash). Falls back to hybrid for brand-new clients with nothing posted yet. An explicit
  // toggle click sets BS_VIEW, which then persists.
  if(!BS_VIEW)BS_VIEW=hasLedger?'ledger':'hybrid';
  var viewToggle='<div style="display:flex;gap:6px;margin-bottom:1rem;flex-wrap:wrap;align-items:center">'
    +'<button class="'+(BS_VIEW==='hybrid'?'sv-btn':'add-btn')+'" style="font-size:11px;padding:5px 12px" onclick="BS_VIEW=\'hybrid\';renderBalanceSheet(gc())">Working view</button>'
    +'<button class="'+(BS_VIEW==='ledger'?'sv-btn':'add-btn')+'" style="font-size:11px;padding:5px 12px" onclick="BS_VIEW=\'ledger\';renderBalanceSheet(gc())"'+(hasLedger?'':' disabled title="No ledger entries yet — save transactions to populate"')+'>Ledger view '+(hasLedger?'':'(no data yet)')+'</button>'
    +'<span style="font-size:10px;color:var(--muted);margin-left:4px">'+(BS_VIEW==='ledger'?'Derived from double-entry ledger — ties to trial balance':'Manual entries + auto-computed rows')+'</span>'
    +'</div>';

  // ── LEDGER VIEW ──────────────────────────────────────────────────────────
  var ledgerHtml='';
  if(BS_VIEW==='ledger'){
    var lbs=getBSFromLedger(c);
    var fmt2=function(n){return'$'+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});};
    function lbsSection(title,rows,total,totalClass){
      var rowsHtml=rows.length
        ?rows.map(function(r){return'<tr><td style="font-family:monospace;font-size:11px;width:8%">'+escHtml(r.code)+'</td><td>'+escHtml(r.name)+'</td><td style="text-align:right;width:22%;font-weight:500;'+(r.balance<0?'color:var(--red)':'')+'">'+fmt2(r.balance)+'</td></tr>';}).join('')
        :'<tr><td colspan="3" style="color:var(--muted);font-size:11px;padding:.5rem 0">No entries posted to '+title.toLowerCase()+' accounts yet.</td></tr>';
      return'<div class="card"><div class="c-head"><span class="c-title">'+title+'</span></div>'
        +'<table><thead><tr><th style="width:8%">Code</th><th>Account</th><th style="text-align:right;width:22%">Balance</th></tr></thead>'
        +'<tbody>'+rowsHtml+'</tbody>'
        +'<tfoot><tr style="font-weight:700;border-top:2px solid var(--border)"><td colspan="2">Total '+title.toLowerCase()+'</td><td style="text-align:right;'+((totalClass==='vr'&&lbs.totalLiab>0)||total<0?'color:var(--red)':'color:var(--green)')+'">'+fmt2(total)+'</td></tr></tfoot>'
        +'</table></div>';
    }
    var balanceStatus=lbs.balanced
      ?'<span style="color:var(--green);font-weight:600;font-size:12px">&#10003; In balance</span>'
      :'<span style="color:var(--red);font-weight:700;font-size:12px">&#9888; Out of balance by '+fmt2(Math.abs(lbs.totalAssets-(lbs.totalLiab+lbs.totalEquityPlusIncome)))+'</span>';
    ledgerHtml='<div style="font-size:11px;color:var(--muted);margin-bottom:.75rem;line-height:1.6">'
      +'Balances derived directly from posted ledger entries. Income and expense account balances roll into <em>Current period net income</em> until year-end closing entries are posted. '
      +'<strong>This view always agrees with the Trial Balance.</strong>'
      +'</div>'
      +'<div class="metrics">'
      +'<div class="metric"><div class="m-lbl">Total assets</div><div class="m-val vg">'+fmt2(lbs.totalAssets)+'</div></div>'
      +'<div class="metric"><div class="m-lbl">Total liabilities</div><div class="m-val vr">'+fmt2(lbs.totalLiab)+'</div></div>'
      +'<div class="metric"><div class="m-lbl">Total equity</div><div class="m-val vb">'+fmt2(lbs.totalEquity)+'</div></div>'
      +'<div class="metric"><div class="m-lbl">Net income (YTD)</div><div class="m-val '+(lbs.netIncome>=0?'vg':'vr')+'">'+fmt2(lbs.netIncome)+'</div></div>'
      +'<div class="metric"><div class="m-lbl">Balance check</div><div class="m-val" style="font-size:12px">'+balanceStatus+'</div></div>'
      +'</div>'
      +lbsSection('Assets',lbs.assets,lbs.totalAssets,'vg')
      +lbsSection('Liabilities',lbs.liabilities,lbs.totalLiab,'vr')
      +(c.type==='np'?(function(){
        // GAAP (ASU 2016-14) face-of-statement presentation: two net-asset classes.
        // 3030 (endowment/permanently-restricted detail) rolls up into "with donor restrictions."
        var _naWithout=(lbs.equity.filter(function(r){return r.code==='3010';})[0]||{balance:0}).balance;
        var _naWith=lbs.equity.filter(function(r){return r.code==='3020'||r.code==='3030';}).reduce(function(s,r){return s+r.balance;},0);
        return'<div class="card"><div class="c-head"><span class="c-title">Net Assets (GAAP presentation)</span></div>'
          +'<table><tbody>'
          +'<tr><td>Net assets without donor restrictions</td><td style="text-align:right;font-weight:600">'+fmt2(_naWithout)+'</td></tr>'
          +'<tr><td>Net assets with donor restrictions</td><td style="text-align:right;font-weight:600">'+fmt2(_naWith)+'</td></tr>'
          +'<tr style="font-weight:700;border-top:2px solid var(--border)"><td>Total net assets</td><td style="text-align:right">'+fmt2(_naWithout+_naWith)+'</td></tr>'
          +'</tbody></table></div>';
      })():'')
      +lbsSection('Equity',lbs.equity,lbs.totalEquity,'vb')
      +'<div class="card"><div class="c-head"><span class="c-title">Current period net income</span><span style="font-size:11px;color:var(--muted)">Income − Expenses (not yet closed to equity)</span></div>'
      +'<table><thead><tr><th style="width:8%">Code</th><th>Account</th><th style="text-align:right;width:22%">Balance</th></tr></thead><tbody>'
      +lbs.incomeAccts.concat(lbs.expenseAccts).map(function(r){return'<tr><td style="font-family:monospace;font-size:11px">'+escHtml(r.code)+'</td><td>'+escHtml(r.name)+'</td><td style="text-align:right;font-weight:500;'+(r.balance<0?'color:var(--red)':'')+'">'+fmt2(r.balance)+'</td></tr>';}).join('')
      +'</tbody><tfoot><tr style="font-weight:700;border-top:2px solid var(--border)"><td colspan="2">Net income (rolls to equity at year-end close)</td><td style="text-align:right;'+(lbs.netIncome>=0?'color:var(--green)':'color:var(--red)')+'">'+fmt2(lbs.netIncome)+'</td></tr></tfoot></table>'
      +'</div>'
      +'<div style="font-size:11px;color:var(--muted);padding:.5rem 0;line-height:1.5">'
      +'A = L + E check: '+fmt2(lbs.totalAssets)+' = '+fmt2(lbs.totalLiab)+' + '+fmt2(lbs.totalEquity)+' + '+fmt2(lbs.netIncome)+' (net income) → '+(lbs.balanced?'<i class="fas fa-check"></i> Balanced':'<i class="fas fa-triangle-exclamation"></i> Difference: '+fmt2(Math.abs(lbs.totalAssets-(lbs.totalLiab+lbs.totalEquityPlusIncome))))
      +'</div>'
      +renderClosingEntries(c);
  }

  // ── HYBRID VIEW (existing) ────────────────────────────────────────────────
  var hybridHtml='';
  if(BS_VIEW==='hybrid'){
    hybridHtml=''
    +'<div class="metrics"><div class="metric"><div class="m-lbl">Total assets</div><div class="m-val vg">'+fmt(totalAssets)+'</div></div><div class="metric"><div class="m-lbl">Total liabilities</div><div class="m-val vr">'+fmt(totalLiab)+'</div></div><div class="metric"><div class="m-lbl">Net equity</div><div class="m-val '+(autoEquity>=0?'vb':'vr')+'">'+fmt(autoEquity)+'</div></div></div>'
    +'<div class="card"><div class="c-head"><span class="c-title">Assets</span><button class="add-btn" onclick="openBSModal(\'assets\')">+ Add manual entry</button></div>'
    +'<table><thead><tr><th style="width:60%">Account</th><th style="width:25%">Balance</th><th style="width:15%"></th></tr></thead><tbody>'
    +reconCashRow+arRow
    +secRows(bs.assets,'assets')+jeAssetRows
    +'<tr style="font-weight:500;border-top:2px solid var(--border)"><td>Total assets</td><td>'+fmt(totalAssets)+'</td><td></td></tr></tbody></table></div>'
    +'<div class="card"><div class="c-head"><span class="c-title">Liabilities</span><button class="add-btn" onclick="openBSModal(\'liabilities\')">+ Add manual entry</button></div>'
    +'<table><thead><tr><th style="width:60%">Account</th><th style="width:25%">Amount</th><th style="width:15%"></th></tr></thead><tbody>'
    +apRow
    +secRows(bs.liabilities,'liabilities')+jeLiabRows
    +'<tr style="font-weight:500;border-top:2px solid var(--border)"><td>Total liabilities</td><td>'+fmt(totalLiab)+'</td><td></td></tr></tbody></table></div>'
    +'<div class="card"><div class="c-head"><span class="c-title">Equity</span><button class="add-btn" onclick="openBSModal(\'equity\')">+ Add manual entry</button></div>'
    +'<table><thead><tr><th style="width:60%">Account</th><th style="width:25%">Amount</th><th style="width:15%"></th></tr></thead><tbody>'
    +secRows(bs.equity,'equity')
    +'<tr style="font-weight:500;border-top:2px solid var(--border)"><td>Calculated equity (Assets − Liabilities)</td><td class="'+(autoEquity>=0?'vg':'vr')+'">'+fmt(autoEquity)+'</td><td></td></tr></tbody></table></div>';
  }

  p.innerHTML=FB()+XB()
    +'<div class="insight"><div class="ins-lbl">Balance sheet</div>Switch between Working view (manual entries + auto rows) and Ledger view (derived from posted double-entry transactions, ties to Trial Balance).</div>'
    +viewToggle
    +hybridHtml
    +ledgerHtml;
}
// ── YEAR-END CLOSING ENTRIES ─────────────────────────────────────────────────
// renderClosingEntries(c): renders the closing entries panel inside the ledger view.
// Called from renderBalanceSheet when BS_VIEW==='ledger'.
function renderClosingEntries(c){
  if(!c)return'';
  var lbs=getBSFromLedger(c);
  var hasIncome=lbs.incomeAccts&&lbs.incomeAccts.length>0;
  var hasExpense=lbs.expenseAccts&&lbs.expenseAccts.length>0;
  var netIncome=lbs.netIncome||0;
  var fy=getFiscalYear(c.fiscalYearEnd);
  // Target the prior FY for closing (we close the year that just ended)
  var priorFYEnd=new Date(fy.end);priorFYEnd.setFullYear(priorFYEnd.getFullYear()-1);
  var priorFYLabel=(priorFYEnd.getFullYear()===fy.end.getFullYear()-1?'FY '+(fy.end.getFullYear()-1):fy.label);
  var closeDate=(priorFYEnd.getMonth()+1).toString().padStart(2,'0')+'/'+(priorFYEnd.getDate()).toString().padStart(2,'0')+'/'+priorFYEnd.getFullYear();
  var retainedCode=c.type==='sb'?'3020':'3010';
  var retainedAcct=(c.accounts||[]).find(function(a){return a.code===retainedCode;})||{name:retainedCode==='3020'?'Retained earnings':'Net assets / equity'};
  var fmt2=function(n){return'$'+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});};

  // History of prior closes
  var history=c.closingHistory||[];
  var historyHtml=history.length
    ?'<div style="margin-top:1rem"><div style="font-size:11px;font-weight:600;color:var(--muted);margin-bottom:.4rem;text-transform:uppercase;letter-spacing:.04em">Prior year-end closes</div>'
      +history.slice().reverse().map(function(h){
        return'<div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-bottom:1px solid var(--border);font-size:12px">'
          +'<span><strong>'+h.fy+'</strong> &nbsp;·&nbsp; Posted '+h.postedOn+'&nbsp;·&nbsp; '+h.accountsClosed+' accounts closed</span>'
          +'<span class="'+(h.netIncome>=0?'vg':'vr')+'" style="font-weight:600">Net '+(h.netIncome>=0?'income':'loss')+': '+fmt2(h.netIncome)+'</span>'
          +'</div>';
      }).join('')
      +'</div>'
    :'';

  // Already closed this year?
  var alreadyClosed=history.find(function(h){return h.fy===priorFYLabel;});
  if(alreadyClosed){
    return'<div class="card" style="border-left:3px solid var(--green)">'
      +'<div class="c-head"><span class="c-title">Year-end closing — '+priorFYLabel+'</span>'
      +'<span style="color:var(--green);font-size:12px;font-weight:600">&#10003; Already closed</span></div>'
      +'<div style="padding:.75rem 1rem;font-size:12px;color:var(--muted)">Closing entries for <strong>'+priorFYLabel+'</strong> were posted on <strong>'+alreadyClosed.postedOn+'</strong>. Income and expense accounts have been zeroed to <strong>'+retainedCode+' '+escHtml(retainedAcct.name)+'</strong>.</div>'
      +historyHtml
      +'</div>';
  }

  // No income/expense to close
  if(!hasIncome&&!hasExpense){
    return'<div class="card" style="border-left:3px solid var(--amber)">'
      +'<div class="c-head"><span class="c-title">Year-end closing</span></div>'
      +'<div style="padding:.75rem 1rem;font-size:12px;color:var(--muted)">No income or expense account balances found in the ledger. Save transactions before posting closing entries.</div>'
      +historyHtml+'</div>';
  }

  // Preview table
  var previewRows='';
  lbs.incomeAccts.forEach(function(r){if(Math.abs(r.balance)<0.01)return;previewRows+='<tr><td style="font-family:monospace;font-size:11px">'+escHtml(r.code)+'</td><td>'+escHtml(r.name)+'</td><td style="color:var(--muted);font-size:11px">Income</td><td style="text-align:right">'+fmt2(r.balance)+'</td><td style="text-align:right;color:var(--muted)">—</td></tr>';});
  lbs.expenseAccts.forEach(function(r){if(Math.abs(r.balance)<0.01)return;previewRows+='<tr><td style="font-family:monospace;font-size:11px">'+escHtml(r.code)+'</td><td>'+escHtml(r.name)+'</td><td style="color:var(--muted);font-size:11px">Expense</td><td style="text-align:right;color:var(--muted)">—</td><td style="text-align:right">'+fmt2(r.balance)+'</td></tr>';});
  previewRows+='<tr style="font-weight:700;border-top:2px solid var(--border);background:var(--bg)"><td colspan="2">'+retainedCode+' '+escHtml(retainedAcct.name)+' (plug)</td><td style="color:var(--muted);font-size:11px">Equity</td>'+(netIncome>=0?'<td style="text-align:right;color:var(--muted)">—</td><td style="text-align:right;color:var(--green)">'+fmt2(netIncome)+'</td>':'<td style="text-align:right;color:var(--red)">'+fmt2(Math.abs(netIncome))+'</td><td style="text-align:right;color:var(--muted)">—</td>')+'</tr>';

  return'<div class="card" style="border-left:3px solid var(--np,#0F6E56)">'
    +'<div class="c-head"><span class="c-title">Year-end closing — '+priorFYLabel+'</span>'
    +'<span style="font-size:11px;color:var(--muted)">As of '+closeDate+'</span></div>'
    +'<div style="padding:.75rem 1rem 0">'
    +'<p style="font-size:12px;color:var(--muted);margin:0 0 .75rem;line-height:1.6">Closing entries zero all income and expense account balances into <strong>'+retainedCode+' '+escHtml(retainedAcct.name)+'</strong>. After posting, the ledger view will show a clean balance sheet with only permanent accounts. This cannot be undone — ensure your trial balance is correct and the period is reconciled before proceeding.</p>'
    +'<div style="overflow-x:auto"><table style="margin-bottom:.75rem"><thead><tr><th style="width:8%">Code</th><th>Account</th><th style="width:12%">Type</th><th style="text-align:right;width:18%">Dr (close)</th><th style="text-align:right;width:18%">Cr (close)</th></tr></thead>'
    +'<tbody>'+previewRows+'</tbody></table></div>'
    +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:1rem;flex-wrap:wrap">'
    +'<div style="font-size:13px"><strong>Net '+(netIncome>=0?'income':'loss')+':</strong> <span class="'+(netIncome>=0?'vg':'vr')+'" style="font-weight:700">'+fmt2(netIncome)+'</span> &rarr; posted to '+retainedCode+' '+escHtml(retainedAcct.name)+'</div>'
    +'<button class="sv-btn" style="background:var(--np,#0F6E56)" onclick="doCloseYear(\''+priorFYLabel+'\')">&#10003; Post closing entries for '+priorFYLabel+'</button>'
    +'</div></div>'
    +historyHtml
    +'</div>';
}

// doCloseYear(fyLabel): called by the Post button. Calls postClosingEntries, saves, re-renders.
function doCloseYear(fyLabel){
  var c=gc();if(!c)return;
  if(!confirm('Post year-end closing entries for '+fyLabel+'?\n\nThis will zero all income and expense accounts to equity. This action cannot be undone.\n\nMake sure your trial balance is correct and the period is reconciled before proceeding.'))return;
  var result=postClosingEntries(c,fyLabel);
  if(!result.ok){alert('Could not post closing entries:\n\n'+result.message);return;}
  markDirty('je','bs','reports','trialbal');
  sv();
  renderBalanceSheet(c);
  if(typeof renderJournalEntries==='function')renderJournalEntries(c);
  if(typeof renderTrialBalance==='function')renderTrialBalance(c);
  alert('&#10003; '+result.message+'\n\nRecommended next step: go to Settings → Closed Periods and lock through '+result.closeDate+' to prevent any edits to the closed year.');
}

var BS_SEC='';
function openBSModal(sec){
  BS_SEC=sec;EI=-1;g('bs-name').value='';g('bs-amt').value='';
  g('bs-sec-label').textContent=sec.charAt(0).toUpperCase()+sec.slice(1);
  var lbl=document.getElementById('bs-amt-label');
  if(lbl)lbl.textContent=sec==='assets'?'Opening balance ($) — transactions will adjust this automatically':'Amount ($)';
  openM('m-bs');
}
function editBSItem(sec,i){
  var c=gc();if(!c.balanceSheet||!c.balanceSheet[sec]||!c.balanceSheet[sec][i])return;
  BS_SEC=sec;EI=i;var item=c.balanceSheet[sec][i];
  g('bs-name').value=item.name||'';
  g('bs-amt').value=sec==='assets'?(item.openingBalance!==undefined?item.openingBalance:item.amt||0):(item.amt||0);
  g('bs-sec-label').textContent=sec.charAt(0).toUpperCase()+sec.slice(1);
  var lbl=document.getElementById('bs-amt-label');
  if(lbl)lbl.textContent=sec==='assets'?'Opening balance ($) — transactions will adjust this automatically':'Amount ($)';
  openM('m-bs');
}
function saveBSItem(){var c=gc();if(!c.balanceSheet)c.balanceSheet={assets:[],liabilities:[],equity:[]};if(!c.balanceSheet[BS_SEC])c.balanceSheet[BS_SEC]=[];var n=g('bs-name').value.trim();if(!n){alert('Please enter an account name.');return;}var existing=EI>=0?c.balanceSheet[BS_SEC][EI]:null;var enteredAmt=Number(g('bs-amt').value||0);var item;if(BS_SEC==='assets'){// Assets use openingBalance for self-healing balance computation
item={id:existing&&existing.id?existing.id:uid(),name:n,openingBalance:enteredAmt};}else{item={id:existing&&existing.id?existing.id:uid(),name:n,amt:enteredAmt};}if(EI>=0)c.balanceSheet[BS_SEC][EI]=item;else c.balanceSheet[BS_SEC].push(item);sv();renderBalanceSheet(c);closeM('m-bs');}
function delBSItem(sec,i){
  var c=gc();if(!confirm('Remove this item?'))return;
  var item=c.balanceSheet[sec]&&c.balanceSheet[sec][i];
  if(item&&item.id&&sec==='assets'){
    // Orphan-clean: remove bsAssetId from all transactions pointing to this asset
    // so they stop posting to a ghost account
    var deadId=item.id;
    (c.expenses||[]).forEach(function(e){if(e.bsAssetId===deadId)delete e.bsAssetId;});
    (c.income||[]).forEach(function(r){if(r.bsAssetId===deadId)delete r.bsAssetId;});
    (c.revenue||[]).forEach(function(r){if(r.bsAssetId===deadId)delete r.bsAssetId;});
  }
  c.balanceSheet[sec].splice(i,1);sv();renderBalanceSheet(c);
}

// ══════════════════════════════════════════
// #18 — RECONCILIATION (SB)
// ══════════════════════════════════════════
var RECON_STATUS_FILTER='all'; // 'all' | 'cleared' | 'uncleared'

function setReconFilter(val){RECON_STATUS_FILTER=val;renderReconciliation(gc());}

function renderReconciliation(c){
  var p=g('p-recon');if(!p)return;if(!c)return;
  var exp=c.expenses||[];var rev=c.revenue||[];
  var accts=c.accounts||[];

  // Build list of reconcilable accounts: bank accounts + credit cards
  var banks=c.bankAccounts&&c.bankAccounts.length?c.bankAccounts:[{id:'default',name:'Checking account',type:'bank'}];
  var ccs=(c.creditCards||[]).map(function(cc){return{id:'cc:'+cc.id,name:cc.name+' (credit card)',type:'cc',ccRef:cc};});
  var allAccts=banks.map(function(b){return{id:'bank:'+b.id,name:b.name,type:'bank',ref:b};}).concat(ccs);

  // Ensure RECON_ACCT is valid
  if(!allAccts.find(function(a){return a.id===RECON_ACCT;}))RECON_ACCT=allAccts[0].id;
  var selAcct=allAccts.find(function(a){return a.id===RECON_ACCT;})||allAccts[0];

  // COA cash accounts treated as reconcilable banks
  var coaBanks=(c.accounts||[]).filter(function(a){
    if(a.type!=='Asset')return false;
    var n=(a.name||'').toLowerCase(),cat=(a.cat||'').toLowerCase();
    return cat==='cash'||n.indexOf('checking')>=0||n.indexOf('savings')>=0||n.indexOf('cash')>=0||n.indexOf('bank')>=0;
  });
  var hasRealBank=c.bankAccounts&&c.bankAccounts.length>0;
  var hasAnyCleared=(c.expenses||[]).some(function(e){return e.reconciled;})||(c.income||[]).some(function(r){return r.reconciled;})||(c.revenue||[]).some(function(r){return r.reconciled;});
  var onboardHtml='';
  if(!coaBanks.length&&!hasRealBank&&!hasAnyCleared){
    onboardHtml='<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1.5rem;margin-bottom:1.25rem">'      +'<div style="font-size:14px;font-weight:600;margin-bottom:.35rem">Set up reconciliation</div>'      +'<div style="font-size:12px;color:var(--muted);line-height:1.7;margin-bottom:.875rem">'      +'Reconciliation is manual — no live bank connection. You work from your actual bank statement and check off transactions here.<br><br>'      +'<strong style="color:var(--text)">Tip:</strong> If you already set up bank or cash accounts in your Chart of Accounts, they appear here automatically. Otherwise add one below.<br><br>'      +'<strong style="color:var(--text)">1.</strong> Add your bank account (or check your COA — it may already be there)<br>'      +'<strong style="color:var(--text)">2.</strong> Pull up your bank statement from your bank\'s website<br>'      +'<strong style="color:var(--text)">3.</strong> Enter opening and closing balances, then check off each transaction'      +'</div>'      +'<div style="display:flex;gap:.5rem;flex-wrap:wrap">'      +'<button onclick="var b=document.querySelector(\'[data-panel=bank]\');if(b)switchTab({target:b},\'bank\')" style="padding:7px 16px;border:none;border-radius:7px;background:var(--np);color:#fff;font-size:12px;font-weight:500;cursor:pointer"><i class="fas fa-building-columns"></i> Go to Bank tab to import</button>'      +'</div></div>';
  }

  var _bankLink='<button class="add-btn" style="font-size:11px;padding:4px 10px" onclick="var b=document.querySelector(\'[data-panel=bank]\');if(b)switchTab({target:b},\'bank\')"><i class="fas fa-building-columns"></i> Import via Bank tab</button>';
  var _bankIdx=selAcct.type==='bank'&&selAcct.ref?(c.bankAccounts||[]).indexOf(selAcct.ref):-1;
  var _checkSettingsLink=_bankIdx>=0?'<button class="add-btn" style="font-size:11px;padding:4px 10px" onclick="editBankAcct('+_bankIdx+')" title="Set check numbering for printing checks from this account"><i class="fas fa-gear"></i> Check settings</button>':'';
  var acctPicker=allAccts.length>1?'<div style="display:flex;align-items:center;gap:8px;margin-bottom:1rem;flex-wrap:wrap"><span style="font-size:12px;color:var(--muted)">Account:</span><div class="sw"><select onchange="RECON_ACCT=this.value;renderReconciliation(gc())">'+allAccts.map(function(a){return'<option value="'+a.id+'"'+(RECON_ACCT===a.id?' selected':'')+'>'+escHtml(a.name)+'</option>';}).join('')+'</select></div>'
  +_bankLink+_checkSettingsLink
  +'</div>':'<div style="margin-bottom:.75rem;display:flex;gap:8px;align-items:center"><span style="font-size:12px;color:var(--muted)">Account: <strong>'+escHtml(selAcct.name)+'</strong></span>'+_bankLink+_checkSettingsLink+'</div>';

  // Get per-account recon state
  var stateKey='reconState_'+RECON_ACCT;
  if(!c[stateKey])c[stateKey]={openBal:0,closeBal:0,periodStart:'',periodEnd:''};
  var rs=c[stateKey];
  var openBal=Number(rs.openBal||0);
  var closeBal=Number(rs.closeBal||0);

  // For CC accounts: filter expenses tagged to that CC
  var isCCRecon=RECON_ACCT.indexOf('cc:')=== 0;
  var ccId=isCCRecon?RECON_ACCT.slice(3):null;

  function inPeriod(item){
    if(!rs.periodStart&&!rs.periodEnd)return true;
    var d=parseDate(item.date||'');if(!d)return true;
    if(rs.periodStart&&d<parseDate(rs.periodStart))return false;
    if(rs.periodEnd&&d>parseDate(rs.periodEnd))return false;
    return true;
  }

  var periExp,periRev;
  if(isCCRecon){
    // CC reconciliation: only charges on that card
    periExp=exp.filter(function(e){return e.ccId===ccId&&inPeriod(e);});
    periRev=[];// CC payments are expenses not income
  }else{
    // Bank: filter by bankId if set, otherwise show untagged
    var bankId=RECON_ACCT.slice(5);// strip 'bank:'
    var isDefault=!bankId||bankId==='default';
    periExp=exp.filter(function(e){return(!e.bankId||isDefault||(e.bankId===bankId))&&inPeriod(e);});
    periRev=(c.type==='sb'?rev:c.income||[]).filter(function(r){return(!r.bankId||isDefault||(r.bankId===bankId))&&inPeriod(r);});
  }

  var unreconExp=periExp.filter(function(e){return!e.reconciled;});
  var unreconInc=periRev.filter(function(r){return r.reconciled!==true;});
  var outstandingChecks=unreconExp.filter(function(e){return e.cat&&(e.cat.toLowerCase().indexOf('check')>=0||e.cat.toLowerCase().indexOf('payable')>=0)||(!e.date);});
  var otherUnrecon=unreconExp.filter(function(e){return outstandingChecks.indexOf(e)<0;});

  var clearedInc=periRev.filter(function(r){return r.reconciled===true;}).reduce(function(s,r){return s+Number(r.act||r.amt||r.recv||0);},0);
  var clearedExp=periExp.filter(function(e){return e.reconciled;}).reduce(function(s,e){return s+Number(e.amt||0);},0);
  var rawBookBal=openBal+(isCCRecon?-clearedExp:clearedInc-clearedExp);
  // Use ledger-derived balance as book balance when available (more accurate)
  // _ledgerBal is computed below before the metrics bar; hoist the computation here
  var _earlyLedgerBal=null;
  if(!isCCRecon&&(c.ledgerEntries||[]).length){
    var _eBankAcct=selAcct&&selAcct.ref;
    var _eCashCode=_eBankAcct&&_eBankAcct.acctCode?_eBankAcct.acctCode:_defaultCashCode(c);
    var _eLdr=0;
    _activeLedgerEntries(c).forEach(function(e){
      (e.lines||[]).forEach(function(l){if(l.accountCode===_eCashCode)_eLdr+=(Number(l.dr||0)-Number(l.cr||0));});
    });
    _earlyLedgerBal=_eLdr;
  }
  var bookBal=_earlyLedgerBal!==null?_earlyLedgerBal:rawBookBal;
  var diff=closeBal-bookBal;

  function expRow(e,label){var oi=exp.indexOf(e);var bankBadge=e.fromBank?'<span class="badge" style="font-size:9px;background:var(--blue-bg);color:var(--blue);margin-left:3px"><i class="fas fa-building-columns"></i> imported</span>':'';return'<tr><td>'+escHtml(e.desc||'—')+bankBadge+'</td><td>'+escHtml(e.cat||'—')+'</td><td class="vr">'+fmt(e.amt)+'</td><td style="color:var(--muted)">'+(e.date||'—')+'</td><td><span class="badge b-amber" style="font-size:9px">'+label+'</span></td><td style="white-space:nowrap"><input type="checkbox" class="rcb" onchange="sbRC('+oi+');renderReconciliation(gc())" title="Clear"> <button class="add-btn" style="font-size:10px;padding:2px 8px" onclick="editItem(\'expenses\','+oi+')"><i class="fas fa-pen"></i> Edit</button></td></tr>';}
  function incRow(r){var src=c.type==='sb'?rev:c.income||[];var oi=src.indexOf(r);var incType=c.type==='sb'?'revenue':'income';var bankBadge=r.fromBank?'<span class="badge" style="font-size:9px;background:var(--blue-bg);color:var(--blue);margin-left:3px"><i class="fas fa-building-columns"></i> imported</span>':'';return'<tr><td>'+escHtml(r.name||r.desc||'—')+bankBadge+'</td><td>'+escHtml(r.cat||'—')+'</td><td class="vg">'+fmt(r.act||r.amt||r.recv||0)+'</td><td style="color:var(--muted)">'+(r.date||'—')+'</td><td><span class="badge b-blue" style="font-size:9px">Deposit</span></td><td style="white-space:nowrap"><input type="checkbox" class="rcb" onchange="reconIncRC('+oi+');renderReconciliation(gc())" title="Clear"> <button class="add-btn" style="font-size:10px;padding:2px 8px" onclick="editItem(\''+incType+'\','+oi+')"><i class="fas fa-pen"></i> Edit</button></td></tr>';}
  function clearedExpRow(e){var oi=exp.indexOf(e);return'<tr style="opacity:.85"><td>'+escHtml(e.desc||'—')+'</td><td>'+escHtml(e.cat||'—')+'</td><td class="vr">'+fmt(e.amt)+'</td><td style="color:var(--muted)">'+(e.date||'—')+'</td><td><span class="badge" style="font-size:9px;background:var(--green-bg);color:var(--green)"><i class="fas fa-check"></i> Cleared</span></td><td style="white-space:nowrap"><button class="add-btn" style="font-size:10px;padding:2px 8px" onclick="editItem(\'expenses\','+oi+')"><i class="fas fa-pen"></i> Edit</button> <button class="add-btn" style="font-size:10px;padding:2px 8px;background:none;border:1px solid var(--border);color:var(--muted)" onclick="unreconcileExp('+oi+')">Undo</button></td></tr>';}
  function clearedIncRow(r){var src=c.type==='sb'?rev:c.income||[];var oi=src.indexOf(r);var incType=c.type==='sb'?'revenue':'income';return'<tr style="opacity:.85"><td>'+escHtml(r.name||r.desc||'—')+'</td><td>'+escHtml(r.cat||'—')+'</td><td class="vg">'+fmt(r.act||r.amt||r.recv||0)+'</td><td style="color:var(--muted)">'+(r.date||'—')+'</td><td><span class="badge" style="font-size:9px;background:var(--green-bg);color:var(--green)"><i class="fas fa-check"></i> Cleared</span></td><td style="white-space:nowrap"><button class="add-btn" style="font-size:10px;padding:2px 8px" onclick="editItem(\''+incType+'\','+oi+')"><i class="fas fa-pen"></i> Edit</button> <button class="add-btn" style="font-size:10px;padding:2px 8px;background:none;border:1px solid var(--border);color:var(--muted)" onclick="unreconcileInc('+oi+')">Undo</button></td></tr>';}

  // Split items to clear: bank-imported vs CC-imported vs manual
  // Income/revenue also splits by fromBank so bank-imported deposits show with bank-imported expenses
  var bankImportedRows = otherUnrecon.filter(function(e){return e.fromBank&&!e.ccId;}).map(function(e){return expRow(e,'Bank import');}).join('')
    + unreconInc.filter(function(r){return r.fromBank;}).map(function(r){return incRow(r);}).join('');
  var ccImportedRows   = otherUnrecon.filter(function(e){return e.ccId;}).map(function(e){return expRow(e,'CC charge');}).join('');
  var manualRows       = outstandingChecks.map(function(e){return expRow(e,'Outstanding check');}).join('')
    + otherUnrecon.filter(function(e){return !e.fromBank&&!e.ccId;}).map(function(e){return expRow(e,'Uncleared');}).join('')
    + unreconInc.filter(function(r){return !r.fromBank;}).map(function(r){return incRow(r);}).join('');
  // Apply status filter
  if(RECON_STATUS_FILTER==='uncleared'){
    // Already only showing uncleared — keep as-is
  } else if(RECON_STATUS_FILTER==='cleared'){
    bankImportedRows=''; ccImportedRows=''; manualRows='';
  }
  var allRows=bankImportedRows+ccImportedRows+manualRows;
  // Cleared items (reconciled=true) — show with Undo button
  var clearedExpItems = periExp.filter(function(e){return e.reconciled;});
  var clearedIncItems = periRev.filter(function(r){return r.reconciled===true;});
  var _showCleared = RECON_STATUS_FILTER !== 'uncleared';
  var clearedBankRows = _showCleared?(clearedExpItems.filter(function(e){return !e.ccId;}).map(function(e){return clearedExpRow(e);}).join('')+clearedIncItems.map(function(r){return clearedIncRow(r);}).join('')):'' ;
  var clearedCCRows = _showCleared?clearedExpItems.filter(function(e){return !!e.ccId;}).map(function(e){return clearedExpRow(e);}).join(''):'' ;
  var clearedRows = clearedBankRows + clearedCCRows;

  // Ledger balance already computed above as _earlyLedgerBal; reuse it
  var _ledgerBal=_earlyLedgerBal;
  var stateUpdFn='gc()[\''+stateKey+'\']';
  var filterBar='<div style="display:flex;align-items:center;gap:8px;margin-bottom:1rem;flex-wrap:wrap">'
    +'<span style="font-size:12px;font-weight:500">Show:</span>'
    +'<button onclick="setReconFilter(\'all\')" style="font-size:11px;padding:4px 12px;border-radius:20px;border:1px solid '+(RECON_STATUS_FILTER==='all'?'var(--text)':'var(--border)')+';background:'+(RECON_STATUS_FILTER==='all'?'var(--text)':'none')+';color:'+(RECON_STATUS_FILTER==='all'?'#fff':'var(--muted)')+';cursor:pointer;font-family:DM Sans,sans-serif">All</button>'
    +'<button onclick="setReconFilter(\'uncleared\')" style="font-size:11px;padding:4px 12px;border-radius:20px;border:1px solid '+(RECON_STATUS_FILTER==='uncleared'?'var(--amber)':'var(--border)')+';background:'+(RECON_STATUS_FILTER==='uncleared'?'var(--amber-bg)':'none')+';color:'+(RECON_STATUS_FILTER==='uncleared'?'var(--amber)':'var(--muted)')+';cursor:pointer;font-family:DM Sans,sans-serif">Uncleared</button>'
    +'<button onclick="setReconFilter(\'cleared\')" style="font-size:11px;padding:4px 12px;border-radius:20px;border:1px solid '+(RECON_STATUS_FILTER==='cleared'?'var(--green)':'var(--border)')+';background:'+(RECON_STATUS_FILTER==='cleared'?'var(--green-bg)':'none')+';color:'+(RECON_STATUS_FILTER==='cleared'?'var(--green)':'var(--muted)')+';cursor:pointer;font-family:DM Sans,sans-serif">Cleared</button>'
    
    +'</div>';

  p.innerHTML=FB()+XB('recon')
  +onboardHtml
  +filterBar
  +acctPicker
  +'<div class="card" style="margin-bottom:1rem">'
  +'<div class="c-title" style="margin-bottom:.75rem">Reconciliation — <span style="font-size:11px;color:var(--muted)">'+escHtml(selAcct.name)+'</span>'+(isCCRecon?' <span class="badge b-blue">Credit card</span>':'')+'</div>'
  +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;flex-wrap:wrap">'
  +'<div><div style="font-size:11px;color:var(--muted);margin-bottom:4px">Period start</div><input id="recon-ps" type="text" value="'+(rs.periodStart||'')+'" placeholder="MM/DD/YYYY" onchange="reconSaveField(\'periodStart\',this.value);renderReconciliation(gc())" style="font-size:12px;padding:6px 8px;border:1px solid var(--border);border-radius:7px;width:100%;font-family:DM Sans,sans-serif"></div>'
  +'<div><div style="font-size:11px;color:var(--muted);margin-bottom:4px">Period end</div><input id="recon-pe" type="text" value="'+(rs.periodEnd||'')+'" placeholder="MM/DD/YYYY" onchange="reconSaveField(\'periodEnd\',this.value);renderReconciliation(gc())" style="font-size:12px;padding:6px 8px;border:1px solid var(--border);border-radius:7px;width:100%;font-family:DM Sans,sans-serif"></div>'
  +'<div><div style="font-size:11px;color:var(--muted);margin-bottom:4px">'+(isCCRecon?'Previous balance ($)':'Opening balance ($)')+'</div><input id="recon-ob" type="number" value="'+(rs.openBal||'')+'" placeholder="0" onchange="reconSaveField(\'openBal\',this.value);renderReconciliation(gc())" style="font-size:12px;padding:6px 8px;border:1px solid var(--border);border-radius:7px;width:100%;font-family:DM Sans,sans-serif"></div>'
  +'<div><div style="font-size:11px;color:var(--muted);margin-bottom:4px">Statement closing balance ($)</div><input id="recon-cb" type="number" value="'+(rs.closeBal||'')+'" placeholder="0" onchange="reconSaveField(\'closeBal\',this.value);renderReconciliation(gc())" style="font-size:12px;padding:6px 8px;border:1px solid var(--border);border-radius:7px;width:100%;font-family:DM Sans,sans-serif"></div>'
  +'</div></div>'
  +'<div class="metrics"><div class="metric"><div class="m-lbl">'+(isCCRecon?'Prev balance':'Opening balance')+'</div><div class="m-val">'+fmt(openBal)+'</div></div>'+'<div class="metric"><div class="m-lbl" title="'+(_ledgerBal!==null?'Sourced from double-entry ledger (most accurate)':'Sourced from cleared transactions')+'">'+'Book balance'+(_ledgerBal!==null?' <i class="fas fa-check"></i>':'')+' </div><div class="m-val">'+fmt(bookBal)+'</div></div>'+(_ledgerBal!==null&&Math.abs(_ledgerBal-rawBookBal)>=1?'<div class="metric"><div class="m-lbl" title="Raw cleared-transaction balance before ledger correction">Cleared bal.</div><div class="m-val va">'+fmt(rawBookBal)+'</div></div>':'')+'<div class="metric"><div class="m-lbl">Statement balance</div><div class="m-val vb">'+fmt(closeBal)+'</div></div></div>'
  +'<div class="metrics" style="margin-top:0">'
  +'<div class="metric"><div class="m-lbl">Difference</div><div class="m-val '+(Math.abs(diff)<1?'vg':'vr')+'">'+fmt(diff)+'</div></div>'
  +'<div class="metric"><div class="m-lbl">Outstanding checks</div><div class="m-val '+(outstandingChecks.length?'va':'vg')+'">'+outstandingChecks.length+'</div></div>'
  +'<div class="metric"><div class="m-lbl">Other uncleared</div><div class="m-val '+(otherUnrecon.length+unreconInc.length?'va':'vg')+'">'+(otherUnrecon.length+unreconInc.length)+'</div></div>'
  +'</div>'
  +(Math.abs(diff)<1
    ?'<div class="insight" style="border-left-color:var(--green)"><div class="ins-lbl"><i class="fas fa-check"></i> Reconciled</div>Statement and book balances match.'+((!isCCRecon)?'<button class="add-btn" style="margin-left:1rem" onclick="postReconToBS()">Post to balance sheet</button>':'')+'</div>'
    :'<div class="insight" style="border-left-color:var(--amber)"><div class="ins-lbl">Difference: '+fmt(Math.abs(diff))+'</div>Clear transactions below to reconcile.</div>')
  +'<div style="margin-bottom:.75rem;display:flex;gap:8px;flex-wrap:wrap"><button class="add-btn" onclick="markSelectedRecon()"><i class="fas fa-check"></i> Mark selected</button><button class="add-btn" onclick="markAllRecon()"><i class="fas fa-check"></i> Mark all</button><button class="add-btn" style="background:none;border:1px solid var(--border);color:var(--muted)" onclick="unmarkAllRecon()"><i class="fas fa-rotate-left"></i> Undo all</button><button class="add-btn" onclick="reconPullMissing()"><i class="fas fa-arrow-down"></i> Pull in missing</button><button class="add-btn" onclick="printReconStatement()" title="Export PDF for auditors"><i class="fas fa-print"></i> Print statement</button></div>'
  +(allRows
    ?( (bankImportedRows?'<div class="card" style="margin-bottom:1rem;border-left:3px solid var(--blue)"><div class="c-head"><span class="c-title"><i class="fas fa-building-columns"></i> Bank transactions ('+(otherUnrecon.filter(function(e){return e.fromBank&&!e.ccId;}).length+unreconInc.filter(function(r){return r.fromBank;}).length)+')</span></div><table><thead><tr><th style="width:24%">Description</th><th style="width:13%">Category</th><th style="width:10%">Amount</th><th style="width:11%">Date</th><th style="width:12%">Type</th><th style="width:30%">Clear</th></tr></thead><tbody>'+bankImportedRows+'</tbody></table></div>':'')
    +(ccImportedRows?'<div class="card" style="margin-bottom:1rem;border-left:3px solid var(--np)"><div class="c-head"><span class="c-title"><i class="fas fa-credit-card"></i> Credit card charges ('+otherUnrecon.filter(function(e){return e.ccId;}).length+')</span></div><table><thead><tr><th style="width:24%">Description</th><th style="width:13%">Category</th><th style="width:10%">Amount</th><th style="width:11%">Date</th><th style="width:12%">Type</th><th style="width:30%">Clear</th></tr></thead><tbody>'+ccImportedRows+'</tbody></table></div>':'')
    +(manualRows?'<div class="card" style="margin-bottom:1rem"><div class="c-head"><span class="c-title"><i class="fas fa-clipboard"></i> Manual &amp; other ('+(outstandingChecks.length+otherUnrecon.filter(function(e){return !e.fromBank&&!e.ccId;}).length+unreconInc.filter(function(r){return !r.fromBank;}).length)+')</span></div><table><thead><tr><th style="width:24%">Description</th><th style="width:13%">Category</th><th style="width:10%">Amount</th><th style="width:11%">Date</th><th style="width:12%">Type</th><th style="width:30%">Clear</th></tr></thead><tbody>'+manualRows+'</tbody></table></div>':'') )
    :'<div class="card"><div style="text-align:center;padding:1.5rem;color:var(--green);font-size:13px"><i class="fas fa-check"></i> All transactions cleared</div></div>')
  +(clearedBankRows?'<div class="card" style="margin-top:1rem;border-left:3px solid var(--blue)"><div class="c-head"><span class="c-title" style="color:var(--blue)"><i class="fas fa-building-columns"></i> Cleared — Bank &amp; Income ('+(clearedExpItems.filter(function(e){return !e.ccId;}).length+clearedIncItems.length)+')</span><button class="add-btn" style="font-size:10px;padding:3px 10px;background:none;border:1px solid var(--border);color:var(--muted)" onclick="unmarkAllRecon()"><i class="fas fa-rotate-left"></i> Undo all</button></div><table><thead><tr><th style="width:26%">Description</th><th style="width:14%">Category</th><th style="width:10%">Amount</th><th style="width:11%">Date</th><th style="width:12%">Status</th><th style="width:27%">Action</th></tr></thead><tbody>'+clearedBankRows+'</tbody></table></div>':'')
  +(clearedCCRows?'<div class="card" style="margin-top:1rem;border-left:3px solid var(--np)"><div class="c-head"><span class="c-title" style="color:var(--np)"><i class="fas fa-credit-card"></i> Cleared — Credit Cards ('+clearedExpItems.filter(function(e){return !!e.ccId;}).length+')</span></div><table><thead><tr><th style="width:26%">Description</th><th style="width:14%">Category</th><th style="width:10%">Amount</th><th style="width:11%">Date</th><th style="width:12%">Status</th><th style="width:27%">Action</th></tr></thead><tbody>'+clearedCCRows+'</tbody></table></div>':'');
}

function printReconStatement(){
  var c=gc();if(!c)return;
  var stateKey='reconState_'+RECON_ACCT;
  var rs=c[stateKey]||{openBal:0,closeBal:0,periodStart:'',periodEnd:''};
  var exp=c.expenses||[];var rev=c.type==='sb'?c.revenue||[]:c.income||[];

  // Identify account
  var banks=c.bankAccounts&&c.bankAccounts.length?c.bankAccounts:[{id:'default',name:'Checking account',type:'bank'}];
  var ccs=(c.creditCards||[]).map(function(cc){return{id:'cc:'+cc.id,name:cc.name+' (credit card)',type:'cc'};});
  var allAccts=banks.map(function(b){return{id:'bank:'+b.id,name:b.name,type:'bank'};}).concat(ccs);
  var selAcct=allAccts.find(function(a){return a.id===RECON_ACCT;})||allAccts[0]||{name:'Account'};
  var isCCRecon=RECON_ACCT.indexOf('cc:')===0;
  var ccId=isCCRecon?RECON_ACCT.slice(3):null;
  var bankId=!isCCRecon?RECON_ACCT.slice(5):null;
  var isDefault=!bankId||bankId==='default';

  function inPeriod(item){
    if(!rs.periodStart&&!rs.periodEnd)return true;
    var d=parseDate(item.date||'');if(!d)return true;
    if(rs.periodStart&&d<parseDate(rs.periodStart))return false;
    if(rs.periodEnd&&d>parseDate(rs.periodEnd))return false;
    return true;
  }

  var periExp=isCCRecon
    ?exp.filter(function(e){return e.ccId===ccId&&inPeriod(e);})
    :exp.filter(function(e){return(!e.bankId||isDefault||(e.bankId===bankId))&&inPeriod(e);});
  var periRev=isCCRecon?[]:rev.filter(function(r){return(!r.bankId||isDefault||(r.bankId===bankId))&&inPeriod(r);});

  var openBal=Number(rs.openBal||0);
  var closeBal=Number(rs.closeBal||0);
  var clearedInc=periRev.filter(function(r){return r.reconciled===true;}).reduce(function(s,r){return s+Number(r.act||r.amt||r.recv||0);},0);
  var clearedExp=periExp.filter(function(e){return e.reconciled;}).reduce(function(s,e){return s+Number(e.amt||0);},0);
  var bookBal=openBal+(isCCRecon?-clearedExp:clearedInc-clearedExp);
  var diff=closeBal-bookBal;

  var unreconExp=periExp.filter(function(e){return!e.reconciled;});
  var unreconInc=periRev.filter(function(r){return r.reconciled!==true;});
  var outChecks=unreconExp.filter(function(e){return e.cat&&(e.cat.toLowerCase().indexOf('check')>=0||e.cat.toLowerCase().indexOf('payable')>=0)||(!e.date);});
  var otherUnrecon=unreconExp.filter(function(e){return outChecks.indexOf(e)<0;});

  function fmtN(n){return'$'+Number(n||0).toLocaleString();}
  function row(cells,cls){return'<tr'+(cls?' class="'+cls+'"':'')+'>'+cells.map(function(cx,i){return'<td'+(i>0?' style="text-align:right"':'')+'>'+cx+'</td>';}).join('')+'</tr>';}

  var clearedExpRows=periExp.filter(function(e){return e.reconciled;}).map(function(e){return row([e.date||'—',escHtml(e.desc||'—'),escHtml(e.cat||'—'),'('+fmtN(e.amt)+')']);}).join('');
  var clearedIncRows=periRev.filter(function(r){return r.reconciled===true;}).map(function(r){return row([r.date||'—',escHtml(r.name||r.desc||'—'),escHtml(r.cat||'—'),fmtN(r.act||r.amt||r.recv||0)]);}).join('');
  var outCheckRows=outChecks.map(function(e){return row([e.date||'—',escHtml(e.desc||'—'),escHtml(e.cat||'—'),'('+fmtN(e.amt)+')'],'muted');}).join('');
  var otherUnreconRows=otherUnrecon.map(function(e){return row([e.date||'—',escHtml(e.desc||'—'),escHtml(e.cat||'—'),'('+fmtN(e.amt)+')'],'muted');}).join('');
  var unreconIncRows=unreconInc.map(function(r){return row([r.date||'—',escHtml(r.name||r.desc||'—'),escHtml(r.cat||'—'),fmtN(r.act||r.amt||r.recv||0)],'muted');}).join('');

  var th='<tr><th>Date</th><th style="text-align:right">Description</th><th style="text-align:right">Category</th><th style="text-align:right">Amount</th></tr>';
  var statusBadge=Math.abs(diff)<1
    ?'<span style="background:#d4edda;color:#155724;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600"><i class="fas fa-check"></i> RECONCILED</span>'
    :'<span style="background:#fff3cd;color:#856404;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600"><i class="fas fa-triangle-exclamation"></i> DIFFERENCE: '+fmtN(Math.abs(diff))+'</span>';

  var body='<h2 style="margin:0 0 4px">Bank Reconciliation Statement</h2>';
  body+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.5rem;flex-wrap:wrap;gap:.5rem">';
  body+='<div><div style="font-weight:600;font-size:14px">'+escHtml(selAcct.name)+'</div><div style="color:#888;font-size:12px">'+escHtml(c.name)+'</div>'+(rs.periodStart||rs.periodEnd?'<div style="color:#888;font-size:11px;margin-top:2px">Period: '+(rs.periodStart||'—')+' to '+(rs.periodEnd||'—')+'</div>':'')+'</div>';
  body+='<div style="text-align:right">'+statusBadge+'<div style="font-size:11px;color:#888;margin-top:4px">Printed '+today()+'</div></div>';
  body+='</div>';

  body+='<table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem;font-size:12px">';
  body+='<thead><tr style="background:#f5f3ee"><th colspan="2" style="padding:8px;text-align:left">Balance Summary</th><th style="padding:8px;text-align:right">Amount</th></tr></thead><tbody>';
  body+='<tr><td colspan="2" style="padding:6px 8px">'+(isCCRecon?'Previous balance':'Opening balance (per statement)')+'</td><td style="padding:6px 8px;text-align:right">'+fmtN(openBal)+'</td></tr>';
  if(!isCCRecon){body+='<tr><td colspan="2" style="padding:6px 8px">+ Deposits cleared</td><td style="padding:6px 8px;text-align:right">'+fmtN(clearedInc)+'</td></tr>';}
  body+='<tr><td colspan="2" style="padding:6px 8px">− Charges cleared</td><td style="padding:6px 8px;text-align:right">('+fmtN(clearedExp)+')</td></tr>';
  body+='<tr style="font-weight:600;border-top:1px solid #ddd"><td colspan="2" style="padding:6px 8px">Book balance</td><td style="padding:6px 8px;text-align:right">'+fmtN(bookBal)+'</td></tr>';
  body+='<tr><td colspan="2" style="padding:6px 8px">Statement closing balance</td><td style="padding:6px 8px;text-align:right">'+fmtN(closeBal)+'</td></tr>';
  body+='<tr style="font-weight:700;border-top:2px solid #333;'+(Math.abs(diff)<1?'color:#155724':'color:#856404')+'"><td colspan="2" style="padding:6px 8px">Difference</td><td style="padding:6px 8px;text-align:right">'+fmtN(diff)+'</td></tr>';
  body+='</tbody></table>';

  if(clearedExpRows||clearedIncRows){
    body+='<h3 style="font-size:12px;margin:1rem 0 .5rem">Cleared Transactions</h3>';
    body+='<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:1.5rem"><thead>'+th+'</thead><tbody>'+(clearedIncRows+clearedExpRows||'<tr><td colspan="4">None</td></tr>')+'</tbody></table>';
  }

  if(outCheckRows||otherUnreconRows||unreconIncRows){
    body+='<h3 style="font-size:12px;margin:1rem 0 .5rem">Outstanding / Uncleared Items</h3>';
    if(outCheckRows)body+='<p style="font-size:10px;color:#888;margin-bottom:4px">Outstanding checks:</p><table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:.75rem"><thead>'+th+'</thead><tbody>'+outCheckRows+'</tbody></table>';
    if(otherUnreconRows)body+='<p style="font-size:10px;color:#888;margin-bottom:4px">Other uncleared expenses:</p><table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:.75rem"><thead>'+th+'</thead><tbody>'+otherUnreconRows+'</tbody></table>';
    if(unreconIncRows)body+='<p style="font-size:10px;color:#888;margin-bottom:4px">Deposits in transit:</p><table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:.75rem"><thead>'+th+'</thead><tbody>'+unreconIncRows+'</tbody></table>';
  }

  body+='<div style="margin-top:2.5rem;display:grid;grid-template-columns:1fr 1fr;gap:3rem">';
  body+='<div><div style="border-top:1px solid #333;padding-top:4px;font-size:11px;color:#888">Prepared by / Date</div></div>';
  body+='<div><div style="border-top:1px solid #333;padding-top:4px;font-size:11px;color:#888">Reviewed by / Date</div></div>';
  body+='</div>';

  openPDF(body+pdfDisclaimer('Bank reconciliation should be reviewed and approved by a supervisor or CPA. This report does not constitute a certified bank reconciliation.'),c,'Bank Reconciliation — '+selAcct.name);
}
function reconIncRC(i){
  var c=gc();
  var src=c.type==='sb'?c.revenue:c.income;
  if(!src||!src[i])return;
  src[i].reconciled=src[i].reconciled===true?false:true;
  sv();renderReconciliation(c);
}

function unreconcileExp(oi){
  var c=gc();if(!c||!c.expenses[oi])return;
  c.expenses[oi].reconciled=false;
  sv();renderReconciliation(c);
}

function unreconcileInc(oi){
  var c=gc();
  var src=c.type==='sb'?c.revenue:c.income;
  if(!src||!src[oi])return;
  src[oi].reconciled=false;
  sv();renderReconciliation(c);
}

function unmarkAllRecon(){
  var c=gc();if(!c)return;
  if(!confirm('Undo all cleared transactions for this period? This will unmark all items as reconciled.'))return;
  // Only unmark items in the current account/period scope
  var isCCRecon=RECON_ACCT.indexOf('cc:')===0;
  var ccId=isCCRecon?RECON_ACCT.slice(3):null;
  var bankId=!isCCRecon?RECON_ACCT.slice(5):null;
  var isDefault=!bankId||bankId==='default';
  if(isCCRecon){
    (c.expenses||[]).forEach(function(e){if(e.ccId===ccId)e.reconciled=false;});
  }else{
    (c.expenses||[]).forEach(function(e){if(!e.bankId||isDefault||(e.bankId===bankId))e.reconciled=false;});
    var src=c.type==='sb'?c.revenue:c.income||[];
    src.forEach(function(r){if(!r.bankId||isDefault||(r.bankId===bankId))r.reconciled=false;});
  }
  sv();renderReconciliation(c);
}

// ── PULL MISSING TRANSACTIONS INTO RECONCILIATION ─────────────
// Shows a modal listing all expenses/income that are in the books
// but not currently visible in the reconciliation panel — because
// they have no bankId tag, or have a different bankId, or were
// manually entered and never pulled in. User can check them off
// and click "Add to reconciliation" to tag them to the current account.
function reconPullMissing(){
  var c=gc();if(!c)return;
  var stateKey='reconState_'+RECON_ACCT;
  if(!c[stateKey])c[stateKey]={openBal:0,closeBal:0,periodStart:'',periodEnd:''};
  var rs=c[stateKey];

  var isCCRecon=RECON_ACCT.indexOf('cc:')===0;
  var ccId=isCCRecon?RECON_ACCT.slice(3):null;
  var bankId=!isCCRecon?RECON_ACCT.slice(5):null;
  var isDefault=bankId==='default';

  function inPeriod(item){
    if(!rs.periodStart&&!rs.periodEnd)return true;
    var d=parseDate(item.date||'');if(!d)return true;
    if(rs.periodStart&&d<parseDate(rs.periodStart))return false;
    if(rs.periodEnd&&d>parseDate(rs.periodEnd))return false;
    return true;
  }

  // Find expenses NOT currently included in this reconciliation
  var allExp=(c.expenses||[]).filter(function(e){return!e.deleted&&!e.voided&&!e.isReversal;});
  var allInc=(c.type==='sb'?c.revenue||[]:c.income||[]).filter(function(r){return!r.deleted&&!r.voided;});

  var missingExp, missingInc;
  if(isCCRecon){
    // For CC: items NOT tagged to this card
    missingExp=allExp.filter(function(e){return e.ccId!==ccId&&inPeriod(e);});
    missingInc=[];
  } else if(isDefault){
    // Default account: items that have a specific bankId (they're excluded from default view)
    missingExp=allExp.filter(function(e){return!!e.bankId&&inPeriod(e);});
    missingInc=allInc.filter(function(r){return!!r.bankId&&inPeriod(r);});
  } else {
    // Specific bank account: items with no bankId or a different bankId
    missingExp=allExp.filter(function(e){return e.bankId!==bankId&&inPeriod(e);});
    missingInc=allInc.filter(function(r){return r.bankId!==bankId&&inPeriod(r);});
  }

  // Sort by date desc
  function byDate(a,b){return new Date(b.date||0)-new Date(a.date||0);}
  missingExp.sort(byDate);
  missingInc.sort(byDate);

  if(!missingExp.length&&!missingInc.length){
    alert('No missing transactions found for this period.\n\nAll expenses and income entries are already included in this reconciliation account.');
    return;
  }

  // Build modal
  var existing=document.getElementById('recon-pull-modal');
  if(existing)existing.parentNode.removeChild(existing);

  var div=document.createElement('div');
  div.innerHTML='<div class="overlay open" id="recon-pull-modal" style="z-index:10001">'
    +'<div class="modal" style="max-width:760px;max-height:88vh;display:flex;flex-direction:column;padding:0;overflow:hidden">'

    // Header
    +'<div style="display:flex;align-items:center;justify-content:space-between;padding:.9rem 1.25rem;border-bottom:1px solid var(--border);flex-shrink:0">'
    +'<div><div style="font-size:15px;font-weight:600"><i class="fas fa-arrow-down"></i> Pull in missing transactions</div>'
    +'<div style="font-size:11px;color:var(--muted);margin-top:2px">These are in your books but not in the current reconciliation. Check the ones you want to add.</div></div>'
    +'<button class="cx" onclick="document.getElementById(\'recon-pull-modal\').classList.remove(\'open\');setTimeout(function(){var m=document.getElementById(\'recon-pull-modal\');if(m)m.parentNode.removeChild(m);},300)">&#215;</button>'
    +'</div>'

    // Scrollable list
    +'<div style="flex:1;overflow-y:auto;padding:1rem 1.25rem">'

    // Expenses section
    +(missingExp.length?'<div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem">Expenses ('+missingExp.length+')</div>'
    +'<table style="width:100%;font-size:12px;border-collapse:collapse;margin-bottom:1.25rem">'
    +'<thead><tr style="border-bottom:1px solid var(--border)">'
    +'<th style="padding-bottom:.4rem;width:26px"></th>'
    +'<th style="text-align:left;padding-bottom:.4rem;color:var(--muted);font-weight:500">Description</th>'
    +'<th style="text-align:left;padding-bottom:.4rem;color:var(--muted);font-weight:500">Category</th>'
    +'<th style="text-align:right;padding-bottom:.4rem;color:var(--muted);font-weight:500">Amount</th>'
    +'<th style="text-align:left;padding-bottom:.4rem;color:var(--muted);font-weight:500;padding-left:.5rem">Date</th>'
    +'<th style="text-align:left;padding-bottom:.4rem;color:var(--muted);font-weight:500">Source</th>'
    +'</tr></thead><tbody>'
    +missingExp.map(function(e){
      var oi=(c.expenses||[]).indexOf(e);
      var src=e.fromBank?'<i class="fas fa-building-columns"></i> bank import':e.checkNum?'check #'+e.checkNum:'manual';
      return '<tr style="border-bottom:1px solid var(--border)">'
        +'<td style="padding:.4rem 0"><input type="checkbox" class="rpm-chk" data-type="expense" data-idx="'+oi+'" style="width:14px;height:14px;cursor:pointer"></td>'
        +'<td style="padding:.4rem .5rem .4rem 0;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+escHtml(e.desc||'')+'">'+escHtml(e.desc||'—')+'</td>'
        +'<td style="padding:.4rem .5rem .4rem 0;color:var(--muted)">'+escHtml(e.cat||'—')+'</td>'
        +'<td style="text-align:right;padding:.4rem .5rem .4rem 0;color:var(--red);font-weight:500">'+fmt(e.amt)+'</td>'
        +'<td style="padding:.4rem .5rem .4rem .5rem;color:var(--muted);white-space:nowrap">'+(e.date||'—')+'</td>'
        +'<td style="padding:.4rem 0;font-size:10px;color:var(--muted)">'+src+'</td>'
        +'</tr>';
    }).join('')
    +'</tbody></table>':'')

    // Income section
    +(missingInc.length?'<div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem">Income / Revenue ('+missingInc.length+')</div>'
    +'<table style="width:100%;font-size:12px;border-collapse:collapse;margin-bottom:1.25rem">'
    +'<thead><tr style="border-bottom:1px solid var(--border)">'
    +'<th style="padding-bottom:.4rem;width:26px"></th>'
    +'<th style="text-align:left;padding-bottom:.4rem;color:var(--muted);font-weight:500">Description</th>'
    +'<th style="text-align:left;padding-bottom:.4rem;color:var(--muted);font-weight:500">Category</th>'
    +'<th style="text-align:right;padding-bottom:.4rem;color:var(--muted);font-weight:500">Amount</th>'
    +'<th style="text-align:left;padding-bottom:.4rem;color:var(--muted);font-weight:500;padding-left:.5rem">Date</th>'
    +'<th style="text-align:left;padding-bottom:.4rem;color:var(--muted);font-weight:500">Source</th>'
    +'</tr></thead><tbody>'
    +missingInc.map(function(r){
      var src=c.type==='sb'?c.revenue||[]:c.income||[];
      var oi=src.indexOf(r);
      var amt=Number(r.act||r.amt||r.recv||0);
      var srcLabel=r.fromBank?'<i class="fas fa-building-columns"></i> bank import':'manual';
      return '<tr style="border-bottom:1px solid var(--border)">'
        +'<td style="padding:.4rem 0"><input type="checkbox" class="rpm-chk" data-type="income" data-idx="'+oi+'" style="width:14px;height:14px;cursor:pointer"></td>'
        +'<td style="padding:.4rem .5rem .4rem 0;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+escHtml(r.name||r.desc||'')+'">'+escHtml(r.name||r.desc||'—')+'</td>'
        +'<td style="padding:.4rem .5rem .4rem 0;color:var(--muted)">'+escHtml(r.cat||'—')+'</td>'
        +'<td style="text-align:right;padding:.4rem .5rem .4rem 0;color:var(--green);font-weight:500">'+fmt(amt)+'</td>'
        +'<td style="padding:.4rem .5rem .4rem .5rem;color:var(--muted);white-space:nowrap">'+(r.date||'—')+'</td>'
        +'<td style="padding:.4rem 0;font-size:10px;color:var(--muted)">'+srcLabel+'</td>'
        +'</tr>';
    }).join('')
    +'</tbody></table>':'')

    +'</div>'

    // Footer
    +'<div style="padding:.75rem 1.25rem;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;gap:.75rem;flex-wrap:wrap">'
    +'<label style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:5px;cursor:pointer">'
    +'<input type="checkbox" id="rpm-select-all" onchange="document.querySelectorAll(\'.rpm-chk\').forEach(function(cb){cb.checked=document.getElementById(\'rpm-select-all\').checked;})" style="width:14px;height:14px"> Select all'
    +'</label>'
    +'<div style="display:flex;gap:.5rem">'
    +'<button onclick="document.getElementById(\'recon-pull-modal\').classList.remove(\'open\');setTimeout(function(){var m=document.getElementById(\'recon-pull-modal\');if(m)m.parentNode.removeChild(m);},300)" style="padding:7px 16px;border:1px solid var(--border);border-radius:7px;background:none;cursor:pointer;font-size:13px;font-family:\'DM Sans\',sans-serif;color:var(--text)">Cancel</button>'
    +'<button onclick="reconPullConfirm()" style="padding:7px 18px;border:none;border-radius:7px;background:var(--np);color:#fff;cursor:pointer;font-size:13px;font-weight:500;font-family:\'DM Sans\',sans-serif">Add to reconciliation</button>'
    +'</div>'
    +'</div>'

    +'</div></div>';
  document.body.appendChild(div.firstChild);
}

function reconPullConfirm(){
  var c=gc();if(!c)return;
  var isCCRecon=RECON_ACCT.indexOf('cc:')===0;
  var ccId=isCCRecon?RECON_ACCT.slice(3):null;
  var bankId=!isCCRecon?RECON_ACCT.slice(5):null;
  var isDefault=bankId==='default';

  var checked=document.querySelectorAll('.rpm-chk:checked');
  if(!checked.length){alert('Select at least one transaction to add.');return;}

  var count=0;
  checked.forEach(function(cb){
    var type=cb.getAttribute('data-type');
    var idx=parseInt(cb.getAttribute('data-idx'),10);
    if(type==='expense'){
      var e=(c.expenses||[])[idx];
      if(!e)return;
      if(isCCRecon){e.ccId=ccId;}
      else if(!isDefault){e.bankId=bankId;}
      else{delete e.bankId;}
      count++;
    } else {
      var src=c.type==='sb'?c.revenue:c.income;
      var r=src&&src[idx];
      if(!r)return;
      if(!isDefault){r.bankId=bankId;}
      else{delete r.bankId;}
      count++;
    }
  });

  sv();
  var modal=document.getElementById('recon-pull-modal');
  if(modal)modal.parentNode.removeChild(modal);
  renderReconciliation(c);

  // Brief toast
  var t=document.createElement('div');
  t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--text);color:var(--surface);padding:10px 18px;border-radius:8px;font-size:13px;z-index:99999;font-family:\'DM Sans\',sans-serif;box-shadow:0 2px 12px rgba(0,0,0,.2)';
  t.textContent=count+' transaction'+(count!==1?'s':'')+' added to reconciliation.';
  document.body.appendChild(t);
  setTimeout(function(){t.style.transition='opacity .4s';t.style.opacity='0';},2500);
  setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},3000);
}
function postReconToBS(){
  var c=gc();if(!c)return;
  var stateKey2='reconState_'+RECON_ACCT;
  var rs2=c[stateKey2];
  if(!rs2||!Number(rs2.closeBal||0)){alert('No closing balance found. Enter and save a closing balance in Reconciliation first.');return;}
  var cashAcct=c.accounts.find(function(a){return a.code==='1010';})||c.accounts.find(function(a){return a.type==='Asset';});
  if(!cashAcct){alert('No cash account found in your Chart of Accounts.');return;}
  if(!c.balanceSheet)c.balanceSheet={assets:[],liabilities:[],equity:[]};
  var name=cashAcct.code+' '+cashAcct.name;
  var existing=c.balanceSheet.assets.findIndex(function(x){return x.name===name;});
  var item={id:existing>=0&&c.balanceSheet.assets[existing].id?c.balanceSheet.assets[existing].id:uid(),name:name,amt:Number(rs2.closeBal||0)};
  if(existing>=0)c.balanceSheet.assets[existing]=item;else c.balanceSheet.assets.push(item);
  sv();alert('Closing balance of '+fmt(Number(rs2.closeBal||0))+' posted to balance sheet as "'+name+'".');renderBalanceSheet(c);
}
function setBankBal(v){var c=gc();if(!c)return;c.bankBalance=Number(v||0);sv();}
function sbRevRC(i){var c=gc();if(!c||!c.revenue[i])return;c.revenue[i].reconciled=!c.revenue[i].reconciled;sv();renderReconciliation(c);}
function markSelectedRecon(){
  var c=gc();if(!c)return;
  var checked=[];
  document.querySelectorAll('.rcb:checked').forEach(function(cb){
    // rcb onchange calls sbRC(oi) — data index is in the onchange attr
    var match=cb.getAttribute('onchange');
    var m=match&&match.match(/sbRC\((\d+)\)/);
    if(m)checked.push(Number(m[1]));
  });
  if(!checked.length){alert('Check at least one transaction to mark reconciled.');return;}
  var exp=c.expenses||[];
  checked.forEach(function(oi){if(exp[oi])exp[oi].reconciled=true;});
  sv();renderReconciliation(c);
  _bankToast(checked.length+' transaction'+(checked.length!==1?'s':'')+' marked reconciled.');
}
function markAllRecon(){var c=gc();if(!c)return;(c.expenses||[]).forEach(function(e){e.reconciled=true;});(c.revenue||[]).forEach(function(r){r.reconciled=true;});(c.income||[]).forEach(function(r){r.reconciled=true;});sv();renderReconciliation(c);}

// ── BANK ACCOUNTS ────────────────────────
var BANK_ACCT_EI=-1;
function saveBankAcct(){
  var c=gc();if(!c.bankAccounts)c.bankAccounts=[];
  var name=g('ba-name').value.trim();if(!name){alert('Please enter an account name.');return;}
  var old=BANK_ACCT_EI>=0?c.bankAccounts[BANK_ACCT_EI]:null;
  var nextCheckVal=g('ba-next-check')&&g('ba-next-check').value.trim();
  var item={id:old?(old.id||uid()):uid(),name:name,type:g('ba-type').value,last4:g('ba-last4').value.trim(),nextCheckNum:nextCheckVal?Number(nextCheckVal):(old&&old.nextCheckNum||''),checkFormat:g('ba-check-format')&&g('ba-check-format').value||'voucher2',checkOffsetX:Number(g('ba-check-offx')&&g('ba-check-offx').value||0),checkOffsetY:Number(g('ba-check-offy')&&g('ba-check-offy').value||0)};
  if(BANK_ACCT_EI>=0)c.bankAccounts[BANK_ACCT_EI]=item;else c.bankAccounts.push(item);
  if(typeof dwUpsertBankAcct==='function')dwUpsertBankAcct(c,item);
  // Auto-create COA account for this bank
  if(!c.accounts)c.accounts=[];
  var coaExists=c.accounts.find(function(a){return a.name===name&&a.type==='Asset';});
  if(!coaExists){var nextCode=_nextAcctCode(c,'Asset');c.accounts.push({id:uid(),code:nextCode,name:name,type:'Asset',cat:name});c.accounts.sort(function(a,b){return a.code.localeCompare(b.code);});}
  BANK_ACCT_EI=-1;sv();renderReconciliation(c);closeM('m-bank-acct');['ba-name','ba-last4','ba-next-check'].forEach(function(id){var el=g(id);if(el)el.value='';});
  if(g('ba-check-offx'))g('ba-check-offx').value=0;
  if(g('ba-check-offy'))g('ba-check-offy').value=0;
  _checkOffsetReadout();
}
// _nudgeCheckOffset(axis, delta): the calibration arrow buttons in the bank-account modal.
// Adjusts the hidden ba-check-offx/y input by a fixed step (inches) instead of making the
// bookkeeper type decimals, then updates the visible readout.
function _nudgeCheckOffset(axis,delta){
  var input=g('ba-check-off'+axis);if(!input)return;
  input.value=Math.round((Number(input.value||0)+delta)*100)/100;
  _checkOffsetReadout();
}
function _checkOffsetReadout(){
  var x=g('ba-check-offx'),y=g('ba-check-offy'),readout=g('ba-check-offset-readout');
  if(!readout)return;
  readout.textContent=Number((x&&x.value)||0).toFixed(2)+'", '+Number((y&&y.value)||0).toFixed(2)+'"';
}
// _markCheckCalibrated(): flips bankAcct.checkCalibrated once a test alignment page has been
// printed for this account, so confirmPayBill() (features.js) only offers the "print a test
// page first" checkpoint before someone's very first real check from that account.
function _markCheckCalibrated(){
  var c=gc();if(!c||BANK_ACCT_EI<0||!c.bankAccounts||!c.bankAccounts[BANK_ACCT_EI])return;
  c.bankAccounts[BANK_ACCT_EI].checkCalibrated=true;
  sv();
}
function editBankAcct(i){
  var c=gc();if(!c||!c.bankAccounts||!c.bankAccounts[i])return;
  BANK_ACCT_EI=i;
  var b=c.bankAccounts[i];
  g('ba-name').value=b.name||'';
  g('ba-type').value=b.type||'checking';
  g('ba-last4').value=b.last4||'';
  if(g('ba-next-check'))g('ba-next-check').value=b.nextCheckNum||'';
  if(g('ba-check-format'))g('ba-check-format').value=b.checkFormat||'voucher2';
  if(g('ba-check-offx'))g('ba-check-offx').value=b.checkOffsetX||0;
  if(g('ba-check-offy'))g('ba-check-offy').value=b.checkOffsetY||0;
  _checkOffsetReadout();
  var t=g('m-bank-acct-title');if(t)t.textContent='Edit bank account';
  openM('m-bank-acct');
}
function deleteBankAcct(id){
  var c=gc();if(!confirm('Remove this bank account?'))return;
  var acct=(c.bankAccounts||[]).find(function(b){return b.id===id;});
  c.bankAccounts=(c.bankAccounts||[]).filter(function(b){return b.id!==id;});
  if(acct&&typeof dwDeleteBankAcct==='function')dwDeleteBankAcct(c,acct);
  RECON_ACCT='bank:default';sv();renderReconciliation(c);
}


// ══════════════════════════════════════════
// PROJECT BUDGETS
// ══════════════════════════════════════════
var PROJ_EI=-1,PROJ_VIEW='summary',PROJ_SEL=null,PROJ_BUDGET_VIEW='current',PROJ_PERIOD_SEL=null;

// ══════════════════════════════════════════
// RESTRICTION RELEASES (Item 2)
// ══════════════════════════════════════════

function openReleaseModal(){
  var c=gc();if(!c)return;
  var sel=g('rel-fund');if(!sel)return;
  var RELEASE_TYPES=['Restricted','Permanently Restricted','Endowment'];
  var relFunds=(c.funds||[]).filter(function(f){return RELEASE_TYPES.indexOf(f.type)>=0;});
  sel.innerHTML=relFunds.map(function(f){return'<option value="'+escHtml(f.name)+'">'+escHtml(f.name)+' ('+escHtml(f.type)+')</option>';}).join('')
    ||'<option value="">— No restricted/endowment funds defined —</option>';
  ['rel-amt','rel-date','rel-note'].forEach(function(id){var el=g(id);if(el)el.value='';});
  openM('m-release');
}

function saveRelease(){
  var c=gc();if(!c)return;
  var fundName=g('rel-fund').value;
  var amt=Number(g('rel-amt').value||0);
  var date=g('rel-date').value.trim();
  var note=g('rel-note').value.trim();
  if(!fundName){alert('Please select a fund.');return;}
  if(!amt||amt<=0){alert('Please enter a release amount greater than zero.');return;}
  if(!date){alert('Please enter a date.');return;}
  // PERIOD LOCK GUARD
  if(isDateLocked(c,date)){periodLockAlert(c.closedThrough);return;}
  // BALANCE GUARD: can't release more than what's actually sitting in "Net assets with
  // donor restrictions" (3020) — otherwise this manual entry could push it negative,
  // which isn't a real accounting position (you can't release money that was never received).
  var _naWithBal=(getTrialBalance(c).find(function(r){return r.code==='3020';})||{balance:0}).balance;
  if(amt>_naWithBal+0.01){alert('This release ($'+amt.toFixed(2)+') is more than the current balance of Net assets with donor restrictions ($'+_naWithBal.toFixed(2)+'). You can\'t release more than what\'s actually restricted.');return;}
  if(!c.restrictionReleases)c.restrictionReleases=[];
  var relId=uid();
  var relItem={id:relId,fundName:fundName,amount:amt,date:date,note:note,created:new Date().toISOString()};
  c.restrictionReleases.push(relItem);
  if(typeof dwUpsertRelease==='function')dwUpsertRelease(c,relItem);
  // Double-entry: Dr Temp Restricted Net Assets (3020) / Cr Unrestricted Net Assets (3010)
  var memo='Restriction release — '+fundName+(note?' — '+note:'');
  postToLedger(c,'3020','3010',amt,memo,'release',relId);
  sv();
  closeM('m-release');
  if(typeof renderFundPLRpt==='function')renderFundPLRpt();
}

function deleteRelease(i){
  var c=gc();if(!c)return;
  if(!confirm('Remove this restriction release entry?'))return;
  var rel=(c.restrictionReleases||[])[i];
  if(rel&&rel.id)voidLedgerEntry(c,rel.id);
  (c.restrictionReleases||[]).splice(i,1);
  sv();
  if(typeof renderFundPLRpt==='function')renderFundPLRpt();
}
