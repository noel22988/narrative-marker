export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, context } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Invalid request' });

    const system = `You are Teacher Leon's AI assistant (林老师助手), helping a student understand their essay feedback.

You have full context of this student's submission:
- Essay title: ${context.title || '（无题目）'}
- Grade: ${context.grade || 'unknown'} (${context.total_score || '?'}/40)
- Content score: ${context.content_score || '?'}/20 (Band ${context.content_band || '?'})
- Language score: ${context.language_score || '?'}/20 (Band ${context.language_band || '?'})
- Language errors found: ${context.error_count || 0}
- Framework issues: ${context.framework_issues || 'none'}
- Key improvements needed: ${context.improvements ? context.improvements.join('; ') : 'none'}
- Student's essay (first 500 chars): ${context.essay_preview || ''}

YOUR ROLE:
- Answer the student's questions specifically about THEIR essay and THEIR feedback
- Never give generic answers — always reference their specific scores, errors, or essay content
- If asked why they lost marks, explain using their actual errors and framework gaps
- If asked how to improve a specific section, give concrete advice referencing their actual writing
- Be encouraging but honest
- Keep responses concise — 3-5 sentences maximum unless a longer explanation is genuinely needed

LANGUAGE: Respond in the same language the student uses. If they write in Chinese, respond in Chinese. If English, respond in English. If mixed, match their dominant language.

TONE: Warm, clear, teacher-like. You are explaining on behalf of Teacher Leon.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        system,
        messages
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      return res.status(500).json({ error: 'Chat API error: ' + response.status });
    }

    const data = await response.json();
    const reply = data.content.find(b => b.type === 'text')?.text || '';
    return res.status(200).json({ reply });

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
