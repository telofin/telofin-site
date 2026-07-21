// ── BANK DEPOSITS (Undeposited Funds) ───────────────────────────────────────
// A batched payout (Zeffy, a cash/merch table) lands in the bank as ONE lump sum
// that is really several gifts + maybe merch. This module lets the user itemize
// that deposit: each component posts to Undeposited Funds (1050) and flows to its
// own tab (Donors / Income / Revenue / TB / GL / 990), then the deposit moves the
// TOTAL to the bank — which is the single line that matches/reconciles the bank.
// See the plan and [[project_batch_deposit_feature]].

// Working state for the builder modal
var _dep = null;         // { date, bankCode, memo, lines:[], bankTxnId }
// line shapes:
//   existing: {mode:'existing', kind:'income'|'revenue', refId, name, amt}
//   new donation: {mode:'new', kind:'donation', donorId, newDonor, name, amt, fund, rst}
//   new income/revenue: {mode:'new', kind:'income'|'revenue', acctCode, name, amt}

function _depUndepositedCode(c){
  // The holding account. Created on first use; never forced on existing clients.
  return _ensureDedicatedCOA(c, 'Undeposited Funds', 'Asset', 'Undeposited Funds');
}
function _depCashOpts(c, sel){
  return (c.accounts||[]).filter(function(a){
    return a.type==='Asset' && a.active!==false && (a.cat==='Cash' || /^10\d\d$/.test(a.code) || /^15\d\d$/.test(a.code));
  }).map(function(a){
    return '<option value="'+escHtml(a.code)+'"'+(a.code===sel?' selected':'')+'>'+escHtml(a.name)+' ('+escHtml(a.code)+')</option>';
  }).join('');
}
// Full Chart-of-Accounts options for a new deposit line, plus an inline
// "add a new one" choice. Lists ALL active accounts (any type) so a deposit
// line can post to whatever the user needs, not just the default income codes.
function _depAcctOptsInner(c, sel){
  var opts=(c.accounts||[]).filter(function(a){return a.active!==false;})
    .slice().sort(function(a,b){return String(a.code).localeCompare(String(b.code));})
    .map(function(a){return '<option value="'+escHtml(a.code)+'"'+(a.code===sel?' selected':'')+'>'+escHtml(a.code)+' — '+escHtml(a.name)+' ('+escHtml(a.type)+')</option>';}).join('');
  return opts+'<option value="__new__">+ New account…</option>';
}
// Inline create-a-new-account from the deposit builder's account picker.
function depNewAcct(sel){
  if(!sel||sel.value!=='__new__')return;
  var c=gc(); if(!c)return;
  var name=(window.prompt('New account name (e.g. "Membership dues")')||'').trim();
  if(!name){sel.value='';return;}
  var t=(window.prompt('Account type — Income, Asset, Liability, Expense, or Equity:','Income')||'Income').trim().toLowerCase();
  var type=({income:'Income',asset:'Asset',liability:'Liability',expense:'Expense',equity:'Equity'})[t]||'Income';
  var code=_ensureDedicatedCOA(c,name,type,name);
  sel.innerHTML=_depAcctOptsInner(c,code); // reselect the just-created account, keep the rest of the form intact
}

// Money-in rows eligible to be pulled into a deposit: not deleted/voided, not
// reconciled, not already in a deposit. Donations show up here because they
// create an income row — so a gift entered on the Donors tab appears automatically.
function _depEligible(c){
  if(c.type==='sb'){
    return (c.revenue||[]).map(function(r,i){return{row:r,i:i};}).filter(function(x){var r=x.row;
      return !r.deleted&&!r.voided&&!r.isReversal&&!r.reconciled&&!r.depositId&&Number(r.act||0)>0;});
  }
  return (c.income||[]).map(function(r,i){return{row:r,i:i};}).filter(function(x){var r=x.row;
    return !r.deleted&&!r.voided&&!r.isReversal&&!r.reconciled&&!r.depositId&&Number(r.recv||r.amt||0)>0;});
}
function _depRowAmt(c,r){return c.type==='sb'?Number(r.act||0):Number(r.recv||r.amt||0);}
// Badge shown on a Donors/Income/Revenue row that's bundled into a deposit, so
// it's obvious it's already grouped (and matched) rather than floating loose.
function _depBadgeHtml(c,depositId){
  if(!depositId)return '';
  var d=(c&&c.deposits||[]).find(function(x){return x.id===depositId;});
  var lbl=d?('In deposit · '+fmtDate(d.date)):'In deposit';
  return ' <span class="badge b-blue" style="cursor:pointer" title="Part of a bank deposit — click to view" onclick="var t=document.querySelector(\'[data-panel=deposits]\');if(t)switchTab({target:t},\'deposits\')">'+escHtml(lbl)+'</span>';
}
// For a donation record: is its linked income row in a deposit?
function _depDonationBadge(c,record){
  if(!record||!record.incomeRef)return '';
  var inc=(c.income||[]).find(function(r){return r.id===record.incomeRef;});
  return inc&&inc.depositId?_depBadgeHtml(c,inc.depositId):'';
}
function _depTotal(){return (_dep&&_dep.lines||[]).reduce(function(s,l){return s+Number(l.amt||0);},0);}

