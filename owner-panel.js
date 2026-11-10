const OWNER_LOGIN_KEY="snaptestpro_owner_logged_in",OWNER_EMAIL_LOCAL_KEY="snaptestpro_owner_email",OWNER_TRUE_EMAIL="thevishnusharmaapp@gmail.com",SAVYA_CLASS_OPTIONS=[{id:"class_9",label:"Class 9"},{id:"class_10",label:"Class 10"},{id:"class_11",label:"Class 11"},{id:"class_12",label:"Class 12"}];window.SAVYA_CLASS_OPTIONS=SAVYA_CLASS_OPTIONS;let _ownerInstitutesCache={},_ownerAdminsCache={},_ownerListenersStarted=!1,_ownerSecondaryAppCounter=0,_ownerApp=null,_ownerAuthInstance=null,_ownerDbInstance=null;function ownerEnsureApp(){if(!_ownerApp){try{_ownerApp=firebase.initializeApp(firebase.app().options,"owner-panel-session")}catch{_ownerApp=firebase.app("owner-panel-session")}_ownerAuthInstance=_ownerApp.auth(),_ownerDbInstance=_ownerApp.firestore()}}function ownerGetAuth(){return ownerEnsureApp(),_ownerAuthInstance}function ownerGetDb(){return ownerEnsureApp(),_ownerDbInstance}function ownerIsLoggedInFlag(){try{return localStorage.getItem(OWNER_LOGIN_KEY)==="true"}catch{return!1}}function ownerSetLoggedInFlag(){try{localStorage.setItem(OWNER_LOGIN_KEY,"true")}catch{}}function ownerClearLoggedInFlag(){try{localStorage.removeItem(OWNER_LOGIN_KEY)}catch{}}function ownerRememberEmail(e){try{localStorage.setItem(OWNER_EMAIL_LOCAL_KEY,e)}catch{}}function ownerGetRememberedEmail(){try{return localStorage.getItem(OWNER_EMAIL_LOCAL_KEY)||""}catch{return""}}function ownerIsEmailLike(e){return/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e||"").trim())}function openOwnerOverlay(){document.getElementById("owner-overlay-bg")?.classList.remove("hidden");const e=ownerGetAuth(),t=e&&e.currentUser&&e.currentUser.email;if(ownerIsLoggedInFlag()&&t&&t===ownerGetRememberedEmail()&&t.toLowerCase()===OWNER_TRUE_EMAIL.toLowerCase())ownerShowPanel();else{if(t&&t.toLowerCase()!==OWNER_TRUE_EMAIL.toLowerCase()){try{e.signOut()}catch{}ownerClearLoggedInFlag()}ownerShowLogin()}}function closeOwnerOverlay(){document.getElementById("owner-overlay-bg")?.classList.add("hidden");const e=new URL(window.location.href);e.searchParams.get("owner")&&(e.searchParams.delete("owner"),window.history.replaceState({},"",e.pathname+e.search))}function ownerShowLogin(){document.getElementById("owner-login-box")?.classList.remove("hidden"),document.getElementById("owner-panel-box")?.classList.add("hidden");const e=document.getElementById("owner-email");e&&(e.value=ownerGetRememberedEmail())}function ownerShowPanel(){document.getElementById("owner-login-box")?.classList.add("hidden"),document.getElementById("owner-panel-box")?.classList.remove("hidden");const e=ownerGetAuth(),t=e&&e.currentUser&&e.currentUser.email,n=document.getElementById("owner-logged-in-as");n&&(n.textContent=t?"👤 "+t:""),ownerRenderNewInstituteClassCheckboxes(),ownerStartListeners()}function ownerRenderNewInstituteClassCheckboxes(){const e=document.getElementById("owner-new-institute-classes");!e||e.dataset.rendered||(e.dataset.rendered="1",e.innerHTML=SAVYA_CLASS_OPTIONS.map(t=>`
    <label class="owner-class-chip">
      <input type="checkbox" value="${t.id}" ${t.id==="class_10"?"checked":""}> ${ownerEsc(t.label)}
    </label>`).join(""))}function ownerGetCheckedClasses(e){const t=document.getElementById(e);return t?Array.from(t.querySelectorAll('input[type="checkbox"]:checked')).map(n=>n.value):[]}async function ownerLogin(e){e&&e.preventDefault&&e.preventDefault();const t=ownerGetAuth();if(!t){alert("⚠️ Firebase Auth load nahi hua. Page reload karein.");return}const n=(document.getElementById("owner-email")?.value||"").trim(),r=document.getElementById("owner-password")?.value||"";if(!ownerIsEmailLike(n)){alert("Sahi email address likhein.");return}try{if(await t.signInWithEmailAndPassword(n,r),n.trim().toLowerCase()!==OWNER_TRUE_EMAIL.toLowerCase()){await t.signOut(),alert(`⚠️ Ye email Owner ke roop mein authorize NAHI hai.

Aapne sign-in kiya: `+n+`
Owner Panel sirf iss email se khulta hai: `+OWNER_TRUE_EMAIL+`

(Agar ye kisi Admin/institute ka email hai, to use Admin login se try karein, Owner Panel se nahi.)`);return}ownerRememberEmail(n),ownerSetLoggedInFlag(),ownerShowPanel()}catch(i){console.warn("[owner] login failed",i&&i.code),alert("Galat email ya password (ya ye email Owner ke roop mein authorize nahi hai).")}}async function ownerForgotPassword(){const e=ownerGetAuth();if(!e){alert("⚠️ Firebase Auth load nahi hua. Page reload karein.");return}let t=(document.getElementById("owner-email")?.value||"").trim();if(t||(t=(prompt("Apna Owner email address likhein — usi par password reset link bhejenge:",ownerGetRememberedEmail())||"").trim()),!!t){if(!ownerIsEmailLike(t)){alert("Sahi email address likhein.");return}try{await e.sendPasswordResetEmail(t),alert("✅ Agar ye email Owner account se registered hai, to reset link bhej diya gaya hai. Apna inbox (aur spam folder) check karein.")}catch(n){console.error("[owner] forgot-password failed",n),alert("Reset email bhejne mein dikkat hui: "+(n.message||n))}}}function ownerLogout(){if(confirm("Owner session se logout karein?")){try{const e=ownerGetAuth();e&&e.currentUser&&e.signOut().catch(()=>{})}catch{}ownerClearLoggedInFlag(),closeOwnerOverlay(),ownerShowLogin()}}function ownerStartListeners(){if(_ownerListenersStarted){ownerRenderList();return}const e=ownerGetDb();if(!e){alert("⚠️ Firestore load nahi hua.");return}_ownerListenersStarted=!0,e.collection("institutes").onSnapshot(t=>{_ownerInstitutesCache={},t.forEach(n=>{_ownerInstitutesCache[n.id]={id:n.id,...n.data()}}),ownerRenderList()},t=>{console.error("[owner] institutes listener error",t);const n=document.getElementById("owner-institutes-list");n&&(n.innerHTML=`<p class="muted-text">⚠️ Load nahi ho paaya: ${t.message||t}</p>`)}),e.collection("admins").onSnapshot(t=>{_ownerAdminsCache={},t.forEach(n=>{_ownerAdminsCache[n.id]={email:n.id,...n.data()}}),ownerRenderList()},t=>console.error("[owner] admins listener error",t))}function ownerRenderList(){const e=document.getElementById("owner-institutes-list");if(!e)return;const t=Object.values(_ownerInstitutesCache).sort((a,o)=>(a.name||"").localeCompare(o.name||"")),n={},r=[];if(Object.values(_ownerAdminsCache).forEach(a=>{a.instituteId&&_ownerInstitutesCache[a.instituteId]?(n[a.instituteId]=n[a.instituteId]||[]).push(a):r.push(a)}),t.length===0&&r.length===0){e.innerHTML='<p class="muted-text">Abhi koi institute add nahi hua. Upar wale form se pehla institute banayein.</p>';return}let i="";t.forEach(a=>{const o=n[a.id]||[];i+=`
      <div class="owner-inst-card" data-iid="${a.id}">
        <div class="owner-inst-head">
          <div>
            <strong>${ownerDecorateInstituteName(a.name||"(naam nahi)")}</strong>
            <span class="owner-badge ${a.active===!1?"owner-badge-off":"owner-badge-on"}">${a.active===!1?"Inactive":"Active"}</span>
            <div style="font-size:.78rem;color:#64748b;margin-top:2px;">👤 Owner: ${a.ownerName?ownerEsc(a.ownerName):'<span style="color:#c2410c;">Naam set nahi hai ⚠️</span>'}</div>
          </div>
          <div class="owner-inst-actions">
            <button type="button" class="owner-mini-btn" onclick="ownerRenameInstitute('${__sj(a.id)}', '${ownerEscAttr(a.name||"")}')">✏️ Rename</button>
            <button type="button" class="owner-mini-btn" onclick="ownerSetInstituteOwnerName('${__sj(a.id)}', '${ownerEscAttr(a.ownerName||"")}')">👤 Owner Naam</button>
            <button type="button" class="owner-mini-btn" onclick="ownerBrandingEdit('${__sj(a.id)}')">🎨 Branding &amp; Plan</button>
            <button type="button" class="owner-mini-btn" onclick="ownerApkInfo('${__sj(a.id)}')">📱 APK / App Link</button>
            <button type="button" class="owner-mini-btn" onclick="ownerToggleInstitute('${__sj(a.id)}', ${a.active===!1})">${a.active===!1?"▶️ Activate":"⏸️ Deactivate"}</button>
            <button type="button" class="owner-mini-btn owner-mini-danger" onclick="ownerDeleteInstitute('${__sj(a.id)}')">🗑️ Remove</button>
          </div>
        </div>

        ${ownerBrandInfoHtml(a)}
        <div class="owner-inst-classes">
          <span class="owner-classes-label">🎓 Allowed Classes:</span>
          ${ownerClassChipsHtml(a)}
        </div>

        <div class="owner-admin-list">
          ${o.length===0?'<p class="muted-text" style="margin:6px 0;">Is institute ka abhi koi admin nahi hai.</p>':o.map(ownerAdminRowHtml).join("")}
        </div>

        <form class="owner-add-admin-form" onsubmit="return ownerAddAdminSubmit(event, '${__sj(a.id)}', '${ownerEscAttr(a.name||"")}')">
          <input type="email" placeholder="Naye admin ka email" required style="flex:1;min-width:160px;" />
          <button type="submit" class="owner-mini-btn owner-mini-primary">+ Admin Add Karein</button>
        </form>
      </div>`}),r.length>0&&(i+=`
      <div class="owner-inst-card owner-inst-card-orphan">
        <div class="owner-inst-head"><strong>⚠️ Bina institute ke admins</strong></div>
        <div class="owner-admin-list">${r.map(ownerOrphanAdminBlockHtml).join("")}</div>
      </div>`),e.innerHTML=i}function ownerOrphanAdminBlockHtml(e){const t=ownerAdminRowHtml(e);return e.instituteId?t+`
    <form class="owner-add-admin-form" onsubmit="return ownerRecreateInstituteSubmit(event, '${ownerEscAttr(e.instituteId)}', '${ownerEscAttr(e.email)}')" style="margin:-4px 0 14px;">
      <input type="text" placeholder="Institute ka naam (wapas banane ke liye)" required style="flex:1;min-width:160px;" />
      <button type="submit" class="owner-mini-btn owner-mini-primary">🔁 Institute Wapas Banayein</button>
    </form>`:t+`
      <form class="owner-add-admin-form" onsubmit="return ownerAssignNewInstituteSubmit(event, '${ownerEscAttr(e.email)}')" style="margin:-4px 0 14px;">
        <input type="text" placeholder="Institute ka naam (is admin ke liye)" required style="flex:1;min-width:160px;" />
        <button type="submit" class="owner-mini-btn owner-mini-primary">🏢 Institute Naam Set Karein</button>
      </form>`}function ownerAdminRowHtml(e){const t=e.active===!1;return`
    <div class="owner-admin-row">
      <div class="owner-admin-email">
        ${ownerEsc(e.email)}
        <span class="owner-badge ${t?"owner-badge-off":"owner-badge-on"}">${t?"Disabled":"Active"}</span>
        <div style="flex-basis:100%;font-size:.76rem;color:#64748b;margin-top:2px;font-weight:400;">🧑 ${e.name?ownerEsc(e.name):'<span style="color:#94a3b8;">(naam set nahi hai)</span>'}</div>
      </div>
      <div class="owner-admin-actions">
        <button type="button" class="owner-mini-btn" onclick="ownerSetAdminName('${ownerEscAttr(e.email)}', '${ownerEscAttr(e.name||"")}')">✏️ Naam</button>
        <button type="button" class="owner-mini-btn" onclick="ownerToggleAdmin('${ownerEscAttr(e.email)}', ${t}, this)">${t?"✅ Enable":"⛔ Disable"}</button>
        <button type="button" class="owner-mini-btn" onclick="ownerResetAdminPassword('${ownerEscAttr(e.email)}')">🔑 Password Reset Email</button>
        <button type="button" class="owner-mini-btn owner-mini-danger" onclick="ownerRemoveAdminRecord('${ownerEscAttr(e.email)}')">🗑️ Remove</button>
      </div>
    </div>`}function ownerEsc(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function ownerEscAttr(e){return String(e??"").replace(/'/g,"\\'")}function ownerDecorateInstituteName(e){return ownerEsc(String(e||"").trim().toUpperCase())}function ownerClassChipsHtml(e){const t=Array.isArray(e.allowedClasses)?e.allowedClasses:null;return SAVYA_CLASS_OPTIONS.map(n=>{const r=t===null?!0:t.includes(n.id);return`
      <label class="owner-class-chip ${r?"owner-class-chip-on":""}">
        <input type="checkbox" ${r?"checked":""}
          onchange="ownerToggleInstituteClass('${__sj(e.id)}', '${n.id}', this.checked)"> ${ownerEsc(n.label)}
      </label>`}).join("")+(t===null?'<div class="muted-text" style="width:100%;font-size:.72rem;margin-top:2px;">(abhi sabhi Classes allowed hain — kisi ek ko uncheck karte hi sirf checked wali Classes is Institute ke liye allowed rahengi)</div>':"")}async function ownerToggleInstituteClass(e,t,n){const r=ownerGetDb(),i=_ownerInstitutesCache[e];let a=Array.isArray(i?.allowedClasses)?i.allowedClasses.slice():SAVYA_CLASS_OPTIONS.map(o=>o.id);if(n&&!a.includes(t)&&a.push(t),n||(a=a.filter(o=>o!==t)),a.length===0){alert("Kam se kam ek Class allowed rehni chahiye — poori tarah khaali nahi ho sakti."),ownerRenderList();return}await ownerRetryOnPermissionDenied(()=>r.collection("institutes").doc(e).update({allowedClasses:a}))}window.ownerToggleInstituteClass=ownerToggleInstituteClass;async function ownerAddInstituteSubmit(e){e.preventDefault();const t=ownerGetDb(),n=document.getElementById("owner-new-institute-name"),r=(n?.value||"").trim();if(!r)return alert("Institute ka naam likhein."),!1;const i=document.getElementById("owner-new-institute-owner-name"),a=(i?.value||"").trim();if(!a)return alert("Institute ke Owner ka naam likhein (ID Card ki signature mein yahi dikhega)."),!1;const o=ownerGetCheckedClasses("owner-new-institute-classes");if(o.length===0)return alert("Kam se kam ek Class select karein jiske liye ye Institute eligible ho."),!1;try{await t.collection("institutes").add({name:r,ownerName:a,active:!0,allowedClasses:o,createdAt:firebase.firestore.FieldValue.serverTimestamp()}),n&&(n.value=""),i&&(i.value="");const s=document.getElementById("owner-new-institute-classes");s&&s.querySelectorAll('input[type="checkbox"]').forEach(l=>{l.checked=l.value==="class_10"})}catch(s){console.error(s),alert("Institute add nahi hua: "+(s.message||s))}return!1}async function ownerRecreateInstituteSubmit(e,t,n){e.preventDefault();const r=e.target,a=(r.querySelector('input[type="text"]')?.value||"").trim();if(!a)return alert("Institute ka naam likhein."),!1;const o=ownerGetDb(),s=r.querySelector('button[type="submit"]');s&&(s.disabled=!0,s.textContent="Recreate ho raha hai...");try{await o.collection("institutes").doc(t).set({name:a,active:!0,createdAt:firebase.firestore.FieldValue.serverTimestamp()}),await o.collection("admins").doc(n).update({active:!0,instituteName:a}),alert('✅ Institute wapas ban gaya ("'+a+'") aur '+n+" activate ho gaya.")}catch(l){console.error(l),alert("Nahi hua: "+(l.message||l)),s&&(s.disabled=!1,s.textContent="🔁 Institute Wapas Banayein")}return!1}async function ownerAssignNewInstituteSubmit(e,t){e.preventDefault();const n=e.target,i=(n.querySelector('input[type="text"]')?.value||"").trim();if(!i)return alert("Institute ka naam likhein."),!1;const a=ownerGetDb(),o=n.querySelector('button[type="submit"]');o&&(o.disabled=!0,o.textContent="Set ho raha hai...");try{const s=await a.collection("institutes").add({name:i,active:!0,createdAt:firebase.firestore.FieldValue.serverTimestamp()});await a.collection("admins").doc(t).update({instituteId:s.id,instituteName:i}),alert('✅ "'+i+'" institute ban gaya aur '+t+" ab isse juda hai.")}catch(s){console.error(s),alert("Nahi hua: "+(s.message||s)),o&&(o.disabled=!1,o.textContent="🏢 Institute Naam Set Karein")}return!1}async function ownerRetryOnPermissionDenied(e){try{await e()}catch(t){const n=String(t&&t.code||"").toLowerCase().includes("permission"),r=ownerGetAuth();if(n&&r&&r.currentUser)try{await r.currentUser.getIdToken(!0),await e();return}catch(a){t=a}const i=r&&r.currentUser?r.currentUser.isAnonymous?"anonymous session (owner login drop ho gaya)":r.currentUser.email:"koi bhi login nahi (signed out)";alert("Update nahi hua: "+(t.message||t)+`

(Us waqt sign-in tha: `+i+")")}}async function ownerRenameInstitute(e,t){const n=prompt("Institute ka naya naam likhein:",t||"");if(n===null)return;const r=n.trim();if(!r){alert("Naam khaali nahi ho sakta.");return}const i=ownerGetDb();await ownerRetryOnPermissionDenied(async()=>{await i.collection("institutes").doc(e).update({name:r});const a=Object.values(_ownerAdminsCache).filter(o=>o.instituteId===e);await Promise.all(a.map(o=>i.collection("admins").doc(o.email).update({instituteName:r}).catch(()=>{})))})}async function ownerSetInstituteOwnerName(e,t){const n=prompt("Institute ke Owner ka naam likhein (ID Card ki signature mein yahi dikhega):",t||"");if(n===null)return;const r=n.trim();if(!r){alert("Owner ka naam khaali nahi ho sakta.");return}const i=ownerGetDb();await ownerRetryOnPermissionDenied(()=>i.collection("institutes").doc(e).update({ownerName:r}))}async function ownerToggleInstitute(e,t){const n=ownerGetDb();await ownerRetryOnPermissionDenied(()=>n.collection("institutes").doc(e).update({active:t}))}async function ownerDeleteInstitute(e){const t=_ownerInstitutesCache[e],n=Object.values(_ownerAdminsCache).filter(l=>l.instituteId===e),r=n.length>0?`

(Is institute ke saath ${n.length} admin record bhi juda hai — remove hone se wo "bina institute ke" list mein chala jaayega, uska access khud disable nahi hoga.)`:"",i=ownerGetAuth(),a=i&&i.currentUser&&i.currentUser.email;if(!a){alert("⚠️ Owner session nahi mili. Page reload karke dobara try karein.");return}if(!confirm(`"${t?.name||e}" ko remove karna shuru karein?

Aapke email (${a}) par ek confirm-link bheja jaayega — wo link click kiye bina institute delete NAHI hoga.`+r))return;const o=ownerGetDb(),s="rm_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,12);try{await o.collection("ownerPendingRemovals").doc(s).set({instituteId:e,instituteName:t?.name||"",ownerEmail:a,createdAt:firebase.firestore.FieldValue.serverTimestamp(),expiresAt:Date.now()+900*1e3});const l=new URL(window.location.href);l.searchParams.delete("owner"),l.searchParams.set("ownerConfirmRemove",s),await i.sendSignInLinkToEmail(a,{url:l.toString(),handleCodeInApp:!0});try{localStorage.setItem("snaptestpro_owner_pending_removal_email",a)}catch{}alert(`📧 Confirm-link bhej diya gaya hai (${a}).

Wahi link isi phone/browser par kholein taaki "${t?.name||e}" remove ho jaaye. Link 15 minute mein expire ho jaayega.`)}catch(l){console.error(l);try{await o.collection("ownerPendingRemovals").doc(s).delete()}catch{}String(l.code||"").includes("operation-not-allowed")?alert("⚠️ Confirm-link nahi bheja ja saka: Firebase Console → Authentication → Sign-in method mein 'Email link (passwordless sign-in)' provider ON karein, phir dobara try karein."):alert("Confirm-link nahi bheja ja saka: "+(l.message||l))}}async function ownerHandlePendingRemovalFromUrl(){const t=new URLSearchParams(window.location.search).get("ownerConfirmRemove");if(!t)return;try{window.vishnuFirebase&&window.vishnuFirebase.authReady&&await window.vishnuFirebase.authReady}catch{}const n=ownerGetAuth();if(!n.isSignInWithEmailLink(window.location.href)){alert("⚠️ Ye confirm-link sahi nahi hai ya expire ho chuka hai.");return}let r="";try{r=localStorage.getItem("snaptestpro_owner_pending_removal_email")||""}catch{}if(r||(r=(prompt("Confirm karne ke liye apna Owner email likhein:")||"").trim()),!!r){openOwnerOverlay();try{await n.signInWithEmailLink(r,window.location.href),ownerRememberEmail(r),ownerSetLoggedInFlag(),ownerShowPanel();const i=ownerGetDb(),a=await i.collection("ownerPendingRemovals").doc(t).get();if(!a.exists){alert("⚠️ Ye removal request nahi mili — shayad pehle hi confirm ho chuki hai, ya expire ho gayi.");return}const o=a.data();if(Date.now()>(o.expiresAt||0)){alert("⚠️ Ye confirm-link expire ho chuka hai (15 min limit). Institute remove nahi hua — Owner Panel se dobara 'Remove' try karein."),await i.collection("ownerPendingRemovals").doc(t).delete().catch(()=>{});return}await i.collection("institutes").doc(o.instituteId).delete(),await i.collection("ownerPendingRemovals").doc(t).delete().catch(()=>{}),alert(`✅ "${o.instituteName||o.instituteId}" hamesha ke liye remove ho gaya.`)}catch(i){console.error(i),alert("Confirm nahi ho paaya: "+(i.message||i))}finally{try{localStorage.removeItem("snaptestpro_owner_pending_removal_email")}catch{}const i=new URL(window.location.href);i.searchParams.delete("ownerConfirmRemove"),window.history.replaceState({},"",i.pathname+i.search)}}}async function ownerAddAdminSubmit(e,t,n){e.preventDefault();const r=e.target,a=(r.querySelector('input[type="email"]')?.value||"").trim().toLowerCase();if(!ownerIsEmailLike(a))return alert("Sahi email address likhein."),!1;const o=ownerGetDb(),s=ownerGetAuth(),l=r.querySelector('button[type="submit"]');l&&(l.disabled=!0,l.textContent="Adding...");try{await o.collection("admins").doc(a).set({email:a,instituteId:t,instituteName:n,active:!0,createdAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:!0}),_ownerSecondaryAppCounter+=1;const c=firebase.initializeApp(firebase.app().options,"owner-secondary-"+_ownerSecondaryAppCounter),u=c.auth(),w="Tmp-"+Math.random().toString(36).slice(2)+"Aa1!";let m=!1;try{await u.createUserWithEmailAndPassword(a,w),m=!0;try{await u.currentUser.sendEmailVerification()}catch(d){console.warn("[owner] verification email failed",d)}}catch(d){d.code!=="auth/email-already-in-use"&&console.warn("[owner] admin auth account create failed",d)}try{await u.signOut()}catch{}try{await c.delete()}catch{}try{await s.sendPasswordResetEmail(a)}catch(d){console.warn("[owner] password reset email failed",d)}r.reset(),alert((m?"✅ Naya admin add ho gaya ("+a+`).

`:"✅ Admin is institute se link ho gaya ("+a+`).

`)+"📧 Us email par DO links bheje gaye hain: (1) apna password khud set karne ke liye, (2) email verify karne ke liye.")}catch(c){console.error(c),alert("Admin add nahi hua: "+(c.message||c))}finally{l&&(l.disabled=!1,l.textContent="+ Admin Add Karein")}return!1}async function ownerToggleAdmin(e,t,n){const r=ownerGetDb(),i=ownerGetAuth(),a=n?n.textContent:null;n&&(n.disabled=!0,n.textContent="...");try{if(i&&i.currentUser)try{await i.currentUser.getIdToken(!0)}catch{}await ownerRetryOnPermissionDenied(()=>r.collection("admins").doc(e).update({active:t}));try{const o=await r.collection("admins").doc(e).get(),s=o.exists?o.data().active!==!1:null;s!==null&&s!==t&&alert(`⚠️ "${e}" ka status update nahi ho paaya (abhi bhi ${s?"Active":"Disabled"} hai). Dobara try karein.`)}catch{}}finally{n&&(n.disabled=!1,n.textContent=a)}}async function ownerResetAdminPassword(e){if(!confirm(`${e} ko password-reset email bhejein?`))return;const t=ownerGetAuth();try{await t.sendPasswordResetEmail(e),alert("✅ Password reset link bhej diya gaya ("+e+").")}catch(n){alert("Bhej nahi paaya: "+(n.message||n))}}async function ownerSetAdminName(e,t){const n=prompt(`"${e}" ka naam likhein (iske ID Card par yahi dikhega):`,t||"");if(n===null)return;const r=n.trim();if(!r){alert("Naam khaali nahi ho sakta.");return}const i=ownerGetDb();await ownerRetryOnPermissionDenied(()=>i.collection("admins").doc(e).update({name:r}))}async function ownerRemoveAdminRecord(e){if(!confirm(`${e} ka admin record hatayein?

Isse is institute se uska access turant band ho jaayega. (Uska Firebase Auth login account is se delete nahi hota — poori tarah account delete karne ke liye OWNER_PANEL_SETUP.md dekhein.)`))return;const t=ownerGetDb();try{await t.collection("admins").doc(e).delete()}catch(n){alert("Remove nahi hua: "+(n.message||n))}}async function ownerDeleteAdminAuth(e){if(confirm(`${e} ka Firebase login account HAMESHA KE LIYE delete karein? Ye undo nahi ho sakta.`))try{if(!firebase.functions)throw new Error("Cloud Functions SDK load nahi hai — OWNER_PANEL_SETUP.md dekhein.");await firebase.app().functions().httpsCallable("ownerDeleteAdminAuth")({email:e}),await ownerRemoveAdminRecordSilently(e),alert("✅ Account permanently delete ho gaya.")}catch(t){alert("Delete nahi hua: "+(t.message||t))}}async function ownerSetAdminPassword(e,t){try{if(!firebase.functions)throw new Error("Cloud Functions SDK load nahi hai — OWNER_PANEL_SETUP.md dekhein.");await firebase.app().functions().httpsCallable("ownerSetAdminPassword")({email:e,newPassword:t}),alert("✅ Password set ho gaya.")}catch(n){alert("Password set nahi hua: "+(n.message||n))}}async function ownerRemoveAdminRecordSilently(e){try{await ownerGetDb().collection("admins").doc(e).delete()}catch{}}window.ownerDeleteAdminAuth=ownerDeleteAdminAuth,window.ownerSetAdminPassword=ownerSetAdminPassword,document.addEventListener("DOMContentLoaded",()=>{const e=new URLSearchParams(window.location.search);if(e.get("ownerConfirmRemove")){ownerHandlePendingRemovalFromUrl();return}e.get("owner")==="1"&&(window.vishnuFirebase&&window.vishnuFirebase.authReady?window.vishnuFirebase.authReady.then(()=>openOwnerOverlay()):openOwnerOverlay())}),window.openOwnerOverlay=openOwnerOverlay,window.closeOwnerOverlay=closeOwnerOverlay,window.ownerLogin=ownerLogin,window.ownerForgotPassword=ownerForgotPassword,window.ownerLogout=ownerLogout,window.ownerAddInstituteSubmit=ownerAddInstituteSubmit,window.ownerRecreateInstituteSubmit=ownerRecreateInstituteSubmit,window.ownerAssignNewInstituteSubmit=ownerAssignNewInstituteSubmit,window.ownerRenameInstitute=ownerRenameInstitute,window.ownerSetInstituteOwnerName=ownerSetInstituteOwnerName,window.ownerToggleInstitute=ownerToggleInstitute,window.ownerDeleteInstitute=ownerDeleteInstitute,window.ownerHandlePendingRemovalFromUrl=ownerHandlePendingRemovalFromUrl,window.ownerAddAdminSubmit=ownerAddAdminSubmit,window.ownerToggleAdmin=ownerToggleAdmin,window.ownerResetAdminPassword=ownerResetAdminPassword,window.ownerSetAdminName=ownerSetAdminName,window.ownerRemoveAdminRecord=ownerRemoveAdminRecord;

/* v168 — Owner Panel: App Alerts (Worker /alerts se; sirf owner ka Firebase token chalta hai) */
(function(){
  var W=(window.SNAP_CONFIG&&window.SNAP_CONFIG.workerUrl)||"https://cool-thunder-a280.vishnu1234stm.workers.dev";
  function esc(x){return String(x==null?"":x).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
  function ago(t){var m=Math.floor((Date.now()-t)/6e4);return m<1?"abhi":m<60?m+" min":m<1440?Math.floor(m/60)+" ghante":Math.floor(m/1440)+" din"}
  async function call(path,method){
    var u=(ownerGetAuth().currentUser||firebase.auth().currentUser); if(!u||!u.email)throw new Error("Owner login chahiye");
    var r=await fetch(W+path,{method:method||"GET",headers:{Authorization:"Bearer "+await u.getIdToken()}}), j=await r.json().catch(function(){return{}});
    if(!r.ok||!j.ok)throw new Error(j.error||("HTTP "+r.status)); return j;
  }
  window.ownerLoadAlerts=async function(){
    var box=document.getElementById("owner-alerts-list"); if(!box)return; box.textContent="Load ho raha hai...";
    try{
      var j=await call("/alerts"), a=j.alerts||[];
      box.innerHTML=a.length?a.map(function(x){var c=x.sev==="critical"?"#b91c1c":x.sev==="error"?"#c2410c":"#64748b";
        return '<div style="border-top:1px solid #e2e8f0;padding:7px 0"><b style="color:'+c+'">'+esc((x.sev||"").toUpperCase())+'</b> • '+esc(x.role||"")+"/"+esc(x.plat||"")+" • "+ago(x.t)+" pehle<br>"+esc(x.msg)+
          '<div style="color:#64748b;font-size:.7rem">'+[x.src,x.screen,x.inst&&("inst: "+x.inst),"app "+x.app,x.net].filter(Boolean).map(esc).join(" • ")+"</div></div>"}).join(""):"✅ Koi alert nahi.";
    }catch(e){var m=String(e&&e.message||e);box.textContent="Alerts nahi mile: "+m+(/Sirf owner/i.test(m)?" — Owner email Worker ki OWNER_EMAILS list me nahi hai (Cloudflare > Worker > Settings > Variables)":/BANK_KV|SERVICE_ACCOUNT/i.test(m)?" — Worker me BANK_KV + SERVICE_ACCOUNT_JSON set karein":"")}
  };
  window.ownerClearAlerts=async function(){ if(!confirm("Saare alerts clear karein?"))return; try{await call("/alerts/clear","POST");window.ownerLoadAlerts()}catch(e){alert("Clear nahi hua: "+(e&&e.message||e))} };
})();


/* ===== v174: Branding & Plan (har institute ko apna look + storage limit) ===== */
function ownerFmtDate(ms){return new Date(ms).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"Asia/Kolkata"})}
function ownerExpState(a){
  const e=+a.planExpiresAt||0;if(!e)return{k:"none",txt:"♾️ bina expiry",c:"#64748b"};
  const d=Math.ceil((e-Date.now())/864e5);
  if(d<0)return{k:"expired",txt:d>=-3?`⚠️ Expired (${-d} din pehle, grace me)`:`❌ Expired (${-d} din pehle)`,c:"#dc2626"};
  if(d<=7)return{k:"soon",txt:`⏳ ${d} din bache (${ownerFmtDate(e)})`,c:"#d97706"};
  return{k:"ok",txt:`✅ ${ownerFmtDate(e)} tak`,c:"#16a34a"};
}
function ownerBrandInfoHtml(a){
  const used=Math.round((a.storageUsedBytes||0)/1048576),lim=+a.storageLimitMB||0,sl=+a.studentLimit||0,sc=+a.studentCount||0,ex=ownerExpState(a);
  const full=sl&&sc>=sl,over=lim&&used>=lim,bar=lim?`${used} / ${lim} MB`:`${used} MB`;
  return `<div class="muted-text" style="font-size:.76rem;margin:4px 0 8px;line-height:1.75;">`+
    `${a.brandColor?`<span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:${ownerEsc(a.brandColor)};vertical-align:middle;margin-right:4px;"></span>`:""}`+
    `📦 <b>${ownerEsc(a.plan||"Free")}</b> • <span style="color:${ex.c};font-weight:700;">${ex.txt}</span><br>`+
    `👥 <b style="${full?"color:#dc2626;":""}">${sc}${sl?" / "+sl:""}</b> students${full?" (limit poori)":""} • 💾 <b style="${over?"color:#dc2626;":""}">${bar}</b> • 📄 ${a.storageFiles||0} files</div>`;
}
function ownerBrandingEdit(id){
  const a=(typeof _ownerInstitutesCache!=="undefined"&&_ownerInstitutesCache[id])||{};
  const old=document.getElementById("owner-brand-modal");old&&old.remove();
  const m=document.createElement("div");m.id="owner-brand-modal";
  m.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:14px;";
  const plans=["Free","Basic","Pro","Premium","Custom"];
  m.innerHTML=`<div style="background:#fff;color:#111;border-radius:14px;max-width:420px;width:100%;max-height:92vh;overflow:auto;padding:16px;">
    <h3 style="margin:0 0 10px;">🎨 Branding, Plan &amp; Limits — ${ownerEsc(a.name||id)}</h3>
    <label style="font-size:.8rem;font-weight:600;">App ka rang</label>
    <input id="obr-color" type="color" value="${/^#[0-9a-f]{6}$/i.test(a.brandColor||"")?a.brandColor:"#4f46e5"}" style="width:100%;height:42px;margin:4px 0 10px;">
    <label style="font-size:.8rem;font-weight:600;">Tagline (header ke neeche)</label>
    <input id="obr-tag" type="text" maxlength="60" value="${ownerEscAttr(a.tagline||"")}" placeholder="jaise: Success Starts Here" style="width:100%;padding:8px;margin:4px 0 10px;box-sizing:border-box;">
    <label style="font-size:.8rem;font-weight:600;">Logo (square, chhota)</label>
    <div style="display:flex;gap:10px;align-items:center;margin:4px 0 10px;"><img id="obr-prev" src="${a.logoDataUrl||""}" style="width:52px;height:52px;object-fit:contain;border:1px solid #ddd;border-radius:8px;background:#fafafa;${a.logoDataUrl?"":"visibility:hidden;"}"><input id="obr-logo" type="file" accept="image/*"></div>
    <label style="display:flex;gap:8px;align-items:center;font-size:.82rem;margin:0 0 10px;cursor:pointer;"><input id="obr-hpb" type="checkbox" ${a.hidePoweredBy?"checked":""}> "Powered by The Vishnu Sharma" chhupayein (admit card, result, print me)</label>
    <label style="font-size:.8rem;font-weight:600;">Plan</label>
    <select id="obr-plan" style="width:100%;padding:8px;margin:4px 0 10px;">${plans.map(p=>`<option ${p===(a.plan||"Free")?"selected":""}>${p}</option>`).join("")}</select>
    <label style="font-size:.8rem;font-weight:600;">Drive storage limit (MB) — 0 = bina limit</label>
    <input id="obr-lim" type="number" min="0" value="${+a.storageLimitMB||0}" style="width:100%;padding:8px;margin:4px 0 4px;box-sizing:border-box;">
    <label style="font-size:.8rem;font-weight:600;">Student limit — 0 = bina limit</label>
    <input id="obr-slim" type="number" min="0" value="${+a.studentLimit||0}" style="width:100%;padding:8px;margin:4px 0 10px;box-sizing:border-box;">
    <label style="font-size:.8rem;font-weight:600;">Plan expiry date (khaali = bina expiry)</label>
    <input id="obr-exp" type="date" value="${a.planExpiresAt>0?new Date(a.planExpiresAt+19800000).toISOString().slice(0,10):""}" style="width:100%;padding:8px;margin:4px 0 6px;box-sizing:border-box;">
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;"><button type="button" class="owner-mini-btn" data-add="30">+30 din</button><button type="button" class="owner-mini-btn" data-add="90">+90 din</button><button type="button" class="owner-mini-btn" data-add="365">+1 saal</button><button type="button" class="owner-mini-btn" data-add="0">Expiry hatao</button></div>
    <div class="muted-text" style="font-size:.72rem;margin-bottom:12px;">Abhi use: ${Math.round((a.storageUsedBytes||0)/1048576)} MB (${a.storageFiles||0} files). Ye limit sirf app ke through hue uploads par lagti hai.</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;"><button type="button" id="obr-x" class="owner-mini-btn">Cancel</button><button type="button" id="obr-msg" class="owner-mini-btn">📋 Renew message</button><button type="button" id="obr-reset" class="owner-mini-btn">Usage reset</button><button type="button" id="obr-ok" class="owner-mini-btn" style="background:#4f46e5;color:#fff;">Save</button></div></div>`;
  document.body.appendChild(m);
  let logo=null;
  const preset=()=>{const pl=((window.SNAP_CONFIG||{}).plans||{})[m.querySelector("#obr-plan").value];if(pl&&pl.studentLimit!=null){m.querySelector("#obr-slim").value=pl.studentLimit;m.querySelector("#obr-lim").value=pl.storageLimitMB||0}};
  m.querySelector("#obr-plan").onchange=preset;
  m.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>{const n=+b.getAttribute("data-add"),inp=m.querySelector("#obr-exp");if(!n){inp.value="";return}let base=inp.value?Date.parse(inp.value+"T00:00:00+05:30"):Date.now();if(!(base>Date.now()))base=Date.now();inp.value=new Date(base+n*864e5+19800000).toISOString().slice(0,10)});
  m.querySelector("#obr-x").onclick=()=>m.remove();
  m.querySelector("#obr-logo").onchange=e=>{
    const f=e.target.files[0];if(!f)return;
    const im=new Image(),u=URL.createObjectURL(f);
    im.onload=()=>{const c=document.createElement("canvas"),sc=Math.min(1,256/Math.max(im.width,im.height));c.width=Math.round(im.width*sc);c.height=Math.round(im.height*sc);c.getContext("2d").drawImage(im,0,0,c.width,c.height);logo=c.toDataURL("image/png");if(logo.length>150000)logo=c.toDataURL("image/jpeg",.85);const p=m.querySelector("#obr-prev");p.src=logo;p.style.visibility="visible";URL.revokeObjectURL(u);};
    im.onerror=()=>alert("Image nahi khuli");im.src=u;
  };
  m.querySelector("#obr-msg").onclick=()=>{
    const v=m.querySelector("#obr-exp").value,ds=v?new Date(Date.parse(v+"T00:00:00+05:30")).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"Asia/Kolkata"}):"jald hi";
    const t=`Namaste! ${a.name||"Aapke institute"} ka The Vishnu Sharma (${m.querySelector("#obr-plan").value} plan) ${ds} ko khatam ho raha hai. Students ka access na ruke, isliye kripya renew kara lein. Renew ke liye mujhe reply karein. Dhanyavaad!`;
    (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>{alert("✅ Message copy ho gaya — WhatsApp me paste karke bhej dein.")},()=>{prompt("Copy karein:",t)});
  };
  m.querySelector("#obr-reset").onclick=async()=>{
    if(!confirm("Is institute ka storage usage counter 0 kar du? (sirf tab jab counter galat ho gaya ho)"))return;
    try{await ownerRetryOnPermissionDenied(()=>ownerGetDb().collection("institutes").doc(id).update({storageUsedBytes:0,storageFiles:0}));try{localStorage.removeItem("snap_brand_"+id)}catch(e){}alert("Usage reset ho gaya.");m.remove();}catch(e){alert("Nahi hua: "+(e.message||e));}
  };
  m.querySelector("#obr-ok").onclick=async()=>{
    const d={brandColor:m.querySelector("#obr-color").value,tagline:m.querySelector("#obr-tag").value.trim(),plan:m.querySelector("#obr-plan").value,storageLimitMB:Math.max(0,+m.querySelector("#obr-lim").value||0),studentLimit:Math.max(0,Math.floor(+m.querySelector("#obr-slim").value||0)),planExpiresAt:(()=>{const v=m.querySelector("#obr-exp").value;const t=v?Date.parse(v+"T23:59:59+05:30"):0;return t>0?t:0})(),hidePoweredBy:!!m.querySelector("#obr-hpb").checked};
    if(logo)d.logoDataUrl=logo;
    try{await ownerRetryOnPermissionDenied(()=>ownerGetDb().collection("institutes").doc(id).update(d));try{localStorage.removeItem("snap_brand_"+id)}catch(e){}m.remove();alert("✅ Save ho gaya. Is institute ke admin/students ko agli baar app khulne par naya look dikhega.");}catch(e){alert("Save nahi hua: "+(e.message||e));}
  };
}


