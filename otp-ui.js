/* v330 — Email OTP popup (SnapOtp). Student: naya device / pehla login / password reset. Admin + Owner: har login.
   Worker (/student/otp-*, /admin/otp-*) code bhejta aur jaanchta hai; ye file sirf popup + flow hai. Kabhi throw nahi karti jab OTP chalu hi na ho.
   Hafka: popup sirf tab banta hai jab Worker "otpRequired" kahe — normal login me koi extra request/lag nahi. */
(function () {
  "use strict";
  var CSS = "#snap-otp{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.6);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}" +
    "#snap-otp .so-box{background:#fff;color:#0f172a;width:100%;max-width:380px;border-radius:16px;padding:20px;box-shadow:0 20px 50px rgba(0,0,0,.35)}" +
    "#snap-otp h3{margin:0 0 6px;font-size:1.05rem}#snap-otp p{margin:6px 0;font-size:.86rem;color:#475569;line-height:1.45}" +
    "#snap-otp input[type=email],#snap-otp input[type=text]{width:100%;box-sizing:border-box;padding:12px;margin:8px 0;border:1px solid #cbd5e1;border-radius:10px;font-size:1rem}" +
    "#snap-otp #so-code{letter-spacing:.5em;text-align:center;font-size:1.3rem}" +
    "#snap-otp .so-row{display:flex;gap:8px;margin-top:10px}#snap-otp button{flex:1;padding:12px;border:0;border-radius:10px;font-weight:700;font-size:.92rem;cursor:pointer}" +
    "#snap-otp .so-p{background:#4f46e5;color:#fff}#snap-otp .so-s{background:#e2e8f0;color:#0f172a}#snap-otp button:disabled{opacity:.55;cursor:default}" +
    "#snap-otp .so-err{color:#b91c1c;font-size:.82rem;min-height:1.1em;margin-top:4px}#snap-otp label.so-rem{display:flex;gap:8px;align-items:center;font-size:.82rem;color:#334155;margin:6px 0}";
  function $(r, s) { return r.querySelector(s); }
  function msg(e) { return String((e && e.message) || e || "Kuch galat hua. Dobara try karein."); }

  /* opts: { title, needEmail, masked, remember, send(email)->{otpId,sentTo}, verify(code,otpId,remember)->result }  => Promise(result) */
  function ui(opts) {
    return new Promise(function (resolve, reject) {
      try { var old = document.getElementById("snap-otp"); if (old) old.remove(); } catch (e) {}
      if (!document.getElementById("snap-otp-css")) { var st = document.createElement("style"); st.id = "snap-otp-css"; st.textContent = CSS; document.head.appendChild(st); }
      var w = document.createElement("div"); w.id = "snap-otp";
      w.innerHTML = '<div class="so-box" role="dialog" aria-modal="true"><h3></h3><p class="so-info"></p>' +
        '<div id="so-s1"><input type="email" id="so-email" placeholder="aapka email" autocomplete="email" inputmode="email"><div class="so-row"><button class="so-s" id="so-c1" type="button">Cancel</button><button class="so-p" id="so-send" type="button">Code bhejein</button></div></div>' +
        '<div id="so-s2" style="display:none"><input type="text" id="so-code" placeholder="••••••" inputmode="numeric" autocomplete="one-time-code" maxlength="6">' +
        '<label class="so-rem" id="so-remw"><input type="checkbox" id="so-rem" checked> Is device ko 30 din yaad rakhein</label>' +
        '<div class="so-row"><button class="so-s" id="so-c2" type="button">Cancel</button><button class="so-s" id="so-re" type="button" disabled>Dobara bhejein</button><button class="so-p" id="so-ok" type="button">Verify</button></div></div>' +
        '<div class="so-err" id="so-err" aria-live="polite"></div></div>';
      document.body.appendChild(w);
      $(w, "h3").textContent = opts.title || "Email verification";
      var info = $(w, ".so-info"), err = $(w, "#so-err"), s1 = $(w, "#so-s1"), s2 = $(w, "#so-s2"), email = $(w, "#so-email"), code = $(w, "#so-code"),
        sendB = $(w, "#so-send"), okB = $(w, "#so-ok"), reB = $(w, "#so-re"), otpId = "", timer = 0, busy = false;
      if (!opts.remember) $(w, "#so-remw").style.display = "none";
      function close() { clearInterval(timer); try { w.remove(); } catch (e) {} }
      function cancel() { close(); reject(new Error("Email verification cancel ho gayi.")); }
      function cool(sec) { clearInterval(timer); reB.disabled = true; var n = sec; reB.textContent = "Dobara (" + n + "s)"; timer = setInterval(function () { n--; if (n <= 0) { clearInterval(timer); reB.disabled = false; reB.textContent = "Dobara bhejein"; } else reB.textContent = "Dobara (" + n + "s)"; }, 1000); }
      async function doSend() {
        if (busy) return; busy = true; err.textContent = ""; sendB.disabled = true; reB.disabled = true;
        try {
          var r = await opts.send(opts.needEmail ? email.value.trim().toLowerCase() : "");
          otpId = r.otpId; s1.style.display = "none"; s2.style.display = ""; info.textContent = "Code " + (r.sentTo || "aapke email") + " par bheja gaya hai (10 minute tak chalega).";
          code.value = ""; code.focus(); cool(60);
        } catch (e) { err.textContent = msg(e); sendB.disabled = false; reB.disabled = false; }
        busy = false;
      }
      async function doVerify() {
        if (busy) return; var c = code.value.replace(/\D/g, ""); if (c.length !== 6) { err.textContent = "6 ank ka code likhein."; return; }
        busy = true; err.textContent = ""; okB.disabled = true;
        try { var res = await opts.verify(c, otpId, $(w, "#so-rem").checked); close(); resolve(res); return; }
        catch (e) { err.textContent = msg(e); okB.disabled = false; code.select(); }
        busy = false;
      }
      $(w, "#so-c1").onclick = cancel; $(w, "#so-c2").onclick = cancel; sendB.onclick = doSend; reB.onclick = doSend; okB.onclick = doVerify;
      code.addEventListener("keydown", function (e) { if (e.key === "Enter") doVerify(); }); email.addEventListener("keydown", function (e) { if (e.key === "Enter") doSend(); });
      if (opts.needEmail) { info.textContent = "Surakshit login ke liye apna email jodein. Us par ek 6 ank ka code aayega (ek hi baar)."; email.focus(); }
      else { info.textContent = "Surakshit login: aapke email (" + (opts.masked || "") + ") par code bheja ja raha hai…"; s1.style.display = "none"; doSend(); }
    });
  }

  /* STUDENT — ctx: { post, purpose: "login" | "reset" }. initial = Worker ka otpRequired jawab. Result: login => {token, student, deviceToken}, reset => {proof} */
  function student(initial, ctx) {
    return ui({
      title: ctx.purpose === "reset" ? "Password reset — email verification" : "Email verification",
      needEmail: !!initial.needEmail, masked: initial.maskedEmail || "", remember: ctx.purpose !== "reset",
      send: function (email) { return ctx.post("/student/otp-send", { challenge: initial.challenge, email: email || undefined }); },
      verify: function (code, otpId, remember) { return ctx.post("/student/otp-verify", { challenge: initial.challenge, otpId: otpId, code: code, remember: !!remember }); }
    });
  }

  /* ADMIN / OWNER — Firebase email login ke BAAD. OTP chalu na ho / Worker na mile to rukta nahi (rules/Worker khud enforce karte hain jab enforcement ON ho).
     Cancel ya fail par signOut karke error. authInst = firebase.auth() (ya owner ka alag auth). */
  async function admin(authInst) {
    var A = window.SnapAuth, cfg = window.SNAP_CONFIG || {};
    var u = authInst && authInst.currentUser;
    if (!u || !A || !A.post || !cfg.workerUrl) return true;
    var c;
    try { c = await A.post("/admin/otp-config", { idToken: await u.getIdToken() }); } catch (e) { return true; }
    if (!c || !c.required || c.verified) return true;
    try {
      await ui({
        title: "Admin email verification", needEmail: false, masked: "aapke login email", remember: false,
        send: async function () { return A.post("/admin/otp-send", { idToken: await u.getIdToken() }); },
        verify: async function (code, otpId) { return A.post("/admin/otp-verify", { idToken: await u.getIdToken(), otpId: otpId, code: code }); }
      });
      await u.getIdToken(true);                    /* naye claim (otpAuth) wala token */
      return true;
    } catch (e) { try { await authInst.signOut(); } catch (e2) {} throw e; }
  }
  window.SnapOtp = { student: student, admin: admin };
})();
