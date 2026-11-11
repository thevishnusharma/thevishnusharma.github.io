// v307: Owner app se "Reads Monitor" tab hata diya gaya. Ye test dekhta hai ki wo wapas na judo / koi toota link na bache.
const fs = require('fs'), path = require('path'), assert = require('assert');
const R = (f) => fs.readFileSync(path.join(__dirname, '../../' + f), 'utf8');
const html = R('owner-app.html'), ui = R('owner-ui.js'), sw = R('sw.js'), bw = R('scripts/build-www.js');
assert(!html.includes('owner-reads.js'), 'owner-app.html owner-reads.js load na kare');
assert(!html.includes('oa-v-reads') && !html.includes("ouiTab('reads')"), 'Reads tab/section nahi hona chahiye');
assert(!ui.includes('ouiReadsOpen'), 'owner-ui.js me Reads hook nahi hona chahiye');
assert(!sw.includes('owner-reads.js'), 'sw.js precache me owner-reads.js nahi');
assert(!bw.includes('owner-reads.js'), 'build-www.js me owner-reads.js nahi (file delete hone par build na tute)');
console.log('PASS owner reads tab removed');
