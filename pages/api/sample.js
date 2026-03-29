export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { title, essay, grade, mode } = req.body;
    if (!essay) return res.status(400).json({ error: '请提供作文内容。' });

    const gradeOrder = ['F9','E8','D7','C6','C5','B4','B3','A2','A1'];
    const gradeIdx = gradeOrder.indexOf(grade);

    const gradeDescriptions = {
      'A1': 'Band 1 both components. Exceptional — rich vocabulary, complex varied sentences, all four EASI techniques vivid and prominent, perfectly layered narrative. Zero or near-zero errors, strong 成语 and 四字词语 usage.',
      'A2': 'Strong Band 1. Excellent — strong vocabulary, minimal isolated errors, all EASI clearly present and effective, well-structured narrative.',
      'B3': 'Band 2. Good — appropriate vocabulary, some sentence variety, EASI present and reasonable throughout.',
      'B4': 'Solid Band 2. Competent — adequate vocabulary, some errors acceptable, EASI attempted in key paragraphs.',
      'C5': 'Band 2/3. Average — simple vocabulary, some errors, EASI minimal but present in climax.',
      'C6': 'Band 3. Below average — limited vocabulary, several errors, EASI weak but attempted.',
      'D7': 'Band 3/4. Weak — basic vocabulary, many errors, very little descriptive technique.',
      'E8': 'Band 4. Poor — very limited vocabulary, frequent errors, bare sentences with minimal description.',
      'F9': 'Band 5. Very poor — bare minimum, many errors, no descriptive techniques attempted.'
    };

    // Determine target grade
    let targetGrade = 'A1';
    let targetLabel = 'A1/A2';
    let modeInstruction = 'This is a top-quality model essay at A1/A2 standard.';

    if (mode === 'stretch' && gradeIdx >= 0) {
      const stretchIdx = Math.min(gradeIdx + 2, gradeOrder.length - 1);
      targetGrade = gradeOrder[stretchIdx];
      targetLabel = targetGrade;
      modeInstruction = `This essay is calibrated exactly to ${targetGrade} standard — two grades above the student's current ${grade}. It should feel like a realistic next step, not an overwhelming perfect essay. Match the language complexity appropriate for ${targetGrade}: ${gradeDescriptions[targetGrade]}`;
    }

    const targetDesc = gradeDescriptions[targetGrade] || gradeDescriptions['A1'];

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    };

    // ── PASS 1: Extract story skeleton ──────────────────────────────────────
    // Locks the student's story before rewriting — prevents AI from drifting
    const skeletonSystem = `You are extracting the story skeleton from a student's Chinese narrative essay.
Your job is to record the following elements EXACTLY as the student wrote them.
Do NOT improve, paraphrase, or add anything. Extract only what is present.

Return a JSON object with these exact fields:
{
  "title": "essay title if given, else null",
  "characters": ["every character by name or description"],
  "setting": "where and when the story takes place — copied exactly from essay",
  "p1_opening": "the opening line or flashback technique used — copy exactly",
  "p2_scene": "all scene details present — time, place, people, activity, environment as written",
  "p3_transition": "how student moved from scene toward the main event — exact content",
  "p3_flashback": "flashback or backstory content if present, else null",
  "p4_trigger": "the specific event that triggered the main conflict — exact from essay",
  "p56_climax_events": ["every key event in the climax, in order, copied from essay"],
  "p56_dialogue": ["every line of dialogue in climax — speaker + exact words as written"],
  "p7_resolution": "what happened after the climax — exact from essay",
  "p8_moral": "the moral or 感悟 the student wrote — copied exactly",
  "key_objects": ["specific objects important to the story"]
}

Return ONLY the JSON object. No markdown, no backticks, no explanation.`;

    const skeletonResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: skeletonSystem,
        messages: [{ role: 'user', content: `题目：${title || '（无题目）'}\n\n学生作文：\n${essay}` }]
      })
    });

    if (!skeletonResp.ok) {
      const errBody = await skeletonResp.text();
      return res.status(500).json({ error: 'Pass 1 failed: ' + errBody.substring(0, 200) });
    }

    const skeletonData = await skeletonResp.json();
    const skeletonRaw = skeletonData.content.find(b => b.type === 'text')?.text || '';
    let skeleton;
    try {
      const s = skeletonRaw.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();
      skeleton = JSON.parse(s.substring(s.indexOf('{'), s.lastIndexOf('}') + 1));
    } catch(e) {
      skeleton = { raw: skeletonRaw };
    }

    // ── PASS 2: Rewrite locked to skeleton ───────────────────────────────────
    const essaySystem = `You are Teacher Leon (林纯隆老师), rewriting a student's narrative essay (记叙文) for O Level Chinese 1160 at ${targetLabel} standard.
${modeInstruction}

════════════════════════════════════════════════
CONTENT PRESERVATION — MOST IMPORTANT RULE
════════════════════════════════════════════════
You are an EDITOR, not a writer. The LOCKED STORY SKELETON below must be preserved.
You MUST keep:
- Every character (same names, same relationships, same roles)
- The same setting (same place, same time)
- Every key event in the climax, in the same order
- Every line of dialogue — keep what is SAID, you may only improve HOW it is said (speech manner tag)
- The same moral/感悟 in the conclusion
- The same opening technique (flashback or direct) as shown in the skeleton
- All key objects mentioned in the skeleton

You may ONLY:
- Add EASI clauses (外貌/行动/语言/心理) to enrich existing moments
- Improve vocabulary and sentence structure
- Add sensory details to existing scenes (sound, smell, temperature, texture)
- Strengthen transitions between existing paragraphs
- Elevate the 结尾 with better expression of the SAME moral
- Add 成语 and 四字词语

You may NOT:
- Change what happens in the story
- Add new plot events that did not occur
- Add new characters not in the skeleton
- Change the setting or location
- Change what any character says (manner only, not content)
- Change the moral or lesson

LOCKED STORY SKELETON:
${JSON.stringify(skeleton, null, 2)}

════════════════════════════════════════════════
TEACHER LEON'S 8-PARAGRAPH FRAMEWORK
════════════════════════════════════════════════

【开头】P1 — OPENING (3-4 sentences)
Use the same technique as the skeleton (倒叙 flashback or 抄题 direct).
Keep their opening image or situation. Elevate the language only.

【场景】P2 — SCENE SETTING (4-5 sentences)
Keep the student's scene content. Include ALL 5 elements:
1. 时间 Time — specific (e.g. 那个闷热的午后)
2. 人物 People — who is there
3. 地点 Place — specific location from skeleton
4. 活动 Activity — what is happening
5. 环境描写 Environment — sensory detail: sight, sound, smell, or temperature
Every element must be clearly present. Do not skip any.

【过渡】P3.1 — TRANSITION (3-4 sentences)
Bridge from scene to trigger. Use student's transition content from skeleton.
Describe what the narrator was doing (queuing, walking, waiting, etc.).
End with attention being drawn to a figure or detail nearby.
Do NOT start the conflict here. Do NOT include the trigger event.
Final sentence example: 就在这时，我的注意力被前方一个身影深深吸引了。

【插叙】P3.2 — FLASHBACK (3-4 sentences, ONLY if skeleton has p3_flashback content)
Include this paragraph ONLY if p3_flashback in the skeleton is not null.
Keep the student's backstory content. Improve language only.
If p3_flashback is null — skip this paragraph completely.

【高潮前】P4 — TRIGGER (3-5 sentences)
The specific event that starts the conflict — use skeleton's p4_trigger exactly.
Include at least one E (外貌描写) describing the key person.
End with the conflict beginning (e.g. 收银员说还差三块五 / 相机从手中滑落).

【高潮中一】P5 — CLIMAX PART 1 (5-7 sentences)
First half of skeleton's p56_climax_events, in order.
Required EASI:
- E: facial features showing emotion (眼眶泛红, 眉头紧皱, 嘴唇微微颤抖)
- A: adverb + action chain of 3-4 consecutive actions (颤巍巍地掏出……小心翼翼地数着……慌忙翻遍……)
- S: speech manner tag + verb + 「exact dialogue from skeleton」
- I: inner thought using 心头一紧 / 百感交集 / 心想：「...」

【高潮中二】P6 — CLIMAX PART 2 (5-7 sentences)
Second half of skeleton's p56_climax_events, in order.
Include skeleton's p56_dialogue here.
Rich I (inner thoughts during action). Build toward the resolution.
Include the turning point or decision.

【高潮后】P7 — RESOLUTION (3-4 sentences)
Keep skeleton's p7_resolution exactly.
Add E + A + S details to make the scene vivid.

【结尾】P8 — CONCLUSION (4-5 sentences)
MUST follow this exact 4-part formula. All 4 parts required:
1. 感受 FEELINGS: 经历过这件事情，我感到____（既……又……）
2. 为什么 WHY: Explain each feeling — 心酸的是……；温暖的是……
3. 启示 MORAL: 这也让我意识到……（use skeleton's p8_moral exactly, elevate language only）
4. 应用到社会 SOCIETY: 在这个……的社会里，我们都应该……

════════════════════════════════════════════════
TARGET: ${targetLabel} — ${targetDesc}
Total length: 600-700 Chinese characters. Simplified Chinese only.

Start each paragraph with its label on its own line:
【开头】 / 【场景】 / 【过渡】 / 【插叙】(if applicable) / 【高潮前】 / 【高潮中一】 / 【高潮中二】 / 【高潮后】 / 【结尾】

After the last paragraph add this line:
※ 此范文仅供参考，请勿直接抄写。以此为范例理解写法，再用自己的语言重写。

Return ONLY the essay with labels. No preamble, no explanation.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 270000);

    const essayResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: essaySystem,
        messages: [{ role: 'user', content: `请根据以上要求，为学生写一篇${targetLabel}水平的范文。\n题目：${title || (skeleton && skeleton.title) || '（无题目）'}` }]
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!essayResp.ok) {
      const errBody = await essayResp.text();
      return res.status(500).json({ error: 'Pass 2 failed: ' + errBody.substring(0, 200) });
    }

    const essayData = await essayResp.json();
    if (essayData.error) return res.status(500).json({ error: essayData.error.message });
    const essayText = essayData.content.find(b => b.type === 'text')?.text || '';

    return res.status(200).json({ essay: essayText, targetGrade, mode });

  } catch(err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: '生成超时，请再试一次。' });
    }
    return res.status(500).json({ error: err.message });
  }
}
