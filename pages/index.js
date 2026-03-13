import { useState } from 'react';
import Head from 'next/head';

export default function Home() {
  const [title, setTitle] = useState('');
  const [essay, setEssay] = useState('');
  const [state, setState] = useState('input'); // input | loading | results
  const [results, setResults] = useState(null);
  const [sampleState, setSampleState] = useState('idle'); // idle | loading | done
  const [sampleEssay, setSampleEssay] = useState('');
  const [error, setError] = useState('');

  const wordCount = essay.replace(/\s/g, '').length;

  async function markEssay() {
    if (wordCount < 80) return setError('请提供至少80字的作文。');
    setError('');
    setState('loading');
    try {
      const res = await fetch('/api/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ essay, title })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || '批改失败');
      setResults(data);
      setState('results');
    } catch (e) {
      setError('批改时出现错误：' + e.message);
      setState('input');
    }
  }

  async function generateSample() {
    setSampleState('loading');
    try {
      const res = await fetch('/api/sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, essaySnippet: essay.substring(0, 500) })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || '生成失败');
      setSampleEssay(data.essay);
      setSampleState('done');
    } catch (e) {
      setSampleState('error');
    }
  }

  function reset() {
    setState('input');
    setResults(null);
    setSampleState('idle');
    setSampleEssay('');
    setError('');
  }

  const fwItems = [
    { key: 'p1_opening', label: 'P1 开头策略' },
    { key: 'p2_scene', label: 'P2 场景设置' },
    { key: 'p3_transition', label: 'P3 过渡段' },
    { key: 'p4_trigger', label: 'P4 高潮前' },
    { key: 'p56_climax', label: 'P5–6 高潮中' },
    { key: 'p7_resolution', label: 'P7 高潮后' },
    { key: 'p8_conclusion', label: 'P8 结尾' },
  ];

  const easiItems = [
    { k: 'E', name: '外貌描写' },
    { k: 'A', name: '行动描写' },
    { k: 'S', name: '语言描写' },
    { k: 'I', name: '心理描写' },
  ];

  function fwColor(status) {
    if (status === 'pass') return { bg: '#edf7f1', border: '#1a6e40', text: '#154d2e', icon: '✓' };
    if (status === 'warn') return { bg: '#fdf6e3', border: '#a07820', text: '#5a3e10', icon: '△' };
    return { bg: '#fdf0ee', border: '#b83222', text: '#6a1810', icon: '✗' };
  }

  function easiColor(rating) {
    if (rating === 'good') return { bg: '#edf7f1', border: '#1a6e40', text: '#154d2e' };
    if (rating === 'ok') return { bg: '#fdf6e3', border: '#a07820', text: '#5a3e10' };
    return { bg: '#fdf0ee', border: '#b83222', text: '#6a1810' };
  }

  function barColor(pct) {
    if (pct >= 80) return '#1a6e40';
    if (pct >= 65) return '#1a4a70';
    if (pct >= 50) return '#a07820';
    return '#b83222';
  }

  function formatSample(text) {
    return text.replace(/【([^】]+)】/g, '<span style="font-family:monospace;font-size:11px;letter-spacing:0.12em;color:#a07820;display:block;margin-top:18px;margin-bottom:3px;text-transform:uppercase">【$1】</span>');
  }

  return (
    <>
      <Head>
        <title>林老师双语学堂 · 记叙文批改</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;400;600;700&family=Noto+Sans+SC:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f8f5ef; color: #1c1710; font-family: 'Noto Sans SC', sans-serif; min-height: 100vh; }
        .topbar { background: #1c1710; padding: 0 32px; height: 54px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
        .logo { font-family: 'Noto Serif SC', serif; font-size: 1rem; font-weight: 700; color: #e8d090; }
        .topbar-mid { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.18em; color: #7a6a50; text-transform: uppercase; }
        .chip { font-family: 'DM Mono', monospace; font-size: 9px; padding: 3px 10px; border-radius: 99px; border: 1px solid rgba(160,120,32,0.4); color: #c8a050; background: rgba(160,120,32,0.1); letter-spacing: 0.1em; }
        .page { max-width: 860px; margin: 0 auto; padding: 44px 20px 60px; }
        .hero { text-align: center; margin-bottom: 36px; }
        .hero-eye { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: #a07820; margin-bottom: 10px; }
        .hero h1 { font-family: 'Noto Serif SC', serif; font-size: clamp(1.8rem,4.5vw,2.6rem); font-weight: 700; margin-bottom: 8px; }
        .hero h1 em { color: #a07820; font-style: normal; }
        .hero-sub { font-size: 0.88rem; color: #8a7a60; }
        .card { background: #fff; border: 1px solid #e0d5c0; border-radius: 10px; padding: 26px 28px; box-shadow: 0 2px 14px rgba(0,0,0,0.06); margin-bottom: 14px; }
        .card-label { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: #8a7a60; margin-bottom: 5px; display: flex; align-items: center; gap: 8px; }
        .lnum { width: 20px; height: 20px; border-radius: 50%; background: #1c1710; color: #e8d090; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0; }
        .card-hint { font-size: 0.8rem; color: #8a7a60; margin-bottom: 12px; }
        input[type=text] { width: 100%; background: #f2ede3; border: 1px solid #e0d5c0; border-radius: 8px; padding: 11px 14px; font-family: 'Noto Sans SC', sans-serif; font-size: 0.95rem; color: #1c1710; outline: none; margin-bottom: 18px; transition: border-color 0.2s; }
        input[type=text]:focus { border-color: #a07820; }
        input::placeholder { color: #8a7a60; font-style: italic; }
        textarea { width: 100%; background: #f2ede3; border: 1px solid #e0d5c0; border-radius: 8px; padding: 14px; font-family: 'Noto Serif SC', serif; font-size: 0.97rem; color: #1c1710; outline: none; resize: vertical; min-height: 280px; line-height: 2; transition: border-color 0.2s; }
        textarea:focus { border-color: #a07820; }
        textarea::placeholder { color: #8a7a60; font-style: italic; font-family: 'Noto Sans SC', sans-serif; font-size: 0.88rem; }
        .row { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
        .wc { font-family: 'DM Mono', monospace; font-size: 11px; color: #8a7a60; }
        .wc.ok { color: #1a6e40; } .wc.low { color: #b83222; }
        .btn-main { font-family: 'Noto Sans SC', sans-serif; font-size: 0.88rem; font-weight: 500; padding: 11px 28px; border-radius: 8px; border: none; background: #1c1710; color: #e8d090; cursor: pointer; transition: all 0.15s; }
        .btn-main:hover { background: #332a18; }
        .btn-main:disabled { background: #8a7a60; cursor: not-allowed; }
        .btn-gold { font-family: 'Noto Sans SC', sans-serif; font-size: 0.9rem; font-weight: 500; padding: 13px 28px; border-radius: 8px; border: none; background: #a07820; color: #fff; cursor: pointer; transition: all 0.15s; width: 100%; }
        .btn-gold:hover { background: #8a6618; }
        .btn-gold:disabled { background: #8a7a60; cursor: not-allowed; }
        .btn-ghost { font-family: 'Noto Sans SC', sans-serif; font-size: 0.82rem; padding: 9px 22px; border-radius: 8px; border: 1px solid #c8b99a; background: transparent; color: #8a7a60; cursor: pointer; transition: all 0.15s; }
        .btn-ghost:hover { color: #1c1710; border-color: #3d3020; }
        .error { color: #b83222; font-size: 0.85rem; margin-top: 8px; }
        .loading-wrap { text-align: center; padding: 60px 20px; }
        .loading-char { font-family: 'Noto Serif SC', serif; font-size: 2rem; letter-spacing: 0.2em; color: #a07820; animation: breathe 2s ease-in-out infinite; margin-bottom: 14px; }
        .loading-msg { font-size: 0.88rem; color: #8a7a60; font-style: italic; margin-bottom: 20px; }
        .loading-steps { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; }
        .lstep { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: #c8b99a; transition: color 0.4s; }
        .lstep.on { color: #a07820; }
        .grade-banner { background: #1c1710; border-radius: 10px; padding: 24px 28px; display: flex; align-items: center; gap: 22px; margin-bottom: 14px; position: relative; overflow: hidden; }
        .grade-banner::after { content: '记'; position: absolute; right: 18px; top: 50%; transform: translateY(-50%); font-family: 'Noto Serif SC', serif; font-size: 7rem; font-weight: 700; color: rgba(255,255,255,0.04); pointer-events: none; }
        .grade-ring { width: 74px; height: 74px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.12); display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
        .grade-letter { font-family: 'Noto Serif SC', serif; font-size: 1.8rem; font-weight: 700; color: #e8d090; line-height: 1; }
        .grade-pts { font-family: 'DM Mono', monospace; font-size: 10px; color: rgba(232,208,144,0.5); margin-top: 2px; }
        .grade-name { font-family: 'Noto Serif SC', serif; font-size: 1.2rem; color: #e8d090; font-weight: 600; margin-bottom: 5px; }
        .grade-desc { font-size: 0.82rem; color: rgba(232,208,144,0.6); margin-bottom: 10px; }
        .score-pills { display: flex; gap: 8px; flex-wrap: wrap; }
        .spill { font-family: 'DM Mono', monospace; font-size: 10px; padding: 3px 10px; border-radius: 99px; border: 1px solid rgba(255,255,255,0.1); color: rgba(232,208,144,0.65); }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
        @media(max-width:600px) { .grid2 { grid-template-columns: 1fr; } .grade-banner { flex-direction: column; text-align: center; } }
        .sec-head { display: flex; align-items: center; gap: 10px; padding-bottom: 12px; margin-bottom: 14px; border-bottom: 1px solid #e0d5c0; }
        .sec-icon { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; flex-shrink: 0; }
        .sec-title { font-family: 'Noto Serif SC', serif; font-size: 0.9rem; font-weight: 600; }
        .sec-sub { font-family: 'DM Mono', monospace; font-size: 9px; color: #8a7a60; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 1px; }
        .bar-wrap { margin-bottom: 11px; }
        .bar-top { display: flex; justify-content: space-between; font-size: 0.78rem; color: #8a7a60; margin-bottom: 5px; }
        .bar-top strong { color: #3d3020; }
        .bar-track { height: 7px; background: #f2ede3; border-radius: 99px; overflow: hidden; border: 1px solid #e0d5c0; }
        .bar-fill { height: 100%; border-radius: 99px; transition: width 1s cubic-bezier(.4,0,.2,1); }
        .fw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        @media(max-width:500px) { .fw-grid { grid-template-columns: 1fr; } }
        .fw-item { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 8px; font-size: 0.82rem; line-height: 1.5; border-left: 3px solid; }
        .fw-icon { flex-shrink: 0; font-size: 0.85rem; margin-top: 1px; font-weight: 700; }
        .fw-lbl { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.6; margin-bottom: 2px; }
        .easi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; }
        @media(max-width:540px) { .easi-grid { grid-template-columns: repeat(2,1fr); } }
        .easi-item { padding: 14px 10px; border-radius: 8px; text-align: center; border: 1px solid; }
        .easi-letter { font-family: 'Noto Serif SC', serif; font-size: 1.5rem; font-weight: 700; margin-bottom: 3px; }
        .easi-name { font-size: 0.7rem; color: #8a7a60; margin-bottom: 7px; }
        .easi-score { font-family: 'DM Mono', monospace; font-size: 10px; padding: 2px 8px; border-radius: 99px; background: rgba(0,0,0,0.06); display: inline-block; }
        .easi-comment { font-size: 0.72rem; color: #8a7a60; margin-top: 6px; line-height: 1.4; }
        .err-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .err-item { padding: 10px 13px; border-radius: 8px; font-size: 0.83rem; line-height: 1.7; border-left: 3px solid; }
        .err-item.lang { background: #fdf0ee; border-color: #b83222; color: #6a1810; }
        .err-item.struct { background: #f5eeff; border-color: #5a2d82; color: #3a1855; }
        .err-item.style { background: #eaf2fb; border-color: #1a4a70; color: #0d2d44; }
        .err-lbl { font-family: 'DM Mono', monospace; font-size: 8px; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.6; margin-bottom: 3px; }
        .sug-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .sug-item { display: flex; gap: 10px; padding: 10px 12px; border-radius: 8px; background: #edf7f1; border-left: 3px solid #1a6e40; font-size: 0.83rem; color: #154d2e; line-height: 1.6; }
        .examiner-box { background: #f2ede3; border: 1px solid #c8b99a; border-radius: 10px; padding: 22px 26px; position: relative; }
        .examiner-box::before { content: '"'; position: absolute; top: 5px; left: 13px; font-family: 'Noto Serif SC', serif; font-size: 2.8rem; color: #c8b99a; line-height: 1; }
        .examiner-text { font-family: 'Noto Serif SC', serif; font-size: 0.93rem; color: #3d3020; line-height: 1.95; padding-top: 14px; }
        .examiner-sig { margin-top: 12px; font-family: 'DM Mono', monospace; font-size: 9px; color: #8a7a60; letter-spacing: 0.12em; text-align: right; }
        .sample-card { border: 2px solid #a07820; }
        .sample-body { font-family: 'Noto Serif SC', serif; font-size: 0.95rem; color: #3d3020; line-height: 2.1; white-space: pre-wrap; padding-top: 4px; }
        .sample-note { font-size: 0.76rem; color: #8a7a60; font-style: italic; margin-top: 14px; padding-top: 12px; border-top: 1px solid #e0d5c0; }
        .dots span { display: inline-block; width: 5px; height: 5px; background: #a07820; border-radius: 50%; animation: pulse 1.2s ease-in-out infinite; margin: 0 2px; }
        .dots span:nth-child(2) { animation-delay: 0.2s; }
        .dots span:nth-child(3) { animation-delay: 0.4s; }
        .center-row { display: flex; justify-content: center; margin-top: 24px; }
        @keyframes breathe { 0%,100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
        @keyframes pulse { 0%,80%,100% { transform: scale(0.6); opacity: 0.3; } 40% { transform: scale(1); opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .fade { animation: fadeUp 0.5s ease both; }
      `}</style>

      {/* Topbar */}
      <div className="topbar">
        <div className="logo">林老师双语学堂</div>
        <div className="topbar-mid">记叙文批改 · O Level 1160</div>
        <div className="chip">Leon Lim 林纯隆老师</div>
      </div>

      <div className="page">
        {/* Hero */}
        <div className="hero fade">
          <div className="hero-eye">Teacher Leon&apos;s Bilingual Academy · 专属批改工具</div>
          <h1>记叙文<em>智能批改</em></h1>
          <div className="hero-sub">依据 SEAB 1160 评分指引 · 结合林老师记叙文框架 · 提供范文参考</div>
        </div>

        {/* Input */}
        {state === 'input' && (
          <div className="fade">
            <div className="card">
              <div className="card-label"><span className="lnum">1</span> 作文题目</div>
              <div className="card-hint">填写题目有助于评估内容切题程度（可选）</div>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="例：那一次，我学会了坚持……" />
              <div className="card-label"><span className="lnum">2</span> 粘贴你的记叙文</div>
              <div className="card-hint">O Level 建议字数：350–500字</div>
              <textarea value={essay} onChange={e => setEssay(e.target.value)} placeholder="在此粘贴你的记叙文……" />
              <div className="row">
                <span className={`wc ${wordCount >= 350 ? 'ok' : wordCount > 100 ? '' : 'low'}`}>{wordCount} 字</span>
                <button className="btn-main" onClick={markEssay} disabled={wordCount < 80}>开始批改 →</button>
              </div>
              {error && <div className="error">{error}</div>}
            </div>
          </div>
        )}

        {/* Loading */}
        {state === 'loading' && (
          <div className="card fade">
            <div className="loading-wrap">
              <div className="loading-char">批改中…</div>
              <div className="loading-msg">正在根据 SEAB 1160 评分指引与林老师记叙文框架批改，约需 20–30 秒……</div>
              <div className="loading-steps">
                {['检查框架结构','评估内容层次','分析语文结构','EASI手法评估','撰写考官评语'].map((s,i) => (
                  <span key={i} className="lstep on">{s}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {state === 'results' && results && (
          <div className="fade">
            {/* Grade banner */}
            <div className="grade-banner">
              <div className="grade-ring">
                <div className="grade-letter">{results.grade}</div>
                <div className="grade-pts">{results.total_score}/40</div>
              </div>
              <div>
                <div className="grade-name">{results.grade_label} · 等级 {results.grade}</div>
                <div className="grade-desc">SEAB 1160 华文（普通水准）写作 · 记叙文</div>
                <div className="score-pills">
                  <span className="spill">内容 {results.content_score}/20（第{results.content_band}级）</span>
                  <span className="spill">语文与结构 {results.language_score}/20（第{results.language_band}级）</span>
                </div>
              </div>
            </div>

            {/* Score bars + Content */}
            <div className="grid2">
              <div className="card">
                <div className="sec-head">
                  <div className="sec-icon" style={{background:'#edf7f1'}}>📊</div>
                  <div><div className="sec-title">分项得分</div><div className="sec-sub">Score Breakdown</div></div>
                </div>
                {[
                  { label: '内容 Content', score: results.content_score, max: 20 },
                  { label: '语文与结构', score: results.language_score, max: 20 },
                  { label: '总分 Total', score: results.total_score, max: 40 },
                ].map(b => {
                  const pct = Math.round((b.score / b.max) * 100);
                  return (
                    <div key={b.label} className="bar-wrap">
                      <div className="bar-top"><span>{b.label}</span><strong>{b.score}/{b.max}</strong></div>
                      <div className="bar-track"><div className="bar-fill" style={{width: pct + '%', background: barColor(pct)}} /></div>
                    </div>
                  );
                })}
              </div>
              <div className="card">
                <div className="sec-head">
                  <div className="sec-icon" style={{background:'#fdf6e3'}}>📝</div>
                  <div><div className="sec-title">内容与语文评析</div><div className="sec-sub">Content & Language</div></div>
                </div>
                <p style={{fontSize:'0.87rem',color:'#3d3020',lineHeight:1.8,marginBottom:12}}>{results.content_feedback}</p>
                <p style={{fontSize:'0.87rem',color:'#3d3020',lineHeight:1.8}}>{results.language_feedback}</p>
              </div>
            </div>

            {/* Framework */}
            <div className="card">
              <div className="sec-head">
                <div className="sec-icon" style={{background:'#f5eeff'}}>🗂</div>
                <div><div className="sec-title">林老师框架检查</div><div className="sec-sub">Narrative Framework</div></div>
              </div>
              <div className="fw-grid">
                {fwItems.map(f => {
                  const item = results.framework?.[f.key] || { status: 'warn', comment: '' };
                  const c = fwColor(item.status);
                  return (
                    <div key={f.key} className="fw-item" style={{background: c.bg, borderColor: c.border, color: c.text}}>
                      <span className="fw-icon">{c.icon}</span>
                      <div><div className="fw-lbl">{f.label}</div>{item.comment}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* EASI */}
            <div className="card">
              <div className="sec-head">
                <div className="sec-icon" style={{background:'#eaf2fb'}}>✍️</div>
                <div><div className="sec-title">EASI 人物描写手法</div><div className="sec-sub">Character Description</div></div>
              </div>
              <div className="easi-grid">
                {easiItems.map(e => {
                  const item = results.easi?.[e.k] || { rating: 'ok', score_label: '', comment: '' };
                  const c = easiColor(item.rating);
                  return (
                    <div key={e.k} className="easi-item" style={{background: c.bg, borderColor: c.border}}>
                      <div className="easi-letter" style={{color: c.border}}>{e.k}</div>
                      <div className="easi-name">{e.name}</div>
                      <div className="easi-score" style={{color: c.border}}>{item.score_label}</div>
                      <div className="easi-comment">{item.comment}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Language errors + Structure */}
            <div className="grid2">
              <div className="card">
                <div className="sec-head">
                  <div className="sec-icon" style={{background:'#fdf0ee'}}>🔍</div>
                  <div><div className="sec-title">语文问题</div><div className="sec-sub">Language Errors</div></div>
                </div>
                <ul className="err-list">
                  {results.language_errors?.length ? results.language_errors.map((e,i) => (
                    <li key={i} className={`err-item ${e.type}`}><div className="err-lbl">{e.label}</div>{e.text}</li>
                  )) : <li style={{fontSize:'0.84rem',color:'#8a7a60',fontStyle:'italic'}}>语言运用良好，无明显错误。✓</li>}
                </ul>
              </div>
              <div className="card">
                <div className="sec-head">
                  <div className="sec-icon" style={{background:'#eaf2fb'}}>🏗</div>
                  <div><div className="sec-title">结构与表达</div><div className="sec-sub">Structure & Style</div></div>
                </div>
                <ul className="err-list">
                  {results.structure_notes?.length ? results.structure_notes.map((e,i) => (
                    <li key={i} className={`err-item ${e.type}`}><div className="err-lbl">{e.label}</div>{e.text}</li>
                  )) : <li style={{fontSize:'0.84rem',color:'#8a7a60',fontStyle:'italic'}}>结构整体良好。✓</li>}
                </ul>
              </div>
            </div>

            {/* Improvements */}
            <div className="card">
              <div className="sec-head">
                <div className="sec-icon" style={{background:'#edf7f1'}}>🌱</div>
                <div><div className="sec-title">改进建议</div><div className="sec-sub">How to Improve</div></div>
              </div>
              <ul className="sug-list">
                {results.improvements?.map((imp,i) => (
                  <li key={i} className="sug-item"><span style={{color:'#1a6e40',flexShrink:0}}>✦</span><span>{imp}</span></li>
                ))}
              </ul>
            </div>

            {/* Examiner comment */}
            <div className="card">
              <div className="sec-head">
                <div className="sec-icon" style={{background:'#f2ede3'}}>📋</div>
                <div><div className="sec-title">老师总评</div><div className="sec-sub">Teacher Leon&apos;s Comment</div></div>
              </div>
              <div className="examiner-box">
                <div className="examiner-text">{results.examiner_comment}</div>
                <div className="examiner-sig">— 林纯隆老师 · 林老师双语学堂 · O Level 1160 考官</div>
              </div>
            </div>

            {/* Sample essay */}
            <div className="card sample-card">
              <div className="sec-head">
                <div className="sec-icon" style={{background:'#fdf6e3'}}>⭐</div>
                <div><div className="sec-title" style={{color:'#a07820'}}>生成范文</div><div className="sec-sub">Model Essay · Your Story Elevated</div></div>
              </div>
              <p style={{fontSize:'0.87rem',color:'#3d3020',lineHeight:1.7,marginBottom:18}}>
                根据你的作文题目与故事内容，结合林老师框架与 EASI 手法，生成一篇示范作文供参考学习。
              </p>
              {sampleState === 'idle' && (
                <button className="btn-gold" onClick={generateSample}>⭐ 点击生成范文</button>
              )}
              {sampleState === 'loading' && (
                <div style={{display:'flex',alignItems:'center',gap:12,padding:'20px 0',color:'#8a7a60',fontStyle:'italic',fontSize:'0.88rem'}}>
                  <div className="dots"><span/><span/><span/></div>
                  正在生成范文，约需 15–20 秒……
                </div>
              )}
              {sampleState === 'error' && (
                <div>
                  <p style={{color:'#b83222',fontSize:'0.84rem',marginBottom:12}}>生成时出现错误，请重试。</p>
                  <button className="btn-gold" onClick={generateSample}>重试</button>
                </div>
              )}
              {sampleState === 'done' && sampleEssay && (
                <div>
                  <div style={{fontFamily:'Noto Serif SC,serif',fontSize:'0.95rem',fontWeight:600,color:'#a07820',marginBottom:14,paddingBottom:12,borderBottom:'1px solid #e0d5c0'}}>
                    ⭐ 范文示例 — 题目：{title || '（无题目）'}
                  </div>
                  <div className="sample-body" dangerouslySetInnerHTML={{__html: formatSample(sampleEssay)}} />
                  <div className="sample-note">※ 此范文仅供参考学习，切勿直接抄写。请以此为范例，理解各段落写法，再用自己的语言重写。</div>
                </div>
              )}
            </div>

            <div className="center-row">
              <button className="btn-ghost" onClick={reset}>← 批改另一篇作文</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
