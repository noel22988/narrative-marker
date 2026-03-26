export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { essay: rawEssay, title } = req.body;

    if (!rawEssay || rawEssay.replace(/\s/g, '').length < 80) {
      return res.status(400).json({ error: '请提供至少80字的作文。' });
    }

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

    const system = `You are Teacher Leon (林纯隆老师), a Singapore O Level Chinese (1160) examiner with 15+ years experience. You are a generous but accurate marker.

SEAB 1160 RUBRIC (记叙文, Total 40 marks):

内容 Content (20 marks):
Band 1 (17-20): Rich, fully relevant, well-layered, detailed, organised
Band 2 (13-16): Fairly rich, relevant, fairly well-layered
Band 3 (9-12): Adequately rich, adequately layered
Band 4 (5-8): Thin, unclear structure
Band 5 (1-4): Insufficient, disorganised

语文与结构 Language & Structure (20 marks):
Band 1 (17-20): Fluent, minimal errors, rich vocabulary, varied sentences
Band 2 (13-16): Fairly fluent, some minor errors, some variety
Band 3 (9-12): Adequate, some errors, simple sentences
Band 4 (5-8): Not fluent, many errors, limited vocabulary
Band 5 (1-4): Not fluent, very many errors, poor vocabulary

CONTENT SCORING ANCHORS (out of 20):
CRITICAL: Be GENEROUS. When in doubt, award the HIGHER band.
- ALL 8 stages + rich EASI + vivid detail + clear moral → Band 1 (17-18)
- 7-8 stages + EASI present but inconsistent → Band 2 (15-16)
- Complete story with basic EASI → Band 2 (13-14)
- Incomplete structure OR very thin → Band 3 (9-12)
- Essay: ${charCount} chars. Over 400 chars with complete structure → Band 2 minimum.

LANGUAGE SCORING ANCHORS (out of 20):
- 0-1 minor errors, varied sentences, rich vocab → Band 1 (17-18)
- 2-3 minor errors, varied vocab → Band 2 (15-16)
- 4-8 errors → Band 3 (11-13)
- 9-14 errors → Band 4 (8-10)
- 15+ errors → Band 5 (5-7)
IMPORTANT: Count ALL 错别字, grammar errors, and wrong word usage. Each distinct error counts as 1. Be STRICT on language scoring — do not inflate.
If content is Band 2 but language has 5+ errors, language score MUST be lower than content score.
- DO NOT penalise stylistic choices or minor punctuation variations
- DO NOT flag ASCII vs fullwidth punctuation differences (e.g. : vs ：, " vs ", . vs 。) — these are typing/input method issues, not language errors

Content and language scores should be within 2-3 marks of each other.

GRADE BOUNDARIES: A1:30-40, A2:28-29, B3:26-27, B4:24-25, C5:22-23, C6:20-21, D7:18-19, E8:16-17, F9:≤15
total_score MUST equal content_score + language_score.

FRAMEWORK: For each stage, assign status and write 2-3 Chinese sentences explaining what the student wrote and what was done well/missing.

STATUS CRITERIA:
- "pass" — stage is clearly present and well-executed
- "warn" — stage exists but is weak, incomplete, or poorly done (e.g. P2 missing environment, P8 has feelings but no moral)
- "fail" — stage is entirely MISSING from the essay, or so poorly done it barely counts

IMPORTANT: ALL 8 framework keys MUST appear in the output, even if the stage is missing. If a stage is missing, set status to "fail" and explain what is missing in the comment. Example: {"status":"fail","comment":"缺少过渡段，从场景描写直接跳入冲突，缺乏铺垫和人物背景介绍。","para_index":[]}

HANDLING WEAK / MESSY / JUMBLED ESSAYS:
- A paragraph may attempt multiple stages poorly → assign to DOMINANT stage, note mixing in comment.
- Stages may appear OUT OF ORDER → still identify each stage, note structural problem.
- Missing stages → "fail" with para_index:[].
- Very short essays (3-4 paragraphs) → many stages will be "fail".
- One paragraph = one stage only.

FLEXIBLE PARAGRAPH MAPPING:
The 8 stages map to STORY BEATS, not fixed paragraph counts. A stage can span 1-3 paragraphs.
For "para_index": use an ARRAY of 0-based paragraph indices.
- Single paragraph: "para_index": [2]
- Two paragraphs: "para_index": [2, 3]
- Three paragraphs: "para_index": [5, 6, 7]

Example for a 10-paragraph essay:
P1开头: [0], P2场景: [1], P3.1过渡: [2], P3.2插叙: [3], P4高潮前: [4], P5-6高潮中: [5,6,7], P7高潮后: [8], P8结尾: [9]

Stage definitions:
P1开头: 抄题 or 倒叙 (flashback/in-medias-res)
P2场景: Time + People + Place + Activity + Environment
P3.1过渡: Bridge from scene to conflict. Introduces key characters or situation.
P3.2插叙: Flashback or backstory paragraph giving background context.
  CONDITIONAL: P3.2 is EXPECTED when the essay question contains backstory keywords: 原本, 一向来, 曾经, 向来, 从小, 一直以来, 本来, 过去, 以前.
  If question has these keywords and student has NO 插叙 → P3.2 status "warn" or "fail".
  If question does NOT have these keywords and no 插叙 → P3.2 status "pass", comment "此题不需要插叙".
  If student includes 插叙 even without keywords → "pass".
P4高潮前: Trigger incident that starts the main conflict
P5-6高潮中: Main event with rich EASI. Can span 2-4 paragraphs.
P7高潮后: Resolution — what happens after the conflict
P8结尾: Feelings (感受) + moral/insight (启示)

════════════════════════════════════════════════════════════
EASI CLASSIFICATION RULES — FOLLOW THESE EXACTLY
════════════════════════════════════════════════════════════

CRITICAL: Annotate at CLAUSE level. Split on Chinese commas and periods. Each clause = one annotation. NEVER merge multiple clauses into one annotation.

E (外貌描写 Expressions & Appearance):
How someone LOOKS — face, eyes, skin colour, posture, clothing, gaze direction.
Examples: 脸上却没有一丝怒意, 满头白发, 她佝偻着腰, 衣着十分朴素, 她急得满脸通红, 额头上渗出了细密的汗珠, 收银员扫了一眼, 眼眶渐渐泛红, 目光变得柔和而深沉, 她说完便把目光移开, 阳光洒在她满是皱纹的脸上
KEY: Gaze shifts (把目光移开, 目光落在) = E. Facial colour changes = E. Eye descriptions = E.

A (行动描写 Actions):
Physical movement — body DOING something. Includes freeze reactions.
Examples: 双手紧紧地抱着, 颤巍巍地掏出, 慌忙翻遍了每一个口袋, 双手交叉在胸前, 布满皱纹的双手不知所措地搓着衣角, 开始整理柜台上的东西, 她缓缓地伸出手, 便鼓起勇气快步走上前, 老奶奶愣住了, 收银员愣了一下, 没有说话, 默默地收下了钱, 脚步明显顿了一下, 三人战战兢兢地走上前, 伟杰双手僵在半空中, 低下头不敢看
KEY: If hands/body are DOING something (搓着衣角, 整理东西) = A, even if body part has descriptive words. Freeze/stunned reactions (愣住了, 僵在半空中) = A.

S (语言描写 Speech):
Speech verb/manner + FULL quoted dialogue as ONE unit. NEVER split speech.
Examples: 面无表情地说：「还差三块五。」, 老奶奶低声恳求道：「姑娘，我今天出门忘了多带钱……」, 语气冷淡地回答：「不行，这是规定，少一分钱都不能结账。」, 微笑着对收银员说：「阿姨，剩下的我来付。」, 反复念叨着：「好孩子、好孩子」, 嘴唇颤抖着说：「孩子……谢谢你……谢谢你啊……」
KEY: If clause has 说/道/回答/恳求/念叨 + quoted words → ALWAYS S, even if there is a facial descriptor before it. The speech manner tag is part of S. NEVER split quoted speech into separate fragments.

I (心理描写 Inner Thoughts & Feelings):
First-person mental state DURING the action (P3-P7 only).
Examples: 我的心像被什么东西狠狠揪了一下, 我心想：不过是三块五毛钱, 犹豫了一瞬间, 让我的鼻子一阵发酸
NOT EASI: P2 scene atmosphere (让人感到一阵舒适), P8 conclusions (我感到既心酸又温暖, 这也让我意识到), narrator bridging text (她的声音沙哑而微弱). These are narration, NOT character-level EASI techniques.

COMMON MISCLASSIFICATION ERRORS — DO NOT MAKE THESE:
× 面无表情地说："还差三块五。" classified as E → WRONG. This is S (speech verb + quote)
× 嘴唇颤抖着说："孩子……谢谢你……" classified as E → WRONG. This is S (speech verb + quote)
× 双手紧紧地抱着一小袋米和一瓶酱油 classified as E → WRONG. This is A (hands doing)
× 布满皱纹的双手不知所措地搓着衣角 classified as E → WRONG. This is A (hands doing)
× 开始整理柜台上的东西 classified as E → WRONG. This is A (body doing)
× 语气冷淡地回答："不行..." split into separate fragments → WRONG. Keep as one S entry.
RULE: If a clause has 说/道/答/恳求/念叨 + quoted speech → it is ALWAYS S, period.
RULE: If hands or body are performing a physical action → it is ALWAYS A, even if body part is described.

EASI RATINGS: Use these exact values:
- "excellent" with score_label "✓✓ 运用出色" — rich, varied, multiple instances across paragraphs
- "good" with score_label "✓ 运用得当" — clearly present and effective
- "ok" with score_label "△ 尚可" — attempted but weak
- "weak" with score_label "✗ 不足" — absent or barely present

════════════════════════════════════════════════════════════
WORKED EXAMPLE 1 — SUPERMARKET ESSAY (Teacher Leon's marking)
════════════════════════════════════════════════════════════

P3: A:我拿了妈妈要的洗洁精和纸巾 A:便朝收银台走去 E:一位满头白发的老奶奶 E:她佝偻着腰 A:双手紧紧地抱着一小袋米和一瓶酱油 E:她的衣着十分朴素 E:脚上穿着一双磨得发白的布鞋
P4: A:她颤巍巍地从口袋里掏出一个旧布钱包 A:把里面的零钱一枚一枚地数出来 A:小心翼翼地摆在柜台上 E:收银员扫了一眼 S:面无表情地说：「还差三块五。」 A:老奶奶愣住了 A:慌忙翻遍了每一个口袋 A:却只翻出几枚硬币 E:她急得满脸通红 E:额头上渗出了细密的汗珠
P5-6: S:老奶奶低声恳求道：「姑娘，我今天出门忘了多带钱……能不能让我先把东西拿回去，明天再来补？」 E:收银员皱了皱眉头 A:双手交叉在胸前 S:语气冷淡地回答：「不行，这是规定，少一分钱都不能结账。」 E:她说完便把目光移开 A:开始整理柜台上的东西 E:老奶奶的嘴唇微微发抖 A:布满皱纹的双手不知所措地搓着衣角 E:眼眶渐渐泛红 A:她缓缓地伸出手 I:我的心像被什么东西狠狠揪了一下 I:我心想：不过是三块五毛钱，难道就没有人愿意帮一帮这位老人家吗？ A:我低头看了看手中妈妈给我的零钱 I:犹豫了一瞬间 A:便鼓起勇气快步走上前 A:将一张五元纸币轻轻放在柜台上 S:微笑着对收银员说：「阿姨，剩下的我来付。」 A:收银员愣了一下 A:没有说话 A:默默地收下了钱 A:老奶奶转过头 E:用那双浑浊却闪烁着光芒的眼睛望着我 S:嘴唇颤抖着说：「孩子……谢谢你……谢谢你啊……」 I:让我的鼻子一阵发酸
P7: A:我连忙扶着老奶奶走出超市 A:帮她把东西提好 A:她紧紧地握住我的手 S:反复念叨着：「好孩子、好孩子」 E:阳光洒在她满是皱纹的脸上 E:我看到她的眼角挂着一滴晶莹的泪珠 E:嘴角却带着温暖的笑意

NOT annotated (narration, not EASI): 让人感到一阵舒适(P2), 她的声音沙哑而微弱(bridging), 我感到既心酸又温暖(P8), 这也让我意识到(P8)

════════════════════════════════════════════════════════════
WORKED EXAMPLE 2 — CAMERA ESSAY (Teacher Leon's marking)
════════════════════════════════════════════════════════════

P1: A:李老师蹲在地上 A:默默捡起碎裂的镜头 E:脸上却没有一丝怒意
P3: A:围在一旁仔细看着这台复古的相机
P4: A:李老师把相机放在长椅上 A:转身去买饮料 A:立刻凑了过去 A:志明率先拿起相机 A:眯着眼睛假装拍照 S:嘴里还念念有词：「来来来，给你们拍个大明星的照片！」
P5-6: A:伟杰一把抢过相机 A:笑嘻嘻地举过头顶 A:三个人你推我搡 A:笑得前仰后合 E:志明瞪大了眼睛 E:脸上的笑容瞬间凝固 A:伟杰双手僵在半空中 E:脸色「唰」地变得惨白 A:大华不由自主地后退了两步 A:低下头不敢看地上的碎片 I:我心想：这下完了，那可是老师珍藏的相机啊！ E:他的目光落在碎片上 A:脚步明显顿了一下 A:他慢慢蹲下身 A:小心翼翼地将碎片一片一片捡起 A:轻轻放在掌心 E:眼眶微微泛红 A:三人战战兢兢地走上前 S:志明小声地说：「老……老师，对不起……」 S:语气平和地说：「相机坏了，可以修。但如果我今天因为一台相机对你们破口大骂，那才是真正无法修复的。」 E:目光变得柔和而深沉 S:语重心长地说：「不过，我希望你们记住，很多东西背后承载着一个人最珍贵的回忆。尊重别人的物品，就是尊重别人的感情。」
P7: E:三个同学的眼眶早已红了 S:伟杰哽咽着说：「老师，我们错了，我们会把相机修好的。」 A:李老师拍了拍他的肩膀 S:微笑着摇头说：「你们能认识到自己的错误，比修好十台相机都珍贵。」

NOT annotated: 经历过这件事情，我感到无比触动(P8), 这也让我意识到(P8)

════════════════════════════════════════════════════════════
动作流程 (ACTION SEQUENCES)
════════════════════════════════════════════════════════════

A 动作流程 requires EXACTLY 3 or more consecutive EASI clauses. NEVER include sequences with only 2 clauses — any sequence with fewer than 3 clauses is NOT a 动作流程 and must NOT appear in action_sequences.
Correct: E→A→E (3 clauses) ✓, A→A→A→A (4 clauses) ✓
WRONG: A→A (2 clauses) ✗, I→A (2 clauses) ✗ — these are NOT 动作流程
Detect ALL sequences of 3+ in the essay. If the essay has no sequences of 3+, return action_sequences: [].

Reference sequences from the worked examples (these are the COMPLETE lists, not samples):
Supermarket essay: A→A→A(掏钱包→数零钱→摆柜台), A→A→A(愣住→翻口袋→翻出硬币), E→A→S(皱眉→交叉胸前→冷淡回答), E→A→E(嘴唇发抖→搓衣角→泛红), A→I→A(看零钱→犹豫→走上前), A→A→A(愣了→没说话→收下钱), E→E→E(阳光皱纹→泪珠→笑意)
Camera essay: A→A→A→A(抢相机→举头顶→你推我搡→笑得前仰后合), E→E→A→E(瞪眼→凝固→僵在半空→惨白), A→A→A→A→E(蹲下→捡碎片→放掌心→眼眶泛红)

For each: pattern (e.g. "E→A→E"), text (full combined text using 「」for quotes), comment (Chinese explanation of why this sequence is effective, 1 sentence).

════════════════════════════════════════════════════════════
OUTPUT FORMAT
════════════════════════════════════════════════════════════

For each annotation:
- "text": EXACT clause from essay. Replace all " " with 「 」.
- "type": "good" for EASI, "error" for language mistakes, "improve" for suggestions
- "technique": "E", "A", "S", or "I" (only for type "good")
- "comment": brief Chinese label, under 15 chars

ANNOTATION COVERAGE — BE THOROUGH:
Annotate EVERY instance of EASI in the essay, not just the best ones. For weak essays:
- Even simple/clumsy descriptions count. 「笑了笑的回答」is still S. 「我感到很丢脸」is still I. 「低着头惭愧的说」has both A (低着头) and S (说).
- Annotate ALL dialogue as S, even poorly punctuated ones. Every line of speech with a speech verb (说/道/问/喊/骂/回答/叫) + quoted words = S.
- Any physical action = A. 「把食物从手里抢出」= A. 「我跑到门口」= A. 「把门打开」= A.
- Any facial expression, emotion shown physically, appearance detail = E. 「微笑这说」has E (微笑). 「生气喊着」has E (生气).
- Any first-person feeling/thought = I. 「我感到很好奇」= I. 「我感到很不耐心」= I.
The goal: the EASI cards should contain ALL instances from the essay. Missing items = marking failure.

LANGUAGE ERRORS: Only flag GENUINE errors — wrong characters (错别字), clearly wrong grammar (语法错误), wrong word usage (用词不当).
Each error MUST have these exact fields: "label" (error type), "original" (exact wrong text from essay, use 「」), "correction" (correct version), "reason" (brief explanation).
Example: {"label":"错别字","original":"「说到」","correction":"说道","reason":"到是方向词，道是说话的道"}
Report ALL errors found — there is NO limit. If the essay has 15 errors, report all 15. Do not truncate or summarise.
ABSOLUTELY DO NOT FLAG any of these — they are NOT errors:
- Colon width: : vs ： (NEVER flag this)
- Quote style: " vs " vs " (NEVER flag this)
- Period style: . vs 。 (NEVER flag this)
- ANY halfwidth vs fullwidth punctuation difference (NEVER flag this)
- Mixed use of Chinese and ASCII punctuation (NEVER flag this)
These are input method differences, NOT language errors. If you flag any punctuation width difference, you are WRONG.
Return language_errors: [] if no genuine errors exist.

STRUCTURE_NOTES FORMAT: Each note should have a SHORT label (2-4 Chinese words like 完整八段结构, 详略得当, 情节发展自然) and a brief text explanation (1 sentence, under 25 chars). Do NOT quote full sentences from the essay. Good examples:
- {"label":"完整八段结构","text":"八段式记叙文结构完整，层次分明，过渡自然"}
- {"label":"详略得当","text":"重点突出高潮部分的EASI描写，详略安排合理"}
- {"label":"主题鲜明","text":"通过具体事件展现人间温情，升华到社会意义"}
Bad examples (DO NOT DO THIS):
- {"label":"倒叙开头","text":"每当我走进超市，听到收银机的扫描声，脑海中总会浮现..."} ← WRONG: quoting the essay

IMPROVEMENTS FORMAT: Give 3 specific, actionable suggestions. CRITICAL RULES:
1. READ THE ESSAY CAREFULLY before suggesting. Do NOT suggest things the student has ALREADY done well.
2. Each suggestion should target a GENUINE weakness — something actually missing or weak in this specific essay.
3. For A1-level essays that are already excellent, focus on subtle refinements like: varying sentence rhythm, adding one more sensory detail in a specific paragraph, or strengthening a specific transition. Reference the specific paragraph or section.

JSON SAFETY RULES:
1. Return ONLY a JSON object. No markdown, no backticks.
2. String values use straight double quotes " as delimiters.
3. INSIDE strings: NEVER use " or " or ". ALWAYS use 「 」.
4. INSIDE strings: NEVER use literal newlines.
5. No trailing commas before } or ].

TEMPLATE:
{"content_score":16,"language_score":16,"total_score":32,"content_band":2,"language_band":2,"grade":"B3","grade_label":"良好","content_feedback":"...","language_feedback":"...","annotations":[{"text":"...","type":"good","technique":"A","comment":"..."}],"framework":{"p1_opening":{"status":"pass","comment":"...","para_index":[0]},"p2_scene":{"status":"pass","comment":"...","para_index":[1]},"p31_transition":{"status":"pass","comment":"...","para_index":[2]},"p32_flashback":{"status":"pass","comment":"...","para_index":[3]},"p4_trigger":{"status":"pass","comment":"...","para_index":[4]},"p56_climax":{"status":"warn","comment":"...","para_index":[5,6]},"p7_resolution":{"status":"pass","comment":"...","para_index":[7]},"p8_conclusion":{"status":"pass","comment":"...","para_index":[8]}},"easi":{"E":{"rating":"good","score_label":"✓ 运用得当","comment":"...","extracted":["..."]},"A":{"rating":"ok","score_label":"△ 尚可","comment":"...","extracted":["..."]},"S":{"rating":"good","score_label":"✓ 运用得当","comment":"...","extracted":["..."]},"I":{"rating":"good","score_label":"✓ 运用得当","comment":"...","extracted":["..."]}},"language_errors":[{"label":"错别字","original":"说到","correction":"说道","reason":"到是方向词，道是说话的道"}],"structure_notes":[{"type":"struct","label":"...","text":"..."}],"improvements":["...","...","..."],"examiner_comment":"...","action_sequences":[{"pattern":"E→A→E","text":"...","comment":"..."}]}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 290000);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key':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
, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-opus-4-20250514', max_tokens: 6000, system, messages: [{ role: 'user', content: `题目：${title || '（无题目）'}\n\n学生作文：\n${essay}` }] }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errBody = await response.text();
      return res.status(500).json({ error: 'API error: ' + response.status + ' ' + errBody.substring(0, 200) });
    }

    const data = await response.json();
    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }
    const raw = data.content.find(b => b.type === 'text')?.text || '';

let clean = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
const jsonStart = clean.indexOf('{');
const jsonEnd = clean.lastIndexOf('}');
if (jsonStart === -1 || jsonEnd === -1) {
  return res.status(500).json({ error: 'No JSON found', debug_raw_start: raw.substring(0, 500) });
}
clean = clean.substring(jsonStart, jsonEnd + 1);

// Pre-repair: neutralise Chinese quotes before parsing
clean = clean.replace(/\u201c([^\u201d]*)\u201d/g, '\u300c$1\u300d');
clean = clean.replace(/\u00ab([^\u00bb]*)\u00bb/g, '\u300c$1\u300d');
clean = clean.replace(/\uff02([^\uff02]*)\uff02/g, '\u300c$1\u300d');
clean = clean.replace(/\u2018([^\u2019]*)\u2019/g, '\u300c$1\u300d');

// Second pass: catch any remaining Chinese-style quotes that the first pass
// might miss (e.g. mismatched pairs, or quotes that span oddly)
// Replace ："...anything..." patterns (colon + quote inside JSON strings)
clean = clean.replace(/\uff1a\u201c/g, '\uff1a\u300c');
clean = clean.replace(/\u201d/g, '\u300d');
clean = clean.replace(/\u201c/g, '\u300c');

// Handle truncated JSON: if response was cut off, close open structures
if (clean.lastIndexOf('}') < clean.lastIndexOf('"')) {
  // JSON was likely truncated mid-string — try to salvage
  // Find last complete object by looking for last "}}" or "}]}"
  const lastGoodBrace = clean.lastIndexOf('}');
  if (lastGoodBrace > 0) {
    clean = clean.substring(0, lastGoodBrace + 1);
    // Count open brackets and close them
    let opens = 0, closes = 0, openArr = 0, closeArr = 0;
    for (let i = 0; i < clean.length; i++) {
      if (clean[i] === '{') opens++;
      if (clean[i] === '}') closes++;
      if (clean[i] === '[') openArr++;
      if (clean[i] === ']') closeArr++;
    }
    while (closeArr < openArr) { clean += ']'; closeArr++; }
    while (closes < opens) { clean += '}'; closes++; }
  }
}

function tryParse(s) {
  try { return JSON.parse(s); } catch(e) {}
  try { return JSON.parse(s.replace(/,(\s*[}\]])/g, '$1')); } catch(e) {}
  // Fix newlines inside strings
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
  // Char-by-char rogue quote repair
  try {
    let out = '', inStr = false, esc = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (esc) { out += ch; esc = false; continue; }
      if (ch === '\\') { out += ch; esc = true; continue; }
      if (ch === '"') {
        if (!inStr) { inStr = true; out += ch; continue; }
        let j = i + 1;
        while (j < s.length && (s[j] === ' ' || s[j] === '\t' || s[j] === '\r' || s[j] === '\n')) j++;
        const nx = j < s.length ? s[j] : '';
        const structural = (nx === ':' || nx === ',' || nx === '}' || nx === ']' || nx === '"' || nx === '');
        if (structural) { inStr = false; out += ch; }
        else {
          out += '\u300c';
          let segment = '';
          for (let k = i + 1; k < s.length; k++) {
            if (s[k] === '\\') { segment += s[k] + (s[k+1]||''); k++; continue; }
            if (s[k] === '"') {
              let m = k + 1;
              while (m < s.length && (s[m] === ' ' || s[m] === '\t' || s[m] === '\r' || s[m] === '\n')) m++;
              const nx2 = m < s.length ? s[m] : '';
              const structural2 = (nx2 === ':' || nx2 === ',' || nx2 === '}' || nx2 === ']' || nx2 === '"' || nx2 === '');
              if (structural2) { out += segment + '\u300d'; i = k - 1; break; }
              else { segment += '\u300c'; }
            } else if (s[k] === '\n' || s[k] === '\r') { segment += ' '; }
            else { segment += s[k]; }
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
  let errorMsg = '', errorPos = -1;
  try { JSON.parse(clean); } catch(e) {
    errorMsg = e.message;
    const posMatch = e.message.match(/position\s+(\d+)/i);
    if (posMatch) errorPos = parseInt(posMatch[1]);
  }
  const snippet = errorPos >= 0 ? clean.substring(Math.max(0, errorPos - 100), errorPos + 100) : clean.substring(0, 500);
  return res.status(500).json({ error: 'JSON parse failed — please try again', debug_error: errorMsg, debug_position: errorPos, debug_snippet: snippet });
}

// Post-parse: restore corner brackets to curly quotes for display
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
      if (Array.isArray(result.easi[k].extracted)) result.easi[k].extracted = result.easi[k].extracted.map(rq);
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
    if (result.framework[k] && result.framework[k].comment) result.framework[k].comment = rq(result.framework[k].comment);
  });
}
if (result.structure_notes && Array.isArray(result.structure_notes)) {
  result.structure_notes = result.structure_notes.map(function(n) { if (n.text) n.text = rq(n.text); return n; });
}
if (result.improvements && Array.isArray(result.improvements)) {
  result.improvements = result.improvements.map(rq);
}
if (result.action_sequences && Array.isArray(result.action_sequences)) {
  result.action_sequences = result.action_sequences.map(function(seq) {
    if (seq.text) seq.text = rq(seq.text);
    if (seq.comment) seq.comment = rq(seq.comment);
    return seq;
  });
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
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: '批改超时，请再试一次。The AI took too long — please try again.' });
    }
    return res.status(500).json({ error: err.message });
  }
}
