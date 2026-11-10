/* own-backend.js — HYBRID MODE adapter (The Vishnu Sharma)
 *
 * Kya karta hai: firebase.firestore() ke upar ek patla parda (Proxy) lagata hai. Sirf wahi collections jo
 * SNAP_CONFIG.ownBackend.collections me likhi hain apne free backend par jati hain; baaki sab Firebase par
 * jaisa ka taisa. Login Firebase Auth hi rehta hai (uska ID token backend ko bheja jata hai).
 *
 * KILL SWITCH: SNAP_CONFIG.ownBackend.enabled = false  (ya collections: [])  -> sab wapas pure Firebase par.
 *
 * Supported (routed collections par): collection().doc(id).get/set/update/delete, collection().get(),
 * where(==,!=,<,<=,>,>=) / orderBy / limit, onSnapshot (live), add(), db.batch() (set/update/delete),
 * FieldValue.serverTimestamp(), Timestamp/Date values.
 * NOT supported (clear error aata hai): FieldValue.increment/arrayUnion/delete, 'in'/'array-contains' queries,
 * sub-collections, doc.onSnapshot, transactions, update() me "a.b" jaise dotted keys.
 *
 * Config example (app-config.js):
 *   ownBackend: { enabled: true, url: "https://snaptestpro-backend.onrender.com",
 *                 collections: ["questionBank", "deletedQuestions"] }
 */
