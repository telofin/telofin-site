// ============================================================
// Clarity by Telofin™ — timetracking.js
// Session timer, idle vs working time, time log, billing.
//
// WIRE INTO app.html:
//   <script src="js/timetracking.js"></script>  — after welcome.js
//
//   Add timer bar div inside .dash-head, after .mob-tabs-wrap:
//   <div id="tt-bar"></div>
//
// DATA MODEL (on client):
//   c.timeLog  = [{id, date, clientId, start, end, workSecs,
//                  idleSecs, note, billed, manual}]
//   c.timeRate = number  — hourly billing rate
// ============================================================

var IDLE_THRESHOLD_SECS = 120;
var TT_AUTOSAVE_MINS    = 5;

var _TT_ACTIVE     = false;
var _TT_START      = null;
var _TT_IS_IDLE    = false;
var _TT_IDLE_START = null;
var _TT_WORK_SECS  = 0;
var _TT_IDLE_SECS  = 0;
var _TT_CLIENT_ID  = null;
var _TT_TICK       = null;
var _TT_IDLE_TIMER = null;
var _TT_AUTOSAVE   = null;
var _TT_LAST_INPUT = Date.now();

// ── IDLE DETECTION ────────────────────────────────────────────
(function(){
  function _resetIdle(){
    _TT_LAST_INPUT = Date.now();
    if (_TT_IS_IDLE && _TT_ACTIVE){
      if (_TT_IDLE_START){
        _TT_IDLE_SECS += Math.round((Date.now() - _TT_IDLE_START.getTime()) / 1000);
        _TT_IDLE_START = null;
      }
      _TT_IS_IDLE = false;
      _ttUpdateBar();
    }
    clearTimeout(_TT_IDLE_TIMER);
    if (_TT_ACTIVE){
      _TT_IDLE_TIMER = setTimeout(function(){
        if (_TT_ACTIVE && !_TT_IS_IDLE){
          _TT_IS_IDLE    = true;
          _TT_IDLE_START = new Date();
          _ttUpdateBar();
        }
      }, IDLE_THRESHOLD_SECS * 1000);
    }
  }
  ['mousemove','keydown','scroll','click','touchstart'].forEach(function(ev){
    document.addEventListener(ev, _resetIdle, { passive: true });
  });
  window.addEventListener('blur', function(){
    if (_TT_ACTIVE && !_TT_IS_IDLE){
      _TT_IS_IDLE    = true;
      _TT_IDLE_START = new Date();
      _ttUpdateBar();
    }
  });
  window.addEventListener('focus', _resetIdle);
})();

// ── TIMER CONTROLS ────────────────────────────────────────────
function ttStartSession(){
  var c = gc();
  if (!c){ alert('Open a client first.'); return; }
  // If a pending session is waiting on a decision, commit it silently before starting fresh
  if(window._ttPendingSession){ _ttCommitSession(''); }
  if (_TT_ACTIVE){
    if (_TT_CLIENT_ID !== CID) ttStopSession(true);
    else return;
  }
  _TT_ACTIVE     = true;
  _TT_START      = new Date();
  _TT_WORK_SECS  = 0;
  _TT_IDLE_SECS  = 0;
  _TT_IS_IDLE    = false;
  _TT_IDLE_START = null;
  _TT_CLIENT_ID  = CID;
  _TT_LAST_INPUT = Date.now();
  _TT_TICK       = setInterval(_ttTick, 1000);
  _TT_AUTOSAVE   = setInterval(function(){ if(_TT_ACTIVE) try{sv();}catch(e){}; }, TT_AUTOSAVE_MINS * 60 * 1000);
  clearTimeout(_TT_IDLE_TIMER);
  _TT_IDLE_TIMER = setTimeout(function(){
    if (_TT_ACTIVE && !_TT_IS_IDLE){ _TT_IS_IDLE = true; _TT_IDLE_START = new Date(); _ttUpdateBar(); }
  }, IDLE_THRESHOLD_SECS * 1000);
  _ttUpdateBar();
  _ttRefreshWidget();
}

function ttStopSession(silent){
  if (!_TT_ACTIVE) return;
  clearInterval(_TT_TICK);
  clearInterval(_TT_AUTOSAVE);
  clearTimeout(_TT_IDLE_TIMER);
  if (_TT_IS_IDLE && _TT_IDLE_START){
    _TT_IDLE_SECS += Math.round((new Date() - _TT_IDLE_START) / 1000);
    _TT_IDLE_START = null;
  }
  var totalSecs = Math.round((new Date() - _TT_START) / 1000);
  _TT_IDLE_SECS = Math.min(_TT_IDLE_SECS, totalSecs);
  _TT_WORK_SECS = totalSecs - _TT_IDLE_SECS;
  _TT_ACTIVE    = false;
  if (totalSecs < 5){ _ttReset(); _ttUpdateBar(); _ttRefreshWidget(); return; }
  var targetC = null;
  for (var i = 0; i < D.clients.length; i++){
    if (D.clients[i].id === _TT_CLIENT_ID){ targetC = D.clients[i]; break; }
  }
  if (!targetC){ _ttReset(); return; }
  var sessionStart = _TT_START.toISOString();
  var sessionEnd   = new Date().toISOString();
  var sessionWork  = _TT_WORK_SECS;
  var sessionIdle  = _TT_IDLE_SECS;
  _ttReset();
  _ttUpdateBar();
  if (!silent){
    // Show inline note prompt in widget — no browser dialog
    _ttShowNotePrompt(targetC, sessionStart, sessionEnd, sessionWork, sessionIdle);
  } else {
    _ttSaveEntry(targetC, {
      start: sessionStart, end: sessionEnd,
      workSecs: sessionWork, idleSecs: sessionIdle,
      note: '', billed: false
    });
    _ttRefreshWidget();
  }
}

function _ttReset(){
  _TT_ACTIVE=false;_TT_START=null;_TT_IDLE_START=null;
  _TT_WORK_SECS=0;_TT_IDLE_SECS=0;_TT_IS_IDLE=false;_TT_CLIENT_ID=null;
  clearInterval(_TT_TICK);clearInterval(_TT_AUTOSAVE);clearTimeout(_TT_IDLE_TIMER);
}

function _ttTick(){
  if (!_TT_ACTIVE) return;
  var totalElapsed = Math.round((Date.now() - _TT_START.getTime()) / 1000);
  var idleSoFar = _TT_IDLE_SECS + (_TT_IS_IDLE && _TT_IDLE_START ? Math.round((Date.now() - _TT_IDLE_START.getTime()) / 1000) : 0);
  _TT_WORK_SECS = Math.max(0, totalElapsed - idleSoFar);
  _ttUpdateSidebar();
  _ttRefreshWidget();
}

// Client switch — stop silently
(function(){
  if (typeof openClient!=='function'||openClient._ttPatched) return;
  var _orig=openClient;
  openClient=function(id){
    if(_TT_ACTIVE&&_TT_CLIENT_ID&&_TT_CLIENT_ID!==id){
      // Auto-stop and log with context note — no prompt needed on client switch
      var switchingTo=null;
      for(var _si=0;_si<D.clients.length;_si++){if(D.clients[_si].id===id){switchingTo=D.clients[_si];break;}}
      var autoNote=switchingTo?'Switched to '+switchingTo.name:'Switched client';
      // Save current session with auto-note before switching
      if(window._ttPendingSession){_ttCommitSession('');} // clear any pending
      // Run stop silently then patch the saved entry's note
      var prevClientId=_TT_CLIENT_ID;
      ttStopSession(true);
      // Find the entry just saved and add the note
      setTimeout(function(){
        var prevC=null;
        for(var _pi=0;_pi<D.clients.length;_pi++){if(D.clients[_pi].id===prevClientId){prevC=D.clients[_pi];break;}}
        if(prevC&&prevC.timeLog&&prevC.timeLog.length){
          var last=prevC.timeLog[prevC.timeLog.length-1];
          if(!last.note)last.note=autoNote;
          sv();
        }
      },100);
    }
    _orig(id);
    _ttUpdateSidebar();
  };
  openClient._ttPatched=true;
})();

window.addEventListener('beforeunload',function(){if(_TT_ACTIVE)ttStopSession(true);});
window.addEventListener('load',function(){setTimeout(_ttUpdateSidebar,300);});

