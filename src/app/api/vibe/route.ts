import Anthropic from '@anthropic-ai/sdk';

// ─── Provider Callers ───────────────────────────────────────────────────────

async function callOpenAI(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  model: string = 'gpt-4o-mini'
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI error: ${response.statusText}`);
  const data = await response.json();
  return data.choices[0].message.content;
}

async function callAnthropic(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  model: string = 'claude-3-5-haiku-20241022'
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = message.content[0];
  if (block.type !== 'text') throw new Error('Unexpected Anthropic response type');
  return block.text;
}

async function callGemini(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  model: string = 'gemini-2.0-flash'
): Promise<string> {
  const contents = [
    { role: 'user', parts: [{ text: `${systemPrompt}\n\n${prompt}` }] },
  ];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
  });
  if (!response.ok) throw new Error(`Gemini error: ${response.statusText}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ─── Dispatcher ─────────────────────────────────────────────────────────────

async function callProvider(
  prompt: string,
  systemPrompt: string,
  provider: string,
  model: string,
  apiKeys: Record<string, string>
): Promise<string> {
  switch (provider) {
    case 'anthropic':
      return callAnthropic(prompt, systemPrompt, apiKeys.anthropic, model);
    case 'gemini':
      return callGemini(prompt, systemPrompt, apiKeys.gemini, model);
    case 'openai':
    default:
      return callOpenAI(prompt, systemPrompt, apiKeys.openai, model);
  }
}

// ─── Mock data (no keys) ─────────────────────────────────────────────────────

const MOCK_STEPS = [
  {
    name: 'Generator',
    code: `// 🏗️ Generator (Mock Mode)\nfunction hello(name: string) {\n  // TODO: add validation\n  console.log("Hello, " + name)\n}`,
  },
  {
    name: 'Fixer',
    code: `// 🔍 Fixer (Mock Mode)\nfunction hello(name: string) {\n  if (!name) throw new Error("Name is required");\n  console.log(\`Hello, \${name}\`);\n}`,
  },
  {
    name: 'Optimizer',
    code: `// ✨ Optimizer (Mock Mode)\nexport function greet(name: string): void {\n  if (!name?.trim()) throw new Error("Name is required");\n  console.log(\`Hello, \${name}! 🚀\`);\n}`,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cleanCode(raw: string): string {
  return raw.replace(/```[\w]*\n?/g, '').replace(/\n```/g, '').trim();
}

function encodeSSE(event: string, data: object): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ─── Agent System Prompts ─────────────────────────────────────────────────────

const AGENT_PROMPTS = {
  generator:
    "You are an expert software architect. Draft the initial code implementation based on the user's prompt. ONLY return the code snippet inside a single markdown code block — no explanations.",
  fixer:
    'You are a precise code reviewer. Review the following code for bugs, logical errors, missing edge cases, and structural issues. Return ONLY the corrected code inside a single markdown code block — no explanations.',
  optimizer:
    'You are a senior performance engineer. Optimize the code for performance, readability, and best practices. Use descriptive names, add types where missing, and ensure clean exports. Return ONLY the final code inside a single markdown code block — no explanations.',
};

// ─── SSE Route ────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const {
    prompt,
    apiKeys = {},
    agents = {},
  } = await request.json();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        controller.enqueue(encoder.encode(encodeSSE(event, data)));
      };

      try {
        const hasAnyKey = apiKeys.openai || apiKeys.anthropic || apiKeys.gemini;

        if (!hasAnyKey) {
          // ── Mock mode ─────────────────────────────────────────────────────
          for (let i = 0; i < MOCK_STEPS.length; i++) {
            const step = MOCK_STEPS[i];
            send('step_start', { step: i + 1, name: step.name });
            await new Promise((r) => setTimeout(r, 2500));
            send('step_done', { step: i + 1, name: step.name, code: step.code });
          }
          send('done', { finalCode: MOCK_STEPS[2].code });
          controller.close();
          return;
        }

        // ── Agent 1: Generator ──────────────────────────────────────────────
        const gen = agents.generator ?? { provider: 'openai', model: 'gpt-4o-mini' };
        send('step_start', { step: 1, name: 'Generator', provider: gen.provider });
        const step1Raw = await callProvider(prompt, AGENT_PROMPTS.generator, gen.provider, gen.model, apiKeys);
        const step1Code = cleanCode(step1Raw);
        send('step_done', { step: 1, name: 'Generator', code: step1Code });

        // ── Agent 2: Fixer ──────────────────────────────────────────────────
        const fix = agents.fixer ?? { provider: 'openai', model: 'gpt-4o-mini' };
        send('step_start', { step: 2, name: 'Fixer', provider: fix.provider });
        const step2Raw = await callProvider(
          `Review and fix this code:\n\n${step1Code}`,
          AGENT_PROMPTS.fixer,
          fix.provider,
          fix.model,
          apiKeys
        );
        const step2Code = cleanCode(step2Raw);
        send('step_done', { step: 2, name: 'Fixer', code: step2Code });

        // ── Agent 3: Optimizer ──────────────────────────────────────────────
        const opt = agents.optimizer ?? { provider: 'openai', model: 'gpt-4o-mini' };
        send('step_start', { step: 3, name: 'Optimizer', provider: opt.provider });
        const step3Raw = await callProvider(
          `Optimize this code:\n\n${step2Code}`,
          AGENT_PROMPTS.optimizer,
          opt.provider,
          opt.model,
          apiKeys
        );
        const step3Code = cleanCode(step3Raw);
        send('step_done', { step: 3, name: 'Optimizer', code: step3Code });

        // ── Done ────────────────────────────────────────────────────────────
        send('done', { finalCode: step3Code });
        controller.close();
      } catch (err: any) {
        send('error', { message: err.message ?? 'Unknown error' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
