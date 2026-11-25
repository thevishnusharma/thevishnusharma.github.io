# v289 — Owner app: Customers (visit / location system)

## Naya
- owner-customers.js: Owner app me "Customers" tab (Institutes ke baad). Add / edit customer (naam, institute, mobile, visiting card photo,
  GPS location one-click + auto prefetch, pin kheench kar sahi karna, address auto, status New/Interested/Follow-up/Converted,
  follow-up date, notes, sahmati), list (search, filters, Due, Paas wale), details (Call / WhatsApp / Navigate, status badlo,
  visit history + Visit/Call jodein), in-app navigate (route + time, phir Google Maps).
- Data: Firestore collection `ownerCustomers` (sirf Owner). Card photo chhoti karke usi doc me.
- Map: Leaflet + OpenStreetMap (cdnjs), route OSRM demo, address Nominatim. Koi API key nahi.

## Badle hue files
- owner-app.html (script tag), scripts/build-www.js (Owner APK me file), scripts/android-prepare.js (Owner APK me location permission),
  firestore.rules (`ownerCustomers`).

## Zaroori steps
1. firestore.rules Firebase me PUBLISH karein (nahi to Customers tab "Load nahi hua" dikhayega).
2. Site/GitHub par upload karein. Owner APK dobara build karein (Actions > Build Owner APK) — location permission manifest me tab judti hai.
3. Pehli baar Customers tab kholne par permission sheet aati hai; Location allow karein.

## Abhi nahi
- Visiting card se naam/mobile apne aap padhna (OCR) nahi hai; sirf photo save hoti hai.
- Follow-up ki phone notification nahi; app me "Due" banner aur filter dikhta hai.
