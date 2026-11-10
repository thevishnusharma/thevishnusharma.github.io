
    (function () {
      try {
        var FLAG = "sa_hard_refreshed_v1";
        if (sessionStorage.getItem(FLAG)) return; // is session mein already ho chuka
        sessionStorage.setItem(FLAG, "1");

        // NOTE: Pehle yahan har naye tab/session mein ek FULL PAGE RELOAD
        // (location.replace) bhi hota tha taaki purana cached version na
        // dikhe — matlab har pehli visit asal mein DO BAAR poora page
        // load karti thi (ek baar normal, phir turant reload), jo load
        // time roughly double kar deta tha. Ab Service Worker ka fetch
        // handler khud hi {cache:'no-store'} (network-first) use karta
        // hai — matlab freshness pehle se hi guaranteed hai, is extra
        // reload ki ab zaroorat nahi. Sirf background mein purane
        // Service-Worker caches saaf kar dete hain (halka, koi reload
        // nahi, page load speed par koi asar nahi).
        // OFFLINE FIX: yahan pehle har naye session me SAARE caches delete hote the (SW ka offline cache bhi),
        // isliye app offline kholne par "Web page not available" aata tha. Purane version ke cache
        // sw.js ke 'activate' me apne aap hat jaate hain, to yahan delete karne ki zaroorat nahi.
        try {
          if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
            navigator.serviceWorker.getRegistrations().then(function (regs) {
              regs.forEach(function (r) { r.update().catch(function () {}); });
            }).catch(function () {});
          }
        } catch (e) {}
      } catch (e) {
        // Kuch bhi fail ho jaaye to bhi site normal load ho jaaye
      }
    })();
  