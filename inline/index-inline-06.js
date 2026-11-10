
  (function () {
    var LIBS = {
      chart:    ["https://cdn.jsdelivr.net/npm/chart.js"],
      tesseract:["https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"],
      xlsx:     ["https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"],
      html2pdf: ["https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"],
      jspdf:    ["https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js"],
      docx:     ["https://cdn.jsdelivr.net/npm/docx@9.7.1/dist/index.iife.js"],
      confetti: ["https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"],
      pdfjs:    ["https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"],
      // Question-bank files (local, same-origin) — Admin ke "Seed All
      // Questions" button ke liye, normal student flow use nahi karta.
      qb_math:      ["mathematics-question-bank.js"],
      qb_history:   ["history-question-bank.js"],
      qb_hist_india:["History-India-question-bank.js"],
      qb_indochina: ["history-indochina-question-bank.js"],
      qb_socialism: ["socialism-question-bank.js"],
      // katex auto-render, core par depend karta hai isliye 2 URLs
      // sequence mein (ensureLib in dono ko order mein load karta hai).
      katex:    ["https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js",
                 "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js"],
      // v120: ab local (same-origin) owner-panel.js aur exam-manager.js
      // bhi isi on-demand loader se load hoti hain — pehle dono
      // <script defer> se har page load par eager download hoti thin.
            examManager: ["exam-manager.js?v=9", "exam-roster.js?v=2", "exam-registration.js?v=2", "scan-extras.js?v=1"],
      // v125: 3D Solids Lab — React + Three.js + Babel-standalone (JSX
      // ko browser mein hi compile karta hai, kyunki app khud koi
      // build-step use nahi karta) — sab kuch sirf tabhi load hota hai
      // jab koi is feature ko khole (Student ya Admin, dono se).
      solidsLab: [
        "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
        "https://unpkg.com/@babel/standalone@7/babel.min.js",
        "solids-lab-boot.js?v=1"
      ]
    };
    var pending = {};
    function loadOne(src) {
      return new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    // window.__ensureLib("xlsx") -> Promise. Pehli baar call hone par
    // hi actual library download shuru hota hai; uske baad har call
    // wahi cached Promise return karti hai (dobara download nahi hota).
    window.__ensureLib = function (key) {
      if (pending[key]) return pending[key];
      var urls = LIBS[key] || [];
      var chain = Promise.resolve();
      urls.forEach(function (url) {
        chain = chain.then(function () { return loadOne(url); });
      });
      pending[key] = chain;
      return chain;
    };

    // v120: SAVYA_CLASS_OPTIONS pehle sirf owner-panel.js (ab lazy) mein
    // define thi. script.js/exam-manager.js/id-card.js sab
    // "window.SAVYA_CLASS_OPTIONS || <fallback>" pattern se ise turant
    // (page-load par hi) use karte hain — agar yahan eager define na
    // karein to owner-panel.js load hone tak sabko chhota, adhoora
    // fallback list milta rahega. Yeh asli list ki hi copy hai; jab
    // owner-panel.js baad mein load hoti hai to wahi values dobara
    // (harmless) assign kar deti hai.
    if (!window.SAVYA_CLASS_OPTIONS) {
      window.SAVYA_CLASS_OPTIONS = [
        { id: "class_9", label: "Class 9" },
        { id: "class_10", label: "Class 10" },
        { id: "class_11", label: "Class 11" },
        { id: "class_12", label: "Class 12" }
      ];
    }

    // v179: Owner Panel entry hata diya (alag Owner APK). Exam Manager ke liye safe wrapper neeche rehta hai.
    window.__examgrOpenRegSafe = function () {
      window.__ensureLib("examManager").then(function () {
        if (window.SnapReg) window.SnapReg.open();
      });
    };
    window.__examgrOpenAddSafe = function () {
      window.__ensureLib("examManager").then(function () {
        if (typeof window.examgrOpenAdd === "function") window.examgrOpenAdd();
      });
    };
  })();
