import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      next: { revalidate: 3600 }
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to query YouTube' }, { status: 502 });
    }

    const html = await res.text();

    // Match video IDs from search results
    const matches = html.match(/watch\?v=([a-zA-Z0-9_-]{11})/g);
    const videoIds: string[] = [];

    if (matches) {
      for (const m of matches) {
        const id = m.replace('watch?v=', '');
        if (!videoIds.includes(id)) {
          videoIds.push(id);
        }
        if (videoIds.length >= 6) break;
      }
    }

    if (videoIds.length === 0) {
      // Fallback to default high quality stream if none parsed
      return NextResponse.json({
        videoId: 'jfKfPfyJRdk',
        videoIds: ['jfKfPfyJRdk'],
        embedUrl: 'https://www.youtube-nocookie.com/embed/jfKfPfyJRdk?autoplay=1'
      });
    }

    return NextResponse.json({
      videoId: videoIds[0],
      videoIds,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoIds[0]}?autoplay=1`
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