// ── TAB LIST ────────────────────────────────────────────────────────────────
function renderDeposits(cc){
  var c=cc||gc(); var p=g('p-deposits'); if(!p||!c)return;
  if(!c.deposits)c.deposits=[];
  var deps=c.deposits.slice().reverse();
  var rows=deps.map(function(d){
    var bankName=((c.accounts||[]).find(function(a){return a.code===d.bankId;})||{}).name||d.bankId||'Bank';
    var badge=d.reconciled?'<span class="badge b-green">Matched</span>':'<span class="badge b-amber">Unmatched</span>';
    var lineList=(d.lines||[]).map(function(l){return escHtml(l.label||l.kind)+' — '+fmt(l.amt);}).join('<br>');
    return '<tr>'
      +'<td style="color:var(--muted)">'+fmtDate(d.date)+'</td>'
      +'<td>'+escHtml(bankName)+(d.memo?' <span style="color:var(--muted);font-size:11px">'+escHtml(d.memo)+'</span>':'')+'</td>'
      +'<td style="font-size:11px;color:var(--muted)">'+(lineList||'—')+'</td>'
      +'<td style="font-weight:600">'+fmt(d.total)+'</td>'
      +'<td>'+badge+'</td>'
      +'<td style="white-space:nowrap"><button class="e-btn" title="Edit deposit" onclick="depEdit(\''+d.id+'\')">&#9998;</button> <button class="d-btn" title="Delete deposit" onclick="depDelete(\''+d.id+'\')">&#215;</button></td>'
      +'</tr>';
  }).join('');
  p.innerHTML=(typeof FB==='function'?FB():'')
    +'<div class="xbar" style="margin-bottom:.75rem"><button class="xbtn p" onclick="depOpen()">+ New deposit</button></div>'
    +'<div class="card"><div class="c-head"><span class="c-title">Bank Deposits</span>'
    +'<span style="font-size:11px;color:var(--muted)">Bundle several gifts / sales into one deposit that matches your bank</span></div>'
    +(deps.length
      ? '<table><thead><tr><th style="width:12%">Date</th><th style="width:22%">Bank / memo</th><th>Items</th><th style="width:12%">Total</th><th style="width:12%">Status</th><th style="width:6%"></th></tr></thead><tbody>'+rows+'</tbody></table>'
      : (typeof ES==='function'?ES('No deposits yet','Group donations, income, or merch sales into a single bank deposit.','depOpen()')
         :'<div style="padding:1.25rem;color:var(--muted);font-size:13px">No deposits yet.</div>'))
    +'</div>';
}

