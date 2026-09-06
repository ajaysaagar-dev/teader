import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid URL provided' }, { status: 400 });
    }

    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      redirect: 'follow'
    });

    const contentType = upstream.headers.get('content-type') || 'text/html';

    if (contentType.includes('text/html')) {
      let html = await upstream.text();
      const origin = parsed.origin;

      // Inject <base href="..."> so relative links, images, scripts and stylesheets resolve
      const baseTag = `<base href="${origin}/">`;
      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>${baseTag}`);
      } else if (html.includes('<head ')) {
        html = html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
      } else if (html.includes('<HEAD>')) {
        html = html.replace('<HEAD>', `<HEAD>${baseTag}`);
      } else {
        html = `${baseTag}${html}`;
      }

      // Neutralize typical frame-busting scripts
      html = html.replace(/top\.location/g, 'location');
      html = html.replace(/parent\.location/g, 'location');
      html = html.replace(/window\.top !== window\.self/g, 'false');
      html = html.replace(/top !== self/g, 'false');

      return new NextResponse(html, {
        status: upstream.status,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*'
          // Stripped: X-Frame-Options, Content-Security-Policy frame-ancestors
        }
      });
    }

    // Binary / other assets
    const arrayBuffer = await upstream.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      status: upstream.status,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch the requested website' },
      { status: 502 }
    );
  }
}
