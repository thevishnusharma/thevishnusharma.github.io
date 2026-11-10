/* v285: browser me root kholne par pehle download.html (landing). App tabhi khulta hai jab "Web par kholein" (?app=1) dabaya ho (is tab/session ke liye).
   Installed app/APK/WebView, ?inst= aur ?owner=1 links seedha app par jaate hain. */
(function(){try{
var L=location,S=L.search||"",P=L.pathname,ss=window.sessionStorage;
if(/[?&](app=1|inst=)/.test(S)){try{ss.setItem("stp_web","1")}catch(e){}
 if(/[?&]app=1(&|$)/.test(S)&&history.replaceState){try{history.replaceState(null,"",P+S.replace(/([?&])app=1&?/,"$1").replace(/[?&]$/,"")+L.hash)}catch(e){}}return}
if(S||L.hash||(P!=="/"&&P!=="/index.html")||!/^https?:$/.test(L.protocol)||L.hostname==="localhost"||L.hostname==="127.0.0.1")return;
if(window.Capacitor||/; wv\)|\bwv\b/.test(navigator.userAgent))return;
if(navigator.standalone||(window.matchMedia&&(matchMedia("(display-mode: standalone)").matches||matchMedia("(display-mode: fullscreen)").matches||matchMedia("(display-mode: minimal-ui)").matches)))return;
if(ss.getItem("stp_web"))return;
if(document.referrer&&document.referrer.indexOf(L.origin)===0&&!/download\.html/.test(document.referrer))return;
L.replace("/download.html")}catch(e){}})();
if(/[?&]owner=1(&|$)/.test(location.search))location.replace("owner-app.html");