// ── SAVE ENTRY ────────────────────────────────────────────────
function _ttSaveEntry(c,entry){
  if(!c.timeLog)c.timeLog=[];
  entry.id=uid();entry.date=new Date(entry.start).toLocaleDateString('en-US');entry.clientId=c.id;
  c.timeLog.push(entry);sv();
}

// ── MANUAL ENTRY ──────────────────────────────────────────────
function ttOpenManual(){
  _ttInjectManualModal();
  var d=document.getElementById('tt-man-date');if(d)d.value=todayNum();
  var h=document.getElementById('tt-man-hrs');if(h)h.value='';
  var m=document.getElementById('tt-man-mins');if(m)m.value='';
  var n=document.getElementById('tt-man-note');if(n)n.value='';
  if(typeof openM==='function')openM('m-tt-manual');
}

function ttSaveManual(){
  var c=gc();if(!c)return;
  var dateVal=(document.getElementById('tt-man-date')||{}).value||todayNum();
  var hrs=parseFloat((document.getElementById('tt-man-hrs')||{}).value||0)||0;
  var mins=parseFloat((document.getElementById('tt-man-mins')||{}).value||0)||0;
  var note=((document.getElementById('tt-man-note')||{}).value||'').trim();
  var totalSecs=Math.round((hrs*3600)+(mins*60));
  if(totalSecs<60){alert('Please enter at least 1 minute.');return;}
  var d=parseDate(dateVal)||new Date();
  _ttSaveEntry(c,{
    start:new Date(d.getFullYear(),d.getMonth(),d.getDate(),9,0,0).toISOString(),
    end:new Date(d.getFullYear(),d.getMonth(),d.getDate(),9,0,totalSecs).toISOString(),
    workSecs:totalSecs,idleSecs:0,note:note,billed:false,manual:true
  });
  if(typeof closeM==='function')closeM('m-tt-manual');
  _ttRefreshWidget();
  if(document.getElementById('tt-log-body'))renderTimePanelModal();
}

function ttMarkBilled(id){
  var c=gc();if(!c||!c.timeLog)return;
  var e=c.timeLog.find(function(x){return x.id===id;});if(!e)return;
  e.billed=!e.billed;sv();_ttRefreshWidget();
  if(document.getElementById('tt-log-body'))renderTimePanelModal();
}

function ttDeleteEntry(id){
  var c=gc();if(!c||!c.timeLog)return;
  if(!confirm('Delete this time entry?'))return;
  c.timeLog=c.timeLog.filter(function(x){return x.id!==id;});
  sv();_ttRefreshWidget();
  if(document.getElementById('tt-log-body'))renderTimePanelModal();
}

function ttSaveRate(){
  var c=gc();if(!c)return;
  var r=parseFloat((document.getElementById('tt-rate')||{}).value||0)||0;
  c.timeRate=r;sv();_ttRefreshWidget();
  if(document.getElementById('tt-log-body'))renderTimePanelModal();
}

// ── FORMATTING ────────────────────────────────────────────────
function _ttFmtDur(secs){
  var h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60),s=secs%60;
  if(h>0)return h+'h '+m+'m';if(m>0)return m+'m '+s+'s';return s+'s';
}
function _ttFmtHrs(secs){return(secs/3600).toFixed(2)+' hrs';}
function _ttBillable(rate,secs){return rate?'$'+(rate*secs/3600).toFixed(2):'—';}

// ── SIDEBAR TIMER ─────────────────────────────────────────────
function _ttUpdateBar(){ _ttUpdateSidebar(); }