// ── BUILDER ─────────────────────────────────────────────────────────────────
function depOpen(prefill){
  var c=gc(); if(!c)return;
  _dep={ date: (prefill&&prefill.date)||todayNum(), bankCode:_defaultCashCode(c), memo:'', lines:[], bankTxnId:(prefill&&prefill.bankTxnId)||'', target:(prefill&&Number(prefill.amount))||0 };
  if(typeof openM==='function')openM('m-deposit');
  depRender();
}
function depSyncHeader(){
  if(!_dep)return;
  var d=g('dep-date'), b=g('dep-bank'), m=g('dep-memo');
  if(d)_dep.date=d.value; if(b)_dep.bankCode=b.value; if(m)_dep.memo=m.value;
}
function depRender(){
  var c=gc(); var host=g('dep-builder'); if(!host||!c||!_dep)return;
  var elig=_depEligible(c);
  var pickedIds={}; _dep.lines.forEach(function(l){if(l.mode==='existing')pickedIds[l.refId]=true;});
  var eligHtml=elig.length? elig.map(function(x){var r=x.row;var amt=_depRowAmt(c,r);
      return '<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;cursor:pointer">'
        +'<input type="checkbox" '+(pickedIds[r.id]?'checked':'')+' onchange="depToggleExisting(\''+r.id+'\')" style="width:14px;height:14px">'
        +'<span style="flex:1">'+escHtml(r.name||'(no name)')+'</span>'
        +'<span style="color:var(--muted)">'+fmtDate(r.date)+'</span>'
        +'<span style="font-weight:600;min-width:70px;text-align:right">'+fmt(amt)+'</span></label>';
    }).join('') : '<div style="font-size:12px;color:var(--muted);padding:4px 0">No undeposited '+(c.type==='sb'?'revenue':'income')+' entries to pull in.</div>';

  var donorOpts='<option value="">— pick a donor —</option>'+(c.donors||[]).map(function(d){return '<option value="'+escHtml(d.id)+'">'+escHtml(d.name)+'</option>';}).join('');
  var incAcctOpts=_depAcctOptsInner(c,'');
  var kindOpts = c.type==='sb'
    ? '<option value="revenue">Revenue / merch</option>'
    : '<option value="donation">Donation (from a donor)</option><option value="income">Other income / merch</option>';

  var linesHtml=_dep.lines.map(function(l,i){
    return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:12px">'
      +'<span style="flex:1">'+escHtml(l.label||l.name||l.kind)+' <span style="color:var(--muted);font-size:10px">('+l.kind+(l.mode==='existing'?', existing':'')+')</span></span>'
      +'<span style="font-weight:600;min-width:70px;text-align:right">'+fmt(l.amt)+'</span>'
      +'<button class="d-btn" onclick="depRemoveLine('+i+')" title="Remove">&#215;</button></div>';
  }).join('');

  host.innerHTML=''
    +'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">'
      +'<div class="fl" style="flex:1;min-width:120px"><label>Date</label><input type="text" id="dep-date" value="'+escHtml(_dep.date)+'" onchange="depSyncHeader()" placeholder="MM/DD/YYYY"></div>'
      +'<div class="fl" style="flex:1;min-width:160px"><label>Deposit to</label><select id="dep-bank" onchange="depSyncHeader()">'+_depCashOpts(c,_dep.bankCode)+'</select></div>'
      +'<div class="fl" style="flex:2;min-width:160px"><label>Memo (optional)</label><input type="text" id="dep-memo" value="'+escHtml(_dep.memo||'')+'" onchange="depSyncHeader()" placeholder="e.g. Zeffy payout 6/22"></div>'
    +'</div>'
    +'<div class="card" style="padding:10px 12px;margin-bottom:10px"><div class="c-title" style="font-size:12px;margin-bottom:4px">Pull in undeposited entries</div>'+eligHtml+'</div>'
    +'<div class="card" style="padding:10px 12px;margin-bottom:10px"><div class="c-title" style="font-size:12px;margin-bottom:6px">Add a new item</div>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">'
        +'<div class="fl" style="margin:0;flex:1;min-width:140px"><label>Type</label><select id="dep-new-kind" onchange="depNewKindChange()">'+kindOpts+'</select></div>'
        +'<div class="fl" id="dep-donor-wrap" style="margin:0;flex:1;min-width:140px;'+(c.type==='sb'?'display:none':'')+'"><label>Donor</label><select id="dep-new-donor">'+donorOpts+'</select></div>'
        +'<div class="fl" id="dep-newdonor-wrap" style="margin:0;flex:1;min-width:140px;'+(c.type==='sb'?'display:none':'')+'"><label>or new donor</label><input type="text" id="dep-new-newdonor" placeholder="New donor name"></div>'
        +'<div class="fl" id="dep-acct-wrap" style="margin:0;flex:1;min-width:140px;display:none"><label>Account</label><select id="dep-new-acct" onchange="depNewAcct(this)">'+incAcctOpts+'</select></div>'
        +'<div class="fl" id="dep-label-wrap" style="margin:0;flex:1;min-width:120px;display:none"><label>Label</label><input type="text" id="dep-new-label" placeholder="e.g. T-shirt sales"></div>'
        +'<div class="fl" style="margin:0;width:100px"><label>Amount</label><input type="number" id="dep-new-amt" step="0.01" placeholder="0.00"></div>'
        +'<button class="add-btn" onclick="depAddNewLine()" style="height:34px">+ Add</button>'
      +'</div></div>'
    +'<div class="card" style="padding:10px 12px;margin-bottom:10px"><div class="c-title" style="font-size:12px;margin-bottom:4px">In this deposit</div>'
      +(linesHtml||'<div style="font-size:12px;color:var(--muted);padding:4px 0">Nothing added yet.</div>')
      +(_dep.target>0?'<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;color:'+(Math.abs(_depTotal()-_dep.target)<0.01?'var(--green)':'var(--muted)')+'"><span>Bank line to match</span><span>'+fmt(_dep.target)+' · remaining '+fmt(Math.max(0,_dep.target-_depTotal()))+'</span></div>':'')
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:8px;border-top:2px solid var(--text)"><span style="font-weight:600">Deposit total</span><span style="font-weight:700;font-size:15px">'+fmt(_depTotal())+'</span></div></div>'
    +'<button class="sv-btn" onclick="depSave()"'+(_depTotal()>0?'':' disabled style="opacity:.5;cursor:not-allowed"')+'>Record deposit</button>';
  depNewKindChange();
}
function depNewKindChange(){
  var k=g('dep-new-kind'); if(!k)return; var v=k.value;
  var show=function(id,on){var e=g(id);if(e)e.style.display=on?'':'none';};
  show('dep-donor-wrap', v==='donation');
  show('dep-newdonor-wrap', v==='donation');
  show('dep-acct-wrap', v==='income'||v==='revenue');
  show('dep-label-wrap', v==='income'||v==='revenue');
}
function depToggleExisting(refId){
  var c=gc(); if(!c||!_dep)return; depSyncHeader();
  var idx=_dep.lines.findIndex(function(l){return l.mode==='existing'&&l.refId===refId;});
  if(idx>=0){ _dep.lines.splice(idx,1); depRender(); return; }
  var list=c.type==='sb'?(c.revenue||[]):(c.income||[]);
  var r=list.find(function(x){return x.id===refId;}); if(!r)return;
  _dep.lines.push({mode:'existing', kind:c.type==='sb'?'revenue':'income', refId:refId, name:r.name||'', amt:_depRowAmt(c,r)});
  depRender();
}
function depAddNewLine(){
  var c=gc(); if(!c||!_dep)return; depSyncHeader();
  var kind=(g('dep-new-kind')||{}).value||'donation';
  var amt=Number((g('dep-new-amt')||{}).value||0);
  if(!(amt>0)){alert('Enter an amount for the new item.');return;}
  if(kind==='donation'){
    var donorId=(g('dep-new-donor')||{}).value||'';
    var newDonor=((g('dep-new-newdonor')||{}).value||'').trim();
    if(!donorId&&!newDonor){alert('Pick a donor or type a new donor name.');return;}
    var name=newDonor|| (((c.donors||[]).find(function(d){return d.id===donorId;})||{}).name)||'Donation';
    _dep.lines.push({mode:'new', kind:'donation', donorId:donorId, newDonor:newDonor, name:name, label:name, amt:amt, rst:'unrestricted'});
  } else {
    var acctCode=(g('dep-new-acct')||{}).value||'4010';
    if(acctCode==='__new__'||!acctCode){alert('Pick an account (or add a new one) for this line.');return;}
    var label=((g('dep-new-label')||{}).value||'').trim()||'Other income';
    _dep.lines.push({mode:'new', kind:(c.type==='sb'?'revenue':'income'), acctCode:acctCode, name:label, label:label, amt:amt});
  }
  depRender();
}
function depRemoveLine(i){ if(!_dep)return; depSyncHeader(); _dep.lines.splice(i,1); depRender(); }

