export async function callAI(prompt, apiKeys, options = {}) {
  const { timeoutMs = 12000 } = options;
  if (apiKeys.openai) {
    return await callOpenAI(prompt, apiKeys.openai, { timeoutMs });
  }
  if (apiKeys.anthropic) {
    return await callAnthropic(prompt, apiKeys.anthropic, { timeoutMs });
  }
  throw new Error('No API key configured');
}

async function callOpenAI(prompt, openaiKey, { timeoutMs }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-5-nano',
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 2000
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callAnthropic(prompt, anthropicKey, { timeoutMs }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } finally {
    clearTimeout(timeoutId);
  }
}