function _ttUpdateSidebar(){
  var el=document.getElementById('tt-sidebar');if(!el)return;
  if(!_TT_ACTIVE){
    el.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between">'
      +'<span style="font-size:11px;color:var(--muted);font-weight:500"><i class="far fa-clock"></i> Time</span>'
      +'<button onclick="ttOpenFullLog(true)" style="font-size:10px;color:var(--muted);background:none;border:none;cursor:pointer;text-decoration:underline;padding:0">all logs</button>'
      +'</div>'
      +'<div style="display:flex;gap:.4rem;margin-top:.4rem">'
      +'<button onclick="ttStartSession()" style="flex:1;padding:5px 0;border:none;border-radius:6px;background:var(--green);color:#fff;font-size:11px;font-weight:500;cursor:pointer">▶ Start</button>'
      +'<button onclick="ttOpenManual()" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:none;font-size:11px;cursor:pointer;color:var(--muted)">+ Manual</button>'
      +'</div>';
    return;
  }
  var timedClient=null;
  for(var i=0;i<D.clients.length;i++){if(D.clients[i].id===_TT_CLIENT_ID){timedClient=D.clients[i];break;}}
  var clientName=timedClient?timedClient.name:'Unknown';
  var statusCol=_TT_IS_IDLE?'var(--amber)':'var(--green)';
  var dot=_TT_IS_IDLE?'<i class="fas fa-moon"></i>':'<i class="fas fa-circle"></i>';
  el.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.3rem">'
    +'<span style="font-size:11px;color:var(--muted);font-weight:500"><i class="far fa-clock"></i> Time</span>'
    +'<span style="font-size:10px;color:'+statusCol+'">'+dot+(_TT_IS_IDLE?' idle':' live')+'</span>'
    +'</div>'
    +'<div style="font-size:10px;color:var(--muted);margin-bottom:.15rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escHtml(clientName)+'</div>'
    +'<div style="font-size:20px;font-weight:700;color:'+statusCol+';line-height:1.1;margin-bottom:.4rem">'+_ttFmtDur(_TT_WORK_SECS)+'</div>'
    +'<div style="display:flex;gap:.4rem">'
    +'<button onclick="ttStopSession(false)" style="flex:1;padding:5px 0;border:none;border-radius:6px;background:var(--red);color:#fff;font-size:11px;font-weight:500;cursor:pointer">■ Stop</button>'
    +'<button onclick="ttOpenFullLog()" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:none;font-size:11px;cursor:pointer;color:var(--muted)">Log</button>'
    +'</div>';
}
// ── TIME PANEL ────────────────────────────────────────────────
function renderTimePanel(){
  var p=document.getElementById('p-time');if(!p)return;
  var c=gc();if(!c)return;
  var log=(c.timeLog||[]).slice().reverse();
  var rate=Number(c.timeRate||0);
  var now=new Date();
  var totalWork=log.reduce(function(s,e){return s+(e.workSecs||0);},0);
  var totalIdle=log.reduce(function(s,e){return s+(e.idleSecs||0);},0);
  var unbilledSecs=log.filter(function(e){return!e.billed;}).reduce(function(s,e){return s+(e.workSecs||0);},0);
  var billedSecs=log.filter(function(e){return e.billed;}).reduce(function(s,e){return s+(e.workSecs||0);},0);
  var mtdSecs=log.filter(function(e){var d=new Date(e.start);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}).reduce(function(s,e){return s+(e.workSecs||0);},0);

  function mcard(label,val,sub,color){
    return '<div class="card" style="padding:.75rem 1rem">'
      +'<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.25rem">'+label+'</div>'
      +'<div style="font-size:18px;font-weight:700;color:'+color+'">'+val+'</div>'
      +(sub&&sub!=='—'?'<div style="font-size:11px;color:var(--muted);margin-top:2px">'+sub+'</div>':'')
      +'</div>';
  }

  var rateRow='<div class="card" style="margin-bottom:.75rem"><div class="c-head"><span class="c-title">Billing rate</span></div>'
    +'<div style="padding:.75rem 1rem;display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">'
    +'<label style="font-size:12px;color:var(--muted)">Hourly rate</label><span style="font-size:13px">$</span>'
    +'<input id="tt-rate" type="number" min="0" step="5" value="'+(rate||'')+'" placeholder="0.00" style="width:90px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--soft);color:var(--text)">'
    +'<button onclick="ttSaveRate()" style="background:var(--green);color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:12px;cursor:pointer;font-family:\'DM Sans\',sans-serif">Save</button>'
    +(rate?'<span style="font-size:11px;color:var(--muted)">'+_ttBillable(rate,3600)+'/hr</span>':'')
    +'</div></div>';

  var metrics='<div class="metrics-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.75rem;margin-bottom:.75rem">'
    +mcard('This month',_ttFmtHrs(mtdSecs),rate?_ttBillable(rate,mtdSecs):'','var(--blue)')
    +mcard('Total working',_ttFmtHrs(totalWork),rate?_ttBillable(rate,totalWork):'','var(--green)')
    +mcard('Total idle',_ttFmtHrs(totalIdle),'','var(--amber)')
    +mcard('Unbilled',_ttFmtHrs(unbilledSecs),rate?_ttBillable(rate,unbilledSecs):'','var(--red)')
    +mcard('Billed',_ttFmtHrs(billedSecs),rate?_ttBillable(rate,billedSecs):'','var(--muted)')
    +'</div>';

  var table='';
  var c2=gc();
  if(!log.length){
    var rateHint=c2&&!c2.timeRate?'<div style="font-size:11px;margin-top:.5rem;color:var(--amber)">Tip: set a billing rate above to track billable value automatically.</div>':'';
    table='<div class="card"><div style="padding:2rem;text-align:center;color:var(--muted);font-size:13px">'
      +'<div style="font-size:28px;margin-bottom:.5rem"><i class="far fa-clock"></i></div>'
      +'<div style="font-weight:500;color:var(--text);margin-bottom:.25rem">No time logged yet</div>'
      +'<div style="font-size:12px">Hit ▶ Start to begin tracking, or use "+ Log time" to add past sessions manually.</div>'
      +rateHint
      +'</div></div>';
  }else{
    var rows=log.map(function(e){
      var d=new Date(e.start);
      var ds=(d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear();
      var ts=d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
      var bb=e.billed
        ?'<span style="background:var(--green);color:#fff;border-radius:10px;padding:2px 7px;font-size:10px;font-weight:600">Billed</span>'
        :'<span style="background:var(--soft);color:var(--muted);border-radius:10px;padding:2px 7px;font-size:10px">Unbilled</span>';
      var mb=e.manual?'<span style="background:var(--soft);color:var(--muted);border-radius:10px;padding:2px 7px;font-size:10px;margin-left:3px">Manual</span>':'';
      return'<tr>'
        +'<td style="font-size:12px">'+ds+'<br><span style="color:var(--muted);font-size:10px">'+ts+'</span></td>'
        +'<td style="font-weight:600">'+_ttFmtHrs(e.workSecs||0)+'</td>'
        +'<td style="color:var(--muted);font-size:12px">'+(e.idleSecs>0?_ttFmtDur(e.idleSecs):'—')+'</td>'
        +(rate?'<td style="color:var(--green);font-weight:600">'+_ttBillable(rate,e.workSecs||0)+'</td>':'')
        +'<td>'+bb+mb+'</td>'
        +'<td style="font-size:11px;color:var(--muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(e.note||'—')+'</td>'
        +'<td><div class="row-acts">'
        +'<button class="e-btn" onclick="ttMarkBilled(\''+e.id+'\')" title="'+(e.billed?'Mark unbilled':'Mark billed')+'">'+(e.billed?'<i class="fas fa-rotate-left"></i>':'<i class="fas fa-check"></i>')+'</button>'
        +'<button class="d-btn" onclick="ttDeleteEntry(\''+e.id+'\')">&#215;</button>'
        +'</div></td></tr>';
    }).join('');
    table='<div class="card"><div class="c-head"><span class="c-title">Time log</span>'
      +'<button onclick="ttOpenManual()" style="padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:none;font-size:11px;cursor:pointer;font-family:\'DM Sans\',sans-serif;color:var(--muted)">+ Log manually</button>'
      +'</div><div style="overflow-x:auto"><table><thead><tr>'
      +'<th>Date</th><th>Working</th><th>Idle</th>'
      +(rate?'<th>Billable</th>':'')
      +'<th>Status</th><th>Note</th><th></th>'
      +'</tr></thead><tbody>'+rows+'</tbody></table></div></div>';
  }

  var actionBar='<div style="margin-bottom:.75rem;display:flex;gap:.5rem;flex-wrap:wrap">'
    +(_TT_ACTIVE&&_TT_CLIENT_ID===c.id
      ?'<button onclick="ttStopSession(false)" style="padding:7px 16px;border:none;border-radius:7px;background:var(--red);color:#fff;font-size:13px;font-weight:500;cursor:pointer;font-family:\'DM Sans\',sans-serif">■ Stop & save session</button>'
      :'<button onclick="ttStartSession()" style="padding:7px 16px;border:none;border-radius:7px;background:var(--green);color:#fff;font-size:13px;font-weight:500;cursor:pointer;font-family:\'DM Sans\',sans-serif">▶ Start timer</button>')
    +'<button onclick="ttOpenManual()" style="padding:7px 14px;border:1px solid var(--border);border-radius:7px;background:none;font-size:13px;cursor:pointer;font-family:\'DM Sans\',sans-serif;color:var(--text)">+ Log time manually</button>'
    +'</div>';

  p.innerHTML='<div style="padding:1rem">'+actionBar+rateRow+metrics+table+'</div>';
  _ttInjectStyles();
  _ttInjectManualModal();
  // Refresh the waypoint time widget if visible
  _ttRefreshWidget();
}

// ── INLINE NOTE PROMPT (replaces window.prompt) ─────────────
function _ttShowNotePrompt(targetC, sessionStart, sessionEnd, sessionWork, sessionIdle){
  // Always store pending session first — widget may not exist yet
  window._ttPendingSession={ c: targetC, start: sessionStart, end: sessionEnd, workSecs: sessionWork, idleSecs: sessionIdle };

  var workLabel=_ttFmtDur(sessionWork);
  var idleLabel=sessionIdle>0?' · '+_ttFmtDur(sessionIdle)+' idle':'';

  // Remove any existing prompt
  var existing=document.getElementById('tt-stop-overlay');
  if(existing)existing.parentNode.removeChild(existing);

  // Build as a fixed overlay so it shows regardless of which panel is active
  var overlay=document.createElement('div');
  overlay.id='tt-stop-overlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:9998;display:flex;align-items:center;justify-content:center';
  document.body.appendChild(overlay);

  var wrap=document.createElement('div');
  wrap.style.cssText='background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.5rem;width:100%;max-width:360px;box-shadow:0 8px 32px rgba(0,0,0,.18)';
  overlay.appendChild(wrap);

  // Header
  var hdr=document.createElement('div');
  hdr.style.cssText='font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem';
  hdr.textContent='Session ended';
  wrap.appendChild(hdr);

  // Time display
  var timeEl=document.createElement('div');
  timeEl.style.cssText='font-size:22px;font-weight:700;color:var(--green);margin-bottom:.15rem';
  timeEl.textContent=workLabel;
  wrap.appendChild(timeEl);

  var subEl=document.createElement('div');
  subEl.style.cssText='font-size:11px;color:var(--muted);margin-bottom:.75rem';
  subEl.textContent='working'+idleLabel;
  wrap.appendChild(subEl);

  // Note input
  var noteLabel=document.createElement('div');
  noteLabel.style.cssText='font-size:11px;color:var(--muted);margin-bottom:.3rem';
  noteLabel.textContent='What were you working on?';
  wrap.appendChild(noteLabel);

  var inp=document.createElement('input');
  inp.type='text';
  inp.id='tt-note-inp';
  inp.placeholder='e.g. Reconciliation, donor report, payroll...';
  inp.style.cssText='width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:12px;background:var(--surface);color:var(--text);box-sizing:border-box;margin-bottom:.6rem;font-family:inherit';
  wrap.appendChild(inp);

  // 3 buttons
  var btnWrap=document.createElement('div');
  btnWrap.style.cssText='display:flex;flex-direction:column;gap:.35rem';

  function makeBtn(label,desc,bgcolor,textcolor,borderColor,handler){
    var b=document.createElement('button');
    b.style.cssText='width:100%;padding:7px 10px;border:1px solid '+borderColor+';border-radius:7px;background:'+bgcolor+';color:'+textcolor+';font-size:12px;cursor:pointer;text-align:left;font-family:inherit;display:flex;justify-content:space-between;align-items:center';
    b.innerHTML='<span style="font-weight:500">'+label+'</span><span style="font-size:10px;opacity:.7">'+desc+'</span>';
    b.onclick=handler;
    return b;
  }

  function closeOverlay(){ var ov=document.getElementById('tt-stop-overlay');if(ov)ov.parentNode.removeChild(ov); }

  btnWrap.appendChild(makeBtn(
    'Add to log','counts toward billing',
    'var(--green)','#fff','var(--green)',
    function(){ closeOverlay(); _ttCommitSession(inp.value.trim()); }
  ));
  btnWrap.appendChild(makeBtn(
    "Keep — don't count it",'saved but excluded from totals',
    'var(--soft)','var(--text)','var(--border)',
    function(){ closeOverlay(); _ttCommitSession(inp.value.trim(), true); }
  ));
  btnWrap.appendChild(makeBtn(
    'Delete this session','not saved',
    'none','var(--muted)','var(--border)',
    function(){ closeOverlay(); window._ttPendingSession=null; _ttRefreshWidget(); }
  ));

  wrap.appendChild(btnWrap);

  inp.onkeydown=function(e){ if(e.key==='Enter'){ closeOverlay(); _ttCommitSession(inp.value.trim()); } };
  // Click outside overlay to dismiss (commits with current note)
  overlay.onclick=function(e){ if(e.target===overlay){ closeOverlay(); _ttCommitSession(inp.value.trim()); } };
  setTimeout(function(){ inp.focus(); }, 50);
}

// ignored=true means stored in log but workSecs treated as 0 in totals
function _ttCommitSession(note, ignored){
  var sess=window._ttPendingSession;
  window._ttPendingSession=null;
  if(!sess){ _ttRefreshWidget(); return; }
  _ttSaveEntry(sess.c,{
    start:sess.start, end:sess.end,
    workSecs: ignored?0:sess.workSecs,
    idleSecs: sess.idleSecs,
    note: note||'',
    billed: false,
    ignored: !!ignored,
    _origWorkSecs: ignored?sess.workSecs:undefined
  });
  _ttRefreshWidget();
  if(document.getElementById('tt-log-body'))renderTimePanelModal();
}

// ── WAYPOINT TIME WIDGET ──────────────────────────────────────
// Called by renderWaypoint() via _ttWaypointWidget(c)
// Also refreshed every tick via _ttRefreshWidget()
function _ttWaypointWidget(c){
  if(!c)return'';
  var rate=Number(c.timeRate||0);
  var log=c.timeLog||[];
  var now=new Date();
  var mtdSecs=log.filter(function(e){
    var d=new Date(e.start);
    return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
  }).reduce(function(s,e){return s+(e.workSecs||0);},0);
  var todaySecs=log.filter(function(e){
    var d=new Date(e.start);
    return d.toDateString()===now.toDateString();
  }).reduce(function(s,e){return s+(e.workSecs||0);},0);
  var unbilledSecs=log.filter(function(e){return!e.billed;}).reduce(function(s,e){return s+(e.workSecs||0);},0);

  var running=_TT_ACTIVE&&_TT_CLIENT_ID===c.id;
  var liveSecs=running?_TT_WORK_SECS:0;
  var liveIdle=running&&_TT_IS_IDLE;

  var timerDisplay=running
    ?'<div id="tt-widget-live" style="font-size:22px;font-weight:700;color:'+(liveIdle?'var(--amber)':'var(--green)')+'">'
      +_ttFmtDur(liveSecs)
      +'<span style="font-size:11px;font-weight:400;margin-left:6px;color:'+(liveIdle?'var(--amber)':'var(--green)')+'">'
      +(liveIdle?'<i class="fas fa-moon"></i> idle':'<i class="fas fa-circle"></i> live')+'</span></div>'
    :'<div style="font-size:13px;color:var(--muted)">Timer not running</div>';

  var btn=running
    ?'<button onclick="ttStopSession(false)" style="padding:5px 12px;border:none;border-radius:6px;background:var(--red);color:#fff;font-size:12px;font-weight:500;cursor:pointer;font-family:\'DM Sans\',sans-serif">■ Stop</button>'
    :'<button onclick="ttStartSession();_ttRefreshWidget()" style="padding:5px 12px;border:none;border-radius:6px;background:var(--green);color:#fff;font-size:12px;font-weight:500;cursor:pointer;font-family:\'DM Sans\',sans-serif">▶ Start</button>';

  var lastEntry=log.length?log[log.length-1]:null;
  var lastEntryHtml='';
  if(!running&&lastEntry){
    var ld=new Date(lastEntry.start);
    var isToday=ld.toDateString()===now.toDateString();
    lastEntryHtml='<div style="font-size:11px;color:var(--muted);margin-bottom:.4rem">'      +'Last: '+(isToday?'today, ':''+( (ld.getMonth()+1)+'/'+ld.getDate()+' '))      +_ttFmtHrs(lastEntry.workSecs||0)      +(lastEntry.note?' · <em>'+escHtml(lastEntry.note)+'</em>':'')      +'</div>';
  }

  return'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.5rem">'
    +'<span style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em"><i class="far fa-clock"></i> Time</span>'
    +'<button onclick="ttOpenFullLog()" style="font-size:11px;color:var(--np);background:none;border:none;cursor:pointer;font-family:\'DM Sans\',sans-serif;padding:0">'
    +(log.length?'Log ('+log.length+') →':'View log →')
    +'</button>'
    +'</div>'
    +lastEntryHtml
    +timerDisplay
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:.35rem;margin:.6rem 0">'
    +'<div style="font-size:10px;color:var(--muted)">Today<br><strong style="font-size:13px;color:var(--text)">'+_ttFmtHrs(todaySecs+(running?liveSecs:0))+'</strong></div>'
    +'<div style="font-size:10px;color:var(--muted)">This month<br><strong style="font-size:13px;color:var(--text)">'+_ttFmtHrs(mtdSecs+(running?liveSecs:0))+'</strong></div>'
    +(unbilledSecs>0?'<div style="font-size:10px;color:var(--muted)">Unbilled<br><strong style="font-size:13px;color:var(--red)">'+_ttFmtHrs(unbilledSecs)+'</strong></div>':'')
    +(rate?'<div style="font-size:10px;color:var(--muted)">Unbilled $<br><strong style="font-size:13px;color:var(--green)">'+_ttBillable(rate,unbilledSecs)+'</strong></div>':'')
    +'</div>'
    +'<div style="display:flex;gap:.4rem">'
    +btn
    +'<button onclick="ttOpenManual()" style="padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:none;font-size:11px;cursor:pointer;font-family:\'DM Sans\',sans-serif;color:var(--muted)">+ Manual</button>'
    +'</div>';
}

function _ttRefreshWidget(){
  var w=document.getElementById('tt-widget-wrap');
  if(!w)return;
  var c=gc();if(!c)return;
  w.innerHTML=_ttWaypointWidget(c);
}

var _TT_LOG_ALL_CLIENTS=false;

function renderAllClientsLog(el){
  if(!el)return;
  var now=new Date();
  var allEntries=[];
  (D.clients||[]).forEach(function(c){
    (c.timeLog||[]).forEach(function(e){
      allEntries.push({entry:e,clientName:c.name,clientId:c.id,rate:Number(c.timeRate||0)});
    });
  });
  allEntries.sort(function(a,b){return new Date(b.entry.start)-new Date(a.entry.start);});

  if(!allEntries.length){
    el.innerHTML='<div style="text-align:center;padding:2rem;color:var(--muted);font-size:13px">No time logged across any client yet.</div>';
    return;
  }

  var totalWork=allEntries.reduce(function(s,x){return s+(x.entry.workSecs||0);},0);
  var unbilled=allEntries.filter(function(x){return!x.entry.billed&&!x.entry.ignored;}).reduce(function(s,x){return s+(x.entry.workSecs||0);},0);
  var mtdWork=allEntries.filter(function(x){var d=new Date(x.entry.start);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}).reduce(function(s,x){return s+(x.entry.workSecs||0);},0);

  var summary='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:.5rem;margin-bottom:.75rem">'
    +'<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:.6rem .9rem"><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.2rem">This month</div><div style="font-size:16px;font-weight:700;color:var(--blue)">'+_ttFmtHrs(mtdWork)+'</div></div>'
    +'<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:.6rem .9rem"><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.2rem">Total</div><div style="font-size:16px;font-weight:700;color:var(--green)">'+_ttFmtHrs(totalWork)+'</div></div>'
    +'<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:.6rem .9rem"><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.2rem">Unbilled</div><div style="font-size:16px;font-weight:700;color:var(--red)">'+_ttFmtHrs(unbilled)+'</div></div>'
    +'</div>';

  var rows=allEntries.map(function(x){
    var e=x.entry;
    var d=new Date(e.start);
    var ds=(d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear();
    var bill=x.rate?_ttBillable(x.rate,e.workSecs||0):'—';
    var status=e.ignored?'Not counted':e.billed?'Billed':'Unbilled';
    return'<tr>'
      +'<td style="font-size:12px;white-space:nowrap">'+ds+'</td>'
      +'<td style="font-size:12px;color:var(--muted)">'+escHtml(x.clientName)+'</td>'
      +'<td style="font-weight:600">'+_ttFmtHrs(e.workSecs||0)+'</td>'
      +'<td style="font-size:11px;color:var(--muted)">'+bill+'</td>'
      +'<td style="font-size:11px;color:var(--muted)">'+status+'</td>'
      +'<td style="font-size:11px;color:var(--muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(e.note?escHtml(e.note):'—')+'</td>'
      +'</tr>';
  }).join('');

  var exportBtn='<div style="display:flex;justify-content:flex-end;gap:.5rem;margin-bottom:.75rem">'
    +'<button onclick="ttExportAllClientsXLSX()" style="padding:6px 14px;border:1px solid var(--border);border-radius:7px;background:var(--surface);color:var(--text);font-size:12px;cursor:pointer;font-weight:500"><i class="fas fa-chart-column"></i> Export Excel</button>'
    +'<button onclick="ttExportAllClientsPDF()" style="padding:6px 14px;border:1px solid var(--np);border-radius:7px;background:var(--np);color:#fff;font-size:12px;cursor:pointer;font-weight:500"><i class="fas fa-file"></i> Export PDF</button>'
    +'</div>';

  el.innerHTML=summary+exportBtn
    +'<div style="overflow-x:auto"><table><thead><tr>'
    +'<th>Date</th><th>Client</th><th>Working</th><th>Billable</th><th>Status</th><th>Note</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table></div>';
}

function ttExportAllClientsPDF(){
  var now=new Date();
  var allEntries=[];
  (D.clients||[]).forEach(function(c){
    (c.timeLog||[]).forEach(function(e){
      allEntries.push({entry:e,clientName:c.name,rate:Number(c.timeRate||0)});
    });
  });
  allEntries.sort(function(a,b){return new Date(a.entry.start)-new Date(b.entry.start);});
  if(!allEntries.length){alert('No time entries to export.');return;}

  var totalWork=allEntries.reduce(function(s,x){return s+(x.entry.workSecs||0);},0);

  // Group by client for subtotals
  var byClient={};
  allEntries.forEach(function(x){
    if(!byClient[x.clientName])byClient[x.clientName]={entries:[],totalWork:0,rate:x.rate};
    byClient[x.clientName].entries.push(x);
    byClient[x.clientName].totalWork+=x.entry.workSecs||0;
  });

  var rowsHtml=allEntries.map(function(x){
    var e=x.entry;
    var d=new Date(e.start);
    var ds=(d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear();
    var bill=x.rate?_ttBillable(x.rate,e.workSecs||0):'—';
    return'<tr style="border-bottom:1px solid #e8e5de">'
      +'<td style="padding:7px 6px;font-size:12px">'+ds+'</td>'
      +'<td style="padding:7px 6px;font-size:12px;color:#555">'+escHtml(x.clientName)+'</td>'
      +'<td style="padding:7px 6px;font-size:12px;font-weight:600">'+_ttFmtHrs(e.workSecs||0)+'</td>'
      +'<td style="padding:7px 6px;font-size:12px">'+bill+'</td>'
      +'<td style="padding:7px 6px;font-size:12px;color:#666">'+(e.note?escHtml(e.note):'—')+'</td>'
      +'</tr>';
  }).join('');

  // Client summary rows
  var summaryRows=Object.keys(byClient).map(function(name){
    var g=byClient[name];
    var bill=g.rate?_ttBillable(g.rate,g.totalWork):'—';
    return'<tr style="border-bottom:1px solid #e8e5de">'
      +'<td style="padding:6px">'+escHtml(name)+'</td>'
      +'<td style="padding:6px;font-weight:600">'+_ttFmtHrs(g.totalWork)+'</td>'
      +'<td style="padding:6px">'+bill+'</td>'
      +'</tr>';
  }).join('');

  var html='<!DOCTYPE html><html><head><meta charset="UTF-8">'
    +'<style>body{font-family:Helvetica Neue,Arial,sans-serif;margin:0;padding:40px;color:#1a1814;font-size:13px;}'
    +'h1{font-size:26px;font-weight:300;margin:0 0 4px}h2{font-size:14px;font-weight:600;margin:24px 0 8px;border-bottom:1px solid #e8e5de;padding-bottom:4px}'
    +'table{width:100%;border-collapse:collapse;margin-bottom:24px}'
    +'th{text-align:left;padding:7px 6px;border-bottom:2px solid #1a1814;font-size:11px;text-transform:uppercase;letter-spacing:.05em}'
    +'.total{font-size:14px;font-weight:700;margin-top:8px;padding-top:8px;border-top:2px solid #1a1814}'
    +'.footer{margin-top:40px;font-size:10px;color:#aaa;border-top:1px solid #e8e5de;padding-top:12px}'
    +'</style></head><body>'
    +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px">'
    +'<div><h1>Time Log — All Clients</h1><div style="font-size:11px;color:#888">Prepared with Clarity by Telofin™</div></div>'
    +'<div style="text-align:right;font-size:12px;color:#666">Generated: '+(now.getMonth()+1)+'/'+now.getDate()+'/'+now.getFullYear()+'<br>Total: '+_ttFmtHrs(totalWork)+'</div>'
    +'</div>'
    +'<h2>Summary by Client</h2>'
    +'<table><thead><tr><th>Client</th><th>Total hours</th><th>Billable</th></tr></thead><tbody>'+summaryRows+'</tbody></table>'
    +'<h2>All Entries</h2>'
    +'<table><thead><tr><th>Date</th><th>Client</th><th>Hours</th><th>Billable</th><th>Description</th></tr></thead><tbody>'+rowsHtml+'</tbody></table>'
    +'<div class="footer">Clarity by Telofin™ · This report is for internal billing reference only.</div>'
    +'</body></html>';

  var win=window.open('','_blank');
  if(!win){alert('Allow popups to export PDF.');return;}
  var printBar='<div style="position:sticky;top:0;z-index:999;background:#1a1814;padding:10px 40px;display:flex;align-items:center;justify-content:space-between">'    +'<span style="color:#f0ede6;font-size:13px;font-family:Helvetica Neue,Arial,sans-serif"><i class="fas fa-file"></i> Clarity by Telofin™ — All clients time log</span>'    +'<div style="display:flex;gap:8px">'    +'<button onclick="window.print()" style="padding:7px 18px;border:none;border-radius:7px;background:#1D9E75;color:#fff;font-size:13px;font-weight:500;cursor:pointer;font-family:Helvetica Neue,Arial,sans-serif"><i class="fas fa-print"></i> Print / Save as PDF</button>'    +'<button onclick="window.close()" style="padding:7px 14px;border:1px solid rgba(255,255,255,.3);border-radius:7px;background:none;color:#f0ede6;font-size:13px;cursor:pointer;font-family:Helvetica Neue,Arial,sans-serif"><i class="fas fa-xmark"></i> Close</button>'    +'</div></div>';
  html = html.replace('<body>', '<body>'+printBar);
  win.document.write(html);
  win.document.close();
  win.focus();
}

function ttOpenFullLog(allClients){
  _TT_LOG_ALL_CLIENTS=!!allClients;
  _ttInjectStyles();
  _ttInjectManualModal();
  _ttInjectFullLogModal();
  if(typeof openM==='function')openM('m-tt-log');
  renderTimePanelModal();
}

function _ttInjectFullLogModal(){
  if(document.getElementById('m-tt-log'))return;
  var div=document.createElement('div');
  div.innerHTML='<div class="overlay" id="m-tt-log" style="align-items:flex-start;padding:1rem" onclick="if(event.target===this)closeM(\'m-tt-log\')">'
    +'<div class="modal" style="max-width:720px;width:100%;max-height:88vh;overflow-y:auto">'
    +'<div class="m-head" style="display:flex;align-items:center;gap:.75rem">'
    +'<span class="m-title"><i class="far fa-clock"></i> Time log</span>'
    +'<div style="display:flex;gap:.4rem;margin-left:.5rem">'
    +'<button id="tt-log-tab-cur" onclick="_TT_LOG_ALL_CLIENTS=false;renderTimePanelModal()" style="padding:3px 10px;border-radius:6px;font-size:11px;cursor:pointer;border:1px solid var(--border)">This client</button>'
    +'<button id="tt-log-tab-all" onclick="_TT_LOG_ALL_CLIENTS=true;renderTimePanelModal()" style="padding:3px 10px;border-radius:6px;font-size:11px;cursor:pointer;border:1px solid var(--border)">All clients</button>'
    +'</div>'
    +'<button class="cx" onclick="closeM(\'m-tt-log\')" style="font-size:20px;margin-left:auto">&#215;</button></div>'
    +'<div id="tt-log-body" style="padding:.5rem 0"></div>'
    +'</div></div>';
  document.body.appendChild(div.firstChild);
}

// ── DATE FILTER STATE ────────────────────────────────────────
var _TT_FILTER_FROM='';
var _TT_FILTER_TO='';

function ttSetFilter(){
  _TT_FILTER_FROM=(document.getElementById('tt-from')||{}).value||'';
  _TT_FILTER_TO=(document.getElementById('tt-to')||{}).value||'';
  renderTimePanelModal();
}

function ttEditNote(id){
  var c=gc();if(!c||!c.timeLog)return;
  var e=c.timeLog.find(function(x){return x.id===id;});if(!e)return;
  var cell=document.getElementById('tt-note-'+id);if(!cell)return;
  var cur=e.note||'';
  cell.innerHTML='<div style="display:flex;gap:4px;align-items:center">'    +'<input id="tt-note-edit-'+id+'" type="text" value="'+escHtml(cur)+'" style="flex:1;padding:3px 6px;border:1px solid var(--border);border-radius:5px;font-size:11px;background:var(--surface);color:var(--text)">'    +'<button onclick="ttSaveNoteEdit(\''+id+'\')" style="padding:3px 7px;border:none;border-radius:5px;background:var(--green);color:#fff;font-size:11px;cursor:pointer"><i class="fas fa-check"></i></button>'    +'<button onclick="renderTimePanelModal()" style="padding:3px 7px;border:1px solid var(--border);border-radius:5px;background:none;font-size:11px;cursor:pointer;color:var(--muted)"><i class="fas fa-xmark"></i></button>'    +'</div>';
  setTimeout(function(){
    var inp=document.getElementById('tt-note-edit-'+id);
    if(inp){inp.focus();inp.select();inp.onkeydown=function(ev){if(ev.key==='Enter')ttSaveNoteEdit(id);if(ev.key==='Escape')renderTimePanelModal();};}
  },30);
}

function ttSaveNoteEdit(id){
  var c=gc();if(!c||!c.timeLog)return;
  var e=c.timeLog.find(function(x){return x.id===id;});if(!e)return;
  var inp=document.getElementById('tt-note-edit-'+id);
  if(inp)e.note=inp.value.trim();
  sv();renderTimePanelModal();_ttRefreshWidget();
}

function ttExportLogXLSX(){
  if(typeof XLSX==='undefined'){alert('Excel export not available — XLSX library not loaded.');return;}
  var c=gc();if(!c)return;
  var rate=Number(c.timeRate||0);
  var log=(c.timeLog||[]).slice().sort(function(a,b){return new Date(a.start)-new Date(b.start);});
  var rows=[['Date','Start time','Hours worked','Idle hrs','Billable','Status','Note']];
  log.forEach(function(e){
    var d=new Date(e.start);
    rows.push([
      (d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear(),
      d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}),
      (e.workSecs||0)/3600,
      (e.idleSecs||0)/3600,
      rate?(e.workSecs||0)/3600*rate:0,
      e.ignored?'Not counted':e.billed?'Billed':'Unbilled',
      e.note||''
    ]);
  });
  var wb=XLSX.utils.book_new();
  var ws=XLSX.utils.aoa_to_sheet(rows);
  // Format number columns
  ws['!cols']=[{wch:12},{wch:12},{wch:14},{wch:10},{wch:12},{wch:14},{wch:40}];
  XLSX.utils.book_append_sheet(wb,ws,'Time Log');
  XLSX.writeFile(wb,(c.name||'client').replace(/[^a-z0-9]/gi,'-')+'-time-log.xlsx');
}

function ttExportAllClientsXLSX(){
  if(typeof XLSX==='undefined'){alert('Excel export not available — XLSX library not loaded.');return;}
  var wb=XLSX.utils.book_new();
  // Summary sheet
  var summaryRows=[['Client','Total hours','Billable amount','Unbilled hours','Billed hours']];
  (D.clients||[]).forEach(function(c){
    var log=c.timeLog||[];
    var rate=Number(c.timeRate||0);
    var total=log.reduce(function(s,e){return s+(e.workSecs||0);},0)/3600;
    var unbilled=log.filter(function(e){return!e.billed&&!e.ignored;}).reduce(function(s,e){return s+(e.workSecs||0);},0)/3600;
    var billed=log.filter(function(e){return e.billed;}).reduce(function(s,e){return s+(e.workSecs||0);},0)/3600;
    if(log.length)summaryRows.push([c.name,total,rate?total*rate:0,unbilled,billed]);
  });
  var wsSummary=XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols']=[{wch:24},{wch:14},{wch:16},{wch:14},{wch:12}];
  XLSX.utils.book_append_sheet(wb,wsSummary,'Summary');
  // All entries sheet
  var allRows=[['Date','Client','Hours','Billable','Status','Note']];
  var allEntries=[];
  (D.clients||[]).forEach(function(c){
    (c.timeLog||[]).forEach(function(e){allEntries.push({e:e,name:c.name,rate:Number(c.timeRate||0)});});
  });
  allEntries.sort(function(a,b){return new Date(a.e.start)-new Date(b.e.start);});
  allEntries.forEach(function(x){
    var d=new Date(x.e.start);
    allRows.push([
      (d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear(),
      x.name,
      (x.e.workSecs||0)/3600,
      x.rate?(x.e.workSecs||0)/3600*x.rate:0,
      x.e.ignored?'Not counted':x.e.billed?'Billed':'Unbilled',
      x.e.note||''
    ]);
  });
  var wsAll=XLSX.utils.aoa_to_sheet(allRows);
  wsAll['!cols']=[{wch:12},{wch:24},{wch:12},{wch:12},{wch:14},{wch:40}];
  XLSX.utils.book_append_sheet(wb,wsAll,'All Entries');
  XLSX.writeFile(wb,'clarity-time-log-all-clients.xlsx');
}

function ttExportInvoicePDF(){
  var c=gc();if(!c)return;
  var rate=Number(c.timeRate||0);
  var allLog=c.timeLog||[];
  // Apply same filter as the modal
  var log=allLog.filter(function(e){
    if(_TT_FILTER_FROM){var d=new Date(e.start);var f=new Date(_TT_FILTER_FROM);f.setHours(0,0,0,0);if(d<f)return false;}
    if(_TT_FILTER_TO){var d2=new Date(e.start);var t=new Date(_TT_FILTER_TO);t.setHours(23,59,59,999);if(d2>t)return false;}
    return true;
  });
  if(!log.length){alert('No time entries in the selected range.');return;}

  var totalWork=log.reduce(function(s,e){return s+(e.workSecs||0);},0);
  var totalBill=rate?_ttBillable(rate,totalWork):'N/A';
  var now=new Date();
  var invoiceNum='INV-'+now.getFullYear()+('0'+(now.getMonth()+1)).slice(-2)+('0'+now.getDate()).slice(-2);

  // Date range label
  var dates=log.map(function(e){return new Date(e.start);}).sort(function(a,b){return a-b;});
  var fromDate=(dates[0].getMonth()+1)+'/'+dates[0].getDate()+'/'+dates[0].getFullYear();
  var toDate=(dates[dates.length-1].getMonth()+1)+'/'+dates[dates.length-1].getDate()+'/'+dates[dates.length-1].getFullYear();
  var period=fromDate===toDate?fromDate:fromDate+' – '+toDate;

  // Build rows
  var rowsHtml=log.slice().sort(function(a,b){return new Date(a.start)-new Date(b.start);}).map(function(e){
    var d=new Date(e.start);
    var ds=(d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear();
    var hrs=_ttFmtHrs(e.workSecs||0);
    var amt=rate?_ttBillable(rate,e.workSecs||0):'—';
    var note=e.note||'';
    return'<tr style="border-bottom:1px solid #e8e5de">'      +'<td style="padding:8px 6px;font-size:12px">'+ds+'</td>'      +'<td style="padding:8px 6px;font-size:12px;font-weight:600">'+hrs+'</td>'      +'<td style="padding:8px 6px;font-size:12px;color:#666">'+escHtml(note)+'</td>'      +(rate?'<td style="padding:8px 6px;font-size:12px;text-align:right;font-weight:600">'+amt+'</td>':'')+'</tr>';
  }).join('');

  var html='<!DOCTYPE html><html><head><meta charset="UTF-8">'    +'<style>body{font-family:Helvetica Neue,Arial,sans-serif;margin:0;padding:40px;color:#1a1814;font-size:13px;}'    +'h1{font-size:28px;font-weight:300;margin:0 0 4px}'    +'.label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#888;margin-bottom:2px}'    +'.val{font-size:14px;font-weight:600;margin-bottom:16px}'    +'table{width:100%;border-collapse:collapse;margin-top:24px}'    +'th{text-align:left;padding:8px 6px;border-bottom:2px solid #1a1814;font-size:11px;text-transform:uppercase;letter-spacing:.05em}'    +'.total{font-size:16px;font-weight:700;text-align:right;padding-top:12px;border-top:2px solid #1a1814;margin-top:8px}'    +'.footer{margin-top:40px;font-size:10px;color:#aaa;border-top:1px solid #e8e5de;padding-top:12px}'    +'</style></head><body>'    +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px">'    +'<div><h1>Invoice</h1><div style="font-size:11px;color:#888">Prepared with Clarity by Telofin™</div></div>'    +'<div style="text-align:right"><div class="label">Invoice #</div><div class="val">'+invoiceNum+'</div>'    +'<div class="label">Date</div><div class="val">'+(now.getMonth()+1)+'/'+now.getDate()+'/'+now.getFullYear()+'</div></div>'    +'</div>'    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;margin-bottom:32px;padding:16px;background:#f7f5f0;border-radius:8px">'    +'<div><div class="label">Client</div><div class="val">'+escHtml(c.name)+'</div></div>'    +'<div><div class="label">Period</div><div class="val">'+period+'</div></div>'    +'<div><div class="label">Billing rate</div><div class="val">'+(rate?'$'+rate+'/hr':'Not set')+'</div></div>'    +'</div>'    +'<table><thead><tr>'    +'<th>Date</th><th>Hours</th><th>Description</th>'+(rate?'<th style="text-align:right">Amount</th>':'')+'</tr></thead>'    +'<tbody>'+rowsHtml+'</tbody></table>'    +'<div class="total">Total: '+_ttFmtHrs(totalWork)+(rate?' · '+totalBill:'')+'</div>'    +'<div class="footer">Generated '+now.toLocaleDateString()+' · Clarity by Telofin™ · This document is for billing reference only.</div>'    +'</body></html>';

  var win=window.open('','_blank');
  if(!win){alert('Allow popups to export the invoice PDF.');return;}
  var printBar='<div style="position:sticky;top:0;z-index:999;background:#1a1814;padding:10px 40px;display:flex;align-items:center;justify-content:space-between">'    +'<span style="color:#f0ede6;font-size:13px;font-family:Helvetica Neue,Arial,sans-serif"><i class="fas fa-file"></i> Clarity by Telofin™ — All clients time log</span>'    +'<div style="display:flex;gap:8px">'    +'<button onclick="window.print()" style="padding:7px 18px;border:none;border-radius:7px;background:#1D9E75;color:#fff;font-size:13px;font-weight:500;cursor:pointer;font-family:Helvetica Neue,Arial,sans-serif"><i class="fas fa-print"></i> Print / Save as PDF</button>'    +'<button onclick="window.close()" style="padding:7px 14px;border:1px solid rgba(255,255,255,.3);border-radius:7px;background:none;color:#f0ede6;font-size:13px;cursor:pointer;font-family:Helvetica Neue,Arial,sans-serif"><i class="fas fa-xmark"></i> Close</button>'    +'</div></div>';
  html = html.replace('<body>', '<body>'+printBar);
  win.document.write(html);
  win.document.close();
  win.focus();
}

function renderTimePanelModal(){
  var el=document.getElementById('tt-log-body');if(!el)return;
  // Highlight active tab
  var tabCur=document.getElementById('tt-log-tab-cur');
  var tabAll=document.getElementById('tt-log-tab-all');
  function _setTab(el,active){if(!el)return;el.style.background=active?'var(--text)':'none';el.style.color=active?'var(--surface)':'var(--muted)';el.style.borderColor=active?'var(--text)':'var(--border)';}
  _setTab(tabCur,!_TT_LOG_ALL_CLIENTS);
  _setTab(tabAll,_TT_LOG_ALL_CLIENTS);

  if(_TT_LOG_ALL_CLIENTS){ renderAllClientsLog(el); return; }

  var c=gc();if(!c)return;
  var rate=Number(c.timeRate||0);
  var now=new Date();
  var allLog=(c.timeLog||[]).slice().reverse();

  // Apply date filter
  var log=allLog.filter(function(e){
    if(_TT_FILTER_FROM){var d=new Date(e.start);var f=new Date(_TT_FILTER_FROM);f.setHours(0,0,0,0);if(d<f)return false;}
    if(_TT_FILTER_TO){var d2=new Date(e.start);var t=new Date(_TT_FILTER_TO);t.setHours(23,59,59,999);if(d2>t)return false;}
    return true;
  });

  var totalWork=log.reduce(function(s,e){return s+(e.workSecs||0);},0);
  var unbilledSecs=log.filter(function(e){return!e.billed;}).reduce(function(s,e){return s+(e.workSecs||0);},0);
  var billedSecs=log.filter(function(e){return e.billed;}).reduce(function(s,e){return s+(e.workSecs||0);},0);
  var allUnbilledSecs=allLog.filter(function(e){return!e.billed;}).reduce(function(s,e){return s+(e.workSecs||0);},0);
  var mtdSecs=allLog.filter(function(e){var d=new Date(e.start);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}).reduce(function(s,e){return s+(e.workSecs||0);},0);

  function mcard(label,val,sub,color){
    return'<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:.6rem .9rem">'      +'<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.2rem">'+label+'</div>'      +'<div style="font-size:16px;font-weight:700;color:'+color+'">'+val+'</div>'      +(sub&&sub!=='—'?'<div style="font-size:10px;color:var(--muted)">'+sub+'</div>':'')      +'</div>';
  }

  var isFiltered=!!(_TT_FILTER_FROM||_TT_FILTER_TO);
  // Top row: rate only
  var controlRow='<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem;padding-bottom:.75rem;border-bottom:1px solid var(--border);flex-wrap:wrap">'
    +'<label style="font-size:12px;color:var(--muted)">Billing rate:</label>'
    +'<span style="font-size:12px;color:var(--muted)">$</span>'
    +'<input id="tt-rate" type="number" min="0" step="5" value="'+(rate||'')+'" placeholder="0.00" style="width:72px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--soft);color:var(--text)">'
    +'<span style="font-size:12px;color:var(--muted)">/hr</span>'
    +'<button onclick="ttSaveRate();renderTimePanelModal();_ttRefreshWidget()" style="background:var(--green);color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer">Save</button>'
    +'</div>';

  var metrics='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:.5rem;margin-bottom:.75rem">'
    +mcard('This month',_ttFmtHrs(mtdSecs),rate?_ttBillable(rate,mtdSecs):'','var(--blue)')
    +mcard('Total',_ttFmtHrs(totalWork),rate?_ttBillable(rate,totalWork):'','var(--green)')
    +mcard('Unbilled',_ttFmtHrs(allUnbilledSecs),rate?_ttBillable(rate,allUnbilledSecs):'','var(--red)')
    +mcard('Billed',_ttFmtHrs(billedSecs),rate?_ttBillable(rate,billedSecs):'','var(--muted)')
    +'</div>';

  var actionRow='<div style="display:flex;gap:.5rem;margin-bottom:.5rem;flex-wrap:wrap;align-items:center">'
    +(_TT_ACTIVE&&_TT_CLIENT_ID===c.id
      ?'<button onclick="ttStopSession(false)" style="padding:6px 14px;border:none;border-radius:7px;background:var(--red);color:#fff;font-size:12px;font-weight:500;cursor:pointer">■ Stop session</button>'
      :'<button onclick="ttStartSession();if(typeof closeM===\'function\')closeM(\'m-tt-log\');" style="padding:6px 14px;border:none;border-radius:7px;background:var(--green);color:#fff;font-size:12px;font-weight:500;cursor:pointer">▶ Start timer</button>')
    +'<button onclick="ttOpenManual()" style="padding:6px 12px;border:1px solid var(--border);border-radius:7px;background:none;font-size:12px;cursor:pointer;color:var(--text)">+ Log manually</button>'
    +'<span style="flex:1"></span>'
    +(allLog.length?'<button onclick="ttExportLogXLSX()" style="padding:6px 14px;border:1px solid var(--border);border-radius:7px;background:var(--surface);color:var(--text);font-size:12px;cursor:pointer;font-weight:500"><i class="fas fa-chart-column"></i> Excel</button>':'')
    +(allLog.length?'<button onclick="ttExportInvoicePDF()" style="padding:6px 14px;border:1px solid var(--np);border-radius:7px;background:var(--np);color:#fff;font-size:12px;cursor:pointer;font-weight:500"><i class="fas fa-file"></i> Invoice PDF</button>':'')
    +'</div>'
    // Filter row — compact, below action buttons
    +'<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem;flex-wrap:wrap">'
    +'<span style="font-size:11px;color:var(--muted)">Filter by date:</span>'
    +'<input id="tt-from" type="date" value="'+_TT_FILTER_FROM+'" onchange="ttSetFilter()" style="padding:3px 6px;border:1px solid var(--border);border-radius:6px;font-size:11px;background:var(--soft);color:var(--text)">'
    +'<span style="font-size:11px;color:var(--muted)">→</span>'
    +'<input id="tt-to" type="date" value="'+_TT_FILTER_TO+'" onchange="ttSetFilter()" style="padding:3px 6px;border:1px solid var(--border);border-radius:6px;font-size:11px;background:var(--soft);color:var(--text)">'
    +(isFiltered?'<button onclick="_TT_FILTER_FROM=\'\';_TT_FILTER_TO=\'\';renderTimePanelModal()" style="font-size:11px;color:var(--muted);background:none;border:none;cursor:pointer;text-decoration:underline;padding:0">Clear</button>':'')
    +'</div>';

  var table='';
  if(!log.length){
    table='<div style="text-align:center;padding:2rem;color:var(--muted);font-size:13px">'      +(allLog.length?'No entries match the selected date range.':'No time logged yet — hit ▶ Start to begin.')      +'</div>';
  }else{
    var rows=log.map(function(e){
      var d=new Date(e.start);
      var ds=(d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear();
      var ts=d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
      var bb=e.ignored        ?'<span style="background:var(--soft);color:var(--muted);border-radius:10px;padding:2px 7px;font-size:10px">Not counted</span>'        :e.billed        ?'<span style="background:var(--green);color:#fff;border-radius:10px;padding:2px 7px;font-size:10px;font-weight:600">Billed</span>'        :'<span style="background:var(--soft);color:var(--muted);border-radius:10px;padding:2px 7px;font-size:10px">Unbilled</span>';
      var mb=e.manual?'<span style="background:var(--soft);color:var(--muted);border-radius:10px;padding:2px 7px;font-size:10px;margin-left:3px">Manual</span>':'';
      // Note cell — click to edit inline
      var noteCell='<td id="tt-note-'+e.id+'" style="font-size:11px;color:var(--muted);max-width:180px">'        +'<span style="cursor:pointer;text-decoration:underline dotted" onclick="ttEditNote(\''+e.id+'\')" title="Click to edit note">'        +(e.note?escHtml(e.note):'<em style="opacity:.5">add note</em>')        +'</span></td>';
      return'<tr>'        +'<td style="font-size:12px;white-space:nowrap">'+ds+'<br><span style="color:var(--muted);font-size:10px">'+ts+'</span></td>'        +'<td style="font-weight:600;white-space:nowrap">'+_ttFmtHrs(e.workSecs||0)+'</td>'        +(rate?'<td style="color:var(--green);font-weight:600;white-space:nowrap">'+_ttBillable(rate,e.workSecs||0)+'</td>':'')        +'<td>'+bb+mb+'</td>'        +noteCell        +'<td><div style="display:flex;gap:4px">'        +'<button class="e-btn" onclick="ttMarkBilled(\''+e.id+'\');renderTimePanelModal();_ttRefreshWidget()" title="'+(e.billed?'Mark unbilled':'Mark billed')+'">'+(e.billed?'<i class="fas fa-rotate-left"></i>':'<i class="fas fa-check"></i>')+'</button>'        +'<button class="d-btn" onclick="ttDeleteEntry(\''+e.id+'\');renderTimePanelModal();_ttRefreshWidget()">&#215;</button>'        +'</div></td></tr>';
    }).join('');
    table='<div style="overflow-x:auto"><table><thead><tr>'      +'<th>Date</th><th>Working</th>'      +(rate?'<th>Billable</th>':'')      +'<th>Status</th><th>Description / Note</th><th></th>'      +'</tr></thead><tbody>'+rows+'</tbody></table></div>'      +'<div style="font-size:11px;color:var(--muted);margin-top:.5rem">Click any note to edit it inline.</div>';
  }

  el.innerHTML=controlRow+metrics+actionRow+table;
}

// ── MANUAL MODAL ──────────────────────────────────────────────
function _ttInjectStyles(){
  if(document.getElementById('tt-styles'))return;
  var s=document.createElement('style');
  s.id='tt-styles';
  s.textContent=''
    +'@media(max-width:768px){'
    +'#p-time .metrics-grid{grid-template-columns:1fr 1fr!important}'
    +'#tt-bar>div{padding:5px 1rem!important;gap:.5rem!important}'
    +'}'
    +'@media(max-width:480px){'
    +'#p-time .metrics-grid{grid-template-columns:1fr!important}'
    +'}';
  document.head.appendChild(s);
}

function _ttInjectManualModal(){
  if(document.getElementById('m-tt-manual'))return;
  var div=document.createElement('div');
  div.innerHTML='<div class="overlay" id="m-tt-manual" onclick="if(event.target===this)closeM(\'m-tt-manual\')">'
    +'<div class="modal" style="max-width:380px">'
    +'<div class="m-head"><span class="m-title">Log time manually</span>'
    +'<button class="m-x" onclick="closeM(\'m-tt-manual\')">&#215;</button></div>'
    +'<div class="m-body">'
    +'<div class="f-row"><label>Date</label><input id="tt-man-date" type="text" placeholder="MM/DD/YYYY" oninput="autoDate(this)" maxlength="10"></div>'
    +'<div class="f-row"><label>Hours</label><input id="tt-man-hrs" type="number" min="0" max="24" step="1" placeholder="0"></div>'
    +'<div class="f-row"><label>Minutes</label><input id="tt-man-mins" type="number" min="0" max="59" step="5" placeholder="0"></div>'
    +'<div class="f-row"><label>Note <span style="color:var(--muted);font-weight:400">(optional)</span></label>'
    +'<input id="tt-man-note" type="text" placeholder="What were you working on?"></div>'
    +'<div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem">'
    +'<button onclick="closeM(\'m-tt-manual\')" style="padding:7px 14px;border:1px solid var(--border);border-radius:7px;background:none;cursor:pointer;font-size:13px;font-family:\'DM Sans\',sans-serif;color:var(--text)">Cancel</button>'
    +'<button onclick="ttSaveManual()" style="padding:7px 16px;border:none;border-radius:7px;background:var(--green);color:#fff;font-size:13px;font-weight:500;cursor:pointer;font-family:\'DM Sans\',sans-serif">Save</button>'
    +'</div></div></div></div>';
  document.body.appendChild(div.firstChild);
}

// ── NAV PATCHES ───────────────────────────────────────────────
// Time is now a Waypoint widget — not a tab.
// getTabs and afterSwitch patches removed.
// renderTimePanel() is still available for the full-log modal.

// Keep p-time panel available if someone links to it directly
(function(){
  if(typeof afterSwitch!=='function'||afterSwitch._ttPatched)return;
  var _orig=afterSwitch;
  afterSwitch=function(p){
    // Time is now a widget — just pass through
    _orig(p);
  };
  afterSwitch._ttPatched=true;
})();
