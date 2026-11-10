
    // ── ZOOM LOCK (pinch-to-zoom / double-tap-zoom) ──────────────────
    // Viewport meta's user-scalable=no + maximum-scale=1.0 already stops
    // most zooming. This adds a JS-level safety net for browsers (mainly
    // iOS Safari / installed PWA) that still allow a pinch gesture.
    (function () {
      document.addEventListener("gesturestart", function (e) { e.preventDefault(); }, { passive: false });
      document.addEventListener("gesturechange", function (e) { e.preventDefault(); }, { passive: false });
      document.addEventListener("touchmove", function (e) {
        if (e.touches && e.touches.length > 1) e.preventDefault(); // multi-finger pinch
      }, { passive: false });
    })();
  