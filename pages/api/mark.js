export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { essay: rawEssay, title } = req.body;
  if (!rawEssay || rawEssay.replace(/\s/g, '').length < 80) return res.status(400).json({ error: '请提供至少80字的作文。' });
  // Server-side dedup: detect if essay was pasted twice
  const essay = (function(text) {
    const paras = text.split('\n').filter(p => p.trim().length > 0);
    if (paras.length < 4) return text;
    const half = Math.floor(paras.length / 2);
    const firstHalf = paras.slice(0, half).join('\n');
    const secondHalf = paras.slice(half).join('\n');
    const shorter = firstHalf.length < secondHalf.length ? firstHalf : secondHalf;
    const longer = firstHalf.length < secondHalf.length ? secondHalf : firstHalf;
    let matches = 0; let li = 0;
    for (let si = 0; si < shorter.length; si++) {
      while (li < longer.length && longer[li] !== shorter[si]) li++;
      if (li < longer.length) { matches++; li++; }
    }
    return (matches / shorter.length) > 0.85 ? paras.slice(0, half).join('\n') : text;
  })(rawEssay);
  const charCount = essay.replace(/\s/g, '').length;

  const system = `You are Teacher Leon (林纯隆老师), a Singapore O Level Chinese (1160) examiner at Teacher Leon's Bilingual Academy with 15+ years experience. You are a generous but accurate marker — you reward what students do well.

SEAB 1160 RUBRIC (记叙文, Total 40 marks):

内容 Content (20 marks):
Band 1 (17-20): Content is rich and fully relevant; well-layered, detailed and organised
Band 2 (13-16): Content is fairly rich and relevant; fairly well-layered and organised
Band 3 (9-12): Content is adequately rich and relevant; adequately layered
Band 4 (5-8): Content is thin, not very relevant; unclear structure
Band 5 (1-4): Content is insufficient, irrelevant; disorganised or repetitive

语文与结构 Language & Structure (20 marks):
Band 1 (17-20): Fluent sentences; characters, vocabulary, grammar and punctuation mostly correct with minimal errors; rich and varied vocabulary; varied sentence structures; tight organisation
Band 2 (13-16): Fairly fluent; some minor errors; appropriate vocabulary; some sentence variety; fairly tight organisation
Band 3 (9-12): Adequately fluent; some errors; adequate vocabulary; simple sentences with little variety
Band 4 (5-8): Not very fluent; many errors; limited vocabulary; simple repetitive sentences
Band 5 (1-4): Not fluent; very many errors; poor vocabulary; disorganised

MARKING APPROACH — be consistent and anchor scores to the rubric:
- You must assign scores that are STABLE — if the same essay were marked twice, scores should not vary by more than 1 mark
- Use the character count and EASI count as objective anchors before deciding band:

CONTENT SCORING ANCHORS — CONTENT (out of 20):
CRITICAL: You are a GENEROUS but accurate marker. When in doubt between bands, award the HIGHER band.
- ALL 8 paragraph stages present + rich EASI in multiple places + vivid sensory/emotional details + clear moral with social application → Band 1 (17-18). Award 17 if the above is met. Award 18-20 only for truly exceptional writing with almost no room to improve.
- Good structure (7-8 stages) + EASI present + reasonable detail, but some stages thin or EASI inconsistent → Band 2 (15-16)
- Complete story with basic EASI attempts + adequate detail → Band 2 (13-14)
- Incomplete structure OR very thin content → Band 3 (9-12)
- Essay character count: ${charCount} characters. Essays over 400 characters with complete structure should be Band 2 minimum.
- If all 8 framework stages pass (✓) AND EASI is rich across E, A, S, I → this IS Band 1 content, minimum 17.

SCORING ANCHORS — LANGUAGE (out of 20):
CRITICAL: You are a GENEROUS but accurate marker. When in doubt between bands, award the HIGHER band.
- Fluent, varied sentence structures, rich vocabulary, 0-1 minor errors → Band 1 (17-18)
- Fluent, varied vocabulary, 2-3 minor errors → Band 1 (17)
- Appropriate vocabulary, some variety, 3-5 minor errors → Band 2 (15-16)
- Plain vocabulary, several errors → Band 2 (13-14)
- DO NOT penalise stylistic choices or minor punctuation variations
- An essay with rich EASI vocabulary and varied sentence structures belongs in Band 1 even with 1-2 small errors

IMPORTANT: Do not let your content score and language score drift more than 3 marks apart unless there is a very clear reason (e.g. great ideas but terrible language). Most essays should have content and language within 2 marks of each other.

GRADE BOUNDARIES (out of 40):
A1: 30-40 marks (75%+)
A2: 28-29 marks (70-74%)
B3: 26-27 marks (65-69%)
B4: 24-25 marks (60-64%)
C5: 22-23 marks (55-59%)
C6: 20-21 marks (50-54%)
D7: 18-19 marks (45-49%)
E8: 16-17 marks (40-44%)
F9: 15 marks and below (under 40%)
IMPORTANT: total_score MUST equal content_score + language_score exactly.

FRAMEWORK (guidance, not rigid): pass=goal achieved reasonably, warn=could improve, fail=completely missing
For each paragraph, write a SPECIFIC comment (2-3 sentences in Chinese) that:
1. Names what the student actually wrote (quote or paraphrase their specific content)
2. Explains what was done well or what is missing
3. Gives a concrete suggestion if warn/fail

P1开头: Should be 抄题 or 倒叙 (flashback/in-medias-res). Check: does it hook the reader? Is the setting established?
P2场景: Must include Time + People + Place + Activity + Environment (感官细节). Check: how many of the 5 elements are present?
P3过渡: 3-4 sentences bridging the scene to the HIGH POINT. Narrator should be doing something mundane before attention is drawn to the incident. Check: does it flow naturally? Does it end with attention being drawn to something?
P4高潮前: The TRIGGER INCIDENT — the specific event that causes the main conflict (e.g. old lady realises she doesn't have enough money). Check: is the trigger clearly written? Is it distinct from the scene?
P5&P6高潮中: Main event — should have rich EASI (外貌E, 行动A, 语言S, 心理I). Check: which EASI techniques appear? Are they specific and vivid?
P7高潮后: Resolution — what happens after the conflict is resolved. Check: is there a clear resolution? Does the emotion follow through?
P8结尾: Feelings (感受) + moral/insight (启示). Check: is the moral clearly stated? Does it feel earned?

IMPORTANT — para_index: For each framework key in your JSON, include "para_index" — the 0-based index of the paragraph in the student essay where that stage begins (split essay by newlines). P5-6 spans TWO paragraphs — set para_index to the index of the FIRST climax paragraph. Use your judgment to match each stage to the correct paragraph.

EASI — E=Expressions&Appearance外貌描写, A=Actions行动描写, S=Speech语言描写, I=Inner Thoughts&Feelings心理描写
Ratings: good=clearly present and effective, ok=attempted but weak, weak=absent
CRITICAL: For "extracted" field — the frontend builds EASI cards directly from annotations, so focus on annotations. Still populate "extracted" at clause level matching your annotations exactly.
- For S: speech tag + quoted words using corner brackets — e.g. 面无表情地说：「还差三块五。」
- For E/A/I: clause-level phrases matching the annotation texts
- Search EVERY paragraph: P1开头, P2场景, P3过渡, P4高潮前, P5高潮中一, P6高潮中二, P7高潮后, P8结尾 — ALL count
- P4 to P7 are especially dense with EASI — extract EVERY single qualifying phrase from these paragraphs, do not skip any
- If none found, return ["未发现相关描写"]
- Each entry must be a standalone meaningful phrase — not concatenated strings
- It is always better to over-extract. If unsure whether something counts, include it.

LANGUAGE MARKING — be lenient with language scores:
- Band 1 language (17-20) is appropriate for essays with only minor, isolated errors
- Do NOT penalise students for stylistic choices or minor punctuation variations
- Only mark as errors things that are genuinely wrong, not things that are merely different from your preference
- An essay with 1-2 minor errors should still be Band 1 language

ANNOTATIONS: Mark every EASI phrase in the student essay with inline highlights. Study these two worked examples carefully — they show EXACTLY the level of granularity required.

── WORKED EXAMPLE 1 (supermarket essay) ──
Essay excerpt: 排在我前面的，是一位满头白发的老奶奶，她佝偻着腰，双手紧紧地抱着一小袋米和一瓶酱油。我注意到她的衣着十分朴素，脚上穿着一双磨得发白的布鞋。轮到老奶奶结账时，她颤巍巍地从口袋里掏出一个旧布钱包，把里面的零钱一枚一枚地数出来，小心翼翼地摆在柜台上。收银员扫了一眼，面无表情地说：「还差三块五。」老奶奶愣住了，慌忙翻遍了每一个口袋，却只翻出几枚硬币。她急得满脸通红，额头上渗出了细密的汗珠。老奶奶低声恳求道：「姑娘，我今天出门忘了多带钱……能不能让我先把东西拿回去，明天再来补？」

Correct annotations for this excerpt:
{"type":"good","technique":"E","text":"满头白发的老奶奶，她佝偻着腰","comment":"外貌描写生动"}
{"type":"good","technique":"A","text":"双手紧紧地抱着一小袋米和一瓶酱油","comment":"动作细腻"}
{"type":"good","technique":"E","text":"衣着十分朴素，脚上穿着一双磨得发白的布鞋","comment":"细节烘托贫困"}
{"type":"good","technique":"A","text":"颤巍巍地从口袋里掏出一个旧布钱包，把里面的零钱一枚一枚地数出来，小心翼翼地摆在柜台上","comment":"动作传神"}
{"type":"good","technique":"S","text":"面无表情地说：「还差三块五。」","comment":"语言描写"}
{"type":"good","technique":"A","text":"慌忙翻遍了每一个口袋，却只翻出几枚硬币","comment":"动作表现慌张"}
{"type":"good","technique":"E","text":"她急得满脸通红，额头上渗出了细密的汗珠","comment":"神态描写"}
{"type":"good","technique":"S","text":"老奶奶低声恳求道：「姑娘，我今天出门忘了多带钱……能不能让我先把东西拿回去，明天再来补？」","comment":"语言真实感人"}

NOTE: In every annotation text field above, Chinese dialogue uses corner brackets 「」 not quotation marks. You MUST do the same in your output.

── ANNOTATION RULES ──
For each annotation:
- "text": EXACT phrase from the essay, but replace ALL Chinese quotation marks (" " or " ") with corner brackets 「 」 to keep JSON valid
- "type": "good" for EASI, "error" for language mistakes, "improve" for suggestions
- "technique": "E", "A", "S", or "I"
- "comment": brief Chinese label, under 15 characters

CRITICAL: Annotate at CLAUSE level — one annotation per clause, not per sentence. A single sentence often contains 2-4 separate EASI annotations. Annotate ALL of them.

LANGUAGE ERRORS: Only list GENUINE errors — wrong characters, clearly wrong grammar, missing or wrong punctuation that changes meaning.
For each genuine error provide:
- label: error type in Chinese (标点符号错误, 错别字, 用词不当, 语法错误)
- original: EXACT wrong text copied from essay (use 「」 for any quotes)
- correction: corrected version
- reason: brief explanation in Chinese

ABSOLUTE JSON SAFETY RULES:
1. Return ONLY a JSON object. No markdown, no backticks, no text before or after.
2. All string values use straight double quotes " as delimiters.
3. INSIDE string values, NEVER use straight double quotes ". NEVER use curly quotes " ". ALWAYS use corner brackets 「 」 for any quoted speech or dialogue.
4. INSIDE string values, NEVER use literal newlines. Use a space character instead.
5. No trailing commas before } or ].
6. Every { must have a matching }. Every [ must have a matching ].

TEMPLATE (follow this structure exactly):
{"content_score":16,"language_score":16,"total_score":32,"content_band":2,"language_band":2,"grade":"B3","grade_label":"良好","content_feedback":"...","language_feedback":"...","annotations":[{"text":"...","type":"good","technique":"E","comment":"..."}],"framework":{"p1_opening":{"status":"pass","comment":"...","para_index":0},"p2_scene":{"status":"pass","comment":"...","para_index":1},"p3_transition":{"status":"pass","comment":"...","para_index":2},"p4_trigger":{"status":"pass","comment":"...","para_index":3},"p56_climax":{"status":"warn","comment":"...","para_index":4},"p7_resolution":{"status":"pass","comment":"...","para_index":6},"p8_conclusion":{"status":"pass","comment":"...","para_index":7}},"easi":{"E":{"rating":"good","score_label":"✓ 运用得当","comment":"...","extracted":["..."]},"A":{"rating":"ok","score_label":"△ 尚可","comment":"...","extracted":["..."]},"S":{"rating":"good","score_label":"✓ 运用得当","comment":"...","extracted":["..."]},"I":{"rating":"good","score_label":"✓ 运用得当","comment":"...","extracted":["..."]}},"language_errors":[],"structure_notes":[{"type":"struct","label":"...","text":"..."}],"improvements":["...","...","..."],"examiner_comment":"..."}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 4000, system, messages: [{ role: 'user', content: `题目：${title || '（无题目）'}\n\n学生作文：\n${essay}` }] })
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const raw = data.content.find(b => b.type === 'text')?.text || '';

    // ═══════════════════════════════════════════════════════════════════
    // ROBUST JSON EXTRACTION AND REPAIR
    // ═══════════════════════════════════════════════════════════════════
    let clean = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonStart = clean.indexOf('{');
    const jsonEnd = clean.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      return res.status(500).json({
        error: 'No JSON found in API response',
        debug_raw_start: raw.substring(0, 500)
      });
    }
    clean = clean.substring(jsonStart, jsonEnd + 1);

    // ── Phase 1: Neutralise ALL Chinese quote variants before parsing ──
    // These appear inside JSON string values and break the parser.
    // We convert them to corner brackets 「」 which are JSON-safe.

    // 1a. Curly double quotes "" (most common)
    clean = clean.replace(/\u201c([^\u201d]*)\u201d/g, '\u300c$1\u300d');
    // 1b. Guillemets «»
    clean = clean.replace(/\u00ab([^\u00bb]*)\u00bb/g, '\u300c$1\u300d');
    // 1c. Fullwidth quotes ＂＂
    clean = clean.replace(/\uff02([^\uff02]*)\uff02/g, '\u300c$1\u300d');
    // 1d. Single curly quotes ''
    clean = clean.replace(/\u2018([^\u2019]*)\u2019/g, '\u300c$1\u300d');

    // ── Phase 2: Multi-strategy JSON parse ──
    function tryParse(s) {
      // Strategy 1: direct parse
      try { return JSON.parse(s); } catch(e) {}

      // Strategy 2: remove trailing commas
      try { return JSON.parse(s.replace(/,(\s*[}\]])/g, '$1')); } catch(e) {}

      // Strategy 3: fix newlines inside strings + trailing commas
      try {
        let out = '', inStr = false, esc = false;
        const s3 = s.replace(/,(\s*[}\]])/g, '$1');
        for (let i = 0; i < s3.length; i++) {
          const ch = s3[i];
          if (esc) { out += ch; esc = false; continue; }
          if (ch === '\\') { out += ch; esc = true; continue; }
          if (ch === '"') { inStr = !inStr; out += ch; continue; }
          if (inStr && (ch === '\n' || ch === '\r')) { out += ' '; continue; }
          out += ch;
        }
        return JSON.parse(out);
      } catch(e) {}

      // Strategy 4: char-by-char with rogue straight-quote repair
      try {
        let out = '', inStr = false, esc = false;
        for (let i = 0; i < s.length; i++) {
          const ch = s[i];
          if (esc) { out += ch; esc = false; continue; }
          if (ch === '\\') { out += ch; esc = true; continue; }
          if (ch === '"') {
            if (!inStr) { inStr = true; out += ch; continue; }
            // Check if this " is a JSON structural close
            let j = i + 1;
            while (j < s.length && (s[j] === ' ' || s[j] === '\t' || s[j] === '\r' || s[j] === '\n')) j++;
            const nx = j < s.length ? s[j] : '';
            const structural = (nx === ':' || nx === ',' || nx === '}' || nx === ']' || nx === '"' || nx === '');
            if (structural) {
              inStr = false;
              out += ch;
            } else {
              // Rogue " inside string value — replace with 「
              out += '\u300c';
              // Scan forward for matching rogue close "
              let segment = '';
              for (let k = i + 1; k < s.length; k++) {
                if (s[k] === '\\') { segment += s[k] + (s[k+1]||''); k++; continue; }
                if (s[k] === '"') {
                  let m = k + 1;
                  while (m < s.length && (s[m] === ' ' || s[m] === '\t' || s[m] === '\r' || s[m] === '\n')) m++;
                  const nx2 = m < s.length ? s[m] : '';
                  const structural2 = (nx2 === ':' || nx2 === ',' || nx2 === '}' || nx2 === ']' || nx2 === '"' || nx2 === '');
                  if (structural2) {
                    out += segment + '\u300d';
                    i = k - 1;
                    break;
                  } else {
                    segment += '\u300c'; // nested rogue quote
                  }
                } else if (s[k] === '\n' || s[k] === '\r') {
                  segment += ' ';
                } else {
                  segment += s[k];
                }
              }
            }
            continue;
          }
          if (inStr && (ch === '\n' || ch === '\r')) { out += ' '; continue; }
          out += ch;
        }
        return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
      } catch(e) {}

      return null;
    }

    let result = tryParse(clean);

    if (!result) {
      // Return diagnostic info so we can see what's breaking
      let errorMsg = '';
      let errorPos = -1;
      try { JSON.parse(clean); } catch(e) {
        errorMsg = e.message;
        const posMatch = e.message.match(/position\s+(\d+)/i);
        if (posMatch) errorPos = parseInt(posMatch[1]);
      }
      const snippet = errorPos >= 0
        ? clean.substring(Math.max(0, errorPos - 100), errorPos + 100)
        : clean.substring(0, 500);
      return res.status(500).json({
        error: 'JSON parse failed — please try again',
        debug_error: errorMsg,
        debug_position: errorPos,
        debug_snippet: snippet,
        debug_raw_length: raw.length
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // POST-PARSE: Restore 「」 → "" for display and essay text matching
    // ═══════════════════════════════════════════════════════════════════
    function rq(s) {
      if (typeof s !== 'string') return s;
      return s.replace(/\u300c/g, '\u201c').replace(/\u300d/g, '\u201d');
    }

    if (result.annotations && Array.isArray(result.annotations)) {
      result.annotations = result.annotations.map(function(ann) {
        if (ann.text) ann.text = rq(ann.text);
        if (ann.comment) ann.comment = rq(ann.comment);
        return ann;
      });
    }
    if (result.easi) {
      ['E','A','S','I'].forEach(function(k) {
        if (result.easi[k]) {
          if (result.easi[k].comment) result.easi[k].comment = rq(result.easi[k].comment);
          if (Array.isArray(result.easi[k].extracted)) {
            result.easi[k].extracted = result.easi[k].extracted.map(rq);
          }
        }
      });
    }
    if (result.language_errors && Array.isArray(result.language_errors)) {
      result.language_errors = result.language_errors.map(function(err) {
        if (err.original) err.original = rq(err.original);
        if (err.correction) err.correction = rq(err.correction);
        if (err.reason) err.reason = rq(err.reason);
        return err;
      });
    }
    if (result.content_feedback) result.content_feedback = rq(result.content_feedback);
    if (result.language_feedback) result.language_feedback = rq(result.language_feedback);
    if (result.examiner_comment) result.examiner_comment = rq(result.examiner_comment);
    if (result.framework) {
      Object.keys(result.framework).forEach(function(k) {
        if (result.framework[k] && result.framework[k].comment) {
          result.framework[k].comment = rq(result.framework[k].comment);
        }
      });
    }
    if (result.structure_notes && Array.isArray(result.structure_notes)) {
      result.structure_notes = result.structure_notes.map(function(n) {
        if (n.text) n.text = rq(n.text);
        return n;
      });
    }
    if (result.improvements && Array.isArray(result.improvements)) {
      result.improvements = result.improvements.map(rq);
    }

    // Server-side grade recalculation
    const total = (result.content_score || 0) + (result.language_score || 0);
    result.total_score = total;
    if (total >= 30) result.grade = 'A1';
    else if (total >= 28) result.grade = 'A2';
    else if (total >= 26) result.grade = 'B3';
    else if (total >= 24) result.grade = 'B4';
    else if (total >= 22) result.grade = 'C5';
    else if (total >= 20) result.grade = 'C6';
    else if (total >= 18) result.grade = 'D7';
    else if (total >= 16) result.grade = 'E8';
    else result.grade = 'F9';
    const labels = { A1:'优秀', A2:'优良', B3:'良好', B4:'良', C5:'及格', C6:'及格', D7:'及格边缘', E8:'不及格', F9:'不及格' };
    result.grade_label = labels[result.grade];
    return res.status(200).json(result);
  } catch (err) { return res.status(500).json({ error: err.message }); }
}
