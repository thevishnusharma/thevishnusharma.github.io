// v257: question-generator.html me app-config.js, own-backend.js aur firebase-config.js se PEHLE hona chahiye.
// Warna SNAP_CONFIG nahi milti -> generator backend ki jagah purane Firebase se questions padhta/likhta hai.
const fs=require('fs'),path=require('path'),assert=require('assert');
const h=fs.readFileSync(path.join(__dirname,'..','..','question-generator.html'),'utf8');
const pos=n=>h.search(new RegExp('<script src="'+n.replace('.','\\.')+'[^"]*"'));
const a=pos('app-config.js'),o=pos('own-backend.js'),f=pos('firebase-config.js');
assert(a>0,'app-config.js generator page me nahi hai'); assert(o>a,'own-backend.js, app-config.js se pehle hai'); assert(f>o,'firebase-config.js, own-backend.js se pehle hai');
console.log('  PASS generator page: app-config.js -> own-backend.js -> firebase-config.js');
