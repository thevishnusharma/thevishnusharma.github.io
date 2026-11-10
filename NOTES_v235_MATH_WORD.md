# v235 — Word export math fix (fraction / recurring / ≠ / root)

## Kya theek hua
1. `\frac{1}{3}`, `\neq` jab `\( \)` ke BINA likhe hon (Q46, Q50, Q52) — ab convert hote hain (pehle raw dikhte the).
2. Recurring decimal: pehle bar sirf aakhri digit par aata tha (0.18̅). Ab dashamlav ke saare digits par continuous bar: 0.18 (poore 18 par), 23.43 (43 par), 0.296 (296 par).
   Mixed recurring (jaise 0.1666…) ke liye question me `0.1\overline{6}` likho — wo sirf 6 par bar lagayega.
3. Nested braces: `\frac{a^{2}}{b+1}`, `\sqrt{x^{2}+1}`, `\dfrac{\sqrt{2}}{3}` — fraction/root ke andar power ab nahi bigadta.
4. Naye symbols: ∠ △ ∴ ∵ → ⇒ ∈ ∪ ∩ ⊥ ∥ ° (`^\circ`), `\overline`, `\bar`, `\dot`, `\left( \right)`, `\%`, `\{ \}` etc.
5. Line-height estimate (paper-format-word.js): bar/dot jaise combining marks ki width 0 maani jati hai, taaki page-fit na bigde.

## Speed
Jis text me `\`, `$` ya bar nahi hota wo seedha fast-path se nikalta hai. 33,169 bank strings par average ~0.17 ms/string (parse + docx runs dono milakar).

## Files
qgen-app.js, paper-format-word.js, question-generator.html (cache ?v), version.json (build 231), sw.js + app-config.js + package.json (stamp se)

## Check
node --check OK. Unit tests 44/46 — 2 purane fail (test_apk_brand_v222, test_branding2_v221) pehle se the, original zip par bhi same.

## Pata hai par chheda nahi (bank data me typo)
`\(-\\)frac{3}{2}` jaise 4 question (quadratic root wale, zero wale) me delimiter toot gaya hai — data fix chahiye, converter se theek nahi hoga.
