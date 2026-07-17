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
    _dwOrgId=null;
    _myProfile=null;
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
  var syncMsg=document.getElementById('sb-sync-msg');
  var mobSignin=document.getElementById('mob-signin-btn');
  var mobSignout=document.getElementById('mob-signout-btn');
  var sbDataMsg=document.getElementById('sb-data-msg');
  var sbDisclaim=document.getElementById('sb-disclaim');
  var mobDisclaim=document.getElementById('mob-disclaim-txt');
  var welcomeMsg=document.getElementById('welcome-data-msg');
  var acctWrap=document.getElementById('acct-wrap');
  var accountEmail=document.getElementById('sb-account-email');
  var menuEmail=document.getElementById('acct-menu-email');
  var menuName=document.getElementById('acct-menu-name');
  if(_user){
    if(signinBtn)signinBtn.style.display='none';
    if(syncMsg)syncMsg.style.display='block';
    if(mobSignin)mobSignin.style.display='none';
    if(mobSignout)mobSignout.style.display='inline-block';
    if(acctWrap)acctWrap.style.display='inline-block';
    if(accountEmail)accountEmail.textContent=_user.email||'';
    if(menuEmail)menuEmail.textContent=_user.email||'';
    if(menuName)menuName.textContent=(_myProfile&&_myProfile.name)?_myProfile.name:'Your account';

  }else{
    if(signinBtn)signinBtn.style.display='block';
    if(syncMsg)syncMsg.style.display='none';
    if(mobSignin)mobSignin.style.display='inline-block';
    if(mobSignout)mobSignout.style.display='none';
    if(acctWrap)acctWrap.style.display='none';
    var am=document.getElementById('acct-menu');if(am)am.style.display='none';

  }
}

// ── Account menu + profile (Teams) ──────────────────────────────
// The toolbar chip opens a small account menu. Items appear only once
// their feature is built (owner's rule): today = Your profile + Sign out;
// Billing / Manage users / Settings get added as their phases ship.
var _myProfile=null;

function toggleAcctMenu(e){
  if(e){e.stopPropagation();}
  var m=document.getElementById('acct-menu');if(!m)return;
  var willOpen=(m.style.display!=='block');
  m.style.display=willOpen?'block':'none';
  if(willOpen){setTimeout(function(){document.addEventListener('click',_acctMenuOutside);},0);}
  else{document.removeEventListener('click',_acctMenuOutside);}
}
function _acctMenuOutside(e){
  var wrap=document.getElementById('acct-wrap');
  if(wrap&&wrap.contains(e.target))return;// clicks inside the menu/chip stay open
  var m=document.getElementById('acct-menu');if(m)m.style.display='none';
  document.removeEventListener('click',_acctMenuOutside);
}

// Reads this user's own profile row (name/firm/phone) → caches + refreshes the menu label.
async function loadMyProfile(){
  var sb=sbClient();if(!sb||!_user)return;
  try{
    var res=await sb.from('profiles').select('name,firm,phone,role').eq('user_id',_user.id).maybeSingle();
    _myProfile=(res&&res.data)?res.data:null;
  }catch(e){console.warn('[profile] load failed:',e);_myProfile=null;}
  if(typeof updateAuthUI==='function')updateAuthUI();
}

function openProfile(){
  var m=document.getElementById('acct-menu');if(m)m.style.display='none';
  var em=g('prof-email');if(em)em.textContent=_user?(_user.email||''):'';
  g('prof-name').value=(_myProfile&&_myProfile.name)||'';
  g('prof-firm').value=(_myProfile&&_myProfile.firm)||'';
  g('prof-phone').value=(_myProfile&&_myProfile.phone)||'';
  var msg=g('prof-msg');if(msg)msg.textContent='';
  openM('m-profile');
}

async function saveMyProfile(){
  var sb=sbClient();if(!sb||!_user){alert('Please sign in first.');return;}
  var name=(g('prof-name').value||'').trim();
  var firm=(g('prof-firm').value||'').trim();
  var phone=(g('prof-phone').value||'').trim();
  if(!name){alert('Please enter your name.');return;}
  var msg=g('prof-msg');if(msg)msg.textContent='Saving…';
  try{
    var res=await sb.from('profiles').upsert({user_id:_user.id,name:name,firm:firm||null,phone:phone||null},{onConflict:'user_id'});
    if(res.error)throw res.error;
    _myProfile=Object.assign({},_myProfile||{},{name:name,firm:firm||null,phone:phone||null});
    if(typeof updateAuthUI==='function')updateAuthUI();
    if(msg)msg.textContent='Saved';
    setTimeout(function(){closeM('m-profile');},650);
  }catch(e){
    console.warn('[profile] save failed:',e);
    if(msg)msg.textContent='';
    alert('Could not save profile: '+((e&&e.message)||e));
  }
}

// ── Manage users (Teams roster) ─────────────────────────────────
// A2.1: read-only roster of everyone the owner has shared clients with.
// People are shown by email (owner can't yet read teammates' profile names —
// that needs a co-member SELECT policy, added when name display lands).
function openManageUsers(){
  var m=document.getElementById('acct-menu');if(m)m.style.display='none';
  openM('m-users');
  loadRoster();
  buildInviteClients();
  var ie=g('inv-email');if(ie)ie.value='';
  var im=g('inv-msg');if(im)im.textContent='';
}

// A2.3: the invite form's client checklist — the owner's OWN clients (skip shared-in).
function buildInviteClients(){
  var host=g('inv-clients');if(!host)return;
  var owned=(D.clients||[]).filter(function(c){return c&&!c._shared;});
  if(!owned.length){host.innerHTML='<div style="font-size:12px;color:var(--muted)">No clients to share yet.</div>';return;}
  host.innerHTML=owned.map(function(c){
    var cid=escHtml(c.id);
    return '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">'
      +'<label style="display:flex;align-items:center;gap:6px;flex:1;font-size:12.5px"><input type="checkbox" class="inv-cb" data-cid="'+cid+'"> '+escHtml(c.name||c.id)+'</label>'
      +'<select class="inv-acc" data-cid="'+cid+'" style="width:auto;font-size:11px;padding:3px 6px"><option value="view">View only</option><option value="edit">Can edit</option></select>'
      +'</div>';
  }).join('');
}