// ── SAVE / POST ─────────────────────────────────────────────────────────────
function depSave(){
  var c=gc(); if(!c||!_dep)return; depSyncHeader();
  var total=_depTotal(); if(!(total>0)){alert('Add at least one item.');return;}
  if(_dep.bankTxnId&&_dep.target>0&&Math.abs(total-_dep.target)>0.01){
    if(!confirm('The items add up to '+fmt(total)+', but the bank line is '+fmt(_dep.target)+'. They should match for the deposit to reconcile. Record anyway?'))return;
  }
  var undep=_depUndepositedCode(c);
  var bankCode=_dep.bankCode||_defaultCashCode(c);
  var date=_dep.date||todayNum();
  var depId=uid();
  var linesMeta=[];
  if(!c.income)c.income=[]; if(!c.revenue)c.revenue=[]; if(!c.donors)c.donors=[];

  _dep.lines.forEach(function(l){
    if(l.mode==='existing'){
      var list=c.type==='sb'?c.revenue:c.income;
      var r=list.find(function(x){return x.id===l.refId;}); if(!r)return;
      // Re-route its cash side from the bank to Undeposited Funds, in place.
      updateLedgerEntry(c, r.id, undep, r.acctCode||(c.type==='sb'?'4010':'4010'), Number(l.amt||0), r.name||'Deposit item', c.type==='sb'?'revenue':'income');
      r.depositId=depId;
      if(c.type==='sb'&&typeof dwUpsertRevenue==='function')dwUpsertRevenue(c,r); else if(typeof dwUpsertIncome==='function')dwUpsertIncome(c,r);
      linesMeta.push({kind:l.kind, refId:r.id, amt:Number(l.amt||0), label:r.name||l.name});
    } else if(l.kind==='donation'){
      var di;
      if(l.donorId){ di=c.donors.findIndex(function(d){return d.id===l.donorId;}); }
      if(di===undefined||di<0){ var nd={id:uid(),name:l.newDonor||l.name||'Donor',email:'',phone:'',address:'',notes:'',donations:[],audit:[]}; c.donors.push(nd); di=c.donors.length-1; if(typeof dwUpsertDonor==='function')dwUpsertDonor(c,nd); }
      var rec={id:uid(),amt:Number(l.amt||0),date:date,fund:l.fund||'',proj:'',rec:'No',ty:'No',rst:l.rst||'unrestricted',inkind:'No',fmv:0,itemDescription:'',qpq:0,auctioned:false,audit:[]};
      c.donors[di].donations.push(rec);
      if(typeof dwUpsertDonation==='function')dwUpsertDonation(c,c.donors[di],rec);
      _postDonationLedger(c,di,rec,undep); // posts Dr undep / Cr 4010, sets rec.incomeRef
      var incRow=c.income.find(function(x){return x.id===rec.incomeRef;}); if(incRow)incRow.depositId=depId;
      linesMeta.push({kind:'donation', refId:rec.incomeRef, amt:Number(l.amt||0), label:l.name});
    } else {
      // brand-new other income / revenue
      var row;
      if(c.type==='sb'){
        row={id:uid(),name:l.label,cat:l.label,proj:Number(l.amt||0),act:Number(l.amt||0),conf:'Confirmed',acctCode:l.acctCode||'4010',date:date,recurring:'None',depositId:depId};
        c.revenue.push(row); if(typeof dwUpsertRevenue==='function')dwUpsertRevenue(c,row);
        postToLedger(c,undep,l.acctCode||'4010',Number(l.amt||0),l.label,'revenue',row.id);
      } else {
        row={id:uid(),name:l.label,cat:'Other Income',proj:Number(l.amt||0),recv:Number(l.amt||0),status:'Received',acctCode:l.acctCode||'4010',date:date,recurring:'None',depositId:depId,audit:[]};
        c.income.push(row); if(typeof dwUpsertIncome==='function')dwUpsertIncome(c,row);
        postToLedger(c,undep,l.acctCode||'4010',Number(l.amt||0),l.label,'income',row.id);
      }
      linesMeta.push({kind:l.kind, refId:row.id, amt:Number(l.amt||0), label:l.label});
    }
  });

  var dep={id:depId, date:date, bankId:bankCode, memo:_dep.memo||'', total:total, lines:linesMeta, bankTxnId:_dep.bankTxnId||'', reconciled:false, createdAt:new Date().toISOString()};
  c.deposits.push(dep);
  // Move the total from Undeposited Funds into the bank — this is the matchable line.
  postToLedger(c, bankCode, undep, total, 'Bank deposit'+(dep.memo?': '+dep.memo:''), 'deposit', dep.id);

  // If itemizing an imported bank line, mark it matched to this deposit.
  if(_dep.bankTxnId){
    var t=(c.bankTransactions||[]).find(function(x){return x.id===_dep.bankTxnId;});
    if(t){ t.approved=true; t.matched=true; t.matchedListKey='deposits'; t.matchedIndex=c.deposits.indexOf(dep); t.postedAt=new Date().toISOString(); dep.reconciled=true; }
  }

  _dep=null;
  if(typeof closeM==='function')closeM('m-deposit');
  if(typeof sv==='function')sv();
  if(typeof renderAll==='function')renderAll();
  renderDeposits(c);
  if(typeof _bankToast==='function')_bankToast('Deposit recorded: '+fmt(total));
}

