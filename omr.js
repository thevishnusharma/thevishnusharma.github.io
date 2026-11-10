(function(){function S(t){if(t<=0)return 0;let o=0;for(;o<200;){const e=o+1;if(e+Math.ceil(e/5)>t)break;o=e}return o}const W=13;function U(t){t=Math.max(1,Math.min(100,t));const o={tl:{x:6+8/2,y:6+8/2},tr:{x:204-8/2,y:6+8/2},bl:{x:6+8/2,y:291-8/2},br:{x:204-8/2,y:291-8/2}},e=78,n=o.bl.y-8,l=o.tl.x+6,i=o.tr.x-6,s=n-e,g=W,p=(i-l)/4;let d=null;for(let m=1;m<=4&&!d;m++){const w=Math.ceil(s/10.5),E=Math.floor(s/5);for(let R=w;R<=E;R++){let y=0;for(let b=0;b<m;b++)y+=S(R-(b===0?g:0));if(y>=t){d={cols:m,rowsPerCol:R};break}}}d||(d={cols:4,rowsPerCol:Math.floor(s/5)});const{cols:c,rowsPerCol:a}=d,u=s/a,h=9,f=6,M=(p-h-f)/4,x=[],k=[],C=[];let v=1;for(let m=0;m<c&&v<=t;m++){const w=m===0?g:0,E=S(a-w),R=Math.min(E,t-v+1),y=[];let b=w,T=0;for(;T<R;){k.push({col:m,rowIndex:b}),y.push({type:"header",rowIndex:b}),b++;const A=Math.min(5,R-T);for(let P=0;P<A;P++){const D=v,z=l+m*p,G=e+b*u,te=[0,1,2,3].map(H=>({opt:H,x:z+h+H*M+M/2,y:G+u/2}));x.push({q:D,qLabelX:z,qLabelY:G+u/2,options:te}),y.push({type:"question",q:D,rowIndex:b}),b++,v++,T++}}C.push({colIndex:m,prefix:w,rows:y,totalRows:b})}const r=[];for(let m=1;m<c;m++)r.push({x:l+m*p-f/2,yTop:e-4,yBottom:e+a*u});return{corners:o,bubbles:x,headers:k,colMeta:C,dividers:r,cols:c,optSpacing:M,gridTop:e,gridBottom:n,gridLeft:l,gridRight:i,blockWidth:p,rowHeight:u,rowsPerCol:a,qLabelWidth:h,gapWidth:f,prefixRows:g}}function L(t,o){const e=window.docx,n=e.convertMillimetersToTwip,l=t.questions.length,i={top:{style:e.BorderStyle.NONE},bottom:{style:e.BorderStyle.NONE},left:{style:e.BorderStyle.NONE},right:{style:e.BorderStyle.NONE}},s={top:{style:e.BorderStyle.SINGLE,size:4},bottom:{style:e.BorderStyle.SINGLE,size:4},left:{style:e.BorderStyle.SINGLE,size:4},right:{style:e.BorderStyle.SINGLE,size:4}};function g(m,w){return new e.TableCell({width:{size:n(m),type:e.WidthType.DXA},verticalAlign:e.VerticalAlign.CENTER,borders:i,children:[new e.Paragraph({alignment:e.AlignmentType.CENTER,children:[new e.TextRun({text:"○",size:w||20})]})]})}function p(m,w,E){return E=E||{},new e.TableCell({width:{size:n(m),type:e.WidthType.DXA},verticalAlign:e.VerticalAlign.CENTER,borders:i,children:[new e.Paragraph({alignment:E.align||e.AlignmentType.LEFT,children:[new e.TextRun({text:w,bold:!!E.bold,size:E.size||16})]})]})}const d=U(l),{cols:c,rowHeight:a,blockWidth:u,qLabelWidth:h,colMeta:f}=d,M=(u-h)/4,x=[];for(let m=0;m<c;m++){const w=f[m],E=[];if(m===0){E.push(new e.TableRow({height:{value:n(a),rule:e.HeightRule.EXACT},children:[new e.TableCell({columnSpan:5,borders:i,verticalAlign:e.VerticalAlign.CENTER,children:[new e.Paragraph({children:[new e.TextRun({text:"Exam Set",bold:!0,size:14})]})]})]}));const y=(u-h)/5,b=[p(h,"",{})];["A","B","C","D","E"].forEach(A=>b.push(new e.TableCell({width:{size:n(y),type:e.WidthType.DXA},verticalAlign:e.VerticalAlign.CENTER,borders:i,children:[new e.Paragraph({alignment:e.AlignmentType.CENTER,children:[new e.TextRun({text:A,bold:!0,size:12})]}),new e.Paragraph({alignment:e.AlignmentType.CENTER,children:[new e.TextRun({text:"○",size:18})]})]}))),E.push(new e.TableRow({children:b,height:{value:n(a),rule:e.HeightRule.EXACT}})),E.push(new e.TableRow({height:{value:n(a),rule:e.HeightRule.EXACT},children:[new e.TableCell({columnSpan:5,borders:i,verticalAlign:e.VerticalAlign.CENTER,children:[new e.Paragraph({children:[new e.TextRun({text:"Roll No.",bold:!0,size:14})]})]})]}));const T=(u-h)/2;for(let A=0;A<=9;A++)E.push(new e.TableRow({height:{value:n(a),rule:e.HeightRule.EXACT},children:[p(h,String(A),{size:14,align:e.AlignmentType.CENTER}),g(T,18),g(T,18)]}));E.push(new e.TableRow({height:{value:n(a),rule:e.HeightRule.EXACT},children:[new e.TableCell({columnSpan:3,borders:i,verticalAlign:e.VerticalAlign.CENTER,children:[new e.Paragraph({children:[new e.TextRun({text:"Subject 1",bold:!0,size:14})]}),new e.Paragraph({children:[new e.TextRun({text:"Section 1",bold:!0,size:14})]})]})]}))}w.rows.forEach(y=>{if(y.type==="header"){const b=[p(h,"",{})];["A","B","C","D"].forEach(T=>b.push(p(M,T,{bold:!0,size:16,align:e.AlignmentType.CENTER}))),E.push(new e.TableRow({children:b,height:{value:n(a),rule:e.HeightRule.EXACT}}))}else{const b=String(y.q).padStart(y.q>=100?3:y.q>=10?2:1,"0"),T=[p(h,b,{bold:!0,size:16})];for(let A=0;A<4;A++)T.push(g(M,20));E.push(new e.TableRow({children:T,height:{value:n(a),rule:e.HeightRule.EXACT}}))}});const R=new e.Table({width:{size:n(u),type:e.WidthType.DXA},rows:E,borders:{...i,insideHorizontal:{style:e.BorderStyle.NONE},insideVertical:{style:e.BorderStyle.NONE}}});x.push(new e.TableCell({width:{size:n(u),type:e.WidthType.DXA},borders:{...i,left:m>0?{style:e.BorderStyle.SINGLE,size:2,color:"999999"}:{style:e.BorderStyle.NONE}},children:[R]}))}const k=new e.Table({width:{size:n(d.blockWidth*d.cols),type:e.WidthType.DXA},rows:[new e.TableRow({children:x})],borders:{...i,insideHorizontal:{style:e.BorderStyle.NONE},insideVertical:{style:e.BorderStyle.NONE}}}),C=["tl","tr","bl","br"].map(m=>{const w=d.corners[m];return new e.Table({width:{size:n(8),type:e.WidthType.DXA},rows:[new e.TableRow({height:{value:n(8),rule:e.HeightRule.EXACT},children:[new e.TableCell({width:{size:n(8),type:e.WidthType.DXA},shading:{type:e.ShadingType.SOLID,color:"000000",fill:"000000"},borders:i,children:[new e.Paragraph({})]})]})],borders:i,float:{horizontalAnchor:e.TableAnchorType.PAGE,verticalAnchor:e.TableAnchorType.PAGE,absoluteHorizontalPosition:n(w.x-8/2),absoluteVerticalPosition:n(w.y-8/2)}})}),v=new e.Table({width:{size:100,type:e.WidthType.PERCENTAGE},rows:[new e.TableRow({children:[new e.TableCell({width:{size:n(110),type:e.WidthType.DXA},verticalAlign:e.VerticalAlign.CENTER,borders:s,children:[new e.Paragraph({children:[new e.TextRun("NAME : ")]})]}),new e.TableCell({verticalAlign:e.VerticalAlign.CENTER,borders:s,children:[new e.Paragraph({children:[new e.TextRun(`EXAM : ${t.title||"Test"}`)]})]})]}),new e.TableRow({children:[new e.TableCell({columnSpan:2,verticalAlign:e.VerticalAlign.CENTER,borders:s,children:[new e.Paragraph({children:[new e.TextRun(`DATE : ____________     Roll Number: ______________   Mobile: ______________   Test ID: ${o}`)]})]})]})],borders:i}),r=new e.Table({width:{size:100,type:e.WidthType.PERCENTAGE},rows:[new e.TableRow({children:[new e.TableCell({shading:{type:e.ShadingType.SOLID,color:"F7F7F7",fill:"F7F7F7"},borders:{top:{style:e.BorderStyle.SINGLE,size:4},bottom:{style:e.BorderStyle.SINGLE,size:4},left:{style:e.BorderStyle.SINGLE,size:4},right:{style:e.BorderStyle.SINGLE,size:4}},children:[new e.Paragraph({children:[new e.TextRun({text:"निर्देश (Instructions): ",bold:!0}),new e.TextRun("वस्तुनिष्ठ प्रश्नों के सही उत्तर वाले गोले को नीले/काले बॉल पेन से पूरी तरह गहरा करें। Darken the correct circle completely using a Blue/Black Ball pen only.")]})]})]})],borders:i});return new e.Document({sections:[{properties:{page:{size:{width:n(210),height:n(297)},margin:{top:n(10),bottom:n(10),left:n(14),right:n(14)}}},children:[new e.Paragraph({alignment:e.AlignmentType.CENTER,children:[new e.TextRun({text:"The Vishnu Sharma — OMR उत्तर पत्रक",bold:!0,size:32})]}),new e.Paragraph({spacing:{before:100},children:[]}),v,new e.Paragraph({spacing:{before:150},children:[]}),r,new e.Paragraph({spacing:{before:150},children:[]}),k,...C]}]})}async function re(t,o){if(!window.docx&&window.__ensureLib)try{await window.__ensureLib("docx")}catch{}if(!window.docx)throw new Error("Word library load nahi ho payi — internet connection check karein aur page reload karein.");const e=`OMR-Sheet-${(t.title||"test").replace(/[^a-z0-9]+/gi,"-")}.docx`,n=L(t,o),l=await window.docx.Packer.toBlob(n),i=URL.createObjectURL(l),s=document.createElement("a");s.href=i,s.download=e,document.body.appendChild(s),s.click(),document.body.removeChild(s),setTimeout(()=>URL.revokeObjectURL(i),1e3)}async function q(t){const o=typeof getDB=="function"?getDB():null;if(!o)return null;try{const e=await o.collection("examManagerExams").where("linkedTestId","==",t).limit(1).get();return e.empty?null:{id:e.docs[0].id,...e.docs[0].data()}}catch(e){return console.warn("[findLinkedExamManagerExam] lookup failed:",e),null}}async function j(){const t=document.getElementById("omr-sheet-test-select")?.value;if(!t||typeof tests>"u"||!tests[t]){alert("Pehle test select karein.");return}const o=tests[t];if(!o.questions||!o.questions.length){alert("Is test mein questions nahi hain.");return}if(o.questions.length>100){alert("OMR sheet abhi max 100 questions tak support karti hai.");return}const e=document.getElementById("omr-generate-sheet-btn");e&&(e.disabled=!0,e.textContent="⏳ OMR Sheet (JPG) Bana Rahe Hain...");try{const n=await q(t);if(!n){alert('Ye test abhi Exam Management se link nahi hua — pehle test ko "Create/Edit Test" se ek baar Save/Publish karein (draft nahi), phir dobara try karein.');return}if(typeof window.examgrDownloadSheetJpg!="function"){alert("OMR sheet module load nahi ho paya — page reload karke dobara try karein.");return}await window.examgrDownloadSheetJpg(n,o.title)}catch(n){console.error(n),alert("OMR Sheet generate karne mein error: "+(n.message||n))}finally{e&&(e.disabled=!1,e.textContent="🖨️ OMR Sheet Generate Karein (JPG)")}}const $={a:0,b:1,c:2,d:3},I=`तुम एक PROFESSIONAL OMR SHEET SCANNER हो।

मैं तुम्हें एक या एक से अधिक OMR Sheet की images दूँगा। प्रत्येक image को एक अलग student की अलग OMR Answer Sheet मानो।

सबसे महत्वपूर्ण नियम — हर image का अलग COPYABLE OUTPUT

अगर मैंने 2 images दी हैं, तो तुम्हें 2 अलग-अलग code blocks देने हैं।

अगर मैंने 5 images दी हैं, तो तुम्हें 5 अलग-अलग code blocks देने हैं।

STRICT RULE:

हर OMR image = केवल एक अलग code block

हर code block में केवल उसी image के answers होंगे।

एक image के answers को दूसरी image के answers के साथ कभी combine मत करना।

उदाहरण

अगर 2 images हैं, तो output EXACTLY इस तरह होना चाहिए:

1 A
2
3 C
4 B
5
6 D

1 B
2 C
3
4 A
5 D
6

इन दोनों code blocks को अलग-अलग copy किया जा सके।

बहुत महत्वपूर्ण OUTPUT नियम

❌ "ANSWER SHEET 1" मत लिखो।

❌ "ANSWER SHEET 2" मत लिखो।

❌ "Image 1" मत लिखो।

❌ "Image 2" मत लिखो।

❌ किसी code block के अंदर कोई heading या explanation मत लिखो।

❌ सभी images के answers को एक ही code block में मत डालो।

✅ हर image के लिए अलग code block बनाओ।

✅ पहला code block = पहली image के answers।

✅ दूसरा code block = दूसरी image के answers।

✅ तीसरा code block = तीसरी image के answers।

और इसी तरह आगे।

OMR BUBBLE पहचानने के नियम

केवल VISUALLY FILLED bubble को answer मानो।

किसी option को तभी selected मानो जब उसके bubble के अंदर student की स्पष्ट dark/colored marking दिखाई दे।

इन चीजों को marking मत मानो:

खाली गोल circle

circle की border/outline

printed option letter

printing का निशान

scan का shadow

हल्का धब्बा

paper की crease

आसपास का text

दूसरे bubble की marking

image compression/noise

हर Question को अलग-अलग जांचो

हर question में A, B, C और D चारों bubbles को ध्यान से देखो।

A → क्या bubble वास्तव में भरा है?

B → क्या bubble वास्तव में भरा है?

C → क्या bubble वास्तव में भरा है?

D → क्या bubble वास्तव में भरा है?

Result के नियम

केवल A स्पष्ट रूप से भरा है → "A"

केवल B स्पष्ट रूप से भरा है → "B"

केवल C स्पष्ट रूप से भरा है → "C"

केवल D स्पष्ट रूप से भरा है → "D"

कोई bubble नहीं भरा है → केवल question number लिखो और उसके बाद खाली छोड़ दो।

दो या अधिक bubbles भरे हुए हैं → केवल question number लिखो और उसके बाद खाली छोड़ दो।

Marking स्पष्ट नहीं है → केवल question number लिखो और उसके बाद खाली छोड़ दो।

उदाहरण

यदि किसी image में:

1 = A
2 = खाली
3 = C
4 = B
5 = खाली

तो उस image का पूरा अलग code block:

1 A
2
3 C
4 B
5

दूसरी image में:

1 = D
2 = A
3 = खाली
4 = C
5 = B

तो दूसरी image का अलग code block:

1 D
2 A
3
4 C
5 B

QUESTION NUMBER

हर image के लिए सभी question numbers क्रम से लिखो।

अगर OMR में 1 से 100 तक questions हैं, तो प्रत्येक image के code block में 1 से 100 तक सभी numbers होने चाहिए।

किसी question को skip मत करो।

Blank question में केवल number लिखो:

25

"25 Blank" नहीं लिखना है।

"25 Unclear" नहीं लिखना है।

"25 Multiple" नहीं लिखना है।

FINAL VERIFICATION

हर image को independently कम से कम दो बार check करो।

विशेष रूप से verify करो:

1. कोई खाली bubble answer न बन जाए।

2. कोई भरा हुआ bubble छूट न जाए।

3. A/B/C/D की position सही हो।

4. Question number सही हो।

5. दूसरी image का answer इस image में न आए।

6. हर image का output अलग code block में हो।

7. हर code block सीधे copy-paste करने योग्य हो।

FINAL OUTPUT FORMAT — ABSOLUTELY STRICT

अगर 3 images हैं, तो EXACTLY 3 अलग-अलग code blocks दो:

[IMAGE 1 के सभी answers]

[IMAGE 2 के सभी answers]

[IMAGE 3 के सभी answers]

हर code block independent और directly copyable होना चाहिए।

कोई heading नहीं।

कोई explanation नहीं।

कोई numbering जैसे "Answer Sheet 1" नहीं।

कोई extra text नहीं।

अंतिम नियम:

ONE IMAGE = ONE SEPARATE CODE BLOCK

NEVER COMBINE MULTIPLE IMAGES INTO ONE CODE BLOCK.

EACH CODE BLOCK MUST BE DIRECTLY COPY-PASTEABLE.

NEVER GUESS.

NEVER FILL AN EMPTY BUBBLE.

NEVER WRITE BLANK, UNCLEAR OR MULTIPLE.

ALWAYS PRESERVE EVERY QUESTION NUMBER.

OUTPUT ONLY SEPARATE CODE BLOCKS.`;function F(){navigator.clipboard.writeText(I).then(()=>{alert("✅ Prompt copy ho gaya! Ab ChatGPT (chatgpt.com) mein naya chat kholein, paste karein, aur OMR sheet ki photo(s) attach karke bhej dein.")}).catch(()=>{const t=document.createElement("textarea");t.value=I,t.style.cssText="position:fixed;top:10%;left:10%;width:80%;height:70%;z-index:99999;font-size:12px;",document.body.appendChild(t),t.focus(),t.select(),alert("Clipboard access nahi mila — text box khul gaya hai, Ctrl+A phir Ctrl+C karke copy kar lein, phir isi box ko band kar dein.")})}window.copyChatGptOmrPrompt=F;function K(t,o){const e={},n=/(\d{1,3})\s*[).:\-]?\s*([abcdABCD]|[xX]|-)/g;let l;for(;(l=n.exec(t))!==null;){const i=parseInt(l[1],10);if(!i||i<1||i>o)continue;const s=l[2].toLowerCase();e[i]=s==="x"||s==="-"?null:$[s]}return e}function V(){const t=document.getElementById("omr-manual-test-select")?.value,o=document.getElementById("omr-manual-student-name"),e=document.getElementById("omr-manual-student-mobile"),n=document.getElementById("omr-manual-answers-text"),l=document.getElementById("omr-manual-status");if(!t||typeof tests>"u"||!tests[t]){alert("Pehle test select karein.");return}const i=tests[t],s=(o?.value||"").trim(),g=(e?.value||"").trim();if(!s||!/^\d{10}$/.test(g)){alert("Student ka naam aur sahi 10-digit mobile number bharein.");return}const p=(n?.value||"").trim();if(!p){alert("Pehle answers type karein — jaise: 1 c 2 b 3 a");return}const d=K(p,i.questions.length);if(Object.keys(d).length===0){l&&(l.textContent="⚠️ Koi bhi answer samajh nahi aaya — format check karein (jaise: 1 c 2 b 3 a).");return}l&&(l.textContent=`✅ ${Object.keys(d).length} / ${i.questions.length} answers mile — neeche review karke confirm karein.`),X(i,s,g,t,d)}function X(t,o,e,n,l){const i=document.getElementById("omr-manual-review-area");if(!i)return;const s=["A","B","C","D"];let g=0;const p=t.questions.map((d,c)=>{const a=c+1,u=Object.prototype.hasOwnProperty.call(l,a);u||g++;const h=u?l[a]:null,f=[0,1,2,3].map(M=>`<option value="${M}" ${h===M?"selected":""}>${s[M]}</option>`).join("")+`<option value="" ${h===null?"selected":""}>— Blank —</option>`;return`
        <div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-bottom:1px solid #f1f5f9;font-size:.85rem;${u?"":"background:#fffbeb;"}">
          <span style="width:64px;font-weight:700;">${u?"✅":"⚠️"} Q${a}</span>
          <select data-q="${a}" class="omr-manual-answer-select" style="padding:3px 6px;">${f}</select>
        </div>`}).join("");i.innerHTML=`
      <div class="card" style="margin-top:14px;">
        <h4 style="margin-bottom:6px;">📝 Review Answers ${g?`<span style="color:#d97706;font-size:.8rem;">(${g} nahi mile — blank maan liya, check karein)</span>`:""}</h4>
        <p class="muted-text" style="margin-bottom:8px;">✅ text se mila · ⚠️ nahi mila (blank set kiya, dropdown se sahi answer bharein).</p>
        <div style="max-height:340px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px;">${p}</div>
        <button type="button" id="omr-manual-confirm-save-btn" class="btn-primary" style="margin-top:12px;">✅ Confirm & Result Save Karein</button>
      </div>`,document.getElementById("omr-manual-confirm-save-btn").onclick=()=>Y(t,o,e,n)}async function Y(t,o,e,n){const l=document.querySelectorAll(".omr-manual-answer-select"),i={};l.forEach(r=>{const m=Number(r.getAttribute("data-q"));i[m]=r.value===""?null:Number(r.value)});let s=0,g=0,p=0,d=0;const c=getMarks(t),a=getNeg(t),u=Number(t.attemptLimit)>0?Number(t.attemptLimit):null;let h=0,f=0;const M=t.questions.map((r,m)=>{const w=m+1,E=i[w],R=r.qType==="subjective",y=typeof getQuestionMarks=="function"?getQuestionMarks(t,r):c;if(R)return d++,{questionNo:w,subject:r.subject||"",chapter:r.chapter||"",questionEN:r.textEN||r.text||"",questionHI:r.textHI||r.text||"",optionsEN:[],optionsHI:[],correctAnswer:null,studentAnswer:null,qType:"subjective",subjectiveGraded:!1,status:"Pending Review",marksAwarded:0,marksPerQuestion:y,explanationEN:r.explanationEN||r.explanation||"",explanationHI:r.explanationHI||r.explanation||""};const b=E==null,T=!b&&E===r.answer;let A=!0;return b||(h++,u&&h>u&&(A=!1,f++)),A&&(b?p++:T?s++:g++),{questionNo:w,subject:r.subject||"",chapter:r.chapter||"",questionEN:r.textEN||r.text||"",questionHI:r.textHI||r.text||"",optionsEN:r.optionsEN||r.options||[],optionsHI:r.optionsHI||r.options||[],correctAnswer:r.answer,studentAnswer:b?null:E,qType:"mcq",status:b?"Not answered":A?T?"Correct":"Wrong":"Extra (Not Counted)",marksAwarded:b||!A?0:T?y:a>0?-a:0,marksPerQuestion:y,explanationEN:r.explanationEN||r.explanation||"",explanationHI:r.explanationHI||r.explanation||""}}),x=typeof getTestMaxMarks=="function"?getTestMaxMarks(t):M.reduce((r,m)=>r+(Number(m.marksPerQuestion)||c),0),k=M.reduce((r,m)=>r+m.marksAwarded,0),C=x>0?k/x*100:0,v=new Date;try{await saveRecordOnline({name:o,mobile:e,email:"",testId:n,testTitle:t.title,testMode:"Manual Entry",totalQuestions:t.questions.length,attempted:s+g,negativeEnabled:a>0,negativeMarks:a,maxScore:x,score:k,percentage:C,correct:s,wrong:g,unattempted:p,details:M,pendingSubjective:d,durationSeconds:0,submittedAt:v.toLocaleString("en-IN"),submittedIso:v.toISOString()}),alert(`✅ Result save ho gaya!
${o}: ${k}/${x} (${Math.round(C)}%)`+(d?`
📝 ${d} subjective answer(s) abhi bhi grading ke liye pending hain — "Grade Subjective" tab mein jaakar marks daalein.`:"")),document.getElementById("omr-manual-review-area").innerHTML="",document.getElementById("omr-manual-answers-text").value="",document.getElementById("omr-manual-student-name").value="",document.getElementById("omr-manual-student-mobile").value="";const r=document.getElementById("omr-manual-status");r&&(r.textContent="")}catch(r){console.error(r),alert("Result save karne mein error: "+(r.message||r))}}const N=new WeakMap;function Q(t){if(!t||N.has(t))return;const o=document.createElement("div");o.className="searchable-select-wrap",t.parentNode.insertBefore(o,t),o.appendChild(t),t.classList.add("searchable-select-native");const e=document.createElement("input");e.type="text",e.className="searchable-select-input",e.placeholder="Test type karke dhoondhein ya list se chunein…",e.autocomplete="off",o.appendChild(e);const n=document.createElement("div");n.className="searchable-select-list hidden",o.appendChild(n);let l=-1;function i(){return Array.from(t.options).filter(c=>c.value!=="")}function s(c){const a=(c||"").trim().toLowerCase(),u=i().filter(h=>!a||h.textContent.toLowerCase().includes(a));if(n.innerHTML="",l=-1,!u.length){const h=document.createElement("div");h.className="searchable-select-empty",h.textContent=a?`"${c}" se milta koi saved test nahi mila`:"Koi saved test nahi mila",n.appendChild(h);return}u.forEach(h=>{const f=document.createElement("div");f.className="searchable-select-option",f.textContent=h.textContent,f.dataset.value=h.value,h.value===t.value&&f.classList.add("active"),f.addEventListener("mousedown",M=>{M.preventDefault(),g(h.value,h.textContent)}),n.appendChild(f)})}function g(c,a){t.value=c,e.value=a||"",d(),t.dispatchEvent(new Event("change",{bubbles:!0}))}function p(){s(e.value),n.classList.remove("hidden"),o.classList.add("open")}function d(){n.classList.add("hidden"),o.classList.remove("open"),l=-1}e.addEventListener("focus",p),e.addEventListener("click",p),e.addEventListener("input",()=>{e.value||(t.value=""),p()}),e.addEventListener("keydown",c=>{const a=Array.from(n.querySelectorAll(".searchable-select-option"));if(c.key==="ArrowDown"){if(c.preventDefault(),n.classList.contains("hidden")){p();return}l=Math.min(l+1,a.length-1),a.forEach((u,h)=>u.classList.toggle("highlight",h===l)),a[l]?.scrollIntoView({block:"nearest"})}else c.key==="ArrowUp"?(c.preventDefault(),l=Math.max(l-1,0),a.forEach((u,h)=>u.classList.toggle("highlight",h===l)),a[l]?.scrollIntoView({block:"nearest"})):c.key==="Enter"?(c.preventDefault(),l>=0&&a[l]&&g(a[l].dataset.value,a[l].textContent)):c.key==="Escape"&&(d(),e.blur())}),document.addEventListener("click",c=>{o.contains(c.target)||d()}),N.set(t,{input:e,list:n,renderList:s}),B(t)}function B(t){const o=N.get(t);if(!o)return;const e=t.options[t.selectedIndex];o.input.value=e&&e.value?e.textContent:""}function J(){return typeof allStudentsCache>"u"||!Array.isArray(allStudentsCache)?[]:allStudentsCache.map(t=>({name:(t.name||"").trim(),mobile:(t.mobile||"").trim()})).filter(t=>t.name||t.mobile)}function Z(t,o){[{input:t,matchField:"name",fillOther:o,otherField:"mobile"},{input:o,matchField:"mobile",fillOther:t,otherField:"name"}].forEach(e=>{const n=e.input;if(!n||n.dataset.autocompleteBound)return;n.dataset.autocompleteBound="1",n.autocomplete="off";const l=document.createElement("div");l.className="searchable-select-wrap",n.parentNode.insertBefore(l,n),l.appendChild(n);const i=document.createElement("div");i.className="searchable-select-list hidden",l.appendChild(i);let s=-1;function g(){const d=n.value.trim().toLowerCase();if(!d){i.classList.add("hidden");return}const c=J().filter(a=>(a[e.matchField]||"").toLowerCase().includes(d));if(i.innerHTML="",s=-1,!c.length){const a=document.createElement("div");a.className="searchable-select-empty",a.textContent="Koi registered student nahi mila — naya naam/number type karte rahein",i.appendChild(a),i.classList.remove("hidden");return}c.slice(0,8).forEach(a=>{const u=document.createElement("div");u.className="searchable-select-option",u.textContent=a.name&&a.mobile?`${a.name} — ${a.mobile}`:a.name||a.mobile,u.addEventListener("mousedown",h=>{h.preventDefault(),n.value=a[e.matchField]||"",a[e.otherField]&&(e.fillOther.value=a[e.otherField]),p()}),i.appendChild(u)}),i.classList.remove("hidden")}function p(){i.classList.add("hidden"),s=-1}n.addEventListener("input",g),n.addEventListener("focus",()=>{n.value.trim()&&g()}),document.addEventListener("click",d=>{l.contains(d.target)||p()}),n.addEventListener("keydown",d=>{const c=Array.from(i.querySelectorAll(".searchable-select-option"));c.length&&(d.key==="ArrowDown"?(d.preventDefault(),s=Math.min(s+1,c.length-1),c.forEach((a,u)=>a.classList.toggle("highlight",u===s)),c[s]?.scrollIntoView({block:"nearest"})):d.key==="ArrowUp"?(d.preventDefault(),s=Math.max(s-1,0),c.forEach((a,u)=>a.classList.toggle("highlight",u===s)),c[s]?.scrollIntoView({block:"nearest"})):d.key==="Enter"?s>=0&&c[s]&&(d.preventDefault(),c[s].dispatchEvent(new MouseEvent("mousedown",{bubbles:!0}))):d.key==="Escape"&&p())})})}let _="";function O(){if(typeof tests>"u")return;const t=Object.keys(tests).join("|");t!==_&&(_=t,[document.getElementById("omr-sheet-test-select"),document.getElementById("omr-manual-test-select")].forEach(o=>{if(!o)return;const e=o.value;o.innerHTML='<option value="">— Test chunein —</option>',Object.keys(tests).forEach(n=>{const l=tests[n];if(!l||l.isDraft)return;const i=document.createElement("option");i.value=n,i.textContent=l.title||n,o.appendChild(i)}),e&&tests[e]&&(o.value=e),Q(o),B(o)}))}function ee(){const t=document.getElementById("omr-generate-sheet-btn");t&&(t.onclick=j);const o=document.getElementById("omr-manual-parse-btn");o&&(o.onclick=V),O(),setInterval(O,4e3),Z(document.getElementById("omr-manual-student-name"),document.getElementById("omr-manual-student-mobile"))}document.addEventListener("DOMContentLoaded",ee),window.buildOMRSheetDocx=L})();
