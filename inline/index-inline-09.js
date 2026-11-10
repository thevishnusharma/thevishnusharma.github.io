
  // ══════════════════════════════════════════════════════════════
  // PWA "Install App" popup — SABHI devices/browsers ke liye
  // ------------------------------------------------------------------
  // - Chrome / Edge / Android / Samsung Internet / Brave / Opera:
  //   native "beforeinstallprompt" pakad kar seedha install-popup
  //   dikhate hain, "Install Karein" click par asli browser dialog
  //   khulta hai.
  // - iOS Safari, macOS Safari, Firefox (koi bhi platform) — inme
  //   browser khud koi install-event nahi deta, isliye wahan sahi
  //   manual steps (Share → Add to Home Screen, ya Menu → Install)
  //   ek popup mein dikhate hain.
  // - Agar app pehle se installed hai (standalone mode), to kabhi
  //   popup nahi dikhega.
  // - v2 (24h cooldown fix, 2026-08-29): pehle ye HAR page-load par
  //   dikhta tha, chahe "Baad Mein" abhi-abhi dabaya ho — is wajah se
  //   poori screen (Admin tab button samet) block ho jaati thi jab tak
  //   popup band na karo, jo baar-baar test/reload karne walon (jaise
  //   admin khud, laptop browser par) ke liye bahut disruptive tha.
  //   Ab har baar dikhne (auto ya manual, dono) ke waqt is waqt ka
  //   timestamp localStorage mein save hota hai, aur agla AUTO-show
  //   (DOMContentLoaded wala) sirf tab hota hai jab last-shown se 24
  //   ghante ho chuke hon. Header ke "⬇️ App Install Karein" button se
  //   MANUAL trigger is cooldown se kabhi affected nahi hota — wo
  //   hamesha turant khulta hai.
  // ══════════════════════════════════════════════════════════════
  let deferredInstallPrompt = null;
  const INSTALL_POPUP_LAST_SHOWN_KEY = 'savya_install_popup_last_shown';
  const INSTALL_POPUP_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 ghante

  function isStandaloneMode() {
    return window.__IS_APP === true
      || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || window.navigator.standalone === true; // iOS Safari ka apna flag
  }

  function detectPlatformInstructions() {
    const ua = window.navigator.userAgent || '';
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isAndroid = /android/i.test(ua);
    const isFirefox = /firefox|fxios/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|chrome|android|edg/i.test(ua);

    if (isIos) {
      return 'Neeche diye Share button ⬆️ par tap karein, phir "Add to Home Screen" chunein.';
    }
    if (isAndroid && isFirefox) {
      return 'Upar-daayein 3-dot menu kholein aur "Install" ya "Add to Home screen" chunein.';
    }
    if (!isAndroid && !isIos && isFirefox) {
      return 'Firefox is site ko app ki tarah install support nahi karta. Chrome ya Edge browser mein kholein taaki "Install Karein" button seedha kaam kare.';
    }
    if (!isAndroid && !isIos && isSafari) {
      return 'Menu bar mein File → "Add to Dock" chunein (Safari 17+), ya Chrome/Edge browser mein kholein.';
    }
    // Generic Chromium fallback (agar beforeinstallprompt na mile)
    return 'Address bar ke daayein taraf install icon ⊕ par click karein, ya browser ke 3-dot menu mein "Install App" dhoondein.';
  }

  // Chrome/Edge/Android etc. sirf tab hi native "beforeinstallprompt" bhejte
  // hain jab unke apne engagement-heuristics poore ho jaayein — kabhi
  // turant, kabhi kuch second baad. Isi wajah se pehle turant fallback
  // ("address bar dekhein") dikh jaata tha, jabki thoda ruk kar asli
  // native "⬇️ Install Karein" popup mil sakta tha. Ab in Chromium-type
  // browsers ke liye chand second ka wait diya jaata hai — waiting ke
  // dauraan neutral loading text dikhta hai, fallback sirf tab dikhta
  // hai jab sach mein native event nahi milta (ya iOS/Firefox jaise
  // browsers jinme native install event kabhi aata hi nahi).
  function couldGetNativePrompt() {
    const ua = window.navigator.userAgent || '';
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isFirefox = /firefox|fxios/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|chrome|android|edg/i.test(ua);
    return !isIos && !isFirefox && !isSafari; // Chrome/Edge/Samsung/Brave/Opera etc.
  }

  let _installWaitTimer = null;
  let _installWaitGen = 0;

  function showAppInstallModal() {
    if (isStandaloneMode()) return;
    const modal = document.getElementById('app-install-modal');
    const textEl = document.getElementById('app-install-modal-text');
    const actionBtn = document.getElementById('app-install-modal-action-btn');
    if (!modal || !textEl || !actionBtn) return;

    clearTimeout(_installWaitTimer);
    const myGen = ++_installWaitGen; // invalidate any pending wait from a previous call

    if (deferredInstallPrompt) {
      // Chromium browser: asli native install prompt available hai
      textEl.textContent = 'Ek tap mein apne home screen / desktop par app install karein — offline bhi chalegi, aur test dene mein easy hoga.';
      actionBtn.textContent = '⬇️ Install Karein';
      actionBtn.disabled = false;
      actionBtn.onclick = function () {
        if (!deferredInstallPrompt) { modal.classList.add('hidden'); return; }
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.finally(function () {
          deferredInstallPrompt = null;
          modal.classList.add('hidden');
        });
      };
    } else if (couldGetNativePrompt()) {
      // Chrome/Edge/etc — native prompt event abhi tak nahi mila, par mil
      // sakta hai. Neutral loading state dikhao aur thoda wait karo.
      textEl.textContent = 'App taiyaar ho raha hai — ek pal rukein… ⏳';
      actionBtn.textContent = '⬇️ Install Karein';
      actionBtn.disabled = true;
      actionBtn.onclick = null;
      _installWaitTimer = setTimeout(function () {
        if (myGen !== _installWaitGen) return; // popup already updated by something else
        if (deferredInstallPrompt) { showAppInstallModal(); return; } // arrived in the meantime
        // Sach mein nahi mila — ab hi manual fallback dikhao.
        textEl.textContent = detectPlatformInstructions();
        actionBtn.textContent = '👍 Samajh Gaya';
        actionBtn.disabled = false;
        actionBtn.onclick = function () { modal.classList.add('hidden'); };
      }, 4000);
    } else {
      // iOS Safari / Firefox — yahan koi native install event kabhi aata
      // hi nahi, wait karne ka koi fayda nahi, seedha steps dikhao.
      textEl.textContent = detectPlatformInstructions();
      actionBtn.textContent = '👍 Samajh Gaya';
      actionBtn.disabled = false;
      actionBtn.onclick = function () { modal.classList.add('hidden'); };
    }
    modal.classList.remove('hidden');
    try { localStorage.setItem(INSTALL_POPUP_LAST_SHOWN_KEY, String(Date.now())); } catch (e) {}
  }

  function dismissAppInstallModal() {
    const modal = document.getElementById('app-install-modal');
    if (modal) modal.classList.add('hidden');
    clearTimeout(_installWaitTimer);
    _installWaitGen++;
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.getElementById('install-app-btn');
    if (btn && !isStandaloneMode()) btn.classList.remove('hidden');
    // Popup pehle se khula ho (manual-steps version ke saath) to usko
    // turant native "Install Karein" version mein upgrade kar do.
    const modal = document.getElementById('app-install-modal');
    if (modal && !modal.classList.contains('hidden')) showAppInstallModal();
  });

  window.addEventListener('appinstalled', function () {
    deferredInstallPrompt = null;
    const btn = document.getElementById('install-app-btn');
    if (btn) btn.classList.add('hidden');
    dismissAppInstallModal();
  });

  // PERF FIX v127: pehle yeh poora block 'DOMContentLoaded' ka wait
  // karta tha — jo tabhi fire hota hai jab is script se PEHLE wale
  // SAARE `<script defer>` (4 Firebase SDK files + script.js 232 KB +
  // 10+ aur files) poori tarah download+execute ho chuke hon. Yehi
  // is popup (jo screen ka sabse bada visible element hai — LCP
  // candidate) ko kaafi der tak (9+ second) hone se rok raha tha.
  // Is script ki position HTML mein already header/modal HTML ke
  // NEECHE hai — matlab jab parser yahan tak pahunchta hai, upar
  // wale saare elements (#install-app-btn, #app-install-modal)
  // already DOM mein maujood hain. DOMContentLoaded ka wait karne ki
  // koi zaroorat nahi thi — turant chala sakte hain.
  (function () {
    const btn = document.getElementById('install-app-btn');
    // Agar ye app pehle se hi installed/standalone mode mein khuli hai,
    // to Student/Admin install button dikhane ka koi matlab nahi —
    // shuru se hi chhupa do (pehle sirf 'appinstalled' event par hota tha).
    if (btn && isStandaloneMode()) btn.classList.add('hidden');
    if (btn) {
      btn.addEventListener('click', async function () {
        if (!deferredInstallPrompt) { showAppInstallModal(); return; }
        deferredInstallPrompt.prompt();
        try { await deferredInstallPrompt.userChoice; } catch (e) {}
        deferredInstallPrompt = null;
        btn.classList.add('hidden');
      });
    }

    // Site khulte hi SEEDHA popup dikhao (koi delay nahi) — agar
    // already installed nahi hai. Chromium browsers mein
    // "beforeinstallprompt" kabhi-kabhi thodi der baad fire hota hai;
    // agar wo is popup ke khule rehte hue aa jaaye, to beforeinstallprompt
    // listener khud hi popup ko native "Install Karein" version mein
    // upgrade kar deta hai (neeche dekhein) — bina user ko kuch bhi
    // dobara karne ki zaroorat ke.
    if (!isStandaloneMode()) {
      let lastShown = 0;
      try { lastShown = Number(localStorage.getItem(INSTALL_POPUP_LAST_SHOWN_KEY) || 0); } catch (e) {}
      if (Date.now() - lastShown > INSTALL_POPUP_COOLDOWN_MS) {
        showAppInstallModal();
      }
    }
  })();
