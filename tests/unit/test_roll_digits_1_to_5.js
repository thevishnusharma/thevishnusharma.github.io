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
function sheet(marks,nd,rolls){nd=nd||2; // marks: {q:[[optIndex,dx,dy,r,ink]]}
  const cv=mk();qe.forEach(x=>Be.forEach(y=>square(cv,x+10,y+10,18)));
  const m=Wt({questions:30,rollDigits:nd});
  Object.keys(m.questionBubbles).forEach(k=>m.questionBubbles[k].forEach(p=>disk(cv,p.x,p.y,10,90,8.6)));
  m.rollColumns.forEach(col=>col.forEach(p=>disk(cv,p.x,p.y,10,90,8.6)));
  m.setBubbles.forEach(p=>disk(cv,p.x,p.y,10,90,8.6));
  Object.entries(marks).forEach(([q,list])=>list.forEach(([o,dx,dy,r,ink])=>{const p=m.questionBubbles[q][o];disk(cv,p.x+dx,p.y+dy,r,ink)}));

  (rolls||[]).forEach((dg,ci)=>{const p=m.rollColumns[ci][dg];disk(cv,p.x,p.y,8.6,40)});disk(cv,m.setBubbles[0].x,m.setBubbles[0].y,8.6,40);
  return cv;}

let pass=0;const T=(n,f)=>{try{f();pass++;console.log('  PASS '+n)}catch(e){console.log('  FAIL '+n+'\n   '+(e.stack||e));process.exitCode=1}};
const R=[4,0,7,1,2];
for(let nd=1;nd<=5;nd++)T(nd+'-digit roll number is read exactly',()=>{const r=ln(sheet({},nd,R.slice(0,nd)),{questions:30,rollDigits:nd},null);assert.strictEqual(String(r.roll),R.slice(0,nd).join(''));assert.strictEqual(r.rollDigitsDetected.length,nd)});
T('roll boxes carry no pre-printed 1/2/3 labels',()=>{assert.ok(!/String\(r\+1\),175\+r\*30\+15/.test(src));assert.ok(!/fillText\(String\(i\+1\),175\+i\*30/.test(src))});
console.log(pass+' passed');