/* ===== v176: Owner Dashboard (plan/expiry/students/storage), Recount, CSV, APK build button ===== */
async function ownerWorkerCall(path,method,body){
  const W=(window.SNAP_CONFIG&&window.SNAP_CONFIG.workerUrl)||"https://cool-thunder-a280.vishnu1234stm.workers.dev";
  const u=(ownerGetAuth().currentUser||firebase.auth().currentUser);if(!u||!u.email)throw new Error("Owner login chahiye");
  const r=await fetch(W+path,{method:method||"GET",headers:Object.assign({Authorization:"Bearer "+await u.getIdToken()},body?{"Content-Type":"application/json"}:{}),body:body?JSON.stringify(body):undefined});
  const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw new Error(j.error||("HTTP "+r.status));return j;
}
let _ownerDashFilter="all";
function ownerDashHtml(){
  const L=Object.values(_ownerInstitutesCache).filter(a=>!a.isDemo);let act=0,off=0,soon=0,exp=0,stu=0,bytes=0,full=0;
  L.forEach(a=>{a.active===false?off++:act++;const e=ownerExpState(a);if(e.k==="soon")soon++;if(e.k==="expired")exp++;stu+=+a.studentCount||0;bytes+=+a.storageUsedBytes||0;if(+a.studentLimit>0&&(+a.studentCount||0)>=+a.studentLimit)full++});
  const card=(n,l,c)=>`<div style="flex:1 1 92px;min-width:92px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:8px;text-align:center;"><div style="font-size:1.15rem;font-weight:800;color:${c||"#111"};">${n}</div><div style="font-size:.68rem;color:#666;">${l}</div></div>`;
  const chip=(k,l)=>`<button type="button" class="owner-mini-btn" data-f="${k}" style="${_ownerDashFilter===k?"background:#4f46e5;color:#fff;":""}">${l}</button>`;
  return `<div style="margin:8px 0 14px;"><div style="display:flex;flex-wrap:wrap;gap:6px;">`+
    card(L.length,"Total institutes")+card(act,"Active","#16a34a")+card(off,"Inactive",off?"#dc2626":"#111")+card(soon,"7 din me expire",soon?"#d97706":"#111")+card(exp,"Expired",exp?"#dc2626":"#111")+card(stu,"Total students")+card(full,"Limit poori",full?"#dc2626":"#111")+card((bytes/1073741824).toFixed(2)+" GB","Drive use")+
    `</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center;">${chip("all","Sab")}${chip("soon","⏳ Jaldi expire")}${chip("expired","❌ Expired")}${chip("off","⛔ Inactive")}${chip("full","👥 Limit poori")}`+
    `<span style="flex:1"></span><button type="button" class="owner-mini-btn" id="owner-recount-all">🔄 Student count sahi karo</button><button type="button" class="owner-mini-btn" id="owner-csv">⬇️ CSV</button></div><div id="owner-dash-msg" class="muted-text" style="font-size:.74rem;margin-top:4px;"></div></div>`;
}
function ownerDashApplyFilter(){
  document.querySelectorAll("#owner-institutes-list .owner-inst-card").forEach(c=>{
    const a=_ownerInstitutesCache[c.getAttribute("data-iid")]||{},e=ownerExpState(a);
    const ok=_ownerDashFilter==="all"||(_ownerDashFilter==="soon"&&e.k==="soon")||(_ownerDashFilter==="expired"&&e.k==="expired")||(_ownerDashFilter==="off"&&a.active===false)||(_ownerDashFilter==="full"&&+a.studentLimit>0&&(+a.studentCount||0)>=+a.studentLimit);
    c.style.display=ok?"":"none";
  });
}
function ownerRenderDashboard(){
  const list=document.getElementById("owner-institutes-list");if(!list)return;
  let d=document.getElementById("owner-dash");if(!d){d=document.createElement("div");d.id="owner-dash";list.parentNode.insertBefore(d,list)}
  d.innerHTML=ownerDashHtml();
  d.querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>{_ownerDashFilter=b.getAttribute("data-f");ownerRenderDashboard()});
  d.querySelector("#owner-recount-all").onclick=ownerRecountAll;d.querySelector("#owner-csv").onclick=ownerExportCsv;
  ownerDashApplyFilter();
}
async function ownerRecountAll(){
  const msg=document.getElementById("owner-dash-msg"),ids=Object.keys(_ownerInstitutesCache).filter(k=>!_ownerInstitutesCache[k].isDemo);if(!ids.length)return;
  if(!confirm(ids.length+" institutes ke student count Firestore se ginkar sahi kiye jaayenge (Worker se). Chalu karein?"))return;
  let done=0;
  try{
    for(let i=0;i<ids.length;i+=20){
      msg&&(msg.textContent="Count ho raha hai… "+done+" / "+ids.length);
      const j=await ownerWorkerCall("/owner/recount","POST",{ids:ids.slice(i,i+20)});
      Object.keys(j.counts||{}).forEach(k=>{if(_ownerInstitutesCache[k])_ownerInstitutesCache[k].studentCount=j.counts[k]});
      done+=Math.min(20,ids.length-i);
    }
    msg&&(msg.textContent="✅ Sab institutes ka student count sahi ho gaya.");ownerRenderList();
  }catch(e){msg&&(msg.textContent="❌ "+(e.message||e)+(/GITHUB|Worker|HTTP|Failed to fetch/i.test(e.message||"")?"":""))}
}
function ownerExportCsv(){
  const q=v=>'"'+String(v==null?"":v).replace(/"/g,'""')+'"',rows=[["Naam","ID","Active","Plan","Expiry","Students","Student limit","Storage MB","Storage limit MB","Files"]];
  Object.values(_ownerInstitutesCache).sort((a,b)=>(a.name||"").localeCompare(b.name||"")).forEach(a=>rows.push([a.name||"",a.id,a.active===false?"No":"Yes",a.plan||"Free",a.planExpiresAt>0?new Date(a.planExpiresAt+19800000).toISOString().slice(0,10):"",a.studentCount||0,a.studentLimit||0,Math.round((a.storageUsedBytes||0)/1048576),a.storageLimitMB||0,a.storageFiles||0]));
  const b=new Blob(["\ufeff"+rows.map(r=>r.map(q).join(",")).join("\n")],{type:"text/csv"}),u=URL.createObjectURL(b),a=document.createElement("a");
  a.href=u;a.download="snaptestpro-institutes-"+new Date().toISOString().slice(0,10)+".csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);
}
/* ownerRenderList ke baad dashboard + filter apne aap */
(function(){const _o=ownerRenderList;ownerRenderList=function(){const r=_o.apply(this,arguments);try{ownerRenderDashboard()}catch(e){console.warn("[owner dash]",e)}return r}})();

/* ===== Institute ka apna APK / App Link (+ "APK banao" button) ===== */
function ownerApkInfo(id){
  const a=(typeof _ownerInstitutesCache!=="undefined"&&_ownerInstitutesCache[id])||{};
  const cfg=window.SNAP_CONFIG||{},repo=cfg.githubRepo||"thevishnusharma/thevishnusharma.github.io",web=(cfg.webUrl||"https://thevishnusharma.github.io/").replace(/\/?$/,"/");
  const slug=String(id).toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,40),pkg="com.snaptestpro.i"+slug;
  const link=web+"?inst="+encodeURIComponent(id),act="https://github.com/"+repo+"/actions/workflows/build-institute-apk.yml";
  const old=document.getElementById("owner-apk-modal");old&&old.remove();
  const m=document.createElement("div");m.id="owner-apk-modal";
  m.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:14px;";
  const row=(l,v)=>`<div style="margin:8px 0;"><div style="font-size:.74rem;color:#666;">${l}</div><div style="display:flex;gap:6px;"><input readonly value="${ownerEscAttr(v)}" style="flex:1;padding:7px;font-size:.78rem;min-width:0;"><button type="button" class="owner-mini-btn" data-copy="${ownerEscAttr(v)}">Copy</button></div></div>`;
  m.innerHTML=`<div style="background:#fff;color:#111;border-radius:14px;max-width:440px;width:100%;max-height:92vh;overflow:auto;padding:16px;">
    <h3 style="margin:0 0 4px;">📱 ${ownerEsc(a.name||id)} — APK / App Link</h3>
    <div style="font-size:.78rem;margin-bottom:8px;">Status: <b style="color:${a.active===false?"#dc2626":"#16a34a"}">${a.active===false?"DEACTIVE (app band hai)":"ACTIVE"}</b> • Plan: <b style="color:${ownerExpState(a).c}">${ownerExpState(a).txt}</b></div>
    <div id="oap-st" style="font-size:.84rem;line-height:1.5;background:#f4f4ff;border-radius:10px;padding:10px;margin-bottom:8px;">APK status check ho raha hai…</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px;"><button type="button" id="oap-go" class="owner-mini-btn" style="background:#4f46e5;color:#fff;">🚀 APK banao / update karo</button><button type="button" id="oap-rf" class="owner-mini-btn">🔄 Status</button></div>
    ${row("Is institute ka web/app link (bina APK ke bhi chalega)",link)}
    ${row("Institute ID",id)}
    ${row("APK ka package naam",pkg)}
    <div style="font-size:.74rem;color:#555;margin:6px 0 10px;line-height:1.5;">Logo, naam, rang apne aap lagte hain (pehle "🎨 Branding" me logo daal do). Website update karte hi Live-mode APK sab update ho jaate hain — naya APK sirf icon/naam badalne par chahiye.</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;"><button type="button" id="oap-x" class="owner-mini-btn">Band karo</button><a href="${act}" target="_blank" rel="noopener" class="owner-mini-btn" style="text-decoration:none;padding:8px 12px;border-radius:8px;">GitHub Actions</a></div></div>`;
  document.body.appendChild(m);
  const st=m.querySelector("#oap-st");let timer=null;
  const stop=()=>{timer&&clearInterval(timer);timer=null};
  m.querySelector("#oap-x").onclick=()=>{stop();m.remove()};
  m.querySelectorAll("[data-copy]").forEach(b=>b.onclick=()=>{const t=b.getAttribute("data-copy");(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>{b.textContent="✓"},()=>{prompt("Copy karein:",t)})});
  const show=(h)=>{if(document.body.contains(m))st.innerHTML=h};
  async function refresh(){
    try{
      const j=await ownerWorkerCall("/owner/apk-status?instituteId="+encodeURIComponent(id)),r=j.run;
      const dl=j.apkUrl?`<br>📥 <a href="${ownerEscAttr(j.apkUrl)}" target="_blank" rel="noopener"><b>APK download</b></a> <button type="button" class="owner-mini-btn" id="oap-cp">Link copy</button><br><span style="color:#666;font-size:.74rem;">${ownerEsc(j.version||"")}</span>`:"";
      if(!r){show(j.apkUrl?"✅ APK tayyar hai."+dl:"Abhi tak is institute ka APK nahi bana. <b>🚀 APK banao</b> dabao.");}
      else if(r.status!=="completed"){show("⏳ APK ban raha hai (10-15 min lagte hain)…"+(j.apkUrl?"<br>Pichla APK:"+dl:""));if(!timer)timer=setInterval(()=>{if(!document.body.contains(m))return stop();refresh()},20000)}
      else{stop();show(r.conclusion==="success"?(j.apkUrl?"✅ APK tayyar hai!"+dl:`✅ Build ho gaya par release link nahi mila (keystore secret nahi hoga?) — <a href="${ownerEscAttr(r.url)}" target="_blank" rel="noopener">GitHub run kholo</a>`):`❌ Build fail hua — <a href="${ownerEscAttr(r.url)}" target="_blank" rel="noopener">logs dekhein</a>`+(j.apkUrl?"<br>Pichla chalta APK:"+dl:""))}
      /* v288: APK link Chrome me khule (WebView me download dikhta nahi) */
      m.querySelectorAll('a[href$=".apk"]').forEach(a=>{a.onclick=ev=>{ev.preventDefault();location.href=a.href}});
      const cp=m.querySelector("#oap-cp");if(cp)cp.onclick=()=>{navigator.clipboard&&navigator.clipboard.writeText(j.apkUrl).then(()=>{cp.textContent="✓"})};
    }catch(e){stop();show("⚠️ Status nahi mila: "+ownerEsc(e.message||e)+(/GITHUB_TOKEN/.test(e.message||"")?"<br>Guide ka 'Worker me GITHUB_TOKEN' step karein.":""))}
  }
  m.querySelector("#oap-rf").onclick=refresh;
  m.querySelector("#oap-go").onclick=async()=>{
    if(a.active===false&&!confirm("Ye institute abhi DEACTIVE hai — APK banega par app 'band hai' dikhayegi. Phir bhi banayein?"))return;
    if(!confirm((a.name||id)+" ka APK banana shuru karein? (10-15 min lagte hain)"))return;
    show("🚀 Build shuru kar raha hu…");
    try{await ownerWorkerCall("/owner/apk","POST",{instituteId:id,appName:"",live:true});show("⏳ Build shuru ho gaya. Kuch second me status aayega…");setTimeout(refresh,8000)}
    catch(e){show("❌ "+ownerEsc(e.message||e)+(/GITHUB_TOKEN/.test(e.message||"")?"<br>Guide ka 'Worker me GITHUB_TOKEN' step karein.":""))}
  };
  refresh();
}
