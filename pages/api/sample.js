export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { title, essaySnippet } = req.body;

  const system = `You are Teacher Leon (林纯隆老师), writing a Band 1 model narrative essay (记叙文) for O Level Chinese 1160.

Follow this EXACT framework with paragraph labels:
【开头】P1: Use 倒叙/悬疑 OR 抄题 — must hook the reader immediately
【场景】P2: Time 时间 + People 人物 + Place 地点 + Activity 做什么 + Environment 环境描写
【过渡】P3: Brief transition leading to the climax trigger
【高潮前】P4: Trigger event — one paragraph setting up the incident
【高潮中一】P5: Main event — use EASI prominently: E外貌(facial features showing emotion), A行动(adjectives+action chains), S语言(rich dialogue not just 他说), I心理(specific mental verbs)
【高潮中二】P6: Continuation — escalate emotion, more EASI
【高潮后】P7: Resolution — how it resolves
【结尾】P8: Feelings 感受 + moral/insight 启示

Requirements:
- 450–500 Chinese characters total
- Band 1 quality: rich vocabulary, varied sentence structures
- EASI must be clearly visible in P5 and P6
- Simplified Chinese only
- Base story on student's title/theme but elevate significantly
- Include paragraph labels exactly as shown above

Return ONLY the essay with labels. No explanation.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system,
        messages: [{
          role: 'user',
          content: `题目：${title || '我最难忘的一次经历'}\n\n学生故事主题（仅参考，请大幅提升）：${essaySnippet}`
        }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const essay = data.content.find(b => b.type === 'text')?.text || '';
    return res.status(200).json({ essay });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
