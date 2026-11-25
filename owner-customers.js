/* Owner app: "Customers" tab — customer list, add/edit with GPS location, details, navigate, visit history.
   Data: Firestore collection "ownerCustomers" (Owner only, see firestore.rules).
   Map: Leaflet + OpenStreetMap (cdnjs), route/time: OSRM demo server, address: Nominatim. No API keys. */
(function(){
"use strict";
var NAV=document.querySelector('.oa-tab'),HOST=document.getElementById('oa-v-set');
if(!NAV||!HOST)return;
var COL='ownerCustomers',PERM_KEY='occ_perm_v1',POS_KEY='occ_lastpos';
var STATUS=[['new','New'],['interested','Interested'],['followup','Follow-up'],['converted','Converted']];
var SLABEL={};STATUS.forEach(function(s){SLABEL[s[0]]=s[1]});
var P={
 back:'<path d="M15 18l-6-6 6-6"/>',users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',search:'<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',
 pin:'<path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
 gps:'<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
 cam:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',img:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
 tel:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
 chat:'<path d="M4 20l1.5-4A8 8 0 1 1 12 20a8 8 0 0 1-3.5-.8z"/>',nav:'<path d="M3 11l18-8-8 18-2-8z"/>',
 ok:'<path d="M5 12l5 5 9-10"/>',edit:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
 trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
 shield:'<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
 car:'<path d="M5 16v-5l2-5h10l2 5v5M3 16h18M7 19v-3M17 19v-3"/>',refresh:'<path d="M20 12a8 8 0 1 1-3-6.3M20 4v5h-5"/>',
 clk:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',x:'<path d="M18 6L6 18M6 6l12 12"/>'
};
function ic(n,s){return '<svg width="'+(s||20)+'" height="'+(s||20)+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+P[n]+'</svg>'}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function $(id){return document.getElementById(id)}
function db(){return ownerGetDb()}
function today(){var d=new Date();return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)}
function fd(s){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||'');return m?m[3]+'-'+m[2]+'-'+m[1]:(s||'')}
function ini(n){var p=String(n||'?').trim().split(/\s+/);return ((p[0]||'?')[0]+(p[1]?p[1][0]:'')).toUpperCase()}
function km(a,b){var R=6371,r=Math.PI/180,dl=(b.lat-a.lat)*r,dn=(b.lng-a.lng)*r,x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)*Math.sin(dn/2);return 2*R*Math.asin(Math.sqrt(x))}
function fkm(v){return v<1?Math.round(v*1000)+' m':(v<10?v.toFixed(1):Math.round(v))+' km'}
function hasLoc(c){return typeof c.lat==='number'&&typeof c.lng==='number'}

