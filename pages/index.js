import { useState } from 'react';
import Head from 'next/head';

export default function Home() {
  const [title, setTitle] = useState('');
  const [essay, setEssay] = useState('');
  const [state, setState] = useState('input');
  const [results, setResults] = useState(null);
  const [sampleState, setSampleState] = useState('idle');
  const [stretchState, setStretchState] = useState('idle');
  const [sampleEssay, setSampleEssay] = useState('');
  const [stretchEssay, setStretchEssay] = useState('');
  const [stretchGrade, setStretchGrade] = useState('');
  const [error, setError] = useState('');
  // New features state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [revisedEssay, setRevisedEssay] = useState('');
  const [revisedResults, setRevisedResults] = useState(null);
  const [viewMode, setViewMode] = useState('first'); // 'first' | 'revised'
  const [revisedState, setRevisedState] = useState('idle'); // 'idle'|'loading'|'done'
  const [showCert, setShowCert] = useState(false);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('leon_history') || '[]'); } catch(e) { return []; }
  });
  const wordCount = essay.replace(/\s/g, '').length;
  const gradeOrder = ['F9','E8','D7','C6','C5','B4','B3','A2','A1'];

  async function markEssay() {
    if (wordCount < 80) return setError('请提供至少80字的作文。');
    setError(''); setState('loading');
    // Deduplicate essay — detect if student accidentally pasted essay twice
    const dedupEssay = (function(text) {
      const paras = text.split('\n').filter(p => p.trim().length > 0);
      if (paras.length < 4) return text;
      const half = Math.floor(paras.length / 2);
      const firstHalf = paras.slice(0, half).join('\n');
      const secondHalf = paras.slice(half).join('\n');
      const shorter = firstHalf.length < secondHalf.length ? firstHalf : secondHalf;
      const longer = firstHalf.length < secondHalf.length ? secondHalf : firstHalf;
      let matches = 0;
      let li = 0;
      for (let si = 0; si < shorter.length; si++) {
        while (li < longer.length && longer[li] !== shorter[si]) li++;
        if (li < longer.length) { matches++; li++; }
      }
      const similarity = matches / shorter.length;
      if (similarity > 0.85) return paras.slice(0, half).join('\n');
      return text;
    })(essay);
    try {
      const res = await fetch('/api/mark', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ essay: dedupEssay, title }) });
      const data = await res.json();
      if (!res.ok || data.error) {
        const debugInfo = data.debug_snippet ? `\n\nDebug snippet: ${data.debug_snippet}\nError: ${data.debug_error}` : '';
        throw new Error((data.error || '批改失败') + debugInfo);
      }
      // ── Post-process EASI: fix misclassifications and supplement gaps ──
      if (data.easi) {
        var speechVerbs = ['说','道','回答','恳求','念叨','喊','骂','叫','问','嚷','吼'];
        var quoteChars = ['“','”','‘','’','「','」','"'];
        function hasSV(t) { return speechVerbs.some(function(v){return t.includes(v);}); }
        // hasCompleteSpeech: has speech verb AND at least one quote character — genuine speech unit
        function hasCompleteSpeech(t) {
          return hasSV(t) && quoteChars.some(function(q){return t.includes(q);});
        }
        var eArr = (data.easi.E && data.easi.E.extracted) ? data.easi.E.extracted.slice() : [];
        var aArr = (data.easi.A && data.easi.A.extracted) ? data.easi.A.extracted.slice() : [];
        var sArr = (data.easi.S && data.easi.S.extracted) ? data.easi.S.extracted.slice() : [];
        var iArr = (data.easi.I && data.easi.I.extracted) ? data.easi.I.extracted.slice() : [];

        // Fix 3: E/A entries with speech verb → move to S
        // Move to S only if has BOTH speech verb AND quote — pure verb-only fragments stay in A or get dropped
        var eToS = eArr.filter(hasCompleteSpeech); eArr = eArr.filter(function(t){return !hasSV(t);});
        var aToS = aArr.filter(hasCompleteSpeech);
        // Remove from A: entries with speech verb but no quote (e.g. 低着头惭愧的说 — verb-only manner tag)
        // Keep in A: entries with 骂/叫 used as action verbs WITH action context (把我骂了起来 = being scolded = action)
        aArr = aArr.filter(function(t){
          if (!hasSV(t)) return true; // no speech verb → keep in A
          // Has speech verb — check if it's a genuine action (被 passive or 了起来 pattern = action, not speech)
          if (t.includes('了起来') || t.includes('被')) return true; // 了起来 or 被 = passive action
          return false; // verb-only manner tag like 低着头惭愧的说 — drop from A
        });
        eToS.concat(aToS).forEach(function(t){ if (!sArr.includes(t)) sArr.push(t); });
        // Remove from S any entry with no quote at all (verb-only fragment like 低着头惭愧的说)
        sArr = sArr.filter(function(t){
          return quoteChars.some(function(q){return t.includes(q);});
        });

        // Fix 4: I entries from last paragraph → remove
        var paras = essay.split(/\n+/).filter(function(p){return p.trim().length>0;});
        var lastPara = paras.length>0 ? paras[paras.length-1] : '';
        iArr = iArr.filter(function(t){ return !lastPara.includes(t); });

        // Fix 5: I keyword supplement
        var iKW = ['我感到','我觉得','心想：','我心想','我不知','我开始感到','我很好奇','心里想','内心','我不禁','我感觉','心中想','犹豫'];
        paras.slice(0, paras.length-1).forEach(function(para) {
          iKW.forEach(function(kw) {
            var pos = 0;
            while (true) {
              var found = para.indexOf(kw, pos); if (found===-1) break;
              var end = found+kw.length;
              for (var ci=end; ci<Math.min(para.length,found+80); ci++) {
                if ('\u3002\uff1f\uff01'.includes(para[ci])) { end=ci+1; break; } end=ci+1;
              }
              var cl = para.slice(found, end).trim();
              if (cl.length>=4 && !iArr.some(function(e){return e.includes(cl)||cl.includes(e);})) iArr.push(cl);
              pos = found+1;
            }
          });
        });

        // Fix 6: E keyword supplement
        var eKW = ['面无表情','脸色苍白','眼眶','嘴唇','佝偻着腰','面色变得','眼神','脸上','面容','眼角','脸红','满脸','眉头紧皱','目光','嘴角','脸色','额头'];
        paras.forEach(function(para) {
          eKW.forEach(function(kw) {
            if (!para.includes(kw)) return;
            var pos2 = para.indexOf(kw);
            var st=0; for (var i=pos2-1;i>=Math.max(0,pos2-30);i--) { if ('\u3002\uff1f\uff01\uff0c\n'.includes(para[i])){st=i+1;break;} }
            var en=para.length; for (var j=pos2+kw.length;j<Math.min(para.length,pos2+50);j++) { if ('\u3002\uff1f\uff01\uff0c'.includes(para[j])){en=j+1;break;} }
            var cl2 = para.slice(st, en).trim();
            if (cl2.length>=4 && !hasSV(cl2) && !eArr.some(function(e){return e.includes(cl2)||cl2.includes(e);})) eArr.push(cl2);
          });
        });

        // Fix 3: I entries — truncate at first opening quote to strip embedded speech
        var iQuoteOpens = ['“','‘','「','"'];
        iArr = iArr.map(function(t) {
          var firstQ = -1;
          iQuoteOpens.forEach(function(q){ var p=t.indexOf(q); if(p!==-1&&(firstQ===-1||p<firstQ)) firstQ=p; });
          if (firstQ > 2) return t.slice(0, firstQ).trim().replace(/[，、]$/, '');
          return t;
        }).filter(function(t){ return t.length >= 4; });
        // Also remove I entries that are pure narration (contain 所以我问 — means it's bridging to speech)
        iArr = iArr.filter(function(t){ return !t.includes('所以我问'); });

        if (data.easi.E) data.easi.E.extracted = eArr;
        if (data.easi.A) data.easi.A.extracted = aArr;
        if (data.easi.S) data.easi.S.extracted = sArr;
        if (data.easi.I) data.easi.I.extracted = iArr;
      }
      setResults(data); setState('results');
      // Save to localStorage history
      try {
        const snap = {id:Date.now(),date:new Date().toLocaleDateString('zh-CN'),title:title||'（无题目）',grade:data.grade,total:data.total_score,content:data.content_score,language:data.language_score};
        const prev = JSON.parse(localStorage.getItem('leon_history')||'[]');
        const updated = [snap,...prev].slice(0,20);
        localStorage.setItem('leon_history', JSON.stringify(updated));
        setHistory(updated);
      } catch(e){}
    } catch (e) { setError('批改时出现错误：' + e.message); setState('input'); }
  }

  async function generateSample(mode) {
    const setter = mode === 'stretch' ? setStretchState : setSampleState;
    const essaySetter = mode === 'stretch' ? setStretchEssay : setSampleEssay;
    setter('loading');
    try {
      const res = await fetch('/api/sample', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, essay, grade: results?.grade, mode }) });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || '生成失败');
      essaySetter(data.essay);
      if (mode === 'stretch') setStretchGrade(data.targetGrade);
      setter('done');
    } catch (e) { setter('error'); }
  }

  function formatSample(text) {
    return text.replace(/【([^】]+)】/g, '<span style="font-family:monospace;font-size:11px;letter-spacing:0.12em;color:#a07820;display:block;margin-top:16px;margin-bottom:2px;font-weight:600">【$1】</span>');
  }

  function generatePDF() {
    const w = window.open('', '_blank');
    const fwNames = {p1_opening:'P1 开头策略',p2_scene:'P2 场景设置',p31_transition:'P3.1 过渡段',p32_flashback:'P3.2 插叙',p4_trigger:'P4 高潮前',p56_climax:'P5–6 高潮中',p7_resolution:'P7 高潮后',p8_conclusion:'P8 结尾'};
    const fwStatusStyle = {pass:{bg:'#edf7f1',border:'#1a6e40',color:'#154d2e',icon:'✓',label:'达标'},warn:{bg:'#fdf6e3',border:'#a07820',color:'#5a3e10',icon:'△',label:'可改善'},fail:{bg:'#fff0ee',border:'#b83222',color:'#6a1810',icon:'✗',label:'缺失'}};
    const easiNames = {E:{zh:'外貌描写',en:'Expressions & Appearance'},A:{zh:'行动描写',en:'Actions'},S:{zh:'语言描写',en:'Speech'},I:{zh:'心理描写',en:'Inner Thoughts & Feelings'}};
    const fmt = t => t.replace(/【([^】]+)】/g,'<span style="font-family:monospace;font-size:10px;color:#a07820;display:block;margin-top:14px;font-weight:600;letter-spacing:.05em">【$1】</span>');

    const fwCards = Object.entries(results.framework||{}).map(([k,v]) => {
      const st = fwStatusStyle[v.status]||fwStatusStyle.pass;
      return `<div style="background:${st.bg};border:1px solid ${st.border};border-left:4px solid ${st.border};border-radius:8px;padding:12px 14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-weight:700;font-size:11px;color:${st.color}">${fwNames[k]||k}</span>
          <span style="font-size:10px;color:${st.color};background:white;padding:1px 7px;border-radius:99px;border:1px solid ${st.border}">${st.icon} ${st.label}</span>
        </div>
        <div style="font-size:12px;color:#3d3020;line-height:1.65">${v.comment||''}</div>
      </div>`;
    }).join('');

    const easiCards = ['E','A','S','I'].map(k => {
      const it = results.easi?.[k]||{};
      const isExcellent = it.rating==='excellent', isGood = it.rating==='good', isOk = it.rating==='ok';
      const bg = isExcellent?'#eaf2fb':isGood?'#edf7f1':isOk?'#fdf6e3':'#fff0ee';
      const border = isExcellent?'#1a4a70':isGood?'#1a6e40':isOk?'#a07820':'#b83222';
      const color = isExcellent?'#0d2d44':isGood?'#154d2e':isOk?'#5a3e10':'#6a1810';
      const extractedArr = (it.extracted && it.extracted.length>0) ? it.extracted : [];
      const extractedHtml = !extractedArr.length
        ? '<span style="color:#999;font-style:italic">未发现相关描写</span>'
        : extractedArr.map(ex=>`<div style="display:flex;gap:6px;margin-bottom:4px"><span style="color:${border};font-weight:700;flex-shrink:0">·</span><span style="font-family:'Noto Serif SC',serif;font-size:11px">${ex}</span></div>`).join('');
      return `<div style="background:${bg};border:1px solid ${border};border-radius:10px;padding:14px 16px;">
        <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:4px">
          <span style="font-family:'Noto Serif SC',serif;font-size:1.6rem;font-weight:900;color:${border};line-height:1">${k}</span>
          <div><div style="font-weight:700;font-size:12px;color:${color}">${easiNames[k].zh}</div><div style="font-size:10px;color:${color};opacity:.7">${easiNames[k].en}</div></div>
          <span style="margin-left:auto;font-size:10px;color:${color};background:white;padding:1px 7px;border-radius:99px;border:1px solid ${border}">${it.score_label||''}</span>
        </div>
        <div style="font-size:11px;color:#3d3020;margin-bottom:8px">${it.comment||''}</div>
        <div style="background:rgba(255,255,255,.6);border-radius:6px;padding:8px 10px;border-left:3px solid ${border}">
          <div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;opacity:.5;margin-bottom:4px;font-family:monospace">学生原文摘录 · STUDENT'S WRITING</div>
          ${extractedHtml}
        </div>
      </div>`;
    }).join('');

    const errSection = (results.language_errors||[]).length
      ? (results.language_errors||[]).map(e=>`<div style="padding:10px 13px;border-radius:8px;border-left:3px solid #b83222;background:#fdf0ee;margin-bottom:8px;font-size:12px">
          <div style="font-weight:700;font-size:10px;color:#b83222;margin-bottom:4px">${e.label}</div>
          <div style="color:#b83222;font-family:'Noto Serif SC',serif">原文：${e.original}</div>
          <div style="color:#1a6e40;font-family:'Noto Serif SC',serif">改正：${e.correction}</div>
          ${e.reason?`<div style="color:#666;margin-top:2px">${e.reason}</div>`:''}
        </div>`).join('')
      : '<p style="color:#1a6e40;font-style:italic;font-size:12px">语言运用良好，未发现明显错误。✓</p>';

    const pdfFwKeys = ['p1_opening','p2_scene','p31_transition','p32_flashback','p4_trigger','p56_climax','p7_resolution','p8_conclusion'].filter(function(k){return !!(results.framework||{})[k];});
    const pdfFwLabels = {p1_opening:'P1 开头',p2_scene:'P2 场景',p31_transition:'P3.1 过渡',p32_flashback:'P3.2 插叙',p4_trigger:'P4 高潮前',p56_climax:'P5-6 高潮中',p7_resolution:'P7 高潮后',p8_conclusion:'P8 结尾'};

    const pdfParas = (essay||'').split('\n').filter(function(p){return p.trim().length>0;});

    const pdfMergedAnns = results.annotations || [];

    const pdfAnnotatedEssayWithFw = pdfParas.map(function(para, pIdx) {
      const annotatedPara = (function() {
        var sorted = pdfMergedAnns.slice().sort(function(a,b){return (b.text||'').length-(a.text||'').length;});
        var text = para;
        sorted.forEach(function(ann) {
          if (!ann.text) return;
          var pos = text.indexOf(ann.text);
          if (pos === -1) return;
          var bg = ann.type==='error'?'#ffd6d6':ann.type==='good'?'#d0f0df':'#fff3cc';
          var ul = ann.type==='error'?'#b83222':ann.type==='good'?'#1a6e40':'#a07820';
          var dot = ann.type==='error'?'🔴':ann.type==='good'?'🟢':'🟡';
          var span = '<span style="background:'+bg+';border-bottom:2px solid '+ul+';border-radius:3px;padding:1px 2px">'+ann.text+'<sup style="font-size:8px;color:'+ul+';margin-left:1px">'+dot+'</sup></span>';
          text = text.slice(0, pos) + span + text.slice(pos + ann.text.length);
        });
        return text;
      })();
      return (
        '<div style="margin-bottom:6px">'+
          '<div style="font-family:Noto Serif SC,serif;font-size:12px;color:#3d3020;line-height:2;background:#fffef8;padding:10px 14px;border-radius:8px;border:1px solid #e0d5c0">'+annotatedPara+'</div>'+
        '</div>'
      );
    }).join('');

    const cPct = Math.round((results.content_score/20)*100);
    const lPct = Math.round((results.language_score/20)*100);
    const barC = p => p>=80?'#1a6e40':p>=65?'#1a4a70':p>=50?'#a07820':'#b83222';

    // NEW: 动作流程 section for PDF
    const seqSection = (results.action_sequences||[]).length ? `<div class="sec"><h2>🔗 动作流程<span class="sec-sub-label">ACTION SEQUENCES · 3+ CONSECUTIVE EASI TECHNIQUES</span></h2>
      <div style="font-size:10px;color:#8a7a60;margin-bottom:12px">连续3个或以上的EASI描写手法，形成流畅的描写链——这是Band 1与Band 2的关键差别。</div>
      ${(results.action_sequences||[]).map(s=>`<div style="padding:10px 14px;border-radius:8px;border-left:3px solid #6b4c9a;background:#f5f0ff;margin-bottom:8px">
        <div style="font-family:monospace;font-size:11px;font-weight:600;color:#6b4c9a;margin-bottom:4px;letter-spacing:.05em">${s.pattern}</div>
        <div style="font-family:'Noto Serif SC',serif;font-size:12px;color:#3d3020;line-height:1.8;margin-bottom:4px">${s.text}</div>
        <div style="font-size:11px;color:#5a4a80;font-style:italic">${s.comment}</div>
      </div>`).join('')}</div>` : '';

    const sampleSection = sampleEssay ? `<div class="sec"><h2>⭐ 示范范文 (A1/A2 水平)</h2><div style="font-size:10px;color:#8a7a60;margin-bottom:10px">根据你的故事内容，生成一篇 A1/A2 水平的示范作文。保留你的故事，全面提升语言表达与 EASI 手法至最高水平。</div><div class="et">${fmt(sampleEssay)}</div><p style="font-size:10px;color:#8a7a60;font-style:italic;margin-top:10px">※ 此范文仅供参考，请勿直接抄写。以此为范例理解写法，再用自己的语言重写。</p></div>` : '';
    const stretchSection = stretchEssay ? `<div class="sec"><h2>📈 进阶范文 (${stretchGrade} 水平)</h2><div class="et">${fmt(stretchEssay)}</div><p style="font-size:10px;color:#8a7a60;font-style:italic;margin-top:10px">※ 此范文仅供参考，请勿直接抄写。</p></div>` : '';

    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>批改报告</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&family=Noto+Sans+SC:wght@300;400;500;600&family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet">
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Noto Sans SC',sans-serif;font-size:13px;color:#1c1710;padding:36px;max-width:960px;margin:0 auto;line-height:1.8;background:#f9f6f1}
      .hdr{text-align:center;padding-bottom:18px;margin-bottom:24px;border-bottom:2px solid #1c1710}
      .hdr-eye{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#8a7a60;margin-bottom:8px}
      .hdr h1{font-family:'Noto Serif SC',serif;font-size:1.5rem;font-weight:700;margin-bottom:4px}
      .hdr-sub{font-size:11px;color:#8a7a60}
      .grade-banner{display:flex;align-items:center;gap:20px;background:#1c1710;color:#e8d090;padding:18px 24px;border-radius:12px;margin-bottom:20px}
      .grade-letter{font-family:'Playfair Display',serif;font-size:3rem;font-weight:900;line-height:1}
      .grade-label{font-family:'Noto Serif SC',serif;font-size:1.1rem;font-weight:600}
      .grade-sub{font-size:11px;color:rgba(232,208,144,.6);margin-top:4px}
      .bars{display:flex;flex-direction:column;gap:6px;flex:1;margin-left:10px}
      .bar-row{display:flex;align-items:center;gap:8px;font-size:11px;color:rgba(232,208,144,.7)}
      .bar-track{flex:1;height:6px;background:rgba(255,255,255,.15);border-radius:3px;overflow:hidden}
      .bar-fill{height:100%;border-radius:3px}
      .sec{background:white;border-radius:12px;border:1px solid #e0d5c0;padding:18px 22px;margin-bottom:16px}
      .sec h2{font-family:'Noto Serif SC',serif;font-size:.9rem;font-weight:600;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #e8dfc8;display:flex;align-items:center;gap:8px}
      .sec-sub-label{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#8a7a60;font-family:'Noto Sans SC',sans-serif;font-weight:400}
      .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:0}
      .se{background:#fffef8;padding:16px;border-radius:8px;font-family:'Noto Serif SC',serif;line-height:2.1;white-space:pre-wrap;font-size:13px;color:#3d3020;border:1px solid #e0d5c0}
      .et{font-family:'Noto Serif SC',serif;line-height:2.1;white-space:pre-wrap;color:#3d3020;font-size:13px}
      .examiner-box{background:#fffef8;border-left:3px solid #c8943a;padding:16px 20px;border-radius:0 8px 8px 0;font-family:'Noto Serif SC',serif;font-style:italic;line-height:1.9;font-size:13px}
      .marketing{background:#1a1a2e;border-radius:12px;padding:22px 24px;margin-bottom:16px;border:1px solid rgba(26,154,173,.3)}
      .mkt-title{font-weight:700;font-size:13px;color:white;margin-bottom:4px}
      .mkt-cred{font-size:11px;color:rgba(255,255,255,.5);margin-bottom:10px}
      .mkt-body{font-size:12px;color:rgba(255,255,255,.7);line-height:1.7;margin-bottom:14px}
      .mkt-wa{display:inline-block;background:#25D366;color:white;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600;text-decoration:none}
      .pb{position:fixed;top:16px;right:16px;background:#1c1710;color:#e8d090;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:12px;font-family:'Noto Sans SC',sans-serif}
      @media print{.pb{display:none}body{background:white;padding:20px}.grade-banner{-webkit-print-color-adjust:exact;print-color-adjust:exact}.marketing{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>
    <button class="pb" onclick="window.print()">🖨 Print / Save PDF</button>
    <div class="hdr">
      <div class="hdr-eye">TEACHER LEON'S BILINGUAL ACADEMY · 专属批改工具</div>
      <h1>记叙文智能批改</h1>
      <div class="hdr-sub">Narrative Composition Marker · 依据 SEAB 1160 评分指引 · 结合林老师记叙文框架</div>
      ${title?'<div style="margin-top:10px;font-size:13px;font-family:\'Noto Serif SC\',serif;color:#3d3020">题目：'+title+'</div>':''}
    </div>
    <div class="grade-banner">
      <div class="grade-letter">${results.grade}</div>
      <div>
        <div class="grade-label">${results.grade_label} · ${results.total_score}/40</div>
        <div class="grade-sub">内容 ${results.content_score}/20（第${results.content_band}级）　语文与结构 ${results.language_score}/20（第${results.language_band}级）</div>
      </div>
      <div class="bars">
        <div class="bar-row"><span style="width:80px">内容 ${results.content_score}/20</span><div class="bar-track"><div class="bar-fill" style="width:${cPct}%;background:${barC(cPct)}"></div></div></div>
        <div class="bar-row"><span style="width:80px">语文 ${results.language_score}/20</span><div class="bar-track"><div class="bar-fill" style="width:${lPct}%;background:${barC(lPct)}"></div></div></div>
      </div>
    </div>
    <div class="sec">
      <h2>📝 学生原文（批注版）<span class="sec-sub-label">ANNOTATED STUDENT ESSAY · FRAMEWORK NOTES ALONGSIDE EACH PARAGRAPH</span></h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        <span style="font-size:10px;padding:2px 8px;border-radius:99px;background:#edf7f1;color:#1a6e40;border:1px solid #1a6e40">🟢 优点</span>
        <span style="font-size:10px;padding:2px 8px;border-radius:99px;background:#fdf0ee;color:#b83222;border:1px solid #b83222">🔴 错误</span>
        <span style="font-size:10px;padding:2px 8px;border-radius:99px;background:#fdf6e3;color:#a07820;border:1px solid #a07820">🟡 可改善</span>
      </div>
      ${pdfAnnotatedEssayWithFw}
    </div>
    <div class="sec">
      <h2>📊 分项得分<span class="sec-sub-label">SCORE BREAKDOWN</span></h2>
      <p style="margin-bottom:8px"><b>内容：</b>${results.content_feedback}</p>
      <p><b>语文：</b>${results.language_feedback}</p>
    </div>
    <div class="sec">
      <h2>🗂 林老师框架检查<span class="sec-sub-label">NARRATIVE FRAMEWORK</span></h2>
      <div class="grid2">${fwCards}</div>
    </div>
    <div class="sec">
      <h2>✍️ EASI 人物描写手法<span class="sec-sub-label">E = Expressions & Appearance · A = Actions · S = Speech · I = Inner Thoughts & Feelings</span></h2>
      <div class="grid2">${easiCards}</div>
    </div>
    ${seqSection}
    <div class="sec">
      <h2>🔍 语文错误（全部）<span class="sec-sub-label">ALL LANGUAGE ERRORS</span></h2>
      ${errSection}
    </div>
    <div class="grid2" style="margin-bottom:16px">
      <div class="sec" style="margin-bottom:0">
        <h2>🏗 结构与表达<span class="sec-sub-label">STRUCTURE & STYLE</span></h2>
        ${(results.structure_notes||[]).length
          ? (results.structure_notes||[]).map(e=>'<div style="padding:10px 13px;border-radius:8px;border-left:3px solid #1a4a70;background:#eaf2fb;margin-bottom:8px;font-size:12px"><div style="font-weight:700;font-size:10px;color:#1a4a70;margin-bottom:3px">'+(e.label||'结构优点')+'</div>'+e.text+'</div>').join('')
          : '<p style="color:#1a6e40;font-style:italic;font-size:12px">结构整体良好。✓</p>'}
      </div>
      <div class="sec" style="margin-bottom:0">
        <h2>🌱 改进建议<span class="sec-sub-label">HOW TO IMPROVE</span></h2>
        <ul style="list-style:none;display:flex;flex-direction:column;gap:8px">${(results.improvements||[]).map(i=>'<li style="display:flex;gap:8px;align-items:flex-start;font-size:12px"><span style="color:#1a6e40;flex-shrink:0;font-weight:700">✦</span><span>'+i+'</span></li>').join('')}</ul>
      </div>
    </div>
    <div class="sec">
      <h2>📋 老师总评<span class="sec-sub-label">TEACHER LEON'S COMMENT</span></h2>
      <div class="examiner-box">${results.examiner_comment}</div>
      <p style="text-align:right;font-size:11px;color:#8a7a60;margin-top:10px">— 林纯隆老师 · 林老师双语学堂 · O Level 1160 考官</p>
    </div>
    ${results.rewrite_examples && results.rewrite_examples.length ? `<div class="sec"><h2>✏️ 改写示范<span class="sec-sub-label">SENTENCE REWRITES</span></h2><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f5f5f5"><th style="text-align:left;padding:7px 10px;border-bottom:2px solid #e0e0e0;width:35%">原句</th><th style="text-align:left;padding:7px 10px;border-bottom:2px solid #e0e0e0;width:40%">改写后</th><th style="text-align:left;padding:7px 10px;border-bottom:2px solid #e0e0e0;width:25%">改写要点</th></tr></thead><tbody>${results.rewrite_examples.map(r=>'<tr style="border-bottom:1px solid #f0f0f0"><td style="padding:8px 10px;color:#c0392b;vertical-align:top;font-family:Noto Serif SC,serif">'+r.original+'</td><td style="padding:8px 10px;color:#1a6e40;vertical-align:top;font-weight:500;font-family:Noto Serif SC,serif">'+r.rewrite+'</td><td style="padding:8px 10px;color:#555;vertical-align:top;font-size:11px">'+r.note+'</td></tr>').join('')}</tbody></table></div>` : ''}
    ${sampleSection}
    ${stretchSection}
    ${revisedResults ? `<div class="sec"><h2>🔄 修改版对比<span class="sec-sub-label">REVISION COMPARISON</span></h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:12px">
        <div style="background:#f8f8f8;border-radius:8px;padding:14px;border:1px solid #e0e0e0;text-align:center">
          <div style="font-size:11px;color:#888;margin-bottom:4px">第一稿 First Draft</div>
          <div style="font-size:2rem;font-weight:900;color:#1a4a70">${results.grade}</div>
          <div style="font-size:12px;color:#555">${results.total_score}/40 · 内容${results.content_score} 语文${results.language_score}</div>
        </div>
        <div style="background:#f8f8f8;border-radius:8px;padding:14px;border:1px solid #e0e0e0;text-align:center">
          <div style="font-size:11px;color:#888;margin-bottom:4px">修改版 Revised</div>
          <div style="font-size:2rem;font-weight:900;color:${revisedResults.total_score>results.total_score?'#1a6e40':revisedResults.total_score<results.total_score?'#b83222':'#1a4a70'}">${revisedResults.grade}</div>
          <div style="font-size:12px;color:#555">${revisedResults.total_score}/40 · 内容${revisedResults.content_score} 语文${revisedResults.language_score}</div>
        </div>
      </div>
      <div style="padding:10px 14px;border-radius:8px;background:${revisedResults.total_score>results.total_score?'#edf7f1':revisedResults.total_score<results.total_score?'#fdf0ee':'#f5f5f5'};border:1px solid ${revisedResults.total_score>results.total_score?'#1a6e40':revisedResults.total_score<results.total_score?'#b83222':'#ddd'};font-size:12px;color:${revisedResults.total_score>results.total_score?'#1a6e40':revisedResults.total_score<results.total_score?'#b83222':'#555'}">
        ${revisedResults.total_score>results.total_score?'✅ 提升了 '+(revisedResults.total_score-results.total_score)+' 分！从 '+results.grade+' 进步到 '+revisedResults.grade:revisedResults.total_score<results.total_score?'⚠️ 分数下降了 '+(results.total_score-revisedResults.total_score)+' 分':'✔️ 分数持平'}
      </div>
    </div>` : ''}
    ${chatMessages.length>0?`<div class="sec"><h2>💬 问答记录<span class="sec-sub-label">Q&A TRANSCRIPT</span></h2>
      ${chatMessages.map(function(m){return '<div style="margin-bottom:10px;display:flex;flex-direction:column;align-items:'+(m.role==='user'?'flex-end':'flex-start')+'"><div style="max-width:85%;background:'+(m.role==='user'?'#1c1710':'#f5f5f5')+';color:'+(m.role==='user'?'#e8d090':'#1c1710')+';padding:8px 12px;border-radius:'+(m.role==='user'?'12px 12px 4px 12px':'12px 12px 12px 4px')+';font-size:12px;line-height:1.6">'+m.content+'</div></div>';}).join('')}
    </div>`:''}
    <div class="marketing">
      <div class="mkt-title">👨‍🏫 Found this useful? Learn directly with Teacher Leon.</div>
      <div class="mkt-cred">BA (Hons) Chinese Studies, NTU · PGDE, NIE · 17 years teaching · 10 years O-Level marker</div>
      <div class="mkt-body">This tool reflects how Leon teaches — structured, strategic, examiner-informed. If your child would benefit from that approach 1-to-1, a trial lesson is the best way to find out.</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <a class="mkt-wa" href="https://wa.me/6592286725?text=Hi%20Leon%2C%20I%20used%20your%20composition%20marking%20tool%20and%20would%20like%20to%20find%20out%20more%20about%20trial%20lessons." target="_blank">WhatsApp for a Trial →</a>
        <a href="/about.html" target="_blank" style="display:inline-block;color:rgba(255,255,255,0.6);font-size:13px;padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);text-decoration:none;">Learn more →</a>
      </div>
    </div>
    </body></html>`);
    w.document.close();
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = {role:'user', content: chatInput.trim()};
    const newMsgs = [...chatMessages, userMsg];
    setChatMessages(newMsgs); setChatInput(''); setChatLoading(true);
    try {
      const ctx = {
        title, grade: results?.grade, total_score: results?.total_score,
        content_score: results?.content_score, language_score: results?.language_score,
        content_band: results?.content_band, language_band: results?.language_band,
        error_count: results?.language_errors?.length || 0,
        framework_issues: Object.entries(results?.framework||{}).filter(([k,v])=>v.status!=='pass').map(([k,v])=>k).join(', ') || 'none',
        improvements: results?.improvements || [],
        essay_preview: essay.substring(0, 500)
      };
      const res = await fetch('/api/chat', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:newMsgs,context:ctx})});
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error||'Chat failed');
      setChatMessages([...newMsgs, {role:'assistant',content:data.reply}]);
    } catch(e) {
      setChatMessages([...newMsgs, {role:'assistant',content:'抱歉，暂时无法回答。请稍后再试。Sorry, unable to respond right now.'}]);
    }
    setChatLoading(false);
  }

  async function markRevised() {
    if (!revisedEssay.trim() || revisedEssay.replace(/\s/g,'').length < 80) return;
    setRevisedState('loading');
    try {
      const res = await fetch('/api/mark', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({essay:revisedEssay,title})});
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error||'批改失败');
      setRevisedResults(data); setRevisedState('done'); setViewMode('revised');
    } catch(e) { setRevisedState('idle'); setError('修改版批改失败：'+e.message); }
  }

  function generateCertificate() {
    const r = results;
    const gradeColors = {A1:'#1a6e40',A2:'#1a6e40',B3:'#1a4a70',B4:'#1a4a70',C5:'#a07820',C6:'#a07820',D7:'#b83222',E8:'#b83222',F9:'#b83222'};
    const gc = gradeColors[r.grade]||'#1a4a70';
    const w = window.open('','_blank');
    const safeComment = (r.examiner_comment||'').substring(0,180).replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;');
    const safeTitle = (title||'').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;');
    const certParts = [
      '<!DOCTYPE html><html><head><meta charset="UTF-8">',
      '<style>',
      '*{box-sizing:border-box;margin:0;padding:0}',
      'body{background:#f8f5ef;display:flex;justify-content:center;padding:40px 20px;font-family:sans-serif}',
      '.cert{background:white;width:640px;border:3px solid ' + gc + ';border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.12)}',
      '.cert-top{background:' + gc + ';padding:28px 32px;color:white;text-align:center}',
      '.cert-eye{font-size:10px;letter-spacing:.2em;text-transform:uppercase;opacity:.7;margin-bottom:6px}',
      '.cert-title{font-size:1.4rem;font-weight:700;margin-bottom:4px}',
      '.cert-sub{font-size:.82rem;opacity:.7}',
      '.cert-body{padding:28px 32px}',
      '.cert-grade{text-align:center;margin-bottom:20px}',
      '.cert-letter{font-size:5rem;font-weight:900;color:' + gc + ';line-height:1}',
      '.cert-pts{font-size:1rem;color:#555;margin-top:4px}',
      '.cert-scores{display:flex;gap:16px;justify-content:center;margin-bottom:20px}',
      '.score-box{text-align:center;background:#f8f8f8;border-radius:10px;padding:12px 20px;border:1px solid #eee}',
      '.score-val{font-size:1.5rem;font-weight:700;color:' + gc + '}',
      '.score-lbl{font-size:.75rem;color:#888;margin-top:2px}',
      '.cert-comment{background:#f8f8f8;border-radius:8px;border-left:4px solid ' + gc + ';padding:14px 16px;margin-bottom:20px;font-size:.88rem;color:#333;line-height:1.7;font-style:italic}',
      '.cert-footer{text-align:center;font-size:.78rem;color:#888;padding-top:16px;border-top:1px solid #eee}',
      '.cert-teacher{font-weight:700;color:#1c1710;font-size:.85rem}',
      '.print-btn{display:block;width:100%;background:' + gc + ';color:white;border:none;padding:12px;font-size:.9rem;cursor:pointer;font-weight:600}',
      '@media print{.print-btn{display:none}.cert{-webkit-print-color-adjust:exact;print-color-adjust:exact}}',
      '</style></head><body>',
      '<div class="cert">',
      '<div class="cert-top">',
      '<div class="cert-eye">' + '林老师双语学堂' + ' &middot; Teacher Leon&#39;s Bilingual Academy</div>',
      '<div class="cert-title">' + '记叙文批改成绩单' + '</div>',
      '<div class="cert-sub">O Level Chinese Narrative Composition &middot; SEAB 1160</div>',
      '</div>',
      '<div class="cert-body">',
      '<div class="cert-grade">',
      '<div class="cert-letter">' + r.grade + '</div>',
      '<div class="cert-pts">' + r.grade_label + ' &middot; ' + r.total_score + '/40</div>',
      '</div>',
      '<div class="cert-scores">',
      '<div class="score-box"><div class="score-val">' + r.content_score + '/20</div><div class="score-lbl">' + '内容' + ' Content</div></div>',
      '<div class="score-box"><div class="score-val">' + r.language_score + '/20</div><div class="score-lbl">' + '语文' + ' Language</div></div>',
      '</div>',
      '<div class="cert-comment">' + safeComment + (r.examiner_comment&&r.examiner_comment.length>180?'&hellip;':'') + '</div>',
      (safeTitle ? '<p style="text-align:center;color:#555;font-size:.85rem;margin-bottom:16px">' + '题目：' + safeTitle + '</p>' : ''),
      '<div class="cert-footer">',
      '<div class="cert-teacher">' + '林纯隆老师' + ' &middot; Leon Lim</div>',
      '<div style="margin-top:2px">BA Chinese Studies NTU &middot; PGDE NIE &middot; 17 years &middot; O Level Examiner</div>',
      '<div style="margin-top:4px;font-size:.72rem">' + new Date().toLocaleDateString('zh-CN') + ' &middot; narrative-marker.vercel.app</div>',
      '</div>',
      '</div>',
      '<button class="print-btn" onclick="window.print()">&#128196; Save / Print Certificate</button>',
      '</div></body></html>'
    ];
    w.document.write(certParts.join(''));
    w.document.close();
  }

  function reset() { setState('input'); setResults(null); setSampleState('idle'); setStretchState('idle'); setSampleEssay(''); setStretchEssay(''); setStretchGrade(''); setError(''); setRevisedEssay(''); setRevisedResults(null); setViewMode('first'); setRevisedState('idle'); setChatMessages([]); setChatInput(''); }

    const fwItems = [{key:'p1_opening',label:'P1 开头策略'},{key:'p2_scene',label:'P2 场景设置'},{key:'p31_transition',label:'P3.1 过渡段'},{key:'p32_flashback',label:'P3.2 插叙'},{key:'p4_trigger',label:'P4 高潮前'},{key:'p56_climax',label:'P5–6 高潮中'},{key:'p7_resolution',label:'P7 高潮后'},{key:'p8_conclusion',label:'P8 结尾'}];
  const easiItems = [{k:'E',name:'外貌描写',en:'Expressions & Appearance'},{k:'A',name:'行动描写',en:'Actions'},{k:'S',name:'语言描写',en:'Speech'},{k:'I',name:'心理描写',en:'Inner Thoughts & Feelings'}];
  function fwColor(s){if(s==='pass')return{bg:'#edf7f1',border:'#1a6e40',text:'#154d2e',icon:'✓'};if(s==='warn')return{bg:'#fdf6e3',border:'#a07820',text:'#5a3e10',icon:'△'};return{bg:'#fdf0ee',border:'#b83222',text:'#6a1810',icon:'✗'};}
  function easiColor(r){if(r==='excellent')return{bg:'#eaf2fb',border:'#1a4a70',text:'#0d2d44'};if(r==='good')return{bg:'#edf7f1',border:'#1a6e40',text:'#154d2e'};if(r==='ok')return{bg:'#fdf6e3',border:'#a07820',text:'#5a3e10'};return{bg:'#fdf0ee',border:'#b83222',text:'#6a1810'};}
  function barColor(p){if(p>=80)return'#1a6e40';if(p>=65)return'#1a4a70';if(p>=50)return'#a07820';return'#b83222';}

  const FW_KEYS = ['p1_opening','p2_scene','p31_transition','p32_flashback','p4_trigger','p56_climax','p7_resolution','p8_conclusion'];
  const FW_LABELS = {
    p1_opening:   {label:'P1 开头',     en:'Opening'},
    p2_scene:     {label:'P2 场景',     en:'Scene'},
    p31_transition:{label:'P3.1 过渡',  en:'Transition'},
    p32_flashback:{label:'P3.2 插叙',   en:'Flashback'},
    p4_trigger:   {label:'P4 高潮前',   en:'Trigger'},
    p56_climax:   {label:'P5-6 高潮中', en:'Climax'},
    p7_resolution:{label:'P7 高潮后',   en:'Resolution'},
    p8_conclusion:{label:'P8 结尾',     en:'Conclusion'},
  };
  const FW_STATUS = {
    pass:{ bg:'#edfaf3', border:'#1a6e40', color:'#1a6e40', icon:'✓', label:'达标' },
    warn:{ bg:'#fffbe6', border:'#a07820', color:'#a07820', icon:'△', label:'可改善' },
    fail:{ bg:'#fff0ee', border:'#b83222', color:'#b83222', icon:'✗', label:'缺失' },
  };

  function FwCard({fw, fwKey}) {
    if (!fw || !fwKey) return null;
    const info = FW_LABELS[fwKey] || {label: fwKey, en: ''};
    const st = FW_STATUS[fw.status] || FW_STATUS.pass;
    return (
      <div style={{
        background: st.bg, border: '1px solid '+st.border,
        borderLeft: '4px solid '+st.border, borderRadius: '8px',
        padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '5px',
      }}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <span style={{fontWeight:700, fontSize:'.72rem', color:st.color, whiteSpace:'nowrap'}}>{info.label}</span>
          <span style={{fontSize:'.68rem', color:st.color, background:'white', padding:'1px 6px', borderRadius:99, border:'1px solid '+st.border, whiteSpace:'nowrap'}}>{st.icon} {st.label}</span>
        </div>
        <div style={{fontSize:'.78rem', color:'#3d3020', lineHeight:1.6, fontFamily:"'Noto Sans SC',sans-serif", flex:1}}>{fw.comment}</div>
      </div>
    );
  }

  function AnnotatedEssayWithFramework({essay, annotations, framework, rewrites}) {
    const paragraphs = (essay||'').split('\n').filter(function(p){return p.trim().length>0;});

    return (
      <div>
        {paragraphs.map(function(para, pIdx) {
          return (
            <div key={pIdx} style={{marginBottom:'6px'}}>
              <div
                style={{fontFamily:"'Noto Serif SC',serif", fontSize:'.95rem', color:'#3d3020',
                  lineHeight:2.2, background:'#fffef8', padding:'10px 14px',
                  borderRadius:'8px', border:'1px solid #e0d5c0'}}
                dangerouslySetInnerHTML={{__html: annotateEssay(para, annotations, rewrites)}}
              />
            </div>
          );
        })}
      </div>
    );
  }

  function annotateEssay(text, annotations, rewrites) {
    if (!annotations || annotations.length === 0) return text.replace(/\n/g, '<br/>');
    // Build rewrite lookup: original sentence → rewrite suggestion
    const rewriteMap = {};
    (rewrites||[]).forEach(function(r){ if(r.original&&r.rewrite) rewriteMap[r.original]=r.rewrite; });
    const sorted = [...annotations].sort((a,b) => (b.text||'').length - (a.text||'').length);
    // Red takes priority over green/yellow on same text
    const errorTexts = new Set(sorted.filter(function(a){return a.type==='error';}).map(function(a){return a.text;}));
    let result = text;
    sorted.forEach((ann) => {
      if (!ann.text || !result.includes(ann.text)) return;
      if ((ann.type==='good'||ann.type==='improve') && errorTexts.has(ann.text)) return;
      const colors = {
        error: { bg:'#fff0ee', underline:'#b83222', dot:'🔴' },
        good:  { bg:'#edfaf3', underline:'#1a6e40', dot:'🟢' },
        improve: { bg:'#fffbe6', underline:'#a07820', dot:'🟡' }
      };
      const c = colors[ann.type] || colors.good;
      const techLabel = ann.technique ? ` [${ann.technique}]` : '';
      // For improve: show rewrite suggestion in tooltip if available
      var tooltipBase = (ann.comment||'') + techLabel;
      if (ann.type==='improve' && rewriteMap[ann.text]) {
        tooltipBase = '改写：' + rewriteMap[ann.text];
      }
      const tooltip = tooltipBase;
      // Escape HTML special chars to prevent broken attributes or invisible text
      function escAttr(s) { return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
      const safeTooltip = escAttr(tooltip);
      const highlighted = `<span class="ann-mark ann-${ann.type}" style="background:${c.bg};border-bottom:2px solid ${c.underline};border-radius:3px;padding:1px 2px;cursor:pointer;position:relative" title="${safeTooltip}" data-comment="${safeTooltip}">${ann.text}<sup style="font-size:9px;color:${c.underline};margin-left:1px">${c.dot}</sup></span>`;
      var idx0 = result.indexOf(ann.text);
      if (idx0 !== -1) { result = result.slice(0,idx0) + highlighted + result.slice(idx0+ann.text.length); }
    });
    return result.replace(/\n/g, '<br/>');
  }

  function SampleBlock({mode}) {
    const currentGradeIdx = results ? gradeOrder.indexOf(results.grade) : -1;
    const computedStretchGrade = currentGradeIdx >= 0 ? gradeOrder[Math.min(currentGradeIdx+2, gradeOrder.length-1)] : '';
    const isStretch = mode==='stretch';
    if (isStretch && (results?.grade === 'A1' || results?.grade === 'A2')) return null;
    const stateVal = isStretch ? stretchState : sampleState;
    const essayVal = isStretch ? stretchEssay : sampleEssay;
    const tGrade = isStretch ? computedStretchGrade : 'A1/A2';
    const color = isStretch ? '#1a4a70' : '#a07820';
    const desc = isStretch
      ? `根据你目前的 ${results?.grade} 水平，生成一篇 ${tGrade} 水平的范文——比你目前高两个等级。故事内容与你的相同，只提升语言表达，是你下一步的目标。`
      : '根据你的故事内容，生成一篇 A1/A2 水平的示范作文。保留你的故事，全面提升语言表达与 EASI 手法至最高水平。';
    return (
      <div className="card" style={{border:`2px solid ${color}`,marginBottom:14}}>
        <div className="sec-head">
          <div className="sec-icon" style={{background:isStretch?'#eaf2fb':'#fdf6e3'}}>{isStretch?'📈':'⭐'}</div>
          <div>
            <div className="sec-title" style={{color}}>{isStretch?('进阶范文 ('+tGrade+' 水平)'):'示范范文 (A1/A2 水平)'}</div>
            <div className="sec-sub">{isStretch?('2 grades above your current '+(results?.grade||'')):'Highest standard model essay'}</div>
          </div>
        </div>
        <p style={{fontSize:'.86rem',color:'#3d3020',lineHeight:1.7,marginBottom:16}}>{desc}</p>
        {stateVal==='idle'&&<button className="btn-gold" style={{background:color}} onClick={()=>generateSample(mode)}>{isStretch?('📈 生成进阶范文 ('+tGrade+')'):'⭐ 生成示范范文 (A1/A2)'}</button>}
        {stateVal==='loading'&&<div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 0',color:'#8a7a60',fontStyle:'italic',fontSize:'.87rem'}}><div className="dots"><span/><span/><span/></div>生成中，约需 40–60 秒……</div>}
        {stateVal==='error'&&<div><p style={{color:'#b83222',fontSize:'.84rem',marginBottom:10}}>生成时出现错误，请重试。</p><button className="btn-gold" style={{background:color}} onClick={()=>generateSample(mode)}>重试</button></div>}
        {stateVal==='done'&&essayVal&&(
          <div>
            <div style={{fontFamily:'Noto Serif SC,serif',fontSize:'.95rem',fontWeight:600,color,marginBottom:12,paddingBottom:10,borderBottom:'1px solid #e0d5c0'}}>{isStretch?'📈':'⭐'} {isStretch?('进阶范文 — '+tGrade+' 水平'):'示范范文 — A1/A2 水平'}　题目：{title||'（无题目）'}</div>
            <div style={{fontFamily:'Noto Serif SC,serif',fontSize:'.95rem',color:'#3d3020',lineHeight:2.1,whiteSpace:'pre-wrap'}} dangerouslySetInnerHTML={{__html:formatSample(essayVal)}} />
            <div style={{fontSize:'.76rem',color:'#8a7a60',fontStyle:'italic',marginTop:12,paddingTop:10,borderTop:'1px solid #e0d5c0'}}>※ 此范文仅供参考，请勿直接抄写。以此为范例理解写法，再用自己的语言重写。</div>
          </div>
        )}
      </div>
    );
  }

  // NEW: 动作流程 Section Component
  function ActionSequences() {
    const seqs = results?.action_sequences;
    if (!seqs || seqs.length === 0) return null;
    return (
      <div className="card">
        <div className="sec-head">
          <div className="sec-icon" style={{background:'#f5f0ff'}}>🔗</div>
          <div>
            <div className="sec-title">动作流程</div>
            <div className="sec-sub">Action Sequences · 3+ consecutive EASI techniques in a row</div>
          </div>
        </div>
        <p style={{fontSize:'.82rem',color:'#8a7a60',lineHeight:1.6,marginBottom:14}}>
          连续3个或以上的EASI描写手法，形成流畅的描写链——这是Band 1与Band 2的关键差别。
        </p>
        {seqs.map((s,i) => (
          <div key={i} style={{padding:'12px 14px',borderRadius:8,borderLeft:'3px solid #6b4c9a',background:'#f5f0ff',marginBottom:8}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.78rem',fontWeight:600,color:'#6b4c9a',marginBottom:4,letterSpacing:'.05em'}}>{s.pattern}</div>
            <div style={{fontFamily:"'Noto Serif SC',serif",fontSize:'.9rem',color:'#3d3020',lineHeight:1.9,marginBottom:4}}>{s.text}</div>
            <div style={{fontSize:'.78rem',color:'#5a4a80',fontStyle:'italic'}}>{s.comment}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>林老师双语学堂 · 记叙文批改</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;400;600;700&family=Noto+Sans+SC:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}body{background:#f8f5ef;color:#1c1710;font-family:'Noto Sans SC',sans-serif;min-height:100vh}.topbar{background:#1c1710;padding:0 32px;height:54px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}.logo{font-family:'Noto Serif SC',serif;font-size:1rem;font-weight:700;color:#e8d090}.topbar-mid{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.18em;color:#7a6a50;text-transform:uppercase}.chip{font-family:'DM Mono',monospace;font-size:9px;padding:3px 10px;border-radius:99px;border:1px solid rgba(160,120,32,.4);color:#c8a050;background:rgba(160,120,32,.1)}.page{max-width:860px;margin:0 auto;padding:44px 20px 60px}.hero{text-align:center;margin-bottom:36px}.hero-eye{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#a07820;margin-bottom:10px}.hero h1{font-family:'Noto Serif SC',serif;font-size:clamp(1.8rem,4.5vw,2.6rem);font-weight:700;margin-bottom:8px}.hero h1 em{color:#a07820;font-style:normal}.hero-sub{font-size:.88rem;color:#8a7a60}.hero-rubric span+span::before{content:'· ';color:#8a7a60}.card{background:#fff;border:1px solid #e0d5c0;border-radius:10px;padding:24px 26px;box-shadow:0 2px 14px rgba(0,0,0,.06);margin-bottom:14px}.card-label{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#8a7a60;margin-bottom:5px;display:flex;align-items:center;gap:8px}.lnum{width:20px;height:20px;border-radius:50%;background:#1c1710;color:#e8d090;display:inline-flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0}.card-hint{font-size:.8rem;color:#8a7a60;margin-bottom:12px}input[type=text]{width:100%;background:#f2ede3;border:1px solid #e0d5c0;border-radius:8px;padding:11px 14px;font-family:'Noto Sans SC',sans-serif;font-size:.95rem;color:#1c1710;outline:none;margin-bottom:18px;transition:border-color .2s}input[type=text]:focus{border-color:#a07820}input::placeholder{color:#8a7a60;font-style:italic}textarea{width:100%;background:#f2ede3;border:1px solid #e0d5c0;border-radius:8px;padding:14px;font-family:'Noto Serif SC',serif;font-size:.97rem;color:#1c1710;outline:none;resize:vertical;min-height:280px;line-height:2;transition:border-color .2s}textarea:focus{border-color:#a07820}textarea::placeholder{color:#8a7a60;font-style:italic;font-family:'Noto Sans SC',sans-serif;font-size:.88rem}.row{display:flex;justify-content:space-between;align-items:center;margin-top:10px}.wc{font-family:'DM Mono',monospace;font-size:11px;color:#8a7a60}.wc.ok{color:#1a6e40}.wc.low{color:#b83222}.btn-main{font-family:'Noto Sans SC',sans-serif;font-size:.88rem;font-weight:500;padding:11px 28px;border-radius:8px;border:none;background:#1c1710;color:#e8d090;cursor:pointer;transition:all .15s}.btn-main:hover{background:#332a18}.btn-main:disabled{background:#8a7a60;cursor:not-allowed}.btn-gold{font-family:'Noto Sans SC',sans-serif;font-size:.9rem;font-weight:500;padding:12px 24px;border-radius:8px;border:none;color:#fff;cursor:pointer;transition:all .15s;width:100%}.btn-gold:hover{filter:brightness(1.12)}.btn-ghost{font-family:'Noto Sans SC',sans-serif;font-size:.82rem;padding:9px 22px;border-radius:8px;border:1px solid #c8b99a;background:transparent;color:#8a7a60;cursor:pointer;transition:all .15s}.btn-ghost:hover{color:#1c1710;border-color:#3d3020}.btn-pdf{font-family:'Noto Sans SC',sans-serif;font-size:.82rem;padding:9px 22px;border-radius:8px;border:1px solid #1a4a70;background:transparent;color:#1a4a70;cursor:pointer;transition:all .15s}.btn-pdf:hover{background:#1a4a70;color:#fff}.error{color:#b83222;font-size:.85rem;margin-top:8px}.loading-wrap{text-align:center;padding:60px 20px}.loading-char{font-family:'Noto Serif SC',serif;font-size:2rem;letter-spacing:.2em;color:#a07820;animation:breathe 2s ease-in-out infinite;margin-bottom:14px}.loading-msg{font-size:.88rem;color:#8a7a60;font-style:italic;margin-bottom:20px}.loading-steps{display:flex;justify-content:center;gap:16px;flex-wrap:wrap}.lstep{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#a07820}.grade-banner{background:#1c1710;border-radius:10px;padding:22px 26px;display:flex;align-items:center;gap:22px;margin-bottom:14px;position:relative;overflow:hidden}.grade-banner::after{content:'记';position:absolute;right:18px;top:50%;transform:translateY(-50%);font-family:'Noto Serif SC',serif;font-size:7rem;font-weight:700;color:rgba(255,255,255,.04);pointer-events:none}.grade-ring{width:72px;height:72px;border-radius:50%;border:2px solid rgba(255,255,255,.12);display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0}.grade-letter{font-family:'Noto Serif SC',serif;font-size:1.8rem;font-weight:700;color:#e8d090;line-height:1}.grade-pts{font-family:'DM Mono',monospace;font-size:10px;color:rgba(232,208,144,.5);margin-top:2px}.grade-name{font-family:'Noto Serif SC',serif;font-size:1.1rem;color:#e8d090;font-weight:600;margin-bottom:4px}.grade-desc{font-size:.82rem;color:rgba(232,208,144,.6);margin-bottom:8px}.score-pills{display:flex;gap:8px;flex-wrap:wrap}.spill{font-family:'DM Mono',monospace;font-size:10px;padding:3px 10px;border-radius:99px;border:1px solid rgba(255,255,255,.1);color:rgba(232,208,144,.65)}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}@media(max-width:600px){.grid2{grid-template-columns:1fr}.grade-banner{flex-direction:column;text-align:center}}.sec-head{display:flex;align-items:center;gap:10px;padding-bottom:12px;margin-bottom:14px;border-bottom:1px solid #e0d5c0}.sec-icon{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.95rem;flex-shrink:0}.sec-title{font-family:'Noto Serif SC',serif;font-size:.9rem;font-weight:600}.sec-sub{font-family:'DM Mono',monospace;font-size:9px;color:#8a7a60;letter-spacing:.1em;text-transform:uppercase;margin-top:1px}.bar-wrap{margin-bottom:11px}.bar-top{display:flex;justify-content:space-between;font-size:.78rem;color:#8a7a60;margin-bottom:5px}.bar-top strong{color:#3d3020}.bar-track{height:7px;background:#f2ede3;border-radius:99px;overflow:hidden;border:1px solid #e0d5c0}.bar-fill{height:100%;border-radius:99px;transition:width 1s cubic-bezier(.4,0,.2,1)}.fw-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}@media(max-width:500px){.fw-grid{grid-template-columns:1fr}}.fw-item{display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border-radius:8px;font-size:.82rem;line-height:1.5;border-left:3px solid}.fw-icon{flex-shrink:0;font-weight:700;margin-top:1px}.fw-lbl{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;opacity:.6;margin-bottom:2px}.easi-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start}@media(max-width:500px){.easi-grid{grid-template-columns:1fr}}.easi-item{padding:14px;border-radius:8px;border:1px solid;width:100%}.easi-header{display:flex;align-items:center;gap:10px;margin-bottom:8px}.easi-letter{font-family:'Noto Serif SC',serif;font-size:1.4rem;font-weight:700}.easi-name{font-size:.78rem;font-weight:600;color:#3d3020}.easi-en{font-size:.7rem;color:#8a7a60}.easi-score{font-family:'DM Mono',monospace;font-size:10px;padding:2px 8px;border-radius:99px;background:rgba(0,0,0,.06);display:inline-block;margin-bottom:6px}.easi-comment{font-size:.78rem;color:#555;line-height:1.5;margin-bottom:8px}.easi-extracted{padding:8px 10px;background:rgba(0,0,0,.04);border-radius:6px;border-left:2px solid}.easi-extracted-lbl{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;opacity:.5;margin-bottom:3px}.easi-extracted-text{font-family:'Noto Serif SC',serif;font-size:.82rem;color:#3d3020;line-height:1.7}.err-list{list-style:none;display:flex;flex-direction:column;gap:8px}.err-item{padding:10px 13px;border-radius:8px;font-size:.82rem;line-height:1.7;border-left:3px solid;background:#fdf0ee;border-color:#b83222;color:#6a1810}.err-lbl{font-family:'DM Mono',monospace;font-size:8px;letter-spacing:.14em;text-transform:uppercase;opacity:.6;margin-bottom:3px}.err-orig{font-family:'Noto Serif SC',serif;margin-bottom:2px}.err-fix{font-family:'Noto Serif SC',serif;color:#1a6e40}.err-reason{font-size:.75rem;opacity:.8;margin-top:2px}.sug-list{list-style:none;display:flex;flex-direction:column;gap:8px}.sug-item{display:flex;gap:10px;padding:10px 12px;border-radius:8px;background:#edf7f1;border-left:3px solid #1a6e40;font-size:.83rem;color:#154d2e;line-height:1.6}.examiner-box{background:#f2ede3;border:1px solid #c8b99a;border-radius:10px;padding:20px 24px;position:relative}.examiner-box::before{content:'"';position:absolute;top:5px;left:12px;font-family:'Noto Serif SC',serif;font-size:2.8rem;color:#c8b99a;line-height:1}.examiner-text{font-family:'Noto Serif SC',serif;font-size:.93rem;color:#3d3020;line-height:1.95;padding-top:14px}.examiner-sig{margin-top:12px;font-family:'DM Mono',monospace;font-size:9px;color:#8a7a60;letter-spacing:.12em;text-align:right}.center-row{display:flex;justify-content:center;gap:12px;margin-top:24px;flex-wrap:wrap}.dots span{display:inline-block;width:5px;height:5px;background:#a07820;border-radius:50%;animation:pulse 1.2s ease-in-out infinite;margin:0 2px}.dots span:nth-child(2){animation-delay:.2s}.dots span:nth-child(3){animation-delay:.4s}@keyframes breathe{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.05)}}@keyframes pulse{0%,80%,100%{transform:scale(.6);opacity:.3}40%{transform:scale(1);opacity:1}}@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}.fade{animation:fadeUp .5s ease both}.ann-mark{transition:all .15s}.ann-mark:hover{filter:brightness(.95)}@media(max-width:600px){.topbar{height:auto;padding:8px 16px;flex-wrap:wrap;gap:4px}.topbar .logo{font-size:.9rem;width:100%;text-align:center}.topbar .topbar-mid{width:100%;text-align:center;font-size:9px}.topbar .chip{font-size:8px;padding:2px 8px;width:100%;text-align:center;border:none}.hero-eye{font-size:9px;letter-spacing:.15em}.hero-sub{font-size:.8rem}.hero-rubric span{display:block}.hero-rubric span+span::before{content:none}.card-hint .hint-en,.card-hint .hint-zh{display:block}.card-label{font-size:9px}}`}</style>

      <div className="topbar">
        <div className="logo">林老师双语学堂</div>
        <div className="topbar-mid">记叙文批改 · O Level 1160</div>
        <div className="chip">Leon Lim 林纯隆老师</div>
      </div>

      <div className="page">
        <div className="hero fade">
          <div className="hero-eye">Teacher Leon&apos;s Bilingual Academy · 专属批改工具</div>
          <h1>记叙文<em>智能批改</em></h1>
          <div className="hero-sub">Narrative Composition Marker · 记叙文智能批改</div>
          <div className="hero-rubric" style={{fontSize:'.82rem',color:'#8a7a60',marginTop:6}}><span>Based on SEAB 1160 Rubric</span> <span>Teacher Leon&apos;s Framework</span> <span>依据 SEAB 1160 评分指引</span> <span>结合林老师记叙文框架</span></div>
        </div>

        {state==='input'&&(<div className="fade"><div className="card">
          <div className="card-label"><span className="lnum">1</span> 作文题目 <span style={{fontWeight:400,opacity:.7,marginLeft:4}}>Essay Title</span></div>
          <div className="card-hint"><span className="hint-zh">填写题目有助于评估内容切题程度（可选）</span><span className="hint-en">Helps assess relevance (optional)</span></div>
          <input type="text" value={title} onChange={e=>setTitle(e.target.value)} placeholder="例：那一次，我学会了坚持… / e.g. The time I learned to persevere…" />
          <div className="card-label"><span className="lnum">2</span> 粘贴你的记叙文 <span style={{fontWeight:400,opacity:.7,marginLeft:4}}>Paste Your Essay</span></div>
          <div className="card-hint"><span className="hint-zh">O Level 建议字数：350–500字</span><span className="hint-en">Recommended length: 350–500 characters</span></div>
          <div style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 14px',background:'#f2ede3',borderRadius:8,border:'1px solid #e0d5c0',marginBottom:12,fontSize:'.82rem',color:'#5a4a30',lineHeight:1.6}}>
            <span style={{fontSize:'1rem',flexShrink:0}}>📷</span>
            <span>
              <strong>Got a handwritten essay? 有手写作文？</strong><br/>
              Use <a href="https://lens.google.com" target="_blank" rel="noopener noreferrer" style={{color:'#a07820',fontWeight:600,textDecoration:'underline'}}>Google Lens</a> to scan and extract the text, then paste it here.<br/>
              <span style={{opacity:.8}}>用 Google Lens 拍照识字，再把文字复制粘贴到上方。</span>
            </span>
          </div>
          <textarea value={essay} onChange={e=>setEssay(e.target.value)} placeholder="在此粘贴你的记叙文… Paste your essay here…" />
          <div className="row">
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <span className={`wc ${wordCount>=350?'ok':wordCount>100?'':'low'}`}>{wordCount} 字</span>
              {wordCount>0&&wordCount<200&&<span style={{fontSize:'.72rem',color:'#b83222'}}>⚠️ 字数偏少，建议至少350字 · Too short, aim for 350+</span>}
              {wordCount>=200&&wordCount<350&&<span style={{fontSize:'.72rem',color:'#a07820'}}>△ 字数稍少，建议350字以上 · A little short</span>}
              {wordCount>=350&&wordCount<=500&&<span style={{fontSize:'.72rem',color:'#1a6e40'}}>✓ 字数合适 · Good length</span>}
              {wordCount>500&&<span style={{fontSize:'.72rem',color:'#1a6e40'}}>✓ 字数充足 · Sufficient length</span>}
            </div>
            <button className="btn-main" onClick={markEssay} disabled={wordCount<80}>开始批改 · Mark My Essay →</button>
          </div>
          {error&&<div className="error">{error}</div>}
        </div>
        {/* localStorage history */}
        {history.length > 0 && (
        <div className="card" style={{marginTop:14}}>
          <div className="sec-head"><div className="sec-icon" style={{background:'#eaf2fb'}}>📜</div><div><div className="sec-title">批改记录</div><div className="sec-sub">Past Submissions · Saved on this device</div></div></div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {history.map(function(h){
              const gc = h.grade&&h.grade.startsWith('A')?'#1a6e40':h.grade&&h.grade.startsWith('B')?'#1a4a70':h.grade&&(h.grade.startsWith('C')||h.grade.startsWith('D'))?'#a07820':'#b83222';
              return(
                <div key={h.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'#f8f8f8',borderRadius:8,border:'1px solid #e8e8e8'}}>
                  <div style={{width:40,height:40,borderRadius:'50%',background:gc,color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'.9rem',flexShrink:0}}>{h.grade}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:"'Noto Serif SC',serif",fontSize:'.85rem',color:'#1c1710',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{h.title}</div>
                    <div style={{fontSize:'.75rem',color:'#888',marginTop:1}}>{h.date} · {h.total}/40 · 内容 {h.content} 语文 {h.language}</div>
                  </div>
                </div>
              );
            })}
            <button onClick={function(){try{localStorage.removeItem('leon_history');}catch(e){}setHistory([]);}} style={{fontSize:'.75rem',color:'#b83222',background:'none',border:'none',cursor:'pointer',alignSelf:'flex-start',padding:'4px 0',opacity:.7}}>清除记录 Clear history</button>
          </div>
        </div>
        )}
        </div>)}

        {state==='loading'&&(<div className="card fade"><div className="loading-wrap">
          <div className="loading-char">批改中…</div>
          <div className="loading-msg">Marking your essay · 正在批改，约需 40–60 秒… (40–60 seconds)</div>
          <div className="loading-steps">{['检查框架结构','评估内容层次','分析语文结构','EASI手法评估','撰写考官评语'].map((s,i)=><span key={i} className="lstep">{s}</span>)}</div>
        </div></div>)}

        {state==='results'&&results&&(<div className="fade">
          <div style={{background:'#eaf2fb',borderRadius:8,border:'1px solid #bee0f5',marginBottom:14,padding:'12px 16px',fontSize:'.82rem',color:'#1a4a70',lineHeight:1.7}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}><span>🌐</span><strong style={{fontSize:'.85rem'}}>Need an English translation of this report?</strong></div>
            <div style={{paddingLeft:24}}>
              <div>Your browser can translate this entire page for free in seconds:</div>
              <div style={{marginTop:6,display:'flex',flexDirection:'column',gap:3}}>
                <span><strong>Chrome (Desktop):</strong> Right-click anywhere on the page → <em>Translate to English</em></span>
                <span><strong>Chrome (Mobile):</strong> Tap the translate icon <strong>⊕</strong> that appears in the address bar</span>
                <span><strong>Safari (iPhone/iPad):</strong> Tap the <strong>AA</strong> button in the address bar → <em>Translate to English</em></span>
                <span><strong>Edge:</strong> Click the translate icon in the address bar → select <em>English</em></span>
              </div>
            </div>
          </div>
          <div className="card" style={{marginBottom:14}}>
            <div className="sec-head"><div className="sec-icon" style={{background:'#fffef8'}}>📝</div><div><div className="sec-title">学生原文（批注版）</div><div className="sec-sub">Annotated Student Essay</div></div></div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
              <span style={{fontSize:'.75rem',padding:'3px 10px',borderRadius:99,background:'#edf7f1',color:'#1a6e40',border:'1px solid #1a6e40'}}>🟢 优点</span>
              <span style={{fontSize:'.75rem',padding:'3px 10px',borderRadius:99,background:'#fdf0ee',color:'#b83222',border:'1px solid #b83222'}}>🔴 错误</span>
              <span style={{fontSize:'.75rem',padding:'3px 10px',borderRadius:99,background:'#fdf6e3',color:'#a07820',border:'1px solid #a07820'}}>🟡 可改善</span>
            </div>
            <AnnotatedEssayWithFramework essay={essay} annotations={results?.annotations||[]} framework={results?.framework||{}} rewrites={results?.rewrite_examples||[]} />
            <div style={{fontSize:'.78rem',color:'#8a7a60',marginTop:10,fontStyle:'italic'}}>
              悬停或点击高亮文字查看批注 · Hover over highlights to see comments
            </div>
          </div>
          <div className="grade-banner">
            <div className="grade-ring"><div className="grade-letter">{results.grade}</div><div className="grade-pts">{results.total_score}/40</div></div>
            <div>
              <div className="grade-name">{results.grade_label} · 等级 {results.grade}</div>
              <div className="grade-desc">SEAB 1160 华文（普通水准）写作 · 记叙文</div>
              <div className="score-pills"><span className="spill">内容 {results.content_score}/20（第{results.content_band}级）</span><span className="spill">语文与结构 {results.language_score}/20（第{results.language_band}级）</span></div>
            </div>
          </div>

          <div className="grid2">
            <div className="card">
              <div className="sec-head"><div className="sec-icon" style={{background:'#edf7f1'}}>📊</div><div><div className="sec-title">分项得分</div><div className="sec-sub">Score Breakdown</div></div></div>
              {[{label:'内容 Content',score:results.content_score,max:20},{label:'语文与结构',score:results.language_score,max:20},{label:'总分 Total',score:results.total_score,max:40}].map(b=>{const pct=Math.round((b.score/b.max)*100);return <div key={b.label} className="bar-wrap"><div className="bar-top"><span>{b.label}</span><strong>{b.score}/{b.max}</strong></div><div className="bar-track"><div className="bar-fill" style={{width:pct+'%',background:barColor(pct)}} /></div></div>;})}
            </div>
            <div className="card">
              <div className="sec-head"><div className="sec-icon" style={{background:'#fdf6e3'}}>📝</div><div><div className="sec-title">内容与语文评析</div><div className="sec-sub">Content & Language</div></div></div>
              <p style={{fontSize:'.87rem',color:'#3d3020',lineHeight:1.8,marginBottom:12}}>{results.content_feedback}</p>
              <p style={{fontSize:'.87rem',color:'#3d3020',lineHeight:1.8}}>{results.language_feedback}</p>
            </div>
          </div>

          {/* Framework Section - standalone */}
          <div className="card">
            <div className="sec-head"><div className="sec-icon" style={{background:'#edf7f1'}}>🗂</div><div><div className="sec-title">林老师框架检查</div><div className="sec-sub">Narrative Framework</div></div></div>
            <div className="fw-grid">
              {FW_KEYS.filter(function(k){return !!(results.framework||{})[k];}).map(function(k){
                const fw = results.framework[k];
                const st = FW_STATUS[fw.status] || FW_STATUS.pass;
                return (<FwCard key={k} fw={fw} fwKey={k} />);
              })}
            </div>
          </div>

          <div className="card">
            <div className="sec-head"><div className="sec-icon" style={{background:'#eaf2fb'}}>✍️</div><div><div className="sec-title">EASI 人物描写手法</div><div className="sec-sub">E = Expressions & Appearance &nbsp;·&nbsp; A = Actions &nbsp;·&nbsp; S = Speech &nbsp;·&nbsp; I = Inner Thoughts & Feelings</div></div></div>
            {/* CHANGED: Use shared dedup function */}
            <div className="easi-grid">{(function(){
            return easiItems.map(e=>{
            const item=results.easi?.[e.k]||{rating:'ok',score_label:'',comment:''};
            const c=easiColor(item.rating);
            const extracted = (item.extracted && item.extracted.length>0) ? item.extracted : ['未发现相关描写'];
            return(<div key={e.k} className="easi-item" style={{background:c.bg,borderColor:c.border}}>
              <div className="easi-header"><div className="easi-letter" style={{color:c.border}}>{e.k}</div><div><div className="easi-name">{e.name}</div><div className="easi-en">{e.en}</div></div></div>
              <div className="easi-score" style={{color:c.border}}>{item.score_label}</div>
              <div className="easi-comment">{item.comment}</div>
              <div className="easi-extracted" style={{borderColor:c.border}}>
                <div className="easi-extracted-lbl">学生原文摘录 · Student&apos;s Writing</div>
                {extracted[0]==='未发现相关描写'
                  ?<div className="easi-extracted-text" style={{color:'#999',fontStyle:'italic'}}>未发现相关描写</div>
                  :<ul style={{listStyle:'none',padding:0,margin:0,display:'flex',flexDirection:'column',gap:'6px'}}>{extracted.map((ex,xi)=>(<li key={xi} style={{display:'flex',gap:'8px',alignItems:'flex-start'}}><span style={{color:c.border,flexShrink:0,fontWeight:700,fontSize:'.85rem',marginTop:'1px'}}>·</span><span className="easi-extracted-text" style={{flex:1}}>{ex}</span></li>))}</ul>
                }
              </div>
            </div>);
          });})()}</div>
          </div>

          {/* NEW: 动作流程 section */}
          <ActionSequences />

          <div className="card">
            <div className="sec-head"><div className="sec-icon" style={{background:'#fdf0ee'}}>🔍</div><div><div className="sec-title">语文错误（全部）</div><div className="sec-sub">All Language Errors</div></div></div>
            <ul className="err-list">{results.language_errors?.length?results.language_errors.map((e,i)=>(<li key={i} className="err-item"><div className="err-lbl">{e.label}</div><div className="err-orig">原文：{e.original}</div><div className="err-fix">改正：{e.correction}</div>{e.reason&&<div className="err-reason">{e.reason}</div>}</li>)):<li style={{fontSize:'.84rem',color:'#1a6e40',fontStyle:'italic',padding:'4px 0'}}>语言运用良好，未发现明显错误。✓</li>}</ul>
          </div>

          <div className="grid2">
            <div className="card">
              <div className="sec-head"><div className="sec-icon" style={{background:'#eaf2fb'}}>🏗</div><div><div className="sec-title">结构与表达</div><div className="sec-sub">Structure & Style</div></div></div>
              <ul className="err-list">{results.structure_notes?.length?results.structure_notes.map((e,i)=><li key={i} className="err-item" style={{background:'#eaf2fb',borderColor:'#1a4a70',color:'#0d2d44'}}><div className="err-lbl">{e.label}</div>{e.text}</li>):<li style={{fontSize:'.84rem',color:'#1a6e40',fontStyle:'italic',padding:'4px 0'}}>结构整体良好。✓</li>}</ul>
            </div>
            <div className="card">
              <div className="sec-head"><div className="sec-icon" style={{background:'#edf7f1'}}>🌱</div><div><div className="sec-title">改进建议</div><div className="sec-sub">How to Improve</div></div></div>
              <ul className="sug-list">{results.improvements?.map((imp,i)=><li key={i} className="sug-item"><span style={{color:'#1a6e40',flexShrink:0}}>✦</span><span>{imp}</span></li>)}</ul>
            </div>
          </div>

          <div className="card">
            <div className="sec-head"><div className="sec-icon" style={{background:'#f2ede3'}}>📋</div><div><div className="sec-title">老师总评</div><div className="sec-sub">Teacher Leon&apos;s Comment</div></div></div>
            <div className="examiner-box"><div className="examiner-text">{results.examiner_comment}</div><div className="examiner-sig">— 林纯隆老师 · 林老师双语学堂 · O Level 1160 考官</div></div>
          </div>

          {/* ── 改写示范 ── */}
          {results.rewrite_examples && results.rewrite_examples.length > 0 && (
          <div className="card">
            <div className="sec-head"><div className="sec-icon" style={{background:'#fff3e0'}}>✏️</div><div><div className="sec-title">改写示范</div><div className="sec-sub">Sentence Rewrites · Grammar & Structure Fixed</div></div></div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.84rem'}}>
                <thead><tr style={{background:'#f5f5f5'}}>
                  <th style={{textAlign:'left',padding:'8px 12px',fontWeight:600,color:'#555',borderBottom:'2px solid #e0e0e0',width:'35%'}}>原句</th>
                  <th style={{textAlign:'left',padding:'8px 12px',fontWeight:600,color:'#555',borderBottom:'2px solid #e0e0e0',width:'40%'}}>改写后</th>
                  <th style={{textAlign:'left',padding:'8px 12px',fontWeight:600,color:'#555',borderBottom:'2px solid #e0e0e0',width:'25%'}}>改写要点</th>
                </tr></thead>
                <tbody>{results.rewrite_examples.map(function(r,i){return(
                  <tr key={i} style={{borderBottom:'1px solid #f0f0f0'}}>
                    <td style={{padding:'10px 12px',color:'#c0392b',verticalAlign:'top',fontFamily:"'Noto Serif SC',serif"}}>{r.original}</td>
                    <td style={{padding:'10px 12px',color:'#1a6e40',verticalAlign:'top',fontWeight:500,fontFamily:"'Noto Serif SC',serif"}}>{r.rewrite}</td>
                    <td style={{padding:'10px 12px',color:'#555',verticalAlign:'top',fontSize:'.8rem'}}>{r.note}</td>
                  </tr>
                );})}</tbody>
              </table>
            </div>
          </div>
          )}

          {/* ── Disclaimer ── */}
          <div style={{background:'#f9f9f9',border:'1px solid #e5e5e5',borderRadius:10,padding:'10px 16px',marginBottom:8,fontSize:'.74rem',color:'#999',lineHeight:1.6,textAlign:'center'}}>
            本报告由 AI 生成，仅供学习参考，不代表正式考试结果。评分及反馈以教师最终判断为准。<br/>
            This report is AI-generated for learning purposes only and does not represent official exam results.
          </div>

          <SampleBlock mode="standard" />
          <SampleBlock mode="stretch" />

          {/* ── Resubmit & Compare ── */}
          <div className="card">
            <div className="sec-head"><div className="sec-icon" style={{background:'#eaf2fb'}}>🔄</div><div><div className="sec-title">重新批改修改版</div><div className="sec-sub">Resubmit Revised Essay · Compare with Original</div></div></div>
            {revisedState !== 'done' && (
              <div>
                <p style={{fontSize:'.84rem',color:'#555',marginBottom:12,lineHeight:1.6}}>根据反馈修改后，把修改版粘贴到下方，系统会重新批改并与第一稿对比。</p>
                <textarea value={revisedEssay} onChange={function(e){setRevisedEssay(e.target.value);}} placeholder="在此粘贴修改后的作文…" style={{width:'100%',background:'#f2ede3',border:'1px solid #e0d5c0',borderRadius:8,padding:14,fontFamily:"'Noto Serif SC',serif",fontSize:'.95rem',color:'#1c1710',outline:'none',resize:'vertical',minHeight:200,lineHeight:2}} />
                <div style={{marginTop:10,display:'flex',justifyContent:'flex-end'}}>
                  {revisedState==='loading'
                    ? <div style={{display:'flex',alignItems:'center',gap:10,color:'#8a7a60',fontSize:'.84rem',fontStyle:'italic'}}><div className="dots"><span/><span/><span/></div>批改中…</div>
                    : <button className="btn-main" onClick={markRevised} disabled={revisedEssay.replace(/\s/g,'').length<80}>批改修改版 →</button>
                  }
                </div>
              </div>
            )}
            {revisedState === 'done' && revisedResults && (
              <div>
                <div style={{display:'flex',gap:8,marginBottom:16,background:'#f5f5f5',borderRadius:8,padding:4}}>
                  <button onClick={function(){setViewMode('first');}} style={{flex:1,padding:'8px 0',borderRadius:6,border:'none',background:viewMode==='first'?'white':'transparent',fontWeight:viewMode==='first'?700:400,color:viewMode==='first'?'#1c1710':'#8a7a60',cursor:'pointer',fontSize:'.85rem',boxShadow:viewMode==='first'?'0 1px 4px rgba(0,0,0,.12)':'none',transition:'all .15s'}}>第一稿 {results.grade} {results.total_score}/40</button>
                  <button onClick={function(){setViewMode('revised');}} style={{flex:1,padding:'8px 0',borderRadius:6,border:'none',background:viewMode==='revised'?'white':'transparent',fontWeight:viewMode==='revised'?700:400,color:viewMode==='revised'?'#1c1710':'#8a7a60',cursor:'pointer',fontSize:'.85rem',boxShadow:viewMode==='revised'?'0 1px 4px rgba(0,0,0,.12)':'none',transition:'all .15s'}}>修改版 {revisedResults.grade} {revisedResults.total_score}/40</button>
                </div>
                {(function(){
                  const r = viewMode==='revised' ? revisedResults : results;
                  const scoreDelta = revisedResults.total_score - results.total_score;
                  return (
                    <div>
                      {viewMode==='revised' && (
                        <div style={{padding:'10px 14px',borderRadius:8,marginBottom:12,background:scoreDelta>0?'#edf7f1':scoreDelta<0?'#fdf0ee':'#f5f5f5',border:'1px solid '+(scoreDelta>0?'#1a6e40':scoreDelta<0?'#b83222':'#ddd'),fontSize:'.84rem',color:scoreDelta>0?'#1a6e40':scoreDelta<0?'#b83222':'#555'}}>
                          {scoreDelta>0?'✅ 提升了 '+scoreDelta+' 分！从 '+results.grade+' ('+results.total_score+'/40) 进步到 '+revisedResults.grade+' ('+revisedResults.total_score+'/40)':scoreDelta<0?'⚠️ 分数下降了 '+Math.abs(scoreDelta)+' 分，检查是否引入了新的错误':'✔️ 分数持平 — 语言表达或结构可能有细微改善'}
                        </div>
                      )}
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                        <div style={{background:'#f8f8f8',borderRadius:8,padding:'12px 14px',textAlign:'center',border:'1px solid #e0e0e0'}}>
                          <div style={{fontSize:'.75rem',color:'#888',marginBottom:4}}>内容 Content</div>
                          <div style={{fontSize:'1.4rem',fontWeight:700,color:'#1a4a70'}}>{r.content_score}/20</div>
                        </div>
                        <div style={{background:'#f8f8f8',borderRadius:8,padding:'12px 14px',textAlign:'center',border:'1px solid #e0e0e0'}}>
                          <div style={{fontSize:'.75rem',color:'#888',marginBottom:4}}>语文 Language</div>
                          <div style={{fontSize:'1.4rem',fontWeight:700,color:'#1a4a70'}}>{r.language_score}/20</div>
                        </div>
                      </div>
                      <div style={{fontFamily:"'Noto Serif SC',serif",fontSize:'.88rem',color:'#3d3020',lineHeight:1.8,background:'#fffef8',padding:'12px 14px',borderRadius:8,border:'1px solid #e0d5c0'}}>{r.examiner_comment}</div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* ── Chatbot ── */}
          <div className="card">
            <div className="sec-head"><div className="sec-icon" style={{background:'#e8f5e9'}}>💬</div><div><div className="sec-title">有疑问？问林老师助手</div><div className="sec-sub">Ask about your feedback · Bilingual · Context-aware</div></div></div>
            <p style={{fontSize:'.82rem',color:'#666',marginBottom:12,lineHeight:1.6}}>对批改结果有任何疑问？助手了解你的作文和所有反馈，可以用中文或英文回答。</p>
            <div style={{background:'#f8f9fa',borderRadius:8,border:'1px solid #e0e0e0',maxHeight:320,overflowY:'auto',marginBottom:10,padding:'8px 0'}}>
              {chatMessages.length===0
                ? <p style={{textAlign:'center',color:'#999',fontSize:'.82rem',padding:'24px 0',fontStyle:'italic'}}>还没有问题。Ask anything about your results!</p>
                : chatMessages.map(function(m,i){return(
                    <div key={i} style={{padding:'8px 14px',display:'flex',flexDirection:'column',alignItems:m.role==='user'?'flex-end':'flex-start'}}>
                      <div style={{maxWidth:'85%',background:m.role==='user'?'#1c1710':'white',color:m.role==='user'?'#e8d090':'#1c1710',padding:'10px 14px',borderRadius:m.role==='user'?'14px 14px 4px 14px':'14px 14px 14px 4px',fontSize:'.84rem',lineHeight:1.7,border:m.role==='user'?'none':'1px solid #e0e0e0',whiteSpace:'pre-wrap'}}>{m.content}</div>
                    </div>
                  );})}
              {chatLoading&&<div style={{padding:'8px 14px'}}><div style={{background:'white',border:'1px solid #e0e0e0',borderRadius:'14px 14px 14px 4px',padding:'10px 14px',display:'inline-flex',gap:4}}><div className="dots"><span/><span/><span/></div></div></div>}
            </div>
            <div style={{display:'flex',gap:8}}>
              <input type="text" value={chatInput} onChange={function(e){setChatInput(e.target.value);}} onKeyDown={function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat();}}} placeholder="问一个关于你的批改结果的问题… Ask a question about your feedback…" style={{flex:1,background:'#f2ede3',border:'1px solid #e0d5c0',borderRadius:8,padding:'10px 14px',fontFamily:"'Noto Sans SC',sans-serif",fontSize:'.88rem',color:'#1c1710',outline:'none'}} />
              <button onClick={sendChat} disabled={!chatInput.trim()||chatLoading} style={{background:'#1c1710',color:'#e8d090',border:'none',borderRadius:8,padding:'10px 18px',fontSize:'.82rem',fontWeight:600,cursor:'pointer',flexShrink:0,opacity:(!chatInput.trim()||chatLoading)?0.5:1}}>发送</button>
            </div>
          </div>

          <div style={{background:'#1a1a2e',borderRadius:16,padding:'28px 24px',marginBottom:14,border:'1px solid rgba(26,154,173,0.3)'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
              <span style={{fontSize:'1.1rem'}}>👨‍🏫</span>
              <div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1rem',fontWeight:700,color:'white',lineHeight:1.3}}>Found this useful? Learn directly with Teacher Leon.</div>
                <div style={{fontSize:'.78rem',color:'rgba(255,255,255,0.5)',marginTop:2}}>BA (Hons) Chinese Studies, NTU · PGDE, NIE · 17 years teaching · 10 years O-Level marker</div>
              </div>
            </div>
            <div style={{fontSize:'.82rem',color:'rgba(255,255,255,0.65)',lineHeight:1.7,marginBottom:14}}>This tool reflects how Leon teaches — structured, strategic, examiner-informed. If your child would benefit from that approach 1-to-1, a trial lesson is the best way to find out.</div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              <a href="https://wa.me/6592286725?text=Hi%20Leon%2C%20I%20used%20your%20composition%20marking%20tool%20and%20would%20like%20to%20find%20out%20more%20about%20trial%20lessons." target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',alignItems:'center',gap:8,background:'#25D366',color:'white',padding:'10px 18px',borderRadius:10,fontSize:'.82rem',fontWeight:600,textDecoration:'none'}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                WhatsApp for a Trial
              </a>
              <a href="/about.html" target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.8)',padding:'10px 18px',borderRadius:10,fontSize:'.82rem',fontWeight:500,textDecoration:'none',border:'1px solid rgba(255,255,255,0.15)'}}>
                Learn more →
              </a>
            </div>
          </div>

          <div className="center-row">
            <button className="btn-pdf" onClick={generatePDF}>🖨 生成批改报告 (PDF)</button>
            <button className="btn-pdf" onClick={generateCertificate} style={{borderColor:'#a07820',color:'#a07820'}}>🏆 生成成绩单</button>
            <button className="btn-ghost" onClick={reset}>← 批改另一篇</button>
          </div>
        </div>)}
      </div>
      {/* Floating WhatsApp button */}
      <a href="https://wa.me/6592286725?text=Hi%20Leon%2C%20I%20used%20your%20composition%20marking%20tool%20and%20would%20like%20to%20find%20out%20more%20about%20trial%20lessons." target="_blank" rel="noopener noreferrer"
        style={{position:'fixed',bottom:24,right:24,zIndex:999,width:52,height:52,borderRadius:'50%',background:'#25D366',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 16px rgba(0,0,0,.25)',textDecoration:'none',transition:'transform .2s'}}
        title="WhatsApp Teacher Leon"
        onMouseEnter={function(e){e.currentTarget.style.transform='scale(1.1)';}}
        onMouseLeave={function(e){e.currentTarget.style.transform='scale(1)';}}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
      </a>
    </>
  );
}
