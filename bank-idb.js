/* IndexedDB cache for admin's full bank and student class/subject chunks. */
(function () {
  "use strict";
  var DB = "snap_bank_db_v1", ST = "kv", KEY = "bank";
  function open() {
    return new Promise(function (res) {
      try {
        var r = indexedDB.open(DB, 1);
        r.onupgradeneeded = function () { try { r.result.createObjectStore(ST); } catch (e) {} };
        r.onsuccess = function () { res(r.result); };
        r.onerror = r.onblocked = function () { res(null); };
      } catch (e) { res(null); }
    });
  }
  window.__bankIdb = {
    get: function (key) {
      return open().then(function (db) {
        if (!db) return null;
        return new Promise(function (res) {
          try {
            var q = db.transaction(ST, "readonly").objectStore(ST).get(key || KEY);
            q.onsuccess = function () { var v = q.result; res(v && Array.isArray(v.arr) ? v.arr : null); };
            q.onerror = function () { res(null); };
          } catch (e) { res(null); }
        });
      }).catch(function () { return null; });
    },
    put: function (arr, key) {
      return open().then(function (db) {
        if (!db) return false;
        return new Promise(function (res) {
          try {
            var tx = db.transaction(ST, "readwrite"); tx.objectStore(ST).put({ arr: arr, ts: Date.now() }, key || KEY);
            tx.oncomplete = function () { res(true); }; tx.onerror = tx.onabort = function () { res(false); };
          } catch (e) { res(false); }
        });
      }).catch(function () { return false; });
    },
    delete: function (key) {
      return open().then(function (db) {
        if (!db) return false;
        return new Promise(function (res) {
          try { var tx = db.transaction(ST, "readwrite"); tx.objectStore(ST).delete(key || KEY); tx.oncomplete = function () { res(true); }; tx.onerror = tx.onabort = function () { res(false); }; }
          catch (e) { res(false); }
        });
      }).catch(function () { return false; });
    }
  };
})();
