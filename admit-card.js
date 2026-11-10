/* v230 — Admit Card (shared renderer + student view)
   - SnapAdmit.render(card, photo)  -> Promise<canvas>   (admin print + student dono yahi use karte hain)
   - Student dashboard par "🎫 Admit Card" card; studentAdmitCards/{examId}_{mobile} se padhta hai.
   - Admit card localStorage me cache hota hai: exam hall me internet na ho tab bhi dikhe.
   - Sab text canvas par draw hota hai (HTML injection ka khatra nahi). Kill-switch: SNAP_CONFIG.admitCard=false */
(function (root) {
  "use strict";
  var W = 1240, H = 877; /* A5 landscape @150dpi — A4 portrait par 2 card aate hain */
  var NAVY = "#1e1b4b", GOLD = "#fbbf24", INK = "#111827", GRAY = "#6b7280", LINE = "#c7d2fe", SOFT = "#eef2ff";

  function admitId(examId, roll) { return String(examId || "").slice(0, 5).toUpperCase() + "-" + String(roll || ""); }
  /* "Powered by The Vishnu Sharma" tag (Owner Panel hidePoweredBy ya SNAP_CONFIG.brandMark=false par nahi) */
  function markText() {
    if (root.SNAP_CONFIG && root.SNAP_CONFIG.brandMark === false) return "";
    var B = root.SnapBrand; if (B && B.mark) return B.mark.on() ? B.mark.text : "";
    return "Powered by The Vishnu Sharma";
  }
  function maskMobile(m) { m = String(m || "").replace(/\D/g, "").slice(-10); return m.length === 10 ? "XXXXXX" + m.slice(6) : ""; }
  function prettyDate(s) {
    var d = new Date(String(s || "") + "T00:00:00"); if (isNaN(d.getTime())) return String(s || "");
    var M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return d.getDate() + " " + M[d.getMonth()] + " " + d.getFullYear();
  }
  function fit(ctx, text, maxW, size, weight) {
    var s = size; ctx.font = weight + " " + s + "px Arial, 'Noto Sans Devanagari', 'Nirmala UI', Mangal, sans-serif";
    while (s > 14 && ctx.measureText(text).width > maxW) { s -= 2; ctx.font = weight + " " + s + "px Arial, 'Noto Sans Devanagari', 'Nirmala UI', Mangal, sans-serif"; }
    return s;
  }
  function wrap(ctx, text, maxW, maxLines) {
    var out = [], paras = String(text || "").split(/\r?\n/);
    for (var p = 0; p < paras.length && out.length < maxLines; p++) {
      var words = paras[p].split(/\s+/).filter(Boolean), line = "";
      for (var i = 0; i < words.length; i++) {
        var t = line ? line + " " + words[i] : words[i];
        if (ctx.measureText(t).width > maxW && line) { out.push(line); line = words[i]; if (out.length >= maxLines) break; } else line = t;
      }
      if (line && out.length < maxLines) out.push(line);
    }
    return out;
  }
  function loadImg(src) {
    return new Promise(function (res) {
      if (!src) return res(null);
      var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = src;
    });
  }
  var DEFAULT_NOTES = "1. Admit card aur photo ID saath layein.  2. Exam shuru hone se 30 minute pehle pahunchein.  3. OMR sheet par Roll No ke bubbles isi card ke number se bharein (neela/kaala ball pen).  4. Mobile / calculator / koi bhi notes allowed nahi hain.";

  function render(card, photoSrc, scale) {
    card = card || {}; scale = scale || 1;
    return loadImg(photoSrc).then(function (img) {
      var cv = document.createElement("canvas"); cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
      var c = cv.getContext("2d"); c.scale(scale, scale);
      c.fillStyle = "#fff"; c.fillRect(0, 0, W, H);
      c.strokeStyle = NAVY; c.lineWidth = 4; c.strokeRect(10, 10, W - 20, H - 20);
      /* header */
      c.fillStyle = NAVY; c.fillRect(10, 10, W - 20, 118);
      c.textAlign = "center"; c.fillStyle = "#fff";
      var inst = String(card.instituteName || (window.SnapBrand && SnapBrand.plain ? SnapBrand.plain("The Vishnu Sharma") : "The Vishnu Sharma")).toUpperCase();
      fit(c, inst, W - 120, 44, "bold"); c.fillText(inst, W / 2, 72);
      c.fillStyle = GOLD; c.font = "bold 24px Arial, 'Noto Sans Devanagari', 'Nirmala UI', Mangal, sans-serif"; c.fillText("ADMIT CARD  •  प्रवेश पत्र", W / 2, 110);
      /* exam band */
      c.fillStyle = SOFT; c.fillRect(10, 128, W - 20, 62);
      c.fillStyle = NAVY; var ex = String(card.examName || "Exam");
      fit(c, ex, W - 140, 32, "bold"); c.fillText(ex, W / 2, 170);
      /* photo */
      c.textAlign = "left";
      c.strokeStyle = NAVY; c.lineWidth = 2; c.strokeRect(40, 212, 220, 272);
      if (img) {
        var r = Math.max(216 / img.width, 268 / img.height), sw = 216 / r, sh = 268 / r;
        c.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 42, 214, 216, 268);
      } else {
        c.fillStyle = SOFT; c.fillRect(42, 214, 216, 268); c.fillStyle = NAVY; c.textAlign = "center";
        c.font = "bold 96px Arial, 'Noto Sans Devanagari', 'Nirmala UI', Mangal, sans-serif"; c.fillText(String(card.name || "?").trim().charAt(0).toUpperCase(), 150, 380);
        c.fillStyle = GRAY; c.font = "16px Arial, 'Noto Sans Devanagari', 'Nirmala UI', Mangal, sans-serif"; c.fillText("Photo yahan lagayein", 150, 440); c.textAlign = "left";
      }
      /* fields */
      var rows = [["STUDENT NAME", card.name || "-"]];
      if (card.fatherName || card.dob) rows.push(["FATHER'S NAME" + (card.dob ? " / DATE OF BIRTH" : ""), (card.fatherName || "") + (card.fatherName && card.dob ? "   •   DOB: " : card.dob ? "DOB: " : "") + (card.dob ? prettyDate(card.dob) : "")]);
      rows.push([card.school ? "CLASS / SCHOOL" : "CLASS", [card.className, card.school].filter(Boolean).join("   •   ") || "-"]);
      var dateRow = ["DATE", prettyDate(card.date) + (card.time ? "   •   Time: " + card.time : "")];
      if (card.reportTime) dateRow[1] += "   •   Reporting: " + card.reportTime;
      rows.push(dateRow); rows.push(["VENUE / CENTER", card.venue || "-"]);
      var dense = rows.length > 4, step = dense ? 54 : 66, y = dense ? 210 : 222;
      rows.forEach(function (rw) {
        c.fillStyle = GRAY; c.font = "bold 16px Arial, 'Noto Sans Devanagari', 'Nirmala UI', Mangal, sans-serif"; c.fillText(rw[0], 296, y);
        c.fillStyle = INK; fit(c, String(rw[1]), W - 340, dense ? 26 : 30, "bold"); c.fillText(String(rw[1]), 296, y + (dense ? 30 : 34));
        c.strokeStyle = LINE; c.lineWidth = 1; c.beginPath(); c.moveTo(296, y + (dense ? 39 : 48)); c.lineTo(W - 44, y + (dense ? 39 : 48)); c.stroke();
        y += step;
      });

      /* roll digits */
      var roll = String(card.roll || ""), bx = 296, by = 492;
      c.fillStyle = GRAY; c.font = "bold 16px Arial, 'Noto Sans Devanagari', 'Nirmala UI', Mangal, sans-serif"; c.fillText("ROLL NO", bx, by - 8);
      for (var i = 0; i < roll.length; i++) {
        c.fillStyle = "#fff"; c.fillRect(bx + i * 62, by, 54, 72);
        c.strokeStyle = NAVY; c.lineWidth = 3; c.strokeRect(bx + i * 62, by, 54, 72);
        c.fillStyle = NAVY; c.font = "bold 46px Arial, 'Noto Sans Devanagari', 'Nirmala UI', Mangal, sans-serif"; c.textAlign = "center"; c.fillText(roll.charAt(i), bx + i * 62 + 27, by + 54); c.textAlign = "left";
      }
      var after = bx + roll.length * 62 + 20;
      c.fillStyle = INK; c.font = "17px Arial, 'Noto Sans Devanagari', 'Nirmala UI', Mangal, sans-serif";
      wrap(c, "OMR sheet ke 'Roll No' me yahi number bharein.", W - after - 44, 3)
        .forEach(function (ln, k) { c.fillText(ln, after, by + 22 + k * 24); });
      /* instructions */
      c.fillStyle = SOFT; c.fillRect(40, 590, W - 80, 176);
      c.fillStyle = NAVY; c.font = "bold 18px Arial, 'Noto Sans Devanagari', 'Nirmala UI', Mangal, sans-serif"; c.fillText("INSTRUCTIONS / निर्देश", 56, 616);
      c.fillStyle = INK; c.font = "17px Arial, 'Noto Sans Devanagari', 'Nirmala UI', Mangal, sans-serif";
      wrap(c, card.notes || DEFAULT_NOTES, W - 112, 6).forEach(function (ln, k) { c.fillText(ln, 56, 646 + k * 25); });
      /* signatures + id */
      c.strokeStyle = INK; c.lineWidth = 1.5; c.fillStyle = GRAY; c.font = "15px Arial, 'Noto Sans Devanagari', 'Nirmala UI', Mangal, sans-serif"; c.textAlign = "center";
      [[190, "Student Signature"], [620, "Invigilator"], [1050, "Principal / Authorised"]].forEach(function (s) {
        c.beginPath(); c.moveTo(s[0] - 130, 806); c.lineTo(s[0] + 130, 806); c.stroke(); c.fillText(s[1], s[0], 826);
      });
      c.textAlign = "right"; c.font = "bold 15px Arial, 'Noto Sans Devanagari', 'Nirmala UI', Mangal, sans-serif";
      var mk = markText(); if (mk) { c.textAlign = "left"; c.fillStyle = GRAY; c.font = "bold 15px Arial, sans-serif"; c.fillText(mk, 44, 852); c.textAlign = "right"; c.fillStyle = GRAY; }
      c.fillText("Admit ID: " + admitId(card.examId, card.roll) + (card.mobile ? "  •  " + maskMobile(card.mobile) : ""), W - 44, 852);
      return cv;
    });
  }

  function toBlob(cv, type, q) { return new Promise(function (res) { cv.toBlob(res, type || "image/png", q); }); }
  function fileBase(card) { return String((card.examName || "exam") + "-roll-" + (card.roll || "")).replace(/[^\w\u0900-\u097F-]+/g, "-").slice(0, 80); }

  /* preview modal: image + Download / Print / Share */
  function preview(card, photoSrc) {
    return render(card, photoSrc, 1).then(function (cv) {
      var old = document.getElementById("snap-admit-preview"); if (old) old.remove();
      var ov = document.createElement("div"); ov.id = "snap-admit-preview"; ov.className = "test-analysis-overlay examgr-overlay-full";
      var sh = document.createElement("div"); sh.className = "test-analysis-sheet ros-sheet";
      var x = document.createElement("button"); x.type = "button"; x.className = "test-analysis-close"; x.textContent = "✕"; x.onclick = function () { ov.remove(); };
      var im = document.createElement("img"); im.className = "ros-card-img"; im.alt = "Admit card"; im.src = cv.toDataURL("image/png");
      var bar = document.createElement("div"); bar.className = "ros-btnrow";
      function btn(t, f) { var b = document.createElement("button"); b.type = "button"; b.className = "btn-secondary"; b.textContent = t; b.onclick = f; bar.appendChild(b); return b; }
      btn("⬇️ Download", function () { var a = document.createElement("a"); a.href = im.src; a.download = fileBase(card) + "-admit-card.png"; document.body.appendChild(a); a.click(); a.remove(); });
      btn("🖨️ Print", function () {
        var w = window.open("", "_blank"); if (!w) { alert("Pop-up block hai — Download karke print karein."); return; }
        var d = w.document; d.title = "Admit Card"; var st = d.createElement("style"); st.textContent = "@page{size:A5 landscape;margin:0}body{margin:0}img{width:100%;display:block}"; d.head.appendChild(st);
        var pi = d.createElement("img"); pi.src = im.src; d.body.appendChild(pi); pi.onload = function () { w.focus(); w.print(); };
      });
      if (navigator.share) btn("📤 Share", function () {
        toBlob(cv).then(function (b) {
          var f = new File([b], fileBase(card) + "-admit-card.png", { type: "image/png" });
          var data = { title: "Admit Card", text: (card.examName || "") + " — Roll " + card.roll };
          if (navigator.canShare && navigator.canShare({ files: [f] })) data.files = [f];
          navigator.share(data).catch(function () {});
        });
      });
      sh.appendChild(x); sh.appendChild(im); sh.appendChild(bar); ov.appendChild(sh);
      ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });
      document.body.appendChild(ov);
    });
  }

  /* ---------- student side ---------- */
  function cfgOn() { try { return !(root.SNAP_CONFIG && root.SNAP_CONFIG.admitCard === false); } catch (e) { return true; } }
  function sMobile() { try { var s = typeof root.getStudentSession === "function" ? root.getStudentSession() : null; return s && s.mobile ? String(s.mobile).replace(/\D/g, "").slice(-10) : ""; } catch (e) { return ""; } }
  function ck(m) { return "snap_admit_" + m; }
  function readCache(m) { try { return JSON.parse(localStorage.getItem(ck(m)) || "null") || { at: 0, cards: [] }; } catch (e) { return { at: 0, cards: [] }; } }
  function writeCache(m, cards) { try { localStorage.setItem(ck(m), JSON.stringify({ at: Date.now(), cards: cards })); } catch (e) {} }
  function today() { var d = new Date(), p = function (n) { return String(n).padStart(2, "0"); }; return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); }
  function upcoming(cards) { var t = today(); return (cards || []).filter(function (c) { return !c.date || c.date >= t; }); }

  function fetchCards(m, force) {
    var c = readCache(m), db = typeof root.getDB === "function" ? root.getDB() : null;
    if (!db) return Promise.resolve(c.cards);
    if (!force && Date.now() - c.at < 20 * 3600 * 1000) return Promise.resolve(c.cards);
    return db.collection("studentAdmitCards").where("mobile", "==", m).get().then(function (q) {
      var cards = q.docs.map(function (d) { var x = d.data(); x.id = d.id; delete x.issuedAt; return x; });
      cards.sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); });
      writeCache(m, cards); return cards;
    }).catch(function () { return c.cards; });
  }
  function myPhoto(m) {
    var db = typeof root.getDB === "function" ? root.getDB() : null; if (!db) return Promise.resolve(null);
    return db.collection("students").doc(m).get().then(function (d) { return d.exists ? (d.data().photoDataUrl || null) : null; }).catch(function () { return null; });
  }
  function setBadge(n) {
    var b = document.getElementById("cd-admit-badge"); if (b) b.textContent = n > 0 ? n + " Naya" : "Admit";
  }
  function openList() {
    var m = sMobile(); if (!m) { alert("Pehle student login karein."); return; }
    var old = document.getElementById("snap-admit-list"); if (old) old.remove();
    var ov = document.createElement("div"); ov.id = "snap-admit-list"; ov.className = "test-analysis-overlay examgr-overlay-full";
    var sh = document.createElement("div"); sh.className = "test-analysis-sheet ros-sheet";
    var x = document.createElement("button"); x.type = "button"; x.className = "test-analysis-close"; x.textContent = "✕"; x.onclick = function () { ov.remove(); };
    var tt = document.createElement("div"); tt.className = "test-analysis-title"; tt.textContent = "🎫 Mere Admit Cards";
    var body = document.createElement("div"); body.textContent = "⏳ Load ho raha hai...";
    sh.appendChild(x); sh.appendChild(tt); sh.appendChild(body); ov.appendChild(sh);
    ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); }); document.body.appendChild(ov);
    fetchCards(m, true).then(function (cards) {
      body.textContent = ""; setBadge(upcoming(cards).length);
      if (!cards.length) { var e = document.createElement("div"); e.className = "examgr-empty"; e.textContent = "Abhi koi Admit Card jaari nahi hua. Jab institute test ke liye card bhejega, yahin dikhega."; body.appendChild(e); return; }
      var photoP = null;
      cards.forEach(function (cd) {
        var row = document.createElement("div"); row.className = "examgr-report-row ros-cardrow";
        var l = document.createElement("div"); l.className = "ros-cardrow-l";
        var a = document.createElement("strong"); a.textContent = cd.examName || "Exam";
        var b = document.createElement("span"); b.className = "muted-text"; b.textContent = prettyDate(cd.date) + (cd.time ? " • " + cd.time : "") + " • Roll " + (cd.roll || "-");
        l.appendChild(a); l.appendChild(b);
        var v = document.createElement("button"); v.type = "button"; v.className = "btn-primary"; v.textContent = "Dekhein";
        v.onclick = function () { v.disabled = true; photoP = photoP || myPhoto(m); photoP.then(function (p) { return preview(cd, p); }).then(function () { v.disabled = false; }); };
        row.appendChild(l); row.appendChild(v); body.appendChild(row);
      });
    });
  }
  function inject() {
    if (!cfgOn() || document.getElementById("cd-admit-card-btn")) return;
    var grid = document.querySelector("#student-dashboard-home .cd-grid"); if (!grid) return;
    var b = document.createElement("button"); b.type = "button"; b.id = "cd-admit-card-btn"; b.className = "cd-card cd-indigo";
    b.innerHTML = '<div class="cd-card-top"><div class="cd-icon-circle">🎫</div><span class="cd-badge" id="cd-admit-badge">Admit</span></div><div class="cd-card-title">Admit Card</div><div class="cd-card-sub">Roll No aur exam details</div><div class="cd-card-bottom"><span class="cd-arrow-btn">→</span></div>';
    b.onclick = openList; grid.appendChild(b);
    var m = sMobile(); if (m) { setBadge(upcoming(readCache(m).cards).length); fetchCards(m, false).then(function (c) { setBadge(upcoming(c).length); }); }
  }
  function boot() { try { inject(); } catch (e) { console.warn("[admit-card]", e); } }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
    document.addEventListener("click", function (e) { var t = e.target; if (t && t.closest && t.closest("#student-login-form,#student-register-form")) setTimeout(boot, 1500); }, true);
  }

  var api = { render: render, preview: preview, admitId: admitId, prettyDate: prettyDate, maskMobile: maskMobile, DEFAULT_NOTES: DEFAULT_NOTES, W: W, H: H, upcoming: upcoming, openList: openList };
  root.SnapAdmit = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