/* ---------- styles ---------- */
var css=document.createElement('style');
css.textContent='.occ-c{background:#fff;border-radius:16px;margin:0 16px 8px;padding:11px 12px;display:flex;gap:11px;align-items:center;box-shadow:0 1px 3px rgba(15,23,42,.06);border:0;width:calc(100% - 32px);text-align:left;font:inherit;color:inherit}'+
'.occ-av{width:44px;height:44px;border-radius:50%;background:#e0e7ff;color:#4338ca;display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0;font-size:.9rem}'+
'.occ-c b{font-size:.9rem;display:block}.occ-c small{display:block;color:#64748b;font-size:.72rem;line-height:1.35}.occ-c .occ-m{min-width:0;flex:1}.occ-c .occ-m small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
'.occ-st{font-size:.64rem;font-weight:800;padding:3px 10px;border-radius:99px;flex-shrink:0;align-self:flex-start}.occ-s-new{background:#dcfce7;color:#15803d}.occ-s-interested{background:#fef3c7;color:#a16207}.occ-s-followup{background:#ede9fe;color:#6d28d9}.occ-s-converted{background:#ccfbf1;color:#0f766e}'+
'.occ-bar{margin:0 16px 12px;background:#fff;border-radius:12px;padding:10px 12px;display:flex;gap:8px;align-items:center;color:#94a3b8}.occ-bar input{border:0;outline:0;flex:1;font-size:.85rem;background:none;min-width:0}'+
'.occ-warn{margin:0 16px 10px;background:#fffbeb;border:1px solid #fcd34d;color:#92400e;border-radius:12px;padding:9px 12px;font-size:.76rem;font-weight:700}'+
'.occ-page{position:fixed;inset:0;z-index:210;background:#f4f6fb;overflow:auto;-webkit-overflow-scrolling:touch;max-width:480px;margin:0 auto;font-family:inherit;color:#0f172a}'+
'.occ-hd{position:sticky;top:0;z-index:2;background:linear-gradient(135deg,#1e1b4b,#312e81);color:#fff;padding:calc(12px + env(safe-area-inset-top,0px)) 14px 12px;display:flex;align-items:center;gap:12px}'+
'.occ-hd b{font-size:1rem;font-weight:800;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.occ-hd button{background:none;border:0;color:#fff;padding:4px;display:flex}'+
'.occ-bd{padding:14px 14px calc(30px + env(safe-area-inset-bottom,0px))}'+
'.occ-sec{display:flex;align-items:center;gap:8px;margin:16px 0 8px;font-size:.74rem;font-weight:800;color:#1e1b4b;text-transform:uppercase;letter-spacing:.05em}.occ-sec:after{content:"";flex:1;height:1.5px;background:#e0e7ff}'+
'.occ-f label{display:block;font-size:.7rem;font-weight:700;color:#1e1b4b;margin:10px 0 4px}.occ-f input,.occ-f textarea{width:100%;padding:12px;border:1.5px solid #e0e7ff;border-radius:12px;font-size:.9rem;background:#fff;outline:none;font-family:inherit}.occ-f input:focus,.occ-f textarea:focus{border-color:#4f46e5}'+
'.occ-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}'+
'.occ-btn{width:100%;padding:13px;border:0;border-radius:14px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-weight:800;font-size:.9rem;display:flex;gap:7px;align-items:center;justify-content:center}.occ-btn.l{background:#fff;color:#1e1b4b;border:1.5px solid #e0e7ff}.occ-btn.r{background:#fee2e2;color:#b91c1c}.occ-btn[disabled]{opacity:.6}'+
'.occ-row{border:1.5px solid #e0e7ff;background:#fff;border-radius:14px;padding:11px 12px;display:flex;align-items:center;gap:10px;font-size:.84rem;font-weight:700;color:#1e1b4b;width:100%;text-align:left;font-family:inherit}.occ-row small{display:block;font-weight:500;color:#64748b;font-size:.72rem}.occ-row svg{color:#4f46e5;flex-shrink:0}'+
'.occ-map{height:190px;border-radius:14px;overflow:hidden;border:1.5px solid #e0e7ff;margin-top:8px;background:#e6ecfb;position:relative;z-index:0}'+
'.occ-acc{font-size:.72rem;font-weight:700;margin:7px 2px 0;color:#64748b}.occ-acc.ok{color:#15803d}.occ-acc.bad{color:#b91c1c}'+
'.occ-chips{display:flex;gap:6px;flex-wrap:wrap}.occ-chip{border:1.5px solid #e0e7ff;background:#fff;border-radius:99px;padding:7px 13px;font-size:.76rem;font-weight:700;color:#475569}.occ-chip.on{background:#4f46e5;border-color:#4f46e5;color:#fff}'+
'.occ-cons{display:flex;align-items:center;gap:10px;background:#eef2ff;border-radius:12px;padding:10px 12px;font-size:.78rem;margin:14px 0}.occ-cons input{width:20px;height:20px;accent-color:#4f46e5;flex-shrink:0}'+
'.occ-acts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.occ-acts a,.occ-acts button{background:#fff;border:1.5px solid #e0e7ff;border-radius:14px;padding:11px 4px;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:.76rem;font-weight:800;color:#1e1b4b;text-decoration:none;font-family:inherit}.occ-acts svg{color:#4f46e5}'+
'.occ-vh{background:#fff;border-radius:12px;padding:10px 12px;display:flex;gap:10px;align-items:center;margin-bottom:8px;font-size:.82rem}.occ-vh i{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#dcfce7;color:#16a34a;flex-shrink:0}.occ-vh i.c{background:#e0e7ff;color:#4f46e5}.occ-vh small{display:block;color:#64748b;font-size:.72rem}'+
'.occ-pin{background:none;border:0}.occ-me{width:16px;height:16px;border-radius:50%;background:#4f46e5;border:3px solid #fff;box-shadow:0 0 0 2px #4f46e5}'+
'.occ-card-img{max-width:100%;border-radius:12px;border:1px solid #e0e7ff;margin-top:8px;display:block}'+
'.occ-perm{text-align:center}.occ-perm .ring{width:58px;height:58px;border-radius:50%;background:#e0e7ff;color:#4f46e5;display:flex;align-items:center;justify-content:center;margin:0 auto 10px}.occ-perm p{font-size:.78rem;color:#64748b;margin:4px 0 12px}.occ-perm .occ-row{margin-bottom:8px}';
document.head.appendChild(css);