// ── DELETE ──────────────────────────────────────────────────────────────────
// Voids the deposit's bank posting and returns each component to direct-to-bank
// (clears depositId, re-routes its cash side back to the bank). The underlying
// gifts/income are kept — only the grouping is undone.
function depDelete(id){
  var c=gc(); if(!c||!c.deposits)return;
  var dep=c.deposits.find(function(d){return d.id===id;}); if(!dep)return;
  if(!confirm('Delete this deposit? The gifts inside it stay on your books; they just go back to being individual bank entries.'))return;
  var cashCode=dep.bankId||_defaultCashCode(c);
  (dep.lines||[]).forEach(function(l){
    var list=l.kind==='revenue'?(c.revenue||[]):(c.income||[]);
    var r=list.find(function(x){return x.id===l.refId;}); if(!r)return;
    updateLedgerEntry(c, r.id, cashCode, r.acctCode||'4010', Number(l.amt||0), r.name||'Deposit item', l.kind==='revenue'?'revenue':'income');
    delete r.depositId;
  });
  if(typeof voidLedgerEntry==='function')voidLedgerEntry(c, dep.id);
  if(dep.bankTxnId){ var t=(c.bankTransactions||[]).find(function(x){return x.id===dep.bankTxnId;}); if(t){t.matched=false;delete t.matchedListKey;delete t.matchedIndex;} }
  c.deposits=c.deposits.filter(function(d){return d.id!==id;});
  if(typeof sv==='function')sv();
  if(typeof renderAll==='function')renderAll();
  renderDeposits(c);
}

