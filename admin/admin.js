import {getUser,login,logout,handleAuthCallback,acceptInvite} from '@netlify/identity';

const API = '/.netlify/functions/epk-admin';
const STAGES = [
  ['new','New application'],['under_review','Under review'],['awaiting_content','Awaiting content'],
  ['in_production','In production'],['client_approval','Client approval'],['published','Published']
];
const byId = id => document.getElementById(id);
const state = { user:null, view:'overview', page:1, stage:'all', query:'', items:[], counts:[], total:0, active:null, schema:null, board:[], inviteToken:null, loading:false };
const display = (id,show) => {byId(id).hidden = !show;};
const stageLabel = id => STAGES.find(s=>s[0]===id)?.[1] || id || 'New application';
const dateLabel = value => {
  if (!value) return '—';
  const d=new Date(value);
  return Number.isNaN(d.valueOf()) ? '—' : new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'short',year:'numeric'}).format(d);
};
const initials = value => (String(value || 'EPK').trim().split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()).join('') || 'E');
const node = (tag,css,text) => {const el=document.createElement(tag);if(css)el.className=css;if(text!==undefined)el.textContent=text;return el;};
const clear = el => el.replaceChildren();
const toast = message => {const el=byId('notice');el.textContent=message;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,4300);};
const label = (stage) => {const s=node('span','status-pill',stageLabel(stage));s.dataset.stage=stage;return s;};
const empty = (title,desc,linkText=null,linkUrl=null) => {
  const box=node('div','empty-state'); box.append(node('span','empty-icon','✧'),node('strong','',title),node('p','',desc));
  if(linkText&&linkUrl){const a=node('a','',linkText);a.href=linkUrl;box.append(a);}return box;
};
const request = async (params={},init={}) => {
  const url=new URL(API,location.origin);
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,String(v)));
  let response;
  try{response=await fetch(url,{credentials:'same-origin',cache:'no-store',...init});}
  catch{throw new Error('Unable to connect to the administrative service.');}
  const payload=await response.json().catch(()=>({}));
  if(!response.ok) throw Object.assign(new Error(payload.error||`Request failed (${response.status})`),{status:response.status});
  return payload;
};
function authError(message){display('authMessage',true);byId('authMessage').textContent=message;}
function showAuth(message){display('workspace',false);display('auth',true);display('detailLayer',false);if(message)authError(message);}
function showWorkspace(){display('auth',false);display('workspace',true);byId('accountName').textContent=state.user?.email||'Administrator';byId('authMessage').hidden=true;}
async function signIn(event){
  event.preventDefault(); const button=byId('loginButton');button.disabled=true;button.textContent='Signing in…';display('authMessage',false);
  try{await login(byId('email').value.trim(),byId('password').value);await loadSession();}
  catch(error){authError('Sign-in failed. Verify your credentials and that your administrator invitation is active.');}
  finally{button.disabled=false;button.innerHTML='Sign in <span>→</span>';}
}
async function acceptInvitation(event){
  event.preventDefault();if(!state.inviteToken)return;const password=byId('invitePassword').value;
  try{await acceptInvite(state.inviteToken,password);state.inviteToken=null;display('inviteForm',false);display('loginForm',true);byId('authTitle').textContent='Account activated';byId('authIntro').textContent='Sign in using your invitation email and new password.';toast('Invitation accepted. Sign in to continue.');}
  catch(error){authError('The invitation could not be activated. Check that the link is still valid and try again.');}
}
async function loadSession(){
  let user;
  try{user=await getUser();}catch{showAuth('Administrator login is not yet configured on Netlify. Enable Identity and invite the administrator.');return;}
  if(!user){showAuth();return;}
  state.user=user;showWorkspace();await loadList();
}
async function logOut(){
  try{await logout();}catch{}
  state.user=null;state.items=[];state.active=null;state.board=[];showAuth();toast('Signed out.');
}
function switchView(view){
  if(!['overview','applications','pipeline'].includes(view))return;
  state.view=view;const names={overview:['Overview','Your clients, production and publishing progress at a glance.'],applications:['Applications','Every client enquiry, organized and searchable.'],pipeline:['Production pipeline','From enquiry to published EPK, with each step accounted for.']};
  const [title,desc]=names[view];byId('viewTitle').textContent=title;byId('viewDescription').textContent=desc;byId('crumb').textContent=title;
  ['overview','applications','pipeline'].forEach(v=>display(v+'View',v===view));display('statsSection',view==='overview');
  document.querySelectorAll('[data-view]').forEach(btn=>{const active=btn.dataset.view===view;btn.classList.toggle('active',active);if(btn.classList.contains('nav-link'))btn.setAttribute('aria-current',active?'page':'false');});
  byId('mainAction').textContent=view==='applications'?'Refresh applications':view==='pipeline'?'View applications':'View applications';
  if(view==='pipeline')loadBoard();
  if(view==='applications')byId('searchInput').focus();
}
async function loadList(){
  if(state.loading)return;state.loading=true;display('loadingState',true);display('errorState',false);
  try{
    const result=await request({action:'list',page:state.page,stage:state.stage,q:state.query});
    state.items=result.items||[];state.counts=result.stageCounts||[];state.total=result.total||0;
    byId('navCount').textContent=String(state.counts.reduce((a,x)=>a+Number(x.count),0));
    byId('lastUpdated').textContent='Updated '+new Intl.DateTimeFormat('en-ZA',{hour:'2-digit',minute:'2-digit'}).format(new Date());
    renderStats();renderRecent();renderStages();renderTable();
  }catch(error){
    if(error.status===401){state.user=null;showAuth('Your session has expired. Please sign in again.');return;}
    if(error.status===403){state.user=null;showAuth('This account does not have the administrator role. Ask the project owner to authorize it.');return;}
    byId('errorState').textContent=error.message;
    display('errorState',true);state.items=[];state.counts=[];state.total=0;renderStats();renderRecent();renderTable();
  }finally{state.loading=false;display('loadingState',false);}
}
function renderStats(){
  const count=id=>Number(state.counts.find(x=>x.stage===id)?.count||0);
  const total=state.counts.reduce((a,c)=>a+Number(c.count||0),0);
  byId('statTotal').textContent=String(total);byId('statNew').textContent=String(count('new'));
  byId('statProgress').textContent=String(count('under_review')+count('awaiting_content')+count('in_production')+count('client_approval'));
  byId('statPublished').textContent=String(count('published'));
}
function renderRecent(){const wrap=byId('recentList');clear(wrap);
  if(!state.items.length){wrap.append(empty('No applications yet','Once a client submits the EPK onboarding form, their application will appear here.','Open onboarding form','/'));return;}
  state.items.slice(0,5).forEach(item=>{const btn=node('button','recent-item');btn.type='button';const avatar=node('span','client-avatar',initials(item.public_name));const info=node('span','recent-info');info.append(node('strong','',item.public_name),node('small','',`${item.profile_type||'EPK'} · ${dateLabel(item.submitted_at)}`));btn.append(avatar,info,label(item.stage));btn.addEventListener('click',()=>openDetail(item.id));wrap.append(btn);});
}
function renderStages(){const wrap=byId('stageSummary');clear(wrap);const total=Math.max(1,state.counts.reduce((a,x)=>a+Number(x.count),0));
  STAGES.forEach(([id,text])=>{const count=Number(state.counts.find(x=>x.stage===id)?.count||0);const item=node('div','summary-row');const header=node('div','summary-row-head');header.append(node('span','',text),node('strong','',String(count)));const track=node('div','progress-track'),fill=node('div','progress-value');fill.style.width=`${Math.round(100*count/total)}%`;track.append(fill);item.append(header,track);wrap.append(item);});
}
function renderTable(){const body=byId('applicationTable');clear(body);
  if(!state.items.length){const tr=node('tr'),td=node('td');td.colSpan=5;td.append(empty('No matching applications','Try a different search or stage, or share the onboarding form with prospective clients.'));tr.append(td);body.append(tr);}
  state.items.forEach(app=>{
    const row=node('tr'); const client=node('td'),person=node('div','table-name'),av=node('span','client-avatar',initials(app.public_name)),details=node('span');details.append(node('strong','',app.public_name),node('small','',app.contact||'Private contact unavailable'));person.append(av,details);client.append(person);const stageCell=node('td');stageCell.append(label(app.stage));const btn=node('button','open-row','→');btn.type='button';btn.setAttribute('aria-label',`Open ${app.public_name}`);btn.addEventListener('click',()=>openDetail(app.id));const last=node('td');last.append(btn);row.append(client,node('td','',app.profile_type||'—'),node('td','',dateLabel(app.submitted_at)),stageCell,last);row.addEventListener('dblclick',()=>openDetail(app.id));body.append(row);
  });
  const from=state.total===0?0:(state.page-1)*30+1,to=Math.min(state.page*30,state.total);
  byId('pageLabel').textContent=`${from}–${to} of ${state.total} applications`;
  byId('prevPage').disabled=state.page<=1;byId('nextPage').disabled=state.page*30>=state.total;
  byId('listCaption').textContent=`${state.total} matching applications`;
}
async function loadBoard(){const wrap=byId('pipelineGrid');clear(wrap);wrap.append(node('div','loading-message','Loading production stages…'));
  try{const data=await request({action:'board'});state.board=data.items||[];renderBoard();}
  catch(error){clear(wrap);wrap.append(node('div','alert',error.message));}
}
function renderBoard(){const wrap=byId('pipelineGrid');clear(wrap);
  STAGES.forEach(([id,title])=>{const col=node('section','pipeline-col');const head=node('div','pipeline-head');const count=Number(state.counts.find(x=>x.stage===id)?.count||0);head.append(node('h2','',title),node('span','',String(count)));col.append(head);
    const matches=state.board.filter(x=>x.stage===id);if(!matches.length)col.append(node('p','pipeline-empty','No applications here'));
    matches.forEach(x=>{const card=node('button','pipeline-card');card.type='button';card.append(node('strong','',x.public_name),node('small','',`${x.profile_type||'EPK'} · ${dateLabel(x.submitted_at)}`));card.addEventListener('click',()=>openDetail(x.id));col.append(card);});
    if(count>matches.length)col.append(node('p','pipeline-empty',`Showing newest ${matches.length} of ${count}`));wrap.append(col);
  });
}
function validUrl(value){try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:null;}catch{return null;}}
function renderAnswers(answers){const wrap=byId('answers');clear(wrap);const fields=state.schema?.fields||[];const steps=state.schema?.steps||[];
  for(const step of steps){const records=fields.filter(f=>f.step===step.id&&String(answers?.[f.name]??'').trim());if(!records.length)continue;const group=node('div','answer-group');group.append(node('h4','',step.title));
    for(const field of records){const dl=node('dl','answer-row'),dt=node('dt','',field.label+(field.private?' · Private':'')),dd=node('dd');const value=String(answers[field.name]);
      const external=validUrl(value.trim());if(external&&value.length<800){const link=node('a','',value);link.href=external;link.rel='noopener noreferrer';link.target='_blank';dd.append(link);}else dd.textContent=value;
      dl.append(dt,dd);group.append(dl);
    }wrap.append(group);
  }
  const misc=Object.entries(answers||{}).filter(([key,val])=>key.startsWith('media_')&&typeof val==='string'&&val.startsWith('http'));
  if(misc.length){const group=node('div','answer-group');group.append(node('h4','','Uploaded media'));misc.forEach(([key,val])=>{const safe=validUrl(val);if(!safe)return;const link=node('a','',key.replaceAll('_',' '));link.href=safe;link.rel='noopener noreferrer';link.target='_blank';group.append(link,node('span','',' · '));});wrap.append(group);}
  if(!wrap.childElementCount)wrap.append(node('p','muted','No submitted answers are available for this application.'));
}
function renderActivity(events){const wrap=byId('activity');clear(wrap);if(!events?.length){wrap.append(node('p','muted','No activity recorded yet.'));return;}
  events.forEach(a=>{const item=node('div','activity-item');item.append(node('strong','',a.summary||'Application updated'),node('small','',`${dateLabel(a.created_at)} · Administrator`));wrap.append(item);});
}
function renderQuickActions(contact){const wrap=byId('quickActions');clear(wrap);if(!contact)return;
  const email=contact.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)?.[0];
  const phone=contact.match(/\+?[0-9][0-9\s()-]{7,17}[0-9]/)?.[0];
  if(email){const a=node('a','','✉ Email client');a.href='mailto:'+email;wrap.append(a);}
  if(phone){const digits=phone.replace(/\D/g,'');const wa=digits.startsWith('0')?'27'+digits.slice(1):digits;
    if(/^\d{10,15}$/.test(wa)){const a=node('a','','◉ WhatsApp');a.href='https://wa.me/'+wa;a.rel='noopener noreferrer';a.target='_blank';wrap.append(a);}}
  const copy=node('a','','⧉ Copy contact');copy.href='#';copy.addEventListener('click',async event=>{event.preventDefault();try{await navigator.clipboard.writeText(contact);toast('Contact copied to clipboard.');}catch{toast('Clipboard permission unavailable.');}});wrap.append(copy);
}
async function openDetail(id){const layer=byId('detailLayer');state.active=null;display('detailLayer',true);byId('detailTitle').textContent='Loading application…';byId('saveDetails').disabled=true;byId('saveHint').textContent='';document.body.style.overflow='hidden';
  try{const payload=await request({action:'detail',id});state.active=payload.application;const app=state.active;
    byId('detailTitle').textContent='Client details';byId('detailStage').textContent=stageLabel(app.stage);byId('clientName').textContent=app.public_name;byId('clientAvatar').textContent=initials(app.public_name);byId('clientInfo').textContent=`${app.profile_type||'EPK'} · Submitted ${dateLabel(app.submitted_at)}`;
    byId('editStage').value=app.stage;byId('editNotes').value=app.internal_notes||'';byId('editApproval').checked=Boolean(app.approval_verified);byId('editEvidence').value=app.approval_evidence||'';
    renderQuickActions(app.contact);renderAnswers(app.answers);renderActivity(payload.activity);byId('saveDetails').disabled=false;
  }catch(error){toast(error.message);closeDetail();}layer.querySelector('.detail-panel')?.focus();
}
function closeDetail(){display('detailLayer',false);document.body.style.overflow='';state.active=null;}
async function saveDetail(){const app=state.active;if(!app)return;const button=byId('saveDetails');button.disabled=true;byId('saveHint').textContent='Saving…';
  const payload={action:'update',id:app.id,stage:byId('editStage').value,notes:byId('editNotes').value,approvalVerified:byId('editApproval').checked,approvalEvidence:byId('editEvidence').value};
  try{await request({},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});byId('saveHint').textContent='Saved';toast('Application updated.');closeDetail();await loadList();if(state.view==='pipeline')await loadBoard();}
  catch(error){byId('saveHint').textContent=error.message;toast(error.message);}finally{button.disabled=false;}
}
async function init(){
  byId('loginForm').addEventListener('submit',signIn);byId('inviteForm').addEventListener('submit',acceptInvitation);
  byId('signOut').addEventListener('click',logOut);byId('mobileSignOut').addEventListener('click',logOut);
  document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));
  document.querySelectorAll('[data-switch]').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.switch)));
  byId('mainAction').addEventListener('click',()=>{if(state.view==='applications')loadList();else switchView('applications');});
  byId('refreshButton').addEventListener('click',async()=>{await loadList();if(state.view==='pipeline')await loadBoard();toast('Applications refreshed.');});
  let debounce;byId('searchInput').addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(()=>{state.query=byId('searchInput').value;state.page=1;loadList();},300);});
  byId('stageFilter').addEventListener('change',()=>{state.stage=byId('stageFilter').value;state.page=1;loadList();});
  byId('prevPage').addEventListener('click',()=>{if(state.page>1){state.page--;loadList();}});
  byId('nextPage').addEventListener('click',()=>{if(state.page*30<state.total){state.page++;loadList();}});
  byId('closeDetail').addEventListener('click',closeDetail);byId('detailBackdrop').addEventListener('click',closeDetail);byId('saveDetails').addEventListener('click',saveDetail);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!byId('detailLayer').hidden)closeDetail();});
  state.schema=await fetch('/admin/schema.json').then(r=>r.ok?r.json():null).catch(()=>null);
  try{const result=await handleAuthCallback();if(result?.type==='invite'&&result.token){state.inviteToken=result.token;display('loginForm',false);display('inviteForm',true);byId('authTitle').textContent='Activate your account';byId('authIntro').textContent='Choose a password to accept your invitation.';return;}}
  catch{ /* Login still available even when callback processing fails. */ }
  await loadSession();
}
init();