/* ---------- tab ---------- */
var btn=el('button');btn.type='button';btn.setAttribute('data-t','cust');
btn.innerHTML=ic('users',22)+'Customers';
NAV.insertBefore(btn,NAV.querySelector('[data-t="alerts"]')||NAV.lastElementChild);
var sec=el('section','oa-view hidden');sec.id='oa-v-cust';
sec.innerHTML='<div class="oa-h2">Customers <small id="occ-count"></small></div><div id="occ-due"></div><label class="occ-bar">'+ic('search',16)+'<input id="occ-q" type="text" placeholder="Naam, institute ya location se khojein" autocomplete="off"></label><div class="oa-fc" id="occ-fc"></div><div id="occ-list"></div><div style="margin:6px 16px 90px"><button type="button" class="occ-btn" id="occ-add">'+ic('plus',18)+'Naya Customer</button></div>';
HOST.parentNode.insertBefore(sec,HOST.nextSibling);
var all=[],filter='all',query='',here=null;
function show(){
 [].forEach.call(document.querySelectorAll('.oa-view'),function(v){v.classList.add('hidden')});
 [].forEach.call(NAV.querySelectorAll('button'),function(b){b.classList.remove('on')});
 sec.classList.remove('hidden');btn.classList.add('on');var f=$('oa-fab');if(f)f.classList.add('hidden');
 window.scrollTo(0,0);load();askPermOnce()}
btn.addEventListener('click',show);
var orig=window.ouiTab;
window.ouiTab=function(){sec.classList.add('hidden');btn.classList.remove('on');return orig&&orig.apply(this,arguments)};
$('occ-add').addEventListener('click',function(){openForm(null)});
$('occ-q').addEventListener('input',function(){query=this.value.trim().toLowerCase();renderList()});

/* ---------- data ---------- */
function load(){
 var L=$('occ-list');if(!all.length)L.textContent='Loading...';
 db().collection(COL).orderBy('createdAt','desc').limit(500).get().then(function(s){
  all=[];s.forEach(function(d){all.push(Object.assign({id:d.id},d.data()))});renderList();updateHere()
 }).catch(function(e){L.textContent='Load nahi hua: '+(e.message||e)+' (latest Firestore rules publish karein aur Owner se login rakhein)'})}
function byId(id){for(var i=0;i<all.length;i++)if(all[i].id===id)return all[i]}
function isDue(c){return c.followUp&&c.followUp<=today()&&c.status!=='converted'}
function updateHere(){
 if(!navigator.geolocation)return;
 navigator.geolocation.getCurrentPosition(function(p){here={lat:p.coords.latitude,lng:p.coords.longitude};renderList()},function(){},{enableHighAccuracy:false,maximumAge:120000,timeout:8000})}

/* ---------- list ---------- */
function renderList(){
 var counts={all:all.length,due:0};STATUS.forEach(function(s){counts[s[0]]=0});
 all.forEach(function(c){if(counts[c.status]!=null)counts[c.status]++;if(isDue(c))counts.due++});
 $('occ-count').textContent='('+all.length+')';
 var dw=$('occ-due');dw.textContent='';
 if(counts.due){var w=el('div','occ-warn',counts.due+' customer ka follow-up aaj ya pehle ka baaki hai');w.onclick=function(){filter='due';renderList()};dw.appendChild(w)}
 var fc=$('occ-fc');fc.textContent='';
 var chips=[['all','All']].concat(STATUS);if(counts.due)chips.push(['due','Due']);if(here)chips.push(['near','Paas wale']);
 chips.forEach(function(x){var b=el('button','',x[1]+(x[0]==='near'?'':' ('+counts[x[0]]+')'));b.type='button';if(filter===x[0])b.className='on';b.onclick=function(){filter=x[0];renderList()};fc.appendChild(b)});
 var rows=all.filter(function(c){
  if(filter==='due'&&!isDue(c))return false;
  if(STATUS.some(function(s){return s[0]===filter})&&c.status!==filter)return false;
  if(!query)return true;
  return [c.name,c.institute,c.mobile,c.address].join(' ').toLowerCase().indexOf(query)>-1});
 rows.forEach(function(c){c._d=here&&hasLoc(c)?km(here,c):null});
 if(filter==='near')rows=rows.filter(function(c){return c._d!=null}).sort(function(a,b){return a._d-b._d});
 var L=$('occ-list');L.textContent='';
 if(!rows.length){var e=el('div','empty-state',all.length?'Koi customer nahi mila.':'Abhi koi customer nahi. Pehla customer jodein.');e.style.cssText='text-align:center;color:#64748b;padding:24px;font-size:.85rem';L.appendChild(e);return}
 rows.forEach(function(c){
  var b=el('button','occ-c');b.type='button';
  b.appendChild(el('div','occ-av',ini(c.name)));
  var m=el('div','occ-m');m.appendChild(el('b','',c.name||'(no name)'));m.appendChild(el('small','',c.institute||''));
  var loc=[c.address?c.address.split(',').slice(0,2).join(','):'',c._d!=null?fkm(c._d)+' door':''].filter(Boolean).join('  ·  ');
  m.appendChild(el('small','',hasLoc(c)?(loc||'Location saved'):'Location save nahi hai'));b.appendChild(m);
  b.appendChild(el('span','occ-st occ-s-'+(c.status||'new'),SLABEL[c.status]||'New'));
  b.onclick=function(){openDetail(c.id)};L.appendChild(b)})}

