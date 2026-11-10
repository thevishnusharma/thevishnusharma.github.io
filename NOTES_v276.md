# v276 — Total Result Sheet ko IMAGE (JPG) me download / WhatsApp group me bhejna

Offline (OMR) students ke liye: Reports screen se poore exam ki marksheet ek image me.
Reports kholo -> upar 2 button:
- 🖼️ Result Sheet (Image) -> JPG download (APK me save + share sheet; wahan se WhatsApp group chun lo).
- 📤 Group me Bhejein -> phone ki share sheet seedhe image ke saath (agar browser/phone file-share support na kare to apne-aap download ho jaata hai).

Image me: institute naam, exam, class, date, Rank / Roll / Naam / Set / Marks / % / Sahi / Galat / Blank, top-3 medal, total students.
- Naam tab dikhta hai jab Roster (registration se) linked ho; nahi to Naam column nahi aata (Roll No se kaam chalta hai).
- Barabar marks par barabar Rank (1,2,2,4) — Reports list me abhi bhi serial number dikhta hai.
- 40 students se zyada ho to 2+ image (Page 1/2 ...), har page par 40 naam.

Files: exam-manager.js (resultSheetModel / resultSheetBlobs / examgrResultSheetImage), exam-roster.js (SnapRoster.nameOf), index.html (2 buttons).
Test: tests/unit/test_result_sheet_image_v276.js. Version 1.4.62 / build 276.
