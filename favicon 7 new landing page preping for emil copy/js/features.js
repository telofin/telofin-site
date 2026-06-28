
var ACCT_EI = -1;

function renderProjectsHTML(c){
  if(!c.projects)c.projects=[];
  var projects=c.projects;

  function projTotals(proj){
    var exp=(c.expenses||[]).filter(function(e){return e.projectId===proj.id;});
    var inc=c.type==='sb'?(c.revenue||[]).filter(function(r){return r.projectId===proj.id;}):(c.income||[]).filter(function(r){return r.projectId===proj.id;});
    var spent=exp.reduce(function(s,e){return s+Number(e.amt||0);},0);
    var received=inc.reduce(function(s,r){return s+Number(c.type==='sb'?(r.act||0):(r.recv||r.amt||0));},0);
    var budget=Number(proj.budget||0);
    return{spent:spent,received:received,budget:budget,net:received-spent,remaining:budget-spent};
  }

  var views=[['summary','Summary'],['detail','Detail'],['budget','Budget'],['transactions','Transactions'],['rollup','Main rollup']];
  var viewBar='<div style="display:flex;gap:6px;margin-bottom:1rem;flex-wrap:wrap">'+views.map(function(v){return'<button class="'+(PROJ_VIEW===v[0]?'sv-btn':'add-btn')+'" style="font-size:11px;padding:4px 12px" onclick="PROJ_VIEW=\''+v[0]+'\';renderBudgetMultiYear()">'+v[1]+'</button>';}).join('')+'</div>';
  var addBar='<div class="xbar" style="margin-bottom:1rem"><button class="xbtn p" onclick="PROJ_EI=-1;openProjModal()">+ New project</button></div>';

  if(!projects.length){
    return addBar+'<div class="insight" style="border-left-color:var(--amber)"><div class="ins-lbl">Project budgets</div>Create projects to track income and expenses separately from your main budget. Tag transactions to a project when adding them.</div>';
  }

  if(!PROJ_SEL||!projects.find(function(pr){return pr.id===PROJ_SEL;}))PROJ_SEL=projects[0].id;
  var selProj=projects.find(function(pr){return pr.id===PROJ_SEL;})||projects[0];
  var st=projTotals(selProj);

  var projSel='<div style="display:flex;align-items:center;gap:10px;margin-bottom:1rem;flex-wrap:wrap"><span style="font-size:12px;color:var(--muted)">Project:</span><div class="sw"><select onchange="PROJ_SEL=this.value;renderBudgetMultiYear()">'+projects.map(function(pr){return'<option value="'+pr.id+'"'+(PROJ_SEL===pr.id?' selected':'')+'>'+escHtml(pr.name)+'</option>';}).join('')+'</select></div>'
  +'<button class="e-btn" style="border:1px solid var(--border);border-radius:7px;padding:5px 10px;font-size:12px" onclick="PROJ_EI='+projects.indexOf(selProj)+';openProjModal()">&#9998; Edit</button>'
  +'<button class="d-btn" style="border:1px solid var(--red-bg);border-radius:7px;padding:5px 10px;font-size:12px" onclick="delProject(\''+selProj.id+'\')">&#215; Delete</button></div>';

  var metrics='<div class="metrics"><div class="metric"><div class="m-lbl">Budget</div><div class="m-val vb">'+fmt(st.budget)+'</div></div><div class="metric"><div class="m-lbl">Spent</div><div class="m-val vr">'+fmt(st.spent)+'</div></div><div class="metric"><div class="m-lbl">Received</div><div class="m-val vg">'+fmt(st.received)+'</div></div><div class="metric"><div class="m-lbl">Remaining</div><div class="m-val '+(st.remaining>=0?'vb':'vr')+'">'+fmt(st.remaining)+'</div></div></div>';

  var html='';
  if(PROJ_VIEW==='summary'){
    var rows=projects.map(function(pr){
      var t=projTotals(pr);var pct=t.budget>0?Math.min(100,Math.round((t.spent/t.budget)*100)):0;
      return'<tr><td style="font-weight:500">'+escHtml(pr.name)+'</td><td style="color:var(--muted);font-size:11px">'+(pr.desc||'—')+'</td><td>'+fmt(t.budget)+'</td><td class="vr">'+fmt(t.spent)+'</td><td class="vg">'+fmt(t.received)+'</td><td class="'+(t.remaining>=0?'vb':'vr')+'">'+fmt(t.remaining)+'</td>'
      +'<td><div class="pbar" style="min-width:60px"><div class="pfill" style="width:'+pct+'%;background:'+(pct>90?'var(--red)':pct>70?'var(--amber)':'var(--green)')+'"></div></div><div style="font-size:10px;color:var(--muted);text-align:right">'+pct+'%</div></td>'
      +'<td><button class="add-btn" style="font-size:10px;padding:3px 8px" onclick="PROJ_SEL=\''+pr.id+'\';PROJ_VIEW=\'detail\';renderBudgetMultiYear()">View →</button></td></tr>';
    }).join('');
    html='<div class="card"><div class="c-head"><span class="c-title">All projects</span></div><div style="overflow-x:auto"><table><thead><tr><th style="width:18%">Project</th><th style="width:16%">Description</th><th style="width:10%">Budget</th><th style="width:9%">Spent</th><th style="width:9%">Received</th><th style="width:9%">Remaining</th><th style="width:14%">Burn</th><th style="width:15%"></th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
  }else if(PROJ_VIEW==='detail'){
    html=projSel+metrics;
    if(selProj.desc)html+='<div style="font-size:12px;color:var(--muted);margin-bottom:1rem;padding:.75rem;background:var(--bg);border-radius:8px">'+selProj.desc+'</div>';
    var pct2=st.budget>0?Math.min(100,Math.round((st.spent/st.budget)*100)):0;
    html+='<div class="card"><div class="c-title" style="margin-bottom:.5rem">Budget burn rate</div><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px"><span>Spent</span><span>'+pct2+'%</span></div><div class="pbar" style="height:10px;margin-bottom:.75rem"><div class="pfill" style="width:'+pct2+'%;background:'+(pct2>90?'var(--red)':pct2>70?'var(--amber)':'var(--green)')+'"></div></div>'+(selProj.notes?'<div style="font-size:12px;color:var(--muted)">'+selProj.notes+'</div>':'')+'</div>';
  }else if(PROJ_VIEW==='budget'){
    html=projSel;
    var fy=getFiscalYear(c.fiscalYearEnd);
    var bvLabels=selProj.isMultiYear?[['proposed','Proposed'],['current','Current period'],['past','Past periods']]:[['proposed','Proposed'],['current','Current ('+fy.label+')'],['past','Past adopted']];
    var bvBar='<div style="display:flex;gap:6px;margin-bottom:1rem;flex-wrap:wrap">'+bvLabels.map(function(v){return'<button class="'+(PROJ_BUDGET_VIEW===v[0]?'sv-btn':'add-btn')+'" style="font-size:11px;padding:4px 12px" onclick="PROJ_BUDGET_VIEW=\''+v[0]+'\';renderBudgetMultiYear()">'+v[1]+'</button>';}).join('')+'</div>';
    html+=bvBar;
    if(c.type==='np'){var grants=c.grants||[];var linkedGrant=selProj.grantId?grants.find(function(gr){return gr.id===selProj.grantId;}):null;if(linkedGrant)html+='<div style="font-size:11px;color:var(--np);margin-bottom:.75rem;padding:.5rem .75rem;background:var(--bg);border-radius:8px;display:inline-block">&#128196; Linked grant: <strong>'+linkedGrant.name+'</strong></div>';}
    if(PROJ_BUDGET_VIEW==='current'){
      var curLines=[],periodLabel='',pExp2=(c.expenses||[]).filter(function(e){return e.projectId===selProj.id;}),pInc2=c.type==='sb'?(c.revenue||[]).filter(function(r){return r.projectId===selProj.id;}):(c.income||[]).filter(function(r){return r.projectId===selProj.id;});
      if(selProj.isMultiYear){
        var periods=selProj.periods||[],today2=new Date();
        var curPeriod=PROJ_PERIOD_SEL?periods.find(function(p){return p.id===PROJ_PERIOD_SEL;}):periods.find(function(p){var s=p.start?new Date(p.start):null,e=p.end?new Date(p.end):null;return s&&e&&today2>=s&&today2<=e;})||periods[periods.length-1];
        if(!curPeriod&&periods.length)curPeriod=periods[periods.length-1];
        if(curPeriod){
          curLines=curPeriod.budgetLines||[];periodLabel=curPeriod.label||'';
          var fyS=getFiscalYear(c.fiscalYearEnd,new Date(curPeriod.start||Date.now())).label,fyE=getFiscalYear(c.fiscalYearEnd,new Date(curPeriod.end||Date.now())).label;
          var fyRef=fyS===fyE?'('+fyS+')':'(spans '+fyS+'–'+fyE+')';
          html+='<div style="display:flex;gap:8px;align-items:center;margin-bottom:.75rem;flex-wrap:wrap"><span style="font-size:12px;color:var(--muted)">Period:</span><div class="sw"><select onchange="PROJ_PERIOD_SEL=this.value;renderBudgetMultiYear()">'+periods.map(function(p){return'<option value="'+p.id+'"'+(curPeriod&&p.id===curPeriod.id?' selected':'')+'>'+p.label+(p.start&&p.end?' ('+p.start+' – '+p.end+')':'')+'</option>';}).join('')+'</select></div><span style="font-size:11px;color:var(--muted)">'+fyRef+'</span><button class="add-btn" style="font-size:10px;padding:3px 10px" onclick="openProjPeriodModal(\''+selProj.id+'\',null)">+ Add period</button></div>';
          if(curPeriod.start&&curPeriod.end){var ps=new Date(curPeriod.start),pe=new Date(curPeriod.end);pExp2=pExp2.filter(function(e){var d=parseDate(e.date);return d&&d>=ps&&d<=pe;});pInc2=pInc2.filter(function(r){var d=parseDate(r.date||'');return d&&d>=ps&&d<=pe;});}
        }else{html+='<div style="font-size:12px;color:var(--muted);margin-bottom:.75rem">No periods defined yet. <button class="add-btn" style="font-size:11px;padding:3px 10px" onclick="openProjPeriodModal(\''+selProj.id+'\',null)">+ Add period</button></div>';}
      }else{curLines=selProj.budgetLines||[];periodLabel=fy.label;}
      var totalBudgetI=curLines.filter(function(l){return l.type==='Income';}).reduce(function(s,l){return s+Number(l.amt||0);},0);
      var totalBudgetE=curLines.filter(function(l){return l.type==='Expense';}).reduce(function(s,l){return s+Number(l.amt||0);},0);
      var totalActI=pInc2.reduce(function(s,r){return s+Number(c.type==='sb'?(r.act||0):(r.recv||r.amt||0));},0);
      var totalActE=pExp2.reduce(function(s,e){return s+Number(e.amt||0);},0);
      var curRows=curLines.map(function(bl,i){var act=bl.type==='Income'?pInc2.filter(function(r){return(r.cat||'')===(bl.cat||'');}).reduce(function(s,r){return s+Number(c.type==='sb'?(r.act||0):(r.recv||r.amt||0));},0):pExp2.filter(function(e){return(e.cat||'')===(bl.cat||'');}).reduce(function(s,e){return s+Number(e.amt||0);},0);var rem=bl.type==='Income'?act-bl.amt:bl.amt-act;var delFn=selProj.isMultiYear&&PROJ_PERIOD_SEL?'delProjPeriodLine(\''+selProj.id+'\',\''+PROJ_PERIOD_SEL+'\','+i+')':'delProjBudgetLine(\''+selProj.id+'\','+i+')';return'<tr><td style="font-weight:500">'+bl.cat+'</td><td style="color:var(--muted);font-size:11px">'+bl.type+'</td><td>'+fmt(bl.amt)+'</td><td class="'+(bl.type==='Income'?'vg':'vr')+'">'+fmt(act)+'</td><td class="'+(rem>=0?'vg':'vr')+'">'+fmt(rem)+'</td><td><button class="d-btn" onclick="'+delFn+'">&#215;</button></td></tr>';}).join('');
      var addFn=selProj.isMultiYear&&PROJ_PERIOD_SEL?'openProjBudgetLine(\''+selProj.id+'\',\''+PROJ_PERIOD_SEL+'\')':'openProjBudgetLine(\''+selProj.id+'\')';
      html+=metrics+'<div class="card"><div class="c-head"><span class="c-title">Budget vs Actual'+(periodLabel?' — '+periodLabel:'')+'</span><button class="add-btn" onclick="'+addFn+'">+ Add line</button></div>'+(curLines.length?'<div style="overflow-x:auto"><table><thead><tr><th>Category</th><th>Type</th><th>Budgeted</th><th>Actual</th><th>Remaining</th><th></th></tr></thead><tbody>'+curRows+'</tbody></table><div class="rpt-total" style="margin-top:.5rem"><span>Totals</span><span style="display:flex;gap:24px"><span>Income: '+fmt(totalBudgetI)+' / Actual: <span class="vg">'+fmt(totalActI)+'</span></span><span>Expenses: '+fmt(totalBudgetE)+' / Actual: <span class="vr">'+fmt(totalActE)+'</span></span></span></div></div>':'<div style="font-size:12px;color:var(--muted);padding:.75rem">No budget lines yet. Add lines to track budget vs actual.</div>')+'</div>';
    }else if(PROJ_BUDGET_VIEW==='proposed'){
      var propLines=selProj.proposedBudget||[];
      var propRows=propLines.map(function(bl,i){return'<tr><td style="font-weight:500">'+bl.cat+'</td><td style="color:var(--muted);font-size:11px">'+bl.type+'</td><td>'+fmt(bl.amt)+'</td><td><button class="d-btn" onclick="delProjProposedLine(\''+selProj.id+'\','+i+')">&#215;</button></td></tr>';}).join('');
      var propI=propLines.filter(function(l){return l.type==='Income';}).reduce(function(s,l){return s+Number(l.amt||0);},0);
      var propE=propLines.filter(function(l){return l.type==='Expense';}).reduce(function(s,l){return s+Number(l.amt||0);},0);
      html+='<div class="card"><div class="c-head"><span class="c-title">Proposed budget — next year</span><button class="add-btn" onclick="openProjBudgetLine(\''+selProj.id+'\',\'proposed\')">+ Add line</button></div>'+(propLines.length?'<div style="overflow-x:auto"><table><thead><tr><th>Category</th><th>Type</th><th>Amount</th><th></th></tr></thead><tbody>'+propRows+'</tbody></table><div class="rpt-total" style="margin-top:.5rem"><span>Total proposed</span><span>Income: '+fmt(propI)+' &nbsp; Expenses: '+fmt(propE)+'</span></div></div>':'<div style="font-size:12px;color:var(--muted);padding:.75rem">No proposed lines yet.</div>')+'</div>';
      if(propLines.length)html+='<div style="margin-top:.75rem"><button class="sv-btn" style="font-size:12px" onclick="adoptProjProposed(\''+selProj.id+'\')">&#10003; Adopt as current budget</button></div>';
    }else if(PROJ_BUDGET_VIEW==='past'){
      if(selProj.isMultiYear){
        var allPeriods=selProj.periods||[],today3=new Date(),pastPeriods=allPeriods.filter(function(p){return p.end&&new Date(p.end)<today3;});
        if(!pastPeriods.length)html+='<div style="font-size:12px;color:var(--muted)">No completed periods yet.</div>';
        else html+=pastPeriods.map(function(p){var pLines=p.budgetLines||[];var pActE=(c.expenses||[]).filter(function(e){var d=parseDate(e.date);var ps=new Date(p.start),pe=new Date(p.end);return e.projectId===selProj.id&&d&&d>=ps&&d<=pe;}).reduce(function(s,e){return s+Number(e.amt||0);},0);var pActI=(c.type==='sb'?(c.revenue||[]):(c.income||[])).filter(function(r){var d=parseDate(r.date||'');var ps=new Date(p.start),pe=new Date(p.end);return r.projectId===selProj.id&&d&&d>=ps&&d<=pe;}).reduce(function(s,r){return s+Number(c.type==='sb'?(r.act||0):(r.recv||r.amt||0));},0);var fyS2=getFiscalYear(c.fiscalYearEnd,new Date(p.start)).label,fyE2=getFiscalYear(c.fiscalYearEnd,new Date(p.end)).label;var fyRef=fyS2===fyE2?' ('+fyS2+')':' (spans '+fyS2+'–'+fyE2+')';var pRows=pLines.map(function(bl){return'<tr><td>'+bl.cat+'</td><td style="color:var(--muted);font-size:11px">'+bl.type+'</td><td>'+fmt(bl.amt)+'</td></tr>';}).join('');return'<div class="card"><div class="c-title" style="margin-bottom:.5rem">'+p.label+fyRef+'<span style="font-size:11px;color:var(--muted);margin-left:.5rem">'+p.start+' – '+p.end+'</span></div>'+(pLines.length?'<table><thead><tr><th>Category</th><th>Type</th><th>Budgeted</th></tr></thead><tbody>'+pRows+'</tbody></table>':'<div style="font-size:12px;color:var(--muted)">No budget lines.</div>')+'<div class="rpt-row" style="margin-top:.5rem"><span style="font-size:11px;color:var(--muted)">Actuals</span><span style="font-size:11px"><span class="vg">Income: '+fmt(pActI)+'</span> &nbsp; <span class="vr">Expenses: '+fmt(pActE)+'</span></span></div></div>';}).join('');
      }else{
        var past=selProj.adoptedBudgets||[];
        if(!past.length)html+='<div style="font-size:12px;color:var(--muted)">No past adopted budgets yet.</div>';
        else html+=past.slice().reverse().map(function(ab){var abRows=(ab.items||[]).map(function(bl){return'<tr><td>'+bl.cat+'</td><td style="color:var(--muted);font-size:11px">'+bl.type+'</td><td>'+fmt(bl.amt)+'</td></tr>';}).join('');var abI=(ab.items||[]).filter(function(l){return l.type==='Income';}).reduce(function(s,l){return s+Number(l.amt||0);},0);var abE=(ab.items||[]).filter(function(l){return l.type==='Expense';}).reduce(function(s,l){return s+Number(l.amt||0);},0);return'<div class="card"><div class="c-title" style="margin-bottom:.5rem">'+ab.fy+(ab.adoptedOn?' <span style="font-size:11px;color:var(--muted)">adopted '+ab.adoptedOn+'</span>':'')+'</div>'+(ab.items&&ab.items.length?'<table><thead><tr><th>Category</th><th>Type</th><th>Amount</th></tr></thead><tbody>'+abRows+'</tbody></table><div style="font-size:11px;color:var(--muted);margin-top:.5rem">Income: '+fmt(abI)+' &nbsp; Expenses: '+fmt(abE)+'</div>':'<div style="font-size:12px;color:var(--muted)">No lines.</div>')+'</div>';}).join('');
      }
    }
  }else if(PROJ_VIEW==='transactions'){
    html=projSel+metrics;
    var pExp=(c.expenses||[]).filter(function(e){return e.projectId===selProj.id;});
    var pInc=c.type==='sb'?(c.revenue||[]).filter(function(r){return r.projectId===selProj.id;}):(c.income||[]).filter(function(r){return r.projectId===selProj.id;});
    var expRows=pExp.map(function(e){var oi=(c.expenses||[]).indexOf(e);return'<tr><td style="color:var(--muted);font-size:11px">'+(e.date||'—')+'</td><td>'+escHtml(e.desc)+'</td><td style="color:var(--muted);font-size:11px">'+escHtml(e.cat||'—')+'</td><td class="vr">'+fmt(e.amt)+'</td><td>'+rb('expenses',oi)+'</td></tr>';}).join('');
    var incRows=pInc.map(function(r){var src=c.type==='sb'?(c.revenue||[]):(c.income||[]);var oi=src.indexOf(r);var amt=c.type==='sb'?r.act:(r.recv||r.amt||0);return'<tr><td style="color:var(--muted);font-size:11px">'+(r.date||'—')+'</td><td>'+escHtml(r.name||r.desc||'—')+'</td><td style="color:var(--muted);font-size:11px">'+escHtml(r.cat||'—')+'</td><td class="vg">'+fmt(amt)+'</td><td></td></tr>';}).join('');
    html+='<div class="card"><div class="c-title" style="margin-bottom:.75rem">Expenses ('+pExp.length+')</div>'+(pExp.length?'<table><thead><tr><th style="width:12%">Date</th><th style="width:36%">Description</th><th style="width:16%">Category</th><th style="width:12%">Amount</th><th style="width:24%"></th></tr></thead><tbody>'+expRows+'</tbody></table>':'<div style="font-size:12px;color:var(--muted)">No expenses tagged to this project yet.</div>')+'</div>';
    html+='<div class="card"><div class="c-title" style="margin-bottom:.75rem">Income ('+pInc.length+')</div>'+(pInc.length?'<table><thead><tr><th style="width:12%">Date</th><th style="width:36%">Name</th><th style="width:16%">Category</th><th style="width:12%">Amount</th><th style="width:24%"></th></tr></thead><tbody>'+incRows+'</tbody></table>':'<div style="font-size:12px;color:var(--muted)">No income tagged to this project.</div>')+'</div>';
  }else if(PROJ_VIEW==='rollup'){
    var mainInc=c.type==='sb'?(c.revenue||[]).filter(function(r){return!r.projectId;}):(c.income||[]).filter(function(r){return!r.projectId;});
    var mainExp=(c.expenses||[]).filter(function(e){return!e.projectId;});
    var mainI=mainInc.reduce(function(s,r){return s+Number(c.type==='sb'?(r.act||0):(r.recv||r.amt||0));},0);
    var mainE=mainExp.reduce(function(s,e){return s+Number(e.amt||0);},0);
    var projRows=projects.map(function(pr){var t=projTotals(pr);return'<tr><td style="font-weight:500">'+escHtml(pr.name)+'</td><td class="vg">'+fmt(t.received)+'</td><td class="vr">'+fmt(t.spent)+'</td><td class="'+(t.net>=0?'vg':'vr')+'">'+fmt(t.net)+'</td></tr>';}).join('');
    var totalProjI=projects.reduce(function(s,pr){return s+projTotals(pr).received;},0);
    var totalProjE=projects.reduce(function(s,pr){return s+projTotals(pr).spent;},0);
    var grandI=mainI+totalProjI,grandE=mainE+totalProjE;
    html='<div class="card"><div class="c-title" style="margin-bottom:.75rem">Net rollup — main budget + all projects</div>'
    +'<div class="rpt-row"><span style="font-weight:500">Main budget (untagged)</span><span style="display:flex;gap:16px"><span class="vg">+'+fmt(mainI)+'</span><span class="vr">−'+fmt(mainE)+'</span><span class="'+(mainI-mainE>=0?'vg':'vr')+'">'+fmt(mainI-mainE)+'</span></span></div>'
    +(projects.length?'<div style="font-size:11px;color:var(--muted);margin:.5rem 0">Projects/Events</div><table><thead><tr><th>Project</th><th>Income</th><th>Expenses</th><th>Net</th></tr></thead><tbody>'+projRows+'</tbody></table>':'')
    +'<div class="rpt-total" style="margin-top:.75rem"><span>Grand total</span><span style="display:flex;gap:16px"><span class="vg">'+fmt(grandI)+'</span><span class="vr">'+fmt(grandE)+'</span><span class="'+(grandI-grandE>=0?'vg':'vr')+'">'+fmt(grandI-grandE)+'</span></span></div></div>';
  }
  return addBar+viewBar+html;
}

// renderProjects removed — projects now live in Budget tab via renderProjectsHTML()

function openProjModal(){
  var c=gc();if(!c.projects)c.projects=[];
  var proj=PROJ_EI>=0?c.projects[PROJ_EI]:null;
  g('proj-name').value=proj?proj.name:'';
  g('proj-desc').value=proj?(proj.desc||''):'';
  g('proj-budget').value=proj?(proj.budget||''):'';
  g('proj-notes').value=proj?(proj.notes||''):'';
  // Multi-year toggle
  var myCk=g('proj-multiyear');if(myCk)myCk.checked=proj?!!proj.isMultiYear:false;
  // Grant link (NP only)
  var gl=g('proj-grant-row');if(gl){gl.style.display=(c.type==='np')?'block':'none';}
  var gsel=g('proj-grant');if(gsel&&c.type==='np'){var grants=c.grants||[];gsel.innerHTML='<option value="">— None —</option>'+grants.map(function(gr){return'<option value="'+gr.id+'"'+(proj&&proj.grantId===gr.id?' selected':'')+'>'+escHtml(gr.name)+'</option>';}).join('');}
  openM('m-project');
}
function saveProject(){
  var c=gc();if(!c.projects)c.projects=[];
  var name=g('proj-name').value.trim();if(!name){alert('Please enter a project name.');return;}
  var isMultiYear=g('proj-multiyear')?g('proj-multiyear').checked:false;
  var grantId=g('proj-grant')&&c.type==='np'?g('proj-grant').value:'';
  var existing=PROJ_EI>=0?c.projects[PROJ_EI]:{};
  var item={id:PROJ_EI>=0?(existing.id||uid()):uid(),name:name,desc:g('proj-desc').value,budget:Number(g('proj-budget').value||0),notes:g('proj-notes').value,isMultiYear:isMultiYear,grantId:grantId,budgetLines:existing.budgetLines||[],proposedBudget:existing.proposedBudget||[],adoptedBudgets:existing.adoptedBudgets||[],periods:existing.periods||[]};
  if(PROJ_EI>=0)c.projects[PROJ_EI]=item;else{c.projects.push(item);PROJ_SEL=item.id;}
  PROJ_EI=-1;sv();renderBudgetMultiYear();closeM('m-project');
}
function delProject(id){
  var c=gc();if(!confirm('Delete this project? Transactions tagged to it will remain but lose the project tag.'))return;
  (c.expenses||[]).forEach(function(e){if(e.projectId===id)delete e.projectId;});
  (c.income||[]).concat(c.revenue||[]).forEach(function(r){if(r.projectId===id)delete r.projectId;});
  c.projects=c.projects.filter(function(pr){return pr.id!==id;});
  PROJ_SEL=c.projects.length?c.projects[0].id:null;
  sv();renderBudgetMultiYear();
}
function openProjBudgetLine(projId,periodId){
  var cat=prompt('Category name:');if(!cat)return;
  var type=prompt('Type (Income or Expense):','Expense');if(!type)return;
  type=type.charAt(0).toUpperCase()+type.slice(1).toLowerCase();
  if(type!=='Income')type='Expense';
  var amt=Number(prompt('Amount ($):','0')||0);
  var c=gc();var proj=c.projects.find(function(p){return p.id===projId;});if(!proj)return;
  if(periodId==='proposed'){
    if(!proj.proposedBudget)proj.proposedBudget=[];
    proj.proposedBudget.push({cat:cat,type:type,amt:amt});
  }else if(periodId){
    var period=(proj.periods||[]).find(function(p){return p.id===periodId;});
    if(!period)return;
    if(!period.budgetLines)period.budgetLines=[];
    period.budgetLines.push({cat:cat,type:type,amt:amt});
  }else{
    if(!proj.budgetLines)proj.budgetLines=[];
    proj.budgetLines.push({cat:cat,type:type,amt:amt});
  }
  sv();renderBudgetMultiYear();
}
function delProjBudgetLine(projId,i){
  var c=gc();var proj=c.projects.find(function(p){return p.id===projId;});
  if(!proj||!proj.budgetLines)return;
  proj.budgetLines.splice(i,1);sv();renderBudgetMultiYear();
}
function delProjPeriodLine(projId,periodId,i){
  var c=gc();var proj=c.projects.find(function(p){return p.id===projId;});if(!proj)return;
  var period=(proj.periods||[]).find(function(p){return p.id===periodId;});if(!period||!period.budgetLines)return;
  period.budgetLines.splice(i,1);sv();renderBudgetMultiYear();
}
function delProjProposedLine(projId,i){
  var c=gc();var proj=c.projects.find(function(p){return p.id===projId;});if(!proj||!proj.proposedBudget)return;
  proj.proposedBudget.splice(i,1);sv();renderBudgetMultiYear();
}
function adoptProjProposed(projId){
  var c=gc();var proj=c.projects.find(function(p){return p.id===projId;});if(!proj)return;
  if(!proj.proposedBudget||!proj.proposedBudget.length){alert('No proposed lines to adopt.');return;}
  if(!confirm('Adopt proposed budget as current? Current budget lines will move to history.'))return;
  var fy=getFiscalYear(c.fiscalYearEnd);
  if(!proj.adoptedBudgets)proj.adoptedBudgets=[];
  if(proj.budgetLines&&proj.budgetLines.length)proj.adoptedBudgets.push({fy:fy.label,items:proj.budgetLines.slice(),adoptedOn:today()});
  proj.budgetLines=proj.proposedBudget.slice();
  proj.proposedBudget=[];
  sv();renderBudgetMultiYear();
}
function openProjPeriodModal(projId,periodId){
  var c=gc();var proj=c.projects.find(function(p){return p.id===projId;});if(!proj)return;
  var period=periodId?(proj.periods||[]).find(function(p){return p.id===periodId;}):null;
  var label=prompt('Period label (e.g. "Grant Year 1"):',period?period.label:'');if(!label)return;
  var start=prompt('Start date (MM/DD/YYYY):',period?period.start:'');if(!start)return;
  var end=prompt('End date (MM/DD/YYYY):',period?period.end:'');if(!end)return;
  if(!proj.periods)proj.periods=[];
  if(period){period.label=label;period.start=start;period.end=end;}
  else{proj.periods.push({id:uid(),label:label,start:start,end:end,budgetLines:[]});}
  sv();renderBudgetMultiYear();
}
function projOpts(c){
  if(!c||!(c.projects||[]).length)return'';
  return'<option value="">— None —</option>'+(c.projects||[]).map(function(pr){return'<option value="'+pr.id+'">'+escHtml(pr.name)+'</option>';}).join('');
}
function renderCOA(c){
  var p=g('p-coa');if(!p||!c)return;
  var accts=c.accounts||[];

  // Build a usage map — how many transactions reference each account code or category
  var usageMap={};
  function countUsage(items,catKey,codeKey){
    (items||[]).forEach(function(r){
      var code=r[codeKey]||'';
      var cat=r[catKey]||'';
      if(code){usageMap[code]=(usageMap[code]||0)+1;}
      if(cat&&!code){
        var match=(c.accounts||[]).find(function(a){return a.cat===cat||a.name===cat;});
        if(match)usageMap[match.code]=(usageMap[match.code]||0)+1;
      }
    });
  }
  countUsage(c.expenses||[],'cat','acctCode');
  countUsage(c.income||[],'cat','acctCode');
  countUsage(c.revenue||[],'cat','acctCode');
  countUsage(c.budgetItems||[],'cat','');

  var types=['Asset','Liability','Equity','Income','Expense'];
  var typeColors={Asset:'b-blue',Liability:'b-red',Equity:'b-teal',Income:'b-green',Expense:'b-amber'};
  var _showInactive=window._coaShowInactive===true;
  var inactiveCount=(c.accounts||[]).filter(function(a){return a.active===false;}).length;

  var html=types.map(function(t){
    var group=accts.filter(function(a){return a.type===t&&(_showInactive||a.active!==false);});
    if(!group.length)return'';
    var rows=group.map(function(a){
      var oi=accts.indexOf(a);
      var uses=usageMap[a.code]||0;
      var isInactive=a.active===false;
      var unusedBadge=uses===0?'<span class="badge b-red" style="margin-left:6px;font-size:9px">unused</span>':'<span style="font-size:10px;color:var(--muted);margin-left:6px">'+uses+' use'+(uses===1?'':'s')+'</span>';
      var inactiveBadge=isInactive?'<span class="badge b-gray" style="margin-left:6px;font-size:9px">inactive</span>':'';
      return'<tr data-coa-code="'+(a.code||'').toLowerCase()+'" data-coa-name="'+(a.name||'').toLowerCase()+'" style="'+(isInactive?'opacity:0.45':'')+'">'
      +'<td style="font-weight:500;color:var(--muted);font-size:11px;font-family:monospace">'+a.code+'</td>'
      +'<td>'+a.name+(a.f990?'<span class="badge b-gray" style="margin-left:6px;font-size:9px">990: '+a.f990+'</span>':'')+unusedBadge+inactiveBadge+'</td>'
      +'<td><span class="badge '+typeColors[t]+'">'+t+'</span></td>'
      +'<td><button class="e-btn" onclick="openGLAccount(\''+a.code+'\')" title="View ledger">&#128196;</button>'
      +'<button class="e-btn" onclick="toggleAcctActive('+oi+')" title="'+(isInactive?'Mark active':'Mark inactive')+'" style="color:'+(isInactive?'var(--green)':'var(--muted)')+'">&#9679;</button>'
      +'<button class="e-btn" onclick="editAcct('+oi+')" title="Edit">&#9998;</button>'
      +'<button class="d-btn" onclick="delAcct('+oi+')" title="Delete">&#215;</button></td></tr>';
    }).join('');
    return'<div class="coa-group" style="margin-bottom:1.25rem"><div style="font-size:11px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.5rem">'+t+'s</div><table><thead><tr><th style="width:8%">Code</th><th style="width:52%">Account name</th><th style="width:15%">Type</th><th style="width:25%"></th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }).join('');

  var loans=c.loans||[];
  var loanSection=loans.length?'<div id="amort-section" style="margin-top:1.25rem"></div>':'<div style="margin-top:1rem;font-size:12px;color:var(--muted)">Add a Liability account (e.g. 2200 Loans Payable) then add a loan to generate an amortization schedule.</div>';
  p.innerHTML=FB()
  +'<div class="xbar"><button class="xbtn p" onclick="ACCT_EI=-1;resetAcctForm();openM(&apos;m-coa&apos;)">+ Add account</button>'+(c.type==='sb'?'<button class="xbtn" onclick="LOAN_EI=-1;resetLoanForm();openM(&apos;m-loan&apos;)">+ Add loan</button>':'')
  +(inactiveCount>0?'<button class="xbtn" onclick="window._coaShowInactive='+(!_showInactive)+';renderCOA(gc())" style="font-size:11px;color:var(--muted)">'+(_showInactive?'Hide':'Show')+' inactive ('+inactiveCount+')</button>':'')
  +'</div>'
  // Inline search — filters rows without re-rendering the panel
  +'<div style="padding:.25rem 0 .75rem"><div style="position:relative"><input id="coa-search" type="text" placeholder="Search accounts by code or name…" autocomplete="off" style="width:100%;padding:7px 36px 7px 12px;font-size:13px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-family:DM Sans,sans-serif;outline:none;"><span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:14px;pointer-events:none"><i class="fas fa-magnifying-glass"></i></span></div></div>'
  +'<div class="insight"><div class="ins-lbl">Chart of accounts</div>Select an account when entering transactions. <strong style="color:var(--red)">Unused</strong> accounts have no transactions and can be safely deleted.'+(c.type==='np'?' 990 line references shown for IRS Form 990 reporting.':'')+'</div>'
  +'<div class="card" id="coa-table">'+html+'</div>'
  +loanSection;
  if(loans.length)renderAmortization(c);

  // Wire up the live filter — NO re-render, just show/hide rows
  var inp=g('coa-search');
  if(inp){
    inp.addEventListener('input',function(){
      var q=inp.value.toLowerCase().trim();
      var rows=p.querySelectorAll('tr[data-coa-code]');
      rows.forEach(function(row){
        var match=!q||row.getAttribute('data-coa-code').indexOf(q)>=0||row.getAttribute('data-coa-name').indexOf(q)>=0;
        row.style.display=match?'':'none';
      });
      // Hide section headers when all their rows are hidden
      p.querySelectorAll('.coa-group').forEach(function(grp){
        var vis=Array.from(grp.querySelectorAll('tr[data-coa-code]')).some(function(r){return r.style.display!=='none';});
        grp.style.display=vis?'':'none';
      });
    });
    inp.addEventListener('keydown',function(e){
      if(e.key==='Escape'){inp.value='';inp.dispatchEvent(new Event('input'));return;}
      if(e.key==='Enter'){
        // Edit the first visible account
        var first=p.querySelector('tr[data-coa-code]:not([style*="display: none"]):not([style*="display:none"])');
        if(first){
          var editBtn=first.querySelector('.e-btn:nth-child(2)');
          if(editBtn)editBtn.click();
        }
      }
    });
    inp.focus();
  }
}

function renderImportRulesPanel(c){
  var p=g('p-coa');if(!p||!c)return;
  var rules=c.importRules||[];
  var existing=g('import-rules-panel');
  if(existing){existing.remove();return;}// toggle
  var div=document.createElement('div');div.id='import-rules-panel';
  var rows=rules.length?rules.map(function(r,i){return'<tr><td style="font-weight:500">'+escHtml(r.keyword)+'</td><td>'+escHtml(r.cat||'—')+'</td><td style="color:var(--muted)">'+(r.acctCode||'—')+'</td><td><button class="d-btn" onclick="delImportRule('+i+')">&#215;</button></td></tr>';}).join(''):'<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:1rem;font-size:12px">No rules yet. They\'re created automatically when you save a keyword during bank import.</td></tr>';
  div.innerHTML='<div class="card" style="margin-top:1.25rem"><div class="c-head"><span class="c-title">Import rules</span></div><table><thead><tr><th>Keyword</th><th>Category</th><th>Account</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  p.appendChild(div);
}
function delImportRule(i){var c=gc();if(!c.importRules)return;c.importRules.splice(i,1);sv();renderImportRulesPanel(c);renderImportRulesPanel(c);}// double call to re-render
function resetAcctForm(){
  ['acct-code','acct-name'].forEach(function(id){var el=g(id);if(el)el.value='';});
  var t=g('acct-type');if(t)t.value='Expense';
  // Auto-suggest next Expense account code
  var c=gc();if(!c||!c.accounts)return;
  var codeEl=g('acct-code');if(!codeEl)return;
  var used5=c.accounts.filter(function(a){return a.code&&a.code.indexOf('5')===0;}).map(function(a){return parseInt(a.code)||0;});
  var next=used5.length?(Math.max.apply(null,used5)+10):5010;
  codeEl.value=String(next);
  // Re-suggest when type changes
  var typeEl=g('acct-type');
  if(typeEl){typeEl.onchange=function(){
    var prefix={Income:'4',Expense:'5',Asset:'1',Liability:'2',Equity:'3'}[typeEl.value]||'5';
    var used=c.accounts.filter(function(a){return a.code&&a.code.indexOf(prefix)===0;}).map(function(a){return parseInt(a.code)||0;});
    var nextC=used.length?(Math.max.apply(null,used)+10):parseInt(prefix+'010');
    codeEl.value=String(nextC);
  };}
}
function editAcct(i){var c=gc();if(!c.accounts[i])return;ACCT_EI=i;var a=c.accounts[i];g('acct-code').value=a.code||'';g('acct-name').value=a.name||'';g('acct-type').value=a.type||'Expense';if(g('acct-fund'))g('acct-fund').value=a.fund||'';openM('m-coa');}
function delAcct(i){var c=gc();if(!confirm('Delete this account?'))return;c.accounts.splice(i,1);sv();renderCOA(c);}
function saveAcct(){
  var c=gc();if(!c.accounts)c.accounts=[];
  var code=g('acct-code').value.trim();var name=g('acct-name').value.trim();
  if(!code||!name){alert('Code and name are required.');return;}
  var existing=ACCT_EI>=0?c.accounts[ACCT_EI]:null;
  var item={id:ACCT_EI>=0?(c.accounts[ACCT_EI].id||uid()):uid(),code:code,name:name,type:g('acct-type').value,cat:name,fund:g('acct-fund')&&g('acct-fund').value||''};
  // Preserve active flag — never reset it on edit
  if(existing&&existing.active===false)item.active=false;
  if(ACCT_EI>=0)c.accounts[ACCT_EI]=item;else c.accounts.push(item);
  c.accounts.sort(function(a,b){return a.code.localeCompare(b.code);});
  ACCT_EI=-1;sv();renderCOA(c);closeM('m-coa');resetAcctForm();
  // If opened from bank tab — link the new account to the pending transaction
  if(window._bankPendingAcctTxnId){
    var _bt=(c.bankTransactions||[]).find(function(x){return x.id===window._bankPendingAcctTxnId;});
    if(_bt){_bt.acctCode=code;sv();if(typeof renderBank==='function')renderBank(c);}
    window._bankPendingAcctTxnId=null;
    window._bankPendingAcctType=null;
  }
}

function toggleAcctActive(i){
  var c=gc();if(!c.accounts||!c.accounts[i])return;
  var a=c.accounts[i];
  var nowActive=a.active!==false;// currently active (undefined or true = active)
  if(nowActive){
    // Mark inactive
    if(!confirm('Mark "'+a.name+'" ('+a.code+') as inactive?\n\nIt will be hidden from transaction dropdowns but kept in your chart of accounts. You can reactivate it any time.'))return;
    a.active=false;
  }else{
    // Reactivate
    a.active=true;
  }
  sv();renderCOA(c);
}

var GL_ACCT=null;
function openGLAccount(code){GL_ACCT=code;renderGL(gc());var tab=Array.from(document.querySelectorAll('#tabs .tab')).find(function(t){return t.dataset.panel==='gl';});if(tab)switchTab({target:tab},'gl');}
function renderGL(c){
  var p=g('p-gl');if(!p||!c)return;
  var accts=c.accounts||[];
  var txns=[];
  function addTxns(items,amtKey,sign,panel){(items||[]).forEach(function(r){var code=r.acctCode||lookupAcctByCAT(c,r.cat)||('CAT:'+(r.cat||'Uncategorized'));txns.push({code:code,date:fmtDate(r.date||''),desc:r.desc||r.name||'',amt:Number(r[amtKey]||0)*sign,panel:panel});});}
  if(c.type==='np'){addTxns(c.income||[],'recv',1,'Income');addTxns(c.expenses||[],'amt',1,'Expense');}
  else if(c.type==='sb'){addTxns(c.revenue||[],'act',1,'Revenue');addTxns(c.expenses||[],'amt',1,'Expense');}
  else{addTxns(c.income||[],'amt',1,'Income');addTxns(c.expenses||[],'amt',1,'Expense');}
  (c.journalEntries||[]).forEach(function(e){
    if(e.debitCode)txns.push({code:e.debitCode,date:e.date||'',desc:e.memo||'JE',amt:Number(e.amt||0),panel:'Journal entry'});
    if(e.creditCode)txns.push({code:e.creditCode,date:e.date||'',desc:e.memo||'JE',amt:-Number(e.amt||0),panel:'Journal entry'});
  });
  // Interfund transfers — show as paired entries (out of fromFund, in to toFund)
  (c.fundTransfers||[]).forEach(function(t){
    var desc='Transfer: '+t.fromFund+' → '+t.toFund+(t.note?' ('+t.note+')':'');
    txns.push({code:'XFUND:'+t.fromFund,date:t.date||'',desc:desc,amt:-Number(t.amount||0),panel:'Interfund transfer'});
    txns.push({code:'XFUND:'+t.toFund,date:t.date||'',desc:desc,amt:Number(t.amount||0),panel:'Interfund transfer'});
  });

  // Group by account
  var grouped={};
  txns.forEach(function(t){if(!grouped[t.code])grouped[t.code]=[];grouped[t.code].push(t);});

  var acctCodes=GL_ACCT?[GL_ACCT]:Object.keys(grouped).sort();
  if(!acctCodes.length){
    p.innerHTML=FB()+'<div class="insight"><div class="ins-lbl">General ledger</div>No transactions yet. Add expenses or income to see them here.</div>';
    return;
  }

  // Only show COA accounts in the filter dropdown (not virtual CAT: codes)
  var selOpts='<option value="">All accounts</option>'+accts.map(function(a){return'<option value="'+a.code+'"'+(GL_ACCT===a.code?' selected':'')+'>'+a.code+' '+a.name+'</option>';}).join('');
  var totalTxns=0,grandTotal=0,totalDebits=0,totalCredits=0;

  var sections=acctCodes.map(function(code){
    var isCat=code.indexOf('CAT:')=== 0;
    var acct=accts.find(function(a){return a.code===code;})||{code:isCat?'':code,name:isCat?code.slice(4):code,type:''};
    var items=(grouped[code]||[]).slice().sort(function(a,b){return(a.date||'').localeCompare(b.date||'');});
    var running=0;
    var rows=items.map(function(t){
      running+=t.amt;
      return'<tr><td style="color:var(--muted);font-size:11px">'+(t.date||'—')+'</td>'
      +'<td>'+t.desc+'</td>'
      +'<td style="color:var(--muted);font-size:11px">'+t.panel+'</td>'
      +'<td class="'+(t.amt>=0?'vg':'vr')+'">'+fmt(t.amt)+'</td>'
      +'<td style="font-size:11px;color:var(--muted)">'+fmt(running)+'</td></tr>';
    }).join('');
    totalTxns+=items.length;grandTotal+=running;
    items.forEach(function(t){var isInc=t.panel==='Income'||t.panel==='Revenue';if(isInc)totalCredits+=Math.abs(t.amt);else totalDebits+=Math.abs(t.amt);});
    return'<div class="card" style="margin-bottom:1rem">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;flex-wrap:wrap;gap:8px">'
    +'<div>'+(acct.code?'<span style="font-size:12px;font-weight:500;color:var(--muted)">'+acct.code+'</span> ':'')+' <span style="font-size:14px;font-weight:500">'+acct.name+'</span>'+(acct.type?'<span class="badge b-gray" style="margin-left:8px;font-size:9px">'+acct.type+'</span>':'')+(isCat?'<span class="badge b-gray" style="margin-left:8px;font-size:9px">Untagged</span>':'')+'</div>'
    +'<div style="font-size:13px;font-weight:500" class="'+(running>=0?'vg':'vr')+'">Balance: '+fmt(running)+'</div></div>'
    +'<table><thead><tr><th style="width:11%">Date</th><th style="width:40%">Description</th><th style="width:16%">Source</th><th style="width:14%">Amount</th><th style="width:19%">Running balance</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }).join('');

  p.innerHTML=FB()+XB('gl')
  +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:1rem;flex-wrap:wrap">'
  +'<span style="font-size:12px;color:var(--muted)">Account:</span>'
  +'<div class="sw"><select onchange="GL_ACCT=this.value||null;renderGL(gc())">'+selOpts+'</select></div>'
  +(GL_ACCT?'<button class="add-btn" onclick="GL_ACCT=null;renderGL(gc())"><i class="fas fa-xmark"></i> All accounts</button>':'')+'</div>'
  +'<div class="metrics"><div class="metric"><div class="m-lbl">Accounts with activity</div><div class="m-val vb">'+acctCodes.length+'</div></div><div class="metric"><div class="m-lbl">Total transactions</div><div class="m-val">'+totalTxns+'</div></div><div class="metric"><div class="m-lbl">Total debits</div><div class="m-val vg">'+fmt(totalDebits)+'</div></div><div class="metric"><div class="m-lbl">Total credits</div><div class="m-val vr">'+fmt(totalCredits)+'</div></div></div>'
  +sections;
}


// ── END COA + GL ─────────────────────────
// ══════════════════════════════════════════
// ══════════════════════════════════════════
// TRIAL BALANCE  (Phase 1-C)
// ══════════════════════════════════════════
function renderTrialBalance(c,asOfDate){
  var p=document.getElementById('p-trialbal');if(!p)return;
  p.innerHTML=FB()+XB();
  if(!c){p.innerHTML+='<div class="insight">No client selected.</div>';return;}
  if(asOfDate)p.dataset.tbAsOf=asOfDate;
  var _isoToday=(function(){var _d=new Date();return _d.getFullYear()+'-'+String(_d.getMonth()+1).padStart(2,'0')+'-'+String(_d.getDate()).padStart(2,'0');})();
  var _asOf=asOfDate||p.dataset.tbAsOf||_isoToday;
  if(!c.ledgerEntries||!c.ledgerEntries.length){
    p.innerHTML+='<div class="insight" style="border-left-color:var(--amber)">'
      +'<div class="ins-lbl">Trial Balance</div>'
      +'No ledger entries yet. Transactions saved after this update will appear here automatically. '
      +'To populate from existing data, click <strong>Rebuild Ledger</strong> below.</div>'
      +'<div class="xbar"><button class="xbtn p" onclick="migrateToLedger(gc());sv();renderTrialBalance(gc())">Rebuild ledger from existing transactions</button></div>';
    return;
  }
  var rows=getTrialBalance(c,_asOf);
  var totDr=rows.reduce(function(s,r){return s+r.dr;},0);
  var totCr=rows.reduce(function(s,r){return s+r.cr;},0);
  var balanced=Math.abs(totDr-totCr)<0.01;
  var fmt2=function(n){return'$'+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});};
  var typeOrder={Asset:1,Liability:2,Equity:3,Income:4,Revenue:4,Expense:5,Unknown:6};
  rows.sort(function(a,b){return(typeOrder[a.type]||6)-(typeOrder[b.type]||6)||a.code.localeCompare(b.code);});
  var _drTypes={Asset:true,Expense:true};
  var tbody=rows.map(function(r){
    var netBal=Math.abs(r.dr-r.cr);
    var isDebitSide=!!_drTypes[r.type];
    var drAmt=isDebitSide?fmt2(netBal):'';
    var crAmt=isDebitSide?'':fmt2(netBal);
    return'<tr>'
      +'<td style="font-family:monospace;font-size:11px">'+escHtml(r.code)+'</td>'
      +'<td style="font-weight:500">'+escHtml(r.name)+'</td>'
      +'<td style="color:var(--muted);font-size:11px">'+escHtml(r.type)+'</td>'
      +'<td style="text-align:right">'+drAmt+'</td>'
      +'<td style="text-align:right">'+crAmt+'</td>'
      +'</tr>';
  }).join('');
  var statusBadge=balanced
    ?'<span style="color:var(--green);font-weight:600">&#10003; Balanced</span>'
    :'<span style="color:var(--red);font-weight:700">&#9888; Out of balance by '+fmt2(Math.abs(totDr-totCr))+'</span>';
  p.innerHTML+='<div class="card">'
    +'<div class="c-head"><span class="c-title">Trial Balance &mdash; '+escHtml(c.name)+'</span>'
    +statusBadge
    +'<button class="add-btn" style="font-size:11px" onclick="doPDF(\'trialbal\')">&#128438; Export PDF</button></div>'
    +'<div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem">'+'<label style="font-size:11px;color:var(--muted)">As of</label>'+'<input type="date" id="tb-asof-date" value="'+_asOf+'" '+'style="font-size:11px;padding:3px 7px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);cursor:pointer" '+'onchange="renderTrialBalance(gc(),this.value)">'+'<span style="font-size:11px;color:var(--muted)">All non-voided posted entries on or before this date</span>'+'</div>'
    +'<div style="overflow-x:auto"><table>'
    +'<thead><tr>'
    +'<th style="width:8%">Code</th>'
    +'<th style="width:35%">Account</th>'
    +'<th style="width:15%">Type</th>'
    +'<th style="width:21%;text-align:right">Debit</th>'
    +'<th style="width:21%;text-align:right">Credit</th>'
    +'</tr></thead>'
    +'<tbody>'+tbody+'</tbody>'
    +'<tfoot><tr style="font-weight:700;border-top:2px solid var(--border)">'
    +'<td colspan="3">Totals</td>'
    +'<td style="text-align:right">'+fmt2(totDr)+'</td>'
    +'<td style="text-align:right">'+fmt2(totCr)+'</td>'
    +'</tr></tfoot></table></div></div>'
    +'<div class="xbar" style="margin-top:.75rem">'
    +'<button class="add-btn" style="font-size:11px" onclick="migrateToLedger(gc());sv();renderTrialBalance(gc())">&#8635; Rebuild ledger from all transactions</button>'
    +'</div>';
}

// PAYROLL
// ══════════════════════════════════════════
function renderPayroll(c){
  var runs=c.payroll||[];
  var totGross=runs.reduce(function(s,r){return s+Number(r.gross||0);},0);
  var totTax=runs.reduce(function(s,r){return s+Number(r.taxes||0);},0);
  var totNet=runs.reduce(function(s,r){return s+Number(r.net||0);},0);
  var rows=runs.map(function(r,i){
    return'<tr><td style="color:var(--muted)">'+(r.date||'—')+'</td>'
    +'<td style="font-weight:500">'+(r.period||'—')+'</td>'
    +'<td>'+fmt(r.gross)+'</td><td class="vr">'+fmt(r.taxes)+'</td>'
    +'<td class="vb">'+fmt(r.net)+'</td>'
    +'<td><span class="badge '+(r.reconciled?'b-green':'b-amber')+'">'+(r.reconciled?'Reconciled':'Pending')+'</span></td>'
    +'<td><button class="d-btn" onclick="delPayroll('+i+')">&#215;</button></td></tr>';
  }).join('');
  return'<div class="card" style="border-left:3px solid var(--blue);margin-bottom:1.25rem">'
  +'<div class="c-head"><span class="c-title">Payroll</span>'
  +'<div style="display:flex;gap:8px"><button class="add-btn" onclick="dlTpl(\'payroll\')"><i class="fas fa-arrow-down"></i> Template</button><label class="add-btn" style="cursor:pointer"><i class="fas fa-arrow-up"></i> Upload CSV<input type="file" accept=".csv,.xlsx" style="display:none" onchange="importPayroll(this)"></label></div></div>'
  +(runs.length
    ?'<div style="display:flex;gap:16px;margin-bottom:.75rem;font-size:12px">'
    +'<span>Gross wages: <strong>'+fmt(totGross)+'</strong></span>'
    +'<span>Taxes: <strong class="vr">'+fmt(totTax)+'</strong></span>'
    +'<span>Net pay: <strong class="vb">'+fmt(totNet)+'</strong></span></div>'
    +'<table><thead><tr><th style="width:11%">Date</th><th style="width:20%">Pay period</th><th style="width:13%">Gross</th><th style="width:13%">Taxes</th><th style="width:13%">Net pay</th><th style="width:13%">Status</th><th style="width:17%"></th></tr></thead><tbody>'+rows+'</tbody></table>'
    :'<div style="font-size:12px;color:var(--muted)">Upload a payroll CSV to track wages, taxes, and match to bank transactions.</div>')
  +'<div style="font-size:11px;color:var(--muted);margin-top:.5rem">CSV columns: Employee, Gross wages, Federal tax, State tax, FICA, Net pay, Pay date, Pay period · Clarity records payroll for bookkeeping purposes only — we do not process payroll or calculate taxes. Use a licensed payroll provider such as Gusto or ADP.</div>'
  +'</div>';
}
function importPayroll(input){
  var file=input.files[0];if(!file)return;
  var c=gc();if(!c)return;
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      var rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
      if(!rows.length){alert('No data found in file.');return;}
      // Aggregate by pay date/period
      var periods={};
      rows.forEach(function(row){
        var keys=Object.keys(row);
        var fk=function(terms){return keys.find(function(k){return terms.some(function(t){return k.toLowerCase().includes(t);});})||keys[0];};
        var date=String(row[fk(['date','pay date','check date'])]||'').trim();
        var period=String(row[fk(['period','pay period','week','cycle'])]||date).trim();
        var gross=Number(row[fk(['gross','wages','salary','gross wages'])]||0);
        var fedTax=Number(row[fk(['federal','fed tax','federal tax','federal withholding'])]||0);
        var stTax=Number(row[fk(['state','state tax','state withholding'])]||0);
        var fica=Number(row[fk(['fica','social','medicare','ss'])]||0);
        var net=Number(row[fk(['net','net pay','take home'])]||0);
        var taxes=fedTax+stTax+fica;
        if(!net&&gross)net=gross-taxes;
        var key=date||period;
        if(!periods[key])periods[key]={date:date,period:period,gross:0,taxes:0,net:0,employees:[]};
        periods[key].gross+=gross;periods[key].taxes+=taxes;periods[key].net+=net;
        var emp=String(row[fk(['name','employee','emp'])]||'');
        if(emp)periods[key].employees.push(emp);
      });
      if(!c.payroll)c.payroll=[];
      if(!c.expenses)c.expenses=[];
      Object.values(periods).forEach(function(p){
        var run={id:uid(),date:p.date,period:p.period,gross:p.gross,taxes:p.taxes,net:p.net,employees:p.employees,reconciled:false};
        c.payroll.push(run);
        // Post gross wages to expenses (5010)
        if(p.gross>0)c.expenses.push({id:uid(),desc:'Payroll — '+p.period,cat:'Salaries & wages',amt:p.gross,date:p.date,acctCode:'5010',reconciled:false,recurring:'None',freq:'One-time',fixed:'Fixed',payrollId:run.id});
        // Post taxes to expenses (5020)
        if(p.taxes>0)c.expenses.push({id:uid(),desc:'Payroll taxes — '+p.period,cat:'Payroll taxes & benefits',amt:p.taxes,date:p.date,acctCode:'5020',reconciled:false,recurring:'None',freq:'One-time',fixed:'Fixed',payrollId:run.id});
      });
      sv();renderAll();
      alert(Object.keys(periods).length+' payroll run(s) imported and posted to expenses.');
    }catch(err){alert('Error reading file. Check your CSV format.');}
  };
  reader.readAsArrayBuffer(file);
  input.value='';
}
function delPayroll(i){
  var c=gc();if(!confirm('Delete this payroll run? Associated expenses will also be removed.'))return;
  var run=c.payroll[i];
  c.payroll.splice(i,1);
  c.expenses=(c.expenses||[]).filter(function(e){return e.payrollId!==run.id;});
  sv();renderAll();
}
// ── END PAYROLL ───────────────────────────
// ══════════════════════════════════════════
var BILL_EI=-1;
var _f990Tab='ix';// 'ix'=Part IX expenses | 'viii'=Part VIII revenue | 'x'=Part X balance sheet
function apAgeDays(due){var d=parseDate(due);if(!d)return 0;return Math.floor((new Date()-d)/(1000*60*60*24));}
function apAgeBadge(due,status){
  if(status==='Paid')return'<span class="badge b-green">Paid</span>';
  if(!due)return'<span class="badge b-gray">No due date</span>';
  var days=apAgeDays(due);
  if(days<0)return'<span class="badge b-blue">Current</span>';
  if(days<31)return'<span class="badge b-amber">30 days</span>';
  if(days<61)return'<span class="badge b-amber">60 days</span>';
  return'<span class="badge b-red">90+ days</span>';
}
function renderAP(c){
  var now=new Date();now.setHours(0,0,0,0);
  var bills=(c.bills||[]).filter(function(b){return b.status!=='Paid';});
  var tot=bills.reduce(function(s,b){return s+Number(b.amt||0);},0);
  // A/P aging buckets — mirror A/R exactly
  var ag={cur:0,d30:0,d60:0,d90:0,d90p:0};
  bills.forEach(function(b){
    var dp=b.due?apAgeDays(b.due):0;
    var a=Number(b.amt||0);
    if(dp<=0)ag.cur+=a;else if(dp<=30)ag.d30+=a;else if(dp<=60)ag.d60+=a;else if(dp<=90)ag.d90+=a;else ag.d90p+=a;
  });
  var agingHtml=bills.length?'<div class="card" style="margin-bottom:.75rem;background:var(--bg)"><div class="c-title" style="margin-bottom:.75rem;font-size:12px">A/P Aging Schedule</div><table><thead><tr><th>Current</th><th>1–30 days</th><th>31–60 days</th><th>61–90 days</th><th>90+ days</th><th>Total</th></tr></thead><tbody><tr>'
    +'<td style="color:var(--green)">'+fmt(ag.cur)+'</td>'
    +'<td style="color:'+(ag.d30>0?'var(--amber)':'var(--muted)')+'">'+fmt(ag.d30)+'</td>'
    +'<td style="color:'+(ag.d60>0?'var(--amber)':'var(--muted)')+'">'+fmt(ag.d60)+'</td>'
    +'<td style="color:'+(ag.d90>0?'var(--red)':'var(--muted)')+'">'+fmt(ag.d90)+'</td>'
    +'<td style="color:'+(ag.d90p>0?'var(--red)':'var(--muted)')+'">'+fmt(ag.d90p)+'</td>'
    +'<td style="font-weight:600">'+fmt(tot)+'</td>'
    +'</tr></tbody></table></div>':'';
  var rows=bills.map(function(b){
    var oi=(c.bills||[]).indexOf(b);
    return'<tr><td style="font-weight:500">'+escHtml(b.vendor||'—')+'</td><td>'+escHtml(b.desc||'—')+'</td><td class="vr">'+fmt(b.amt)+'</td><td style="color:var(--muted)">'+(b.due||'—')+'</td><td>'+apAgeBadge(b.due,b.status)+'</td>'
    +'<td><div class="row-acts">'+billRcptCell(oi,b)+'<button class="e-btn" onclick="payBill('+oi+')" title="Mark paid" style="color:var(--green)"><i class="fas fa-check"></i></button><button class="e-btn" onclick="editBill('+oi+')">&#9998;</button><button class="d-btn" onclick="delBill('+oi+')">&#215;</button></div></td></tr>';
  }).join('');
  return'<div class="card" style="border-left:3px solid var(--amber);margin-bottom:1.25rem">'
  +'<div class="c-head"><span class="c-title">Accounts payable</span><div style="display:flex;gap:6px"><button class="add-btn" onclick="printAPAging()" title="Export aging schedule PDF"><i class="fas fa-print"></i> Print aging</button><button class="add-btn" onclick="billOpenNew()">+ Enter bill</button></div></div>'
  +agingHtml
  +(bills.length
    ?'<table><thead><tr><th style="width:16%">Vendor</th><th style="width:22%">Description</th><th style="width:10%">Amount</th><th style="width:11%">Due</th><th style="width:12%">Age</th><th style="width:29%"></th></tr></thead><tbody>'+rows+'</tbody></table>'
    :'<div style="font-size:12px;color:var(--muted)">No open bills. Enter a bill to track what you owe before it hits your bank.</div>')
  +'</div>';
}
// Populate the bill modal's expense-account dropdown with live Expense-type
// accounts from the COA. Re-run every time the modal opens so newly added
// accounts show up, and so edits to an existing bill pre-select the right one.
function _billPopulateAcctOptions(selectedCode){
  var c=gc();if(!c)return;
  var sel=g('bill-acct');if(!sel)return;
  var expAccts=(c.accounts||[]).filter(function(a){return a.type==='Expense'&&a.active!==false;});
  sel.innerHTML='<option value="">— Select expense account —</option>'
    +expAccts.map(function(a){
      return '<option value="'+a.code+'"'+(selectedCode===a.code?' selected':'')+'>'+a.code+' '+a.name+'</option>';
    }).join('');
}
function billOpenNew(){BILL_EI=-1;resetBillForm();_billPopulateAcctOptions('');openM('m-bill');}
function saveBill(){
  var c=gc();if(!c.bills)c.bills=[];
  // PERIOD LOCK GUARD — check bill received date
  var _billLockDate=g('bill-recv')&&g('bill-recv').value.trim();
  if(_billLockDate&&isDateLocked(c,_billLockDate)){periodLockAlert(c.closedThrough);return;}
  var vendor=sanitizeInput(g('bill-vendor').value.trim());if(!vendor){alert('Please enter a vendor name.');return;}
  var acctCode=g('bill-acct')&&g('bill-acct').value;
  if(!acctCode){alert('Please select an expense account for this bill.');return;}
  var acctObj=(c.accounts||[]).find(function(a){return a.code===acctCode;});
  var billId=BILL_EI>=0?(c.bills[BILL_EI].id||uid()):uid();
  var item={id:billId,vendor:vendor,desc:sanitizeInput(g('bill-desc').value.trim()),amt:Number(g('bill-amt').value||0),received:g('bill-recv').value,due:g('bill-due').value,acctCode:acctCode,cat:(acctObj&&acctObj.cat)||'Uncategorized',status:'Unpaid',notes:g('bill-notes').value};
  var isNew=BILL_EI<0;
  if(BILL_EI>=0)c.bills[BILL_EI]=item;else c.bills.push(item);
  // AP ACCRUAL: on new bill entry post Dr Expense / Cr AP (accrual basis)
  // On edit we void the old ledger entry and repost to keep amounts in sync
  if(!isNew&&item.ledgerEntryId){voidLedgerEntry(c,item.ledgerEntryId);}
  var apCode=_defaultAPCode(c);
  var le=postToLedger(c,acctCode,apCode,item.amt,'Bill received: '+vendor+(item.desc?' — '+item.desc:''),'bill',billId);
  if(le)item.ledgerEntryId=le.id;
  BILL_EI=-1;sv();renderAll();closeM('m-bill');resetBillForm();
}
function payBill(i){
  var c=gc();if(!c.bills[i])return;
  var b=c.bills[i];
  // PERIOD LOCK GUARD
  if(isDateLocked(c,todayNum())){periodLockAlert(c.closedThrough);return;}
  // Prompt for check/ACH number before confirm so user can cancel cleanly
  var instrNum=window.prompt('Check or ACH number (leave blank to skip):','');
  if(instrNum===null)return;// Cancel pressed
  instrNum=(instrNum||'').trim();
  var memo=b.vendor+(b.desc?' — '+b.desc:'')+(instrNum?' ['+instrNum+']':'');
  if(!confirm('Mark "'+b.vendor+'" bill for '+fmt(b.amt)+' as paid and post to expenses?'))return;
  b.status='Paid';b.paidDate=todayNum();b.instrNum=instrNum||'';
  if(!c.expenses)c.expenses=[];
  var expId=uid();
  // checkNum stored as structured data (not just in the memo string) so the
  // bank feed can later show "Check #1472" when offering a match, and so a
  // future check-printing feature has a real field to read/write.
  // matchId stays unset until a bank transaction is matched to this expense —
  // see bankMatchOne() in bank.js.
  c.expenses.push({id:expId,desc:memo,cat:b.cat||'Accounts Payable',amt:b.amt,date:b.paidDate,acctCode:b.acctCode||'2010',reconciled:false,recurring:'None',freq:'One-time',fixed:'Variable',is1099:b.is1099||false,vendor1099:b.vendor||'',tin1099:b.tin1099||'',checkNum:instrNum||'',billId:b.id,matchId:null});
  // DOUBLE ENTRY: paying a bill clears the AP accrual entry -- Dr AP / Cr Cash
  var apCode=_defaultAPCode(c);var cashCode=_defaultCashCode(c);
  postToLedger(c,apCode,cashCode,b.amt,'Pay bill: '+memo,'expense',expId);
  sv();renderAll();
}
function editBill(i){var c=gc();if(!c.bills[i])return;BILL_EI=i;var b=c.bills[i];g('bill-vendor').value=b.vendor||'';g('bill-desc').value=b.desc||'';g('bill-amt').value=b.amt||'';g('bill-recv').value=b.received||'';g('bill-due').value=b.due||'';g('bill-cat').value=b.cat||'';g('bill-notes').value=b.notes||'';_billPopulateAcctOptions(b.acctCode||'');openM('m-bill');}
function delBill(i){var c=gc();if(!confirm('Delete this bill?'))return;c.bills.splice(i,1);sv();renderAll();}
function resetBillForm(){['bill-vendor','bill-desc','bill-amt','bill-recv','bill-due','bill-cat','bill-notes'].forEach(function(id){var el=g(id);if(el)el.value='';});}


function printAPAging(){
  var c=gc();if(!c)return;
  var bills=(c.bills||[]).filter(function(b){return b.status!=='Paid';});
  if(!bills.length){alert('No open bills to print.');return;}
  var now=new Date();now.setHours(0,0,0,0);
  var ag={cur:[],d30:[],d60:[],d90:[],d90p:[]};
  bills.forEach(function(b){
    var dp=b.due?apAgeDays(b.due):0;
    if(dp<=0)ag.cur.push(b);else if(dp<=30)ag.d30.push(b);else if(dp<=60)ag.d60.push(b);else if(dp<=90)ag.d90.push(b);else ag.d90p.push(b);
  });
  var tot=bills.reduce(function(s,b){return s+Number(b.amt||0);},0);
  var agTots={cur:ag.cur.reduce(function(s,b){return s+Number(b.amt||0);},0),d30:ag.d30.reduce(function(s,b){return s+Number(b.amt||0);},0),d60:ag.d60.reduce(function(s,b){return s+Number(b.amt||0);},0),d90:ag.d90.reduce(function(s,b){return s+Number(b.amt||0);},0),d90p:ag.d90p.reduce(function(s,b){return s+Number(b.amt||0);},0)};
  function fmtN(n){return'$'+Number(n||0).toLocaleString();}
  function bRow(b){var dp=b.due?apAgeDays(b.due):0;var aged=dp>90?'90+ days':dp>60?'61–90 days':dp>30?'31–60 days':dp>0?'1–30 days':'Current';return'<tr><td>'+escHtml(b.vendor||'—')+'</td><td>'+escHtml(b.desc||'—')+'</td><td style="text-align:right">'+fmtN(b.amt)+'</td><td>'+(b.due||'—')+'</td><td>'+aged+'</td></tr>';}
  var sections=[
    {label:'90+ Days Overdue',bills:ag.d90p,cls:'color:#c0392b;font-weight:600'},
    {label:'61–90 Days',bills:ag.d90,cls:'color:#c0392b'},
    {label:'31–60 Days',bills:ag.d60,cls:'color:#BA7517'},
    {label:'1–30 Days',bills:ag.d30,cls:'color:#BA7517'},
    {label:'Current',bills:ag.cur,cls:'color:#1D9E75'}
  ];
  var body='<h2 style="margin:0 0 4px">Accounts Payable Aging Schedule</h2>';
  body+='<div style="color:#888;font-size:11px;margin-bottom:1.5rem">As of '+today()+' &nbsp;·&nbsp; '+c.name+'</div>';
  // Summary table
  body+='<table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem;font-size:12px">';
  body+='<thead><tr style="background:#f5f3ee"><th style="padding:6px 8px;text-align:left">Bucket</th><th style="padding:6px 8px;text-align:right">Amount</th><th style="padding:6px 8px;text-align:right">Bills</th></tr></thead><tbody>';
  body+='<tr><td style="padding:5px 8px">Current</td><td style="padding:5px 8px;text-align:right;color:#1D9E75">'+fmtN(agTots.cur)+'</td><td style="padding:5px 8px;text-align:right">'+ag.cur.length+'</td></tr>';
  body+='<tr><td style="padding:5px 8px">1–30 days</td><td style="padding:5px 8px;text-align:right;color:#BA7517">'+fmtN(agTots.d30)+'</td><td style="padding:5px 8px;text-align:right">'+ag.d30.length+'</td></tr>';
  body+='<tr><td style="padding:5px 8px">31–60 days</td><td style="padding:5px 8px;text-align:right;color:#BA7517">'+fmtN(agTots.d60)+'</td><td style="padding:5px 8px;text-align:right">'+ag.d60.length+'</td></tr>';
  body+='<tr><td style="padding:5px 8px">61–90 days</td><td style="padding:5px 8px;text-align:right;color:#c0392b">'+fmtN(agTots.d90)+'</td><td style="padding:5px 8px;text-align:right">'+ag.d90.length+'</td></tr>';
  body+='<tr><td style="padding:5px 8px">90+ days</td><td style="padding:5px 8px;text-align:right;color:#c0392b;font-weight:600">'+fmtN(agTots.d90p)+'</td><td style="padding:5px 8px;text-align:right;font-weight:600">'+ag.d90p.length+'</td></tr>';
  body+='<tr style="border-top:2px solid #333;font-weight:700"><td style="padding:6px 8px">Total outstanding</td><td style="padding:6px 8px;text-align:right">'+fmtN(tot)+'</td><td style="padding:6px 8px;text-align:right">'+bills.length+'</td></tr>';
  body+='</tbody></table>';
  // Detail by bucket
  sections.forEach(function(sec){
    if(!sec.bills.length)return;
    body+='<h3 style="font-size:12px;margin:1rem 0 .4rem;'+sec.cls+'">'+sec.label+' ('+sec.bills.length+' bill'+(sec.bills.length>1?'s':'')+')</h3>';
    body+='<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:.75rem">';
    body+='<thead><tr style="background:#f5f3ee"><th style="padding:4px 6px;text-align:left">Vendor</th><th style="padding:4px 6px;text-align:left">Description</th><th style="padding:4px 6px;text-align:right">Amount</th><th style="padding:4px 6px;text-align:left">Due</th><th style="padding:4px 6px;text-align:left">Age</th></tr></thead>';
    body+='<tbody>'+sec.bills.map(bRow).join('')+'</tbody></table>';
  });
  body+='<div style="margin-top:2.5rem;display:grid;grid-template-columns:1fr 1fr;gap:3rem">';
  body+='<div><div style="border-top:1px solid #333;padding-top:4px;font-size:11px;color:#888">Prepared by / Date</div></div>';
  body+='<div><div style="border-top:1px solid #333;padding-top:4px;font-size:11px;color:#888">Reviewed by / Date</div></div>';
  body+='</div>';
  if(typeof openPDF==='function')openPDF(body,c,'A/P Aging Schedule');
}

// ══════════════════════════════════════════
// CREDIT CARDS
// ══════════════════════════════════════════
var CC_EI=-1;
function renderCC(c){
  if(!c||!(c.creditCards||[]).length)return'<div style="margin-bottom:1rem"><button class="add-btn" style="font-size:11px" onclick="openM(\'m-cc\')">+ Add credit card</button></div>';
  var html='';
  (c.creditCards||[]).forEach(function(cc,ci){
    var charges=(c.expenses||[]).filter(function(e){return e.ccId===cc.id;});
    var unpaid=charges.filter(function(e){return!e.ccPaid;});
    var balance=unpaid.reduce(function(s,e){return s+Number(e.amt||0);},0);
    var limit=Number(cc.limit||0);
    var util=limit>0?Math.min(100,Math.round((balance/limit)*100)):null;
    var rows=unpaid.slice().sort(function(a,b){return(b.date||'').localeCompare(a.date||'');}).map(function(e){
      var oi=(c.expenses||[]).indexOf(e);
      return'<tr><td style="color:var(--muted);font-size:11px">'+(e.date||'\u2014')+'</td><td>'+escHtml(e.desc)+'</td><td style="color:var(--muted);font-size:11px">'+escHtml(e.cat||'\u2014')+'</td><td class="vr">'+fmt(e.amt)+'</td>'
      +'<td><div class="row-acts"><button class="e-btn" style="color:var(--green)" onclick="markCCPaid('+oi+')" title="Mark cleared">\u2713</button><button class="d-btn" onclick="delItem(\'expenses\','+oi+')" title="Delete">&#215;</button></div></td></tr>';
    }).join('');
    html+='<div class="card" style="border-left:3px solid var(--blue);margin-bottom:1.25rem">'
    +'<div class="c-head"><span class="c-title">'+cc.name+(cc.last4?' \u00b7\u00b7\u00b7'+cc.last4:'')+'</span>'
    +'<div style="display:flex;gap:6px;align-items:center">'
    +(limit?'<span style="font-size:11px;color:var(--muted)">'+fmt(balance)+' / '+fmt(limit)+'</span>':'<span style="font-size:11px;color:var(--muted)">Balance: '+fmt(balance)+'</span>')
    +'<button class="add-btn" onclick="openCCCharge(\''+cc.id+'\')">+ Charge</button>'
    +'<button class="e-btn" style="border:1px solid var(--border);border-radius:7px;padding:4px 9px;font-size:12px" onclick="editCC('+ci+')">&#9998;</button>'
    +'<button class="d-btn" style="border:1px solid var(--red-bg);border-radius:7px;padding:4px 9px;font-size:12px" onclick="deleteCC(\''+cc.id+'\')">&#215;</button>'
    +'</div></div>'
    +(util!==null?'<div style="margin-bottom:.5rem"><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:3px"><span>Utilization</span><span>'+util+'%</span></div><div class="pbar" style="height:6px"><div class="pfill" style="width:'+util+'%;background:'+(util>80?'var(--red)':util>50?'var(--amber)':'var(--blue)')+'"></div></div></div>':'')
    +(unpaid.length
      ?'<table><thead><tr><th style="width:11%">Date</th><th style="width:34%">Description</th><th style="width:16%">Category</th><th style="width:12%">Amount</th><th style="width:27%"></th></tr></thead><tbody>'+rows+'</tbody></table>'
      :'<div style="font-size:12px;color:var(--green);padding:.25rem 0">\u2713 No unpaid charges</div>')
    +'</div>';
  });
  return html+'<div style="margin-bottom:1rem"><button class="add-btn" style="font-size:11px" onclick="openM(\'m-cc\')">+ Add credit card</button></div>';
}
function openCCCharge(ccId){EI=-1;openM('m-exp');setTimeout(function(){var s=g('e-bank');if(s)s.value='cc:'+ccId;},60);}
function markCCPaid(i){var c=gc();if(!c||!c.expenses[i])return;c.expenses[i].ccPaid=true;c.expenses[i].reconciled=true;sv();renderAll();}
function saveCC(){
  var c=gc();if(!c.creditCards)c.creditCards=[];
  var name=g('cc-name').value.trim();if(!name){alert('Please enter a card name.');return;}
  var item={id:CC_EI>=0?(c.creditCards[CC_EI].id||uid()):uid(),name:name,last4:g('cc-last4').value.trim(),limit:Number(g('cc-limit').value||0),network:g('cc-network').value};
  if(!c.accounts)c.accounts=[];
  var coaName=name+(item.last4?' \u00b7\u00b7\u00b7'+item.last4:'');
  if(!c.accounts.find(function(a){return a.name===coaName&&a.type==='Liability';})){
    var used=c.accounts.filter(function(a){return a.code.indexOf('2')===0;}).map(function(a){return parseInt(a.code)||0;});
    var nc=String(used.length?(Math.max.apply(null,used)+10):2100);
    c.accounts.push({id:uid(),code:nc,name:coaName,type:'Liability',cat:'Credit Cards'});
    c.accounts.sort(function(a,b){return a.code.localeCompare(b.code);});
  }
  if(CC_EI>=0)c.creditCards[CC_EI]=item;else c.creditCards.push(item);
  CC_EI=-1;sv();renderAll();closeM('m-cc');['cc-name','cc-last4','cc-limit'].forEach(function(id){var el=g(id);if(el)el.value='';});
}
function editCC(i){var c=gc();if(!c.creditCards[i])return;CC_EI=i;var cc=c.creditCards[i];g('cc-name').value=cc.name||'';g('cc-last4').value=cc.last4||'';g('cc-limit').value=cc.limit||'';g('cc-network').value=cc.network||'Visa';openM('m-cc');}
function deleteCC(id){var c=gc();if(!confirm('Remove this card? Charges remain as expenses.'))return;c.creditCards=(c.creditCards||[]).filter(function(cc){return cc.id!==id;});(c.expenses||[]).forEach(function(e){if(e.ccId===id)delete e.ccId;});sv();renderAll();}

// ══════════════════════════════════════════
// AMORTIZATION TABLE
// ══════════════════════════════════════════
var LOAN_EI=-1,LOAN_VIEW=null;
function calcAmort(principal,rate,termMonths){
  var mo=rate/100/12;var pmt=mo===0?principal/termMonths:principal*(mo*Math.pow(1+mo,termMonths))/(Math.pow(1+mo,termMonths)-1);
  var bal=principal;var rows=[];
  for(var i=1;i<=termMonths;i++){
    var int=bal*mo;var prin=pmt-int;if(i===termMonths)prin=bal;
    bal=Math.max(0,bal-prin);
    rows.push({num:i,payment:pmt,interest:int,principal:prin,balance:bal});
  }
  return{payment:pmt,rows:rows};
}
function renderAmortization(c){
  var el=g('amort-section');if(!el)return;
  var loans=c.loans||[];
  if(!loans.length)return;
  if(LOAN_VIEW===null||LOAN_VIEW>=loans.length)LOAN_VIEW=0;
  var loan=loans[LOAN_VIEW];
  var amort=calcAmort(Number(loan.principal),Number(loan.rate),Number(loan.term));
  var posted=loan.posted||[];
  var loanOpts=loans.map(function(l,i){return'<option value="'+i+'"'+(LOAN_VIEW===i?' selected':'')+'>'+l.name+'</option>';}).join('');
  var remaining=Number(loan.principal)-amort.rows.filter(function(r){return posted.indexOf(r.num)>=0;}).reduce(function(s,r){return s+r.principal;},0);
  var rows=amort.rows.map(function(r){
    var isPosted=posted.indexOf(r.num)>=0;
    var dueDate='';
    if(loan.startDate){var d=parseDate(loan.startDate);if(d){d.setMonth(d.getMonth()+r.num);dueDate=(d.getMonth()+1).toString().padStart(2,'0')+'/'+d.getDate().toString().padStart(2,'0')+'/'+d.getFullYear();}}
    return'<tr'+(isPosted?' style="color:var(--muted)"':'')+'>'
    +'<td style="color:var(--muted)">#'+r.num+(dueDate?' · '+dueDate:'')+'</td>'
    +'<td>'+fmt(r.payment)+'</td>'
    +'<td class="vr">'+fmt(r.interest)+'</td>'
    +'<td class="vb">'+fmt(r.principal)+'</td>'
    +'<td>'+fmt(r.balance)+'</td>'
    +'<td>'+(isPosted?'<span class="badge b-green">Posted <i class="fas fa-check"></i></span>':'<button class="add-btn" onclick="postLoanPayment('+LOAN_VIEW+','+r.num+','+r.interest.toFixed(2)+','+r.principal.toFixed(2)+')" style="font-size:10px;padding:3px 8px">Post interest</button>')+'</td>'
    +'</tr>';
  }).join('');
  el.innerHTML='<div class="card" style="border-left:3px solid var(--blue)">'
  +'<div class="c-head"><span class="c-title">Loan amortization schedule</span><div style="display:flex;gap:8px;align-items:center"><div class="sw"><select onchange="LOAN_VIEW=parseInt(this.value);renderAmortization(gc())">'+loanOpts+'</select></div><button class="e-btn" onclick="editLoan('+LOAN_VIEW+')">&#9998;</button><button class="d-btn" onclick="delLoan('+LOAN_VIEW+')">&#215;</button></div></div>'
  +'<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:.75rem;font-size:12px">'
  +'<span>Principal: <strong>'+fmt(loan.principal)+'</strong></span>'
  +'<span>Rate: <strong>'+loan.rate+'%</strong></span>'
  +'<span>Term: <strong>'+loan.term+' months</strong></span>'
  +'<span>Monthly payment: <strong class="vb">'+fmt(amort.payment)+'</strong></span>'
  +'<span>Remaining balance: <strong class="vr">'+fmt(remaining)+'</strong></span>'
  +'</div>'
  +'<div style="font-size:11px;color:var(--muted);margin-bottom:.75rem">Clicking "Post interest" records the interest portion to expenses. Principal reduction is confirmed when you import your bank statement.</div>'
  +'<div style="max-height:320px;overflow-y:auto"><table><thead><tr><th style="width:22%">Payment</th><th style="width:14%">Total</th><th style="width:14%">Interest</th><th style="width:14%">Principal</th><th style="width:14%">Balance</th><th style="width:22%"></th></tr></thead><tbody>'+rows+'</tbody></table></div>'
  +'</div>';
}
function postLoanPayment(li,num,interest,principal){
  var c=gc();if(!c.loans[li])return;
  var loan=c.loans[li];var date=todayNum();
  if(!c.expenses)c.expenses=[];
  // Post interest to expenses
  if(interest>0.01)c.expenses.push({id:uid(),desc:'Loan interest — '+loan.name+' pmt #'+num,cat:'Interest',amt:Number(interest.toFixed(2)),date:date,acctCode:'5700',reconciled:false,recurring:'None',freq:'One-time',fixed:'Fixed'});
  // Reduce loan liability balance in COA (account 2200 or loan's acctCode)
  var loanAcct=c.accounts.find(function(a){return a.code===(loan.acctCode||'2200');});
  if(loanAcct){if(!loanAcct.balance)loanAcct.balance=Number(loan.principal);loanAcct.balance=Math.max(0,(loanAcct.balance||Number(loan.principal))-principal);}
  if(!loan.posted)loan.posted=[];
  loan.posted.push(num);
  sv();renderAll();
  // Note: principal reduction is confirmed when bank statement import matches this payment
}
function saveLoan(){
  var c=gc();if(!c.loans)c.loans=[];
  var name=g('loan-name').value.trim();if(!name){alert('Please enter a loan name.');return;}
  var item={id:LOAN_EI>=0?(c.loans[LOAN_EI].id||uid()):uid(),name:name,principal:Number(g('loan-principal').value||0),rate:Number(g('loan-rate').value||0),term:Number(g('loan-term').value||12),startDate:g('loan-start').value,posted:LOAN_EI>=0?(c.loans[LOAN_EI].posted||[]):[]};
  if(!item.principal||!item.term){alert('Please enter principal and term.');return;}
  if(LOAN_EI>=0)c.loans[LOAN_EI]=item;else{c.loans.push(item);LOAN_VIEW=c.loans.length-1;}
  LOAN_EI=-1;sv();renderAll();closeM('m-loan');resetLoanForm();
}
function editLoan(i){var c=gc();if(!c.loans[i])return;LOAN_EI=i;var l=c.loans[i];g('loan-name').value=l.name||'';g('loan-principal').value=l.principal||'';g('loan-rate').value=l.rate||'';g('loan-term').value=l.term||'';g('loan-start').value=l.startDate||'';openM('m-loan');}
function delLoan(i){var c=gc();if(!confirm('Delete this loan and its amortization schedule?'))return;c.loans.splice(i,1);LOAN_VIEW=c.loans.length?0:null;sv();renderAll();}
function resetLoanForm(){['loan-name','loan-principal','loan-rate','loan-term','loan-start'].forEach(function(id){var el=g(id);if(el)el.value='';}); }
// ── END AMORTIZATION ─────────────────────

// ── END A/P ──────────────────────────────

var PROC_EI=-1;
function renderProcurement(c){
  var p=g('p-procurement');if(!p)return;if(!c)return;
  var bids=c.procurement||[];
  var filt=srchItems(bids,SRCH['p-procurement']||'',['vendor','scope','status','fund']);
  var grants=c.grants||[];
  function grantName(id){var gr=grants.find(function(x){return x.id===id;});return gr?gr.name:id||'—';}
  var totAwarded=bids.filter(function(b){return b.status==='Awarded';}).reduce(function(s,b){return s+Number(b.bidAmt||0);},0);
  var needsFlag=bids.filter(function(b){
    if(b.status==='Awarded'||b.status==='Rejected'||b.status==='Sole source')return false;
    var bidCount=bids.filter(function(x){return x.scope===b.scope&&x.status!=='Rejected';}).length;
    return b.federal&&bidCount<3;
  });
  var flagHtml=needsFlag.length?'<div class="insight" style="border-left-color:var(--red)"><div class="ins-lbl"><i class="fas fa-triangle-exclamation"></i> Compliance alert</div>'+needsFlag.length+' federal solicitation'+(needsFlag.length===1?'':'s')+' with fewer than 3 bids documented. Add bids or mark as sole source with justification.</div>':'';
  var rows=filt.map(function(b){
    var oi=bids.indexOf(b);
    var bidCount=bids.filter(function(x){return x.scope===b.scope;}).length;
    var fedFlag=b.federal&&bidCount<3&&b.status!=='Sole source'&&b.status!=='Awarded'&&b.status!=='Rejected';
    return'<tr'+(fedFlag?' style="background:rgba(192,57,43,.06)"':'')+'>'
    +'<td style="font-weight:500">'+escHtml(b.vendor||'—')+'</td>'
    +'<td>'+(b.scope||'—')+'</td>'
    +'<td>'+fmt(b.bidAmt)+'</td>'
    +'<td style="color:var(--muted)">'+(b.bidDate||'—')+'</td>'
    +'<td>'+SB(b.status||'Soliciting')+'</td>'
    +'<td>'+(b.grantId?'<span class="badge b-green" style="font-size:9px;max-width:120px;overflow:hidden;text-overflow:ellipsis;display:inline-block">'+grantName(b.grantId).slice(0,22)+'</span>':b.fund?'<span class="badge '+(b.fund?'b-blue':'b-gray')+'">'+b.fund+'</span>':'—')+'</td>'
    +'<td>'+(b.federal?'<span class="badge b-blue">Federal</span>':'—')+'</td>'
    +'<td><div class="row-acts"><button class="e-btn" onclick="editProc('+oi+')" title="Edit">&#9998;</button>'
    +(b.docRef?'<a href="'+b.docRef+'" target="_blank" class="e-btn" title="View document" style="display:inline-flex;align-items:center;justify-content:center;text-decoration:none">&#128196;</a>':'')
    +'<button class="e-btn" onclick="openProcAudit('+oi+')" title="Audit log">&#128221;</button>'
    +'<button class="d-btn" onclick="delProc('+oi+')" title="Delete">&#215;</button></div></td></tr>';
  }).join('');
  p.innerHTML=FB()
  +'<div class="xbar"><button class="xbtn" onclick="exportProcurement()">Export for auditors</button><button class="xbtn p" onclick="PROC_EI=-1;resetProcForm();openM(\'m-proc\')">+ Add bid</button></div>'
  +flagHtml
  +srchBar('p-procurement','renderProcurement(gc())')
  +'<div class="metrics"><div class="metric"><div class="m-lbl">Total bids</div><div class="m-val vb">'+bids.length+'</div></div><div class="metric"><div class="m-lbl">Awarded value</div><div class="m-val vg">'+fmt(totAwarded)+'</div></div><div class="metric"><div class="m-lbl">Compliance flags</div><div class="m-val '+(needsFlag.length>0?'vr':'vg')+'">'+needsFlag.length+'</div></div></div>'
  +'<div class="card"><div class="c-head"><span class="c-title">Bid log</span></div>'
  +(bids.length?'<table><thead><tr><th style="width:14%">Vendor</th><th style="width:16%">Scope</th><th style="width:9%">Amount</th><th style="width:9%">Date</th><th style="width:10%">Status</th><th style="width:14%">Grant/Fund</th><th style="width:8%">Type</th><th style="width:20%"></th></tr></thead><tbody>'+rows+'</tbody></table>'
  :ES('No bids logged yet','Add vendor bids to track procurement compliance.','PROC_EI=-1;resetProcForm();openM(\'m-proc\')'))+'</div>';
}
function resetProcForm(){['proc-vendor','proc-scope','proc-amt','proc-date','proc-fund','proc-winner','proc-just','proc-doc','proc-file'].forEach(function(id){var el=g(id);if(el)el.value='';});var s=g('proc-status');if(s)s.value='Soliciting';var f=g('proc-federal');if(f)f.value='no';var gr=g('proc-grant');if(gr)gr.value='';}
async function uploadProcDoc(file){
  var sb=sbClient();if(!sb||!_user)return null;
  var ext=file.name.split('.').pop();
  var path=_user.id+'/'+uid()+'.'+ext;
  var buf=await file.arrayBuffer();
  var data=buf;
  if(file.type.startsWith('image/')&&file.size>800000){
    await new Promise(function(res){
      var img=new Image(),url=URL.createObjectURL(file);
      img.onload=function(){
        var canvas=document.createElement('canvas');
        var scale=Math.min(1,800/Math.max(img.width,img.height));
        canvas.width=img.width*scale;canvas.height=img.height*scale;
        canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
        canvas.toBlob(function(blob){blob.arrayBuffer().then(function(b){data=b;URL.revokeObjectURL(url);res();});},file.type,0.75);
      };img.src=url;
    });
  }
  var res=await sb.storage.from('procurement-docs').upload(path,data,{contentType:file.type,upsert:false});
  if(res.error)return null;
  return sb.storage.from('procurement-docs').getPublicUrl(path).data.publicUrl;
}
function saveProc(){
  var c=gc();if(!c.procurement)c.procurement=[];
  var vendor=g('proc-vendor').value.trim();if(!vendor){alert('Please enter a vendor name.');return;}
  var file=g('proc-file')&&g('proc-file').files[0];
  var btn=document.querySelector('#m-proc .sv-btn');
  async function doSave(docUrl){
    var now=new Date().toISOString();
    var existingDoc=PROC_EI>=0?(c.procurement[PROC_EI].docRef||''):'';
    var item={id:PROC_EI>=0?(c.procurement[PROC_EI].id||uid()):uid(),vendor:vendor,scope:g('proc-scope').value,bidAmt:Number(g('proc-amt').value||0),bidDate:g('proc-date').value,status:g('proc-status').value||'Soliciting',grantId:g('proc-grant').value||'',fund:g('proc-fund').value,federal:g('proc-federal').value==='yes',winner:g('proc-winner').value,justification:g('proc-just').value,docRef:docUrl||existingDoc,audit:PROC_EI>=0?(c.procurement[PROC_EI].audit||[]):[]};
    if(PROC_EI>=0){var old=c.procurement[PROC_EI];if(old.status!==item.status)item.audit.push({field:'status',oldValue:old.status,newValue:item.status,timestamp:now});if(old.vendor!==item.vendor)item.audit.push({field:'vendor',oldValue:old.vendor,newValue:item.vendor,timestamp:now});c.procurement[PROC_EI]=item;}
    else{item.audit.push({field:'created',oldValue:'',newValue:'Bid added',timestamp:now});c.procurement.push(item);}
    PROC_EI=-1;sv();renderProcurement(c);closeM('m-proc');resetProcForm();
    if(btn){btn.textContent='Save bid record';btn.disabled=false;}
  }
  if(file){
    if(btn){btn.textContent='Uploading...';btn.disabled=true;}
    uploadProcDoc(file).then(function(url){
      if(!url)alert('Upload failed — record saved without file.');
      doSave(url);
    });
  }else{doSave(null);}
}
function editProc(i){var c=gc();if(!c.procurement[i])return;PROC_EI=i;var b=c.procurement[i];g('proc-vendor').value=b.vendor||'';g('proc-scope').value=b.scope||'';g('proc-amt').value=b.bidAmt||'';g('proc-date').value=b.bidDate||'';g('proc-status').value=b.status||'Soliciting';g('proc-grant').value=b.grantId||'';g('proc-fund').value=b.fund||'';g('proc-federal').value=b.federal?'yes':'no';g('proc-winner').value=b.winner||'';g('proc-just').value=b.justification||'';g('proc-doc').value=b.docRef||'';openM('m-proc');}
function delProc(i){var c=gc();if(!confirm('Delete this bid record? This cannot be undone.'))return;c.procurement.splice(i,1);sv();renderProcurement(c);}
function openProcAudit(i){
  var c=gc();if(!c.procurement[i])return;
  var log=c.procurement[i].audit||[];
  var labels={status:'Status',vendor:'Vendor',created:'Created'};
  var rows=log.map(function(e){return'<tr><td style="font-size:10px;color:var(--muted);white-space:nowrap">'+(e.timestamp?e.timestamp.replace('T',' ').slice(0,19):'—')+'</td><td>'+(labels[e.field]||e.field)+'</td><td style="color:var(--muted)">'+(e.oldValue||'—')+'</td><td>'+(e.newValue||'—')+'</td></tr>';}).join('');
  g('proc-audit-body').innerHTML=rows||'<tr><td colspan="4" style="text-align:center;padding:1.5rem;color:var(--muted);font-size:12px">No audit history yet.</td></tr>';
  openM('m-proc-audit');
}
function exportProcurement(){
  var c=gc();if(!c)return;var wb=XLSX.utils.book_new();
  var grants=c.grants||[];
  function grantName(id){var gr=grants.find(function(x){return x.id===id;});return gr?gr.name:id||'';}
  var rows=[['Vendor','Scope of work','Bid amount','Bid date','Status','Grant/Fund','Federal','Winning vendor','Sole source justification','Doc reference']];
  (c.procurement||[]).forEach(function(b){rows.push([b.vendor||'',b.scope||'',Number(b.bidAmt||0),b.bidDate||'',b.status||'',grantName(b.grantId)||b.fund||'',b.federal?'Yes':'No',b.winner||'',b.justification||'',b.docRef||'']);});
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'Procurement');
  XLSX.writeFile(wb,(c.name||'client').replace(/[^a-z0-9]/gi,'-')+'-procurement-report.xlsx');
}

// ══════════════════════════════════════════
// #5 — GRANT COMPLIANCE: wire into renderAll
// ══════════════════════════════════════════
if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}

// ══════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ══════════════════════════════════════════
document.addEventListener('keydown',function(e){
  var tag=document.activeElement?document.activeElement.tagName:'';
  var inInput=tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT';
  var mod=e.metaKey||e.ctrlKey;

  // Esc — close topmost open modal
  if(e.key==='Escape'){
    var open=document.querySelector('.overlay.open');
    if(open){closeM(open.id);e.preventDefault();}
    return;
  }

  // Cmd/Ctrl+S — click save button in open modal
  if(mod&&e.key==='s'){
    e.preventDefault();
    var svBtn=document.querySelector('.overlay.open .sv-btn');
    if(svBtn)svBtn.click();
    return;
  }

  if(inInput)return;

  // Cmd/Ctrl+N — new item based on active tab
  if(mod&&e.key==='n'){
    e.preventDefault();
    var active=document.querySelector('#tabs .tab.active');
    var panel=active?active.dataset.panel:'';
    if(panel==='npexp'||panel==='sbexp'||panel==='peexp'){EI=-1;if(g('e-gid'))g('e-gid').value='';openM('m-exp');}
    else if(panel==='funding'){EI=-1;openM('m-inc');}
    else if(panel==='revenue'){EI=-1;openM('m-rev');}
    else if(panel==='grants'){EI=-1;openM('m-grant');}
    else if(panel==='donors'){DONOR_EI=-1;resetDonorForm();openM('m-donor');}
    else if(panel==='budget'){EI=-1;openM('m-budget');}
    return;
  }
});

// ══════════════════════════════════════════
// PETTY CASH MODULE
// ══════════════════════════════════════════
// Schema: c.pettyCash[]: {id, date, type:'disbursement'|'replenishment', amt, desc, cat, receipt, createdAt}
// Running balance starts from the fund balance set on the client (c.pettyCashFund).
var PC_EI = -1;
function renderPettyCash(c){
  if(!c)return;
  var p=g('p-pettycash');if(!p)return;
  var entries=c.pettyCash||[];
  var fundAmt=Number(c.pettyCashFund||0);

  // Running balance
  var balance=fundAmt;
  var rows=entries.slice().sort(function(a,b){return(a.date||'').localeCompare(b.date||'');}).map(function(e,idx){
    var amt=Number(e.amt||0);
    if(e.type==='replenishment')balance+=amt;
    else balance-=amt;
    var runBal=balance;
    var oi=entries.indexOf(e);
    return'<tr>'
      +'<td style="color:var(--muted);font-size:11px">'+(e.date||'—')+'</td>'
      +'<td>'+escHtml(e.desc||'—')+'</td>'
      +'<td style="font-size:11px;color:var(--muted)">'+escHtml(e.cat||'—')+'</td>'
      +'<td><span class="badge '+(e.type==='replenishment'?'b-green':'b-amber')+'">'+
        (e.type==='replenishment'?'Replenishment':'Disbursement')+'</span></td>'
      +'<td class="right" style="color:'+(e.type==='replenishment'?'var(--green)':'var(--red)')+'">'+
        (e.type==='replenishment'?'+':'-')+fmt(amt)+'</td>'
      +'<td class="right" style="font-weight:600;color:'+(runBal<0?'var(--red)':'var(--text)')+'">'+fmt(runBal)+'</td>'
      +'<td><div class="row-acts">'
      +'<button class="d-btn" onclick="deletePettyCashEntry('+oi+')">&#215;</button>'
      +'</div></td>'
      +'</tr>';
  });

  // Reset running balance for display (rows mutated it)
  var totalDisb=entries.filter(function(e){return e.type!=='replenishment';}).reduce(function(s,e){return s+Number(e.amt||0);},0);
  var totalRepl=entries.filter(function(e){return e.type==='replenishment';}).reduce(function(s,e){return s+Number(e.amt||0);},0);
  var currentBal=fundAmt+totalRepl-totalDisb;

  var summaryHtml='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem;margin-bottom:1rem">'
    +'<div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:.75rem 1rem;text-align:center">'
    +'<div style="font-size:11px;color:var(--muted);margin-bottom:4px">Fund size</div>'
    +'<div style="font-size:17px;font-weight:700">'+fmt(fundAmt)+'</div>'
    +'<button onclick="editPettyCashFund()" style="font-size:10px;color:var(--muted);background:none;border:none;cursor:pointer;margin-top:2px">Edit</button>'
    +'</div>'
    +'<div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:.75rem 1rem;text-align:center">'
    +'<div style="font-size:11px;color:var(--muted);margin-bottom:4px">Disbursed</div>'
    +'<div style="font-size:17px;font-weight:700;color:var(--red)">'+fmt(totalDisb)+'</div>'
    +'</div>'
    +'<div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:.75rem 1rem;text-align:center">'
    +'<div style="font-size:11px;color:var(--muted);margin-bottom:4px">Replenished</div>'
    +'<div style="font-size:17px;font-weight:700;color:var(--green)">'+fmt(totalRepl)+'</div>'
    +'</div>'
    +'<div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:.75rem 1rem;text-align:center">'
    +'<div style="font-size:11px;color:var(--muted);margin-bottom:4px">Current balance</div>'
    +'<div style="font-size:17px;font-weight:700;color:'+(currentBal<fundAmt*0.2?'var(--red)':currentBal<fundAmt*0.5?'var(--amber)':'var(--green)')+'">'+fmt(currentBal)+'</div>'
    +'</div>'
    +'</div>';

  var modal='<div class="overlay" id="m-pettycash"><div class="modal" style="max-width:460px">'
    +'<button class="cx" onclick="closeM(&apos;m-pettycash&apos;)">&#215;</button>'
    +'<div class="m-title" id="m-pc-title">Log petty cash entry</div>'
    +'<div class="fl"><label>Type</label>'
    +'<select id="pc-type" onchange="document.getElementById(&apos;pc-cat-row&apos;).style.display=this.value===&apos;replenishment&apos;?&apos;none&apos;:&apos;&apos;">'
    +'<option value="disbursement">Disbursement (cash out)</option>'
    +'<option value="replenishment">Replenishment (cash in)</option>'
    +'</select></div>'
    +'<div class="fr"><div><label>Date</label><input type="text" id="pc-date" placeholder="MM/DD/YYYY" onblur="autoDate(this)" oninput="autoDate(this)"></div>'
    +'<div><label>Amount ($)</label><input type="number" id="pc-amt" placeholder="0.00" oninput="fmtAmt(this)"></div></div>'
    +'<div class="fl"><label>Description</label><input type="text" id="pc-desc" placeholder="e.g. Office supplies, postage"></div>'
    +'<div class="fl" id="pc-cat-row"><label>Category</label><input type="text" id="pc-cat" placeholder="e.g. Office Supplies"></div>'
    +'<button class="sv-btn" onclick="savePettyCash()">Save entry</button>'
    +'</div></div>';

  p.innerHTML=FB()+XB()
    +'<div class="xbar" style="margin-bottom:.75rem">'
    +'<span style="font-weight:700;font-size:15px">Petty Cash</span>'
    +'<button class="xbtn p" onclick="PC_EI=-1;resetPCForm();openM(&apos;m-pettycash&apos;)">+ Log entry</button>'
    +'</div>'
    +summaryHtml
    +'<div class="card"><div class="c-head"><span class="c-title">Transaction log</span></div>'
    +(rows.length
      ?'<table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th class="right">Amount</th><th class="right">Balance</th><th></th></tr></thead><tbody>'+rows.join('')+'</tbody></table>'
      :ES('No petty cash entries yet','Log disbursements when cash is spent and replenishments when the fund is refilled.',"PC_EI=-1;resetPCForm();openM(&apos;m-pettycash&apos;)"))
    +'</div>'
    +modal;
}

function resetPCForm(){
  var d=g('pc-date');if(d)d.value=todayNum();
  var a=g('pc-amt');if(a)a.value='';
  var ds=g('pc-desc');if(ds)ds.value='';
  var ct=g('pc-cat');if(ct)ct.value='';
  var t=g('pc-type');if(t)t.value='disbursement';
  var cr=g('pc-cat-row');if(cr)cr.style.display='';
  var ti=g('m-pc-title');if(ti)ti.textContent='Log petty cash entry';
}

function savePettyCash(){
  var c=gc();if(!c.pettyCash)c.pettyCash=[];
  // PERIOD LOCK GUARD
  var _pcDate=g('pc-date')&&g('pc-date').value.trim();
  if(_pcDate&&isDateLocked(c,_pcDate)){periodLockAlert(c.closedThrough);return;}
  var amt=Number(g('pc-amt')&&g('pc-amt').value||0);
  if(!amt||amt<=0){alert('Please enter an amount greater than zero.');return;}
  var type=g('pc-type')&&g('pc-type').value||'disbursement';
  var desc=sanitizeInput(g('pc-desc')&&g('pc-desc').value.trim()||'');
  if(!desc){alert('Please enter a description.');return;}
  var item={
    id:uid(),date:_pcDate||todayNum(),type:type,amt:amt,
    desc:desc,cat:g('pc-cat')&&g('pc-cat').value.trim()||'',
    createdAt:new Date().toISOString()
  };
  c.pettyCash.push(item);
  // Mirror disbursements to expenses for P&L reporting
  if(type==='disbursement'){
    if(!c.expenses)c.expenses=[];
    var expId=uid();
    var expItem={id:expId,desc:'Petty cash: '+desc,cat:item.cat||'Petty Cash',
      amt:amt,date:item.date,acctCode:'5210',recurring:'None',
      freq:'One-time',fixed:'Variable',reconciled:false,pettyCashId:item.id,
      audit:[{action:'created',at:item.createdAt}]};
    c.expenses.push(expItem);
    postToLedger(c,'5210',_defaultCashCode(c),amt,'Petty cash: '+desc,'expense',expId);
  }
  markDirty('reports');
  sv();renderPettyCash(c);closeM('m-pettycash');resetPCForm();
}

function deletePettyCashEntry(i){
  var c=gc();if(!c.pettyCash||!c.pettyCash[i])return;
  if(!confirm('Delete this petty cash entry? Any linked expense will remain.'))return;
  c.pettyCash.splice(i,1);sv();renderPettyCash(c);
}

function editPettyCashFund(){
  var c=gc();if(!c)return;
  var cur=c.pettyCashFund||0;
  var val=prompt('Set petty cash fund size (the total amount replenished to the fund):',''+cur);
  if(val===null)return;
  var n=Number(val);
  if(isNaN(n)||n<0){alert('Please enter a valid amount.');return;}
  c.pettyCashFund=n;sv();renderPettyCash(c);
}

// ══════════════════════════════════════════
// OPENING BALANCES WORKFLOW
// ══════════════════════════════════════════
// renderOpeningBalances(c): a single guided screen to enter start-of-books balances.
// Covers: bank accounts, AR, AP, loans, equity. Writes to c.balanceSheet and c.bankAccounts.
function renderOpeningBalances(c){
  if(!c)return;
  var p=g('p-openingbal');if(!p)return;

  var bs=c.balanceSheet||{assets:[],liabilities:[],equity:[]};
  var banks=c.bankAccounts||[];
  var loans=c.loans||[];

  function fmtOB(n){return n?'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';}

  // ── Bank / cash accounts ────────────────────────────────────────────────
  var bankRows=banks.map(function(b,i){
    return'<tr>'
      +'<td style="font-weight:500">'+escHtml(b.name||'—')+'</td>'
      +'<td style="color:var(--muted);font-size:11px">'+escHtml(b.type||'—')+'</td>'
      +'<td class="right">'+fmtOB(b.openingBalance)+'</td>'
      +'<td><input type="number" placeholder="0.00" value="'+(b.openingBalance||'')+'" '
      +'oninput="saveOBBank('+i+',this.value)" style="width:110px;font-size:12px;padding:4px 6px;border:1px solid var(--border);border-radius:4px"></td>'
      +'</tr>';
  }).join('');

  // ── Balance sheet items ─────────────────────────────────────────────────
  function bsSection(title, items, sec, acctHint){
    var rows=items.map(function(item,i){
      var val=sec==='assets'?Number(item.openingBalance||0):Number(item.amt||0);
      return'<tr>'
        +'<td style="font-weight:500">'+escHtml(item.name||'—')+'</td>'
        +'<td class="right">'+fmtOB(val)+'</td>'
        +'<td><input type="number" placeholder="0.00" value="'+(val||'')+'" '
        +'oninput="saveOBBSItem(&quot;'+sec+'&quot;,'+i+',this.value)" style="width:110px;font-size:12px;padding:4px 6px;border:1px solid var(--border);border-radius:4px"></td>'
        +'</tr>';
    }).join('');
    return'<div class="card" style="margin-bottom:1rem"><div class="c-head"><span class="c-title">'+title+'</span>'
      +(acctHint?'<span style="font-size:11px;color:var(--muted)">'+acctHint+'</span>':'')
      +'</div>'
      +(rows
        ?'<table><thead><tr><th>Account</th><th class="right">Current</th><th>New opening balance</th></tr></thead><tbody>'+rows+'</tbody></table>'
        :'<div style="padding:.75rem 1rem;font-size:13px;color:var(--muted)">No '+title.toLowerCase()+' defined yet. Add them in the Balance Sheet tab first.</div>')
      +'</div>';
  }

  // ── Loans / liabilities ─────────────────────────────────────────────────
  var loanRows=loans.map(function(l,i){
    return'<tr>'
      +'<td style="font-weight:500">'+escHtml(l.name||'—')+'</td>'
      +'<td class="right">'+fmtOB(l.openingBalance)+'</td>'
      +'<td><input type="number" placeholder="0.00" value="'+(l.openingBalance||'')+'" '
      +'oninput="saveOBLoan('+i+',this.value)" style="width:110px;font-size:12px;padding:4px 6px;border:1px solid var(--border);border-radius:4px"></td>'
      +'</tr>';
  }).join('');
  var loanCard='<div class="card" style="margin-bottom:1rem"><div class="c-head"><span class="c-title">Loans & notes payable</span></div>'
    +(loanRows
      ?'<table><thead><tr><th>Loan</th><th class="right">Current</th><th>Opening balance (principal remaining)</th></tr></thead><tbody>'+loanRows+'</tbody></table>'
      :'<div style="padding:.75rem 1rem;font-size:13px;color:var(--muted)">No loans defined yet. Add them in the A/P & Loans section first.</div>')
    +'</div>';

  var noteHtml='<div style="background:#e8f5e9;border:1px solid #43a047;border-radius:8px;padding:.75rem 1rem;margin-bottom:1rem;font-size:12px;color:#2e7d32;line-height:1.6">'
    +'<strong>How this works:</strong> Enter the balances as of your bookkeeping start date. '
    +'Bank account opening balances flow into reconciliation. Balance sheet items set the starting point for equity calculations. '
    +'These values are used for reporting but do not create ledger entries — they represent your books on day one.'
    +'</div>';


  // Equity opening balance card
  var eqAccts=(c.accounts||[]).filter(function(a){return(a.type||'').toLowerCase()==='equity'&&a.active!==false;});
  var eqObMap=c.equityOpeningBalances||{};
  var eqRows=eqAccts.map(function(a){
    var cur=Number(eqObMap[a.code]||0);
    return'<tr>'
      +'<td style="font-weight:500">'+escHtml(a.name)+'</td>'
      +'<td style="color:var(--muted);font-size:11px">'+escHtml(a.code)+'</td>'
      +'<td class="right">'+fmtOB(cur)+'</td>'
      +'<td><input type="number" placeholder="0.00" value="'+(cur||'')+'" '
      +'oninput="saveOBEquity(\''+a.code+'\',this.value)" style="width:110px;font-size:12px;padding:4px 6px;border:1px solid var(--border);border-radius:4px"></td>'
      +'</tr>';
  }).join('');
  var equityObCard='<div class="card" style="margin-bottom:1rem;border-left:3px solid var(--blue)">'
    +'<div class="c-head"><span class="c-title">Beginning equity / retained earnings</span>'
    +'<span style="font-size:11px;color:var(--muted)">Posts a ledger entry so the balance sheet opens correctly</span></div>'
    +(eqAccts.length
      ?'<table><thead><tr><th>Account</th><th>Code</th><th class="right">Current OB</th><th>Set opening balance</th></tr></thead><tbody>'+eqRows+'</tbody></table>'
      +'<div style="padding:.5rem 1rem .75rem;font-size:12px;color:var(--muted)">Each change immediately posts (or replaces) a beginning-balance ledger entry so the trial balance starts correctly.</div>'
      :'<div style="padding:.75rem 1rem;font-size:13px;color:var(--muted)">No equity accounts in Chart of Accounts. Add them in the COA tab (type = Equity).</div>')
    +'</div>';
  p.innerHTML=FB()+XB()
    +'<div class="xbar" style="margin-bottom:.75rem"><span style="font-weight:700;font-size:15px">Opening Balances</span></div>'
    +noteHtml
    +(banks.length?'<div class="card" style="margin-bottom:1rem"><div class="c-head"><span class="c-title">Bank & cash accounts</span></div>'
      +'<table><thead><tr><th>Account</th><th>Type</th><th class="right">Current</th><th>Opening balance</th></tr></thead><tbody>'
      +bankRows+'</tbody></table></div>'
      :'<div class="card" style="margin-bottom:1rem"><div style="padding:.75rem 1rem;font-size:13px;color:var(--muted)">No bank accounts defined yet. Add them via the Reconciliation tab.</div></div>')
    +bsSection('Accounts receivable / other assets', bs.assets||[], 'assets','Opening balance = amount owed to you on start date')
    +bsSection('Accounts payable / other liabilities', bs.liabilities||[], 'liabilities','Opening balance = amount you owed on start date')
    +bsSection('Equity', bs.equity||[], 'equity','e.g. Owner equity, retained earnings')
    +loanCard
    +equityObCard;
}

// Inline save handlers — called oninput, autosave immediately
function saveOBBank(i,val){
  var c=gc();if(!c||!c.bankAccounts||!c.bankAccounts[i])return;
  c.bankAccounts[i].openingBalance=Number(val)||0;
  sv();
}
function saveOBBSItem(sec,i,val){
  var c=gc();if(!c||!c.balanceSheet||!c.balanceSheet[sec]||!c.balanceSheet[sec][i])return;
  var item=c.balanceSheet[sec][i];
  if(sec==='assets')item.openingBalance=Number(val)||0;
  else item.amt=Number(val)||0;
  sv();
}
function saveOBLoan(i,val){
  var c=gc();if(!c||!c.loans||!c.loans[i])return;
  c.loans[i].openingBalance=Number(val)||0;
  sv();
}
// saveOBEquity: sets equity opening balance for one account code.
// Voids any prior opening-equity ledger entry for that code, then posts a fresh one.
// Debit side: 3999 Opening Balance Equity (a clearing account).
// Credit side: the equity account code specified.
// Net effect: equity account carries a beginning balance visible in the trial balance.
function saveOBEquity(code,val){
  var c=gc();if(!c||!code)return;
  if(!c.equityOpeningBalances)c.equityOpeningBalances={};
  var amt=Number(val)||0;
  // Void previous OB ledger entry for this account if any
  var prevId=c.equityOpeningBalances['_le_'+code];
  if(prevId)voidLedgerEntry(c,prevId);
  c.equityOpeningBalances[code]=amt;
  if(amt!==0){
    // Post: Dr 3999 Opening Balance Equity / Cr equity account (for credit-normal equity)
    // If user enters a positive number it means the equity account has a credit balance (normal).
    // We debit the clearing account and credit the equity account.
    var sourceId='ob-eq-'+code+'-'+Date.now();
    var le=postToLedger(c,'3999',code,Math.abs(amt),'Opening balance: '+code,'opening-equity',sourceId);
    c.equityOpeningBalances['_le_'+code]=sourceId;
  }else{
    delete c.equityOpeningBalances['_le_'+code];
  }
  markDirty('openingbal');
  sv();
}

// ══════════════════════════════════════════
// VENDOR MASTER (Phase 3-A)
// ══════════════════════════════════════════
// Schema: c.vendors[]: {id, name, tin, is1099, defaultCat, defaultAcctCode, phone, email, address, notes}
var VENDOR_EI=-1;
function renderVendors(c){
  if(!c)return;
  var p=g('p-vendors');if(!p)return;
  var vendors=c.vendors||[];
  var rows=vendors.map(function(v,i){
    return'<tr>'
      +'<td style="font-weight:500">'+escHtml(v.name||'—')+'</td>'
      +'<td style="font-size:11px;color:var(--muted)">'+escHtml(v.defaultCat||'—')+'</td>'
      +'<td style="font-size:11px">'+(v.is1099?'<span class="badge b-amber">1099</span>':'—')+'</td>'
      +'<td style="font-size:11px;color:var(--muted)">'+escHtml(v.email||'—')+'</td>'
      +'<td style="font-size:11px;color:var(--muted)">'+escHtml(v.phone||'—')+'</td>'
      +'<td><div class="row-acts">'
      +'<button class="e-btn" onclick="editVendor('+i+')">&#9998;</button>'
      +'<button class="d-btn" onclick="deleteVendor('+i+')">&#215;</button>'
      +'</div></td>'
      +'</tr>';
  }).join('');

  p.innerHTML=FB()+XB()
    +'<div class="xbar" style="margin-bottom:.75rem"><button class="xbtn p" onclick="VENDOR_EI=-1;resetVendorForm();openM(&apos;m-vendor&apos;)">+ Add vendor</button></div>'
    +'<div class="card"><div class="c-head"><span class="c-title">Vendors</span>'
    +'<span style="font-size:11px;color:var(--muted)">Pre-fill expense entries and track 1099 contractors</span></div>'
    +(rows
      ?'<table><thead><tr><th>Name</th><th>Default category</th><th>1099</th><th>Email</th><th>Phone</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>'
      :ES('No vendors yet','Add vendors to pre-fill expense entries and track 1099 contractors.',"VENDOR_EI=-1;resetVendorForm();openM(&apos;m-vendor&apos;)"))
    +'</div>'
    +'<div class="overlay" id="m-vendor"><div class="modal" style="max-width:480px">'
    +'<button class="cx" onclick="closeM(&apos;m-vendor&apos;)">&#215;</button>'
    +'<div class="m-title" id="m-vendor-title">Add vendor</div>'
    +'<div class="fl"><label>Vendor name *</label><input type="text" id="vnd-name" placeholder="e.g. Staples, John Smith Consulting"></div>'
    +'<div class="fr"><div><label>Default expense category</label><input type="text" id="vnd-cat" placeholder="e.g. Office Supplies"></div>'
    +'<div><label>Default account code</label><input type="text" id="vnd-acct" placeholder="e.g. 5210"></div></div>'
    +'<div class="fr"><div><label>1099 vendor?</label><select id="vnd-1099"><option value="no">No</option><option value="yes">Yes — report payments</option></select></div>'
    +'<div><label>TIN / EIN</label><input type="text" id="vnd-tin" placeholder="XX-XXXXXXX"></div></div>'
    +'<div class="fr"><div><label>Email</label><input type="email" id="vnd-email" placeholder="vendor@example.com"></div>'
    +'<div><label>Phone</label><input type="text" id="vnd-phone" placeholder="(555) 000-0000"></div></div>'
    +'<div class="fl"><label>Address</label><input type="text" id="vnd-addr" placeholder="123 Main St, City, ST 00000"></div>'
    +'<div class="fl"><label>Notes</label><input type="text" id="vnd-notes" placeholder="Payment terms, contact info, etc."></div>'
    +'<button class="sv-btn" onclick="saveVendor()">Save vendor</button>'
    +'</div></div>';
}
// ══════════════════════════════════════════════════════════════════════════════
// REPORT PACKAGES UI
// ══════════════════════════════════════════════════════════════════════════════
var _PKG_EI=-1;
var _PKG_DATE_MODE='lastmonth';
var _PKG_CUSTOM_START='';
var _PKG_CUSTOM_END='';

// ══════════════════════════════════════════════════════════════════════════════
// REPORT PACKAGE CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════
var PACKAGE_REPORTS=[
  {id:'executive',  label:'Executive Summary',      types:['np','sb','pe']},
  {id:'pl',         label:'P&L',                    types:['np','sb','pe']},
  {id:'plcompare',  label:'Year-over-Year P&L',     types:['np','sb','pe']},
  {id:'bsheet',     label:'Balance Sheet',           types:['np','sb']},
  {id:'functional', label:'Functional Expenses (990)',types:['np']},
  {id:'fundpl',     label:'Fund P&L',               types:['np']},
  {id:'budgetbyfund',label:'Budget vs Actual by Fund',types:['np']},
  {id:'grants',     label:'Grant Summary',           types:['np']},
  {id:'donors',     label:'Donor Report (LYBUNT)',   types:['np']},
  {id:'budget',     label:'Budget vs Actual',        types:['np','sb','pe']},
  {id:'budgetexport',label:'Budget Summary',         types:['np','sb','pe']},
  {id:'category',   label:'Category Breakdown',      types:['np','sb','pe']},
  {id:'expdetail',  label:'Expense Detail',          types:['np','sb','pe']},
  {id:'incdetail',  label:'Income/Revenue Detail',   types:['np','sb','pe']},
  {id:'vendor',     label:'Vendor Summary',          types:['np','sb','pe']},
  {id:'1099',       label:'1099 Contractors',        types:['np','sb','pe']},
  {id:'projpl',     label:'Project P&L',             types:['np','sb']},
  {id:'cashflow',   label:'Cash Flow',               types:['sb']},
  {id:'assets',     label:'Fixed Assets & Depreciation',types:['np','sb','pe']},
  {id:'loans',      label:'Loan Amortization',       types:['np','sb','pe']}
];

var DATE_RANGE_MODES=[
  {id:'fiscal',      label:'Current fiscal year'},
  {id:'thismonth',   label:'This month'},
  {id:'lastmonth',   label:'Last month'},
  {id:'thisquarter', label:'This quarter'},
  {id:'lastquarter', label:'Last quarter'},
  {id:'custom',      label:'Custom date range'}
];

function openPackagesPanel(){
  var c=gc();if(!c)return;
  var old=g('m-packages');if(old)old.parentNode.removeChild(old);
  if(!c.reportPackages)c.reportPackages=[];
  var pkgs=c.reportPackages;

  var pkgRows=pkgs.map(function(pkg,i){
    var rptLabels=(pkg.reports||[]).map(function(rid){
      var r=PACKAGE_REPORTS.find(function(x){return x.id===rid;});
      return r?r.label:rid;
    }).join(', ');
    return'<tr>'
      +'<td style="font-weight:500">'+escHtml(pkg.name||'Unnamed')+'</td>'
      +'<td style="font-size:11px;color:var(--muted)">'+escHtml(rptLabels||'—')+'</td>'
      +'<td style="font-size:11px;color:var(--muted)">'+escHtml(pkg.dateMode||'fiscal')+'</td>'
      +'<td><div class="row-acts">'
      +'<button class="sv-btn" style="font-size:10px;padding:3px 10px" onclick="runPackage('+i+')">&#128202; Run</button>'
      +'<button class="e-btn" onclick="editPackage('+i+')" title="Edit">&#9998;</button>'
      +'<button class="d-btn" onclick="deletePackage('+i+')" title="Delete">&#215;</button>'
      +'</div></td>'
      +'</tr>';
  }).join('');

  // Available reports for this client type
  var available=(typeof PACKAGE_REPORTS!=='undefined'?PACKAGE_REPORTS:[]).filter(function(r){return r.types.indexOf(c.type)>=0;});
  var rptChecks=available.map(function(r){
    return'<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;margin-bottom:4px">'
      +'<input type="checkbox" class="pkg-rpt-chk" value="'+r.id+'" style="width:14px;height:14px"> '+r.label+'</label>';
  }).join('');

  var dateOpts=(typeof DATE_RANGE_MODES!=='undefined'?DATE_RANGE_MODES:[]).map(function(m){
    return'<option value="'+m.id+'">'+m.label+'</option>';
  }).join('');

  var html='<div id="m-packages" class="overlay" style="z-index:10000"><div class="modal" style="max-width:600px;max-height:85vh;overflow-y:auto">'
    +'<button class="cx" onclick="var m=g(\'m-packages\');if(m)m.parentNode.removeChild(m)">&#215;</button>'
    +'<div class="m-title">&#128202; Report Packages</div>'
    // Saved packages
    +(pkgs.length
      ?'<div style="margin-bottom:1.5rem"><div style="font-size:12px;font-weight:600;margin-bottom:.5rem">Saved packages</div>'
        +'<table><thead><tr><th>Name</th><th>Reports</th><th>Date mode</th><th></th></tr></thead><tbody>'+pkgRows+'</tbody></table>'
        +'</div>'
      :'<div style="font-size:12px;color:var(--muted);margin-bottom:1.5rem">No packages yet. Create one below.</div>')
    // Create / edit form
    +'<div style="background:var(--soft);border-radius:10px;padding:1rem">'
    +'<div style="font-size:12px;font-weight:600;margin-bottom:.75rem" id="pkg-form-title">Create new package</div>'
    +'<div class="fl"><label>Package name *</label><input type="text" id="pkg-name" placeholder="e.g. Monthly Board Packet"></div>'
    // Report selection
    +'<div style="font-size:12px;color:var(--muted);margin-bottom:.4rem">Reports to include:</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;margin-bottom:.75rem">'+rptChecks+'</div>'
    // Date range
    +'<div class="fr"><div><label style="font-size:12px">Date range</label>'
    +'<select id="pkg-date-mode" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:12px;background:var(--surface);color:var(--text)" onchange="togglePkgCustomDates(this.value)">'+dateOpts+'</select></div>'
    +'<div id="pkg-custom-dates" style="display:none"><label style="font-size:12px">Start date</label>'
    +'<input type="text" id="pkg-start" placeholder="MM/DD/YYYY" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:12px;background:var(--surface);color:var(--text);box-sizing:border-box"></div>'
    +'<div id="pkg-custom-dates2" style="display:none"><label style="font-size:12px">End date</label>'
    +'<input type="text" id="pkg-end" placeholder="MM/DD/YYYY" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:12px;background:var(--surface);color:var(--text);box-sizing:border-box"></div>'
    +'</div>'
    +'<div style="display:flex;gap:8px;margin-top:.75rem">'
    +'<button class="sv-btn" style="flex:1" onclick="savePackage()">Save package</button>'
    +'<button class="add-btn" style="flex:1" onclick="saveAndRunPackage()">&#128202; Save &amp; run now</button>'
    +'<button class="add-btn" onclick="_PKG_EI=-1;resetPackageForm()" style="font-size:12px">Clear</button>'
    +'</div></div>'
    +'</div></div>';

  document.body.insertAdjacentHTML('beforeend',html);
  g('m-packages').classList.add('open');
  setTimeout(function(){var m=g('m-packages');if(m)m.querySelector('.cx').focus();},50);
}

function togglePkgCustomDates(val){
  var show=val==='custom';
  var d1=g('pkg-custom-dates'),d2=g('pkg-custom-dates2');
  if(d1)d1.style.display=show?'block':'none';
  if(d2)d2.style.display=show?'block':'none';
}

function resetPackageForm(){
  _PKG_EI=-1;
  var n=g('pkg-name');if(n)n.value='';
  document.querySelectorAll('.pkg-rpt-chk').forEach(function(cb){cb.checked=false;});
  var dm=g('pkg-date-mode');if(dm)dm.value='lastmonth';
  togglePkgCustomDates('lastmonth');
  var ft=g('pkg-form-title');if(ft)ft.textContent='Create new package';
}

function _getPackageFormData(){
  var name=(g('pkg-name')&&g('pkg-name').value.trim())||'';
  if(!name){alert('Please enter a package name.');return null;}
  var reports=[];
  document.querySelectorAll('.pkg-rpt-chk:checked').forEach(function(cb){reports.push(cb.value);});
  if(!reports.length){alert('Please select at least one report.');return null;}
  var dateMode=g('pkg-date-mode')&&g('pkg-date-mode').value||'lastmonth';
  var customStart=g('pkg-start')&&g('pkg-start').value.trim()||'';
  var customEnd=g('pkg-end')&&g('pkg-end').value.trim()||'';
  if(dateMode==='custom'&&(!customStart||!customEnd)){alert('Please enter start and end dates for the custom range.');return null;}
  return{name:name,reports:reports,dateMode:dateMode,customStart:customStart,customEnd:customEnd};
}

function savePackage(){
  var c=gc();if(!c)return;
  var data=_getPackageFormData();if(!data)return;
  if(!c.reportPackages)c.reportPackages=[];
  if(_PKG_EI>=0){
    c.reportPackages[_PKG_EI]=Object.assign(c.reportPackages[_PKG_EI],data);
  }else{
    c.reportPackages.push(Object.assign({id:uid()},data));
  }
  sv();
  var m=g('m-packages');if(m)m.parentNode.removeChild(m);
  setTimeout(openPackagesPanel,50);
}

function saveAndRunPackage(){
  var c=gc();if(!c)return;
  var data=_getPackageFormData();if(!data)return;
  if(!c.reportPackages)c.reportPackages=[];
  var pkg;
  if(_PKG_EI>=0){c.reportPackages[_PKG_EI]=Object.assign(c.reportPackages[_PKG_EI],data);pkg=c.reportPackages[_PKG_EI];}
  else{pkg=Object.assign({id:uid()},data);c.reportPackages.push(pkg);}
  sv();
  var m=g('m-packages');if(m)m.parentNode.removeChild(m);
  openPackagePDF(pkg.id,data.dateMode,data.customStart,data.customEnd);
}

function runPackage(i){
  var c=gc();if(!c||!c.reportPackages||!c.reportPackages[i])return;
  var pkg=c.reportPackages[i];
  // If custom, use saved dates; otherwise use saved mode
  openPackagePDF(pkg.id,pkg.dateMode,pkg.customStart,pkg.customEnd);
}

function editPackage(i){
  var c=gc();if(!c||!c.reportPackages||!c.reportPackages[i])return;
  _PKG_EI=i;var pkg=c.reportPackages[i];
  var n=g('pkg-name');if(n)n.value=pkg.name||'';
  document.querySelectorAll('.pkg-rpt-chk').forEach(function(cb){
    cb.checked=(pkg.reports||[]).indexOf(cb.value)>=0;
  });
  var dm=g('pkg-date-mode');if(dm)dm.value=pkg.dateMode||'lastmonth';
  togglePkgCustomDates(pkg.dateMode||'lastmonth');
  if(g('pkg-start'))g('pkg-start').value=pkg.customStart||'';
  if(g('pkg-end'))g('pkg-end').value=pkg.customEnd||'';
  var ft=g('pkg-form-title');if(ft)ft.textContent='Edit package';
}

function deletePackage(i){
  var c=gc();if(!c||!c.reportPackages||!c.reportPackages[i])return;
  if(!confirm('Delete package "'+c.reportPackages[i].name+'"?'))return;
  c.reportPackages.splice(i,1);
  sv();
  var m=g('m-packages');if(m)m.parentNode.removeChild(m);
  setTimeout(openPackagesPanel,50);
}

// ══════════════════════════════════════════════════════════════════════════════
// FLAGGED TRANSACTIONS PANEL
// ══════════════════════════════════════════════════════════════════════════════
function renderFlaggedTransactions(c){
  if(!c)return;
  var p=g('p-flagged');if(!p)return;
  var flagged=[];
  (c.expenses||[]).forEach(function(e,i){if(e.flagged&&!e.deleted&&!e.voided)flagged.push({item:e,type:'expenses',idx:i,desc:e.desc,amt:e.amt,date:e.date});});
  var incArr=c.type==='sb'?(c.revenue||[]):(c.income||[]);
  var incType=c.type==='sb'?'revenue':'income';
  incArr.forEach(function(r,i){if(r.flagged&&!r.deleted)flagged.push({item:r,type:incType,idx:i,desc:r.name||r.desc,amt:r.amt||r.recv||r.act,date:r.date});});
  flagged.sort(function(a,b){return(a.item.flagSeverity==='red'?0:1)-(b.item.flagSeverity==='red'?0:1);});

  var rows=flagged.map(function(f){
    var sevColor=f.item.flagSeverity==='red'?'var(--red)':'var(--amber)';
    var sevIcon=f.item.flagSeverity==='red'?'&#x1F6A9;':'&#x26A0;';
    return'<tr>'
      +'<td style="text-align:center;font-size:15px">'+sevIcon+'</td>'
      +'<td style="font-weight:500">'+escHtml(f.desc||'—')+'</td>'
      +'<td>'+fmt(f.amt||0)+'</td>'
      +'<td style="font-size:11px;color:var(--muted)">'+(f.date||'—')+'</td>'
      +'<td style="font-size:11px;color:'+sevColor+';max-width:220px">'+escHtml(f.item.flagReason||'')+'</td>'
      +'<td><button class="add-btn" style="font-size:10px;padding:2px 8px" onclick="dismissFlag(\''+f.type+'\',\''+f.item.id+'\')">Dismiss</button></td>'
      +'</tr>';
  }).join('');

  var customTerms=(c.flagTerms||[]);
  var customRows=customTerms.map(function(t,i){
    return'<tr>'
      +'<td>'+escHtml(t.term)+'</td>'
      +'<td><span class="badge '+(t.severity==='red'?'b-red':'b-amber')+'">'+t.severity+'</span></td>'
      +'<td style="font-size:11px;color:var(--muted)">'+escHtml(t.reason||'')+'</td>'
      +'<td><button class="d-btn" onclick="deleteFlagTerm('+i+')">&#215;</button></td>'
      +'</tr>';
  }).join('');

  var threshold=Number(c.flagThreshold||9999);

  p.innerHTML=FB()+XB()
    +'<div class="xbar" style="margin-bottom:.75rem">'
    +'<button class="xbtn p" onclick="scanExistingForFlags()" title="Scan all existing expenses and income for suspicious activity">&#x1F50D; Scan existing transactions</button>'
    +'</div>'
    +'<div class="metrics">'
    +'<div class="metric"><div class="m-lbl">&#x1F6A9; High risk</div><div class="m-val" style="color:var(--red)">'+flagged.filter(function(f){return f.item.flagSeverity==='red';}).length+'</div></div>'
    +'<div class="metric"><div class="m-lbl">&#x26A0; Review</div><div class="m-val" style="color:var(--amber)">'+flagged.filter(function(f){return f.item.flagSeverity==='yellow';}).length+'</div></div>'
    +'<div class="metric"><div class="m-lbl">Total flagged</div><div class="m-val">'+flagged.length+'</div></div>'
    +'</div>'
    +'<div class="card">'
    +'<div class="c-head"><span class="c-title">&#x1F6A9; Flagged transactions</span>'
    +'<span style="font-size:11px;color:var(--muted)">Imported or entered transactions that matched suspicious activity rules</span></div>'
    +(flagged.length
      ?'<div style="overflow-x:auto"><table><thead><tr><th style="width:4%"></th><th>Description</th><th>Amount</th><th>Date</th><th>Reason</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>'
      :'<div style="font-size:13px;color:var(--muted);padding:1rem 0">No flagged transactions. Run a scan or import new data to check.</div>')
    +'</div>'
    +'<div class="card" style="margin-top:1rem">'
    +'<div class="c-head"><span class="c-title">&#x2699; Flag settings</span></div>'
    +'<div class="fr" style="margin-bottom:1rem"><div><label style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px">Reporting threshold ($)</label>'
    +'<input type="number" id="flag-threshold" value="'+threshold+'" style="padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;width:140px;background:var(--surface);color:var(--text)" onchange="saveFlagThreshold(this.value)">'
    +'<div style="font-size:11px;color:var(--muted);margin-top:4px">Transactions at or just under this amount are flagged for possible structuring.</div></div></div>'
    +'<div style="font-size:12px;font-weight:600;margin-bottom:.5rem">Custom flag terms</div>'
    +(customTerms.length
      ?'<table style="margin-bottom:.75rem"><thead><tr><th>Term</th><th>Severity</th><th>Reason</th><th></th></tr></thead><tbody>'+customRows+'</tbody></table>'
      :'<div style="font-size:12px;color:var(--muted);margin-bottom:.75rem">No custom terms yet.</div>')
    +'<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">'
    +'<div><label style="font-size:11px;color:var(--muted);display:block;margin-bottom:3px">Term</label><input type="text" id="flag-term-input" placeholder="e.g. personal account" style="padding:6px 10px;border:1px solid var(--border);border-radius:7px;font-size:12px;width:180px;background:var(--surface);color:var(--text)"></div>'
    +'<div><label style="font-size:11px;color:var(--muted);display:block;margin-bottom:3px">Severity</label><select id="flag-sev-input" style="padding:6px 10px;border:1px solid var(--border);border-radius:7px;font-size:12px;background:var(--surface);color:var(--text)"><option value="yellow">Yellow &#x2014; review</option><option value="red">Red &#x2014; high risk</option></select></div>'
    +'<div><label style="font-size:11px;color:var(--muted);display:block;margin-bottom:3px">Reason (optional)</label><input type="text" id="flag-reason-input" placeholder="e.g. Personal account on org statement" style="padding:6px 10px;border:1px solid var(--border);border-radius:7px;font-size:12px;width:240px;background:var(--surface);color:var(--text)"></div>'
    +'<button class="add-btn" style="font-size:12px;padding:6px 14px" onclick="addFlagTerm()">+ Add term</button>'
    +'</div></div>';
}

function scanExistingForFlags(){
  var c=gc();if(!c)return;
  var flagged=0;
  var desc,amt;
  // Scan expenses
  (c.expenses||[]).filter(function(e){return!e.deleted&&!e.voided&&!e.flagged;}).forEach(function(e){
    desc=e.vendor1099||e.desc||'';
    amt=Number(e.amt||0);
    var result=typeof checkSuspiciousActivity==='function'?checkSuspiciousActivity(c,e,desc,amt):null;
    if(result&&result.flagged){e.flagged=true;e.flagReason=result.flagReason;e.flagSeverity=result.flagSeverity;e.flaggedAt=new Date().toISOString();flagged++;}
  });
  // Scan income / revenue
  var incArr=c.type==='sb'?(c.revenue||[]):(c.income||[]);
  incArr.filter(function(r){return!r.deleted&&!r.voided&&!r.flagged;}).forEach(function(r){
    desc=r.name||r.desc||'';
    amt=Number(r.act||r.recv||r.amt||0);
    var result=typeof checkSuspiciousActivity==='function'?checkSuspiciousActivity(c,r,desc,amt):null;
    if(result&&result.flagged){r.flagged=true;r.flagReason=result.flagReason;r.flagSeverity=result.flagSeverity;r.flaggedAt=new Date().toISOString();flagged++;}
  });
  sv();
  renderFlaggedTransactions(c);
  alert(flagged>0?flagged+' transaction'+(flagged>1?'s were':' was')+' flagged. Review them in the list above.':'No new flags found — all existing transactions look clean.');
}

function saveFlagThreshold(val){
  var c=gc();if(!c)return;
  c.flagThreshold=Number(val)||9999;
  sv();
}

function addFlagTerm(){
  var c=gc();if(!c)return;
  var term=(g('flag-term-input')&&g('flag-term-input').value.trim()||'').toLowerCase();
  if(!term){alert('Please enter a term to flag.');return;}
  var sev=g('flag-sev-input')&&g('flag-sev-input').value||'yellow';
  var reason=g('flag-reason-input')&&g('flag-reason-input').value.trim()||'';
  if(!c.flagTerms)c.flagTerms=[];
  if(c.flagTerms.find(function(t){return t.term===term;})){alert('That term already exists.');return;}
  c.flagTerms.push({term:term,severity:sev,reason:reason||'Matched custom term: '+term});
  sv();renderFlaggedTransactions(c);
}

function deleteFlagTerm(i){
  var c=gc();if(!c||!c.flagTerms||!c.flagTerms[i])return;
  if(!confirm('Remove this flag term?'))return;
  c.flagTerms.splice(i,1);
  sv();renderFlaggedTransactions(c);
}

function dismissFlag(type,id){
  var c=gc();if(!c)return;
  var arr=type==='income'?(c.type==='sb'?c.revenue:c.income):type==='revenue'?c.revenue:c.expenses;
  var item=(arr||[]).find(function(x){return x.id===id;});
  if(!item)return;
  var note=prompt('Add a note for dismissing this flag (optional):');
  if(note===null)return;
  item.flagged=false;item.flagDismissed=true;item.flagDismissedAt=new Date().toISOString();item.flagDismissNote=note||'';
  (item.audit=item.audit||[]).push({field:'flag-dismissed',oldValue:item.flagReason||'',newValue:'Dismissed'+(note?' \u2014 '+note:''),timestamp:new Date().toISOString()});
  sv();
  if(typeof renderAll==='function')renderAll();
  renderFlaggedTransactions(c);
}

function resetVendorForm(){
  ['vnd-name','vnd-cat','vnd-acct','vnd-tin','vnd-email','vnd-phone','vnd-addr','vnd-notes'].forEach(function(id){var el=g(id);if(el)el.value='';});
  var s=g('vnd-1099');if(s)s.value='no';
  var t=g('m-vendor-title');if(t)t.textContent='Add vendor';
}
function saveVendor(){
  var c=gc();if(!c.vendors)c.vendors=[];
  var name=g('vnd-name')&&g('vnd-name').value.trim();if(!name){alert('Vendor name is required.');return;}
  var item={
    id:VENDOR_EI>=0?(c.vendors[VENDOR_EI].id||uid()):uid(),
    name:sanitizeInput(name),
    defaultCat:g('vnd-cat')&&g('vnd-cat').value.trim()||'',
    defaultAcctCode:g('vnd-acct')&&g('vnd-acct').value.trim()||'',
    is1099:g('vnd-1099')&&g('vnd-1099').value==='yes',
    tin:g('vnd-tin')&&g('vnd-tin').value.trim().replace(/[^0-9\-]/g,'')||'',
    email:g('vnd-email')&&g('vnd-email').value.trim()||'',
    phone:g('vnd-phone')&&g('vnd-phone').value.trim()||'',
    address:g('vnd-addr')&&g('vnd-addr').value.trim()||'',
    notes:g('vnd-notes')&&g('vnd-notes').value.trim()||''
  };
  if(VENDOR_EI>=0)c.vendors[VENDOR_EI]=item;
  else{
    if(c.vendors.find(function(v){return v.name.toLowerCase()===name.toLowerCase();})){alert('A vendor with that name already exists.');return;}
    c.vendors.push(item);
  }
  VENDOR_EI=-1;sv();renderVendors(c);closeM('m-vendor');resetVendorForm();
}
function editVendor(i){
  var c=gc();if(!c.vendors||!c.vendors[i])return;
  VENDOR_EI=i;var v=c.vendors[i];
  g('vnd-name').value=v.name||'';
  g('vnd-cat').value=v.defaultCat||'';
  g('vnd-acct').value=v.defaultAcctCode||'';
  if(g('vnd-1099'))g('vnd-1099').value=v.is1099?'yes':'no';
  g('vnd-tin').value=v.tin||'';
  g('vnd-email').value=v.email||'';
  g('vnd-phone').value=v.phone||'';
  g('vnd-addr').value=v.address||'';
  g('vnd-notes').value=v.notes||'';
  var t=g('m-vendor-title');if(t)t.textContent='Edit vendor';
  openM('m-vendor');
}
function deleteVendor(i){
  var c=gc();if(!c.vendors||!c.vendors[i])return;
  if(!confirm('Delete vendor "'+c.vendors[i].name+'"? This won\'t affect existing expense entries.'))return;
  c.vendors.splice(i,1);sv();renderVendors(c);
}
// Pre-fill expense modal from vendor selection
function onVendorSelect(sel){
  var c=gc();if(!c||!sel||!sel.value)return;
  var v=(c.vendors||[]).find(function(x){return x.id===sel.value;});
  if(!v)return;
  if(g('e-vendor'))g('e-vendor').value=v.name;
  if(g('e-tin'))g('e-tin').value=v.tin||'';
  if(g('e-1099')&&v.is1099)g('e-1099').value='yes';
  if(g('e-c')&&v.defaultCat)g('e-c').value=v.defaultCat;
  if(g('e-acct')&&v.defaultAcctCode)g('e-acct').value=v.defaultAcctCode;
}
// Build vendor dropdown HTML for expense modals
function vendorOpts(c){
  var opts='<option value="">— Select vendor (optional) —</option>';
  (c&&c.vendors||[]).sort(function(a,b){return a.name.localeCompare(b.name);}).forEach(function(v){
    opts+='<option value="'+v.id+'">'+escHtml(v.name)+(v.is1099?' <i class="fas fa-star"></i>':'')+'</option>';
  });
  return opts;
}

// ══════════════════════════════════════════
// CUSTOMER MASTER (Phase 3-B) — SB only
// ══════════════════════════════════════════
// Schema: c.customers[]: {id, name, email, phone, address, notes, defaultPaymentTerms}
var CUST_EI=-1;
function renderCustomers(c){
  if(!c)return;
  var p=g('p-customers');if(!p)return;
  var customers=c.customers||[];
  var rows=customers.map(function(cu,i){
    return'<tr>'
      +'<td style="font-weight:500">'+escHtml(cu.name||'—')+'</td>'
      +'<td style="font-size:11px;color:var(--muted)">'+escHtml(cu.email||'—')+'</td>'
      +'<td style="font-size:11px;color:var(--muted)">'+escHtml(cu.phone||'—')+'</td>'
      +'<td style="font-size:11px;color:var(--muted)">'+escHtml(cu.defaultPaymentTerms||'—')+'</td>'
      +'<td><div class="row-acts">'
      +'<button class="e-btn" onclick="editCustomer('+i+')">&#9998;</button>'
      +'<button class="d-btn" onclick="deleteCustomer('+i+')">&#215;</button>'
      +'</div></td>'
      +'</tr>';
  }).join('');

  p.innerHTML=FB()+XB()
    +'<div class="xbar" style="margin-bottom:.75rem"><button class="xbtn p" onclick="CUST_EI=-1;resetCustomerForm();openM(&apos;m-customer&apos;)">+ Add customer</button></div>'
    +'<div class="card"><div class="c-head"><span class="c-title">Customers</span>'
    +'<span style="font-size:11px;color:var(--muted)">Pre-fill invoice entries and track AR contacts</span></div>'
    +(rows
      ?'<table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Payment terms</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>'
      :ES('No customers yet','Add customers to pre-fill invoices and track accounts receivable contacts.',"CUST_EI=-1;resetCustomerForm();openM(&apos;m-customer&apos;)"))
    +'</div>'
    +'<div class="overlay" id="m-customer"><div class="modal" style="max-width:460px">'
    +'<button class="cx" onclick="closeM(&apos;m-customer&apos;)">&#215;</button>'
    +'<div class="m-title" id="m-customer-title">Add customer</div>'
    +'<div class="fl"><label>Customer name *</label><input type="text" id="cust-name" placeholder="e.g. Acme Corp"></div>'
    +'<div class="fr"><div><label>Email</label><input type="email" id="cust-email" placeholder="billing@acme.com"></div>'
    +'<div><label>Phone</label><input type="text" id="cust-phone" placeholder="(555) 000-0000"></div></div>'
    +'<div class="fl"><label>Address</label><input type="text" id="cust-addr" placeholder="123 Main St, City, ST 00000"></div>'
    +'<div class="fl"><label>Default payment terms</label><select id="cust-terms"><option value="Net 30">Net 30</option><option value="Net 15">Net 15</option><option value="Net 60">Net 60</option><option value="Due on receipt">Due on receipt</option><option value="Custom">Custom</option></select></div>'
    +'<div class="fl"><label>Notes</label><input type="text" id="cust-notes" placeholder="Billing contacts, special terms, etc."></div>'
    +'<button class="sv-btn" onclick="saveCustomer()">Save customer</button>'
    +'</div></div>';
}
function resetCustomerForm(){
  ['cust-name','cust-email','cust-phone','cust-addr','cust-notes'].forEach(function(id){var el=g(id);if(el)el.value='';});
  var s=g('cust-terms');if(s)s.value='Net 30';
  var t=g('m-customer-title');if(t)t.textContent='Add customer';
}
function saveCustomer(){
  var c=gc();if(!c.customers)c.customers=[];
  var name=g('cust-name')&&g('cust-name').value.trim();if(!name){alert('Customer name is required.');return;}
  var item={
    id:CUST_EI>=0?(c.customers[CUST_EI].id||uid()):uid(),
    name:sanitizeInput(name),
    email:g('cust-email')&&g('cust-email').value.trim()||'',
    phone:g('cust-phone')&&g('cust-phone').value.trim()||'',
    address:g('cust-addr')&&g('cust-addr').value.trim()||'',
    defaultPaymentTerms:g('cust-terms')&&g('cust-terms').value||'Net 30',
    notes:g('cust-notes')&&g('cust-notes').value.trim()||''
  };
  if(CUST_EI>=0)c.customers[CUST_EI]=item;
  else{
    if(c.customers.find(function(cu){return cu.name.toLowerCase()===name.toLowerCase();})){alert('A customer with that name already exists.');return;}
    c.customers.push(item);
  }
  CUST_EI=-1;sv();renderCustomers(c);closeM('m-customer');resetCustomerForm();
}
function editCustomer(i){
  var c=gc();if(!c.customers||!c.customers[i])return;
  CUST_EI=i;var cu=c.customers[i];
  g('cust-name').value=cu.name||'';
  g('cust-email').value=cu.email||'';
  g('cust-phone').value=cu.phone||'';
  g('cust-addr').value=cu.address||'';
  if(g('cust-terms'))g('cust-terms').value=cu.defaultPaymentTerms||'Net 30';
  g('cust-notes').value=cu.notes||'';
  var t=g('m-customer-title');if(t)t.textContent='Edit customer';
  openM('m-customer');
}
function deleteCustomer(i){
  var c=gc();if(!c.customers||!c.customers[i])return;
  if(!confirm('Delete customer "'+c.customers[i].name+'"? This won\'t affect existing invoices.'))return;
  c.customers.splice(i,1);sv();renderCustomers(c);
}
// Pre-fill invoice modal from customer selection
function onCustomerSelect(sel){
  var c=gc();if(!c||!sel||!sel.value)return;
  var cu=(c.customers||[]).find(function(x){return x.id===sel.value;});
  if(!cu)return;
  if(g('inv-client'))g('inv-client').value=cu.name;
}
// Build customer dropdown HTML for invoice modal
function customerOpts(c){
  var opts='<option value="">— Select customer (optional) —</option>';
  (c&&c.customers||[]).sort(function(a,b){return a.name.localeCompare(b.name);}).forEach(function(cu){
    opts+='<option value="'+cu.id+'">'+escHtml(cu.name)+'</option>';
  });
  return opts;
}

// ══════════════════════════════════════════
// BANK IMPORT RULE MANAGEMENT (Phase 3-C)
// ══════════════════════════════════════════
// renderImportRules(c): renders a management UI for c.importRules[]
// Rules schema: {keyword, cat, acctCode}
var RULE_EI=-1;
function renderImportRules(c){
  if(!c)return;
  var p=g('p-importrules');if(!p)return;
  var rules=c.importRules||[];
  var rows=rules.map(function(r,i){
    return'<tr>'
      +'<td style="font-family:monospace;font-size:12px">'+escHtml(r.keyword||'—')+'</td>'
      +'<td style="font-size:12px">'+escHtml(r.cat||'—')+'</td>'
      +'<td style="font-size:11px;color:var(--muted)">'+escHtml(r.acctCode||'—')+'</td>'
      +'<td><div class="row-acts">'
      +'<button class="e-btn" onclick="editImportRule('+i+')">&#9998;</button>'
      +'<button class="d-btn" onclick="deleteImportRule('+i+')">&#215;</button>'
      +'</div></td>'
      +'</tr>';
  }).join('');

  p.innerHTML=FB()+XB()
    +'<div class="xbar" style="margin-bottom:.75rem"><button class="xbtn p" onclick="RULE_EI=-1;resetRuleForm();openM(&apos;m-importrule&apos;)">+ Add rule</button></div>'
    +'<div class="card"><div class="c-head"><span class="c-title">Bank import rules</span>'
    +'<span style="font-size:11px;color:var(--muted)">Auto-categorize transactions during bank import</span></div>'
    +(rows
      ?'<table><thead><tr><th>Keyword (contains)</th><th>Category</th><th>Account code</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>'
      :ES('No import rules yet','Rules auto-categorize bank transactions during import. Add a rule for recurring vendors like payroll, rent, or utilities.',"RULE_EI=-1;resetRuleForm();openM(&apos;m-importrule&apos;)"))
    +'</div>'
    +'<div style="font-size:11px;color:var(--muted);margin-top:.5rem;line-height:1.6">'
    +'Rules are applied in order during bank import. The first matching rule wins. Keywords are case-insensitive.'
    +'</div>'
    +'<div class="overlay" id="m-importrule"><div class="modal" style="max-width:420px">'
    +'<button class="cx" onclick="closeM(&apos;m-importrule&apos;)">&#215;</button>'
    +'<div class="m-title" id="m-importrule-title">Add import rule</div>'
    +'<div class="fl"><label>Keyword *</label><input type="text" id="rule-kw" placeholder="e.g. AMAZON, PAYROLL, RENT"></div>'
    +'<div class="fl"><label>Assign category</label><input type="text" id="rule-cat" placeholder="e.g. Office Supplies"></div>'
    +'<div class="fl"><label>Assign account code</label><input type="text" id="rule-acct" placeholder="e.g. 5210"></div>'
    +'<button class="sv-btn" onclick="saveImportRule()">Save rule</button>'
    +'</div></div>';
}
function resetRuleForm(){
  ['rule-kw','rule-cat','rule-acct'].forEach(function(id){var el=g(id);if(el)el.value='';});
  var t=g('m-importrule-title');if(t)t.textContent='Add import rule';
}
function saveImportRule(){
  var c=gc();if(!c.importRules)c.importRules=[];
  var kw=(g('rule-kw')&&g('rule-kw').value.trim()||'').toLowerCase();
  if(!kw){alert('Please enter a keyword.');return;}
  var item={keyword:kw,cat:g('rule-cat')&&g('rule-cat').value.trim()||'',acctCode:g('rule-acct')&&g('rule-acct').value.trim()||''};
  if(RULE_EI>=0)c.importRules[RULE_EI]=item;
  else{
    if(c.importRules.find(function(r){return r.keyword===kw;})){alert('A rule for that keyword already exists.');return;}
    c.importRules.push(item);
  }
  RULE_EI=-1;sv();renderImportRules(c);closeM('m-importrule');resetRuleForm();
}
function editImportRule(i){
  var c=gc();if(!c.importRules||!c.importRules[i])return;
  RULE_EI=i;var r=c.importRules[i];
  g('rule-kw').value=r.keyword||'';
  g('rule-cat').value=r.cat||'';
  g('rule-acct').value=r.acctCode||'';
  var t=g('m-importrule-title');if(t)t.textContent='Edit rule';
  openM('m-importrule');
}
function deleteImportRule(i){
  var c=gc();if(!c.importRules||!c.importRules[i])return;
  if(!confirm('Delete rule for keyword "'+c.importRules[i].keyword+'"?'))return;
  c.importRules.splice(i,1);sv();renderImportRules(c);
}

// ══════════════════════════════════════════
// FORM 990 PART IX (Phase 2-D) — NP only
// ══════════════════════════════════════════
// renderForm990(c): renders the Form 990 Part IX panel (p-f990).
// Shows a live functional expense breakdown by Part IX line.
// Exports via doPDF('f990partix').
function renderForm990(c){
  if(!c||c.type!=='np')return;
  var p=g('p-f990');if(!p)return;

  var exp=(c.expenses||[]).filter(function(e){return!e.deleted&&!e.voided;});

  function _col(e){
    var f=(e.functional||'').toLowerCase();
    if(f==='program')return 0;
    if(f==='management'||f==='admin')return 1;
    if(f==='fundraising')return 2;
    return 1;
  }

  // Group by f990 line / category
  var map={};
  exp.forEach(function(e){
    var acct=(c.accounts||[]).find(function(a){return a.code===e.acctCode;});
    var lineKey=acct&&acct.f990?acct.f990:('Other — '+(e.cat||'Uncategorized'));
    if(!map[lineKey])map[lineKey]=[0,0,0];
    map[lineKey][_col(e)]+=Number(e.amt||0);
  });

  var tot=[0,0,0];
  Object.keys(map).forEach(function(k){tot[0]+=map[k][0];tot[1]+=map[k][1];tot[2]+=map[k][2];});
  var grand=tot[0]+tot[1]+tot[2];

  function fmtF(n){return n?'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0}):'—';}

  // Untagged count
  var untagged=exp.filter(function(e){return!e.functional;}).length;
  var warnHtml=untagged
    ?'<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:.6rem .9rem;font-size:12px;margin-bottom:1rem;color:#7a5c00">'
      +'<i class="fas fa-triangle-exclamation"></i> <strong>'+untagged+' expense(s)</strong> have no functional classification and default to Management & General. '
      +'Edit each expense and set the Functional field to Program, Management, or Fundraising.'
      +'</div>'
    :'';

  // Summary stat cards
  var pct0=grand>0?Math.round(tot[0]/grand*100):0;
  var pct1=grand>0?Math.round(tot[1]/grand*100):0;
  var pct2=grand>0?Math.round(tot[2]/grand*100):0;
  var summaryHtml='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.75rem;margin-bottom:1rem">'
    +_f990Stat('Program services',tot[0],pct0,'var(--green)')
    +_f990Stat('Management & general',tot[1],pct1,'var(--blue,#2980b9)')
    +_f990Stat('Fundraising',tot[2],pct2,'var(--amber)')
    +_f990Stat('Total expenses',grand,100,'var(--text)')
    +'</div>';

  // Detail table
  var keys=Object.keys(map).sort();
  var rows=keys.map(function(k){
    var v=map[k];var rt=v[0]+v[1]+v[2];
    return'<tr>'
      +'<td style="font-size:12px">'+escHtml(k)+'</td>'
      +'<td class="right" style="color:var(--green)">'+fmtF(v[0])+'</td>'
      +'<td class="right">'+fmtF(v[1])+'</td>'
      +'<td class="right" style="color:var(--amber)">'+fmtF(v[2])+'</td>'
      +'<td class="right" style="font-weight:600">'+fmtF(rt)+'</td>'
      +'</tr>';
  }).join('');

  var tableHtml='<div class="card" style="margin-bottom:1rem">'
    +'<div class="c-head"><span class="c-title">Functional expense detail</span>'
    +'<button class="xbtn" onclick="doPDF(&apos;f990partix&apos;)" style="font-size:11px;padding:4px 10px">&#128438; Export PDF</button>'
    +'</div>'
    +(rows
      ?'<table><thead><tr>'
        +'<th>Part IX line / category</th>'
        +'<th class="right">Program services</th>'
        +'<th class="right">Mgmt & general</th>'
        +'<th class="right">Fundraising</th>'
        +'<th class="right">Total</th>'
        +'</tr></thead><tbody>'+rows+'</tbody>'
        +'<tfoot><tr class="total">'
        +'<td>Total</td>'
        +'<td class="right">'+fmtF(tot[0])+'</td>'
        +'<td class="right">'+fmtF(tot[1])+'</td>'
        +'<td class="right">'+fmtF(tot[2])+'</td>'
        +'<td class="right">'+fmtF(grand)+'</td>'
        +'</tr></tfoot></table>'
      :'<div style="padding:1rem;color:var(--muted);font-size:13px">No expenses recorded yet.</div>')
    +'</div>';

  var noteHtml='<div style="font-size:11px;color:var(--muted);line-height:1.6;margin-top:.5rem">'
    +'Part IX line references come from the <strong>f990</strong> field on each COA account. '
    +'Functional classification is set per expense via the Functional field (Program / Management / Fundraising). '
    +'Verify all amounts with your CPA before filing Form 990.'
    +'</div>'
    +'<div style="background:#fff8e1;border:1px solid #ffe082;border-radius:8px;padding:.6rem .9rem;font-size:11px;color:#795548;margin-bottom:.75rem">'
    +'<strong><i class="fas fa-triangle-exclamation"></i> Internal use only.</strong> This report is for reference and planning purposes only. It does not constitute a filed IRS Form 990 and is not transmitted to the IRS or any government agency. Always consult a qualified CPA or tax professional before filing.'
    +'</div>';

  // Part VIII: Statement of Revenue
  var incItems=(c.income||[]).filter(function(i){return!i.deleted&&!i.voided;});
  var grantItems=(c.grants||[]).filter(function(g){return Number(g.awarded||g.received||0)>0;});
  var donorItems=(c.donors||[]);
  var p8map={};
  function _p8add(lineKey,amt){if(!p8map[lineKey])p8map[lineKey]=0;p8map[lineKey]+=Number(amt||0);}
  // General income — exclude grant-linked entries (they are counted separately below)
  incItems.forEach(function(i){
    if(i.grantId)return; // grant receipts counted in grant line, not here
    var acct=(c.accounts||[]).find(function(a){return a.code===i.acctCode;});
    var line=acct&&acct.f990?acct.f990:('Other revenue — '+(i.cat||'Uncategorized'));
    _p8add(line,i.recv||i.amt||0);
  });
  // Grant revenue — use actual received amounts from income entries, not awarded amount
  grantItems.forEach(function(g){
    var grantRecv=(c.income||[]).filter(function(i){
      return!i.deleted&&!i.voided&&i.grantId===g.id;
    }).reduce(function(s,i){return s+Number(i.recv||i.amt||0);},0);
    if(grantRecv>0)_p8add('Part VIII Line 1 (Grants)',grantRecv);
  });
  var donorTotal=donorItems.reduce(function(s,d){return s+(d.donations||[]).reduce(function(t,dn){return t+Number(dn.amt||0);},0);},0);
  if(donorTotal>0&&!incItems.some(function(i){var a=(c.accounts||[]).find(function(a){return a.code===i.acctCode;});return a&&(a.f990||'').indexOf('Part VIII Line 1')===0;}))
    _p8add('Part VIII Line 1 (Contributions)',donorTotal);
  var p8keys=Object.keys(p8map).sort();
  var p8total=p8keys.reduce(function(s,k){return s+p8map[k];},0);
  var p8rows=p8keys.map(function(k){
    return'<tr><td style="font-size:12px">'+escHtml(k)+'</td><td class="right" style="font-weight:600">'+fmtF(p8map[k])+'</td></tr>';
  }).join('');
  var p8Html='<div class="card" style="margin-bottom:1rem">'    +'<div class="c-head"><span class="c-title">Part VIII — Statement of Revenue</span></div>'    +(p8rows      ?'<table><thead><tr><th>Revenue line</th><th class="right">Amount</th></tr></thead><tbody>'        +p8rows        +'</tbody><tfoot><tr class="total"><td>Total revenue</td><td class="right">'+fmtF(p8total)+'</td></tr></tfoot></table>'      :'<div style="padding:1rem;color:var(--muted);font-size:13px">No income recorded yet.</div>')    +'<div style="font-size:11px;color:var(--muted);margin-top:.5rem;padding:0 1rem .75rem">Revenue line tags come from the <strong>f990</strong> field on each COA account. Grants and donor totals are included automatically.</div>'    +'</div>';

  // Part X: Balance Sheet
  var hasLedger=(c.ledgerEntries||[]).filter(function(e){return!e.superseded;}).length>0;
  var p10Html;
  if(hasLedger){
    var lbs=getBSFromLedger(c);
    function _p10sect(title,rows,total,color){
      var rHtml=rows.map(function(r){
        return'<tr><td style="font-size:12px;padding-left:1.25rem">'+escHtml(r.name)+'</td><td class="right">'+fmtF(r.balance)+'</td></tr>';
      }).join('');
      return'<tr><td style="font-weight:600;font-size:12px;padding-top:.5rem">'+title+'</td><td></td></tr>'        +rHtml        +'<tr style="border-top:1px solid var(--border)"><td style="font-size:12px;font-weight:600">Total '+title+'</td>'        +'<td class="right" style="font-weight:700;color:'+color+'">'+fmtF(total)+'</td></tr>';
    }
    var p10balanced=lbs.balanced      ?'<div style="background:#d4edda;border:1px solid #43a047;border-radius:6px;padding:.5rem .9rem;font-size:11px;color:#2e7d32;margin-top:.5rem">&#10003; Balance sheet balances: Assets = Liabilities + Net Assets (within $0.01)</div>'      :'<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:.5rem .9rem;font-size:11px;color:#7a5c00;margin-top:.5rem">&#9888; Balance sheet does not balance — difference: '+fmtF(Math.abs(lbs.totalAssets-(lbs.totalLiab+lbs.totalEquityPlusIncome)))+'</div>';
    p10Html='<div class="card" style="margin-bottom:1rem">'      +'<div class="c-head"><span class="c-title">Part X — Balance Sheet (Ledger-derived)</span>'      +'<span style="font-size:11px;color:var(--green)">&#10003; Ledger data</span></div>'      +'<table><tbody>'      +_p10sect('Assets',lbs.assets,lbs.totalAssets,'var(--text)')      +_p10sect('Liabilities',lbs.liabilities,lbs.totalLiab,'var(--red)')      +_p10sect('Net Assets',lbs.equity,lbs.totalEquity,'var(--blue,#2980b9)')      +'<tr class="total"><td>Net income / surplus YTD</td><td class="right" style="color:'+(lbs.netIncome>=0?'var(--green)':'var(--red)')+'">'+fmtF(lbs.netIncome)+'</td></tr>'      +'</tbody></table>'      +p10balanced      +'</div>';
  }else{
    var wbs=c.balanceSheet||{assets:[],liabilities:[],equity:[]};
    var wAssets=wbs.assets.reduce(function(s,a){return s+Number(a.openingBalance||0);},0);
    var wLiab=wbs.liabilities.reduce(function(s,l){return s+Number(l.amt||0);},0);
    var wEquity=wAssets-wLiab;
    p10Html='<div class="card" style="margin-bottom:1rem">'      +'<div class="c-head"><span class="c-title">Part X — Balance Sheet (Working view)</span>'      +'<span style="font-size:11px;color:var(--muted)">Post ledger entries for a full ledger-derived view</span></div>'      +(wAssets||wLiab        ?'<table><tbody>'          +'<tr><td>Total Assets</td><td class="right" style="font-weight:600">'+fmtF(wAssets)+'</td></tr>'          +'<tr><td>Total Liabilities</td><td class="right" style="font-weight:600;color:var(--red)">'+fmtF(wLiab)+'</td></tr>'          +'<tr class="total"><td>Net Assets</td><td class="right" style="color:'+(wEquity>=0?'var(--green)':'var(--red)')+'">'+fmtF(wEquity)+'</td></tr>'          +'</tbody></table>'        :'<div style="padding:1rem;color:var(--muted);font-size:13px">No balance sheet data yet. Add entries in the Balance Sheet tab.</div>')      +'</div>';
  }

  var _npTypeLabels={'501c3':'501(c)(3)','501c4':'501(c)(4)','501c5':'501(c)(5)','501c6':'501(c)(6)','501c7':'501(c)(7)','501c8':'501(c)(8)','501c10':'501(c)(10)','501c19':'501(c)(19)'};
  var _npTypeLabel=_npTypeLabels[c.npType||'501c3']||'501(c)(3)';
  var _fsCount=(c.fiscalSponsorships||[]).filter(function(sp){return sp.status==='active';}).length;

  p.innerHTML=FB()+XB()
    +'<div class="xbar" style="margin-bottom:.75rem">'
    +'<div style="background:#fff8e1;border:1px solid #ffe082;border-radius:6px;padding:6px 10px;font-size:10px;color:#795548;margin-bottom:.75rem">'
    +'<strong><i class="fas fa-triangle-exclamation"></i> INTERNAL USE ONLY</strong> — This document is not a filed IRS Form 990 and is not transmitted to the IRS or any government agency. Consult a qualified CPA or tax professional before filing.'
    +'</div>'
    +'<span style="font-weight:700;font-size:15px">Form 990 — Financial Statements</span>'
    +' <span class="badge b-blue" style="font-size:11px;vertical-align:middle">'+_npTypeLabel+'</span>'
    +(_fsCount?(' <span class="badge b-amber" style="font-size:11px;vertical-align:middle;cursor:pointer" onclick="var t=document.querySelector(\'[data-panel=grants]\');if(t)switchTab({target:t},\'grants\')" title="Active fiscal sponsorships — disclosure required on Form 990">'+_fsCount+' fiscal sponsorship'+(  _fsCount>1?'s':'')+' ↗</span>'):'')
    +'</div>'
    +(typeof renderComplianceBanner==='function'?renderComplianceBanner(c):'')
    +'<div style="display:flex;gap:6px;margin-bottom:1rem">'
    +'<button class="'+((_f990Tab||'ix')==='ix'?'sv-btn':'add-btn')+'" style="font-size:11px;padding:5px 14px" onclick="_f990Tab=\'ix\';renderForm990(gc())">Part IX: Expenses</button>'
    +'<button class="'+((_f990Tab==='viii')?'sv-btn':'add-btn')+'" style="font-size:11px;padding:5px 14px" onclick="_f990Tab=\'viii\';renderForm990(gc())">Part VIII: Revenue</button>'
    +'<button class="'+((_f990Tab==='x')?'sv-btn':'add-btn')+'" style="font-size:11px;padding:5px 14px" onclick="_f990Tab=\'x\';renderForm990(gc())">Part X: Balance Sheet</button>'
    +'<button class="'+((_f990Tab==='sb')?'sv-btn':'add-btn')+'" style="font-size:11px;padding:5px 14px" onclick="_f990Tab=\'sb\';renderForm990(gc())">Schedule B: Donors</button>'
    +'</div>'
    +((_f990Tab||'ix')==='viii'?p8Html:(_f990Tab==='x'?p10Html:(_f990Tab==='sb'?_schedBHtml():warnHtml+summaryHtml+tableHtml+noteHtml)));
}

var _f990SchBPublic=false;
function _schedBHtml(){
  var c=gc();if(!c)return'';
  var THRESHOLD=5000;
  // Collect every bankTxnId already represented in a donor's donation records —
  // these are the same dollar event as some c.income[] entry and must not be
  // counted again under the income entry's raw description.
  var donorLinkedBankTxnIds={};
  (c.donors||[]).forEach(function(d){
    (d.donations||[]).forEach(function(dn){ if(dn.bankTxnId) donorLinkedBankTxnIds[dn.bankTxnId]=true; });
  });
  var donors=(c.donors||[]).map(function(d){
    var total=(d.donations||[]).reduce(function(s,dn){return s+Number(dn.amt||0);},0);
    return{name:d.name||'Unknown',email:d.email||'',total:total};
  }).filter(function(d){return d.total>=THRESHOLD;});
  // Include income entries above threshold not already in donor records.
  // Exclude grant-linked income (grantId set) — grants are institutional funders,
  // not individual contributors, and their donations are already tracked via donor records.
  // Exclude any income entry whose bankTxnId is already linked to a donor's donation record —
  // same money, already counted above, regardless of whether the names match.
  var incDonors={};
  var donorNames=donors.map(function(d){return(d.name||'').toLowerCase().trim();});
  (c.income||[]).filter(function(r){
    return !r.deleted&&!r.voided&&!r.grantId&&!(r.bankTxnId&&donorLinkedBankTxnIds[r.bankTxnId]);
  }).forEach(function(r){
    var k=r.name||'Unknown';
    if(!incDonors[k])incDonors[k]=0;
    incDonors[k]+=Number(r.recv||r.proj||0);
  });
  Object.keys(incDonors).forEach(function(name){
    var nameLower=(name||'').toLowerCase().trim();
    var alreadyCounted=donorNames.indexOf(nameLower)>=0;
    if(!alreadyCounted&&incDonors[name]>=THRESHOLD)
      donors.push({name:name,email:'',total:incDonors[name]});
  });
  donors.sort(function(a,b){return b.total-a.total;});
  function fmtF(n){return'$'+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0});}
  var rows=donors.map(function(d,i){
    var dispName=_f990SchBPublic?'Contributor #'+(i+1):escHtml(d.name);
    var dispContact=_f990SchBPublic
      ?'<span style="color:var(--muted);font-style:italic">Redacted</span>'
      :escHtml(d.email||'—');
    return'<tr>'
      +'<td style="font-size:12px;font-weight:500">'+dispName+'</td>'
      +'<td style="font-size:12px;color:var(--muted)">'+dispContact+'</td>'
      +'<td class="right" style="font-weight:600">'+fmtF(d.total)+'</td>'
      +'</tr>';
  }).join('');
  var totalSchedB=donors.reduce(function(s,d){return s+d.total;},0);
  return'<div class="card" style="margin-bottom:1rem">'
    +'<div class="c-head">'
    +'<span class="c-title">Schedule B — Schedule of Contributors</span>'
    +'<div style="display:flex;gap:6px">'
    +'<button class="'+(!_f990SchBPublic?'sv-btn':'add-btn')+'" style="font-size:11px;padding:4px 10px" onclick="_f990SchBPublic=false;renderForm990(gc())">Internal copy</button>'
    +'<button class="'+(_f990SchBPublic?'sv-btn':'add-btn')+'" style="font-size:11px;padding:4px 10px" onclick="_f990SchBPublic=true;renderForm990(gc())">Public copy (redacted)</button>'
    +'<button class="xbtn" style="font-size:11px;padding:4px 10px" onclick="doPDF(\'f990schedB\')">&#128438; Export PDF</button>'
    +'</div></div>'
    +'<div style="background:#fff8e1;border:1px solid #f9a825;border-radius:6px;padding:.5rem .9rem;font-size:11px;color:#7a5c00;margin-bottom:.75rem">'
    +'<strong>IRS Rule:</strong> List all contributors giving $5,000+ during the tax year. '
    +'The public copy filed with Form 990 must have all names and addresses redacted. '
    +'The internal copy is retained by your organization and shown only to auditors.'
    +'</div>'
    +(donors.length
      ?'<table><thead><tr>'
        +'<th style="width:35%">'+(_f990SchBPublic?'Contributor':'Name')+'</th>'
        +'<th style="width:40%">'+(_f990SchBPublic?'Contact':'Email / Contact')+'</th>'
        +'<th class="right" style="width:25%">Total contributions</th>'
        +'</tr></thead><tbody>'+rows+'</tbody>'
        +'<tfoot><tr class="total"><td colspan="2">Total Schedule B contributions</td><td class="right">'+fmtF(totalSchedB)+'</td></tr></tfoot>'
        +'</table>'
      :'<div style="padding:1rem;color:var(--muted);font-size:13px">No contributors at or above the $5,000 threshold. Schedule B may not be required.</div>')
    +'<div style="font-size:11px;color:var(--muted);margin-top:.5rem">'
    +'Threshold: $5,000. Sources: Donor records + income entries. Verify with your CPA before filing.'
    +'</div></div>';
}

function _f990Stat(label,amt,pct,color){
  return'<div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:.75rem 1rem">'
    +'<div style="font-size:11px;color:var(--muted);margin-bottom:4px">'+label+'</div>'
    +'<div style="font-size:17px;font-weight:700;color:'+color+'">'
    +'$'+Number(amt||0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})
    +'</div>'
    +'<div style="font-size:11px;color:var(--muted);margin-top:2px">'+pct+'% of total</div>'
    +'</div>';
}

// ══════════════════════════════════════════
// SALES TAX LIABILITY TRACKING (Phase 2-C)
// ══════════════════════════════════════════
// renderSalesTax(c): renders the Sales Tax panel (p-salestax) for SB clients.
// Shows collected-but-unremitted sales tax from revenue entries, and provides
// a remittance button that clears the liability via a journal-style expense post.
function renderSalesTax(c){
  if(!c)return;
  var p=g('p-salestax');if(!p)return;
  var stCode=_defaultSTaxCode(c);
  var jurs=(c.taxJurisdictions||[]);
  function fmtST(n){return'$'+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
  // Per-jurisdiction collected/remitted
  var jurMap={};
  (c.revenue||[]).filter(function(r){return!r.deleted&&Number(r.taxAmt||0)>0;}).forEach(function(r){
    var jn=r.taxJurisdiction||'Unassigned';
    if(!jurMap[jn])jurMap[jn]={collected:0,remitted:0,rate:r.taxRate||0,freq:'monthly',authority:''};
    jurMap[jn].collected+=Number(r.taxAmt||0);
  });
  jurs.forEach(function(j){if(jurMap[j.name]){jurMap[j.name].rate=j.rate;jurMap[j.name].freq=j.freq||'monthly';jurMap[j.name].authority=j.authority||'';}});
  var remittances=(c.expenses||[]).filter(function(e){return!e.deleted&&!e.voided&&(e.cat==='Sales Tax'||e.acctCode===stCode);});
  remittances.forEach(function(e){
    var jn=e.taxJurisdiction||'Unassigned';
    if(!jurMap[jn])jurMap[jn]={collected:0,remitted:0,rate:0,freq:'monthly',authority:''};
    jurMap[jn].remitted+=Number(e.amt||0);
  });
  var totalCollected=Object.keys(jurMap).reduce(function(s,k){return s+jurMap[k].collected;},0);
  var totalRemitted=Object.keys(jurMap).reduce(function(s,k){return s+jurMap[k].remitted;},0);
  var totalOutstanding=totalCollected-totalRemitted;
  var summaryHtml='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.75rem;margin-bottom:1rem">'
    +_stStat('Total collected',totalCollected,'var(--text)')
    +_stStat('Total remitted',totalRemitted,'var(--green)')
    +_stStat('Outstanding liability',totalOutstanding,totalOutstanding>0?'var(--red)':'var(--green)')
    +'</div>';
  // Per-jurisdiction rows
  var jurRows=Object.keys(jurMap).sort().map(function(jn){
    var j=jurMap[jn];var out=j.collected-j.remitted;
    return'<tr><td style="font-weight:500">'+escHtml(jn)+'</td>'
      +'<td style="font-size:11px;color:var(--muted)">'+escHtml(j.authority||'')+'</td>'
      +'<td class="right">'+fmtST(j.collected)+'</td>'
      +'<td class="right" style="color:var(--green)">'+fmtST(j.remitted)+'</td>'
      +'<td class="right" style="font-weight:600;color:'+(out>0?'var(--red)':'var(--muted)')+'">'+fmtST(out)+'</td>'
      +'<td><button class="add-btn" style="font-size:10px;padding:2px 8px" onclick="openRemitModal(\''+escHtml(jn)+'\','+out+')">Remit</button></td>'
      +'</tr>';
  }).join('');
  var jurCard=Object.keys(jurMap).length
    ?'<div class="card" style="margin-bottom:1rem"><div class="c-head"><span class="c-title">By jurisdiction</span></div>'
      +'<table><thead><tr><th>Jurisdiction</th><th>Authority</th><th class="right">Collected</th><th class="right">Remitted</th><th class="right">Outstanding</th><th></th></tr></thead>'
      +'<tbody>'+jurRows+'</tbody></table></div>'
    :'<div class="card" style="margin-bottom:1rem"><div style="padding:1rem;color:var(--muted);font-size:13px">No tax collected yet. Add a jurisdiction below and select it when logging revenue.</div></div>';
  // Transaction detail
  var taxItems=(c.revenue||[]).filter(function(r){return!r.deleted&&Number(r.taxAmt||0)>0;});
  var txRows=taxItems.map(function(r){
    return'<tr><td>'+(r.date||'--')+'</td><td>'+escHtml(r.name||r.cat||'Revenue')+'</td>'
      +'<td>'+escHtml(r.taxJurisdiction||'--')+'</td>'
      +'<td class="right">'+fmtST(r.act||0)+'</td>'
      +'<td class="right" style="color:var(--amber);font-weight:600">'+fmtST(r.taxAmt||0)+'</td>'
      +'<td style="font-size:10px;color:var(--muted)">'+(r.taxRate?r.taxRate+'%':'--')+'</td></tr>';
  }).join('');
  var detailCard=txRows
    ?'<div class="card" style="margin-bottom:1rem"><div class="c-head"><span class="c-title">Collected tax by transaction</span></div>'
      +'<table><thead><tr><th>Date</th><th>Revenue item</th><th>Jurisdiction</th><th class="right">Gross</th><th class="right">Tax</th><th>Rate</th></tr></thead>'
      +'<tbody>'+txRows+'</tbody></table></div>'
    :'';
  // Jurisdiction manager
  var jurMgrRows=jurs.length
    ?jurs.map(function(j,i){
      return'<tr><td style="font-weight:500">'+escHtml(j.name)+'</td>'
        +'<td class="right">'+j.rate+'%</td>'
        +'<td>'+escHtml(j.freq||'monthly')+'</td>'
        +'<td style="font-size:11px;color:var(--muted)">'+escHtml(j.authority||'')+'</td>'
        +'<td><button class="d-btn" onclick="delJurisdiction('+i+')">&#215;</button></td>'
        +'</tr>';
    }).join('')
    :'<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:.75rem">No jurisdictions saved yet. Add from the list below or create a custom one.</td></tr>';
  var starterOpts='<option value="">-- Add a common jurisdiction --</option>'
    +(typeof STARTER_JURISDICTIONS!=='undefined'?STARTER_JURISDICTIONS.filter(function(s){
      return!jurs.find(function(j){return j.name===s.name;});
    }).map(function(s){
      return'<option value="'+escHtml(s.name)+'" data-rate="'+s.rate+'" data-freq="'+s.freq+'" data-auth="'+escHtml(s.authority)+'">'+escHtml(s.name)+' ('+s.rate+'%)</option>';
    }).join(''):'');
  var jurMgr='<div class="card" style="margin-bottom:1rem"><div class="c-head"><span class="c-title">Manage jurisdictions</span></div>'
    +'<div style="background:#fff8e1;border:1px solid #f9a825;border-radius:6px;padding:.5rem .9rem;font-size:11px;color:#7a5c00;margin-bottom:.75rem">'
    +'<strong>Disclaimer:</strong> Tax rates are entered and maintained manually. Clarity does not verify or update rates automatically. '
    +'Always confirm rates with your state/local tax authority or a CPA before filing. Rates change — update your jurisdictions when they do.'
    +'</div>'
    +'<div style="display:flex;gap:8px;margin-bottom:.75rem;flex-wrap:wrap">'
    +'<div class="sw" style="flex:1;min-width:200px"><select id="jur-starter" onchange="prefillJurisdiction(this)" style="width:100%">'+starterOpts+'</select></div>'
    +'<button class="add-btn" onclick="openM(\'m-tax-jur\')">+ Custom jurisdiction</button>'
    +'</div>'
    +'<table><thead><tr><th>Name</th><th class="right">Rate</th><th>Frequency</th><th>Authority</th><th></th></tr></thead>'
    +'<tbody>'+jurMgrRows+'</tbody></table>'
    +'</div>';
  // Remit modal
  var remitModal='<div class="overlay" id="m-stax-remit"><div class="modal" style="max-width:380px">'
    +'<button class="cx" onclick="g(\'m-stax-remit\').classList.remove(\'open\')">&#215;</button>'
    +'<div class="m-title">Record tax remittance</div>'
    +'<div class="fl"><label>Jurisdiction</label><div class="sw"><select id="stax-jur" style="width:100%"><option value="Unassigned">Unassigned</option>'
    +jurs.map(function(j){return'<option value="'+escHtml(j.name)+'">'+escHtml(j.name)+'</option>';}).join('')
    +'</select></div></div>'
    +'<div class="fl"><label>Amount remitted ($)</label><input type="number" id="stax-amt" placeholder="0.00" oninput="fmtAmt(this)"></div>'
    +'<div class="fl"><label>Date</label><input type="text" id="stax-date" placeholder="MM/DD/YYYY" onblur="autoDate(this)" oninput="autoDate(this)"></div>'
    +'<div class="fl"><label>Description</label><input type="text" id="stax-desc" placeholder="e.g. PA Q1 2025 sales tax remittance"></div>'
    +'<div class="fl"><label>Paid from account</label><div class="sw"><select id="stax-bank" style="width:100%">'+_staxBankOpts(c)+'</select></div></div>'
    +'<button class="sv-btn" onclick="remitSalesTax()">Record remittance</button>'
    +'</div></div>';
  // Add jurisdiction modal
  var addJurModal='<div class="overlay" id="m-tax-jur"><div class="modal" style="max-width:360px">'
    +'<button class="cx" onclick="closeM(\'m-tax-jur\')">&#215;</button>'
    +'<div class="m-title">Add jurisdiction</div>'
    +'<div class="fl"><label>Name *</label><input type="text" id="jur-name" placeholder="e.g. Pennsylvania, Philadelphia"></div>'
    +'<div class="fl"><label>Combined rate (%) *</label><input type="number" id="jur-rate" placeholder="6.00" step="0.001" min="0" max="25"></div>'
    +'<div class="fl"><label>Filing frequency</label><div class="sw"><select id="jur-freq" style="width:100%"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option></select></div></div>'
    +'<div class="fl"><label>Tax authority</label><input type="text" id="jur-auth" placeholder="e.g. Pennsylvania Dept. of Revenue"></div>'
    +'<button class="sv-btn" onclick="saveJurisdiction()">Save jurisdiction</button>'
    +'</div></div>';
  p.innerHTML=FB()+XB()
    +'<div class="xbar" style="margin-bottom:.75rem"><span style="font-weight:700;font-size:15px">Sales Tax</span></div>'
    +summaryHtml+jurCard+detailCard+jurMgr+remitModal+addJurModal;
}


function _stStat(label,amt,color){
  return'<div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:.75rem 1rem;text-align:center">'
    +'<div style="font-size:11px;color:var(--muted);margin-bottom:4px">'+label+'</div>'
    +'<div style="font-size:17px;font-weight:700;color:'+color+'">$'+Number(amt||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</div>'
    +'</div>';
}

function _staxBankOpts(c){
  var opts='<option value="">— Select account —</option>';
  (c.bankAccounts||[]).forEach(function(b){opts+='<option value="bank:'+b.id+'">'+escHtml(b.name||'Bank')+'</option>';});
  (c.accounts||[]).filter(function(a){return a.type==='Asset'&&a.cat==='Cash';}).forEach(function(a){opts+='<option value="coa:'+a.code+'">'+escHtml(a.name)+' ('+a.code+')</option>';});
  return opts;
}

function openRemitModal(jurName,outstanding){
  var m=g('m-stax-remit');if(m)m.classList.add('open');
  var d=g('stax-date');if(d)d.value=todayNum();
  if(jurName){var sel=g('stax-jur');if(sel)sel.value=jurName;}
  if(outstanding>0){var amt=g('stax-amt');if(amt)amt.value=outstanding.toFixed(2);}
}
function saveJurisdiction(){
  var c=gc();if(!c)return;
  var name=(g('jur-name')&&g('jur-name').value.trim())||'';
  var rate=Number(g('jur-rate')&&g('jur-rate').value||0);
  if(!name){alert('Please enter a jurisdiction name.');return;}
  if(!rate||rate<=0){alert('Please enter a valid tax rate.');return;}
  if(!c.taxJurisdictions)c.taxJurisdictions=[];
  if(c.taxJurisdictions.find(function(j){return j.name===name;})){alert('A jurisdiction named "'+name+'" already exists.');return;}
  var freq=g('jur-freq')&&g('jur-freq').value||'monthly';
  var auth=g('jur-auth')&&g('jur-auth').value.trim()||'';
  c.taxJurisdictions.push({name:name,rate:rate,freq:freq,authority:auth});
  sv();closeM('m-tax-jur');
  ['jur-name','jur-rate','jur-auth'].forEach(function(id){var el=g(id);if(el)el.value='';});
  renderSalesTax(c);
}
function delJurisdiction(i){
  var c=gc();if(!c||!c.taxJurisdictions||!c.taxJurisdictions[i])return;
  if(!confirm('Remove jurisdiction "'+c.taxJurisdictions[i].name+'"?'))return;
  c.taxJurisdictions.splice(i,1);
  sv();renderSalesTax(c);
}
function prefillJurisdiction(sel){
  var opt=sel.options[sel.selectedIndex];if(!opt||!opt.value)return;
  var c=gc();if(!c)return;
  if(!c.taxJurisdictions)c.taxJurisdictions=[];
  var name=opt.value;
  var rate=Number(opt.getAttribute('data-rate')||0);
  var freq=opt.getAttribute('data-freq')||'monthly';
  var auth=opt.getAttribute('data-auth')||'';
  if(c.taxJurisdictions.find(function(j){return j.name===name;})){alert(name+' is already saved.');sel.value='';return;}
  if(!confirm('Add '+name+' at '+rate+'% ('+freq+')? Verify this rate with your tax authority before using it.')){
    sel.value='';return;
  }
  c.taxJurisdictions.push({name:name,rate:rate,freq:freq,authority:auth});
  sv();sel.value='';renderSalesTax(c);
}

function remitSalesTax(){
  var c=gc();if(!c)return;
  // PERIOD LOCK GUARD
  var _stLockDate=g('stax-date')&&g('stax-date').value.trim();
  if(_stLockDate&&isDateLocked(c,_stLockDate)){periodLockAlert(c.closedThrough);return;}
  var amt=Number(g('stax-amt')&&g('stax-amt').value||0);
  if(!amt||amt<=0){alert('Please enter an amount greater than zero.');return;}
  var desc=g('stax-desc')&&g('stax-desc').value.trim()||'Sales tax remittance';
  var dateVal=g('stax-date')&&g('stax-date').value.trim()||todayNum();
  var bankVal=g('stax-bank')&&g('stax-bank').value||'';
  var stCode=_defaultSTaxCode(c);
  if(!c.expenses)c.expenses=[];
  var expId=uid();
  // Post expense: debit Sales Tax Payable (clearing the liability), credit cash
  // In double-entry: Dr Sales Tax Payable / Cr Cash
  // We record as an expense against the stax category so it flows through existing reports
  var jurName=g('stax-jur')&&g('stax-jur').value||'Unassigned';
  var expItem={id:expId,desc:desc,cat:'Sales Tax',amt:amt,date:dateVal,acctCode:stCode,
    taxJurisdiction:jurName,
    recurring:'None',freq:'One-time',fixed:'Variable',reconciled:false,
    bankId:bankVal.indexOf('bank:')===0?bankVal.slice(5):'',
    audit:[{action:'created',at:new Date().toISOString()}]};
  c.expenses.push(expItem);
  // Post to ledger: debit stax payable (reducing liability), credit cash
  postToLedger(c,stCode,_defaultCashCode(c),amt,desc,'expense',expId);
  markDirty('revenue','reports','bs');
  sv();
  var m=g('m-stax-remit');if(m)m.classList.remove('open');
  renderSalesTax(c);
}

// ══════════════════════════════════════════
// CASH FLOW STATEMENT (Phase 2-B) — SB only, indirect method
// ══════════════════════════════════════════
// renderCF(): renders the Cash Flow tab (p-cashflow) for small-business clients.
// Indirect method:
//   Operating:  Net income ± non-cash adjustments ± working capital changes
//   Investing:  Fixed asset purchases / disposals
//   Financing:  Loan proceeds / principal payments
// All figures are period-to-date for the current fiscal year.
function renderCF(){
  var c=gc();if(!c)return;
  var p=g('p-cashflow');if(!p)return;

  // ── Fiscal year date range ────────────────────────────────
  var fy=getFiscalYear(c.fiscalYearEnd);
  var fyStart=fy.start,fyEnd=fy.end;
  function inFY(dateStr){
    if(!dateStr)return false;
    var parts=dateStr.split('/');if(parts.length!==3)return false;
    var d=new Date(Number(parts[2]),Number(parts[0])-1,Number(parts[1]));
    return d>=fyStart&&d<=fyEnd;
  }
  function fmtCF(n){
    var abs=Math.abs(n||0);
    var s='$'+abs.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0});
    return n<0?'('+s+')':s;
  }
  function cfRow(label,amt,indent,isBold,isTotal){
    var style='display:flex;justify-content:space-between;padding:'+(isTotal?'8px 12px':'5px 12px')+';'
      +(indent?'padding-left:'+(indent*20+12)+'px;':'')
      +(isTotal?'border-top:1px solid var(--border);margin-top:4px;':'')
      +(isBold?'font-weight:600;':'font-weight:400;')
      +(isTotal?'background:var(--surface2,#f8f7f5);border-radius:0 0 6px 6px;':'');
    var color=amt===null?'':amt>=0?'color:var(--green)':'color:var(--red)';
    return '<div style="'+style+'">'
      +'<span style="font-size:13px;color:var(--text)">'+label+'</span>'
      +(amt!==null?'<span style="font-size:13px;'+color+'">'+fmtCF(amt)+'</span>':'')
      +'</div>';
  }
  function section(title,rows,total,totalLabel){
    var html='<div class="card" style="margin-bottom:1rem">'
      +'<div class="c-head"><span class="c-title">'+title+'</span></div>'
      +rows
      +cfRow(totalLabel||'Net '+title,total,0,true,true)
      +'</div>';
    return html;
  }

  // ── 1. NET INCOME (from P&L) ─────────────────────────────
  var rev=(c.revenue||[]).filter(function(r){return!r.deleted&&inFY(r.date);});
  var exp=(c.expenses||[]).filter(function(e){return!e.deleted&&!e.voided&&inFY(e.date);});
  var totalRev=rev.reduce(function(s,r){return s+Number(r.act||0);},0);
  var totalExp=exp.reduce(function(s,e){return s+Number(e.amt||0);},0);
  var netIncome=totalRev-totalExp;

  // ── 2. OPERATING ADJUSTMENTS ─────────────────────────────
  // Non-cash: depreciation (expense entries tagged via ledger sourceType='depreciation')
  var deprAmt=(c.ledgerEntries||[]).filter(function(e){
    return!e.superseded&&e.sourceType==='depreciation'&&inFY(e.date);
  }).reduce(function(s,e){
    // depr entries debit expense, credit accum-depr — add back the expense side
    return s+(e.lines||[]).reduce(function(ls,l){return ls+Number(l.dr||0);},0);
  },0);
  // Also catch depreciation from expense array (fallback if not in ledger)
  var deprExpFallback=exp.filter(function(e){
    return(e.cat||'').toLowerCase().indexOf('depreciation')>=0||(e.desc||'').toLowerCase().indexOf('depreciation')>=0;
  }).reduce(function(s,e){return s+Number(e.amt||0);},0);
  var addBackDepr=deprAmt||deprExpFallback;

  // Working capital: AR change (increase in AR = cash not yet received = subtract)
  var arOpen=(c.invoices||[]).filter(function(inv){return inv.status!=='Paid'&&inv.status!=='Void';});
  var arBalance=arOpen.reduce(function(s,inv){return s+Number(inv.amt||0);},0);

  // Working capital: AP change (increase in AP = cash not yet paid = add back)
  var apOpen=(c.bills||[]).filter(function(b){return b.status==='Unpaid';});
  var apBalance=apOpen.reduce(function(s,b){return s+Number(b.amt||0);},0);

  var operatingRows=cfRow('Net income',netIncome,1,false)
    +cfRow('Add: Depreciation & amortization (non-cash)',addBackDepr,1,false)
    +cfRow('Less: Increase in accounts receivable',-arBalance,1,false)
    +cfRow('Add: Increase in accounts payable',apBalance,1,false);
  var operatingTotal=netIncome+addBackDepr-arBalance+apBalance;

  // ── 3. INVESTING ─────────────────────────────────────────
  // Fixed asset purchases in FY
  var assetPurchases=(c.fixedAssets||[]).filter(function(a){return inFY(a.date);})
    .reduce(function(s,a){return s+Number(a.cost||0);},0);
  var investingRows=cfRow('Purchase of fixed assets',-assetPurchases,1,false);
  var investingTotal=-assetPurchases;

  // ── 4. FINANCING ─────────────────────────────────────────
  // Loan proceeds: loans started in FY
  var loanProceeds=(c.loans||[]).filter(function(l){return inFY(l.startDate);})
    .reduce(function(s,l){return s+Number(l.principal||0);},0);
  // Loan payments: expense entries tagged as loan payments (by category)
  var loanPmts=exp.filter(function(e){
    return(e.cat||'').toLowerCase().indexOf('loan')>=0||(e.cat||'').toLowerCase().indexOf('debt')>=0;
  }).reduce(function(s,e){return s+Number(e.amt||0);},0);
  var financingRows=cfRow('Proceeds from loans',loanProceeds,1,false)
    +cfRow('Principal payments on debt',-loanPmts,1,false);
  var financingTotal=loanProceeds-loanPmts;

  // ── 5. NET CHANGE & ENDING CASH ──────────────────────────
  var netChange=operatingTotal+investingTotal+financingTotal;
  // Opening cash: sum of bank account balances (opening)
  var openingCash=(c.bankAccounts||[]).reduce(function(s,b){return s+Number(b.openingBalance||b.balance||0);},0);
  var endingCash=openingCash+netChange;

  // ── BUILD HTML ───────────────────────────────────────────
  var disclaimer='<div style="font-size:11px;color:var(--muted);margin-bottom:1rem;line-height:1.5">'
    +'Cash flow computed using the <strong>indirect method</strong> for fiscal year <strong>'+fy.label+'</strong>. '
    +'AR and AP balances reflect currently open items. Depreciation add-back uses ledger entries where available.'
    +'</div>';

  var summaryCard='<div class="card" style="margin-bottom:1rem">'
    +'<div class="c-head"><span class="c-title">Summary</span>'
    +'<button class="xbtn" onclick="doPDF(\'cashflow\')" style="font-size:11px;padding:4px 10px">&#128438; Export PDF</button>'
    +'</div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem;padding:.75rem 1rem">'
    +_cfStat('Operating',operatingTotal)
    +_cfStat('Investing',investingTotal)
    +_cfStat('Financing',financingTotal)
    +_cfStat('Net change',netChange)
    +_cfStat('Ending cash',endingCash)
    +'</div></div>';

  p.innerHTML=FB()+XB()
    +'<div class="xbar" style="margin-bottom:.75rem"><span style="font-weight:700;font-size:15px">Cash Flow Statement</span></div>'
    +disclaimer
    +summaryCard
    +section('Operating Activities',operatingRows,operatingTotal,'Net cash from operating activities')
    +section('Investing Activities',investingRows,investingTotal,'Net cash from investing activities')
    +section('Financing Activities',financingRows,financingTotal,'Net cash from financing activities')
    +'<div class="card" style="margin-bottom:1rem">'
    +cfRow('Net increase (decrease) in cash',netChange,0,true)
    +cfRow('Cash at beginning of period',openingCash,0,false)
    +cfRow('Cash at end of period',endingCash,0,true,true)
    +'</div>';
}

function _cfStat(label,amt){
  var pos=amt>=0;
  return '<div style="text-align:center;padding:.5rem .25rem">'
    +'<div style="font-size:11px;color:var(--muted);margin-bottom:4px">'+label+'</div>'
    +'<div style="font-size:17px;font-weight:700;color:'+(pos?'var(--green)':'var(--red)')+'">'+
    (amt<0?'(':'')+'$'+Math.abs(amt).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})+(amt<0?')':'')
    +'</div></div>';
}

// ══════════════════════════════════════════
// CLOSED PERIODS (Phase 2-A)
// ══════════════════════════════════════════
// renderClosedPeriods(c): renders the Closed Periods settings panel.
// Allows the bookkeeper to set/clear c.closedThrough — a MM/DD/YYYY date
// before which all transaction saves are hard-blocked.
function renderClosedPeriods(c){
  if(!c)return;
  var p=g('p-closedperiods');if(!p)return;
  var cur=c.closedThrough||'';
  var hasLock=!!cur;

  // History list — derive closed period "events" from the audit trail or just show current
  var statusHtml=hasLock
    ? '<div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap"><div style="background:var(--red);color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;letter-spacing:.04em"><i class="fas fa-lock"></i> LOCKED</div><div style="font-size:13px;color:var(--text)">All transactions dated on or before <strong>'+cur+'</strong> are hard-blocked from being added or edited.</div></div>'
    : '<div style="display:flex;align-items:center;gap:.75rem"><div style="background:var(--green);color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;letter-spacing:.04em"><i class="fas fa-check"></i> OPEN</div><div style="font-size:13px;color:var(--muted)">No periods are currently locked. All dates are editable.</div></div>';

  var lockForm='<div class="card" style="margin-top:1rem"><div class="c-head"><span class="c-title">Set lock date</span></div>'
    +'<div style="padding:.75rem 1rem 1rem">'
    +'<p style="font-size:12px;color:var(--muted);margin:0 0 .75rem">Enter the last date of the period you want to close. Transactions on or before this date will be blocked from creation or editing. This cannot be undone without explicitly clearing the lock.</p>'
    +'<div style="display:flex;gap:.75rem;align-items:flex-end;flex-wrap:wrap">'
    +'<div><label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px">Lock through date (MM/DD/YYYY)</label>'
    +'<input type="text" id="cp-date" placeholder="e.g. 12/31/2024" value="'+escHtml(cur)+'" style="width:180px" onblur="autoDate(this)" oninput="autoDate(this)"></div>'
    +'<button class="sv-btn" onclick="applyPeriodLock()" style="margin-bottom:0"><i class="fas fa-lock"></i> Lock period</button>'
    +(hasLock?'<button onclick="clearPeriodLock()" style="background:none;border:1px solid var(--red);color:var(--red);padding:8px 14px;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600"><i class="fas fa-xmark"></i> Clear lock</button>':'')
    +'</div></div></div>';

  var warningHtml='<div class="card" style="margin-top:1rem;border-left:3px solid var(--amber)"><div style="padding:.75rem 1rem">'
    +'<div style="font-weight:600;font-size:13px;margin-bottom:.5rem"><i class="fas fa-triangle-exclamation"></i> What gets blocked</div>'
    +'<div style="font-size:12px;color:var(--muted);line-height:1.6">'
    +'Expenses · Income / Revenue · Donations · Journal entries · Invoices · Mileage · Fixed assets · Fund transfers · Restriction releases · Bill payments'
    +'<br><br>Recurring auto-posts and depreciation entries dated in the locked period will also be suppressed. Budget, reconciliation, and balance sheet opening balances are not affected.'
    +'</div></div></div>';

  p.innerHTML=FB()+XB()
    +'<div class="xbar" style="margin-bottom:.75rem"><span style="font-weight:700;font-size:15px">Closed Periods</span></div>'
    +'<div class="card"><div class="c-head"><span class="c-title">Period lock status</span></div>'
    +'<div style="padding:.75rem 1rem">'+statusHtml+'</div></div>'
    +lockForm+warningHtml;
}

function applyPeriodLock(){
  var c=gc();if(!c)return;
  var dateVal=(g('cp-date')&&g('cp-date').value.trim())||'';
  if(!dateVal){alert('Please enter a lock-through date.');return;}
  // Basic MM/DD/YYYY validation
  var _parts=dateVal.split('/');
  if(_parts.length!==3||isNaN(Number(_parts[0]))||isNaN(Number(_parts[1]))||isNaN(Number(_parts[2]))){
    alert('Please enter a valid date in MM/DD/YYYY format.');return;
  }
  if(!confirm('Lock all periods through '+dateVal+'?\n\nNo transactions dated on or before this date can be added or edited until the lock is cleared.\n\nThis is recommended after finalizing a fiscal year or tax period.'))return;
  c.closedThrough=dateVal;
  sv();
  renderClosedPeriods(c);
}

function clearPeriodLock(){
  var c=gc();if(!c||!c.closedThrough)return;
  if(!confirm('Clear the period lock (currently through '+c.closedThrough+')?\n\nThis will allow edits to previously locked periods.'))return;
  c.closedThrough=null;
  sv();
  renderClosedPeriods(c);
}

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════
// APP STARTUP — stale-while-revalidate
// ─────────────────────────────────────────
// Strategy:
//   1. Render immediately from localStorage (< 50ms — user sees their data instantly)
//   2. In parallel, check Supabase session + fetch cloud data
//   3. If cloud data differs from what we rendered, silently re-render
//   4. processRecurring() is deferred inside load() so it never blocks first paint
// ══════════════════════════════════════════
(async function(){
  var sb=sbClient();

  // ── PHASE 1: load() is now called from app.html after ALL scripts parse ────
  // This ensures waypoint.js, timetracking.js, and switcher.js have all patched
  // getTabs and afterSwitch before buildDash runs.
  // load() call removed from here — see bottom of app.html.

  // If Supabase is not configured (dev/offline), we're done.
  if(!sb){updateAuthUI();return;}

  // ── PHASE 2: Resolve auth session in parallel ──────────────────────────────
  // onAuthStateChange fires for OAuth redirects (magic link, Google).
  // getSession() handles already-logged-in users on refresh.
  // Both paths call _syncFromCloud() which diffs and re-renders only if needed.

  var _cloudSynced=false;

  async function _syncFromCloud(session){
    if(_cloudSynced)return;// only run once — prevent double-sync
    _cloudSynced=true;
    _user=session.user;
    window.currentUser=session.user;
    updateAuthUI();
    // Snapshot what we rendered from localStorage so we can diff
    var _localSnapshot=JSON.stringify(D);
    var loaded=await loadFromSupabase();
    if(!loaded){
      // No cloud data — try migrating from old localStorage key
      migrateLocalStorage();
    } else {
      // Cloud data loaded — check if it differs from what we already rendered
      var _cloudSnapshot=JSON.stringify(D);
      if(_cloudSnapshot!==_localSnapshot){
        // Data changed — re-migrate and re-render with cloud data
        migrateD();
        renderApp();
        // Re-run housekeeping after cloud re-render
        setTimeout(function(){
          try{processRecurring();renderAll();}catch(e){console.error('[clarity] post-cloud sync:',e);}
        },0);
      }
      // Always save cloud data back to localStorage so next load is instant
      try{localStorage.setItem(STORE,JSON.stringify(D));}catch(e){}
    }
    // STEP 5 — Supabase table restructuring: one-time migration into the
    // new per-table schema. Safe to call on every sign-in — it checks for
    // existing rows in the new `clients` table and no-ops instantly if this
    // person has already been migrated. Runs only after their real cloud
    // data has loaded above, so it's never migrating stale/local data.
    // Fails silently on error and simply retries next sign-in — see
    // migration.js for the full safety design (backup-first, no data
    // deleted, nothing touched if anything goes wrong).
    if(typeof maybeMigrateUser==='function'){
      try{await maybeMigrateUser();}catch(e){console.error('[migration] unexpected error:',e);}
    }
  }

  // Set up auth listener FIRST — catches OAuth redirect callbacks
  sb.auth.onAuthStateChange(function(event,session){
    if(event==='SIGNED_IN'&&session){
      _syncFromCloud(session);
      // Show friendly heads-up disclaimer after sign-in
      if(typeof window.showDisclaimerIfNeeded==='function')window.showDisclaimerIfNeeded();
    }else if(event==='SIGNED_OUT'){
      _user=null;
      window.currentUser=null;
      updateAuthUI();
    }
  });

  // Check existing session for already-logged-in users (page refresh)
  try{
    var res=await sb.auth.getSession();
    var session=res.data&&res.data.session?res.data.session:null;
    if(session&&!_cloudSynced){
      await _syncFromCloud(session);
    }
  }catch(e){
    console.error('[clarity] getSession error:',e);
  }

  // Final fallback — if nothing fired after 1s, show auth UI and handle #signin
  setTimeout(function(){
    updateAuthUI();
    if(window.location.hash==='#signin'){showAuthScreen();}
  },1000);

})();

// ══════════════════════════════════════════

// ══════════════════════════════════════════
// HELP & GUIDANCE
// ══════════════════════════════════════════
var HELP_TAB='insights';

function openHelp(){
  HELP_TAB='insights';
  openM('m-help');
  showHelpTab('insights');
}

function showHelpTab(tab){
  HELP_TAB=tab;
  ['insights','basics','month','year','glossary'].forEach(function(t){
    var btn=g('ht-'+t);
    if(btn)btn.className=t===tab?'sv-btn':'add-btn';
    if(btn){btn.style.fontSize='11px';btn.style.padding='4px 12px';}
  });
  var el=g('help-content');if(!el)return;
  var c=gc();
  var type=c?c.type:'np';
  if(tab==='insights')el.innerHTML=renderHelpInsights(c);
  else if(tab==='basics')el.innerHTML=renderHelpBasics(type);
  else if(tab==='month')el.innerHTML=renderHelpChecklist('month',type,c);
  else if(tab==='year')el.innerHTML=renderHelpChecklist('year',type,c);
  else if(tab==='glossary')el.innerHTML=renderHelpGlossary(type);
}

function getHelpUserName(){
  if(_user){var meta=_user.user_metadata||{};return meta.full_name||meta.name||_user.email||'You';}
  return 'You';
}

function getChecklistKey(period){
  var c=gc();if(!c)return null;
  return 'checklist-'+c.id+'-'+period;
}

function loadChecklist(period){
  var key=getChecklistKey(period);if(!key)return{checks:{},selfSign:null,bossName:'',bossDate:'',custom:[]};
  try{var s=localStorage.getItem(key);if(s)return JSON.parse(s);}catch(e){}
  return{checks:{},selfSign:null,bossName:'',bossDate:'',custom:[]};
}

function saveChecklist(period,data){
  var key=getChecklistKey(period);if(!key)return;
  try{localStorage.setItem(key,JSON.stringify(data));}catch(e){}
}

function toggleCheck(period,id){
  var data=loadChecklist(period);
  if(data.selfSign)return;
  data.checks[id]=!data.checks[id];
  saveChecklist(period,data);
  showHelpTab(period.startsWith('year')?'year':'month');
}

function selfSignOff(period){
  var data=loadChecklist(period);
  var allItems=getChecklistItems(period.startsWith('year')?'year':'month',(gc()||{}).type||'np',gc());
  var done=Object.values(data.checks).filter(Boolean).length;
  if(!confirm('Sign off on this checklist? It will be locked.\n\n'+done+' of '+allItems.length+' items checked.'))return;
  data.selfSign={name:getHelpUserName(),date:todayNum(),ts:Date.now()};
  saveChecklist(period,data);
  showHelpTab(period.startsWith('year')?'year':'month');
}

function saveBossSignoff(period){
  var data=loadChecklist(period);
  var name=g('boss-name-'+period);var date=g('boss-date-'+period);
  if(!name||!name.value.trim()){alert('Please enter the reviewer name.');return;}
  data.bossName=name.value.trim();data.bossDate=date?date.value:'';
  saveChecklist(period,data);
  showHelpTab(period.startsWith('year')?'year':'month');
}

function clearBossSignoff(period){
  var data=loadChecklist(period);
  data.bossName='';data.bossDate='';
  saveChecklist(period,data);
  showHelpTab(period.startsWith('year')?'year':'month');
}

function addCustomItem(period){
  var inp=g('custom-inp-'+period);if(!inp||!inp.value.trim())return;
  var data=loadChecklist(period);
  if(!data.custom)data.custom=[];
  data.custom.push({id:'c-'+Date.now(),label:inp.value.trim()});
  saveChecklist(period,data);inp.value='';
  showHelpTab(period.startsWith('year')?'year':'month');
}

function removeCustomItem(period,id){
  var data=loadChecklist(period);
  data.custom=(data.custom||[]).filter(function(x){return x.id!==id;});
  saveChecklist(period,data);
  showHelpTab(period.startsWith('year')?'year':'month');
}

function monthLabel(period){
  var parts=period.split('-');if(parts.length<3)return period;
  var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[parseInt(parts[2])-1]+' '+parts[1];
}

function currentPeriod(listType){
  var now=new Date();
  if(listType==='year')return 'year-'+now.getFullYear();
  return 'month-'+now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
}

function downloadChecklist(period){
  var c=gc();if(!c)return;
  var data=loadChecklist(period);
  var listType=period.startsWith('year')?'year':'month';
  var items=getChecklistItems(listType,c.type,c);
  var allItems=items.concat((data.custom||[]).map(function(x){return{id:x.id,label:x.label};}));
  var periodLabel=listType==='year'?'Year-End '+period.split('-')[1]:monthLabel(period);
  var lines=['CLARITY BY TELOFIN','',c.name+' — '+periodLabel+' Checklist','Generated: '+todayNum(),'','CHECKLIST ITEMS:',''];
  allItems.forEach(function(item){lines.push((data.checks[item.id]?'[x] ':'[ ] ')+item.label);});
  lines.push('','SIGN-OFF:');
  if(data.selfSign){lines.push('Preparer: '+data.selfSign.name+' — '+data.selfSign.date);}else{lines.push('Preparer: Not signed off');}
  if(data.bossName){lines.push('Reviewed by: '+data.bossName+(data.bossDate?' — '+data.bossDate:''));}else{lines.push('Reviewed by: —');}
  lines.push('','Powered by Clarity by Telofin');
  var blob=new Blob([lines.join('\n')],{type:'text/plain'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=c.name.replace(/[^a-z0-9]/gi,'-')+'-'+period+'-checklist.txt';a.click();
}

function getChecklistItems(listType,clientType,c){
  var base=[];
  if(listType==='month'){
    base=[
      {id:'record',label:'Record all transactions — income, expenses, transfers'},
      {id:'cat',label:'Categorize everything — no uncategorized transactions'},
      {id:'recon',label:'Reconcile all bank and credit card accounts'},
      {id:'fix',label:'Fix any discrepancies found during reconciliation'},
      {id:'reports',label:'Review P&L and budget vs actual — now that books are clean'},
      {id:'invoices',label:'Review open invoices — follow up on anything over 30 days'},
      {id:'bills',label:'Confirm all bills received are entered and scheduled'},
      {id:'payroll',label:'Verify payroll entries are posted and categorized'},
      {id:'exec',label:'Run Executive Summary — review Clarity by Telofin™ Score and insights'},
    ];
    if(clientType==='np'){
      base.push({id:'grants',label:'Check grant spending pace — on track with timeline and restrictions?'});
      base.push({id:'restrict',label:'Confirm restricted funds used only for designated purposes'});
      base.push({id:'donor',label:'Log all donations received this month'});
    }
    if(clientType==='sb'){
      base.push({id:'ar',label:'Review AR aging — anything over 60 days needs immediate action'});
      base.push({id:'margin',label:'Check net margin trend — is direction right?'});
      base.push({id:'contractors',label:'Log any 1099 contractor payments made this month'});
    }
    if(clientType==='pe'){
      base.push({id:'savings',label:'Confirm savings contributions were made'});
      base.push({id:'debt',label:'Review debt balances — any changes?'});
    }
  } else {
    base=[
      {id:'yr-record',label:'Ensure all transactions for the year are recorded and categorized'},
      {id:'yr-recon',label:'Complete final reconciliation for all accounts'},
      {id:'yr-fix',label:'Resolve any outstanding discrepancies'},
      {id:'yr-reports',label:'Run full-year P&L and balance sheet review'},
      {id:'yr-exec',label:'Run full-year Executive Summary — document Clarity by Telofin™ Score'},
      {id:'yr-bva',label:'Document all major budget variances — know why they happened'},
      {id:'yr-adopt',label:'Adopt proposed budget for new fiscal year'},
      {id:'yr-taxprep',label:'Compile income and expense totals for tax preparer'},
    ];
    if(clientType==='np'){
      base.push({id:'yr-990',label:'Prepare 990 data — program vs admin vs fundraising allocation'});
      base.push({id:'yr-grants',label:'Close out completed grants — file final reports'});
      base.push({id:'yr-restrict',label:'Review all restricted fund balances — release any eligible'});
      base.push({id:'yr-donors',label:'Send annual donation acknowledgment letters to all donors'});
      base.push({id:'yr-adminratio',label:'Calculate admin cost ratio — be ready to explain to funders'});
    }
    if(clientType==='sb'){
      base.push({id:'yr-1099',label:'Issue 1099-NECs to all contractors paid $600+ this year'});
      base.push({id:'yr-deprec',label:'Record depreciation on any fixed assets'});
      base.push({id:'yr-growth',label:'Calculate year-over-year revenue growth rate'});
    }
    if(clientType==='pe'){
      base.push({id:'yr-networth',label:'Calculate year-end net worth snapshot'});
      base.push({id:'yr-goals',label:'Review financial goals — set new ones for next year'});
    }
  }
  return base;
}

function renderChecklistHTML(listType,type,c){
  var period=currentPeriod(listType);
  var data=loadChecklist(period);
  var items=getChecklistItems(listType,type,c);
  var allItems=items.concat((data.custom||[]).map(function(x){return{id:x.id,label:x.label,custom:true};}));
  var locked=!!data.selfSign;
  var checked=allItems.filter(function(i){return data.checks[i.id];}).length;
  var pct=allItems.length>0?Math.round((checked/allItems.length)*100):0;
  var periodLabel=listType==='year'?'Year-End '+new Date().getFullYear():monthLabel(period);

  var html='<div style="margin-bottom:.75rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">'
  +'<div><span style="font-weight:600">'+periodLabel+'</span> <span style="font-size:11px;color:var(--muted)">'+checked+' / '+allItems.length+' complete</span></div>'
  +'<div class="pbar" style="width:140px;height:8px"><div class="pfill" style="width:'+pct+'%;background:'+(pct===100?'var(--green)':pct>=50?'var(--amber)':'var(--muted)')+'"></div></div>'
  +'</div>'
  +'<div style="font-size:11px;color:var(--muted);margin-bottom:.75rem">Do these in order. Looking at reports before reconciling gives you wrong numbers.</div>';

  html+=allItems.map(function(item){
    var chk=!!data.checks[item.id];
    return'<div style="display:flex;align-items:flex-start;gap:10px;padding:.5rem 0;border-bottom:1px solid var(--bg)">'
    +'<input type="checkbox" '+(chk?'checked':'')+' '+(locked?'disabled':'')
    +' onchange="toggleCheck(\''+period+'\',\''+item.id+'\')" style="margin-top:2px;cursor:'+(locked?'default':'pointer')+';width:15px;height:15px;flex-shrink:0">'
    +'<span style="font-size:13px;'+(chk?'color:var(--muted);text-decoration:line-through;':'')+'">'+item.label
    +(item.custom&&!locked?' <button onclick="removeCustomItem(\''+period+'\',\''+item.id+'\')" style="font-size:10px;color:var(--red);background:none;border:none;cursor:pointer;margin-left:4px"><i class="fas fa-xmark"></i></button>':'')
    +'</span></div>';
  }).join('');

  if(!locked){
    html+='<div style="display:flex;gap:8px;margin-top:.75rem">'
    +'<input type="text" id="custom-inp-'+period+'" placeholder="Add custom item..." style="flex:1;padding:6px 10px;font-size:12px;border:1px solid var(--border);border-radius:7px;background:var(--surface);color:var(--text)">'
    +'<button class="add-btn" style="font-size:12px" onclick="addCustomItem(\''+period+'\')">+ Add</button>'
    +'</div>';
  }

  html+='<div style="margin-top:1rem;padding:.75rem;background:var(--bg);border-radius:10px">';
  html+='<div style="font-size:12px;font-weight:600;margin-bottom:.5rem">Sign-off</div>';
  if(data.selfSign){
    html+='<div style="font-size:12px;color:var(--green);margin-bottom:.5rem"><i class="fas fa-check"></i> Signed off by <strong>'+data.selfSign.name+'</strong> on '+data.selfSign.date+'</div>';
  } else {
    html+='<button class="sv-btn" style="font-size:12px;margin-bottom:.5rem" onclick="selfSignOff(\''+period+'\')"><i class="fas fa-check"></i> Sign off as preparer</button>';
  }
  html+='<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:.5rem">';
  if(data.bossName){
    html+='<span style="font-size:12px;color:var(--muted)">Reviewed by: <strong>'+data.bossName+'</strong>'+(data.bossDate?' on '+data.bossDate:'')+'</span>';
    html+='<button class="add-btn" style="font-size:11px;padding:3px 10px" onclick="clearBossSignoff(\''+period+'\')">Edit</button>';
  } else {
    html+='<input type="text" id="boss-name-'+period+'" placeholder="Reviewer / boss name" style="padding:5px 8px;font-size:12px;border:1px solid var(--border);border-radius:7px;background:var(--surface);color:var(--text);width:170px">';
    html+='<input type="text" id="boss-date-'+period+'" placeholder="Date" style="padding:5px 8px;font-size:12px;border:1px solid var(--border);border-radius:7px;background:var(--surface);color:var(--text);width:100px">';
    html+='<button class="add-btn" style="font-size:12px" onclick="saveBossSignoff(\''+period+'\')">Save</button>';
  }
  html+='</div>';
  html+='<div style="margin-top:.75rem"><button class="add-btn" style="font-size:11px;padding:4px 12px" onclick="downloadChecklist(\''+period+'\')"><i class="fas fa-arrow-down"></i> Download checklist</button></div>';
  html+='</div>';
  return html;
}

function renderHelpChecklist(listType,type,c){
  return'<div>'+renderChecklistHTML(listType,type,c)+'</div>';
}

// ── INSIGHTS (if this → do this) ────────
function renderHelpInsights(c){
  if(!c)return'<div style="font-size:13px;color:var(--muted)">Select a client to see insights.</div>';
  var type=c.type;
  var allInc=type==='sb'?(c.revenue||[]):(c.income||[]);
  var allExp=c.expenses||[];
  var invoices=c.invoices||[];
  var bills=c.bills||[];
  var grants=c.grants||[];
  var bs=c.balanceSheet||{assets:[],liabilities:[],equity:[]};

  function getAmt(r){return type==='sb'?Number(r.act||0):(Number(r.recv||r.amt||0));}
  var iT=allInc.reduce(function(s,r){return s+getAmt(r);},0);
  var eT=allExp.reduce(function(s,e){return s+Number(e.amt||0);},0);

  // Monthly grouping
  function monthKey(d){var p=parseDate(d);if(!p)return null;return p.getFullYear()+'-'+(p.getMonth()+1);}
  var incByMonth={},expByMonth={};
  allInc.forEach(function(r){var k=monthKey(r.date||'');if(!k)return;if(!incByMonth[k])incByMonth[k]=0;incByMonth[k]+=getAmt(r);});
  allExp.forEach(function(e){var k=monthKey(e.date||'');if(!k)return;if(!expByMonth[k])expByMonth[k]=0;expByMonth[k]+=Number(e.amt||0);});
  var incMonths=Object.keys(incByMonth).sort();
  var expMonths=Object.keys(expByMonth).sort();

  // Rolling averages
  var rollInc=incMonths.length?incMonths.slice(-3).reduce(function(s,k){return s+incByMonth[k];},0)/Math.min(incMonths.length,3):0;
  var rollExp=expMonths.length?expMonths.slice(-3).reduce(function(s,k){return s+expByMonth[k];},0)/Math.min(expMonths.length,3):0;
  var thisMonthInc=incMonths.length?incByMonth[incMonths[incMonths.length-1]]:0;

  // Cash on hand
  var cashOnHand=getCashOnHand(c);
  var runway=rollExp>0?Math.round(cashOnHand/rollExp):null;

  // Cash trend (last 2 months of net)
  var cashDropMonths=0;
  for(var mi=incMonths.length-1;mi>=1&&cashDropMonths<3;mi--){
    var net1=(incByMonth[incMonths[mi]]||0)-(expByMonth[incMonths[mi]]||0);
    if(net1<0)cashDropMonths++;else break;
  }

  // Revenue trend (declining 3 months)
  var revDecMonths=0;
  for(var ri=incMonths.length-1;ri>=1&&revDecMonths<3;ri--){
    if((incByMonth[incMonths[ri]]||0)<(incByMonth[incMonths[ri-1]]||0))revDecMonths++;else break;
  }

  // Expense creep
  var expGrowth=null;
  if(expMonths.length>=4){
    var eFirst=(expByMonth[expMonths[0]]+expByMonth[expMonths[1]])/2;
    var eLast=(expByMonth[expMonths[expMonths.length-1]]+expByMonth[expMonths[expMonths.length-2]])/2;
    expGrowth=eFirst>0?Math.round(((eLast-eFirst)/eFirst)*100):null;
  }

  // Fixed cost ratio
  var fixedExp=allExp.filter(function(e){return e.fixed==='Fixed';}).reduce(function(s,e){return s+Number(e.amt||0);},0);
  var fixedRatio=eT>0?Math.round((fixedExp/eT)*100):null;

  // AR
  var openInv=invoices.filter(function(i){return i.status!=='Paid';});
  var openInvAmt=openInv.reduce(function(s,i){return s+Number(i.amt||0);},0);
  var oldInv=openInv.filter(function(i){var d=parseDate(i.date||'');return d&&((new Date()-d)/(864e5))>60;});

  // Revenue spike
  var incSpike=rollInc>0&&thisMonthInc>rollInc*1.4;

  // NP: admin ratio
  var adminExp=allExp.filter(function(e){var cat=(e.cat||'').toLowerCase();return cat.includes('admin')||cat.includes('operations')||cat.includes('overhead');}).reduce(function(s,e){return s+Number(e.amt||0);},0);
  var adminRatio=eT>0?Math.round((adminExp/eT)*100):null;
  var prevAdminRatio=null; // future: compare to prior period

  // NP: grant alignment
  var grantIssues=grants.filter(function(gr){
    var spent=allExp.filter(function(e){return e.grantId===gr.id;}).reduce(function(s,e){return s+Number(e.amt||0);},0);
    var awarded=Number(gr.awarded||0);
    var dl=gr.deadline?parseDate(gr.deadline):null;
    var daysLeft=dl?Math.round((dl-new Date())/(864e5)):null;
    return daysLeft!==null&&daysLeft<90&&awarded>0&&(spent/awarded)<0.5;
  });

  // PE: savings rate
  var totalIncomePE=iT;
  var savingsExp=allExp.filter(function(e){var cat=(e.cat||'').toLowerCase();return cat.includes('saving')||cat.includes('invest');}).reduce(function(s,e){return s+Number(e.amt||0);},0);
  var savingsRate=totalIncomePE>0?Math.round((savingsExp/totalIncomePE)*100):null;

  // Build insights
  var insights=[];
  function ins(level,title,body,action){insights.push({level:level,title:title,body:body,action:action});}

  // SURVIVAL
  if(rollExp>0&&iT>0&&rollExp>rollInc)ins('red','You are spending more than you bring in','Your average monthly expenses exceed your average monthly income. This is not sustainable.','Cut at least one fixed cost this month, or take immediate action to increase income.');
  if(runway!==null&&runway<6){var sev=runway<3?'red':'amber';var msg=runway<3?'You have less than 3 months of runway':'You have less than 6 months of runway';var detail='At your current burn rate, your cash will run out in '+runway+' month'+(runway===1?'':'s')+'.';var action=runway<3?'Freeze non-essential spending immediately. Prioritize anything that generates cash quickly.':'Start shoring up cash reserves now. Conventional wisdom targets 18+ months of runway.';ins(sev,msg,detail,action);}
  if(cashDropMonths>=2)ins('amber','Your net position has been negative for '+cashDropMonths+' months','Income minus expenses has been negative recently. This is an early warning.','Review your top 3 expense categories. Identify anything that grew without a clear reason.');

  // COLLECTIONS
  if(openInvAmt>0&&rollInc>0&&openInvAmt>rollInc*0.3)ins('amber','A large portion of your revenue is uncollected','You have '+fmt(openInvAmt)+' in unpaid invoices — over 30% of your monthly average.','Follow up on all invoices over 30 days today. Consider tightening payment terms.');
  if(oldInv.length>0)ins('red',oldInv.length+' invoice'+(oldInv.length>1?'s are':' is')+' over 60 days old','Invoices this old have a low collection rate and are hurting your cash flow.','Contact those clients directly. Consider stopping new work until balances are paid.');

  // EXPENSES
  if(expGrowth!==null&&expGrowth>15)ins('amber','Your expenses are growing faster than expected','Costs have grown '+expGrowth+'% over the past few months. This is expense creep.','Review each category. Identify what grew and whether it was intentional.');
  if(fixedRatio!==null&&fixedRatio>70)ins('amber','Over 70% of your expenses are fixed costs','High fixed costs mean less flexibility if revenue drops.','Be cautious with new commitments like hiring or long-term contracts right now.');

  // PERFORMANCE
  if(incSpike)ins('amber','This month\'s income is significantly above your average','Your rolling average is '+fmt(Math.round(rollInc))+'. This month looks like a spike.','Don\'t treat this as your new baseline. Avoid increasing fixed costs until the trend confirms.');
  if(revDecMonths>=3)ins('red','Income has declined for '+revDecMonths+' months in a row','Sustained decline is a serious signal. Direction matters more than the total.','Identify what changed. Take action now — pricing, outreach, new sources.');

  // NP-SPECIFIC
  if(type==='np'){
    if(adminRatio!==null&&adminRatio>15){var adminSev=adminRatio>25?'red':'amber';ins(adminSev,'Your admin cost ratio is '+adminRatio+'%',adminRatio>25?'Above 25% will raise serious questions with most funders and Charity Navigator.':'Many major funders target under 15%. Above 15% warrants a clear explanation.','Review what\'s driving admin costs. Be ready to justify it to funders — or reduce it.');}
    if(grantIssues.length>0)ins('red',grantIssues.length+' grant'+(grantIssues.length>1?'s are':' is')+' at risk of lapsing','Less than 50% spent with under 90 days remaining.','Review spending timelines and restrictions immediately. Adjust pace or request a no-cost extension.');
  }

  // SB-SPECIFIC
  if(type==='sb'&&openInv.length>0){
    var avgAgeDays=openInv.reduce(function(s,i){var d=parseDate(i.date||'');return s+(d?Math.round((new Date()-d)/864e5):0);},0)/openInv.length;
    if(avgAgeDays>45)ins('amber','Your average invoice is '+Math.round(avgAgeDays)+' days old','Slow collections are a leading cause of cash flow problems even in profitable businesses.','Tighten payment terms on new work. Set up reminders for anything over 30 days.');
  }

  // PE-SPECIFIC
  if(type==='pe'){
    if(eT>iT)ins('red','You are spending more than you earn','Expenses exceed income. Every month this continues reduces your net worth.','Identify your top 2 expense categories and reduce them this month.');
    if(savingsRate!==null&&savingsRate<10)ins('amber','Your savings rate is '+savingsRate+'%','Below 10% makes it hard to build any cushion or reach long-term goals.','Start small — even 1-2% more per month adds up. Automate it if possible.');
  }

  if(!insights.length){
    return'<div style="padding:1.5rem;text-align:center;color:var(--muted)">'
    +'<div style="font-size:24px;margin-bottom:.5rem"><i class="fas fa-check"></i></div>'
    +'<div style="font-weight:600;margin-bottom:.25rem">No critical issues found</div>'
    +'<div style="font-size:12px">Add more dated transactions to get richer insights over time.</div>'
    +'</div>';
  }

  var colorMap={red:'var(--red)',amber:'var(--amber)',green:'var(--green)'};
  var bgMap={red:'rgba(239,68,68,.07)',amber:'rgba(245,158,11,.07)',green:'rgba(34,197,94,.07)'};
  var iconMap={red:'<i class="fas fa-triangle-exclamation"></i>',amber:'<i class="fas fa-triangle-exclamation"></i>',green:'<i class="fas fa-check"></i>'};

  return'<div style="font-size:11px;color:var(--muted);margin-bottom:.75rem">Based on your current data. These are signals, not verdicts.</div>'
  +insights.map(function(ins){
    return'<div style="border-left:3px solid '+colorMap[ins.level]+';background:'+bgMap[ins.level]+';border-radius:0 10px 10px 0;padding:.75rem 1rem;margin-bottom:.75rem">'
    +'<div style="font-weight:600;font-size:13px;margin-bottom:.25rem">'+iconMap[ins.level]+' '+ins.title+'</div>'
    +'<div style="font-size:12px;color:var(--muted);margin-bottom:.4rem;line-height:1.5">'+ins.body+'</div>'
    +'<div style="font-size:12px;font-weight:500;color:'+colorMap[ins.level]+'">→ '+ins.action+'</div>'
    +'</div>';
  }).join('');
}

// ── BASICS (rewritten tone) ──────────────
function renderHelpBasics(type){
  var common=[
    {title:'Profit vs Cash',body:'Profit is not cash. You can be profitable and still broke. You can have cash and still be losing money.<br><br>Profit (P&L) = what you earned vs what you spent. Cash = what\'s actually in your bank. The gap between them is money you\'re owed, bills you haven\'t paid yet, or money you received early but haven\'t earned yet.<br><br><strong>If your profit looks good but your bank doesn\'t:</strong> you\'re not collecting fast enough, or you\'re spending ahead.'},
    {title:'Reconciliation',body:'Matching your books to your bank statement line by line. The goal: your book balance equals your statement balance when adjusted for timing differences.<br><br><strong>Deposits in transit</strong> — money you recorded in your books that hasn\'t shown up on the bank statement yet. Common at month-end when a check was mailed or a deposit was made after the statement cut. Your books are right; the bank just hasn\'t caught up.<br><br><strong>Outstanding checks</strong> — checks you\'ve written and recorded in your books that the recipient hasn\'t cashed yet. You\'ve reduced your book balance but the bank still shows the money. Subtract these from the bank balance to get your true position.<br><br><strong>Bank fees and service charges</strong> — monthly maintenance fees, wire fees, NSF charges. Log these as an expense entry in the Bank Fees category and tag the bank account they came from. They will flow through to your P&amp;L and reconciliation automatically. No journal entry needed.<br><br>The reconciliation formula: <em>Bank balance + deposits in transit − outstanding checks ± bank errors = your book balance.</em><br><br>If it doesn\'t balance, something is missing, duplicated, or recorded incorrectly. Fix it before looking at any reports — reconciliation is the foundation everything else stands on.<br><br><strong>Do it every month. No exceptions.</strong>'},
    {title:'Budget vs Actual',body:'What you planned vs what actually happened. This is where decisions come from.<br><br>Over budget → why? Under budget → missed opportunity or good control?<br><br><strong>If you\'re not reviewing this monthly, you\'re guessing.</strong>'},
    {title:'Burn Rate & Runway',body:'Burn rate = how fast you spend money each month. Runway = how long you can keep going at that pace.<br><br><strong>If burn rate exceeds income for 2+ months:</strong> cut something or increase revenue. Don\'t wait.'},
    {title:'Chart of Accounts',body:'Just your category system. It organizes everything: income, expenses, assets, liabilities.<br><br><strong>If this is messy, everything else will be messy.</strong> Keep categories consistent.'},
  ];
  var npExtra=[
    {title:'Fund Accounting',body:'Nonprofits track money by fund, not just category. Restricted funds can only be spent on specific programs. Unrestricted funds give flexibility.<br><br><strong>Always know which bucket money belongs to before spending it.</strong>'},
    {title:'Form 990',body:'This is not just a tax form. It\'s your public report. Donors, funders, and watchdogs look at it to see where your money comes from and how you spend it — especially how much goes to programs vs admin vs fundraising.<br><br><strong>If your numbers are messy here, it shows.</strong>'},
    {title:'Grant Burn Rate',body:'Not just how much you spent — it\'s whether you\'re spending at the right pace, following restrictions, and hitting deadlines.<br><br>Spending too slow → funds may lapse. Spending too fast → you run out early. Spending wrong → compliance issue.<br><br><strong>Check this monthly against your grant timeline, not just the total.</strong>'},
    {title:'Admin Cost Ratio',body:'How much you spend on admin vs programs. The real targets are tighter than most people think.<br><br>Best-in-class is under 10%. Charity Navigator and most serious funders want to see under 15%. Above 20% will raise questions. Above 25% requires a very clear explanation.<br><br>What actually matters: the number has to be defensible. If it\'s high because you invested in infrastructure that drives program impact, say so explicitly.<br><br><strong>Know your ratio before your funder asks. Never let it be a surprise.</strong>'},
  ];
  var sbExtra=[
    {title:'Accounts Receivable (AR)',body:'Money owed to you. You did the work, sent the invoice, just haven\'t been paid yet.<br><br>If it\'s over 60 days, that\'s a problem. Follow up. This is one of the fastest ways to fix cash flow.<br><br><strong>Profitable businesses fail because of slow collections. Don\'t let AR age.</strong>'},
    {title:'Cash vs Accrual',body:'Cash basis records money when it hits your bank. Accrual records when it\'s earned or owed.<br><br>Cash feels real. Accrual is more accurate. Most small businesses start cash and move to accrual as they grow.<br><br><strong>Know which one you\'re on — it changes how you read your numbers.</strong>'},
    {title:'1099 Contractors',body:'If you pay a contractor $600 or more in a calendar year, you must issue a 1099-NEC — regardless of whether you are a business, nonprofit, or individual. It is about who you pay, not what type of organization you are. Log contractor status when you add the expense and track payments as you go.<br><br><strong>Missing 1099s = IRS penalties. Don\'t wait until year-end to figure out who qualifies.</strong>'},
  ];
  var peExtra=[
    {title:'Net Worth',body:'Assets minus liabilities. This is your real financial score.<br><br>Track it annually at minimum. Growing net worth = you\'re building wealth. Flat or declining = something needs to change.<br><br><strong>Income alone doesn\'t tell you if you\'re getting ahead. Net worth does.</strong>'},
    {title:'Cash Flow Timing',body:'Income timing matters. If bills hit before your paycheck, you\'ll feel broke even when you\'re not.<br><br><strong>Map out when money comes in and when bills are due. Timing is everything.</strong>'},
  ];
  var items=common.concat(type==='np'?npExtra:type==='sb'?sbExtra:peExtra);
  return'<div>'
  +items.map(function(s){
    return'<div style="margin-bottom:1rem;padding:.85rem 1rem;background:var(--bg);border-radius:10px;border-left:3px solid var(--np)">'
    +'<div style="font-weight:600;font-size:13px;margin-bottom:.4rem">'+s.title+'</div>'
    +'<div style="font-size:12px;color:var(--muted);line-height:1.7">'+s.body+'</div>'
    +'</div>';
  }).join('')
  +'</div>';
}

// ── GLOSSARY ─────────────────────────────
function renderHelpGlossary(type){
  var terms=[
    {term:'Accrual Basis',def:'The method of accounting where revenue is recognized when earned and expenses are recognized when incurred — regardless of when cash changes hands. Required under GAAP for any nonprofit that undergoes an independent audit or issues audited financial statements. More accurate than cash basis because it matches revenue to the period it relates to and shows obligations as they arise, not just when they are paid.'},
    {term:'Accounts Payable (AP)',def:'Money you owe. Bills received but not yet paid. Timing matters — too slow damages relationships, too fast strains cash.'},
    {term:'Accounts Receivable (AR)',def:'Money owed to you. Invoices sent but not yet collected. Over 60 days old = follow up immediately.'},
    {term:'Admin Cost Ratio',def:'(NP) Management and general (admin) expenses as a percentage of total expenses — one of three categories on the Form 990 alongside program services and fundraising. Best-in-class is under 10%. Most serious funders and Charity Navigator target under 15%. Above 20% raises questions; above 25% requires a clear and documented explanation. Note: artificially suppressing admin costs by misclassifying expenses as program is a common audit finding and a Form 990 compliance risk. Know your real number and be ready to defend it accurately.'},
    {term:'Burn Rate',def:'How much you spend per month on average. Divide your cash on hand by your burn rate to get your runway. Healthy target is 18+ months of runway. Under 6 months means you need to act now — either cut costs or accelerate income. Under 3 months is a crisis.'},
    {term:'Cash Basis',def:'The method of accounting where revenue is recorded only when cash is received and expenses only when cash is paid. Simpler to maintain, but can paint a distorted picture — an organization may look financially healthy because large receivables haven\'t been collected yet, or appear to be struggling because a batch of bills hit before income arrived. Not compliant with GAAP and not suitable for audited financial statements.'},
    {term:'Chart of Accounts (COA)',def:'The organized list of all account categories used to classify transactions. If this is messy, everything else will be.'},
    {term:'Clarity by Telofin™ Score',def:'An internal management tool (0–100) measuring financial health across five weighted dimensions: Survival (30%), Performance (25%), Stability (20%), Efficiency (15%), and Resilience (10%). Based solely on data you have entered and may not reflect your complete financial picture. Should not be used as the sole basis for evaluating organizational health. Not an audit, review, compilation, or professional opinion. Always consult a licensed CPA or financial advisor before making significant financial or operational decisions.'},
    {term:'Current Ratio',def:'Current assets ÷ current liabilities. \'Current\' means amounts expected to be received or paid within 12 months — cash, accounts receivable, prepaid expenses on the asset side; accounts payable, accrued liabilities, and current portion of long-term debt on the liability side. Above 2.0 = strong liquidity. 1.0–2.0 = adequate but monitor. Below 1.0 = short-term obligations exceed liquid assets — a cash flow risk. Note: this ratio measures liquidity, not reserves. Nonprofits should separately target 3–6 months of unrestricted operating reserves as a financial cushion.'},
    {term:'Deferred Revenue',def:'Cash received but not yet earned — so it sits on your balance sheet as a liability until you deliver the goods or services. Common examples: grants paid upfront for a future program period, annual membership dues paid in advance, and event ticket sales before the event. Note: unconditional pledges are generally recognized as revenue immediately under ASC 958, not deferred. Conditional grants or pledges — where the organization must first overcome a barrier — are deferred until the condition is met. You cannot recognize deferred revenue as income until you have fulfilled the obligation.'},
    {term:'Deposits in Transit',def:'Deposits you\'ve recorded in your books that haven\'t appeared on the bank statement yet — typically because they were made after the statement cut-off date. Add these to the bank balance when reconciling. Your books are correct; the bank just hasn\'t caught up.'},
    {term:'Fiscal Year',def:'Your organization\'s 12-month accounting period. It doesn\'t have to match the calendar year. Many nonprofits use July 1–June 30 or October 1–September 30 to align with grant cycles or program seasons. All your financial reporting, budgeting, and tax filings are organized around this period.'},
    {term:'Form 990',def:'(NP) The annual information return filed with the IRS by tax-exempt organizations. It is a public document — donors, funders, journalists, and watchdog sites like Charity Navigator and GuideStar use it to evaluate your organization. Due 4.5 months after your fiscal year end (May 15 for calendar-year filers), with an automatic 6-month extension available. Failure to file for three consecutive years results in automatic revocation of your federal tax-exempt status. How you classify expenses between program, management, and fundraising on Part IX (Statement of Functional Expenses) directly affects how the public and funders perceive your efficiency. Schedule O is the supplemental narrative — use it to explain unusual ratios or significant changes.'},
    {term:'Fund Accounting',def:'(NP) A system of accounting where resources are classified into self-balancing sets of accounts called funds, each representing a specific purpose or restriction. Required under GAAP for nonprofits that issue audited financial statements. Each fund has its own assets, liabilities, and net assets that must balance independently. The purpose is accountability — ensuring that restricted resources are used only as the donor or grantor intended. Spending restricted funds on an unintended purpose is a compliance violation, not just a bookkeeping error.'},
    {term:'General Ledger (GL)',def:'The complete record of all financial transactions, organized by account. The source of truth for your books.'},
    {term:'In-Kind Contributions',def:'(NP) Non-cash donations of goods or services. Under ASC 958 (GAAP for nonprofits), in-kind contributions must be recorded at fair market value as both contribution revenue and expense. Donated goods, use of facilities, and professional services (legal, accounting, medical, engineering, etc.) that would otherwise be purchased must be recorded. However, general volunteer labor — someone stuffing envelopes or serving at an event — is generally not recognized unless the volunteer is contributing a specialized professional skill they would normally charge for. Misrecording general volunteer time as in-kind revenue is a common audit finding. Significant in-kind contributions must be disclosed on the Form 990.'},
    {term:'Net Assets',def:'(NP) The nonprofit equivalent of equity — total assets minus total liabilities. Under FASB ASU 2016-14 (effective for fiscal years beginning after December 15, 2017), net assets are classified into two categories: <strong>net assets without donor restrictions</strong> (formerly called unrestricted — available for general operations) and <strong>net assets with donor restrictions</strong> (formerly called temporarily or permanently restricted — must be used as the donor specified). The old three-category terminology is no longer GAAP-compliant. Funders and auditors focus on net assets without donor restrictions as your true operating cushion — it\'s what you can actually spend when needed.'},
    {term:'Net Surplus / Net Income',def:'Income minus expenses for a given period. Positive = surplus or profit. Negative = deficit or loss. Does not equal cash — you can be profitable and still broke. For nonprofits, a 3–7% surplus is a healthy target: enough to build reserves without appearing to hoard. A very large surplus may concern funders who wonder why the money isn\'t going to mission.'},
    {term:'Outstanding Checks',def:'Checks you\'ve written and recorded in your books that the payee hasn\'t cashed yet. The bank still shows the full balance, but you know that money is spoken for. Subtract outstanding checks from the bank balance when reconciling.'},
    {term:'Program Efficiency',def:'(NP) The percentage of total expenses allocated to program services — the direct delivery of your mission. Charity Navigator awards its highest ratings at 75% or above. Most institutional funders look for at least 75% going to programs. Below 65% raises questions that require explanation. Total expenses are split three ways on the Form 990: program services, management and general (admin), and fundraising. These three must sum to 100%. A typical healthy distribution might be 80% program / 10% admin / 10% fundraising — but context matters. A young organization building infrastructure may have higher admin costs temporarily. A development-heavy organization may have higher fundraising costs. What matters is that the allocation is accurate, consistent, and defensible.'},
    {term:'Reconciliation',def:'Matching your book balance to your bank statement balance. They rarely match exactly — the difference is explained by deposits in transit (recorded in your books but not yet on the statement) and outstanding checks (written and recorded but not yet cashed). Bank balance + deposits in transit − outstanding checks = your book balance. If it still doesn\'t balance, something is missing or wrong.'},
    {term:'Restricted Funds',def:'(NP) Resources that carry donor-imposed restrictions on how or when they may be used. There are two types: <strong>purpose restrictions</strong> (must be spent on a specific program or activity) and <strong>time restrictions</strong> (cannot be used until a specified date or event). Critically, these are distinct from <strong>board-designated funds</strong> — money set aside by the board for a specific purpose. Board-designated funds are legally unrestricted and can be un-designated by a board vote. Donor-restricted funds cannot. Confusing the two is a common governance error. Spending donor-restricted funds on an unauthorized purpose is a legal compliance issue, not just an accounting one.'},
    {term:'Runway',def:'How many months you can operate at current burn rate before running out of cash. Healthy target is 18+ months. 12–17 months = watch closely. Under 6 months = take action. Under 3 months = crisis.'},
    {term:'1099-NEC',def:'Required for anyone — business, nonprofit, or individual — who pays a contractor or self-employed person $600 or more in a calendar year. It\'s about who you pay, not what type of organization you are. Track contractor payments as you go. Missing a 1099 can mean IRS penalties. Don\'t wait until year-end to figure out who qualifies.'}
  ];
  return'<div>'
  +terms.map(function(t){
    return'<div style="display:flex;gap:12px;padding:.5rem 0;border-bottom:1px solid var(--bg);align-items:flex-start">'
    +'<span style="font-weight:600;font-size:12px;min-width:155px;color:var(--text);flex-shrink:0">'+t.term+'</span>'
    +'<span style="font-size:12px;color:var(--muted);line-height:1.6">'+t.def+'</span>'
    +'</div>';
  }).join('')
  +'</div>';
}

// ══════════════════════════════════════════
// ONBOARDING
// ══════════════════════════════════════════
var _obClientId=null;

function showOnboarding(clientId){
  _obClientId=clientId;
  var c=D.clients.find(function(x){return x.id===clientId;});
  if(!c||c.onboardingComplete)return;
  // Pre-fill from existing client data
  var nm=g('ob-name');if(nm)nm.value=c.name&&c.name!==('My '+tl(c.type))&&c.name!==('New '+tl(c.type))?c.name:'';
  var tp=g('ob-type');if(tp)tp.value=c.type||'np';
  var fye=g('ob-fye');if(fye)fye.value=c.fiscalYearEnd||'12/31';
  var basis=g('ob-basis');if(basis)basis.value=c.basisType||'accrual';
  obSetStep(1);
  openM('m-onboard');
}

function obTypeChange(){
  var tp=g('ob-type');if(!tp)return;
  var basis=g('ob-basis');
  if(basis)basis.value=defaultBasis(tp.value);
}

function obSetStep(n){
  [1,2,3].forEach(function(s){
    var el=g('ob-step-'+s);if(el)el.style.display=s===n?'block':'none';
    var dot=g('ob-dot-'+s);
    if(dot)dot.style.background=s===n?'var(--accent)':s<n?'var(--green)':'var(--border)';
  });
  var titles={1:'Step 1 of 3 — Organization',2:'Step 2 of 3 — Fiscal year',3:'Step 3 of 3 — Chart of accounts'};
  var t=g('ob-title');if(t)t.textContent=titles[n]||'Setup';
  if(n===3)obBuildCoaOpts();
}

function obBuildCoaOpts(){
  var tp=g('ob-type');var type=tp?tp.value:'np';
  var opts=g('ob-coa-opts');var note=g('ob-coa-note');if(!opts)return;
  var templates={
    np:{label:'Nonprofit standard',desc:'Includes donation income, grant tracking, restricted/unrestricted net assets, and functional expense categories aligned to Form 990 Part IX.'},
    sb:{label:'Small business standard',desc:'Includes sales/service revenue, COGS, accounts payable/receivable, owner equity, and common operating expense categories.'},
    pe:{label:'Personal finance',desc:'Includes employment income, housing, food, transportation, and other common personal expense categories.'}
  };
  var t=templates[type]||templates.np;
  opts.innerHTML='<label style="display:flex;align-items:flex-start;gap:10px;padding:.75rem;border:1.5px solid var(--accent);border-radius:8px;cursor:pointer;background:var(--soft)">'
    +'<input type="radio" name="ob-coa" value="default" checked style="margin-top:2px">'
    +'<div><div style="font-weight:500;font-size:13px">'+t.label+'</div>'
    +'<div style="font-size:11px;color:var(--muted);margin-top:2px">'+t.desc+'</div></div></label>'
    +'<label style="display:flex;align-items:flex-start;gap:10px;padding:.75rem;border:1px solid var(--border);border-radius:8px;cursor:pointer">'
    +'<input type="radio" name="ob-coa" value="blank" style="margin-top:2px">'
    +'<div><div style="font-weight:500;font-size:13px">Start blank</div>'
    +'<div style="font-size:11px;color:var(--muted);margin-top:2px">No pre-built accounts. Add your own chart of accounts from scratch.</div></div></label>';
  if(note)note.textContent=type==='np'?'Tip: Accrual basis + the nonprofit COA template is the recommended setup for 990 filers.':type==='sb'?'Tip: Your accountant may have a preferred COA — you can always edit accounts under Settings.':'Tip: You can rename or remove any category that doesn\'t fit your situation.';
}

function obNext(step){
  if(step===1){
    var nm=g('ob-name').value.trim();
    if(!nm){alert('Please enter an organization name.');return;}
    obSetStep(2);
  } else if(step===2){
    obSetStep(3);
  }
}

function obBack(step){
  obSetStep(step-1);
}

function obFinish(){
  var c=D.clients.find(function(x){return x.id===_obClientId;});
  if(!c)return;
  // Apply step 1
  var nm=g('ob-name').value.trim();if(nm)c.name=nm;
  c.type=g('ob-type').value||c.type;
  // Apply step 2
  c.fiscalYearEnd=g('ob-fye').value||'12/31';
  c.basisType=g('ob-basis').value||'accrual';
  // Apply step 3 — COA template
  var coaSel=document.querySelector('input[name="ob-coa"]:checked');
  if(coaSel&&coaSel.value==='default'){
    c.accounts=getDefaultCOA(c.type);
  }
  c.onboardingComplete=true;
  sv();
  // Refresh UI with new name/type
  renderSB();renderMobSel();
  if(typeof buildDynMods==='function')buildDynMods(c.type);
  renderAll();
  // Update dashboard header
  var dn=g('d-name');if(dn)dn.textContent=c.name;
  var dav=g('d-av');if(dav){dav.textContent=ini(c.name);dav.className='d-av '+avc(c.type);}
  closeM('m-onboard');
}

// ══════════════════════════════════════════
// DOCUMENT VAULT
// ══════════════════════════════════════════
var DOC_CATS_NP=['Tax Returns','Sales Tax Exempt Certificate','Articles of Incorporation','Grant Agreements','Audit Reports','Board Minutes','W-9 / W-2','1099s','Insurance','Contracts','Other'];
var DOC_CATS_SB=['Tax Returns','Sales Tax Docs','Business License','Contracts','Insurance','W-9 / 1099','Bank Statements','Payroll Records','Other'];
var DOC_CATS_PE=['Tax Returns','Insurance','Mortgage / Lease','Medical Records','Other'];

function _vaultCats(type){return type==='np'?DOC_CATS_NP:type==='sb'?DOC_CATS_SB:DOC_CATS_PE;}

function renderDocumentVault(c){
  var p=g('p-vault');if(!p||!c)return;
  // Auth gate
  if(!isSignedIn()){
    p.innerHTML='<div style="max-width:480px;margin:3rem auto;text-align:center;padding:2rem">'
      +'<div style="font-size:2rem;margin-bottom:1rem"><i class="fas fa-paperclip"></i></div>'
      +'<div style="font-size:16px;font-weight:600;margin-bottom:.5rem">Sign in to access your document vault</div>'
      +'<div style="font-size:13px;color:var(--muted);margin-bottom:1.5rem;line-height:1.6">Receipts, invoices, tax returns, certificates and more — securely stored and tied to your account.</div>'
      +'<button class="sv-btn" onclick="showAuthScreen()" style="max-width:200px;margin:0 auto">Sign in</button>'
      +'</div>';
    return;
  }
  if(!c.documents)c.documents=[];
  var cats=_vaultCats(c.type);
  // Filter state
  var activeCat=window._vaultCat||'All';
  var filtered=activeCat==='All'?c.documents:c.documents.filter(function(d){return d.category===activeCat;});
  // Category filter pills
  var allCats=['All'].concat(cats);
  var pills=allCats.map(function(cat){
    var count=cat==='All'?c.documents.length:c.documents.filter(function(d){return d.category===cat;}).length;
    var active=cat===activeCat;
    return'<button onclick="window._vaultCat=\''+escHtml(cat)+'\';renderDocumentVault(gc())" style="font-size:11px;padding:4px 10px;border-radius:20px;border:1px solid '+(active?'var(--accent)':'var(--border)')+';background:'+(active?'var(--accent)':'var(--surface)')+';color:'+(active?'#fff':'var(--text)')+';cursor:pointer;white-space:nowrap">'+escHtml(cat)+(count>0?' ('+count+')':'')+'</button>';
  }).join('');
  // Document rows
  var rows=filtered.length?filtered.map(function(doc){
    var ext=(doc.name||'').split('.').pop().toLowerCase();
    var icon=ext==='pdf'?'<i class="fas fa-file"></i>':ext==='xlsx'||ext==='csv'?'<i class="fas fa-chart-column"></i>':ext==='docx'?'<i class="fas fa-pen-to-square"></i>':(ext==='jpg'||ext==='jpeg'||ext==='png'||ext==='heic')?'<i class="fas fa-image"></i>':'<i class="fas fa-paperclip"></i>';
    var sz=doc.size?_fmtSize(doc.size):'';
    var dt=doc.uploadedAt?new Date(doc.uploadedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'';
    return'<tr>'
      +'<td style="font-size:15px;width:28px">'+icon+'</td>'
      +'<td style="font-weight:500;font-size:12px">'+escHtml(doc.name||'Untitled')+'</td>'
      +'<td><span class="badge b-blue" style="font-size:10px">'+escHtml(doc.category||'Other')+'</span></td>'
      +'<td style="font-size:11px;color:var(--muted)">'+escHtml(doc.notes||'')+'</td>'
      +'<td style="font-size:11px;color:var(--muted);white-space:nowrap">'+sz+'</td>'
      +'<td style="font-size:11px;color:var(--muted);white-space:nowrap">'+dt+'</td>'
      +'<td><div class="row-acts">'
        +'<button class="e-btn" onclick="vaultOpen(\''+escHtml(doc.id)+'\')" title="View" style="color:var(--accent)">View</button>'
        +(doc.linkedTo?'<button class="e-btn" title="Linked to transaction" style="color:var(--muted);cursor:default"><i class="fas fa-link"></i></button>':'')
        +'<button class="d-btn" onclick="vaultDelete(\''+escHtml(doc.id)+'\')" title="Delete">&#215;</button>'
      +'</div></td>'
      +'</tr>';
  }).join(''):'<tr><td colspan="7" style="text-align:center;padding:2.5rem;color:var(--muted);font-size:13px">No documents in this category yet.</td></tr>';

  p.innerHTML='<div class="card">'
    +'<div class="c-head"><span class="c-title"><i class="fas fa-paperclip"></i> Document Vault</span>'
    +'<button class="add-btn" onclick="vaultOpenUpload()">+ Upload document</button></div>'
    +'<p style="font-size:12px;color:var(--muted);margin:0 0 1rem;line-height:1.5">Store tax returns, exemption certificates, grant agreements, board minutes, W-9s, and more. Files are private and tied to your account.</p>'
    +'<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:1rem">'+pills+'</div>'
    +(filtered.length||activeCat==='All'?'<table><thead><tr><th style="width:28px"></th><th>File</th><th>Category</th><th>Notes</th><th>Size</th><th>Uploaded</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>':'<div style="color:var(--muted);font-size:13px;text-align:center;padding:2rem">No documents yet in this category.</div>')
    +'</div>'
    // Receipt section (linked)
    +_vaultLinkedSection(c);
}

function _fmtSize(bytes){
  if(!bytes)return'';
  if(bytes<1024)return bytes+'B';
  if(bytes<1024*1024)return Math.round(bytes/1024)+'KB';
  return(bytes/(1024*1024)).toFixed(1)+'MB';
}

function _vaultLinkedSection(c){
  // Show all expenses/bills with attached receipts
  var expWithReceipt=(c.expenses||[]).filter(function(e){return e.receiptPath||e.receiptUrl;});
  var billsWithInvoice=(c.bills||[]).filter(function(b){return b.invoicePath||b.invoiceUrl;});
  if(!expWithReceipt.length&&!billsWithInvoice.length)return'';
  var rows='';
  expWithReceipt.forEach(function(e,i){
    var oi=(c.expenses||[]).indexOf(e);
    rows+='<tr><td style="font-size:15px"><i class="fas fa-receipt"></i></td><td style="font-size:12px;font-weight:500">'+escHtml(e.desc||'Expense')+'</td><td><span class="badge b-amber" style="font-size:10px">Receipt</span></td><td style="font-size:11px;color:var(--muted)">'+(e.date||'')+'</td><td style="font-size:11px;color:var(--muted)">'+fmt(e.amt)+'</td><td><div class="row-acts"><button class="e-btn" onclick="vaultViewReceipt(\'expenses\','+oi+')" style="color:var(--accent)">View</button><button class="d-btn" onclick="vaultDetachReceipt(\'expenses\','+oi+')">&#215;</button></div></td></tr>';
  });
  billsWithInvoice.forEach(function(b){
    var oi=(c.bills||[]).indexOf(b);
    rows+='<tr><td style="font-size:15px"><i class="fas fa-file"></i></td><td style="font-size:12px;font-weight:500">'+escHtml(b.vendor||'Bill')+(b.desc?' — '+escHtml(b.desc):'')+'</td><td><span class="badge b-amber" style="font-size:10px">Invoice</span></td><td style="font-size:11px;color:var(--muted)">'+(b.received||b.due||'')+'</td><td style="font-size:11px;color:var(--muted)">'+fmt(b.amt)+'</td><td><div class="row-acts"><button class="e-btn" onclick="vaultViewBillInvoice('+oi+')" style="color:var(--accent)">View</button><button class="d-btn" onclick="vaultDetachBillInvoice('+oi+')">&#215;</button></div></td></tr>';
  });
  return'<div class="card" style="margin-top:1rem">'
    +'<div class="c-title" style="margin-bottom:.75rem"><i class="fas fa-receipt"></i> Attached receipts &amp; invoices</div>'
    +'<table><thead><tr><th style="width:28px"></th><th>Description</th><th>Type</th><th>Date</th><th>Amount</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>'
    +'</div>';
}

// ── Vault upload modal open ─────────────────────────────────────────────────
function vaultOpenUpload(linkedTo,linkedType,linkedOi){
  // Auth gate — must be signed in to upload (Supabase storage requires auth)
  if(!isSignedIn()){
    showAuthScreen();
    return;
  }
  // linkedTo: optional txn id (for receipt attachments)
  window._vaultUploadLinkedTo=linkedTo||null;
  window._vaultUploadLinkedType=linkedType||null;
  window._vaultUploadLinkedOi=linkedOi!=null?linkedOi:null;
  var c=gc();if(!c)return;
  var cats=_vaultCats(c.type);
  var catOpts=cats.map(function(cat){return'<option>'+escHtml(cat)+'</option>';}).join('');
  var m=g('m-doc-upload');if(!m)return;
  g('doc-name').value='';
  g('doc-notes').value='';
  var catSel=g('doc-cat');if(catSel)catSel.innerHTML=catOpts;
  g('doc-file').value='';
  var lbl=g('doc-upload-title');
  if(lbl)lbl.textContent=linkedTo?'Attach receipt / invoice':'Upload document';
  var stEl=g('doc-upload-status');if(stEl)stEl.textContent='';
  openM('m-doc-upload');
  setTimeout(function(){var fi=g('doc-file');if(fi)fi.click();},200);
}

// ── Auto-fill name from file picker ────────────────────────────────────────
function vaultFileChosen(){
  var fi=g('doc-file');if(!fi||!fi.files||!fi.files[0])return;
  var f=fi.files[0];
  var nameEl=g('doc-name');if(nameEl&&!nameEl.value)nameEl.value=f.name;
}

// ── Upload handler ──────────────────────────────────────────────────────────
async function vaultSaveUpload(){
  var c=gc();if(!c)return;
  var fi=g('doc-file');
  if(!fi||!fi.files||!fi.files[0]){alert('Please choose a file.');return;}
  var file=fi.files[0];
  var name=(g('doc-name').value||'').trim()||file.name;
  var cat=g('doc-cat').value||'Other';
  var notes=(g('doc-notes').value||'').trim();
  var stEl=g('doc-upload-status');
  if(stEl){stEl.style.color='var(--muted)';stEl.textContent='Uploading…';}
  var btn=g('doc-upload-btn');if(btn)btn.disabled=true;
  var res=await storageUpload(c.id,file);
  if(res.error){
    var msg=res.error;
    if(/bucket/i.test(msg))msg='Document storage is not available yet — please contact support.';
    else if(/not signed in/i.test(msg))msg='Please sign in to upload documents.';
    else if(/10 mb|file must/i.test(msg))msg='File is too large. Please use a file under 10 MB.';
    if(stEl){stEl.style.color='var(--red)';stEl.textContent='Upload failed: '+msg;}
    if(btn)btn.disabled=false;
    return;
  }
  var docId=uid();
  var linkedTo=window._vaultUploadLinkedTo||null;
  var linkedType=window._vaultUploadLinkedType||null;
  var linkedOi=window._vaultUploadLinkedOi;
  var docEntry={id:docId,name:name,category:cat,path:res.path,size:file.size,mimeType:file.type,uploadedAt:new Date().toISOString(),notes:notes,linkedTo:linkedTo||''};
  if(!c.documents)c.documents=[];
  c.documents.push(docEntry);
  // Wire into transaction if this is a receipt/invoice attachment
  if(linkedType==='expenses'&&linkedOi!=null&&c.expenses[linkedOi]){
    c.expenses[linkedOi].receiptPath=res.path;
    c.expenses[linkedOi].receiptUrl='';// clear legacy URL — path is authoritative
  }else if(linkedType==='bills'&&linkedOi!=null&&c.bills[linkedOi]){
    c.bills[linkedOi].invoicePath=res.path;
    c.bills[linkedOi].invoiceUrl='';
  }
  sv();
  if(stEl){stEl.style.color='var(--green)';stEl.innerHTML='Uploaded <i class="fas fa-check"></i>';}
  // PDF import offer — if uploaded file is a PDF, offer to import its data
  if(file.name.toLowerCase().endsWith('.pdf')&&typeof pdfMaybeImport==='function'){
    setTimeout(function(){pdfMaybeImport(file,c.id);},900);
  }
  setTimeout(function(){closeM('m-doc-upload');renderDocumentVault(gc());renderAll();},700);
}

// ── Open/view a vault document by id ───────────────────────────────────────
async function vaultOpen(docId){
  var c=gc();if(!c)return;
  var doc=(c.documents||[]).find(function(d){return d.id===docId;});
  if(!doc||!doc.path){alert('Document not found.');return;}
  var url=await storageSignedUrl(doc.path,3600);
  if(!url){alert('Could not generate a view link. Please try again.');return;}
  window.open(url,'_blank');
}

// ── Delete a vault document ─────────────────────────────────────────────────
async function vaultDelete(docId){
  var c=gc();if(!c)return;
  var idx=(c.documents||[]).findIndex(function(d){return d.id===docId;});
  if(idx<0)return;
  var doc=c.documents[idx];
  if(!confirm('Delete "'+doc.name+'"? This cannot be undone.'))return;
  if(doc.path)await storageDelete(doc.path);
  c.documents.splice(idx,1);
  sv();renderDocumentVault(c);
}

// ── Receipt attachment on expense rows ──────────────────────────────────────
function vaultAttachReceipt(col,oi){
  if(!isSignedIn()){alert('Please sign in to attach receipts.');showAuthScreen();return;}
  var c=gc();if(!c)return;
  var txn=(c[col]||[])[oi];if(!txn)return;
  vaultOpenUpload(txn.id,col,oi);
  var catSel=g('doc-cat');if(catSel){// default to relevant category
    for(var i=0;i<catSel.options.length;i++){if(catSel.options[i].value==='Other'){catSel.selectedIndex=i;break;}}
  }
}

async function vaultViewReceipt(col,oi){
  var c=gc();if(!c)return;
  var txn=(c[col]||[])[oi];if(!txn)return;
  if(txn.receiptPath){
    var url=await storageSignedUrl(txn.receiptPath,3600);
    if(url){window.open(url,'_blank');return;}
  }
  if(txn.receiptUrl){window.open(txn.receiptUrl,'_blank');return;}
  alert('No receipt attached.');
}

function vaultDetachReceipt(col,oi){
  var c=gc();if(!c)return;
  var txn=(c[col]||[])[oi];if(!txn)return;
  if(!confirm('Remove receipt attachment from this expense?'))return;
  txn.receiptPath='';txn.receiptUrl='';
  sv();renderDocumentVault(c);renderAll();
}

// ── Invoice attachment on bill rows ─────────────────────────────────────────
function vaultAttachBillInvoice(oi){
  if(!isSignedIn()){alert('Please sign in to attach invoices.');showAuthScreen();return;}
  var c=gc();if(!c)return;
  var bill=(c.bills||[])[oi];if(!bill)return;
  vaultOpenUpload(bill.id,'bills',oi);
}

async function vaultViewBillInvoice(oi){
  var c=gc();if(!c)return;
  var bill=(c.bills||[])[oi];if(!bill)return;
  if(bill.invoicePath){
    var url=await storageSignedUrl(bill.invoicePath,3600);
    if(url){window.open(url,'_blank');return;}
  }
  if(bill.invoiceUrl){window.open(bill.invoiceUrl,'_blank');return;}
  alert('No invoice attached.');
}

function vaultDetachBillInvoice(oi){
  var c=gc();if(!c)return;
  var bill=(c.bills||[])[oi];if(!bill)return;
  if(!confirm('Remove invoice attachment from this bill?'))return;
  bill.invoicePath='';bill.invoiceUrl='';
  sv();renderDocumentVault(c);renderAll();
}

// ══════════════════════════════════════════
// FISCAL SPONSORSHIP
// ══════════════════════════════════════════
var _fsEI=-1;// current fiscal sponsorship edit index

function renderFiscalSponsorships(c){
  if(!c||c.type!=='np')return'';
  var fs=c.fiscalSponsorships||[];
  var rows=fs.map(function(sp,i){
    var bal=Number(sp.fundsReceived||0)-Number(sp.fundsExpended||0);
    var statColor=sp.status==='active'?'b-green':'b-grey';
    return'<tr>'
      +'<td style="font-weight:500">'+escHtml(sp.sponsorName||'—')+'</td>'
      +'<td>'+escHtml(sp.projectName||'—')+'</td>'
      +'<td>'+fmt(sp.fundsReceived||0)+'</td>'
      +'<td>'+fmt(sp.fundsExpended||0)+'</td>'
      +'<td class="'+(bal<0?'vr':'vg')+'">'+fmt(bal)+'</td>'
      +'<td><span class="badge '+statColor+'" style="text-transform:capitalize">'+escHtml(sp.status||'active')+'</span></td>'
      +'<td>'
        +'<button class="e-btn" onclick="editFiscalSponsor('+i+')">&#9998; Edit</button> '
        +'<button class="e-btn" style="color:var(--red)" onclick="deleteFiscalSponsor('+i+')">&#x2715;</button>'
      +'</td>'
    +'</tr>';
  }).join('');
  return'<div class="card" style="margin-top:1rem">'
    +'<div class="c-head"><span class="c-title">Fiscal Sponsorships</span>'
    +'<button class="add-btn" onclick="_fsEI=-1;resetFiscalSponsorForm();openM(\'m-fiscal-sponsor\')">+ Add</button>'
    +'</div>'
    +'<p style="font-size:12px;color:var(--muted);margin:0 0 .75rem;line-height:1.5">IRS Treasury guidance (Apr 2026) requires disclosure of fiscal sponsorship arrangements on Form 990. Track each arrangement here and attach your signed agreement in the Document Vault.</p>'
    +(fs.length
      ?'<table><thead><tr><th style="width:20%">Fiscal agent</th><th style="width:20%">Project</th><th style="width:12%">Received</th><th style="width:12%">Expended</th><th style="width:12%">Balance</th><th style="width:10%">Status</th><th style="width:14%"></th></tr></thead><tbody>'+rows+'</tbody></table>'
      :'<div style="font-size:13px;color:var(--muted);padding:.5rem 0">No fiscal sponsorships recorded yet.</div>')
    +'</div>';
}

function resetFiscalSponsorForm(){
  ['fs-sponsor','fs-project','fs-date','fs-recv','fs-exp','fs-restrict'].forEach(function(id){var el=g(id);if(el)el.value='';});
  var st=g('fs-status');if(st)st.value='active';
  var ttl=g('fs-modal-title');if(ttl)ttl.textContent='Add fiscal sponsorship';
}

function editFiscalSponsor(i){
  var c=gc();if(!c)return;
  var sp=(c.fiscalSponsorships||[])[i];if(!sp)return;
  _fsEI=i;
  g('fs-sponsor').value=sp.sponsorName||'';
  g('fs-project').value=sp.projectName||'';
  g('fs-date').value=sp.agreementDate||'';
  g('fs-recv').value=sp.fundsReceived||0;
  g('fs-exp').value=sp.fundsExpended||0;
  g('fs-restrict').value=sp.restrictions||'';
  g('fs-status').value=sp.status||'active';
  var ttl=g('fs-modal-title');if(ttl)ttl.textContent='Edit fiscal sponsorship';
  openM('m-fiscal-sponsor');
}

function deleteFiscalSponsor(i){
  var c=gc();if(!c)return;
  if(!confirm('Remove this fiscal sponsorship record?'))return;
  c.fiscalSponsorships.splice(i,1);
  sv();renderGrants(c);
}

function saveFiscalSponsor(){
  var c=gc();if(!c)return;
  var sponsor=(g('fs-sponsor').value||'').trim();
  var project=(g('fs-project').value||'').trim();
  if(!sponsor||!project){alert('Sponsor name and project name are required.');return;}
  if(!c.fiscalSponsorships)c.fiscalSponsorships=[];
  var rec={
    id:(_fsEI>=0&&c.fiscalSponsorships[_fsEI])?c.fiscalSponsorships[_fsEI].id:uid(),
    sponsorName:sponsor,
    projectName:project,
    agreementDate:g('fs-date').value||'',
    fundsReceived:Number(g('fs-recv').value||0),
    fundsExpended:Number(g('fs-exp').value||0),
    restrictions:g('fs-restrict').value||'',
    status:g('fs-status').value||'active'
  };
  if(_fsEI>=0&&c.fiscalSponsorships[_fsEI]){c.fiscalSponsorships[_fsEI]=rec;}else{c.fiscalSponsorships.push(rec);}
  sv();closeM('m-fiscal-sponsor');renderGrants(c);
}

// ══════════════════════════════════════════
// COMPLIANCE WARNING ENGINE
// ══════════════════════════════════════════
// Returns array of {sev:'red'|'amber'|'info', panel:str, msg:str}
function getComplianceWarnings(c){
  if(!c||c.type!=='np')return[];
  var warnings=[];
  var exp=(c.expenses||[]).filter(function(e){return!e.deleted&&!e.voided&&!e.isReversal;});
  var inc=(c.income||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;});
  var donors=(c.donors||[]);
  var npType=c.npType||'501c3';

  // 1. Founder / officer compensation — look for payroll or expense categories that suggest owner pay
  var payrollExp=exp.filter(function(e){
    var cat=(e.cat||'').toLowerCase(),desc=(e.desc||'').toLowerCase();
    return cat.indexOf('payroll')>=0||cat.indexOf('salary')>=0||cat.indexOf('compensation')>=0||cat.indexOf('officer')>=0||desc.indexOf('founder')>=0||desc.indexOf('owner salary')>=0||desc.indexOf('owner pay')>=0;
  });
  if(payrollExp.length&&npType==='501c3'){
    warnings.push({sev:'amber',panel:'expenses',msg:'Officer/founder compensation detected — confirm Part VII of Form 990 lists all officers paid over $100k. Excess benefit transactions are prohibited for 501(c)(3) organizations.'});
  }

  // 2. Self-dealing — vendor name matches a donor name or a known officer keyword
  var donorNames=donors.map(function(d){return(d.name||'').toLowerCase().trim();}).filter(Boolean);
  exp.forEach(function(e){
    var v=(e.desc||e.vendor||'').toLowerCase().trim();
    if(v&&donorNames.some(function(dn){return dn.length>3&&v.indexOf(dn)>=0;})){
      warnings.push({sev:'red',panel:'expenses',msg:'Possible self-dealing: expense "'+escHtml(e.desc||'')+'" may involve a donor or insider. Document the arm\'s-length nature or get board approval per IRS self-dealing rules.'});
    }
  });

  // 3. Government grant disclosure
  var govCats=['government grant','federal grant','state grant','county grant','city grant','municipal grant','hud','hhs','doj','dod','usda','epa','nsf','nih'];
  var govGrants=inc.filter(function(r){
    var cat=(r.cat||'').toLowerCase(),nm=(r.name||'').toLowerCase();
    return govCats.some(function(g){return cat.indexOf(g)>=0||nm.indexOf(g)>=0;});
  });
  if(govGrants.length){
    warnings.push({sev:'amber',panel:'income',msg:'Government grant(s) detected — new IRS Form 990 transparency requirements (Treasury Apr 2026) require enhanced disclosure of government funding sources and conditions. Verify Schedule I reporting.'});
  }

  // 4. Fiscal sponsorship — check if funds received vs expended are mismatched by category
  var fsList=c.fiscalSponsorships||[];
  fsList.forEach(function(sp){
    if(sp.status==='active'){
      var bal=Number(sp.fundsReceived||0)-Number(sp.fundsExpended||0);
      // Check expenses tagged to this project exist in expense log
      var matchedExp=exp.filter(function(e){return(e.desc||'').toLowerCase().indexOf((sp.projectName||'').toLowerCase())>=0;});
      if(bal>0&&matchedExp.length===0){
        warnings.push({sev:'amber',panel:'grants',msg:'Fiscal sponsorship "'+escHtml(sp.projectName)+'" has '+fmt(bal)+' unspent — no matching expenses found. Verify fund restrictions and expenditure tracking.'});
      }
      if(bal<0){
        warnings.push({sev:'red',panel:'grants',msg:'Fiscal sponsorship "'+escHtml(sp.projectName)+'" is over-expended by '+fmt(Math.abs(bal))+'. This may constitute a misuse of restricted funds.'});
      }
    }
  });

  // 5. Unrelated business income (UBIT) warning
  var ubitCats=['rental income','advertising','merchandise','investment income','interest income','dividend'];
  var ubitKeywords=['rent','rental','advertising','merchandise','investment','interest income','dividend'];
  var ubitInc=inc.filter(function(r){
    var cat=(r.cat||'').toLowerCase();
    var nm=(r.name||'').toLowerCase();
    return ubitCats.some(function(u){return cat.indexOf(u)>=0;})||ubitKeywords.some(function(u){return nm.indexOf(u)>=0;});
  });
  if(ubitInc.length&&npType==='501c3'){
    var ubitTotal=ubitInc.reduce(function(s,r){return s+Number(r.recv||r.proj||0);},0);
    if(ubitTotal>0){
      warnings.push({sev:'amber',panel:'income',msg:'Potential unrelated business income (UBIT) of '+fmt(ubitTotal)+' detected. If this income is regularly carried on and not substantially related to your exempt purpose, Form 990-T may be required.'});
    }
  }

  // 6. Non-501(c)(3) types — TechSoup ineligibility note
  if(npType==='501c4'||npType==='501c5'||npType==='501c6'){
    warnings.push({sev:'info',panel:'grants',msg:'Note: 501('+npType.replace('501','').replace('c','(c)')+')'+'  organizations do not qualify for TechSoup technology discount programs. Scholarship program eligibility also requires 501(c)(3) status.'});
  }

  // Deduplicate by msg
  var seen={};
  return warnings.filter(function(w){if(seen[w.msg])return false;seen[w.msg]=true;return true;});
}

function renderComplianceBanner(c){
  var warns=getComplianceWarnings(c);
  if(!warns.length)return'';
  var sevColor={red:'var(--red)',amber:'var(--amber)',info:'var(--blue)'};
  var sevBg={red:'#fff5f5',amber:'#fffbeb',info:'#f0f7ff'};
  var sevIcon={red:'<i class="fas fa-triangle-exclamation"></i>',amber:'<i class="fas fa-triangle-exclamation"></i>',info:'<i class="fas fa-circle-info"></i>'};
  return'<div style="margin-bottom:1rem">'
    +warns.map(function(w){
      return'<div style="display:flex;align-items:flex-start;gap:10px;padding:.75rem 1rem;background:'+sevBg[w.sev]+';border-left:3px solid '+sevColor[w.sev]+';border-radius:0 8px 8px 0;margin-bottom:6px;font-size:12px;line-height:1.5">'
        +'<span style="color:'+sevColor[w.sev]+';flex-shrink:0;font-size:14px">'+sevIcon[w.sev]+'</span>'
        +'<span style="color:var(--text)">'+w.msg+'</span>'
        +'</div>';
    }).join('')
    +'</div>';
}

// ══════════════════════════════════════════
// REIMBURSEMENTS MODULE
// ══════════════════════════════════════════
function renderReimbursements(cc){
  var c=cc||gc(),p=g('p-reimbursements');if(!p)return;if(!c)return;
  if(!c.reimbursements)c.reimbursements=[];
  var reimbs=c.reimbursements.filter(function(r){return!r.deleted;});
  var pending=reimbs.filter(function(r){return r.status==='Pending';});
  var approved=reimbs.filter(function(r){return r.status==='Approved';});
  var paid=reimbs.filter(function(r){return r.status==='Paid';});
  var totalPending=pending.reduce(function(s,r){return s+Number(r.amt||0);},0);
  var totalApproved=approved.reduce(function(s,r){return s+Number(r.amt||0);},0);
  var totalPaid=paid.reduce(function(s,r){return s+Number(r.amt||0);},0);

  var now=new Date();
  var allRows=reimbs.map(function(r){
    var ri=c.reimbursements.indexOf(r);
    var submitDate=r.submitted?new Date(r.submitted):null;
    var daysOld=submitDate?Math.floor((now-submitDate)/(1000*60*60*24)):null;
    var noReceipt=!r.receiptPath&&!r.receiptUrl;
    var flagOld=noReceipt&&daysOld!==null&&daysOld>=30;
    var sev=r.status==='Paid'?'b-green':r.status==='Approved'?'b-blue':'b-amber';
    return'<tr>'
      +'<td style="font-weight:500">'+escHtml(r.who||'—')+'</td>'
      +'<td>'+escHtml(r.desc||'—')+'</td>'
      +'<td class="vg">'+fmt(r.amt)+'</td>'
      +'<td style="color:var(--muted);font-size:11px">'+(r.submitted?r.submitted.split('T')[0]:'—')+'</td>'
      +'<td style="color:var(--muted);font-size:11px">'+(r.cat||'—')+'</td>'
      +'<td><span class="badge '+sev+'">'+r.status+'</span></td>'
      +'<td>'+(noReceipt?'<span style="color:var(--red)" title="No receipt"><i class="fas fa-file"></i><i class="fas fa-flag"></i></span>'+(flagOld?' <span style="font-size:10px;color:var(--red)">('+daysOld+'d)</span>':''):'<span style="color:var(--green)"><i class="fas fa-check"></i></span>')+'</td>'
      +'<td><div style="display:flex;gap:4px;flex-wrap:wrap">'
      +(r.status==='Pending'?'<button class="e-btn" style="font-size:10px;padding:2px 7px" onclick="approveReimb(\''+r.id+'\')"><i class="fas fa-check"></i> Approve</button>':'')
      +(r.status==='Approved'?'<button class="sv-btn" style="font-size:10px;padding:2px 7px" onclick="markReimbPaid(\''+r.id+'\')"><i class="fas fa-credit-card"></i> Paid</button>':'')
      +(r.receiptPath||r.receiptUrl?'<button class="e-btn" style="font-size:10px;padding:2px 7px" onclick="viewReimbReceipt(\''+r.id+'\')"><i class="fas fa-file"></i></button>':'')
      +'<button class="e-btn" style="font-size:10px;padding:2px 7px" onclick="REIMB_EI='+ri+';openReimbModal()"><i class="fas fa-pen"></i></button>'
      +'<button class="d-btn" style="font-size:10px;padding:2px 7px" onclick="deleteReimb(\''+r.id+'\')"><i class="fas fa-xmark"></i></button>'
      +'</div></td>'
      +'</tr>';
  }).join('');

  p.innerHTML=FB()+XB('reimbursements')
    +'<div class="metrics">'
    +'<div class="metric"><div class="m-lbl">Pending</div><div class="m-val va">'+fmt(totalPending)+'</div></div>'
    +'<div class="metric"><div class="m-lbl">Approved</div><div class="m-val vb">'+fmt(totalApproved)+'</div></div>'
    +'<div class="metric"><div class="m-lbl">Paid</div><div class="m-val vg">'+fmt(totalPaid)+'</div></div>'
    +'</div>'
    +'<div class="card"><div class="c-head"><span class="c-title">Reimbursement requests</span><button class="add-btn" onclick="REIMB_EI=-1;openReimbModal()">+ New request</button></div>'
    +(reimbs.length
      ?'<div style="overflow-x:auto"><table><thead><tr>'
        +'<th style="width:13%">Requestor</th><th style="width:20%">Description</th>'
        +'<th style="width:8%">Amount</th><th style="width:10%">Submitted</th>'
        +'<th style="width:10%">Category</th><th style="width:9%">Status</th>'
        +'<th style="width:7%">Receipt</th><th style="width:23%">Actions</th>'
        +'</tr></thead><tbody>'+allRows+'</tbody></table></div>'
      :'<div style="padding:2rem;text-align:center;color:var(--muted);font-size:13px">No reimbursement requests yet.<br>Click <strong>+ New request</strong> to submit one.</div>')
    +'</div>';
}

function openReimbModal(){
  var c=gc();if(!c)return;
  var r=REIMB_EI>=0&&c.reimbursements&&c.reimbursements[REIMB_EI]?c.reimbursements[REIMB_EI]:{};
  var existing=g('m-reimb');if(existing)existing.remove();
  var cats=c.type==='np'
    ?['Program expense','Administrative','Fundraising','Travel','Meals','Supplies','Technology','Other']
    :['Cost of goods','Operating expense','Travel','Meals','Supplies','Technology','Other'];
  var catOpts=cats.map(function(x){return'<option'+(r.cat===x?' selected':'')+'>'+x+'</option>';}).join('');
  var mo=document.createElement('div');
  mo.className='overlay';mo.id='m-reimb';
  mo.innerHTML='<div class="modal"><button class="cx" onclick="closeM(\'m-reimb\')">&#215;</button>'
    +'<div class="m-title">'+(REIMB_EI>=0?'Edit':'New')+' Reimbursement Request</div>'
    +'<div class="fr"><div class="fl" style="margin-bottom:0"><label>Requestor name *</label>'
    +'<input type="text" id="reimb-who" placeholder="Employee or volunteer name" value="'+escHtml(r.who||'')+'"></div>'
    +'<div class="fl" style="margin-bottom:0"><label>Amount ($) *</label>'
    +'<input type="number" id="reimb-amt" placeholder="0.00" value="'+(r.amt||'')+'" oninput="fmtAmt(this)"></div></div>'
    +'<div class="fl"><label>Description *</label>'
    +'<input type="text" id="reimb-desc" placeholder="What was this expense for?" value="'+escHtml(r.desc||'')+'"></div>'
    +'<div class="fr"><div class="fl" style="margin-bottom:0"><label>Category</label>'
    +'<div class="sw" style="width:100%"><select id="reimb-cat">'+catOpts+'</select></div></div>'
    +'<div class="fl" style="margin-bottom:0"><label>Date of expense</label>'
    +'<input type="text" id="reimb-date" placeholder="MM/DD/YYYY" value="'+(r.date||'')+'" onblur="autoDate(this)" oninput="autoDate(this)"></div></div>'
    +'<div class="fl"><label>Receipt <span style="font-size:11px;color:var(--muted)">(PDF or image, max 10MB — strongly recommended)</span></label>'
    +'<input type="file" id="reimb-file" accept="application/pdf,image/*">'
    +(r.receiptUrl||r.receiptPath?'<div style="font-size:11px;color:var(--green);margin-top:4px"><i class="fas fa-check"></i> Receipt on file</div>':'')+'</div>'
    +'<div class="fl"><label>Or receipt URL</label>'
    +'<input type="text" id="reimb-url" placeholder="https://..." value="'+escHtml(r.receiptUrl||'')+'"></div>'
    +'<div class="fl"><label>Notes</label>'
    +'<textarea id="reimb-notes" placeholder="Additional context...">'+(r.notes||'')+'</textarea></div>'
    +'<button class="sv-btn" onclick="saveReimb()">Save request</button>'
    +'</div></div>';
  document.body.appendChild(mo);
  setTimeout(function(){mo.classList.add('open');},10);
}

async function saveReimb(){
  var c=gc();if(!c)return;
  if(!c.reimbursements)c.reimbursements=[];
  var who=g('reimb-who')&&g('reimb-who').value.trim();
  var amt=Number(g('reimb-amt')&&g('reimb-amt').value||0);
  var desc=g('reimb-desc')&&g('reimb-desc').value.trim();
  if(!who||!amt||!desc){alert('Please fill in requestor, amount, and description.');return;}
  var _ri=resolveEI(c.reimbursements);
  var existing=_ri>=0?c.reimbursements[_ri]:{};
  var item={
    id:_ri>=0?existing.id:uid(),
    who:who,amt:amt,desc:desc,
    cat:g('reimb-cat')&&g('reimb-cat').value||'',
    date:g('reimb-date')&&g('reimb-date').value||'',
    notes:g('reimb-notes')&&g('reimb-notes').value||'',
    receiptUrl:g('reimb-url')&&g('reimb-url').value.trim()||existing.receiptUrl||'',
    receiptPath:existing.receiptPath||'',
    status:existing.status||'Pending',
    submitted:existing.submitted||new Date().toISOString(),
    audit:existing.audit||[]
  };
  item.flagged=!item.receiptUrl&&!item.receiptPath;
  // File upload
  var fileInput=g('reimb-file');
  if(fileInput&&fileInput.files&&fileInput.files[0]){
    var upRes=await storageUpload(c.id,fileInput.files[0]);
    if(upRes&&upRes.path){item.receiptPath=upRes.path;item.flagged=false;}
    else if(upRes&&upRes.error)alert('Upload warning: '+upRes.error+'. Request saved without receipt.');
  }
  // Auto-create vendor with isMember:true
  if(who){
    if(!c.vendors)c.vendors=[];
    var existing_v=c.vendors.find(function(v){return(v.name||'').toLowerCase()===who.toLowerCase();});
    if(!existing_v)c.vendors.push({id:uid(),name:who,isMember:true,added:new Date().toISOString()});
  }
  item.audit.push({action:_ri>=0?'edited':'created',by:'user',timestamp:new Date().toISOString()});
  if(_ri>=0)c.reimbursements[_ri]=item;else c.reimbursements.push(item);
  sv();renderReimbursements(c);closeM('m-reimb');
}

function approveReimb(id){
  var c=gc();if(!c||!c.reimbursements)return;
  var r=c.reimbursements.find(function(x){return x.id===id;});if(!r)return;
  var noReceipt=!r.receiptPath&&!r.receiptUrl;
  var reason='';
  if(noReceipt){reason=prompt('No receipt attached. Enter reason for approving without receipt (required):');if(!reason)return;}
  r.status='Approved';r.approvedDate=new Date().toISOString();
  if(reason)r.noReceiptReason=reason;
  r.audit=(r.audit||[]);r.audit.push({action:'approved',reason:reason||'',timestamp:new Date().toISOString()});
  sv();renderReimbursements(c);
}

function markReimbPaid(id){
  var c=gc();if(!c||!c.reimbursements)return;
  var r=c.reimbursements.find(function(x){return x.id===id;});if(!r)return;
  if(!confirm('Mark this reimbursement as paid and post to expenses?\n\n'+escHtml(r.who)+' — '+fmt(r.amt)+'\n'+escHtml(r.desc)))return;
  r.status='Paid';r.paidDate=new Date().toISOString();
  r.audit=(r.audit||[]);r.audit.push({action:'paid',timestamp:new Date().toISOString()});
  // Post real expense
  var expItem={id:uid(),desc:'Reimbursement: '+r.desc+' ('+r.who+')',cat:r.cat||'Administrative',amt:r.amt,date:r.date||new Date().toISOString().split('T')[0],vendor1099:r.who,reimbId:r.id,isReimb:true};
  if(!c.expenses)c.expenses=[];
  c.expenses.push(expItem);
  if(typeof syncVendorFromExpense==='function')syncVendorFromExpense(c,expItem);
  if(typeof postToLedger==='function')postToLedger(c,expItem.acctCode||'5010',_defaultCashCode?_defaultCashCode(c):'1010',r.amt,'Reimbursement: '+r.desc,'expense',expItem.id);
  markDirty('reimbursements','npexp','sbexp','budget','reports');
  sv();renderReimbursements(c);
  if(typeof renderNpExp==='function')renderNpExp(c);
  if(typeof renderSbExp==='function')renderSbExp(c);
}

async function viewReimbReceipt(id){
  var c=gc();if(!c||!c.reimbursements)return;
  var r=c.reimbursements.find(function(x){return x.id===id;});if(!r)return;
  if(r.receiptPath){var url=await storageSignedUrl(r.receiptPath);if(url)window.open(url,'_blank');else alert('Could not load receipt.');}
  else if(r.receiptUrl)window.open(r.receiptUrl,'_blank');
  else alert('No receipt on file.');
}

function deleteReimb(id){
  var c=gc();if(!c||!c.reimbursements)return;
  if(!confirm('Delete this reimbursement request?'))return;
  var r=c.reimbursements.find(function(x){return x.id===id;});if(!r)return;
  r.deleted=true;sv();renderReimbursements(c);
}

// ══════════════════════════════════════════
// VENDOR / CUSTOMER SYNC BACKFILL
// ══════════════════════════════════════════
function syncAllVendors(){
  var c=gc();if(!c)return;
  if(!c.vendors)c.vendors=[];
  var added=0;
  (c.expenses||[]).forEach(function(e){
    if(typeof syncVendorFromExpense==='function')syncVendorFromExpense(c,e);
  });
  // Count new
  sv();
  if(typeof renderVendors==='function')renderVendors(c);
  alert('Vendor sync complete. Vendor list updated from all expenses.');
}

function syncAllCustomers(){
  var c=gc();if(!c||c.type!=='sb')return;
  if(!c.customers)c.customers=[];
  var names=new Set();
  (c.revenue||[]).forEach(function(r){if(r.name&&r.name.trim())names.add(r.name.trim());});
  (c.invoices||[]).forEach(function(inv){if(inv.customer&&inv.customer.trim())names.add(inv.customer.trim());});
  var added=0;
  names.forEach(function(n){
    var ex=c.customers.find(function(cu){return(cu.name||'').toLowerCase()===n.toLowerCase();});
    if(!ex){c.customers.push({id:uid(),name:n,added:new Date().toISOString()});added++;}
  });
  sv();
  if(typeof renderCustomers==='function')renderCustomers(c);
  alert('Customer sync complete. '+added+' new customer'+(added===1?'':'s')+' added.');
}

// ══════════════════════════════════════════
// DONOR INTERACTION LOG
// ══════════════════════════════════════════
function openInteractionModal(di){
  var dIdx=g('int-donor-idx');if(dIdx)dIdx.value=di;
  ['int-note','int-followup-note'].forEach(function(id){var el=g(id);if(el)el.value='';});
  ['int-date','int-followup','int-who'].forEach(function(id){var el=g(id);if(el)el.value='';});
  var dtype=g('int-type');if(dtype)dtype.value='Call';
  // Default date to today
  var today=new Date();var mm=String(today.getMonth()+1).padStart(2,'0');var dd=String(today.getDate()).padStart(2,'0');var yyyy=today.getFullYear();
  var dateEl=g('int-date');if(dateEl)dateEl.value=mm+'/'+dd+'/'+yyyy;
  openM('m-interaction');
}

function saveInteraction(){
  var c=gc();if(!c)return;
  var diEl=g('int-donor-idx');if(!diEl)return;
  var di=parseInt(diEl.value);
  if(isNaN(di)||!c.donors||!c.donors[di])return;
  var d=c.donors[di];
  var note=g('int-note')&&g('int-note').value.trim();
  if(!note){alert('Please enter interaction notes.');return;}
  if(!d.interactions)d.interactions=[];
  var item={
    id:uid(),
    type:g('int-type')&&g('int-type').value||'Note',
    date:g('int-date')&&g('int-date').value||new Date().toISOString().split('T')[0],
    who:g('int-who')&&g('int-who').value.trim()||'',
    note:note,
    followupDate:g('int-followup')&&g('int-followup').value||'',
    followupNote:g('int-followup-note')&&g('int-followup-note').value.trim()||'',
    completed:false,
    timestamp:new Date().toISOString()
  };
  d.interactions.push(item);
  sv();renderDonors(c);renderTodoBar();closeM('m-interaction');
}

function completeInteraction(di,ixi){
  var c=gc();if(!c||!c.donors||!c.donors[di])return;
  var ix=c.donors[di].interactions&&c.donors[di].interactions[ixi];if(!ix)return;
  ix.completed=true;ix.completedDate=new Date().toISOString().split('T')[0];
  sv();renderDonors(c);renderTodoBar();
}

function deleteInteraction(di,ixi){
  var c=gc();if(!c||!c.donors||!c.donors[di])return;
  if(!confirm('Delete this interaction log entry?'))return;
  c.donors[di].interactions.splice(ixi,1);
  sv();renderDonors(c);renderTodoBar();
}

// ══════════════════════════════════════════
// WORKPLACE GIVING STEWARDSHIP LETTER
// ══════════════════════════════════════════
function openWorkplaceGivingLetter(di){
  var c=gc();if(!c||!c.donors||!c.donors[di])return;
  var d=c.donors[di];
  var fy=getFiscalYear(c.fiscalYearEnd);
  var fyDons=(d.donations||[]).filter(function(dn){
    if(!dn.date)return false;var dt=parseDate(dn.date);
    return dt&&dt>=fy.start&&dt<=fy.end&&dn.inkind!=='Yes';
  });
  var total=fyDons.reduce(function(s,dn){return s+Number(dn.amt||0);},0);
  var platform=d.platform||'your workplace giving program';
  var letter='STEWARDSHIP LETTER — WORKPLACE GIVING\n\nDear '+d.name+',\n\nThank you for choosing to support '+c.name+' through '+platform+(d.employer?' at '+d.employer:'')+'. Your payroll giving makes a meaningful difference to the communities we serve.\n\nBecause your contribution was made through a third-party giving platform, you will receive your tax acknowledgment directly from '+platform+'. This letter is a personal note of appreciation from our team.\n\n'+(total>0?'During '+fy.label+', your workplace giving contributed '+fmt(total)+' to our work. ':'')+'Here is a glimpse of what your support makes possible:\n\n[Insert 2–3 specific program impact statements here]\n\nWe are grateful to have you in our community of supporters. If you have any questions about our programs or would like to see your giving in action, we would love to connect.\n\nWith sincere appreciation,\n\n[Your name]\n'+c.name;
  var mo=g('m-ty-letter');
  var bodyEl=g('ty-letter-text')||g('ty-letter-body');
  if(bodyEl){bodyEl.value=letter;if(mo)mo.classList.add('open');}
  else{var win=window.open('','_blank');if(win){win.document.write('<pre style="font-family:Georgia;font-size:14px;line-height:1.8;max-width:600px;margin:2rem auto;white-space:pre-wrap">'+letter+'</pre>');win.document.close();}}
}

// ══════════════════════════════════════════
// TO-DO BAR
// ══════════════════════════════════════════
function renderTodoBar(){
  var bar=g('todo-bar');var inner=g('todo-bar-inner');if(!bar||!inner)return;
  var c=gc();if(!c){bar.style.display='none';return;}
  var items=[];
  var now=new Date();

  function dlItem(dateStr,label,type,id,days){
    var bg=days<=5?'#fff0f0':days<=15?'#fff3e0':'#fffbeb';
    var color=days<=5?'var(--red)':days<=15?'#e65100':'var(--amber)';
    var icon=days<=5?'<i class="fas fa-circle"></i>':days<=15?'<i class="fas fa-triangle-exclamation"></i>':'<i class="fas fa-triangle-exclamation"></i>';
    return'<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;background:'+bg+';border:1px solid '+color+';border-radius:20px;font-size:11px;color:'+color+';white-space:nowrap">'
      +icon+' '+escHtml(label)+' — '+days+'d'
      +'<button onclick="dismissTodo(\''+type+'\',\''+id+'\')" style="background:none;border:none;cursor:pointer;color:'+color+';font-size:13px;line-height:1;padding:0 0 0 2px;opacity:.7" title="Dismiss">×</button>'
      +'</span>';
  }

  // Grant application deadlines
  (c.grants||[]).forEach(function(gr){
    if(!gr.appDeadline||gr.status==='Closed'||gr.status==='Denied')return;
    var dl=parseDate(gr.appDeadline);if(!dl)return;
    var days=Math.floor((dl-now)/(1000*60*60*24));
    if(days>=0&&days<=30){
      var dismissed=(c._dismissedTodos||{})[('appdl-'+gr.id)];
      if(!dismissed)items.push(dlItem(gr.appDeadline,'Apply: '+gr.name,'appdl',gr.id,days));
    }
  });

  // Grant reporting deadlines
  (c.grants||[]).forEach(function(gr){
    if(!gr.deadline||gr.status==='Closed')return;
    var dl=parseDate(gr.deadline);if(!dl)return;
    var days=Math.floor((dl-now)/(1000*60*60*24));
    if(days>=0&&days<=30){
      var dismissed=(c._dismissedTodos||{})[('rptdl-'+gr.id)];
      if(!dismissed)items.push(dlItem(gr.deadline,'Report: '+gr.name,'rptdl',gr.id,days));
    }
  });

  // Donor interaction follow-ups
  (c.donors||[]).forEach(function(d){
    (d.interactions||[]).forEach(function(ix){
      if(!ix.followupDate||ix.completed)return;
      var dl=parseDate(ix.followupDate);if(!dl)return;
      var days=Math.floor((dl-now)/(1000*60*60*24));
      if(days<=7){
        var overdue=days<0;
        var label='Follow up: '+d.name+(ix.followupNote?' — '+ix.followupNote:'');
        var color=overdue?'var(--red)':'var(--blue)';var bg=overdue?'#fff0f0':'#e8f0fb';var icon=overdue?'<i class="fas fa-circle"></i>':'<i class="fas fa-calendar"></i>';
        items.push('<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;background:'+bg+';border:1px solid '+color+';border-radius:20px;font-size:11px;color:'+color+';white-space:nowrap;cursor:pointer" onclick="switchTab({target:document.querySelector(\'[data-panel=donors]\')},\'donors\')">'
          +icon+' '+escHtml(label.substring(0,60)+(label.length>60?'…':''))+(overdue?' — OVERDUE':days===0?' — Today':' — '+days+'d')
          +'</span>');
      }
    });
  });

  if(!items.length){bar.style.display='none';return;}
  bar.style.display='block';
  inner.innerHTML='<span style="font-size:11px;font-weight:500;color:var(--muted);margin-right:4px;flex-shrink:0"><i class="fas fa-clipboard"></i> To do:</span>'+items.join('')
    +'<button onclick="switchTab({target:document.querySelector(\'[data-panel=calendar]\')},\'calendar\')" style="margin-left:auto;font-size:10px;color:var(--muted);background:none;border:none;cursor:pointer;white-space:nowrap;text-decoration:underline">View calendar →</button>';
}

function dismissTodo(type,id){
  var c=gc();if(!c)return;
  if(!c._dismissedTodos)c._dismissedTodos={};
  c._dismissedTodos[type+'-'+id]=new Date().toISOString();
  sv();renderTodoBar();
}

// ══════════════════════════════════════════
// CALENDAR VIEW
// ══════════════════════════════════════════
var _CAL_MONTH=null,_CAL_YEAR=null;

function renderCalendar(cc){
  var c=cc||gc(),p=g('p-calendar');if(!p)return;if(!c)return;
  var now=new Date();
  if(_CAL_MONTH===null){_CAL_MONTH=now.getMonth();_CAL_YEAR=now.getFullYear();}
  var month=_CAL_MONTH,year=_CAL_YEAR;
  var monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
  var firstDay=new Date(year,month,1).getDay();
  var daysInMonth=new Date(year,month+1,0).getDate();

  // Collect all events for this month
  var events={};
  function addEvent(dateStr,label,color,icon){
    if(!dateStr)return;
    var d=parseDate(dateStr);if(!d)return;
    if(d.getMonth()!==month||d.getFullYear()!==year)return;
    var key=d.getDate();
    if(!events[key])events[key]=[];
    events[key].push({label:label,color:color,icon:icon});
  }

  // Grant deadlines
  (c.grants||[]).forEach(function(gr){
    if(gr.appDeadline&&gr.status!=='Closed'&&gr.status!=='Denied')
      addEvent(gr.appDeadline,'Apply: '+gr.name,'#e65100','<i class="fas fa-pen-to-square"></i>');
    if(gr.deadline&&gr.status!=='Closed')
      addEvent(gr.deadline,'Report: '+gr.name,'var(--red)','<i class="fas fa-clipboard"></i>');
  });

  // Donor follow-ups
  (c.donors||[]).forEach(function(d){
    (d.interactions||[]).forEach(function(ix){
      if(ix.followupDate&&!ix.completed)
        addEvent(ix.followupDate,'Follow up: '+d.name+(ix.followupNote?' — '+ix.followupNote:''),'var(--blue)','<i class="fas fa-calendar"></i>');
    });
  });

  // Build calendar grid
  var prevMonth='<button class="add-btn" onclick="_CAL_MONTH='+(month===0?11:month-1)+';_CAL_YEAR='+(month===0?year-1:year)+';renderCalendar()">← Prev</button>';
  var nextMonth='<button class="add-btn" onclick="_CAL_MONTH='+(month===11?0:month+1)+';_CAL_YEAR='+(month===11?year+1:year)+';renderCalendar()">Next →</button>';
  var todayBtn='<button class="add-btn" onclick="_CAL_MONTH=new Date().getMonth();_CAL_YEAR=new Date().getFullYear();renderCalendar()">Today</button>';

  var grid='<table style="width:100%;border-collapse:collapse">'
    +'<thead><tr>'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(function(d){
      return'<th style="padding:.5rem;font-size:11px;color:var(--muted);font-weight:500;text-align:center;border-bottom:1px solid var(--border)">'+d+'</th>';
    }).join('')+'</tr></thead><tbody>';

  var day=1,started=false;
  for(var row=0;row<6;row++){
    if(day>daysInMonth)break;
    grid+='<tr>';
    for(var col=0;col<7;col++){
      if(row===0&&col<firstDay){grid+='<td style="padding:.5rem;min-height:80px;vertical-align:top;border:1px solid var(--soft)"></td>';continue;}
      if(day>daysInMonth){grid+='<td style="padding:.5rem;min-height:80px;vertical-align:top;border:1px solid var(--soft)"></td>';continue;}
      var isToday=day===now.getDate()&&month===now.getMonth()&&year===now.getFullYear();
      var dayEvents=events[day]||[];
      grid+='<td style="padding:.5rem;min-height:80px;vertical-align:top;border:1px solid var(--soft);'+(isToday?'background:var(--np-bg);':'')+'">'
        +'<div style="font-size:13px;font-weight:'+(isToday?'700':'400')+';color:'+(isToday?'var(--np)':'var(--text)')+';margin-bottom:4px">'+day+'</div>'
        +dayEvents.map(function(ev){
          return'<div style="font-size:10px;background:'+ev.color+';color:#fff;border-radius:4px;padding:2px 5px;margin-bottom:2px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+escHtml(ev.label)+'">'
            +ev.icon+' '+escHtml(ev.label.substring(0,28)+(ev.label.length>28?'…':''))+'</div>';
        }).join('')
        +'</td>';
      day++;
    }
    grid+='</tr>';
  }
  grid+='</tbody></table>';

  // Upcoming list
  var upcoming=[];
  function addUpcoming(dateStr,label,color,icon){
    if(!dateStr)return;var d=parseDate(dateStr);if(!d)return;
    var days=Math.floor((d-now)/(1000*60*60*24));
    if(days>=0&&days<=60)upcoming.push({date:d,days:days,label:label,color:color,icon:icon});
  }
  (c.grants||[]).forEach(function(gr){
    if(gr.appDeadline&&gr.status!=='Closed'&&gr.status!=='Denied')addUpcoming(gr.appDeadline,'Apply: '+gr.name,'#e65100','<i class="fas fa-pen-to-square"></i>');
    if(gr.deadline&&gr.status!=='Closed')addUpcoming(gr.deadline,'Report: '+gr.name,'var(--red)','<i class="fas fa-clipboard"></i>');
  });
  (c.donors||[]).forEach(function(d){
    (d.interactions||[]).forEach(function(ix){
      if(ix.followupDate&&!ix.completed)addUpcoming(ix.followupDate,'Follow up: '+d.name+(ix.followupNote?' — '+ix.followupNote:''),'var(--blue)','<i class="fas fa-calendar"></i>');
    });
  });
  upcoming.sort(function(a,b){return a.date-b.date;});

  var upcomingHTML=upcoming.length
    ?'<div class="card"><div class="c-title" style="margin-bottom:.75rem">Upcoming — next 60 days</div>'
      +upcoming.map(function(ev){
        return'<div style="display:flex;align-items:center;gap:10px;padding:.5rem 0;border-bottom:1px solid var(--soft);font-size:12px">'
          +'<span style="font-size:16px">'+ev.icon+'</span>'
          +'<span style="color:var(--muted);min-width:80px;flex-shrink:0">'+ev.date.toLocaleDateString('en-US',{month:'short',day:'numeric'})+'</span>'
          +'<span style="flex:1">'+escHtml(ev.label)+'</span>'
          +'<span style="font-size:11px;color:'+ev.color+';font-weight:500">'+(ev.days===0?'Today':ev.days+'d away')+'</span>'
          +'</div>';
      }).join('')
      +'</div>'
    :'<div class="card" style="color:var(--muted);font-size:13px;text-align:center;padding:2rem">No upcoming deadlines or follow-ups in the next 60 days.</div>';

  p.innerHTML=FB()+XB('calendar')
    +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:1rem;flex-wrap:wrap">'
    +'<span style="font-size:16px;font-weight:500">'+monthNames[month]+' '+year+'</span>'
    +prevMonth+todayBtn+nextMonth
    +'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 320px;gap:1rem;align-items:start">'
    +'<div class="card" style="padding:0;overflow:hidden">'+grid+'</div>'
    +upcomingHTML
    +'</div>';
}

// ── GRANT CLOSE-OUT REPORT ───────────────────────────────────────────────────
function renderGrantCloseoutRpt(){
  var c=gc();if(!c)return;var el=g('rpt-grantcloseout');if(!el)return;
  if(c.type!=='np'){el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Grant Close-Out Report</div><div style="color:var(--muted);font-size:12px">This report is only available for nonprofit organizations.</div></div>';return;}
  var grants=c.grants||[];
  if(!grants.length){el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Grant Close-Out Report</div><div style="color:var(--muted);font-size:12px">No grants found.</div></div>';return;}

  // Grant selector
  var selId=el.dataset.grantId||grants[0].id;
  var gr=grants.find(function(x){return x.id===selId;})||grants[0];
  var selHtml='<div style="display:flex;align-items:center;gap:8px;margin-bottom:1.25rem;flex-wrap:wrap">'
    +'<span style="font-size:12px;color:var(--muted)">Grant:</span>'
    +'<div class="sw"><select style="font-size:12px" onchange="var el=g(\'rpt-grantcloseout\');el.dataset.grantId=this.value;renderGrantCloseoutRpt()">'
    +grants.map(function(g2){return'<option value="'+g2.id+'"'+(g2.id===gr.id?' selected':'')+'>'+escHtml(g2.name)+'</option>';}).join('')
    +'</select></div>'
    +'<button class="xbtn p" onclick="doPDF(\'grantcloseout\')" style="margin-left:auto">Export PDF</button>'
    +'</div>';

  var gExp=(c.expenses||[]).filter(function(e){return!e.deleted&&!e.voided&&!e.isReversal&&e.grantId===gr.id;});
  var gInc=(c.income||[]).filter(function(r){return!r.deleted&&!r.voided&&r.grantId===gr.id;});
  var awarded=Number(gr.awarded||0);
  var totalRecv=gInc.reduce(function(s,r){return s+Number(r.recv||0);},0);
  var totalSpent=gExp.reduce(function(s,e){var pct=e.grantPct!=null?Number(e.grantPct)/100:1;return s+Number(e.amt||0)*pct;},0);
  var balance=totalRecv-totalSpent;

  // Group by fiscal year
  function getFY(dateStr){
    if(!dateStr)return'Unknown';
    var d=parseDate(dateStr);if(!d)return'Unknown';
    var fye=c.fiscalYearEnd||'12/31';
    if(typeof getFiscalYear==='function')return getFiscalYear(fye,d).label;
    return'FY '+d.getFullYear();
  }
  var fyMap={};
  gInc.forEach(function(r){var fy=getFY(r.date);if(!fyMap[fy])fyMap[fy]={income:[],expenses:[]};fyMap[fy].income.push(r);});
  gExp.forEach(function(e){var fy=getFY(e.date);if(!fyMap[fy])fyMap[fy]={income:[],expenses:[]};fyMap[fy].expenses.push(e);});
  var fyKeys=Object.keys(fyMap).filter(function(k){return k!=='Unknown';}).sort();
  if(fyMap['Unknown'])fyKeys.push('Unknown');
  var multiYear=fyKeys.length>1;

  // Requirements checklist
  var reqs=gr.requirements||[];
  var reqHtml='';
  if(reqs.length){
    reqHtml='<div class="rpt-sec" style="margin-top:1rem"><div class="rpt-ttl" style="font-size:13px;margin-bottom:.5rem">Close-Out Requirements</div>'
      +reqs.map(function(r){return'<div style="display:flex;align-items:center;gap:8px;padding:.35rem 0;border-bottom:1px solid var(--soft)">'
        +'<span style="font-size:15px">'+(r.done?'<i class="fas fa-square-check"></i>':'<i class="far fa-square"></i>')+'</span>'
        +'<span style="font-size:12px;'+(r.done?'':'color:var(--amber)')+'">'+escHtml(r.label)+'</span>'
        +(r.done?'':'<span style="font-size:10px;color:var(--amber);margin-left:auto">Pending</span>')
        +'</div>';}).join('')
      +'</div>';
  }

  // Summary tiles
  var tilesHtml='<div class="metrics" style="margin-bottom:1rem">'
    +'<div class="metric"><div class="m-lbl">Awarded</div><div class="m-val vg">'+fmt(awarded)+'</div></div>'
    +'<div class="metric"><div class="m-lbl">Total received</div><div class="m-val vb">'+fmt(totalRecv)+'</div></div>'
    +'<div class="metric"><div class="m-lbl">Total spent</div><div class="m-val vr">'+fmt(totalSpent)+'</div></div>'
    +'<div class="metric"><div class="m-lbl">Balance</div><div class="m-val '+(balance>=0?'vg':'vr')+'">'+fmt(balance)+'</div></div>'
    +'</div>';

  // Per-FY sections or single section
  function fySection(fyLabel,items){
    var incItems=items.income||[];var expItems=items.expenses||[];
    var fyRecv=incItems.reduce(function(s,r){return s+Number(r.recv||0);},0);
    var fySpent=expItems.reduce(function(s,e){var pct=e.grantPct!=null?Number(e.grantPct)/100:1;return s+Number(e.amt||0)*pct;},0);
    var incRows=incItems.length?incItems.map(function(r){
      return'<tr><td>'+escHtml(r.name||'—')+'</td><td>'+escHtml(r.cat||'—')+'</td><td class="vg">'+fmt(r.recv)+'</td><td style="color:var(--muted)">'+(r.date||'—')+'</td><td>'+SB(r.status||'')+'</td></tr>';
    }).join(''):'<tr><td colspan="5" style="color:var(--muted);font-size:11px;padding:.75rem">No income entries for this period.</td></tr>';
    var expRows=expItems.length?expItems.map(function(e){
      var pct=e.grantPct!=null?Number(e.grantPct):100;var allocAmt=Number(e.amt||0)*(pct/100);
      return'<tr><td>'+escHtml(e.desc||'—')+'</td><td>'+escHtml(e.cat||'—')+'</td><td class="vr">'+(pct!==100?fmt(allocAmt)+'<span style="font-size:10px;color:var(--muted);margin-left:4px">('+pct+'% of '+fmt(e.amt)+')</span>':fmt(e.amt))+'</td><td style="color:var(--muted)">'+(e.date||'—')+'</td><td>'+(e.reconciled?'<span class="badge b-green" style="font-size:10px"><i class="fas fa-check"></i> Reconciled</span>':'<span class="badge b-amber" style="font-size:10px">Unreconciled</span>')+'</td></tr>';
    }).join(''):'<tr><td colspan="5" style="color:var(--muted);font-size:11px;padding:.75rem">No expenses for this period.</td></tr>';
    return'<div class="card" style="margin-bottom:1rem">'
      +(multiYear?'<div class="c-title" style="margin-bottom:.75rem;font-size:13px">'+escHtml(fyLabel)+'</div>':'')
      +'<div style="font-size:12px;font-weight:500;margin-bottom:.4rem;color:var(--muted)">Income received</div>'
      +'<table style="margin-bottom:.75rem"><thead><tr><th>Source</th><th>Category</th><th>Received</th><th>Date</th><th>Status</th></tr></thead><tbody>'+incRows+'</tbody>'
      +(incItems.length?'<tfoot><tr><td colspan="2" style="font-weight:600;font-size:12px">Total received</td><td class="vg" style="font-weight:600">'+fmt(fyRecv)+'</td><td colspan="2"></td></tr></tfoot>':'')
      +'</table>'
      +'<div style="font-size:12px;font-weight:500;margin-bottom:.4rem;color:var(--muted)">Expenses charged to grant</div>'
      +'<table><thead><tr><th>Description</th><th>Category</th><th>Amount</th><th>Date</th><th>Reconciled</th></tr></thead><tbody>'+expRows+'</tbody>'
      +(expItems.length?'<tfoot><tr><td colspan="2" style="font-weight:600;font-size:12px">Total spent</td><td class="vr" style="font-weight:600">'+fmt(fySpent)+'</td><td colspan="2"></td></tr></tfoot>':'')
      +'</table>'
      +(multiYear?'<div class="rpt-row" style="margin-top:.5rem;border-top:1px solid var(--border);padding-top:.5rem"><span style="font-size:11px;font-weight:500">'+fyLabel+' net</span><span class="'+(fyRecv-fySpent>=0?'vg':'vr')+'" style="font-weight:600">'+fmt(fyRecv-fySpent)+'</span></div>':'')
      +'</div>';
  }

  var fySections=(fyKeys.length?fyKeys:['All']).map(function(fy){
    return fySection(fy,fyMap[fy]||{income:gInc,expenses:gExp});
  }).join('');

  var statusBadge=gr.reconciled?'<span class="badge b-green" style="font-size:11px"><i class="fas fa-check"></i> Reconciled</span>':'';

  el.innerHTML='<div class="rpt-sec">'
    +selHtml
    +'<div class="rpt-ttl">Grant Close-Out Report</div>'
    +'<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:.25rem">'
    +'<span style="font-size:14px;font-weight:500">'+escHtml(gr.name)+'</span>'
    +SB(gr.status||'')+statusBadge
    +'</div>'
    +(gr.funder?'<div style="font-size:12px;color:var(--muted);margin-bottom:.1rem">Funder: '+escHtml(gr.funder)+'</div>':'')
    +(gr.deadline?'<div style="font-size:12px;color:var(--muted);margin-bottom:.75rem">Reporting deadline: '+gr.deadline+'</div>':'<div style="margin-bottom:.75rem"></div>')
    +'<div style="font-size:10px;color:var(--muted);font-style:italic;margin-bottom:1rem">Internal use only — not transmitted to any funder</div>'
    +tilesHtml
    +reqHtml
    +'<div style="margin-top:1rem">'+fySections+'</div>'
    +(balance>0?'<div class="card" style="background:var(--amber-bg,#fffbea);border:1px solid var(--amber);margin-top:.5rem"><div style="font-size:12px;font-weight:500;color:var(--amber)"><i class="fas fa-triangle-exclamation"></i> Unspent balance: '+fmt(balance)+'</div><div style="font-size:11px;color:var(--muted);margin-top:3px">Confirm with funder whether unspent funds must be returned or may be carried forward.</div></div>':'')
    +'</div>';
}

// ── GRANT STATUS REPORT ──────────────────────────────────────────────────────
function renderGrantStatusRpt(){
  var c=gc();if(!c)return;var el=g('rpt-grantstatus');if(!el)return;
  if(c.type!=='np'){el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Grant Status Report</div><div style="color:var(--muted);font-size:12px">This report is only available for nonprofit organizations.</div></div>';return;}
  var grants=c.grants||[];
  if(!grants.length){el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Grant Status Report</div><div style="color:var(--muted);font-size:12px">No grants found.</div></div>';return;}

  var selId=el.dataset.grantId||grants[0].id;
  var gr=grants.find(function(x){return x.id===selId;})||grants[0];
  var selHtml='<div style="display:flex;align-items:center;gap:8px;margin-bottom:1.25rem;flex-wrap:wrap">'
    +'<span style="font-size:12px;color:var(--muted)">Grant:</span>'
    +'<div class="sw"><select style="font-size:12px" onchange="var el=g(\'rpt-grantstatus\');el.dataset.grantId=this.value;renderGrantStatusRpt()">'
    +grants.map(function(g2){return'<option value="'+g2.id+'"'+(g2.id===gr.id?' selected':'')+'>'+escHtml(g2.name)+'</option>';}).join('')
    +'</select></div>'
    +'<button class="xbtn p" onclick="doPDF(\'grantstatus\')" style="margin-left:auto">Export PDF</button>'
    +'</div>';

  var gExp=(c.expenses||[]).filter(function(e){return!e.deleted&&!e.voided&&!e.isReversal&&e.grantId===gr.id;});
  var gInc=(c.income||[]).filter(function(r){return!r.deleted&&!r.voided&&r.grantId===gr.id;});
  var awarded=Number(gr.awarded||0);
  var totalRecv=gInc.reduce(function(s,r){return s+Number(r.recv||0);},0);
  var totalSpent=gExp.reduce(function(s,e){var pct=e.grantPct!=null?Number(e.grantPct)/100:1;return s+Number(e.amt||0)*pct;},0);
  var remaining=awarded-totalSpent;
  var drawPct=awarded>0?Math.round((totalSpent/awarded)*100):0;
  var recvPct=awarded>0?Math.round((totalRecv/awarded)*100):0;

  // Spending by category
  var byCat={};
  gExp.forEach(function(e){
    var cat=e.cat||'Uncategorized';
    var pct=e.grantPct!=null?Number(e.grantPct)/100:1;
    var amt=Number(e.amt||0)*pct;
    if(!byCat[cat])byCat[cat]=0;
    byCat[cat]+=amt;
  });
  var catRows=Object.keys(byCat).sort(function(a,b){return byCat[b]-byCat[a];}).map(function(cat){
    var pct=totalSpent>0?Math.round((byCat[cat]/totalSpent)*100):0;
    return'<div class="rpt-row"><span>'+escHtml(cat)+'</span><span style="display:flex;gap:12px;align-items:center">'
      +'<span style="font-size:11px;color:var(--muted)">'+pct+'% of spend</span>'
      +'<span class="vr">'+fmt(byCat[cat])+'</span></span></div>';
  }).join('');

  // FY breakdown for YoY
  function getFY(dateStr){
    if(!dateStr)return'Unknown';
    var d=parseDate(dateStr);if(!d)return'Unknown';
    var fye=c.fiscalYearEnd||'12/31';
    if(typeof getFiscalYear==='function')return getFiscalYear(fye,d).label;
    return'FY '+d.getFullYear();
  }
  var fyMap={};
  gInc.forEach(function(r){var fy=getFY(r.date);if(!fyMap[fy])fyMap[fy]={recv:0,spent:0};fyMap[fy].recv+=Number(r.recv||0);});
  gExp.forEach(function(e){var fy=getFY(e.date);if(!fyMap[fy])fyMap[fy]={recv:0,spent:0};var pct=e.grantPct!=null?Number(e.grantPct)/100:1;fyMap[fy].spent+=Number(e.amt||0)*pct;});
  var fyKeys=Object.keys(fyMap).filter(function(k){return k!=='Unknown';}).sort();
  var yoyHtml='';
  if(fyKeys.length>1){
    yoyHtml='<div class="card" style="margin-bottom:1rem"><div class="c-title" style="margin-bottom:.75rem;font-size:13px">Year-over-Year</div>'
      +'<table><thead><tr><th>Fiscal Year</th><th>Received</th><th>Spent</th><th>Net</th></tr></thead><tbody>'
      +fyKeys.map(function(fy){var d=fyMap[fy];var net=d.recv-d.spent;return'<tr>'
        +'<td style="font-weight:500">'+escHtml(fy)+'</td>'
        +'<td class="vg">'+fmt(d.recv)+'</td>'
        +'<td class="vr">'+fmt(d.spent)+'</td>'
        +'<td class="'+(net>=0?'vg':'vr')+'">'+fmt(net)+'</td>'
        +'</tr>';}).join('')
      +'</tbody></table></div>';
  }

  // Compliance gaps
  var gaps=[];
  var unreconExp=gExp.filter(function(e){return!e.reconciled;}).length;
  var unreconInc=gInc.filter(function(r){return r.reconciled!==true;}).length;
  if(unreconExp>0)gaps.push({sev:'amber',msg:unreconExp+' unreconciled expense'+(unreconExp===1?'':'s')});
  if(unreconInc>0)gaps.push({sev:'amber',msg:unreconInc+' unreconciled income'+(unreconInc===1?'':'s')});
  if(remaining<0)gaps.push({sev:'red',msg:'Over-budget by '+fmt(Math.abs(remaining))});
  if(gr.deadline){var dl=parseDate(gr.deadline);if(dl){var daysLeft=Math.round((dl-new Date())/(1000*60*60*24));if(daysLeft<30&&daysLeft>=0)gaps.push({sev:'amber',msg:'Reporting deadline in '+daysLeft+' day'+(daysLeft===1?'':'s')});if(daysLeft<0)gaps.push({sev:'red',msg:'Reporting deadline passed '+Math.abs(daysLeft)+' day'+(Math.abs(daysLeft)===1?'':'s')+' ago'});}}
  var reqs=gr.requirements||[];
  var pendingReqs=reqs.filter(function(r){return!r.done;});
  if(pendingReqs.length)gaps.push({sev:'amber',msg:pendingReqs.length+' close-out requirement'+(pendingReqs.length===1?'':'s')+' pending'});
  var gapsHtml=gaps.length
    ?'<div class="card" style="margin-bottom:1rem"><div class="c-title" style="margin-bottom:.5rem;font-size:13px">Compliance flags</div>'
      +gaps.map(function(g2){var col=g2.sev==='red'?'var(--red)':'var(--amber)';return'<div style="display:flex;gap:6px;align-items:center;padding:.3rem 0;border-bottom:1px solid var(--soft);font-size:12px"><span style="color:'+col+'">●</span><span>'+g2.msg+'</span></div>';}).join('')+'</div>'
    :'<div class="card" style="margin-bottom:1rem;background:var(--green-bg,#f0faf4);border:1px solid var(--green)"><div style="font-size:12px;color:var(--green);font-weight:500"><i class="fas fa-check"></i> No compliance gaps</div></div>';

  el.innerHTML='<div class="rpt-sec">'
    +selHtml
    +'<div class="rpt-ttl">Grant Status Report</div>'
    +'<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:.25rem">'
    +'<span style="font-size:14px;font-weight:500">'+escHtml(gr.name)+'</span>'+SB(gr.status||'')
    +'</div>'
    +(gr.funder?'<div style="font-size:12px;color:var(--muted);margin-bottom:.1rem">Funder: '+escHtml(gr.funder)+'</div>':'')
    +(gr.deadline?'<div style="font-size:12px;color:var(--muted);margin-bottom:.75rem">Reporting deadline: '+gr.deadline+'</div>':'<div style="margin-bottom:.75rem"></div>')
    +'<div class="metrics" style="margin-bottom:1rem">'
    +'<div class="metric"><div class="m-lbl">Awarded</div><div class="m-val vg">'+fmt(awarded)+'</div></div>'
    +'<div class="metric"><div class="m-lbl">Received</div><div class="m-val vb">'+fmt(totalRecv)+' <span style="font-size:11px;color:var(--muted)">('+recvPct+'%)</span></div></div>'
    +'<div class="metric"><div class="m-lbl">Spent</div><div class="m-val vr">'+fmt(totalSpent)+' <span style="font-size:11px;color:var(--muted)">('+drawPct+'%)</span></div></div>'
    +'<div class="metric"><div class="m-lbl">Remaining</div><div class="m-val '+(remaining>=0?'vb':'vr')+'">'+fmt(remaining)+'</div></div>'
    +'</div>'
    +'<div class="card" style="margin-bottom:1rem"><div class="c-title" style="margin-bottom:.5rem;font-size:13px">Drawdown progress</div>'
    +'<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:3px"><span>Spent</span><span>'+drawPct+'%</span></div>'
    +'<div class="pbar" style="height:10px;margin-bottom:.75rem"><div class="pfill" style="width:'+Math.min(drawPct,100)+'%;background:'+(drawPct>90?'var(--red)':drawPct>70?'var(--amber)':'var(--green)')+'"></div></div>'
    +'<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:3px"><span>Received</span><span>'+recvPct+'%</span></div>'
    +'<div class="pbar" style="height:10px"><div class="pfill" style="width:'+Math.min(recvPct,100)+'%;background:var(--blue)"></div></div>'
    +'</div>'
    +gapsHtml
    +(catRows?'<div class="card" style="margin-bottom:1rem"><div class="c-title" style="margin-bottom:.5rem;font-size:13px">Spending by category</div>'+catRows+'</div>':'')
    +yoyHtml
    +(reqs.length?'<div class="card"><div class="c-title" style="margin-bottom:.5rem;font-size:13px">Close-out requirements</div>'
      +reqs.map(function(r){return'<div style="display:flex;align-items:center;gap:8px;padding:.3rem 0;border-bottom:1px solid var(--soft);font-size:12px">'
        +'<span>'+(r.done?'<i class="fas fa-square-check"></i>':'<i class="far fa-square"></i>')+'</span><span style="'+(r.done?'':'color:var(--amber)')+'">'+escHtml(r.label)+'</span>'
        +(r.done?'':'<span style="font-size:10px;color:var(--amber);margin-left:auto">Pending</span>')
        +'</div>';}).join('')+'</div>':'')
    +'</div>';
}
