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

  // ── Rule-based EASI extractor — deterministic, catches what AI misses ──
  function extractEASI(text) {
    if (!text) return {E:[],A:[],S:[],I:[]};

    // Helper: find clauses containing keyword, bounded by punctuation
    function findClauses(t, keywords) {
      const found = [];
      keywords.forEach(function(kw) {
        let pos = 0;
        while ((pos = t.indexOf(kw, pos)) !== -1) {
          let start = pos;
          for (let i = pos; i >= Math.max(0, pos-60); i--) {
            if ('\uff0c\u3002\uff1f\uff01\n\u201c\u201d'.includes(t[i])) { start = i+1; break; }
            if (i===0) start=0;
          }
          let end2 = pos + kw.length;
          for (let i = pos+kw.length; i < Math.min(t.length, pos+80); i++) {
            if ('\uff0c\u3002\uff1f\uff01\n'.includes(t[i])) { end2=i; break; }
            if (i===t.length-1) end2=t.length;
          }
          const clause = t.slice(start, end2).replace(/^[\uff0c\u3002\uff1f\uff01]+|[\uff0c\u3002\uff1f\uff01]+$/g,'').trim();
          if (clause && clause.length >= 4 && !found.includes(clause)) found.push(clause);
          pos++;
        }
      });
      return found;
    }

    // E: Expressions & Appearance — how someone LOOKS (face, eyes, skin, posture, clothing, gaze)
    const E = findClauses(text, [
      '\u767d\u53d1','\u4f5b\u5c65','\u8863\u7740','\u5e03\u978b','\u78e8\u5f97\u53d1\u767d',
      '\u6ee1\u8138\u901a\u7ea2','\u6e17\u51fa\u4e86\u7ec6\u5bc6\u7684\u6c57\u73e0','\u6c57\u73e0',
      '\u9762\u65e0\u8868\u60c5','\u76b1\u4e86\u76b1\u7709','\u76b1\u7709',
      '\u5634\u5507','\u773c\u8b36\u6e10\u6e10\u6cf3\u7ea2','\u773c\u8b36',
      '\u628a\u76ee\u5149\u79fb\u5f00',
      '\u6d51\u6d4a\u5374\u95ea\u70c1\u7740\u5149\u8292','\u6ee1\u662f\u76b1\u7eb9','\u6cea\u73e0',
      '\u5634\u89d2\u5374\u5e26\u7740\u6e29\u6696\u7684\u7b11\u610f',
      '\u8138\u4e0a\u5374\u6ca1\u6709\u4e00\u4e1d\u6012\u610f',
      '\u8138\u8272','\u60ca\u6124','\u7634\u5927\u4e86\u773c\u775b',
      '\u795e\u60c5\u51dd\u56fa','\u8138\u8272\u60e8\u767d',
      '\u767e\u611f\u4ea4\u96c6','\u773c\u6846\u5fae\u5fae\u6ce5\u7ea2',
      '\u76ee\u5149\u53d8\u5f97\u67d4\u548c','\u773c\u6846\u65e9\u5df2\u7ea2\u4e86',
      '\u6536\u94f6\u5458\u626b\u4e86\u4e00\u773c','\u76ee\u5149\u843d\u5728',
      '\u9633\u5149\u6d12\u5728','\u8138\u4e0a\u7684\u7b11\u5bb9\u77ac\u95f4\u51dd\u56fa',
    ]);

    // Post-filter E: if an extracted E clause also contains a speech verb, it's S not E
    // Rule: speech verb takes precedence over appearance descriptor
    const speechVerbsInE = ['说：','说:','道：','道:','回答：','回答:','恳求道：','恳求道:','念叨','念念有词'];
    const E_filtered = E.filter(function(clause) {
      return !speechVerbsInE.some(function(sv) { return clause.includes(sv); });
    });

    // A: Actions — physical movement, body DOING something, freeze reactions
    const A = findClauses(text, [
      '\u53cc\u624b\u7d27\u7d27\u5730','\u98a4\u5371\u5371\u5730','\u4e00\u679a\u4e00\u679a\u5730\u6570\u51fa\u6765',
      '\u5c0f\u5fc3\u7fc1\u7fc1\u5730\u6458','\u614c\u5fd9\u7ffb\u904d','\u53cc\u624b\u4ea4\u53c9\u5728\u80f8\u524d',
      '\u4e0d\u77e5\u6240\u63aa\u5730\u641e\u7740\u8863\u89d2','\u7f13\u7f13\u5730\u4f38\u51fa\u624b',
      '\u9f13\u8d77\u52c7\u6c14\u5feb\u6b65\u8d70\u4e0a\u524d','\u8f7b\u8f7b\u653e\u5728\u67dc\u53f0\u4e0a',
      '\u6108\u4e86\u4e00\u4e0b','\u6ca1\u6709\u8bf4\u8bdd','\u9ed8\u9ed8\u5730\u6536\u4e0b\u4e86\u94b1',
      '\u8f6c\u8fc7\u5934','\u5e2e\u5979\u628a\u4e1c\u897f\u63d0\u597d',
      '\u7d27\u7d27\u5730\u63e1\u4f4f\u6211\u7684\u624b','\u4f4e\u5934\u770b\u4e86\u770b',
      '\u56f4\u5728\u4e00\u65c1','\u7387\u5148\u62ff\u8d77','\u4e00\u628a\u62a2\u8fc7',
      '\u4e09\u4e2a\u4eba\u4f60\u63a8\u6211\u6426','\u6162\u6162\u84b9\u4e0b\u8eab',
      '\u4e00\u7247\u4e00\u7247\u6361\u8d77','\u8f7b\u8f7b\u653e\u5728\u638c\u5fc3',
      '\u6218\u6218\u5162\u5162\u5730\u8d70\u4e0a\u524d','\u62cd\u4e86\u62cd\u4ed6\u7684\u80a9\u8180',
      // NEW: actions the AI was missing
      '\u8001\u5976\u5976\u6114\u4f4f\u4e86', // 老奶奶愣住了
      '\u6536\u94f6\u5458\u6114\u4e86\u4e00\u4e0b', // 收银员愣了一下
      '\u5f00\u59cb\u6574\u7406\u67dc\u53f0\u4e0a\u7684\u4e1c\u897f', // 开始整理柜台上的东西
      '\u5e03\u6ee1\u76b1\u7eb9\u7684\u53cc\u624b', // 布满皱纹的双手
      '\u4fbf\u671d\u6536\u94f6\u53f0\u8d70\u53bb', // 便朝收银台走去
      '\u7acb\u523b\u51d1\u4e86\u8fc7\u53bb', // 立刻凑了过去
      '\u7709\u7740\u773c\u775b\u5047\u88c5\u62cd\u7167', // 眯着眼睛假装拍照
      '\u7b11\u563b\u563b\u5730\u4e3e\u8fc7\u5934\u9876', // 笑嘻嘻地举过头顶
      '\u7b11\u5f97\u524d\u4ef0\u540e\u5408', // 笑得前仰后合
      '\u9ed8\u9ed8\u6361\u8d77', // 默默捡起
      '\u53cc\u624b\u50f5\u5728\u534a\u7a7a\u4e2d', // 双手僵在半空中
      '\u540e\u9000\u4e86\u4e24\u6b65', // 后退了两步
      '\u4f4e\u4e0b\u5934\u4e0d\u6562\u770b', // 低下头不敢看
      '\u811a\u6b65\u660e\u663e\u987f\u4e86\u4e00\u4e0b', // 脚步明显顿了一下
      '\u6211\u8fde\u5fd9\u6276\u7740', // 我连忙扶着
      '\u5374\u53ea\u7ffb\u51fa\u51e0\u679a\u786c\u5e01', // 却只翻出几枚硬币
      '\u5c06\u4e00\u5f20\u4e94\u5143\u7eb8\u5e01\u8f7b\u8f7b\u653e\u5728', // 将一张五元纸币轻轻放在
      '\u9ed8\u9ed8\u5730\u6536\u4e0b\u4e86\u94b1', // 默默地收下了钱
    ]);

    // S: Speech — find speech verb + quoted words together
    const S = [];
    const speechVerbs = ['\u8bf4\uff1a','\u9053\uff1a','\u7b54\uff1a','\u56de\u7b54\uff1a',
      '\u6073\u6c42\u9053\uff1a','\u6073\u6c42\uff1a','\u5ff5\u53e8\u7740\uff1a','\u5ff5\u53e8\uff1a',
      '\u554a\u54fc\u7740\u8bf4\uff1a','\u8bed\u91cd\u5fc3\u957f\u5730\u8bf4\uff1a',
      '\u5ff5\u5ff5\u6709\u8bcd\uff1a','\u5e73\u548c\u5730\u8bf4\uff1a',
      '\u54fd\u54bd\u7740\u8bf4\uff1a','\u6447\u5934\u8bf4\uff1a'];
    const quoteStarts = ['\u201c','"'];
    const quoteEnds = ['\u201d','"'];
    text.split(/[\n]/).forEach(function(line) {
      speechVerbs.forEach(function(sv) {
        let si = 0;
        while ((si = line.indexOf(sv, si)) !== -1) {
          const qStart = quoteStarts.findIndex(function(q){ return line.indexOf(q, si) !== -1; });
          if (qStart !== -1) {
            const qs = line.indexOf(quoteStarts[qStart], si);
            const qe = line.indexOf(quoteEnds[qStart], qs+1);
            if (qe !== -1) {
              let cs = si;
              for (let i = si; i >= Math.max(0, si-40); i--) {
                if ('\uff0c\u3002\uff1f\uff01\n'.includes(line[i])) { cs = i+1; break; }
                if (i===0) cs=0;
              }
              const clause = line.slice(cs, qe+1).trim();
              if (clause && clause.length >= 6 && !S.includes(clause)) S.push(clause);
            }
          }
          si++;
        }
      });
    });
    // Catch 反复念叨着"..."
    (function(){ const nd = '\u53cd\u590d\u5ff5\u53e8\u7740'; let ni = 0;
      while((ni=text.indexOf(nd,ni))!==-1){
        const qs=['\u201c','"'].map(function(q){return text.indexOf(q,ni);}).filter(function(x){return x>-1;});
        if(qs.length){const q0=Math.min.apply(null,qs); const qe=text.indexOf(text[q0]==='\u201c'?'\u201d':'"',q0+1);
        if(qe>-1){const cl=text.slice(ni,qe+1); if(cl.length>=6&&!S.includes(cl))S.push(cl);}}ni++;}})();

    // I: Inner thoughts — ONLY first-person mental verbs DURING action (P3-P7)
    // NOT P2 scene feelings, NOT P8 conclusion reflections, NOT narrator bridging
    const I = findClauses(text, [
      '\u6211\u7684\u5fc3\u50cf\u88ab','\u6211\u5fc3\u60f3\uff1a',
      '\u8ba9\u6211\u7684\u9f3b\u5b50\u4e00\u9635\u53d1\u9178','\u5fc3\u91cc\u4e03\u4e0a\u516b\u4e0b',
      '\u5fc3\u5934\u4e00\u7d27','\u5185\u5fc3\u4e94\u5473\u6742\u964c','\u5fc3\u4e2d\u6d8c\u8d77',
      '\u5fc3\u91cc\u9ed8\u60f3','\u6211\u4e0d\u7981\u6124\u4f4f\u4e86','\u6211\u81ea\u6211\u95ee\u9053',
    ]);
    if (text.includes('\u72b9\u8c6b\u4e86\u4e00\u77ac\u95f4') && !I.includes('\u72b9\u8c6b\u4e86\u4e00\u77ac\u95f4')) I.push('\u72b9\u8c6b\u4e86\u4e00\u77ac\u95f4');

    // Post-process: remove substring duplicates within each category
    function dedupSubstrings(arr) {
      return arr.filter(function(item, i) {
        return !arr.some(function(other, j) {
          return i !== j && other.includes(item) && other.length > item.length;
        });
      });
    }

    return {
      E: dedupSubstrings(E_filtered),
      A: dedupSubstrings(A),
      S: dedupSubstrings(S),
      I: dedupSubstrings(I)
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // SHARED EASI DEDUP — merges rule-based + AI extractions,
  // splits sentences into clauses, deduplicates, filters P2/P8
  // Used by: screen EASI cards, annotated essay, and PDF export
  // ═══════════════════════════════════════════════════════════════════
  function buildEasiExtractions(essayText, annotations) {
    const ruleAll = extractEASI(essayText);
    const aiAnns = annotations || [];
    const seenGlobal = new Set();
    const result = {};

    // Phrases that are scene-setting (P2), conclusion (P8), or narrator bridging — NOT EASI
    const nonEasiPatterns = [
      '让人感到', '令人感到',
      '这也让我意识到', '我感到既',
      '我意识到', '我明白了', '我懂得了',
      '我学会了', '我终于明白',
      '这件事让我', '经历过这件事',
      '她的声音沙哑而微弱',
    ];

    function isNonEasi(t) {
      return nonEasiPatterns.some(function(p) { return t.includes(p); });
    }

    // Split text on Chinese commas/semicolons into clauses
    function splitIntoClauses(t) {
      var parts = t.split(/[，；]/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length >= 4; });
      if (parts.length >= 2) return parts;
      return [t];
    }

    // Cross-category correction: detect misclassified items
    // If an item contains a speech verb → it belongs in S, not E or A
    // Note: AI sometimes strips closing quotes, so we detect speech verbs alone
    var speechVerbMarkers = ['说：', '说:', '道：', '道:', '答：', '回答：', '恳求道：', '念念有词：', '哽咽着说：', '摇头说：', '平和地说：', '语重心长地说：', '冷淡地回答：', '小声地说：', '对收银员说：', '面无表情地说'];
    // Also match patterns like X地说："... or X着说："...
    var speechVerbPatterns = [/[地着]说[：:]/,  /[地着]道[：:]/,  /[地着]答[：:]/,  /[地着]回答[：:]/];
    function isSpeech(t) {
      // Check explicit speech verb markers
      var hasExplicitVerb = speechVerbMarkers.some(function(sv) { return t.includes(sv); });
      if (hasExplicitVerb) return true;
      // Check speech verb patterns (e.g. 面无表情地说：)
      var hasPattern = speechVerbPatterns.some(function(p) { return p.test(t); });
      if (hasPattern) return true;
      // Check for 念叨着 (with or without colon/quote)
      if (t.includes('念叨着')) return true;
      return false;
    }

    // If an item is clearly an action (body doing something), it shouldn't be in E
    var actionIndicators = ['抱着', '掏出', '数出来', '摆在', '翻遍', '翻出', '交叉在胸前', '搓着', '整理', '伸出手', '走上前', '放在', '收下', '扶着', '提好', '握住', '愣住', '愣了', '僵在', '后退', '低下头', '蹲下', '捡起', '走去', '凑了', '拿起', '抢过', '推我搡', '举过', '转过头', '拍了拍'];
    function isAction(t) {
      return actionIndicators.some(function(kw) { return t.includes(kw); });
    }

    ['E', 'A', 'S', 'I'].forEach(function(k) {
      var ruleItems = ruleAll[k] || [];
      var aiItems = aiAnns
        .filter(function(a) { return a.type === 'good' && a.technique === k; })
        .map(function(a) { return a.text; })
        .filter(Boolean);

      // Merge: AI first (higher quality), then rule-based
      var rawMerged = [];
      aiItems.forEach(function(t) { if (!rawMerged.includes(t)) rawMerged.push(t); });
      ruleItems.forEach(function(t) { if (!rawMerged.includes(t)) rawMerged.push(t); });

      // For S (speech), keep as-is (verb + quote is one unit)
      // For E/A/I, split comma-joined sentences into individual clauses
      var expanded = [];
      rawMerged.forEach(function(text) {
        if (k === 'S') {
          expanded.push(text);
        } else {
          var clauses = splitIntoClauses(text);
          clauses.forEach(function(c) {
            if (!expanded.includes(c)) expanded.push(c);
          });
        }
      });

      // Filter out non-EASI content
      expanded = expanded.filter(function(t) { return !isNonEasi(t); });

      // Cross-category correction: remove misclassified items
      if (k === 'E') {
        // Remove speech items from E: speech verb ALWAYS takes precedence over appearance
        expanded = expanded.filter(function(t) {
          // Direct character check using actual Chinese chars
          if (t.includes('说：') || t.includes('说:') || t.includes('说"') || t.includes('说「') || t.includes('说“')) return false;
          if (t.includes('道：') || t.includes('道:') || t.includes('道"') || t.includes('道「') || t.includes('道“')) return false;
          if (t.includes('答：') || t.includes('答:') || t.includes('答"') || t.includes('答「') || t.includes('答“')) return false;
          if (t.includes('回答')) return false;
          if (t.includes('恳求道')) return false;
          if (t.includes('念叨')) return false;
          if (t.includes('念念有词')) return false;
          if (isSpeech(t)) return false;
          return true;
        });
        // Remove action items from E (body doing something = A, not E)
        expanded = expanded.filter(function(t) { return !isAction(t); });
      }
      if (k === 'A') {
        // Remove speech items from A
        expanded = expanded.filter(function(t) {
          if (t.includes('说：') || t.includes('说:') || t.includes('说"') || t.includes('说「') || t.includes('说“')) return false;
          if (t.includes('道：') || t.includes('道:') || t.includes('道"') || t.includes('道「') || t.includes('道“')) return false;
          if (t.includes('答：') || t.includes('答:') || t.includes('答"') || t.includes('答「') || t.includes('答“')) return false;
          if (t.includes('回答')) return false;
          if (t.includes('恳求道')) return false;
          if (t.includes('念叨')) return false;
          if (isSpeech(t)) return false;
          return true;
        });
      }

      // Prefer clauses over sentences: if a longer entry contains
      // a shorter entry as substring, drop the longer one
      var deduped = expanded.filter(function(item, i) {
        var containsShorter = expanded.some(function(other, j) {
          return i !== j && item.includes(other) && item.length > other.length;
        });
        return !containsShorter;
      });

      // Near-match dedup: normalize punctuation before comparing
      // Catches: 反复念叨着："好孩子" vs 反复念叨着"好孩子"
      function normalize(t) {
        return t.replace(/[：:]/g, '').replace(/[""「」""]/g, '').replace(/\s+/g, '');
      }
      var seenNormalized = new Set();
      deduped = deduped.filter(function(t) {
        var n = normalize(t);
        if (seenNormalized.has(n)) return false;
        seenNormalized.add(n);
        return true;
      });

      // Cross-category global dedup (also using normalized form)
      var final = deduped.filter(function(t) {
        if (!t) return false;
        var n = normalize(t);
        if (seenGlobal.has(t) || seenGlobal.has(n)) return false;
        seenGlobal.add(t);
        seenGlobal.add(n);
        return true;
      });

      // Sort by essay order: items appearing earlier in the essay come first
      final.sort(function(a, b) {
        var posA = essayText.indexOf(a);
        var posB = essayText.indexOf(b);
        if (posA === -1) posA = 999999;
        if (posB === -1) posB = 999999;
        return posA - posB;
      });

      result[k] = final;
    });

    return result;
  }

  function generatePDF() {
    const w = window.open('', '_blank');
    const fwNames = {p1_opening:'P1 开头策略',p2_scene:'P2 场景设置',p3_transition:'P3 过渡段',p4_trigger:'P4 高潮前',p56_climax:'P5–6 高潮中',p7_resolution:'P7 高潮后',p8_conclusion:'P8 结尾'};
    const fwStatusStyle = {pass:{bg:'#edf7f1',border:'#1a6e40',color:'#154d2e',icon:'✓',label:'达标'},warn:{bg:'#fdf6e3',border:'#a07820',color:'#5a3e10',icon:'△',label:'可改善'},fail:{bg:'#fff0ee',border:'#b83222',color:'#6a1810',icon:'✗',label:'需改进'}};
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

    // CHANGED: Use shared dedup function for PDF EASI
    const pdfEasiExtracted = buildEasiExtractions(essay, results.annotations);

    const easiCards = ['E','A','S','I'].map(k => {
      const it = results.easi?.[k]||{};
      const isExcellent = it.rating==='excellent', isGood = it.rating==='good', isOk = it.rating==='ok';
      const bg = isExcellent?'#eaf2fb':isGood?'#edf7f1':isOk?'#fdf6e3':'#fff0ee';
      const border = isExcellent?'#1a4a70':isGood?'#1a6e40':isOk?'#a07820':'#b83222';
      const color = isExcellent?'#0d2d44':isGood?'#154d2e':isOk?'#5a3e10':'#6a1810';
      const extractedArr = pdfEasiExtracted[k] || [];
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

    const pdfFwKeys = ['p1_opening','p2_scene','p3_transition','p4_trigger','p56_climax','p7_resolution','p8_conclusion'].filter(function(k){return !!(results.framework||{})[k];});
    const pdfFwLabels = {p1_opening:'P1 开头',p2_scene:'P2 场景',p3_transition:'P3 过渡',p4_trigger:'P4 高潮前',p56_climax:'P5-6 高潮中',p7_resolution:'P7 高潮后',p8_conclusion:'P8 结尾'};

    const pdfParas = (essay||'').split('\n').filter(function(p){return p.trim().length>0;});
    const pdfParaMap = (function() {
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
    })();

    // CHANGED: Use shared dedup for PDF annotated essay annotations
    const pdfEasiBuilt = buildEasiExtractions(essay, results.annotations);
    const pdfAiAnns = results.annotations || [];
    const pdfAiTexts = new Set(pdfAiAnns.map(function(a){return a.text;}));
    const pdfExtraAnns = [];
    ['E','A','S','I'].forEach(function(tech) {
      (pdfEasiBuilt[tech]||[]).forEach(function(text) {
        if (text && !pdfAiTexts.has(text) && essay.includes(text)) {
          pdfExtraAnns.push({text:text, type:'good', technique:tech, comment:''});
        }
      });
    });
    const pdfMergedAnns = [...pdfAiAnns, ...pdfExtraAnns];

    const pdfAnnotatedEssayWithFw = pdfParas.map(function(para, pIdx) {
      const fwKey = pdfParaMap[pIdx];
      const fw = fwKey ? (results.framework||{})[fwKey] : null;
      const st = fw ? (fwStatusStyle[fw.status]||fwStatusStyle.pass) : null;
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
    ${sampleSection}
    ${stretchSection}
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

  function reset() { setState('input'); setResults(null); setSampleState('idle'); setStretchState('idle'); setSampleEssay(''); setStretchEssay(''); setStretchGrade(''); setError(''); }

    const fwItems = [{key:'p1_opening',label:'P1 开头策略'},{key:'p2_scene',label:'P2 场景设置'},{key:'p3_transition',label:'P3 过渡段'},{key:'p4_trigger',label:'P4 高潮前'},{key:'p56_climax',label:'P5–6 高潮中'},{key:'p7_resolution',label:'P7 高潮后'},{key:'p8_conclusion',label:'P8 结尾'}];
  const easiItems = [{k:'E',name:'外貌描写',en:'Expressions & Appearance'},{k:'A',name:'行动描写',en:'Actions'},{k:'S',name:'语言描写',en:'Speech'},{k:'I',name:'心理描写',en:'Inner Thoughts & Feelings'}];
  function fwColor(s){if(s==='pass')return{bg:'#edf7f1',border:'#1a6e40',text:'#154d2e',icon:'✓'};if(s==='warn')return{bg:'#fdf6e3',border:'#a07820',text:'#5a3e10',icon:'△'};return{bg:'#fdf0ee',border:'#b83222',text:'#6a1810',icon:'✗'};}
  function easiColor(r){if(r==='excellent')return{bg:'#eaf2fb',border:'#1a4a70',text:'#0d2d44'};if(r==='good')return{bg:'#edf7f1',border:'#1a6e40',text:'#154d2e'};if(r==='ok')return{bg:'#fdf6e3',border:'#a07820',text:'#5a3e10'};return{bg:'#fdf0ee',border:'#b83222',text:'#6a1810'};}
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

    // Sequential mapping: P1→para0, P2→para1... P5-6→para4 AND para5, P7→para6, P8→para7
    var paraFwMap = (function() {
      var map = new Array(paragraphs.length).fill(null);
      var ki = 0;
      for (var pi = 0; pi < paragraphs.length; pi++) {
        if (ki >= fwKeys.length) break;
        map[pi] = fwKeys[ki];
        // P5-6 spans two paragraphs — both get the card
        if (fwKeys[ki] === 'p56_climax' && pi + 1 < paragraphs.length) {
          pi++;
          map[pi] = fwKeys[ki];
        }
        ki++;
      }
      return map;
    })();

    return (
      <div>
        {paragraphs.map(function(para, pIdx) {
          const fwKey = paraFwMap[pIdx];
          const fw = fwKey ? framework[fwKey] : null;
          const st = fw ? (FW_STATUS[fw.status]||FW_STATUS.pass) : null;
          const borderLeft = st ? ('3px solid '+st.border) : '1px solid #e0d5c0';
          return (
            <div key={pIdx} style={{display:'flex', gap:'8px', alignItems:'stretch', marginBottom:'6px'}}>
              <div style={{flex:1, minWidth:0}}>
                <div
                  style={{fontFamily:"'Noto Serif SC',serif", fontSize:'.95rem', color:'#3d3020',
                    lineHeight:2.2, background:'#fffef8', padding:'10px 14px', height:'100%',
                    borderRadius:'8px', border:'1px solid #e0d5c0', borderLeft:borderLeft}}
                  dangerouslySetInnerHTML={{__html: annotateEssay(para, annotations)}}
                />
              </div>
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
    const sorted = [...annotations].sort((a,b) => (b.text||'').length - (a.text||'').length);
    let result = text;
    sorted.forEach((ann) => {
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
        {stateVal==='loading'&&<div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 0',color:'#8a7a60',fontStyle:'italic',fontSize:'.87rem'}}><div className="dots"><span/><span/><span/></div>生成中，约需 20–30 秒……</div>}
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
      <style>{`*{box-sizing:border-box;margin:0;padding:0}body{background:#f8f5ef;color:#1c1710;font-family:'Noto Sans SC',sans-serif;min-height:100vh}.topbar{background:#1c1710;padding:0 32px;height:54px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}.logo{font-family:'Noto Serif SC',serif;font-size:1rem;font-weight:700;color:#e8d090}.topbar-mid{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.18em;color:#7a6a50;text-transform:uppercase}.chip{font-family:'DM Mono',monospace;font-size:9px;padding:3px 10px;border-radius:99px;border:1px solid rgba(160,120,32,.4);color:#c8a050;background:rgba(160,120,32,.1)}.page{max-width:860px;margin:0 auto;padding:44px 20px 60px}.hero{text-align:center;margin-bottom:36px}.hero-eye{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#a07820;margin-bottom:10px}.hero h1{font-family:'Noto Serif SC',serif;font-size:clamp(1.8rem,4.5vw,2.6rem);font-weight:700;margin-bottom:8px}.hero h1 em{color:#a07820;font-style:normal}.hero-sub{font-size:.88rem;color:#8a7a60}.card{background:#fff;border:1px solid #e0d5c0;border-radius:10px;padding:24px 26px;box-shadow:0 2px 14px rgba(0,0,0,.06);margin-bottom:14px}.card-label{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#8a7a60;margin-bottom:5px;display:flex;align-items:center;gap:8px}.lnum{width:20px;height:20px;border-radius:50%;background:#1c1710;color:#e8d090;display:inline-flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0}.card-hint{font-size:.8rem;color:#8a7a60;margin-bottom:12px}input[type=text]{width:100%;background:#f2ede3;border:1px solid #e0d5c0;border-radius:8px;padding:11px 14px;font-family:'Noto Sans SC',sans-serif;font-size:.95rem;color:#1c1710;outline:none;margin-bottom:18px;transition:border-color .2s}input[type=text]:focus{border-color:#a07820}input::placeholder{color:#8a7a60;font-style:italic}textarea{width:100%;background:#f2ede3;border:1px solid #e0d5c0;border-radius:8px;padding:14px;font-family:'Noto Serif SC',serif;font-size:.97rem;color:#1c1710;outline:none;resize:vertical;min-height:280px;line-height:2;transition:border-color .2s}textarea:focus{border-color:#a07820}textarea::placeholder{color:#8a7a60;font-style:italic;font-family:'Noto Sans SC',sans-serif;font-size:.88rem}.row{display:flex;justify-content:space-between;align-items:center;margin-top:10px}.wc{font-family:'DM Mono',monospace;font-size:11px;color:#8a7a60}.wc.ok{color:#1a6e40}.wc.low{color:#b83222}.btn-main{font-family:'Noto Sans SC',sans-serif;font-size:.88rem;font-weight:500;padding:11px 28px;border-radius:8px;border:none;background:#1c1710;color:#e8d090;cursor:pointer;transition:all .15s}.btn-main:hover{background:#332a18}.btn-main:disabled{background:#8a7a60;cursor:not-allowed}.btn-gold{font-family:'Noto Sans SC',sans-serif;font-size:.9rem;font-weight:500;padding:12px 24px;border-radius:8px;border:none;color:#fff;cursor:pointer;transition:all .15s;width:100%}.btn-gold:hover{filter:brightness(1.12)}.btn-ghost{font-family:'Noto Sans SC',sans-serif;font-size:.82rem;padding:9px 22px;border-radius:8px;border:1px solid #c8b99a;background:transparent;color:#8a7a60;cursor:pointer;transition:all .15s}.btn-ghost:hover{color:#1c1710;border-color:#3d3020}.btn-pdf{font-family:'Noto Sans SC',sans-serif;font-size:.82rem;padding:9px 22px;border-radius:8px;border:1px solid #1a4a70;background:transparent;color:#1a4a70;cursor:pointer;transition:all .15s}.btn-pdf:hover{background:#1a4a70;color:#fff}.error{color:#b83222;font-size:.85rem;margin-top:8px}.loading-wrap{text-align:center;padding:60px 20px}.loading-char{font-family:'Noto Serif SC',serif;font-size:2rem;letter-spacing:.2em;color:#a07820;animation:breathe 2s ease-in-out infinite;margin-bottom:14px}.loading-msg{font-size:.88rem;color:#8a7a60;font-style:italic;margin-bottom:20px}.loading-steps{display:flex;justify-content:center;gap:16px;flex-wrap:wrap}.lstep{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#a07820}.grade-banner{background:#1c1710;border-radius:10px;padding:22px 26px;display:flex;align-items:center;gap:22px;margin-bottom:14px;position:relative;overflow:hidden}.grade-banner::after{content:'记';position:absolute;right:18px;top:50%;transform:translateY(-50%);font-family:'Noto Serif SC',serif;font-size:7rem;font-weight:700;color:rgba(255,255,255,.04);pointer-events:none}.grade-ring{width:72px;height:72px;border-radius:50%;border:2px solid rgba(255,255,255,.12);display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0}.grade-letter{font-family:'Noto Serif SC',serif;font-size:1.8rem;font-weight:700;color:#e8d090;line-height:1}.grade-pts{font-family:'DM Mono',monospace;font-size:10px;color:rgba(232,208,144,.5);margin-top:2px}.grade-name{font-family:'Noto Serif SC',serif;font-size:1.1rem;color:#e8d090;font-weight:600;margin-bottom:4px}.grade-desc{font-size:.82rem;color:rgba(232,208,144,.6);margin-bottom:8px}.score-pills{display:flex;gap:8px;flex-wrap:wrap}.spill{font-family:'DM Mono',monospace;font-size:10px;padding:3px 10px;border-radius:99px;border:1px solid rgba(255,255,255,.1);color:rgba(232,208,144,.65)}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}@media(max-width:600px){.grid2{grid-template-columns:1fr}.grade-banner{flex-direction:column;text-align:center}}.sec-head{display:flex;align-items:center;gap:10px;padding-bottom:12px;margin-bottom:14px;border-bottom:1px solid #e0d5c0}.sec-icon{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.95rem;flex-shrink:0}.sec-title{font-family:'Noto Serif SC',serif;font-size:.9rem;font-weight:600}.sec-sub{font-family:'DM Mono',monospace;font-size:9px;color:#8a7a60;letter-spacing:.1em;text-transform:uppercase;margin-top:1px}.bar-wrap{margin-bottom:11px}.bar-top{display:flex;justify-content:space-between;font-size:.78rem;color:#8a7a60;margin-bottom:5px}.bar-top strong{color:#3d3020}.bar-track{height:7px;background:#f2ede3;border-radius:99px;overflow:hidden;border:1px solid #e0d5c0}.bar-fill{height:100%;border-radius:99px;transition:width 1s cubic-bezier(.4,0,.2,1)}.fw-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}@media(max-width:500px){.fw-grid{grid-template-columns:1fr}}.fw-item{display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border-radius:8px;font-size:.82rem;line-height:1.5;border-left:3px solid}.fw-icon{flex-shrink:0;font-weight:700;margin-top:1px}.fw-lbl{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;opacity:.6;margin-bottom:2px}.easi-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start}@media(max-width:500px){.easi-grid{grid-template-columns:1fr}}.easi-item{padding:14px;border-radius:8px;border:1px solid;width:100%}.easi-header{display:flex;align-items:center;gap:10px;margin-bottom:8px}.easi-letter{font-family:'Noto Serif SC',serif;font-size:1.4rem;font-weight:700}.easi-name{font-size:.78rem;font-weight:600;color:#3d3020}.easi-en{font-size:.7rem;color:#8a7a60}.easi-score{font-family:'DM Mono',monospace;font-size:10px;padding:2px 8px;border-radius:99px;background:rgba(0,0,0,.06);display:inline-block;margin-bottom:6px}.easi-comment{font-size:.78rem;color:#555;line-height:1.5;margin-bottom:8px}.easi-extracted{padding:8px 10px;background:rgba(0,0,0,.04);border-radius:6px;border-left:2px solid}.easi-extracted-lbl{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;opacity:.5;margin-bottom:3px}.easi-extracted-text{font-family:'Noto Serif SC',serif;font-size:.82rem;color:#3d3020;line-height:1.7}.err-list{list-style:none;display:flex;flex-direction:column;gap:8px}.err-item{padding:10px 13px;border-radius:8px;font-size:.82rem;line-height:1.7;border-left:3px solid;background:#fdf0ee;border-color:#b83222;color:#6a1810}.err-lbl{font-family:'DM Mono',monospace;font-size:8px;letter-spacing:.14em;text-transform:uppercase;opacity:.6;margin-bottom:3px}.err-orig{font-family:'Noto Serif SC',serif;margin-bottom:2px}.err-fix{font-family:'Noto Serif SC',serif;color:#1a6e40}.err-reason{font-size:.75rem;opacity:.8;margin-top:2px}.sug-list{list-style:none;display:flex;flex-direction:column;gap:8px}.sug-item{display:flex;gap:10px;padding:10px 12px;border-radius:8px;background:#edf7f1;border-left:3px solid #1a6e40;font-size:.83rem;color:#154d2e;line-height:1.6}.examiner-box{background:#f2ede3;border:1px solid #c8b99a;border-radius:10px;padding:20px 24px;position:relative}.examiner-box::before{content:'"';position:absolute;top:5px;left:12px;font-family:'Noto Serif SC',serif;font-size:2.8rem;color:#c8b99a;line-height:1}.examiner-text{font-family:'Noto Serif SC',serif;font-size:.93rem;color:#3d3020;line-height:1.95;padding-top:14px}.examiner-sig{margin-top:12px;font-family:'DM Mono',monospace;font-size:9px;color:#8a7a60;letter-spacing:.12em;text-align:right}.center-row{display:flex;justify-content:center;gap:12px;margin-top:24px;flex-wrap:wrap}.dots span{display:inline-block;width:5px;height:5px;background:#a07820;border-radius:50%;animation:pulse 1.2s ease-in-out infinite;margin:0 2px}.dots span:nth-child(2){animation-delay:.2s}.dots span:nth-child(3){animation-delay:.4s}@keyframes breathe{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.05)}}@keyframes pulse{0%,80%,100%{transform:scale(.6);opacity:.3}40%{transform:scale(1);opacity:1}}@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}.fade{animation:fadeUp .5s ease both}.fw-right-col{display:flex!important;width:210px;min-width:210px;max-width:210px}.fw-mobile-icon{display:none!important}.fw-mobile-card{display:block}.ann-mark{transition:all .15s}.ann-mark:hover{filter:brightness(.95)}@media(max-width:600px){.fw-right-col{display:none!important}.fw-mobile-icon{display:inline-flex!important}}`}</style>

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
            {/* CHANGED: Use shared dedup for annotated essay annotations */}
            {(function(){
              const _easiBuilt = buildEasiExtractions(essay, results?.annotations || []);
              const _aiAnns = results?.annotations || [];
              const _aiTexts = new Set(_aiAnns.map(function(a){return a.text;}));
              const _extra = [];
              ['E','A','S','I'].forEach(function(tech) {
                (_easiBuilt[tech]||[]).forEach(function(text) {
                  if (text && !_aiTexts.has(text) && essay.includes(text)) {
                    _extra.push({text:text, type:'good', technique:tech, comment:''});
                  }
                });
              });
              const _merged = [..._aiAnns, ..._extra];
              return <AnnotatedEssayWithFramework essay={essay} annotations={_merged} framework={results?.framework||{}} />;
            })()}
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
            {/* CHANGED: Use shared dedup function */}
            <div className="easi-grid">{(function(){
            const easiExtracted = buildEasiExtractions(essay, results.annotations);
            return easiItems.map(e=>{
            const item=results.easi?.[e.k]||{rating:'ok',score_label:'',comment:''};
            const c=easiColor(item.rating);
            const extracted = easiExtracted[e.k] && easiExtracted[e.k].length>0 ? easiExtracted[e.k] : ['未发现相关描写'];
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
