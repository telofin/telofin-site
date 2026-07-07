// ============================================================
// Clarity by Telofin™ — app.js
// Phase 1 stability refactor: JS extracted from app.html
//
// STABILITY FIXES APPLIED (search "STABILITY FIX" to find them):
//   FIX-1: buildDynMods() guard — never rebuilds while a modal is open
//   FIX-2: Tab order keyed by client ID, not client type
//   FIX-3: closeM() always resets EI and DONOR_EI
//   FIX-4: closeM() null-checks the element before acting
//
// DEFERRED (marked with DEFER comment):
//   - editItem() branching refactor
//   - saveExp() branching refactor
//   - renderAll() consistency audit
//   - Inline onclick → event delegation
//   - CSS extraction
//   - JS module split
// ============================================================


// ══════════════════════════════════════════
// SUPABASE CONFIG
// ══════════════════════════════════════════
var SUPABASE_URL='https://vcxkphspdbublfdbqlmz.supabase.co';
var SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjeGtwaHNwZGJ1YmxmZGJxbG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NTQ2NjQsImV4cCI6MjA5MDIzMDY2NH0.Q0usq7op4KLKJlp3PrWTfV5ImAllqY-1fvmWfc4JbXY';
var _sb=null;
var _user=null;

function sbClient(){
  if(!_sb&&window.supabase){_sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);}
  return _sb;
} 



// ══════════════════════════════════════════
// AUTH HELPERS
// ══════════════════════════════════════════
function showAuthScreen(){
  var el=document.getElementById('auth-modal');
  if(el)el.classList.add('open');
}

function hideAuthScreen(){
  var el=document.getElementById('auth-modal');
  if(el)el.classList.remove('open');
}

function sendMagicLink(){
  var email=document.getElementById('auth-email').value.trim();
  if(!email){alert('Please enter your email address.');return;}
  var btn=document.getElementById('auth-magic-btn');
  if(btn){btn.textContent='Sending...';btn.disabled=true;}
  var sb=sbClient();if(!sb)return;
  var redirectTo=window.location.origin+window.location.pathname;
  sb.auth.signInWithOtp({email:email,options:{emailRedirectTo:redirectTo}})
  .then(function(res){
    if(res.error){alert('Error: '+res.error.message);if(btn){btn.textContent='Send magic link';btn.disabled=false;}}
    else{
      var el=document.getElementById('auth-email');if(el)el.style.display='none';
      if(btn){btn.style.display='none';}
      var ok=document.getElementById('auth-ok');if(ok)ok.style.display='block';
    }
  });
}

function signInWithGoogle(){
  var sb=sbClient();if(!sb)return;
  var redirectTo=window.location.origin+window.location.pathname;
  sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:redirectTo}});
}

// Clears every piece of client financial data this app has ever written to
// localStorage — the main dataset plus all the smaller per-client caches
// (tab order, last-active-tab, month-end checklists, pinned client).
// Called on sign-out so a shared/public computer doesn't keep a readable
// copy of someone else's books after they've logged out. Session auth
// (Supabase) is separate from this — signing out invalidates the server
// session regardless, but that alone does NOT clear what's sitting in
// localStorage, which is why this exists as its own explicit step.
function clearLocalData(){
  try{
    var toRemove=[];
    for(var i=0;i<localStorage.length;i++){
      var k=localStorage.key(i);
      if(!k)continue;
      if(k===STORE||k==='clarity-pinned'||k==='clarity-sample-loaded'
        ||k.indexOf('to-')===0||k.indexOf('last-tab-')===0||k.indexOf('checklist-')===0){
        toRemove.push(k);
      }
    }
    toRemove.forEach(function(k){try{localStorage.removeItem(k);}catch(e){}});
  }catch(e){console.warn('[security] clearLocalData failed:',e);}
  // Reset in-memory state too, so nothing lingers in the page until reload
  try{D={clients:[]};CID=null;}catch(e){}
}

