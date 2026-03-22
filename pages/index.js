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
  const wordCount = essay.replace(/\s/g, '').length;
  const gradeOrder = ['F9','E8','D7','C6','C5','B4','B3','A2','A1'];

  async function markEssay() {
    if (wordCount < 80) return setError('请提供至少80字的作文。');
    setError(''); setState('loading');
    try {
      const res = await fetch('/api/mark', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ essay, title }) });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || '批改失败');
      setResults(data); setState('results');
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
    const fwNames = {p1_opening:'P1 开头策略',p2_scene:'P2 场景设置',p3_transition:'P3 过渡段',p4_trigger:'P4 高潮前',p56_climax:'P5–6 高潮中',p7_resolution:'P7 高潮后',p8_conclusion:'P8 结尾'};
    const fwStatusStyle = {pass:{bg:'#edf7f1',border:'#1a6e40',color:'#154d2e',icon:'✓',label:'达标'},warn:{bg:'#fdf6e3',border:'#a07820',color:'#5a3e10',icon:'△',label:'可改善'},fail:{bg:'#fff0ee',border:'#b83222',color:'#6a1810',icon:'✗',label:'需改进'}};
    const easiNames = {E:{zh:'外貌描写',en:'Expressions & Appearance'},A:{zh:'行动描写',en:'Actions'},S:{zh:'语言描写',en:'Speech'},I:{zh:'心理描写',en:'Inner Thoughts & Feelings'}};
    const fmt = t => t.replace(/【([^】]+)】/g,'<span style="font-family:monospace;font-size:10px;color:#a07820;display:block;margin-top:14px;font-weight:600;letter-spacing:.05em">【$1】</span>');

    // ── Annotated essay text (inline emoji markers)
    const annotatedEssayText = (results.annotations||[]).reduce((text, ann) => {
      if (!ann.text || !text.includes(ann.text)) return text;
      const dot = ann.type==='error'?'🔴':ann.type==='good'?'🟢':'🟡';
      return text.replace(ann.text, ann.text + dot);
    }, essay);

    // ── Framework cards HTML (2-column grid matching screen)
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

    // ── EASI cards HTML (2-column grid matching screen)
    const easiCards = ['E','A','S','I'].map(k => {
      const it = results.easi?.[k]||{};
      const isGood = it.rating==='good', isOk = it.rating==='ok';
      const bg = isGood?'#edf7f1':isOk?'#fdf6e3':'#fff0ee';
      const border = isGood?'#1a6e40':isOk?'#a07820':'#b83222';
      const color = isGood?'#154d2e':isOk?'#5a3e10':'#6a1810';
      const extractedArr = Array.isArray(it.extracted) ? it.extracted : (it.extracted||'').split('｜').filter(Boolean);
      const extractedHtml = extractedArr[0]==='未发现相关描写'||!extractedArr.length
        ? '<span style="color:#999;font-style:italic">未发现相关描写</span>'
        : extractedArr.map(ex=>`<div style="display:flex;gap:6px;margin-bottom:4px"><span style="color:${border};font-weight:700;flex-shrink:0">·</span><span style="font-family:\'Noto Serif SC\',serif;font-size:11px">${ex}</span></div>`).join('');
      return `<div style="background:${bg};border:1px solid ${border};border-radius:10px;padding:14px 16px;">
        <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:4px">
          <span style="font-family:'Noto Serif SC',serif;font-size:1.6rem;font-weight:900;color:${border};line-height:1">${k}</span>
          <div>
            <div style="font-weight:700;font-size:12px;color:${color}">${easiNames[k].zh}</div>
            <div style="font-size:10px;color:${color};opacity:.7">${easiNames[k].en}</div>
          </div>
          <span style="margin-left:auto;font-size:10px;color:${color};background:white;padding:1px 7px;border-radius:99px;border:1px solid ${border}">${it.score_label||''}</span>
        </div>
        <div style="font-size:11px;color:#3d3020;margin-bottom:8px">${it.comment||''}</div>
        <div style="background:rgba(255,255,255,.6);border-radius:6px;padding:8px 10px;border-left:3px solid ${border}">
          <div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;opacity:.5;margin-bottom:4px;font-family:monospace">学生原文摘录 · STUDENT'S WRITING</div>
          ${extractedHtml}
        </div>
      </div>`;
    }).join('');

    // ── Language errors
    const errSection = (results.language_errors||[]).length
      ? (results.language_errors||[]).map(e=>`<div style="padding:10px 13px;border-radius:8px;border-left:3px solid #b83222;background:#fdf0ee;margin-bottom:8px;font-size:12px">
          <div style="font-weight:700;font-size:10px;color:#b83222;margin-bottom:4px">${e.label}</div>
          <div style="color:#b83222;font-family:'Noto Serif SC',serif">原文：${e.original}</div>
          <div style="color:#1a6e40;font-family:'Noto Serif SC',serif">改正：${e.correction}</div>
          ${e.reason?`<div style="color:#666;margin-top:2px">${e.reason}</div>`:''}
        </div>`).join('')
      : '<p style="color:#1a6e40;font-style:italic;font-size:12px">语言运用良好，未发现明显错误。✓</p>';

    // ── No annotation legend in PDF — inline dots only, matching screen

    // ── Annotated essay with framework cards (paragraph by paragraph, matching screen)
    const pdfFwKeys = ['p1_opening','p2_scene','p3_transition','p4_trigger','p56_climax','p7_resolution','p8_conclusion'].filter(function(k){return !!(results.framework||{})[k];});
    const pdfFwLabels = {p1_opening:'P1 开头',p2_scene:'P2 场景',p3_transition:'P3 过渡',p4_trigger:'P4 高潮前',p56_climax:'P5-6 高潮中',p7_resolution:'P7 高潮后',p8_conclusion:'P8 结尾'};

    const pdfParas = (essay||'').split('\n').filter(function(p){return p.trim().length>0;});
    const pdfParaMap = (function() {
      var hasIdx = pdfFwKeys.some(function(k) {
        var fw = (results.framework||{})[k];
        return fw && typeof fw.para_index === 'number';
      });
      if (hasIdx) {
        var map = new Array(pdfParas.length).fill(null);
        pdfFwKeys.forEach(function(k) {
          var fw = (results.framework||{})[k];
          if (!fw) return;
          var pi = (typeof fw.para_index === 'number') ? fw.para_index : null;
          if (pi === null || pi >= pdfParas.length) return;
          map[pi] = k;
          if (k === 'p56_climax' && pi + 1 < pdfParas.length) {
            map[pi + 1] = k;
          }
        });
        return map;
      } else {
        var map = new Array(pdfParas.length).fill(null);
        var ki = 0;
        for (var pi = 0; pi < pdfParas.length; pi++) {
          if (ki >= pdfFwKeys.length) break;
          map[pi] = pdfFwKeys[ki];
          if (pdfFwKeys[ki] === 'p56_climax' && pi + 1 < pdfParas.length) {
            pi++;
            map[pi] = pdfFwKeys[ki];
          }
          ki++;
        }
        return map;
      }
    })();

    const pdfAnnotatedEssayWithFw = pdfParas.map(function(para, pIdx) {
      const fwKey = pdfParaMap[pIdx];
      const fw = fwKey ? (results.framework||{})[fwKey] : null;
      const st = fw ? (fwStatusStyle[fw.status]||fwStatusStyle.pass) : null;
      // Annotate this paragraph with coloured highlights (matching screen)
      const annotatedPara = (function() {
        var sorted = (results.annotations||[]).slice().sort(function(a,b){return (b.text||'').length-(a.text||'').length;});
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
      const borderLeft = st ? ('3px solid '+st.border) : '1px solid #e0d5c0';
      const fwCard = fw && st ? (
        '<div style="width:210px;flex-shrink:0;background:'+st.bg+';border:1px solid '+st.border+';border-left:4px solid '+st.border+';border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:5px;">'+
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'+
            '<span style="font-weight:700;font-size:11px;color:'+st.color+';white-space:nowrap">'+(pdfFwLabels[fwKey]||fwKey)+'</span>'+
            '<span style="font-size:10px;color:'+st.color+';background:white;padding:1px 6px;border-radius:99px;border:1px solid '+st.border+';white-space:nowrap">'+st.icon+' '+st.label+'</span>'+
          '</div>'+
          '<div style="font-size:11px;color:#3d3020;line-height:1.6;font-family:Noto Sans SC,sans-serif">'+fw.comment+'</div>'+
        '</div>'
      ) : '';
      return (
        '<div style="display:flex;gap:8px;align-items:stretch;margin-bottom:6px">'+
          '<div style="flex:1;min-width:0;font-family:Noto Serif SC,serif;font-size:12px;color:#3d3020;line-height:2;background:#fffef8;padding:10px 14px;border-radius:8px;border:1px solid #e0d5c0;border-left:'+borderLeft+'">'+annotatedPara+'</div>'+
          fwCard+
        '</div>'
      );
    }).join('');

    // ── Score bars
    const cPct = Math.round((results.content_score/20)*100);
    const lPct = Math.round((results.language_score/20)*100);
    const barC = p => p>=80?'#1a6e40':p>=65?'#1a4a70':p>=50?'#a07820':'#b83222';

    // ── Sample essays
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
        <div class="bar-row">
          <span style="width:80px">内容 ${results.content_score}/20</span>
          <div class="bar-track"><div class="bar-fill" style="width:${cPct}%;background:${barC(cPct)}"></div></div>
        </div>
        <div class="bar-row">
          <span style="width:80px">语文 ${results.language_score}/20</span>
          <div class="bar-track"><div class="bar-fill" style="width:${lPct}%;background:${barC(lPct)}"></div></div>
        </div>
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

    ${sampleSection}
    ${stretchSection}

    <div class="marketing">
      <div class="mkt-title">👨‍🏫 Found this useful? Learn directly with Teacher Leon.</div>
      <div class="mkt-cred">BA (Hons) Chinese Studies, NTU · PGDE, NIE · 17 years teaching · 10 years O-Level marker</div>
      <div class="mkt-body">This tool reflects how Leon teaches — structured, strategic, examiner-informed. If your child would benefit from that approach 1-to-1, a trial lesson is the best way to find out.</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <a class="mkt-wa" href="https://wa.me/6592286725?text=Hi%20Leon%2C%20I%20used%20your%20composition%20marking%20tool%20and%20would%20like%20to%20find%20out%20more%20about%20trial%20lessons." target="_blank">
          WhatsApp for a Trial →
        </a>
        <a href="/about.html" target="_blank" style="display:inline-block;color:rgba(255,255,255,0.6);font-size:13px;padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);text-decoration:none;">
          Learn more →
        </a>
      </div>
    </div>

    </body></html>`);
    w.document.close();
  }

  function reset() { setState('input'); setResults(null); setSampleState('idle'); setStretchState('idle'); setSampleEssay(''); setStretchEssay(''); setStretchGrade(''); setError(''); }

  const fwItems = [{key:'p1_opening',label:'P1 开头策略'},{key:'p2_scene',label:'P2 场景设置'},{key:'p3_transition',label:'P3 过渡段'},{key:'p4_trigger',label:'P4 高潮前'},{key:'p56_climax',label:'P5–6 高潮中'},{key:'p7_resolution',label:'P7 高潮后'},{key:'p8_conclusion',label:'P8 结尾'}];
  const easiItems = [{k:'E',name:'外貌描写',en:'Expressions & Appearance'},{k:'A',name:'行动描写',en:'Actions'},{k:'S',name:'语言描写',en:'Speech'},{k:'I',name:'心理描写',en:'Inner Thoughts & Feelings'}];
  function fwColor(s){if(s==='pass')return{bg:'#edf7f1',border:'#1a6e40',text:'#154d2e',icon:'✓'};if(s==='warn')return{bg:'#fdf6e3',border:'#a07820',text:'#5a3e10',icon:'△'};return{bg:'#fdf0ee',border:'#b83222',text:'#6a1810',icon:'✗'};}
  function easiColor(r){if(r==='good')return{bg:'#edf7f1',border:'#1a6e40',text:'#154d2e'};if(r==='ok')return{bg:'#fdf6e3',border:'#a07820',text:'#5a3e10'};return{bg:'#fdf0ee',border:'#b83222',text:'#6a1810'};}
  function barColor(p){if(p>=80)return'#1a6e40';if(p>=65)return'#1a4a70';if(p>=50)return'#a07820';return'#b83222';}

  const FW_KEYS = ['p1_opening','p2_scene','p3_transition','p4_trigger','p56_climax','p7_resolution','p8_conclusion'];
  const FW_LABELS = {
    p1_opening:   {label:'P1 开头',     en:'Opening'},
    p2_scene:     {label:'P2 场景',     en:'Scene'},
    p3_transition:{label:'P3 过渡',     en:'Transition'},
    p4_trigger:   {label:'P4 高潮前',   en:'Trigger'},
    p56_climax:   {label:'P5-6 高潮中', en:'Climax'},
    p7_resolution:{label:'P7 高潮后',   en:'Resolution'},
    p8_conclusion:{label:'P8 结尾',     en:'Conclusion'},
  };
  const FW_STATUS = {
    pass:{ bg:'#edfaf3', border:'#1a6e40', color:'#1a6e40', icon:'✓', label:'达标' },
    warn:{ bg:'#fffbe6', border:'#a07820', color:'#a07820', icon:'△', label:'可改善' },
    fail:{ bg:'#fff0ee', border:'#b83222', color:'#b83222', icon:'✗', label:'需改进' },
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

  function AnnotatedEssayWithFramework({essay, annotations, framework}) {
    const [expandedIdx, setExpandedIdx] = useState(null);
    const paragraphs = (essay||'').split('\n').filter(function(p){return p.trim().length>0;});
    const fwKeys = FW_KEYS.filter(function(k){return !!framework[k];});

    // Assign fw keys to paragraphs, giving P5-6 (高潮中) TWO paragraph slots
    // Pattern: P1, P2, P3, P4, P5-6, P5-6, P7, P8, null...
    // Build para→fwKey map: use AI para_index if available, else sequential with P5-6 double slot
    var paraFwMap = (function() {
      // Check if AI returned para_index for any key
      var hasParaIndex = fwKeys.some(function(k) {
        return framework[k] && typeof framework[k].para_index === 'number';
      });

      if (hasParaIndex) {
        // Use AI-assigned indices
        var map = new Array(paragraphs.length).fill(null);
        fwKeys.forEach(function(k) {
          var fw = framework[k];
          if (!fw) return;
          var pi = (typeof fw.para_index === 'number') ? fw.para_index : null;
          if (pi === null || pi >= paragraphs.length) return;
          map[pi] = k;
          // P5-6 always covers the next paragraph too
          if (k === 'p56_climax' && pi + 1 < paragraphs.length) {
            map[pi + 1] = k;
          }
        });
        return map;
      } else {
        // Fallback: sequential, P5-6 gets two slots
        // P1, P2, P3, P4, P5-6, P5-6, P7, P8
        var map = new Array(paragraphs.length).fill(null);
        var ki = 0;
        for (var pi = 0; pi < paragraphs.length; pi++) {
          if (ki >= fwKeys.length) break;
          map[pi] = fwKeys[ki];
          if (fwKeys[ki] === 'p56_climax' && pi + 1 < paragraphs.length) {
            pi++;
            map[pi] = fwKeys[ki]; // second climax paragraph
          }
          ki++;
        }
        return map;
      }
    })();

    // Each paragraph row contains essay + card side by side — perfect alignment guaranteed
    return (
      <div>
        {paragraphs.map(function(para, pIdx) {
          const fwKey = paraFwMap[pIdx];
          const fw = fwKey ? framework[fwKey] : null;
          const st = fw ? (FW_STATUS[fw.status]||FW_STATUS.pass) : null;
          const borderLeft = st ? ('3px solid '+st.border) : '1px solid #e0d5c0';
          return (
            <div key={pIdx} style={{display:'flex', gap:'8px', alignItems:'stretch', marginBottom:'6px'}}>
              {/* Essay paragraph */}
              <div style={{flex:1, minWidth:0}}>
                <div
                  style={{fontFamily:"'Noto Serif SC',serif", fontSize:'.95rem', color:'#3d3020',
                    lineHeight:2.2, background:'#fffef8', padding:'10px 14px', height:'100%',
                    borderRadius:'8px', border:'1px solid #e0d5c0', borderLeft:borderLeft}}
                  dangerouslySetInnerHTML={{__html: annotateEssay(para, annotations)}}
                />
              </div>
              {/* Framework card — desktop: inline; mobile: tap to expand */}
              {fw && st && (
                <div className="fw-right-col" style={{width:'210px', flexShrink:0}}>
                  <FwCard fw={fw} fwKey={fwKey} />
                </div>
              )}
              {fw && st && (
                <button
                  onClick={function(){setExpandedIdx(expandedIdx===pIdx?null:pIdx);}}
                  className="fw-mobile-icon"
                  style={{display:'none', flexShrink:0, width:'28px', height:'28px',
                    alignSelf:'flex-start', marginTop:'12px', borderRadius:'50%',
                    border:'2px solid '+st.border, background:st.bg, color:st.color,
                    fontSize:'.8rem', fontWeight:700, cursor:'pointer',
                    alignItems:'center', justifyContent:'center'}}
                >{st.icon}</button>
              )}
              {fw && expandedIdx===pIdx && (
                <div className="fw-mobile-card" style={{marginTop:'4px', width:'100%'}}>
                  <FwCard fw={fw} fwKey={fwKey} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function annotateEssay(text, annotations) {
    if (!annotations || annotations.length === 0) return text.replace(/\n/g, '<br/>');
    // Sort by length descending to avoid partial replacements
    const sorted = [...annotations].sort((a,b) => (b.text||'').length - (a.text||'').length);
    let result = text;
    sorted.forEach((ann, idx) => {
      if (!ann.text || !result.includes(ann.text)) return;
      const colors = {
        error: { bg:'#fff0ee', underline:'#b83222', dot:'🔴' },
        good:  { bg:'#edfaf3', underline:'#1a6e40', dot:'🟢' },
        improve: { bg:'#fffbe6', underline:'#a07820', dot:'🟡' }
      };
      const c = colors[ann.type] || colors.good;
      const techLabel = ann.technique ? ` [${ann.technique}]` : '';
      const tooltip = (ann.comment||'') + techLabel;
      const highlighted = `<span class="ann-mark ann-${ann.type}" style="background:${c.bg};border-bottom:2px solid ${c.underline};border-radius:3px;padding:1px 2px;cursor:pointer;position:relative" title="${tooltip}" data-comment="${tooltip}">${ann.text}<sup style="font-size:9px;color:${c.underline};margin-left:1px">${c.dot}</sup></span>`;
      result = result.replace(ann.text, highlighted);
    });
    return result.replace(/\n/g, '<br/>');
  }

  function SampleBlock({mode}) {
    const currentGradeIdx = results ? gradeOrder.indexOf(results.grade) : -1;
    const computedStretchGrade = currentGradeIdx >= 0 ? gradeOrder[Math.min(currentGradeIdx+2, gradeOrder.length-1)] : '';
    const isStretch = mode==='stretch';
    // Hide stretch button for A1/A2 — already at top level
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
            <div className="sec-title" style={{color}}>{isStretch?`进阶范文 (${tGrade} 水平)`:'示范范文 (A1/A2 水平)'}</div>
            <div className="sec-sub">{isStretch?`2 grades above your current ${results?.grade}`:'Highest standard model essay'}</div>
          </div>
        </div>
        <p style={{fontSize:'.86rem',color:'#3d3020',lineHeight:1.7,marginBottom:16}}>{desc}</p>
        {stateVal==='idle'&&<button className="btn-gold" style={{background:color}} onClick={()=>generateSample(mode)}>{isStretch?`📈 生成进阶范文 (${tGrade})`:'⭐ 生成示范范文 (A1/A2)'}</button>}
        {stateVal==='loading'&&<div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 0',color:'#8a7a60',fontStyle:'italic',fontSize:'.87rem'}}><div className="dots"><span/><span/><span/></div>生成中，约需 20–30 秒……</div>}
        {stateVal==='error'&&<div><p style={{color:'#b83222',fontSize:'.84rem',marginBottom:10}}>生成时出现错误，请重试。</p><button className="btn-gold" style={{background:color}} onClick={()=>generateSample(mode)}>重试</button></div>}
        {stateVal==='done'&&essayVal&&(
          <div>
            <div style={{fontFamily:'Noto Serif SC,serif',fontSize:'.95rem',fontWeight:600,color,marginBottom:12,paddingBottom:10,borderBottom:'1px solid #e0d5c0'}}>{isStretch?'📈':'⭐'} {isStretch?`进阶范文 — ${tGrade} 水平`:'示范范文 — A1/A2 水平'}　题目：{title||'（无题目）'}</div>
            <div style={{fontFamily:'Noto Serif SC,serif',fontSize:'.95rem',color:'#3d3020',lineHeight:2.1,whiteSpace:'pre-wrap'}} dangerouslySetInnerHTML={{__html:formatSample(essayVal)}} />
            <div style={{fontSize:'.76rem',color:'#8a7a60',fontStyle:'italic',marginTop:12,paddingTop:10,borderTop:'1px solid #e0d5c0'}}>※ 此范文仅供参考，请勿直接抄写。以此为范例理解写法，再用自己的语言重写。</div>
          </div>
        )}
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
      <style>{`*{box-sizing:border-box;margin:0;padding:0}body{background:#f8f5ef;color:#1c1710;font-family:'Noto Sans SC',sans-serif;min-height:100vh}.topbar{background:#1c1710;padding:0 32px;height:54px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}.logo{font-family:'Noto Serif SC',serif;font-size:1rem;font-weight:700;color:#e8d090}.topbar-mid{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.18em;color:#7a6a50;text-transform:uppercase}.chip{font-family:'DM Mono',monospace;font-size:9px;padding:3px 10px;border-radius:99px;border:1px solid rgba(160,120,32,.4);color:#c8a050;background:rgba(160,120,32,.1)}.page{max-width:860px;margin:0 auto;padding:44px 20px 60px}.hero{text-align:center;margin-bottom:36px}.hero-eye{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#a07820;margin-bottom:10px}.hero h1{font-family:'Noto Serif SC',serif;font-size:clamp(1.8rem,4.5vw,2.6rem);font-weight:700;margin-bottom:8px}.hero h1 em{color:#a07820;font-style:normal}.hero-sub{font-size:.88rem;color:#8a7a60}.card{background:#fff;border:1px solid #e0d5c0;border-radius:10px;padding:24px 26px;box-shadow:0 2px 14px rgba(0,0,0,.06);margin-bottom:14px}.card-label{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#8a7a60;margin-bottom:5px;display:flex;align-items:center;gap:8px}.lnum{width:20px;height:20px;border-radius:50%;background:#1c1710;color:#e8d090;display:inline-flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0}.card-hint{font-size:.8rem;color:#8a7a60;margin-bottom:12px}input[type=text]{width:100%;background:#f2ede3;border:1px solid #e0d5c0;border-radius:8px;padding:11px 14px;font-family:'Noto Sans SC',sans-serif;font-size:.95rem;color:#1c1710;outline:none;margin-bottom:18px;transition:border-color .2s}input[type=text]:focus{border-color:#a07820}input::placeholder{color:#8a7a60;font-style:italic}textarea{width:100%;background:#f2ede3;border:1px solid #e0d5c0;border-radius:8px;padding:14px;font-family:'Noto Serif SC',serif;font-size:.97rem;color:#1c1710;outline:none;resize:vertical;min-height:280px;line-height:2;transition:border-color .2s}textarea:focus{border-color:#a07820}textarea::placeholder{color:#8a7a60;font-style:italic;font-family:'Noto Sans SC',sans-serif;font-size:.88rem}.row{display:flex;justify-content:space-between;align-items:center;margin-top:10px}.wc{font-family:'DM Mono',monospace;font-size:11px;color:#8a7a60}.wc.ok{color:#1a6e40}.wc.low{color:#b83222}.btn-main{font-family:'Noto Sans SC',sans-serif;font-size:.88rem;font-weight:500;padding:11px 28px;border-radius:8px;border:none;background:#1c1710;color:#e8d090;cursor:pointer;transition:all .15s}.btn-main:hover{background:#332a18}.btn-main:disabled{background:#8a7a60;cursor:not-allowed}.btn-gold{font-family:'Noto Sans SC',sans-serif;font-size:.9rem;font-weight:500;padding:12px 24px;border-radius:8px;border:none;color:#fff;cursor:pointer;transition:all .15s;width:100%}.btn-gold:hover{filter:brightness(1.12)}.btn-ghost{font-family:'Noto Sans SC',sans-serif;font-size:.82rem;padding:9px 22px;border-radius:8px;border:1px solid #c8b99a;background:transparent;color:#8a7a60;cursor:pointer;transition:all .15s}.btn-ghost:hover{color:#1c1710;border-color:#3d3020}.btn-pdf{font-family:'Noto Sans SC',sans-serif;font-size:.82rem;padding:9px 22px;border-radius:8px;border:1px solid #1a4a70;background:transparent;color:#1a4a70;cursor:pointer;transition:all .15s}.btn-pdf:hover{background:#1a4a70;color:#fff}.error{color:#b83222;font-size:.85rem;margin-top:8px}.loading-wrap{text-align:center;padding:60px 20px}.loading-char{font-family:'Noto Serif SC',serif;font-size:2rem;letter-spacing:.2em;color:#a07820;animation:breathe 2s ease-in-out infinite;margin-bottom:14px}.loading-msg{font-size:.88rem;color:#8a7a60;font-style:italic;margin-bottom:20px}.loading-steps{display:flex;justify-content:center;gap:16px;flex-wrap:wrap}.lstep{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#a07820}.grade-banner{background:#1c1710;border-radius:10px;padding:22px 26px;display:flex;align-items:center;gap:22px;margin-bottom:14px;position:relative;overflow:hidden}.grade-banner::after{content:'记';position:absolute;right:18px;top:50%;transform:translateY(-50%);font-family:'Noto Serif SC',serif;font-size:7rem;font-weight:700;color:rgba(255,255,255,.04);pointer-events:none}.grade-ring{width:72px;height:72px;border-radius:50%;border:2px solid rgba(255,255,255,.12);display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0}.grade-letter{font-family:'Noto Serif SC',serif;font-size:1.8rem;font-weight:700;color:#e8d090;line-height:1}.grade-pts{font-family:'DM Mono',monospace;font-size:10px;color:rgba(232,208,144,.5);margin-top:2px}.grade-name{font-family:'Noto Serif SC',serif;font-size:1.1rem;color:#e8d090;font-weight:600;margin-bottom:4px}.grade-desc{font-size:.82rem;color:rgba(232,208,144,.6);margin-bottom:8px}.score-pills{display:flex;gap:8px;flex-wrap:wrap}.spill{font-family:'DM Mono',monospace;font-size:10px;padding:3px 10px;border-radius:99px;border:1px solid rgba(255,255,255,.1);color:rgba(232,208,144,.65)}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}@media(max-width:600px){.grid2{grid-template-columns:1fr}.grade-banner{flex-direction:column;text-align:center}}.sec-head{display:flex;align-items:center;gap:10px;padding-bottom:12px;margin-bottom:14px;border-bottom:1px solid #e0d5c0}.sec-icon{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.95rem;flex-shrink:0}.sec-title{font-family:'Noto Serif SC',serif;font-size:.9rem;font-weight:600}.sec-sub{font-family:'DM Mono',monospace;font-size:9px;color:#8a7a60;letter-spacing:.1em;text-transform:uppercase;margin-top:1px}.bar-wrap{margin-bottom:11px}.bar-top{display:flex;justify-content:space-between;font-size:.78rem;color:#8a7a60;margin-bottom:5px}.bar-top strong{color:#3d3020}.bar-track{height:7px;background:#f2ede3;border-radius:99px;overflow:hidden;border:1px solid #e0d5c0}.bar-fill{height:100%;border-radius:99px;transition:width 1s cubic-bezier(.4,0,.2,1)}.fw-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}@media(max-width:500px){.fw-grid{grid-template-columns:1fr}}.fw-item{display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border-radius:8px;font-size:.82rem;line-height:1.5;border-left:3px solid}.fw-icon{flex-shrink:0;font-weight:700;margin-top:1px}.fw-lbl{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;opacity:.6;margin-bottom:2px}.easi-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:500px){.easi-grid{grid-template-columns:1fr}}.easi-item{padding:14px;border-radius:8px;border:1px solid}.easi-header{display:flex;align-items:center;gap:10px;margin-bottom:8px}.easi-letter{font-family:'Noto Serif SC',serif;font-size:1.4rem;font-weight:700}.easi-name{font-size:.78rem;font-weight:600;color:#3d3020}.easi-en{font-size:.7rem;color:#8a7a60}.easi-score{font-family:'DM Mono',monospace;font-size:10px;padding:2px 8px;border-radius:99px;background:rgba(0,0,0,.06);display:inline-block;margin-bottom:6px}.easi-comment{font-size:.78rem;color:#555;line-height:1.5;margin-bottom:8px}.easi-extracted{padding:8px 10px;background:rgba(0,0,0,.04);border-radius:6px;border-left:2px solid}.easi-extracted-lbl{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;opacity:.5;margin-bottom:3px}.easi-extracted-text{font-family:'Noto Serif SC',serif;font-size:.82rem;color:#3d3020;line-height:1.7}.err-list{list-style:none;display:flex;flex-direction:column;gap:8px}.err-item{padding:10px 13px;border-radius:8px;font-size:.82rem;line-height:1.7;border-left:3px solid;background:#fdf0ee;border-color:#b83222;color:#6a1810}.err-lbl{font-family:'DM Mono',monospace;font-size:8px;letter-spacing:.14em;text-transform:uppercase;opacity:.6;margin-bottom:3px}.err-orig{font-family:'Noto Serif SC',serif;margin-bottom:2px}.err-fix{font-family:'Noto Serif SC',serif;color:#1a6e40}.err-reason{font-size:.75rem;opacity:.8;margin-top:2px}.sug-list{list-style:none;display:flex;flex-direction:column;gap:8px}.sug-item{display:flex;gap:10px;padding:10px 12px;border-radius:8px;background:#edf7f1;border-left:3px solid #1a6e40;font-size:.83rem;color:#154d2e;line-height:1.6}.examiner-box{background:#f2ede3;border:1px solid #c8b99a;border-radius:10px;padding:20px 24px;position:relative}.examiner-box::before{content:'"';position:absolute;top:5px;left:12px;font-family:'Noto Serif SC',serif;font-size:2.8rem;color:#c8b99a;line-height:1}.examiner-text{font-family:'Noto Serif SC',serif;font-size:.93rem;color:#3d3020;line-height:1.95;padding-top:14px}.examiner-sig{margin-top:12px;font-family:'DM Mono',monospace;font-size:9px;color:#8a7a60;letter-spacing:.12em;text-align:right}.center-row{display:flex;justify-content:center;gap:12px;margin-top:24px;flex-wrap:wrap}.dots span{display:inline-block;width:5px;height:5px;background:#a07820;border-radius:50%;animation:pulse 1.2s ease-in-out infinite;margin:0 2px}.dots span:nth-child(2){animation-delay:.2s}.dots span:nth-child(3){animation-delay:.4s}@keyframes breathe{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.05)}}@keyframes pulse{0%,80%,100%{transform:scale(.6);opacity:.3}40%{transform:scale(1);opacity:1}}@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}.fade{animation:fadeUp .5s ease both}.fw-right-col{display:flex!important}.fw-mobile-icon{display:none!important}.fw-mobile-card{display:block}.fw-essay-grid{grid-template-columns:1fr 220px!important}.ann-mark{transition:all .15s}.ann-mark:hover{filter:brightness(.95)}.ann-tooltip{position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:#1c1710;color:#e8d090;padding:4px 10px;border-radius:6px;font-size:11px;white-space:nowrap;pointer-events:none;z-index:999;font-family:'Noto Sans SC',sans-serif}`}</style>

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
          <div style={{fontSize:'.82rem',color:'#8a7a60',marginTop:6}}>Based on SEAB 1160 Rubric · Teacher Leon&apos;s Framework · 依据 SEAB 1160 评分指引 · 结合林老师记叙文框架</div>
        </div>

        {state==='input'&&(<div className="fade"><div className="card">
          <div className="card-label"><span className="lnum">1</span> 作文题目 <span style={{fontWeight:400,opacity:.7,marginLeft:4}}>Essay Title</span></div>
          <div className="card-hint">填写题目有助于评估内容切题程度（可选）· Helps assess relevance (optional)</div>
          <input type="text" value={title} onChange={e=>setTitle(e.target.value)} placeholder="例：那一次，我学会了坚持… / e.g. The time I learned to persevere…" />
          <div className="card-label"><span className="lnum">2</span> 粘贴你的记叙文 <span style={{fontWeight:400,opacity:.7,marginLeft:4}}>Paste Your Essay</span></div>
          <div className="card-hint">O Level 建议字数：350–500字 · Recommended length: 350–500 characters</div>
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
            <span className={`wc ${wordCount>=350?'ok':wordCount>100?'':'low'}`}>{wordCount} 字</span>
            <button className="btn-main" onClick={markEssay} disabled={wordCount<80}>开始批改 · Mark My Essay →</button>
          </div>
          {error&&<div className="error">{error}</div>}
        </div></div>)}

        {state==='loading'&&(<div className="card fade"><div className="loading-wrap">
          <div className="loading-char">批改中…</div>
          <div className="loading-msg">Marking your essay · 正在批改，约需 20–30 秒… (20–30 seconds)</div>
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
            <div className="sec-head"><div className="sec-icon" style={{background:'#fffef8'}}>📝</div><div><div className="sec-title">学生原文（批注版）</div><div className="sec-sub">Annotated Student Essay · Framework notes alongside each paragraph</div></div></div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
              <span style={{fontSize:'.75rem',padding:'3px 10px',borderRadius:99,background:'#edf7f1',color:'#1a6e40',border:'1px solid #1a6e40'}}>🟢 优点</span>
              <span style={{fontSize:'.75rem',padding:'3px 10px',borderRadius:99,background:'#fdf0ee',color:'#b83222',border:'1px solid #b83222'}}>🔴 错误</span>
              <span style={{fontSize:'.75rem',padding:'3px 10px',borderRadius:99,background:'#fdf6e3',color:'#a07820',border:'1px solid #a07820'}}>🟡 可改善</span>
            </div>
            <AnnotatedEssayWithFramework essay={essay} annotations={results?.annotations||[]} framework={results?.framework||{}} />
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

          <div className="card">
            <div className="sec-head"><div className="sec-icon" style={{background:'#eaf2fb'}}>✍️</div><div><div className="sec-title">EASI 人物描写手法</div><div className="sec-sub">E = Expressions & Appearance &nbsp;·&nbsp; A = Actions &nbsp;·&nbsp; S = Speech &nbsp;·&nbsp; I = Inner Thoughts & Feelings</div></div></div>
            <div className="easi-grid">{easiItems.map(e=>{const item=results.easi?.[e.k]||{rating:'ok',score_label:'',comment:'',extracted:''};const c=easiColor(item.rating);return(<div key={e.k} className="easi-item" style={{background:c.bg,borderColor:c.border}}><div className="easi-header"><div className="easi-letter" style={{color:c.border}}>{e.k}</div><div><div className="easi-name">{e.name}</div><div className="easi-en">{e.en}</div></div></div><div className="easi-score" style={{color:c.border}}>{item.score_label}</div><div className="easi-comment">{item.comment}</div><div className="easi-extracted" style={{borderColor:c.border}}><div className="easi-extracted-lbl">学生原文摘录 · Student&apos;s Writing</div>{Array.isArray(item.extracted)?(item.extracted[0]==='未发现相关描写'?<div className="easi-extracted-text" style={{color:'#999',fontStyle:'italic'}}>未发现相关描写</div>:<ul style={{listStyle:'none',padding:0,margin:0,display:'flex',flexDirection:'column',gap:'6px'}}>{item.extracted.map((ex,xi)=>(<li key={xi} style={{display:'flex',gap:'8px',alignItems:'flex-start'}}><span style={{color:c.border,flexShrink:0,fontWeight:700,fontSize:'.85rem',marginTop:'1px'}}>·</span><span className="easi-extracted-text" style={{flex:1}}>{ex}</span></li>))}</ul>):<div className="easi-extracted-text">{typeof item.extracted==='string'?item.extracted.split('｜').map((ex,xi,arr)=>(<div key={xi} style={{display:'flex',gap:'8px',marginBottom:xi<arr.length-1?'4px':'0'}}><span style={{color:c.border,fontWeight:700}}>·</span><span>{ex}</span></div>)):'未发现相关描写'}</div>}</div></div>);})}</div>
          </div>

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

          <SampleBlock mode="standard" />
          <SampleBlock mode="stretch" />

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
            <button className="btn-ghost" onClick={reset}>← 批改另一篇</button>
          </div>
        </div>)}
      </div>
    </>
  );
}
