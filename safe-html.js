/* The Vishnu Sharma — safe-html.js (Phase 5). Sabse PEHLE load hota hai.
   1) Helpers: __sx (text/attribute escape), __sj (inline-handler JS string), SnapSafe.esc/escAttr/safeUrl/html/sanitizeRich
   2) Guard: innerHTML / outerHTML / insertAdjacentHTML me auto-execute hone wale hisse (script, onerror, javascript: ...) hata deta hai. */
(function (root) {
  "use strict";
  var MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" };
  function esc(v) { return v == null ? "" : String(v).replace(/[&<>"'`]/g, function (c) { return MAP[c]; }); }
  function escJs(v) { /* inline handler: onclick="f('${...}')" ke andar ke liye (pehle JS-string escape, phir HTML escape) */
    return esc(v == null ? "" : String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/[\r\n\u2028\u2029]/g, " ").replace(/</g, "\\x3c"));
  }
  var SAFE_URL = /^(https?:|tel:|mailto:|blob:|data:image\/(png|jpe?g|gif|webp|bmp);base64,|\/(?!\/)|#|\.{0,2}\/)/i;
  function safeUrl(u) {
    var s = String(u == null ? "" : u).replace(/[\u0000-\u0020\u007f]+/g, function (m) { return m.replace(/[\u0000-\u001f\u007f]/g, ""); }).trim();
    if (!s) return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(s) || s.indexOf("//") === 0) return SAFE_URL.test(s) && s.indexOf("//") !== 0 ? s : "";
    return s; /* relative */
  }
  function html(strings) { /* html`<b>${x}</b>` — har interpolation auto-escape (SnapSafe.raw(x) se skip) */
    var out = strings[0];
    for (var i = 1; i < arguments.length; i++) { var a = arguments[i]; out += (a && a.__raw !== undefined ? a.__raw : esc(a)) + strings[i]; }
    return out;
  }
  function raw(s) { return { __raw: String(s) }; }

  /* ---------- sanitizer (DOM based, allow-list for rich text) ---------- */
  var RICH_TAGS = { B: 1, I: 1, U: 1, EM: 1, STRONG: 1, SUB: 1, SUP: 1, BR: 1, P: 1, UL: 1, OL: 1, LI: 1, SPAN: 1, DIV: 1, S: 1, SMALL: 1, TABLE: 1, THEAD: 1, TBODY: 1, TR: 1, TD: 1, TH: 1, IMG: 1, BLOCKQUOTE: 1, PRE: 1, CODE: 1, H1: 1, H2: 1, H3: 1, H4: 1 };
  var RICH_ATTRS = { class: 1, style: 1, src: 1, alt: 1, colspan: 1, rowspan: 1, width: 1, height: 1, title: 1 };
  var CLICK_OK = { onclick: 1, ondblclick: 1, onchange: 1, oninput: 1, onsubmit: 1, onkeydown: 1, onkeyup: 1, onkeypress: 1, onblur: 1, onfocus: 1 };
  var IMG_FALLBACK = /^\s*(this\.style\.display\s*=\s*['"]none['"]|this\.remove\(\)|this\.onerror\s*=\s*null\s*;?\s*this\.src\s*=\s*['"][^'"<>]*['"]|this\.src\s*=\s*['"][^'"<>]*['"])\s*;?\s*$/;
  var ORIG_INNER = root.Element ? Object.getOwnPropertyDescriptor(root.Element.prototype, "innerHTML") : null;
  var BAD_TAGS = /^(script|object|embed|base|meta|applet|frame|frameset)$/i;
  var NEEDS = /(<\s*(script|iframe|object|embed|base|meta|applet|frame)\b|[^a-z0-9]on(?!click\b|dblclick\b|change\b|input\b|submit\b|keydown\b|keyup\b|keypress\b|blur\b|focus\b)[a-z]+\s*=|javascript:|vbscript:|data:text\/html|srcdoc|formaction|xlink:href|<\s*svg[^>]*\son)/i;   /* sirf khatarnak dikhe tab parse (normal UI par almost free) */
  function badUrlAttr(name, val) {
    if (!/^(href|src|action|formaction|xlink:href|data|poster|background|srcset)$/i.test(name)) return false;
    var v = String(val).replace(/[\u0000-\u0020\u007f]+/g, "").toLowerCase();
    return /^(javascript|vbscript):/.test(v) || /^data:(?!image\/(png|jpe?g|gif|webp|bmp);base64,)/.test(v);
  }
  function cleanTree(rootNode, opts) {
    var rich = opts && opts.rich, doc = rootNode.ownerDocument || document, walker = doc.createTreeWalker(rootNode, 1 /* SHOW_ELEMENT */), n, kill = [];
    while ((n = walker.nextNode())) {
      var tag = n.nodeName;
      if (BAD_TAGS.test(tag) || (rich && !RICH_TAGS[tag.toUpperCase()])) { kill.push(n); continue; }
      var attrs = Array.prototype.slice.call(n.attributes);
      for (var i = 0; i < attrs.length; i++) {
        var a = attrs[i], nm = a.name.toLowerCase();
        if (rich) { if (!RICH_ATTRS[nm] || badUrlAttr(nm, a.value) || (nm === "src" && !/^(https?:|data:image\/|\/|\.)/i.test(a.value.trim()))) n.removeAttribute(a.name); continue; }
        if (nm.slice(0, 2) === "on") {
          var ok = CLICK_OK[nm] || ((nm === "onerror" || nm === "onload") && IMG_FALLBACK.test(a.value) && /^(img)$/i.test(tag));
          if (!ok) n.removeAttribute(a.name);
          continue;
        }
        if (nm === "srcdoc" || badUrlAttr(nm, a.value)) n.removeAttribute(a.name);
        else if (nm === "style" && /expression\s*\(|javascript:|behavior\s*:|-moz-binding/i.test(a.value)) n.removeAttribute(a.name);
      }
      if (/^iframe$/i.test(tag)) { var s = (n.getAttribute("src") || "").trim(); if (s && !/^(https?:|blob:|\/|\.|about:blank$)/i.test(s)) n.removeAttribute("src"); }
    }
    for (var k = 0; k < kill.length; k++) if (kill[k].parentNode) kill[k].parentNode.removeChild(kill[k]);
    return rootNode;
  }
  function sanitize(htmlStr, opts) { /* opts.rich=true -> sirf allow-list tags/attrs (question text jaisa content) */
    var s = htmlStr == null ? "" : String(htmlStr);
    if (!(opts && opts.rich) && (s.indexOf("<") < 0 || !NEEDS.test(s))) return s;
    var t = root.document.createElement("template");
    if (ORIG_INNER && ORIG_INNER.set) ORIG_INNER.set.call(t, s); else t.innerHTML = s;   /* asli setter: guard ke andar loop na bane */
    cleanTree(t.content, opts);
    return ORIG_INNER && ORIG_INNER.get ? ORIG_INNER.get.call(t) : t.innerHTML;
  }
  function sanitizeRich(s) { return sanitize(s, { rich: true }); }

  /* ---------- global guard ---------- */
  function install() {
    try {
      if (!root.Element || root.Element.prototype.__snapGuard) return;
      var proto = root.Element.prototype, d = Object.getOwnPropertyDescriptor(proto, "innerHTML");
      if (d && d.set) Object.defineProperty(proto, "innerHTML", { configurable: true, enumerable: d.enumerable, get: d.get, set: function (v) { d.set.call(this, typeof v === "string" ? sanitize(v) : v); } });
      var o = Object.getOwnPropertyDescriptor(proto, "outerHTML");
      if (o && o.set) Object.defineProperty(proto, "outerHTML", { configurable: true, enumerable: o.enumerable, get: o.get, set: function (v) { o.set.call(this, typeof v === "string" ? sanitize(v) : v); } });
      var ia = proto.insertAdjacentHTML;
      if (ia) proto.insertAdjacentHTML = function (pos, v) { return ia.call(this, pos, typeof v === "string" ? sanitize(v) : v); };
      proto.__snapGuard = true;
    } catch (e) {}
  }
  var api = { esc: esc, escAttr: esc, escJs: escJs, safeUrl: safeUrl, html: html, raw: raw, sanitize: sanitize, sanitizeRich: sanitizeRich, install: install };
  root.SnapSafe = api; root.__sx = esc; root.__sj = escJs;
  if (root.document) install();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