// Edit a deposit by undoing it in place (returns each component to direct-to-bank,
// voids the total, unmatches the bank line, removes the deposit) and reopening the
// builder prefilled with those same items — so the user can add/remove lines or
// change the date/bank/memo and re-record. Reuses depSave's proven posting paths.
function depEdit(id){
  var c=gc(); if(!c||!c.deposits)return;
  var dep=c.deposits.find(function(d){return d.id===id;}); if(!dep)return;
  var cashCode=dep.bankId||_defaultCashCode(c);
  // Snapshot the components as builder lines BEFORE undoing.
  var lines=(dep.lines||[]).map(function(l){
    var list=l.kind==='revenue'?(c.revenue||[]):(c.income||[]);
    var r=list.find(function(x){return x.id===l.refId;});
    return {mode:'existing', kind:(l.kind==='revenue'?'revenue':'income'), refId:l.refId, name:(r&&r.name)||l.label, amt:Number(l.amt||0)};
  }).filter(function(l){return !!l.refId;});
  // Capture the matched bank line's amount as the new target, if any.
  var bankTxnId=dep.bankTxnId||'', target=0;
  if(bankTxnId){var bt=(c.bankTransactions||[]).find(function(x){return x.id===bankTxnId;}); if(bt)target=Number(bt.amount||0);}
  // Undo: re-route each component back to the bank and clear its depositId.
  (dep.lines||[]).forEach(function(l){
    var list=l.kind==='revenue'?(c.revenue||[]):(c.income||[]);
    var r=list.find(function(x){return x.id===l.refId;}); if(!r)return;
    updateLedgerEntry(c, r.id, cashCode, r.acctCode||'4010', Number(l.amt||0), r.name||'Deposit item', l.kind==='revenue'?'revenue':'income');
    delete r.depositId;
  });
  if(typeof voidLedgerEntry==='function')voidLedgerEntry(c, dep.id);
  if(bankTxnId){var bt2=(c.bankTransactions||[]).find(function(x){return x.id===bankTxnId;}); if(bt2){bt2.matched=false;delete bt2.matchedListKey;delete bt2.matchedIndex;}}
  c.deposits=c.deposits.filter(function(d){return d.id!==id;});
  if(typeof sv==='function')sv();
  // Reopen the builder prefilled with the freed components.
  if(typeof openM==='function')openM('m-deposit');
  _dep={ date:dep.date||todayNum(), bankCode:cashCode, memo:dep.memo||'', lines:lines, bankTxnId:bankTxnId, target:target };
  depRender();
}
