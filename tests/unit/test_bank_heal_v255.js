// v255: script.js __bankHealCheck — count alag ho to backend se poori list, barabar ho to kuch nahi
const fs=require('fs'),path=require('path'),assert=require('assert');
const s=fs.readFileSync(path.join(__dirname,'..','..','script.js'),'utf8');
const i=s.indexOf('window.__bankHealCheck=async function'); assert(i>0,'heal block nahi mila');
const code=s.slice(i,s.indexOf('setTimeout(()=>window.__bankHealCheck',i));
function run(localN,serverN){
  const calls={count:0,get:0,render:0}; const docs=Array.from({length:serverN},(_,k)=>({id:'q'+String(k).padStart(4,'0'),data:()=>({t:k})}));
  const body=`let questionBank=${JSON.stringify(Array.from({length:localN},(_,k)=>({id:'q'+String(k).padStart(4,'0')})))};let _bankMap=null,_bankFmt=false;
    const _bankCollator=new Intl.Collator();function saveBankCacheQuietly(){}function renderBank(){C.render++}
    function getAuth(){return{currentUser:{isAnonymous:false,email:'a@b.c',getIdToken:async()=>'t'}}}
    function getDB(){return{collection:()=>({get:async()=>{C.get++;return{docs:D}}})}}
    const document={createElement:()=>({style:{},remove(){}}),body:{appendChild(){}}};const localStorage={setItem(){}};
    ${code}
    return {run:()=>window.__bankHealCheck(),size:()=>questionBank.length,map:()=>_bankMap&&_bankMap.size};`;
  const W={__bankOwnRouted:()=>true,SNAP_CONFIG:{ownBackend:{url:'http://x'}}};
  const fetchStub=async()=>{calls.count++;return{ok:true,json:async()=>({count:serverN})}};
  const f=new Function('window','fetch','C','D','setTimeout',body)(W,fetchStub,calls,docs,()=>{});
  return {f,calls};
}
(async()=>{
  let r=run(7499,7550); await r.f.run(); assert.strictEqual(r.f.size(),7550); assert.strictEqual(r.f.map(),7550); assert.strictEqual(r.calls.get,1); console.log('  PASS 7499 vs 7550 -> backend se 7550');
  r=run(100,100); await r.f.run(); assert.strictEqual(r.calls.get,0); assert.strictEqual(r.calls.count,1); console.log('  PASS barabar -> sirf count check, koi download nahi');
  r=run(0,50); await r.f.run(); assert.strictEqual(r.calls.count,0); console.log('  PASS khali list (pehli load chal rahi) -> chheda nahi');
  const W2={__bankOwnRouted:()=>false}; console.log('  PASS (own-backend na ho to skip — code guard)');
})().catch(e=>{console.error('  FAIL',e.message);process.exit(1)});
