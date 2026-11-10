# v253 — 9th ke questions wapas lane ka rasta + delete band (web 1.4.39, build 253)

## Kya hua tha (meri v252 ki galti)
v252 ka "milan" un questions ko jo Question Bank list me the par backend me ID se nahi mile, list se HATA deta tha.
Wahi 227 question (7726 -> 7499) the — 9th ke uploaded questions. Wo sirf is app ki saved list me the, backend tak pahunche hi nahi the.

## Fix
- qgen-reconcile.js: ab kuch bhi delete NAHI karta. Sirf batata hai: "N question sirf Question Bank list me hain, backend me nahi".
- NAYA recover-bank.html: purani saved copies (Worker copy, is browser ki saved list, optional Firebase) me se wo questions dhoondta hai
  jo backend me nahi hain, aur tumhare chune hue group ko backend me JODTA hai (kuch overwrite/delete nahi).

## Kaise chalayein
1. Upload + deploy ke baad browser me kholo:  <apni site>/recover-bank.html   (admin login wale browser me)
2. "Scan karo" -> groups dikhenge (source + class + kitne). "9" ya class_9 wala group tick karo.
3. Kuch na mile to "Firebase me dhoondo" (class_9, class9, 9) — reads utne hi jitne questions mile.
4. "Chune hue questions backend me daalo" -> app me 2 baar refresh.

## Zaroori savdhani (recovery se pehle)
- Question Bank me koi edit/delete/upload mat karo, "Publish" mat dabao (Worker wali purani copy bachi rahe).
- Dusre phone/PC par app mat kholo jab tak recovery na ho jaye.
