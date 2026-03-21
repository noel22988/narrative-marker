export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { title, essay, grade, mode } = req.body;
  // mode: 'standard' = model at high quality, 'stretch' = 2 grades above student's current grade

  const gradeOrder = ['F9','E8','D7','C6','C5','B4','B3','A2','A1'];
  const gradeDescriptions = {
    'A1': 'Band 1 in both content and language. Exceptional — rich vocabulary, complex sentences, vivid EASI, layered narrative.',
    'A2': 'High Band 1 / low Band 1. Excellent — strong vocabulary, minor errors only, clear EASI, well-structured.',
    'B3': 'Band 2. Good — appropriate vocabulary, some varied sentences, EASI present but could be stronger.',
    'B4': 'Solid Band 2. Competent — adequate vocabulary, some errors, basic EASI attempted.',
    'C5': 'Band 2/3 boundary. Average — simple vocabulary, noticeable errors, minimal EASI.',
    'C6': 'Band 3. Below average — limited vocabulary, several errors, EASI weak or missing.',
    'D7': 'Band 3/4. Weak — basic vocabulary, many errors, little description.',
    'E8': 'Band 4. Poor — very limited vocabulary, frequent errors, very simple sentences.',
    'F9': 'Band 5. Very poor — bare minimum content, many errors, no descriptive techniques.'
  };

  let targetGrade = 'A1';
  let targetDescription = gradeDescriptions['A1'];
  let modeInstruction = '';

  if (mode === 'stretch' && grade) {
    const currentIdx = gradeOrder.indexOf(grade);
    const stretchIdx = Math.min(currentIdx + 2, gradeOrder.length - 1);
    targetGrade = gradeOrder[stretchIdx];
    targetDescription = gradeDescriptions[targetGrade];
    modeInstruction = `This essay is specifically calibrated to ${targetGrade} standard — two grades above the student's current ${grade}. It should feel achievable and relatable, not overwhelmingly perfect. Use language complexity appropriate for ${targetGrade}.`;
  } else {
    modeInstruction = 'This is a high-quality model essay at the best possible standard (A1/A2). Rich vocabulary, complex EASI, cinematic and emotional.';
  }

  const system = `You are Teacher Leon (林纯隆老师), writing a model narrative essay (记叙文) for O Level Chinese 1160.

TARGET STANDARD: ${targetGrade} — ${targetDescription}
${modeInstruction}

CRITICAL CONTENT RULE:
- You MUST preserve the student's original story, characters, setting and key events as much as possible
- Only change the LANGUAGE EXPRESSION — improve how things are written, not what happens
- If the student wrote about helping an elderly person on the MRT, your essay must also be about helping an elderly person on the MRT
- If the student has good content and structure, keep it intact — only elevate the writing quality
- Only invent new content if the student's content is truly insufficient (under 150 chars or completely off-topic)

FRAMEWORK (follow with paragraph labels):
【开头】P1 (3-4 sentences): Use the student's opening approach if reasonable. If they used 倒叙, keep 倒叙. If 抄题, keep that. Elevate the language.
【场景】P2 (4-5 sentences): Expand the student's scene setting with all 5 elements: Time+People+Place+Activity+Environment. Use sensory details.
【过渡】P3 (2-3 sentences): Smooth transition to climax.
【高潮前】P4 (3-4 sentences): The trigger event from student's story, elevated.
【高潮中一】P5 (5-7 sentences): EASI techniques — E=Expressions&Appearance(具体描写面部特征), A=Actions(动作流程技巧：形容词+动词链), S=Speech(语言描写：动作链+对话), I=Inner Thoughts&Feelings(具体心理动词：不禁愣住/心头一紧/百感交集)
【高潮中二】P6 (5-7 sentences): Continue with more EASI. Escalate emotion. Turning point or realisation.
【高潮后】P7 (3-4 sentences): Resolution from student's story.
【结尾】P8 (3-4 sentences): Feelings 感受 + life lesson 启示 connecting to broader values.

QUALITY REQUIREMENTS for ${targetGrade}:
- Total: 600-700 Chinese characters
- Simplified Chinese only
- Paragraph labels exactly as shown above
- No explanation outside the essay

Return ONLY the essay with labels.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system,
        messages: [{ role: 'user', content: `题目：${title || '我最难忘的一次经历'}\n\n学生原文（请尽量保留内容和故事，只提升语言表达）：\n${essay || ''}` }]
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
