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
          background: '#0A0B0D',
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
        {/* Glow Effects */}
        <div
          style={{
            position: 'absolute',
            top: '-60px',
            right: '-60px',
            width: '520px',
            height: '520px',
            borderRadius: '50%',
            background: 'rgba(220, 176, 1, 0.18)',
            filter: 'blur(100px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-40px',
            left: '200px',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'rgba(6, 182, 212, 0.12)',
            filter: 'blur(90px)',
          }}
        />

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
              background: '#1F2126',
              border: '1px solid #2E3138',
              color: '#DCB001',
              fontSize: '18px',
              fontWeight: 700,
              fontFamily: 'monospace',
            }}
          >
            AI-Native PM Platform
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
              color: '#8E939D',
              lineHeight: 1.4,
            }}
          >
            0ms Optimistic UI • Unity VCS Branch Explorer • Markdown Docs • PostgreSQL Realtime Sync
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
              borderRadius: '12px',
              background: 'rgba(220, 176, 1, 0.12)',
              border: '1px solid rgba(220, 176, 1, 0.35)',
              color: '#DCB001',
              fontSize: '18px',
              fontWeight: 600,
            }}
          >
            ⚡ 0ms Optimistic UI
          </div>
          <div
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              background: 'rgba(6, 182, 212, 0.12)',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              color: '#06B6D4',
              fontSize: '18px',
              fontWeight: 600,
            }}
          >
            🌿 Unity VCS Branch Splines
          </div>
          <div
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid rgba(34, 197, 94, 0.35)',
              color: '#22C55E',
              fontSize: '18px',
              fontWeight: 600,
            }}
          >
            📝 Live Markdown Specs
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
