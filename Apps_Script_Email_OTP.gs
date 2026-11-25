/* Free email-OTP bhejne ka Google Apps Script Web App (aapke Gmail se). Brevo ka sahaara na lena ho to ye use karein.
   SETUP (2 minute):
   1) script.google.com > New project > ye poora code paste.
   2) Project Settings > Script properties > Add: OTP_WEBHOOK_SECRET = koi lamba random text (jaise 32 akshar).
   3) Deploy > New deployment > Type: Web app > Execute as: Me > Who has access: Anyone > Deploy. Mili hui URL copy karein.
   4) Cloudflare Worker > Settings > Variables: OTP_WEBHOOK_URL = wo URL, OTP_WEBHOOK_SECRET = wahi secret (Secret type).
   Seema: Gmail se roz ~100 email (Workspace me ~1500). Student bahut zyada hon to Brevo (300/din) behtar. */
function doPost(e) {
  try {
    var secret = PropertiesService.getScriptProperties().getProperty('OTP_WEBHOOK_SECRET');
    var d = JSON.parse(e.postData.contents);
    if (!secret || d.secret !== secret) return out({ ok: false });
    if (!/^[^\s@,;<>]{1,64}@[^\s@,;<>]{1,190}\.[A-Za-z]{2,24}$/.test(String(d.to))) return out({ ok: false });
    MailApp.sendEmail({ to: String(d.to), subject: String(d.subject).slice(0, 120), body: String(d.text).slice(0, 600), name: 'The Vishnu Sharma' });
    return out({ ok: true });
  } catch (err) { return out({ ok: false }); }
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