// A2.3: create the share(s). One client_access row per picked client (pending invite,
// user_id null — claimInvites stamps it when they sign in). RLS client_access_owner_write
// gates the insert; a matching email already on a client is skipped to avoid duplicates.
async function sendInvite(){
  var sb=sbClient();if(!sb||!_user){alert('Please sign in first.');return;}
  var email=(g('inv-email').value||'').trim();
  if(!email||email.indexOf('@')<1){alert('Please enter a valid email.');return;}
  var picks=[];
  Array.prototype.forEach.call(document.querySelectorAll('#inv-clients .inv-cb'),function(cb){
    if(cb.checked){
      var cid=cb.getAttribute('data-cid');
      var sel=document.querySelector('#inv-clients .inv-acc[data-cid="'+cid+'"]');
      picks.push({cid:cid,canEdit:!!(sel&&sel.value==='edit')});
    }
  });
  if(!picks.length){alert('Pick at least one client to share.');return;}
  var msg=g('inv-msg');if(msg)msg.textContent='Sending…';
  try{
    var boxRes=await sb.from('client_data').select('id,app_client_id').eq('owner_id',_user.id);
    if(boxRes.error)throw boxRes.error;
    var boxByCid={};(boxRes.data||[]).forEach(function(b){boxByCid[b.app_client_id]=b.id;});
    var boxIds=picks.map(function(p){return boxByCid[p.cid];}).filter(Boolean);
    // Skip any client already shared with this email (pending or accepted)
    var exist=await sb.from('client_access').select('client_data_id,invited_email').in('client_data_id',boxIds);
    if(exist.error)throw exist.error;
    var have={};(exist.data||[]).forEach(function(r){if(r.invited_email&&r.invited_email.toLowerCase()===email.toLowerCase())have[r.client_data_id]=true;});
    var toInsert=[];
    picks.forEach(function(p){var box=boxByCid[p.cid];if(box&&!have[box])toInsert.push({client_data_id:box,invited_email:email,can_edit:p.canEdit});});
    var added=0;
    if(toInsert.length){
      var ins=await sb.from('client_access').insert(toInsert);
      if(ins.error)throw ins.error;
      added=toInsert.length;
    }
    var skipped=picks.length-added;
    if(msg)msg.textContent=added
      ?('Invited '+email+' — '+added+' client'+(added>1?'s':'')+' shared'+(skipped?' ('+skipped+' already shared)':''))
      :'Already shared with '+email;
    g('inv-email').value='';
    Array.prototype.forEach.call(document.querySelectorAll('#inv-clients .inv-cb'),function(cb){cb.checked=false;});
    loadRoster();
  }catch(e){
    console.warn('[users] sendInvite failed:',e);
    if(msg)msg.textContent='';
    alert('Could not send invite: '+((e&&e.message)||e));
  }
}

async function loadRoster(){
  var host=g('users-body');if(!host)return;
  var sb=sbClient();
  if(!sb||!_user){host.innerHTML='<div style="color:var(--muted);font-size:13px">Please sign in.</div>';return;}
  host.innerHTML='<div style="color:var(--muted);font-size:13px">Loading…</div>';
  try{
    // My owned client boxes → map box id to the client's display name (from D.clients)
    var boxRes=await sb.from('client_data').select('id,app_client_id').eq('owner_id',_user.id);
    if(boxRes.error)throw boxRes.error;
    var boxes=boxRes.data||[];
    if(!boxes.length){host.innerHTML='<div style="color:var(--muted);font-size:13px">You don\'t have any clients to share yet.</div>';return;}
    var boxName={};boxes.forEach(function(b){
      var c=(D.clients||[]).find(function(cl){return cl.id===b.app_client_id;});
      boxName[b.id]=c?c.name:b.app_client_id;
    });
    var boxIds=boxes.map(function(b){return b.id;});
    // Shares + pending invites on those boxes
    var acc=await sb.from('client_access').select('id,client_data_id,user_id,invited_email,can_edit').in('client_data_id',boxIds);
    if(acc.error)throw acc.error;
    var rows=acc.data||[];
    if(!rows.length){host.innerHTML='<div style="color:var(--muted);font-size:13px">No one has been invited yet.</div>';return;}
    // Group by person: a real teammate keys on user_id, a pending invite on its email
    var people={};
    rows.forEach(function(r){
      var key=r.user_id||('email:'+(r.invited_email||'').toLowerCase());
      if(!people[key])people[key]={email:r.invited_email||'',accepted:!!r.user_id,shares:[]};
      if(r.user_id)people[key].accepted=true;
      people[key].shares.push({id:r.id,client:boxName[r.client_data_id]||'—',canEdit:!!r.can_edit});
    });
    var html='<table style="width:100%;border-collapse:collapse;font-size:12.5px">'
      +'<thead><tr style="text-align:left;color:var(--muted);font-size:11px">'
      +'<th style="padding:6px 8px;font-weight:500">Person</th>'
      +'<th style="padding:6px 8px;font-weight:500">Clients &amp; access</th>'
      +'<th style="padding:6px 8px;font-weight:500">Status</th></tr></thead><tbody>';
    Object.keys(people).forEach(function(k){
      var p=people[k];
      var clients=p.shares.map(function(s){
        return '<div style="display:flex;align-items:center;gap:8px;margin:3px 0;flex-wrap:wrap">'
          +'<span style="min-width:110px">'+escHtml(s.client)+'</span>'
          +'<select onchange="setShareEdit(\''+s.id+'\',this.value===\'edit\')" style="font-size:11px;padding:3px 6px;width:auto">'
            +'<option value="view"'+(s.canEdit?'':' selected')+'>View only</option>'
            +'<option value="edit"'+(s.canEdit?' selected':'')+'>Can edit</option>'
          +'</select>'
          +'<button class="add-btn" style="font-size:10px;padding:2px 8px;color:var(--red);border-color:var(--red-bg)" onclick="removeShare(\''+s.id+'\')">Remove</button>'
          +'</div>';
      }).join('');
      var status=p.accepted
        ?'<span class="badge b-green" style="font-size:9px">Accepted</span>'
        :'<span class="badge b-amber" style="font-size:9px">Pending</span>';
      html+='<tr style="border-top:1px solid var(--border)">'
        +'<td style="padding:8px;word-break:break-all;vertical-align:top">'+escHtml(p.email||'—')+'</td>'
        +'<td style="padding:8px;line-height:1.9;vertical-align:top">'+clients+'</td>'
        +'<td style="padding:8px;vertical-align:top">'+status+'</td></tr>';
    });
    html+='</tbody></table>';
    host.innerHTML=html;
  }catch(e){
    console.warn('[users] roster load failed:',e);
    host.innerHTML='<div style="color:var(--red);font-size:13px">Could not load users: '+escHtml((e&&e.message)||String(e))+'</div>';
  }
}

