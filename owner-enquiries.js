/* Inbox tab for the Owner app: website Enquiries + Reviews (approve, hide, pin, reply, delete).
   Reads the "enquiries" and "reviews" collections written by download.html. Loads only on tap/Refresh to save reads. */
(function(){
"use strict";
var NAV=document.querySelector('.oa-tab'),HOST=document.getElementById('oa-v-set');
if(!NAV||!HOST)return;
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
var btn=document.createElement('button');btn.type='button';btn.setAttribute('data-t','enq');
btn.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/></svg>Inbox';
NAV.insertBefore(btn,NAV.lastElementChild);
var sec=el('section','oa-view hidden');sec.id='oa-v-enq';
sec.innerHTML='<div class="oa-h2">Inbox <small>from the website</small></div><div class="oa-card"><div class="oa-row2"><button type="button" class="oa-pill" id="inb-enq">Enquiries</button><button type="button" class="oa-pill" id="inb-rev">Reviews</button><button type="button" class="oa-pill" id="inb-refresh">Refresh</button></div><div id="enq-list" style="margin-top:10px;display:grid;gap:10px">Tap Refresh.</div></div>';
HOST.parentNode.insertBefore(sec,HOST.nextSibling);
var mode='enq',L=document.getElementById('enq-list');
function setMode(m){mode=m;document.getElementById('inb-enq').style.fontWeight=m==='enq'?'800':'500';document.getElementById('inb-rev').style.fontWeight=m==='rev'?'800':'500';load()}
function show(){
 [].forEach.call(document.querySelectorAll('.oa-view'),function(v){v.classList.add('hidden')});
 [].forEach.call(NAV.querySelectorAll('button'),function(b){b.classList.remove('on')});
 sec.classList.remove('hidden');btn.classList.add('on');setMode('rev')}
btn.addEventListener('click',show);
var orig=window.ouiTab;
window.ouiTab=function(){sec.classList.add('hidden');btn.classList.remove('on');return orig&&orig.apply(this,arguments)};
document.getElementById('inb-refresh').addEventListener('click',function(){load()});
document.getElementById('inb-enq').addEventListener('click',function(){setMode('enq')});
document.getElementById('inb-rev').addEventListener('click',function(){setMode('rev')});
function db(){return ownerGetDb()}
function line(k,v){if(v==null||v==='')return null;var d=el('div');d.style.cssText='font-size:.8rem;color:#334155';d.appendChild(el('b','',k+': '));d.appendChild(document.createTextNode(v));return d}
function when(ts){try{var d=ts&&ts.toDate?ts.toDate():new Date(ts);return d.toLocaleString()}catch(e){return ''}}
function fail(w){return function(e){alert('Could not '+w+': '+(e.message||e))}}
function badge(txt,bg,fg){var s=el('span','',txt);s.style.cssText='font-size:.62rem;font-weight:800;padding:2px 8px;border-radius:99px;background:'+bg+';color:'+fg;return s}
function actions(c){var a=el('div');a.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-top:10px';c.appendChild(a);
 return function(txt,fn,href){var p=el(href?'a':'button','oa-pill',txt);if(href){p.href=href;p.target='_blank';p.rel='noopener'}else{p.type='button';p.onclick=fn}p.style.textDecoration='none';a.appendChild(p)}}
function enquiryCard(doc){
 var r=doc.data(),isNew=r.status==='new',c=el('div');c.style.cssText='border:1px solid '+(isNew?'#4f46e5':'#e5e7eb')+';border-radius:14px;padding:12px;background:#fff';
 var h=el('div');h.style.cssText='display:flex;justify-content:space-between;gap:8px;align-items:center';
 var t=el('b','',r.institute||'(no name)');t.style.fontSize='.95rem';h.appendChild(t);h.appendChild(isNew?badge('NEW','#4f46e5','#fff'):badge('Contacted','#e2e8f0','#475569'));c.appendChild(h);
 var rows=[['Name',r.ownerName||r.name],['Mobile',r.mobile],['WhatsApp',r.whatsapp],['Email',r.email],['City',[r.city,r.district,r.state,r.pin].filter(Boolean).join(', ')],['Classes',r.classes],['Students',r.students],['Message',r.message],['Received',when(r.createdAt)]];
 var g=el('div');g.style.cssText='display:grid;gap:3px;margin-top:8px';rows.forEach(function(x){var l=line(x[0],x[1]);if(l)g.appendChild(l)});c.appendChild(g);
 var pill=actions(c),m=String(r.mobile||'').replace(/\D/g,''),w=String(r.whatsapp||r.mobile||'').replace(/\D/g,'');
 if(m)pill('Call','','tel:+91'+m);
 if(w)pill('WhatsApp','','https://wa.me/91'+w);
 if(isNew)pill('Mark contacted',function(){db().collection('enquiries').doc(doc.id).update({status:'contacted'}).then(load).catch(fail('update'))});
 pill('Delete',function(){if(confirm('Delete this enquiry?'))db().collection('enquiries').doc(doc.id).delete().then(load).catch(fail('delete'))});
 return c}
function reviewCard(doc){
 var r=doc.data(),st=r.status||'pending',c=el('div');
 c.style.cssText='border:1px solid '+(st==='pending'?'#f59e0b':'#e5e7eb')+';border-radius:14px;padding:12px;background:#fff';
 var h=el('div');h.style.cssText='display:flex;justify-content:space-between;gap:8px;align-items:center';
 var t=el('b','',(r.name||'(no name)')+'  '+'★'.repeat(+r.rating||0));t.style.fontSize='.92rem';h.appendChild(t);
 var tags=el('span');tags.style.cssText='display:flex;gap:6px';
 if(r.pin)tags.appendChild(badge('PINNED','#0ea5e9','#fff'));
 tags.appendChild(st==='approved'?badge('LIVE','#16a34a','#fff'):st==='hidden'?badge('HIDDEN','#e2e8f0','#475569'):badge('PENDING','#f59e0b','#fff'));
 h.appendChild(tags);c.appendChild(h);
 var tx=el('div','','“'+(r.text||'')+'”');tx.style.cssText='margin-top:8px;font-size:.88rem;color:#1e293b;white-space:pre-wrap';c.appendChild(tx);
 var g=el('div');g.style.cssText='display:grid;gap:3px;margin-top:8px';
 [['Role',r.role],['Institute',[r.inst,r.city].filter(Boolean).join(', ')],['Date',r.date]].forEach(function(x){var l=line(x[0],x[1]);if(l)g.appendChild(l)});c.appendChild(g);
 if(r.reply){var rp=el('div');rp.style.cssText='margin-top:8px;padding:8px 10px;border-radius:10px;background:#f1f5f9;font-size:.82rem';rp.appendChild(el('b','','Your reply: '));rp.appendChild(document.createTextNode(r.reply));c.appendChild(rp)}
 var ref=db().collection('reviews').doc(doc.id),pill=actions(c);
 if(st!=='approved')pill('Approve',function(){ref.update({status:'approved',show:true}).then(load).catch(fail('approve'))});
 if(st==='approved')pill('Hide',function(){ref.update({status:'hidden',show:false,pin:false}).then(load).catch(fail('hide'))});
 if(st==='approved')pill(r.pin?'Unpin':'Pin to top',function(){ref.update({pin:!r.pin}).then(load).catch(fail('pin'))});
 pill(r.reply?'Edit reply':'Reply',function(){var x=prompt('Your reply (shown under the review on the site):',r.reply||'');if(x===null)return;x=x.trim().slice(0,400);ref.update({reply:x}).then(load).catch(fail('save reply'))});
 pill('Delete',function(){if(confirm('Delete this review permanently?'))ref.delete().then(load).catch(fail('delete'))});
 return c}
function load(){
 var col=mode==='rev'?'reviews':'enquiries',mk=mode==='rev'?reviewCard:enquiryCard;
 L.textContent='Loading...';
 db().collection(col).orderBy('createdAt','desc').limit(100).get().then(function(s){
  L.textContent='';if(s.empty){L.textContent=mode==='rev'?'No reviews yet.':'No enquiries yet.';return}
  var docs=[];s.forEach(function(d){docs.push(d)});
  if(mode==='rev'){var o={pending:0,approved:1,hidden:2};docs.sort(function(a,b){return (o[a.data().status||'pending']||0)-(o[b.data().status||'pending']||0)})}
  var p=docs.filter(function(d){return mode==='rev'?(d.data().status||'pending')==='pending':d.data().status==='new'}).length;
  if(p){var n=el('div','',p+(mode==='rev'?' review(s) waiting for approval':' new enquiry(ies)'));n.style.cssText='font-weight:800;font-size:.82rem;color:#b45309';L.appendChild(n)}
  docs.forEach(function(d){L.appendChild(mk(d))})
 }).catch(function(e){L.textContent='Could not load: '+(e.message||e)+' (publish the latest Firestore rules and make sure you are signed in as the owner)'})}
})();
