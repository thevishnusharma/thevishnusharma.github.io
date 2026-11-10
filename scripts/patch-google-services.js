// v175: google-services.json me agar institute ke package ka client nahi hai to existing client ki copy bana deta hai,
// taaki Gradle build fail na ho. NOTE: push notification tabhi pakka chalega jab Firebase Console me us package ko "Add app" kiya ho
// aur naya google-services.json secret me daala ho (guide dekhein). Bina uske build + app theek chalti hai.
const fs = require('fs');
const f = 'android/app/google-services.json', pkg = process.env.APP_ID;
if (!fs.existsSync(f)) { console.log('google-services.json nahi hai — skip'); process.exit(0); }
const j = JSON.parse(fs.readFileSync(f, 'utf8'));
const has = (j.client || []).some(c => c.client_info && c.client_info.android_client_info && c.client_info.android_client_info.package_name === pkg);
if (has) { console.log('Firebase me', pkg, 'registered hai — push chalu'); process.exit(0); }
const c = JSON.parse(JSON.stringify(j.client[0]));
c.client_info.android_client_info.package_name = pkg;
j.client.push(c);
fs.writeFileSync(f, JSON.stringify(j, null, 2));
console.log('WARN:', pkg, 'Firebase me registered nahi — build ke liye copy banayi; push ke liye Firebase Console me app add karein');