// A2.2: change a share's access (view↔edit). RLS client_access_owner_write gates it.
async function setShareEdit(accessId,canEdit){
  var sb=sbClient();if(!sb||!_user)return;
  try{
    var res=await sb.from('client_access').update({can_edit:!!canEdit}).eq('id',accessId);
    if(res.error)throw res.error;
  }catch(e){
    console.warn('[users] setShareEdit failed:',e);
    alert('Could not update access: '+((e&&e.message)||e));
  }
  loadRoster();
}

// A2.2: revoke a share. Deletes the client_access row only — the client's books are untouched.
async function removeShare(accessId){
  if(!confirm('Remove this person’s access to this client?\n\nTheir access is revoked; the client’s books are not affected.'))return;
  var sb=sbClient();if(!sb||!_user)return;
  try{
    var res=await sb.from('client_access').delete().eq('id',accessId);
    if(res.error)throw res.error;
  }catch(e){
    console.warn('[users] removeShare failed:',e);
    alert('Could not remove access: '+((e&&e.message)||e));
  }
  loadRoster();
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
    var _blobData=D;
    if(D&&D.clients&&D.clients.some(function(c){return c&&c._shared;})){
      // Never write clients shared TO this user into their own blob — keep it to their books.
      _blobData=Object.assign({},D,{clients:D.clients.filter(function(c){return !(c&&c._shared);})});
    }
    await sb.from('User_Data').upsert({user_id:_user.id,data:_blobData,updated_at:new Date().toISOString()},{onConflict:'user_id',ignoreDuplicates:false});
    dwMirrorClients();// Teams dual-write: keep per-client boxes current (blob stays authoritative)
    dwWriteSharedEdits();// Teams: push a teammate's edits to editable shared clients back to the owner's box
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
  await claimInvites();// Teams: accept invites addressed to my email → active shares, before loading boxes
  loadMyProfile();// Teams: fetch my name/firm/phone for the account menu (non-blocking)
  try{
    var res=await sb.from('User_Data').select('data,updated_at').eq('user_id',_user.id).maybeSingle();
    if(res.error){
      console.error('[clarity] loadFromSupabase error:',res.error.message||res.error);
      var syncMsg=document.getElementById('sb-sync-msg');
      if(syncMsg)syncMsg.textContent='Could not load cloud data — showing local copy';
      return false;
    }
    var _blob=res.data&&res.data.data;
    var _hasBlob=_blob&&_blob.clients&&_blob.clients.length;
    if(_hasBlob){
      D=_blob;
      if(_blob.plan)_plan=_blob.plan;
      _loadedServerTime=res.data.updated_at?new Date(res.data.updated_at):null;
    }
    // Bring in boxes: swap owner clients to their box copies (when clean) + append clients
    // shared to this user. For a teammate with no blob this loads only the shared clients.
    var _gotBoxes=await useBoxesIfClean(_hasBlob);
    if(_hasBlob)return true;
    if(_gotBoxes)return true;
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
var _dwOrgId=null;

// ══════════════════════════════════════════
// TEAMS DUAL-WRITE — keep per-client `client_data` boxes current
// ══════════════════════════════════════════
// Same idea + safety as the expenses dual-write above: on every cloud save we
// also mirror each client into its own client_data row (an org-owned "box"), so
// the shared-books tables stay current going forward. The blob (User_Data) stays
// authoritative; nothing reads client_data yet, and every failure here is logged
// and swallowed so a hiccup can never touch the blob save. Cutover to reading
// these boxes is a later, separate step.

// Resolves this signed-in user's workspace (org) id, creating it if this is a
// brand-new account that never went through the one-time migration. Cached for
// the session; cleared on sign-out.
async function dwResolveOrgId(){
  var sb=sbClient();if(!sb||!_user)return null;
  if(_dwOrgId)return _dwOrgId;
  try{
    var res=await sb.from('orgs').select('id').eq('owner_id',_user.id).maybeSingle();
    if(res.data&&res.data.id){_dwOrgId=res.data.id;return _dwOrgId;}
    var ins=await sb.from('orgs').insert({owner_id:_user.id,name:'My Workspace'}).select('id').single();
    if(ins.error||!ins.data)return null;
    _dwOrgId=ins.data.id;
    return _dwOrgId;
  }catch(e){
    console.warn('[clarity] dwResolveOrgId failed:',e);
    return null;
  }
}

// Mirrors every current client into its client_data box (upsert on
// org_id+app_client_id). Called after a successful blob sync. RLS allows these
// writes because the signed-in user owns their own org.
async function dwMirrorClients(){
  var sb=sbClient();if(!sb||!_user||!D||!D.clients||!D.clients.length)return;
  try{
    var orgId=await dwResolveOrgId();
    if(!orgId)return;
    var now=new Date().toISOString();
    var rows=D.clients.filter(function(c){return c&&c.id&&!c._shared;}).map(function(c){
      return {org_id:orgId,app_client_id:String(c.id),data:c,updated_at:now};
    });
    if(!rows.length)return;
    await sb.from('client_data').upsert(rows,{onConflict:'org_id,app_client_id'});
  }catch(e){
    console.warn('[clarity] dwMirrorClients failed (blob save unaffected):',e);
  }
}

// Writes a teammate's edits to an EDITABLE shared client back to its ORIGINAL box (the
// owner's box, by id) — never a fork. Only touches clients marked ._shared with ._canEdit.
// Runtime markers are stripped before writing so they never persist into the owner's box.
async function dwWriteSharedEdits(){
  var sb=sbClient();if(!sb||!_user||!D||!D.clients)return;
  try{
    var edits=D.clients.filter(function(c){return c&&c._shared&&c._canEdit&&c._shareBoxId;});
    for(var i=0;i<edits.length;i++){
      var c=edits[i];
      var clean=Object.assign({},c);delete clean._shared;delete clean._shareBoxId;delete clean._canEdit;
      await sb.from('client_data').update({data:clean,updated_at:new Date().toISOString()}).eq('id',c._shareBoxId);
    }
  }catch(e){console.warn('[clarity] dwWriteSharedEdits failed:',e);}
}

// ══════════════════════════════════════════
// TEAMS CUTOVER — Step 2b, slice 1: SHADOW-COMPARE (read-only, changes nothing)
// ══════════════════════════════════════════
// Loads the per-client boxes alongside the blob and deep-compares them, so we can
// PROVE the boxes are a faithful copy before ever switching the app to read from
// them. Logs a verdict to the console; never touches D or what the user sees.

// Order-insensitive canonical stringify. JSONB reorders object keys on round-trip,
// so a plain JSON.stringify would flag false diffs — this sorts keys recursively.
function _canonJSON(v){
  if(v===null||typeof v!=='object')return JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(_canonJSON).join(',')+']';
  return '{'+Object.keys(v).sort().map(function(k){return JSON.stringify(k)+':'+_canonJSON(v[k]);}).join(',')+'}';
}

// Reads this user's client_data boxes (their own + any shared) → array of client objects.
// Accepts any pending invites addressed to THIS user's verified email — flips them into
// active shares by stamping user_id. RLS (client_access_claim) guarantees a user can only
// claim invites to their own email, and only onto themselves. Safe to run on every sign-in.
async function claimInvites(){
  var sb=sbClient();if(!sb||!_user)return;
  try{
    await sb.from('client_access').update({user_id:_user.id}).is('user_id',null);
  }catch(e){console.warn('[teams] claimInvites failed:',e);}
}

async function loadClientBoxes(){
  var sb=sbClient();if(!sb||!_user)return null;
  try{
    var res=await sb.from('client_data').select('id,app_client_id,data,owner_id,updated_at');
    if(res.error){console.warn('[boxes] load failed:',res.error.message||res.error);return null;}
    // Which shared boxes may I edit? (my grants in client_access)
    var canEdit={};
    var gr=await sb.from('client_access').select('client_data_id,can_edit').eq('user_id',_user.id);
    if(gr&&gr.data)gr.data.forEach(function(g){canEdit[g.client_data_id]=!!g.can_edit;});
    return (res.data||[]).filter(function(r){return r&&r.data;}).map(function(r){
      var mine=(r.owner_id===_user.id);
      return {data:r.data,mine:mine,boxId:r.id,canEdit:mine||!!canEdit[r.id],updatedAt:r.updated_at};
    });
  }catch(e){console.warn('[boxes] load error:',e);return null;}
}

// Step 2b, slice 3 (member loading): rebuild D.clients from the boxes — the owner's OWN
// clients (from the blob's set, swapped to their box copies when they match) PLUS any
// clients SHARED to this user (each marked ._shared, so the dual-write/blob never fork or
// absorb them). Owner data is protected: if a blob client is missing from the owner's boxes
// or its copy differs, we keep the owner's blob copies (safe) but still append shared ones.
// Shared clients are read-only for now (no member write path yet). Returns true if boxes
// gave us any clients. `hasBlob` tells us whether D already holds this user's own books.
async function useBoxesIfClean(hasBlob){
  if(!_user)return false;
  var rows=await loadClientBoxes();
  if(!rows||!rows.length)return false;// no boxes → leave D as-is (blob/local)
  var myById={},myTimeById={},shared=[];
  rows.forEach(function(r){
    if(r.mine){if(r.data&&r.data.id!=null){myById[String(r.data.id)]=r.data;myTimeById[String(r.data.id)]=r.updatedAt?new Date(r.updatedAt).getTime():0;}}
    else if(r.data){r.data._shared=true;r.data._shareBoxId=r.boxId;r.data._canEdit=r.canEdit;shared.push(r.data);}
  });
  var blobClients=(hasBlob&&D&&D.clients)?D.clients:[];
  var blobTime=(typeof _loadedServerTime!=='undefined'&&_loadedServerTime)?_loadedServerTime.getTime():0;
  var usedBox=0,keptStale=0,noBox=0;
  var out;
  if(hasBlob){
    // Owner: for each of their clients, trust the box copy when it's at least as fresh as the
    // blob — that's how a teammate's edits show up. If no box exists keep the blob client
    // (never drop one); if a box is somehow OLDER than the blob (rare failed mirror) keep blob.
    out=blobClients.map(function(c){
      if(!c||c.id==null)return c;
      var b=myById[String(c.id)];
      if(!b){noBox++;return c;}
      if((myTimeById[String(c.id)]||0)>=blobTime){usedBox++;return b;}
      keptStale++;return c;
    });
  }else{
    // Teammate with no blob of their own: their clients are whatever boxes they own (rare).
    out=[];Object.keys(myById).forEach(function(id){out.push(myById[id]);});
  }
  // Append shared clients not already present.
  var have={};out.forEach(function(c){if(c&&c.id!=null)have[String(c.id)]=1;});
  shared.forEach(function(c){if(c&&c.id!=null&&!have[String(c.id)]){out.push(c);have[String(c.id)]=1;}});
  if(!out.length)return false;
  D.clients=out;
  var rep={owner:!!hasBlob,total:out.length,fromBox:usedBox,shared:shared.length,keptFromBlob:noBox+keptStale};
  window._shadowReport=rep;
  console.log('%c[teams] ✓ '+out.length+' client(s)'+(shared.length?(' ('+shared.length+' shared)'):'')+(keptStale?(' — '+keptStale+' kept from blob (box older)'):''),'font-weight:bold;font-size:13px;color:green',rep);
  return true;
}

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

// Same shape as dwUpsertExpense — see its comments above. FK fields (grantId,
// bankId, projectId) left null for now, same reasoning: those record types
// aren't dual-written yet.
async function dwUpsertIncome(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={
      client_id:clientId,old_id:item.id,
      name:item.name||null,cat:item.cat||null,
      status:item.status||null,proj:item.proj||null,recv:item.recv||null,
      recurring:item.recurring||null,recur_end_date:item.recurEndDate||null,
      recur_count:item.recurCount||null,fund:item.fund||null,date:item.date||null,
      acct_code:item.acctCode||null,
      inkind_ref:!!item.inkindRef,auction_ref:!!item.auctionRef,
      from_bank:!!item.fromBank,vendor_1099:item.vendor1099||null,
      voided:!!item.voided,is_reversal:!!item.isReversal,
      reconciled:!!item.reconciled,deleted:!!item.deleted,deleted_at:item.deletedAt||null,
      audit:Array.isArray(item.audit)?item.audit:(item.audit?[item.audit]:[])
    };
    await sb.from('income').upsert(payload,{onConflict:'client_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertIncome failed (blob save unaffected):',e);
  }
}

// Same shape as dwUpsertExpense — see its comments above. FK fields (bankId,
// projectId) left null for now, same reasoning: those record types aren't
// dual-written yet. The sales-tax-split second ledger entry saveRev() may
// post stays blob-only — this only mirrors the revenue row itself, not the
// internal ledger.
async function dwUpsertRevenue(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={
      client_id:clientId,old_id:item.id,
      name:item.name||null,customer_name:item.customerName||null,
      cat:item.cat||null,conf:item.conf||null,proj:item.proj||null,
      act:item.act||null,recurring:item.recurring||null,
      recur_end_date:item.recurEndDate||null,recur_count:item.recurCount||null,
      date:item.date||null,tax_rate:item.taxRate||null,tax_amt:item.taxAmt||null,
      tax_jurisdiction:item.taxJurisdiction||null,
      voided:!!item.voided,is_reversal:!!item.isReversal,reconciled:!!item.reconciled,
      deleted:!!item.deleted,deleted_at:item.deletedAt||null,
      audit:Array.isArray(item.audit)?item.audit:(item.audit?[item.audit]:[])
    };
    await sb.from('revenue').upsert(payload,{onConflict:'client_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertRevenue failed (blob save unaffected):',e);
  }
}

// Bills, unlike expenses/income/revenue, don't go through the generic
// delItem() soft-delete — delBill() hard-splices locally, so the Supabase
// side mirrors that with a real row delete (dwDeleteBill) rather than a
// deleted flag.
async function dwUpsertBill(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={
      client_id:clientId,old_id:item.id,
      vendor:item.vendor||null,description:item.desc||null,
      amt:item.amt||null,received:item.received||null,due:item.due||null,
      acct_code:item.acctCode||null,cat:item.cat||null,status:item.status||'Unpaid',
      notes:item.notes||null,paid_date:item.paidDate||null,instr_num:item.instrNum||null,
      is_1099:!!item.is1099,tin_1099:item.tin1099||null
    };
    await sb.from('bills').upsert(payload,{onConflict:'client_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertBill failed (blob save unaffected):',e);
  }
}

async function dwDeleteBill(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    await sb.from('bills').delete().eq('client_id',clientId).eq('old_id',item.id);
  }catch(e){
    console.warn('[clarity] dwDeleteBill failed (blob save unaffected):',e);
  }
}

// Loans, like bills, hard-delete locally (delLoan() splices) rather than
// going through delItem()'s soft-delete, so dwDeleteLoan mirrors with a
// real row delete.
async function dwUpsertLoan(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={
      client_id:clientId,old_id:item.id,
      name:item.name||null,principal:item.principal||null,rate:item.rate||null,
      term:item.term||null,start_date:item.startDate||null,
      opening_balance:item.openingBalance||null,posted:item.posted||[]
    };
    await sb.from('loans').upsert(payload,{onConflict:'client_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertLoan failed (blob save unaffected):',e);
  }
}

async function dwDeleteLoan(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    await sb.from('loans').delete().eq('client_id',clientId).eq('old_id',item.id);
  }catch(e){
    console.warn('[clarity] dwDeleteLoan failed (blob save unaffected):',e);
  }
}

