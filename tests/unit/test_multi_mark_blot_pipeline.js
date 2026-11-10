const fs=require('fs'),vm=require('vm'),assert=require('assert');
const path=require('path'); const src=fs.readFileSync(path.join(__dirname,'..','..','exam-manager.js'),'utf8');
function grab(name){const start=src.indexOf('function '+name+'(');assert.ok(start>=0,name);let i=src.indexOf('{',start),d=0,inStr=null,esc=false;for(;i<src.length;i++){const c=src[i];if(inStr){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===inStr)inStr=null;continue}if(c==='"'||c==="'"||c==='`'){inStr=c;continue}if(c==='{')d++;else if(c==='}'){d--;if(d===0)return src.slice(start,i+1)}}throw new Error(name)}
const a=src.indexOf('const O={width'),b=src.indexOf(',re=e=>');const consts1=src.slice(a,b)+';';
const c=src.indexOf('const Ya=42'),d2=src.indexOf(';',src.indexOf('rn=13',c));const consts2=src.slice(c,d2+1);
const qd='const q=["A","B","C","D"],Q=["A","B","C","D","E"];';
const code=[qd,consts1,consts2,...['yn','aa','sn','on','Ha','bt','Xa','Qa','Wt','ln'].map(grab)].join('\n');
const ctx={Math,Float32Array,Float64Array,Int32Array,Uint8Array,Uint8ClampedArray,Array,Object,isFinite,Number,console};vm.createContext(ctx);vm.runInContext(code,ctx);
const W=1203,H=1536;
function mk(){const buf=new Uint8ClampedArray(W*H*4).fill(235);for(let i=3;i<buf.length;i+=4)buf[i]=255;return {width:W,height:H,buf,getContext(){return{getImageData:(x,y,w,h)=>{const o=new Uint8ClampedArray(w*h*4);for(let j=0;j<h;j++)for(let i=0;i<w;i++){const xs=x+i,ys=y+j;if(xs<W&&ys<H){const s=(ys*W+xs)*4,k=(j*w+i)*4;o[k]=buf[s];o[k+1]=buf[s+1];o[k+2]=buf[s+2];o[k+3]=255}}return{data:o}}}}}}
function disk(cv,cx,cy,r,v,inner){for(let y=Math.floor(cy-r-1);y<=cy+r+1;y++)for(let x=Math.floor(cx-r-1);x<=cx+r+1;x++){const d=Math.hypot(x-cx,y-cy);if(d<=r&&d>=(inner||0)&&x>=0&&y>=0&&x<W&&y<H){const k=(y*W+x)*4;cv.buf[k]=cv.buf[k+1]=cv.buf[k+2]=v}}}
function square(cv,cx,cy,s){for(let y=cy-s/2;y<=cy+s/2;y++)for(let x=cx-s/2;x<=cx+s/2;x++){const k=(Math.round(y)*W+Math.round(x))*4;cv.buf[k]=cv.buf[k+1]=cv.buf[k+2]=25}}
const Wt=vm.runInContext('Wt',ctx),ln=vm.runInContext('ln',ctx),qe=vm.runInContext('qe',ctx),Be=vm.runInContext('Be',ctx);
function sheet(marks){ // marks: {q:[[optIndex,dx,dy,r,ink]]}
  const cv=mk();qe.forEach(x=>Be.forEach(y=>square(cv,x+10,y+10,18)));
  const m=Wt({questions:30,rollDigits:2});
  Object.keys(m.questionBubbles).forEach(k=>m.questionBubbles[k].forEach(p=>disk(cv,p.x,p.y,10,90,8.6)));
  m.rollColumns.forEach(col=>col.forEach(p=>disk(cv,p.x,p.y,10,90,8.6)));
  m.setBubbles.forEach(p=>disk(cv,p.x,p.y,10,90,8.6));
  Object.entries(marks).forEach(([q,list])=>list.forEach(([o,dx,dy,r,ink])=>{const p=m.questionBubbles[q][o];disk(cv,p.x+dx,p.y+dy,r,ink)}));
  // roll 1,2 + set A
  [[0,1],[1,2]].forEach(([ci,dg])=>{const p=m.rollColumns[ci][dg];disk(cv,p.x,p.y,8.6,40)});disk(cv,m.setBubbles[0].x,m.setBubbles[0].y,8.6,40);
  return cv;}

// ---- Double-mark pipeline test: runs the REAL ln() (registration + local exposure + pickBest) on a synthetic warped sheet ----
const ex={questions:30,rollDigits:2};
let pass=0;const T=(n,f)=>{try{f();pass++;console.log('  PASS '+n)}catch(e){console.log('  FAIL '+n+'\n   '+(e.stack||e));process.exitCode=1}};
const run=(m)=>ln(sheet(m),ex,null);
T('two filled options (centred) -> multi, both reported',()=>{const r=run({22:[[0,0,0,8.6,40],[1,0,0,8.6,40]]});assert.strictEqual(r.answerFlags[22],'multi');assert.strictEqual(JSON.stringify(r.answerMultiOptions[22].map(o=>o.opt).sort()),'[0,1]')});
T('second mark misplaced by 4px / 8px / 10px / 12px (curved paper) is still caught',()=>{for(const d of [4,8,10,12]){const r=run({22:[[0,d*.7,d*.7,8.6,40],[1,0,0,8.6,40]]});assert.strictEqual(r.answerFlags[22],'multi','offset '+d);assert.strictEqual(r.answerMultiOptions[22].length,2,'offset '+d)}});
T('very dark big blot beside a correct mark -> multi',()=>{const r=run({22:[[0,6,4,10,25],[1,0,0,8.6,40]]});assert.strictEqual(r.answerFlags[22],'multi')});
T('single mark -> not flagged',()=>{const r=run({22:[[1,0,0,8.6,40]]});assert.strictEqual(r.answerFlags[22],null);assert.strictEqual(r.answers[22],1)});
T('360 single-marked answers (random sizes/darkness/jitter) -> zero false multi, zero misreads',()=>{let seed=99;const rnd=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;let bad=0;for(let t=0;t<12;t++){const marks={},truth={};for(let q=1;q<=30;q++){const o=Math.floor(rnd()*4);truth[q]=o;marks[q]=[[o,(rnd()-.5)*3,(rnd()-.5)*3,rnd()<.5?8.6:rnd()<.5?9.6:7.4,20+rnd()*70]]}const r=run(marks);for(let q=1;q<=30;q++)if(r.answerFlags[q]||r.answers[q]!==truth[q])bad++}assert.strictEqual(bad,0,'bad '+bad)});
T('adjacent questions both marked (neighbouring rows/columns) -> no cross-contamination',()=>{const r=run({10:[[0,0,0,8.6,40]],11:[[0,0,0,8.6,40]],12:[[3,0,0,8.6,40]],13:[[2,0,0,8.6,40]]});[10,11,12,13].forEach(q=>assert.strictEqual(r.answerFlags[q],null,'q'+q))});
console.log(pass+' passed');
