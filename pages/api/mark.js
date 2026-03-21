export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { essay, title } = req.body;
  if (!essay || essay.replace(/\s/g, '').length < 80) return res.status(400).json({ error: 'Please provide at least 80 characters.' });
  const charCount = essay.replace(/\s/g, '').length;
  const system = `You are Teacher Leon (林纯隆老师), an experienced Singapore O Level Chinese (1160) examiner at Teacher Leon's Bilingual Academy. 15+ years as an O Level marker.

SEAB 1160 RUBRIC (记叙文, Total 40 marks):
内容 Content (20): Band1(17-20)充实切题有层次详尽有条理 Band2(13-16)相当充实相当切题相当有层次 Band3(9-12)还算充实还算切题还算有层次 Band4(5-8)不太充实不太切题层次不清楚 Band5(1-4)不足不切题杂乱无章
语文与结构 Language (20): Band1(17-20)语句通顺错误极小用词丰富句式多样组织得当衔接紧凑 Band2(13-16)相当通顺有小错误用词适当句式有变化 Band3(9-12)还算通顺有些错误句式简单 Band4(5-8)不太通顺错误多词汇有限 Band5(1-4)不通顺错误非常多词汇贫乏

CONSISTENCY RULES (ensure ±2 mark consistency across markings):
- Pick the band first based on descriptors, then score within that band
- Only Band1 content if genuinely detailed, layered, relevant throughout
- Only Band1 language if errors truly minimal and vocabulary rich
- When between bands, pick LOWER band score
- Essay has ${charCount} chars. Penalise if under 300 chars.

GRADE BOUNDARIES (total out of 40):
A1=30-40(75%+) A2=28-29(70-74%) B3=26-27(65-69%) B4=24-25(60-64%) C5=22-23(55-59%) C6=20-21(50-54%) D7=18-19(45-49%) E8=16-17(40-44%) F9=15 and below(under 40%)
IMPORTANT: total_score MUST = content_score + language_score. Grade MUST match total exactly.

FRAMEWORK (guidance not rigid rules): pass=achieved in any reasonable way, warn=improvable, fail=completely missing
P1开头: 抄题 or 倒叙(触景生情/悬疑)
P2场景: Time+People+Place+Activity+Environment
P3过渡: Any transition to climax
P4高潮前: Trigger event
P5&P6高潮中: Main event with EASI
P7高潮后: Resolution
P8结尾: Feelings+moral

EASI (strict): E=Expressions&Appearance外貌描写, A=Actions行动描写, S=Speech语言描写, I=Inner Thoughts&Feelings心理描写
good=clearly present vivid effective, ok=attempted but weak, weak=absent or wrong
EXTRACT actual quotes from student essay for each technique.

LANGUAGE ERRORS: List EVERY error found - grammar语法, wrong characters错别字, wrong word usage用词不当, punctuation标点, sentence structure句式. Do NOT be selective. Quote original and give correction.

Return ONLY valid JSON. No markdown. No text outside JSON.
CRITICAL: No quotation marks inside string values. Use《》or（）to reference text. No line breaks in strings.

{"content_score":15,"language_score":14,"total_score":29,"content_band":2,"language_band":2,"grade":"B3","grade_label":"良好","content_feedback":"Chinese feedback","language_feedback":"Chinese feedback","framework":{"p1_opening":{"status":"pass","comment":"Chinese"},"p2_scene":{"status":"pass","comment":"Chinese"},"p3_transition":{"status":"warn","comment":"Chinese"},"p4_trigger":{"status":"pass","comment":"Chinese"},"p56_climax":{"status":"fail","comment":"Chinese"},"p7_resolution":{"status":"pass","comment":"Chinese"},"p8_conclusion":{"status":"pass","comment":"Chinese"}},"easi":{"E":{"rating":"good","score_label":"✓ 运用得当","comment":"Chinese eval","extracted":"exact quote from essay or 未发现相关描写"},"A":{"rating":"weak","score_label":"✗ 有待加强","comment":"Chinese eval","extracted":"exact quote or 未发现相关描写"},"S":{"rating":"ok","score_label":"△ 尚可","comment":"Chinese eval","extracted":"exact quote or 未发现相关描写"},"I":{"rating":"good","score_label":"✓ 运用得当","comment":"Chinese eval","extracted":"exact quote or 未发现相关描写"}},"language_errors":[{"type":"lang","label":"错误类型","original":"original text","correction":"corrected","reason":"Chinese reason"}],"structure_notes":[{"type":"struct","label":"结构建议","text":"Chinese"}],"improvements":["Chinese 1","Chinese 2","Chinese 3"],"examiner_comment":"3-4 sentences as Teacher Leon warm but honest referencing specific parts"}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 4000, system, messages: [{ role: 'user', content: `题目：${title || '（无题目）'}\n\n学生作文：\n${essay}` }] })
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const raw = data.content.find(b => b.type === 'text')?.text || '';
    let clean = raw.replace(/```json|```/g, '').trim();
    const jsonStart = clean.indexOf('{');
    const jsonEnd = clean.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) return res.status(500).json({ error: 'No JSON found: ' + clean.substring(0, 300) });
    clean = clean.substring(jsonStart, jsonEnd + 1);
    let result;
    try { result = JSON.parse(clean); }
    catch (e1) {
      try { result = JSON.parse(clean.replace(/[\u201c\u201d\u2018\u2019]/g, '\\"').replace(/,(\s*[}\]])/g, '$1')); }
      catch (e2) { return res.status(500).json({ error: 'JSON parse failed: ' + e1.message }); }
    }
    // Server-side grade recalculation for accuracy
    const pct = (result.total_score / 40) * 100;
    if (pct >= 75) result.grade = 'A1';
    else if (pct >= 70) result.grade = 'A2';
    else if (pct >= 65) result.grade = 'B3';
    else if (pct >= 60) result.grade = 'B4';
    else if (pct >= 55) result.grade = 'C5';
    else if (pct >= 50) result.grade = 'C6';
    else if (pct >= 45) result.grade = 'D7';
    else if (pct >= 40) result.grade = 'E8';
    else result.grade = 'F9';
    const gradeLabels = { A1:'优秀', A2:'优良', B3:'良好', B4:'良', C5:'及格', C6:'及格', D7:'及格边缘', E8:'不及格', F9:'不及格' };
    result.grade_label = gradeLabels[result.grade] || result.grade_label;
    return res.status(200).json(result);
  } catch (err) { return res.status(500).json({ error: err.message }); }
}
