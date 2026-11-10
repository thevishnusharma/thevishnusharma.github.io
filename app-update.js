/* v159 — APK auto-update (sirf Android app me; website/browser par kuch nahi karta).
   Kaise kaam karta hai:
   1) GitHub Actions jab naya signed APK banata hai to GitHub Release me daalta hai aur repo ki app-version.json me
      naya build number + download link likh deta hai.
   2) App khulte hi (aur wapas aane par) ye file app-version.json padhti hai (GitHub raw se — service worker cache se nahi).
   3) Agar naya build mila to "Naya APK aaya hai" dialog aata hai -> Download -> Android installer -> Install. */
(function () {
  "use strict";
  var VERSION_URL = "https://raw.githubusercontent.com/thevishnusharma/thevishnusharma.github.io/main/app-version.json";
  var SNOOZE_KEY = "snap_apk_snooze_v1", LAST_KEY = "snap_apk_lastcheck_v1";
  var state = { available: false, checked: false, build: 0, name: "", url: "", notes: "", force: false, installedBuild: 0, installedName: "" };
  window.SnapAppUpdate = { state: state, check: function () { return Promise.resolve(state); }, open: function () {}, show: function () {} };

  function getCap() {
    var w = []; try { if (window.top) w.push(window.top); } catch (e) {}
    try { if (window.parent && window.parent !== window.top) w.push(window.parent); } catch (e) {}
    w.push(window);
    for (var i = 0; i < w.length; i++) { try { var c = w[i].Capacitor; if (c && typeof c.nativePromise === "function") return c; } catch (e) {} }
    return null;
  }
  var cap = getCap();
  if (!cap || window.top !== window) return;               // browser / iframe: kuch nahi

  function toast(m, ms) {
    try { var b = document.createElement("div"); b.textContent = m;
      b.style.cssText = "position:fixed;left:50%;bottom:30px;transform:translateX(-50%);background:#1e1b4b;color:#fff;padding:11px 18px;border-radius:22px;font-size:.84rem;z-index:2147483647;max-width:90vw;text-align:center;box-shadow:0 6px 18px rgba(0,0,0,.35);pointer-events:none";
      document.body.appendChild(b); setTimeout(function () { b.remove(); }, ms || 4500); } catch (e) {}
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  var installedP = null;
  function installed() {
    if (!installedP) installedP = cap.nativePromise("App", "getInfo", {}).then(function (i) { return { build: parseInt(i && i.build, 10) || 0, name: (i && i.version) || "", id: (i && i.id) || "" }; }).catch(function () { return { build: 0, name: "" }; });
    return installedP;
  }
  function fetchInfo() {
    var ctrl = window.AbortController ? new AbortController() : null, t = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, 8000);
    return fetch(VERSION_URL + "?t=" + Date.now(), { cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { clearTimeout(t); if (!r.ok) throw new Error("http " + r.status); return r.json(); });
  }
  function examActive() {                                    // exam/solution ke beech dialog nahi (index.html wala same rule)
    try {
      var vis = function (el) { if (!el || el.classList.contains("hidden")) return false; var cs = getComputedStyle(el); return cs.display !== "none" && cs.visibility !== "hidden"; };
      if (vis(document.getElementById("exam-screen")) && typeof current !== "undefined" && current && current.test) return true;
      return vis(document.getElementById("solution-screen"));
    } catch (e) { return true; }
  }
  function snoozed(build) { try { var s = JSON.parse(localStorage.getItem(SNOOZE_KEY) || "null"); return !!(s && s.build === build && s.until > Date.now()); } catch (e) { return false; } }
  function snooze(build) { try { localStorage.setItem(SNOOZE_KEY, JSON.stringify({ build: build, until: Date.now() + 12 * 3600 * 1000 })); } catch (e) {} }

  function check(opts) {
    opts = opts || {};
    return Promise.all([installed(), fetchInfo()]).then(function (a) {
      var inst = a[0], apk = (a[1] && a[1].apk) || {}, latest = parseInt(apk.build, 10) || 0;
      state.checked = true; state.installedBuild = inst.build; state.installedName = inst.name;
      state.build = latest; state.name = String(apk.name || ""); state.url = String(apk.url || ""); state.notes = String(apk.notes || "");
      state.available = !!(inst.build && latest > inst.build && /^https:\/\/github\.com\//.test(state.url)) && !/^com\.snaptestpro\.i[a-z0-9]/.test(inst.id || "");   /* v175: institute APK ko main app ka update prompt nahi */
      state.force = !!(apk.force && state.available);
      try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch (e) {}
      try { window.dispatchEvent(new CustomEvent("snap-apk-update", { detail: state })); } catch (e) {}
      if (state.available && (opts.manual || state.force || !snoozed(latest))) whenIdle(0);
      return state;
    }).catch(function (e) { console.warn("[SnapAppUpdate]", e && e.message || e); return state; });
  }
  function whenIdle(n) { if (!state.available) return; if (examActive() && n < 40) return void setTimeout(function () { whenIdle(n + 1); }, 45000); show(); }

  function show() {
    if (!state.available || document.getElementById("sau-ov")) return;
    var ov = document.createElement("div"); ov.id = "sau-ov";
    ov.style.cssText = "position:fixed;inset:0;z-index:2147483600;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:22px;font-family:Inter,'Segoe UI',Arial,sans-serif";
    var notes = state.notes ? '<div style="margin-top:10px;background:#f1f5f9;border-radius:12px;padding:10px 12px;font-size:.8rem;color:#334155;line-height:1.5;text-align:left;white-space:pre-line;max-height:120px;overflow:auto">' + esc(state.notes) + "</div>" : "";
    ov.innerHTML = '<div style="background:#fff;color:#0f172a;border-radius:22px;max-width:360px;width:100%;padding:22px 20px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.4)">' +
      '<div style="width:64px;height:64px;border-radius:20px;margin:0 auto 12px;background:linear-gradient(135deg,#fbbf24,#ea580c);display:flex;align-items:center;justify-content:center;color:#fff"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M6 11l6 6 6-6M4 21h16"/></svg></div>' +
      '<div style="font-size:1.1rem;font-weight:800">Naya APK aaya hai</div>' +
      '<div style="font-size:.82rem;color:#64748b;margin-top:6px;line-height:1.5">' + (state.name ? "Version <b>" + esc(state.name) + "</b> taiyaar hai. " : "") + (state.force ? "Ye zaroori update hai — app chalane ke liye install karna hoga." : "Behtar app ke liye abhi update kar lein.") + "</div>" + notes +
      '<button id="sau-go" style="margin-top:16px;width:100%;border:0;border-radius:14px;padding:13px;font-weight:700;font-size:.95rem;color:#fff;cursor:pointer;background:linear-gradient(135deg,#f97316,#c2410c);box-shadow:0 6px 14px rgba(234,88,12,.35)">Download &amp; Update karein</button>' +
      (state.force ? "" : '<button id="sau-later" style="margin-top:8px;width:100%;border:0;border-radius:14px;padding:11px;font-weight:700;font-size:.85rem;color:#475569;background:#f1f5f9;cursor:pointer">Baad mein</button>') +
      '<div style="font-size:.7rem;color:#94a3b8;margin-top:12px;line-height:1.5">Download hone ke baad file par tap karke <b>Install</b> dabayein. Pehli baar Android "is source se install" ki permission maang sakta hai — Allow kar dein. Aapka data aur login bana rahega.</div></div>';
    document.body.appendChild(ov);
    ov.querySelector("#sau-go").onclick = function () { openDownload(); };
    var later = ov.querySelector("#sau-later"); if (later) later.onclick = function () { snooze(state.build); ov.remove(); };
  }
  function fastUrl(u) {                                   /* v288: Cloudflare ke raste tez download (ping ok ho tabhi) */
    var W = "https://cool-thunder-a280.vishnu1234stm.workers.dev", m = /^https:\/\/github\.com\/[^\/]+\/[^\/]+\/releases\/download\/([^\/]+)\/([^\/]+\.apk)$/.exec(u);
    if (!m) return Promise.resolve(u);
    var ctrl = window.AbortController ? new AbortController() : null, t = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, 3000);
    var p = W + "/apk/" + m[1] + "/" + m[2];
    return fetch(p, { method: "HEAD", signal: ctrl ? ctrl.signal : undefined }).then(function (r) { clearTimeout(t); return r.ok ? p : u; }).catch(function () { return u; });
  }
  function openDownload() {
    var url = state.url; if (!url || !/^https:\/\/github\.com\//.test(url)) return;
    fastUrl(url).then(function (u) { openDownload2(u, url); });
  }
  function openDownload2(url, orig) {
    toast("⬇️ Download shuru — poora hone par file par tap karke Install karein", 6000);
    /* v288: Browser.open (Chrome Custom Tab) me download 100% par atak jata tha. Bahari link par Capacitor
       system browser (Chrome) kholta hai — wahan normal download + notification + Open milta hai. */
    try { window.location.href = url; } catch (e) { cap.nativePromise("Browser", "open", { url: url }).catch(function () {}); }
  }

  window.SnapAppUpdate = { state: state, check: check, open: openDownload, show: show };
  setTimeout(function () { check({}); }, 5000);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") return;
    var last = 0; try { last = parseInt(localStorage.getItem(LAST_KEY) || "0", 10) || 0; } catch (e) {}
    if (Date.now() - last > 20 * 60 * 1000) check({});
  });
})();
