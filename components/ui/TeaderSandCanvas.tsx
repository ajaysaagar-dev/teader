'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Particle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  delay: number;
}

const SAND_COLORS = [
  '#DCB001', // Primary Golden Amber
  '#FDE047', // Radiant Gold
  '#F59E0B', // Warm Amber
  '#FBBF24', // Sun Sand
  '#FEF08A', // Pale Gold
  '#FFFFFF', // Stardust White
];

export const TeaderSandCanvas: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);

  useEffect(() => {
    // 1. Log bold formatted banner to browser console
    console.log(
      '%c TEADER %c High-Velocity Engineering & Task Platform %c ⚡ 0ms Optimistic UI ',
      'background: #DCB001; color: #0A0B0D; font-weight: 900; font-size: 22px; padding: 6px 14px; border-radius: 6px; text-transform: uppercase;',
      'background: #181A1F; color: #DCB001; font-weight: bold; font-size: 13px; padding: 6px 10px; border-radius: 4px; border: 1px solid #2E3138;',
      'background: #0E0F11; color: #22C55E; font-family: monospace; font-size: 12px; padding: 6px 8px; border-radius: 4px;'
    );

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    let startTime = Date.now();

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    // 2. Render off-screen bold "TEADER" text to sample sand particle positions
    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const offCtx = offscreen.getContext('2d');

    if (offCtx) {
      const fontSize = Math.min(canvas.width * 0.18, 140);
      offCtx.fillStyle = '#FFFFFF';
      offCtx.font = `900 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      offCtx.textAlign = 'center';
      offCtx.textBaseline = 'middle';
      offCtx.fillText('TEADER', canvas.width / 2, canvas.height / 2);

      // Subtitle below
      offCtx.font = `700 ${Math.max(14, fontSize * 0.16)}px monospace`;
      offCtx.fillText('HIGH-VELOCITY PLATFORM', canvas.width / 2, canvas.height / 2 + fontSize * 0.65);

      const imgData = offCtx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Sample particles with step density
      const step = Math.max(3, Math.floor(canvas.width / 400));
      for (let y = 0; y < canvas.height; y += step) {
        for (let x = 0; x < canvas.width; x += step) {
          const index = (y * canvas.width + x) * 4;
          const alpha = data[index + 3];

          if (alpha > 128) {
            // Random explosive outward velocity + 360-degree angle
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 6.5;
            const delay = 600 + Math.random() * 800; // time before dissolving

            particles.push({
              x: x + (Math.random() - 0.5) * 2,
              y: y + (Math.random() - 0.5) * 2,
              originX: x,
              originY: y,
              vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 2,
              vy: Math.sin(angle) * speed + (Math.random() - 0.5) * 2 - 0.5,
              size: 1.2 + Math.random() * 2.2,
              color: SAND_COLORS[Math.floor(Math.random() * SAND_COLORS.length)],
              alpha: 1,
              delay,
            });
          }
        }
      }
    }

    // 3. Animation Loop
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const elapsed = Date.now() - startTime;

      let activeCount = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (elapsed > p.delay) {
          // Dissolve & Flow like sand in all directions
          p.x += p.vx;
          p.y += p.vy;

          // Turbulence / wind curl
          p.vx += (Math.random() - 0.5) * 0.15;
          p.vy += (Math.random() - 0.5) * 0.15;

          // Friction / drag
          p.vx *= 0.985;
          p.vy *= 0.985;

          // Alpha fadeout
          p.alpha = Math.max(0, p.alpha - 0.012);
        } else {
          // Subtle breathing / glimmer while holding text shape
          const shimmer = Math.sin((elapsed + p.originX) * 0.01) * 0.2;
          p.alpha = Math.min(1, 0.85 + shimmer);
        }

        if (p.alpha > 0.01) {
          activeCount++;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Once most particles have dissolved, fade out intro canvas
      if (elapsed > 2800 || activeCount === 0) {
        setIsOverlayVisible(false);
        if (onComplete) onComplete();
      } else {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    animationFrameId = requestAnimationFrame(render);

    const handleResize = () => {
      resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isOverlayVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          onClick={() => setIsOverlayVisible(false)}
          className="fixed inset-0 z-[100] bg-[#0A0B0D]/95 backdrop-blur-md flex items-center justify-center pointer-events-auto cursor-pointer"
          title="Click to skip animation"
        >
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
          <div className="absolute bottom-8 text-[11px] font-mono text-[#787C83] animate-pulse">
            Click anywhere to enter • Sand Dissolve Intro
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