(function (W) {
  'use strict';
  if (W.SnapOwnBackend) return;

  var VERSION = '1.0.0';
  var SOCKET_SRC = 'https://cdn.jsdelivr.net/npm/socket.io-client@4.7.5/dist/socket.io.min.js';

  function cfg() { return (W.SNAP_CONFIG && W.SNAP_CONFIG.ownBackend) || {}; }
  function baseUrl() { return String(cfg().url || '').replace(/\/+$/, ''); }
  function routed(name) {
    var c = cfg();
    return c.enabled !== false && !!baseUrl() && Array.isArray(c.collections) && c.collections.indexOf(name) !== -1;
  }
  function fb() { return W.firebase; }
  function FS() { return fb() && fb().firestore; }
  function err(code, message) { var e = new Error(message || code); e.code = code; return e; }
  function unsupported(what) { return err('unimplemented', 'Own backend: ' + what + ' is collection par supported nahi hai. Is collection ko SNAP_CONFIG.ownBackend.collections se hata do.'); }

  // ------------------------------------------------------------ token + http
  function getToken() {
    var v = W.vishnuFirebase || {};
    return Promise.resolve(v.authReady).then(function () {
      var u = v.auth && v.auth.currentUser;
      return u ? u.getIdToken() : '';
    }).catch(function () { return ''; });
  }
  function http(method, path, body) {
    return getToken().then(function (token) {
      var ctl = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = ctl ? setTimeout(function () { ctl.abort(); }, cfg().timeoutMs || 60000) : null;
      var headers = {};
      if (token) headers.Authorization = 'Bearer ' + token;
      try { var _b = W.SNAP_CONFIG && W.SNAP_CONFIG.build; if (_b) headers['X-App-Build'] = String(_b); } catch (_e) {}
      if (body) headers['Content-Type'] = 'application/json';
      return fetch(baseUrl() + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, signal: ctl ? ctl.signal : undefined })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (j) {
            if (!res.ok) {
              var code = res.status === 401 ? 'unauthenticated' : res.status === 403 ? 'permission-denied' : res.status === 404 ? 'not-found' : res.status === 429 ? 'resource-exhausted' : 'unavailable';
              if (res.status === 426) { try { W.dispatchEvent(new CustomEvent('snap-update-required')); } catch (_e) {} }
              var e = err(code, (j && j.error) || ('HTTP ' + res.status)); e.status = res.status; throw e;
            }
            return j;
          });
        }, function (e) { throw err('unavailable', 'Backend se connect nahi ho paya: ' + (e && e.message)); })
        .then(function (x) { if (timer) clearTimeout(timer); return x; }, function (e) { if (timer) clearTimeout(timer); throw e; });
    });
  }

  // ------------------------------------------------------------ value codec (Timestamp/Date/serverTimestamp)
  function isTs(v) { var T = FS() && FS().Timestamp; return !!(T && v instanceof T); }
  function sentinel(v) {
    var FV = FS() && FS().FieldValue;
    if (!FV || !(v instanceof FV)) return null;
    try { if (v.isEqual(FV.serverTimestamp())) return 'serverTimestamp'; } catch (e) { /* ignore */ }
    return String(v._methodName || (v._delegate && v._delegate._methodName) || 'FieldValue');
  }
  function encode(v) {
    if (v === undefined) return undefined;
    if (v === null || typeof v !== 'object') return v;
    if (v instanceof Date) return { __ts: v.getTime() };
    if (isTs(v)) return { __ts: v.toMillis() };
    var s = sentinel(v);
    if (s === 'serverTimestamp') return { __sv: 'serverTimestamp' };
    if (s) throw unsupported(s);
    if (Array.isArray(v)) return v.map(function (x) { var e = encode(x); return e === undefined ? null : e; });
    var o = {};
    Object.keys(v).forEach(function (k) { var e = encode(v[k]); if (e !== undefined) o[k] = e; });
    return o;
  }
  function decode(v) {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(decode);
    var keys = Object.keys(v);
    if (keys.length === 1 && keys[0] === '__ts' && typeof v.__ts === 'number') return FS().Timestamp.fromMillis(v.__ts);
    var o = {}; keys.forEach(function (k) { o[k] = decode(v[k]); }); return o;
  }
  function plain(v) { return v && typeof v.toMillis === 'function' ? v.toMillis() : v; }
  function getPath(obj, path) { return String(path).split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj); }
  function eq(a, b) { return JSON.stringify(plain(a)) === JSON.stringify(plain(b)); }
  var CMP = {
    '==': eq, '!=': function (a, b) { return !eq(a, b); },
    '<': function (a, b) { return plain(a) < plain(b); }, '<=': function (a, b) { return plain(a) <= plain(b); },
    '>': function (a, b) { return plain(a) > plain(b); }, '>=': function (a, b) { return plain(a) >= plain(b); }
  };
  var SERVER_OP = { '==': 'eq', '!=': 'ne', '<': 'lt', '<=': 'lte', '>': 'gt', '>=': 'gte' };

  // ------------------------------------------------------------ snapshots
  var META = { fromCache: false, hasPendingWrites: false };
  function randomId() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', s = '';
    var a = (W.crypto && W.crypto.getRandomValues) ? W.crypto.getRandomValues(new Uint8Array(20)) : null;
    for (var i = 0; i < 20; i++) s += chars[(a ? a[i] : Math.floor(Math.random() * 256)) % chars.length];
    return s;
  }
  function mkDocSnap(coll, id, raw) { // raw = decoded data object, ya null (exists:false)
    var exists = raw != null;
    return {
      id: id, exists: exists, ref: new OwnDoc(coll, id), metadata: META,
      data: function () { return exists ? decode(raw) : undefined; },
      get: function (field) { return exists ? getPath(decode(raw), field) : undefined; }
    };
  }
  function mkQuerySnap(coll, entries, changes) { // entries: [{id, raw}]
    var docs = entries.map(function (e) { return mkDocSnap(coll, e.id, e.raw); });
    var ch = (changes || entries.map(function (e) { return { type: 'added', id: e.id, raw: e.raw }; }))
      .map(function (c) { return { type: c.type, doc: mkDocSnap(coll, c.id, c.raw) }; });
    return {
      docs: docs, size: docs.length, empty: docs.length === 0, metadata: META,
      forEach: function (cb, thisArg) { docs.forEach(function (d) { cb.call(thisArg, d); }); },
      docChanges: function () { return ch.slice(); }
    };
  }

  // ------------------------------------------------------------ socket (live updates)
  var socket = null, socketState = 'idle', subs = {}; // subs[collection] = [listener]
  function loadSocketLib() {
    if (typeof W.io === 'function') return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = cfg().socketScript || SOCKET_SRC; s.async = true;
      s.onload = resolve; s.onerror = function () { reject(new Error('socket.io load nahi hua')); };
      document.head.appendChild(s);
    });
  }
  function ensureSocket() {
    if (socket || socketState === 'loading') return;
    socketState = 'loading';
    loadSocketLib().then(function () {
      socket = W.io(baseUrl(), { reconnection: true });
      var needFull = {}; // disconnect ke baad jin collections ko poora dobara load karna hai
      socket.on('connect', function () { socketState = 'connected'; Object.keys(subs).forEach(subscribe); });
      socket.on('disconnect', function () { socketState = 'disconnected'; Object.keys(subs).forEach(function (c) { needFull[c] = true; }); });
      socket.on('subscribed', function (ev) { // room join ho gaya: ab beech ka gap bharo
        var full = !!needFull[ev.collection]; delete needFull[ev.collection];
        (subs[ev.collection] || []).slice().forEach(function (l) { return full ? l.resync() : l.catchUp(); });
      });
      socket.on('update', function (ev) { (subs[ev.collection] || []).slice().forEach(function (l) { l.onEvent(ev); }); });
    }).catch(function (e) { socketState = 'failed'; console.warn('[own-backend] live updates band (' + e.message + '); sirf load-time data milega'); });
  }
  function subscribe(collection) {
    if (!socket || !socket.connected) return;
    getToken().then(function (token) { socket.emit('subscribe', { collection: collection, token: token }); });
  }

  // ------------------------------------------------------------ persistent cache (IndexedDB) — v250
  // Bada collection (questionBank) device par save rehta hai. App dobara khulne par poora download nahi hota:
  // saved list turant dikhti hai, phir chupke se sirf badle hue docs (since=) aate hain + count se delete check.
  // Kill-switch: SNAP_CONFIG.ownBackend.persistCache = []  (khali) -> purana tareeka (har baar poora load).
  var CACHE_DB = 'snap_own_cache_v1', CACHE_ST = 'kv';
  function persistOn(name) {
    var l = cfg().persistCache; if (!Array.isArray(l)) l = ['questionBank'];
    return l.indexOf(name) !== -1 && typeof W.indexedDB !== 'undefined' && !!W.indexedDB;
  }
  function cacheOpen() {
    return new Promise(function (res) {
      try {
        var r = W.indexedDB.open(CACHE_DB, 1);
        r.onupgradeneeded = function () { try { r.result.createObjectStore(CACHE_ST); } catch (e) { /* ignore */ } };
        r.onsuccess = function () { res(r.result); };
        r.onerror = r.onblocked = function () { res(null); };
      } catch (e) { res(null); }
    });
  }
  function cacheGet(key) {
    return cacheOpen().then(function (db) {
      if (!db) return null;
      return new Promise(function (res) {
        try { var q = db.transaction(CACHE_ST, 'readonly').objectStore(CACHE_ST).get(key); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }
        catch (e) { res(null); }
      });
    }).catch(function () { return null; });
  }
  function cachePut(key, val) {
    return cacheOpen().then(function (db) {
      if (!db) return false;
      return new Promise(function (res) {
        try { var tx = db.transaction(CACHE_ST, 'readwrite'); tx.objectStore(CACHE_ST).put(val, key); tx.oncomplete = function () { res(true); }; tx.onerror = tx.onabort = function () { res(false); }; }
        catch (e) { res(false); }
      });
    }).catch(function () { return false; });
  }
  var flushers = [];
  function flushAll() { flushers.slice().forEach(function (f) { try { f(); } catch (e) { /* ignore */ } }); }
  // v251: tab/app wapas khule ya net wapas aaye to chupke se badle hue docs le aao (10 sec se jaldi dobara nahi)
  var lastRefresh = {};
  function refreshCollection(name, force) {
    var now = Date.now();
    if (!force && lastRefresh[name] && now - lastRefresh[name] < 10000) return false;
    lastRefresh[name] = now;
    (subs[name] || []).slice().forEach(function (l) { try { l.catchUp(); } catch (e) { /* ignore */ } });
    return true;
  }
  function refreshAll() { Object.keys(subs).forEach(function (c) { refreshCollection(c); }); }
  try {
    if (W.addEventListener) { W.addEventListener('pagehide', flushAll); W.addEventListener('online', refreshAll); }
    if (W.document && W.document.addEventListener) W.document.addEventListener('visibilitychange', function () {
      if (W.document.visibilityState === 'hidden') flushAll(); else if (W.document.visibilityState === 'visible') refreshAll();
    });
  } catch (e) { /* ignore */ }

  // ------------------------------------------------------------ Query / Collection
  function OwnQuery(name, wheres, order, lim) { this.name = name; this._w = wheres || []; this._o = order || null; this._l = lim || null; this.id = name; this.path = name; }
  OwnQuery.prototype._with = function (p) { return new OwnQuery(this.name, p.w || this._w, p.o || this._o, p.l || this._l); };
  OwnQuery.prototype.where = function (field, op, value) {
    if (!SERVER_OP[op]) throw unsupported("'" + op + "' query");
    return this._with({ w: this._w.concat([[field, op, value]]) });
  };
  OwnQuery.prototype.orderBy = function (field, dir) { return this._with({ o: [field, dir === 'desc' ? 'desc' : 'asc'] }); };
  OwnQuery.prototype.limit = function (n) { return this._with({ l: n }); };
  ['startAt', 'startAfter', 'endAt', 'endBefore', 'limitToLast'].forEach(function (m) {
    OwnQuery.prototype[m] = function () { throw unsupported(m + '()'); };
  });
  OwnQuery.prototype._qs = function () {
    var q = [];
    this._w.forEach(function (w) { q.push('where=' + encodeURIComponent(w[0] + ':' + SERVER_OP[w[1]] + ':' + JSON.stringify(encode(w[2])))); });
    if (this._o) q.push('orderBy=' + encodeURIComponent(this._o[0] + ':' + this._o[1]));
    return q;
  };
  // Server ek request me max 1000 docs deta hai, isliye pages me padhte hain. since = sirf us time ke baad badle hue docs.
  OwnQuery.prototype._fetchAll = function (since) {
    var self = this, out = [], PAGE = 1000, want = self._l || Infinity, serverTime = null;
    function page(offset, guard) {
      var take = Math.min(PAGE, want - out.length), q = self._qs();
      q.push('limit=' + take); q.push('offset=' + offset);
      if (since) q.push('since=' + encodeURIComponent(since));
      return http('GET', '/api/collections/' + self.name + '/documents?' + q.join('&')).then(function (r) {
        if (!serverTime) serverTime = r.serverTime;
        r.docs.forEach(function (d) { out.push({ id: d.id, raw: d.data }); });
        if (r.docs.length === take && out.length < want && guard < 1000) return page(offset + take, guard + 1);
        return { list: out, serverTime: serverTime };
      });
    }
    return page(0, 0);
  };
  OwnQuery.prototype.get = function () {
    var self = this;
    return self._fetchAll().then(function (r) { return mkQuerySnap(self.name, r.list); });
  };
  OwnQuery.prototype._matches = function (raw) {
    var d = decode(raw);
    return this._w.every(function (w) { return CMP[w[1]](getPath(d, w[0]), w[2]); });
  };
  OwnQuery.prototype._view = function (map) { // local map -> sorted, limited list
    var self = this, list = [];
    map.forEach(function (raw, id) { list.push({ id: id, raw: raw }); });
    if (self._o) {
      var f = self._o[0], dir = self._o[1] === 'desc' ? -1 : 1;
      list.sort(function (a, b) {
        var x = plain(getPath(decode(a.raw), f)), y = plain(getPath(decode(b.raw), f));
        return (x > y ? 1 : x < y ? -1 : (a.id > b.id ? 1 : -1)) * dir;
      });
    } else list.sort(function (a, b) { return a.id > b.id ? 1 : -1; });
    return self._l ? list.slice(0, self._l) : list;
  };
  OwnQuery.prototype.onSnapshot = function (next, onError) {
    var self = this, alive = true, busy = true, queue = [], map = new Map(), prev = new Map(), emitted = false, lastServerTime = null, reloading = false;
    var inflight = false, rerun = false, persistT = null;
    // v250: sirf poore collection ka listener (koi where/orderBy/limit nahi) device par save hota hai
    var cacheKey = (!self._w.length && !self._o && !self._l && persistOn(self.name)) ? 'coll:' + self.name + '@' + baseUrl() : null;
    if (next && typeof next === 'object') { onError = next.error; next = next.next; }
    function apply(ev) {
      if (ev.action === 'delete') { map.delete(ev.docId); return; }
      if (self._matches(ev.data)) map.set(ev.docId, ev.data); else map.delete(ev.docId);
    }
    function doPersist() {
      if (!cacheKey || !lastServerTime || !alive) return;
      cachePut(cacheKey, { v: 1, docs: Array.from(map.entries()), serverTime: lastServerTime, ts: Date.now() });
    }
    function schedulePersist() {
      if (!cacheKey || !lastServerTime) return;
      clearTimeout(persistT); persistT = setTimeout(function () { persistT = null; doPersist(); }, 2500);
    }
    function flush() { if (persistT) { clearTimeout(persistT); persistT = null; doPersist(); } }
    if (cacheKey) flushers.push(flush);
    function emitChanges() {
      if (!alive) return;
      var view = self._view(map), now = new Map(), changes = [];
      // limit(N) wali query me top doc hatne par agla doc humare paas nahi hota -> server se dobara load
      if (self._l && prev.size >= self._l && view.length < self._l && !reloading) {
        reloading = true; load(true, false).then(function () { reloading = false; }); return;
      }
      view.forEach(function (e) { now.set(e.id, JSON.stringify(e.raw)); });
      view.forEach(function (e) {
        if (!prev.has(e.id)) changes.push({ type: 'added', id: e.id, raw: e.raw });
        else if (prev.get(e.id) !== now.get(e.id)) changes.push({ type: 'modified', id: e.id, raw: e.raw });
      });
      prev.forEach(function (_, id) { if (!now.has(id)) changes.push({ type: 'removed', id: id, raw: null }); });
      if (emitted && !changes.length) return;
      emitted = true; prev = now;
      try { next(mkQuerySnap(self.name, view, changes)); } catch (e) { console.error('[own-backend] onSnapshot callback error', e); }
    }
    function settle() { // ek load poora (ya fail) hua: agar beech me catch-up maanga gaya tha to ab chalao
      inflight = false;
      if (rerun && alive) { rerun = false; load(false, false, !!cacheKey); }
    }
    function finish() { queue.splice(0).forEach(apply); busy = false; emitChanges(); schedulePersist(); settle(); }
    function sinceIso() { return lastServerTime ? new Date(new Date(lastServerTime).getTime() - 5000).toISOString() : null; }
    function mergeDelta(since) { // since ke baad ke docs map me milao
      return self._fetchAll(since).then(function (r) {
        if (!alive) return r;
        r.list.forEach(function (e) { if (self._matches(e.raw)) map.set(e.id, e.raw); else map.delete(e.id); });
        lastServerTime = r.serverTime || lastServerTime;
        return r;
      });
    }
    // Delete pakadne ke liye: server ka count hamare count se alag ho to pehle ek baar delta dobara, phir bhi alag ho to poora resync
    function verify(tries, wasFull) {
      return http('GET', '/api/collections/' + self.name + '/count').then(function (c) { return c; }, function () { return null; }).then(function (c) {
        if (!alive) return;
        queue.splice(0).forEach(apply);
        if (c && typeof c.count === 'number' && c.count !== map.size) {
          // poora load karne par bhi doc chhoot sakta hai (paging ke beech koi doc badal jaye) -> 2 baar dobara try
          if (wasFull) { if (tries < 2) return load(true, false, true, tries + 1); }
          else { if (tries < 1) return mergeDelta(sinceIso()).then(function () { return verify(tries + 1, false); }); return load(true, false, true, 0); }
          console.warn('[own-backend] ' + self.name + ': count match nahi hua (local ' + map.size + ', server ' + c.count + ')');
        }
        finish();
      });
    }
    // full = poora dobara load; delta = sirf kuch der pehle ke baad badle docs (cache/socket ka gap bharne ke liye)
    function load(full, first, verifyCount, tries) {
      busy = true; inflight = true;
      var since = !full && lastServerTime ? sinceIso() : null;
      return self._fetchAll(since).then(function (r) {
        if (!alive) return;
        if (since) r.list.forEach(function (e) { if (self._matches(e.raw)) map.set(e.id, e.raw); else map.delete(e.id); });
        else { map = new Map(); r.list.forEach(function (e) { map.set(e.id, e.raw); }); }
        lastServerTime = r.serverTime || lastServerTime;
        if (verifyCount && cacheKey) return verify(since ? 0 : (tries || 0), !since);
        finish();
      }).catch(function (e) {
        if (first && onError) { busy = false; inflight = false; onError(e); return; }
        console.warn('[own-backend] sync fail:', e.message);
        // v250: fail hone par bhi beech me aaye socket events na khoyein (pehle ye drop ho jate the -> list purani reh jati thi)
        if (alive) { queue.splice(0).forEach(apply); busy = false; if (emitted) emitChanges(); }
        settle();
      });
    }
    var l = {
      name: self.name,
      onEvent: function (ev) { if (busy) { queue.push(ev); return; } apply(ev); emitChanges(); schedulePersist(); },
      catchUp: function () { if (inflight) { rerun = true; return; } return load(false, false, !!cacheKey); },   // socket join hone ke baad
      resync: function () {                                                                                      // disconnect ke baad
        if (inflight) { rerun = true; return; }
        return cacheKey && lastServerTime ? load(false, false, true) : load(true, false);
      }
    };
    (subs[self.name] = subs[self.name] || []).push(l);
    ensureSocket(); subscribe(self.name);
    if (!cacheKey) load(true, true);
    else {   // (cacheKey wale collection me poora load bhi count se verify hota hai)
      inflight = true; // cache padhte waqt socket ka catch-up dobara poora load na shuru kare
      cacheGet(cacheKey).then(function (c) {
        if (!alive) return;
        if (c && c.v === 1 && Array.isArray(c.docs) && c.docs.length && c.serverTime) {
          map = new Map(c.docs); lastServerTime = c.serverTime;
          queue.splice(0).forEach(apply);
          busy = false; emitChanges();            // saved list turant (network ka intezaar nahi)
          load(false, false, true);               // chupke se sirf badle hue docs + count check
        } else load(true, true, true);            // pehli baar: poora load (+count check), phir device par save
      });
    }
    return function unsubscribe() {
      flush(); alive = false;
      flushers = flushers.filter(function (f) { return f !== flush; });
      subs[self.name] = (subs[self.name] || []).filter(function (x) { return x !== l; });
      if (!subs[self.name].length) { delete subs[self.name]; if (socket && socket.connected) socket.emit('unsubscribe', self.name); }
    };
  };

  function OwnCollection(name) { OwnQuery.call(this, name); }
  OwnCollection.prototype = Object.create(OwnQuery.prototype);
  OwnCollection.prototype.doc = function (id) { return new OwnDoc(this.name, id == null ? randomId() : String(id)); };
  OwnCollection.prototype.add = function (data) {
    var ref = this.doc();
    return ref.set(data).then(function () { return ref; });
  };

  // ------------------------------------------------------------ Doc ref
  function OwnDoc(coll, id) { this.id = id; this.path = coll + '/' + id; this._c = coll; this.__own = true; this.parent = new OwnCollection(coll); }
  OwnDoc.prototype._url = function () { return '/api/collections/' + this._c + '/documents/' + encodeURIComponent(this.id); };
  OwnDoc.prototype.get = function () {
    var self = this;
    return http('GET', self._url()).then(function (r) { return mkDocSnap(self._c, self.id, r.doc.data); },
      function (e) { if (e.code === 'not-found') return mkDocSnap(self._c, self.id, null); throw e; });
  };
  OwnDoc.prototype.set = function (data, opts) {
    return http('POST', '/api/collections/' + this._c + '/documents', { docId: this.id, data: encode(data), merge: !!(opts && opts.merge) }).then(function () {});
  };
  function checkUpdateKeys(data) {
    Object.keys(data || {}).forEach(function (k) { if (k.indexOf('.') !== -1) throw unsupported('update() me dotted key "' + k + '"'); });
  }
  OwnDoc.prototype.update = function (data) {
    checkUpdateKeys(data);
    return http('PATCH', this._url(), { data: encode(data) }).then(function () {});
  };
  OwnDoc.prototype.delete = function () { return http('DELETE', this._url()).then(function () {}); };
  OwnDoc.prototype.onSnapshot = function () { throw unsupported('doc.onSnapshot()'); };
  OwnDoc.prototype.collection = function () { throw unsupported('sub-collection'); };

  // ------------------------------------------------------------ batch (own + firebase mixed)
  function makeBatch(realDb) {
    var ownOps = [], real = null;
    function R() { return real || (real = realDb.batch()); }
    var b = {
      set: function (ref, data, opts) {
        if (ref && ref.__own) ownOps.push({ type: 'set', collection: ref._c, docId: ref.id, data: encode(data), merge: !!(opts && opts.merge) });
        else R().set(ref, data, opts);
        return b;
      },
      update: function (ref) {
        if (ref && ref.__own) { var d = arguments[1]; checkUpdateKeys(d); ownOps.push({ type: 'update', collection: ref._c, docId: ref.id, data: encode(d) }); }
        else R().update.apply(real, arguments);
        return b;
      },
      delete: function (ref) {
        if (ref && ref.__own) ownOps.push({ type: 'delete', collection: ref._c, docId: ref.id }); else R().delete(ref);
        return b;
      },
      commit: function () {
        var chunks = [], i; for (i = 0; i < ownOps.length; i += 400) chunks.push(ownOps.slice(i, i + 400));
        var p = Promise.resolve();
        chunks.forEach(function (c) { p = p.then(function () { return http('POST', '/api/batch', { ops: c }); }); });
        return p.then(function () { return real ? real.commit() : undefined; });
      }
    };
    return b;
  }

  // ------------------------------------------------------------ public wrapper
  function wrap(db) {
    if (!db || db.__ownWrapped) return db;
    if (!W.SnapOwnBackend.status().enabled) return db; // kill-switch: bilkul kuch nahi badalta, app 100% pehle jaisa
    return new Proxy(db, {
      get: function (t, p) {
        if (p === '__ownWrapped') return true;
        if (p === 'collection') return function (name) { return routed(name) ? new OwnCollection(name) : t.collection(name); };
        if (p === 'doc') return function (path) {
          var parts = String(path).split('/');
          return parts.length === 2 && routed(parts[0]) ? new OwnDoc(parts[0], parts[1]) : t.doc(path);
        };
        if (p === 'batch') return function () { return makeBatch(t); };
        var v = t[p];
        return typeof v === 'function' ? v.bind(t) : v;
      }
    });
  }

  W.SnapOwnBackend = {
    version: VERSION, wrap: wrap, routed: routed,
    // v251: dusre code (jaise admin tab badalna) se silent delta refresh maango: SnapOwnBackend.refresh('questionBank')
    refresh: function (name, force) { return refreshCollection(name, force); },
    status: function () { return { enabled: cfg().enabled !== false && !!baseUrl() && (cfg().collections || []).length > 0, url: baseUrl(), collections: cfg().collections || [], socket: socketState }; },
    // Console me chalao:  await SnapOwnBackend.whoami()   -> backend ko tumhara Firebase login kaisa dikh raha hai
    whoami: function () { return http('GET', '/api/auth/whoami'); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