// Upserts the donor row and returns its Supabase id, for donation/milestone/
// interaction dual-write to key off — mirrors dwResolveClientId's resolve-or-
// create shape, except donors are always upserted fresh (cheap, and keeps the
// row current) rather than only created once.
async function dwUpsertDonor(c,donor){
  var sb=sbClient();if(!sb||!_user||!c||!donor||!donor.id)return null;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return null;
    var payload={
      client_id:clientId,old_id:donor.id,
      name:donor.name||null,email:donor.email||null,phone:donor.phone||null,
      address:donor.address||null,notes:donor.notes||null,
      constituent_type:donor.constituentType||null,tier:donor.tier||null,
      stage:donor.stage||null,solicitor:donor.solicitor||null,
      ask_amt:donor.askAmt||null,ask_date:donor.askDate||null,
      platform:donor.platform||null,employer:donor.employer||null,
      key_dates:donor.keyDates||{},
      audit:Array.isArray(donor.audit)?donor.audit:(donor.audit?[donor.audit]:[])
    };
    var res=await sb.from('donors').upsert(payload,{onConflict:'client_id,old_id'}).select('id').single();
    return res.data?res.data.id:null;
  }catch(e){
    console.warn('[clarity] dwUpsertDonor failed (blob save unaffected):',e);
    return null;
  }
}

