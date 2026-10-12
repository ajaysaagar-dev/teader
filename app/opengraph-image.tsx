import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'Teader - AI-Native High-Velocity Project Management Platform';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#000000',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '80px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Top Header Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              fontSize: '52px',
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: '-1.5px',
            }}
          >
            teader
          </div>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              background: '#0A0A0A',
              border: '1px solid #2E2E2E',
              color: '#EDEDED',
              fontSize: '18px',
              fontWeight: 600,
            }}
          >
            AI-Native Project Workspace
          </div>
        </div>

        {/* Center Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            maxWidth: '1020px',
          }}
        >
          <div
            style={{
              fontSize: '58px',
              fontWeight: 800,
              color: '#FFFFFF',
              lineHeight: 1.15,
              letterSpacing: '-1.5px',
            }}
          >
            The High-Velocity Project Tracker Engineered for Developers.
          </div>
          <div
            style={{
              fontSize: '24px',
              color: '#A3A3A3',
              lineHeight: 1.4,
            }}
          >
            0ms Optimistic UI • Real-time Sync • Markdown Docs • Multi-Agent Workflows
          </div>
        </div>

        {/* Bottom Feature Tags */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
          }}
        >
          <div
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              background: '#0A0A0A',
              border: '1px solid #2E2E2E',
              color: '#EDEDED',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            0ms Optimistic UI
          </div>
          <div
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              background: '#0A0A0A',
              border: '1px solid #2E2E2E',
              color: '#EDEDED',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            Branch Visualizer
          </div>
          <div
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              background: '#0A0A0A',
              border: '1px solid #2E2E2E',
              color: '#EDEDED',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            Live Markdown Docs
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
