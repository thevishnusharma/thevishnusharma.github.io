// v235: admin ke liye poora questionBank Firestore se apne-aap kabhi nahi padhna chahiye (7.5K reads/baar).
const fs=require('fs'),path=require('path'),assert=require('assert');
const s=fs.readFileSync(path.join(__dirname,'..','..','script.js'),'utf8');
let pass=0;const T=(n,f)=>{try{f();pass++;console.log('  PASS '+n)}catch(e){console.log('  FAIL '+n+'\n  '+(e.stack||e));process.exitCode=1}};
T('syncBank admin ke liye (Firebase mode me) __bankFullOk ke bina onSnapshot nahi chalata — v251: apne backend par ye guard nahi, wahan reads Firebase ke nahi',()=>{assert.ok(s.includes('if(!window.__bankFullOk&&window.__bankIsAdmin&&window.__bankIsAdmin()&&!(window.__bankOwnRouted&&window.__bankOwnRouted())){'))});
T('/bank fail hone par admin fallback force-sync nahi karta',()=>{assert.ok(!s.includes('}).catch(()=>{if(isAdminUser)window.__bankDirty=!0;window.__bankForce=!0;try{syncBank()}catch(_e){}});'))});
T('refresh button confirm maangta hai',()=>{assert.ok(/window\.refreshBankNow=function\(\)\{\s*if\(!window\.__bankFullOk\)\{[\s\S]{0,200}confirm\(/.test(s))});
console.log(pass+' passed');