/* ---------- helpers: overlay page, sheets ---------- */
function page(title,right){
 var r=el('div','occ-page');r.setAttribute('role','dialog');
 var h=el('div','occ-hd');var back=el('button');back.type='button';back.setAttribute('aria-label','Back');back.innerHTML=ic('back',22);
 h.appendChild(back);h.appendChild(el('b','',title));if(right)right.forEach(function(x){h.appendChild(x)});
 var bd=el('div','occ-bd');r.appendChild(h);r.appendChild(bd);document.body.appendChild(r);
 var api={root:r,body:bd,head:h,onclose:null,close:function(){if(api.onclose)api.onclose();r.remove()}};back.onclick=api.close;return api}
function sheet(html){
 var s=el('div','oa-sheet');s.style.zIndex=300;var b=el('div','oa-sheet-box');b.innerHTML='<div class="oa-grab"></div>'+html;s.appendChild(b);document.body.appendChild(s);
 s.addEventListener('click',function(e){if(e.target===s)s.remove()});return {root:s,box:b,close:function(){s.remove()}}}
function iconBtn(n,label,fn){var b=el('button');b.type='button';b.setAttribute('aria-label',label);b.innerHTML=ic(n,20);b.onclick=fn;return b}

/* ---------- permissions (one time) ---------- */
function askPermOnce(){
 var seen='';try{seen=localStorage.getItem(PERM_KEY)}catch(e){}
 if(seen)return;
 var s=sheet('<div class="occ-perm"><div class="ring">'+ic('shield',28)+'</div><h3>Customer system ke liye access</h3><p>Sirf Owner ko, ek baar. Baad mein phone Settings se badal sakte hain.</p>'+
 '<div class="occ-row">'+ic('pin')+'<span>Location (GPS)<small>Customer ki exact jagah save karne aur navigate karne ke liye</small></span></div>'+
 '<div class="occ-row">'+ic('cam')+'<span>Camera aur Photos<small>Visiting card ki photo ke liye (jab card jodein tab poochega)</small></span></div>'+
 '<div class="occ-row">'+ic('tel')+'<span>Call aur WhatsApp<small>Alag permission nahi lagti, seedha phone / WhatsApp khulta hai</small></span></div>'+
 '<button type="button" class="occ-btn" id="occ-pa">Access Allow Karein</button><button type="button" class="oa-link" id="occ-pl" style="margin-top:6px">Baad mein</button></div>');
 function done(){try{localStorage.setItem(PERM_KEY,'1')}catch(e){}s.close()}
 s.box.querySelector('#occ-pa').onclick=function(){
  if(!navigator.geolocation){done();return}
  navigator.geolocation.getCurrentPosition(function(){done();updateHere()},function(){done()},{enableHighAccuracy:true,timeout:15000})};
 s.box.querySelector('#occ-pl').onclick=done}

/* ---------- location + maps ---------- */
function grabLoc(done,prog){
 if(!navigator.geolocation){done(null,'Is device par location available nahi hai.');return}
 var best=null,fin=false,wid=null,tm=null;
 function end(){if(fin)return;fin=true;clearTimeout(tm);navigator.geolocation.clearWatch(wid);best?done(best):done(null,'Location nahi mili. GPS on karke dobara try karein.')}
 tm=setTimeout(end,12000);
 wid=navigator.geolocation.watchPosition(function(p){var c=p.coords;if(!best||c.accuracy<best.accuracy)best={lat:c.latitude,lng:c.longitude,accuracy:Math.round(c.accuracy)};if(prog)prog(best);if(c.accuracy<=20)end()},
  function(e){if(fin)return;fin=true;clearTimeout(tm);navigator.geolocation.clearWatch(wid);
   done(null,e&&e.code===1?'Location permission band hai. Phone Settings > Apps > is app > Permissions > Location allow karein.':'Location nahi mili. GPS on karke dobara try karein.')},
  {enableHighAccuracy:true,maximumAge:0,timeout:15000})}
