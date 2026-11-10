#!/usr/bin/env python3
"""The Vishnu Sharma — system map + data map (PNG/PDF). Chalane ke liye: pip install matplotlib; python3 scripts/make-diagrams.py
Code badle (naya service/collection jude) to yahan ka text badal kar dobara chalayein. Output: docs/diagrams/"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "diagrams")
os.makedirs(OUT, exist_ok=True)
plt.rcParams["font.family"] = "DejaVu Sans"
INK, MUTED, BG = "#0f172a", "#475569", "#f8fafc"

def box(ax, x, y, w, h, title, lines=(), fc="#ffffff", ec="#334155", head="#334155", dashed=False, tsize=17, lsize=14.0, lh=2.75):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0,rounding_size=1.6", fc=fc, ec=ec, lw=2.2, ls="--" if dashed else "-", zorder=2))
    ax.add_patch(FancyBboxPatch((x, y + h - 4.6), w, 4.6, boxstyle="round,pad=0,rounding_size=1.6", fc=head, ec=head, lw=0, zorder=3))
    ax.add_patch(plt.Rectangle((x, y + h - 4.6), w, 2.0, fc=head, ec=head, lw=0, zorder=3))
    ax.text(x + 1.6, y + h - 2.35, title, fontsize=tsize, fontweight="bold", color="white", va="center", ha="left", zorder=4)
    cy = y + h - 7.4
    for ln in lines:
        bold = ln.startswith("*")
        txt = ln[1:] if bold else ln
        col = INK
        if txt.startswith("(OFF)") or txt.startswith("(band)"): col = "#b91c1c"
        ax.text(x + 1.8, cy, txt, fontsize=lsize, color=col, va="center", ha="left", fontweight="bold" if bold else "normal", zorder=4)
        cy -= lh

def arrow(ax, p1, p2, label="", color="#1e293b", rad=0.0, lx=None, ly=None, both=False, dashed=False, lsize=10.6, lw=2.6):
    st = "<|-|>" if both else "-|>"
    ax.add_patch(FancyArrowPatch(p1, p2, arrowstyle=st, mutation_scale=22, lw=lw, color=color, connectionstyle=f"arc3,rad={rad}", ls="--" if dashed else "-", zorder=1))
    if label:
        mx, my = (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2
        ax.text(lx if lx is not None else mx, ly if ly is not None else my, label, fontsize=lsize, color=color, ha="center", va="center", fontweight="bold",
                bbox=dict(boxstyle="round,pad=0.35", fc="white", ec=color, lw=1.2), zorder=6)

def canvas(w=24, h=15):
    fig = plt.figure(figsize=(w, h), dpi=150, facecolor=BG)
    ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, 240); ax.set_ylim(0, 150 if h == 15 else 150 * h / 15); ax.axis("off")
    return fig, ax

# ===================================================================== 1. SYSTEM MAP
fig, ax = canvas()
ax.add_patch(plt.Rectangle((0, 141), 240, 9, fc=INK, ec=INK))
ax.text(3, 145.5, "The Vishnu Sharma  —  System Map", fontsize=26, color="white", fontweight="bold", va="center")
ax.text(237, 145.5, "Build 240  |  web 1.4.26  |  Firebase project: the-vishnu-sharma (Spark / free plan)", fontsize=13, color="#cbd5e1", va="center", ha="right")

# --- Row A: apps
ax.text(3, 137.6, "A.  USER APPS  (sabka code ek hi repo me)", fontsize=14, color=MUTED, fontweight="bold")
apps = [
    ("Student App", ["Web (PWA) + Android APK", "Login: mobile + PIN", "Tests dena, result, admit card,", "daily challenge, notifications"]),
    ("Admin / Teacher App", ["Wahi Web + APK, role login se", "Login: email + password", "Tests, question bank, records,", "batches, OMR, fees, students"]),
    ("Owner App", ["owner-app.html + Owner APK", "com.snaptestpro.owner", "Tabs: Home, Institutes, Alerts,", "Reads (naya), Settings"]),
    ("Institute APK", ["Har institute ka apna APK", "Owner Panel -> 'APK banao'", "Branding + lock (appLock)", "GitHub Actions banata hai"]),
]
for i, (t, ls_) in enumerate(apps):
    box(ax, 3 + i * 59.3, 117, 56, 19.5, t, ls_, fc="#eef2ff", ec="#4f46e5", head="#4f46e5")

# --- Row B: three columns
ax.text(3, 113.4, "B.  DELIVERY, BACKEND AUR DATA", fontsize=14, color=MUTED, fontweight="bold")
# GitHub (left)
box(ax, 3, 56, 66, 56, "GitHub  (code + hosting)", [
    "*Repo: thevishnusharma/thevishnusharma.github.io",
    "*GitHub Pages",
    "   Site: thevishnusharma.github.io",
    "   Student/Admin/Owner web yahin se",
    "   sw.js = offline cache",
    "*GitHub Releases",
    "   APK files + app-version.json",
    "*GitHub Actions (workflows)",
    "   auto-extract: zip upload -> files",
    "   build-android / institute-apk /",
    "   owner-apk, ci, announce-update",
    "*Secrets: signing, WORKFLOW_PAT",
], fc="#f1f5f9", ec="#1e293b", head="#1e293b", lsize=13.6, lh=3.65)
# CDN under GitHub
box(ax, 3, 33, 66, 20, "CDN (libraries, free)", [
    "cdnjs.cloudflare.com, cdn.jsdelivr.net,",
    "unpkg.com  -> JS libraries",
    "gstatic.com -> Firebase SDK 9.22 (compat)",
    "Google Fonts -> fonts",
], fc="#f8fafc", ec="#64748b", head="#64748b", lsize=12.8, lh=2.85)

# Firebase (middle)
box(ax, 79, 33, 80, 79, "Firebase / Google Cloud project", [
    "*Authentication",
    "   Admin + Owner: email/password",
    "   Student: anonymous (+ PIN check)",
    "(OFF) custom-token login (serverAuth)",
    "*Cloud Firestore  (main database)",
    "   institutes/{id}/ batches, subjects,",
    "   chapters, items, roster, ver",
    "   tests (+ qchunks), students,",
    "   studentRecords, admins, questionBank,",
    "   questionReports, deletedQuestions",
    "   Rules = access control",
    "*App Check",
    "   APK: config ON  |  Web: key khali (OFF)",
    "*Cloud Messaging (FCM)",
    "   Push notification to phones",
    "*Storage",
    "(band) SDK load hota hai; upload Drive se",
    "*Quota (Spark): 50K reads/din, 20K writes/din",
], fc="#fffbeb", ec="#b45309", head="#d97706", lsize=14.6, lh=3.45)

# Cloudflare (right)
box(ax, 169, 56, 68, 56, "Cloudflare Worker", [
    "*cool-thunder-a280.workers.dev",
    "/bank, /bank/chunk   question bank",
    "/student/login, /register, /set-pin,",
    "   /reset-with-pin, /delete-account",
    "/alert, /alerts, /broadcast  push+alert",
    "/readlog + /owner/reads/*  Reads Monitor",
    "/owner/apk, /owner/recount",
    "*Cron: reminders, nightly recount,",
    "   daily expiry digest",
    "*Secrets: service account, owner emails,",
    "   Telegram, GitHub token",
], fc="#fff7ed", ec="#c2410c", head="#ea580c", lsize=13.6, lh=4.1)
box(ax, 169, 33, 68, 20, "Worker ke andar ka data", [
    "*KV (BANK_KV): bank chunks, alerts history",
    "*D1 (READS_DB): Reads Monitor logs",
    "(band) R2 / FILES_KV: file store band hai",
], fc="#fff7ed", ec="#c2410c", head="#c2410c", lsize=13.6, lh=3.6)

# --- Row C: Google + others
ax.text(3, 29.4, "C.  GOOGLE AUR BAAKI SERVICES", fontsize=14, color=MUTED, fontweight="bold")
box(ax, 3, 3, 78, 24, "Google Cloud Console + Google APIs", [
    "*IAM service account: Worker Firestore/FCM ke liye",
    "*OAuth Client ID: Google Drive login (drive upload)",
    "*Google Drive: institute ki files (PDF/photo/video)",
    "(OFF) Cloud Monitoring API: Billing (Blaze) chahiye",
    "   -> Reads tab me 'haath se mel' box",
], fc="#ecfdf5", ec="#047857", head="#059669", lsize=13.0, lh=2.85)
box(ax, 85, 3, 74, 24, "Google Forms / Apps Script / YouTube", [
    "*Exam registration: auto Google Form + Apps Script",
    "   web-app (script.google.com) se responses pull",
    "*YouTube: live class (embed)",
    "*Google Docs viewer: PPT/DOC/XLS dikhane ke liye",
], fc="#ecfdf5", ec="#047857", head="#059669", lsize=13.0, lh=2.85)
box(ax, 163, 3, 74, 24, "Baaki (outside)", [
    "*Telegram bot: Worker se owner alert (optional)",
    "*WhatsApp (wa.me links): parent report, support",
    "*ChatGPT: sirf copy-paste (OMR prompt), API nahi",
], fc="#f8fafc", ec="#64748b", head="#64748b", lsize=13.0, lh=2.85)

# --- arrows
arrow(ax, (36, 112), (36, 117), "", color="#1e293b")
ax.text(46, 114.6, "app ka code + APK download (sab apps ko)", fontsize=10.6, color="#1e293b", fontweight="bold", va="center", ha="left", zorder=6,
        bbox=dict(boxstyle="round,pad=0.35", fc="white", ec="#1e293b", lw=1.2))
arrow(ax, (118, 117), (118, 112), "", color="#b45309")
ax.text(122, 114.4, "SDK: Auth + Firestore  (direct, rules + App Check)", fontsize=10.6, color="#b45309", fontweight="bold", va="center",
        bbox=dict(boxstyle="round,pad=0.35", fc="white", ec="#b45309", lw=1.2), zorder=6)
arrow(ax, (203, 117), (203, 112), "", color="#c2410c")
ax.text(204, 114.4, "HTTPS: /bank, /student/*, /readlog", fontsize=10.6, color="#c2410c", fontweight="bold", va="center", ha="center",
        bbox=dict(boxstyle="round,pad=0.35", fc="white", ec="#c2410c", lw=1.2), zorder=6)
arrow(ax, (159, 85), (169, 85), "", color="#7c2d12", both=True, lw=3.0)
ax.text(164, 92.2, "REST +\nservice\naccount", fontsize=9.6, color="#7c2d12", fontweight="bold", ha="center", va="center", zorder=6,
        bbox=dict(boxstyle="round,pad=0.25", fc="white", ec="#7c2d12", lw=1.1))
arrow(ax, (203, 56), (203, 53), "", color="#c2410c", lw=2.2)
arrow(ax, (42, 33), (42, 27), "", color="#047857", lw=2.2)
arrow(ax, (118, 33), (118, 27), "", color="#047857", lw=2.2)
arrow(ax, (203, 33), (203, 27), "", color="#64748b", lw=2.2)
ax.text(66, 29.5, "apps se: Drive upload, YouTube, Forms", fontsize=9.6, color="#047857", fontweight="bold", ha="center", va="center", zorder=6,
        bbox=dict(boxstyle="round,pad=0.25", fc="white", ec="#047857", lw=1.1))
ax.text(172, 29.4, "Worker se: Telegram, GitHub API", fontsize=9.6, color="#475569", fontweight="bold", ha="center", va="center", zorder=6,
        bbox=dict(boxstyle="round,pad=0.25", fc="white", ec="#64748b", lw=1.1))
ax.text(118, 0.9, "Chhote kaam: FCM push -> Firebase se seedha phone par.  Laal text (OFF)/(band) = config me band ya use nahi ho raha.  Ye chart code se banaya gaya hai (v240).",
        fontsize=10.2, color=MUTED, ha="center", va="center")
fig.savefig(os.path.join(OUT, "SYSTEM_MAP.png"), dpi=150, facecolor=BG)
fig.savefig(os.path.join(OUT, "SYSTEM_MAP.pdf"), facecolor=BG)
plt.close(fig)

# ===================================================================== 2. DATA MAP
rows = [
    ("Students, admins, institutes, batches", "Firebase Firestore", "Student/Admin app (SDK), Worker (REST)", "institutes/{id}/batches, items, roster ... ; students, admins"),
    ("Tests aur questions (tests, qchunks)", "Firebase Firestore", "Admin likhta, Student padhta", "tests/{id}/qchunks = bade tests ke tukde"),
    ("Student ke results / records", "Firebase Firestore", "Student likhta, Admin padhta", "studentRecords (sabse zyada reads yahin se)"),
    ("Question Bank (master)", "Firebase Firestore", "Admin app", "questionBank ~7,550 docs; poora padhna mehnga"),
    ("Question Bank (tez copy)", "Cloudflare KV + phone IndexedDB", "Worker /bank, Admin app", "Pehle yahin se, fail ho to peela banner (v235)"),
    ("Version marker (read-diet)", "Firebase Firestore", "Admin likhta, apps padhte", "institutes/{id}/ver/main: cache valid hai ya nahi"),
    ("Login: Admin / Owner", "Firebase Authentication", "Email + password", "Owner = OWNER_EMAILS (Worker secret)"),
    ("Login: Student", "Firebase Auth (anonymous) + Firestore", "Mobile + PIN (Firestore se check)", "Server hashing (Phase 4) code me hai par OFF"),
    ("Uploaded files (PDF, photo, video)", "Google Drive (institute ka)", "Admin app, Google OAuth", "Upload ab Drive se; Storage SDK / R2 band"),
    ("Push notification tokens + bhejna", "Firebase Cloud Messaging", "Worker /broadcast, /alert", "App me @capacitor-firebase/messaging"),
    ("Owner alerts ka history", "Cloudflare KV (key: alerts)", "Worker, Owner App 'Alerts'", "Aakhri 60 + Telegram copy"),
    ("Reads Monitor ke logs", "Cloudflare D1 (READS_DB)", "Tracker -> /readlog -> Owner 'Reads'", "14 din baad auto-saaf. Console ke reads nahi ginta"),
    ("Exam registration responses", "Google Forms (Apps Script)", "Admin app pull karta hai", "exam-registration.js"),
    ("App ka code / APK / versions", "GitHub (repo, Pages, Releases)", "Aap zip upload, Actions banate", "thevishnusharma.github.io, app-version.json"),
    ("Offline cache (phone par)", "localStorage + IndexedDB + sw.js", "Har app khud", "Records/students list, bank copy, tests meta"),
]
H = 15 + (len(rows) - 12) * 0.9
fig, ax = canvas(24, 15)
ax.add_patch(plt.Rectangle((0, 141), 240, 9, fc=INK, ec=INK))
ax.text(3, 145.5, "Data Map  —  kaun sa data kahan rakha hai", fontsize=26, color="white", fontweight="bold", va="center")
ax.text(237, 145.5, "Build 240", fontsize=13, color="#cbd5e1", va="center", ha="right")
cols = [3, 62, 112, 168]; wid = [58, 49, 55, 69]
heads = ["DATA", "KAHAN RAKHA HAI", "KAUN PADHTA / LIKHTA", "NOTE"]
y0 = 134.0
for cx, w, hd in zip(cols, wid, heads):
    ax.add_patch(plt.Rectangle((cx - 0.5, y0), w + 0.9, 5.2, fc="#334155", ec="white", lw=1.2))
    ax.text(cx + 0.8, y0 + 2.6, hd, fontsize=13, color="white", fontweight="bold", va="center")
store_col = {"Firebase": "#fef3c7", "Cloudflare": "#ffedd5", "Google": "#d1fae5", "GitHub": "#e2e8f0", "phone": "#e0e7ff"}
def tint(s):
    for k, v in store_col.items():
        if k.lower() in s.lower() or (k == "phone" and "localStorage" in s): return v
    return "#ffffff"
rh = 8.0
for i, r in enumerate(rows):
    y = y0 - (i + 1) * rh
    for j, (cx, w) in enumerate(zip(cols, wid)):
        fc = tint(r[1]) if j == 1 else ("#ffffff" if i % 2 == 0 else "#f1f5f9")
        ax.add_patch(plt.Rectangle((cx - 0.5, y), w + 0.9, rh, fc=fc, ec="#cbd5e1", lw=1.0))
        ax.text(cx + 0.8, y + rh / 2, r[j], fontsize=12.4 if j != 1 else 12.6, color=INK, va="center", fontweight="bold" if j in (0, 1) else "normal", clip_on=True)
ax.text(3, 7.6, "Rang: peela = Firebase, narangi = Cloudflare, hara = Google (Drive/Forms), grey = GitHub, neela = phone ke andar.", fontsize=11.5, color=MUTED, va="center")
ax.text(3, 3.6, "Dhyan: Firebase Console me collection kholne se bhi reads lagte hain (Usage me gine jaate hain, hamare Reads tab me nahi).", fontsize=11.5, color="#b91c1c", va="center", fontweight="bold")
fig.savefig(os.path.join(OUT, "DATA_MAP.png"), dpi=150, facecolor=BG)
fig.savefig(os.path.join(OUT, "DATA_MAP.pdf"), facecolor=BG)
plt.close(fig)
print("ok", OUT)