function signOut(){
  var sb=sbClient();if(!sb)return;
  sb.auth.signOut().then(function(){
    _user=null;
    clearLocalData();
    updateAuthUI();
    if(typeof renderAll==='function')renderAll();
    if(typeof renderSB==='function')renderSB();
  });
}

function downloadAllData(){
  try{
    var blob=new Blob([JSON.stringify(D,null,2)],{type:'application/json'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url;
    a.download='clarity-backup-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a);a.click();
    document.body.removeChild(a);URL.revokeObjectURL(url);
  }catch(e){alert('Export failed: '+e.message);}
}

function updateAuthUI(){
  var signinBtn=document.getElementById('sb-signin-btn');
  var signoutBtn=document.getElementById('sb-signout-btn');
  var syncMsg=document.getElementById('sb-sync-msg');
  var mobSignin=document.getElementById('mob-signin-btn');
  var mobSignout=document.getElementById('mob-signout-btn');
  var sbDataMsg=document.getElementById('sb-data-msg');
  var sbDisclaim=document.getElementById('sb-disclaim');
  var mobDisclaim=document.getElementById('mob-disclaim-txt');
  var welcomeMsg=document.getElementById('welcome-data-msg');
  if(_user){
    if(signinBtn)signinBtn.style.display='none';
    if(signoutBtn)signoutBtn.style.display='block';
    if(syncMsg)syncMsg.style.display='block';
    if(mobSignin)mobSignin.style.display='none';
    if(mobSignout)mobSignout.style.display='inline-block';

  }else{
    if(signinBtn)signinBtn.style.display='block';
    if(signoutBtn)signoutBtn.style.display='none';
    if(syncMsg)syncMsg.style.display='none';
    if(mobSignin)mobSignin.style.display='inline-block';
    if(mobSignout)mobSignout.style.display='none';

  }
}

var _lastSynced=null;
var _syncRetryTimer=null;
var _syncRetryCount=0;
var _MAX_SYNC_RETRIES=3;

async function syncToSupabase(){
  var sb=sbClient();if(!sb||!_user)return;
  var syncMsg=document.getElementById('sb-sync-msg');
  if(syncMsg)syncMsg.textContent='Saving…';
  // Conflict check — warn if another device saved since we loaded
  // Runs on both fresh tab (Case B) and mid-session (Case A)
  var ok=await checkSyncConflict();
  if(ok===false)return;// user chose to cancel
  try{
    await sb.from('User_Data').upsert({user_id:_user.id,data:D,updated_at:new Date().toISOString()},{onConflict:'user_id',ignoreDuplicates:false});
    _lastSynced=new Date();
    _syncRetryCount=0;// reset on success
    clearTimeout(_syncRetryTimer);
    if(syncMsg){
      var h=_lastSynced.getHours(),m=_lastSynced.getMinutes(),ampm=h>=12?'pm':'am';
      h=h%12||12;
      syncMsg.textContent='Saved '+h+':'+(m<10?'0':'')+m+ampm;
    }
  }catch(e){
    console.log('[sync] error:',e);
    if(_syncRetryCount<_MAX_SYNC_RETRIES){
      _syncRetryCount++;
      // Exponential backoff: 3s, 9s, 27s
      var delay=Math.pow(3,_syncRetryCount)*1000;
      if(syncMsg)syncMsg.textContent='Sync error — retrying in '+(delay/1000)+'s (attempt '+_syncRetryCount+'/'+_MAX_SYNC_RETRIES+')…';
      clearTimeout(_syncRetryTimer);
      _syncRetryTimer=setTimeout(function(){try{syncToSupabase();}catch(e){}},delay);
    }else{
      _syncRetryCount=0;
      if(syncMsg)syncMsg.textContent='Sync failed after '+_MAX_SYNC_RETRIES+' attempts — check connection';
      console.warn('[sync] gave up after',_MAX_SYNC_RETRIES,'retries');
    }
  }
}

var _loadedServerTime=null;
async function loadFromSupabase(){
  var sb=sbClient();if(!sb||!_user)return false;
  try{
    var res=await sb.from('User_Data').select('data,updated_at').eq('user_id',_user.id).maybeSingle();
    if(res.error){
      console.error('[clarity] loadFromSupabase error:',res.error.message||res.error);
      var syncMsg=document.getElementById('sb-sync-msg');
      if(syncMsg)syncMsg.textContent='Could not load cloud data — showing local copy';
      return false;
    }
    if(res.data&&res.data.data&&res.data.data.clients&&res.data.data.clients.length){
      D=res.data.data;
      if(res.data.data.plan)_plan=res.data.data.plan;
      _loadedServerTime=res.data.updated_at?new Date(res.data.updated_at):null;
      return true;
    }
  }catch(e){
    console.error('[clarity] loadFromSupabase exception:',e&&e.message||e);
    var syncMsg=document.getElementById('sb-sync-msg');
    if(syncMsg)syncMsg.textContent='Could not reach cloud — showing local copy';
  }
  return false;
}

// ══════════════════════════════════════════
// DUAL-WRITE — Supabase Step 6, Phase 2 (expenses only, first slice)
// ══════════════════════════════════════════
// The relational tables (clients, expenses, ...) only ever got filled in
// once, at migration.js's one-time run. These two functions keep the
// `expenses` table current on every save going forward, without changing
// anything about the blob — the blob stays authoritative; this is a mirror.
// Nothing in the app reads from these tables yet, so a bug here can't
// affect what anyone sees. Both are written to never throw outward: a
// Supabase failure is logged and swallowed, the blob save is untouched.
var _dwClientIdCache={};

// Resolves this client's Supabase UUID via the existing client_id_map table
// (built once by migration.js). If no mapping exists yet — this client was
// created after that one-time migration ran — creates the clients row and
// the mapping now, using the exact same field shape migration.js already
// uses for client rows.
async function dwResolveClientId(c){
  var sb=sbClient();if(!sb||!_user||!c)return null;
  if(_dwClientIdCache[c.id])return _dwClientIdCache[c.id];
  try{
    var mapRes=await sb.from('client_id_map').select('new_client_id').eq('old_client_id',String(c.id)).eq('user_id',_user.id).maybeSingle();
    if(mapRes.data&&mapRes.data.new_client_id){
      _dwClientIdCache[c.id]=mapRes.data.new_client_id;
      return mapRes.data.new_client_id;
    }
    var clientRes=await sb.from('clients').insert({
      user_id:_user.id,name:c.name||'',type:c.type||'np',
      fiscal_year_end:c.fiscalYearEnd||null,basis_type:c.basisType||null,
      np_type:c.npType||null,closed_through:c.closedThrough||null
    }).select('id').single();
    if(clientRes.error||!clientRes.data)return null;
    var newClientId=clientRes.data.id;
    await sb.from('client_id_map').insert({old_client_id:String(c.id),user_id:_user.id,new_client_id:newClientId});
    _dwClientIdCache[c.id]=newClientId;
    return newClientId;
  }catch(e){
    console.warn('[clarity] dwResolveClientId failed:',e);
    return null;
  }
}

// Maps a blob expense record's core fields to the relational `expenses`
// table and upserts on (client_id, old_id) — reuses the exact field mapping
// migration.js's _migrateBlobToTables already proved for expenses.
// FK fields that point at other not-yet-dual-written record types (grant,
// bank account, credit card, project, payroll, bill, petty cash,
// reimbursement) are intentionally left null for now, same as migration.js
// already does for match_id/bank_txn_id — those relationships get filled in
// once those record types get their own dual-write pass.
async function dwUpsertExpense(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={
      client_id:clientId,old_id:item.id,
      description:item.desc||null,cat:item.cat||null,
      amt:item.amt||null,date:item.date||null,fund:item.fund||null,
      line_990:item.line990||null,
      recurring:item.recurring||null,recur_end_date:item.recurEndDate||null,
      recur_count:item.recurCount||null,recur_posted_count:item.recurPostedCount||0,
      check_num:item.checkNum||null,functional:item.functional||null,
      receipt_url:item.receiptUrl||null,tin_1099:item.tin1099||null,
      vendor_1099:item.vendor1099||null,is_1099:!!item.is1099,
      acct_code:item.acctCode||null,
      bank_name:item.bankName||null,
      bs_asset_id:item.bsAssetId||null,freq:item.freq||null,fixed:item.fixed||null,
      subcat:item.subcat||null,
      is_reimb:!!item.isReimb,
      inkind_ref:!!item.inkindRef,functional_split:!!item.functionalSplit,
      reconciled:!!item.reconciled,voided:!!item.voided,voided_at:item.voidedAt||null,
      is_reversal:!!item.isReversal,deleted:!!item.deleted,deleted_at:item.deletedAt||null,
      flagged:!!item.flagged,flag_reason:item.flagReason||null,
      flag_severity:item.flagSeverity||null,flagged_at:item.flaggedAt||null,
      audit:Array.isArray(item.audit)?item.audit:(item.audit?[item.audit]:[])
    };
    await sb.from('expenses').upsert(payload,{onConflict:'client_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertExpense failed (blob save unaffected):',e);
  }
}

async function checkSyncConflict(){
  // Before saving, check if the server has a newer version than what we loaded.
  // Covers two scenarios:
  //   A) Mid-session: another device saved after _lastSynced (original check)
  //   B) Fresh tab:   server was updated between when we loaded and our first save
  //                   (_lastSynced is null but _loadedServerTime exists)
  var sb=sbClient();if(!sb||!_user||!_loadedServerTime)return true;
  try{
    var res=await sb.from('User_Data').select('updated_at').eq('user_id',_user.id).maybeSingle();
    if(!res.data||!res.data.updated_at)return true;
    var serverTime=new Date(res.data.updated_at);
    // Case A: we've synced before and server moved ahead of our last sync
    if(_lastSynced&&serverTime>_lastSynced){
      return confirm('Your data was updated on another device since this session started.\n\nClick OK to save this version (overwrites the other), or Cancel to reload the page and get the latest.');
    }
    // Case B: fresh tab — server moved ahead of what we loaded at startup
    if(!_lastSynced&&serverTime>_loadedServerTime){
      return confirm('Your data was updated on another device after this tab was opened.\n\nClick OK to save this version (overwrites the other), or Cancel to reload the page and get the latest.');
    }
  }catch(e){}
  return true;
}

function restoreFromBackup(input){
  var file=input.files&&input.files[0];if(!file)return;
  if(!file.name.endsWith('.json')){alert('Please select a Clarity backup (.json) file.');input.value='';return;}
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var d=JSON.parse(e.target.result);
      if(!d.clients||!d.clients.length){alert('This file does not appear to be a valid Clarity backup.');return;}
      if(!confirm('This will replace ALL current data with the backup. Are you sure?'))return;
      D=d;
      if(d.plan)_plan=d.plan;
      sv();
      if(typeof load==='function')load();
      alert('Backup restored successfully. '+d.clients.length+' client(s) loaded.');
    }catch(err){alert('Could not read backup file: '+err.message);}
    input.value='';
  };
  reader.readAsText(file);
}

