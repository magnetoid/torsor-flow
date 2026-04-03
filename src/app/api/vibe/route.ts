import { NextResponse } from 'next/server';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callOpenAI(prompt: string, systemPrompt: string, apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function POST(request: Request) {
  try {
    const { prompt, apiKeys } = await request.json();
    const openaiKey = apiKeys?.openai;

    if (!openaiKey) {
      // Mock mode if no key is provided
      await delay(2000);
      const generated = `// Simulated Generator Code\nfunction hello() {\n  console.log("Generated");\n}`;
      await delay(2000);
      const fixed = `// Simulated Fixer Code\nfunction hello() {\n  console.log("Fixed! Hello Vibe Coder.");\n}`;
      await delay(2000);
      const optimized = `// Simulated Optimizer Code\nexport function hello(): void {\n  console.log("Optimized! 🚀 Hello Vibe Coder");\n}`;
      
      return NextResponse.json({
        success: true,
        steps: [
          { name: 'Generator', result: generated },
          { name: 'Fixer', result: fixed },
          { name: 'Optimizer', result: optimized }
        ],
        finalCode: optimized
      });
    }

    // Agent 1: Generator
    const generatorSystem = "You are an expert software architect. Draft the initial code implementation based on the user's prompt. ONLY return the code snippet inside markdown blocks, do not include explanations.";
    const step1Code = await callOpenAI(prompt, generatorSystem, openaiKey);

    // Agent 2: Fixer
    const fixerSystem = "You are a code reviewer. Review the following code. Fix any bugs, logical errors, or typos. Improve the structure. ONLY return the revised code snippet inside markdown blocks.";
    const step2Code = await callOpenAI(`Review and fix this code:\n\n${step1Code}`, fixerSystem, openaiKey);

    // Agent 3: Optimizer
    const optimizerSystem = "You are a performance and aesthetics optimizer. Take the fixed code and optimize it for best performance, readable variable names, and best practices. Clean up the output. ONLY return the final code snippet inside markdown blocks.";
    const step3Code = await callOpenAI(`Optimize this code:\n\n${step2Code}`, optimizerSystem, openaiKey);

    // Utility to clean markdown blocks
    const cleanCode = (raw: string) => raw.replace(/```\w*\n?/g, '').replace(/\n```/g, '').trim();

    return NextResponse.json({
      success: true,
      steps: [
        { name: 'Generator', result: cleanCode(step1Code) },
        { name: 'Fixer', result: cleanCode(step2Code) },
        { name: 'Optimizer', result: cleanCode(step3Code) }
      ],
      finalCode: cleanCode(step3Code)
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
