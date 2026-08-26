import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';

/**
 * POST /api/ai/chat
 *
 * Phase 1 — Streaming LLM chat with issue context.
 * Requires:
 *   - ANTHROPIC_API_KEY env var set
 *   - Body: { message: string, issueContext?: object }
 *
 * To enable: set ANTHROPIC_API_KEY in your .env
 */
export async function POST(req: Request) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'AI features are not configured. Set ANTHROPIC_API_KEY in your .env to enable.',
        configured: false,
      },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { message, issueContext } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // Build system prompt with issue context if available
    const systemPrompt = issueContext
      ? `You are an AI engineering assistant integrated into Teader, a project management platform.

Current issue context:
- Title: ${issueContext.title || 'N/A'}
- Status: ${issueContext.status || 'N/A'}
- Priority: ${issueContext.priority || 'N/A'}
- Epic: ${issueContext.epic || 'N/A'}
- Description: ${issueContext.description || 'N/A'}
- Subtasks: ${JSON.stringify(issueContext.subtasks?.map((s: any) => ({ title: s.title, completed: s.completed })) || [])}

Help the engineer with this specific task. You can suggest code, estimate complexity, detect blockers, or generate tests.`
      : `You are an AI engineering assistant integrated into Teader, a project management platform. Help engineers plan, estimate, and complete their tasks efficiently.`;

    // Streaming response from Anthropic Claude
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        stream: true,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      return NextResponse.json({ error: `Anthropic API error: ${errBody}` }, { status: 502 });
    }

    // Stream the SSE response back to the client
    return new Response(anthropicRes.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
