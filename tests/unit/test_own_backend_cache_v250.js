// v250: own-backend.js — questionBank device cache + silent delta (fake server + fake IndexedDB)
const fs=require('fs');
function mkIDB(store){ // minimal fake indexedDB
  return { open(){ const r={}; setTimeout(()=>{ r.result={ createObjectStore(){}, transaction(){ const tx={}; const os={
    get(k){const q={}; setTimeout(()=>{q.result=store.has(k)?structuredClone(store.get(k)):undefined; q.onsuccess&&q.onsuccess();},0); return q;},
    put(v,k){ store.set(k,structuredClone(v)); setTimeout(()=>tx.oncomplete&&tx.oncomplete(),0); } };
    tx.objectStore=()=>os; return tx; } }; r.onupgradeneeded&&r.onupgradeneeded(); r.onsuccess&&r.onsuccess(); },0); return r; } };
}
function mkServer(){
  const docs=new Map(); let t=1000; const log=[];
  const api={ docs, log,
    set(id,data){ t+=60000; docs.set(id,{data,updated:t}); },
    del(id){ docs.delete(id); t+=60000; },
    fetch(url){ const u=new URL(url); const path=u.pathname; log.push(path+u.search);
      let body;
      if(path.endsWith('/count')) body={count:docs.size};
      else { const since=u.searchParams.get('since'); const limit=+u.searchParams.get('limit'), off=+u.searchParams.get('offset');
        let rows=[...docs.entries()].map(([id,v])=>({id,data:v.data,u:v.updated})); 
        if(since) rows=rows.filter(r=>r.u> (Date.parse(since)-Date.parse('2026-01-01T00:00:00.000Z')) ); // since = ISO of (serverTime-5000)
        rows.sort((a,b)=>b.u-a.u); rows=rows.slice(off,off+limit);
        if(api.dropOnce && !since && off===0){ rows=rows.slice(0,-1); api.dropOnce=false; api.dropped=true; }
        body={success:true,docs:rows.map(r=>({id:r.id,data:r.data})),count:rows.length,serverTime:new Date(Date.parse('2026-01-01T00:00:00.000Z')+t).toISOString()}; }
      return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(body)}); } };
  return api;
}
async function run(){
  const idbStore=new Map(); const srv=mkServer();
  for(let i=1;i<=2500;i++) srv.set('q'+i,{t:'old'+i});
  function boot(){
    const W={ SNAP_CONFIG:{ownBackend:{enabled:true,url:'http://x',collections:['questionBank']}}, indexedDB:mkIDB(idbStore),
      firebase:{firestore:{Timestamp:class{},FieldValue:class{}}}, vishnuFirebase:{authReady:Promise.resolve(),auth:{currentUser:{getIdToken:()=>Promise.resolve('tok')}}},
      addEventListener(){}, document:{addEventListener(){}}, crypto:require('crypto').webcrypto };
    global.fetch=(u)=>srv.fetch(u); global.window=W; 
    const code=fs.readFileSync(require('path').join(__dirname,'..','..','own-backend.js'),'utf8');
    new Function('window','globalThis',code.replace("})(typeof window !== 'undefined' ? window : globalThis);","})(window);"))(W,W);
    // socket stub: never loads
    W.io=undefined; return W; }
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const mkdb=(W)=>{ const db={collection(){throw new Error('real')}}; return W.SnapOwnBackend.wrap(db); };

  // ---- run 1: cold start (no cache) -> full load
  let W=boot(); let snaps=[]; let db=mkdb(W);
  // avoid socket script injection: stub document.createElement
  W.document.createElement=()=>({}); W.document.head={appendChild(){}};
  let un=db.collection('questionBank').onSnapshot(s=>snaps.push({size:s.size,ch:s.docChanges().length}));
  await wait(200);
  console.log('run1 snaps',JSON.stringify(snaps),'reqs',srv.log.length); 
  if(snaps.length!==1||snaps[0].size!==2500) throw new Error('run1 bad');
  un(); await wait(50); console.log('cache saved?',idbStore.has('coll:questionBank@http://x'));
  global.document={createElement:()=>({}),head:{appendChild(){}},addEventListener(){}};
  async function reopen(label){ srv.log.length=0; W=boot(); W.document=global.document; db=mkdb(W); snaps=[];
    un=db.collection('questionBank').onSnapshot(s=>snaps.push({size:s.size,ch:s.docChanges().length,ids:s.docs.map(d=>d.id)}));
    await wait(300); un(); await wait(50);
    console.log(label,'snaps',JSON.stringify(snaps.map(s=>({size:s.size,ch:s.ch}))),'reqs',srv.log.length, srv.log.some(l=>/offset=1000/.test(l))?'(FULL PAGING)':'(delta only)');
    return snaps; }
  // A) band hone ke dauran: 3 naye + 1 edit (delete nahi)
  srv.set('new1',{t:'n1'}); srv.set('new2',{t:'n2'}); srv.set('new3',{t:'n3'}); srv.set('q5',{t:'edited'});
  let sn=await reopen('A add/edit');
  if(sn[0].size!==2500) throw new Error('A: first emit should be cached 2500');
  let last=sn[sn.length-1]; if(last.size!==2503||!last.ids.includes('new1')) throw new Error('A: final wrong '+last.size);
  if(srv.log.some(l=>/offset=1000/.test(l))) throw new Error('A: should be delta only');
  console.log('PASS A: cache first, 3 new + edit via delta, no full reload');
  // B) band hone ke dauran 2 delete
  srv.del('q10'); srv.del('q11');
  sn=await reopen('B delete');
  last=sn[sn.length-1]; if(last.size!==2501||last.ids.includes('q10')||last.ids.includes('q11')) throw new Error('B: delete not detected '+last.size);
  console.log('PASS B: deletes detected (count check -> resync)');
  // C) kuch nahi badla
  sn=await reopen('C no change');
  if(sn.length!==1||sn[0].size!==2501) throw new Error('C: expected single cached emit');
  if(srv.log.length>3) throw new Error('C: too many requests '+srv.log.length);
  console.log('PASS C: no change -> 1 cached emit, '+srv.log.length+' requests (1 delta + 1 count)');
  // D) poore load me ek doc chhoot jaye (paging) -> count mismatch -> apne-aap dobara load
  idbStore.clear(); srv.dropOnce=true; srv.log.length=0;
  sn=await reopen('D skipped doc');
  last=sn[sn.length-1];
  if(!srv.dropped) throw new Error('D: test setup (doc drop) nahi hua');
  if(last.size!==srv.docs.size) throw new Error('D: expected '+srv.docs.size+' got '+last.size);
  console.log('PASS D: chhoota hua doc count check se pakda gaya ('+last.size+' = server)');
  // E) listener chalu hai; server par naya doc aaya; SnapOwnBackend.refresh() se chupke se aa jaye
  W=boot(); W.document=global.document; db=mkdb(W); snaps=[];
  const un2=db.collection('questionBank').onSnapshot(s=>snaps.push({size:s.size,ids:s.docs.map(d=>d.id)}));
  await wait(300);
  srv.set('late1',{t:'late'}); W.SnapOwnBackend.refresh('questionBank',true); await wait(300);
  const l2=snaps[snaps.length-1]; if(!l2.ids.includes('late1')) throw new Error('E: refresh se naya doc nahi aaya');
  console.log('PASS E: SnapOwnBackend.refresh() se naya doc silently aaya'); un2();
}
run().then(()=>process.exit(0)).catch(e=>{console.error('FAIL',e.message);process.exit(1)});