async function dwDeleteDonor(c,donor){
  var sb=sbClient();if(!sb||!_user||!c||!donor||!donor.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    await sb.from('donors').delete().eq('client_id',clientId).eq('old_id',donor.id);
  }catch(e){
    console.warn('[clarity] dwDeleteDonor failed (blob save unaffected):',e);
  }
}

// donations is keyed by donor_id, not client_id — resolves the donor row
// (upserting it first if needed) via dwUpsertDonor before writing the
// donation itself. project_id/bank_txn_id left null, same reasoning as
// dwUpsertExpense's other not-yet-dual-written FK fields.
async function dwUpsertDonation(c,donor,record){
  var sb=sbClient();if(!sb||!_user||!c||!donor||!record||!record.id)return;
  try{
    var donorId=await dwUpsertDonor(c,donor);
    if(!donorId)return;
    var payload={
      donor_id:donorId,old_id:record.id,
      amt:record.amt||null,date:record.date||null,fund:record.fund||null,
      receipted:record.rec==='Yes',thank_you_sent:record.ty==='Yes',
      restriction_type:record.rst||null,in_kind:record.inkind==='Yes',
      fmv:record.fmv||null,item_description:record.itemDescription||null,
      auctioned:!!record.auctioned,auction_date:record.auctionDate||null,
      auction_sale_price:record.auctionSalePrice||null,
      auction_buyer_name:record.auctionBuyerName||null,qpq:record.qpq||null,
      from_bank:!!record.fromBank,
      audit:Array.isArray(record.audit)?record.audit:(record.audit?[record.audit]:[])
    };
    await sb.from('donations').upsert(payload,{onConflict:'donor_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertDonation failed (blob save unaffected):',e);
  }
}

async function dwDeleteDonation(c,donor,record){
  var sb=sbClient();if(!sb||!_user||!c||!donor||!record||!record.id)return;
  try{
    var donorId=await dwUpsertDonor(c,donor);
    if(!donorId)return;
    await sb.from('donations').delete().eq('donor_id',donorId).eq('old_id',record.id);
  }catch(e){
    console.warn('[clarity] dwDeleteDonation failed (blob save unaffected):',e);
  }
}

// Only mirrors the columns confirmed to exist from migration.js's original insert
// (client_id, num, client_name, description, amt, date, due, status, notes,
// bad_debt, bad_debt_date) — paidDate/disputed/disputedAt/disputeNote/amtPaid/
// payments aren't in that insert, so those columns may not exist on this table;
// including an unknown column would fail the whole upsert, not just that field.
// `status` itself does capture Paid/Partial/Disputed/Written Off either way.
async function dwUpsertInvoice(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={
      client_id:clientId,old_id:item.id,
      num:item.num||null,client_name:item.client||null,
      description:item.desc||null,amt:item.amt||null,date:item.date||null,
      due:item.due||null,status:item.status||'Draft',notes:item.notes||null,
      bad_debt:!!item.badDebt,bad_debt_date:item.badDebtDate||null
    };
    await sb.from('invoices').upsert(payload,{onConflict:'client_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertInvoice failed (blob save unaffected):',e);
  }
}

async function dwDeleteInvoice(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    await sb.from('invoices').delete().eq('client_id',clientId).eq('old_id',item.id);
  }catch(e){
    console.warn('[clarity] dwDeleteInvoice failed (blob save unaffected):',e);
  }
}

