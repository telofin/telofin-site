// RENDER HELPERS
// ══════════════════════════════════════════
var RPT_FY='current'; // 'current' or a FY label string like 'FY 2024'
// Global disclaimer HTML used across all report panels
function _rptDisclaimer(extra){
  return'<div style="font-size:10.5px;color:var(--muted);background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem;margin-bottom:1rem;line-height:1.5">'
    +'<strong>Disclaimer:</strong> This report is generated from user-entered data for informational purposes only. '
    +'It does not constitute professional accounting, tax, or financial advice. '
    +(extra?extra+' ':'')
    +'Verify all figures with a licensed CPA before use in tax filings, financial statements, or any formal submission. '
    +'Telofin™ is not liable for errors or decisions made in reliance on this data.'
    +'</div>';
}
var RPT_BASIS=''; // '' = use client default, 'cash' or 'accrual' to override

// ── DRILL-DOWN REPORT FILTER STATE ──────────────────────────────────────────
// Set by drillLink clicks. Cleared by clearRptFilter(). Read by detail renderers.
var RPT_FILTER_TYPE='';   // 'cat' | 'vendor' | 'fund' | 'source' | 'donor' | 'grant' | ''
var RPT_FILTER_VALUE='';  // e.g. 'Office Supplies' or 'United Way'
var RPT_FILTER_LABEL='';  // human-readable label for the chip

function clearRptFilter(){RPT_FILTER_TYPE='';RPT_FILTER_VALUE='';RPT_FILTER_LABEL='';if(typeof renderReports==='function')renderReports();}

// Renders a drillable link — blue, underlined, QBO-style
// onclick sets filter state and navigates to the appropriate report
function drillLink(text,filterType,filterValue,rptTarget){
  if(!text||text==='—')return escHtml(text||'—');
  var safe=escHtml(text);
  var label=escHtml(filterType+': '+text);
  return'<span class="drill-link" title="Run report: '+safe+'" onclick="runItemReport(\''+escHtml(filterType)+'\',\''+escHtml(filterValue||text)+'\',\''+label+'\',\''+rptTarget+'\')">'+safe+'</span>';
}

// Jump to expense tab and open edit modal for a specific expense
function jumpToExpense(oi){
  // Open edit modal in place — do NOT switch tabs, stay on reconciliation
  editItem('expenses',oi);
}

// Navigate to reports tab, set filter, switch to the right sub-report
function runItemReport(filterType,filterValue,filterLabel,rptTarget){
  RPT_FILTER_TYPE=filterType;
  RPT_FILTER_VALUE=filterValue;
  RPT_FILTER_LABEL=filterLabel||filterValue;
  // Navigate to reports tab
  document.querySelectorAll('#tabs .tab').forEach(function(t){t.classList.toggle('active',t.dataset.panel==='reports');});
  document.querySelectorAll('#panels .panel').forEach(function(p){p.classList.remove('active');});
  var rp=g('p-reports');if(rp)rp.classList.add('active');
  var ms=g('mob-tab-sel');if(ms)ms.value='reports';
  if(typeof afterSwitch==='function')afterSwitch('reports');
  var target=rptTarget||'expdetail';
  setTimeout(function(){
    var sel=g('rpt-sel');if(sel)sel.value=target;
    if(typeof switchRpt==='function')switchRpt(target);
  },50);
}

// Run Report button popdown — Transaction Report, P&L, Balance Sheet
function showRunReportMenu(btn,panelType){
  // Remove any existing menu
  var old=g('run-rpt-menu');if(old)old.parentNode.removeChild(old);
  var c=gc();if(!c)return;
  var isNP=c.type==='np',isSB=c.type==='sb';
  var txnTarget=isNP?(panelType==='income'?'incdetail':'expdetail'):isSB?(panelType==='revenue'?'incdetail':'expdetail'):'expdetail';
  var items=[
    {label:'Transaction Report',icon:'📋',fn:'clearRptFilter();runItemReport(\'\',\'\',\'\',\''+txnTarget+'\')'},
    {label:'P&amp;L',icon:'📊',fn:'clearRptFilter();runItemReport(\'\',\'\',\'\',\'pl\')'},
    {label:'Balance Sheet',icon:'⚖️',fn:'clearRptFilter();runItemReport(\'\',\'\',\'\',\'bsheet\')'}
  ];
  if(panelType==='grants'&&isNP){items.unshift({label:'Grant Close-Out Report',icon:'📄',fn:'runItemReport(\'\',\'\',\'\',\'grantcloseout\')'},{label:'Grant Status Report',icon:'📊',fn:'runItemReport(\'\',\'\',\'\',\'grantstatus\')'});}
  var menuHtml='<div id="run-rpt-menu" style="position:fixed;z-index:9999;background:var(--surface);border:1px solid var(--border);border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.15);min-width:190px;overflow:hidden;animation:fadeIn .12s ease">'
    +items.map(function(it){return'<div class="rpt-menu-item" onclick="'+it.fn+';var m=g(\'run-rpt-menu\');if(m)m.parentNode.removeChild(m)">'+it.icon+' '+it.label+'</div>';}).join('')
    +'</div>';
  document.body.insertAdjacentHTML('beforeend',menuHtml);
  var menu=g('run-rpt-menu');
  var rect=btn.getBoundingClientRect();
  menu.style.top=(rect.bottom+4)+'px';
  menu.style.left=rect.left+'px';
  // Close on outside click
  setTimeout(function(){
    function _close(e){if(!menu.contains(e.target)){menu.parentNode&&menu.parentNode.removeChild(menu);document.removeEventListener('click',_close);}};
    document.addEventListener('click',_close);
  },10);
}
function rb(type,i){
  var c=gc();var item=c&&c[type]&&c[type][i];
  if(!item)return'';
  if(item.isReversal)return'<span style="font-size:10px;color:var(--muted)">reversal</span>';
  var hasAudit=item.audit&&item.audit.length>0;
  if(item.voided){
    return'<div class="row-acts">'
      +'<span style="font-size:10px;color:var(--muted);margin-right:4px">voided</span>'
      +'<button class="e-btn" onclick="unvoidItem(\''+type+'\','+i+')" title="Un-void">↩</button>'
      +'</div>';
  }
  if(item.reconciled){
    return'<div class="row-acts">'
      +(hasAudit?'<button class="e-btn" onclick="openTxnAuditLog(\''+type+'\','+i+')" title="Edit history">&#128221;</button>':'')
      +'<button class="add-btn" onclick="editItem(\''+type+'\','+i+')" title="Edit (reconciled — will warn before saving)" style="font-size:11px;padding:3px 9px">&#9998; Edit</button>'
      +'<span style="font-size:10px;color:var(--muted)" title="Reconciled">🔒</span>'
      +'</div>';
  }
  return'<div class="row-acts">'
    +(hasAudit?'<button class="e-btn" onclick="openTxnAuditLog(\''+type+'\','+i+')" title="Edit history">&#128221;</button>':'')
    +'<button class="add-btn" onclick="editItem(\''+type+'\','+i+')" title="Edit" style="font-size:11px;padding:3px 9px">&#9998; Edit</button>'
    +'<button class="add-btn" onclick="voidItem(\''+type+'\','+i+')" title="Void & reverse" style="font-size:11px;padding:3px 9px;background:none;border:1px solid var(--border);color:var(--amber)">⊘</button>'
    +'<button class="add-btn" onclick="delItem(\''+type+'\','+i+')" title="Delete" style="font-size:11px;padding:3px 9px;background:none;border:1px solid var(--red-bg);color:var(--red)">&#215; Delete</button>'
    +'</div>';
}

// ── TRANSACTION AUDIT TRAIL ─────────────────────────────────────────────────
// Watched fields per transaction type. Only changes to these fields are logged.
// _editItemId: stores the item's stable .id when editing, so save functions
// can find the correct array index even if the array was re-sorted since editItem() ran.
// EI stays as the new/edit sentinel (-1=new, >=0=edit mode) but lookups use _editItemId.
var _editItemId=null;

var _TXN_WATCHED={
  expenses:['desc','cat','amt','date','fund','acctCode'],
  income:  ['name','cat','proj','recv','date','fund','acctCode'],
  revenue: ['name','cat','proj','act','date','acctCode'],
  donors:  ['name','email','phone','address','notes']
};
// Call this on EDIT (EI>=0) before overwriting. Returns the updated audit array.
function auditTxn(old,item,type){
  if(!old)return item.audit||[];
  var log=(old.audit||[]).slice();
  var ts=new Date().toISOString();
  var watched=_TXN_WATCHED[type]||['amt'];
  watched.forEach(function(f){
    var ov=String(old[f]===undefined||old[f]===null?'':old[f]);
    var nv=String(item[f]===undefined||item[f]===null?'':item[f]);
    if(ov!==nv)log.push({field:f,oldValue:ov,newValue:nv,timestamp:ts});
  });
  return log;
}
function _auditCreated(){
  return [{field:'created',oldValue:'',newValue:'Entry created',timestamp:new Date().toISOString()}];
}
// Resolve the correct array index using _editItemId (safe against re-sorts).
// Falls back to EI if id-based lookup fails (backward compat for items without .id).
function resolveEI(arr){
  if(EI<0)return -1;
  if(_editItemId){
    var idx=arr.findIndex(function(x){return x&&x.id===_editItemId;});
    if(idx>=0)return idx;
    // _editItemId was set but not found — array may have been mutated since editItem() ran.
    // Return -1 (treat as new) rather than falling back to a potentially stale EI index.
    console.warn('[clarity] resolveEI: _editItemId "'+_editItemId+'" not found — treating as new entry to prevent wrong-index write.');
    return -1;
  }
  // No _editItemId set — EI was used before id-based tracking existed. Guard bounds only.
  return(EI<arr.length)?EI:-1;
}
function openTxnAuditLog(type,i){
  var c=gc();if(!c)return;
  var item=c[type]&&c[type][i];if(!item)return;
  var log=item.audit||[];
  var labels={desc:'Description',cat:'Category',amt:'Amount',date:'Date',fund:'Fund',
    acctCode:'Account code',name:'Name',proj:'Projected',recv:'Received',act:'Actual',created:'Created'};
  var rows=log.length
    ?log.map(function(e){
        return'<tr>'
          +'<td style="white-space:nowrap;font-size:10px;color:var(--muted)">'+(e.timestamp?e.timestamp.replace('T',' ').slice(0,19):'—')+'</td>'
          +'<td>'+(labels[e.field]||e.field)+'</td>'
          +'<td style="color:var(--muted)">'+(e.oldValue||'—')+'</td>'
          +'<td>'+(e.newValue||'—')+'</td>'
          +'</tr>';
      }).join('')
    :'<tr><td colspan="4" style="text-align:center;padding:1.5rem;color:var(--muted);font-size:12px">No edit history yet.</td></tr>';
  g('audit-log-body').innerHTML=rows;
  openM('m-audit');
}
function XB(tabType){
  var expFn=tabType?'exportTab(\''+tabType+'\')':'doXL()';
  var pdfFn=tabType?'doPDF(\''+tabType+'\')':'doPDF()';
  var coaBtns=tabType==='coa'?'<button class="xbtn" onclick="exportCOA()" title="Download COA as CSV">&#11015; Export COA</button><label class="xbtn" style="cursor:pointer" title="Import COA from CSV">&#11014; Import COA<input type="file" accept=".csv" style="display:none" onchange="importCOA(this)"></label>':'';
  var rptPanels={'expenses':1,'income':1,'revenue':1,'peinc':1,'grants':1,'donors':1};
  var panelType=tabType||'';
  var rptBtn=(rptPanels[panelType]||!panelType)?'<button class="xbtn rpt-btn" onclick="showRunReportMenu(this,\''+panelType+'\')" title="Run a report from this data">&#128202; Run Report</button>':'';
  var importBtn=(tabType==='recon'||tabType==='openingbal'||tabType==='trialbal'||tabType==='gl')?'':'<button class="xbtn" onclick="openM(\'m-import\')">Import</button>';
  return'<div class="xbar">'+rptBtn+'<button class="xbtn p" onclick="'+pdfFn+'">Export PDF</button><button class="xbtn" onclick="'+expFn+'">Export Excel</button>'+importBtn+coaBtns+'<button class="xbtn" onclick="downloadAllData()" title="Download a full backup of all your data as JSON">&#11015; Backup</button></div>';
}
function exportCOA(){
  var c=gc();if(!c)return;
  var accts=c.accounts||[];if(!accts.length){alert('No accounts in your chart of accounts.');return;}
  var rows=[['Code','Name','Type','Category']];
  accts.slice().sort(function(a,b){return(a.code||'').localeCompare(b.code||'');}).forEach(function(a){
    rows.push([a.code||'',a.name||'',a.type||'',a.cat||'']);
  });
  var csv=rows.map(function(r){return r.map(function(v){return'"'+String(v).replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  var blob=new Blob([csv],{type:'text/csv'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;
  a.download=(c.name||'client').replace(/[^a-z0-9]/gi,'_')+'-COA.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}
function importCOA(input){
  var file=input.files&&input.files[0];if(!file)return;
  var c=gc();if(!c)return;
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var lines=e.target.result.split('\n').map(function(l){return l.trim();}).filter(Boolean);
      if(lines.length<2){alert('CSV must have a header row and at least one account.');return;}
      var headers=lines[0].split(',').map(function(h){return h.replace(/^"|"$/g,'').toLowerCase().trim();});
      var ci=function(name){var i=headers.indexOf(name);return i>=0?i:0;};
      var cCode=ci('code'),cName=ci('name'),cType=ci('type'),cCat=ci('category');
      var imported=0,skipped=0;
      if(!c.accounts)c.accounts=[];
      lines.slice(1).forEach(function(line){
        var parts=line.match(/(".*?"|[^,]+)(?=,|$)/g)||line.split(',');
        var clean=function(s){return(s||'').replace(/^"|"$/g,'').trim();};
        var code=clean(parts[cCode]),name=clean(parts[cName]),type=clean(parts[cType]),cat=clean(parts[cCat])||name;
        if(!code||!name){skipped++;return;}
        var existing=c.accounts.find(function(a){return a.code===code;});
        if(existing){existing.name=name;existing.type=type||existing.type;existing.cat=cat||existing.cat;}
        else{c.accounts.push({id:uid(),code:code,name:name,type:type||'Expense',cat:cat});}
        imported++;
      });
      c.accounts.sort(function(a,b){return(a.code||'').localeCompare(b.code||'');});
      sv();if(typeof renderCOA==='function')renderCOA(c);
      alert(imported+' account(s) imported/updated.'+(skipped?' '+skipped+' row(s) skipped (missing code or name).':''));
    }catch(err){alert('Error reading COA file: '+err.message);}
    input.value='';
  };
  reader.readAsText(file);
}

function exportSchedB(){
  var c=gc();if(!c||c.type!=='np'){alert('Schedule B is only available for nonprofit organizations.');return;}
  var fy=getFiscalYear(c.fiscalYearEnd);
  var THRESHOLD=5000;
  // Build rows: donors with $5,000+ cash (non-inkind) in current FY
  var rows=[['Schedule B — Form 990 Export','','','',''],
            ['Organization:',c.name,'','',''],
            ['Fiscal year:',fy.label,'','',''],
            ['Generated:',new Date().toLocaleDateString(),'','',''],
            ['','','','',''],
            ['Donor Name','Address','Total Cash Gifts (FY)','Largest Single Gift','Notes']];
  var found=0;
  (c.donors||[]).forEach(function(d){
    var fyTotal=(d.donations||[]).reduce(function(s,dn){
      if(dn.inkind==='Yes')return s;
      if(!dn.date)return s;
      var dt=parseDate(dn.date);
      if(!dt||dt<fy.start||dt>fy.end)return s;
      return s+Number(dn.amt||0);
    },0);
    if(fyTotal<THRESHOLD)return;
    found++;
    var largest=(d.donations||[]).filter(function(dn){
      if(dn.inkind==='Yes')return false;
      var dt=parseDate(dn.date);return dt&&dt>=fy.start&&dt<=fy.end;
    }).reduce(function(mx,dn){return Math.max(mx,Number(dn.amt||0));},0);
    rows.push([d.name||'',d.address||'',fyTotal,largest,d.notes||'']);
  });
  if(!found){alert('No donors meet the Schedule B threshold ($5,000+) for the current fiscal year.');return;}
  // CSV export
  var csv=rows.map(function(r){return r.map(function(v){var s=String(v===null||v===undefined?'':v);return s.indexOf(',')>=0||s.indexOf('"')>=0?'"'+s.replace(/"/g,'""')+'"':s;}).join(',');}).join('\n');
  var blob=new Blob([csv],{type:'text/csv'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;a.download=c.name.replace(/[^a-z0-9]/gi,'_')+'-Schedule-B-'+fy.label+'.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}
function safeUrl(url){
  if(!url)return'';
  var s=String(url).trim();
  // Only allow http, https, and relative paths
  if(/^javascript:/i.test(s)||/^data:/i.test(s)||/^vbscript:/i.test(s))return'';
  return s;
}

// rcptCell(collection, index, row) — renders the paperclip receipt/invoice cell
// Works for expenses (receiptUrl/receiptPath). For bills use billRcptCell().
function rcptCell(col,oi,r){
  var hasFile=!!(r.receiptPath||r.receiptUrl);
  var clip=hasFile
    ?'<button class="e-btn" onclick="vaultViewReceipt(\''+col+'\','+oi+')" title="View receipt" style="font-size:13px;color:var(--accent)">📎</button>'
    :'<button class="e-btn" onclick="vaultAttachReceipt(\''+col+'\','+oi+')" title="Attach receipt" style="font-size:13px;color:var(--muted)">📎</button>';
  return clip;
}

// billRcptCell(index, bill) — paperclip for AP bill invoice
function billRcptCell(oi,b){
  var hasFile=!!(b.invoicePath||b.invoiceUrl);
  return hasFile
    ?'<button class="e-btn" onclick="vaultViewBillInvoice('+oi+')" title="View invoice" style="font-size:13px;color:var(--accent)">📎</button>'
    :'<button class="e-btn" onclick="vaultAttachBillInvoice('+oi+')" title="Attach invoice" style="font-size:13px;color:var(--muted)">📎</button>';
}
function escHtml(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
// Strip dangerous HTML from free-text fields before saving to storage
// escHtml protects display; sanitizeInput protects the stored data itself
function sanitizeInput(s){
  if(!s)return'';
  return String(s)
    .replace(/<script[\s\S]*?<\/script>/gi,'')
    .replace(/<style[\s\S]*?<\/style>/gi,'')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi,'')
    .replace(/on\w+\s*=\s*[^\s>]*/gi,'')
    .replace(/<iframe[\s\S]*?>/gi,'')
    .trim();
}

// Returns null if valid, or an error string if invalid
function validateDate(str,allowFuture){
  if(!str||!str.trim())return'Date is required.';
  var d=parseDate(str);
  if(!d||isNaN(d.getTime()))return'"'+str+'" is not a valid date. Use MM/DD/YYYY.';
  var now=new Date();
  var twoYrsAgo=new Date(now.getFullYear()-2,now.getMonth(),now.getDate());
  var twoYrsAhead=new Date(now.getFullYear()+2,now.getMonth(),now.getDate());
  if(d<twoYrsAgo)return'Date "'+str+'" is over 2 years in the past — please verify.';
  if(!allowFuture&&d>twoYrsAhead)return'Date "'+str+'" is over 2 years in the future — please verify.';
  return null;
}
function exportSchedM(){
  var c=gc();if(!c||c.type!=='np'){alert('Schedule M is only available for nonprofit organizations.');return;}
  var fy=getFiscalYear(c.fiscalYearEnd);
  var inkindDonations=[];
  (c.donors||[]).forEach(function(d){
    (d.donations||[]).forEach(function(dn){
      if(dn.inkind!=='Yes')return;
      inkindDonations.push({donor:d.name||'',address:d.address||'',date:dn.date||'',desc:dn.itemDescription||'',fmv:Number(dn.fmv||0),auctioned:dn.auctioned?'Yes':'No',salePrice:dn.auctionSalePrice||0});
    });
  });
  if(!inkindDonations.length){alert('No in-kind (non-cash) donations found.');return;}
  var total=inkindDonations.reduce(function(s,r){return s+r.fmv;},0);
  var rows=[
    ['Schedule M — Non-Cash Contributions (Form 990)','','','','','',''],
    ['Organization:',c.name,'','','','',''],
    ['Fiscal year:',fy.label,'','','','',''],
    ['Generated:',new Date().toLocaleDateString(),'','','','',''],
    ['Total FMV:',total,'','','','',''],
    ['','','','','','',''],
    ['Donor Name','Address','Date','Item Description','Fair Market Value ($)','Used in Auction','Auction Sale Price ($)']
  ];
  inkindDonations.forEach(function(r){rows.push([r.donor,r.address,r.date,r.desc,r.fmv,r.auctioned,r.salePrice||'']);});
  var csv=rows.map(function(r){return r.map(function(v){var s=String(v===null||v===undefined?'':v);return s.indexOf(',')>=0||s.indexOf('"')>=0?'"'+s.replace(/"/g,'""')+'"':s;}).join(',');}).join('\n');
  var blob=new Blob([csv],{type:'text/csv'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;a.download=c.name.replace(/[^a-z0-9]/gi,'_')+'-Schedule-M-'+fy.label+'.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}
function exportTab(type){
  var c=gc();if(!c)return;var wb=XLSX.utils.book_new();var rows,ws;
  if(type==='expenses'){
    rows=[['Description','Category','Amount','Date','Fund','Reconciled']];
    (c.expenses||[]).filter(function(e){return!e.deleted&&!e.voided&&!e.isReversal;}).forEach(function(e){rows.push([e.desc||'',e.cat||'',Number(e.amt||0),e.date||'',e.fund||'',e.reconciled?'Yes':'No']);});
    ws=XLSX.utils.aoa_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,'Expenses');
  }else if(type==='income'){
    rows=[['Name','Category','Projected','Received','Status']];
    (c.income||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}).forEach(function(r){rows.push([r.name||'',r.cat||'',Number(r.proj||0),Number(r.recv||0),r.status||'']);});
    ws=XLSX.utils.aoa_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,'Income');
  }else if(type==='revenue'){
    rows=[['Name','Category','Projected','Actual','Confidence']];
    (c.revenue||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}).forEach(function(r){rows.push([r.name||'',r.cat||'',Number(r.proj||0),Number(r.act||0),r.conf||'']);});
    ws=XLSX.utils.aoa_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,'Revenue');
  }else if(type==='donors'){
    rows=[['Donor','Email','Phone','Total Donated','Last Gift','TY Pending']];
    (c.donors||[]).forEach(function(d){
      var tot=(d.donations||[]).reduce(function(s,dn){return s+Number(dn.amt||0);},0);
      var last=(d.donations||[]).slice(-1)[0];
      var pending=(d.donations||[]).filter(function(dn){return dn.ty==='No';}).length;
      rows.push([d.name||'',d.email||'',d.phone||'',tot,last?last.date:'',pending]);
    });
    ws=XLSX.utils.aoa_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,'Donors');
    var dd=[['Donor','Amount','Date','Fund','Restriction','TY Sent']];
    (c.donors||[]).forEach(function(d){(d.donations||[]).forEach(function(dn){dd.push([d.name||'',Number(dn.amt||0),dn.date||'',dn.fund||'',rstLabel(dn.rst),dn.ty||'']);});});
    if(dd.length>1)XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(dd),'Donation Detail');
  }else if(type==='grants'){
    rows=[['Grant','Funder','Awarded','Status','Deadline','Spent','Remaining']];
    var exp=(c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;});
    (c.grants||[]).forEach(function(gr){var sp=exp.filter(function(e){return e.grantId===gr.id;}).reduce(function(s,e){return s+Number(e.amt||0);},0);rows.push([gr.name,gr.funder||'',Number(gr.awarded||0),gr.status||'',gr.deadline||'',sp,Number(gr.awarded||0)-sp]);});
    ws=XLSX.utils.aoa_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,'Grants');
  }else if(type==='budget'){
    rows=[['Group','Line item','Type','Budgeted']];
    (c.budgetItems||[]).forEach(function(b){rows.push([b.group||b.type,b.cat,b.type,Number(b.amt||0)]);});
    ws=XLSX.utils.aoa_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,'Budget');
  }else if(type==='gl'){
    rows=[['Account Code','Account','Date','Description','Source','Amount','Running Balance']];
    var accts=c.accounts||[];var txns2=[];
    function addT(items,amtKey,sign,panel){(items||[]).forEach(function(r){var code=r.acctCode||lookupAcctByCAT(c,r.cat)||('CAT:'+(r.cat||'Uncategorized'));txns2.push({code:code,date:fmtDate(r.date||''),desc:r.desc||r.name||'',amt:Number(r[amtKey]||0)*sign,panel:panel});});}
    if(c.type==='np'){addT((c.income||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}),'recv',1,'Income');addT((c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}),'amt',-1,'Expense');}
    else if(c.type==='sb'){addT((c.revenue||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}),'act',1,'Revenue');addT((c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}),'amt',-1,'Expense');}
    else{addT((c.income||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}),'amt',1,'Income');addT((c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}),'amt',-1,'Expense');}
    var byCode={};txns2.forEach(function(t){if(!byCode[t.code])byCode[t.code]=[];byCode[t.code].push(t);});
    Object.keys(byCode).sort().forEach(function(code){
      var acct=accts.find(function(a){return a.code===code;})||{code:code,name:code.indexOf('CAT:')=== 0?code.slice(4):code};
      var running2=0;
      byCode[code].sort(function(a,b){return(a.date||'').localeCompare(b.date||'');}).forEach(function(t){running2+=t.amt;rows.push([acct.code,acct.name,t.date,t.desc,t.panel,t.amt,running2]);});
    });
    ws=XLSX.utils.aoa_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,'General Ledger');
  }else if(type==='ar'){
    rows=[['Invoice #','Client','Description','Amount','Issued','Due','Status']];
    (c.invoices||[]).forEach(function(inv){rows.push([inv.num||'',inv.client||'',inv.desc||'',Number(inv.amt||0),inv.date||'',inv.due||'',inv.status||'']);});
    ws=XLSX.utils.aoa_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,'Invoices');
  }else if(type==='procurement'){
    rows=[['Vendor','Scope','Bid Amount','Date','Status','Federal','Winner']];
    (c.procurement||[]).forEach(function(b){rows.push([b.vendor||'',b.scope||'',Number(b.bidAmt||0),b.bidDate||'',b.status||'',b.federal?'Yes':'No',b.winner||'']);});
    ws=XLSX.utils.aoa_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,'Procurement');
  }else if(type==='peinc'){
    rows=[['Name','Category','Amount','Frequency','Date']];
    (c.income||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}).forEach(function(r){rows.push([r.name||'',r.cat||'',Number(r.amt||0),r.freq||'',r.date||'']);});
    ws=XLSX.utils.aoa_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,'Income');
  }else{return doXL();}
  XLSX.writeFile(wb,(c.name||'client').replace(/[^a-z0-9]/gi,'-')+'-'+type+'-clarity.xlsx');
}
function FB(){return'';}
function ES(title,sub,fn){return'<div class="empty"><div class="et">'+title+'</div><div class="es">'+sub+'</div>'+(fn?'<button class="add-btn" onclick="'+fn+'" style="margin:0 auto">+ Add one now</button>':'')+'<button class="fb-nudge" onclick="openFB()">💬 What do you wish we had? Drop us a line.</button></div>';}
function SB(s){var m={Prospecting:'b-gray',Applied:'b-blue',Awarded:'b-amber',Received:'b-green',Confirmed:'b-green',Likely:'b-teal',Possible:'b-amber',Speculative:'b-gray','In Progress':'b-blue',Reporting:'b-amber',Closed:'b-gray',Denied:'b-red',Paid:'b-green',Draft:'b-gray',Sent:'b-blue',Overdue:'b-red',Partial:'b-amber',Disputed:'b-red','Written Off':'b-gray',Unpaid:'b-amber'};return'<span class="badge '+(m[s]||'b-gray')+'">'+s+'</span>';}
function catSum(items,key){var cats={};items.forEach(function(r){var c=r.cat||'Other';if(!cats[c])cats[c]=0;cats[c]+=Number(r[key]||0);});return Object.keys(cats).map(function(c){return'<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--soft)"><span style="color:var(--muted)">'+c+'</span><span>'+fmt(cats[c])+'</span></div>';}).join('');}
function catF(items,fn){var cats=['all'];items.forEach(function(r){if(r.cat&&cats.indexOf(r.cat)<0)cats.push(r.cat);});if(cats.length<=2)return'';return'<div class="cat-filter"><span style="font-size:12px;color:var(--muted)">Filter:</span><div class="sw"><select onchange="CF=this.value;'+fn+'">'+cats.map(function(c){return'<option value="'+escHtml(c)+'"'+(CF===c?' selected':'')+'>'+( c==='all'?'All categories':escHtml(c))+'</option>';}).join('')+'</select></div></div>';}
function srchBar(panelId,fn){var q=SRCH[panelId]||'';return'<div style="display:flex;align-items:center;gap:8px;margin-bottom:1rem"><input type="text" placeholder="Search..." value="'+q.replace(/"/g,'&quot;')+'" oninput="SRCH[\''+panelId+'\']=this.value;'+fn+'" style="max-width:220px;padding:6px 10px;font-size:12px;border:1px solid var(--border);border-radius:7px;background:var(--surface);color:var(--text);font-family:DM Sans,sans-serif;outline:none">'+(q?'<button onclick="SRCH[\''+panelId+'\']=\'\';'+fn+'" style="font-size:11px;color:var(--muted);background:none;border:none;cursor:pointer;padding:2px 6px">✕ Clear</button>':'')+'</div>';}
function srchItems(items,q,fields){if(!q)return items;var lq=q.toLowerCase();return items.filter(function(r){return fields.some(function(f){var v=r[f];return v&&String(v).toLowerCase().indexOf(lq)>=0;});});}

// ══════════════════════════════════════════
// RENDER ALL
// ══════════════════════════════════════════
// _dirtyPanels: set of panel names that need re-rendering.
// null means "render everything" (full renderAll).
// Use markDirty('panelname') from save functions to scope re-renders.
var _dirtyPanels=null;
function markDirty(){
  if(_dirtyPanels===null)_dirtyPanels=new Set();
  for(var i=0;i<arguments.length;i++)_dirtyPanels.add(arguments[i]);
}

function renderAll(force){
  var c=gc();if(!c)return;
  // Always keep ledger current — migrateToLedger is idempotent via dedup
  if(typeof migrateToLedger==='function'){
    try{migrateToLedger(c);}catch(e){console.warn('[clarity] migrateToLedger error:',e);}
  }
  function safe(fn,name){
    // Skip if dirty tracking is active and this panel isn't dirty
    if(!force&&_dirtyPanels!==null&&!_dirtyPanels.has(name))return;
    try{fn();}catch(e){
      console.error('[Clarity] render error in '+name+':',e);
      var p=g('p-'+name);
      if(p)p.innerHTML='<div style="padding:1.5rem;color:var(--red);font-size:13px;background:var(--soft);border-radius:8px;margin:1rem 0">⚠ Display error in '+name+'. Your data is safe — try refreshing.<br><span style="font-size:11px;color:var(--muted)">'+e.message+'</span></div>';
    }
  }
  if(c.type==='np'){safe(function(){renderGrants(c);},'grants');safe(function(){renderProcurement(c);},'procurement');safe(function(){renderNpInc(c);},'funding');safe(function(){renderNpExp(c);},'npexp');safe(function(){renderDonors(c);},'donors');safe(function(){renderNpJrn(c);},'npjrn');safe(function(){renderNpAct(c);},'npact');var ccPnp=g('p-cc');if(ccPnp&&ccPnp.classList.contains('active'))safe(function(){renderCCTab(c);},'cc');var reconP=g('p-recon');if(reconP&&reconP.classList.contains('active'))safe(function(){renderReconciliation(c);},'recon');}
  else if(c.type==='sb'){safe(function(){renderRev(c);},'revenue');safe(function(){renderCF(c);},'cashflow');safe(function(){renderSbExp(c);},'sbexp');safe(function(){renderAR(c);},'ar');safe(function(){renderJournalEntries(c);},'je');safe(function(){renderBalanceSheet(c);},'bs');var ccPsb=g('p-cc');if(ccPsb&&ccPsb.classList.contains('active'))safe(function(){renderCCTab(c);},'cc');var reconPsb=g('p-recon');if(reconPsb&&reconPsb.classList.contains('active'))safe(function(){renderReconciliation(c);},'recon');safe(function(){renderSbJrn(c);},'sbjrn');safe(function(){renderSbAct(c);},'sbact');}
  else{safe(function(){renderPeInc(c);},'peinc');safe(function(){renderPeExp(c);},'peexp');safe(function(){renderPeJrn(c);},'pejrn');safe(function(){renderPeAct(c);},'peact');}
  // budget, reports, coa, gl, trash always render when dirty tracking is off;
  // when tracking is on they only render if explicitly marked
  safe(function(){renderBudgetMultiYear();},'budget');
  safe(function(){renderReports();},'reports');
  safe(function(){renderCOA(c);},'coa');
  safe(function(){renderGL(c);},'gl');
  safe(function(){renderTrialBalance(c);},'trialbal');
  safe(function(){renderTrash(c);},'trash');
  renderRecurBanner();
  if(typeof renderTodoBar==='function')renderTodoBar();
  // Always clear dirty set after render
  _dirtyPanels=null;
}

// ── GRANTS ──────────────────────────────
function renderGrants(cc){
  var c=cc||gc(),p=g('p-grants');if(!p)return;if(!c)return;if(!c.grants)c.grants=[];
  if(!c.grants.length){p.innerHTML=FB()+XB('grants')+ES('No grants yet','Add your first grant to track funding, deadlines, and expenses.','EI=-1;openM(\'m-grant\')')+(typeof renderFiscalSponsorships==='function'?renderFiscalSponsorships(c):'')+(typeof renderComplianceBanner==='function'?renderComplianceBanner(c):'');return;}
  if(!AG||!c.grants.find(function(x){return x.id===AG;}))AG=c.grants[0].id;
  var gr=c.grants.find(function(x){return x.id===AG;})||c.grants[0];
  var opts=c.grants.map(function(x){return'<option value="'+x.id+'"'+(x.id===AG?' selected':'')+'>'+x.name+'</option>';}).join('');
  var gExp=(c.expenses||[]).filter(function(e){return!e.deleted&&!e.voided&&!e.isReversal&&e.grantId===AG;});
  var gInc=(c.income||[]).filter(function(r){return!r.deleted&&!r.voided&&r.grantId===AG;});
  var spent=gExp.reduce(function(s,e){var pct=e.grantPct!=null?Number(e.grantPct)/100:1;return s+Number(e.amt||0)*pct;},0),awarded=Number(gr.awarded||0);
  var incRecv=gInc.reduce(function(s,r){return s+Number(r.recv||0);},0);
  var rem=awarded-incRecv;
  var eRows=gExp.length?gExp.map(function(e){var oi=(c.expenses||[]).indexOf(e);var pct=e.grantPct!=null?Number(e.grantPct):100;var allocAmt=Number(e.amt||0)*(pct/100);return'<tr><td>'+escHtml(e.desc)+'</td><td>'+escHtml(e.cat||'--')+'</td><td>'+(pct!==100?fmt(allocAmt)+'<span style="font-size:10px;color:var(--muted);margin-left:4px">('+pct+'% of '+fmt(e.amt)+')</span>':fmt(e.amt))+'</td><td style="color:var(--muted)">'+(e.date||'--')+'</td><td><input type="checkbox" class="rcb" '+(e.reconciled?'checked':'')+' onchange="tgRecon('+oi+')" title="Reconciled"></td><td>'+rb('expenses',oi)+'</td></tr>';}).join(''):'<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--muted);font-size:12px">No expenses logged against this grant yet.</td></tr>';
  var iRows=gInc.length?gInc.map(function(r){var oi=(c.income||[]).indexOf(r);return'<tr><td style="font-weight:500">'+escHtml(r.name||'—')+'</td><td>'+escHtml(r.cat||'—')+'</td><td class="vb">'+fmt(r.proj)+'</td><td class="vg">'+fmt(r.recv)+'</td><td style="color:var(--muted)">'+(r.date||'—')+'</td><td>'+SB(r.status||'')+'</td><td><input type="checkbox" class="rcb" '+(r.reconciled===true?'checked':'')+' onchange="tgReconInc('+oi+')" title="Reconciled"></td><td>'+rb('income',oi)+'</td></tr>';}).join(''):'<tr><td colspan="8" style="text-align:center;padding:1.5rem;color:var(--muted);font-size:12px">No income entries linked to this grant yet. Click "+ Link income" above to add one.</td></tr>';

  // ── Deadline badge helper ──
  function dlBadge(dateStr,label){
    if(!dateStr)return'';
    var dl=parseDate(dateStr),now=new Date();
    if(!dl)return'<span style="font-size:12px;color:var(--muted)">'+escHtml(dateStr)+'</span>';
    var days=Math.floor((dl-now)/(1000*60*60*24));
    if(days<0)return'<span class="badge" style="background:var(--red-bg);color:var(--red);border:1px solid var(--red)">🔴 MISSED — '+Math.abs(days)+'d ago</span>';
    if(days<=5)return'<span class="badge" style="background:#fff0f0;color:#c0392b;border:1px solid #c0392b;font-weight:600">🔴 '+label+' in '+days+'d</span>';
    if(days<=15)return'<span class="badge" style="background:#fff3e0;color:#e65100;border:1px solid #e65100">🔶 '+label+' in '+days+'d</span>';
    if(days<=30)return'<span class="badge" style="background:var(--amber-bg);color:var(--amber);border:1px solid var(--amber)">⚠ '+label+' in '+days+'d</span>';
    return'<span style="font-size:12px;color:var(--muted)">'+escHtml(dateStr)+'</span>';
  }

  // ── Fiscal year span flag on reporting deadline ──
  function rptDeadlineFYFlag(dateStr){
    if(!dateStr||!c.fiscalYearEnd)return'';
    var dl=parseDate(dateStr);if(!dl)return'';
    var fyNow=getFiscalYear(c.fiscalYearEnd,new Date());
    var fyDl=getFiscalYear(c.fiscalYearEnd,dl);
    if(fyNow.label!==fyDl.label)return' <span class="badge b-blue" style="font-size:10px">spans FY'+fyNow.label+'→FY'+fyDl.label+'</span>';
    return'';
  }

  p.innerHTML=FB()+XB('grants')+'<div class="g-sel-row"><div class="sw"><select style="max-width:220px;font-size:13px;padding:8px 28px 8px 12px" onchange="AG=this.value;renderGrants()">'+opts+'</select></div><button class="add-btn" onclick="EI=-1;window._gReqTemp=[{id:uid(),label:\'Submit final report to funder\',done:false},{id:uid(),label:\'Collect and file all receipts\',done:false},{id:uid(),label:\'Verify match requirement met\',done:false},{id:uid(),label:\'Send thank-you letter to funder\',done:false},{id:uid(),label:\'Confirm all funds spent per restrictions\',done:false}];_renderGrantReqList(window._gReqTemp);openM(\'m-grant\')">+ Add grant</button><button class="e-btn" style="border:1px solid var(--border);border-radius:7px;padding:5px 10px;font-size:14px;color:var(--text)" onclick="editGrant(\''+AG+'\')" title="Edit this grant">&#9998;</button></div>'
  +'<div class="metrics"><div class="metric"><div class="m-lbl">Awarded</div><div class="m-val vg">'+fmt(awarded)+'</div></div><div class="metric"><div class="m-lbl">Received</div><div class="m-val vb">'+fmt(incRecv)+'</div></div><div class="metric"><div class="m-lbl">Spent</div><div class="m-val vr">'+fmt(spent)+'</div></div><div class="metric"><div class="m-lbl">Remaining</div><div class="m-val '+(rem>=0?'vb':'vr')+'">'+fmt(rem)+'</div></div></div>'
  +'<div class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.75rem"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="font-size:13px;font-weight:500">'+escHtml(gr.name)+'</span>'+SB(gr.status||'Applied')+(gr.reconciled?'<span class="badge b-green" title="Grant reconciled">✓ Reconciled</span>':'')+'</div><button class="e-btn" style="border:1px solid var(--border);border-radius:7px;padding:4px 9px;font-size:14px;color:var(--text);flex-shrink:0" onclick="editGrant(\''+AG+'\')" title="Edit this grant">&#9998;</button></div>'
  +(gr.funder?'<div style="font-size:12px;color:var(--muted);margin-bottom:3px">Funder: <span style="color:var(--text)">'+gr.funder+'</span></div>':'')
  +(gr.portalUrl?'<div style="font-size:12px;color:var(--muted);margin-bottom:3px">Portal: <a href="'+escHtml(gr.portalUrl)+'" target="_blank" rel="noopener" style="color:var(--blue);text-decoration:underline">Open grant portal ↗</a></div>':'')
  +(gr.appDeadline?'<div style="font-size:12px;color:var(--muted);margin-bottom:3px">Application deadline: '+dlBadge(gr.appDeadline,'Apply')+'</div>':'')
  +(gr.deadline?'<div style="font-size:12px;color:var(--muted);margin-bottom:3px">Reporting deadline: '+dlBadge(gr.deadline,'Report')+rptDeadlineFYFlag(gr.deadline)+'</div>':'')
  +(gr.match?'<div style="font-size:12px;color:var(--muted);margin-bottom:3px">Match requirement: <span style="color:var(--text)">'+gr.match+'</span>'+(function(){
    if(!gr.matchRequired||Number(gr.matchRequired)<=0)return'';
    var req=Number(gr.matchRequired);
    var matched=(c.income||[]).filter(function(r){return r.grantId===AG&&!r.deleted&&!r.voided;}).reduce(function(s,r){return s+Number(r.recv||0);},0);
    var pct=Math.min(100,Math.round((matched/req)*100));
    var met=matched>=req;
    return' <span class="badge '+(met?'b-green':'b-amber')+'" style="font-size:10px">'+(met?'✓ Match met':'Match: '+fmt(matched)+' / '+fmt(req)+' ('+pct+'%)')+'</span>';
  })()+  '</div>':'')
  +(gr.restrict?'<div style="font-size:12px;margin-top:6px;padding:.75rem;background:var(--bg);border-radius:8px;line-height:1.5"><strong>Restrictions: </strong><span style="color:var(--muted)">'+gr.restrict+'</span></div>':'')
  +(function(){
    var now=new Date(),gaps=[];
    var dl=gr.deadline?parseDate(gr.deadline):null;
    var appDl=gr.appDeadline?parseDate(gr.appDeadline):null;
    var daysLeft=dl?Math.floor((dl-now)/(1000*60*60*24)):null;
    var daysLeftApp=appDl?Math.floor((appDl-now)/(1000*60*60*24)):null;
    var drawPct=awarded>0?Math.round((spent/awarded)*100):0;
    if(rem<0)gaps.push({sev:'red',msg:'Over-budget by '+fmt(Math.abs(rem))});
    if(drawPct<10&&gr.status==='In Progress')gaps.push({sev:'amber',msg:'Low drawdown ('+drawPct+'%) — funds may lapse'});
    if(daysLeftApp!==null&&daysLeftApp<30&&daysLeftApp>=0)gaps.push({sev:'amber',msg:'Application deadline in '+daysLeftApp+' day'+(daysLeftApp===1?'':'s')});
    if(daysLeftApp!==null&&daysLeftApp<0&&gr.status==='Prospecting'||gr.status==='Applied')gaps.push({sev:'red',msg:'Application deadline passed '+Math.abs(daysLeftApp||0)+' day'+(Math.abs(daysLeftApp||0)===1?'':'s')+' ago'});
    if(daysLeft!==null&&daysLeft<30&&daysLeft>=0)gaps.push({sev:'amber',msg:'Reporting deadline in '+daysLeft+' day'+(daysLeft===1?'':'s')});
    if(daysLeft!==null&&daysLeft<0)gaps.push({sev:'red',msg:'Reporting deadline passed '+Math.abs(daysLeft)+' day'+(Math.abs(daysLeft)===1?'':'s')+' ago'});
    if(!gr.reconciled){
    var unreconExp=gExp.filter(function(e){return!e.reconciled;}).length;
    var unreconInc=gInc.filter(function(r){return r.reconciled!==true;}).length;
    var unrecon=unreconExp+unreconInc;
    if(unrecon>0)gaps.push({sev:'amber',msg:(unreconExp>0?unreconExp+' unreconciled expense'+(unreconExp===1?'':'s'):'')+(unreconExp>0&&unreconInc>0?', ':'')+(unreconInc>0?unreconInc+' unreconciled income'+(unreconInc===1?'':'s'):'')});
    if(gr.status==='Awarded'&&spent===0)gaps.push({sev:'amber',msg:'Awarded but no drawdown started'});
    }
    if(incRecv===0&&awarded>0&&(gr.status==='Awarded'||gr.status==='In Progress'))gaps.push({sev:'amber',msg:'No income received — link payment via Income tab with this grant selected'});
    if(!gaps.length)return'<div style="font-size:12px;color:var(--green);margin-top:.75rem;padding:.5rem 0">✓ No compliance gaps</div>';
    var sevColor={red:'var(--red)',amber:'var(--amber)'};
    return'<div style="margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--soft)">'+gaps.map(function(gp){return'<div style="display:flex;align-items:center;gap:8px;padding:3px 0"><span style="width:7px;height:7px;border-radius:50%;background:'+sevColor[gp.sev]+';flex-shrink:0;display:inline-block"></span><span style="font-size:12px;color:'+sevColor[gp.sev]+'">'+gp.msg+'</span></div>';}).join('')+'</div>';
  })()
  +'</div>'
  +(function(){
    var _allExp=gExp.length>0&&gExp.every(function(e){return e.reconciled;});
    var _allInc=gInc.length>0&&gInc.every(function(r){return r.reconciled===true;});
    var _hasItems=gExp.length>0||gInc.length>0;
    var _reqs=gr.requirements||[];
    var _allReqs=_reqs.length===0||_reqs.every(function(r){return r.done;});
    var _pendingReqs=_reqs.filter(function(r){return!r.done;});
    if(gr.reconciled){
      return '<div style="background:var(--green-bg,#f0faf4);border:1px solid var(--green);border-radius:8px;padding:.6rem 1rem;margin-bottom:.75rem;display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:var(--green);font-weight:500">✓ Grant reconciled</span><button class="add-btn" style="font-size:11px;padding:3px 10px;background:none;border:1px solid var(--green);color:var(--green)" onclick="unmarkGrantReconciled(\''+AG+'\')" title="Undo reconciled status">Undo</button></div>';
    } else if(_hasItems&&_allExp&&_allInc&&_reqs.length>0&&!_allReqs){
      return '<div style="background:var(--amber-bg,#fffbea);border:1px solid var(--amber);border-radius:8px;padding:.6rem 1rem;margin-bottom:.75rem"><div style="font-size:12px;color:var(--amber);font-weight:500;margin-bottom:4px">✓ All transactions reconciled — complete requirements to close out</div><div style="font-size:11px;color:var(--muted)">Remaining: '+_pendingReqs.map(function(r){return escHtml(r.label);}).join(', ')+'</div></div>';
    } else if(_hasItems&&_allExp&&_allInc&&_allReqs){
      return '<div style="background:var(--green-bg,#f0faf4);border:1px solid var(--green);border-radius:8px;padding:.6rem 1rem;margin-bottom:.75rem;display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:var(--green);font-weight:500">✓ All items reconciled — ready to close out</span><button class="sv-btn" style="font-size:11px;padding:4px 12px" onclick="markGrantReconciled(\''+AG+'\')" title="Mark this grant as fully reconciled">Mark Grant Reconciled</button></div>';
    }
    return '';
  }())
  +'<div class="card"><div class="c-head"><span class="c-title">Income linked to this grant</span><div style="display:flex;gap:6px"><button class="sv-btn" style="font-size:11px;padding:4px 12px" onclick="openGrantIncomeModal(\''+AG+'\',\'add\')" title="Create a new income entry for this grant">+ Add income</button><button class="add-btn" style="font-size:11px;padding:4px 10px" onclick="openGrantIncomeModal(\''+AG+'\',\'link\')" title="Link an income entry you already added elsewhere">🔗 Link existing</button></div></div><table><thead><tr><th style="width:18%">Source</th><th style="width:13%">Category</th><th style="width:10%">Projected</th><th style="width:10%">Received</th><th style="width:11%">Date</th><th style="width:9%">Status</th><th style="width:9%">Reconciled</th><th style="width:20%"></th></tr></thead><tbody>'+iRows+'</tbody></table></div>'
  +'<div class="card"><div class="c-head"><span class="c-title">Expenses against this grant</span><button class="add-btn" onclick="EI=-1;g(\'e-gid\').value=\''+AG+'\';openM(\'m-exp\')">+ Log expense</button></div><table><thead><tr><th style="width:26%">Description</th><th style="width:14%">Category</th><th style="width:12%">Amount</th><th style="width:14%">Date</th><th style="width:14%">Reconciled</th><th style="width:20%"></th></tr></thead><tbody>'+eRows+'</tbody></table></div>'
  +(typeof renderFiscalSponsorships==='function'?renderFiscalSponsorships(c):'')
  +(typeof renderComplianceBanner==='function'?renderComplianceBanner(c):'');
}
function batchUnreconcileExp(){
  var c=gc();if(!c)return;
  var checked=[];
  document.querySelectorAll('.exp-recon-chk:checked').forEach(function(cb){
    var oi=Number(cb.getAttribute('data-oi'));
    if(!isNaN(oi))checked.push(oi);
  });
  var reconciled=checked.filter(function(oi){return c.expenses[oi]&&c.expenses[oi].reconciled;});
  if(!reconciled.length){alert('Select at least one reconciled transaction to unreconcile.');return;}
  if(!confirm('Unreconcile '+reconciled.length+' selected transaction'+(reconciled.length!==1?'s':'')+'?'))return;
  reconciled.forEach(function(oi){if(c.expenses[oi])c.expenses[oi].reconciled=false;});
  sv();
  if(c.type==='np')renderNpExp(c);
  else if(c.type==='sb')renderSbExp(c);
  else renderPeExp(c);
}
function inlineSetExpAcct(oi, val) {
  var c = gc(); if (!c || !c.expenses[oi]) return;
  var e = c.expenses[oi];

  // Handle "+ New account..." option
  if (val === '__new__') {
    var name = prompt('New account name (e.g. Office Supplies, Software, Rent):');
    if (!name || !name.trim()) return;
    name = name.trim();
    if (!c.accounts) c.accounts = [];
    // Check if already exists by name
    var existing = c.accounts.find(function(a){ return a.name.toLowerCase()===name.toLowerCase(); });
    if (existing) {
      e.acctCode = existing.code;
      e.cat = existing.name;
    } else {
      // Auto-generate a 4-digit expense code starting at 5010
      var usedCodes = c.accounts.map(function(a){ return Number(a.code)||0; });
      var nextCode = 5010;
      while (usedCodes.indexOf(nextCode) >= 0) nextCode++;
      var newAcct = { id: uid(), code: String(nextCode), name: name, type: 'Expense', cat: name, active: true };
      c.accounts.push(newAcct);
      c.accounts.sort(function(a,b){ return (a.code||'').localeCompare(b.code||''); });
      e.acctCode = newAcct.code;
      e.cat = name;
    }
  } else {
    // val is "code|name" format
    var parts = val.split('|');
    var code = parts[0];
    var name = parts[1] || '';
    e.acctCode = code;
    if (name) e.cat = name;
  }

  // Re-fire GL update so ledger, P&L, balance sheet stay in sync
  if (typeof updateLedgerEntry === 'function' && e.id) {
    var cashCode = typeof _defaultCashCode === 'function' ? _defaultCashCode(c) : '1010';
    updateLedgerEntry(c, e.id, e.acctCode || '5010', cashCode, Number(e.amt||0), e.desc||'Expense', 'expense');
  }
  sv();
  if (typeof markDirty === 'function') markDirty('npexp','sbexp','peexp','reports','bs','gl');
  // Re-render so the dropdown shows the new selection
  if (c.type==='np' && typeof renderNpExp==='function') renderNpExp(c);
  else if (c.type==='sb' && typeof renderSbExp==='function') renderSbExp(c);
  else if (typeof renderPeExp==='function') renderPeExp(c);
}

function tgRecon(i){var c=gc();if(!c||!c.expenses[i])return;var cur=c.expenses[i].reconciled;if(!cur&&!confirm('Mark this transaction as reconciled?'))return;if(cur&&!confirm('Unmark this transaction as reconciled?'))return;c.expenses[i].reconciled=!cur;if(!c.expenses[i].reconciled&&AG){var _gr=c.grants&&c.grants.find(function(x){return x.id===AG;});if(_gr&&_gr.reconciled)_gr.reconciled=false;}sv();renderGrants();renderNpExp(c);}
function tgReconInc(i){var c=gc();if(!c||!c.income[i])return;c.income[i].reconciled=!c.income[i].reconciled;if(!c.income[i].reconciled&&AG){var _gr=c.grants&&c.grants.find(function(x){return x.id===AG;});if(_gr&&_gr.reconciled)_gr.reconciled=false;}sv();renderGrants();renderNpInc(c);}
function _renderGrantReqList(reqs){
  var el=g('g-req-list');if(!el)return;
  if(!reqs.length){el.innerHTML='<div style="font-size:11px;color:var(--muted);padding:4px 0">No requirements added yet.</div>';return;}
  el.innerHTML=reqs.map(function(r,i){
    return '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'
      +'<input type="checkbox" id="greq-'+i+'" '+(r.done?'checked':'')
      +' onchange="var c=gc();if(c&&AG){var gr=c.grants.find(function(x){return x.id===AG;});if(gr&&gr.requirements&&gr.requirements['+i+'])gr.requirements['+i+'].done=this.checked;sv();renderGrants();}">'
      +'<span style="font-size:12px;flex:1">'+escHtml(r.label)+'</span>'
      +'<button class="add-btn" style="font-size:10px;padding:2px 7px;background:none;border:1px solid var(--border);color:var(--muted)" '
      +'onclick="_removeGrantReq('+i+')">✕</button>'
      +'</div>';
  }).join('');
}
function _addGrantReq(){
  var inp=g('g-req-new');if(!inp||!inp.value.trim())return;
  var label=inp.value.trim();inp.value='';
  // Store temp reqs in a window var until saveGrant commits them
  window._gReqTemp=window._gReqTemp||[];
  window._gReqTemp.push({id:uid(),label:label,done:false});
  _renderGrantReqList(window._gReqTemp);
}
function _removeGrantReq(i){
  window._gReqTemp=window._gReqTemp||[];
  window._gReqTemp.splice(i,1);
  _renderGrantReqList(window._gReqTemp);
}
function markGrantReconciled(id){var c=gc();if(!c)return;var gr=c.grants&&c.grants.find(function(x){return x.id===id;});if(!gr)return;var reqs=gr.requirements||[];var unmetReqs=reqs.filter(function(r){return!r.done;});if(unmetReqs.length){alert('Please check off all close-out requirements before marking this grant reconciled.\n\nOutstanding:\n'+unmetReqs.map(function(r){return'  • '+r.label;}).join('\n'));return;}gr.reconciled=true;sv();renderGrants();}
function unmarkGrantReconciled(id){var c=gc();if(!c)return;var gr=c.grants&&c.grants.find(function(x){return x.id===id;});if(!gr)return;gr.reconciled=false;sv();renderGrants();}
function editGrant(id){var c=gc();if(!c)return;var gr=c.grants.find(function(x){return x.id===id;});if(!gr)return;EI=c.grants.indexOf(gr);g('g-n').value=gr.name||'';g('g-f').value=gr.funder||'';g('g-a').value=gr.awarded||'';g('g-st').value=gr.status||'Applied';g('g-dl').value=gr.deadline||'';g('g-m').value=gr.match||'';var gmr=g('g-mr');if(gmr)gmr.value=gr.matchRequired||'';g('g-r').value=gr.restrict||'';var gappdl=g('g-appdl');if(gappdl)gappdl.value=gr.appDeadline||'';var gportal=g('g-portal');if(gportal)gportal.value=gr.portalUrl||'';window._gReqTemp=(gr.requirements||[]).map(function(r){return{id:r.id||uid(),label:r.label,done:r.done||false};});_renderGrantReqList(window._gReqTemp);openM('m-grant');}

function openGrantIncomeModal(grantId,mode){
  // mode: 'add' = new income pre-filled from grant, 'link' = blank modal with grant pre-selected
  var c=gc();if(!c)return;
  var gr=c.grants&&c.grants.find(function(x){return x.id===grantId;});
  EI=-1;
  openM('m-inc');
  setTimeout(function(){
    var gidEl=g('i-gid');if(gidEl)gidEl.value=grantId;
    if(mode==='add'&&gr){
      // Pre-fill with grant details
      var nEl=g('i-n');if(nEl)nEl.value=gr.name||'';
      var catEl=g('i-c');if(catEl){
        // Set to Grant category if it exists
        for(var i=0;i<catEl.options.length;i++){if(catEl.options[i].text.toLowerCase().indexOf('grant')>=0){catEl.selectedIndex=i;break;}}
      }
      var sEl=g('i-s');if(sEl)sEl.value='Awarded';
      var pEl=g('i-p');if(pEl&&gr.awarded)pEl.value=gr.awarded;
      var fundEl=g('i-fund');if(fundEl&&gr.restrict)fundEl.value='';
    }
  },80);
}

// ── NP INCOME ───────────────────────────
function renderNpInc(c){
  var p=g('p-funding');if(!p)return;if(!c)return;var inc=(c.income||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;});var filt=CF==='all'?inc:inc.filter(function(r){return r.cat===CF;});
  filt=srchItems(filt,SRCH['p-funding']||'',['name','cat','status','fund','date','acctCode']);
  var tp=inc.reduce(function(s,r){return(r.voided||r.isReversal)?s:s+Number(r.proj||0);},0),tr=inc.reduce(function(s,r){return(r.voided||r.isReversal)?s:s+Number(r.recv||0);},0);
  var rows=filt.map(function(r){var oi=inc.indexOf(r),pv=pct(r.recv,r.proj);var acctI=(c.accounts||[]).find(function(a){return a.code===r.acctCode||a.cat===r.cat||a.name===r.cat;});var codeI=acctI?'<span style="font-family:monospace;font-size:10px;background:var(--soft);padding:1px 4px;border-radius:3px">'+acctI.code+'</span>':'—';var grBadge='';if(r.grantId){var _gr=(c.grants||[]).find(function(gg){return gg.id===r.grantId;});if(_gr)grBadge=' <span class="badge b-green" style="cursor:pointer" onclick="runItemReport(\'grant\',\''+escHtml(_gr.name)+'\',\'Grant: '+escHtml(_gr.name)+'\',\'grants\')" title="Run grant report">'+escHtml(_gr.name)+'</span>';}var _srcCell=r.name?drillLink(r.name,'source',r.name,'incdetail'):('—');var _catCell=r.cat?drillLink(r.cat,'cat',r.cat,'incdetail'):('—');var _fundCell=r.fund?'<span class="badge b-blue" style="cursor:pointer" onclick="runItemReport(\'fund\',\''+escHtml(r.fund)+'\',\'Fund: '+escHtml(r.fund)+'\',\'fundpl\')" title="Run fund report">'+escHtml(r.fund)+'</span>':('—');return'<tr'+(r.voided?' style="opacity:.55;text-decoration:line-through"':'')+'><td style="font-weight:500">'+_srcCell+'</td><td>'+_catCell+'</td><td>'+codeI+'</td><td>'+_fundCell+grBadge+'</td><td>'+fmt(r.proj)+'</td><td>'+fmt(r.recv)+'</td><td>'+SB(r.status)+(r.recurring&&r.recurring!=='None'?' <span class="badge b-rec">&#8635;</span>':'')+'</td><td><div style="font-size:10px;color:var(--muted)">'+pv+'%</div><div class="pbar"><div class="pfill" style="width:'+pv+'%"></div></div></td><td>'+(r.inkindRef||r.auctionRef?'<span style="font-size:10px;color:var(--muted)" title="Auto-created from in-kind donation">&#9889; system</span>':rb('income',oi))+'</td></tr>';}).join('');
  var cs=catSum(inc,'recv');
  var _npCurBasis=(typeof RPT_BASIS!=='undefined'&&RPT_BASIS)?RPT_BASIS:(c.basisType||'cash');
  var _npBasisBadge='<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:'+(_npCurBasis==='accrual'?'#e3f2fd;color:#1565c0':'#e8f5e9;color:#2e7d32')+'">'+(  _npCurBasis==='accrual'?'Accrual — showing projected':'Cash — showing received')+'</span>';
  p.innerHTML=FB()+XB('income')+catF(inc,'renderNpInc(gc())')+srchBar('p-funding','renderNpInc(gc())')+_npBasisBadge+'<div class="metrics"><div class="metric"><div class="m-lbl">Projected</div><div class="m-val">'+fmt(tp)+'</div></div><div class="metric"><div class="m-lbl">Received</div><div class="m-val vg">'+fmt(tr)+'</div></div><div class="metric"><div class="m-lbl">Outstanding</div><div class="m-val va">'+fmt(tp-tr)+'</div></div></div>'+(cs?'<div class="card"><div class="c-title" style="margin-bottom:.75rem">By category</div>'+cs+'</div>':'')+'<div class="card"><div class="c-head"><span class="c-title">Funding pipeline</span><button class="add-btn" onclick="EI=-1;openM(\'m-inc\')">+ Add income</button></div>'+(filt.length?'<table><thead><tr><th style="width:15%">Source</th><th style="width:10%">Category</th><th style="width:7%">Code</th><th style="width:8%">Fund</th><th style="width:9%">Projected</th><th style="width:9%">Received</th><th style="width:11%">Status</th><th style="width:9%">Progress</th><th style="width:7%">Recon</th><th style="width:15%"></th></tr></thead><tbody>'+rows+'</tbody></table>':ES('No income sources yet','Add grants, donations, or other funding.','EI=-1;openM(\'m-inc\')'))+'</div>'+(typeof renderComplianceBanner==='function'?renderComplianceBanner(c):'');
}

// ── NP EXPENSES ─────────────────────────
function renderNpExp(c){
  var p=g('p-npexp');if(!p)return;if(!c)return;var exp=(c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;});var filt=CF==='all'?exp:exp.filter(function(r){return r.cat===CF;});
  filt=srchItems(filt,SRCH['p-npexp']||'',['desc','cat','fund','date','checkNum','vendor1099','receiptUrl','acctCode']);
  var tot=exp.reduce(function(s,r){return(r.voided||r.isReversal)?s:s+Number(r.amt||0);},0);
  var rows=filt.map(function(r){var oi=exp.indexOf(r);var acctE=(c.accounts||[]).find(function(a){return a.code===r.acctCode||a.cat===r.cat||a.name===r.cat;});var expAcctsE=(c.accounts||[]).filter(function(a){return a.type==='Expense'&&a.active!==false;});var _catAcctCell=r.reconciled?escHtml(r.cat||'—'):'<select onchange="inlineSetExpAcct('+oi+',this.value)" style="font-size:11px;padding:2px 6px;border:1px solid var(--border);border-radius:6px;max-width:140px;font-family:DM Sans,sans-serif;background:var(--surface);color:var(--text)" title="Category / Account"><option value="">— Category —</option>'+expAcctsE.map(function(a){return'<option value="'+escHtml(a.code)+'|'+escHtml(a.name)+'"'+((r.acctCode===a.code||r.cat===a.name||r.cat===a.cat)?' selected':'')+'>'+escHtml(a.name)+'</option>';}).join('')+'<option value="__new__" style="color:var(--np);font-weight:500">+ New account...</option></select>';var _vnd=r.vendor1099||r.desc||'';var _descCell=escHtml(_vnd||'—');var _fundCell=r.fund?'<span class="badge b-green" style="cursor:pointer" onclick="runItemReport(\'fund\',\''+escHtml(r.fund)+'\',\'Fund: '+escHtml(r.fund)+'\',\'expdetail\')" title="Run fund report">'+escHtml(r.fund)+'</span>':(r.grantId?'<span class="badge b-green">Grant</span>':'—');return'<tr'+(r.voided?' style="opacity:.55;text-decoration:line-through"':'')+'><td style="width:20px"><input type="checkbox" class="exp-recon-chk" data-oi="'+oi+'" style="width:13px;height:13px;cursor:pointer" '+(r.reconciled?'checked':'')+' onchange="tgRecon('+oi+')"></td><td>'+_descCell+'</td><td colspan="2">'+_catAcctCell+'</td><td>'+fmt(r.amt)+'</td><td style="color:var(--muted)">'+(r.date||'—')+'</td><td style="color:var(--muted);font-size:11px">'+(r.checkNum||'—')+'</td><td>'+rcptCell('expenses',oi,r)+'</td><td>'+_fundCell+'</td><td style="white-space:nowrap;min-width:220px">'+(r.inkindRef?'<span style="font-size:10px;color:var(--muted)" title="Auto-created from in-kind donation">&#9889; system</span>':'<span style="display:inline-flex;align-items:center;gap:3px">'+(r.functionalSplit?'<span class="badge b-blue" style="font-size:10px" title="Split allocation">split</span>':'')+rb('expenses',oi)+'<button class="add-btn" onclick="openAllocModal('+oi+')" title="Allocate across functional categories" style="font-size:11px;padding:3px 8px;white-space:nowrap">&#8853; Allocate</button></span>')+'</td></tr>';}).join('');
  var cs=catSum(exp,'amt');
  p.innerHTML=FB()+XB('expenses')+renderPayroll(c)+renderAP(c)+catF(exp,'renderNpExp(gc())')+srchBar('p-npexp','renderNpExp(gc())')+'<div class="metrics"><div class="metric"><div class="m-lbl">Total expenses</div><div class="m-val vr">'+fmt(tot)+'</div></div></div>'+(cs?'<div class="card"><div class="c-title" style="margin-bottom:.75rem">By category</div>'+cs+'</div>':'')+'<div class="card"><div class="c-head"><span class="c-title">Expense log</span><div style="display:flex;gap:.5rem;align-items:center"><button class="add-btn" style="font-size:11px;padding:3px 10px;background:none;border:1px solid var(--border);color:var(--muted)" onclick="batchUnreconcileExp()">↩ Unreconcile selected</button><button class="add-btn" onclick="EI=-1;g(\'e-gid\').value=\'\';openM(\'m-exp\')">+ Add expense</button></div></div>'+(exp.length?'<table><thead><tr><th style="width:20px"></th><th style="width:18%">Description</th><th style="width:15%">Category / Account</th><th style="width:7%">Amount</th><th style="width:7%">Date</th><th style="width:6%">Check #</th><th style="width:5%">📎</th><th style="width:8%">Fund</th><th style="width:9%">Recon</th><th style="width:26%"></th></tr></thead><tbody>'+rows+'</tbody></table>':ES('No expenses yet','Log your first expense.','EI=-1;g(\'e-gid\').value=\'\';openM(\'m-exp\')'))+'</div>';
}

// ── DONORS ──────────────────────────────
// normalizeRst: maps legacy binary values to the three-value canonical set.
// Called at read-time only — existing records are never mutated.
function normalizeRst(v){
  if(v==='Restricted')return'temporarily_restricted';
  if(v==='Nonrestricted'||!v)return'unrestricted';
  return v;
}
function rstLabel(v){
  var n=normalizeRst(v);
  if(n==='temporarily_restricted')return'Temp. restricted';
  if(n==='permanently_restricted')return'Perm. restricted';
  return'Unrestricted';
}
function rstBadge(v){
  var n=normalizeRst(v);
  if(n==='temporarily_restricted')return'<span class="badge b-amber">Temp. restricted</span>';
  if(n==='permanently_restricted')return'<span class="badge b-red">Perm. restricted</span>';
  return'<span class="badge b-green">Unrestricted</span>';
}
function renderDonors(cc){
  var c=cc||gc(),p=g('p-donors');if(!p)return;if(!c)return;if(!c.donors)c.donors=[];
  var donors=c.donors;
  // DONOR_F: if selected donor no longer exists, reset to all
  if(DONOR_F!=='all'&&!donors.find(function(d){return d.id===DONOR_F;}))DONOR_F='all';
  var visibleDonors=DONOR_F==='all'?donors:donors.filter(function(d){return d.id===DONOR_F;});
  var base=visibleDonors;
  var totAmt=base.reduce(function(s,d){return s+(d.donations||[]).filter(function(dn){return dn.inkind!=='Yes';}).reduce(function(s2,dn){return s2+Number(dn.amt||0);},0);},0);
  var pending=base.reduce(function(s,d){return s+(d.donations||[]).filter(function(dn){return dn.ty==='No';}).length;},0);

  // ── SCHEDULE B: flag donors giving $5,000+ cash in current fiscal year ──
  var SCHED_B_THRESHOLD=5000;
  var fy=getFiscalYear(c.fiscalYearEnd);
  var schedBDonors=[];
  donors.forEach(function(d){
    var fyTotal=(d.donations||[]).reduce(function(s,dn){
      if(dn.inkind==='Yes')return s;// in-kind excluded from Schedule B
      if(!dn.date)return s;
      var dt=new Date(dn.date);
      if(dt>=fy.start&&dt<=fy.end)return s+Number(dn.amt||0);
      return s;
    },0);
    if(fyTotal>=SCHED_B_THRESHOLD)schedBDonors.push({name:d.name,total:fyTotal});
  });
  var schedBAlert='';
  if(schedBDonors.length){
    var sbNames=schedBDonors.map(function(d){return escHtml(d.name)+' ('+fmt(d.total)+')';}).join(', ');
    schedBAlert='<div style="margin-bottom:1rem;padding:.875rem 1rem;background:#fff8e1;border:1px solid #f9a825;border-radius:10px;display:flex;gap:10px;align-items:flex-start">'
      +'<span style="font-size:18px;flex-shrink:0">⚠️</span>'
      +'<div><div style="font-weight:600;font-size:13px;color:#5d4037;margin-bottom:3px">Schedule B disclosure required</div>'
      +'<div style="font-size:12px;color:#6d4c41;line-height:1.6">The following donor'+(schedBDonors.length>1?'s have':'has')+' given $5,000 or more in the current fiscal year and must be reported on <strong>Form 990 Schedule B</strong>: '+sbNames+'.</div>'
      +'<div style="font-size:11px;color:#8d6e63;margin-top:4px">Consult your CPA to confirm disclosure requirements for your filing.</div>'
      +'</div></div>';
  }

  // ── SCHEDULE M: flag if total non-cash contributions ≥ $25,000 ──
  var totalInkindFMV=donors.reduce(function(s,d){
    return s+(d.donations||[]).filter(function(dn){return dn.inkind==='Yes';}).reduce(function(s2,dn){return s2+Number(dn.fmv||0);},0);
  },0);
  var schedMAlert='';
  if(totalInkindFMV>=25000){
    schedMAlert='<div style="margin-bottom:1rem;padding:.875rem 1rem;background:#e8f5e9;border:1px solid #43a047;border-radius:10px;display:flex;gap:10px;align-items:flex-start">'
      +'<span style="font-size:18px;flex-shrink:0">📋</span>'
      +'<div><div style="font-weight:600;font-size:13px;color:#1b5e20;margin-bottom:3px">Schedule M may be required</div>'
      +'<div style="font-size:12px;color:#2e7d32;line-height:1.6">Total non-cash (in-kind) contributions are <strong>'+fmt(totalInkindFMV)+'</strong>. Organizations receiving $25,000 or more in non-cash contributions must complete <strong>Form 990 Schedule M</strong>.</div>'
      +'<div style="font-size:11px;color:#388e3c;margin-top:4px">Consult your CPA. Certain property types (art, vehicles, clothing) have additional reporting requirements regardless of amount.</div>'
      +'</div></div>';
  }

  var cards=visibleDonors.map(function(d,_vi){
    var di=donors.indexOf(d);
    var dCash=(d.donations||[]).filter(function(dn){return dn.inkind!=='Yes';}).reduce(function(s,dn){return s+Number(dn.amt||0);},0);
    var dInkind=(d.donations||[]).filter(function(dn){return dn.inkind==='Yes';}).reduce(function(s,dn){return s+Number(dn.fmv||dn.amt||0);},0);
    var dTot=dCash+dInkind;
    var hasPending=(d.donations||[]).some(function(dn){return dn.ty==='No';});
    var dFyTot=(d.donations||[]).reduce(function(s,dn){
      if(dn.inkind==='Yes')return s;
      if(!dn.date)return s;var dt=new Date(dn.date);
      if(dt>=fy.start&&dt<=fy.end)return s+Number(dn.amt||0);return s;
    },0);
    var schedBBadge=dFyTot>=SCHED_B_THRESHOLD?'<span class="badge" style="background:#fff8e1;color:#f57f17;border:1px solid #f9a825;margin-left:6px;font-size:9px">⚠ Sch. B</span>':'';

    // ── Giving pattern flags ──
    var now2=new Date();
    var sortedDons=(d.donations||[]).filter(function(dn){return dn.date&&dn.inkind!=='Yes';}).sort(function(a,b){return new Date(b.date)-new Date(a.date);});
    var lastGiftDate=sortedDons.length?new Date(sortedDons[0].date):null;
    var daysSinceGift=lastGiftDate?Math.floor((now2-lastGiftDate)/(1000*60*60*24)):null;
    var lapsedFlag=daysSinceGift!==null&&daysSinceGift>365?'<span class="badge b-amber" style="font-size:9px">⚠ Lapsed '+Math.floor(daysSinceGift/365)+'yr</span>':'';
    // Consecutive years giving
    var giftYears=[...new Set((d.donations||[]).filter(function(dn){return dn.date&&dn.inkind!=='Yes';}).map(function(dn){return new Date(dn.date).getFullYear();}))].sort();
    var consecutive=0;if(giftYears.length){var yr=new Date().getFullYear();for(var _y=yr;_y>=yr-10;_y--){if(giftYears.indexOf(_y)>=0)consecutive++;else break;}}
    var consecFlag=consecutive>=3?'<span class="badge b-green" style="font-size:9px">'+consecutive+' yrs consecutive</span>':'';
    // Upgrade opportunity — same amount 3+ years in a row
    var recentAmts=sortedDons.slice(0,3).map(function(dn){return Number(dn.amt||0);});
    var upgradeFlag=recentAmts.length===3&&recentAmts[0]===recentAmts[1]&&recentAmts[1]===recentAmts[2]?'<span class="badge b-blue" style="font-size:9px">↑ Upgrade opportunity</span>':'';
    // Workplace giving badge
    var wpBadge=d.constituentType==='workplace'?'<span class="badge" style="background:#e8f5e9;color:#2e7d32;font-size:9px">🏢 Payroll</span>':'';
    // Tier badge
    var tierColors={major:'b-green',midlevel:'b-blue',annual:'b-amber',prospect:'',lapsed:'b-amber'};
    var tierBadge=d.tier?'<span class="badge '+(tierColors[d.tier]||'')+'" style="font-size:9px">'+d.tier+'</span>':'';
    // Stage badge
    var stageBadge=d.stage?'<span class="badge" style="background:var(--soft);color:var(--muted);font-size:9px">'+d.stage+'</span>':'';

    // ── Interaction log ──
    var pendingFollowups=(d.activities||[]).filter(function(x){return x.followupDate&&!x.completed;}).concat((d.interactions||[]).filter(function(x){return x.followupDate&&!x.completed;}));

    return'<div class="donor-card">'
      +'<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:.75rem">'
      +'<div><div style="font-size:14px;font-weight:500">'+escHtml(d.name)+schedBBadge+'</div>'
      +'<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">'+tierBadge+stageBadge+wpBadge+lapsedFlag+consecFlag+upgradeFlag+'</div>'
      +(d.email?'<div style="font-size:12px;color:var(--muted);margin-top:4px">'+d.email+'</div>':'')
      +(d.phone?'<div style="font-size:12px;color:var(--muted)">'+d.phone+'</div>':'')
      +(d.address?'<div style="font-size:12px;color:var(--muted)">'+d.address+'</div>':'')
      +(d.solicitor?'<div style="font-size:11px;color:var(--muted);margin-top:3px">Solicitor: <span style="color:var(--text)">'+escHtml(d.solicitor)+'</span></div>':'')
      +(d.constituentType==='workplace'&&d.platform?'<div style="font-size:11px;color:var(--muted)">Platform: <span style="color:var(--text)">'+escHtml(d.platform)+'</span>'+(d.employer?' · '+escHtml(d.employer):'')+'</div>':'')
      +'</div>'
      +'<div style="text-align:right"><div style="font-size:20px;font-weight:300;color:var(--green)">'+fmt(dCash)+'</div>'
      +'<div style="font-size:10px;color:var(--muted)">cash donated</div>'
      +(dInkind>0?'<div style="font-size:12px;color:var(--muted);margin-top:2px">'+fmt(dInkind)+' in-kind</div>':'')
      +(d.askAmt>0?'<div style="font-size:11px;color:var(--blue);margin-top:4px">Ask: '+fmt(d.askAmt)+(d.askDate?' by '+fmtDate(d.askDate):'')+'</div>':'')
      +(hasPending?'<span class="badge b-amber" style="margin-top:4px;display:inline-block">TY letter pending</span>':'')
      +(pendingFollowups.length?'<span class="badge b-blue" style="margin-top:4px;display:inline-block">📅 '+pendingFollowups.length+' follow-up'+(pendingFollowups.length>1?'s':'')+'</span>':'')
      +'</div></div>'
      +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:.75rem">'
      +'<button class="add-btn" onclick="openAddDonation('+di+')">+ Log donation</button>'
      +'<button class="add-btn" style="background:var(--blue-bg);color:var(--blue);border-color:var(--blue)" onclick="openActivityModal('+di+')">📋 Log activity</button>'
      +'<button class="e-btn" style="border:1px solid var(--border);border-radius:7px;padding:5px 10px;font-size:12px" onclick="openAnnualLetter('+di+')" title="Generate year-end consolidated acknowledgment letter">📄 Year-end letter</button>'
      +(d.constituentType==='workplace'?'<button class="e-btn" style="border:1px solid var(--border);border-radius:7px;padding:5px 10px;font-size:12px" onclick="openWorkplaceGivingLetter('+di+')" title="Generate stewardship letter for workplace giving donor">🏢 Stewardship letter</button>':'')
      +'<button class="e-btn" style="border:1px solid var(--border);border-radius:7px;padding:5px 10px;font-size:12px;color:var(--text)" title="Edit donor" onclick="editDonor('+di+')">&#9998; Edit</button>'
      +'<button class="e-btn" style="border:1px solid var(--border);border-radius:7px;padding:5px 10px;font-size:12px;color:var(--muted)" title="View change history" onclick="openDonorAuditLog(\''+di+'\')">&#128203; History</button>'
      +'<button style="border:none;border-radius:7px;padding:5px 12px;font-size:12px;background:var(--red,#c0392b);color:#fff;cursor:pointer;font-family:\'DM Sans\',sans-serif;font-weight:500" title="Remove donor" onclick="delDonor('+di+')">&#215; Remove</button></div>'
      +((d.donations||[]).length
        ?'<table><thead><tr><th style="width:12%">Amount</th><th style="width:13%">Date</th><th style="width:14%">Campaign</th><th style="width:12%">Project</th><th style="width:8%">Recurring</th><th style="width:10%">Restricted</th><th style="width:10%">TY Sent</th><th style="width:21%"></th></tr></thead><tbody>'
        +(function(){var _rows=[];(d.donations||[]).forEach(function(dn,dni){if(RST_F!=='all'&&normalizeRst(dn.rst)!==RST_F)return;_rows.push('<tr><td class="vg" style="font-weight:500">'+fmt(dn.amt)+(dn.inkind==='Yes'?' <span class="badge" style="background:#e8f5e9;color:#2e7d32;font-size:9px">In-kind</span>':'')+(dn.qpq>0?' <span class="badge" style="background:#e3f2fd;color:#1565c0;font-size:9px">QPQ</span><span style="font-size:10px;color:var(--muted);margin-left:3px">'+fmt(Math.max(0,Number(dn.amt||0)-dn.qpq))+' deductible</span>':'')+'</td><td style="color:var(--muted)">'+(dn.date||'—')+'</td><td>'+(dn.fund||'—')+'</td><td style="font-size:11px;color:var(--muted)">'+(dn.proj?(function(){var _pr=(c&&c.projects||[]).find(function(p){return p.id===dn.proj||p.name===dn.proj;});return escHtml(_pr?_pr.name:dn.proj);})():'—')+'</td><td>'+(dn.rec==='Yes'?'<span class="badge b-rec">↻ Yes</span>':'—')+'</td><td>'+rstBadge(dn.rst)+'</td><td>'+(dn.ty==='Yes'?'<span class="badge b-green">✓ Sent</span>':'<span class="badge b-amber">Pending</span>')+'</td><td><div class="row-acts"><button class="e-btn" onclick="editDonation('+di+','+dni+')" title="Edit donation">&#9998;</button><button class="e-btn" onclick="openAuditLog('+di+','+dni+')" title="Edit history">&#128221;</button><button class="e-btn" onclick="openTYLetter('+di+','+dni+')" title="Generate thank you letter">💌</button><button class="e-btn" onclick="toggleTY('+di+','+dni+')" title="Toggle TY sent">✓</button><button class="d-btn" title="Delete donation" onclick="delDonation('+di+','+dni+')">&#215;</button></div></td></tr>');});return _rows.join('');})()+(!((d.donations||[]).some(function(dn){return RST_F==='all'||normalizeRst(dn.rst)===RST_F;}))?'<tr><td colspan="7" style="text-align:center;padding:1rem;color:var(--muted);font-size:12px">No donations match this filter.</td></tr>':'')+'</tbody></table>'
        :'<div style="font-size:12px;color:var(--muted);padding:.5rem 0">No donations logged yet.</div>')
      +(d.notes?'<div style="font-size:12px;color:var(--muted);margin-top:.75rem;padding:.75rem;background:var(--bg);border-radius:8px;line-height:1.5"><strong style="color:var(--text)">Notes: </strong>'+escHtml(d.notes)+'</div>':'')
      +_renderActivityLog(d,di)
      +'</div>';
  }).join('');

  var rstOpts=[['all','All restrictions'],['unrestricted','Unrestricted'],['temporarily_restricted','Temp. restricted'],['permanently_restricted','Perm. restricted']];
  var rstFilter='<div class="cat-filter"><span style="font-size:12px;color:var(--muted)">Restriction:</span><div class="sw"><select onchange="RST_F=this.value;renderDonors()">'+rstOpts.map(function(o){return'<option value="'+o[0]+'"'+(RST_F===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></div></div>';
  var donorFilter=donors.length<2?'':'<div class="cat-filter"><span style="font-size:12px;color:var(--muted)">Donor:</span><div class="sw"><select onchange=\"DONOR_F=this.value===\"all\"?\"all\":this.value;renderDonors()\"><option value="all"'+(DONOR_F==='all'?' selected':'')+'>All donors</option>'+donors.map(function(d){return'<option value="'+d.id+'"'+(DONOR_F===d.id?' selected':'')+'>'+escHtml(d.name)+'</option>';}).join('')+'</select></div></div>';
  p.innerHTML=FB()+XB('donors')+'<div class="xbar" style="margin-top:-8px;margin-bottom:4px"><button class="xbtn p" onclick="exportSchedB()" title="Export Schedule B donor data as CSV for 990 prep">📋 Export Schedule B</button>'+(totalInkindFMV>0?'<button class="xbtn p" onclick="exportSchedM()" title="Export Schedule M non-cash contribution detail for 990 prep">📋 Export Schedule M</button>':'')+'</div>'+donorFilter+rstFilter+schedBAlert+schedMAlert
  +'<div class="metrics"><div class="metric"><div class="m-lbl">Total donors</div><div class="m-val vb">'+donors.length+'</div></div><div class="metric"><div class="m-lbl">Total donated</div><div class="m-val vg">'+fmt(totAmt)+'</div></div><div class="metric"><div class="m-lbl">TY letters pending</div><div class="m-val va">'+pending+'</div></div></div>'
  +'<div style="margin-bottom:1.25rem"><button class="add-btn" onclick="DONOR_EI=-1;resetDonorForm();openM(\'m-donor\')">+ Add donor</button></div>'
  +(donors.length?cards:ES('No donors yet','Add your first donor to track giving history and generate thank you letters.','DONOR_EI=-1;resetDonorForm();openM(\'m-donor\')'));
}
function _clearDonorDates(){['firstcontact','askmade','response','donated','thankyou','impact','reengaged'].forEach(function(f){var el=g('don-dt-'+f);if(el)el.value='';});var cl=g('don-dt-custom-label');if(cl)cl.value='';var cd=g('don-dt-custom-date');if(cd)cd.value='';}

var _DEFAULT_DONOR_TIERS=[
  {value:'major',label:'Major donor ($10k+)'},
  {value:'midlevel',label:'Mid-level ($1k–$9,999)'},
  {value:'annual',label:'Annual fund (under $1k)'},
  {value:'prospect',label:'Prospect'},
  {value:'lapsed',label:'Lapsed'}
];
var _DEFAULT_DONOR_STAGES=[
  {value:'identified',label:'Identified'},
  {value:'qualified',label:'Qualified'},
  {value:'cultivated',label:'Cultivating'},
  {value:'solicited',label:'Solicited'},
  {value:'closed',label:'Closed / Won'},
  {value:'stewardship',label:'Stewardship'}
];

function populateDonorDropdowns(currentTier,currentStage){
  var c=gc();if(!c)return;
  if(!c.donorOptions)c.donorOptions={};
  var tierSel=g('don-tier');
  if(tierSel){
    var tiers=_DEFAULT_DONOR_TIERS.concat((c.donorOptions.donorTiers||[]).map(function(v){return{value:v,label:v};}));
    tierSel.innerHTML='<option value="">— Select —</option>'
      +tiers.map(function(t){return'<option value="'+escHtml(t.value)+'"'+(currentTier===t.value?' selected':'')+'>'+escHtml(t.label)+'</option>';}).join('');
  }
  var stageSel=g('don-stage');
  if(stageSel){
    var stages=_DEFAULT_DONOR_STAGES.concat((c.donorOptions.donorStages||[]).map(function(v){return{value:v,label:v};}));
    stageSel.innerHTML='<option value="">— Select —</option>'
      +stages.map(function(s){return'<option value="'+escHtml(s.value)+'"'+(currentStage===s.value?' selected':'')+'>'+escHtml(s.label)+'</option>';}).join('');
  }
}

function addDonorCustomOption(selectId,optionKey){
  var val=prompt('Enter new option name:');
  if(!val||!val.trim())return;
  val=val.trim();
  var c=gc();if(!c)return;
  if(!c.donorOptions)c.donorOptions={};
  if(!c.donorOptions[optionKey])c.donorOptions[optionKey]=[];
  if(c.donorOptions[optionKey].indexOf(val)<0)c.donorOptions[optionKey].push(val);
  sv();
  var tierSel=g('don-tier'),stageSel=g('don-stage');
  var curTier=tierSel?tierSel.value:'';
  var curStage=stageSel?stageSel.value:'';
  populateDonorDropdowns(curTier,curStage);
  var target=g(selectId);if(target)target.value=val;
}

function resetDonorForm(){
  g('m-donor-title').textContent='Add donor';
  ['don-n','don-e','don-p','don-a','don-notes','don-solicitor','don-ask','don-askdate','don-platform','don-employer'].forEach(function(id){var el=g(id);if(el)el.value='';});
  var wr=g('don-workplace-row');if(wr)wr.style.display='none';
  _clearDonorDates();
  populateDonorDropdowns('','');
}
function toggleDonorWorkplace(){var t=g('don-type');var wr=g('don-workplace-row');if(wr)wr.style.display=(t&&t.value==='workplace')?'block':'none';}
function toggleInkindFMV(){
  var isInkind=g('dnt-inkind')&&g('dnt-inkind').value==='Yes';
  var fmvRow=g('dnt-fmv-row');var note=g('dnt-inkind-note');
  if(fmvRow)fmvRow.style.display=isInkind?'block':'none';
  if(note)note.style.display=isInkind?'block':'none';
  if(!isInkind){// reset auction sub-fields when hiding
    if(g('dnt-auctioned'))g('dnt-auctioned').value='No';
    if(g('dnt-auction-fields'))g('dnt-auction-fields').style.display='none';
  }
  // in-kind and qpq are mutually exclusive
  if(isInkind&&g('dnt-hasqpq')){g('dnt-hasqpq').value='No';toggleQpq();}
  updateAuctionCalc();
}
function toggleAuction(){
  var on=g('dnt-auctioned')&&g('dnt-auctioned').value==='Yes';
  var af=g('dnt-auction-fields');if(af)af.style.display=on?'block':'none';
  updateAuctionCalc();
}
function updateAuctionCalc(){
  var fmv=Number(g('dnt-fmv')&&g('dnt-fmv').value||0);
  var warn=g('dnt-8283-warn');if(warn)warn.style.display=fmv>=500?'block':'none';
  var calc=g('dnt-auction-calc');if(!calc)return;
  var auctioned=g('dnt-auctioned')&&g('dnt-auctioned').value==='Yes';
  if(!auctioned){calc.style.display='none';return;}
  var sale=Number(g('dnt-auction-sale')&&g('dnt-auction-sale').value||0);
  if(!fmv||!sale){calc.style.display='none';return;}
  var buyerDed=Math.max(0,sale-fmv);
  var orgGain=sale-fmv;
  calc.style.display='block';
  calc.innerHTML='<strong>Donor\'s gift:</strong> '+fmt(fmv)+' (their FMV — org does not assert this)'
    +'<br><strong>Buyer paid:</strong> '+fmt(sale)
    +'<br><strong>Buyer\'s deductible portion:</strong> '+(buyerDed>0?'<span style="color:var(--green)">'+fmt(buyerDed)+'</span> (paid − FMV)':'<span style="color:var(--muted)">$0 — sale ≤ FMV, no deduction</span>')
    +'<br><strong>Org gain on sale:</strong> '+(orgGain>0?'<span style="color:var(--green)">'+fmt(orgGain)+'</span> (event revenue)':orgGain<0?'<span style="color:var(--red)">'+fmt(orgGain)+'</span> (loss)':'<span style="color:var(--muted)">$0 break-even</span>');
}
function toggleQpq(){
  var hasQpq=g('dnt-hasqpq')&&g('dnt-hasqpq').value==='Yes';
  var qpqRow=g('dnt-qpq-row');var qpqNote=g('dnt-qpq-note');
  if(qpqRow)qpqRow.style.display=hasQpq?'flex':'none';
  if(qpqNote)qpqNote.style.display=hasQpq?'block':'none';
  if(hasQpq&&g('dnt-inkind')){g('dnt-inkind').value='No';toggleInkindFMV();}
  updateQpqDeductible();
}
function updateQpqDeductible(){
  var amt=Number(g('dnt-amt')&&g('dnt-amt').value||0);
  var qpq=Number(g('dnt-qpq')&&g('dnt-qpq').value||0);
  var el=g('dnt-deductible');
  if(!el)return;
  if(!g('dnt-hasqpq')||g('dnt-hasqpq').value!=='Yes'){el.textContent='—';return;}
  var ded=Math.max(0,amt-qpq);
  el.textContent=fmt(ded);
  el.style.color=ded>0?'var(--green)':'var(--muted)';
}
function _populateDonationProjDropdown(c, selectedProj) {
  var sel = g('dnt-proj'); if (!sel) return;
  var projects = (c && c.projects) || [];
  sel.innerHTML = '<option value="">— None —</option>'
    + projects.map(function(p){ return '<option value="'+escHtml(p.id||p.name)+'"'+(( selectedProj===p.id||selectedProj===p.name)?' selected':'')+'>'+escHtml(p.name)+'</option>'; }).join('');
}

function openAddDonation(di){var c=gc();g('dnt-donor-id').value=di;['dnt-amt','dnt-date','dnt-fund','dnt-fmv','dnt-qpq','dnt-item-desc','dnt-auction-date','dnt-auction-sale','dnt-auction-buyer'].forEach(function(id){var el=g(id);if(el)el.value='';});g('dnt-rec').value='No';g('dnt-ty').value='No';g('dnt-rst').value='unrestricted';if(g('dnt-inkind'))g('dnt-inkind').value='No';if(g('dnt-hasqpq'))g('dnt-hasqpq').value='No';if(g('dnt-auctioned'))g('dnt-auctioned').value='No';_populateDonationProjDropdown(c,'');toggleInkindFMV();toggleQpq();DONATION_EI=-1;g('m-donation-title').textContent='Log donation';openM('m-donation');}
// editDonation: pre-fills the existing m-donation modal with the selected donation's
// values, sets DONATION_EI so saveDonation() updates in place instead of pushing.
// Follows the exact same pattern as editDonor().
function editDonation(di,dni){
  var c=gc();if(!c||!c.donors[di]||!c.donors[di].donations[dni])return;
  var dn=c.donors[di].donations[dni];
  g('dnt-donor-id').value=di;
  DONATION_EI=dni;
  g('dnt-amt').value=dn.amt||'';
  g('dnt-date').value=dn.date||'';
  g('dnt-fund').value=dn.fund||'';_populateDonationProjDropdown(gc(),dn.proj||'');
  g('dnt-rec').value=dn.rec||'No';
  g('dnt-rst').value=normalizeRst(dn.rst);
  g('dnt-ty').value=dn.ty||'No';
  if(g('dnt-inkind'))g('dnt-inkind').value=dn.inkind||'No';
  if(g('dnt-fmv'))g('dnt-fmv').value=dn.fmv||'';
  if(g('dnt-item-desc'))g('dnt-item-desc').value=dn.itemDescription||'';
  if(g('dnt-auctioned'))g('dnt-auctioned').value=dn.auctioned?'Yes':'No';
  if(g('dnt-auction-date'))g('dnt-auction-date').value=dn.auctionDate||'';
  if(g('dnt-auction-sale'))g('dnt-auction-sale').value=dn.auctionSalePrice||'';
  if(g('dnt-auction-buyer'))g('dnt-auction-buyer').value=dn.auctionBuyerName||'';
  if(g('dnt-hasqpq'))g('dnt-hasqpq').value=dn.qpq>0?'Yes':'No';
  if(g('dnt-qpq'))g('dnt-qpq').value=dn.qpq||'';
  toggleInkindFMV();toggleAuction();toggleQpq();
  g('m-donation-title').textContent='Edit donation';
  openM('m-donation');
}
function openAuditLog(di,dni){
  var c=gc();if(!c||!c.donors[di]||!c.donors[di].donations[dni])return;
  var dn=c.donors[di].donations[dni];
  var log=dn.audit||[];
  var labels={amt:'Amount',rst:'Restriction',fund:'Fund/Campaign',date:'Date',ty:'TY Sent'};
  var rows=log.length
    ?log.map(function(e){
        return'<tr><td style="white-space:nowrap;font-size:10px;color:var(--muted)">'
          +(e.timestamp?e.timestamp.replace('T',' ').slice(0,19):'—')+'</td>'
          +'<td>'+(labels[e.field]||e.field)+'</td>'
          +'<td style="color:var(--muted)">'+(e.oldValue||'—')+'</td>'
          +'<td>'+(e.newValue||'—')+'</td></tr>';
      }).join('')
    :'<tr><td colspan="4" style="text-align:center;padding:1.5rem;color:var(--muted);font-size:12px">No edit history yet.</td></tr>';
  g('audit-log-body').innerHTML=rows;
  openM('m-audit');
}
function openTYLetter(di,dni){
  var c=gc();if(!c||!c.donors[di])return;
  var d=c.donors[di],dn=d.donations[dni];
  var _ded=Math.max(0,Number(dn.amt||0)-(dn.qpq||0));
  var _qpqLine=dn.inkind==='Yes'
    ?'\n\nThis gift was received as an in-kind donation'+(dn.itemDescription?' described as: '+dn.itemDescription:'')+'. In-kind gifts are non-cash contributions of goods or services. No goods or services were provided to you in exchange for this contribution.'
    :dn.qpq>0
      ?'\n\nIn connection with this gift, you received goods or services with a fair market value of '+fmt(dn.qpq)+'. In accordance with IRS regulations, the tax-deductible portion of your contribution is '+fmt(_ded)+'.'
      :'\n\nNo goods or services were provided in exchange for this contribution. The full amount of your gift is tax-deductible to the extent allowed by law.';
  // Auction buyer letter (separate from donor acknowledgment)
  var _auctionBuyerLetter='';
  if(dn.inkind==='Yes'&&dn.auctioned&&dn.auctionBuyerName&&dn.auctionSalePrice){
    var _buyerDed=Math.max(0,Number(dn.auctionSalePrice||0)-Number(dn.fmv||0));
    _auctionBuyerLetter='\n\n---\nAUCTION BUYER ACKNOWLEDGMENT\nDear '+dn.auctionBuyerName+',\n\nThank you for your winning bid of '+fmt(dn.auctionSalePrice)+(dn.auctionDate?' on '+dn.auctionDate:'')+' at our auction.\n\nThe fair market value of the item you received was '+fmt(dn.fmv||0)+'.'
      +(_buyerDed>0?'\n\nIn accordance with IRS regulations, the tax-deductible portion of your payment is '+fmt(_buyerDed)+' (the amount paid above the fair market value of goods received).':'\n\nBecause the fair market value of the item equals or exceeds your payment, no portion of your bid is tax-deductible.')
      +'\n\nNo goods or services were provided to you beyond the auction item itself.\n\nWith gratitude,\n\n[Your name]\n'+c.name;
  }
  var letter='Dear '+d.name+',\n\nOn behalf of '+c.name+', I want to express our heartfelt gratitude for your generous gift of '+fmt(dn.amt)+(dn.date?' on '+dn.date:'')+'.'+_qpqLine+'\n\n'+(dn.fund?'Your contribution to our '+dn.fund+' makes a real difference in the work we do every day.\n\n':'Your support makes a real difference in the work we do every day.\n\n')+'Because of donors like you, we are able to continue our mission and serve our community. Your generosity does not go unnoticed.\n\nWith sincere gratitude,\n\n[Your name]\n'+c.name+(c.ein?'\nEIN: '+c.ein:'')+(Number(dn.amt||0)>=250&&!c.ein?'\n\n⚠ Note: IRS Publication 1771 requires your organization\'s EIN on written acknowledgments for gifts of $250 or more. Add your EIN under Settings → Edit name & settings.':'')+_auctionBuyerLetter;
  g('ty-letter-body').value=letter;openM('m-ty-letter');
}
function copyTYLetter(){
  var txt=g('ty-letter-body').value;
  if(navigator.clipboard){navigator.clipboard.writeText(txt).then(function(){g('ty-copy-ok').style.display='block';setTimeout(function(){g('ty-copy-ok').style.display='none';},2000);});}
  else{g('ty-letter-body').select();document.execCommand('copy');g('ty-copy-ok').style.display='block';setTimeout(function(){g('ty-copy-ok').style.display='none';},2000);}
}
function printTYLetter(){
  var txt=g('ty-letter-body').value.replace(/\n/g,'<br>');
  var w=window.open('','_blank');
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Thank You Letter</title><style>body{font-family:Georgia,serif;max-width:640px;margin:60px auto;color:#1a1814;font-size:14px;line-height:1.8}@media print{.no-print{display:none}}</style></head><body>');
  w.document.write('<div>'+txt+'</div>');
  w.document.write('<br><div class="no-print" style="display:flex;gap:8px;margin-top:20px"><button onclick="window.print()" style="padding:8px 20px;background:#1a1814;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">Print / Save as PDF</button><button onclick="window.close()" style="padding:8px 20px;background:#fff;color:#1a1814;border:1px solid #e8e6e0;border-radius:6px;cursor:pointer;font-size:13px">← Close</button></div>');
  w.document.write('</body></html>');w.document.close();
}
function openAnnualLetter(di){
  var c=gc();if(!c||!c.donors[di])return;
  var d=c.donors[di];
  var fy=getFiscalYear(c.fiscalYearEnd);
  // Filter to current FY cash donations only
  var fyDons=(d.donations||[]).filter(function(dn){
    if(dn.inkind==='Yes')return false;// in-kind listed separately
    if(!dn.date)return false;
    var dt=parseDate(dn.date);
    return dt&&dt>=fy.start&&dt<=fy.end;
  });
  var fyInkind=(d.donations||[]).filter(function(dn){
    if(dn.inkind!=='Yes')return false;
    if(!dn.date)return false;
    var dt=parseDate(dn.date);
    return dt&&dt>=fy.start&&dt<=fy.end;
  });
  if(!fyDons.length&&!fyInkind.length){alert('No donations found for '+d.name+' in the current fiscal year ('+fy.label+').');return;}
  var cashTotal=fyDons.reduce(function(s,dn){return s+Number(dn.amt||0);},0);
  var giftTable=fyDons.map(function(dn){
    var ded=dn.qpq>0?'Deductible portion: '+fmt(Math.max(0,Number(dn.amt||0)-dn.qpq)):'Fully deductible';
    return'  '+fmtDate(dn.date)+'  '+fmt(dn.amt)+(dn.fund?'  ['+dn.fund+']':'')+'  '+ded;
  }).join('\n');
  var inkindSection=fyInkind.length?'\n\nIn-kind contributions ('+fyInkind.length+' gift'+(fyInkind.length>1?'s':'')+')\nNote: In-kind gift values are determined by the donor. This letter serves as written acknowledgment of receipt.\n'+fyInkind.map(function(dn){return'  '+fmtDate(dn.date)+'  '+escHtml(dn.itemDescription||'Non-cash gift')+(dn.fmv?'  (Donor-reported FMV: '+fmt(dn.fmv)+')':'');}).join('\n'):'';
  var noGoodsLine=fyDons.every(function(dn){return!dn.qpq||dn.qpq===0;})
    ?'\n\nNo goods or services were provided in exchange for any of the cash contributions listed above. The full deductible amount of each gift is as noted.'
    :'\n\nFor gifts marked with a deductible portion, goods or services were provided in exchange as noted. Please consult your tax advisor regarding deductibility.';
  var letter='YEAR-END GIVING SUMMARY\n'+c.name+(c.ein?'\nEIN: '+c.ein:'')+'\n\nDear '+d.name+',\n\nThank you for your generous support of '+c.name+' during '+fy.label+'. This letter serves as your official charitable contribution acknowledgment for income tax purposes.\n\nCASH CONTRIBUTIONS — '+fy.label+'\n'+giftTable+'\n\nTotal cash contributions: '+fmt(cashTotal)+inkindSection+noGoodsLine+'\n\nPlease retain this letter for your tax records. If you have any questions, contact us at your convenience.\n\nWith sincere gratitude,\n\n[Your name]\n'+c.name+(c.ein?'\nEIN: '+c.ein:'')+(cashTotal>=250?'\n\n(This written acknowledgment is required for charitable deductions of $250 or more per IRS Publication 1771.)':'');
  var el=g('ty-letter-text');if(el)el.value=letter;
  var title=g('ty-letter-title');if(title)title.textContent=fy.label+' Year-End Summary — '+d.name;
  openM('m-ty-letter');
}
function toggleTY(di,dni){var c=gc();if(!c||!c.donors[di]||!c.donors[di].donations[dni])return;var dn=c.donors[di].donations[dni];dn.ty=dn.ty==='Yes'?'No':'Yes';sv();renderDonors(c);}
function delDonation(di,dni){var c=gc();if(!confirm('Delete this donation?'))return;c.donors[di].donations.splice(dni,1);sv();renderDonors(c);}
function delDonor(di){var c=gc();if(!confirm('Remove this donor and all their donation history? Cannot be undone.'))return;c.donors.splice(di,1);sv();renderDonors(c);}
function editDonor(di){
  var c=gc();if(!c||!c.donors[di])return;DONOR_EI=di;var d=c.donors[di];
  g('m-donor-title').textContent='Edit donor';
  g('don-n').value=d.name||'';g('don-e').value=d.email||'';g('don-p').value=d.phone||'';g('don-a').value=d.address||'';g('don-notes').value=d.notes||'';
  var dtype=g('don-type');if(dtype)dtype.value=d.constituentType||'';
  var dsol=g('don-solicitor');if(dsol)dsol.value=d.solicitor||'';
  var dask=g('don-ask');if(dask)dask.value=d.askAmt||'';
  var daskdate=g('don-askdate');if(daskdate)daskdate.value=d.askDate||'';
  var dplat=g('don-platform');if(dplat)dplat.value=d.platform||'';
  var demp=g('don-employer');if(demp)demp.value=d.employer||'';
  var wr=g('don-workplace-row');if(wr)wr.style.display=(d.constituentType==='workplace')?'block':'none';
  _clearDonorDates();
  var _kdm={firstcontact:'First contact',askmade:'Ask made',response:'Response received',donated:'Donation received',thankyou:'Thank you sent',impact:'Impact report sent',reengaged:'Lapsed — re-engaged'};
  (d.milestones||[]).forEach(function(m){var fkey=Object.keys(_kdm).find(function(k){return _kdm[k]===m.type;});if(fkey){var el=g('don-dt-'+fkey);if(el)el.value=m.date||'';} else{var cl=g('don-dt-custom-label');var cd=g('don-dt-custom-date');if(cl&&!cl.value){cl.value=m.type;if(cd)cd.value=m.date||'';}}});
  populateDonorDropdowns(d.tier||'',d.stage||'');
  openM('m-donor');
}
function saveDonor(){
  var c=gc();if(!c.donors)c.donors=[];
  var n=g('don-n').value.trim();if(!n){alert('Please enter a name.');return;}
  var _oldDonor=DONOR_EI>=0?c.donors[DONOR_EI]:null;
  // Collect key dates from modal
  var _keyDateFields=['firstcontact','askmade','response','donated','thankyou','impact','reengaged'];
  var keyDates={};
  _keyDateFields.forEach(function(f){var el=g('don-dt-'+f);if(el&&el.value.trim())keyDates[f]=el.value.trim();});
  var customLabel=g('don-dt-custom-label')&&g('don-dt-custom-label').value.trim();
  var customDate=g('don-dt-custom-date')&&g('don-dt-custom-date').value.trim();
  if(customLabel&&customDate)keyDates['_custom_'+customLabel]=customDate;

  var item={
    id:DONOR_EI>=0?(c.donors[DONOR_EI].id||uid()):uid(),
    name:sanitizeInput(n),
    email:g('don-e').value.trim(),
    phone:g('don-p').value.trim(),
    address:g('don-a').value.trim(),
    notes:sanitizeInput(g('don-notes').value),
    constituentType:g('don-type')&&g('don-type').value||'',
    tier:g('don-tier')&&g('don-tier').value||'',
    stage:g('don-stage')&&g('don-stage').value||'',
    solicitor:g('don-solicitor')&&g('don-solicitor').value.trim()||'',
    askAmt:Number(g('don-ask')&&g('don-ask').value||0),
    askDate:g('don-askdate')&&g('don-askdate').value||'',
    platform:g('don-platform')&&g('don-platform').value.trim()||'',
    employer:g('don-employer')&&g('don-employer').value.trim()||'',
    keyDates:keyDates,
    donations:DONOR_EI>=0?(c.donors[DONOR_EI].donations||[]):[],
    interactions:DONOR_EI>=0?(c.donors[DONOR_EI].interactions||[]):[],
    milestones:DONOR_EI>=0?(c.donors[DONOR_EI].milestones||[]):[]
  };

  // Auto-create milestones from filled key dates (new entries only, avoid duplicates)
  var _keyDateMap={firstcontact:'First contact',askmade:'Ask made',response:'Response received',donated:'Donation received',thankyou:'Thank you sent',impact:'Impact report sent',reengaged:'Lapsed — re-engaged'};
  var existingTypes=(item.milestones||[]).map(function(m){return m.type;});
  Object.keys(keyDates).forEach(function(f){
    var label=f.indexOf('_custom_')===0?f.replace('_custom_',''):(_keyDateMap[f]||f);
    if(existingTypes.indexOf(label)<0){
      item.milestones.push({id:uid(),type:label,date:keyDates[f],notes:'',created:new Date().toISOString()});
    } else {
      // Update existing milestone date if it changed
      var existing=item.milestones.find(function(m){return m.type===label;});
      if(existing)existing.date=keyDates[f];
    }
  });
  item.milestones.sort(function(a,b){return new Date(a.date)-new Date(b.date);});

  var _donorWatched=['name','email','phone','address','notes','constituentType','tier','stage','solicitor','askAmt','askDate'];
  if(_oldDonor){
    var _donorLog=(_oldDonor.audit||[]).slice();
    var _ts=new Date().toISOString();
    _donorWatched.forEach(function(f){
      var ov=String(_oldDonor[f]===undefined||_oldDonor[f]===null?'':_oldDonor[f]);
      var nv=String(item[f]===undefined||item[f]===null?'':item[f]);
      if(ov!==nv)_donorLog.push({field:f,oldValue:ov,newValue:nv,timestamp:_ts});
    });
    item.audit=_donorLog;
  }else{
    item.audit=[{field:'created',oldValue:'',newValue:'Donor record created',timestamp:new Date().toISOString()}];
  }
  if(DONOR_EI>=0)c.donors[DONOR_EI]=item;else c.donors.push(item);
  DONOR_EI=-1;sv();renderDonors(c);renderTodoBar();closeM('m-donor');
}
function openDonorAuditLog(di){
  var c=gc();if(!c||!c.donors[di])return;
  var d=c.donors[di];
  var log=(d.audit||[]);
  if(!log.length){alert('No change history for this donor record.');return;}
  var rows=log.slice().reverse().map(function(e){
    return'<tr>'
      +'<td style="font-size:11px;color:var(--muted)">'+escHtml((e.timestamp||'').replace('T',' ').slice(0,16))+'</td>'
      +'<td style="font-size:12px;font-weight:500">'+escHtml(e.field||'')+'</td>'
      +'<td style="font-size:12px;color:var(--muted);max-width:160px;word-break:break-word">'+escHtml(e.oldValue||'—')+'</td>'
      +'<td style="font-size:12px;max-width:160px;word-break:break-word">'+escHtml(e.newValue||'—')+'</td>'
      +'</tr>';
  }).join('');
  var w=window.open('','_blank','width=700,height=500');
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Change history — '+escHtml(d.name)+'</title>'
    +'<style>body{font-family:DM Sans,sans-serif;padding:20px;color:#1a1916}table{border-collapse:collapse;width:100%}th{text-align:left;padding:8px 10px;border-bottom:2px solid #e8e5df;font-size:12px;color:#8a8880}td{padding:7px 10px;border-bottom:1px solid #f0ede8;vertical-align:top}h2{margin:0 0 4px}p{color:#8a8880;font-size:13px;margin:0 0 16px}</style>'
    +'</head><body>'
    +'<h2>Change history</h2><p>'+escHtml(d.name)+'</p>'
    +'<table><thead><tr><th>Timestamp</th><th>Field</th><th>Previous value</th><th>New value</th></tr></thead>'
    +'<tbody>'+rows+'</tbody></table>'
    +'</body></html>');
  w.document.close();
}

function saveDonation(){
  var c=gc();if(!c.donors)c.donors=[];
  // PERIOD LOCK GUARD
  var _dntLockDate=g('dnt-date')&&g('dnt-date').value.trim();
  if(_dntLockDate&&isDateLocked(c,_dntLockDate)){periodLockAlert(c.closedThrough);return;}

  // Validation — applies to create and edit
  var amt=g('dnt-amt').value;
  var amtNum=Number(amt);
  if(!amt||isNaN(amtNum)||amtNum<=0){alert('Please enter a valid amount greater than 0.');return;}
  var dateVal=g('dnt-date').value.trim();
  if(!dateVal){alert('Please enter a donation date.');return;}
  var _dateErr=validateDate(dateVal);
  if(_dateErr){alert(_dateErr);return;}

  var di=parseInt(g('dnt-donor-id').value);if(isNaN(di)||!c.donors[di])return;
  if(!c.donors[di].donations)c.donors[di].donations=[];

  var record={amt:amt,date:dateVal,fund:g('dnt-fund').value,proj:g('dnt-proj')&&g('dnt-proj').value||'',rec:g('dnt-rec').value,ty:g('dnt-ty').value,rst:g('dnt-rst').value,inkind:g('dnt-inkind')&&g('dnt-inkind').value||'No',fmv:g('dnt-fmv')&&Number(g('dnt-fmv').value||0)||0,itemDescription:g('dnt-item-desc')&&g('dnt-item-desc').value.trim()||'',auctioned:g('dnt-auctioned')&&g('dnt-auctioned').value==='Yes',auctionDate:g('dnt-auction-date')&&g('dnt-auction-date').value||'',auctionSalePrice:g('dnt-auction-sale')&&Number(g('dnt-auction-sale').value||0)||0,auctionBuyerName:g('dnt-auction-buyer')&&g('dnt-auction-buyer').value.trim()||'',qpq:g('dnt-hasqpq')&&g('dnt-hasqpq').value==='Yes'?Number(g('dnt-qpq')&&g('dnt-qpq').value||0):0};
  if(record.inkind==='Yes'&&!record.fmv){alert('Please enter the fair market value for this in-kind donation.');return;}
  if(record.inkind==='Yes'&&!record.itemDescription){alert('Please describe the donated item or service.');return;}

  // Scenario B: Check for existing bank-imported income entry that matches this donation
  if(DONATION_EI<0){
    var _donorName=(c.donors[di]&&c.donors[di].name||'').toLowerCase();
    var _newAmt=Number(amtNum);
    var _newDate=dateVal;
    var _dupInc=(c.income||[]).find(function(r){
      if(!r.fromBank)return false;
      var amtMatch=Math.abs(Number(r.recv||r.amt||0)-_newAmt)<0.01;
      var dateDiff=r.date&&_newDate?Math.abs(new Date(r.date)-new Date(_newDate))/(1000*60*60*24):999;
      var nameMatch=!_donorName||(r.vendor1099||r.name||'').toLowerCase().indexOf(_donorName)>=0||_donorName.indexOf((r.vendor1099||'').toLowerCase())>=0;
      return amtMatch&&dateDiff<=5&&nameMatch;
    });
    if(_dupInc){
      // Show warning modal with link to the existing entry
      var _dupModal=document.createElement('div');
      _dupModal.id='don-dup-modal';
      _dupModal.style.cssText='position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center';
      _dupModal.innerHTML='<div style="background:var(--surface);border-radius:14px;padding:1.5rem;width:380px;box-shadow:0 8px 32px rgba(0,0,0,.2);font-family:\'DM Sans\',sans-serif">'
        +'<div style="font-size:15px;font-weight:600;margin-bottom:.5rem;color:var(--text)">⚠️ Possible duplicate donation</div>'
        +'<div style="font-size:13px;color:var(--muted);margin-bottom:.75rem">A bank import already recorded <strong style="color:var(--text)">$'+_newAmt.toFixed(2)+'</strong> on <strong style="color:var(--text)">'+(_dupInc.date||'unknown date')+'</strong>'
        +(_dupInc.vendor1099?' from <strong style="color:var(--text)">'+escHtml(_dupInc.vendor1099)+'</strong>':'')+'.</div>'
        +'<div style="font-size:12px;color:var(--muted);margin-bottom:1.25rem">This may already be recorded from your bank statement. If it\'s the same payment, saving this will create a duplicate \u2014 the reconciliation tab is the final check. If it\'s a separate donation, click Save anyway.</div>'
        +'<div style="display:flex;gap:.5rem;justify-content:flex-end;flex-wrap:wrap">'
        +'<button onclick="document.getElementById(\'don-dup-modal\').remove()" style="padding:7px 14px;border:1px solid var(--border);border-radius:8px;background:none;cursor:pointer;font-size:13px;font-family:\'DM Sans\',sans-serif;color:var(--text)">Cancel</button>'
        +'<button onclick="_donForceLog()" style="padding:7px 14px;border:none;border-radius:8px;background:var(--np);color:#fff;cursor:pointer;font-size:13px;font-weight:500;font-family:\'DM Sans\',sans-serif">Save anyway — separate donation</button>'
        +'</div></div>';
      window._donPendingRecord={c:c,di:di,record:record};
      document.body.appendChild(_dupModal);
      return;
    }
  }

  if(DONATION_EI>=0){
    // Edit in place — audit changed fields before overwriting
    var old=c.donors[di].donations[DONATION_EI];
    var auditLog=old.audit||[];
    var ts=new Date().toISOString();
    var watched=['amt','rst','fund','date','ty'];
    var oldVals={amt:old.amt,rst:old.rst,fund:old.fund,date:old.date,ty:old.ty};
    var newVals={amt:record.amt,rst:record.rst,fund:record.fund,date:record.date,ty:record.ty};
    watched.forEach(function(f){
      if(String(oldVals[f]||'')!==String(newVals[f]||'')){
        auditLog.push({field:f,oldValue:oldVals[f]||'',newValue:newVals[f]||'',timestamp:ts});
      }
    });
    record.audit=auditLog;
    c.donors[di].donations[DONATION_EI]=record;
    // Update orphaned inkindRef auto-entries when FMV/description/date/fund changed
    if(record.inkind==='Yes'){
      var _oldDesc=(old.itemDescription||'In-kind donation')+' — '+(c.donors[di].name||'Unknown donor');
      var _newDesc=(record.itemDescription||'In-kind donation')+' — '+(c.donors[di].name||'Unknown donor');
      var _newAmt=Number(record.fmv||0);
      (c.income||[]).forEach(function(r){if(r.inkindRef&&r.name===_oldDesc){r.name=_newDesc;r.proj=_newAmt;r.recv=_newAmt;r.date=record.date;r.fund=record.fund||'';}});
      (c.expenses||[]).forEach(function(e){if(e.inkindRef&&e.desc===_oldDesc){e.desc=_newDesc;e.amt=_newAmt;e.date=record.date;e.fund=record.fund||'';}});
    }
  }else{
    // Add new — no audit on create
    c.donors[di].donations.push(record);
  }

  // ── IN-KIND DOUBLE-ENTRY ─────────────────────────────────────
  // New in-kind donations (not edits) auto-create matching income + expense entries
  // so 990 Part VIII (contribution revenue) and Part IX (in-kind expense) gross up correctly.
  if(record.inkind==='Yes'&&DONATION_EI<0){
    var donorName=c.donors[di].name||'Unknown donor';
    var inkindDesc=(record.itemDescription||'In-kind donation')+' — '+donorName;
    var inkindAmt=Number(record.fmv||0);
    // Income entry: In-kind contributions (COA 4050, Part VIII Line 1)
    if(!c.income)c.income=[];
    c.income.push({id:uid(),name:inkindDesc,cat:'In-Kind',status:'Received',proj:inkindAmt,recv:inkindAmt,date:record.date,fund:record.fund||'',acctCode:'4050',inkindRef:true,audit:[]});
    // Expense entry: In-kind expense allocated to fundraising (Part IX)
    if(!c.expenses)c.expenses=[];
    c.expenses.push({id:uid(),desc:inkindDesc,cat:'In-Kind Expense',amt:inkindAmt,date:record.date,fund:record.fund||'',functional:'fundraising',acctCode:'5400',inkindRef:true,reconciled:true,audit:[]});
    // If auctioned: also log auction sale proceeds as event revenue
    if(record.auctioned&&record.auctionSalePrice>0){
      var saleDesc='Auction sale: '+(record.itemDescription||'In-kind item')+' (buyer: '+(record.auctionBuyerName||'unknown')+')';
      c.income.push({id:uid(),name:saleDesc,cat:'Events',status:'Received',proj:record.auctionSalePrice,recv:record.auctionSalePrice,date:record.auctionDate||record.date,fund:record.fund||'',acctCode:'4040',auctionRef:true,audit:[]});
    }
  }

  sv();renderDonors(c);closeM('m-donation');['dnt-amt','dnt-date','dnt-fund','dnt-fmv','dnt-qpq','dnt-item-desc','dnt-auction-date','dnt-auction-sale','dnt-auction-buyer'].forEach(function(id){var el=g(id);if(el)el.value='';});var _dp=g('dnt-proj');if(_dp)_dp.value='';if(g('dnt-inkind'))g('dnt-inkind').value='No';if(g('dnt-hasqpq'))g('dnt-hasqpq').value='No';if(g('dnt-auctioned'))g('dnt-auctioned').value='No';toggleInkindFMV();toggleQpq();
}

// ── SB REVENUE ──────────────────────────
function renderRev(c){
  var p=g('p-revenue');if(!p)return;if(!c)return;var rev=(c.revenue||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;});var filt=CF==='all'?rev:rev.filter(function(r){return r.cat===CF;});
  filt=srchItems(filt,SRCH['p-revenue']||'',['name','cat','conf','date','acctCode']);
  var tp=rev.reduce(function(s,r){return s+Number(r.proj||0);},0),ta=rev.reduce(function(s,r){return s+basisInc(c,r);},0),conf=rev.filter(function(r){return r.conf==='Confirmed';}).reduce(function(s,r){return s+Number(r.proj||0);},0);
  var totTax=rev.filter(function(r){return r.taxRate>0;}).reduce(function(s,r){return s+Number(r.taxAmt||0);},0);
  var rows=filt.map(function(r){var oi=rev.indexOf(r),pv=pct(r.act,r.proj);var acctR=(c.accounts||[]).find(function(a){return a.code===r.acctCode||a.cat===r.cat||a.name===r.cat;});var codeR=acctR?'<span style="font-family:monospace;font-size:10px;background:var(--soft);padding:1px 4px;border-radius:3px">'+acctR.code+'</span>':'—';var _srcCell=r.name?drillLink(r.name,'source',r.name,'incdetail'):('—');var _catCell=r.cat?drillLink(r.cat,'cat',r.cat,'incdetail'):('—');return'<tr><td style="font-weight:500">'+_srcCell+'</td><td>'+_catCell+'</td><td>'+codeR+'</td><td>'+fmt(r.proj)+'</td><td>'+fmt(r.act)+'</td><td>'+SB(r.conf)+(r.recurring&&r.recurring!=='None'?' <span class="badge b-rec">&#8635;</span>':'')+'</td><td><div style="font-size:10px;color:var(--muted)">'+pv+'%</div><div class="pbar"><div class="pfill" style="width:'+pv+'%"></div></div></td><td>'+rb('revenue',oi)+'</td></tr>';}).join('');
  var cs=catSum(rev,'act');
  var _sbCurBasis=(typeof RPT_BASIS!=='undefined'&&RPT_BASIS)?RPT_BASIS:(c.basisType||'cash');
  var _sbBasisBadge='<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:'+(_sbCurBasis==='accrual'?'#e3f2fd;color:#1565c0':'#e8f5e9;color:#2e7d32')+'">'+(  _sbCurBasis==='accrual'?'Accrual basis':'Cash basis')+'</span>';
  p.innerHTML=FB()+XB('revenue')+catF(rev,'renderRev(gc())')+srchBar('p-revenue','renderRev(gc())')+_sbBasisBadge+'<div class="metrics"><div class="metric"><div class="m-lbl">Projected</div><div class="m-val vb">'+fmt(tp)+'</div></div><div class="metric"><div class="m-lbl">Actual</div><div class="m-val vg">'+fmt(ta)+'</div></div><div class="metric"><div class="m-lbl">Confirmed pipeline</div><div class="m-val">'+fmt(conf)+'</div></div></div>'+(cs?'<div class="card"><div class="c-title" style="margin-bottom:.75rem">By category</div>'+cs+'</div>':'')+'<div class="card"><div class="c-head"><span class="c-title">Revenue streams</span><button class="add-btn" onclick="EI=-1;openM(\'m-rev\')">+ Add stream</button></div>'+(rev.length?'<table><thead><tr><th style="width:16%">Stream</th><th style="width:10%">Category</th><th style="width:7%">Code</th><th style="width:10%">Projected</th><th style="width:10%">Actual</th><th style="width:13%">Confidence</th><th style="width:12%">Progress</th><th style="width:22%"></th></tr></thead><tbody>'+rows+'</tbody></table>':ES('No revenue streams yet','Add your first revenue stream.','EI=-1;openM(\'m-rev\')'))+'</div>';
}

// ── CASH FLOW ───────────────────────────
function renderCF(cc){
  var c=cc||gc(),p=g('p-cashflow');if(!p)return;if(!c)return;var rev=(c.revenue||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}),exp=(c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;});
  var mIn=rev.reduce(function(s,r){return s+Number(r.proj||0);},0);
  var mOut=exp.reduce(function(s,e){var a=Number(e.amt||0);return s+(e.freq==='Weekly'?a*4:e.freq==='Bi-weekly'?a*2:e.freq==='Monthly'?a:e.freq==='Quarterly'?a/3:e.freq==='Annual'?a/12:a);},0);
  var net=mIn-mOut,tR=rev.reduce(function(s,r){return s+basisInc(c,r);},0),tE=exp.reduce(function(s,e){return s+Number(e.amt||0);},0),gp=tR-tE;
  // Build next 4 months dynamically from today
  var _now=new Date();
  var _mnNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var cfHtml='';
  for(var _mi=0;_mi<4;_mi++){
    var _md=new Date(_now.getFullYear(),_now.getMonth()+_mi+1,1);
    var _mlabel=_mnNames[_md.getMonth()]+' '+_md.getFullYear();
    var _ins=Math.round(mIn),_out=Math.round(mOut),_n=_ins-_out;
    cfHtml+='<div class="cf-mo"><div class="cf-mn">'+_mlabel+'</div>';
    cfHtml+='<div class="cf-in">+'+fmt(_ins)+'</div>';
    cfHtml+='<div class="cf-out">−'+fmt(_out)+'</div>';
    cfHtml+='<div class="cf-net" style="color:'+(_n>=0?'var(--green)':'var(--red)')+';">'+((_n>=0)?'+':'')+fmt(_n)+'</div></div>';
  }
  p.innerHTML=FB()+XB()+'<div class="insight"><div class="ins-lbl">Cash flow health</div>'+(net>=0?'Monthly position looks positive at '+fmt(Math.round(net))+'/mo.':'Projected monthly outflow exceeds inflow by '+fmt(Math.round(Math.abs(net)))+'. Review variable costs.')+'</div><div class="card"><div class="c-head"><span class="c-title">4-month forecast</span></div><div class="cf-grid">'+cfHtml+'</div></div><div class="card"><div class="c-head"><span class="c-title">P&amp;L snapshot</span></div><div class="metrics"><div class="metric"><div class="m-lbl">Total revenue</div><div class="m-val vg">'+fmt(tR)+'</div></div><div class="metric"><div class="m-lbl">Total costs</div><div class="m-val vr">'+fmt(tE)+'</div></div><div class="metric"><div class="m-lbl">Net P&amp;L</div><div class="m-val '+(gp>=0?'vg':'vr')+'">'+fmt(gp)+'</div></div></div></div>';
}

// ── SB EXPENSES ─────────────────────────
function renderSbExp(c){
  var p=g('p-sbexp');if(!p)return;if(!c)return;var exp=(c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;});var filt=CF==='all'?exp:exp.filter(function(r){return r.cat===CF;});
  filt=srchItems(filt,SRCH['p-sbexp']||'',['desc','cat','freq','fixed','checkNum','vendor1099','receiptUrl','acctCode']);
  var mo=exp.reduce(function(s,e){var a=Number(e.amt||0);return s+(e.freq==='Weekly'?a*4:e.freq==='Bi-weekly'?a*2:e.freq==='Monthly'?a:e.freq==='Quarterly'?a/3:e.freq==='Annual'?a/12:a);},0);
  var fx=exp.filter(function(e){return e.fixed==='Fixed';}).reduce(function(s,e){return s+Number(e.amt||0);},0),vr=exp.filter(function(e){return e.fixed==='Variable';}).reduce(function(s,e){return s+Number(e.amt||0);},0);
  var rows=filt.map(function(r){var oi=exp.indexOf(r),mo2=r.freq==='Weekly'?r.amt*4:r.freq==='Bi-weekly'?r.amt*2:r.freq==='Monthly'?r.amt:r.freq==='Quarterly'?Math.round(r.amt/3):r.freq==='Annual'?Math.round(r.amt/12):r.amt;var acctSb=(c.accounts||[]).find(function(a){return a.code===r.acctCode||a.cat===r.cat||a.name===r.cat;});var expAcctsSb=(c.accounts||[]).filter(function(a){return a.type==='Expense'&&a.active!==false;});var _catAcctCell=r.reconciled?escHtml(r.cat||'—'):'<select onchange="inlineSetExpAcct('+oi+',this.value)" style="font-size:11px;padding:2px 6px;border:1px solid var(--border);border-radius:6px;max-width:140px;font-family:DM Sans,sans-serif;background:var(--surface);color:var(--text)" title="Category / Account"><option value="">— Category —</option>'+expAcctsSb.map(function(a){return'<option value="'+escHtml(a.code)+'|'+escHtml(a.name)+'"'+((r.acctCode===a.code||r.cat===a.name||r.cat===a.cat)?' selected':'')+'>'+escHtml(a.name)+'</option>';}).join('')+'<option value="__new__" style="color:var(--np);font-weight:500">+ New account...</option></select>';var _vnd=r.vendor1099||r.desc||'';var _descCell=escHtml(_vnd||'—');return'<tr><td style="width:20px"><input type="checkbox" class="exp-recon-chk" data-oi="'+oi+'" style="width:13px;height:13px;cursor:pointer" '+(r.reconciled?'checked':'')+' onchange="sbRC('+oi+')"></td><td>'+_descCell+'</td><td colspan="2">'+_catAcctCell+'</td><td>'+fmt(r.amt)+'</td><td style="color:var(--muted)">'+(r.freq||'—')+'</td><td>'+fmt(mo2)+'</td><td><span class="badge '+(r.fixed==='Fixed'?'b-blue':'b-amber')+'">'+(r.fixed||'')+'</span>'+(r.recurring&&r.recurring!=='None'?' <span class="badge b-rec">&#8635;</span>':'')+'</td><td style="color:var(--muted);font-size:11px">'+(r.checkNum||'—')+'</td><td>'+rcptCell('expenses',oi,r)+'</td><td style="white-space:nowrap;min-width:220px">'+(r.inkindRef?'<span style="font-size:10px;color:var(--muted)">&#9889; system</span>':'<span style="display:inline-flex;align-items:center;gap:3px">'+rb('expenses',oi)+'<button class="add-btn" onclick="openAllocModal('+oi+')" title="Split across functional categories" style="font-size:11px;padding:3px 8px;white-space:nowrap">&#8853; Allocate</button></span>')+'</td></tr>';}).join('');
  var cs=catSum(exp,'amt');
  p.innerHTML=FB()+XB('expenses')+renderPayroll(c)+renderAP(c)+catF(exp,'renderSbExp(gc())')+srchBar('p-sbexp','renderSbExp(gc())')+'<div class="metrics"><div class="metric"><div class="m-lbl">Monthly burn</div><div class="m-val vr">'+fmt(Math.round(mo))+'</div></div><div class="metric"><div class="m-lbl">Fixed costs</div><div class="m-val">'+fmt(fx)+'</div></div><div class="metric"><div class="m-lbl">Variable costs</div><div class="m-val">'+fmt(vr)+'</div></div></div>'+(cs?'<div class="card"><div class="c-title" style="margin-bottom:.75rem">By category</div>'+cs+'</div>':'')+'<div class="card"><div class="c-head"><span class="c-title">Expenses</span><div style="display:flex;gap:.5rem;align-items:center"><button class="add-btn" style="font-size:11px;padding:3px 10px;background:none;border:1px solid var(--border);color:var(--muted)" onclick="batchUnreconcileExp()">↩ Unreconcile selected</button><button class="add-btn" onclick="EI=-1;openM(\'m-exp\')">+ Add expense</button></div></div>'+(exp.length?'<table><thead><tr><th style="width:20px"></th><th style="width:13%">Description</th><th style="width:14%">Category / Account</th><th style="width:7%">Amount</th><th style="width:6%">Freq</th><th style="width:7%">Monthly</th><th style="width:7%">Type</th><th style="width:6%">Check #</th><th style="width:5%">📎</th><th style="width:6%">Recon</th><th style="width:29%"></th></tr></thead><tbody>'+rows+'</tbody></table>':ES('No expenses yet','Add your business expenses.','EI=-1;openM(\'m-exp\')'))+'</div>';
}
function sbRC(i){var c=gc();if(!c||!c.expenses[i])return;var cur=c.expenses[i].reconciled;if(!cur&&!confirm('Mark this transaction as reconciled?'))return;if(cur&&!confirm('Unmark this transaction as reconciled?'))return;c.expenses[i].reconciled=!cur;sv();renderSbExp(c);}

function renderPeInc(c){
  var p=g('p-peinc');if(!p)return;if(!c)return;var inc=(c.income||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;});var filt=CF==='all'?inc:inc.filter(function(r){return r.cat===CF;});
  filt=srchItems(filt,SRCH['p-peinc']||'',['name','cat','freq','date','acctCode']);
  var tot=inc.reduce(function(s,r){return s+Number(r.amt||0);},0);
  var sorted=filt.slice().sort(function(a,b){var da=parseDate(a.date),db=parseDate(b.date);if(!da&&!db)return 0;if(!da)return 1;if(!db)return -1;return da-db;});
  var rows=sorted.map(function(r){var oi=inc.indexOf(r);var acctPI=(c.accounts||[]).find(function(a){return a.code===r.acctCode||a.cat===r.cat||a.name===r.cat;});var codePI=acctPI?'<span style="font-family:monospace;font-size:10px;background:var(--soft);padding:1px 4px;border-radius:3px">'+acctPI.code+'</span>':'—';var _srcCell=r.name?drillLink(r.name,'source',r.name,'incdetail'):('—');var _catCell=r.cat?drillLink(r.cat,'cat',r.cat,'incdetail'):('—');return'<tr><td style="font-weight:500">'+_srcCell+'</td><td>'+_catCell+'</td><td>'+codePI+'</td><td>'+fmt(r.amt)+'</td><td style="color:var(--muted)">'+(r.freq||'—')+(r.recurring&&r.recurring!=='None'?' <span class="badge b-rec">&#8635;</span>':'')+'</td><td style="color:var(--muted)">'+(r.date||'—')+'</td><td><input type="checkbox" class="rcb" '+(r.reconciled?'checked':'')+' onchange="tgReconInc('+oi+')" title="Mark reconciled"></td><td>'+rb('income',oi)+'</td></tr>';}).join('');
  var cs=catSum(inc,'amt');
  p.innerHTML=FB()+XB('peinc')+catF(inc,'renderPeInc(gc())')+srchBar('p-peinc','renderPeInc(gc())')+'<div class="metrics"><div class="metric"><div class="m-lbl">Total income</div><div class="m-val vg">'+fmt(tot)+'</div></div></div>'+(cs?'<div class="card"><div class="c-title" style="margin-bottom:.75rem">By category</div>'+cs+'</div>':'')+'<div class="card"><div class="c-head"><span class="c-title">Income sources</span><button class="add-btn" onclick="EI=-1;openM(\'m-peinc\')">+ Add income</button></div>'+(inc.length?'<table><thead><tr><th style="width:20%">Source</th><th style="width:12%">Category</th><th style="width:7%">Code</th><th style="width:11%">Amount</th><th style="width:15%">Frequency</th><th style="width:13%">Date</th><th style="width:22%"></th></tr></thead><tbody>'+rows+'</tbody></table>':ES('No income yet','Add your salary, side income, or other sources.','EI=-1;openM(\'m-peinc\')'))+'</div>';
}

function renderPeExp(c){
  var p=g('p-peexp');if(!p)return;if(!c)return;var exp=(c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;});var filt=CF==='all'?exp:exp.filter(function(r){return r.cat===CF;});
  filt=srchItems(filt,SRCH['p-peexp']||'',['desc','cat','freq','date','checkNum','vendor1099','acctCode']);
  var tot=exp.reduce(function(s,r){return(r.voided||r.isReversal)?s:s+Number(r.amt||0);},0);
  var rows=filt.map(function(r){var oi=exp.indexOf(r);var acctPE=(c.accounts||[]).find(function(a){return a.code===r.acctCode||a.cat===r.cat||a.name===r.cat;});var expAcctsPE=(c.accounts||[]).filter(function(a){return a.type==='Expense'&&a.active!==false;});var _catAcctCell=r.reconciled?escHtml(r.cat||'—'):'<select onchange="inlineSetExpAcct('+oi+',this.value)" style="font-size:11px;padding:2px 6px;border:1px solid var(--border);border-radius:6px;max-width:140px;font-family:DM Sans,sans-serif;background:var(--surface);color:var(--text)" title="Category / Account"><option value="">— Category —</option>'+expAcctsPE.map(function(a){return'<option value="'+escHtml(a.code)+'|'+escHtml(a.name)+'"'+((r.acctCode===a.code||r.cat===a.name||r.cat===a.cat)?' selected':'')+'>'+escHtml(a.name)+'</option>';}).join('')+'<option value="__new__" style="color:var(--np);font-weight:500">+ New account...</option></select>';var _vnd=r.vendor1099||r.desc||'';var _descCell=escHtml(_vnd||'—');return'<tr><td style="width:20px"><input type="checkbox" class="exp-recon-chk" data-oi="'+oi+'" style="width:13px;height:13px;cursor:pointer" '+(r.reconciled?'checked':'')+' onchange="peRC('+oi+')"></td><td>'+_descCell+'</td><td colspan="2">'+_catAcctCell+'</td><td>'+fmt(r.amt)+'</td><td style="color:var(--muted)">'+(r.freq||'—')+(r.recurring&&r.recurring!=='None'?' <span class="badge b-rec">&#8635;</span>':'')+'</td><td style="color:var(--muted)">'+(r.date||'—')+'</td><td style="color:var(--muted);font-size:11px">'+(r.checkNum||'—')+'</td><td>'+rcptCell('expenses',oi,r)+'</td><td>'+'<span style="display:inline-flex;gap:4px;align-items:center;white-space:nowrap">'+rb('expenses',oi)+'</span></td></tr>';}).join('');
  var cs=catSum(exp,'amt');
  p.innerHTML=FB()+XB('expenses')+catF(exp,'renderPeExp(gc())')+srchBar('p-peexp','renderPeExp(gc())')+'<div class="metrics"><div class="metric"><div class="m-lbl">Total expenses</div><div class="m-val vr">'+fmt(tot)+'</div></div></div>'+(cs?'<div class="card"><div class="c-title" style="margin-bottom:.75rem">By category</div>'+cs+'</div>':'')+'<div class="card"><div class="c-head"><span class="c-title">Expense log</span><div style="display:flex;gap:.5rem;align-items:center"><button class="add-btn" style="font-size:11px;padding:3px 10px;background:none;border:1px solid var(--border);color:var(--muted)" onclick="batchUnreconcileExp()">&#8617; Unreconcile selected</button><button class="add-btn" onclick="EI=-1;openM(\'m-exp\')">+ Add expense</button></div>'+(exp.length?'<table><thead><tr><th style="width:20px"></th><th style="width:14%">Description</th><th style="width:15%">Category / Account</th><th style="width:7%">Amount</th><th style="width:9%">Frequency</th><th style="width:9%">Date</th><th style="width:6%">Check #</th><th style="width:5%">📎</th><th style="width:6%">Recon</th><th style="width:29%"></th></tr></thead><tbody>'+rows+'</tbody></table>':ES('No expenses yet','Start logging your household expenses.','EI=-1;openM(\'m-exp\')'))+'</div>';
}
function peRC(i){var c=gc();if(!c||!c.expenses[i])return;var cur=c.expenses[i].reconciled;if(!cur&&!confirm('Mark this transaction as reconciled?'))return;if(cur&&!confirm('Unmark this transaction as reconciled?'))return;c.expenses[i].reconciled=!cur;sv();renderPeExp(c);}

// ── BUDGET ──────────────────────────────
// renderBudget() removed — renderBudgetMultiYear() handles all budget tab rendering

// ── REPORTS ─────────────────────────────
function renderReports(){
  var p=g('p-reports');if(!p)return;
  var c=gc();if(!c)return;

  // Capture current selection BEFORE rebuilding innerHTML
  var _prevSel=g('rpt-sel')?g('rpt-sel').value:'executive';

  // ── Compute P&L totals for the header metrics ──────────────────────────
  var accts=c.accounts||[];
  function acctLabel(code,cat){
    if(code){var a=accts.find(function(x){return x.code===code;});if(a)return a.code+' '+a.name;}
    return cat||'Other';
  }
  // FY date filter — 'current' uses getFiscalYear(), others parse the label
  var _fyRange=(function(){
    if(RPT_FY==='current')return getFiscalYear(c.fiscalYearEnd);
    // Label is 'FY 2024' — use Dec 31 of that year as the FYE reference
    var yr=parseInt(RPT_FY.replace('FY ',''));
    if(isNaN(yr))return getFiscalYear(c.fiscalYearEnd);
    var parts=(c.fiscalYearEnd||'12/31').split('/');
    var refDate=new Date(yr,parseInt(parts[0])-1,parseInt(parts[1]));
    return getFiscalYear(c.fiscalYearEnd,refDate);
  })();
  function inFY(dateStr){
    if(!dateStr)return false;
    var d=parseDate(dateStr);
    return d&&d>=_fyRange.start&&d<=_fyRange.end;
  }
  var _basis=RPT_BASIS||(c.basisType||'cash');
  var iT=0,eT=0,iC={},eC={};
  if(c.type==='np'){
    // Grant income is recognized through c.income[] entries (linked via grantId) when disbursements
    // are received — NOT from gr.awarded, which is a commitment/pledge, not recognized revenue.
    // A prior version double-counted by also adding the full awarded amount here; removed.
    (c.income||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal&&inFY(r.date||r.recv&&r.date);}).forEach(function(r){var a=_basis==='accrual'?Number(r.proj||0):Number(r.recv||0);iT+=a;var k=acctLabel(r.acctCode,r.cat);if(!iC[k])iC[k]=0;iC[k]+=a;});
    (c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal&&inFY(r.date);}).forEach(function(r){eT+=Number(r.amt||0);var k=acctLabel(r.acctCode,r.cat);if(!eC[k])eC[k]=0;eC[k]+=Number(r.amt||0);});
  }else if(c.type==='sb'){
    (c.revenue||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal&&inFY(r.date);}).forEach(function(r){var a=_basis==='accrual'?Number(r.proj||0):Number(r.act||0);iT+=a;var k=acctLabel(r.acctCode,r.cat);if(!iC[k])iC[k]=0;iC[k]+=a;});
    // ACCRUAL TIMING: add unpaid invoices dated in FY as earned revenue
    if(_basis==='accrual'){
      (c.invoices||[]).filter(function(i){return i.status!=='Paid'&&i.status!=='Written Off'&&i.status!=='Void'&&!i.deleted&&inFY(i.date);}).forEach(function(i){var a=Number(i.amt||0);iT+=a;var k=acctLabel(i.acctCode,'Accounts Receivable');if(!iC[k])iC[k]=0;iC[k]+=a;});
      // Add unpaid bills dated in FY as accrued expenses
      (c.bills||[]).filter(function(b){return b.status==='Unpaid'&&inFY(b.received||b.due);}).forEach(function(b){eT+=Number(b.amt||0);var k=acctLabel(b.acctCode,'Accounts Payable');if(!eC[k])eC[k]=0;eC[k]+=Number(b.amt||0);});
    }
    (c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal&&inFY(r.date);}).forEach(function(r){eT+=Number(r.amt||0);var k=acctLabel(r.acctCode,r.cat);if(!eC[k])eC[k]=0;eC[k]+=Number(r.amt||0);});
  }else{
    (c.income||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal&&inFY(r.date);}).forEach(function(r){iT+=Number(r.amt||0);var k=acctLabel(r.acctCode,r.cat);if(!iC[k])iC[k]=0;iC[k]+=Number(r.amt||0);});
    (c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal&&inFY(r.date);}).forEach(function(r){eT+=Number(r.amt||0);var k=acctLabel(r.acctCode,r.cat);if(!eC[k])eC[k]=0;eC[k]+=Number(r.amt||0);});
  }
  (c.journalEntries||[]).filter(function(e){return inFY(e.date);}).forEach(function(e){
    var da=accts.find(function(a){return a.code===e.debitCode;});
    var ca2=accts.find(function(a){return a.code===e.creditCode;});
    if(da){var k=da.code+' '+da.name;var amt=Number(e.amt||0);if(da.type==='Expense'){if(!eC[k])eC[k]=0;eC[k]+=amt;eT+=amt;}else if(da.type==='Income'){if(!iC[k])iC[k]=0;iC[k]+=amt;iT+=amt;}}
    if(ca2){var k2=ca2.code+' '+ca2.name;var amt2=Number(e.amt||0);if(ca2.type==='Income'){if(!iC[k2])iC[k2]=0;iC[k2]+=amt2;iT+=amt2;}else if(ca2.type==='Expense'){if(!eC[k2])eC[k2]=0;eC[k2]+=amt2;eT+=amt2;}}
  });
  var net=iT-eT;
  var gm=iT>0?Math.round((net/iT)*100):0;

  // ── 990 filing threshold alert (NP only) ──────────────────────────────
  var _990Alert='';
  if(c.type==='np'){
    var _grossReceipts=iT; // gross receipts = total income for 990 purposes
    if(_grossReceipts<50000){
      _990Alert='<div style="margin-bottom:.75rem;padding:.6rem .875rem;background:#e8f5e9;border:1px solid #43a047;border-radius:8px;font-size:11px;color:#1b5e20;line-height:1.6">'
        +'<strong>990-N (e-Postcard):</strong> Gross receipts under $50K — file the 990-N e-Postcard. No financial data required, just basic org info. Due by the 15th day of the 5th month after your fiscal year ends.'
        +'</div>';
    }else if(_grossReceipts<200000){
      _990Alert='<div style="margin-bottom:.75rem;padding:.6rem .875rem;background:#fff8e1;border:1px solid #f9a825;border-radius:8px;font-size:11px;color:#7b5800;line-height:1.6">'
        +'<strong>990-EZ:</strong> Gross receipts $50K–$200K — you may file the 990-EZ (short form) unless total assets exceed $500K. Consult your CPA.'
        +'</div>';
    }else{
      _990Alert='<div style="margin-bottom:.75rem;padding:.6rem .875rem;background:#fce4ec;border:1px solid #e91e63;border-radius:8px;font-size:11px;color:#880e4f;line-height:1.6">'
        +'<strong>Form 990 (full):</strong> Gross receipts over $200K — full Form 990 required. Work with a CPA or tax professional for preparation.'
        +'</div>';
    }
  }

  function sortedRows(obj,cls){
    return Object.keys(obj).sort().map(function(k){
      return '<div class="rpt-row"><span>'+k+'</span><span class="'+cls+'">'+fmt(obj[k])+'</span></div>';
    }).join('');
  }
  var iR=sortedRows(iC,'vg');
  var eR=sortedRows(eC,'vr');

  var hasTagged=(c.accounts||[]).length>0;

  // ── Report type selector options ──────────────────────────────────────
  var selOpts=''
    +'<option value="executive">Executive Summary</option>'
    +(c.type==='np'?'<optgroup label="── Nonprofit ──"></optgroup>':'')
    +(c.type==='np'?'<option value="donors">Donor Report (LYBUNT)</option>':'')
    +(c.type==='np'?'<option value="grants">Grant Summary</option>':'')
    +(c.type==='np'?'<option value="grantcloseout">Grant Close-Out Report</option>':'')
    +(c.type==='np'?'<option value="grantstatus">Grant Status Report</option>':'')
    +(c.type==='np'?'<option value="functional">Functional Expenses (990)</option>':'')
    +(c.type==='np'?'<option value="fundpl">Fund P&L</option>':'')
    +(c.type==='np'?'<option value="budgetbyfund">Budget vs Actual by Fund</option>':'')
    +'<optgroup label="── Financial ──"></optgroup>'
    +'<option value="pl">P&L</option>'
    +'<option value="plcompare">Year-over-Year P&L</option>'
    +((c.type==='sb'||c.type==='np')?'<option value="bsheet">Balance Sheet</option>':'')
    +(c.type==='sb'?'<option value="cashflow">Cash Flow</option>':'')
    +'<optgroup label="── Budget ──"></optgroup>'
    +'<option value="budget">Budget vs Actual</option>'
    +'<option value="budgetexport">Budget Summary</option>'
    +'<option value="budgetmulti">Multi-year Budget</option>'
    +'<option value="budgettwoyr">Current + Proposed Budget</option>'
    +'<optgroup label="── Detail ──"></optgroup>'
    +'<option value="category">Category Breakdown</option>'
    +'<option value="expdetail">Expense Detail</option>'
    +'<option value="incdetail">'+il(c.type)+' Detail</option>'
    +'<option value="vendor">Vendor Summary</option>'
    +'<option value="1099">1099 Contractors</option>'
    +'<option value="projpl">Project P&L</option>'
    +'<optgroup label="── Other ──"></optgroup>'
    +(c.type!=='np'?'<option value="mileage">Mileage Log</option>':'')
    +'<option value="assets">Fixed Assets &amp; Depreciation</option>'
    +(c.type!=='np'?'<option value="esttax">Estimated Quarterly Taxes</option>':'')
    +'<option value="loans">Loan Amortization</option>'
    +(D.clients.length>1?'<option value="consolidated">★ Consolidated P&L</option>':'');

  // ── Logo ──────────────────────────────────────────────────────────────
  var logoHtml=c.logo?'<img src="'+c.logo+'" style="max-height:48px;max-width:160px;object-fit:contain;margin-bottom:.25rem" alt="logo">':'';
  var logoUpload='<label style="font-size:11px;color:var(--muted);cursor:pointer;text-decoration:underline">'+(c.logo?'Change logo':'+ Upload logo')+'<input type="file" accept="image/*" style="display:none" onchange="uploadOrgLogo(this)"></label>';

  // ── Grant summary rows (for rpt-grants panel) ─────────────────────────
  var grantRows='';
  if(c.type==='np'){
    grantRows=(c.grants||[]).map(function(gr){
      var sp=(c.expenses||[]).filter(function(e){return e.grantId===gr.id;}).reduce(function(s,e){return s+Number(e.amt||0);},0);
      var r=Number(gr.awarded||0)-sp;
      return '<div class="rpt-row"><span>'+escHtml(gr.name)+' '+SB(gr.status||'')+'</span><span class="vg">'+fmt(gr.awarded)+'</span></div>'
        +'<div class="rpt-row" style="padding-left:1rem;background:var(--bg)"><span style="color:var(--muted);font-size:11px">Spent</span><span class="vr">'+fmt(sp)+'</span></div>'
        +'<div class="rpt-row" style="padding-left:1rem;background:var(--bg)"><span style="color:var(--muted);font-size:11px">Remaining</span><span class="'+(r>=0?'vg':'vr')+'">'+fmt(r)+'</span></div>';
    }).join('');
  }

  // ── Budget vs actual rows (for rpt-budget panel) ──────────────────────
  var budRows=(c.budgetItems||[]).map(function(b){
    var act=b.type==='Income'?(iC[b.cat]||0):(eC[b.cat]||0);
    var v=b.type==='Income'?(act-Number(b.amt)):(Number(b.amt)-act);
    return '<div class="rpt-row"><span>'+b.cat+' <span style="font-size:10px;color:var(--muted)">('+b.type+')</span></span>'
      +'<span style="display:flex;gap:12px;flex-wrap:wrap"><span>'+fmt(b.amt)+'</span><span>'+fmt(act)+' actual</span>'
      +'<span class="'+(v>=0?'vg':'vr')+'">'+(v>=0?'+':'')+fmt(v)+'</span></span></div>';
  }).join('');

  // ── Assemble the full panel HTML ──────────────────────────────────────
  // Every section is a sibling div — NO nesting of report panels inside each other.
  // rpt-header: org name + metrics (shown for all reports except executive)
  // rpt-pl, rpt-grants, rpt-budget, etc: each a flat sibling, shown/hidden by switchRpt

  p.innerHTML=''
    // Feedback bar + export bar
    +FB()
    +XB()
    // ── Compliance warnings (NP only) ────────────────────────────────
    +(c.type==='np'&&typeof renderComplianceBanner==='function'?renderComplianceBanner(c):'')

    // ── Selector row ──────────────────────────────────────────────────
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:8px">'
      +'<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
        +'<span style="font-size:12px;color:var(--muted)">Report type:</span>'
        +'<div class="sw"><select id="rpt-sel" onchange="switchRpt(this.value)">'+selOpts+'</select></div>'
        +(function(){
          var fyOpts='<option value="current">Current FY</option>';
          var adopted=c.adoptedBudgets||[];
          // Build prior FY list from adopted budgets + last 3 calendar years
          var fyLabels={};
          adopted.forEach(function(ab){if(ab.fy)fyLabels[ab.fy]=1;});
          var curYr=new Date().getFullYear();
          for(var y=curYr-1;y>=curYr-3;y--){fyLabels['FY '+y]=1;}
          Object.keys(fyLabels).sort().reverse().forEach(function(lbl){
            fyOpts+='<option value="'+lbl+'"'+(RPT_FY===lbl?' selected':'')+'>'+lbl+'</option>';
          });
          return'<span style="font-size:12px;color:var(--muted)">Year:</span><div class="sw"><select id="rpt-fy-sel" onchange="RPT_FY=this.value;renderReports()">'+fyOpts+'</select></div>'
            +'<span style="font-size:12px;color:var(--muted);margin-left:8px">Basis:</span><div class="sw"><select onchange="RPT_BASIS=this.value;renderReports()" style="font-size:12px"><option value="" '+(RPT_BASIS===''?'selected':'')+'>Default ('+( c.basisType||'cash')+')</option><option value="cash" '+(RPT_BASIS==='cash'?'selected':'')+'>Cash</option><option value="accrual" '+(RPT_BASIS==='accrual'?'selected':'')+'>Accrual</option></select></div>';
        })()
      +'</div>'
      +(hasTagged?'<span style="font-size:11px;color:var(--green)">✓ COA-linked</span>':'')
      +'<div style="display:flex;gap:6px">'
      +'<button onclick="openPackagesPanel()" style="font-size:12px;padding:5px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface);cursor:pointer;font-family:DM Sans,sans-serif;color:var(--text)">📦 Packages</button>'
      +'<button onclick="goReportsTab()" style="font-size:12px;padding:5px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface);cursor:pointer;font-family:DM Sans,sans-serif;color:var(--muted)">✕ Close</button>'
      +'</div>'
    +'</div>'

    // ── Org header + metrics (always shown) ──────────────────────────────
    +'<div id="rpt-score-bar"></div>'
    +'<div id="rpt-header">'
      +'<div class="card">'
        +'<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:.75rem">'
          +'<div>'+(logoHtml?logoHtml+'<br>':'')+'<span style="font-family:\'DM Serif Display\',serif;font-size:18px;font-weight:400">'+c.name+'</span>'
            +'<div style="font-size:11px;color:var(--muted);margin-top:2px">'+tl(c.type)+' · '+today()+(c.fiscalYearEnd?' · FY ends '+fyeLabel(c.fiscalYearEnd):'')+'</div>'
          +'</div>'
          +'<div style="text-align:right">'+logoUpload+'</div>'
        +'</div>'
        +'<div class="metrics">'
          +'<div class="metric"><div class="m-lbl">Total '+il(c.type).toLowerCase()+'</div><div class="m-val vg">'+fmt(iT)+'</div></div>'
          +'<div class="metric"><div class="m-lbl">Total expenses</div><div class="m-val vr">'+fmt(eT)+'</div></div>'
          +'<div class="metric"><div class="m-lbl">'+nl(c.type)+'</div><div class="m-val '+(net>=0?'vg':'vr')+'">'+fmt(net)+'</div></div>'
        +'</div>'
        +(iT>0?'<div style="font-size:12px;color:var(--muted);margin-bottom:1rem">'+(c.type==='sb'?'Gross margin':'Surplus rate')+': '+gm+'%</div>':'')
        +_990Alert
      +'</div>'
    +'</div>'

    // ── P&L panel ────────────────────────────────────────────────────────
    +'<div id="rpt-pl" style="display:none">'
      +_rptDisclaimer('Figures reflect the selected fiscal year and basis (cash/accrual).')
      +((iT===0&&eT===0&&RPT_FY==='current'&&(((c.income||[]).length)||((c.expenses||[]).length)))
        ?'<div style="margin-bottom:1rem;padding:.6rem .875rem;background:var(--amber-bg,#fffbea);border:1px solid var(--amber);border-radius:8px;font-size:12px;color:var(--amber)">No activity in the current fiscal year ('+_fyRange.start.getFullYear()+'–'+_fyRange.end.getFullYear()+'), but this client has transactions on file. Use the <strong>Year</strong> selector above to view a prior fiscal year.</div>'
        :'')
      +'<div class="rpt-sec"><div class="rpt-ttl">'+il(c.type)+'</div>'
        +(iR||'<div style="color:var(--muted);font-size:12px;padding:.5rem 0">No data yet.</div>')
        +'<div class="rpt-total"><span>Total '+il(c.type).toLowerCase()+'</span><span class="vg">'+fmt(iT)+'</span></div>'
      +'</div>'
      +'<div class="rpt-sec"><div class="rpt-ttl">Expenses</div>'
        +(eR||'<div style="color:var(--muted);font-size:12px;padding:.5rem 0">No data yet.</div>')
        +'<div class="rpt-total"><span>Total expenses</span><span class="vr">'+fmt(eT)+'</span></div>'
      +'</div>'
      +'<div class="rpt-sec"><div class="rpt-total" style="font-size:16px;border-top:2px solid var(--text);padding-top:12px"><span>'+nl(c.type)+'</span><span class="'+(net>=0?'vg':'vr')+'">'+fmt(net)+'</span></div></div>'
    +'</div>'

    // ── Grants panel ──────────────────────────────────────────────────────
    +'<div id="rpt-grants" style="display:none">'
      +'<div class="rpt-sec"><div class="rpt-ttl">Grant summary</div>'
        +(grantRows||'<div style="color:var(--muted);font-size:12px">No grants.</div>')
      +'</div>'
    +'</div>'

    // ── Budget vs Actual panel ────────────────────────────────────────────
    +'<div id="rpt-budget" style="display:none">'
      +'<div class="rpt-sec"><div class="rpt-ttl">Budget vs actual</div>'
        +(budRows||'<div style="color:var(--muted);font-size:12px">No budget items.</div>')
      +'</div>'
    +'</div>'

    // ── Category breakdown panel ──────────────────────────────────────────
    +'<div id="rpt-category" style="display:none">'
      +'<div class="rpt-sec"><div class="rpt-ttl">'+il(c.type)+' by account</div>'
        +(iR||'<div style="color:var(--muted);font-size:12px">No data.</div>')
      +'</div>'
      +'<div class="rpt-sec"><div class="rpt-ttl">Expenses by account</div>'
        +(eR||'<div style="color:var(--muted);font-size:12px">No data.</div>')
      +'</div>'
    +'</div>'

    // ── Dynamic panels (populated by their render functions) ──────────────
    +'<div id="rpt-1099"         style="display:none"></div>'
    +'<div id="rpt-budgetmulti"  style="display:none"></div>'
    +'<div id="rpt-plcompare" style="display:none"></div>'
    +'<div id="rpt-budgettwoyr" style="display:none"></div>'
    +'<div id="rpt-budgetexport" style="display:none"></div>'
    +'<div id="rpt-expdetail"    style="display:none"></div>'
    +'<div id="rpt-incdetail"    style="display:none"></div>'
    +'<div id="rpt-vendor"       style="display:none"></div>'
    +'<div id="rpt-donors"       style="display:none"></div>'
    +'<div id="rpt-projpl"       style="display:none"></div>'
    +'<div id="rpt-functional"   style="display:none"></div>'
    +'<div id="rpt-cashflow"     style="display:none"></div>'
    +'<div id="rpt-bsheet"       style="display:none"></div>'
    +'<div id="rpt-fundpl"       style="display:none"></div>'
    +'<div id="rpt-budgetbyfund" style="display:none"></div>'
    +'<div id="rpt-mileage"     style="display:none"></div>'
    +'<div id="rpt-assets"      style="display:none"></div>'
    +'<div id="rpt-esttax"      style="display:none"></div>'
    +'<div id="rpt-loans"       style="display:none"></div>'
    +'<div id="rpt-consolidated" style="display:none"></div>'
    +'<div id="rpt-grantcloseout" style="display:none"></div>'
    +'<div id="rpt-grantstatus"   style="display:none"></div>'

    // ── Executive Summary panel ───────────────────────────────────────────
    +'<div id="rpt-executive"    style="display:none"></div>';

  // Restore previously-selected report, only re-render if panel is visible
  var _cur=_prevSel||'executive';
  var selEl=g('rpt-sel');if(selEl)selEl.value=_cur;
  var pRep=g('p-reports');
  if(pRep&&pRep.classList.contains('active')){
    // Always pre-render executive summary first to populate _clarityScoreData
    // so the score shows in the header for ALL reports
    if(typeof renderExecutiveSummary==='function')setTimeout(function(){renderExecutiveSummary();setTimeout(function(){switchRpt(_cur);},50);},0);
    else setTimeout(function(){switchRpt(_cur);},0);
  }
}

function switchRpt(type){
  // If the reports panel isn't open yet, navigate there first then re-call
  var rptPanel=g('p-reports');
  if(!rptPanel||!rptPanel.classList.contains('active')){
    var rptTab=document.querySelector('#tabs .tab[data-panel="reports"]');
    if(rptTab&&typeof switchTab==='function'){
      switchTab({target:rptTab},'reports');
      // renderReports builds the sub-divs; wait for it then switch
      setTimeout(function(){switchRpt(type);},120);
      return;
    }
  }
  // Hide every report panel
  ['rpt-pl','rpt-grants','rpt-budget','rpt-category','rpt-1099','rpt-budgetmulti',
   'rpt-budgetexport','rpt-budgettwoyr','rpt-plcompare','rpt-functional','rpt-expdetail','rpt-incdetail','rpt-vendor','rpt-donors',
   'rpt-projpl','rpt-cashflow','rpt-bsheet','rpt-executive','rpt-fundpl','rpt-budgetbyfund',
   'rpt-mileage','rpt-assets','rpt-esttax','rpt-loans','rpt-consolidated',
   'rpt-grantcloseout','rpt-grantstatus'
  ].forEach(function(id){var el=g(id);if(el)el.style.display='none';});

  // Always show the persistent header
  var rptHdr=g('rpt-header');
  if(rptHdr)rptHdr.style.display='block';

  // Show the target panel
  var target=g('rpt-'+type);
  if(target){
    target.style.display='block';
  }else{
    // Fallback to P&L if unknown type
    var pl=g('rpt-pl');if(pl)pl.style.display='block';
    return;
  }

  // Render dynamic reports
  var fns={
    'executive':renderExecutiveSummary,
    'functional':renderFunctionalExpRpt,
    'fundpl':renderFundPLRpt,
    '1099':render1099Report,
    'budgetmulti':renderBudgetMultiRpt,
    'budgettwoyr':renderBudgetTwoYrRpt,
    'plcompare':renderPLCompareRpt,
    'budgetexport':renderBudgetExportRpt,
    'expdetail':renderExpDetailRpt,
    'incdetail':renderIncDetailRpt,
    'vendor':renderVendorRpt,
    'donors':renderDonorRpt,
    'projpl':renderProjPLRpt,
    'cashflow':renderCashFlowRpt,
    'bsheet':renderBSheetRpt,
    'budgetbyfund':renderBudgetByFundRpt,
    'mileage':renderMileageRpt,
    'assets':renderAssetsRpt,
    'esttax':renderEstTaxRpt,
    'loans':renderLoansRpt,'consolidated':renderConsolidatedPL,
    'grantcloseout':renderGrantCloseoutRpt,'grantstatus':renderGrantStatusRpt
  };
  if(fns[type])fns[type]();
}

// ── NEW REPORT RENDERERS ─────────────────

function renderFunctionalExpRpt(){
  var c=gc();if(!c)return;var el=g('rpt-functional');if(!el)return;
  if(c.type!=='np'){el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Functional Expenses</div><div style="color:var(--muted);font-size:12px">This report is only available for nonprofit organizations.</div></div>';return;}
  var exp=(c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;});
  if(!exp.length){el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Statement of Functional Expenses</div><div style="color:var(--muted);font-size:12px">No expenses yet. As you log expenses and classify them as Program, Management, or Fundraising, they will appear here.</div></div>';return;}
  // Build totals by category across functional classifications
  var cats={};
  var colTotals={program:0,management:0,fundraising:0,unclassified:0,total:0};
  exp.forEach(function(e){
    var amt=Number(e.amt||0);
    var cat=e.cat||'Other';
    if(!cats[cat])cats[cat]={program:0,management:0,fundraising:0,unclassified:0,total:0};
    cats[cat].total+=amt;
    colTotals.total+=amt;
    if(e.functionalSplit&&e.functionalSplit.length){
      // Distribute by split percentages
      e.functionalSplit.forEach(function(s){
        var col=s.type==='program'?'program':s.type==='management'?'management':s.type==='fundraising'?'fundraising':'unclassified';
        var share=amt*(s.pct/100);
        cats[cat][col]+=share;
        colTotals[col]+=share;
      });
    } else {
      var fn=e.functional||'';
      var col=fn==='program'?'program':fn==='management'?'management':fn==='fundraising'?'fundraising':'unclassified';
      cats[cat][col]+=amt;
      colTotals[col]+=amt;
    }
  });
  var totalExp=colTotals.total;
  var programPct=totalExp>0?Math.round(colTotals.program/totalExp*100):0;
  var mgmtPct=totalExp>0?Math.round(colTotals.management/totalExp*100):0;
  var frPct=totalExp>0?Math.round(colTotals.fundraising/totalExp*100):0;
  var unclPct=totalExp>0?Math.round(colTotals.unclassified/totalExp*100):0;
  var hasUnclassified=colTotals.unclassified>0;
  // Summary tiles
  var tiles='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem;margin-bottom:1.25rem">';
  function tile(label,amt,pct,color,note){
    return'<div class="card" style="margin:0;padding:.75rem">'
      +'<div style="font-size:11px;color:var(--muted);margin-bottom:2px">'+label+'</div>'
      +'<div style="font-weight:700;font-size:18px;color:'+color+'">'+pct+'%</div>'
      +'<div style="font-size:12px;font-weight:500">'+fmt(amt)+'</div>'
      +(note?'<div style="font-size:10px;color:var(--muted);margin-top:3px">'+note+'</div>':'')
      +'</div>';
  }
  tiles+=tile('Program services',colTotals.program,programPct,'var(--green)',programPct>=75?'✓ Charity Navigator standard':'Target: 75%+');
  tiles+=tile('Mgmt & general',colTotals.management,mgmtPct,'var(--text)',mgmtPct<=15?'✓ Under 15%':'Consider reviewing');
  tiles+=tile('Fundraising',colTotals.fundraising,frPct,'var(--text)','');
  if(hasUnclassified)tiles+=tile('Unclassified',colTotals.unclassified,unclPct,'var(--amber)','Classify to complete 990');
  tiles+='</div>';
  // Detail table by category
  var catKeys=Object.keys(cats).sort();
  var rows=catKeys.map(function(cat){
    var d=cats[cat];
    var pPct=d.total>0?Math.round(d.program/d.total*100):0;
    return'<tr>'
      +'<td style="font-size:12px">'+cat+'</td>'
      +'<td style="text-align:right">'+fmt(d.program)+'</td>'
      +'<td style="text-align:right">'+fmt(d.management)+'</td>'
      +'<td style="text-align:right">'+fmt(d.fundraising)+'</td>'
      +(hasUnclassified?'<td style="text-align:right;color:var(--amber)">'+fmt(d.unclassified)+'</td>':'')
      +'<td style="text-align:right;font-weight:500">'+fmt(d.total)+'</td>'
      +'</tr>';
  }).join('');
  var totRow='<tr class="bud-total">'
    +'<td>Total</td>'
    +'<td style="text-align:right;color:var(--green)">'+fmt(colTotals.program)+'</td>'
    +'<td style="text-align:right">'+fmt(colTotals.management)+'</td>'
    +'<td style="text-align:right">'+fmt(colTotals.fundraising)+'</td>'
    +(hasUnclassified?'<td style="text-align:right;color:var(--amber)">'+fmt(colTotals.unclassified)+'</td>':'')
    +'<td style="text-align:right">'+fmt(colTotals.total)+'</td>'
    +'</tr>';
  var pctRow='<tr style="font-size:11px;color:var(--muted)">'
    +'<td>% of total</td>'
    +'<td style="text-align:right">'+programPct+'%</td>'
    +'<td style="text-align:right">'+mgmtPct+'%</td>'
    +'<td style="text-align:right">'+frPct+'%</td>'
    +(hasUnclassified?'<td style="text-align:right">'+unclPct+'%</td>':'')
    +'<td></td>'
    +'</tr>';
  var unclNote=hasUnclassified
    ?'<div style="margin-top:.75rem;padding:.75rem;background:var(--soft);border-radius:8px;font-size:11px;color:var(--amber)">⚠ '+colTotals.unclassified>0?fmt(colTotals.unclassified)+' in unclassified expenses. Open each expense and set the Functional field to complete your 990 Part IX.':''+'</div>'
    :'<div style="margin-top:.75rem;font-size:11px;color:var(--green)">✓ All expenses classified — ready for Form 990 Part IX.</div>';
  el.innerHTML='<div class="rpt-sec">'
    +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:1rem">'
    +'<div class="rpt-ttl" style="margin-bottom:0">Statement of Functional Expenses</div>'
    +'<span class="badge b-gray" style="font-size:10px">Form 990 Part IX</span>'
    +'</div>'
    +tiles
    +'<div style="overflow-x:auto"><table class="bud-tbl"><thead><tr>'
    +'<th>Category</th>'
    +'<th style="text-align:right">Program</th>'
    +'<th style="text-align:right">Mgmt &amp; General</th>'
    +'<th style="text-align:right">Fundraising</th>'
    +(hasUnclassified?'<th style="text-align:right;color:var(--amber)">Unclassified</th>':'')
    +'<th style="text-align:right">Total</th>'
    +'</tr></thead><tbody>'
    +rows+totRow+pctRow
    +'</tbody></table></div>'
    +unclNote
    +'</div>';
}

function renderScoreBar(score,scores){
  var el=g('rpt-score-bar');if(!el)return;
  // Respect user dismissal
  if(window._scoreBarDismissed){el.innerHTML='<div style="text-align:right;margin-bottom:.5rem"><button onclick="window._scoreBarDismissed=false;renderScoreBar('+(score||0)+',window._clarityScoreData&&window._clarityScoreData.scores||{})" style="font-size:11px;color:var(--muted);background:none;border:none;cursor:pointer;text-decoration:underline;font-family:DM Sans,sans-serif">Show Clarity Score</button></div>';return;}
  if(score===null||score===undefined){el.innerHTML='<div style="font-size:12px;color:var(--muted);padding:.5rem 0">Add more data to generate your Clarity Score.</div>';return;}
  var col=score>=80?'var(--green)':score>=60?'var(--amber)':'var(--red)';
  var label=score>=80?'Strong':score>=60?'Stable':'Needs attention';
  var subScores=[
    {label:'Survival',    key:'survival',   weight:'30%'},
    {label:'Performance', key:'performance', weight:'25%'},
    {label:'Stability',   key:'stability',   weight:'20%'},
    {label:'Efficiency',  key:'efficiency',  weight:'15%'},
    {label:'Resilience',  key:'resilience',  weight:'10%'}
  ];
  el.innerHTML='<div class="card" style="margin-bottom:1rem;padding:1rem 1.25rem;position:relative">'
    +'<button onclick="window._scoreBarDismissed=true;renderScoreBar()" style="position:absolute;top:8px;right:8px;background:none;border:none;cursor:pointer;color:var(--muted);font-size:18px;line-height:1;padding:2px 6px;font-family:DM Sans,sans-serif" title="Hide score">×</button>'
    +'<div style="display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap">'
    // Big score number
    +'<div style="text-align:center;flex-shrink:0">'
    +'<div style="font-size:11px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Clarity Score</div>'
    +'<div style="font-size:52px;font-weight:700;color:'+col+';line-height:1">'+score+'</div>'
    +'<div style="font-size:11px;font-weight:600;color:'+col+'">'+label+'</div>'
    +'</div>'
    // Score bar
    +'<div style="flex:1;min-width:200px">'
    +'<div style="width:100%;height:10px;background:var(--soft);border-radius:99px;overflow:hidden;margin-bottom:1.25rem">'
    +'<div style="height:100%;width:'+score+'%;background:'+col+';border-radius:99px;transition:width .6s ease"></div>'
    +'</div>'
    // Sub-scores
    +'<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px">'
    +subScores.map(function(s){
      var sv=Math.round(scores[s.key]||0);
      var sc=sv>=80?'var(--green)':sv>=60?'var(--amber)':'var(--red)';
      return'<div style="text-align:center">'
        +'<div style="font-size:14px;font-weight:700;color:'+sc+'">'+sv+'</div>'
        +'<div style="font-size:9px;color:var(--muted);margin-top:1px">'+s.label+'</div>'
        +'<div style="font-size:8px;color:var(--muted);opacity:.7">'+s.weight+'</div>'
        +'</div>';
    }).join('')
    +'</div></div>'
    // View full button
    +'<div style="flex-shrink:0">'
    +'<button onclick="switchRpt(\'executive\');setTimeout(function(){var e=document.getElementById(\'rpt-executive\');if(e)e.scrollIntoView({behavior:\'smooth\'});},200)" style="font-size:11px;padding:6px 14px;border:1px solid var(--border);border-radius:7px;background:var(--surface);cursor:pointer;font-family:DM Sans,sans-serif;color:var(--text)">View full summary →</button>'
    +'</div>'
    +'</div>'
    +'</div>';
}

function renderExecutiveSummary(){
  var el=g('rpt-executive');
  if(!el){console.error('rpt-executive div not found');return;}
  var c=gc();
  if(!c){console.error('no client selected');return;}
  el.innerHTML='<div style="padding:1rem;color:var(--muted);font-size:12px">Loading...</div>';
  try{
    _renderExecSummaryBody(el,c);
  }catch(err){
    console.error('Executive Summary render error:',err.message,err.stack);
    el.innerHTML='<div style="padding:2rem;color:var(--red);font-size:13px">'
      +'<strong>Executive Summary error:</strong><br>'+err.message
      +'<br><br><span style="font-size:11px;color:var(--muted)">Open DevTools console for full details.</span>'
      +'</div>';
  }
}
function _renderExecSummaryBody(el,c){
  var fy=getFiscalYear(c.fiscalYearEnd);

  // ── RAW DATA ────────────────────────────
  var allInc=c.type==='sb'?(c.revenue||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}):(c.income||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;});
  var allExp=(c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;});
  var bills=c.bills||[];
  var invoices=c.invoices||[];
  var loans=c.loans||[];
  var bs=c.balanceSheet||{assets:[],liabilities:[],equity:[]};
  var grants=c.grants||[];
  var projects=c.projects||[];
  var budItems=c.budgetItems||[];

  function getAmt(r){return basisInc(c,r);}// basis-aware: cash=recv/act, accrual=proj

  var iT=allInc.reduce(function(s,r){return s+getAmt(r);},0);
  var eT=allExp.reduce(function(s,e){return s+Number(e.amt||0);},0);
  var net=iT-eT;

  // ── PERIOD HELPERS ──────────────────────
  // Group transactions by month for rolling calcs
  function monthKey(d){var p=parseDate(d);if(!p)return null;return p.getFullYear()+'-'+(p.getMonth()+1);}
  var incByMonth={},expByMonth={};
  allInc.forEach(function(r){var k=monthKey(r.date||'');if(!k)return;if(!incByMonth[k])incByMonth[k]=0;incByMonth[k]+=getAmt(r);});
  allExp.forEach(function(e){var k=monthKey(e.date||'');if(!k)return;if(!expByMonth[k])expByMonth[k]=0;expByMonth[k]+=Number(e.amt||0);});
  var incMonths=Object.keys(incByMonth).sort();
  var expMonths=Object.keys(expByMonth).sort();

  // Rolling 3-month averages
  function rolling3(byMonth,months){
    if(months.length<1)return 0;
    var last3=months.slice(-3);
    return last3.reduce(function(s,k){return s+byMonth[k];},0)/last3.length;
  }
  var rollInc=rolling3(incByMonth,incMonths);
  var rollExp=rolling3(expByMonth,expMonths);

  // MoM trend — last 2 months
  function momTrend(byMonth,months){
    if(months.length<2)return null;
    var cur=byMonth[months[months.length-1]],prev=byMonth[months[months.length-2]];
    if(!prev)return null;
    return Math.round(((cur-prev)/prev)*100);
  }
  var incMoM=momTrend(incByMonth,incMonths);
  var expMoM=momTrend(expByMonth,expMonths);

  // This month vs rolling avg
  var thisMonthInc=incMonths.length?incByMonth[incMonths[incMonths.length-1]]:0;
  var incVsRoll=rollInc>0?Math.round(((thisMonthInc-rollInc)/rollInc)*100):null;

  // ── BALANCE SHEET CALCS ─────────────────
  // Manual BS assets — exclude cash/bank entries to avoid double-counting with getCashOnHand
  var totalAssets=bs.assets.reduce(function(s,a){
    var n=(a.name||'').toLowerCase();
    return(n.includes('cash')||n.includes('bank')||n.includes('checking'))?s:s+Number(a.amt||0);
  },0);
  // Auto-computed assets: cash from recon (authoritative), AR from open invoices
  totalAssets+=getCashOnHand(c);
  totalAssets+=(c.invoices||[]).filter(function(i){return i.status!=='Paid';}).reduce(function(s,i){return s+Number(i.amt||0);},0);
  var totalLiab=bs.liabilities.reduce(function(s,l){return s+Number(l.amt||0);},0);
  // Auto-computed liabilities: AP from open bills
  totalLiab+=(c.bills||[]).filter(function(b){return b.status!=='Paid';}).reduce(function(s,b){return s+Number(b.amt||0);},0);
  var totalEquity=bs.equity.reduce(function(s,e){return s+Number(e.amt||0);},0);
  var currentRatio=totalLiab>0?(totalAssets/totalLiab):null;
  var debtToEquity=totalEquity>0?(totalLiab/totalEquity):null;

  // ── LOAN / INTEREST ─────────────────────
  var totalDebt=loans.reduce(function(s,l){return s+Number(l.principal||0);},0);
  var intExp=allExp.filter(function(e){return(e.cat||'').toLowerCase().includes('interest');}).reduce(function(s,e){return s+Number(e.amt||0);},0);
  var ebit=net+intExp;
  var interestCoverage=intExp>0?(ebit/intExp):null;

  // ── BURN RATE & RUNWAY ──────────────────
  var burnRate=rollExp||eT/Math.max(expMonths.length,1);
  var cashOnHand=getCashOnHand(c);
  var runway=burnRate>0?Math.round(cashOnHand/burnRate):null;

  // ── FIXED VS VARIABLE (SB) ──────────────
  var fixedExp=allExp.filter(function(e){return e.fixed==='Fixed';}).reduce(function(s,e){return s+Number(e.amt||0);},0);
  var varExp=allExp.filter(function(e){return e.fixed==='Variable';}).reduce(function(s,e){return s+Number(e.amt||0);},0);
  var fixedRatio=eT>0?Math.round((fixedExp/eT)*100):null;

  // ── REVENUE CONCENTRATION ───────────────
  var incByCat={};
  allInc.forEach(function(r){var k=r.cat||r.name||'Other';if(!incByCat[k])incByCat[k]=0;incByCat[k]+=getAmt(r);});
  var sortedCats=Object.keys(incByCat).sort(function(a,b){return incByCat[b]-incByCat[a];});
  var top3=sortedCats.slice(0,3).reduce(function(s,k){return s+incByCat[k];},0);
  var concRatio=iT>0?Math.round((top3/iT)*100):null;

  // ── BUDGET VARIANCE ─────────────────────
  var budgetedInc=budItems.filter(function(b){return b.type==='Income';}).reduce(function(s,b){return s+Number(b.amt||0);},0);
  var budgetedExp=budItems.filter(function(b){return b.type==='Expense';}).reduce(function(s,b){return s+Number(b.amt||0);},0);
  var incVar=budgetedInc>0?Math.round(((iT-budgetedInc)/budgetedInc)*100):null;
  var expVar=budgetedExp>0?Math.round(((eT-budgetedExp)/budgetedExp)*100):null;

  // ── GRANT COVERAGE (NP) ─────────────────
  // Grant coverage: expenses tagged to grants as % of total expenses
  // This answers: 'what share of our spending is grant-funded?'
  // Also include income entries categorized as grants (received amount)
  var grantExpSpend=allExp.filter(function(e){return e.grantId;}).reduce(function(s,e){return s+Number(e.amt||0);},0);
  var grantIncRecv=(c.income||[]).filter(function(r){var cat=(r.cat||'').toLowerCase();return cat.includes('grant');}).reduce(function(s,r){return s+Number(r.recv||0);},0);
  var grantTotal=Math.max(grantExpSpend,grantIncRecv);
  var grantCoverage=eT>0?Math.round((grantTotal/eT)*100):null;

  // ── ADMIN / PROGRAM RATIOS (NP) ─────────
  var adminExp=allExp.filter(function(e){var cat=(e.cat||'').toLowerCase();return cat.includes('admin')||cat.includes('operations')||cat.includes('overhead')||cat.includes('management');}).reduce(function(s,e){return s+Number(e.amt||0);},0);
  var programExp=allExp.filter(function(e){var cat=(e.cat||'').toLowerCase();return cat.includes('program')||cat.includes('service')||cat.includes('mission');}).reduce(function(s,e){return s+Number(e.amt||0);},0);
  var adminRatio=eT>0?Math.round((adminExp/eT)*100):null;
  var programRatio=eT>0?Math.round((programExp/eT)*100):null;

  // ── RECEIVABLES / PAYABLES ──────────────
  var openInv=invoices.filter(function(i){return i.status!=='Paid';}).reduce(function(s,i){return s+Number(i.amt||0);},0);
  var openBills=bills.filter(function(b){return b.status!=='Paid';}).reduce(function(s,b){return s+Number(b.amt||0);},0);

  // ── EXPENSE CREEP ───────────────────────
  var expCreep=null;
  if(expMonths.length>=4){
    var first2avg=(expByMonth[expMonths[0]]+(expByMonth[expMonths[1]]||0))/2;
    var last2avg=(expByMonth[expMonths[expMonths.length-1]]+(expByMonth[expMonths[expMonths.length-2]]||0))/2;
    expCreep=first2avg>0?Math.round(((last2avg-first2avg)/first2avg)*100):null;
  }

  // ── BREAKEVEN ───────────────────────────
  var breakeven=null;
  if(c.type==='sb'&&iT>0){
    var contribMargin=(iT-varExp)/iT;
    breakeven=contribMargin>0?Math.round(fixedExp/contribMargin):null;
  }

  // ── NET MARGIN ──────────────────────────
  var netMargin=iT>0?Math.round((net/iT)*100):null;

  // ── RECONCILIATION HEALTH ───────────────
  var totalTx=(allInc.length||0)+(allExp.length||0);
  var reconTx=allExp.filter(function(e){return e.reconciled;}).length+allInc.filter(function(r){return r.reconciled;}).length;
  // If there are transactions but none reconciled, that IS a score: 0%.
  // Only null if there are literally no transactions yet.
  var reconPct=totalTx>0?Math.round((reconTx/totalTx)*100):null;
  // Has ANY bank account ever been reconciled?
  var hasBankRecon=(c.reconciliations&&c.reconciliations.length>0)||reconTx>0;
  // Has a budget been set?
  var hasBudget=(c.budgetItems&&c.budgetItems.length>0);

  // ── CLARITY SCORE ───────────────────────
  // Philosophy: only score what we can actually measure.
  // Each dimension tracks real data points vs null.
  // If a dimension has zero real data it is excluded from the overall
  // and shown as "—" in the UI. No more 50-padding masking empty books.
  function clampScore(val,low,high,invert){
    if(val===null||val===undefined)return null;
    var pct=(val-low)/(high-low);
    pct=Math.max(0,Math.min(1,pct));
    return Math.round((invert?1-pct:pct)*100);
  }
  // weightedAvg: takes array of {val, weight} — skips nulls, re-weights remaining
  function weightedAvg(items){
    var sum=0,w=0;
    items.forEach(function(it){if(it.val!==null&&it.val!==undefined){sum+=it.val*it.weight;w+=it.weight;}});
    return w>0?Math.round(sum/w):null;
  }

  var scores={};
  var scoreDataCount={}; // how many real signals back each dimension

  // SURVIVAL — runway (0.5), current ratio (0.3), income/burn coverage (0.2)
  // No bank recon = runway unknown = penalise survival (can't manage what you can't see)
  var sv_runway   = runway!==null          ? clampScore(runway,0,18,false)
                  : (!hasBankRecon&&totalTx>0) ? 0   // has transactions but no recon = unknown = risk
                  : null;
  var sv_ratio    = currentRatio!==null    ? clampScore(currentRatio,0,2,false)         : null;
  var sv_coverage = (burnRate>0&&iT>0)     ? clampScore(iT/burnRate,0,2,false)          : null;
  scoreDataCount.survival=[sv_runway,sv_ratio,sv_coverage].filter(function(v){return v!==null;}).length;
  scores.survival=weightedAvg([{val:sv_runway,weight:.5},{val:sv_ratio,weight:.3},{val:sv_coverage,weight:.2}]);

  // PERFORMANCE — net margin (0.4), income vs budget (0.3), MoM trend (0.3)
  var pf_margin   = netMargin!==null       ? clampScore(netMargin,-20,20,false)         : null;
  // No budget = budget variance unknown. Penalise lightly — operating without a budget is a risk signal.
  var pf_incvar   = incVar!==null          ? clampScore(incVar,-30,10,false)
                  : (hasBudget===false&&totalTx>0) ? 20  // transactions but no budget = low score
                  : null;
  var pf_mom      = incMoM!==null          ? clampScore(incMoM,-10,10,false)            : null;
  scoreDataCount.performance=[pf_margin,pf_incvar,pf_mom].filter(function(v){return v!==null;}).length;
  scores.performance=weightedAvg([{val:pf_margin,weight:.4},{val:pf_incvar,weight:.3},{val:pf_mom,weight:.3}]);

  // STABILITY — concentration (0.4), fixed cost ratio (0.3), expense creep (0.3)
  var st_conc     = concRatio!==null       ? clampScore(concRatio,80,30,true)           : null;
  var st_fixed    = fixedRatio!==null      ? clampScore(fixedRatio,80,40,true)          : null;
  var st_creep    = expCreep!==null        ? clampScore(expCreep,30,0,true)             : null;
  scoreDataCount.stability=[st_conc,st_fixed,st_creep].filter(function(v){return v!==null;}).length;
  scores.stability=weightedAvg([{val:st_conc,weight:.4},{val:st_fixed,weight:.3},{val:st_creep,weight:.3}]);

  // EFFICIENCY — reconciliation (0.45), admin ratio (0.35), expense vs budget (0.2)
  // Recon: if transactions exist but nothing reconciled, that scores 0 — not null.
  // No recon at all on an active client is a real efficiency failure.
  var ef_recon    = reconPct!==null        ? clampScore(reconPct,0,100,false)           // 0% recon = score 0, 100% = score 100
                  : (totalTx>0)            ? 0   // transactions but reconPct couldn't calc = treat as 0
                  : null;
  var ef_admin    = adminRatio!==null      ? clampScore(adminRatio,35,10,true)          : null;
  // No budget = penalise expense variance too
  var ef_expvar   = expVar!==null          ? clampScore(expVar,30,0,true)
                  : (hasBudget===false&&totalTx>0) ? 20
                  : null;
  scoreDataCount.efficiency=[ef_recon,ef_admin,ef_expvar].filter(function(v){return v!==null;}).length;
  // Recon gets higher weight (0.45) since it's the most actionable hygiene signal
  scores.efficiency=weightedAvg([{val:ef_recon,weight:.45},{val:ef_admin,weight:.35},{val:ef_expvar,weight:.2}]);

  // RESILIENCE — grant balance (0.4), interest coverage (0.3), debt/equity (0.3)
  var rs_grant    = grantCoverage!==null   ? (function(){var d=Math.abs(grantCoverage-50);return Math.max(0,100-d*2);}()) : null;
  var rs_interest = interestCoverage!==null? clampScore(interestCoverage,1,4,false)     : null;
  var rs_dte      = debtToEquity!==null    ? clampScore(debtToEquity,3,0.5,true)        : null;
  scoreDataCount.resilience=[rs_grant,rs_interest,rs_dte].filter(function(v){return v!==null;}).length;
  scores.resilience=weightedAvg([{val:rs_grant,weight:.4},{val:rs_interest,weight:.3},{val:rs_dte,weight:.3}]);

  // OVERALL — only include dimensions with at least 1 real data point
  // Weights are re-normalised so missing dimensions don't drag the score toward 50
  var dimWeights={survival:.30,performance:.25,stability:.20,efficiency:.15,resilience:.10};
  var overallSum=0,overallW=0;
  Object.keys(dimWeights).forEach(function(k){
    if(scores[k]!==null&&scoreDataCount[k]>0){overallSum+=scores[k]*dimWeights[k];overallW+=dimWeights[k];}
  });
  var clarityScore=overallW>0?Math.round(overallSum/overallW):null;
  if(clarityScore!==null)clarityScore=Math.max(0,Math.min(100,clarityScore));

  function _dimDataHint(dim,type){
    if(dim==='survival')return'No bank reconciliation found. Without a reconciled cash balance, runway cannot be calculated — this scores as a risk, not a skip. Reconcile a bank account to improve this score.';
    if(dim==='performance')return type==='np'?'Add income entries to calculate net surplus margin. No budget means variance cannot be measured — operating without a budget is scored as a risk signal.':'Add revenue entries to calculate net margin. No budget means variance cannot be measured — this is scored as a risk signal, not skipped.';
    if(dim==='stability')return'Needs multiple months of dated transactions (for expense creep) and income spread across categories (for concentration ratio). Add dates to all entries.';
    if(dim==='efficiency')return'No transactions or none reconciled. Unreconciled books score 0 on reconciliation — this is the most actionable item to fix.';
    if(dim==='resilience')return'No loan or grant data found. For nonprofits, grant concentration is scored here. For all orgs, loans trigger debt coverage analysis. Neither = not applicable.';
    return'Add more data to score this dimension.';
  }
  function scoreColor(s){if(s===null)return'var(--muted)';return s>=70?'var(--green)':s>=45?'var(--amber)':'var(--red)';}
  function scoreBg(s){if(s===null)return'var(--soft)';return s>=70?'rgba(34,197,94,.08)':s>=45?'rgba(245,158,11,.08)':'rgba(239,68,68,.08)';}
  function scoreLabel(s){if(s===null)return'Insufficient data';return s>=70?'Healthy':s>=45?'Watch':'Risk';}
  function trendArrow(v){if(v===null)return'';return v>0?'<span style="color:var(--green)">▲ '+v+'%</span>':'<span style="color:var(--red)">▼ '+Math.abs(v)+'%</span>';}
  function pill(label,val,good,warn,note){
    var col=good?'var(--green)':warn?'var(--amber)':'var(--red)';
    var bg=good?'rgba(34,197,94,.08)':warn?'rgba(245,158,11,.08)':'rgba(239,68,68,.08)';
    return'<div style="background:'+bg+';border:1px solid '+col+';border-radius:10px;padding:.6rem .9rem;margin-bottom:.5rem">'
    +'<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-weight:600;font-size:13px">'+label+'</span><span style="font-size:16px;font-weight:700;color:'+col+'">'+val+'</span></div>'
    +'<div style="font-size:11px;color:var(--muted);margin-top:3px;line-height:1.5">'+note+'</div></div>';
  }

  // ── SECTION: CLARITY SCORE ──────────────
  var scoreColor2=scoreColor(clarityScore);
  // How many total real signals do we have?
  var totalSignals=Object.keys(scoreDataCount).reduce(function(s,k){return s+scoreDataCount[k];},0);
  var hasEnoughData=totalSignals>=3;
  // ── SCORE NARRATIVE ─────────────────────
  function scoreDimNarrative(dim,val,c){
    var t=c.type;
    if(dim==='survival'){
      if(val>=70)return'Cash position and coverage look solid. '+(runway!==null?'Runway is '+runway+' months at current burn.':'Add reconciled bank balances to calculate runway.');
      if(val>=45)return'Survivability is moderate. '+(runway!==null&&runway<12?'Runway of '+runway+' months warrants attention — target 18+.':'Monitor burn rate closely.');
      return'Survival indicators are in the danger zone. '+(runway!==null&&runway<6?'Only '+runway+' months of runway — immediate attention required.':'Prioritize cash visibility and reduce burn.');
    }
    if(dim==='performance'){
      if(val>=70)return'Revenue momentum is positive and margins are tracking well against plan.';
      if(val>=45)return'Performance is mixed. '+(netMargin!==null&&netMargin<5?'Net margin of '+netMargin+'% leaves limited cushion.':'Trending in the right direction but watch closely.');
      return'Performance needs attention. '+(netMargin!==null&&netMargin<0?'Operating at a deficit ('+netMargin+'% margin).':'Income vs budget gap is widening.');
    }
    if(dim==='stability'){
      if(val>=70)return'Income is well-diversified and expense growth is controlled.';
      if(val>=45)return'Stability is moderate. '+(concRatio!==null&&concRatio>60?'Top 3 income sources represent '+concRatio+'% — consider diversifying.':'Watch expense creep over time.');
      return'Stability is a concern. '+(concRatio!==null&&concRatio>80?'Over '+concRatio+'% of income from top 3 sources — high concentration risk.':'Expense structure may be too rigid for revenue fluctuations.');
    }
    if(dim==='efficiency'){
      if(val>=70)return t==='np'?'Admin ratio and program spend are well within funder expectations.':'Spending efficiency and reconciliation are strong.';
      if(val>=45)return t==='np'?'Efficiency is acceptable but admin ratio may draw scrutiny from some funders.':'Budget variance or reconciliation gaps are pulling this score down.';
      return t==='np'?'Efficiency metrics may raise questions with funders. Review admin cost allocation.':'Reconciliation is below 90% or budget variance is significant.';
    }
    if(dim==='resilience'){
      if(val>=70)return'Debt structure is manageable and income diversity provides a buffer against shocks.';
      if(val>=45)return'Some resilience risk. '+(interestCoverage!==null&&interestCoverage<2?'Interest coverage of '+interestCoverage.toFixed(1)+'x is below the 2x safety threshold.':'Moderate dependency on a single income type.');
      return'Resilience is low. '+(debtToEquity!==null&&debtToEquity>3?'Debt-to-equity of '+debtToEquity.toFixed(1)+'x signals leverage risk.':'Structural fragility if a key income source changes.');
    }
    return '';
  }

  // Overall narrative
  var topWeak=[];var topStrong=[];
  var dimList=[{k:'survival',l:'Survival',v:scores.survival,w:'30%'},{k:'performance',l:'Performance',v:scores.performance,w:'25%'},{k:'stability',l:'Stability',v:scores.stability,w:'20%'},{k:'efficiency',l:'Efficiency',v:scores.efficiency,w:'15%'},{k:'resilience',l:'Resilience',v:scores.resilience,w:'10%'}];
  dimList.forEach(function(d){if(d.v<45)topWeak.push(d.l);else if(d.v>=70)topStrong.push(d.l);});
  var overallNarrative='';
  if(clarityScore>=70){overallNarrative='Overall financial health is <strong>strong</strong>.'+(topWeak.length?' Keep an eye on '+topWeak.join(' and ')+'.':'  All five dimensions are tracking well.');}
  else if(clarityScore>=45){overallNarrative='Overall health is <strong>stable but needs monitoring</strong>.'+(topWeak.length?' The biggest gaps are in <strong>'+topWeak.join('</strong> and <strong>')+'</strong>.':'')+(topStrong.length?' Strengths: '+topStrong.join(', ')+'.'  :'');}
  else{overallNarrative='Several financial dimensions need attention. '+(topWeak.length?'<strong>'+topWeak.join('</strong> and <strong>')+'</strong> are in the risk zone — address these first.':'Review the indicators below carefully.');}

  var scoreHTML='<div style="margin-bottom:1.5rem">'  // Top: score + overall bar + narrative
  +'<div style="display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap;margin-bottom:1.25rem">'  +'<div style="text-align:center;flex-shrink:0">'  +'<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Clarity Score</div>'  +(clarityScore!==null    ?'<div style="font-size:64px;font-weight:700;color:'+scoreColor2+';line-height:1">'+clarityScore+'</div>'     +'<div style="font-size:12px;font-weight:600;color:var(--muted);margin-top:2px">'+scoreLabel(clarityScore)+'</div>'    :'<div style="font-size:32px;font-weight:700;color:var(--muted);line-height:1">—</div>'     +'<div style="font-size:11px;color:var(--muted);margin-top:4px">Not enough data</div>')  +'</div>'  +'<div style="flex:1;min-width:200px">'  +(clarityScore!==null    ?'<div style="width:100%;height:10px;background:var(--soft);border-radius:99px;overflow:hidden;margin-bottom:1rem">'     +'<div style="height:100%;width:'+clarityScore+'%;background:'+scoreColor2+';border-radius:99px;transition:width .6s ease"></div>'     +'</div>'    :'')  +'<div style="font-size:13px;line-height:1.6;color:var(--text)">'  +(clarityScore!==null?overallNarrative:'Add income, expenses, a reconciled bank account, and a budget to start generating your Clarity Score. Each dimension only scores when real data is available — no guessing.')  +'</div>'  +'</div>'  +'</div>'  // Dimension bars with narrative
  +'<div style="display:flex;flex-direction:column;gap:.75rem">'  +dimList.map(function(d){    var col=scoreColor(d.v);    var narr=d.v!==null?scoreDimNarrative(d.k,d.v,c):'';    var dataCount=scoreDataCount[d.k]||0;    var noData=d.v===null||dataCount===0;    return'<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:.75rem 1rem'+(noData?';opacity:.6':'')+'">'     +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem">'    +'<div style="display:flex;align-items:center;gap:.5rem">'    +'<span style="font-size:13px;font-weight:600">'+d.l+'</span>'    +'<span style="font-size:10px;color:var(--muted)">'+d.w+' of score</span>'    +'</div>'    +'<span style="font-size:16px;font-weight:700;color:'+col+'">'+(!noData?d.v:'—')+'</span>'    +'</div>'    +'<div style="width:100%;height:7px;background:var(--soft);border-radius:99px;overflow:hidden;margin-bottom:.4rem">'    +'<div style="height:100%;width:'+(!noData?d.v:0)+'%;background:'+col+';border-radius:99px;transition:width .8s ease"></div>'    +'</div>'    +(noData      ?'<div style="font-size:11px;color:var(--muted);font-style:italic">'+_dimDataHint(d.k,c.type)+'</div>'      :(narr?'<div style="font-size:11px;color:var(--muted);line-height:1.5">'+narr+'</div>':''));  }).join('</div>')  +'</div>'  // Disclaimer
  +'<div style="margin-top:1rem;padding:.6rem .9rem;background:var(--amber-bg);border-radius:8px;font-size:10px;color:var(--amber);line-height:1.6">'  +'<strong>Note:</strong> This score is based solely on the data entered in this system. It is an internal management tool — not an audit, compilation, or professional opinion. Consult a licensed CPA before making significant financial decisions.'  +'</div></div>';

  // ── SECTION 1: HEALTH INDICATORS ────────
  var h1='<div style="margin-bottom:1.25rem"><div class="rpt-ttl" style="margin-bottom:.75rem">Health Indicators</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.5rem">';
  // Burn rate & runway
  if(burnRate>0){
    var rGood=runway===null?false:runway>=18,rWarn=runway===null?true:runway>=12&&runway<18;
    var runwayNote=(runway!==null&&runway>0)?'Runway: '+runway+' months of cash at current burn rate. ':'Add bank statement balances in the Reconciliation tab to calculate runway. ';h1+=pill('Burn Rate / Runway',fmt(Math.round(burnRate))+'/mo'+(runway!==null&&runway>0?' · '+runway+' mo runway':runway===0?' · Reconcile a bank account to calculate':''),rGood,rWarn,runwayNote+'Healthy: 18+ months. 12–17 months = watch. Under 6 months = danger.');
  }
  // Net margin
  if(netMargin!==null){
    h1+=pill('Net '+(c.type==='np'?'Surplus':'Profit')+' Margin',netMargin+'%',netMargin>=10,netMargin>=0&&netMargin<10,'What you keep after all expenses. '+(c.type==='np'?'NPs should target a 3–7% surplus to build reserves. A deficit is a warning; a very large surplus may concern funders.':'Target 10–20% for healthy operations. Below 5% leaves little cushion.'));
  }
  // Budget variance
  if(incVar!==null){h1+=pill('Income vs Budget',incVar+'%',incVar>=0,incVar>=-10,'Actual income vs budgeted income. Positive = ahead of plan (good). Negative = behind plan. A gap over 10% warrants investigation.');}
  if(expVar!==null){h1+=pill('Expenses vs Budget',expVar+'%',expVar<=5,expVar<=15,'How actual spending compares to budgeted. Negative = under budget (good if intentional, concerning if programs are not running). Positive = over budget.');}
  // Current ratio
  if(currentRatio!==null){h1+=pill('Current Ratio',currentRatio.toFixed(1)+'x',currentRatio>=1.5,currentRatio>=1,'Short-term assets vs short-term liabilities. Above 2x = strong. Below 1x = you owe more than you can quickly pay. NPs should also target 3–6 months of operating expenses in unrestricted reserves.');}
  // Grant coverage (NP)
  if(c.type==='np'&&grantCoverage!==null){var gcGood=grantCoverage>=30&&grantCoverage<=70,gcWarn=(grantCoverage>=15&&grantCoverage<30)||(grantCoverage>70&&grantCoverage<=80);h1+=pill('Grant Coverage',grantCoverage+'%',gcGood,gcWarn,'Grant funding as % of total expenses. Healthy range: 30–70%. Below 30% with no other stable income = risk. Above 80% = dangerous over-reliance on grants — one lost grant could be catastrophic. Diversify.');}
  // Reconciliation
  if(reconPct!==null){h1+=pill('Reconciliation',reconPct+'%',reconPct>=90,reconPct>=70,'How many of your transactions have been reconciled. Below 90% means your books may not reflect reality.');}
  // Interest coverage
  if(interestCoverage!==null){h1+=pill('Interest Coverage',interestCoverage.toFixed(1)+'x',interestCoverage>=3,interestCoverage>=2,'Can you afford your debt payments? Below 2x is a danger zone. Above 3x = comfortable.');}
  h1+='</div></div>';

  // ── SECTION 2: ROLLING AVERAGES & TRENDS ─
  var h2='<div style="margin-bottom:1.25rem"><div class="rpt-ttl" style="margin-bottom:.75rem">Trends &amp; Rolling Averages</div>';
  if(incMonths.length>=2||expMonths.length>=2){
    h2+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.5rem;margin-bottom:.75rem">';
    h2+='<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">3-Month Rolling '+(c.type==='np'?'Income':'Revenue')+' Avg</div><div style="font-weight:700;font-size:18px">'+fmt(Math.round(rollInc))+'</div>'+(incVsRoll!==null?'<div style="font-size:11px;margin-top:2px">This month: '+trendArrow(incVsRoll)+' vs average</div>':'')+'<div style="font-size:10px;color:var(--muted);margin-top:4px">Smooths spikes. This is your true earning baseline — one good month doesn\'t mean growth.</div></div>';
    h2+='<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">3-Month Rolling Expense Avg</div><div style="font-weight:700;font-size:18px">'+fmt(Math.round(rollExp))+'</div>'+(expMoM!==null?'<div style="font-size:11px;margin-top:2px">MoM: '+trendArrow(expMoM)+'</div>':'')+'<div style="font-size:10px;color:var(--muted);margin-top:4px">Your real monthly cost baseline. Rising faster than income? Worth investigating.</div></div>';
    if(incMoM!==null)h2+='<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">'+(c.type==='np'?'Income':'Revenue')+' Momentum</div><div style="font-weight:700;font-size:18px;color:'+(incMoM>=0?'var(--green)':'var(--red)')+'">'+trendArrow(incMoM)+' MoM</div><div style="font-size:10px;color:var(--muted);margin-top:4px">Direction matters more than totals. Declining momentum is an early warning signal.</div></div>';
    if(expCreep!==null)h2+='<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Expense Creep</div><div style="font-weight:700;font-size:18px;color:'+(expCreep>10?'var(--red)':expCreep>0?'var(--amber)':'var(--green)')+'">'+expCreep+'% growth</div><div style="font-size:10px;color:var(--muted);margin-top:4px">Are costs growing quietly? Expense creep is a silent margin killer — catch it early.</div></div>';
    h2+='</div>';
  }else{h2+='<div style="font-size:12px;color:var(--muted)">Add dated transactions across multiple months to see trends and rolling averages.</div>';}
  h2+='</div>';

  // ── SECTION 3: P&L SUMMARY ───────────────
  var eC2={};allExp.forEach(function(e){var k=e.cat||'Other';if(!eC2[k])eC2[k]=0;eC2[k]+=Number(e.amt||0);});
  var topExpCats2=Object.keys(eC2).sort(function(a,b){return eC2[b]-eC2[a];}).slice(0,3);
  var h3='<div style="margin-bottom:1.25rem"><div class="rpt-ttl" style="margin-bottom:.75rem">P&amp;L Summary</div>'
  +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.75rem">'
  +'<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">'+(c.type==='np'?'Total Income':'Revenue')+'</div><div style="font-weight:700;font-size:20px;color:var(--green)">'+fmt(iT)+'</div>'+(budgetedInc?'<div style="font-size:11px;color:var(--muted)">Budgeted: '+fmt(budgetedInc)+'</div>':'')+'</div>'
  +'<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Total Expenses</div><div style="font-weight:700;font-size:20px;color:var(--red)">'+fmt(eT)+'</div>'+(budgetedExp?'<div style="font-size:11px;color:var(--muted)">Budgeted: '+fmt(budgetedExp)+'</div>':'')+'</div>'
  +'</div>'
  +'<div class="rpt-total" style="margin-bottom:.75rem"><span>'+(c.type==='np'?'Net Surplus':'Net Income')+'</span><span class="'+(net>=0?'vg':'vr')+'">'+fmt(net)+(netMargin!==null?' ('+netMargin+'%)':'')+'</span></div>'
  +(topExpCats2.length?'<div style="font-size:12px;color:var(--muted);margin-bottom:.25rem">Top expense categories:</div>'
  +topExpCats2.map(function(k){return'<div class="rpt-row"><span>'+k+'</span><span class="vr">'+fmt(eC2[k])+'</span></div>';}).join(''):'')+'</div>';

  // ── SECTION 4: WHERE DID MY PROFIT GO ───
  var cashChange=net-openInv+openBills;
  var h4='<div style="margin-bottom:1.25rem"><div class="rpt-ttl" style="margin-bottom:.5rem">Where Did My '+(c.type==='np'?'Surplus':'Profit')+' Go?</div>'
  +'<div style="font-size:11px;color:var(--muted);margin-bottom:.75rem">The bridge between your P&amp;L and your actual cash position. Profit and cash don\'t always move together.</div>'
  +'<div class="card" style="margin:0;padding:.75rem">'
  +'<div class="rpt-row"><span style="font-weight:500">'+(c.type==='np'?'Net Surplus':'Net Income')+'</span><span class="'+(net>=0?'vg':'vr')+'">'+fmt(net)+'</span></div>'
  +(openInv>0?'<div class="rpt-row"><span style="color:var(--muted)">− Uncollected (open invoices)</span><span class="vr">−'+fmt(openInv)+'</span></div>':'')
  +(openBills>0?'<div class="rpt-row"><span style="color:var(--muted)">+ Unpaid bills (cash still held)</span><span class="vg">+'+fmt(openBills)+'</span></div>':'')
  +(c.type==='np'&&grantTotal>0&&iT>0?'<div class="rpt-row"><span style="color:var(--muted)">⚠ Grant funds may be restricted</span><span style="color:var(--amber)">'+fmt(grantTotal)+' awarded</span></div>':'')
  +'<div class="rpt-total" style="margin-top:.5rem"><span>Estimated Cash Position</span><span class="'+(cashChange>=0?'vg':'vr')+'">'+fmt(cashChange)+'</span></div>'
  +(openInv>0||openBills>0?'<div style="font-size:10px;color:var(--muted);margin-top:.5rem">'+(openInv>0?'You\'ve earned '+fmt(openInv)+' that hasn\'t been collected yet. ':'')+( openBills>0?'You owe '+fmt(openBills)+' in unpaid bills — that cash is still on hand but spoken for.':'')+'</div>':'')+'</div></div>';

  // ── SECTION 5: EFFICIENCY RATIOS ────────
  var h5='<div style="margin-bottom:1.25rem"><div class="rpt-ttl" style="margin-bottom:.75rem">Efficiency Ratios</div>'
  +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.5rem">';
  if(iT>0&&eT>0)h5+='<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Revenue per $ Spent</div><div style="font-weight:700;font-size:18px;color:'+(iT/eT>=1?'var(--green)':'var(--red)')+'">$'+((iT/eT)).toFixed(2)+'</div><div style="font-size:10px;color:var(--muted);margin-top:4px">For every dollar you spend, how much comes in. Above $1.00 = sustainable.</div></div>';
  if(c.type==='np'){
    if(adminRatio!==null)h5+='<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Admin Cost Ratio</div><div style="font-weight:700;font-size:18px;color:'+(adminRatio<=10?'var(--green)':adminRatio<=15?'var(--amber)':'var(--red)')+'">'+adminRatio+'%</div><div style="font-size:10px;color:var(--muted);margin-top:4px">Admin/overhead as % of total expenses. Best-in-class is under 10%. Most major funders and Charity Navigator target under 15%. Above 20% will raise funder questions.</div></div>';
    if(programRatio!==null&&programRatio>0)h5+='<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Program Efficiency</div><div style="font-weight:700;font-size:18px;color:'+(programRatio>=75?'var(--green)':programRatio>=65?'var(--amber)':'var(--red)')+'">'+programRatio+'%</div><div style="font-size:10px;color:var(--muted);margin-top:4px">Program spend as % of total expenses. Charity Navigator top marks at 75%+. Most serious funders want to see at least 75% going to mission. Below 65% is a red flag.</div></div>';
  }
  if(c.type==='sb'&&fixedRatio!==null)h5+='<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Fixed Cost Ratio</div><div style="font-weight:700;font-size:18px;color:'+(fixedRatio<=60?'var(--green)':fixedRatio<=75?'var(--amber)':'var(--red)')+'">'+fixedRatio+'%</div><div style="font-size:10px;color:var(--muted);margin-top:4px">How much of your expenses are locked in regardless of revenue. High fixed costs = fragile during slow periods.</div></div>';
  if(concRatio!==null)h5+='<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Income Concentration</div><div style="font-weight:700;font-size:18px;color:'+(concRatio<=50?'var(--green)':concRatio<=70?'var(--amber)':'var(--red)')+'">'+concRatio+'%</div><div style="font-size:10px;color:var(--muted);margin-top:4px">% of income from your top 3 sources. Above 70% = risky — one lost source could be devastating.</div></div>';
  if(breakeven!==null)h5+='<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Breakeven Point</div><div style="font-weight:700;font-size:18px">'+fmt(breakeven)+'</div><div style="font-size:10px;color:var(--muted);margin-top:4px">Revenue needed just to cover all fixed costs. Below this = operating at a loss.</div></div>';
  h5+='</div></div>';

  // ── SECTION 6: BUDGET DEEP DIVE ──────────
  var h6='';
  if(budItems.length){
    var varLines=budItems.map(function(b){
      var act=b.type==='Income'?(allInc.reduce(function(s,r){return(r.cat===b.cat)?s+getAmt(r):s;},0)):(allExp.reduce(function(s,e){return(e.cat===b.cat)?s+Number(e.amt||0):s;},0));
      var v=b.type==='Income'?(act-Number(b.amt)):(Number(b.amt)-act);
      var vpct=Number(b.amt)>0?Math.round((Math.abs(v)/Number(b.amt))*100):0;
      return{cat:b.cat,type:b.type,budget:Number(b.amt),actual:act,variance:v,vpct:vpct};
    }).filter(function(l){return l.vpct>10;}).sort(function(a,b){return Math.abs(b.variance)-Math.abs(a.variance);});
    h6='<div style="margin-bottom:1.25rem"><div class="rpt-ttl" style="margin-bottom:.5rem">Budget Variance — Notable Items</div>'
    +'<div style="font-size:11px;color:var(--muted);margin-bottom:.75rem">Categories with 10%+ variance from budget. These are your biggest planning misses.</div>'
    +(varLines.length?varLines.slice(0,6).map(function(l){return'<div class="rpt-row"><span>'+l.cat+' <span style="font-size:10px;color:var(--muted)">('+l.type+')</span></span><span style="display:flex;gap:12px"><span style="color:var(--muted)">'+fmt(l.budget)+'</span><span class="'+(l.variance>=0?'vg':'vr')+'">'+(l.variance>=0?'+':'')+fmt(l.variance)+' ('+l.vpct+'%)</span></span></div>';}).join(''):'<div style="font-size:12px;color:var(--muted)">All categories within 10% of budget. Good forecasting.</div>')+'</div>';
  }

  // ── SECTION 7: PROJECTS ──────────────────
  var h7='';
  if(projects.length){
    var today2=new Date();
    h7='<div style="margin-bottom:1.25rem"><div class="rpt-ttl" style="margin-bottom:.75rem">Projects / Events</div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.5rem">';
    h7+=projects.map(function(pr){
      var pExp=allExp.filter(function(e){return e.projectId===pr.id;}).reduce(function(s,e){return s+Number(e.amt||0);},0);
      var pInc=allInc.filter(function(r){return r.projectId===pr.id;}).reduce(function(s,r){return s+getAmt(r);},0);
      var pBudget=Number(pr.budget||0);
      var burn=pBudget>0?Math.round((pExp/pBudget)*100):null;
      var linkedGrant=pr.grantId?grants.find(function(g){return g.id===pr.grantId;}):null;
      var multiYearFlag=pr.isMultiYear?'<span style="font-size:10px;color:var(--np);margin-left:4px">Multi-year</span>':'';
      // Period context for multi-year
      var periodCtx='';
      if(pr.isMultiYear&&(pr.periods||[]).length){
        var activePeriod=(pr.periods||[]).find(function(p){var s=p.start?new Date(p.start):null,e=p.end?new Date(p.end):null;return s&&e&&today2>=s&&today2<=e;});
        if(activePeriod){var fyS=getFiscalYear(c.fiscalYearEnd,new Date(activePeriod.start)).label,fyE=getFiscalYear(c.fiscalYearEnd,new Date(activePeriod.end)).label;periodCtx='<div style="font-size:10px;color:var(--muted)">Current period: '+activePeriod.label+(fyS!==fyE?' (spans '+fyS+'–'+fyE+')':' ('+fyS+')')+'</div>';}
      }
      return'<div class="card" style="margin:0;padding:.75rem"><div style="font-weight:600;font-size:13px">'+escHtml(pr.name)+multiYearFlag+'</div>'
      +(linkedGrant?'<div style="font-size:10px;color:var(--np);margin-top:2px">&#128196; '+linkedGrant.name+'</div>':'')
      +periodCtx
      +'<div style="display:flex;gap:12px;margin-top:.4rem"><span style="font-size:11px"><span style="color:var(--muted)">Spent:</span> <span class="vr">'+fmt(pExp)+'</span></span><span style="font-size:11px"><span style="color:var(--muted)">In:</span> <span class="vg">'+fmt(pInc)+'</span></span></div>'
      +(burn!==null?'<div style="margin-top:.4rem"><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted)"><span>Budget burn</span><span>'+burn+'%</span></div><div class="pbar" style="height:6px;margin-top:2px"><div class="pfill" style="width:'+Math.min(burn,100)+'%;background:'+(burn>90?'var(--red)':burn>70?'var(--amber)':'var(--green)')+'"></div></div></div>':'')+'</div>';
    }).join('');
    h7+='</div></div>';
  }

  // ── SECTION 8: GRANTS (NP) ───────────────
  var h8='';
  if(c.type==='np'&&grants.length){
    var today3=new Date();
    h8='<div style="margin-bottom:1.25rem"><div class="rpt-ttl" style="margin-bottom:.75rem">Grant Status</div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.5rem">';
    h8+=grants.map(function(gr){
      var spent=allExp.filter(function(e){return e.grantId===gr.id;}).reduce(function(s,e){return s+Number(e.amt||0);},0);
      var awarded=Number(gr.awarded||0);
      var remaining=awarded-spent;
      var burnPct=awarded>0?Math.round((spent/awarded)*100):0;
      var dl=gr.deadline?parseDate(gr.deadline):null;
      var daysLeft=dl?Math.round((dl-today3)/(1000*60*60*24)):null;
      var urgency=daysLeft!==null&&daysLeft<90&&remaining>0;
      return'<div class="card" style="margin:0;padding:.75rem;'+(urgency?'border-left:3px solid var(--amber)':'')+'">'
      +'<div style="font-weight:600;font-size:13px">'+escHtml(gr.name)+'</div>'
      +(gr.funder?'<div style="font-size:10px;color:var(--muted)">'+gr.funder+'</div>':'')
      +'<div style="display:flex;gap:12px;margin-top:.4rem"><span style="font-size:11px"><span style="color:var(--muted)">Awarded:</span> <span class="vg">'+fmt(awarded)+'</span></span><span style="font-size:11px"><span style="color:var(--muted)">Remaining:</span> <span class="'+(remaining>=0?'vg':'vr')+'">'+fmt(remaining)+'</span></span></div>'
      +(awarded>0?'<div style="margin-top:.4rem"><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted)"><span>Spent</span><span>'+burnPct+'%</span></div><div class="pbar" style="height:6px;margin-top:2px"><div class="pfill" style="width:'+Math.min(burnPct,100)+'%;background:'+(burnPct>90?'var(--red)':burnPct>70?'var(--amber)':'var(--green)')+'"></div></div></div>':'')
      +(urgency?'<div style="font-size:10px;color:var(--amber);margin-top:.4rem">⚠ '+daysLeft+' days left · '+fmt(remaining)+' unspent</div>':'')
      +(gr.restrict?'<div style="font-size:10px;color:var(--muted);margin-top:2px">Restricted: '+gr.restrict+'</div>':'')+'</div>';
    }).join('');
    h8+='</div>'
    +(grantCoverage!==null?'<div style="font-size:12px;color:var(--muted);margin-top:.75rem">Grant coverage ratio: <strong>'+grantCoverage+'%</strong> of total expenses covered by grants. '+(grantCoverage>=60?'Strong grant base.':grantCoverage>=30?'Moderate — consider diversifying income sources.':'Low grant coverage — significant exposure if funding changes.')+'</div>':'')+'</div>';
  }

  // ── CASH CONVERSION CYCLE ──────────────────
  var paidInvoices=invoices.filter(function(i){return i.paidDate&&i.date;});
  var paidBills2=bills.filter(function(b){return b.paidDate&&b.received;});
  var avgDaysToCollect=null,avgDaysToPay=null;
  if(paidInvoices.length){var ds=paidInvoices.map(function(i){var a=parseDate(i.date),b2=parseDate(i.paidDate);return a&&b2?Math.max(0,Math.round((b2-a)/(864e5))):null;}).filter(function(d){return d!==null;});if(ds.length)avgDaysToCollect=Math.round(ds.reduce(function(s,d){return s+d;},0)/ds.length);}
  if(paidBills2.length){var ds2=paidBills2.map(function(b3){var a=parseDate(b3.received),b4=parseDate(b3.paidDate);return a&&b4?Math.max(0,Math.round((b4-a)/(864e5))):null;}).filter(function(d){return d!==null;});if(ds2.length)avgDaysToPay=Math.round(ds2.reduce(function(s,d){return s+d;},0)/ds2.length);}

  // ── REPEAT RATE / RETENTION (NP) ────────
  var repeatRate=null,repeatDonors=0,totalDonorCount=0;
  if(c.type==='np'){
    totalDonorCount=(c.donors||[]).length;
    repeatDonors=(c.donors||[]).filter(function(d){return(d.donations||[]).length>=2;}).length;
    repeatRate=totalDonorCount>0?Math.round((repeatDonors/totalDonorCount)*100):null;
  }

  // ── STRESS TEST HTML (interactive) ──────
  window._stressBase={iT:iT,eT:eT,burnRate:burnRate,cashOnHand:cashOnHand,topSrcAmt:sortedCats.length?(incByCat[sortedCats[0]]||0):0,fmt:fmt};
  var stressHTML='<div style="margin-bottom:1.25rem"><div class="rpt-ttl" style="margin-bottom:.5rem">Stress Test — What If?</div>'  +'<div style="font-size:11px;color:var(--muted);margin-bottom:.75rem">Adjust the sliders to model financial scenarios. Pure math — no guessing.</div>'  +'<div class="card" style="margin:0;padding:.75rem">'  +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.75rem;margin-bottom:.75rem">'  +'<div><label style="font-size:11px;color:var(--muted);display:block;margin-bottom:3px">'+(c.type==='np'?'Income':'Revenue')+' change (%)</label><input type="range" id="st-inc" min="-50" max="50" value="0" step="5" style="width:100%" oninput="runStressTest()"><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted)"><span>-50%</span><span id="st-inc-val">0%</span><span>+50%</span></div></div>'  +'<div><label style="font-size:11px;color:var(--muted);display:block;margin-bottom:3px">Expense change (%)</label><input type="range" id="st-exp" min="-30" max="50" value="0" step="5" style="width:100%" oninput="runStressTest()"><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted)"><span>-30%</span><span id="st-exp-val">0%</span><span>+50%</span></div></div>'  +(iT>0?'<div><label style="font-size:11px;color:var(--muted);display:block;margin-bottom:3px">Lose top income source?</label><select id="st-topsrc" onchange="runStressTest()" style="width:100%;padding:5px;font-size:12px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text)"><option value="0">No</option><option value="1">Yes</option></select><div style="font-size:10px;color:var(--muted);margin-top:3px">'+(sortedCats.length?'Top: '+sortedCats[0]+' ('+fmt(incByCat[sortedCats[0]]||0)+')':'No sources yet')+'</div></div>':'')  +'</div>'  +'<div id="st-results" style="padding:.75rem;background:var(--bg);border-radius:8px"><div style="font-size:12px;color:var(--muted);text-align:center">Adjust sliders to run scenarios</div></div></div></div>';

  // ── CCC + REPEAT RATE HTML ───────────────
  var hCCC='';
  if(avgDaysToCollect!==null||avgDaysToPay!==null||repeatRate!==null){
    hCCC='<div style="margin-bottom:1.25rem"><div class="rpt-ttl" style="margin-bottom:.75rem">Cash Timing &amp; Retention</div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.5rem">';
    if(avgDaysToCollect!==null)hCCC+='<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Avg Days to Collect</div><div style="font-weight:700;font-size:22px;color:'+(avgDaysToCollect<=30?'var(--green)':avgDaysToCollect<=60?'var(--amber)':'var(--red)')+'">'+avgDaysToCollect+' days</div><div style="font-size:10px;color:var(--muted);margin-top:4px">How long between issuing an invoice and getting paid. Under 30 days = healthy. Over 60 days = cash flow risk.</div></div>';
    if(avgDaysToPay!==null)hCCC+='<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Avg Days to Pay Bills</div><div style="font-weight:700;font-size:22px;color:'+(avgDaysToPay<=45?'var(--green)':avgDaysToPay<=60?'var(--amber)':'var(--red)')+'">'+avgDaysToPay+' days</div><div style="font-size:10px;color:var(--muted);margin-top:4px">How long you take to pay vendors. Paying on time protects relationships. Too fast can strain your cash.</div></div>';
    if(avgDaysToCollect!==null&&avgDaysToPay!==null){var ccc=avgDaysToCollect-avgDaysToPay;hCCC+='<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Cash Conversion Gap</div><div style="font-weight:700;font-size:22px;color:'+(ccc<=0?'var(--green)':ccc<=30?'var(--amber)':'var(--red)')+'">'+ccc+' days</div><div style="font-size:10px;color:var(--muted);margin-top:4px">'+(ccc<=0?'You pay bills after you collect — positive cash timing.':'You pay bills before collecting. This gap is where "profitable but broke" lives.')+'</div></div>';}
    if(repeatRate!==null)hCCC+='<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Donor Retention Rate</div><div style="font-weight:700;font-size:22px;color:'+(repeatRate>=60?'var(--green)':repeatRate>=40?'var(--amber)':'var(--red)')+'">'+repeatRate+'%</div><div style="font-size:10px;color:var(--muted);margin-top:4px">'+repeatDonors+' of '+totalDonorCount+' donors gave more than once. Above 60% = strong loyalty. Retention is cheaper than acquisition.</div></div>';
    hCCC+='</div></div>';
  }

  // ── ASSEMBLE ─────────────────────────────
  // Board ready version
  var logoHtml2=c.logo?'<img src="'+c.logo+'" style="max-height:40px;max-width:140px;object-fit:contain;margin-bottom:.25rem" alt="logo">':'';
  var boardHTML='<div style="max-width:700px;margin:0 auto;font-family:var(--font,sans-serif)">'  +'<div style="text-align:center;padding:1.5rem 0 1rem;border-bottom:2px solid var(--text);margin-bottom:1.5rem">'  +(logoHtml2?'<div style="margin-bottom:.5rem">'+logoHtml2+'</div>':'')  +'<div style="font-family:serif;font-size:24px;font-weight:400">'+c.name+'</div>'  +'<div style="font-size:12px;color:var(--muted);margin-top:4px">Financial Executive Summary · '+tl(c.type)+' · '+today()+'</div></div>'  +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:1.5rem;text-align:center">'  +'<div><div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">'+(c.type==='np'?'Total Income':'Revenue')+'</div><div style="font-size:22px;font-weight:700;color:var(--green)">'+fmt(iT)+'</div></div>'  +'<div><div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Total Expenses</div><div style="font-size:22px;font-weight:700;color:var(--red)">'+fmt(eT)+'</div></div>'  +'<div><div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">'+(c.type==='np'?'Net Surplus':'Net Income')+'</div><div style="font-size:22px;font-weight:700;color:'+(net>=0?'var(--green)':'var(--red)')+'">'+fmt(net)+'</div></div>'  +'</div>'  +(budgetedInc||budgetedExp?'<div style="margin-bottom:1.5rem"><div style="font-size:13px;font-weight:600;margin-bottom:.5rem;padding-bottom:.25rem;border-bottom:1px solid var(--border)">Budget Performance</div>'  +(incVar!==null?'<div style="display:flex;justify-content:space-between;padding:.3rem 0;font-size:13px"><span>'+(c.type==='np'?'Income':'Revenue')+' vs Budget</span><span style="color:'+(incVar>=0?'var(--green)':'var(--red)')+';">'+(incVar>=0?'+':'')+incVar+'%</span></div>':'')  +(expVar!==null?'<div style="display:flex;justify-content:space-between;padding:.3rem 0;font-size:13px"><span>Expenses vs Budget</span><span style="color:'+(expVar<=5?'var(--green)':'var(--red)')+';">'+(expVar>=0?'+':'')+expVar+'%</span></div>':'')  +'</div>':'')
  +(h7?'<div style="margin-bottom:1.5rem"><div style="font-size:13px;font-weight:600;margin-bottom:.5rem;padding-bottom:.25rem;border-bottom:1px solid var(--border)">Projects / Events</div>'+h7+'</div>':'')
  +(h8?'<div style="margin-bottom:1.5rem"><div style="font-size:13px;font-weight:600;margin-bottom:.5rem;padding-bottom:.25rem;border-bottom:1px solid var(--border)">Grants</div>'+h8+'</div>':'')
  +'<div style="font-size:10px;color:var(--muted);text-align:center;margin-top:2rem;padding-top:1rem;border-top:1px solid var(--border)">Prepared with Clarity by Telofin™ · '+today()+'</div></div>';

  // Store score data and render the persistent score bar
  window._clarityScoreData={score:clarityScore,scores:scores,hasData:totalSignals>=3};
  renderScoreBar(clarityScore,scores);

  el.innerHTML='<div class="rpt-sec">'  +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:8px">'  +'<div><div style="font-family:serif;font-size:20px">Executive Summary</div><div style="font-size:11px;color:var(--muted)">'+c.name+' · '+tl(c.type)+' · '+today()+'</div></div>'  +'<div style="display:flex;gap:8px">'  +'<button class="sv-btn" id="exec-internal-btn" style="font-size:11px;padding:4px 12px" onclick="switchExecView(\'internal\')">Internal</button>'  +'<button class="add-btn" id="exec-board-btn" style="font-size:11px;padding:4px 12px" onclick="switchExecView(\'board\')">Board Ready</button>'  +'<label style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="exec-include-score" checked style="cursor:pointer"> Include score</label>'+'<button class="add-btn" style="font-size:11px;padding:4px 12px" onclick="exportExecutiveSummary()">&#128438; Export PDF</button>'  +'</div></div>'  +'<div id="exec-internal">'  +scoreHTML  +'<hr style="border:none;border-top:1px solid var(--border);margin:1rem 0">'  +h1+h2+h3+h4+h5+hCCC+stressHTML+h6+h7+h8  +_rptDisclaimer('This executive summary is an internal management tool only. The Clarity Score and all metrics are derived solely from user-entered data and do not constitute a professional financial opinion, audit, or compilation.')
  +'<div style="font-size:10px;color:var(--muted);text-align:center;margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--border)">Generated by Clarity by Telofin™ · All calculations based on data entered in this system</div>'  +'</div>'  +'<div id="exec-board" style="display:none">'+boardHTML+'</div>'  +'</div>';
}

function runStressTest(){
  var b=window._stressBase||{};
  var incEl=document.getElementById('st-inc'),expEl=document.getElementById('st-exp'),srcEl=document.getElementById('st-topsrc');
  if(!incEl||!expEl)return;
  var incChg=Number(incEl.value)/100,expChg=Number(expEl.value)/100,loseSrc=srcEl?Number(srcEl.value):0;
  document.getElementById('st-inc-val').textContent=(incChg>=0?'+':'')+Math.round(incChg*100)+'%';
  document.getElementById('st-exp-val').textContent=(expChg>=0?'+':'')+Math.round(expChg*100)+'%';
  var newI=(b.iT||0)*(1+incChg)-(loseSrc?(b.topSrcAmt||0):0);
  var newE=(b.eT||0)*(1+expChg);
  var newNet=newI-newE;
  var newBurn=(b.burnRate||0)*(1+expChg);
  var newRunway=newBurn>0?Math.round((b.cashOnHand||0)/newBurn):null;
  var newMargin=newI>0?Math.round((newNet/newI)*100):null;
  var fmt2=function(n){return'$'+Math.abs(Math.round(n)).toLocaleString();};
  var gc2=function(v,g,a){return v>=g?'var(--green)':v>=a?'var(--amber)':'var(--red)';};
  var html='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.5rem;text-align:center">'
  +'<div><div style="font-size:10px;color:var(--muted)">Income</div><div style="font-weight:700;font-size:16px;color:var(--green)">'+fmt2(newI)+'</div></div>'
  +'<div><div style="font-size:10px;color:var(--muted)">Expenses</div><div style="font-weight:700;font-size:16px;color:var(--red)">'+fmt2(newE)+'</div></div>'
  +'<div><div style="font-size:10px;color:var(--muted)">Net</div><div style="font-weight:700;font-size:16px;color:'+(newNet>=0?'var(--green)':'var(--red)')+'">'+( newNet<0?'-':'')+fmt2(newNet)+'</div></div>'
  +'<div><div style="font-size:10px;color:var(--muted)">Runway</div><div style="font-weight:700;font-size:16px;color:'+(newRunway===null?'var(--muted)':newRunway>=3?'var(--green)':newRunway>=1?'var(--amber)':'var(--red)')+'">'+( newRunway!==null?newRunway+' mo':'—')+'</div></div>'
  +'<div><div style="font-size:10px;color:var(--muted)">Net Margin</div><div style="font-weight:700;font-size:16px;color:'+(newMargin===null?'var(--muted)':newMargin>=10?'var(--green)':newMargin>=0?'var(--amber)':'var(--red)')+'">'+( newMargin!==null?newMargin+'%':'—')+'</div></div>'
  +'</div>'
  +(newNet<0?'<div style="font-size:11px;color:var(--red);margin-top:.5rem;text-align:center">⚠ This scenario results in a deficit. Review your cost structure.</div>':newRunway!==null&&newRunway<3?'<div style="font-size:11px;color:var(--amber);margin-top:.5rem;text-align:center">⚠ Runway drops below 3 months — consider building reserves.</div>':'<div style="font-size:11px;color:var(--green);margin-top:.5rem;text-align:center">✓ Organization remains viable under this scenario.</div>');
  var el=document.getElementById('st-results');if(el)el.innerHTML=html;
}

function switchExecView(mode){
  var i=g('exec-internal'),b=g('exec-board');
  var ib=g('exec-internal-btn'),bb=g('exec-board-btn');
  if(!i||!b)return;
  if(mode==='board'){i.style.display='none';b.style.display='block';if(ib)ib.className='add-btn';if(bb)bb.className='sv-btn';}
  else{i.style.display='block';b.style.display='none';if(ib)ib.className='sv-btn';if(bb)bb.className='add-btn';}
}

function rptFmt(n){return'$'+Number(n||0).toLocaleString();}
function rptRow(label,val,cls){return'<div class="rpt-row"><span>'+label+'</span><span class="'+(cls||'')+'">'+rptFmt(val)+'</span></div>';}
function rptTotal(label,val,cls){return'<div class="rpt-total"><span>'+label+'</span><span class="'+(cls||'')+'">'+rptFmt(val)+'</span></div>';}

function renderExpDetailRpt(){
  var c=gc();if(!c)return;var el=g('rpt-expdetail');if(!el)return;
  var all=(c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;});
  var exp=all;
  var chipHtml='';
  if(RPT_FILTER_TYPE&&RPT_FILTER_VALUE){
    if(RPT_FILTER_TYPE==='cat')exp=all.filter(function(r){return r.cat===RPT_FILTER_VALUE;});
    else if(RPT_FILTER_TYPE==='vendor')exp=all.filter(function(r){return(r.vendor1099||r.desc)===RPT_FILTER_VALUE;});
    else if(RPT_FILTER_TYPE==='fund')exp=all.filter(function(r){return r.fund===RPT_FILTER_VALUE;});
    chipHtml='<div class="drill-chip">'+escHtml(RPT_FILTER_LABEL)+' <span onclick="clearRptFilter()" title="Clear filter">&#x2715;</span></div>';
  }
  exp=exp.slice().sort(function(a,b){return(b.date||'').localeCompare(a.date||'');});
  var total=exp.reduce(function(s,e){return s+Number(e.amt||0);},0);
  var rows=exp.map(function(e){return'<div class="rpt-row"><span>'+(e.date||'—')+' · '+escHtml(e.desc||'—')+' <span style="color:var(--muted);font-size:11px">'+escHtml(e.cat||'')+(e.vendor1099?' · '+escHtml(e.vendor1099):'')+'</span></span><span class="vr">'+rptFmt(e.amt)+'</span></div>';}).join('');
  el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Expense Detail</div>'+chipHtml+(rows||'<div style="color:var(--muted);font-size:12px">No expenses.</div>')+rptTotal('Total expenses',total,'vr')+'</div>';
}

function renderIncDetailRpt(){
  var c=gc();if(!c)return;var el=g('rpt-incdetail');if(!el)return;
  var allItems=c.type==='sb'?(c.revenue||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}):(c.income||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;});
  var items=allItems;
  var chipHtml='';
  if(RPT_FILTER_TYPE&&RPT_FILTER_VALUE){
    if(RPT_FILTER_TYPE==='source')items=allItems.filter(function(r){return r.name===RPT_FILTER_VALUE;});
    else if(RPT_FILTER_TYPE==='cat')items=allItems.filter(function(r){return r.cat===RPT_FILTER_VALUE;});
    else if(RPT_FILTER_TYPE==='fund')items=allItems.filter(function(r){return r.fund===RPT_FILTER_VALUE;});
    chipHtml='<div class="drill-chip">'+escHtml(RPT_FILTER_LABEL)+' <span onclick="clearRptFilter()" title="Clear filter">&#x2715;</span></div>';
  }
  var total=items.reduce(function(s,r){return s+basisInc(c,r);},0);
  var rows=items.map(function(r){var a=basisInc(c,r);return'<div class="rpt-row"><span>'+(r.date||escHtml(r.name)||'—')+' <span style="color:var(--muted);font-size:11px">'+escHtml(r.cat||'')+(r.name&&r.date?' · '+escHtml(r.name):'')+'</span></span><span class="vg">'+rptFmt(a)+'</span></div>';}).join('');
  el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">'+il(c.type)+' Detail</div>'+chipHtml+(rows||'<div style="color:var(--muted);font-size:12px">No data.</div>')+rptTotal('Total',total,'vg')+'</div>';
}

function renderVendorRpt(){
  var c=gc();if(!c)return;var el=g('rpt-vendor');if(!el)return;
  var allExp=(c.expenses||[]).filter(function(e){return!e.deleted&&!e.voided&&!e.isReversal;});
  var vendors={};
  var chipHtml='';
  var filtered=allExp;
  if(RPT_FILTER_TYPE==='vendor'&&RPT_FILTER_VALUE){
    filtered=allExp.filter(function(e){return(e.vendor1099||e.desc)===RPT_FILTER_VALUE;});
    chipHtml='<div class="drill-chip">'+escHtml(RPT_FILTER_LABEL)+' <span onclick="clearRptFilter()" title="Clear filter">&#x2715;</span></div>';
  }
  filtered.forEach(function(e){var v=e.vendor1099||e.desc||'Unknown';if(!vendors[v])vendors[v]={total:0,count:0,is1099:!!e.is1099,cats:{}};vendors[v].total+=Number(e.amt||0);vendors[v].count++;if(e.cat)vendors[v].cats[e.cat]=(vendors[v].cats[e.cat]||0)+Number(e.amt||0);});
  var rows=Object.keys(vendors).sort(function(a,b){return vendors[b].total-vendors[a].total;}).map(function(v){
    var d=vendors[v];
    var topCat=Object.keys(d.cats).sort(function(a,b){return d.cats[b]-d.cats[a];}).slice(0,2).join(', ');
    return'<div class="rpt-row"><span>'+escHtml(v)+(d.is1099?'<span class="badge b-amber" style="margin-left:6px;font-size:9px">1099</span>':'')+'<span style="color:var(--muted);font-size:11px;margin-left:8px">'+d.count+' transaction'+(d.count>1?'s':'')+(topCat?' · '+escHtml(topCat):'')+'</span></span><span class="vr">'+rptFmt(d.total)+'</span></div>';}).join('');
  var total=Object.values(vendors).reduce(function(s,v){return s+v.total;},0);
  el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Vendor Summary</div>'+chipHtml+(rows||'<div style="color:var(--muted);font-size:12px">No vendor data.</div>')+rptTotal('Total',total,'vr')+'</div>';
}

function renderDonorRpt(){
  var c=gc();if(!c)return;var el=g('rpt-donors');if(!el)return;
  if(c.type!=='np'){el.innerHTML='<div class="rpt-sec"><div style="color:var(--muted);font-size:12px">Donor report is for nonprofit clients only.</div></div>';return;}
  var donors=c.donors||[];
  if(!donors.length){el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Donor Report</div><div style="color:var(--muted);font-size:12px">No donors yet.</div></div>';return;}

  var fy=getFiscalYear(c.fiscalYearEnd);
  var priorFY=getFiscalYear(c.fiscalYearEnd,new Date(fy.start.getFullYear()-1,fy.start.getMonth(),fy.start.getDate()));

  // Helper — get cash donations for a donor in a date range
  function donorTotal(d,start,end){
    return(d.donations||[]).filter(function(dn){
      if(dn.inkind==='Yes')return false;
      if(!dn.date)return false;
      var dt=new Date(dn.date);
      return dt>=start&&dt<=end;
    }).reduce(function(s,dn){return s+Number(dn.amt||0);},0);
  }

  // Current FY and prior FY totals per donor
  var donorData=donors.map(function(d){
    var curAmt=donorTotal(d,fy.start,fy.end);
    var priorAmt=donorTotal(d,priorFY.start,priorFY.end);
    var allTime=(d.donations||[]).filter(function(dn){return dn.inkind!=='Yes';}).reduce(function(s,dn){return s+Number(dn.amt||0);},0);
    var firstGift=(d.donations||[]).filter(function(dn){return dn.date&&dn.inkind!=='Yes';}).sort(function(a,b){return new Date(a.date)-new Date(b.date);})[0];
    var lastGift=(d.donations||[]).filter(function(dn){return dn.date&&dn.inkind!=='Yes';}).sort(function(a,b){return new Date(b.date)-new Date(a.date);})[0];
    return{d:d,curAmt:curAmt,priorAmt:priorAmt,allTime:allTime,
      firstGift:firstGift,lastGift:lastGift,
      isNewThisYear:curAmt>0&&priorAmt===0&&allTime===curAmt,
      isLYBUNT:priorAmt>0&&curAmt===0,// gave last year, not this year
      isSYBUNT:allTime>0&&priorAmt===0&&curAmt===0,// gave some year but not last or this
      isRetained:curAmt>0&&priorAmt>0,// gave both years
      isUpgraded:curAmt>0&&priorAmt>0&&curAmt>priorAmt,
      isDowngraded:curAmt>0&&priorAmt>0&&curAmt<priorAmt
    };
  });

  // Summary metrics
  var totalCur=donorData.reduce(function(s,d){return s+d.curAmt;},0);
  var totalPrior=donorData.reduce(function(s,d){return s+d.priorAmt;},0);
  var curDonors=donorData.filter(function(d){return d.curAmt>0;});
  var priorDonors=donorData.filter(function(d){return d.priorAmt>0;});
  var retained=donorData.filter(function(d){return d.isRetained;});
  var lybunt=donorData.filter(function(d){return d.isLYBUNT;});
  var sybunt=donorData.filter(function(d){return d.isSYBUNT;});
  var newDonors=donorData.filter(function(d){return d.isNewThisYear;});
  var upgraded=donorData.filter(function(d){return d.isUpgraded;});
  var retentionRate=priorDonors.length?Math.round((retained.length/priorDonors.length)*100):null;
  var yoyChange=totalPrior>0?Math.round(((totalCur-totalPrior)/totalPrior)*100):null;

  function rptRow(label,val,color){
    return'<div class="rpt-row"><span style="color:var(--muted)">'+label+'</span><span style="font-weight:600;color:'+(color||'var(--text)')+'">'+val+'</span></div>';
  }
  function donorRow(dd,showPrior){
    var yoy=dd.priorAmt>0&&dd.curAmt>0?Math.round(((dd.curAmt-dd.priorAmt)/dd.priorAmt)*100):null;
    var yoyBadge=yoy!==null?'<span class="badge" style="font-size:9px;background:'+(yoy>=0?'var(--green-bg)':'var(--red-bg)')+';color:'+(yoy>=0?'var(--green)':'var(--red)')+';">'+(yoy>=0?'+':'')+yoy+'%</span>':'';
    return'<div class="rpt-row">'
      +'<span>'+escHtml(dd.d.name)+(dd.d.email?'<span style="color:var(--muted);font-size:10px;margin-left:6px">'+escHtml(dd.d.email)+'</span>':'')
      +(dd.d.tier?'<span class="badge" style="font-size:9px;margin-left:4px;background:var(--soft);color:var(--muted)">'+escHtml(dd.d.tier)+'</span>':'')
      +yoyBadge+'</span>'
      +'<span style="display:flex;gap:12px;align-items:center">'
      +(showPrior&&dd.priorAmt?'<span style="color:var(--muted);font-size:11px">Prior: '+rptFmt(dd.priorAmt)+'</span>':'')
      +'<span class="vg" style="font-weight:600">'+rptFmt(dd.curAmt||dd.priorAmt||dd.allTime)+'</span>'
      +'</span></div>';
  }

  var html='<div class="rpt-sec"><div class="rpt-ttl">Donor Report — '+fy.label+'</div>';

  // Key metrics strip
  html+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:1rem">'
    +'<div style="padding:.625rem;background:var(--bg);border-radius:8px;text-align:center"><div style="font-size:10px;color:var(--muted);margin-bottom:3px">Total raised</div><div style="font-size:16px;font-weight:700;color:var(--green)">'+rptFmt(totalCur)+'</div>'+(yoyChange!==null?'<div style="font-size:10px;color:'+(yoyChange>=0?'var(--green)':'var(--red)')+';">'+(yoyChange>=0?'+':'')+yoyChange+'% vs prior</div>':'')+'</div>'
    +'<div style="padding:.625rem;background:var(--bg);border-radius:8px;text-align:center"><div style="font-size:10px;color:var(--muted);margin-bottom:3px">Active donors</div><div style="font-size:16px;font-weight:700;color:var(--blue)">'+curDonors.length+'</div><div style="font-size:10px;color:var(--muted)">this year</div></div>'
    +(retentionRate!==null?'<div style="padding:.625rem;background:var(--bg);border-radius:8px;text-align:center"><div style="font-size:10px;color:var(--muted);margin-bottom:3px">Retention rate</div><div style="font-size:16px;font-weight:700;color:'+(retentionRate>=60?'var(--green)':retentionRate>=40?'var(--amber)':'var(--red)')+'">'+retentionRate+'%</div><div style="font-size:10px;color:var(--muted)">'+retained.length+' of '+priorDonors.length+' renewed</div></div>':'')
    +'<div style="padding:.625rem;background:var(--bg);border-radius:8px;text-align:center"><div style="font-size:10px;color:var(--muted);margin-bottom:3px">New donors</div><div style="font-size:16px;font-weight:700;color:var(--np)">'+newDonors.length+'</div><div style="font-size:10px;color:var(--muted)">first gift this year</div></div>'
    +'<div style="padding:.625rem;background:'+(lybunt.length>0?'#fff8e1':'var(--bg)')+';border-radius:8px;text-align:center"><div style="font-size:10px;color:var(--muted);margin-bottom:3px">LYBUNT</div><div style="font-size:16px;font-weight:700;color:'+(lybunt.length>0?'var(--amber)':'var(--muted)')+'">'+lybunt.length+'</div><div style="font-size:10px;color:var(--muted)">need re-engagement</div></div>'
    +'</div>';

  // Top donors this year
  if(curDonors.length){
    html+='<div style="font-size:12px;font-weight:600;color:var(--text);margin:.75rem 0 .375rem">Top donors — '+fy.label+'</div>';
    html+=curDonors.slice().sort(function(a,b){return b.curAmt-a.curAmt;}).slice(0,10).map(function(dd){return donorRow(dd,true);}).join('');
    html+=rptTotal('Total '+fy.label,totalCur,'vg');
  }

  // Year over year comparison
  if(priorDonors.length){
    html+='<div style="font-size:12px;font-weight:600;color:var(--text);margin:1rem 0 .375rem">Year-over-year — donors in both '+priorFY.label+' and '+fy.label+'</div>';
    if(retained.length){
      html+=retained.slice().sort(function(a,b){return b.curAmt-a.curAmt;}).map(function(dd){return donorRow(dd,true);}).join('');
    } else {
      html+='<div style="font-size:12px;color:var(--muted);padding:.5rem 0">No donors gave in both years yet.</div>';
    }
    if(upgraded.length)html+='<div style="font-size:11px;color:var(--green);margin-top:.375rem">↑ '+upgraded.length+' donor'+(upgraded.length>1?'s':'')+' upgraded their giving</div>';
  }

  // LYBUNT list
  if(lybunt.length){
    html+='<div style="margin-top:1rem;padding:.75rem;background:#fff8e1;border-left:3px solid var(--amber);border-radius:0 8px 8px 0">';
    html+='<div style="font-size:12px;font-weight:600;color:#7a5c00;margin-bottom:.375rem">⚠ LYBUNT — Gave '+priorFY.label+', not yet '+fy.label+' ('+lybunt.length+')</div>';
    html+='<div style="font-size:11px;color:#7a5c00;margin-bottom:.5rem">These donors gave last year but haven\'t given this year. Priority re-engagement list.</div>';
    html+=lybunt.slice().sort(function(a,b){return b.priorAmt-a.priorAmt;}).map(function(dd){
      var lastGiftDate=dd.lastGift?fmtDate(dd.lastGift.date):'';
      return'<div class="rpt-row"><span>'+escHtml(dd.d.name)+(dd.d.email?'<span style="color:var(--muted);font-size:10px;margin-left:6px">'+escHtml(dd.d.email)+'</span>':'')+(lastGiftDate?'<span style="color:var(--muted);font-size:10px;margin-left:6px">Last gift: '+lastGiftDate+'</span>':'')+'</span><span style="color:var(--amber);font-weight:600">'+rptFmt(dd.priorAmt)+'</span></div>';
    }).join('');
    html+='</div>';
  }

  // SYBUNT list
  if(sybunt.length){
    html+='<div style="margin-top:.75rem;padding:.75rem;background:var(--bg);border-left:3px solid var(--muted);border-radius:0 8px 8px 0">';
    html+='<div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:.375rem">SYBUNT — Gave some year, not recently ('+sybunt.length+')</div>';
    html+=sybunt.slice().sort(function(a,b){return b.allTime-a.allTime;}).slice(0,8).map(function(dd){
      var lastGiftDate=dd.lastGift?fmtDate(dd.lastGift.date):'';
      return'<div class="rpt-row"><span>'+escHtml(dd.d.name)+(lastGiftDate?'<span style="color:var(--muted);font-size:10px;margin-left:6px">Last: '+lastGiftDate+'</span>':'')+'</span><span style="color:var(--muted)">'+rptFmt(dd.allTime)+' all time</span></div>';
    }).join('');
    html+='</div>';
  }

  // New donors this year
  if(newDonors.length){
    html+='<div style="margin-top:.75rem;padding:.75rem;background:var(--np-bg);border-left:3px solid var(--np);border-radius:0 8px 8px 0">';
    html+='<div style="font-size:12px;font-weight:600;color:var(--np);margin-bottom:.375rem">🌱 New donors this year ('+newDonors.length+')</div>';
    html+=newDonors.slice().sort(function(a,b){return b.curAmt-a.curAmt;}).map(function(dd){
      return'<div class="rpt-row"><span>'+escHtml(dd.d.name)+(dd.d.email?'<span style="color:var(--muted);font-size:10px;margin-left:6px">'+escHtml(dd.d.email)+'</span>':'')+'</span><span class="vg">'+rptFmt(dd.curAmt)+'</span></div>';
    }).join('');
    html+='</div>';
  }

  html+='</div>';
  el.innerHTML=html;
}

function renderProjPLRpt(){
  var c=gc();if(!c)return;var el=g('rpt-projpl');if(!el)return;
  var projects=c.projects||[];
  if(!projects.length){el.innerHTML='<div class="rpt-sec"><div style="color:var(--muted);font-size:12px">No projects yet.</div></div>';return;}
  var rows=projects.map(function(pr){
    var exp=(c.expenses||[]).filter(function(e){return e.projectId===pr.id;}).reduce(function(s,e){return s+Number(e.amt||0);},0);
    var inc=((c.type==='sb'?c.revenue:c.income)||[]).filter(function(r){return r.projectId===pr.id;}).reduce(function(s,r){return s+basisInc(c,r);},0);
    var net=inc-exp;
    return'<div class="rpt-sec" style="margin-bottom:.5rem"><div class="rpt-ttl" style="font-size:13px">'+escHtml(pr.name)+'</div>'
    +rptRow('Income',inc,'vg')+rptRow('Expenses',exp,'vr')+rptTotal('Net',net,net>=0?'vg':'vr')+'</div>';
  }).join('');
  el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Project P&amp;L</div>'+rows+'</div>';
}

function renderCashFlowRpt(){
  var c=gc();if(!c)return;var el=g('rpt-cashflow');if(!el)return;
  var exp=(c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;});var rev=(c.revenue||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;});
  // Monthly projected burn (frequency-adjusted)
  var mOut=exp.reduce(function(s,e){var a=Number(e.amt||0);return s+(e.freq==='Weekly'?a*4:e.freq==='Bi-weekly'?a*2:e.freq==='Monthly'?a:e.freq==='Quarterly'?a/3:e.freq==='Annual'?a/12:a);},0);
  var mIn=rev.reduce(function(s,r){return s+Number(r.proj||0);},0);
  var fixed=exp.filter(function(e){return e.fixed==='Fixed';}).reduce(function(s,e){return s+Number(e.amt||0);},0);
  var variable=exp.filter(function(e){return e.fixed!=='Fixed';}).reduce(function(s,e){return s+Number(e.amt||0);},0);
  var totalAct=rev.reduce(function(s,r){return s+basisInc(c,r);},0);
  var totalExp=exp.reduce(function(s,e){return s+Number(e.amt||0);},0);
  var cashOnHand=getCashOnHand(c);
  var runway=mOut>0?Math.round(cashOnHand/mOut):null;
  el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Cash Position</div>'
  +rptRow('Cash on hand (from reconciliation)',cashOnHand,'vg')
  +rptRow('Monthly projected inflow',Math.round(mIn),'vg')
  +rptRow('Monthly projected outflow',Math.round(mOut),'vr')
  +rptTotal('Monthly net',(Math.round(mIn)-Math.round(mOut)),(mIn>=mOut)?'vg':'vr')+'</div>'
  +'<div class="rpt-sec"><div class="rpt-ttl">Actuals to Date</div>'
  +rptRow('Total revenue (actual)',totalAct,'vg')
  +rptRow('Fixed expenses',fixed,'vr')
  +rptRow('Variable expenses',variable,'vr')
  +rptTotal('Net P&L',totalAct-totalExp,(totalAct>=totalExp)?'vg':'vr')+'</div>'
  +(runway!==null?'<div class="rpt-sec">'+rptRow('Runway at current burn rate',runway+' months',runway>=18?'vg':runway>=12?'va':'vr')+'</div>':'');
}

function renderBSheetRpt(){
  var c=gc();if(!c)return;var el=g('rpt-bsheet');if(!el)return;
  var bs=c.balanceSheet||{assets:[],liabilities:[],equity:[]};
  // Use computeBSAssetBalance — same derived logic as renderBalanceSheet
  var manualAssets=(bs.assets||[]).reduce(function(s,a){return s+computeBSAssetBalance(c,a.id);},0);
  var manualLiab=(bs.liabilities||[]).reduce(function(s,l){return s+Number(l.amt||0);},0);
  var reconCash=0;
  var reconByBankId={};
  (c.bankAccounts||[]).forEach(function(b){var rs=c['reconState_bank:'+b.id];if(rs&&Number(rs.closeBal||0)>0){reconCash+=Number(rs.closeBal);reconByBankId[b.id]=true;}});
  if(c['reconState_bank']&&Number(c['reconState_bank'].closeBal||0)>0)reconCash+=Number(c['reconState_bank'].closeBal);
  var arAmt=(c.invoices||[]).filter(function(i){return i.status!=='Paid';}).reduce(function(s,i){return s+Number(i.amt||0);},0);
  var apAmt=(c.bills||[]).filter(function(b){return b.status!=='Paid';}).reduce(function(s,b){return s+Number(b.amt||0);},0);
  var totalAssets=manualAssets+reconCash+arAmt;
  var totalLiab=manualLiab+apAmt;
  var equity=totalAssets-totalLiab;
  function autoRptRow(label,amt,cls){return'<div class="rpt-row" style="font-style:italic"><span>'+label+' <span style="font-size:10px;background:var(--soft);padding:1px 4px;border-radius:3px">auto</span></span><span class="'+cls+'">'+rptFmt(amt)+'</span></div>';}
  var assetRows=(reconCash>0?autoRptRow('Cash — Bank Accounts',reconCash,'vg'):'')
    +(arAmt>0?autoRptRow('Accounts Receivable',arAmt,'vg'):'')
    +(bs.assets||[]).map(function(a){var bal=computeBSAssetBalance(c,a.id);return rptRow(a.name,bal,bal>=0?'vg':'vr');}).join('');
  var liabRows=(apAmt>0?autoRptRow('Accounts Payable',apAmt,'vr'):'')
    +(bs.liabilities||[]).map(function(i){return rptRow(i.name,i.amt,'vr');}).join('');
  // ── LEDGER-DERIVED SECTION ──────────────────────────────────────────────────────────────────────────
  var ledgerSection='';
  var hasLedger=c.ledgerEntries&&c.ledgerEntries.length>0;
  if(hasLedger){
    var lbs=getBSFromLedger(c);
    var fmt2=function(n){return'$'+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});};
    var balStatus=lbs.balanced
      ?'<span style="color:var(--green);font-weight:600">&#10003; In balance</span>'
      :'<span style="color:var(--red);font-weight:700">&#9888; Out of balance by '+fmt2(Math.abs(lbs.totalAssets-(lbs.totalLiab+lbs.totalEquityPlusIncome)))+'</span>';
    function lbsRptSec(title,rows,total,color){
      var rowHtml=rows.map(function(r){return rptRow(r.code+' '+r.name,r.balance,r.balance<0?'vr':color);}).join('');
      return'<div class="rpt-sec"><div class="rpt-ttl">'+title+'</div>'
        +(rowHtml||'<div style="color:var(--muted);font-size:12px">No entries.</div>')
        +rptTotal('Total '+title.toLowerCase(),total,color)+'</div>';
    }
    ledgerSection='<div class="rpt-sec"><div class="rpt-ttl" style="margin-top:1.5rem;border-top:2px solid var(--border);padding-top:1rem">Ledger-Derived Balance Sheet</div>'
      +'<div style="font-size:11px;color:var(--muted);margin-bottom:.75rem">Computed from posted double-entry entries — agrees with Trial Balance. '+balStatus+'</div>'
      +'<div style="display:flex;gap:24px;font-size:12px;margin-bottom:.75rem;flex-wrap:wrap">'
      +'<span>Assets: <strong>'+fmt2(lbs.totalAssets)+'</strong></span>'
      +'<span>Liabilities: <strong>'+fmt2(lbs.totalLiab)+'</strong></span>'
      +'<span>Equity: <strong>'+fmt2(lbs.totalEquity)+'</strong></span>'
      +'<span>Net income (YTD): <strong class="'+(lbs.netIncome>=0?'vg':'vr')+'">'+fmt2(lbs.netIncome)+'</strong></span>'
      +'</div></div>'
      +lbsRptSec('Assets',lbs.assets,lbs.totalAssets,'vg')
      +lbsRptSec('Liabilities',lbs.liabilities,lbs.totalLiab,'vr')
      +lbsRptSec('Equity',lbs.equity,lbs.totalEquity,'vb')
      +'<div class="rpt-sec"><div class="rpt-ttl">Current period net income</div>'
      +'<div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.03em;margin:.5rem 0 .25rem">Income</div>'
      +(lbs.incomeAccts.length?lbs.incomeAccts.map(function(r){return rptRow(r.code+' '+r.name,r.balance,'vg');}).join(''):'<div style="color:var(--muted);font-size:12px;padding:.25rem 0">No income accounts.</div>')
      +rptTotal('Total income',lbs.totalIncome,'vg')
      +'<div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.03em;margin:1rem 0 .25rem">Expenses</div>'
      +(lbs.expenseAccts.length?lbs.expenseAccts.map(function(r){return rptRow(r.code+' '+r.name,r.balance,'vr');}).join(''):'<div style="color:var(--muted);font-size:12px;padding:.25rem 0">No expense accounts.</div>')
      +rptTotal('Total expenses',lbs.totalExpense,'vr')
      +rptTotal('Net income (not yet closed to equity)',lbs.netIncome,lbs.netIncome>=0?'vg':'vr')
      +'</div>';
  }

  el.innerHTML=_rptDisclaimer('Balance sheet figures are based on entered transactions and manual entries. This is not a certified or audited financial statement.')+'<div class="rpt-sec"><div class="rpt-ttl">Assets</div>'+assetRows+rptTotal('Total assets',totalAssets,'vg')+'</div>'
  +'<div class="rpt-sec"><div class="rpt-ttl">Liabilities</div>'+liabRows+rptTotal('Total liabilities',totalLiab,'vr')+'</div>'
  +'<div class="rpt-sec">'+rptTotal('Net equity / net assets',equity,equity>=0?'vg':'vr')+'</div>'
  +ledgerSection;
}


// ── MILEAGE LOG ──────────────────────────────────────────────────────────────
function mileCalc(){
  var miles=Number(g('mile-miles')&&g('mile-miles').value||0);
  var rate=Number(g('mile-rate')&&g('mile-rate').value||0.67);
  var prev=g('mile-preview');
  if(prev)prev.textContent=miles>0?'Deduction: '+fmt(miles*rate)+' ('+miles+' mi × $'+rate+'/mi)':'';
}
function saveMile(){
  var c=gc();if(!c)return;
  // PERIOD LOCK GUARD
  var _mileLockDate=g('mile-date')&&g('mile-date').value.trim();
  if(_mileLockDate&&isDateLocked(c,_mileLockDate)){periodLockAlert(c.closedThrough);return;}
  var miles=Number(g('mile-miles').value||0);if(!miles){alert('Please enter miles.');return;}
  var purpose=g('mile-purpose').value.trim();if(!purpose){alert('Please enter a purpose.');return;}
  var rate=Number(g('mile-rate').value||0.67);
  if(!c.mileage)c.mileage=[];
  var item={id:uid(),date:g('mile-date').value||todayNum(),miles:miles,purpose:purpose,from:g('mile-from').value.trim(),to:g('mile-to').value.trim(),rate:rate,deduction:Math.round(miles*rate*100)/100,notes:g('mile-notes').value.trim()};
  if(MILE_EI>=0)c.mileage[MILE_EI]=item;else c.mileage.push(item);
  sv();renderMileageRpt();closeM('m-mile');MILE_EI=-1;
  ['mile-miles','mile-purpose','mile-from','mile-to','mile-notes'].forEach(function(id){var el=g(id);if(el)el.value='';});
  if(g('mile-rate'))g('mile-rate').value='0.67';
  if(g('mile-preview'))g('mile-preview').textContent='';
}
var MILE_EI=-1;
function delMile(i){var c=gc();if(!c||!confirm('Delete this mileage entry?'))return;c.mileage.splice(i,1);sv();renderMileageRpt();}
function renderMileageRpt(){
  var c=gc();if(!c)return;var el=g('rpt-mileage');if(!el)return;
  if(!c.mileage)c.mileage=[];
  var logs=c.mileage.slice().sort(function(a,b){return(b.date||'').localeCompare(a.date||'');});
  var totMiles=logs.reduce(function(s,m){return s+Number(m.miles||0);},0);
  var totDed=logs.reduce(function(s,m){return s+Number(m.deduction||0);},0);
  var rows=logs.map(function(m,i){return'<tr><td style="color:var(--muted)">'+( m.date||'—')+'</td><td>'+escHtml(m.purpose||'—')+'</td><td style="color:var(--muted);font-size:11px">'+(m.from&&m.to?escHtml(m.from)+' → '+escHtml(m.to):'—')+'</td><td>'+Number(m.miles||0).toFixed(1)+'</td><td>$'+(m.rate||0.67)+'</td><td style="color:var(--green);font-weight:500">'+fmt(m.deduction||0)+'</td><td><div class="row-acts"><button class="d-btn" onclick="delMile('+i+')" title="Delete">&#215;</button></div></td></tr>';}).join('');
  el.innerHTML='<div class="rpt-sec"><div style="display:flex;align-items:center;gap:12px;margin-bottom:1rem"><div class="rpt-ttl" style="margin-bottom:0">Mileage Log</div><span class="badge b-gray" style="font-size:10px">IRS Schedule C / 2106</span></div>'
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:1rem">'
    +'<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Total miles</div><div style="font-weight:700;font-size:20px">'+totMiles.toFixed(1)+'</div></div>'
    +'<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Total deduction</div><div style="font-weight:700;font-size:20px;color:var(--green)">'+fmt(totDed)+'</div></div>'
    +'<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">IRS rate (2024)</div><div style="font-weight:700;font-size:20px">$0.67/mi</div></div>'
    +'</div>'
    +'<div class="card"><div class="c-head"><span class="c-title">Mileage entries</span><button class="add-btn" onclick="MILE_EI=-1;if(g(\'mile-date\'))g(\'mile-date\').value=todayNum();openM(\'m-mile\')">+ Log trip</button></div>'
    +(logs.length?'<table><thead><tr><th style="width:11%">Date</th><th style="width:30%">Purpose</th><th style="width:20%">Route</th><th style="width:8%">Miles</th><th style="width:8%">Rate</th><th style="width:10%">Deduction</th><th style="width:13%"></th></tr></thead><tbody>'+rows+'</tbody></table>'
    +'<div style="text-align:right;font-size:12px;padding:.5rem 0;border-top:1px solid var(--soft)"><strong>Total: '+totMiles.toFixed(1)+' miles = '+fmt(totDed)+'</strong></div>'
    :ES('No mileage logged','Log business trips to track your IRS deduction.',"MILE_EI=-1;openM('m-mile')"))
    +'</div></div>';
}

// ── FIXED ASSETS & DEPRECIATION ──────────────────────────────────────────────
function assetCalc(){
  var cost=Number(g('asset-cost')&&g('asset-cost').value||0);
  var life=Number(g('asset-life')&&g('asset-life').value||5);
  var salvage=Number(g('asset-salvage')&&g('asset-salvage').value||0);
  var method=g('asset-method')&&g('asset-method').value||'sl';
  var prev=g('asset-preview');if(!prev)return;
  if(!cost||!life){prev.textContent='';return;}
  var annual=method==='sl'?(cost-salvage)/life:method==='macrs'?cost*0.2:cost*(2/life);
  var macrsNote=method==='macrs'?' (MACRS yr1 est.)':'';
  prev.textContent='Annual depreciation: '+fmt(annual)+'/yr  ·  Total depreciable: '+fmt(cost-salvage)+macrsNote;
}
var ASSET_EI=-1;
function saveAsset(){
  var c=gc();if(!c)return;
  // PERIOD LOCK GUARD
  var _assetLockDate=g('asset-date')&&g('asset-date').value.trim();
  if(_assetLockDate&&isDateLocked(c,_assetLockDate)){periodLockAlert(c.closedThrough);return;}
  var name=g('asset-name').value.trim();if(!name){alert('Please enter an asset name.');return;}
  var cost=Number(g('asset-cost').value||0);if(!cost){alert('Please enter the cost.');return;}
  var life=Number(g('asset-life').value||5);
  var salvage=Number(g('asset-salvage').value||0);
  var method=g('asset-method').value||'sl';
  var annual=method==='sl'?(cost-salvage)/life:method==='macrs'?cost*(2/Math.max(life,3)):cost*(2/life);
  if(!c.fixedAssets)c.fixedAssets=[];
  var item={id:uid(),name:name,date:g('asset-date').value||todayNum(),cost:cost,life:life,salvage:salvage,method:method,annualDepr:Math.round(annual*100)/100,notes:g('asset-notes').value.trim()};
  if(ASSET_EI>=0)c.fixedAssets[ASSET_EI]=item;else c.fixedAssets.push(item);
  sv();renderAssetsRpt();closeM('m-asset');ASSET_EI=-1;
  ['asset-name','asset-date','asset-cost','asset-notes'].forEach(function(id){var el=g(id);if(el)el.value='';});
  if(g('asset-life'))g('asset-life').value='5';
  if(g('asset-salvage'))g('asset-salvage').value='0';
  if(g('asset-preview'))g('asset-preview').textContent='';
}
function delAsset(i){var c=gc();if(!c||!confirm('Delete this asset?'))return;if(!c.fixedAssets)return;c.fixedAssets.splice(i,1);sv();renderAssetsRpt();}
function renderAssetsRpt(){
  var c=gc();if(!c)return;var el=g('rpt-assets');if(!el)return;
  if(!c.fixedAssets)c.fixedAssets=[];
  var assets=c.fixedAssets;
  var now=new Date();
  function yearsOwned(dateStr){var d=parseDate(dateStr);if(!d)return 0;return Math.max(0,(now-d)/(365.25*86400000));}
  var MACRS_T={3:[33.33,44.45,14.81,7.41],5:[20,32,19.2,11.52,11.52,5.76],7:[14.29,24.49,17.49,12.49,8.93,8.92,8.93,4.46],10:[10,18,14.4,11.52,9.22,7.37,6.55,6.55,6.56,6.55,3.28]};
  function accumDepr(a){
    var yrs=Math.min(yearsOwned(a.date),a.life);
    if(a.method==='macrs'){
      var cls=[3,5,7,10].reduce(function(p,c){return Math.abs(c-a.life)<Math.abs(p-a.life)?c:p;});
      var pcts=MACRS_T[cls]||MACRS_T[5];
      var acc=0;
      for(var y=0;y<Math.min(Math.floor(yrs),pcts.length);y++)acc+=a.cost*(pcts[y]/100);
      return Math.round(Math.min(acc,a.cost)*100)/100;
    }
    if(a.method==='sl')return Math.min((a.cost-a.salvage),yrs*a.annualDepr);
    var bv=a.cost,acc=0,rate=2/a.life;for(var y=0;y<Math.floor(yrs);y++){var d=bv*rate;acc+=d;bv-=d;}return Math.round(acc*100)/100;
  }
  var totCost=assets.reduce(function(s,a){return s+Number(a.cost||0);},0);
  var totAccum=assets.reduce(function(s,a){return s+accumDepr(a);},0);
  var totBV=totCost-totAccum;
  var _mk=new Date().getFullYear()+'-'+(new Date().getMonth()+1);var rows=assets.map(function(a,i){var acc=accumDepr(a);var bv=Math.max(0,a.cost-acc);var pct=a.cost>0?Math.round(acc/a.cost*100):0;var _dk=a.id+':'+_mk;var _dp=c.deprPosted&&c.deprPosted[_dk];var _db=bv<=0?'<span style="font-size:10px;color:var(--muted)">Fully depr.</span>':(_dp?'<span class="badge b-green" title="Posted '+_mk+'">Depr &#10003;</span>':'<button class="add-btn" style="font-size:10px;padding:2px 7px" title="Post '+_mk+' depreciation now" onclick="postDepreciation(gc());sv();renderAssetsRpt()">Post depr</button>');return'<tr><td style="font-weight:500">'+escHtml(a.name)+'</td><td style="color:var(--muted);font-size:11px">'+(a.date||'&#8212;')+'</td><td>'+fmt(a.cost)+'</td><td style="color:var(--muted)">'+fmt(a.annualDepr)+'/yr</td><td style="color:var(--amber)">'+fmt(acc)+'</td><td style="font-weight:500;color:'+(bv<=0?'var(--muted)':'var(--text)')+'">'+fmt(bv)+'</td><td style="font-size:11px;color:var(--muted)">'+pct+'% used</td><td>'+_db+'</td><td><div class="row-acts"><button class="d-btn" onclick="delAsset('+i+')" title="Delete">&#215;</button></div></td></tr>';}).join('');
  el.innerHTML='<div class="rpt-sec"><div style="display:flex;align-items:center;gap:12px;margin-bottom:1rem"><div class="rpt-ttl" style="margin-bottom:0">Fixed Assets &amp; Depreciation</div></div>'
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:1rem">'
    +'<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Total cost</div><div style="font-weight:700;font-size:18px">'+fmt(totCost)+'</div></div>'
    +'<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Accumulated depreciation</div><div style="font-weight:700;font-size:18px;color:var(--amber)">'+fmt(totAccum)+'</div></div>'
    +'<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Net book value</div><div style="font-weight:700;font-size:18px;color:var(--green)">'+fmt(totBV)+'</div></div>'
    +'</div>'
    +'<div class="card"><div class="c-head"><span class="c-title">Asset schedule</span><button class="add-btn" onclick="ASSET_EI=-1;openM(\'m-asset\')">+ Add asset</button></div>'
    +(assets.length?'<table><thead><tr><th style="width:16%">Asset</th><th style="width:9%">Purchased</th><th style="width:9%">Cost</th><th style="width:10%">Annual depr</th><th style="width:11%">Accumulated</th><th style="width:9%">Book value</th><th style="width:8%">Used</th><th style="width:13%">This month</th><th style="width:6%"></th></tr></thead><tbody>'+rows+'</tbody></table>'
    :ES('No fixed assets','Track equipment, vehicles, and property for depreciation.',"ASSET_EI=-1;openM('m-asset')"))
    +_rptDisclaimer('Depreciation figures are estimates for bookkeeping reference only (SL, DDB, and MACRS half-year convention). They may differ from deductions allowed on your tax return. Section 179 and bonus depreciation are not computed. Consult a CPA before claiming depreciation on any tax filing.')
    +'</div></div>';
}

// ── ESTIMATED QUARTERLY TAXES ─────────────────────────────────────────────────
function renderEstTaxRpt(){
  var c=gc();if(!c)return;var el=g('rpt-esttax');if(!el)return;
  if(c.type==='np'){el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Estimated Quarterly Taxes</div><div style="color:var(--muted);font-size:12px">Not applicable for nonprofit organizations.</div></div>';return;}
  var fy=getFiscalYear(c);
  var allInc=(c.type==='sb'?c.revenue:c.income)||[];
  var allExp=c.expenses||[];
  var grossInc=allInc.filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}).reduce(function(s,r){return s+basisInc(c,r);},0);
  var grossExp=allExp.filter(function(e){return!e.deleted&&!e.voided&&!e.isReversal;}).reduce(function(s,e){return s+Number(e.amt||0);},0);
  var netProfit=grossInc-grossExp;
  // SE tax: 92.35% of net × 15.3% (capped at $168,600 for SS portion)
  var seSelf=Math.max(0,netProfit)*0.9235;
  var seTax=Math.min(seSelf,168600)*0.153+(seSelf>168600?(seSelf-168600)*0.029:0);
  var seDed=seTax/2;// SE tax deduction
  var agi=Math.max(0,netProfit-seDed);
  // Federal income tax — 2024 single brackets (conservative estimate)
  function fedTax(income){if(income<=11600)return income*0.10;if(income<=47150)return 1160+(income-11600)*0.12;if(income<=100525)return 5426+(income-47150)*0.22;if(income<=191950)return 17168.5+(income-100525)*0.24;if(income<=243725)return 39110.5+(income-191950)*0.32;if(income<=609350)return 55678.5+(income-243725)*0.35;return 183647.25+(income-609350)*0.37;}
  var fedEst=Math.max(0,fedTax(agi));
  var totalEst=seTax+fedEst;
  var qtrAmt=totalEst/4;
  var dueDates=[['Q1','April 15, 2025'],['Q2','June 16, 2025'],['Q3','September 15, 2025'],['Q4','January 15, 2026']];
  var qRows=dueDates.map(function(q){return'<tr><td style="font-weight:500">'+q[0]+'</td><td style="color:var(--muted)">'+q[1]+'</td><td style="font-weight:600;color:var(--amber)">'+fmt(qtrAmt)+'</td></tr>';}).join('');
  el.innerHTML='<div class="rpt-sec"><div style="display:flex;align-items:center;gap:12px;margin-bottom:1rem"><div class="rpt-ttl" style="margin-bottom:0">Estimated Quarterly Taxes</div><span class="badge b-gray" style="font-size:10px">IRS Form 1040-ES</span></div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem;margin-bottom:1rem">'
    +'<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Net profit (YTD)</div><div style="font-weight:700;font-size:18px;color:'+(netProfit>=0?'var(--green)':'var(--red)')+'">'+fmt(netProfit)+'</div></div>'
    +'<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">SE tax (15.3%)</div><div style="font-weight:700;font-size:18px">'+fmt(seTax)+'</div></div>'
    +'<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Federal income tax</div><div style="font-weight:700;font-size:18px">'+fmt(fedEst)+'</div></div>'
    +'<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Est. quarterly payment</div><div style="font-weight:700;font-size:20px;color:var(--amber)">'+fmt(qtrAmt)+'</div></div>'
    +'</div>'
    +'<div class="card"><div class="c-title" style="margin-bottom:.75rem">2025 Payment schedule</div>'
    +'<table><thead><tr><th>Quarter</th><th>Due date</th><th>Amount due</th></tr></thead><tbody>'+qRows+'</tbody></table>'
    +'<div style="margin-top:.75rem;font-size:11px;color:var(--muted);line-height:1.6">⚠ This is an estimate using 2024 federal tax brackets for a single filer, based on data entered in Clarity. State income taxes are not included. Consult a CPA before making payments. Safe harbor: pay 100% of prior year tax liability to avoid underpayment penalty.</div>'
    +'</div></div>';
}

// ── LOAN AMORTIZATION REPORT ─────────────────────────────────────────────────
var _loanRptIdx=0;
function renderLoansRpt(){
  var c=gc();if(!c)return;var el=g('rpt-loans');if(!el)return;
  var loans=c.loans||[];
  if(!loans.length){
    el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Loan Amortization</div>'
      +'<div style="color:var(--muted);font-size:12px;margin-bottom:1rem">No loans yet. Add a loan to generate an interactive amortization schedule.</div>'
      +'<button class="add-btn" onclick="LOAN_EI=-1;openM(\'m-loan\')">+ Add loan</button></div>';
    return;
  }
  if(_loanRptIdx>=loans.length)_loanRptIdx=0;
  var loan=loans[_loanRptIdx];
  var principal=Number(loan.principal||0);
  var rate=Number(loan.rate||0);
  var term=Number(loan.term||12);
  var posted=loan.posted||[];
  var extra=Number(g('loan-extra-pmt')&&g('loan-extra-pmt').value||0);

  // Build amortization with optional extra payment
  function buildSchedule(extraPmt){
    var mo=rate/100/12;
    var pmt=mo===0?principal/term:principal*(mo*Math.pow(1+mo,term))/(Math.pow(1+mo,term)-1);
    var bal=principal;var rows=[];var totalInt=0;
    for(var i=1;i<=term&&bal>0.005;i++){
      var int=bal*mo;var prin=Math.min(bal,pmt-int+extraPmt);
      if(i===term||bal-prin<0.005)prin=bal;
      bal=Math.max(0,bal-prin);
      totalInt+=int;
      var dueDate='';
      if(loan.startDate){var dd=parseDate(loan.startDate);if(dd){dd.setMonth(dd.getMonth()+i);dueDate=(dd.getMonth()+1).toString().padStart(2,'0')+'/'+dd.getDate().toString().padStart(2,'0')+'/'+dd.getFullYear();}}
      rows.push({num:i,payment:pmt+extraPmt,interest:int,principal:prin,balance:bal,dueDate:dueDate});
      if(bal<=0.005)break;
    }
    return{rows:rows,totalInt:totalInt,payment:pmt};
  }

  var sched=buildSchedule(extra);
  var schedBase=buildSchedule(0);
  var intSaved=extra>0?Math.max(0,schedBase.totalInt-sched.totalInt):0;
  var pymtsSaved=extra>0?schedBase.rows.length-sched.rows.length:0;

  // Summary tiles
  var remaining=principal-sched.rows.filter(function(r){return posted.indexOf(r.num)>=0;}).reduce(function(s,r){return s+r.principal;},0);
  var paidPrin=principal-remaining;
  var paidPct=principal>0?Math.round((paidPrin/principal)*100):0;

  var loanTabs=loans.map(function(l,i){
    return'<button onclick="_loanRptIdx='+i+';renderLoansRpt()" style="padding:5px 12px;font-size:12px;border-radius:6px;border:1px solid var(--border);cursor:pointer;background:'+(i===_loanRptIdx?'var(--np)':'var(--surface)')+';color:'+(i===_loanRptIdx?'#fff':'var(--text)')+'">'+escHtml(l.name)+'</button>';
  }).join('');

  // Table rows
  var rows=sched.rows.map(function(r){
    var isPosted=posted.indexOf(r.num)>=0;
    return'<tr style="'+(isPosted?'opacity:.5':'')+'"><td style="color:var(--muted);font-size:11px">#'+r.num+(r.dueDate?' · '+r.dueDate:'')+'</td>'
      +'<td style="font-weight:500">'+fmt(r.payment)+'</td>'
      +'<td style="color:var(--red)">'+fmt(r.interest)+'</td>'
      +'<td style="color:var(--blue)">'+fmt(r.principal)+'</td>'
      +'<td>'+fmt(r.balance)+'</td>'
      +'<td><div class="row-acts">'
      +(isPosted
        ?'<span class="badge b-green" style="font-size:10px">Posted ✓</span>'
        :'<button class="add-btn" style="font-size:10px;padding:3px 8px" onclick="loanPostPayment('+_loanRptIdx+','+r.num+','+r.interest.toFixed(2)+','+r.principal.toFixed(2)+')" title="Post this payment to expenses and journal">Post</button>')
      +'</div></td></tr>';
  }).join('');

  el.innerHTML='<div class="rpt-sec">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem">'
    +'<div class="rpt-ttl" style="margin-bottom:0">Loan Amortization</div>'
    +'<button class="add-btn" onclick="LOAN_EI=-1;openM(\'m-loan\')">+ Add loan</button>'
    +'</div>'
    // Loan tabs
    +(loans.length>1?'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:1rem">'+loanTabs+'</div>':'')
    // Summary tiles
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.75rem;margin-bottom:1.25rem">'
    +'<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Original principal</div><div style="font-weight:700;font-size:18px">'+fmt(principal)+'</div></div>'
    +'<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Remaining balance</div><div style="font-weight:700;font-size:18px;color:var(--red)">'+fmt(remaining)+'</div><div style="font-size:10px;color:var(--muted);margin-top:3px"><div class="pbar" style="height:5px;margin-top:4px"><div class="pfill" style="width:'+paidPct+'%;background:var(--green)"></div></div>'+paidPct+'% paid</div></div>'
    +'<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Monthly payment</div><div style="font-weight:700;font-size:18px;color:var(--blue)">'+fmt(sched.payment)+'</div></div>'
    +'<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Total interest</div><div style="font-weight:700;font-size:18px;color:var(--amber)">'+fmt(sched.totalInt)+'</div></div>'
    +'<div class="card" style="margin:0;padding:.75rem"><div style="font-size:11px;color:var(--muted)">Rate / Term</div><div style="font-weight:700;font-size:16px">'+rate+'% · '+term+'mo</div></div>'
    +'</div>'
    // Payoff simulator
    +'<div class="card" style="margin-bottom:1.25rem;border-left:3px solid var(--green)">'
    +'<div class="c-title" style="margin-bottom:.75rem">💡 Payoff simulator — extra monthly payment</div>'
    +'<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">'
    +'<input type="range" id="loan-extra-pmt" min="0" max="'+Math.round(sched.payment*2)+'" step="25" value="'+extra+'" oninput="g(\'loan-extra-val\').textContent=\'$\'+Number(this.value).toLocaleString();renderLoansRpt()" style="flex:1;min-width:180px">'
    +'<span id="loan-extra-val" style="font-weight:700;font-size:15px;min-width:60px">'+fmt(extra)+'</span>'
    +'</div>'
    +(extra>0
      ?'<div style="display:flex;gap:1.5rem;margin-top:.75rem;flex-wrap:wrap">'
        +'<span style="font-size:13px;color:var(--green)">✓ Pay off in <strong>'+sched.rows.length+' months</strong> (save '+pymtsSaved+' payments)</span>'
        +'<span style="font-size:13px;color:var(--green)">✓ Interest saved: <strong>'+fmt(intSaved)+'</strong></span>'
        +'</div>'
      :'<div style="font-size:12px;color:var(--muted);margin-top:.5rem">Drag to see how extra principal payments accelerate payoff and reduce total interest.</div>')
    +'</div>'
    // Schedule table
    +'<div class="card"><div class="c-head"><span class="c-title">Payment schedule</span>'
    +'<div style="display:flex;gap:6px">'
    +'<button class="e-btn" style="border:1px solid var(--border);border-radius:7px;padding:4px 10px;font-size:12px" onclick="LOAN_EI='+_loanRptIdx+';openM(\'m-loan\')" title="Edit loan">&#9998;</button>'
    +'<button class="d-btn" style="border:1px solid var(--red-bg);border-radius:7px;padding:4px 10px;font-size:12px" onclick="loanDel('+_loanRptIdx+')" title="Delete loan">&#215;</button>'
    +'</div></div>'
    +'<div style="max-height:380px;overflow-y:auto">'
    +'<table><thead><tr><th style="width:22%">Payment</th><th style="width:14%">Total</th><th style="width:14%">Interest</th><th style="width:14%">Principal</th><th style="width:14%">Balance</th><th style="width:22%"></th></tr></thead><tbody>'+rows+'</tbody></table>'
    +'</div>'
    +'<div style="font-size:11px;color:var(--muted);margin-top:.5rem;padding-top:.5rem;border-top:1px solid var(--soft)">Posting a payment books interest to expenses (acct 5700) and records principal reduction as a journal entry against your loan liability account.</div>'
    +'</div>'
    +'</div>';
}

function loanPostPayment(li,num,interest,principal){
  var c=gc();if(!c||!c.loans[li])return;
  var loan=c.loans[li];
  if(!confirm('Post payment #'+num+' for '+escHtml(loan.name)+'?\n\nInterest: '+fmt(interest)+' → Expense (5700)\nPrincipal: '+fmt(principal)+' → Reduces loan liability'))return;
  if(!c.expenses)c.expenses=[];
  if(!c.journalEntries)c.journalEntries=[];
  var date=todayNum();
  // Post interest to expenses
  if(interest>0.01)c.expenses.push({id:uid(),desc:'Loan interest — '+loan.name+' pmt #'+num,cat:'Interest expense',amt:Number(interest.toFixed(2)),date:date,acctCode:'5700',reconciled:false,recurring:'None',freq:'One-time',fixed:'Fixed',loanId:loan.id});
  // Journal entry: Dr Loan Payable / Cr Cash (principal)
  c.journalEntries.push({id:uid(),date:date,type:'Loan payment',memo:'Principal — '+loan.name+' pmt #'+num,debitAcct:loan.acctCode||'2200',creditAcct:'Cash',amt:Number(principal.toFixed(2)),notes:'Auto-posted from loan schedule'});
  if(!loan.posted)loan.posted=[];
  loan.posted.push(num);
  sv();renderLoansRpt();renderReports();
}

function loanDel(li){
  var c=gc();if(!c||!c.loans[li])return;
  if(!confirm('Delete '+c.loans[li].name+' and its amortization schedule?'))return;
  c.loans.splice(li,1);
  _loanRptIdx=c.loans.length?Math.max(0,li-1):0;
  sv();renderLoansRpt();
}

// ── FUNCTIONAL EXPENSE ALLOCATION ───────────────────────────────────────────
var ALLOC_EI=-1;
function openAllocModal(i){
  var c=gc();if(!c||!c.expenses[i])return;
  ALLOC_EI=i;var e=c.expenses[i];
  var descEl=g('alloc-desc');if(descEl)descEl.textContent=e.desc||e.cat||'Expense';
  var amtEl=g('alloc-amt');if(amtEl)amtEl.textContent='Total: '+fmt(e.amt);
  // Pre-fill from existing split or single functional value
  var sp=e.functionalSplit||[];
  var prog=sp.length?(sp.find(function(s){return s.type==='program';})||{pct:0}).pct:(e.functional==='program'?100:0);
  var mgmt=sp.length?(sp.find(function(s){return s.type==='management';})||{pct:0}).pct:(e.functional==='management'?100:0);
  var fund=sp.length?(sp.find(function(s){return s.type==='fundraising';})||{pct:0}).pct:(e.functional==='fundraising'?100:0);
  if(g('alloc-prog'))g('alloc-prog').value=prog;
  if(g('alloc-mgmt'))g('alloc-mgmt').value=mgmt;
  if(g('alloc-fund'))g('alloc-fund').value=fund;
  allocPctCheck();
  openM('m-alloc');
}
function allocPctCheck(){
  var prog=Number(g('alloc-prog')&&g('alloc-prog').value||0);
  var mgmt=Number(g('alloc-mgmt')&&g('alloc-mgmt').value||0);
  var fund=Number(g('alloc-fund')&&g('alloc-fund').value||0);
  var total=prog+mgmt+fund;
  var warn=g('alloc-warn');if(warn)warn.style.display=(total!==100&&total!==0)?'block':'none';
  var prev=g('alloc-preview');
  if(prev&&total>0){
    var c=gc();var amt=c&&ALLOC_EI>=0?Number(c.expenses[ALLOC_EI].amt||0):0;
    prev.textContent='Program: '+fmt(amt*prog/100)+' · Mgmt: '+fmt(amt*mgmt/100)+' · Fundraising: '+fmt(amt*fund/100);
  }else if(prev){prev.textContent='';}
}
function saveAlloc(){
  var c=gc();if(!c||ALLOC_EI<0||!c.expenses[ALLOC_EI])return;
  var prog=Number(g('alloc-prog')&&g('alloc-prog').value||0);
  var mgmt=Number(g('alloc-mgmt')&&g('alloc-mgmt').value||0);
  var fund=Number(g('alloc-fund')&&g('alloc-fund').value||0);
  var total=prog+mgmt+fund;
  if(total!==100){alert('Percentages must total 100%. Current total: '+total+'%');return;}
  var split=[];
  if(prog>0)split.push({type:'program',pct:prog});
  if(mgmt>0)split.push({type:'management',pct:mgmt});
  if(fund>0)split.push({type:'fundraising',pct:fund});
  c.expenses[ALLOC_EI].functionalSplit=split;
  // Set functional to dominant type for backward compat
  var dom=split.reduce(function(a,b){return b.pct>a.pct?b:a;},{type:'',pct:0});
  c.expenses[ALLOC_EI].functional=dom.type;
  sv();renderNpExp(c);renderReports();closeM('m-alloc');ALLOC_EI=-1;
}
function clearAlloc(){
  var c=gc();if(!c||ALLOC_EI<0||!c.expenses[ALLOC_EI])return;
  delete c.expenses[ALLOC_EI].functionalSplit;
  sv();renderNpExp(c);renderReports();closeM('m-alloc');ALLOC_EI=-1;
}

// ── RESTRICTION RELEASES ────────────────────────────────────────────────────
// ── INTERFUND TRANSFERS ─────────────────────────────────────────────────────
function openTransferModal(){
  var c=gc();if(!c)return;
  var funds=(c.funds||[]);
  if(funds.length<2){alert('You need at least two funds to record a transfer. Add funds under the Funds tab.');return;}
  var opts=funds.map(function(f){return'<option value="'+escHtml(f.name)+'">'+escHtml(f.name)+' ('+f.type+')</option>';}).join('');
  var fs=g('xfr-from');if(fs)fs.innerHTML=opts;
  var ts=g('xfr-to');if(ts)ts.innerHTML=opts;
  ['xfr-date','xfr-amt','xfr-note'].forEach(function(id){var el=g(id);if(el)el.value='';});
  openM('m-transfer');
}

function saveTransfer(){
  var c=gc();if(!c)return;
  // PERIOD LOCK GUARD
  var _xfrLockDate=g('xfr-date')&&g('xfr-date').value.trim();
  if(_xfrLockDate&&isDateLocked(c,_xfrLockDate)){periodLockAlert(c.closedThrough);return;}
  var fromFund=g('xfr-from')&&g('xfr-from').value;
  var toFund=g('xfr-to')&&g('xfr-to').value;
  var dateVal=g('xfr-date')&&g('xfr-date').value.trim();
  var amt=Number(g('xfr-amt')&&g('xfr-amt').value||0);
  var note=g('xfr-note')&&g('xfr-note').value.trim()||'';
  if(!fromFund||!toFund){alert('Please select both funds.');return;}
  if(fromFund===toFund){alert('From and To funds must be different.');return;}
  if(!dateVal){alert('Please enter a transfer date.');return;}
  if(!amt||amt<=0){alert('Please enter a valid amount.');return;}
  if(!c.fundTransfers)c.fundTransfers=[];
  c.fundTransfers.push({id:uid(),fromFund:fromFund,toFund:toFund,date:dateVal,amount:amt,note:note,createdAt:new Date().toISOString()});
  sv();closeM('m-transfer');renderReports();
}

function deleteTransfer(ti){
  var c=gc();if(!c||!c.fundTransfers||!c.fundTransfers[ti])return;
  if(!confirm('Remove this transfer? This cannot be undone.'))return;
  c.fundTransfers.splice(ti,1);
  sv();renderReports();
}

function openReleaseModal(){
  var c=gc();if(!c)return;
  var funds=(c.funds||[]).filter(function(f){return f.type==='Restricted'||f.type==='Permanently Restricted'||f.type==='Endowment';});
  if(!funds.length){alert('No restricted or endowment funds found. Add a restricted fund first under the Funds tab.');return;}
  // Populate from-fund dropdown (restricted funds only)
  var fromOpts=funds.map(function(f){return'<option value="'+escHtml(f.name)+'">'+escHtml(f.name)+' ('+f.type+')</option>';}).join('');
  var rel=g('rel-fund');if(rel)rel.innerHTML=fromOpts;
  // Populate to-fund dropdown (unrestricted funds + blank)
  var toFunds=(c.funds||[]).filter(function(f){return f.type==='Unrestricted';});
  var toOpts='<option value="">— General unrestricted —</option>'+toFunds.map(function(f){return'<option value="'+escHtml(f.name)+'">'+escHtml(f.name)+'</option>';}).join('');
  var rel2=g('rel-to-fund');if(rel2)rel2.innerHTML=toOpts;
  // Clear fields
  ['rel-date','rel-amt','rel-note'].forEach(function(id){var el=g(id);if(el)el.value='';});
  var w=g('rel-warn');if(w)w.style.display='none';
  openM('m-release');
}

function saveRelease(){
  var c=gc();if(!c)return;
  // PERIOD LOCK GUARD
  var _relLockDate=g('rel-date')&&g('rel-date').value.trim();
  if(_relLockDate&&isDateLocked(c,_relLockDate)){periodLockAlert(c.closedThrough);return;}
  var fundName=g('rel-fund')&&g('rel-fund').value;
  var dateVal=g('rel-date')&&g('rel-date').value.trim();
  var amt=Number(g('rel-amt')&&g('rel-amt').value||0);
  var note=g('rel-note')&&g('rel-note').value.trim();
  var toFund=g('rel-to-fund')&&g('rel-to-fund').value||'';
  if(!fundName){alert('Please select a fund.');return;}
  if(!dateVal){alert('Please enter a release date.');return;}
  if(!amt||amt<=0){alert('Please enter a valid amount.');return;}
  if(!note){alert('Please enter a note describing the purpose of this release.');return;}
  // Warn if release exceeds available restricted balance
  var fy=getFiscalYear(c.fiscalYearEnd);
  var fundInc=(c.income||[]).filter(function(r){return r.fund===fundName&&!r.deleted&&!r.voided;}).reduce(function(s,r){return s+Number(r.recv||0);},0);
  var fundExp=(c.expenses||[]).filter(function(e){return e.fund===fundName&&!e.deleted&&!e.voided;}).reduce(function(s,e){return s+Number(e.amt||0);},0);
  var prevReleased=(c.restrictionReleases||[]).filter(function(r){return r.fundName===fundName;}).reduce(function(s,r){return s+Number(r.amount||0);},0);
  var available=fundInc-fundExp-prevReleased;
  var warn=g('rel-warn');
  if(amt>available&&available>=0){
    if(!confirm('⚠ Release amount ('+fmt(amt)+') exceeds the available restricted balance for '+fundName+' ('+fmt(available)+'). This may indicate expenses haven\'t been recorded yet.\nProceed anyway?'))return;
  }
  if(!c.restrictionReleases)c.restrictionReleases=[];
  c.restrictionReleases.push({
    id:uid(),
    fundName:fundName,
    toFund:toFund,
    date:dateVal,
    amount:amt,
    note:note,
    createdAt:new Date().toISOString()
  });
  sv();closeM('m-release');renderReports();
}

function deleteRelease(ri){
  var c=gc();if(!c||!c.restrictionReleases||!c.restrictionReleases[ri])return;
  if(!confirm('Remove this restriction release? This cannot be undone.'))return;
  c.restrictionReleases.splice(ri,1);
  sv();renderReports();
}

function renderFundPLRpt(){
  var c=gc();if(!c)return;var el=g('rpt-fundpl');if(!el)return;
  var funds=(c.funds||[]);
  if(!funds.length){
    el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Fund P&L</div><div style="color:var(--muted);font-size:12px;padding:1rem 0">No funds defined yet. <button class="add-btn" style="font-size:11px" onclick="FUND_EI=-1;resetFundForm();openM(\'m-fund\')">+ Add a fund</button></div></div>';return;
  }
  var allInc=(c.income||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;});var allExp=(c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;});
  // Build totals per fund
  var fundData={};
  // Unassigned bucket
  funds.concat([{name:'',_unassigned:true}]).forEach(function(f){
    var fname=f.name;
    var iT=allInc.filter(function(r){return(r.fund||'')=== fname;}).reduce(function(s,r){return s+basisInc(c,r);},0);
    var eT=allExp.filter(function(e){return(e.fund||'')=== fname;}).reduce(function(s,e){return s+Number(e.amt||0);},0);
    // Grant income is recognized through c.income[] entries (linked via grantId), already counted above
    fundData[fname]={f:f,iT:iT,eT:eT,net:iT-eT};
  });
  var html='<div class="rpt-sec"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem"><div class="rpt-ttl" style="margin-bottom:0">Fund P&L</div></div>';
  // Summary tiles
  var allFunds=funds.concat([{name:'',_unassigned:true,type:'Unassigned'}]);
  html+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem;margin-bottom:1.5rem">';
  allFunds.forEach(function(f){
    var d=fundData[f.name];if(!d)return;
    if(!d.iT&&!d.eT)return; // skip empty funds
    var net=d.iT-d.eT;
    var label=f.name||'Unassigned';
    var typeBadge=f.type?'<span class="badge '+(f.type==='Restricted'?'b-amber':f.type==='Capital'?'b-blue':'b-green')+'">'+f.type+'</span>':'';
    html+='<div class="card" style="margin:0;padding:.75rem">'
      +'<div style="font-weight:600;font-size:13px;margin-bottom:4px">'+label+'</div>'
      +(typeBadge?'<div style="margin-bottom:.4rem">'+typeBadge+'</div>':'')
      +'<div style="font-size:11px;color:var(--muted)">Income</div><div style="font-weight:500;color:var(--green)">'+fmt(d.iT)+'</div>'
      +'<div style="font-size:11px;color:var(--muted);margin-top:.25rem">Expenses</div><div style="font-weight:500;color:var(--red)">'+fmt(d.eT)+'</div>'
      +'<div style="border-top:1px solid var(--border);margin-top:.5rem;padding-top:.5rem;font-size:11px;color:var(--muted)">Net</div>'
      +'<div style="font-weight:700;font-size:16px;color:'+(net>=0?'var(--green)':'var(--red)')+'">'+fmt(net)+'</div>'
      +'</div>';
  });
  html+='</div>';
  // Detail table per fund
  allFunds.forEach(function(f){
    var d=fundData[f.name];if(!d||(!d.iT&&!d.eT))return;
    var label=f.name||'Unassigned';
    var incRows=allInc.filter(function(r){return(r.fund||'')===(f.name||'');}).map(function(r){return'<div class="rpt-row"><span>'+escHtml(r.name||r.cat||'Income')+'</span><span class="vg">'+fmt(basisInc(c,r))+'</span></div>';}).join('');
    var expRows=allExp.filter(function(e){return(e.fund||'')===(f.name||'');}).map(function(e){return'<div class="rpt-row"><span>'+escHtml(e.desc||e.cat||'Expense')+'</span><span class="vr">'+fmt(e.amt||0)+'</span></div>';}).join('');
    html+='<div style="margin-bottom:1.5rem"><div class="rpt-ttl" style="margin-bottom:.5rem">'+label+' — Detail</div>'
      +'<div class="rpt-sec"><div style="font-size:11px;font-weight:500;color:var(--muted);margin-bottom:.25rem">Income</div>'+(incRows||'<div style="font-size:11px;color:var(--muted)">None</div>')+rptTotal('Total income',d.iT,'vg')+'</div>'
      +'<div class="rpt-sec"><div style="font-size:11px;font-weight:500;color:var(--muted);margin-bottom:.25rem">Expenses</div>'+(expRows||'<div style="font-size:11px;color:var(--muted)">None</div>')+rptTotal('Total expenses',d.eT,'vr')+'</div>'
      +'<div class="rpt-sec">'+rptTotal('Net '+(d.net>=0?'surplus':'deficit'),Math.abs(d.net),d.net>=0?'vg':'vr')+'</div></div>';
  });
  // ── Restriction releases (GAAP ASC 958-205) ─────────────────────────
  // Show for Restricted, Permanently Restricted, and Endowment funds.
  // Capital funds omitted unless separately identified as donor-restricted.
  var RELEASE_TYPES=['Restricted','Permanently Restricted','Endowment'];
  var hasReleaseFunds=funds.some(function(f){return RELEASE_TYPES.indexOf(f.type)>=0;});
  var releases=(c.restrictionReleases||[]);
  if(hasReleaseFunds){
    html+='<div class="rpt-sec" style="margin-top:1rem">';
    html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">';
    html+='<div class="rpt-ttl" style="margin-bottom:0">Restriction Releases</div>';
    html+='<button class="add-btn" onclick="openReleaseModal()">+ Record release</button>';
    html+='</div>';
    if(releases.length){
      html+='<table><thead><tr><th style="width:15%">Date</th><th style="width:25%">Fund</th><th style="width:15%">Amount</th><th style="width:35%">Note</th><th style="width:10%"></th></tr></thead><tbody>';
      html+=releases.map(function(r,ri){
        return'<tr><td style="color:var(--muted)">'+(r.date||'—')+'</td><td>'+r.fundName+'</td><td class="vg">'+fmt(r.amount)+'</td><td style="font-size:12px;color:var(--muted)">'+(r.note||'—')+'</td>'
          +'<td><button class="add-btn" style="padding:2px 8px;font-size:11px;background:var(--red);color:#fff;border:none" onclick="deleteRelease('+ri+')">Remove</button></td></tr>';
      }).join('');
      html+='</tbody></table>';
      var relTotal=releases.reduce(function(s,r){return s+Number(r.amount||0);},0);
      html+='<div class="rpt-row" style="margin-top:.5rem;font-weight:600"><span>Total released to unrestricted</span><span class="vg">'+fmt(relTotal)+'</span></div>';
    }else{
      html+='<div style="font-size:12px;color:var(--muted);padding:.5rem 0">No releases recorded yet. When restricted or endowment funds are spent per donor intent, record a release here to reclassify net assets from restricted to unrestricted (GAAP ASC 958-205). Note: Capital funds should record releases here only if subject to explicit donor restrictions.</div>';
    }
    html+='</div>';
  }
  // ── Interfund transfers ───────────────────────────────────────────────
  var transfers=(c.fundTransfers||[]);
  html+='<div class="rpt-sec" style="margin-top:1rem">';
  html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">';
  html+='<div class="rpt-ttl" style="margin-bottom:0">Interfund Transfers</div>';
  html+='<button class="add-btn" onclick="openTransferModal()">+ Record transfer</button>';
  html+='</div>';
  if(transfers.length){
    html+='<table><thead><tr><th style="width:13%">Date</th><th style="width:22%">From</th><th style="width:22%">To</th><th style="width:13%">Amount</th><th style="width:25%">Note</th><th style="width:5%"></th></tr></thead><tbody>';
    html+=transfers.map(function(t,ti){
      return'<tr><td style="color:var(--muted);font-size:11px">'+(t.date||'—')+'</td><td>'+escHtml(t.fromFund)+'</td><td>'+escHtml(t.toFund)+'</td><td class="vb">'+fmt(t.amount)+'</td><td style="font-size:11px;color:var(--muted)">'+escHtml(t.note||'—')+'</td>'
        +'<td><button class="add-btn" style="padding:2px 8px;font-size:11px;background:var(--red);color:#fff;border:none" title="Remove transfer" onclick="deleteTransfer('+ti+')">✕</button></td></tr>';
    }).join('');
    html+='</tbody></table>';
  }else{
    html+='<div style="font-size:12px;color:var(--muted);padding:.5rem 0">No transfers recorded yet. Use transfers to move money between funds (e.g. board-approved transfer to capital reserve) without creating income or expense entries.</div>';
  }
  html+='</div>';
  html+='</div>';
  el.innerHTML=html;
}

function renderBudgetMultiRpt(){
  var c=gc();if(!c)return;var el=g('rpt-budgetmulti');if(!el)return;
  var adopted=c.adoptedBudgets||[];
  var proposed=c.proposedBudgets||[];
  var curYear=new Date().getFullYear();
  if(!adopted.length&&!(c.budgetItems||[]).length&&!proposed.length){
    el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Multi-year Budget</div><div style="color:var(--muted);font-size:12px">No budget history yet.</div></div>';return;
  }
  // Build actuals by category for current FY
  var actI={},actE={};
  if(c.type==='np'){(c.income||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}).forEach(function(r){actI[r.cat||'Other']=(actI[r.cat||'Other']||0)+basisInc(c,r);});(c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}).forEach(function(e){actE[e.cat||'Other']=(actE[e.cat||'Other']||0)+Number(e.amt||0);});}
  else if(c.type==='sb'){(c.revenue||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}).forEach(function(r){actI[r.cat||'Other']=(actI[r.cat||'Other']||0)+basisInc(c,r);});(c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}).forEach(function(e){actE[e.cat||'Other']=(actE[e.cat||'Other']||0)+Number(e.amt||0);});}
  else{(c.income||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}).forEach(function(r){actI[r.cat||'Other']=(actI[r.cat||'Other']||0)+Number(r.amt||0);});(c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}).forEach(function(e){actE[e.cat||'Other']=(actE[e.cat||'Other']||0)+Number(e.amt||0);});}

  // Columns: adopted years (oldest→newest) + current (budget + actual) + proposed years
  var cols=[];
  adopted.slice().sort(function(a,b){return(a.fy||'').localeCompare(b.fy||'');}).forEach(function(ab){cols.push({label:ab.fy,items:ab.items,actual:null});});
  var fy=getFiscalYear(c.fiscalYearEnd);
  cols.push({label:fy.label+' Budget',items:c.budgetItems||[],actual:null});
  cols.push({label:fy.label+' Actual',items:null,actual:{i:actI,e:actE}});
  proposed.slice().sort(function(a,b){return(a.fy||'').localeCompare(b.fy||'');}).forEach(function(pb){cols.push({label:pb.fy+' (proposed)',items:pb.items,actual:null});});

  // Collect all unique line items
  var allCats={};
  cols.forEach(function(col){(col.items||[]).forEach(function(b){allCats[b.group+'|'+b.cat+':'+b.type]={group:b.group||b.type,cat:b.cat,type:b.type};});});
  if(cols.find(function(col){return col.actual;})){Object.keys(actI).forEach(function(k){if(!allCats['Income|'+k+':Income'])allCats['Income|'+k+':Income']={group:'Income',cat:k,type:'Income'};});Object.keys(actE).forEach(function(k){if(!allCats['Expense|'+k+':Expense'])allCats['Expense|'+k+':Expense']={group:'Expense',cat:k,type:'Expense'};});}

  var ths='<th style="width:22%">Line item</th>'+cols.map(function(col){return'<th style="text-align:right;font-size:11px">'+col.label+'</th>';}).join('');

  // Group rows
  var groups={};
  Object.values(allCats).forEach(function(b){if(!groups[b.group])groups[b.group]=[];if(!groups[b.group].find(function(x){return x.cat===b.cat&&x.type===b.type;}))groups[b.group].push(b);});

  var html=Object.keys(groups).map(function(grpName){
    var items=groups[grpName];
    var isExp=items.every(function(b){return b.type==='Expense';});
    var grpTots=cols.map(function(){return 0;});
    var rows=items.map(function(b){
      var cells=cols.map(function(col,ci){
        var val=0;
        if(col.actual){val=b.type==='Income'?(col.actual.i[b.cat]||0):(col.actual.e[b.cat]||0);}
        else{var found=(col.items||[]).find(function(x){return x.cat===b.cat&&x.type===b.type;});val=found?Number(found.amt||0):null;}
        grpTots[ci]+=(val||0);
        return'<td style="text-align:right">'+(val===null?'<span style="color:var(--muted)">—</span>':fmt(val))+'</td>';
      }).join('');
      return'<tr><td style="padding-left:1rem;font-size:12px">'+b.cat+'</td>'+cells+'</tr>';
    }).join('');
    var totCells=grpTots.map(function(t){return'<td style="text-align:right;font-weight:500">'+fmt(t)+'</td>';}).join('');
    return'<tr style="background:var(--bg)"><td style="font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)" colspan="'+(cols.length+1)+'">'+grpName+'</td></tr>'
    +rows+'<tr class="bud-total"><td style="padding-left:.5rem">'+grpName+' total</td>'+totCells+'</tr>';
  }).join('');

  // Grand totals row
  var grandInc=cols.map(function(col){if(col.actual)return Object.values(col.actual.i).reduce(function(s,v){return s+v;},0);return(col.items||[]).filter(function(b){return b.type==='Income';}).reduce(function(s,b){return s+Number(b.amt||0);},0);});
  var grandExp=cols.map(function(col){if(col.actual)return Object.values(col.actual.e).reduce(function(s,v){return s+v;},0);return(col.items||[]).filter(function(b){return b.type==='Expense';}).reduce(function(s,b){return s+Number(b.amt||0);},0);});
  var nets=grandInc.map(function(i,ci){return i-grandExp[ci];});
  var netRow='<tr class="bud-net"><td>'+nl(c.type)+'</td>'+nets.map(function(n){return'<td style="text-align:right;font-weight:600" class="'+(n>=0?'vg':'vr')+'">'+fmt(n)+'</td>';}).join('')+'</tr>';

  el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Multi-year Budget Comparison</div>'
  +'<div style="overflow-x:auto"><table class="bud-tbl"><thead><tr>'+ths+'</tr></thead><tbody>'+html+netRow+'</tbody></table></div>'
  +'<div style="font-size:11px;color:var(--muted);margin-top:.75rem">Adopted years · Current year budget vs actuals · Proposed years shown side by side.</div></div>';
}
function renderBudgetTwoYrRpt(){
  var c=gc();if(!c)return;var el=g('rpt-budgettwoyr');if(!el)return;
  var curItems=c.budgetItems||[];
  var proposed=c.proposedBudgets||[];
  if(!curItems.length&&!proposed.length){el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Current + Proposed Budget</div><div style="color:var(--muted);font-size:12px">No budget items yet.</div></div>';return;}
  var fy=getFiscalYear(c.fiscalYearEnd);
  var sortedProp=proposed.slice().sort(function(a,b){return(a.fy||'').localeCompare(b.fy||'');});
  var nextProp=sortedProp[sortedProp.length-1]||null;
  var cols=[{label:fy.label+' (Current)',items:curItems}];
  if(nextProp)cols.push({label:nextProp.fy+' (Proposed)',items:nextProp.items||[]});
  var allCats={};
  cols.forEach(function(col){(col.items||[]).forEach(function(b){var key=b.group+'|'+b.cat+':'+b.type;if(!allCats[key])allCats[key]={group:b.group||b.type,cat:b.cat,type:b.type};});});
  var groups={};
  Object.values(allCats).forEach(function(b){if(!groups[b.group])groups[b.group]=[];if(!groups[b.group].find(function(x){return x.cat===b.cat&&x.type===b.type;}))groups[b.group].push(b);});
  Object.keys(groups).forEach(function(grp){groups[grp].sort(function(a,b){var aa=(c.accounts||[]).find(function(x){return x.cat===a.cat||x.name===a.cat;});var bb=(c.accounts||[]).find(function(x){return x.cat===b.cat||x.name===b.cat;});return((aa?aa.code:'zzz')).localeCompare(bb?bb.code:'zzz');});});
  var ths='<th style="width:28%">Line item</th><th style="width:10%">Code</th>'+cols.map(function(col){return'<th style="text-align:right">'+col.label+'</th>';}).join('')+(cols.length>1?'<th style="text-align:right">Change</th>':'');
  var grandInc=cols.map(function(){return 0;});var grandExp=cols.map(function(){return 0;});
  var html=Object.keys(groups).map(function(grpName){
    var items=groups[grpName];
    var grpTots=cols.map(function(){return 0;});
    var rows=items.map(function(b){
      var acct=(c.accounts||[]).find(function(a){return a.cat===b.cat||a.name===b.cat;});
      var codeCell='<td style="font-size:11px;color:var(--muted)">'+(acct?'<span style="font-family:monospace;background:var(--soft);padding:1px 4px;border-radius:3px">'+acct.code+'</span>':'—')+'</td>';
      var vals=cols.map(function(col,ci){var found=(col.items||[]).find(function(x){return x.cat===b.cat&&x.type===b.type;});var v=found?Number(found.amt||0):null;grpTots[ci]+=(v||0);if(b.type==='Income')grandInc[ci]+=(v||0);else grandExp[ci]+=(v||0);return v;});
      var cells=vals.map(function(v){return'<td style="text-align:right">'+(v===null?'<span style="color:var(--muted)">—</span>':fmt(v))+'</td>';}).join('');
      var changeCell='';if(cols.length>1){var d=( vals[1]||0)-(vals[0]||0);changeCell='<td style="text-align:right;font-size:12px" class="'+(d>0?'vg':d<0?'vr':'')+'">'+( d===0?'—':(d>0?'+':'')+fmt(d))+'</td>';}
      return'<tr><td style="padding-left:1rem;font-size:12px">'+b.cat+'</td>'+codeCell+cells+changeCell+'</tr>';
    }).join('');
    var totCells=grpTots.map(function(t){return'<td style="text-align:right;font-weight:500">'+fmt(t)+'</td>';}).join('');
    var totChange='';if(cols.length>1){var td=grpTots[1]-grpTots[0];totChange='<td style="text-align:right;font-weight:500" class="'+(td>0?'vg':td<0?'vr':'')+'">'+( td===0?'—':(td>0?'+':'')+fmt(td))+'</td>';}
    return'<tr style="background:var(--bg)"><td style="font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)" colspan="'+(cols.length+2+(cols.length>1?1:0))+'">'+grpName+'</td></tr>'+rows+'<tr class="bud-total"><td style="padding-left:.5rem">'+grpName+' total</td><td></td>'+totCells+totChange+'</tr>';
  }).join('');
  var nets=grandInc.map(function(i,ci){return i-grandExp[ci];});
  var netCells=nets.map(function(n){return'<td style="text-align:right;font-weight:600" class="'+(n>=0?'vg':'vr')+'">'+fmt(n)+'</td>';}).join('');
  var netChange='';if(cols.length>1){var nd=nets[1]-nets[0];netChange='<td style="text-align:right;font-weight:600" class="'+(nd>0?'vg':nd<0?'vr':'')+'">'+( nd===0?'—':(nd>0?'+':'')+fmt(nd))+'</td>';}
  el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Current + Proposed Budget</div>'+(nextProp?'':'<div style="font-size:11px;color:var(--amber);margin-bottom:.75rem">No proposed budget yet — showing current only.</div>')+'<div style="overflow-x:auto"><table class="bud-tbl"><thead><tr>'+ths+'</tr></thead><tbody>'+html+'<tr class="bud-net"><td>'+nl(c.type)+'</td><td></td>'+netCells+netChange+'</tr></tbody></table></div>'+(nextProp?'<div style="font-size:11px;color:var(--muted);margin-top:.75rem">Change = proposed vs current. Green = increase, red = decrease.</div>':'')+'</div>';
}
function renderBudgetExportRpt(){
  var c=gc();if(!c)return;var el=g('rpt-budgetexport');if(!el)return;
  var buds=c.budgetItems||[];
  if(!buds.length){el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Budget Summary</div><div style="color:var(--muted);font-size:12px">No budget items yet.</div></div>';return;}
  var groups={};buds.forEach(function(b){var g2=b.group||b.type;if(!groups[g2])groups[g2]=[];groups[g2].push(b);});
  var totInc=0,totExp=0;
  var html=Object.keys(groups).map(function(grp){
    var items=groups[grp];
    var isInc=items.some(function(b){return b.type==='Income';});
    var grpTot=items.reduce(function(s,b){return s+Number(b.amt||0);},0);
    if(isInc)totInc+=grpTot;else totExp+=grpTot;
    var rows=items.map(function(b){return'<div class="rpt-row"><span style="padding-left:1.25rem;color:var(--muted)">'+b.cat+'</span><span>'+fmt(b.amt)+'</span></div>';}).join('');
    return'<div style="margin-bottom:.5rem">'
    +'<div style="display:flex;justify-content:space-between;padding:7px 0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);border-top:1px solid var(--soft)"><span>'+grp+'</span></div>'
    +rows
    +'<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;font-weight:600;border-top:1px solid var(--soft)"><span style="padding-left:.5rem">'+grp+' total</span><span class="'+(isInc?'vg':'vr')+'">'+fmt(grpTot)+'</span></div>'
    +'</div>';
  }).join('');
  var net=totInc-totExp;
  el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Budget Summary</div>'+html
  +'<div style="margin-top:.75rem;padding-top:.75rem;border-top:2px solid var(--text)">'
  +'<div class="rpt-row"><span>Total '+il(c.type).toLowerCase()+'</span><span class="vg">'+fmt(totInc)+'</span></div>'
  +'<div class="rpt-row"><span>Total expenses</span><span class="vr">'+fmt(totExp)+'</span></div>'
  +'<div style="display:flex;justify-content:space-between;padding:10px 0;font-size:15px;font-weight:700;border-top:2px solid var(--text);margin-top:4px"><span>'+nl(c.type)+'</span><span class="'+(net>=0?'vg':'vr')+'">'+fmt(net)+'</span></div>'
  +'</div></div>';
}
function renderPLCompareRpt(){
  var c=gc();if(!c)return;var el=g('rpt-plcompare');if(!el)return;
  var fy=getFiscalYear(c.fiscalYearEnd);
  // Prior FY: pass a refDate one day before current FY start
  var priorRef=new Date(fy.start.getTime()-86400000);
  var priorFY=getFiscalYear(c.fiscalYearEnd,priorRef);

  function getAmts(items,amtKey,dateFilter){
    var iC={},eC={};
    items.forEach(function(r){
      var d=r.date||'';var dt=d?new Date(d):null;
      if(dateFilter&&dt&&(dt<dateFilter.start||dt>dateFilter.end))return;
      var k=r.cat||'Other';
      if(amtKey==='recv')iC[k]=(iC[k]||0)+basisInc(c,r);
      else if(amtKey==='act')iC[k]=(iC[k]||0)+basisInc(c,r);
      else if(amtKey==='amt_inc')iC[k]=(iC[k]||0)+Number(r.amt||0);
      else eC[k]=(eC[k]||0)+Number(r.amt||0);
    });
    return{inc:iC,exp:eC};
  }

  function buildTotals(fyFilter){
    var iC={},eC={};
    var addInc=function(k,v){iC[k]=(iC[k]||0)+v;};
    var addExp=function(k,v){eC[k]=(eC[k]||0)+v;};
    if(c.type==='np'){
      (c.income||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}).forEach(function(r){var d=r.date?new Date(r.date):null;if(fyFilter&&d&&(d<fyFilter.start||d>fyFilter.end))return;addInc(r.cat||'Other',basisInc(c,r));});
      // Grant income comes through c.income[] entries above — gr.awarded is a commitment, not recognized revenue
      (c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}).forEach(function(r){var d=r.date?new Date(r.date):null;if(fyFilter&&d&&(d<fyFilter.start||d>fyFilter.end))return;addExp(r.cat||'Other',Number(r.amt||0));});
    }else if(c.type==='sb'){
      (c.revenue||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}).forEach(function(r){var d=r.date?new Date(r.date):null;if(fyFilter&&d&&(d<fyFilter.start||d>fyFilter.end))return;addInc(r.cat||'Other',basisInc(c,r));});
      (c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}).forEach(function(r){var d=r.date?new Date(r.date):null;if(fyFilter&&d&&(d<fyFilter.start||d>fyFilter.end))return;addExp(r.cat||'Other',Number(r.amt||0));});
    }else{
      (c.income||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}).forEach(function(r){var d=r.date?new Date(r.date):null;if(fyFilter&&d&&(d<fyFilter.start||d>fyFilter.end))return;addInc(r.cat||'Other',Number(r.amt||0));});
      (c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;}).forEach(function(r){var d=r.date?new Date(r.date):null;if(fyFilter&&d&&(d<fyFilter.start||d>fyFilter.end))return;addExp(r.cat||'Other',Number(r.amt||0));});
    }
    return{inc:iC,exp:eC};
  }

  var cur=buildTotals(fy);
  var prior=buildTotals(priorFY);

  // Merge all keys
  var allInc=Object.keys(cur.inc).concat(Object.keys(prior.inc)).filter(function(k,i,a){return a.indexOf(k)===i;}).sort();
  var allExp=Object.keys(cur.exp).concat(Object.keys(prior.exp)).filter(function(k,i,a){return a.indexOf(k)===i;}).sort();

  function changeCell(c2,p){
    var d=c2-p;
    if(p===0&&c2===0)return'<td style="text-align:right;color:var(--muted)">—</td>';
    var pct=p!==0?Math.round((d/Math.abs(p))*100):null;
    var cls=d>=0?'vg':'vr';
    return'<td style="text-align:right" class="'+cls+'">'+(d>=0?'+':'')+fmt(d)+(pct!==null?' <span style="font-size:10px;opacity:.7">('+( d>=0?'+':'')+pct+'%)</span>':'')+'</td>';
  }

  function section(label,keys,curObj,priorObj,isInc){
    if(!keys.length)return'';
    var curTot=0,priorTot=0;
    var rows=keys.map(function(k){
      var c2=curObj[k]||0,p=priorObj[k]||0;
      curTot+=c2;priorTot+=p;
      return'<tr><td style="padding-left:1rem;font-size:12px">'+k+'</td>'
        +'<td style="text-align:right">'+(c2?fmt(c2):'—')+'</td>'
        +'<td style="text-align:right;color:var(--muted)">'+(p?fmt(p):'—')+'</td>'
        +changeCell(c2,p)+'</tr>';
    }).join('');
    var td=curTot-priorTot;
    return'<tr style="background:var(--bg)"><td style="font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)" colspan="4">'+label+'</td></tr>'
      +rows
      +'<tr class="bud-total"><td style="padding-left:.5rem">'+label+' total</td>'
      +'<td style="text-align:right;font-weight:500">'+fmt(curTot)+'</td>'
      +'<td style="text-align:right;font-weight:500;color:var(--muted)">'+fmt(priorTot)+'</td>'
      +changeCell(curTot,priorTot)+'</tr>';
  }

  var curInc=Object.values(cur.inc).reduce(function(s,v){return s+v;},0);
  var curExp=Object.values(cur.exp).reduce(function(s,v){return s+v;},0);
  var priInc=Object.values(prior.inc).reduce(function(s,v){return s+v;},0);
  var priExp=Object.values(prior.exp).reduce(function(s,v){return s+v;},0);
  var curNet=curInc-curExp,priNet=priInc-priExp;
  var nd=curNet-priNet;

  var ths='<tr><th style="width:35%">Category</th><th style="text-align:right">'+fy.label+' (Current)</th><th style="text-align:right;color:var(--muted)">'+priorFY.label+' (Prior)</th><th style="text-align:right">Change</th></tr>';

  var hasPrior=priInc>0||priExp>0;

  el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Year-over-Year P&L</div>'
    +(!hasPrior?'<div style="font-size:11px;color:var(--amber);margin-bottom:.75rem">No prior year transactions found with dates in the '+priorFY.label+' fiscal year. Transactions without dates are excluded from both periods.</div>':'')
    +'<div style="overflow-x:auto"><table class="bud-tbl"><thead>'+ths+'</thead><tbody>'
    +section(il(c.type),allInc,cur.inc,prior.inc,true)
    +section('Expenses',allExp,cur.exp,prior.exp,false)
    +'<tr class="bud-net"><td>'+nl(c.type)+'</td>'
    +'<td style="text-align:right;font-weight:600" class="'+(curNet>=0?'vg':'vr')+'">'+fmt(curNet)+'</td>'
    +'<td style="text-align:right;font-weight:600;color:var(--muted)">'+fmt(priNet)+'</td>'
    +'<td style="text-align:right;font-weight:600" class="'+(nd>=0?'vg':'vr')+'">'+(nd>=0?'+':'')+fmt(nd)+'</td>'
    +'</tr></tbody></table></div>'
    +'<div style="font-size:11px;color:var(--muted);margin-top:.75rem">Comparing '+fy.label+' ('+fy.start.toLocaleDateString()+' – '+fy.end.toLocaleDateString()+') vs '+priorFY.label+' ('+priorFY.start.toLocaleDateString()+' – '+priorFY.end.toLocaleDateString()+'). Only dated transactions are included.</div>'
    +'</div>';
}
function render1099Report(){
  var c=gc();if(!c)return;var el=g('rpt-1099');if(!el)return;
  var exp=(c.expenses||[]).filter(function(e){return e.is1099;});
  if(!exp.length){el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">1099 Contractors</div><div style="color:var(--muted);font-size:12px;padding:.5rem 0">No 1099 contractor expenses found. Mark expenses as 1099 when adding them.</div></div>';return;}
  // Group by vendor — track TIN and aggregate
  var vendors={};
  exp.forEach(function(e){
    var v=e.vendor1099||e.desc||'Unknown';
    if(!vendors[v])vendors[v]={total:0,tin:e.tin1099||'',txns:0};
    vendors[v].total+=Number(e.amt||0);
    vendors[v].txns++;
    if(e.tin1099&&!vendors[v].tin)vendors[v].tin=e.tin1099;
  });
  var vkeys=Object.keys(vendors).sort();
  var total=vkeys.reduce(function(s,v){return s+vendors[v].total;},0);
  var flagCount=vkeys.filter(function(v){return vendors[v].total>=600;}).length;
  var missingTIN=vkeys.filter(function(v){return vendors[v].total>=600&&!vendors[v].tin;}).length;
  var rows=vkeys.map(function(v){
    var d=vendors[v];var flag=d.total>=600;
    var tinBadge=d.tin
      ?'<span style="font-size:10px;color:var(--muted);margin-left:8px">EIN: '+escHtml(d.tin)+'</span>'
      :(flag?'<span class="badge b-red" style="margin-left:6px;font-size:9px">TIN missing</span>':'');
    var req=flag?'<span class="badge b-amber" style="margin-left:6px">1099-NEC required</span>':'<span class="badge b-gray" style="margin-left:6px">Under $600</span>';
    return'<div class="rpt-row"><span>'+escHtml(v)+req+tinBadge+'<span style="color:var(--muted);font-size:11px;margin-left:8px">'+d.txns+' payment'+(d.txns>1?'s':'')+'</span></span><span class="'+(flag?'vr':'')+'">'+fmt(d.total)+'</span></div>';
  }).join('');
  var missingAlert=missingTIN>0?'<div style="background:var(--red-bg);color:var(--red);border-radius:8px;padding:.6rem .9rem;font-size:12px;margin-bottom:.75rem">⚠ '+missingTIN+' contractor'+(missingTIN>1?'s':'')+' over $600 missing EIN/TIN — edit the expense to add it.</div>':'';
  el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">1099 Contractors — Year-end Report</div>'
  +'<div style="display:flex;gap:16px;margin-bottom:.75rem;font-size:12px;flex-wrap:wrap"><span>Total contractors: <strong>'+vkeys.length+'</strong></span><span>Require 1099-NEC: <strong class="vr">'+flagCount+'</strong></span><span>Missing TIN: <strong class="'+(missingTIN>0?'vr':'')+'">'+missingTIN+'</strong></span><span>Total paid: <strong>'+fmt(total)+'</strong></span></div>'
  +missingAlert+rows
  +'<div class="rpt-total"><span>Total contractor payments</span><span>'+fmt(total)+'</span></div>'
  +'<div style="font-size:11px;color:var(--muted);margin-top:.75rem;line-height:1.6">Contractors paid $600+ require a 1099-NEC. File by January 31. Collect W-9s before year-end.</div></div>';
}

// ── JOURNAL & ACTIONS ───────────────────
function renderJrn(pid,c){var p=g(pid);if(!p)return;var j=c.journal||[],html='';j.slice().reverse().forEach(function(e,ri){var oi=j.length-1-ri;html+='<div class="jentry"><div class="jdate">'+e.date+'</div><div class="jtext">'+escHtml(e.text)+'</div><div class="j-acts"><button class="e-btn" title="Edit entry" onclick="editItem(\'journal\','+oi+')">&#9998;</button><button class="d-btn" title="Delete entry" onclick="delItem(\'journal\','+oi+')">&#215;</button></div></div>';});p.innerHTML=FB()+XB()+'<div class="card"><div class="c-head"><span class="c-title">Reflections &amp; notes</span><button class="add-btn" onclick="EI=-1;openM(\'m-jrn\')">+ New entry</button></div>'+(html||ES('No journal entries yet','Capture wins, challenges, and reflections here.','EI=-1;openM(\'m-jrn\')'))+'</div>';}
function renderNpJrn(c){renderJrn('p-npjrn',c);}
function renderSbJrn(c){renderJrn('p-sbjrn',c);}
function renderPeJrn(c){renderJrn('p-pejrn',c);}
function renderAct(pid,c){var p=g(pid);if(!p)return;var a=c.actions||[],pc={High:'b-red',Medium:'b-amber',Low:'b-gray'},html='';a.forEach(function(r,i){html+='<div class="act-item"><input type="checkbox" '+(r.done?'checked':'')+' onchange="tgAct('+i+')"><div style="flex:1"><div class="act-txt '+(r.done?'done':'')+'">'+r.text+'</div><div class="act-meta">'+(r.due?'Due: '+r.due:'')+((r.due&&r.who)?' · ':'')+(r.who||'')+' <span class="badge '+(pc[r.pri]||'b-gray')+'">'+(r.pri||'')+'</span></div></div><div class="row-acts"><button class="e-btn" title="Edit action" onclick="editItem(\'actions\','+i+')">&#9998;</button><button class="d-btn" title="Delete action" onclick="delItem(\'actions\','+i+')">&#215;</button></div></div>';});p.innerHTML=FB()+XB()+'<div class="card"><div class="c-head"><span class="c-title">Daily action items</span><button class="add-btn" onclick="EI=-1;openM(\'m-act\')">+ Add item</button></div>'+(html||ES('No action items yet','Add tasks, deadlines, and follow-ups.','EI=-1;openM(\'m-act\')'))+'</div>';}
function renderNpAct(c){renderAct('p-npact',c);}
function renderSbAct(c){renderAct('p-sbact',c);}
function renderPeAct(c){renderAct('p-peact',c);}

// ── HOME WIDGET (Notes + Actions) ────────
function renderHomeWidget(){
  var el=g('home-widget');if(!el)return;
  var c=gc();if(!c)return;
  var j=c.journal||[];var a=c.actions||[];
  var lastNote=j.length?j[j.length-1]:'';
  var pending=a.filter(function(x){return!x.done;});
  var pc={High:'b-red',Medium:'b-amber',Low:'b-gray'};
  var actHtml=pending.slice(0,5).map(function(r,i){var oi=a.indexOf(r);return'<div class="act-item" style="padding:6px 0"><input type="checkbox" '+(r.done?'checked':'')+' onchange="tgAct('+oi+');renderHomeWidget()" style="width:14px;height:14px;flex-shrink:0;cursor:pointer;accent-color:var(--text)"><div style="flex:1"><div style="font-size:13px;line-height:1.4">'+r.text+'</div><div style="font-size:10px;color:var(--muted);margin-top:2px">'+(r.due?'Due: '+r.due+' · ':'')+' <span class="badge '+(pc[r.pri]||'b-gray')+'">'+r.pri+'</span></div></div><button class="d-btn" title="Delete action" onclick="delItem(\'actions\','+oi+');renderHomeWidget()">&#215;</button></div>';}).join('');
  // ESTIMATED TAX DUE DATE ALERT — PE/SB only, within 30 days of quarterly due date
  var _taxAlertHtml='';
  if(c.type!=='np'){
    var _now=new Date();_now.setHours(0,0,0,0);
    var _yr=_now.getFullYear();
    var _qDates=[
      {q:'Q1',label:'April 15',d:new Date(_yr,3,15)},
      {q:'Q2',label:'June 16',d:new Date(_yr,5,16)},
      {q:'Q3',label:'September 15',d:new Date(_yr,8,15)},
      {q:'Q4',label:'January 15',d:new Date(_yr+1,0,15)}
    ];
    var _upcoming=_qDates.filter(function(q){var diff=Math.floor((q.d-_now)/86400000);return diff>=0&&diff<=30;});
    var _overdue=_qDates.filter(function(q){var diff=Math.floor((q.d-_now)/86400000);return diff>=-7&&diff<0;});
    if(_upcoming.length||_overdue.length){
      var _msgs=[];
      _overdue.forEach(function(q){_msgs.push('<strong>'+q.q+' estimated taxes were due '+q.label+'</strong> — file now if not yet submitted.');});
      _upcoming.forEach(function(q){var d=Math.floor((q.d-_now)/86400000);_msgs.push('<strong>'+q.q+' estimated taxes due '+q.label+'</strong> — '+d+' day'+(d===1?'':'s')+' away.');});
      _taxAlertHtml='<div style="background:#fff8e1;border:1px solid #f9a825;border-radius:8px;padding:.75rem 1rem;margin-bottom:1rem;font-size:13px;line-height:1.6">'
        +'<div style="font-weight:700;margin-bottom:4px;color:#7a5c00">⏰ Estimated Tax Reminder</div>'
        +_msgs.map(function(m){return'<div style="color:#5a4000">'+m+'</div>';}).join('')
        +'</div>';
    }
  }

  // ── CALENDAR WIDGET built inline below ──

  // Time widget — from timetracking.js if available
  var timeWidgetInner='';
  var hasTimeWidget=typeof _ttWaypointWidget==='function';
  if(hasTimeWidget)timeWidgetInner=_ttWaypointWidget(c);

  el.innerHTML=_taxAlertHtml
  +'<div style="display:grid;grid-template-columns:240px 1fr 1fr;grid-template-rows:auto auto;gap:12px;margin-bottom:1.5rem;grid-template-areas:\'cal act notes\' \'cal time time\'">'
  +'<div style="grid-area:cal">'+_buildCalendarWidget(c)+'</div>'
  +'<div class="card" style="margin-bottom:0;grid-area:act"><div class="c-head"><span class="c-title">✅ Today\'s actions</span><button class="add-btn" onclick="EI=-1;openM(\'m-act\')">+ Add</button></div>'
  +(pending.length?actHtml:'<div style="font-size:12px;color:var(--muted)">No pending actions. What needs to get done today?</div>')
  +(a.filter(function(x){return x.done;}).length?'<div style="font-size:11px;color:var(--green);margin-top:.5rem">'+a.filter(function(x){return x.done;}).length+' completed ✓</div>':'')
  +'</div>'
  +'<div class="card" style="margin-bottom:0;grid-area:notes"><div class="c-head"><span class="c-title">📝 Notes</span><button class="add-btn" onclick="EI=-1;openM(\'m-jrn\')">+ Add</button></div>'
  +(lastNote?'<div style="font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:.5rem">'+lastNote.text.slice(0,120)+(lastNote.text.length>120?'…':'')+'</div><div style="font-size:10px;color:var(--muted)">'+lastNote.date+'</div>':'<div style="font-size:12px;color:var(--muted)">No notes yet. What do you need to remember?</div>')
  +(j.length>1?'<div style="font-size:11px;color:var(--muted);margin-top:.5rem;cursor:pointer;text-decoration:underline" onclick="openAllNotes()">View all '+j.length+' notes →</div>':'')
  +'</div>'
  +(hasTimeWidget?'<div class="card" id="tt-widget-wrap" style="margin-bottom:0;grid-area:time">'+timeWidgetInner+'</div>':'')
  +'</div>';
}

var _CAL_EVENTS={};
var _CAL_NOTES_KEY='calNotes';
var _CAL_MONTH=null;
var _CAL_YEAR=null;

function _buildCalendarWidget(c){
  var now=new Date();
  if(_CAL_MONTH===null){_CAL_MONTH=now.getMonth();_CAL_YEAR=now.getFullYear();}
  var month=_CAL_MONTH,year=_CAL_YEAR;
  var mNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var firstDay=new Date(year,month,1).getDay();
  var daysInMonth=new Date(year,month+1,0).getDate();
  _CAL_EVENTS={};

  function dateKey(d){return year+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');}

  // Populate from grants, donors, and manual calendar notes
  function addEvent(dateStr,label,color,icon,type){
    if(!dateStr)return;var d=parseDate(dateStr);if(!d)return;
    if(d.getMonth()!==month||d.getFullYear()!==year)return;
    var key=d.getDate();if(!_CAL_EVENTS[key])_CAL_EVENTS[key]=[];
    _CAL_EVENTS[key].push({label:label,color:color,icon:icon,type:type||'auto'});
  }
  (c.grants||[]).forEach(function(gr){
    if(gr.appDeadline&&gr.status!=='Closed'&&gr.status!=='Denied')addEvent(gr.appDeadline,'Apply: '+gr.name,'#e65100','📝','grant');
    if(gr.deadline&&gr.status!=='Closed')addEvent(gr.deadline,'Report: '+gr.name,'#c0392b','📋','grant');
  });
  (c.donors||[]).forEach(function(d){
    (d.interactions||[]).forEach(function(ix){
      if(ix.followupDate&&!ix.completed)addEvent(ix.followupDate,'Follow up: '+d.name+(ix.followupNote?' — '+ix.followupNote:''),'#185FA5','📅','donor');
    });
  });
  // Manual calendar notes
  var calNotes=c.calendarNotes||{};
  for(var dk in calNotes){
    var parts=dk.split('-');
    if(parseInt(parts[0])===year&&parseInt(parts[1])-1===month){
      var dayN=parseInt(parts[2]);
      (calNotes[dk]||[]).forEach(function(n){
        if(!_CAL_EVENTS[dayN])_CAL_EVENTS[dayN]=[];
        _CAL_EVENTS[dayN].push({label:n.text,color:'var(--np)',icon:'📌',type:'note',id:n.id,dateKey:dk});
      });
    }
  }

  // To-do strip: upcoming 30 days across all sources
  var upcoming=[];
  function addUpcoming(dateStr,label,color,icon){
    if(!dateStr)return;var d=parseDate(dateStr);if(!d)return;
    var days=Math.floor((d-now)/(1000*60*60*24));
    if(days>=0&&days<=30)upcoming.push({days:days,label:label,color:color,icon:icon});
  }
  (c.grants||[]).forEach(function(gr){
    if(gr.appDeadline&&gr.status!=='Closed'&&gr.status!=='Denied')addUpcoming(gr.appDeadline,'Apply: '+gr.name,'#e65100','📝');
    if(gr.deadline&&gr.status!=='Closed')addUpcoming(gr.deadline,'Report: '+gr.name,'#c0392b','📋');
  });
  (c.donors||[]).forEach(function(d){
    (d.interactions||[]).forEach(function(ix){
      if(ix.followupDate&&!ix.completed)addUpcoming(ix.followupDate,'Follow up: '+d.name+(ix.followupNote?' — '+ix.followupNote:''),'#185FA5','📅');
    });
  });
  // Manual notes in upcoming
  for(var dk2 in calNotes){
    var d2=parseDate(dk2);if(!d2)continue;
    var days2=Math.floor((d2-now)/(1000*60*60*24));
    if(days2>=0&&days2<=30)(calNotes[dk2]||[]).forEach(function(n){upcoming.push({days:days2,label:n.text,color:'var(--np)',icon:'📌'});});
  }
  upcoming.sort(function(a,b){return a.days-b.days;});

  var prevBtn='<button onclick="_CAL_MONTH='+(month===0?11:month-1)+';_CAL_YEAR='+(month===0?year-1:year)+';renderHomeWidget()" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:14px;padding:0 3px;font-family:inherit">‹</button>';
  var nextBtn='<button onclick="_CAL_MONTH='+(month===11?0:month+1)+';_CAL_YEAR='+(month===11?year+1:year)+';renderHomeWidget()" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:14px;padding:0 3px;font-family:inherit">›</button>';

  // Every day is clickable
  var CELL='width:24px;height:24px;padding:0;text-align:center;vertical-align:middle;border:none';
  var grid='<table style="border-collapse:collapse;width:100%"><thead><tr>'
    +['S','M','T','W','T','F','S'].map(function(d){return'<th style="'+CELL+';height:16px;font-size:9px;color:var(--muted);font-weight:400">'+d+'</th>';}).join('')
    +'</tr></thead><tbody>';

  var day=1;
  for(var row=0;row<6;row++){
    if(day>daysInMonth)break;
    grid+='<tr>';
    for(var col=0;col<7;col++){
      if(row===0&&col<firstDay){grid+='<td style="'+CELL+'"></td>';continue;}
      if(day>daysInMonth){grid+='<td style="'+CELL+'"></td>';continue;}
      var isToday=day===now.getDate()&&month===now.getMonth()&&year===now.getFullYear();
      var hasEvts=!!(_CAL_EVENTS[day]&&_CAL_EVENTS[day].length);
      var dots=hasEvts?_CAL_EVENTS[day].slice(0,3).map(function(ev){
        return'<span style="display:inline-block;width:3px;height:3px;border-radius:50%;background:'+ev.color+';margin:0 0.5px"></span>';
      }).join(''):'';
      grid+='<td style="'+CELL+'">'
        +'<div data-calday="'+day+'" onclick="showCalPopover(event,'+day+')" style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;margin:0 auto;cursor:pointer;'
        +(isToday?'background:var(--np);':hasEvts?'background:var(--soft);':'')
        +'transition:background .1s"'
        +' onmouseover="if(!this.style.background||this.style.background===\'\'||this.dataset.today!==\'1\')this.style.background=\'var(--soft)\'" onmouseout="this.style.background=\''+(isToday?'var(--np)':hasEvts?'var(--soft)':'')+'\'"'
        +(isToday?' data-today="1"':'')
        +'>'
        +'<span style="font-size:10px;line-height:1;color:'+(isToday?'#fff':hasEvts?'var(--text)':'var(--muted)')+'">'+day+'</span>'
        +(dots?'<div style="display:flex;margin-top:1px">'+dots+'</div>':'')
        +'</div></td>';
      day++;
    }
    grid+='</tr>';
  }
  grid+='</tbody></table>';

  var todoStrip=upcoming.length
    ?'<div style="margin-top:.5rem;padding-top:.5rem;border-top:1px solid var(--soft)">'
      +upcoming.slice(0,5).map(function(ev){
        var dLabel=ev.days===0?'Today':ev.days===1?'Tmrw':ev.days+'d';
        return'<div style="display:flex;align-items:center;gap:5px;padding:2px 0;font-size:10px;line-height:1.4">'
          +'<span style="font-weight:700;color:'+ev.color+';min-width:28px;flex-shrink:0">'+dLabel+'</span>'
          +'<span style="color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">'+ev.icon+' '+escHtml(ev.label)+'</span>'
          +'</div>';
      }).join('')
      +(upcoming.length>5?'<div style="font-size:9px;color:var(--muted);margin-top:2px">+'+(upcoming.length-5)+' more</div>':'')
      +'</div>'
    :'';

  return'<div class="card" style="margin-bottom:0;padding:.875rem">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.375rem">'
    +'<span style="font-size:12px;font-weight:500">📅 '+mNames[month]+' '+year+'</span>'
    +'<div>'+prevBtn+nextBtn+'</div></div>'
    +grid
    +'<div style="display:flex;gap:8px;margin-top:.375rem;flex-wrap:wrap">'
    +'<span style="display:flex;align-items:center;gap:3px;font-size:9px;color:var(--muted)"><span style="width:5px;height:5px;border-radius:50%;background:#c0392b;display:inline-block"></span>Report</span>'
    +'<span style="display:flex;align-items:center;gap:3px;font-size:9px;color:var(--muted)"><span style="width:5px;height:5px;border-radius:50%;background:#e65100;display:inline-block"></span>Apply</span>'
    +'<span style="display:flex;align-items:center;gap:3px;font-size:9px;color:var(--muted)"><span style="width:5px;height:5px;border-radius:50%;background:#185FA5;display:inline-block"></span>Follow-up</span>'
    +'<span style="display:flex;align-items:center;gap:3px;font-size:9px;color:var(--muted)"><span style="width:5px;height:5px;border-radius:50%;background:var(--np);display:inline-block"></span>Note</span>'
    +'</div>'
    +todoStrip
    +'</div>';
}

function showCalPopover(e,dayNum){
  e.stopPropagation();
  var c=gc();if(!c)return;
  // Guard — ensure globals are set (they may not be if widget hasn't rendered yet)
  if(_CAL_MONTH===null||_CAL_YEAR===null){var _n=new Date();_CAL_MONTH=_n.getMonth();_CAL_YEAR=_n.getFullYear();}
  var mNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
  var dateKey=_CAL_YEAR+'-'+String(_CAL_MONTH+1).padStart(2,'0')+'-'+String(dayNum).padStart(2,'0');
  var dateLabel=mNames[_CAL_MONTH]+' '+dayNum+', '+_CAL_YEAR;

  // Default color tags — stored in c.calTagColors, editable by user
  var defaultTags=[
    {label:'Deadline',color:'#c0392b'},
    {label:'Meeting',color:'#185FA5'},
    {label:'Follow-up',color:'#e65100'},
    {label:'Reminder',color:'#7c3aed'},
    {label:'Grant',color:'#0F6E56'},
    {label:'Personal',color:'#8a8880'}
  ];
  if(!c.calTagColors)c.calTagColors=defaultTags;
  var tags=c.calTagColors;

  var pop=g('cal-popover');
  if(!pop){
    pop=document.createElement('div');pop.id='cal-popover';
    pop.addEventListener('click',function(ev){ev.stopPropagation();});
    pop.style.cssText='display:none;position:fixed;z-index:500;background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.16);padding:.875rem 1rem;width:280px;font-family:DM Sans,sans-serif';
    document.body.appendChild(pop);
  }

  function renderPop(){
    var c2=gc();
    var mn2=(c2.calendarNotes&&c2.calendarNotes[dateKey])||[];
    var autoEvts=(_CAL_EVENTS[dayNum]||[]).filter(function(ev){return ev.type!=='note';});
    var tags2=c2.calTagColors||defaultTags;
    var selTag=tags2[0];// currently selected tag — tracked by data attr
    var curTagIdx=parseInt(pop.dataset.tagIdx||'0');
    if(curTagIdx>=tags2.length)curTagIdx=0;

    var tagPicker=tags2.map(function(t,i){
      var sel=i===curTagIdx;
      return'<span onclick="document.getElementById(\'cal-popover\').dataset.tagIdx=\''+i+'\';document.querySelectorAll(\'.cal-tag-opt\').forEach(function(el,j){el.style.outline=j==='+i+'?\'2px solid \'+el.dataset.color+\' \':\'none\';});" class="cal-tag-opt" data-color="'+t.color+'" style="display:inline-block;width:16px;height:16px;border-radius:50%;background:'+t.color+';cursor:pointer;outline:'+(sel?'2px solid '+t.color:'none')+';outline-offset:2px;transition:outline .1s" title="'+escHtml(t.label)+'"></span>';
    }).join('')
    +'<span onclick="openCalTagManager()" style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:var(--soft);cursor:pointer;font-size:10px;color:var(--muted)" title="Manage tags">+</span>';

    pop.innerHTML=
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.625rem">'
      +'<span style="font-size:12px;font-weight:600;color:var(--text)">'+dateLabel+'</span>'
      +'<button onclick="g(\'cal-popover\').style.display=\'none\'" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:20px;line-height:1;padding:0 0 0 8px;font-family:inherit">×</button>'
      +'</div>'
      // Auto events
      +(autoEvts.length?'<div style="margin-bottom:4px">'+autoEvts.map(function(ev){
          return'<div style="display:flex;align-items:flex-start;gap:8px;padding:4px 0;border-top:1px solid var(--soft);font-size:12px;line-height:1.5">'
            +'<span style="width:7px;height:7px;border-radius:50%;background:'+ev.color+';flex-shrink:0;margin-top:4px;display:inline-block"></span>'
            +'<span style="color:var(--text)">'+escHtml(ev.label)+'</span>'
            +'</div>';
        }).join('')+'</div>':'')
      // Manual notes
      +(mn2.length?mn2.map(function(n){
          return'<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-top:1px solid var(--soft);font-size:12px;line-height:1.5">'
            +'<span style="width:7px;height:7px;border-radius:50%;background:'+(n.color||'var(--np)')+';flex-shrink:0;display:inline-block"></span>'
            +'<span style="flex:1;color:var(--text)">'+escHtml(n.text)+(n.time?' <span style="font-size:10px;color:var(--muted)">@ '+escHtml(n.time)+'</span>':'')+'</span>'
            +'<button onclick="deleteCalNote(\''+dateKey+'\',\''+n.id+'\')" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:14px;line-height:1;padding:0;flex-shrink:0">×</button>'
            +'</div>';
        }).join(''):'')
      +(!autoEvts.length&&!mn2.length?'<div style="font-size:12px;color:var(--muted);padding:4px 0;border-top:1px solid var(--soft)">Nothing scheduled — add a note below.</div>':'')
      // Color tag picker row
      +'<div style="margin-top:.625rem;padding-top:.5rem;border-top:1px solid var(--soft)">'
      +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:.5rem;flex-wrap:wrap">'+tagPicker+'</div>'
      // Note input with optional time
      +'<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'
      +'<input type="text" id="cal-note-inp" placeholder="Add a note…" style="flex:1;min-width:120px;font-size:12px;padding:5px 8px;border:1px solid var(--border);border-radius:7px;background:var(--bg);color:var(--text);font-family:DM Sans,sans-serif;outline:none" onkeydown="if(event.key===\'Enter\')saveCalNote(\''+dateKey+'\')">'
      +'<input type="text" id="cal-note-time" placeholder="Time (opt.)" style="width:80px;font-size:12px;padding:5px 8px;border:1px solid var(--border);border-radius:7px;background:var(--bg);color:var(--text);font-family:DM Sans,sans-serif;outline:none" title="Optional time e.g. 2:00pm">'
      +'<button onclick="saveCalNote(\''+dateKey+'\')" style="background:var(--np);color:#fff;border:none;border-radius:7px;padding:5px 10px;font-size:11px;cursor:pointer;font-family:DM Sans,sans-serif;white-space:nowrap">+ Add</button>'
      +'</div>'
      +'</div>';
    pop.dataset.dateKey=dateKey;
    pop.dataset.dayNum=dayNum;
    if(!pop.dataset.tagIdx)pop.dataset.tagIdx='0';
    setTimeout(function(){var inp=g('cal-note-inp');if(inp)inp.focus();},50);
  }

  renderPop();
  pop.style.display='block';

  var target=e.currentTarget||e.target;
  var rect=target.getBoundingClientRect?target.getBoundingClientRect():{left:e.clientX||200,bottom:(e.clientY||200)+8,top:e.clientY||200};
  var pw=280,ph=260;
  var left=rect.left,top=rect.bottom+8;
  if(left+pw>window.innerWidth-12)left=window.innerWidth-pw-12;
  if(left<8)left=8;
  if(top+ph>window.innerHeight-12)top=rect.top-ph-8;
  pop.style.left=left+'px';pop.style.top=top+'px';

  setTimeout(function(){
    document.addEventListener('click',function _close(ev){
      var p=g('cal-popover');
      if(p&&!p.contains(ev.target)){p.style.display='none';document.removeEventListener('click',_close);}
    });
  },100);
}

function saveCalNote(dateKey){
  var inp=g('cal-note-inp');if(!inp)return;
  var text=inp.value.trim();if(!text)return;
  var c=gc();if(!c)return;
  // Get selected color tag
  var pop=g('cal-popover');
  var tagIdx=parseInt((pop&&pop.dataset.tagIdx)||'0');
  var tags=c.calTagColors||[{label:'Reminder',color:'var(--np)'}];
  var selectedTag=tags[tagIdx]||tags[0];
  if(!c.calendarNotes)c.calendarNotes={};
  if(!c.calendarNotes[dateKey])c.calendarNotes[dateKey]=[];
  var note={id:uid(),text:text,color:selectedTag.color,tagLabel:selectedTag.label,time:g('cal-note-time')&&g('cal-note-time').value.trim()||'',created:new Date().toISOString()};
  c.calendarNotes[dateKey].push(note);
  inp.value='';
  sv();
  var parts=dateKey.split('-');
  var dayN=parseInt(parts[2]);
  if(!_CAL_EVENTS[dayN])_CAL_EVENTS[dayN]=[];
  _CAL_EVENTS[dayN].push({label:text,color:selectedTag.color,icon:'📌',type:'note',dateKey:dateKey});
  renderHomeWidget();
  // Reopen popover on same day
  setTimeout(function(){
    var pop2=g('cal-popover');
    if(pop2&&pop2.dataset.dayNum)showCalPopover({stopPropagation:function(){},currentTarget:{getBoundingClientRect:function(){return{left:parseInt(pop2.style.left),bottom:parseInt(pop2.style.top),top:parseInt(pop2.style.top)-8};}},target:{getBoundingClientRect:function(){return{left:parseInt(pop2.style.left),bottom:parseInt(pop2.style.top),top:parseInt(pop2.style.top)-8};}}},parseInt(pop2.dataset.dayNum));
  },50);
}

function openCalTagManager(){
  var pop=g('cal-popover');if(pop)pop.style.display='none';
  var c=gc();if(!c)return;
  var defaultTags=[{label:'Deadline',color:'#c0392b'},{label:'Meeting',color:'#185FA5'},{label:'Follow-up',color:'#e65100'},{label:'Reminder',color:'#7c3aed'},{label:'Grant',color:'#0F6E56'},{label:'Personal',color:'#8a8880'}];
  if(!c.calTagColors)c.calTagColors=defaultTags;
  var existing=g('m-cal-tags');if(existing)existing.remove();
  var mo=document.createElement('div');mo.className='overlay';mo.id='m-cal-tags';
  mo.innerHTML='<div class="modal" style="max-width:380px"><button class="cx" onclick="closeM(\'m-cal-tags\')">&#215;</button>'
    +'<div class="m-title">Calendar tag colors</div>'
    +'<div id="cal-tag-list">'
    +c.calTagColors.map(function(t,i){
      return'<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--soft)">'
        +'<input type="color" value="'+t.color+'" onchange="updateCalTag('+i+',\'color\',this.value)" style="width:28px;height:28px;border:none;border-radius:50%;cursor:pointer;padding:0;background:none">'
        +'<input type="text" value="'+escHtml(t.label)+'" onchange="updateCalTag('+i+',\'label\',this.value)" style="flex:1;font-size:12px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);font-family:DM Sans,sans-serif">'
        +'<button onclick="deleteCalTag('+i+')" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:16px;line-height:1">×</button>'
        +'</div>';
    }).join('')
    +'</div>'
    +'<div style="display:flex;gap:8px;margin-top:.875rem">'
    +'<input type="text" id="new-tag-label" placeholder="New tag name" style="flex:1;font-size:12px;padding:5px 8px;border:1px solid var(--border);border-radius:7px;background:var(--bg);color:var(--text);font-family:DM Sans,sans-serif">'
    +'<input type="color" id="new-tag-color" value="#185FA5" style="width:36px;height:33px;border:none;border-radius:6px;cursor:pointer;padding:0;background:none">'
    +'<button onclick="addCalTag()" style="background:var(--np);color:#fff;border:none;border-radius:7px;padding:5px 12px;font-size:12px;cursor:pointer;font-family:DM Sans,sans-serif">+ Add</button>'
    +'</div>'
    +'</div></div>';
  document.body.appendChild(mo);
  setTimeout(function(){mo.classList.add('open');},10);
}

function updateCalTag(i,field,val){
  var c=gc();if(!c||!c.calTagColors||!c.calTagColors[i])return;
  c.calTagColors[i][field]=val;sv();
}
function deleteCalTag(i){
  var c=gc();if(!c||!c.calTagColors)return;
  c.calTagColors.splice(i,1);sv();
  openCalTagManager();// refresh
}
function addCalTag(){
  var c=gc();if(!c)return;
  var label=g('new-tag-label')&&g('new-tag-label').value.trim();
  var color=g('new-tag-color')&&g('new-tag-color').value||'#185FA5';
  if(!label)return;
  if(!c.calTagColors)c.calTagColors=[];
  c.calTagColors.push({label:label,color:color});
  sv();openCalTagManager();
}

function deleteCalNote(dateKey,noteId){
  var c=gc();if(!c||!c.calendarNotes||!c.calendarNotes[dateKey])return;
  c.calendarNotes[dateKey]=c.calendarNotes[dateKey].filter(function(n){return n.id!==noteId;});
  if(!c.calendarNotes[dateKey].length)delete c.calendarNotes[dateKey];
  sv();renderHomeWidget();
  var pop=g('cal-popover');if(pop)pop.style.display='none';
}
function openAllNotes(){
  var c=gc();if(!c)return;
  var j=c.journal||[];
  var html=j.slice().reverse().map(function(e,ri){var oi=j.length-1-ri;return'<div class="jentry"><div class="jdate">'+e.date+'</div><div class="jtext">'+escHtml(e.text)+'</div><div class="j-acts"><button class="e-btn" title="Edit entry" onclick="editItem(\'journal\','+oi+')">&#9998;</button><button class="d-btn" title="Delete entry" onclick="delItem(\'journal\','+oi+');renderHomeWidget();openAllNotes()">&#215;</button></div></div>';}).join('');
  g('all-notes-body').innerHTML=html||'<div style="color:var(--muted);font-size:13px">No notes yet.</div>';
  openM('m-notes');
}

// ══════════════════════════════════════════
// DYNAMIC MODALS
// ══════════════════════════════════════════
var FO='<option>Weekly</option><option>Bi-weekly</option><option>Monthly</option><option>One-time</option><option>Quarterly</option><option>Annual</option>';
var RO='<option value="None">No — one time</option><option value="Weekly">Weekly</option><option value="Bi-weekly">Bi-weekly</option><option value="Monthly">Monthly</option><option value="Quarterly">Quarterly</option><option value="Annual">Annual</option>';
function _toggleRecurOpts(val){
  var el=document.getElementById('recur-opts');
  if(el)el.style.display=(val&&val!=='None')?'block':'none';
}

// STABILITY FIX-1: Guard against rebuilding dynamic modals while one is open.
// buildDynMods() calls mc.innerHTML = h which destroys all dynamic overlays,
// including any currently open one, causing silent form data loss and stale EI.
// This situation should not occur in normal usage (you can't switch clients
// while a modal is open) but the guard prevents it if it ever does.
function renderBudgetByFundRpt(){
  var c=gc();if(!c)return;var el=g('rpt-budgetbyfund');if(!el)return;
  if(c.type!=='np'){el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Budget vs Actual by Fund</div><div style="color:var(--muted);font-size:12px">This report is only available for nonprofit organizations.</div></div>';return;}
  var funds=(c.funds||[]);
  var budgetItems=(c.budgetItems||[]);
  var allInc=(c.income||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;});
  var allExp=(c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal;});
  if(!funds.length&&!budgetItems.length){el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Budget vs Actual by Fund</div><div style="color:var(--muted);font-size:12px">No funds or budget items yet.</div></div>';return;}
  var fy=getFiscalYear(c.fiscalYearEnd);
  var html='<div class="rpt-sec"><div class="rpt-ttl">Budget vs Actual by Fund — '+fy.label+'</div></div>';
  var fundNames={};
  budgetItems.forEach(function(b){if(b.fund)fundNames[b.fund]=1;});
  allInc.forEach(function(r){if(r.fund)fundNames[r.fund]=1;});
  allExp.forEach(function(e){if(e.fund)fundNames[e.fund]=1;});
  funds.forEach(function(f){if(f.name)fundNames[f.name]=1;});
  var fnames=Object.keys(fundNames);
  if(!fnames.length){el.innerHTML='<div class="rpt-sec"><div class="rpt-ttl">Budget vs Actual by Fund</div><div style="color:var(--muted);font-size:12px">No fund assignments found on budget items or transactions.</div></div>';return;}
  var grandBudInc=0,grandActInc=0,grandBudExp=0,grandActExp=0;
  fnames.sort().forEach(function(fname){
    var fobj=funds.find(function(f){return f.name===fname;})||{name:fname,type:''};
    var bInc=budgetItems.filter(function(b){return(b.fund||'')=== fname&&b.type==='Income';}).reduce(function(s,b){return s+Number(b.amt||0);},0);
    var bExp=budgetItems.filter(function(b){return(b.fund||'')=== fname&&b.type==='Expense';}).reduce(function(s,b){return s+Number(b.amt||0);},0);
    var aInc=allInc.filter(function(r){return(r.fund||'')=== fname;}).reduce(function(s,r){return s+basisInc(c,r);},0);
    var aExp=allExp.filter(function(e){return(e.fund||'')=== fname;}).reduce(function(s,e){return s+Number(e.amt||0);},0);
    grandBudInc+=bInc;grandActInc+=aInc;grandBudExp+=bExp;grandActExp+=aExp;
    var varInc=aInc-bInc;var varExp=aExp-bExp;
    var typeBadge=fobj.type?'<span class="badge '+(fobj.type==='Restricted'?'b-amber':fobj.type==='Endowment'?'b-blue':fobj.type==='Capital'?'b-blue':'b-green')+'">'+fobj.type+'</span>':'';
    html+='<div class="card" style="margin-bottom:1rem">';
    html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">';
    html+='<div style="font-weight:600;font-size:14px">'+fname+'</div>'+(typeBadge?typeBadge:'');
    html+='</div>';
    html+='<table><thead><tr><th style="width:30%"></th><th style="width:23%;text-align:right">Budget</th><th style="width:23%;text-align:right">Actual</th><th style="width:24%;text-align:right">Variance</th></tr></thead><tbody>';
    html+='<tr><td style="font-size:12px;color:var(--muted);font-weight:500">Income</td><td style="text-align:right">'+fmt(bInc)+'</td><td style="text-align:right">'+fmt(aInc)+'</td><td style="text-align:right;color:'+(varInc>=0?'var(--green)':'var(--red)')+'">'+fmt(varInc)+'</td></tr>';
    html+='<tr><td style="font-size:12px;color:var(--muted);font-weight:500">Expenses</td><td style="text-align:right">'+fmt(bExp)+'</td><td style="text-align:right">'+fmt(aExp)+'</td><td style="text-align:right;color:'+(varExp<=0?'var(--green)':'var(--red)')+'">'+fmt(-varExp)+'</td></tr>';
    var incActMap={};allInc.filter(function(r){return(r.fund||'')=== fname;}).forEach(function(r){incActMap[r.cat||'Other']=(incActMap[r.cat||'Other']||0)+basisInc(c,r);});
    var incCats={};budgetItems.filter(function(b){return(b.fund||'')=== fname&&b.type==='Income';}).forEach(function(b){incCats[b.cat]=Number(b.amt||0);});
    Object.keys(incActMap).forEach(function(k){if(!incCats[k])incCats[k]=0;});
    if(Object.keys(incCats).length){
      html+='<tr><td colspan="4" style="padding-top:.5rem;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Income detail</td></tr>';
      Object.keys(incCats).sort().forEach(function(cat){
        var b2=incCats[cat]||0,a2=incActMap[cat]||0,v2=a2-b2;
        html+='<tr style="font-size:12px"><td style="padding-left:1rem">'+cat+'</td><td style="text-align:right">'+fmt(b2)+'</td><td style="text-align:right">'+fmt(a2)+'</td><td style="text-align:right;color:'+(v2>=0?'var(--green)':'var(--red)')+'">'+fmt(v2)+'</td></tr>';
      });
    }
    var expActMap={};allExp.filter(function(e){return(e.fund||'')=== fname;}).forEach(function(e){expActMap[e.cat||'Other']=(expActMap[e.cat||'Other']||0)+Number(e.amt||0);});
    var expCats={};budgetItems.filter(function(b){return(b.fund||'')=== fname&&b.type==='Expense';}).forEach(function(b){expCats[b.cat]=Number(b.amt||0);});
    Object.keys(expActMap).forEach(function(k){if(!expCats[k])expCats[k]=0;});
    if(Object.keys(expCats).length){
      html+='<tr><td colspan="4" style="padding-top:.5rem;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Expense detail</td></tr>';
      Object.keys(expCats).sort().forEach(function(cat){
        var b2=expCats[cat]||0,a2=expActMap[cat]||0,v2=a2-b2;
        html+='<tr style="font-size:12px"><td style="padding-left:1rem">'+cat+'</td><td style="text-align:right">'+fmt(b2)+'</td><td style="text-align:right">'+fmt(a2)+'</td><td style="text-align:right;color:'+(v2<=0?'var(--green)':'var(--red)')+'">'+fmt(-v2)+'</td></tr>';
      });
    }
    html+='</tbody></table></div>';
  });
  var gVarInc=grandActInc-grandBudInc,gVarExp=grandActExp-grandBudExp;
  html+='<div class="rpt-sec"><div class="rpt-ttl" style="margin-bottom:.75rem">All funds combined</div>';
  html+='<table><thead><tr><th style="width:30%"></th><th style="width:23%;text-align:right">Budget</th><th style="width:23%;text-align:right">Actual</th><th style="width:24%;text-align:right">Variance</th></tr></thead><tbody>';
  html+='<tr class="bud-total"><td>Total income</td><td style="text-align:right">'+fmt(grandBudInc)+'</td><td style="text-align:right">'+fmt(grandActInc)+'</td><td style="text-align:right;color:'+(gVarInc>=0?'var(--green)':'var(--red)')+'">'+fmt(gVarInc)+'</td></tr>';
  html+='<tr class="bud-total"><td>Total expenses</td><td style="text-align:right">'+fmt(grandBudExp)+'</td><td style="text-align:right">'+fmt(grandActExp)+'</td><td style="text-align:right;color:'+(gVarExp<=0?'var(--green)':'var(--red)')+'">'+fmt(-gVarExp)+'</td></tr>';
  html+='</tbody></table></div>';
  el.innerHTML=html;
}

function buildDynMods(type){
  var mc=g('dyn-mods');
  if(!mc)return;
  // If any dynamic modal is currently open, do not rebuild — data would be lost
  if(mc.querySelector('.overlay.open')){return;}
  var ro='<div class="fl"><label>Recurring?</label><select id="f-rec" onchange="_toggleRecurOpts(this.value)">'+RO+'</select></div>'
    +'<div id="recur-opts" style="display:none;background:var(--soft);border-radius:8px;padding:.6rem .75rem;margin-bottom:.75rem">'
    +'<div class="fr"><div class="fl" style="margin-bottom:0"><label style="font-size:11px">End date (optional)</label><input type="text" id="f-rec-end" placeholder="MM/DD/YYYY" onblur="autoDate(this)" oninput="autoDate(this)"></div>'
    +'<div class="fl" style="margin-bottom:0"><label style="font-size:11px">Max occurrences (optional)</label><input type="number" id="f-rec-count" placeholder="e.g. 24" min="1" step="1"></div></div>'
    +'<div style="font-size:10px;color:var(--muted);margin-top:4px">Leave blank for indefinite. Either limit will stop the series.</div>'
    +'</div>',h='';
  var ca='<div class="fl"><label>Account (COA)</label><div style="display:flex;gap:6px;align-items:center"><div class="sw" style="flex:1"><select id="e-acct" style="width:100%"></select></div><button type="button" class="add-btn" style="white-space:nowrap;font-size:11px;padding:4px 8px" onclick="quickNewAcct(\'e-acct\',\'Expense\')">+ New</button></div></div>';
  var ia='<div class="fl"><label>Account (COA)</label><div style="display:flex;gap:6px;align-items:center"><div class="sw" style="flex:1"><select id="i-acct" style="width:100%"></select></div><button type="button" class="add-btn" style="white-space:nowrap;font-size:11px;padding:4px 8px" onclick="quickNewAcct(\'i-acct\',\'Income\')">+ New</button></div></div>';
  var ra='<div class="fl"><label>Account (COA)</label><div style="display:flex;gap:6px;align-items:center"><div class="sw" style="flex:1"><select id="r-acct" style="width:100%"></select></div><button type="button" class="add-btn" style="white-space:nowrap;font-size:11px;padding:4px 8px" onclick="quickNewAcct(\'r-acct\',\'Income\')">+ New</button></div></div>';
  var pia='<div class="fl"><label>Account (COA)</label><div style="display:flex;gap:6px;align-items:center"><div class="sw" style="flex:1"><select id="pi-acct" style="width:100%"></select></div><button type="button" class="add-btn" style="white-space:nowrap;font-size:11px;padding:4px 8px" onclick="quickNewAcct(\'pi-acct\',\'Income\')">+ New</button></div></div>';
  var billModal='<div class="overlay" id="m-bill"><div class="modal"><button class="cx" onclick="closeM(\'m-bill\')">&#215;</button><div class="m-title">Enter bill (A/P)</div><div class="fr"><div class="fl" style="margin-bottom:0"><label>Vendor *</label><input type="text" id="bill-vendor" placeholder="e.g. Office Depot"></div><div class="fl" style="margin-bottom:0"><label>Amount ($)</label><input type="number" id="bill-amt" placeholder="0" oninput="fmtAmt(this)"></div></div><div class="fl"><label>Description</label><input type="text" id="bill-desc" placeholder="e.g. Office supplies — March"></div><div class="fr"><div class="fl" style="margin-bottom:0"><label>Bill received</label><input type="text" id="bill-recv" placeholder="MM/DD/YYYY" onblur="autoDate(this)" oninput="autoDate(this)"></div><div class="fl" style="margin-bottom:0"><label>Due date</label><input type="text" id="bill-due" placeholder="MM/DD/YYYY" onblur="autoDate(this)" oninput="autoDate(this)"></div></div><div class="fr"><div class="fl" style="margin-bottom:0"><label>Account (COA)</label><div class="sw" style="width:100%"><select id="bill-acct" style="width:100%"></select></div></div><div class="fl" style="margin-bottom:0"><label>Category</label><input type="text" id="bill-cat" placeholder="e.g. Supplies"></div></div><div class="fl"><label>Notes</label><textarea id="bill-notes" placeholder="Invoice #, payment terms..."></textarea></div><div style="display:flex;gap:8px"><button class="sv-btn" onclick="saveBill()">Save bill</button><button class="add-btn" style="flex:1" onclick="saveBillAndNew()">Save &amp; new</button></div></div></div>';
  var ccModal='<div class="overlay" id="m-cc"><div class="modal"><button class="cx" onclick="closeM(\'m-cc\')">&#215;</button><div class="m-title">Credit card</div><div class="fl"><label>Card name *</label><input type="text" id="cc-name" placeholder="e.g. Chase Sapphire, Amex Blue"></div><div class="fr"><div class="fl" style="margin-bottom:0"><label>Network</label><select id="cc-network"><option>Visa</option><option>Mastercard</option><option>Amex</option><option>Discover</option><option>Other</option></select></div><div class="fl" style="margin-bottom:0"><label>Last 4 digits</label><input type="text" id="cc-last4" placeholder="4321" maxlength="4"></div></div><div class="fl"><label>Credit limit ($, optional)</label><input type="number" id="cc-limit" placeholder="0" oninput="fmtAmt(this)"></div><div style="font-size:11px;color:var(--muted);margin-bottom:.75rem">Charges go to expenses by category and feed your P&amp;L and GL. Reconcile via the Reconciliation tab.</div><button class="sv-btn" onclick="saveCC()">Save card</button></div></div>';
  h+='<div class="overlay" id="m-project"><div class="modal"><button class="cx" onclick="closeM(\'m-project\')">&#215;</button><div class="m-title">Project/Event</div><div class="fl"><label>Project name *</label><input type="text" id="proj-name" placeholder="e.g. Annual Gala, Q3 Campaign"></div><div class="fl"><label>Description</label><input type="text" id="proj-desc" placeholder="Brief description"></div><div class="fl"><label>Total budget ($)</label><input type="number" id="proj-budget" placeholder="0" oninput="fmtAmt(this)"></div><div class="fl"><label>Notes</label><textarea id="proj-notes" placeholder="Goals, scope, team..."></textarea></div><div class="fl" style="flex-direction:row;align-items:center;gap:10px;margin-bottom:.75rem"><input type="checkbox" id="proj-multiyear" style="width:16px;height:16px;cursor:pointer"><label style="margin:0;font-size:13px;cursor:pointer" for="proj-multiyear">Multi-year project (grant or capital project spanning fiscal years)</label></div><div id="proj-grant-row" style="display:none"><div class="fl"><label>Link to grant (optional)</label><div class="sw"><select id="proj-grant" style="width:100%"></select></div></div></div><button class="sv-btn" onclick="saveProject()">Save project</button></div></div>';
  h+='<div class="overlay" id="m-bank-acct"><div class="modal"><button class="cx" onclick="closeM(\'m-bank-acct\')">&#215;</button><div class="m-title">Bank account</div><div class="fl"><label>Account name *</label><input type="text" id="ba-name" placeholder="e.g. Chase Checking, Savings"></div><div class="fl"><label>Account type</label><select id="ba-type"><option value="checking">Checking</option><option value="savings">Savings</option><option value="money_market">Money market</option><option value="other">Other</option></select></div><div class="fl"><label>Account number (last 4, optional)</label><input type="text" id="ba-last4" placeholder="e.g. 4321" maxlength="4"></div><button class="sv-btn" onclick="saveBankAcct()">Save account</button></div></div>';
  if(type==='np'){
    h+='<div class="overlay" id="m-fund"><div class="modal"><button class="cx" onclick="closeM(\'m-fund\')">&#215;</button><div class="m-title">Add / edit fund</div><div class="fl"><label>Fund name *</label><input type="text" id="fund-name" placeholder="e.g. General Operating, Smith Grant Restricted"></div><div class="fl"><label>Fund type</label><select id="fund-type"><option value="Unrestricted">Unrestricted</option><option value="Restricted">Temporarily Restricted</option><option value="Permanently Restricted">Permanently Restricted</option><option value="Capital">Capital / Building</option><option value="Endowment">Endowment</option></select></div><div class="fl"><label>Description (optional)</label><input type="text" id="fund-desc" placeholder="e.g. Day-to-day operations with no donor restrictions"></div><button class="sv-btn" onclick="saveFund()">Save fund</button></div></div>';
    h+='<div class="overlay" id="m-release"><div class="modal"><button class="cx" onclick="closeM(\'m-release\')">&#215;</button><div class="m-title">Record restriction release</div><div class="fl"><label>Restricted fund *</label><div class="sw" style="width:100%"><select id="rel-fund" style="width:100%"></select></div></div><div class="fr"><div><label>Amount released ($)</label><input type="number" id="rel-amt" placeholder="0" oninput="fmtAmt(this)"></div><div><label>Date (MM/DD/YYYY)</label><input type="text" id="rel-date" placeholder="MM/DD/YYYY" onblur="autoDate(this)" oninput="autoDate(this)"></div></div><div class="fl"><label>Note / purpose</label><input type="text" id="rel-note" placeholder="e.g. Program activities completed per grant terms"></div><button class="sv-btn" onclick="saveRelease()">Save release</button></div></div>';
    h+='<div class="overlay" id="m-grant"><div class="modal"><button class="cx" onclick="closeM(\'m-grant\')">&#215;</button><div class="m-title">Grant details</div><div class="fl"><label>Grant name *</label><input type="text" id="g-n" placeholder="Smith Family Foundation Grant"></div><div class="fr"><div><label>Funder</label><input type="text" id="g-f"></div><div><label>Status</label><select id="g-st"><option>Prospecting</option><option>Applied</option><option>Awarded</option><option>In Progress</option><option>Reporting</option><option>Closed</option><option>Denied</option></select></div></div><div class="fr"><div><label>Amount awarded ($)</label><input type="number" id="g-a" oninput="fmtAmt(this)"></div><div><label>Application deadline</label><input type="text" id="g-appdl" placeholder="MM/DD/YYYY" onblur="autoDate(this)" oninput="autoDate(this)"></div></div><div class="fr"><div><label>Reporting deadline</label><input type="text" id="g-dl" placeholder="MM/DD/YYYY" onblur="autoDate(this)" oninput="autoDate(this)"></div><div><label>Grant portal URL</label><input type="text" id="g-portal" placeholder="https://apply.foundation.org"></div></div><div class="fl"><label>Match requirement</label><input type="text" id="g-m" placeholder="e.g. 1:1 match"></div><div class="fl"><label>Match amount required ($)</label><input type="number" id="g-mr" placeholder="0" oninput="fmtAmt(this)"></div><div class="fl"><label>Restrictions</label><textarea id="g-r" placeholder="What can and cannot this grant be spent on?"></textarea></div><div class=\"fl\"><label>Close-out requirements <span style=\"font-size:10px;color:var(--muted);font-weight:400\">— must all be checked to mark grant reconciled</span></label><div id=\"g-req-list\" style=\"margin-bottom:6px\"></div><div style=\"display:flex;gap:6px\"><input type=\"text\" id=\"g-req-new\" placeholder=\"e.g. Submit final report\" style=\"flex:1;font-size:12px\"><button class=\"add-btn\" style=\"font-size:11px;padding:4px 10px;flex-shrink:0\" onclick=\"_addGrantReq()\">+ Add</button></div></div><button class=\"sv-btn\" onclick=\"saveGrant()\">Save grant</button></div></div>';
    h+=billModal;h+=ccModal;
    h+='<div class="overlay" id="m-inc"><div class="modal"><button class="cx" onclick="closeM(\'m-inc\')">&#215;</button><div class="m-title">Add income</div>'+ia+'<div class="fl"><label>Source name (optional)</label><input type="text" id="i-n" placeholder="e.g. Spring Gala"></div><div class="fr"><div><label>Category</label><div class="sw" style="width:100%"><select id="i-c" style="width:100%"></select></div></div><div><label>Status</label><select id="i-s"><option>Prospecting</option><option>Applied</option><option>Awarded</option><option>Received</option></select></div></div><div class="fr"><div><label>Projected ($)</label><input type="number" id="i-p" oninput="fmtAmt(this)"></div><div><label>Received ($)</label><input type="number" id="i-r" oninput="fmtAmt(this)"></div></div><div class="fr"><div><label>Date (MM/DD/YYYY)</label><input type="text" id="i-dt" placeholder="MM/DD/YYYY" onblur="autoDate(this)" oninput="autoDate(this)"></div><div><label>Fund</label><div class="sw" style="width:100%"><select id="i-fund" style="width:100%"><option value="">— None —</option></select></div></div></div>'+'<div class=\"fl\" style=\"margin-bottom:.5rem\"><label>Deposit to account</label><div class=\"sw\" style=\"width:100%\"><select id=\"i-bank\" style=\"width:100%\"></select></div></div><div class=\"fl\" style=\"margin-bottom:.5rem\"><label>Project (optional)</label><div class=\"sw\" style=\"width:100%\"><select id=\"i-proj\" style=\"width:100%\"></select></div></div><div class=\"fl\" style=\"margin-bottom:.5rem\"><label>Grant (optional)</label><div class=\"sw\" style=\"width:100%\"><select id=\"i-gid\" style=\"width:100%\"></select></div></div>'+ro+'<div style="display:flex;gap:8px"><button class="sv-btn" onclick="saveInc()">Save</button><button class="add-btn" style="flex:1" onclick="saveIncAndNew()">Save &amp; new</button><button class="add-btn" id="del-inc-btn" style="display:none;background:none;border:1px solid var(--red);color:var(--red)" onclick="deleteFromModal(&quot;income&quot;)">🗑 Delete</button></div></div></div>';
    h+='<div class="overlay" id="m-exp"><div class="modal"><button class="cx" onclick="closeM(\'m-exp\')">&#215;</button><div class="m-title">Add expense</div>'+ca+'<div class="fl"><label>Description</label><input type="text" id="e-d" placeholder="Program supplies"></div><div style="display:none"><select id="e-c"></select></div><div class="fr"><div><label>990 Part IX Line <span style="font-size:10px;color:var(--muted)">(optional)</span></label><div class="sw" style="width:100%"><select id="e-990line" style="width:100%" onchange="exp990LineChange(this)"><option value="">— Select line —</option><option value="L1">Line 1 — Grants to domestic orgs</option><option value="L2">Line 2 — Grants to domestic individuals</option><option value="L3">Line 3 — Grants to foreign orgs/individuals</option><option value="L5">Line 5 — Compensation of officers</option><option value="L6">Line 6 — Compensation not above</option><option value="L7">Line 7 — Other salaries &amp; wages</option><option value="L8">Line 8 — Pension plan contributions</option><option value="L9">Line 9 — Other employee benefits</option><option value="L10">Line 10 — Payroll taxes</option><option value="L11a">Line 11a — Management fees</option><option value="L11b">Line 11b — Legal fees</option><option value="L11c">Line 11c — Accounting fees</option><option value="L11d">Line 11d — Lobbying fees</option><option value="L11e">Line 11e — Professional fundraising</option><option value="L11g">Line 11g — Other fees for services</option><option value="L12">Line 12 — Advertising &amp; promotion</option><option value="L13">Line 13 — Office expenses</option><option value="L14">Line 14 — Information technology</option><option value="L15">Line 15 — Royalties</option><option value="L16a">Line 16a — Occupancy</option><option value="L17">Line 17 — Travel</option><option value="L19">Line 19 — Conferences &amp; meetings</option><option value="L20">Line 20 — Interest</option><option value="L22">Line 22 — Depreciation</option><option value="L23">Line 23 — Insurance</option><option value="L24">Line 24 — Other expenses</option><option value="custom">+ Add custom…</option></select></div></div><div><label>Amount ($)</label><input type="number" id="e-a" oninput="fmtAmt(this)"></div></div><div class="fr"><div><label>Date (MM/DD/YYYY)</label><input type="text" id="e-dt" placeholder="MM/DD/YYYY" onblur="autoDate(this)" oninput="autoDate(this)"></div></div>'+'<div class=\"fl\" style=\"margin-bottom:.5rem\"><label>Paid from account <span style=\\\"color:var(--red)\\\">*</span></label><div class=\"sw\" style=\"width:100%\"><select id=\"e-bank\" style=\"width:100%\"></select></div></div>'+'<div class=\"fr\"><div><label>Fund</label><div class=\"sw\" style=\"width:100%\"><select id=\"e-f\" style=\"width:100%\"><option value=\"\">— None —</option></select></div></div><div><label>Project (optional)</label><div class=\"sw\" style=\"width:100%\"><select id=\"e-proj\" style=\"width:100%\"></select></div></div></div>'+'<div class=\"fr\" style=\"align-items:flex-end;margin-bottom:.5rem\"><div style=\"flex:2\"><label>Grant allocation (optional)</label><div class=\"sw\" style=\"width:100%\"><select id=\"e-gid\" style=\"width:100%\"><option value=\"\">-- No grant --</option></select></div></div><div style=\"flex:1\"><label style=\"font-size:11px\">% toward grant</label><input type=\"number\" id=\"e-gpct\" min=\"0\" max=\"100\" placeholder=\"100\" style=\"width:100%\"></div></div>'+'<div class=\"fl\" style=\"margin-bottom:.5rem\"><label>Check / Ref # (optional)</label><input type=\"text\" id=\"e-ref\" placeholder=\"e.g. 1472 or ACH\"></div>'+'<div class=\"fr\"><div class=\"fl\" style=\"margin-bottom:0\"><label>1099 contractor?</label><select id=\"e-1099\"><option value=\"\">No</option><option value=\"yes\">Yes</option></select></div><div class=\"fl\" style=\"margin-bottom:0\"><label>Vendor name</label><input type=\"text\" id=\"e-vendor\" placeholder=\"e.g. John Smith Consulting\\"></div><div class=\\"fl\\" style=\\"margin-bottom:0\"><label>EIN / TIN <span style=\\"font-size:10px;color:var(--muted)\">for 1099</span></label><input type=\\"text\" id=\\"e-tin\" placeholder="12-3456789"></div></div<div class=\\\"fr\\\"><div class=\\\"fl\\\" style=\\\"margin-bottom:0\\\"><label>Functional <span style=\\\"font-size:10px;color:var(--muted)\\\">(990)</span></label><select id=\\\"e-func\\\"><option value=\\\"\\\">&#x2014; Select &#x2014;</option><option value=\\\"program\\\">Program services</option><option value=\\\"management\\\">Mgmt &amp; general</option><option value=\\\"fundraising\\\">Fundraising</option></select></div><div class=\\\"fl\\\" style=\\\"margin-bottom:0\\\"><label>Receipt URL (optional)</label><input type=\\\"url\\\" id=\\\"e-url\\\" placeholder=\\\"https://drive.google.com/...\\\"></div></div>>'+ro+'<div style="display:flex;gap:8px"><button class="sv-btn" onclick="saveExp()">Save</button><button class="add-btn" style="flex:1" onclick="saveExpAndNew()">Save &amp; new</button><button class="add-btn" id="del-exp-btn" style="display:none;background:none;border:1px solid var(--red);color:var(--red)" onclick="deleteFromModal(&quot;expenses&quot;)">🗑 Delete</button></div></div></div>';
  }else if(type==='sb'){
    h+='<div class="overlay" id="m-rev"><div class="modal"><button class="cx" onclick="closeM(\'m-rev\')">&#215;</button><div class="m-title">Add revenue stream</div>'+ra+'<div class="fl"><label>Stream name</label><input type="text" id="r-n" placeholder="Consulting retainer"></div><div class="fl"><label>Customer / Client name (optional)</label><input type="text" id="r-cust" placeholder="e.g. Acme Corp"></div><div class="fr"><div><label>Category</label><div class="sw" style="width:100%"><select id="r-c" style="width:100%"></select></div></div><div><label>Confidence</label><select id="r-cf"><option>Confirmed</option><option>Likely</option><option>Possible</option><option>Speculative</option></select></div></div><div class="fr"><div><label>Projected ($)</label><input type="number" id="r-p" oninput="fmtAmt(this)"></div><div><label>Actual ($)</label><input type="number" id="r-a" oninput="fmtAmt(this)"></div></div>'+'<div class=\"fl\" style=\"margin-bottom:.5rem\"><label>Date (MM/DD/YYYY)</label><input type=\"text\" id=\"r-dt\" placeholder=\"MM/DD/YYYY\" onblur=\"autoDate(this)\" oninput=\"autoDate(this)\"></div><div class=\"fl\" style=\"margin-bottom:.5rem\"><label>Deposit to account</label><div class=\"sw\" style=\"width:100%\"><select id=\"r-bank\" style=\"width:100%\"></select></div></div><div class=\"fl\" style=\"margin-bottom:.5rem\"><label>Project (optional)</label><div class=\"sw\" style=\"width:100%\"><select id=\"r-proj\" style=\"width:100%\"></select></div></div><div class=\"fl\" style=\"margin-bottom:.5rem\"><label>Sales tax jurisdiction</label><div class=\"sw\" style=\"width:100%\"><select id=\"r-taxjur\" style=\"width:100%\" onchange=\"revTaxCalc()\"><option value=\"\">No sales tax</option></select></div></div><div class=\"fr\"><div><label>Tax rate (%)</label><input type=\"number\" id=\"r-taxrate\" min=\"0\" max=\"25\" step=\"0.001\" placeholder=\"0\" value=\"0\" oninput=\"revTaxCalc()\"></div><div><label>Tax collected ($)</label><input type=\"number\" id=\"r-taxamt\" placeholder=\"auto\" readonly style=\"background:var(--bg);color:var(--muted)\"></div></div>'+ro+'<div style="display:flex;gap:8px"><button class="sv-btn" onclick="saveRev()">Save</button><button class="add-btn" style="flex:1" onclick="saveRevAndNew()">Save &amp; new</button><button class="add-btn" id="del-rev-btn" style="display:none;background:none;border:1px solid var(--red);color:var(--red)" onclick="deleteFromModal(&quot;revenue&quot;)">🗑 Delete</button></div></div></div>';
    h+='<div class="overlay" id="m-exp"><div class="modal"><button class="cx" onclick="closeM(\'m-exp\')">&#215;</button><div class="m-title">Add expense</div>'+ca+'<div class="fl"><label>Description</label><input type="text" id="e-d" placeholder="Software subscriptions"></div><div style="display:none"><select id="e-c"></select></div><div class="fr"><div><label>Subcategory <span style="font-size:10px;color:var(--muted)">(optional)</span></label><input type="text" id="e-subcat" list="sb-subcat-list" placeholder="e.g. Software, Ads, Meals…" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--soft);color:var(--text)"><datalist id="sb-subcat-list"><option value="Software &amp; subscriptions"><option value="Meals &amp; entertainment"><option value="Advertising &amp; marketing"><option value="Office supplies"><option value="Professional development"><option value="Travel &amp; transportation"><option value="Utilities"><option value="Repairs &amp; maintenance"><option value="Contractor payments"><option value="Insurance"><option value="Rent &amp; lease"><option value="Equipment &amp; hardware"><option value="Bank &amp; payment fees"><option value="Taxes &amp; licenses"><option value="Shipping &amp; postage"><option value="Inventory"><option value="Vehicle expenses"></datalist></div><div><label>Amount ($)</label><input type="number" id="e-a" oninput="fmtAmt(this)"></div></div><div class="fr"><div><label>Frequency</label><select id="e-fr">'+FO+'</select></div><div><label>Type</label><select id="e-fx"><option>Fixed</option><option>Variable</option></select></div></div>'+'<div class=\"fl\" style=\"margin-bottom:.5rem\"><label>Paid from account <span style=\\\"color:var(--red)\\\">*</span></label><div class=\"sw\" style=\"width:100%\"><select id=\"e-bank\" style=\"width:100%\"></select></div></div>'+'<div class=\"fl\" style=\"margin-bottom:.5rem\"><label>Project (optional)</label><div class=\"sw\" style=\"width:100%\"><select id=\"e-proj\" style=\"width:100%\"></select></div></div>'+'<div class=\"fl\" style=\"margin-bottom:.5rem\"><label>Check / Ref # (optional)</label><input type=\"text\" id=\"e-ref\" placeholder=\"e.g. 1472 or ACH\"></div>'+'<div class=\"fr\"><div class=\"fl\" style=\"margin-bottom:0\"><label>1099 contractor?</label><select id=\"e-1099\"><option value=\"\">No</option><option value=\"yes\">Yes</option></select></div><div class=\"fl\" style=\"margin-bottom:0\"><label>Vendor name</label><input type=\"text\" id=\"e-vendor\" placeholder=\"e.g. John Smith Consulting\\"></div><div class=\\"fl\\" style=\\"margin-bottom:0\"><label>EIN / TIN <span style=\\"font-size:10px;color:var(--muted)\">for 1099</span></label><input type=\\"text\" id=\\"e-tin\" placeholder="12-3456789"></div></div<div class=\\\"fl\\\" style=\\\"margin-bottom:.5rem\\\"><label>Receipt URL (optional)</label><input type=\\\"url\\\" id=\\\"e-url\\\" placeholder=\\\"https://drive.google.com/...\\\"></div>>'+ro+'<div style="display:flex;gap:8px"><button class="sv-btn" onclick="saveExp()">Save</button><button class="add-btn" style="flex:1" onclick="saveExpAndNew()">Save &amp; new</button><button class="add-btn" id="del-exp-btn" style="display:none;background:none;border:1px solid var(--red);color:var(--red)" onclick="deleteFromModal(&quot;expenses&quot;)">🗑 Delete</button></div></div></div>';
    h+='<div class="overlay" id="m-inv"><div class="modal" style="max-width:480px"><button class="cx" onclick="closeM(\'m-inv\')">&#215;</button><div class="m-title">Invoice</div><div class="fr"><div><label>Invoice #</label><input type="text" id="inv-num" placeholder="INV-001"></div><div><label>Status</label><select id="inv-status"><option value="Draft">Draft</option><option value="Sent">Sent</option><option value="Paid">Paid</option><option value="Overdue">Overdue</option></select></div></div><div class="fl"><label>Client / company</label><input type="text" id="inv-client" placeholder="Acme Corp"></div><div class="fl"><label>Description</label><input type="text" id="inv-desc" placeholder="Consulting services — April 2026"></div><div class="fr"><div><label>Amount ($)</label><input type="number" id="inv-amt" placeholder="0" oninput="fmtAmt(this)"></div><div><label>Issue date</label><input type="text" id="inv-date" placeholder="MM/DD/YYYY" onblur="autoDate(this)" oninput="autoDate(this)"></div></div><div class="fl"><label>Due date</label><input type="text" id="inv-due" placeholder="MM/DD/YYYY" onblur="autoDate(this)" oninput="autoDate(this)"></div><div class="fl"><label>Notes (optional)</label><textarea id="inv-notes" placeholder="Payment terms, bank details..."></textarea></div><div style="display:flex;gap:8px"><button class="sv-btn" onclick="saveInv()">Save invoice</button><button class="add-btn" style="flex:1" onclick="saveInvAndNew()">Save &amp; new</button></div></div></div>';
    h+='<div class="overlay" id="m-je"><div class="modal"><button class="cx" onclick="closeM(\'m-je\')">&#215;</button><div class="m-title">Journal entry</div><div class="fr"><div><label>Date</label><input type="text" id="je-date" placeholder="MM/DD/YYYY" onblur="autoDate(this)" oninput="autoDate(this)"></div><div><label>Type</label><select id="je-type"><option>Loan payment</option><option>Depreciation</option><option>Equity change</option><option>Accrual</option><option>Prepaid expense</option><option>Other</option></select></div></div><div class="fl"><label>Memo</label><input type="text" id="je-memo" placeholder="e.g. Monthly loan principal payment"></div><div class="fr"><div><label>Debit account</label><input type="text" id="je-debit" placeholder="e.g. Loan Payable"></div><div><label>Credit account</label><input type="text" id="je-credit" placeholder="e.g. Cash / Assets"></div></div><div class="fl"><label>Amount ($)</label><input type="number" id="je-amt" placeholder="0" oninput="fmtAmt(this)"></div><div class="fl"><label>Notes (optional)</label><textarea id="je-notes" placeholder="Additional details..."></textarea></div><button class="sv-btn" onclick="saveJE()">Save entry</button></div></div>';
    h+='<div class="overlay" id="m-bs"><div class="modal"><button class="cx" onclick="closeM(\'m-bs\')">&#215;</button><div class="m-title">Balance sheet item</div><div style="font-size:12px;color:var(--muted);margin-bottom:.75rem">Section: <strong id="bs-sec-label"></strong></div><div class="fl"><label>Account name</label><input type="text" id="bs-name" placeholder="e.g. Cash, Equipment, Loan Payable"></div><div class="fl"><label id="bs-amt-label">Amount ($)</label><input type="number" id="bs-amt" placeholder="0" oninput="fmtAmt(this)"></div><button class="sv-btn" onclick="saveBSItem()">Save</button></div></div>';
    h+=billModal;h+=ccModal;
    h+='<div class="overlay" id="m-loan"><div class="modal"><button class="cx" onclick="closeM(\'m-loan\')">&#215;</button><div class="m-title">Add loan</div><div class="fl"><label>Loan name *</label><input type="text" id="loan-name" placeholder="e.g. SBA Loan, Equipment Financing"></div><div class="fr"><div class="fl" style="margin-bottom:0"><label>Principal ($)</label><input type="number" id="loan-principal" placeholder="50000" oninput="fmtAmt(this)"></div><div class="fl" style="margin-bottom:0"><label>Annual interest rate (%)</label><input type="number" id="loan-rate" placeholder="6.5" step="0.01"></div></div><div class="fr"><div class="fl" style="margin-bottom:0"><label>Term (months)</label><input type="number" id="loan-term" placeholder="60"></div><div class="fl" style="margin-bottom:0"><label>First payment date</label><input type="text" id="loan-start" placeholder="MM/DD/YYYY" onblur="autoDate(this)" oninput="autoDate(this)"></div></div><button class="sv-btn" onclick="saveLoan()">Generate schedule</button></div></div>';
  }else{
    h+='<div class="overlay" id="m-peinc"><div class="modal"><button class="cx" onclick="closeM(\'m-peinc\')">&#215;</button><div class="m-title">Add income</div>'+pia+'<div class="fl"><label>Source</label><input type="text" id="pi-n" placeholder="e.g. Salary"></div><div class="fr"><div><label>Category</label><div class="sw" style="width:100%"><select id="pi-c" style="width:100%"></select></div></div><div><label>Amount ($)</label><input type="number" id="pi-a" oninput="fmtAmt(this)"></div></div><div class="fr"><div><label>Frequency</label><select id="pi-f">'+FO+'</select></div><div><label>Date (MM/DD/YYYY)</label><input type="text" id="pi-d" placeholder="MM/DD/YYYY" onblur="autoDate(this)" oninput="autoDate(this)"></div></div>'+ro+'<div style="display:flex;gap:8px"><button class="sv-btn" onclick="savePeInc()">Save</button><button class="add-btn" style="flex:1" onclick="savePeIncAndNew()">Save &amp; new</button></div></div></div>';
    h+='<div class="overlay" id="m-exp"><div class="modal"><button class="cx" onclick="closeM(\'m-exp\')">&#215;</button><div class="m-title">Add expense</div>'+ca+'<div class="fl"><label>Description</label><input type="text" id="e-d" placeholder="e.g. Rent"></div><div class="fr"><div><label>Category</label><div class="sw" style="width:100%"><select id="e-c" style="width:100%"></select></div></div><div><label>Amount ($)</label><input type="number" id="e-a" oninput="fmtAmt(this)"></div></div><div class="fr"><div><label>Frequency</label><select id="e-fr">'+FO+'</select></div><div><label>Date (MM/DD/YYYY)</label><input type="text" id="e-dt" placeholder="MM/DD/YYYY" onblur="autoDate(this)" oninput="autoDate(this)"></div></div>'+'<div class=\"fl\" style=\"margin-bottom:.5rem\"><label>Paid from account <span style=\\\"color:var(--red)\\\">*</span></label><div class=\"sw\" style=\"width:100%\"><select id=\"e-bank\" style=\"width:100%\"></select></div></div>'+'<div class=\"fl\" style=\"margin-bottom:.5rem\"><label>Project (optional)</label><div class=\"sw\" style=\"width:100%\"><select id=\"e-proj\" style=\"width:100%\"></select></div></div>'+'<div class=\"fl\" style=\"margin-bottom:.5rem\"><label>Check / Ref # (optional)</label><input type=\"text\" id=\"e-ref\" placeholder=\"e.g. 1472 or ACH\"></div>'+'<div class=\"fr\"><div class=\"fl\" style=\"margin-bottom:0\"><label>1099 contractor?</label><select id=\"e-1099\"><option value=\"\">No</option><option value=\"yes\">Yes</option></select></div><div class=\"fl\" style=\"margin-bottom:0\"><label>Vendor name</label><input type=\"text\" id=\"e-vendor\" placeholder=\"e.g. John Smith Consulting\\"></div><div class=\\"fl\\" style=\\"margin-bottom:0\"><label>EIN / TIN <span style=\\"font-size:10px;color:var(--muted)\">for 1099</span></label><input type=\\"text\" id=\\"e-tin\" placeholder="12-3456789"></div></div<div class=\\\"fl\\\" style=\\\"margin-bottom:.5rem\\\"><label>Receipt URL (optional)</label><input type=\\\"url\\\" id=\\\"e-url\\\" placeholder=\\\"https://drive.google.com/...\\\"></div>>'+ro+'<div style="display:flex;gap:8px"><button class="sv-btn" onclick="saveExp()">Save</button><button class="add-btn" style="flex:1" onclick="saveExpAndNew()">Save &amp; new</button><button class="add-btn" id="del-exp-btn" style="display:none;background:none;border:1px solid var(--red);color:var(--red)" onclick="deleteFromModal(&quot;expenses&quot;)">🗑 Delete</button></div></div></div>';
  }
  h+='<div class="overlay" id="m-budget"><div class="modal"><button class="cx" onclick="closeM(\'m-budget\')">&#215;</button><div class="m-title">Budget line item</div><div class="fl"><label>Group</label><div class="sw" style="width:100%"><select id="b-g" style="width:100%"></select></div></div><div class="fl"><label>Line item (category)</label><div class="sw" style="width:100%"><select id="b-c" style="width:100%"></select></div></div><div class="fr"><div><label>Type</label><select id="b-t"><option>Income</option><option>Expense</option></select></div><div><label>Budgeted amount ($)</label><input type="number" id="b-a" oninput="fmtAmt(this)"></div></div><div class="fl"><label>Fund (optional)</label><div class="sw" style="width:100%"><select id="b-fund" style="width:100%"><option value="">— None —</option></select></div></div><div class="fl"><label>Overspend policy</label><select id="b-overspend"><option value="warn">⚠ Warn — allow with warning</option><option value="strict">🔒 Strict — block save</option></select></div><div style="display:flex;gap:8px"><button class="sv-btn" id="budget-sv-btn" onclick="saveBudget()">Save &amp; close</button><button class="add-btn" style="flex:1" onclick="saveBudgetAndNew()">Save &amp; new</button></div></div></div>';
  h+='<div class="overlay" id="m-jrn"><div class="modal"><button class="cx" onclick="closeM(\'m-jrn\')">&#215;</button><div class="m-title">Journal entry</div><div class="fl"><label>Entry</label><textarea id="j-t" placeholder="Wins, challenges, reflections..."></textarea></div><button class="sv-btn" onclick="saveJrn()">Save</button></div></div>';
  h+='<div class="overlay" id="m-act"><div class="modal"><button class="cx" onclick="closeM(\'m-act\')">&#215;</button><div class="m-title">Daily action item</div><div class="fl"><label>Task</label><input type="text" id="a-t" placeholder="e.g. Follow up on grant"></div><div class="fr"><div><label>Due date</label><input type="text" id="a-d" placeholder="MM/DD/YYYY" onblur="autoDate(this)" oninput="autoDate(this)"></div><div><label>Assigned to</label><input type="text" id="a-w" placeholder="Optional"></div></div><div class="fl"><label>Priority</label><select id="a-p"><option>High</option><option>Medium</option><option>Low</option></select></div><button class="sv-btn" onclick="saveAct()">Save</button></div></div>';
  mc.innerHTML=h;
}

// ══════════════════════════════════════════
// SAVE FUNCTIONS
// ══════════════════════════════════════════
// DEFER: saveGrant, saveInc, saveRev, savePeInc, saveExp, saveBudget, saveJrn, saveAct
// are left as-is (branching logic). Refactoring these is medium-risk and deferred to Phase 3.
function saveGrant(){
  var c=gc();if(!c.grants)c.grants=[];
  var n=sanitizeInput(g('g-n').value.trim());if(!n)return;
  var _rGEI=resolveEI(c.grants);
  var prevGrant=_rGEI>=0?c.grants[_rGEI]:null;
  var item={
    id:_rGEI>=0?c.grants[_rGEI].id:uid(),
    name:n,funder:sanitizeInput(g('g-f').value.trim()),
    awarded:Number(g('g-a').value||0),
    status:g('g-st').value,
    deadline:g('g-dl').value,
    appDeadline:g('g-appdl')&&g('g-appdl').value||'',
    portalUrl:g('g-portal')&&g('g-portal').value.trim()||'',
    match:g('g-m').value,
    matchRequired:Number(g('g-mr')&&g('g-mr').value||0)||0,
    restrict:g('g-r').value,
    requirements:window._gReqTemp||((_rGEI>=0&&c.grants[_rGEI].requirements)||[]),
    reconciled:_rGEI>=0?c.grants[_rGEI].reconciled:false
  };
  window._gReqTemp=null;
  // Auto-post income when status becomes Awarded/In Progress with an amount
  var awardedStatuses=['Awarded','In Progress'];
  var wasAwarded=prevGrant&&awardedStatuses.indexOf(prevGrant.status)>=0;
  var isAwarded=awardedStatuses.indexOf(item.status)>=0;
  var hasAmt=item.awarded>0;
  // Check if income already exists for this grant to avoid duplicates
  var existingInc=(c.income||[]).find(function(r){return r.fromGrantId===item.id;});
  if(isAwarded&&hasAmt&&!wasAwarded&&!existingInc){
    // New award — auto-create income entry
    if(!c.income)c.income=[];
    var incEntry={
      id:uid(),name:item.name,
      cat:'Grant',status:'Awarded',
      proj:item.awarded,recv:0,
      date:new Date().toISOString().split('T')[0],
      fund:item.restrict||'',
      acctCode:'4020',
      fromGrantId:item.id,
      grantId:item.id
    };
    c.income.push(incEntry);
    markDirty('funding','budget','reports','bs');
    // Show a quiet confirmation
    setTimeout(function(){
      var msg=document.createElement('div');
      msg.style.cssText='position:fixed;bottom:24px;right:24px;background:var(--np);color:#fff;padding:.75rem 1.25rem;border-radius:10px;font-size:13px;z-index:600;box-shadow:0 4px 16px rgba(0,0,0,.2)';
      msg.textContent='✓ Grant income of '+fmt(item.awarded)+' added to Income tab';
      document.body.appendChild(msg);
      setTimeout(function(){msg.remove();},3500);
    },300);
  } else if(isAwarded&&hasAmt&&existingInc&&existingInc.proj!==item.awarded){
    // Amount changed — update the projected amount
    existingInc.proj=item.awarded;
    markDirty('funding','budget','reports');
  }
  markDirty('grants','budget','reports');
  if(_rGEI>=0)c.grants[_rGEI]=item;else{c.grants.push(item);AG=item.id;}
  sv();renderGrants(c);renderBudgetMultiYear();renderReports();renderTodoBar();
  closeM('m-grant');
  ['g-n','g-f','g-a','g-dl','g-appdl','g-portal','g-m','g-mr','g-r'].forEach(function(id){var el=g(id);if(el)el.value='';});
  // If opened from bank tab — link the new grant to the pending transaction and re-render
  if(window._bankPendingGrantTxnId){
    var _bt=(c.bankTransactions||[]).find(function(x){return x.id===window._bankPendingGrantTxnId;});
    if(_bt){
      _bt.grantId=item.id;
      _bt.category=_bt.type==='debit'?_bt.category:'Grant';
      sv();
      if(typeof renderBank==='function')setTimeout(function(){renderBank(c);},50);
    }
    window._bankPendingGrantTxnId=null;
  }
}
function saveInc(){var c=gc();if(!c.income)c.income=[];
  // PERIOD LOCK GUARD
  var _incLockDate=g('i-dt')&&g('i-dt').value.trim();
  if(_incLockDate&&isDateLocked(c,_incLockDate)){periodLockAlert(c.closedThrough);return;}
  var n=sanitizeInput(g('i-n').value.trim()||g('i-c').value.trim()||'Income');var pid=g('i-proj')&&g('i-proj').value||'';var bv=g('i-bank')&&g('i-bank').value||'';
  // Guard: warn before overwriting a reconciled income entry
  var _rEI=resolveEI(c.income);
  if(_rEI>=0&&c.income[_rEI]&&c.income[_rEI].reconciled){if(!confirm('⚠ This income entry has been reconciled.\n\nSaving changes may affect a closed period. Continue?'))return;}
  // Duplicate detection — only on new entries
  if(EI<0){var _newAmt=Number(g('i-r')&&g('i-r').value||g('i-p')&&g('i-p').value||0);var _newDate=g('i-dt')&&g('i-dt').value||'';var _newName=g('i-n')&&g('i-n').value.trim()||'';if(_newAmt&&_newDate){var _dupInc=(c.income||[]).find(function(r){var d=parseDate(r.date||'');var nd=parseDate(_newDate);return!r.deleted&&Math.abs(Number(r.recv||r.proj||0)-_newAmt)<0.01&&d&&nd&&Math.abs(d-nd)<7*86400000&&(r.name||'').toLowerCase()===_newName.toLowerCase();});if(_dupInc&&!confirm('⚠ Possible duplicate: an income entry for '+fmt(_newAmt)+' from "'+(_dupInc.name||'unknown')+'" exists within 7 days of this date.\n\nSave anyway?'))return;}}
  // Only require deposit account if the dropdown has real options (banks or cash assets exist)
  var _bankSel=g('i-bank');var _hasAccounts=_bankSel&&_bankSel.options.length>1&&!(_bankSel.options[1]&&_bankSel.options[1].disabled);
  if(!bv&&_hasAccounts){alert('Please select a "Deposit to account" before saving.');if(_bankSel)_bankSel.focus();return;}
  var iBsAssetId=bv.indexOf('bsasset:')=== 0?bv.slice(8):'';
  var _oldInc=_rEI>=0?c.income[_rEI]:null;
  var _iAmtErr=validateAmt(g('i-r').value,{allowZero:true,label:'Amount received'});if(_iAmtErr){alert(_iAmtErr);if(g('i-r'))g('i-r').focus();return;}
  var cat=g('i-c').value;var _iRecurEnd=g('f-rec-end')&&g('f-rec-end').value.trim()||'';var _iRecurCnt=g('f-rec-count')&&Number(g('f-rec-count').value)||0;var item={name:n,cat:cat,status:g('i-s').value,proj:Number(g('i-p').value||0),recv:Number(g('i-r').value||0),date:g('i-dt')&&g('i-dt').value||'',fund:g('i-fund')&&g('i-fund').value||'',acctCode:g('i-acct')&&g('i-acct').value||lookupAcctByCAT(c,cat)||'',recurring:g('f-rec').value,grantId:g('i-gid')&&g('i-gid').value||''};
  if(item.recurring&&item.recurring!=='None'){if(_iRecurEnd)item.recurEndDate=_iRecurEnd;if(_iRecurCnt>0){item.recurCount=_iRecurCnt;item.recurPostedCount=0;}}
  if(pid)item.projectId=pid;
  if(bv.indexOf('bank:')=== 0)item.bankId=bv.slice(5);
  if(iBsAssetId){item.bsAssetId=iBsAssetId;item.acctCode=ensureBSAssetCOA(c,iBsAssetId)||item.acctCode;}
  item.audit=_rEI>=0?auditTxn(_oldInc,item,'income'):_auditCreated();
  var _iRecv=Number(item.recv||0);var _iPrevRecv=_oldInc?Number(_oldInc.recv||0):0;
  if(iBsAssetId){applyBSAssetDelta(c,iBsAssetId,_iRecv-_iPrevRecv);}
  else if(_oldInc&&_oldInc.bsAssetId){applyBSAssetDelta(c,_oldInc.bsAssetId,-_iPrevRecv);}// account changed — reverse old
  if(_rEI>=0)updateLedgerEntry(c,item.id||c.income[_rEI].id,_defaultCashCode(c),item.acctCode||'4010',Number(item.recv||0),item.name||'Income','income');else postToLedger(c,_defaultCashCode(c),item.acctCode||'4010',Number(item.recv||0),item.name||'Income','income',item.id);markDirty('funding','budget','reports','bs');if(_rEI>=0)c.income[_rEI]=item;else c.income.push(item);sv();var _pfunding=g('p-funding');if(_pfunding&&_pfunding.classList.contains('active'))renderNpInc(c);renderBudgetMultiYear();renderReports();renderBalanceSheet(c);if(item.grantId){var _pgrantsInc=g('p-grants');if(_pgrantsInc&&_pgrantsInc.classList.contains('active'))renderGrants(c);}var _rp=g('p-recon');if(_rp&&_rp.classList.contains('active'))renderReconciliation(c);closeM('m-inc');['i-n','i-c','i-p','i-r','i-dt','i-fund','i-gid'].forEach(function(id){var el=g(id);if(el)el.value='';}); }
function saveRev(){var c=gc();if(!c.revenue)c.revenue=[];
  // PERIOD LOCK GUARD
  var _revLockDate=g('r-dt')&&g('r-dt').value.trim();
  if(_revLockDate&&isDateLocked(c,_revLockDate)){periodLockAlert(c.closedThrough);return;}
  var n=sanitizeInput(g('r-n').value.trim()||g('r-c').value.trim()||'Revenue');var pid=g('r-proj')&&g('r-proj').value||'';var bv=g('r-bank')&&g('r-bank').value||'';
  // Only require deposit account if the dropdown has real options (banks or cash assets exist)
  var _rbankSel=g('r-bank');var _rHasAccounts=_rbankSel&&_rbankSel.options.length>1&&!(_rbankSel.options[1]&&_rbankSel.options[1].disabled);
  if(!bv&&_rHasAccounts){alert('Please select a "Deposit to account" before saving.');if(_rbankSel)_rbankSel.focus();return;}
  var rBsAssetId=bv.indexOf('bsasset:')=== 0?bv.slice(8):'';
  var _rREI=resolveEI(c.revenue);
  var _oldRev=_rREI>=0?c.revenue[_rREI]:null;
  var _rAmtErr=validateAmt(g('r-a').value,{allowZero:true,label:'Actual revenue'});if(_rAmtErr){alert(_rAmtErr);if(g('r-a'))g('r-a').focus();return;}
  var cat=g('r-c').value;var _taxRate=Number(g('r-taxrate')&&g('r-taxrate').value||0);var _taxAmt=Number(g('r-taxamt')&&g('r-taxamt').value||0);
  var _taxJur=g('r-taxjur')&&g('r-taxjur').value||'';var _rRecurEnd=g('f-rec-end')&&g('f-rec-end').value.trim()||'';var _rRecurCnt=g('f-rec-count')&&Number(g('f-rec-count').value)||0;var customerName2=sanitizeInput(g('r-cust')&&g('r-cust').value.trim()||'');var item={name:n,cat:cat,conf:g('r-cf').value,proj:Number(g('r-p').value||0),act:Number(g('r-a').value||0),date:g('r-dt')&&g('r-dt').value||'',acctCode:g('r-acct')&&g('r-acct').value||lookupAcctByCAT(c,cat)||'',recurring:g('f-rec').value};
  if(customerName2)item.customerName=customerName2;if(item.recurring&&item.recurring!=='None'){if(_rRecurEnd)item.recurEndDate=_rRecurEnd;if(_rRecurCnt>0){item.recurCount=_rRecurCnt;item.recurPostedCount=0;}}
  if(_taxRate>0){item.taxRate=_taxRate;item.taxAmt=_taxAmt;}
  if(_taxJur){item.taxJurisdiction=_taxJur;}
  if(pid)item.projectId=pid;
  if(bv.indexOf('bank:')=== 0)item.bankId=bv.slice(5);
  if(rBsAssetId){item.bsAssetId=rBsAssetId;item.acctCode=ensureBSAssetCOA(c,rBsAssetId)||item.acctCode;}
  item.audit=_rREI>=0?auditTxn(_oldRev,item,'revenue'):_auditCreated();
  var _rAct=Number(item.act||0);var _rPrevAct=_oldRev?Number(_oldRev.act||0):0;
  if(rBsAssetId){applyBSAssetDelta(c,rBsAssetId,_rAct-_rPrevAct);}
  else if(_oldRev&&_oldRev.bsAssetId){applyBSAssetDelta(c,_oldRev.bsAssetId,-_rPrevAct);}// account changed — reverse old
  // SALES TAX SPLIT: if taxAmt>0, post net revenue to revenue acct + tax collected to Sales Tax Payable
  var _stCode=_defaultSTaxCode(c);
  // Ensure 2350 Sales Tax Payable exists in COA for this client (auto-add if missing)
  if(_taxAmt>0&&!(c.accounts||[]).find(function(a){return a.code===_stCode;})){
    if(!c.accounts)c.accounts=[];
    c.accounts.push({code:'2350',name:'Sales tax payable',type:'Liability',cat:'Sales Tax'});
  }
  var _netRevAmt=Number(item.act||0)-(_taxAmt>0?_taxAmt:0);
  var _existingId=_rREI>=0?(item.id||c.revenue[_rREI].id):item.id;
  if(_rREI>=0){
    // Edit: supersede old ledger entries and repost
    updateLedgerEntry(c,_existingId,_defaultCashCode(c),item.acctCode||'4010',_taxAmt>0?_netRevAmt:Number(item.act||0),item.name||'Revenue','revenue');
    if(_taxAmt>0)postToLedger(c,_defaultCashCode(c),_stCode,_taxAmt,(item.name||'Revenue')+' — sales tax collected','revenue',_existingId+':stax');
  }else{
    postToLedger(c,_defaultCashCode(c),item.acctCode||'4010',_taxAmt>0?_netRevAmt:Number(item.act||0),item.name||'Revenue','revenue',item.id);
    if(_taxAmt>0)postToLedger(c,_defaultCashCode(c),_stCode,_taxAmt,(item.name||'Revenue')+' — sales tax collected','revenue',item.id+':stax');
  }
  markDirty('revenue','budget','reports','bs');if(_rREI>=0)c.revenue[_rREI]=item;else c.revenue.push(item);sv();var _prev=g('p-revenue');if(_prev&&_prev.classList.contains('active'))renderRev(c);renderBudgetMultiYear();renderReports();renderBalanceSheet(c);var _rp=g('p-recon');if(_rp&&_rp.classList.contains('active'))renderReconciliation(c);closeM('m-rev');['r-n','r-c','r-p','r-a','r-dt','r-taxrate','r-taxamt','r-cust'].forEach(function(id){var el=g(id);if(el)el.value='';});if(g('r-taxrate'))g('r-taxrate').value='0';if(g('r-taxjur'))g('r-taxjur').value=''; }
function revTaxCalc(){
  var act=Number(g('r-a')&&g('r-a').value||0);
  // Auto-fill rate from selected jurisdiction
  var jurSel=g('r-taxjur');var jurOpt=jurSel&&jurSel.options[jurSel.selectedIndex];
  if(jurOpt&&jurOpt.value&&jurOpt.getAttribute('data-rate')){
    var jurRate=Number(jurOpt.getAttribute('data-rate')||0);
    if(g('r-taxrate'))g('r-taxrate').value=jurRate;
  }
  var rate=Number(g('r-taxrate')&&g('r-taxrate').value||0);
  var ta=g('r-taxamt');
  if(ta)ta.value=act>0&&rate>0?(act*(rate/100)).toFixed(2):'';
}
// ── EDIT ITEM pre-fill for tax fields ───────────────────────────────────────
function savePeInc(){var c=gc();if(!c.income)c.income=[];var n=g('pi-n').value.trim();if(!n)return;var item={name:n,cat:g('pi-c').value,amt:Number(g('pi-a').value||0),freq:g('pi-f').value,date:g('pi-d').value,acctCode:g('pi-acct')&&g('pi-acct').value||'',recurring:g('f-rec').value};markDirty('peinc','budget','reports');var _rPEI=resolveEI(c.income);if(_rPEI>=0)c.income[_rPEI]=item;else c.income.push(item);sv();renderPeInc(c);renderBudgetMultiYear();renderReports();closeM('m-peinc');['pi-n','pi-c','pi-a','pi-d'].forEach(function(id){g(id).value='';}); }
// ── FIX-6: Balance sheet cash asset adjustment ──────────────────────────────
// Uses bsAssetId (stable ID) — never array index.
function getBSAsset(c,bsAssetId){
  if(!bsAssetId||!c.balanceSheet||!c.balanceSheet.assets)return null;
  return c.balanceSheet.assets.find(function(a){return a.id===bsAssetId;})||null;
}
function ensureBSAssetCOA(c,bsAssetId){
  var asset=getBSAsset(c,bsAssetId);if(!asset)return'';
  if(!c.accounts)c.accounts=[];
  var existing=c.accounts.find(function(a){
    return a.type==='Asset'&&a.name.toLowerCase()===asset.name.toLowerCase();
  });
  if(existing)return existing.code;
  var used=c.accounts.filter(function(a){return a.code.indexOf('1')=== 0;}).map(function(a){return parseInt(a.code)||0;});
  var code=String(used.length?(Math.max.apply(null,used)+10):1010);
  var entry={id:uid(),code:code,name:asset.name,type:'Asset',cat:asset.name,fromBSAsset:true};
  c.accounts.push(entry);
  c.accounts.sort(function(a,b){return a.code.localeCompare(b.code);});
  return code;
}
// ── FIX-B: openingBalance — self-healing BS asset balances ──────────────────
// The balance of a cash asset is NEVER stored as a mutable number.
// It is always derived: openingBalance + net of all tagged transactions.
// applyBSAssetDelta is now a no-op — kept so no call sites break.
function computeBSAssetBalance(c,assetId){
  var asset=getBSAsset(c,assetId);if(!asset)return 0;
  var base=Number(asset.openingBalance||0);
  var inc=(c.income||[]).filter(function(r){return r.bsAssetId===assetId;}).reduce(function(s,r){return s+Number(r.recv||r.amt||0);},0);
  var rev=(c.revenue||[]).filter(function(r){return r.bsAssetId===assetId;}).reduce(function(s,r){return s+Number(r.act||0);},0);
  var exp=(c.expenses||[]).filter(function(e){return e.bsAssetId===assetId;}).reduce(function(s,e){return s+Number(e.amt||0);},0);
  return base+inc+rev-exp;
}
function applyBSAssetDelta(c,bsAssetId,delta){
  // No-op — balance is now derived live from transactions via computeBSAssetBalance.
  // Kept to avoid breaking any call sites. Safe to call; does nothing.
}


// Auto-sync vendor from expense — runs on every save, no sync button needed.
function syncVendorFromExpense(c,item){
  var name=(item.vendor1099||item.desc||'').trim();
  if(!name)return;
  if(!c.vendors)c.vendors=[];
  var exists=c.vendors.find(function(v){return v.name&&v.name.toLowerCase()===name.toLowerCase();});
  if(exists){
    if(item.is1099&&!exists.is1099){exists.is1099=true;if(item.tin1099&&!exists.tin)exists.tin=item.tin1099;}
    return;
  }
  c.vendors.push({id:uid(),name:name,defaultCat:item.cat||'',defaultAcctCode:item.acctCode||'',is1099:!!item.is1099,tin:item.tin1099||'',email:'',phone:'',address:'',notes:''});
}

function deleteFromModal(type){
  var c=gc();if(!c)return;
  var arr=type==='expenses'?c.expenses:type==='income'?c.income:type==='revenue'?c.revenue:null;
  if(!arr||EI<0||EI>=arr.length)return;
  var item=arr[EI];
  // Period lock check
  var itemDate=item.date||'';
  if(itemDate&&typeof isDateLocked==='function'&&isDateLocked(c,itemDate)){
    if(typeof periodLockAlert==='function')periodLockAlert(c.closedThrough);
    return;
  }
  var idx=EI;
  closeM(type==='expenses'?'m-exp':type==='income'?'m-inc':'m-rev');
  // Route through delItem: soft delete, ledger reversal, 30-day restore window
  if(typeof delItem==='function')delItem(type,idx);
}
function exp990LineChange(sel){
  if(sel.value==='custom'){
    var cv=prompt('Enter custom 990 line description:');
    if(cv&&cv.trim()){sel.value=cv.trim();}else{sel.value='';}
  }
}
function saveExp(){
  var c=gc();if(!c.expenses)c.expenses=[];
  // PERIOD LOCK GUARD
  var _expLockDate=g('e-dt')&&g('e-dt').value.trim();
  if(_expLockDate&&isDateLocked(c,_expLockDate)){periodLockAlert(c.closedThrough);return;}
  // FIX-14: Guard EI — if it's out of bounds (stale), treat as new
  var _rXEI=resolveEI(c.expenses);
  if(_rXEI>=0&&!c.expenses[_rXEI])_rXEI=-1;
  // Guard: warn before overwriting a reconciled expense
  if(_rXEI>=0&&c.expenses[_rXEI]&&c.expenses[_rXEI].reconciled){if(!confirm('⚠ This expense has been reconciled.\n\nSaving changes may affect a closed period. Continue?'))return;}
  // Duplicate detection — only on new entries
  if(EI<0){var _xAmt=Number(g('e-a')&&g('e-a').value||0);var _xDate=g('e-dt')&&g('e-dt').value||'';var _xDesc=g('e-d')&&g('e-d').value.trim()||'';if(_xAmt&&_xDate){var _dupExp=(c.expenses||[]).find(function(r){var d=parseDate(r.date||'');var nd=parseDate(_xDate);return!r.deleted&&Math.abs(Number(r.amt||0)-_xAmt)<0.01&&d&&nd&&Math.abs(d-nd)<7*86400000&&(r.desc||'').toLowerCase()===_xDesc.toLowerCase();});if(_dupExp&&!confirm('⚠ Possible duplicate: an expense for '+fmt(_xAmt)+' "'+(_dupExp.desc||'unknown')+'" exists within 7 days of this date.\n\nSave anyway?'))return;}}
  var d=sanitizeInput(g('e-d').value.trim()||g('e-c').value.trim()||'Expense');var item;
  var is1099=g('e-1099')&&g('e-1099').value==='yes';var vendor1099=sanitizeInput(g('e-vendor')&&g('e-vendor').value.trim()||'');var tin1099=g('e-tin')&&g('e-tin').value.trim().replace(/[^0-9\-]/g,'')||'';
  var pid=g('e-proj')&&g('e-proj').value||'';
  var bankVal=g('e-bank')&&g('e-bank').value||'';
  // Only require paid from account if the dropdown has real options (banks or cash assets exist)
  var _ebankSel=g('e-bank');var _eHasAccounts=_ebankSel&&_ebankSel.options.length>1&&!(_ebankSel.options[1]&&_ebankSel.options[1].disabled);
  if(!bankVal&&_eHasAccounts){alert('Please select a "Paid from account" before saving.');if(_ebankSel)_ebankSel.focus();return;}
  // Validate date if provided (NP and PE branches use e-dt; SB uses freq only so skip if blank)
  var _expDateEl=g('e-dt');var _expDateVal=_expDateEl&&_expDateEl.value.trim();
  if(_expDateVal){var _expDateErr=validateDate(_expDateVal);if(_expDateErr){alert(_expDateErr);if(_expDateEl)_expDateEl.focus();return;}}
  var bankId=bankVal.indexOf('bank:')=== 0?bankVal.slice(5):'';
  var ccId=bankVal.indexOf('cc:')=== 0?bankVal.slice(3):'';
  var bsAssetId=bankVal.indexOf('bsasset:')=== 0?bankVal.slice(8):'';
function resolveAcct(cat,explicit){return explicit||lookupAcctByCAT(c,cat)||'';}
  // Helper: get the old expense's bsAssetId before overwriting
  var _oldExp=_rXEI>=0?c.expenses[_rXEI]:null;
  // ── FIX-C: Restricted fund check helper ─────────────────────────────────
  // Returns true if save should proceed, false if user cancelled.
  function checkBudgetOverspend(cat,newAmt,oldAmt){
    if(!cat)return true;
    var budLine=(c.budgetItems||[]).find(function(b){return b.cat===cat&&b.type==='Expense';});
    if(!budLine||budLine.amt===null||budLine.amt===undefined)return true;
    var budgeted=Number(budLine.amt||0);
    var spent=(c.expenses||[]).filter(function(e,idx){return e.cat===cat&&!e.voided&&!e.deleted&&(EI<0||idx!==EI);}).reduce(function(s,e){return s+Number(e.amt||0);},0);
    var afterThis=spent+newAmt-oldAmt;
    if(afterThis>budgeted){
      var policy=budLine.overspendPolicy||'warn';
      var detail='Category: '+cat+'\nBudgeted: '+fmt(budgeted)+'\nAlready spent: '+fmt(spent)+'\nThis expense: '+fmt(newAmt)+'\nTotal after: '+fmt(afterThis)+'\nOver budget by: '+fmt(afterThis-budgeted);
      if(policy==='strict'){
        alert('🔒 Blocked — Budget Exceeded\n\n'+detail+'\n\nThis line item is set to Strict. Adjust the amount or update the budget line policy.');
        return false;
      }else{
        return confirm('⚠ Budget Warning\n\n'+detail+'\n\nThis expense exceeds the budgeted amount. Proceed anyway?');
      }
    }
    return true;
  }

  function checkRestrictedFund(fundName,newAmt,oldAmt){
    if(!fundName)return true;
    var fund=(c.funds||[]).find(function(f){return f.name===fundName;});
    if(!fund||fund.type==='Unrestricted')return true;
    // Compute current fund balance: income received minus expenses (excluding this transaction if editing)
    var fundInc=(c.income||[]).filter(function(r){return r.fund===fundName;}).reduce(function(s,r){return s+Number(r.recv||0);},0);
    var fundExp=(c.expenses||[]).filter(function(e,idx){return e.fund===fundName&&(EI<0||idx!==EI);}).reduce(function(s,e){return s+Number(e.amt||0);},0);
    var available=fundInc-fundExp;
    var afterThis=available-newAmt;
    if(afterThis<0){
      var msg='⚠ Restricted Fund Warning\n\n'
        +'Fund: '+fundName+' ('+fund.type+')\n'
        +'Total received: '+fmt(fundInc)+'\n'
        +'Already spent: '+fmt(fundExp)+'\n'
        +'This expense: '+fmt(newAmt)+'\n'
        +'Balance after: '+fmt(afterThis)+'\n\n'
        +'Spending exceeds funds received for this restricted fund. '
        +'This may be a compliance violation.\n\nProceed anyway?';
      return confirm(msg);
    }
    return true;
  }
  var _xAmtErr=validateAmt(g('e-a').value,{label:'Amount'});if(_xAmtErr){alert(_xAmtErr);if(g('e-a'))g('e-a').focus();return;}
  var _xRecurEnd=g('f-rec-end')&&g('f-rec-end').value.trim()||'';
  var _xRecurCnt=g('f-rec-count')&&Number(g('f-rec-count').value)||0;
  if(c.type==='np'){var cat=g('e-c').value;var _990v=g('e-990line')&&g('e-990line').value||'';item={desc:d,cat:cat,line990:_990v,amt:Number(g('e-a').value||0),date:g('e-dt').value,fund:g('e-f').value,grantId:g('e-gid').value||'',grantPct:g('e-gpct')&&g('e-gpct').value!==''?Number(g('e-gpct').value):null,acctCode:resolveAcct(cat,g('e-acct')&&g('e-acct').value),reconciled:_rXEI>=0?c.expenses[_rXEI].reconciled:false,recurring:g('f-rec').value,is1099:is1099,vendor1099:vendor1099,tin1099:tin1099,functional:g('e-func')&&g('e-func').value||'',receiptUrl:safeUrl(g('e-url')&&g('e-url').value)};var ref=g('e-ref')&&g('e-ref').value.trim()||'';if(ref)item.checkNum=ref;if(pid)item.projectId=pid;if(bankId)item.bankId=bankId;if(ccId)item.ccId=ccId;if(bsAssetId){item.bsAssetId=bsAssetId;item.acctCode=ensureBSAssetCOA(c,bsAssetId)||item.acctCode;}
    item.audit=EI>=0?auditTxn(_oldExp,item,'expenses'):(_oldExp&&_oldExp.audit||_auditCreated());
    if(!checkRestrictedFund(item.fund,item.amt,_oldExp?Number(_oldExp.amt||0):0))return;
    if(!checkBudgetOverspend(item.cat,Number(item.amt||0),_oldExp?Number(_oldExp.amt||0):0))return;
    var _prevAmt=_oldExp?Number(_oldExp.amt||0):0;var _newAmt=Number(item.amt||0);
    if(bsAssetId){applyBSAssetDelta(c,bsAssetId,_prevAmt-_newAmt);}
    else if(_oldExp&&_oldExp.bsAssetId){applyBSAssetDelta(c,_oldExp.bsAssetId,_prevAmt);}// account changed — reverse old
    if(c.accounts&&c.accounts.length){var _coaMatch=(c.accounts||[]).find(function(a){return a.cat===cat||a.name===cat||a.code===item.acctCode;});if(!_coaMatch){if(!confirm('⚠ COA Warning: "'+cat+'" is not in your chart of accounts.\n\nSave anyway? (You can add this category to your COA later.)'))return;}}
    if(_rXEI>=0)updateLedgerEntry(c,item.id||c.expenses[_rXEI].id,item.acctCode||'5010',_defaultCashCode(c),Number(item.amt||0),item.desc||'Expense','expense');else postToLedger(c,item.acctCode||'5010',_defaultCashCode(c),Number(item.amt||0),item.desc||'Expense','expense',item.id);markDirty('npexp','grants','budget','reports','bs');if(_rXEI>=0)c.expenses[_rXEI]=item;else c.expenses.push(item);syncVendorFromExpense(c,item);sv();var _pnpexp=g('p-npexp');if(_pnpexp&&_pnpexp.classList.contains('active'))renderNpExp(c);var _pgrants=g('p-grants');if(_pgrants&&_pgrants.classList.contains('active'))renderGrants(c);renderBudgetMultiYear();renderReports();renderBalanceSheet(c);var _rp=g('p-recon');if(_rp&&_rp.classList.contains('active'))renderReconciliation(c);closeM('m-exp');['e-d','e-c','e-a','e-dt','e-f','e-ref','e-url','e-func'].forEach(function(id){var el=g(id);if(el)el.value='';});var _egid=g('e-gid');if(_egid)_egid.value='';var _egpct=g('e-gpct');if(_egpct)_egpct.value='';var _990c=g('e-990line');if(_990c)_990c.value='';}
  else if(c.type==='sb'){var cat=g('e-c').value;var _subcv=g('e-subcat')&&g('e-subcat').value.trim()||'';item={desc:d,cat:cat,subcat:_subcv,amt:Number(g('e-a').value||0),freq:g('e-fr').value,fixed:g('e-fx').value,acctCode:resolveAcct(cat,g('e-acct')&&g('e-acct').value),reconciled:_rXEI>=0?c.expenses[_rXEI].reconciled:false,recurring:g('f-rec').value,is1099:is1099,vendor1099:vendor1099,tin1099:tin1099,receiptUrl:safeUrl(g('e-url')&&g('e-url').value)};var ref=g('e-ref')&&g('e-ref').value.trim()||'';if(ref)item.checkNum=ref;if(pid)item.projectId=pid;if(bankId)item.bankId=bankId;if(ccId)item.ccId=ccId;if(bsAssetId){item.bsAssetId=bsAssetId;item.acctCode=ensureBSAssetCOA(c,bsAssetId)||item.acctCode;}
    item.audit=EI>=0?auditTxn(_oldExp,item,'expenses'):_auditCreated();
    var _prevAmt2=_oldExp?Number(_oldExp.amt||0):0;var _newAmt2=Number(item.amt||0);
    if(bsAssetId){applyBSAssetDelta(c,bsAssetId,_prevAmt2-_newAmt2);}
    else if(_oldExp&&_oldExp.bsAssetId){applyBSAssetDelta(c,_oldExp.bsAssetId,_prevAmt2);}
    if(c.accounts&&c.accounts.length){var _coaMatch=(c.accounts||[]).find(function(a){return a.cat===cat||a.name===cat||a.code===item.acctCode;});if(!_coaMatch){if(!confirm('⚠ COA Warning: "'+cat+'" is not in your chart of accounts.\n\nSave anyway? (You can add this category to your COA later.)'))return;}}
    if(!checkBudgetOverspend(item.cat,Number(item.amt||0),_oldExp?Number(_oldExp.amt||0):0))return;
    if(_rXEI>=0)updateLedgerEntry(c,item.id||c.expenses[_rXEI].id,item.acctCode||'5010',_defaultCashCode(c),Number(item.amt||0),item.desc||'Expense','expense');else postToLedger(c,item.acctCode||'5010',_defaultCashCode(c),Number(item.amt||0),item.desc||'Expense','expense',item.id);markDirty('sbexp','budget','reports','bs');if(_rXEI>=0)c.expenses[_rXEI]=item;else c.expenses.push(item);syncVendorFromExpense(c,item);sv();var _psbexp=g('p-sbexp');if(_psbexp&&_psbexp.classList.contains('active'))renderSbExp(c);renderBudgetMultiYear();renderReports();renderBalanceSheet(c);var _rp=g('p-recon');if(_rp&&_rp.classList.contains('active'))renderReconciliation(c);closeM('m-exp');['e-d','e-c','e-a','e-ref','e-url'].forEach(function(id){var el=g(id);if(el)el.value='';}); }
  else{var cat=g('e-c').value;item={desc:d,cat:cat,amt:Number(g('e-a').value||0),freq:g('e-fr').value,date:g('e-dt').value,acctCode:resolveAcct(cat,g('e-acct')&&g('e-acct').value),reconciled:_rXEI>=0?c.expenses[_rXEI].reconciled:false,recurring:g('f-rec').value,is1099:is1099,vendor1099:vendor1099,tin1099:tin1099,receiptUrl:safeUrl(g('e-url')&&g('e-url').value)};var ref=g('e-ref')&&g('e-ref').value.trim()||'';if(ref)item.checkNum=ref;if(pid)item.projectId=pid;if(bankId)item.bankId=bankId;if(ccId)item.ccId=ccId;if(bsAssetId){item.bsAssetId=bsAssetId;item.acctCode=ensureBSAssetCOA(c,bsAssetId)||item.acctCode;}
    item.audit=EI>=0?auditTxn(_oldExp,item,'expenses'):_auditCreated();
    var _prevAmt3=_oldExp?Number(_oldExp.amt||0):0;var _newAmt3=Number(item.amt||0);
    if(bsAssetId){applyBSAssetDelta(c,bsAssetId,_prevAmt3-_newAmt3);}
    else if(_oldExp&&_oldExp.bsAssetId){applyBSAssetDelta(c,_oldExp.bsAssetId,_prevAmt3);}
    if(c.accounts&&c.accounts.length){var _coaMatch=(c.accounts||[]).find(function(a){return a.cat===cat||a.name===cat||a.code===item.acctCode;});if(!_coaMatch){if(!confirm('⚠ COA Warning: "'+cat+'" is not in your chart of accounts.\n\nSave anyway? (You can add this category to your COA later.)'))return;}}
    if(_rXEI>=0)updateLedgerEntry(c,item.id||c.expenses[_rXEI].id,item.acctCode||'5010',_defaultCashCode(c),Number(item.amt||0),item.desc||'Expense','expense');else postToLedger(c,item.acctCode||'5010',_defaultCashCode(c),Number(item.amt||0),item.desc||'Expense','expense',item.id);markDirty('peexp','budget','reports','bs');if(_rXEI>=0)c.expenses[_rXEI]=item;else c.expenses.push(item);syncVendorFromExpense(c,item);sv();var _ppeexp=g('p-peexp');if(_ppeexp&&_ppeexp.classList.contains('active'))renderPeExp(c);renderBudgetMultiYear();renderReports();renderBalanceSheet(c);var _rp=g('p-recon');if(_rp&&_rp.classList.contains('active'))renderReconciliation(c);closeM('m-exp');['e-d','e-c','e-a','e-dt','e-ref','e-url'].forEach(function(id){var el=g(id);if(el)el.value='';}); }
}

function saveBudgetAndNew(){
  var grp=g('b-g').value;var type=g('b-t').value;
  // Call the right save function depending on which view is active
  if(BUDGET_VIEW==='proposed')saveProposedBudget();else saveBudget();
  var fnd2=g('b-fund')&&g('b-fund').value||'';
  setTimeout(function(){
    openM('m-budget');
    var bg=g('b-g');if(bg)bg.setAttribute('data-pending-val',grp);
    g('b-t').value=type;g('b-a').value='';
    if(g('b-fund'))g('b-fund').value=fnd2;
    var bc=g('b-c');if(bc)bc.setAttribute('data-pending-val','');
    populateBudgetCatDropdown('b-c','');
    populateBudgetGroupDropdown('b-g',grp);
    if(g('b-a'))g('b-a').focus();
  },100);
}
function saveIncAndNew(){var cat=g('i-c').value;var st=g('i-s').value;saveInc();setTimeout(function(){openM('m-inc');g('i-c').value=cat;g('i-s').value=st;if(g('i-n'))g('i-n').focus();},100);}
function saveRevAndNew(){var cat=g('r-c').value;var cf=g('r-cf').value;saveRev();setTimeout(function(){openM('m-rev');g('r-c').value=cat;g('r-cf').value=cf;if(g('r-n'))g('r-n').focus();},100);}
function savePeIncAndNew(){var cat=g('pi-c').value;var fr=g('pi-f').value;savePeInc();setTimeout(function(){openM('m-peinc');g('pi-c').value=cat;g('pi-f').value=fr;if(g('pi-n'))g('pi-n').focus();},100);}
function saveExpAndNew(){
  var c=gc();var cat=g('e-c').value;var gid=g('e-gid')&&g('e-gid').value;
  var fr=g('e-fr')&&g('e-fr').value;var fx=g('e-fx')&&g('e-fx').value;
  saveExp();
  setTimeout(function(){openM('m-exp');g('e-c').value=cat;if(g('e-gid'))g('e-gid').value=gid||'';if(g('e-fr'))g('e-fr').value=fr||'Monthly';if(g('e-fx'))g('e-fx').value=fx||'Fixed';if(g('e-d'))g('e-d').focus();},100);
}
function saveInvAndNew(){var client=g('inv-client').value;saveInv();setTimeout(function(){openM('m-inv');g('inv-client').value=client;if(g('inv-desc'))g('inv-desc').focus();},100);}
function saveDonorAndNew(){saveDonor();setTimeout(function(){DONOR_EI=-1;resetDonorForm();openM('m-donor');if(g('don-n'))g('don-n').focus();},100);}

// ══════════════════════════════════════════
// UNIFIED DONOR ACTIVITY LOG
// ══════════════════════════════════════════
var _ACT_CACHE={}; // {donorIdx: [mergedActsArray]}
var _ACT_ICON={
  'Phone call':'📞','Meeting':'🤝','Email':'✉','Site visit':'🏢','Event':'🎟','Letter sent':'📬',
  'Proposal sent':'📄','Ask made':'💬','Pledge received':'📋','Donation received':'💚',
  'Thank you sent':'💌','Impact report sent':'📊','Lapsed — re-engaged':'🔄','Note':'📝'
};
var _ACT_FINANCIAL=['Donation received','Pledge received'];
var _ACT_FOLLOWUP_TYPES=['Phone call','Meeting','Email','Site visit','Event','Letter sent','Proposal sent','Ask made','Note'];
var _ACT_MILESTONE_TYPES=['Donation received','Pledge received','Thank you sent','Impact report sent','Lapsed — re-engaged','Ask made','Proposal sent'];

function _renderActivityLog(d,di){
  // Merge old interactions + old milestones + new activities into one unified list
  var acts=[];
  (d.activities||[]).forEach(function(a){acts.push(a);});
  // Legacy interactions → activity format
  (d.interactions||[]).forEach(function(ix){
    if(!acts.find(function(a){return a.id===ix.id;}))
      acts.push({id:ix.id,type:ix.type||'Note',date:ix.date,who:ix.who,note:ix.note,followupDate:ix.followupDate,followupNote:ix.followupNote,completed:ix.completed,completedDate:ix.completedDate,legacy:'interaction'});
  });
  // Legacy milestones → activity format
  (d.milestones||[]).forEach(function(m){
    if(!acts.find(function(a){return a.id===m.id;}))
      acts.push({id:m.id,type:m.type,date:m.date,note:m.notes,amt:m.amt,linkedIncome:m.linkedIncome,linkedPledge:m.linkedPledge,legacy:'milestone'});
  });
  acts.sort(function(a,b){return new Date(a.date)-new Date(b.date);});
  _ACT_CACHE[di]=acts;// store for button handlers
  var now2=new Date();
  if(!acts.length)return'<div style="font-size:11px;color:var(--muted);margin-top:.5rem;padding:.5rem 0;border-top:1px solid var(--soft)">No activity logged yet. <span style="cursor:pointer;text-decoration:underline" onclick="openActivityModal('+di+')">+ Log first activity</span></div>';
  return'<div style="margin-top:.75rem;border-top:1px solid var(--soft);padding-top:.625rem">'
    +'<div style="font-size:10px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem">Activity</div>'
    +'<div style="position:relative;padding-left:20px">'
    +'<div style="position:absolute;left:7px;top:4px;bottom:4px;width:1px;background:var(--border)"></div>'
    +acts.map(function(a,ai){
      var icon=_ACT_ICON[a.type]||'📌';
      var overdue=a.followupDate&&!a.completed&&new Date(a.followupDate)<now2;
      return'<div style="position:relative;margin-bottom:.5rem">'
        +'<div style="position:absolute;left:-20px;top:5px;width:14px;height:14px;border-radius:50%;background:var(--surface);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:8px;z-index:1">'+icon+'</div>'
        +'<div style="padding:.5rem .625rem;background:var(--bg);border-radius:8px;font-size:12px;line-height:1.5">'
        // Top row: type + date + who + badges + action buttons
        +'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">'
        +'<div style="display:flex;align-items:baseline;gap:6px;flex-wrap:wrap">'
        +'<span style="font-weight:500;color:var(--text)">'+escHtml(a.type)+'</span>'
        +'<span style="font-size:10px;color:var(--muted)">'+fmtDate(a.date)+'</span>'
        +(a.who?'<span style="font-size:10px;color:var(--muted)">by '+escHtml(a.who)+'</span>':'')
        +(a.amt?'<span class="badge b-green" style="font-size:9px">'+fmt(a.amt)+'</span>':'')
        +(a.linkedIncome?'<span class="badge b-green" style="font-size:9px">→ income</span>':'')
        +(a.linkedPledge?'<span class="badge b-blue" style="font-size:9px">→ projected</span>':'')
        +(a.audit&&a.audit.length>1?'<span class="badge" style="font-size:9px;background:var(--soft);color:var(--muted);cursor:pointer" title="'+escHtml(a.audit.filter(function(x){return x.action==='edited';}).map(function(x){return(x.timestamp?x.timestamp.replace('T',' ').slice(0,16):'')+': '+x.changes;}).join('\n'))+'">edited</span>':'')
        +'</div>'
        // Action buttons — right side, reasonably sized
        +'<div style="display:flex;gap:4px;flex-shrink:0">'
        +(a.followupDate&&!a.completed?'<button class="add-btn" style="font-size:11px;padding:3px 8px" onclick="completeActivity('+di+','+ai+')">✓</button>':'')
        +'<button class="e-btn" style="font-size:13px;padding:3px 8px" onclick="editActivity('+di+','+ai+')">&#9998;</button>'
        +'<button class="d-btn" style="font-size:13px;padding:3px 8px" onclick="deleteActivity('+di+','+ai+')">&#215;</button>'
        +'</div>'
        +'</div>'
        // Notes row
        +(a.note?'<div style="color:var(--muted);margin-top:3px">'+escHtml(a.note)+'</div>':'')
        // Follow-up row
        +(a.followupDate?'<div style="margin-top:3px;font-size:11px;color:'+(a.completed?'var(--green)':overdue?'var(--red)':'var(--amber)')+';">'
          +(a.completed?'✓ Completed '+fmtDate(a.completedDate||''):'📅 Follow up: '+fmtDate(a.followupDate)+(a.followupNote?' — '+escHtml(a.followupNote):'')+(overdue?' — OVERDUE':''))
          +'</div>':'')
        +'</div>'
        +'</div>';
    }).join('')
    +'</div></div>';
}

function openActivityModal(di){
  var today=new Date();
  var mm=String(today.getMonth()+1).padStart(2,'0');
  var dd=String(today.getDate()).padStart(2,'0');
  var yyyy=today.getFullYear();
  var mo=g('m-activity');if(mo)mo.remove();
  mo=document.createElement('div');mo.className='overlay';mo.id='m-activity';
  mo.innerHTML='<div class="modal" style="max-width:480px">'
    +'<button class="cx" onclick="closeM(\'m-activity\')">&#215;</button>'
    +'<div class="m-title">Log activity</div>'
    +'<input type="hidden" id="act-donor-idx" value="'+di+'">'
    +'<div class="fr"><div class="fl" style="margin-bottom:0"><label>Activity type</label>'
    +'<div class="sw" style="width:100%"><select id="act-type" onchange="onActTypeChange()">'
    +['Phone call','Meeting','Email','Site visit','Event','Letter sent','Proposal sent','Ask made','Donation received','Pledge received','Thank you sent','Impact report sent','Lapsed — re-engaged','Note'].map(function(t){return'<option>'+t+'</option>';}).join('')
    +'</select></div></div>'
    +'<div class="fl" style="margin-bottom:0"><label>Date</label>'
    +'<input type="text" id="act-date" value="'+mm+'/'+dd+'/'+yyyy+'" placeholder="MM/DD/YYYY" onblur="autoDate(this)" oninput="autoDate(this)"></div></div>'
    +'<div class="fl"><label>Who (optional)</label>'
    +'<input type="text" id="act-who" placeholder="Staff or board member name"></div>'
    +'<div class="fl"><label>Notes</label>'
    +'<textarea id="act-note" placeholder="What happened, key points, next steps..." style="min-height:80px"></textarea></div>'
    // Financial fields — shown for Donation received / Pledge received
    +'<div id="act-donation-row" style="display:none">'
    +'<div class="fr"><div class="fl" style="margin-bottom:0"><label>Amount ($)</label>'
    +'<input type="number" id="act-amt" placeholder="0.00" oninput="fmtAmt(this)"></div>'
    +'<div class="fl" style="margin-bottom:0"><label>Fund / Campaign</label>'
    +'<input type="text" id="act-fund" placeholder="e.g. Annual Fund"></div></div>'
    +'<div style="font-size:11px;color:var(--np);padding:.5rem .75rem;background:var(--np-bg);border-radius:7px;margin-top:.25rem" id="act-income-note">✓ Will auto-post to Income</div>'
    +'</div>'
    // Follow-up fields — shown for interaction types
    +'<div id="act-followup-row">'
    +'<div class="fr"><div class="fl" style="margin-bottom:0"><label>Follow-up date (optional)</label>'
    +'<input type="text" id="act-followup" placeholder="MM/DD/YYYY" onblur="autoDate(this)" oninput="autoDate(this)"></div>'
    +'<div class="fl" style="margin-bottom:0"><label>Follow-up action</label>'
    +'<input type="text" id="act-followup-note" placeholder="e.g. Send impact report"></div></div>'
    +'</div>'
    +'<button class="sv-btn" onclick="saveActivity()">Save activity</button>'
    +'</div></div>';
  document.body.appendChild(mo);
  setTimeout(function(){mo.classList.add('open');onActTypeChange();},10);
}

function onActTypeChange(){
  var t=g('act-type')&&g('act-type').value||'';
  var dr=g('act-donation-row');var fr=g('act-followup-row');
  var inote=g('act-income-note');
  if(dr)dr.style.display=(t==='Donation received'||t==='Pledge received')?'block':'none';
  if(inote&&t==='Pledge received')inote.textContent='✓ Will create a projected income entry';
  if(inote&&t==='Donation received')inote.textContent='✓ Will auto-post to Income';
  if(fr)fr.style.display=(t==='Donation received'||t==='Pledge received'||t==='Thank you sent'||t==='Impact report sent')?'none':'block';
}

function saveActivity(){
  var c=gc();if(!c)return;
  var diEl=g('act-donor-idx');if(!diEl)return;
  var di=parseInt(diEl.value);
  if(isNaN(di)||!c.donors||!c.donors[di])return;
  var d=c.donors[di];
  var type=g('act-type')&&g('act-type').value||'Note';
  var date=g('act-date')&&g('act-date').value||new Date().toISOString().split('T')[0];
  var mo=g('m-activity');
  var editId=mo&&mo.dataset.editId||'';
  var act={
    id:editId||uid(),type:type,date:date,
    who:g('act-who')&&g('act-who').value.trim()||'',
    note:g('act-note')&&g('act-note').value.trim()||'',
    followupDate:g('act-followup')&&g('act-followup').value||'',
    followupNote:g('act-followup-note')&&g('act-followup-note').value.trim()||'',
    completed:false,
    created:new Date().toISOString()
  };
  // If editing, preserve completed state
  if(editId){
    var existing=(d.activities||[]).find(function(x){return x.id===editId;})
      ||(d.interactions||[]).find(function(x){return x.id===editId;});
    if(existing){act.completed=existing.completed||false;act.completedDate=existing.completedDate||'';}
  }
  // Financial auto-post (only on new entries, not edits)
  if(!editId){
    if(type==='Donation received'){
      var amt=Number(g('act-amt')&&g('act-amt').value||0);
      var fund=g('act-fund')&&g('act-fund').value.trim()||'';
      if(amt>0){
        act.amt=amt;act.fund=fund;
        if(!c.income)c.income=[];
        var incItem={id:uid(),name:d.name,cat:'Individual donation',status:'Received',proj:amt,recv:amt,date:date,fund:fund,acctCode:'4010',fromActivityId:act.id,donorId:d.id};
        c.income.push(incItem);
        act.linkedIncome=incItem.id;
        if(typeof postToLedger==='function')postToLedger(c,'1010','4010',amt,'Donation: '+d.name,'income',incItem.id);
        markDirty('funding','budget','reports','bs');
      }
    }
    if(type==='Pledge received'){
      var pAmt=Number(g('act-amt')&&g('act-amt').value||0);
      var pFund=g('act-fund')&&g('act-fund').value.trim()||'';
      if(pAmt>0){
        act.pledgeAmt=pAmt;
        if(!c.income)c.income=[];
        var pledgeItem={id:uid(),name:d.name+' (Pledge)',cat:'Individual donation',status:'Awarded',proj:pAmt,recv:0,date:date,fund:pFund,acctCode:'4010',fromActivityId:act.id,donorId:d.id};
        c.income.push(pledgeItem);
        act.linkedPledge=pledgeItem.id;
        markDirty('funding','budget','reports');
      }
    }
  }
  if(!d.activities)d.activities=[];
  if(editId){
    // Update in activities array — stamp audit trail
    var idx=(d.activities||[]).findIndex(function(x){return x.id===editId;});
    var prev=idx>=0?d.activities[idx]:null;
    if(!act.audit)act.audit=prev&&prev.audit?prev.audit.slice():[];
    // Log what changed
    var _ts=new Date().toISOString();
    var _changed=[];
    if(prev){
      ['type','date','who','note','followupDate','followupNote'].forEach(function(f){
        var ov=String(prev[f]||'');var nv=String(act[f]||'');
        if(ov!==nv)_changed.push(f+': "'+ov+'" → "'+nv+'"');
      });
    }
    act.audit.push({action:'edited',changes:_changed.join('; ')||'no changes',timestamp:_ts});
    if(idx>=0){d.activities[idx]=act;}
    else{
      d.activities.push(act);
      if(d.interactions)d.interactions=d.interactions.filter(function(x){return x.id!==editId;});
      if(d.milestones)d.milestones=d.milestones.filter(function(x){return x.id!==editId;});
    }
  } else {
    act.audit=[{action:'created',timestamp:new Date().toISOString()}];
    d.activities.push(act);
  }
  if(mo)delete mo.dataset.editId;
  sv();renderDonors(c);renderTodoBar();closeM('m-activity');
}

function editActivity(di,ai){
  var a=_ACT_CACHE[di]&&_ACT_CACHE[di][ai];if(!a)return;
  openActivityModal(di);
  setTimeout(function(){
    var typeEl=g('act-type');if(typeEl)typeEl.value=a.type||'Note';
    var dateEl=g('act-date');if(dateEl)dateEl.value=a.date||'';
    var whoEl=g('act-who');if(whoEl)whoEl.value=a.who||'';
    var noteEl=g('act-note');if(noteEl)noteEl.value=a.note||a.notes||'';
    var fuEl=g('act-followup');if(fuEl)fuEl.value=a.followupDate||'';
    var funEl=g('act-followup-note');if(funEl)funEl.value=a.followupNote||'';
    var amtEl=g('act-amt');if(amtEl)amtEl.value=a.amt||a.pledgeAmt||'';
    var fundEl=g('act-fund');if(fundEl)fundEl.value=a.fund||'';
    onActTypeChange();
    var mo=g('m-activity');
    if(mo){mo.dataset.editId=a.id;mo.dataset.editLegacy=a.legacy||'';}
    var title=mo&&mo.querySelector('.m-title');if(title)title.textContent='Edit activity';
    var btn=mo&&mo.querySelector('.sv-btn');if(btn)btn.textContent='Update activity';
  },60);
}

function completeActivity(di,ai){
  var c=gc();if(!c||!c.donors||!c.donors[di])return;
  var a=_ACT_CACHE[di]&&_ACT_CACHE[di][ai];if(!a)return;
  var d=c.donors[di];
  var target=(d.activities||[]).find(function(x){return x.id===a.id;})
    ||(d.interactions||[]).find(function(x){return x.id===a.id;});
  if(!target)return;
  target.completed=true;target.completedDate=new Date().toISOString().split('T')[0];
  sv();renderDonors(c);renderTodoBar();
}

function deleteActivity(di,ai){
  var c=gc();if(!c||!c.donors||!c.donors[di])return;
  if(!confirm('Delete this activity?'))return;
  var a=_ACT_CACHE[di]&&_ACT_CACHE[di][ai];if(!a)return;
  var d=c.donors[di];
  var actId=a.id;
  var act=(d.activities||[]).find(function(x){return x.id===actId;});
  if(act){
    if(act.linkedIncome&&c.income)c.income=c.income.filter(function(r){return r.id!==act.linkedIncome;});
    if(act.linkedPledge&&c.income)c.income=c.income.filter(function(r){return r.id!==act.linkedPledge;});
    d.activities=d.activities.filter(function(x){return x.id!==actId;});
  } else {
    if(d.interactions)d.interactions=d.interactions.filter(function(x){return x.id!==actId;});
    var ms=d.milestones&&d.milestones.find(function(m){return m.id===actId;});
    if(ms){
      if(ms.linkedIncome&&c.income)c.income=c.income.filter(function(r){return r.id!==ms.linkedIncome;});
      if(ms.linkedPledge&&c.income)c.income=c.income.filter(function(r){return r.id!==ms.linkedPledge;});
      d.milestones=d.milestones.filter(function(m){return m.id!==actId;});
    }
  }
  sv();renderDonors(c);
}

function _donForceLog(){
  var m=document.getElementById('don-dup-modal');if(m)m.remove();
  if(!window._donPendingRecord)return;
  var _p=window._donPendingRecord;
  _p.c.donors[_p.di].donations.push(_p.record);
  sv();renderDonors(_p.c);closeM('m-donation');
  window._donPendingRecord=null;
}

function saveDonationAndNew(){var di=g('dnt-donor-id').value;var fund=g('dnt-fund').value;var proj=g('dnt-proj')&&g('dnt-proj').value||'';var rst=g('dnt-rst').value;saveDonation();setTimeout(function(){g('dnt-donor-id').value=di;g('dnt-fund').value=fund;g('dnt-rst').value=rst;_populateDonationProjDropdown(gc(),proj);DONATION_EI=-1;g('m-donation-title').textContent='Log donation';openM('m-donation');if(g('dnt-amt'))g('dnt-amt').focus();},100);}
function saveBillAndNew(){var cat=g('bill-cat').value;saveBill();setTimeout(function(){BILL_EI=-1;resetBillForm();g('bill-cat').value=cat;openM('m-bill');if(g('bill-vendor'))g('bill-vendor').focus();},100);}
function renameGroup(oldName){
  var newName=prompt('Rename group "'+oldName+'" to:',oldName);
  if(!newName||newName.trim()===oldName)return;
  newName=newName.trim();
  var c=gc();
  var arr=BUDGET_VIEW==='proposed'?c.proposedBudget:c.budgetItems;
  (arr||[]).forEach(function(b){if(b.group===oldName)b.group=newName;});
  sv();renderBudgetMultiYear();
}
function syncBudgetToCOA(c,cat,type,grp){
  if(!c.accounts)c.accounts=[];
  var coaType=type==='Income'?'Income':'Expense';
  var exists=c.accounts.find(function(a){return a.cat===cat&&a.type===coaType;});
  if(!exists){
    // Pick next available code in 4xxx (income) or 5xxx (expense) range
    var prefix=coaType==='Income'?'4':'5';
    var used=c.accounts.filter(function(a){return a.code.indexOf(prefix)===0;}).map(function(a){return parseInt(a.code)||0;});
    var next=used.length?Math.max.apply(null,used)+10:parseInt(prefix+'010');
    c.accounts.push({id:uid(),code:String(next),name:cat,type:coaType,cat:cat,fromBudget:true});
    c.accounts.sort(function(a,b){return a.code.localeCompare(b.code);});
  }
}
var _BUDGET_EDIT_CAT='',_BUDGET_EDIT_TYPE='';
function editBudgetLine(i){
  var c=gc();if(!c||!c.budgetItems[i])return;
  var b=c.budgetItems[i];
  // Identity-based — never use index after sort (arch rule)
  _BUDGET_EDIT_CAT=b.cat||'';_BUDGET_EDIT_TYPE=b.type||'Expense';
  EI=1;
  var bc=g('b-c'),bg=g('b-g');
  // code::cat pending val so duplicate names across Income/Expense select the right account
  var _coaAcct=(c.accounts||[]).find(function(a){return(a.cat===b.cat||a.name===b.cat)&&a.type===(b.type==='Income'?'Income':'Expense');});
  var _pendingCat=_coaAcct?(_coaAcct.code+'::'+b.cat):b.cat;
  if(bc)bc.setAttribute('data-pending-val',_pendingCat);
  if(bg)bg.setAttribute('data-pending-val',b.group||'');
  g('b-t').value=b.type||'Expense';
  g('b-a').value=b.amt||'';
  if(g('b-fund'))g('b-fund').value=b.fund||'';
  if(g('b-overspend'))g('b-overspend').value=b.overspendPolicy||'warn';
  openM('m-budget');
}
function delBudgetLine(i){var c=gc();if(!c||!c.budgetItems[i])return;if(!confirm('Delete "'+c.budgetItems[i].cat+'"?'))return;c.budgetItems.splice(i,1);sv();renderBudgetMultiYear();}
function saveBudget(){
  if(BUDGET_VIEW==='proposed'){saveProposedBudget();return;}
  var c=gc();if(!c.budgetItems)c.budgetItems=[];
  var _bcRaw=g('b-c').value.trim();if(!_bcRaw)return;
  var _bcParts=_bcRaw.indexOf('::')>=0?_bcRaw.split('::'):['',_bcRaw];
  var cat=_bcParts.slice(1).join('::').trim();if(!cat)cat=_bcRaw;
  var _bcSel=g('b-c');var _selOpt=_bcSel&&_bcSel.options[_bcSel.selectedIndex];
  var type=(_selOpt&&_selOpt.getAttribute('data-acct-type'))||g('b-t').value||'Expense';
  var grp=g('b-g').value.trim()||type;
  var amt=Number(g('b-a').value||0);
  var _editItem=EI>=0?c.budgetItems.find(function(b){return b.cat===_BUDGET_EDIT_CAT&&b.type===_BUDGET_EDIT_TYPE;}):null;
  if(_editItem){
    // Edit in place by identity — immune to sort reordering
    _editItem.cat=cat;_editItem.type=type;_editItem.amt=amt;_editItem.group=grp;
    _editItem.fund=g('b-fund')&&g('b-fund').value||'';
    _editItem.overspendPolicy=g('b-overspend')&&g('b-overspend').value||'warn';
    _BUDGET_EDIT_CAT='';_BUDGET_EDIT_TYPE='';
  }else{
    var ex=c.budgetItems.find(function(b){return b.cat===cat&&b.type===type;});
    if(ex){ex.amt=amt;ex.group=grp;ex.fund=g('b-fund')&&g('b-fund').value||'';ex.overspendPolicy=g('b-overspend')&&g('b-overspend').value||'warn';}
    else{c.budgetItems.push({cat:cat,type:type,amt:amt,group:grp,fund:g('b-fund')&&g('b-fund').value||'',overspendPolicy:g('b-overspend')&&g('b-overspend').value||'warn'});syncBudgetToCOA(c,cat,type,grp);}
  }
  // Sort budgetItems by account code so they render in COA order
  c.budgetItems.sort(function(a,b){
    var acctA=(c.accounts||[]).find(function(x){return x.cat===a.cat||x.name===a.cat;});
    var acctB=(c.accounts||[]).find(function(x){return x.cat===b.cat||x.name===b.cat;});
    var codeA=acctA?acctA.code:'zzz';
    var codeB=acctB?acctB.code:'zzz';
    return codeA.localeCompare(codeB);
  });
  EI=-1;sv();renderBudgetMultiYear();closeM('m-budget');
  ['b-c','b-a','b-g'].forEach(function(id){g(id).value=''});if(g('b-fund'))g('b-fund').value='';
}
function saveJrn(){var c=gc();if(!c.journal)c.journal=[];var t=g('j-t').value.trim();if(!t)return;var _jt=sanitizeInput(t);if(EI>=0)c.journal[EI].text=_jt;else c.journal.push({text:_jt,date:today()});sv();renderHomeWidget();closeM('m-jrn');g('j-t').value='';}
function saveAct(){var c=gc();if(!c.actions)c.actions=[];var t=g('a-t').value.trim();if(!t)return;var item={text:sanitizeInput(t),due:g('a-d').value,who:sanitizeInput(g('a-w').value),pri:g('a-p').value,done:EI>=0?c.actions[EI].done:false};if(EI>=0)c.actions[EI]=item;else c.actions.push(item);sv();renderHomeWidget();closeM('m-act');['a-t','a-d','a-w'].forEach(function(id){g(id).value='';}); }

// ── CONSOLIDATED MULTI-CLIENT P&L ────────────────────────────
function renderConsolidatedPL(){
  var p=g('rpt-consolidated');if(!p)return;
  var clients=D.clients.filter(function(c){return!c.deleted;});
  if(clients.length<2){
    p.innerHTML='<div class="card"><div style="text-align:center;padding:2rem;color:var(--muted)">Add a second client to use the Consolidated P&L.</div></div>';
    return;
  }

  // Per-client totals using current RPT_BASIS/RPT_FY settings
  var rows=clients.map(function(c){
    var _basis=RPT_BASIS||(c.basisType||'cash');
    var fyRange=(function(){
      if(RPT_FY==='current')return getFiscalYear(c.fiscalYearEnd);
      var yr=parseInt(RPT_FY.replace('FY ',''));
      if(isNaN(yr))return getFiscalYear(c.fiscalYearEnd);
      var parts=(c.fiscalYearEnd||'12/31').split('/');
      return getFiscalYear(c.fiscalYearEnd,new Date(yr,parseInt(parts[0])-1,parseInt(parts[1])));
    })();
    function inFY(s){if(!s)return false;var d=parseDate(s);return d&&d>=fyRange.start&&d<=fyRange.end;}
    var iT=0,eT=0,iC={},eC={};
    if(c.type==='np'){
      (c.income||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal&&inFY(r.date);}).forEach(function(r){var a=_basis==='accrual'?Number(r.proj||0):Number(r.recv||0);iT+=a;iC[r.cat||'Other']=(iC[r.cat||'Other']||0)+a;});
      // Grant income comes through c.income[] entries above — gr.awarded is a commitment, not recognized revenue
      (c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal&&inFY(r.date);}).forEach(function(r){eT+=Number(r.amt||0);eC[r.cat||'Other']=(eC[r.cat||'Other']||0)+Number(r.amt||0);});
    }else if(c.type==='sb'){
      (c.revenue||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal&&inFY(r.date);}).forEach(function(r){var a=_basis==='accrual'?Number(r.proj||0):Number(r.act||0);iT+=a;iC[r.cat||'Other']=(iC[r.cat||'Other']||0)+a;});
      (c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal&&inFY(r.date);}).forEach(function(r){eT+=Number(r.amt||0);eC[r.cat||'Other']=(eC[r.cat||'Other']||0)+Number(r.amt||0);});
    }else{
      (c.income||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal&&inFY(r.date);}).forEach(function(r){var a=Number(r.amt||0);iT+=a;iC[r.cat||'Other']=(iC[r.cat||'Other']||0)+a;});
      (c.expenses||[]).filter(function(r){return!r.deleted&&!r.voided&&!r.isReversal&&inFY(r.date);}).forEach(function(r){eT+=Number(r.amt||0);eC[r.cat||'Other']=(eC[r.cat||'Other']||0)+Number(r.amt||0);});
    }
    return{c:c,iT:iT,eT:eT,iC:iC,eC:eC,net:iT-eT};
  });

  // Grand totals
  var grandI=rows.reduce(function(s,r){return s+r.iT;},0);
  var grandE=rows.reduce(function(s,r){return s+r.eT;},0);
  var grandN=grandI-grandE;

  // Collect all income/expense categories across all clients
  var allICats={},allECats={};
  rows.forEach(function(r){
    Object.keys(r.iC).forEach(function(k){allICats[k]=true;});
    Object.keys(r.eC).forEach(function(k){allECats[k]=true;});
  });
  var iCats=Object.keys(allICats).sort();
  var eCats=Object.keys(allECats).sort();

  // Build table header: Category | Client1 | Client2 | ... | Total
  var colHdr='<th style="text-align:left;padding:6px 8px">Category</th>'
    +rows.map(function(r){return'<th style="text-align:right;padding:6px 8px;max-width:90px;overflow:hidden;text-overflow:ellipsis" title="'+r.c.name+'">'+r.c.name+'</th>';}).join('')
    +'<th style="text-align:right;padding:6px 8px;font-weight:700">Total</th>';

  function catRow(cat,catMaps,isInc){
    var vals=rows.map(function(r){return r[catMaps][cat]||0;});
    var tot=vals.reduce(function(s,v){return s+v;},0);
    if(tot===0)return'';
    return'<tr><td style="padding:5px 8px;font-size:12px">'+cat+'</td>'
      +vals.map(function(v){return'<td style="text-align:right;padding:5px 8px;font-size:12px;color:'+(isInc?'var(--green)':'var(--red)')+'">'+fmt(v)+'</td>';}).join('')
      +'<td style="text-align:right;padding:5px 8px;font-size:12px;font-weight:600;color:'+(isInc?'var(--green)':'var(--red)')+'">'+fmt(tot)+'</td></tr>';
  }

  function subTotalRow(label,vals,tot,cls){
    return'<tr style="background:var(--bg);font-weight:600"><td style="padding:6px 8px;font-size:12px">'+label+'</td>'
      +vals.map(function(v){return'<td style="text-align:right;padding:6px 8px;font-size:12px" class="'+cls+'">'+fmt(v)+'</td>';}).join('')
      +'<td style="text-align:right;padding:6px 8px;font-size:12px;font-weight:700" class="'+cls+'">'+fmt(tot)+'</td></tr>';
  }

  var iRows=iCats.map(function(k){return catRow(k,'iC',true);}).join('');
  var eRows=eCats.map(function(k){return catRow(k,'eC',false);}).join('');
  var iSub=subTotalRow('Total Income',rows.map(function(r){return r.iT;}),grandI,'vg');
  var eSub=subTotalRow('Total Expenses',rows.map(function(r){return r.eT;}),grandE,'vr');
  var netRow='<tr style="border-top:2px solid var(--border);font-weight:700"><td style="padding:8px">Net</td>'
    +rows.map(function(r){return'<td style="text-align:right;padding:8px;color:'+(r.net>=0?'var(--green)':'var(--red)')+'">'+fmt(r.net)+'</td>';}).join('')
    +'<td style="text-align:right;padding:8px;font-weight:800;color:'+(grandN>=0?'var(--green)':'var(--red)')+'">'+fmt(grandN)+'</td></tr>';

  // Summary metric tiles
  var tiles='<div class="metrics">'
    +rows.map(function(r){return'<div class="metric"><div class="m-lbl">'+r.c.name+'</div><div class="m-val '+(r.net>=0?'vg':'vr')+'">'+fmt(r.net)+'</div></div>';}).join('')
    +'<div class="metric"><div class="m-lbl">Combined Net</div><div class="m-val '+(grandN>=0?'vg':'vr')+'">'+fmt(grandN)+'</div></div>'
    +'</div>';

  p.innerHTML='<div class="card">'
    +'<div class="c-head"><span class="c-title">Consolidated P&amp;L</span>'
    +'<button class="xbtn" onclick="doPDF(&quot;consolidated&quot;)" style="font-size:11px">⬇ Export PDF</button></div>'
    +tiles
    +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:400px">'
    +'<thead><tr style="background:var(--bg);border-bottom:2px solid var(--border)">'+colHdr+'</tr></thead>'
    +'<tbody>'
    +'<tr style="background:var(--bg2,var(--bg))"><td colspan="'+(rows.length+2)+'" style="padding:5px 8px;font-size:11px;text-transform:uppercase;font-weight:600;color:var(--muted)">Income</td></tr>'
    +iRows+iSub
    +'<tr style="background:var(--bg2,var(--bg))"><td colspan="'+(rows.length+2)+'" style="padding:5px 8px;font-size:11px;text-transform:uppercase;font-weight:600;color:var(--muted)">Expenses</td></tr>'
    +eRows+eSub
    +netRow
    +'</tbody></table></div>'
    +'</div>';
}

// ── RECURRING TRANSACTION BANNER ────────────────────────────
function renderRecurBanner(){
  // Find or create the banner element just below the nav
  var banner=g('recur-banner');
  if(!banner){
    banner=document.createElement('div');
    banner.id='recur-banner';
    banner.style.cssText='position:fixed;top:56px;left:0;right:0;z-index:900;display:none';
    document.body.appendChild(banner);
  }

  // Build upcoming list: recurring templates due in next 7 days across all clients
  var upcoming=[];
  var now=new Date();now.setHours(0,0,0,0);
  var in7=new Date(now);in7.setDate(in7.getDate()+7);
  D.clients.forEach(function(cl){
    function checkItems(items,amtKey){
      items.forEach(function(item){
        if(!item.recurring||item.recurring==='None'||item.deleted||item.voided)return;
        var last=item.recurKey||(item.date||'');
        var next=nextSched(item.recurring,last);
        if(!next)return;
        var nd=parseDate(next);
        if(nd&&nd>now&&nd<=in7){
          upcoming.push({clientName:cl.name,desc:item.desc||item.name||'Recurring entry',amt:Number(item[amtKey]||0),date:next,freq:item.recurring,type:amtKey==='amt'?'expense':'income'});
        }
      });
    }
    checkItems(cl.expenses||[],'amt');
    checkItems(cl.income||[],'recv');
    checkItems(cl.revenue||[],'act');
  });

  // Combine: posted today + upcoming next 7 days
  var posted=typeof _recurPosted!=='undefined'?_recurPosted:[];
  var total=posted.length+upcoming.length;

  if(total===0){banner.style.display='none';banner.innerHTML='';return;}

  // Check if dismissed this session
  var _dismissKey='recur-dismissed-'+todayKey();
  try{if(sessionStorage.getItem(_dismissKey)==='1'){banner.style.display='none';return;}}catch(e){}

  var postedHtml=posted.length?'<div style="margin-bottom:6px"><strong>Auto-posted today ('+posted.length+'):</strong> '
    +posted.map(function(p){return'<span style="background:rgba(0,0,0,.12);border-radius:4px;padding:1px 6px;font-size:11px;margin:1px">'
      +(p.type==='expense'?'▼':'▲')+' '+(p.clientName?p.clientName+' · ':'')+p.desc+' '+(p.amt?'$'+Number(p.amt).toLocaleString():'')+'</span>';}).join(' ')
    +'</div>':'';

  var upcomingHtml=upcoming.length?'<div><strong>Coming up ('+upcoming.length+'):</strong> '
    +upcoming.map(function(u){return'<span style="background:rgba(0,0,0,.12);border-radius:4px;padding:1px 6px;font-size:11px;margin:1px">'
      +(u.type==='expense'?'▼':'▲')+' '+(u.clientName?u.clientName+' · ':'')+u.desc+' · '+u.date+'</span>';}).join(' ')
    +'</div>':'';

  banner.style.display='block';
  banner.innerHTML='<div style="background:var(--np,#2d6a4f);color:#fff;padding:8px 16px;font-size:12px;display:flex;align-items:flex-start;gap:12px;line-height:1.5;box-shadow:0 2px 8px rgba(0,0,0,.15)">'
    +'<div style="flex:1">🔄 <strong>Recurring transactions</strong> — '
    +postedHtml+upcomingHtml
    +'</div>'
    +'<button onclick="try{sessionStorage.setItem(&quot;recur-dismissed-&quot;+todayKey(),&quot;1&quot;);}catch(e){}document.getElementById(&quot;recur-banner&quot;).style.display=&quot;none&quot;" '
    +'style="background:rgba(0,0,0,.2);border:none;color:#fff;padding:3px 10px;border-radius:4px;cursor:pointer;font-size:12px;flex-shrink:0;margin-top:1px">✕ Dismiss</button>'
    +'</div>';
}

// ══════════════════════════════════════════