import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';

/**
 * POST /api/ai/parse-issue
 *
 * Natural-language prompt to structured Issue definition.
 */
export async function POST(req: Request) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt string is required' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (apiKey) {
      try {
        const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1000,
            system: 'You are an AI task extraction assistant. Parse the user prompt into a valid JSON object matching: { title: string, description: string, priority: "critical"|"high"|"medium"|"low", labels: string[], assigneeName?: string, estimatedHours?: number, subtasks: { title: string }[] }. Return ONLY raw JSON without markdown code fences.',
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        if (anthropicRes.ok) {
          const data = await anthropicRes.json();
          const rawText = data.content?.[0]?.text || '{}';
          const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          return NextResponse.json(parsed);
        }
      } catch {
        // Fallback to local heuristic parser
      }
    }

    // High-precision local heuristic parser when API key is not present
    const lower = prompt.toLowerCase();

    // 1. Priority detection
    let priority: 'critical' | 'high' | 'medium' | 'low' = 'medium';
    if (lower.includes('critical') || lower.includes('p0') || lower.includes('urgent') || lower.includes('blocker')) {
      priority = 'critical';
    } else if (lower.includes('high') || lower.includes('p1') || lower.includes('asap')) {
      priority = 'high';
    } else if (lower.includes('low') || lower.includes('p3') || lower.includes('minor')) {
      priority = 'low';
    }

    // 2. Assignee detection
    let assigneeName = 'General (Anyone)';
    const assigneeMatch = prompt.match(/assign(?:\s+to)?\s+([A-Za-z0-9_]+)/i);
    if (assigneeMatch) {
      assigneeName = assigneeMatch[1];
    } else if (lower.includes('assign to me') || lower.includes('for me')) {
      assigneeName = (session as any).name || 'karri';
    }

    // 3. Label detection
    const labels: string[] = [];
    if (lower.includes('bug') || lower.includes('crash') || lower.includes('error') || lower.includes('fail')) {
      labels.push('Bug');
    }
    if (lower.includes('ui') || lower.includes('frontend') || lower.includes('design') || lower.includes('css')) {
      labels.push('Frontend');
    }
    if (lower.includes('api') || lower.includes('backend') || lower.includes('db') || lower.includes('database')) {
      labels.push('Backend');
    }
    if (lower.includes('security') || lower.includes('auth') || lower.includes('jwt')) {
      labels.push('Security');
    }
    if (labels.length === 0) labels.push('Feature');

    // 4. Estimate detection
    let estimatedHours = 2;
    const estimateMatch = prompt.match(/(\d+(?:\.\d+)?)\s*(?:h|hrs|hours)/i);
    if (estimateMatch) {
      estimatedHours = parseFloat(estimateMatch[1]);
    }

    // 5. Clean Title & Subtasks
    const cleanTitle = prompt
      .replace(/assign(?:\s+to)?\s+([A-Za-z0-9_]+)/gi, '')
      .replace(/(critical|high|medium|low)\s+priority/gi, '')
      .replace(/labels?:[a-zA-Z0-9_,\s]+/gi, '')
      .trim();

    return NextResponse.json({
      title: cleanTitle.length > 80 ? cleanTitle.slice(0, 77) + '...' : cleanTitle,
      description: `Generated from natural language prompt:\n"${prompt}"`,
      priority,
      assigneeName,
      labels,
      estimatedHours,
      subtasks: [
        { title: `Reproduce and inspect ${cleanTitle.slice(0, 30)}` },
        { title: 'Implement solution and add automated tests' },
        { title: 'Verify fix in staging and prepare pull request' },
      ],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