// Only mirrors columns confirmed in migration.js's original insert (name, type,
// last_4) — the check-printing fields (nextCheckNum, checkFormat, offsets,
// checkCalibrated) were added to the app after that migration ran, so those
// columns likely don't exist on this table yet.
async function dwUpsertBankAcct(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={client_id:clientId,old_id:item.id,name:item.name||null,type:item.type||null,last_4:item.last4||null};
    await sb.from('bank_accounts').upsert(payload,{onConflict:'client_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertBankAcct failed (blob save unaffected):',e);
  }
}
async function dwDeleteBankAcct(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    await sb.from('bank_accounts').delete().eq('client_id',clientId).eq('old_id',item.id);
  }catch(e){
    console.warn('[clarity] dwDeleteBankAcct failed (blob save unaffected):',e);
  }
}

async function dwUpsertCC(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={client_id:clientId,old_id:item.id,name:item.name||null,last_4:item.last4||null,limit:item.limit||null,network:item.network||null};
    await sb.from('credit_cards').upsert(payload,{onConflict:'client_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertCC failed (blob save unaffected):',e);
  }
}
async function dwDeleteCC(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    await sb.from('credit_cards').delete().eq('client_id',clientId).eq('old_id',item.id);
  }catch(e){
    console.warn('[clarity] dwDeleteCC failed (blob save unaffected):',e);
  }
}

async function dwUpsertPayroll(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={
      client_id:clientId,old_id:item.id,date:item.date||null,period:item.period||null,
      gross:item.gross||null,taxes:item.taxes||null,net:item.net||null,
      employees:item.employees||[],reconciled:!!item.reconciled
    };
    await sb.from('payroll').upsert(payload,{onConflict:'client_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertPayroll failed (blob save unaffected):',e);
  }
}
async function dwDeletePayroll(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    await sb.from('payroll').delete().eq('client_id',clientId).eq('old_id',item.id);
  }catch(e){
    console.warn('[clarity] dwDeletePayroll failed (blob save unaffected):',e);
  }
}

async function dwUpsertPettyCash(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={client_id:clientId,old_id:item.id,date:item.date||null,type:item.type||null,amt:item.amt||null,description:item.desc||null,cat:item.cat||null};
    await sb.from('petty_cash').upsert(payload,{onConflict:'client_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertPettyCash failed (blob save unaffected):',e);
  }
}
async function dwDeletePettyCash(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    await sb.from('petty_cash').delete().eq('client_id',clientId).eq('old_id',item.id);
  }catch(e){
    console.warn('[clarity] dwDeletePettyCash failed (blob save unaffected):',e);
  }
}

// deleteReimb() soft-deletes locally (r.deleted=true, no splice) — but `deleted`
// isn't a confirmed column (not in migration.js's original insert), so it isn't
// included here; a deleted reimbursement's Supabase mirror stays as last synced.
async function dwUpsertReimb(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={
      client_id:clientId,old_id:item.id,who:item.who||null,amt:item.amt||null,
      description:item.desc||null,cat:item.cat||null,date:item.date||null,
      notes:item.notes||null,receipt_url:item.receiptUrl||null,receipt_path:item.receiptPath||null,
      status:item.status||'Pending',flagged:!!item.flagged,no_receipt_reason:item.noReceiptReason||null,
      audit:Array.isArray(item.audit)?item.audit:(item.audit?[item.audit]:[])
    };
    await sb.from('reimbursements').upsert(payload,{onConflict:'client_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertReimb failed (blob save unaffected):',e);
  }
}

