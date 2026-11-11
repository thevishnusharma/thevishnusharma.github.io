/* ============================================================
   The Vishnu Sharma — APP CONFIG (Owner/Developer ek hi jagah se badle)
   Yahan jo likhoge wahi Student app aur Admin app dono ke
   Help & Support / About me dikhega. Khaali ("") chhodne par wo
   option apne-aap chhup jata hai.
   ============================================================ */
window.SNAP_CONFIG = {
  appName: "The Vishnu Sharma",
  // HYBRID MODE: kuch collections free apne backend par. enabled:false = sab kuch Firebase par (kill-switch). enabled:true = chalu.
  ownBackend: {
    enabled: true,
    url: "https://thevishnusharma-backend.onrender.com",
    collections: ["questionBank", "deletedQuestions", "seedExclusions", "draftQuestions", "pdfDrafts"]
  },
  bankAutoFix: false,  // v226 READS FIX: true karne par admin login par question-bank ki auto class-tag / chapter-merge / ID-migration chalti hai (har question par 2 reads+write+delete — bahut mehngi). Default false. Ek baar chalane ke liye console me: runBankAutoFixNow()
  serverAuth: false,   // Phase 4: true karne par login/register/PIN Worker se (salted hash + rate limit). Pehle docs/PHASE4_AUTH.md padhein.
  appCheck: {
    enabled: true,
    webSiteKey: "",           // Firebase Console > App Check > Web app reCAPTCHA v3 site key; public site key only
    nativeEnabled: true,
    tokenAutoRefresh: true
  },
  tagline: "Smart Practice • Better Result",
  version: "1.4.29",
  workerUrl: "https://vishnupush.thevishnusharmaapp.workers.dev",   // Cloudflare Worker (bank + push + owner alerts)
  ownFiles: false,                                                    // DEPRECATED (v216): Cloudflare R2 "SnapFiles" band hai aur rahega — file upload ab Google Drive se. Code abhi rakha hai, aage hatega.
  googleClientId: "1009250922801-16aubac9rbmnlvpru734phg5c3e8c4rn.apps.googleusercontent.com",                                                 // <-- yahan Google OAuth Web Client ID daalein (DRIVE_SETUP_HINDI.md dekhein). Khaali = Drive upload band
  branding2: true,                                                    // v221: gehri branding — splash, login card, result sheet, print header, "Powered by". false = purana look (kill-switch)
  demo: true,                                                         // v220: Owner Panel "Demo Institute" (seed/reset). false = buttons chhup jate hain (kill-switch)
  onboarding: true,                                                   // v219: Owner Panel "Naya Institute" wizard + Drive status/banner. false = purana single form (kill-switch)
  driveRequired: false,                                               // v219: true karne par (aur googleClientId set hone par) Drive na jure institute ka FILE upload band; links/YouTube chalte rahenge
  catalog: true,                                                      // v218: batch ki list chhote catalog se (reads kam). false = purana tareeka (poore items padhna)
  youtubeLive: true,                                                  // v217: live class = YouTube embed (ytId). false = Phase 0 wala purana link-prompt (kill-switch)
  driveUpload: true,
  brandMark: true,                                                    // v233: har output (admit card, result sheet, paper print) par "Powered by The Vishnu Sharma" tag. Institute-wise chhupana: Owner Panel hidePoweredBy. false = sab jagah band
  registration: true,                                                 // v231: Test se pehle "Registration" (students + shuffled roll + admit card). false = band
  roster: true,                                                       // v230: Exam Manager me "Admit Card & Roster" + scan par roll-match/anomaly check. false = purana scan flow (kill-switch)
  admitCard: true,                                                    // v230: student dashboard par "Admit Card" card. false = card nahi dikhta (kill-switch)
  topperCard: true,                                                   // v223 Phase 5A: topper image card (Result Tools). false = tab chhup jata hai
  parentReport: true,                                                 // v223 Phase 5A: parent WhatsApp report (Result Tools). false = tab chhup jata hai
  antiCheat: true,                                                    // v223 Phase 5B: timed test me tab/app switch ginti (sirf record). false = band
  analytics: true,                                                    // v223 Phase 5B: admin analytics tab (Result Tools). false = tab chhup jata hai
  resultTools: true,                                                  // v223 Phase 5: Records hub ka "Result Tools" card. false = card nahi banta
  feeDue: true,                                                       // v223 Phase 5C: Batch Admin me "Fee Due" section. false = section nahi jurta
  dailyChallenge: true,                                               // v223 Phase 5D: student ka "Aaj ka Challenge" + revision card. false = card nahi dikhta
  githubRepo: "thevishnusharma/thevishnusharma.github.io",                   // Owner Panel ke "📱 APK" button ke liye
  webUrl: "https://thevishnusharma.github.io/",
  graceDays: 3,                                                       // plan expire ke baad itne din app chalta rehta hai (rules me bhi 3 din)
  plans: {                                                            // Owner Panel ke "Branding & Plan" ke preset — number aap badal sakte ho
    Free:    { studentLimit: 30,   storageLimitMB: 500 },
    Basic:   { studentLimit: 150,  storageLimitMB: 3000 },
    Pro:     { studentLimit: 500,  storageLimitMB: 10000 },
    Premium: { studentLimit: 2000, storageLimitMB: 30000 },
    Custom:  {}
  },
  appLock: true,                                                      // institute-APK / ?inst= link lock + "app band hai" screen (kill-switch)
  ownerAlertEmail: "thevishnusharmaapp@gmail.com",                         // is email se login par owner app me alerts ka push aata hai
  build: "243",
  ownerName: "Vishnu Sharma",
  supportPhone: "9525208263",
  supportWhatsapp: "9525208263",          // WhatsApp number (khaali = phone wala use hoga)
  supportEmail: "thevishnusharmaapp@gmail.com",
  supportHours: "Roz 10:00 AM – 7:00 PM",
  website: "https://thevishnusharma.github.io",
  privacyUrl: "/privacy.html",            // Privacy Policy
  termsUrl: "/terms.html",                // Terms & Conditions
  privacyVersion: "2026-10-15-v1",
  termsVersion: "2026-10-15-v1",
  adminFaqs: [
    ["Naya test kaise banayein?", "Admin Dashboard → Tests → Naya Test. Questions Question Bank se chunein, time/marks set karein aur Publish karein."],
    ["Students ko notification kaise bhejein?", "Dashboard → 🔔 Notification. Title aur message likhkar 'Students ko bhejein' dabayein. App band hone par bhi students ko mil jata hai."],
    ["Student ka password bhool gaya?", "Records / Students list me us student ko chunkar Password Reset karein."],
    ["Nayi class ya subject kaise jodein?", "Owner se contact karein — class list institute ke hisaab se Owner Panel se set hoti hai."],
    ["Data ya result nahi dikh raha?", "Settings → App & Data → 'Cache saaf karke refresh' dabayein. Login bana rahega."]
  ]
};