function rev(lat,lng,cb){
 fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&accept-language=hi,en&lat='+lat+'&lon='+lng).then(function(r){return r.json()}).then(function(j){cb(j&&j.display_name||'')}).catch(function(){cb('')})}
var Lq=null;
function leaf(cb){
 if(window.L&&window.L.map){cb();return}
 if(Lq){Lq.push(cb);return}Lq=[cb];
 var l=document.createElement('link');l.rel='stylesheet';l.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';document.head.appendChild(l);
 var s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
 s.onload=function(){var a=Lq;Lq=null;a.forEach(function(f){f()})};s.onerror=function(){var a=Lq;Lq=null;a.forEach(function(f){f(true)})};document.head.appendChild(s)}
function pinIcon(){return L.divIcon({className:'occ-pin',iconSize:[32,32],iconAnchor:[16,32],html:'<svg width="32" height="32" viewBox="0 0 24 24" fill="#ef4444" stroke="#fff" stroke-width="1.5"><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.6" fill="#fff" stroke="none"/></svg>'})}
function mkMap(node,lat,lng,zoom,onMove){
 var o={map:null,marker:null,set:function(a,b,z){if(!o.map)return;var ll=[a,b];if(!o.marker){o.marker=L.marker(ll,{icon:pinIcon(),draggable:!!onMove}).addTo(o.map);
   if(onMove)o.marker.on('dragend',function(){var p=o.marker.getLatLng();onMove(p.lat,p.lng)})}else o.marker.setLatLng(ll);o.map.setView(ll,z||17)}};
 leaf(function(err){
  if(err){node.textContent='Map load nahi hua (internet check karein).';node.style.cssText+='display:flex;align-items:center;justify-content:center;font-size:.76rem;color:#64748b;padding:10px;text-align:center';return}
  o.map=L.map(node,{zoomControl:true,attributionControl:true}).setView([lat==null?25.6:lat,lng==null?85.1:lng],lat==null?6:zoom||17);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(o.map);
  if(lat!=null)o.set(lat,lng,zoom);
  if(onMove)o.map.on('click',function(e){o.set(e.latlng.lat,e.latlng.lng,o.map.getZoom());onMove(e.latlng.lat,e.latlng.lng)});
  setTimeout(function(){o.map.invalidateSize()},250);
  if(o.ready)o.ready(o)});
 return o}

/* ---------- add / edit form ---------- */
function shrink(file,cb){
 var r=new FileReader();r.onload=function(){var im=new Image();im.onload=function(){var m=760,k=Math.min(1,m/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);cb(c.toDataURL('image/jpeg',.6))};im.onerror=function(){cb('')};im.src=r.result};r.onerror=function(){cb('')};r.readAsDataURL(file)}
function openForm(c){
 var edit=!!c,f=edit?Object.assign({},c):{status:'new',followUp:'',notes:'',address:'',card:''};
 var pg=page(edit?'Customer Edit Karein':'Naya Customer');var b=pg.body;
 b.innerHTML='<div class="occ-row" id="occ-scan" style="border-style:dashed;background:#eef2ff"><span>'+ic('cam',26)+'</span><span style="flex:1">Visiting Card Ki Photo (Optional)<small id="occ-cardst">Camera se khinchein ya gallery se chunein</small></span></div>'+
 '<div style="display:flex;gap:8px;margin-top:8px"><button type="button" class="occ-btn l" id="occ-cam">'+ic('cam',16)+'Camera</button><button type="button" class="occ-btn l" id="occ-gal">'+ic('img',16)+'Gallery</button></div>'+
 '<input type="file" id="occ-fc1" accept="image/*" capture="environment" hidden><input type="file" id="occ-fc2" accept="image/*" hidden><img id="occ-cardimg" class="occ-card-img" alt="Visiting card" hidden>'+
 '<div class="occ-sec">Customer Details</div><div class="occ-f"><label for="occ-n">Poora Naam *</label><input id="occ-n" type="text" autocomplete="off" maxlength="80"><label for="occ-i">Institute / Coaching Naam *</label><input id="occ-i" type="text" autocomplete="off" maxlength="120"><label for="occ-m">Mobile Number *</label><input id="occ-m" type="tel" inputmode="numeric" maxlength="10" placeholder="10 digit mobile"></div>'+
 '<div class="occ-sec">Location</div><button type="button" class="occ-row" id="occ-loc">'+ic('gps',22)+'<span id="occ-loct" style="flex:1">Meri Current Location Lein<small>Ek click mein GPS se exact location</small></span></button>'+
 '<div class="occ-map" id="occ-map"></div><div class="occ-acc" id="occ-acc">Pin ko kheench kar ya map par tap karke location theek kar sakte hain.</div><div class="occ-f"><label for="occ-a">Pata / Area</label><input id="occ-a" type="text" maxlength="300" placeholder="Location se apne aap bhar jata hai"></div>'+
 '<div class="occ-sec">Status</div><div class="occ-chips" id="occ-sts"></div>'+
 '<div class="occ-two occ-f"><div><label for="occ-d">Follow-up Date</label><input id="occ-d" type="date"></div><div><label for="occ-no">Notes (Optional)</label><input id="occ-no" type="text" maxlength="300" placeholder="Kuch likhein"></div></div>'+
 '<label class="occ-cons"><input type="checkbox" id="occ-cons"><span>Main is customer ka data save karne se sahmat hoon</span></label>'+
 '<div style="display:grid;grid-template-columns:1fr 2fr;gap:10px"><button type="button" class="occ-btn l" id="occ-rs">'+ic('refresh',16)+'Reset</button><button type="button" class="occ-btn" id="occ-sv">Customer Save Karein</button></div><div id="occ-err" class="occ-acc bad"></div>';
 function g(id){return b.querySelector('#'+id)}
 g('occ-n').value=f.name||'';g('occ-i').value=f.institute||'';g('occ-m').value=f.mobile||'';g('occ-a').value=f.address||'';g('occ-d').value=f.followUp||'';g('occ-no').value=f.notes||'';g('occ-cons').checked=edit;
 var addrEdited=!!f.address;g('occ-a').addEventListener('input',function(){addrEdited=true});
 function drawSt(){var w=g('occ-sts');w.textContent='';STATUS.forEach(function(s){var x=el('button','occ-chip'+(f.status===s[0]?' on':''),s[1]);x.type='button';x.onclick=function(){f.status=s[0];drawSt()};w.appendChild(x)})}drawSt();
 function showCard(){var im=g('occ-cardimg');if(f.card){im.src=f.card;im.hidden=false;g('occ-cardst').textContent='Card ki photo lag gayi'}else{im.hidden=true}}showCard();
 function pick(inp){inp.onchange=function(){var fl=inp.files&&inp.files[0];inp.value='';if(!fl)return;g('occ-cardst').textContent='Photo chhoti ho rahi hai...';shrink(fl,function(d){if(d)f.card=d;showCard()})}}
 var i1=g('occ-fc1'),i2=g('occ-fc2');pick(i1);pick(i2);g('occ-cam').onclick=function(){i1.click()};g('occ-gal').onclick=function(){i2.click()};g('occ-scan').onclick=function(){i1.click()};
 var mp=mkMap(g('occ-map'),hasLoc(f)?f.lat:null,hasLoc(f)?f.lng:null,17,function(a,bb){f.lat=a;f.lng=bb;f.accuracy=0;acc('Pin haath se set kiya gaya.','ok');fillAddr(a,bb)});
 function acc(t,k){var e=g('occ-acc');e.textContent=t;e.className='occ-acc'+(k?' '+k:'')}
 function fillAddr(a,bb){rev(a,bb,function(t){if(t&&!addrEdited)g('occ-a').value=t})}
 if(hasLoc(f))acc(f.accuracy?'Location saved, accuracy '+f.accuracy+' m':'Location saved','ok');
 function getLoc(){
  var lb=g('occ-loc');lb.disabled=true;acc('Location le rahe hain... bahar / khule mein khade hon','');
  grabLoc(function(p,msg){lb.disabled=false;if(!p){acc(msg,'bad');return}
   f.lat=p.lat;f.lng=p.lng;f.accuracy=p.accuracy;acc('Location verified, accuracy '+p.accuracy+' m'+(p.accuracy>50?' (kam sahi — khule mein dobara lein ya pin theek karein)':''),p.accuracy>50?'':'ok');
   if(mp.map)mp.set(p.lat,p.lng,17);else mp.ready=function(){mp.set(p.lat,p.lng,17)};fillAddr(p.lat,p.lng)},
   function(p){acc('Location le rahe hain... accuracy '+p.accuracy+' m','')})}
 g('occ-loc').onclick=getLoc;
 if(!edit)setTimeout(function(){var seen='';try{seen=localStorage.getItem(PERM_KEY)}catch(e){}if(seen)getLoc()},400); /* prefetch */
 g('occ-rs').onclick=function(){if(edit)return;f={status:'new',followUp:'',notes:'',address:'',card:''};['occ-n','occ-i','occ-m','occ-a','occ-d','occ-no'].forEach(function(k){g(k).value=''});g('occ-cons').checked=false;addrEdited=false;drawSt();showCard();acc('Pin ko kheench kar ya map par tap karke location theek kar sakte hain.','');if(mp.marker){mp.marker.remove();mp.marker=null}};
 g('occ-sv').onclick=function(){
  var er=g('occ-err'),n=g('occ-n').value.trim(),ins=g('occ-i').value.trim(),m=g('occ-m').value.replace(/\D/g,'');er.textContent='';
  if(!n)return er.textContent='Naam likhein.';if(!ins)return er.textContent='Institute ka naam likhein.';
  if(!/^[6-9]\d{9}$/.test(m))return er.textContent='10 digit ka sahi mobile number likhein.';
  if(!hasLoc(f))return er.textContent='Location lein ya map par pin lagayein.';
  if(!g('occ-cons').checked)return er.textContent='Data save karne ki sahmati tick karein.';
  var dup=all.filter(function(x){return x.mobile===m&&(!edit||x.id!==c.id)})[0];
  if(dup&&!confirm('Ye mobile "'+(dup.name||'')+'" ke naam se pehle se saved hai. Phir bhi save karein?'))return;
  var data={name:n,institute:ins,mobile:m,lat:f.lat,lng:f.lng,accuracy:f.accuracy||0,address:g('occ-a').value.trim(),status:f.status,followUp:g('occ-d').value||'',notes:g('occ-no').value.trim(),card:f.card||'',consent:true,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
  var sv=g('occ-sv');sv.disabled=true;sv.textContent='Save ho raha hai...';
  var ref=db().collection(COL),p;
  if(edit)p=ref.doc(c.id).update(data);
  else{data.createdAt=firebase.firestore.FieldValue.serverTimestamp();data.visits=[{type:'visit',date:today(),note:'Pehli visit, location save ki',at:Date.now()}];p=ref.add(data)}
  p.then(function(r){var id=edit?c.id:r.id;pg.close();return load2(id)}).catch(function(e){sv.disabled=false;sv.textContent='Customer Save Karein';er.textContent='Save nahi hua: '+(e.message||e)})}}
function load2(openId){
 return db().collection(COL).orderBy('createdAt','desc').limit(500).get().then(function(s){all=[];s.forEach(function(d){all.push(Object.assign({id:d.id},d.data()))});renderList();if(openId&&byId(openId))openDetail(openId)})}

/* ---------- details ---------- */
function openDetail(id){
 var c=byId(id);if(!c)return;
 var pg=page('Customer Details',[iconBtn('edit','Edit',function(){pg.close();openForm(byId(id))}),iconBtn('trash','Delete',function(){
   if(!confirm('"'+(c.name||'')+'" ko delete karein? Ye wapas nahi aayega.'))return;
   db().collection(COL).doc(id).delete().then(function(){pg.close();return load2()}).catch(function(e){alert('Delete nahi hua: '+(e.message||e))})})]);
 var b=pg.body;
 function draw(){
  c=byId(id)||c;b.textContent='';
  var top=el('div');top.style.cssText='display:flex;gap:14px;align-items:center';
  var av=el('div','occ-av',ini(c.name));av.style.cssText+='width:62px;height:62px;font-size:1.2rem';top.appendChild(av);
  var t=el('div');var h=el('div');h.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap';h.appendChild(el('b','',c.name));h.firstChild.style.fontSize='1.1rem';h.appendChild(el('span','occ-st occ-s-'+(c.status||'new'),SLABEL[c.status]||'New'));t.appendChild(h);
  [c.institute,c.mobile?'+91 '+c.mobile:'',c.address].forEach(function(x){if(x){var s=el('div','',x);s.style.cssText='font-size:.8rem;color:#475569;margin-top:2px';t.appendChild(s)}});top.appendChild(t);b.appendChild(top);
  var A=el('div','occ-acts'),m=c.mobile||'';
  var call=el('a');call.href='tel:+91'+m;call.innerHTML=ic('tel',20)+'Call';
  var wa=el('a');wa.href='https://wa.me/91'+m;wa.target='_blank';wa.rel='noopener';wa.innerHTML=ic('chat',20)+'WhatsApp';
  var nv=el('button');nv.type='button';nv.innerHTML=ic('nav',20)+'Navigate';nv.onclick=function(){openNav(c)};
  A.appendChild(call);A.appendChild(wa);A.appendChild(nv);b.appendChild(A);
  if(c.followUp){var fu=el('div','occ-warn','Follow-up: '+fd(c.followUp));if(!isDue(c)){fu.style.cssText='background:#eef2ff;border-color:#c7d2fe;color:#3730a3'}b.appendChild(fu)}
  if(c.notes){var nt=el('div','',c.notes);nt.style.cssText='font-size:.82rem;background:#fff;border-radius:12px;padding:10px 12px;margin-bottom:8px';b.appendChild(nt)}
  b.appendChild(el('div','occ-sec','Status badlein'));
  var cs=el('div','occ-chips');STATUS.forEach(function(s){var x=el('button','occ-chip'+(c.status===s[0]?' on':''),s[1]);x.type='button';x.onclick=function(){
    db().collection(COL).doc(id).update({status:s[0],updatedAt:firebase.firestore.FieldValue.serverTimestamp()}).then(function(){c.status=s[0];draw();renderList()}).catch(function(e){alert('Update nahi hua: '+(e.message||e))})};cs.appendChild(x)});b.appendChild(cs);
  if(c.card){b.appendChild(el('div','occ-sec','Visiting Card'));var im=el('img','occ-card-img');im.src=c.card;im.alt='Visiting card';b.appendChild(im)}
  var hs=el('div','occ-sec','Visit History');b.appendChild(hs);
  var add=el('button','occ-btn l');add.type='button';add.innerHTML=ic('plus',16)+'Visit / Call Jodein';add.onclick=function(){addVisit(id,draw)};b.appendChild(add);add.style.margin='0 0 10px';
  var vs=(c.visits||[]).slice().sort(function(x,y){return (y.at||0)-(x.at||0)});
  if(!vs.length){var ev=el('div','',"Abhi koi visit record nahi.");ev.style.cssText='font-size:.8rem;color:#64748b';b.appendChild(ev)}
  vs.forEach(function(v){var r=el('div','occ-vh');var i=el('i',v.type==='visit'?'':'c');i.innerHTML=ic(v.type==='visit'?'ok':'tel',16);r.appendChild(i);var tx=el('span');tx.appendChild(el('b','',(v.type==='visit'?'Visit: ':'Call: ')+fd(v.date)));if(v.note)tx.appendChild(el('small','',v.note));r.appendChild(tx);b.appendChild(r)})}
 draw()}
function addVisit(id,done){
 var s=sheet('<h3>Visit / Call Jodein</h3><div class="occ-chips" id="occ-vt"></div><div class="occ-f"><label for="occ-vd">Tareekh</label><input id="occ-vd" type="date"><label for="occ-vn">Kya baat hui</label><input id="occ-vn" type="text" maxlength="300" placeholder="Jaise: course details samjhaye"></div><div style="height:12px"></div><button type="button" class="occ-btn" id="occ-vs">Save Karein</button>');
 var type='visit',w=s.box.querySelector('#occ-vt');
 function dr(){w.textContent='';[['visit','Visit'],['call','Call']].forEach(function(x){var k=el('button','occ-chip'+(type===x[0]?' on':''),x[1]);k.type='button';k.onclick=function(){type=x[0];dr()};w.appendChild(k)})}dr();
 s.box.querySelector('#occ-vd').value=today();
 s.box.querySelector('#occ-vs').onclick=function(){
  var d=s.box.querySelector('#occ-vd').value||today(),n=s.box.querySelector('#occ-vn').value.trim(),e={type:type,date:d,note:n,at:Date.now()};
  db().collection(COL).doc(id).update({visits:firebase.firestore.FieldValue.arrayUnion(e),updatedAt:firebase.firestore.FieldValue.serverTimestamp()}).then(function(){var c=byId(id);c.visits=(c.visits||[]).concat([e]);s.close();done()}).catch(function(er){alert('Save nahi hua: '+(er.message||er))})}}

/* ---------- navigate ---------- */
function openNav(c){
 if(!hasLoc(c)){alert('Is customer ki location save nahi hai. Edit karke location lein.');return}
 var pg=page('Customer Tak Navigate');var b=pg.body;
 b.innerHTML='<div class="occ-map" id="occ-nm" style="height:300px"></div><div style="display:flex;align-items:center;gap:12px;margin:14px 2px"><span style="color:#1e1b4b">'+ic('car',30)+'</span><div><b id="occ-eta" style="font-size:1.1rem">Raasta dhoondh rahe hain...</b><div id="occ-eta2" style="font-size:.76rem;color:#64748b"></div></div></div>';
 var a=el('a','occ-btn','');a.innerHTML=ic('nav',18)+'Google Maps Mein Shuru Karein';a.style.textDecoration='none';
 a.href='https://www.google.com/maps/dir/?api=1&destination='+c.lat+','+c.lng+'&travelmode=driving';a.target='_blank';a.rel='noopener';b.appendChild(a);
 var mp=mkMap(b.querySelector('#occ-nm'),c.lat,c.lng,15,null);
 function eta(t,t2){b.querySelector('#occ-eta').textContent=t;b.querySelector('#occ-eta2').textContent=t2||''}
 function startNav(){
  grabLoc(function(p){
   if(!p){eta('Aapki location nahi mili','Google Maps khulne par wahi raasta dikha dega.');return}
   L.marker([p.lat,p.lng],{icon:L.divIcon({className:'occ-pin',html:'<div class="occ-me"></div>',iconSize:[16,16],iconAnchor:[8,8]})}).addTo(mp.map);
   mp.map.fitBounds([[p.lat,p.lng],[c.lat,c.lng]],{padding:[40,40]});
   var line=km({lat:p.lat,lng:p.lng},c);
   fetch('https://router.project-osrm.org/route/v1/driving/'+p.lng+','+p.lat+';'+c.lng+','+c.lat+'?overview=full&geometries=geojson').then(function(r){return r.json()}).then(function(j){
    var r=j&&j.routes&&j.routes[0];if(!r)throw 0;L.geoJSON(r.geometry,{style:{color:'#4f46e5',weight:5}}).addTo(mp.map);
    var mins=Math.max(1,Math.round(r.duration/60));eta((mins>=60?Math.floor(mins/60)+' ghanta '+(mins%60)+' min':mins+' min'),fkm(r.distance/1000)+' (gaadi se, andaza)')
   }).catch(function(){eta('Lagbhag '+fkm(line)+' door','Seedhi doori. Sahi raasta Google Maps mein dikhega.')})},function(){})}
 if(mp.map)startNav();else mp.ready=startNav}
})();