// Covers every postToLedger()/updateLedgerEntry()/voidLedgerEntry() call across
// the whole app in one place, rather than the dozens of individual call sites —
// those three shared functions are the only paths that ever touch c.ledgerEntries.
// source_id intentionally omitted, same as migration.js's original insert: the
// local sourceId is a same-blob id (an expense/bill/loan/etc id), not a real FK
// into another Supabase table's row, so it can't be written into a real FK column.
// Lines are always deleted + re-inserted fresh — a ledger entry's lines never
// change in place once posted, only its `superseded` flag does, so this stays
// correct (and idempotent) whether this call is a brand-new entry or just a
// flag update on an existing one.
async function dwUpsertLedgerEntry(c,entry){
  var sb=sbClient();if(!sb||!_user||!c||!entry||!entry.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={
      client_id:clientId,old_id:entry.id,
      date:entry.date||null,memo:entry.memo||null,
      source_type:entry.sourceType||null,superseded:!!entry.superseded
    };
    var res=await sb.from('ledger_entries').upsert(payload,{onConflict:'client_id,old_id'}).select('id').single();
    var entryId=res.data?res.data.id:null;
    if(!entryId)return;
    await sb.from('ledger_lines').delete().eq('ledger_entry_id',entryId);
    var lines=(entry.lines||[]).map(function(l){return{ledger_entry_id:entryId,account_code:l.accountCode||null,debit:l.dr||0,credit:l.cr||0};});
    if(lines.length)await sb.from('ledger_lines').insert(lines);
  }catch(e){
    console.warn('[clarity] dwUpsertLedgerEntry failed (blob save unaffected):',e);
  }
}

async function dwUpsertJE(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={
      client_id:clientId,old_id:item.id,date:item.date||null,type:item.type||null,
      memo:item.memo||null,source_type:item.isClosingEntry?'closing':'manual',
      is_closing_entry:!!item.isClosingEntry,closing_fy:item.closingFY||null,
      audit:Array.isArray(item.audit)?item.audit:(item.audit?[item.audit]:[])
    };
    await sb.from('journal_entries').upsert(payload,{onConflict:'client_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertJE failed (blob save unaffected):',e);
  }
}
async function dwDeleteJE(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    await sb.from('journal_entries').delete().eq('client_id',clientId).eq('old_id',item.id);
  }catch(e){
    console.warn('[clarity] dwDeleteJE failed (blob save unaffected):',e);
  }
}

// No dwDelete — grants can't be deleted locally (only edited), so nothing to mirror.
async function dwUpsertGrant(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={
      client_id:clientId,old_id:item.id,name:item.name||null,funder:item.funder||null,
      awarded:item.awarded||null,status:item.status||null,deadline:item.deadline||null,
      app_deadline:item.appDeadline||null,portal_url:item.portalUrl||null,match:item.match||null,
      match_required:item.matchRequired||null,restrict:item.restrict||null,
      reconciled:!!item.reconciled,requirements:item.requirements||[]
    };
    await sb.from('grants').upsert(payload,{onConflict:'client_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertGrant failed (blob save unaffected):',e);
  }
}

// grant_id left null — grants dual-write exists but resolving it here would need its own
// resolve-or-upsert chain; same "FK to a not-yet-linked table" deferral used elsewhere.
async function dwUpsertProject(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={
      client_id:clientId,old_id:item.id,name:item.name||null,description:item.desc||null,
      budget:item.budget||null,notes:item.notes||null,is_multi_year:!!item.isMultiYear,
      budget_lines:item.budgetLines||[],proposed_budget:item.proposedBudget||[],
      adopted_budgets:item.adoptedBudgets||[],periods:item.periods||[]
    };
    await sb.from('projects').upsert(payload,{onConflict:'client_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertProject failed (blob save unaffected):',e);
  }
}
async function dwDeleteProject(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    await sb.from('projects').delete().eq('client_id',clientId).eq('old_id',item.id);
  }catch(e){
    console.warn('[clarity] dwDeleteProject failed (blob save unaffected):',e);
  }
}

// No dwDelete — vendors can't be deleted locally (only edited), so nothing to mirror.
async function dwUpsertVendor(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={
      client_id:clientId,old_id:item.id,name:item.name||null,
      default_cat:item.defaultCat||null,default_acct_code:item.defaultAcctCode||null,
      is_1099:!!item.is1099,tin:item.tin||null,email:item.email||null,phone:item.phone||null,
      address:item.address||null,notes:item.notes||null,is_member:!!item.isMember
    };
    await sb.from('vendors').upsert(payload,{onConflict:'client_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertVendor failed (blob save unaffected):',e);
  }
}

// No dwDelete — customers can't be deleted locally (only edited), so nothing to mirror.
async function dwUpsertCustomer(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={
      client_id:clientId,old_id:item.id,name:item.name||null,email:item.email||null,
      phone:item.phone||null,address:item.address||null,
      default_payment_terms:item.defaultPaymentTerms||null,notes:item.notes||null
    };
    await sb.from('customers').upsert(payload,{onConflict:'client_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertCustomer failed (blob save unaffected):',e);
  }
}

async function dwUpsertMileage(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={
      client_id:clientId,old_id:item.id,date:item.date||null,miles:item.miles||null,
      purpose:item.purpose||null,from_location:item.from||null,to_location:item.to||null,
      rate:item.rate||null,deduction:item.deduction||null,notes:item.notes||null
    };
    await sb.from('mileage').upsert(payload,{onConflict:'client_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertMileage failed (blob save unaffected):',e);
  }
}
async function dwDeleteMileage(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    await sb.from('mileage').delete().eq('client_id',clientId).eq('old_id',item.id);
  }catch(e){
    console.warn('[clarity] dwDeleteMileage failed (blob save unaffected):',e);
  }
}

// grant_id left null, same reasoning as dwUpsertProject.
async function dwUpsertProc(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={
      client_id:clientId,old_id:item.id,vendor:item.vendor||null,scope:item.scope||null,
      bid_amt:item.bidAmt||null,bid_date:item.bidDate||null,status:item.status||null,
      fund:item.fund||null,federal:!!item.federal,winner:item.winner||null,
      justification:item.justification||null,doc_ref:item.docRef||null,
      audit:Array.isArray(item.audit)?item.audit:(item.audit?[item.audit]:[])
    };
    await sb.from('procurement').upsert(payload,{onConflict:'client_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertProc failed (blob save unaffected):',e);
  }
}
async function dwDeleteProc(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    await sb.from('procurement').delete().eq('client_id',clientId).eq('old_id',item.id);
  }catch(e){
    console.warn('[clarity] dwDeleteProc failed (blob save unaffected):',e);
  }
}

