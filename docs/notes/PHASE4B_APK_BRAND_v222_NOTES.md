# Phase 4B (v222) — institute APK native branding

Flow: fetch-institute.js -> institute-brand.json {brandColor} (+ institute-icon.img) -> `cap add android` -> android-prepare.js -> android-brand.js.
android-brand.js: res/values/snap_brand.xml (colorPrimary, colorPrimaryDark, snap_splash_bg), styles.xml ke AppTheme.NoActionBarLaunch me windowSplashScreenBackground/AnimatedIcon, har drawable*/splash.png ko brand rang + logo card se badalta, drawable-nodpi/snap_splash_icon.png.
Android 12+: system apna splash (rang + icon) dikhata hai; bada splash image wahan nahi dikhta. Naam/tagline native splash me nahi (fonts) — web splash (v221) dikhata hai.
Rollback: app-config.js `branding2: false` ya commit Revert.
Chalaya nahi: gradle APK build, phone par splash.