function migrateLocalStorage(){
  try{
    var s=localStorage.getItem(STORE);
    if(s){var d=JSON.parse(s);if(d.clients&&d.clients.length){D=d;syncToSupabase();return true;}}
  }catch(e){}
  return false;
}

// ══════════════════════════════════════════
// SUPABASE STORAGE HELPERS
// ══════════════════════════════════════════
// Path convention: {user_id}/{client_id}/{uuid}-{filename}
// Bucket: 'documents' (RLS scoped to auth.uid())

async function storageUpload(clientId,file,onProgress){
  var sb=sbClient();
  if(!sb||!_user)return{error:'Not signed in'};
  if(!file)return{error:'No file provided'};
  if(file.size>10*1024*1024)return{error:'File must be under 10 MB'};
  var allowed=['application/pdf','image/jpeg','image/png','image/heic','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  // Some browsers report an empty file.type for certain file kinds (notably
  // .heic on some platforms) — that empty-string case is allowed through,
  // but anything with a type that's actively NOT on the list is rejected.
  // Previously this only logged a console warning and let the upload
  // through regardless, making the allowlist purely decorative.
  if(file.type&&allowed.indexOf(file.type)<0)return{error:'File type not supported. Please upload a PDF, image, Excel, or Word file.'};
  // Build a unique path so re-uploads never collide
  var ext=file.name.split('.').pop().toLowerCase();
  var safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
  var path=_user.id+'/'+clientId+'/'+uid()+'-'+safeName;
  try{
    var res=await sb.storage.from('documents').upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream'});
    if(res.error)return{error:res.error.message||'Upload failed'};
    return{path:path};
  }catch(e){return{error:e&&e.message||'Upload error'};}
}

async function storageSignedUrl(path,expiresIn){
  var sb=sbClient();
  if(!sb||!_user)return null;
  try{
    var res=await sb.storage.from('documents').createSignedUrl(path,expiresIn||3600);
    if(res.error||!res.data)return null;
    return res.data.signedUrl;
  }catch(e){return null;}
}

async function storageDelete(path){
  var sb=sbClient();
  if(!sb||!_user)return false;
  try{
    var res=await sb.storage.from('documents').remove([path]);
    return!res.error;
  }catch(e){return false;}
}

// isSignedIn(): lightweight sync check — true if _user is set
function isSignedIn(){return!!_user;}

// ══════════════════════════════════════════
// OFFLINE INDICATOR
// ══════════════════════════════════════════
// Subtle banner at top of page when connection drops.
// Reassures user: data is safe locally, syncs when back online.
// Clears automatically when connection restores.

(function(){
  var _offlineBanner = null;
  var _wasOffline    = false;

  function _showOfflineBanner(){
    if(_offlineBanner)return;
    _offlineBanner=document.createElement('div');
    _offlineBanner.id='offline-banner';
    _offlineBanner.style.cssText=
      'position:fixed;top:0;left:0;right:0;z-index:99998;'
      +'background:#1a1814;color:#f0ede6;'
      +'font-size:12px;font-family:\'DM Sans\',sans-serif;'
      +'padding:8px 1rem;text-align:center;'
      +'display:flex;align-items:center;justify-content:center;gap:.75rem;'
      +'box-shadow:0 2px 8px rgba(0,0,0,.2);'
      +'transition:transform .3s ease;transform:translateY(-100%)';
    _offlineBanner.innerHTML=
      '<span style="font-size:14px"><i class="fas fa-wifi"></i></span>'
      +'<span>You\'re offline — your work is saved locally and will sync when you\'re back.</span>';
    document.body.insertBefore(_offlineBanner,document.body.firstChild);
    // Slide in
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        if(_offlineBanner)_offlineBanner.style.transform='translateY(0)';
      });
    });
    _wasOffline=true;
  }

  function _hideOfflineBanner(){
    if(!_offlineBanner)return;
    var b=_offlineBanner;
    b.style.background='var(--green,#1D9E75)';
    b.innerHTML=
      '<span style="font-size:14px"><i class="fas fa-check"></i></span>'
      +'<span>Back online — syncing your data now.</span>';
    // Trigger sync if signed in
    if(typeof syncToSupabase==='function'&&typeof _user!=='undefined'&&_user){
      try{syncToSupabase();}catch(e){}
    }
    setTimeout(function(){
      b.style.transform='translateY(-100%)';
      setTimeout(function(){
        if(b.parentNode)b.parentNode.removeChild(b);
        if(_offlineBanner===b)_offlineBanner=null;
      },350);
    },2000);
    _wasOffline=false;
  }

  window.addEventListener('offline',_showOfflineBanner);
  window.addEventListener('online',function(){
    if(_wasOffline)_hideOfflineBanner();
  });

  // Check on load — in case page was opened while offline
  if(typeof navigator!=='undefined'&&navigator.onLine===false){
    if(document.readyState==='loading'){
      document.addEventListener('DOMContentLoaded',_showOfflineBanner);
    }else{
      setTimeout(_showOfflineBanner,500);
    }
  }
})();