async function dwUpsertRelease(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={
      client_id:clientId,old_id:item.id,fund_name:item.fundName||null,
      amount:item.amount||null,date:item.date||null,note:item.note||null
    };
    await sb.from('restriction_releases').upsert(payload,{onConflict:'client_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertRelease failed (blob save unaffected):',e);
  }
}

// No dwDelete — fiscal sponsorships can be deleted (deleteFiscalSponsor), wired separately.
async function dwUpsertFiscalSponsor(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={
      client_id:clientId,old_id:item.id,sponsor_name:item.sponsorName||null,
      project_name:item.projectName||null,agreement_date:item.agreementDate||null,
      funds_received:item.fundsReceived||null,funds_expended:item.fundsExpended||null,
      restrictions:item.restrictions||null,status:item.status||'active'
    };
    await sb.from('fiscal_sponsorships').upsert(payload,{onConflict:'client_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertFiscalSponsor failed (blob save unaffected):',e);
  }
}
async function dwDeleteFiscalSponsor(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    await sb.from('fiscal_sponsorships').delete().eq('client_id',clientId).eq('old_id',item.id);
  }catch(e){
    console.warn('[clarity] dwDeleteFiscalSponsor failed (blob save unaffected):',e);
  }
}

async function dwUpsertDocument(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={
      client_id:clientId,old_id:item.id,name:item.name||null,category:item.category||null,
      path:item.path||null,size:item.size||null,mime_type:item.mimeType||null,
      notes:item.notes||null,linked_to:item.linkedTo||null
    };
    await sb.from('documents').upsert(payload,{onConflict:'client_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertDocument failed (blob save unaffected):',e);
  }
}
async function dwDeleteDocument(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.id)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    await sb.from('documents').delete().eq('client_id',clientId).eq('old_id',item.id);
  }catch(e){
    console.warn('[clarity] dwDeleteDocument failed (blob save unaffected):',e);
  }
}

// import_rules/tax_jurisdictions have no local .id — keyed on their natural
// unique field (keyword / name) instead of old_id.
async function dwUpsertImportRule(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.keyword)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={client_id:clientId,keyword:item.keyword,cat:item.cat||null,acct_code:item.acctCode||null};
    await sb.from('import_rules').upsert(payload,{onConflict:'client_id,keyword'});
  }catch(e){
    console.warn('[clarity] dwUpsertImportRule failed (blob save unaffected):',e);
  }
}
async function dwDeleteImportRule(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.keyword)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    await sb.from('import_rules').delete().eq('client_id',clientId).eq('keyword',item.keyword);
  }catch(e){
    console.warn('[clarity] dwDeleteImportRule failed (blob save unaffected):',e);
  }
}

async function dwUpsertJurisdiction(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.name)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={client_id:clientId,name:item.name,rate:item.rate||null,freq:item.freq||null,authority:item.authority||null};
    await sb.from('tax_jurisdictions').upsert(payload,{onConflict:'client_id,name'});
  }catch(e){
    console.warn('[clarity] dwUpsertJurisdiction failed (blob save unaffected):',e);
  }
}
async function dwDeleteJurisdiction(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.name)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    await sb.from('tax_jurisdictions').delete().eq('client_id',clientId).eq('name',item.name);
  }catch(e){
    console.warn('[clarity] dwDeleteJurisdiction failed (blob save unaffected):',e);
  }
}

// budget_items has no local .id — keyed on (client_id, cat, type), the same
// identity saveBudget() itself already uses to find-or-create a line.
async function dwUpsertBudgetItem(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.cat||!item.type)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    var payload={
      client_id:clientId,cat:item.cat,type:item.type,amt:item.amt||null,
      group_name:item.group||null,overspend_policy:item.overspendPolicy||'warn',
      audit:Array.isArray(item.audit)?item.audit:(item.audit?[item.audit]:[])
    };
    await sb.from('budget_items').upsert(payload,{onConflict:'client_id,cat,type'});
  }catch(e){
    console.warn('[clarity] dwUpsertBudgetItem failed (blob save unaffected):',e);
  }
}
async function dwDeleteBudgetItem(c,item){
  var sb=sbClient();if(!sb||!_user||!c||!item||!item.cat||!item.type)return;
  try{
    var clientId=await dwResolveClientId(c);
    if(!clientId)return;
    await sb.from('budget_items').delete().eq('client_id',clientId).eq('cat',item.cat).eq('type',item.type);
  }catch(e){
    console.warn('[clarity] dwDeleteBudgetItem failed (blob save unaffected):',e);
  }
}

// donor_milestones/donor_interactions — keyed by donor_id, same
// resolve-via-dwUpsertDonor pattern as dwUpsertDonation.
async function dwUpsertMilestone(c,donor,item){
  var sb=sbClient();if(!sb||!_user||!c||!donor||!item||!item.id)return;
  try{
    var donorId=await dwUpsertDonor(c,donor);
    if(!donorId)return;
    var payload={donor_id:donorId,old_id:item.id,type:item.type||null,date:item.date||null,notes:item.notes||null};
    await sb.from('donor_milestones').upsert(payload,{onConflict:'donor_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertMilestone failed (blob save unaffected):',e);
  }
}

async function dwUpsertInteraction(c,donor,item){
  var sb=sbClient();if(!sb||!_user||!c||!donor||!item||!item.id)return;
  try{
    var donorId=await dwUpsertDonor(c,donor);
    if(!donorId)return;
    var payload={
      donor_id:donorId,old_id:item.id,type:item.type||null,date:item.date||null,
      who:item.who||null,note:item.note||null,followup_date:item.followupDate||null,
      followup_note:item.followupNote||null,completed:!!item.completed
    };
    await sb.from('donor_interactions').upsert(payload,{onConflict:'donor_id,old_id'});
  }catch(e){
    console.warn('[clarity] dwUpsertInteraction failed (blob save unaffected):',e);
  }
}
async function dwDeleteInteraction(c,donor,item){
  var sb=sbClient();if(!sb||!_user||!c||!donor||!item||!item.id)return;
  try{
    var donorId=await dwUpsertDonor(c,donor);
    if(!donorId)return;
    await sb.from('donor_interactions').delete().eq('donor_id',donorId).eq('old_id',item.id);
  }catch(e){
    console.warn('[clarity] dwDeleteInteraction failed (blob save unaffected):',e);
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
