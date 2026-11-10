
  // ══════════════════════════════════════════════════════════════
  // AUTO-UPDATE PWA — SILENT + EXAM-SAFE (v2)
  // ------------------------------------------------------------------
  // Pehle: naya Service Worker activate hote hi TURANT location.reload()
  // ho jaata tha — chahe student beech exam mein hi kyun na ho. Isse
  // exam ke beech screen achanak reload ho sakti thi (disruptive, aur
  // "reload hua" dikh bhi jaata tha).
  //
  // Ab: update mil jaaye to turant reload NAHI karte. Bas ek flag
  // (pendingAppUpdate) set kar dete hain aur reload ko TAAL dete hain
  // jab tak koi "safe moment" na aaye:
  //   - Exam/Solution screen active ho to reload BILKUL nahi hota
  //     (chahe student app ko background mein bhi bhej de).
  //   - Reload sirf tab hota hai jab app EK SAATH do sharten poori
  //     kare: (a) exam active NAHI hai, aur (b) tab/app abhi
  //     background mein gaya hai (visibilitychange → hidden). Matlab
  //     reload hamesha tabhi hota hai jab student screen dekh hi nahi
  //     raha — wapas aane par unhe seedha updated app dikhega, bina
  //     kisi flicker/reload ke ehsaas ke. Isse update 100% silent
  //     mehsoos hota hai.
  //   - Agar student kabhi background hi nahi karta (app khula rakhta
  //     hai), to update agli baar naya tab/session khulne par apne aap
  //     lag jaata hai (index.html ke top wala "AUTO HARD-REFRESH"
  //     block yahi kaam already karta hai) — is se bhi student ko kuch
  //     dikhta nahi.
  // ══════════════════════════════════════════════════════════════
  function isExamOrSolutionActive() {
    try {
      var examEl = document.getElementById('exam-screen');
      var solEl = document.getElementById('solution-screen');
      function vis(el) {
        if (!el || el.classList.contains('hidden')) return false;
        var cs = window.getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden';
      }
      if (vis(examEl) && typeof current !== 'undefined' && current && current.test) return true;
      if (vis(solEl)) return true;
      return false;
    } catch (e) {
      // Pata na chal paye to safest maan lo ki exam active hai —
      // matlab reload ko taalna hi behtar hai.
      return true;
    }
  }

  if ('serviceWorker' in navigator) {
    let swRegistration = null;
    let pendingAppUpdate = false;

    navigator.serviceWorker.register('/sw.js')
      .then(function (reg) {
        swRegistration = reg;
        console.log('Service worker registered:', reg.scope);
        reg.update().catch(function () {});
      })
      .catch(function (err) { console.warn('Service worker registration failed:', err); });

    // Naya SW control le chuka hai — reload turant NAHI, bas flag set.
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      pendingAppUpdate = true;
    });
    // v168: SW ne background me koi file nayi pakdi (JS/CSS/HTML) -> reload flag. Reload sirf app background me jaate waqt hota hai
    // (upar visibilitychange), exam/solution ke beech kabhi nahi — isliye student ko kuch dikhta nahi aur agli baar naya version milta hai.
    navigator.serviceWorker.addEventListener('message', function (ev) {
      if (ev && ev.data && ev.data.type === 'snap-asset-updated') pendingAppUpdate = true;
    });

    // App foreground mein wapas aaye to fresh update-check karo, aur
    // agar background jaate waqt update pending tha to (safe waqt
    // par) silently reload kar do.
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        if (pendingAppUpdate && !isExamOrSolutionActive()) {
          pendingAppUpdate = false;
          location.reload();
        }
      } else if (document.visibilityState === 'visible' && swRegistration) {
        swRegistration.update().catch(function () {});
      }
    });

    // App khula rehte hue bhi periodically check karte raho.
    setInterval(function () {
      if (document.visibilityState === 'visible' && swRegistration) {
        swRegistration.update().catch(function () {});
      }
    }, 60 * 1000);
  }

  // ══════════════════════════════════════════════════════════════
  // EXAM REFRESH-LOCK — student exam ke beech manually refresh
  // (F5 / Ctrl+R / pull-to-refresh) karke test ko reset/escape na
  // kar paaye, isliye:
  //   1) F5 aur Ctrl/Cmd+R keyboard shortcut ko exam ke dauraan
  //      rok dete hain (jahan browser ijazat de).
  //   2) Mobile par upar se "pull to refresh" gesture exam screen
  //      par disable kar dete hain.
  //   3) Agar phir bhi koi refresh/close/tab-close try kare, browser
  //      ka native "changes may be lost" confirm dialog dikhega
  //      (beforeunload) — poori tarah block karna browser security
  //      ki wajah se possible nahi hai, lekin ye strong warning +
  //      friction de deta hai.
  // ══════════════════════════════════════════════════════════════
  document.addEventListener('keydown', function (e) {
    if (!isExamOrSolutionActive()) return;
    var isRefreshKey = e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'));
    if (isRefreshKey) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // ══════════════════════════════════════════════════════════════
  // PULL-TO-REFRESH DISABLE — poori app mein (sirf exam mein nahi)
  // ------------------------------------------------------------------
  // Mobile browsers/installed-PWA mein upar se neeche swipe karne par
  // page apne aap reload ho jaata hai (browser ka built-in gesture) —
  // isse student kahin bhi (home screen, student form, admin, exam,
  // sab jagah) achanak reload dekh sakta tha. CSS ka
  // overscroll-behavior-y kaafi browsers mein isse rok deta hai, lekin
  // kuch installed/TWA environments mein akela kaafi nahi hota — isliye
  // yahan JS se bhi (globally, har screen par) rok rahe hain.
  // ══════════════════════════════════════════════════════════════
  (function () {
    var touchStartY = 0;
    var startTarget = null;

    function nearestScrollable(el) {
      while (el && el !== document.body && el !== document.documentElement) {
        var cs = window.getComputedStyle(el);
        if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
          return el;
        }
        el = el.parentElement;
      }
      return null;
    }

    document.addEventListener('touchstart', function (e) {
      if (e.touches && e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
        startTarget = e.target;
      }
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      var y = e.touches && e.touches[0] ? e.touches[0].clientY : touchStartY;
      var pullingDown = y > touchStartY;
      if (!pullingDown) return;

      // Agar touch kisi andar wale scrollable box (modal/list) ke
      // andar shuru hua tha aur wo box abhi top par nahi hai, to use
      // apna normal internal-scroll karne dete hain — sirf jab wo box
      // khud bhi top par ho (ya koi scrollable box hai hi nahi) tabhi
      // pull-to-refresh gesture rokte hain.
      var scrollable = nearestScrollable(startTarget);
      if (scrollable && scrollable.scrollTop > 0) return;

      if (window.scrollY <= 0) {
        e.preventDefault();
      }
    }, { passive: false });
  })();

  window.addEventListener('beforeunload', function (e) {
    if (!isExamOrSolutionActive()) return;
    e.preventDefault();
    e.returnValue = '';
    return '';
  });
