export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { title, essay, grade, mode } = req.body;

  const gradeOrder = ['F9','E8','D7','C6','C5','B4','B3','A2','A1'];
  const gradeDescriptions = {
    'A1': 'Band 1 both components. Exceptional — rich vocabulary, complex varied sentences, all four EASI techniques vivid and prominent, perfectly layered narrative.',
    'A2': 'Strong Band 1. Excellent — strong vocabulary, minimal errors, all EASI clearly present, well-structured.',
    'B3': 'Band 2. Good — appropriate vocabulary, some sentence variety, EASI present and reasonable.',
    'B4': 'Solid Band 2. Competent — adequate vocabulary, some errors acceptable, EASI attempted.',
    'C5': 'Band 2/3. Average — simple vocabulary, some errors, EASI minimal but present.',
    'C6': 'Band 3. Below average — limited vocabulary, several errors, EASI weak.',
    'D7': 'Band 3/4. Weak — basic vocabulary, many errors, very little description.',
    'E8': 'Band 4. Poor — very limited vocabulary, frequent errors, bare sentences.',
    'F9': 'Band 5. Very poor — bare minimum, many errors, no descriptive techniques.'
  };

  let targetGrade = 'A1';
  let modeInstruction = 'This is a top-quality model essay at A1/A2 standard.';

  if (mode === 'stretch' && grade) {
    const currentIdx = gradeOrder.indexOf(grade);
    const stretchIdx = Math.min(currentIdx + 2, gradeOrder.length - 1);
    targetGrade = gradeOrder[stretchIdx];
    modeInstruction = `This essay is calibrated exactly to ${targetGrade} standard — two grades above the student's current ${grade}. It should feel like a realistic next step, not an overwhelming perfect essay. Match the language complexity appropriate for ${targetGrade}: ${gradeDescriptions[targetGrade]}`;
  }

  const system = `You are Teacher Leon (林纯隆老师), rewriting a student's narrative essay (记叙文) for O Level Chinese 1160 at ${targetGrade} standard.
${modeInstruction}

YOUR MOST IMPORTANT RULE — CONTENT PRESERVATION:
You are an EDITOR, not a writer. Your job is to REWRITE the student's essay, not replace it.
- Keep ALL of the student's key story events in the SAME ORDER
- Keep ALL the same characters (same people, same relationships)
- Keep the same setting and location
- Keep the same climax situation
- Keep the same ending and moral
- You may only ADD sensory details, EASI techniques, richer vocabulary, and better sentence structures
- You must NOT change what happens in the story
- You must NOT invent new plot events
- Think of it as: take the student's skeleton and add flesh — do not build a new skeleton

FRAMEWORK — keep the student's paragraph structure, add these labels:
【开头】Use the same opening approach as the student (倒叙/抄题). Keep their opening idea, elevate the language. (3-4 sentences)
【场景】Keep the student's scene. MUST include ALL 5 elements: Time（时间）+ People（人物）+ Place（地点）+ Activity（做什么）+ Environment（环境描写，use sensory details — sight, sound, smell, temperature）. Each element must be clearly present. (4-5 sentences)
【过渡】This paragraph bridges the scene to the HIGH POINT. It should be 3-4 sentences. Use the student's original content: describe what the narrator was doing (e.g. queuing, walking, waiting) and end with their attention being drawn to a specific figure or detail nearby. Do NOT include the trigger event here. Do NOT have the old lady discover her money problem here. End with a sentence like: 就在这时，我的注意力被前方一个身影深深吸引了。
【高潮前】IMPORTANT: This paragraph is the TRIGGER — the specific event that causes the main conflict. Copy the student's content: the old lady is described in detail (appearance using E), then the moment she realises she doesn't have enough money. This is NOT part of the transition. Write 3-5 sentences. Include at least one E (外貌描写) here. End with the conflict beginning (e.g. cashier says there's not enough money).
【高潮中一】Keep the student's main event. Add EASI: E=外貌(specific facial features showing emotion), A=行动(adjective+action chain sequence), S=语言(action chain + dialogue, not just 他说), I=心理(specific mental verbs: 心头一紧/不禁愣住/百感交集/心里七上八下). (5-7 sentences)
【高潮中二】Continue the student's story. More EASI. Escalate emotion. Turning point or decision. (5-7 sentences)
【高潮后】Keep the student's resolution. Improve language. (3-4 sentences)
【结尾】MUST follow this exact 4-part formula strictly:
1. 感受 FEELINGS: State the emotional feeling(s) — e.g. 经历过这件事情，我感到____（既……又……）
2. 为什么 WHY: Explain WHY those feelings — e.g. 心酸的是……；温暖的是……
3. 启示 MORAL/INSIGHT: What the narrator learned — e.g. 这也让我意识到……（the lesson from the experience）
4. 应用到社会 APPLY TO SOCIETY: How this applies to society or the world — e.g. 在这个……的社会里，我们都应该……
Keep the student's specific feelings and moral — only elevate the language. All 4 parts must be present. (4-5 sentences)

TARGET QUALITY for ${targetGrade}: ${gradeDescriptions[targetGrade]}
Total length: 600-700 Chinese characters. Simplified Chinese only.
Return ONLY the rewritten essay with paragraph labels. No explanation.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system,
        messages: [{ role: 'user', content: `题目：${title || '（无题目）'}\n\n学生原文（必须保留所有故事内容，只改善语言表达）：\n${essay || ''}` }]
      })
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const text = data.content.find(b => b.type === 'text')?.text || '';
    return res.status(200).json({ essay: text, targetGrade, mode });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
