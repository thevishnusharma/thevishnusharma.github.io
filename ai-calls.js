/* In-app AI voice announcements. This never places a phone or VoIP call. */
(function () {
  "use strict";
  var OPT_OUT = "savya_ai_calls_optout_v1", PREF_AT = "savya_ai_calls_pref_at_v1";
  var callAudio = null, audioPromise = null, ringTimer = 0, ringContext = null, current = null, turns = [], acceptedAt = 0, listenedSeconds = 0, playbackAt = 0, busy = false, callEpoch = 0, reportChain = Promise.resolve();
  var $ = function (id) { return document.getElementById(id); };
  function cfg() { return window.SNAP_CONFIG || {}; }
  function worker() { return String(cfg().workerUrl || "").replace(/\/+$/, ""); }
  function auth() { try { return typeof getAuth === "function" ? getAuth() : window.vishnuFirebase && window.vishnuFirebase.auth; } catch (e) { return null; } }
  function db() { try { return window.vishnuFirebase && window.vishnuFirebase.enabled ? window.vishnuFirebase.db : (typeof getDB === "function" ? getDB() : null); } catch (e) { return null; } }
  function inst() { try { return typeof getCurrentAdminInstituteId === "function" ? getCurrentAdminInstituteId() : ""; } catch (e) { return ""; } }
  function session() { try { return typeof getStudentSession === "function" ? getStudentSession() : null; } catch (e) { return null; } }
  function text(id) { var e = $(id); return e ? String(e.value || "").trim() : ""; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function toast(s) {
    try { var b = document.createElement("div"); b.textContent = s; b.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;background:#111827;color:#fff;padding:11px 16px;border-radius:13px;max-width:90vw;font:600 14px/1.4 system-ui;box-shadow:0 8px 26px #0005"; document.body.appendChild(b); setTimeout(function () { b.remove(); }, 4200); } catch (e) {}
  }
  async function token() {
    var a = auth(), u = a && a.currentUser;
    if (!u) throw new Error("Pehle app me login karein.");
    return await u.getIdToken();
  }
  async function appCheckToken() {
    try { if (window.firebase && firebase.appCheck) { var r = await firebase.appCheck().getToken(false); return r && r.token || ""; } } catch (e) {}
    return "";
  }
  async function api(path, body, method) {
    var t = await token(), headers = { Authorization: "Bearer " + t, "Content-Type": "application/json" }, ac = await appCheckToken();
    if (ac) headers["X-Firebase-AppCheck"] = ac;
    var res = await fetch(worker() + path, { method: method || "POST", headers: headers, body: body == null ? undefined : JSON.stringify(body), cache: "no-store" });
    var data = {};
    if ((res.headers.get("content-type") || "").indexOf("application/json") >= 0) data = await res.json().catch(function () { return {}; });
    if (!res.ok || data.ok === false) throw new Error(data.error || ("Request fail " + res.status));
    return data;
  }
  function setStatus(id, value) { var e = $(id); if (e) e.textContent = value || ""; }
  function deviceSpeak(value, trackAsAnnouncement) {
    return new Promise(function (resolve) {
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { resolve(false); return; }
      try {
        window.speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(String(value || "")); u.lang = "hi-IN"; u.rate = 0.96;
        var voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [], v = voices.find(function (x) { return /^hi[-_]/i.test(x.lang || ""); });
        if (v) u.voice = v;
        var speechStart = 0;
        u.onstart = function () { if (trackAsAnnouncement) speechStart = Date.now(); };
        u.onend = function () { if (speechStart) { listenedSeconds += (Date.now() - speechStart) / 1000; speechStart = 0; } resolve(true); };
        u.onerror = function () { if (speechStart) { listenedSeconds += (Date.now() - speechStart) / 1000; speechStart = 0; } resolve(false); };
        window.speechSynthesis.speak(u);
        setTimeout(function () { resolve(true); }, 15000);
      } catch (e) { resolve(false); }
    });
  }
  function studentName() { var s = session() || {}; return String(s.name || s.studentName || s.fullName || s.displayName || "").trim().split(/\s+/)[0]; }
  function stopRing() {
    if (ringTimer) { clearInterval(ringTimer); ringTimer = 0; }
    try { if (ringContext) { ringContext.close(); ringContext = null; } } catch (e) {}
    try { navigator.vibrate && navigator.vibrate(0); } catch (e) {}
  }
  function startRing() {
    stopRing();
    try { navigator.vibrate && navigator.vibrate([450, 500, 450, 1000]); } catch (e) {}
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { ringContext = new AC(); if (ringContext.state === "suspended") ringContext.resume().catch(function () {}); }
      var tone = function () {
        if (!ringContext) return;
        [0, 0.22].forEach(function (delay) { var o = ringContext.createOscillator(), g = ringContext.createGain(); o.type = "sine"; o.frequency.value = delay ? 660 : 880; g.gain.setValueAtTime(0.0001, ringContext.currentTime + delay); g.gain.exponentialRampToValueAtTime(0.045, ringContext.currentTime + delay + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, ringContext.currentTime + delay + 0.18); o.connect(g); g.connect(ringContext.destination); o.start(ringContext.currentTime + delay); o.stop(ringContext.currentTime + delay + 0.2); });
      };
      tone(); ringTimer = setInterval(tone, 1800);
    } catch (e) {}
  }
  function report(status) {
    if (!current || !current.callId) return Promise.resolve();
    var callId = current.callId, seconds = Math.floor(listenedSeconds + (playbackAt ? (Date.now() - playbackAt) / 1000 : 0));
    reportChain = reportChain.catch(function () {}).then(function () { return api("/ai-call/report", { callId: callId, status: status, listenedSeconds: seconds }); });
    return reportChain.catch(function () {});
  }
  function studentUI() {
    if ($("ai-call-screen")) return;
    var o = document.createElement("div"); o.id = "ai-call-screen";
    o.innerHTML = '<div class="aic-card"><div class="aic-mark">☎</div><div class="aic-kicker">SAVYASACHI SIR · AI VOICE</div><h2 id="aic-title">Incoming call</h2><p id="aic-sub">Aapke liye ek audio message</p><div class="aic-wave" id="aic-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><p id="aic-state" class="aic-state">Call aa rahi hai…</p><audio id="aic-audio" preload="auto"></audio><div class="aic-controls" id="aic-ring-controls"><button type="button" class="aic-btn decline" id="aic-decline">Decline</button><button type="button" class="aic-btn accept" id="aic-accept">Accept</button></div><div class="aic-controls" id="aic-active-controls" hidden><button type="button" class="aic-btn talk" id="aic-talk">🎙️ Baat karein</button><button type="button" class="aic-btn decline" id="aic-end">Call end</button></div><div id="aic-chat" hidden><div id="aic-chat-status" class="aic-chat-status"></div><div class="aic-chat-row"><input id="aic-input" maxlength="320" placeholder="Apna sawaal type karein…"><button type="button" id="aic-send">Bhejein</button></div><button type="button" id="aic-speak" class="aic-speak">🎤 Bolkar sawaal poochhein</button><div id="aic-chat-log" class="aic-chat-log"></div></div><p class="aic-privacy">Yeh app ke andar AI audio message hai. Koi phone call nahi hoti.</p></div>';
    document.body.appendChild(o);
    $("aic-decline").onclick = function () { stopRing(); report("declined"); closeStudent(); };
    $("aic-accept").onclick = acceptCall;
    $("aic-end").onclick = function () { report("completed").finally(closeStudent); };
    $("aic-talk").onclick = showTalk;
    $("aic-send").onclick = sendReply;
    $("aic-input").onkeydown = function (e) { if (e.key === "Enter") sendReply(); };
    $("aic-speak").onclick = listenQuestion;
    $("aic-audio").onplay = function () { playbackAt = Date.now(); $("aic-wave").classList.add("playing"); };
    $("aic-audio").onpause = function () { if (playbackAt) { listenedSeconds += (Date.now() - playbackAt) / 1000; playbackAt = 0; } $("aic-wave").classList.remove("playing"); };
    $("aic-audio").onended = function () { if (playbackAt) { listenedSeconds += (Date.now() - playbackAt) / 1000; playbackAt = 0; } $("aic-wave").classList.remove("playing"); setStatus("aic-state", "Message khatam. Aap sawaal pooch sakte hain ya call end karein."); };
    o.addEventListener("click", function (e) { if (e.target === o && !acceptedAt) { stopRing(); report("declined"); closeStudent(); } });
  }
  function closeStudent() {
    callEpoch++;
    stopRing(); try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
    var audio = $("aic-audio"); if (audio) { audio.pause(); audio.removeAttribute("src"); }
    if (callAudio) { try { URL.revokeObjectURL(callAudio); } catch (e) {} callAudio = null; } audioPromise = null;
    if ($("ai-call-screen")) $("ai-call-screen").classList.remove("open"); current = null; acceptedAt = 0; listenedSeconds = 0; playbackAt = 0; turns = []; busy = false;
  }
  async function fetchCallAudio(call) {
    var t = await token(), ac = await appCheckToken(), headers = { Authorization: "Bearer " + t };
    if (ac) headers["X-Firebase-AppCheck"] = ac;
    var r = await fetch(worker() + "/ai-call/audio/" + encodeURIComponent(call.instituteId) + "/" + encodeURIComponent(call.callId), { headers: headers, cache: "no-store" });
    if (!r.ok) throw new Error("Cloud voice available nahi");
    var blob = await r.blob(); return URL.createObjectURL(blob);
  }
  async function openIncoming(d) {
    if (!d || !d.aiCallId || !d.instituteId) return;
    var s = session(); if (!s) return;
    if (current && current.callId === String(d.aiCallId) && $("ai-call-screen") && $("ai-call-screen").classList.contains("open")) return;
    if (current) { report("declined"); closeStudent(); }
    var epoch = ++callEpoch;
    current = { callId: String(d.aiCallId), instituteId: String(d.instituteId), batchId: String(d.batchId || "") }; acceptedAt = 0; listenedSeconds = 0; playbackAt = 0; turns = [];
    studentUI(); stopRing(); $("ai-call-screen").classList.add("open"); $("aic-ring-controls").hidden = false; $("aic-active-controls").hidden = true; $("aic-chat").hidden = true;
    $("aic-accept").disabled = true;
    var name = studentName(); $("aic-title").textContent = "Savyasachi Sir (AI) calling…"; $("aic-sub").textContent = name ? "Namaste " + name + " ji, aapke liye ek sandesh hai" : "Aapke liye ek audio message";
    setStatus("aic-state", "Call aa rahi hai… audio tayyar kar rahe hain"); startRing();
    try {
      var j = await api("/ai-call/details", { callId: current.callId, instituteId: current.instituteId });
      if (epoch !== callEpoch) return;
      current = j.call; current.batchId = j.call.batchId || ""; $("aic-title").textContent = "Savyasachi Sir (AI)";
      $("aic-sub").textContent = name ? "Namaste " + name + " ji, aapka message tayyar hai" : "Aapka audio message tayyar hai";
      $("aic-accept").disabled = false;
      var audioCall = current;
      audioPromise = fetchCallAudio(audioCall).then(function (url) {
        if (epoch !== callEpoch || !current || current.callId !== audioCall.callId) { URL.revokeObjectURL(url); return; }
        callAudio = url; $("aic-audio").src = url; $("aic-audio").load(); setStatus("aic-state", "Cloud Hindi voice ready. Accept dabayein.");
      }).catch(function () { if (epoch === callEpoch) setStatus("aic-state", "Accept dabayein. Phone ki Hindi voice se message sunenge."); });
    } catch (e) { if (epoch === callEpoch) { $("aic-accept").disabled = true; setStatus("aic-state", e.message || "Call load nahi hui."); } }
    window.dispatchEvent(new CustomEvent("snap-ai-call-open"));
    setTimeout(function () { if (epoch === callEpoch && current && !acceptedAt && $("ai-call-screen").classList.contains("open")) { report("declined"); closeStudent(); } }, 35000);
  }
  async function playScript() {
    if (!current || !current.script) return;
    var name = studentName();
    if (name) await deviceSpeak("Namaste " + name + " ji.");
    if (!current) return;
    var audio = $("aic-audio");
    if (callAudio && audio) {
      try { audio.currentTime = 0; await audio.play(); setStatus("aic-state", "Savyasachi Sir ka message chal raha hai…"); return; } catch (e) {}
    }
    var ok = await deviceSpeak(current.script, true);
    if (!ok) setStatus("aic-state", "Audio nahi chal paaya. Screen par message dekhne ke liye Talk dabayein.");
    else setStatus("aic-state", "Message chal raha hai…");
  }
  async function acceptCall() {
    if (!current || busy) return; busy = true; stopRing(); acceptedAt = Date.now();
    $("aic-ring-controls").hidden = true; $("aic-active-controls").hidden = false; setStatus("aic-state", "Connect ho raha hai…");
    report("accepted");
    if (!current) { busy = false; return; }
    try {
      if (!callAudio && audioPromise) await Promise.race([audioPromise, new Promise(function (resolve) { setTimeout(resolve, 5000); })]);
      if (!callAudio && current) { callAudio = await fetchCallAudio(current); $("aic-audio").src = callAudio; $("aic-audio").load(); }
    } catch (e) {}
    if (current) await playScript(); busy = false;
  }
  function showTalk() {
    if (!current) return;
    $("aic-chat").hidden = false; $("aic-input").focus();
    setStatus("aic-state", "Aap Hindi me sawaal pooch sakte hain.");
  }
  function addChat(who, value) {
    var box = $("aic-chat-log"), row = document.createElement("div"); row.className = "aic-chat-line " + who; row.textContent = value; box.appendChild(row); box.scrollTop = box.scrollHeight;
  }
  async function sendReply(value) {
    if (!current || busy) return;
    var input = $("aic-input"), valueText = String(value || (input && input.value) || "").trim();
    if (!valueText) return;
    if (input) input.value = ""; busy = true; turns.push({ role: "student", text: valueText }); addChat("student", valueText); setStatus("aic-chat-status", "Sir jawab de rahe hain…");
    try {
      var j = await api("/ai-call/reply", { callId: current.callId, messages: turns });
      turns.push({ role: "assistant", text: j.reply }); addChat("assistant", j.reply); setStatus("aic-chat-status", "AI ka jawab");
      var a = $("aic-audio"); if (a) a.pause(); await deviceSpeak(j.reply);
    } catch (e) { setStatus("aic-chat-status", e.message || "Jawab nahi mila."); }
    busy = false;
  }
  function listenQuestion() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast("Is phone me voice input available nahi; neeche sawaal type karein."); $("aic-input").focus(); return; }
    try {
      var rec = new SR(); rec.lang = "hi-IN"; rec.interimResults = false; rec.maxAlternatives = 1;
      setStatus("aic-chat-status", "Sun raha hoon… ab boliye");
      rec.onresult = function (e) { var q = e.results && e.results[0] && e.results[0][0] && e.results[0][0].transcript; if (q) sendReply(q); };
      rec.onerror = function () { setStatus("aic-chat-status", "Awaaz samajh nahi aayi. Sawaal type karein."); };
      rec.onend = function () { if ($("aic-chat-status").textContent === "Sun raha hoon… ab boliye") setStatus("aic-chat-status", "Sawaal type karein ya phir se bolein."); };
      rec.start();
    } catch (e) { toast("Voice input start nahi hua; sawaal type karein."); }
  }
  function card() {
    if ($("ai-call-card")) return;
    var grid = document.querySelector("#admin-grid-students") || document.querySelector("#admin-dashboard-home .cd-grid");
    if (!grid || !inst() || !auth() || !auth().currentUser) return;
    var b = document.createElement("button"); b.type = "button"; b.id = "ai-call-card"; b.className = "cd-card cd-pink";
    b.innerHTML = '<div class="cd-card-top"><div class="cd-icon-circle">☎️</div><span class="cd-badge">AI Voice</span></div><div class="cd-card-title">AI Call</div><div class="cd-card-sub">Students ko call jaisa audio sandesh bhejein</div><div class="cd-card-bottom"><span class="cd-arrow-btn">→</span></div>';
    b.onclick = openAdmin; grid.appendChild(b);
  }
  function adminUI() {
    if ($("ai-admin-modal")) return;
    var o = document.createElement("div"); o.id = "ai-admin-modal";
    o.innerHTML = '<div class="aia-panel"><header><div><small>IN-APP ANNOUNCEMENT</small><h2>AI Voice Call</h2></div><button type="button" id="aia-close" aria-label="Band karein">×</button></header><p class="aia-note">Yeh app ke andar call-jaisa audio message hai. Koi phone call nahi hoti. AI draft ko bhejne se pehle date, time aur numbers check karein.</p><label class="aia-label" for="aia-title">Call ka title</label><input id="aia-title" maxlength="80" value="Savyasachi Sir ka zaroori message"><label class="aia-label" for="aia-source">Aap kya batana chahte hain?</label><textarea id="aia-source" maxlength="1600" rows="4" placeholder="Jaise: Kal subah 10 baje Maths test hai. Chapter 5 se 7 tak padhna hai."></textarea><div class="aia-row"><label class="aia-label">Bhasha<select id="aia-language"><option value="hindi">Hindi</option><option value="hinglish">Hinglish</option></select></label><label class="aia-label">Kisko bhejein?<select id="aia-batch"><option value="">Institute ke sabhi opted-in students</option></select></label></div><button type="button" class="aia-primary" id="aia-generate">✨ Hindi call script banayein</button><div id="aia-preview" hidden><label class="aia-label" for="aia-script">Review karein, chahein to edit karein</label><textarea id="aia-script" maxlength="2200" rows="6"></textarea><p id="aia-voice-note" class="aia-help"></p><audio id="aia-preview-audio" controls preload="none"></audio><button type="button" class="aia-secondary" id="aia-preview-device">Phone voice me preview</button><label class="aia-label" for="aia-schedule">Abhi bhejein ya schedule karein</label><input id="aia-schedule" type="datetime-local"><div class="aia-help">Schedule Worker ke 15-minute cron par deliver hoga. Student ko Android notification milegi; tap karne par app call screen kholegi.</div><button type="button" class="aia-primary" id="aia-send">📞 Call bhejein</button></div><div class="aia-auto"><b>Automatic AI calls</b><label><input type="checkbox" id="aia-auto-test"><span><strong>Test se 1 ghanta pehle</strong><small>AI voice reminder ke saath existing text reminder bhi jayega.</small></span></label><label><input type="checkbox" id="aia-auto-result"><span><strong>Result publish hone par</strong><small>Short voice message opted-in students ko jayega.</small></span></label></div><p id="aia-status" role="status"></p><h3>Pichhli calls</h3><div id="aia-history" class="aia-history"></div></div>';
    document.body.appendChild(o);
    $("aia-close").onclick = closeAdmin; o.addEventListener("click", function (e) { if (e.target === o) closeAdmin(); });
    $("aia-generate").onclick = prepareCall; $("aia-send").onclick = sendCall;
    $("aia-preview-device").onclick = function () { deviceSpeak(text("aia-script")); };
    $("aia-auto-test").onchange = saveAutoSettings; $("aia-auto-result").onchange = saveAutoSettings;
  }
  function closeAdmin() { if ($("ai-admin-modal")) $("ai-admin-modal").classList.remove("open"); }
  async function loadBatchOptions() {
    var sel = $("aia-batch"), d = db(), id = inst(); if (!sel || !d || !id) return;
    while (sel.options.length > 1) sel.remove(1);
    try {
      var snap = await d.collection("institutes").doc(id).collection("batches").get();
      snap.forEach(function (doc) { var x = doc.data() || {}, op = document.createElement("option"); op.value = doc.id; op.textContent = String(x.name || x.batchName || x.title || doc.id).slice(0, 80); sel.appendChild(op); });
    } catch (e) { /* All-institute delivery still works if batch list is unavailable. */ }
  }
  var draftId = "";
  async function prepareCall() {
    var source = text("aia-source"); if (source.length < 8) return setStatus("aia-status", "Pehle announcement ke facts likhein.");
    var b = $("aia-generate"); b.disabled = true; setStatus("aia-status", "AI script aur Hindi voice tayyar kar rahe hain…"); $("aia-preview").hidden = true;
    try {
      var j = await api("/ai-call/prepare", { instituteId: inst(), source: source, title: text("aia-title"), language: $("aia-language").value });
      draftId = j.draftId; $("aia-script").value = j.script; $("aia-preview").hidden = false;
      var voiceNote = $("aia-voice-note"); voiceNote.textContent = j.audioAvailable ? "Natural Hindi cloud voice ready. Is preview ko sun kar approve karein." : "Cloud voice abhi set nahi hai. Call phone ki installed Hindi voice se chalegi.";
      var a = $("aia-preview-audio"); a.hidden = !j.audioAvailable; a.removeAttribute("src");
      if (j.audioAvailable) { var raw = atob(j.audioPreview), bytes = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i); a.src = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" })); }
      setStatus("aia-status", "Script ready. Facts check karke bhejein.");
    } catch (e) { setStatus("aia-status", e.message || "AI script nahi bana."); }
    b.disabled = false;
  }
  async function sendCall() {
    if (!draftId) return setStatus("aia-status", "Pehle AI script banayein.");
    var b = $("aia-send"), schedule = text("aia-schedule"), scheduledAt = "";
    if (schedule) { var ms = new Date(schedule).getTime(); if (!Number.isFinite(ms) || ms < Date.now() + 60000) return setStatus("aia-status", "Schedule kam se kam 1 minute aage ka rakhein."); scheduledAt = new Date(ms).toISOString(); }
    b.disabled = true; setStatus("aia-status", schedule ? "Call schedule kar rahe hain…" : "Opted-in students ko bhej rahe hain…");
    try {
      var j = await api("/ai-call/send", { instituteId: inst(), draftId: draftId, script: text("aia-script"), batchId: $("aia-batch").value, scheduledAt: scheduledAt });
      draftId = ""; setStatus("aia-status", j.scheduled ? "✅ Call schedule ho gayi." : "✅ AI Call students ko bhej di.");
      $("aia-source").value = ""; $("aia-preview").hidden = true; $("aia-schedule").value = ""; await loadHistory();
    } catch (e) { setStatus("aia-status", e.message || "AI Call send nahi hui."); }
    b.disabled = false;
  }
  async function loadHistory() {
    var box = $("aia-history"); if (!box) return;
    box.textContent = "Loading…";
    try {
      var j = await api("/ai-call/history?instituteId=" + encodeURIComponent(inst()), null, "GET"); box.textContent = "";
      if (!j.calls || !j.calls.length) { box.textContent = "Abhi koi AI Call nahi bheji."; return; }
      j.calls.forEach(function (c) {
        var row = document.createElement("div"); row.className = "aia-history-row";
        var title = document.createElement("b"); title.textContent = c.title || "AI Call";
        var meta = document.createElement("small"); meta.textContent = (c.batchId ? "Batch: " + c.batchId : "Institute") + " · " + (c.status || "") + " · " + (c.scheduledAt ? new Date(c.scheduledAt).toLocaleString("en-IN") : new Date(c.createdAt).toLocaleString("en-IN"));
        var controls = document.createElement("div"); controls.className = "aia-history-actions";
        if (c.status === "scheduled") { var cancel = document.createElement("button"); cancel.textContent = "Cancel"; cancel.onclick = async function () { try { await api("/ai-call/cancel", { instituteId: inst(), callId: c.callId }); await loadHistory(); } catch (e) { toast(e.message); } }; controls.appendChild(cancel); }
        if (c.status === "sent") { var rep = document.createElement("button"); rep.textContent = "Report"; rep.onclick = async function () { try { var r = await api("/ai-call/reports?instituteId=" + encodeURIComponent(inst()) + "&callId=" + encodeURIComponent(c.callId), null, "GET"); toast("Accepted " + r.accepted + " · Declined " + r.declined + " · Heard to end " + r.completed + " · " + r.listenedSeconds + " sec suna"); var oldDetail = row.querySelector(".aia-report-list"); if (oldDetail) oldDetail.remove(); var detail = document.createElement("small"); detail.className = "aia-report-list"; detail.textContent = (r.students || []).map(function (x) { return x.name + (x.last4 ? " · ••••" + x.last4 : "") + " — " + x.status + " — " + x.listenedSeconds + " sec"; }).join("\n") || "Abhi kisi ne response nahi diya."; row.appendChild(detail); } catch (e) { toast(e.message); } }; controls.appendChild(rep); }
        row.append(title, meta, controls); box.appendChild(row);
      });
    } catch (e) { box.textContent = "History nahi load hui: " + (e.message || e); }
  }
  async function loadAutoSettings() {
    try { var j = await api("/ai-call/auto-settings?instituteId=" + encodeURIComponent(inst()), null, "GET"); $("aia-auto-test").checked = j.autoTestReminder === true; $("aia-auto-result").checked = j.autoResultPublished === true; }
    catch (e) { setStatus("aia-status", "Automatic calls ki setting load nahi hui: " + (e.message || e)); }
  }
  async function saveAutoSettings() {
    try { await api("/ai-call/auto-settings", { instituteId: inst(), autoTestReminder: $("aia-auto-test").checked, autoResultPublished: $("aia-auto-result").checked }); toast("Automatic call setting save ho gayi."); }
    catch (e) { toast("Setting save nahi hui: " + (e.message || e)); await loadAutoSettings(); }
  }
  async function autoResultPublished(id, ex) {
    try {
      var prefs = await api("/ai-call/auto-settings?instituteId=" + encodeURIComponent(inst()), null, "GET");
      if (!prefs.autoResultPublished) return;
      var j = await api("/ai-call/event-result", { instituteId: inst(), examId: String(id), examName: String(ex && ex.examName || "Exam"), className: String(ex && ex.className || "") });
      if (j.sent) toast("Result publish AI call opted-in students ko bhej di.");
    } catch (e) { console.warn("[SnapAICall] result auto-call fail", e && e.message); toast("Auto result call nahi ja saki: " + (e.message || e)); }
  }
  function openAdmin() { adminUI(); $("ai-admin-modal").classList.add("open"); setStatus("aia-status", ""); loadBatchOptions(); loadHistory(); loadAutoSettings(); }
  async function refreshSettingsUI() {
    var box = $("ssp-ai-call-toggle"); if (!box) return;
    var enabled = !localStorage.getItem(OPT_OUT);
    try { var j = await api("/ai-call/settings", null, "GET"); enabled = j.enabled !== false; if (enabled) localStorage.removeItem(OPT_OUT); else localStorage.setItem(OPT_OUT, "1"); localStorage.setItem(PREF_AT, String(Date.now())); } catch (e) {}
    box.checked = enabled;
  }
  async function saveSetting(enabled) {
    try { await api("/ai-call/settings", { enabled: !!enabled }); localStorage.setItem(PREF_AT, String(Date.now())); }
    catch (e) { toast("Setting save nahi hui: " + e.message); }
    if (enabled) localStorage.removeItem(OPT_OUT); else localStorage.setItem(OPT_OUT, "1");
    try { window.SnapPush && window.SnapPush.sync && window.SnapPush.sync(); } catch (e) {}
  }
  async function syncPreference() {
    if (!session()) return;
    var last = Number(localStorage.getItem(PREF_AT) || 0); if (Date.now() - last < 5 * 60 * 1000) return;
    try { var j = await api("/ai-call/settings", null, "GET"); if (j.enabled === false) localStorage.setItem(OPT_OUT, "1"); else localStorage.removeItem(OPT_OUT); localStorage.setItem(PREF_AT, String(Date.now())); } catch (e) {}
  }
  function init() {
    var tries = 0; var findAdmin = function () { card(); if (!$("ai-call-card") && ++tries < 30) setTimeout(findAdmin, 800); }; findAdmin();
    document.addEventListener("visibilitychange", function () { if (!document.hidden) card(); });
    document.addEventListener("snap-ai-call", function (e) { openIncoming(e.detail || {}); });
    document.addEventListener("snap-push-in", function () { card(); });
  }
  window.SnapAICall = { openIncoming: openIncoming, syncPreference: syncPreference, refreshSettingsUI: refreshSettingsUI, saveSetting: saveSetting, autoResultPublished: autoResultPublished, isDisabled: function () { return !!localStorage.getItem(OPT_OUT); } };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();
