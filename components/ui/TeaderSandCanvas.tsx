'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ButterflyParticle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  baseAngle: number;
  baseSpeed: number;
  flutterFreq: number;
  flutterAmp: number;
  flutterPhase: number;
  curveFactor: number;
  size: number;
  color: string;
  alpha: number;
  delay: number;
}

const BUTTERFLY_COLORS = [
  '#DCB001', // Primary Golden Amber
  '#FDE047', // Radiant Sun Gold
  '#F59E0B', // Amber Honey
  '#FBBF24', // Warm Topaz
  '#FEF08A', // Pale Shimmer
  '#FFFFFF', // Stardust White
  '#38BDF8', // Ethereal Cyan Glint
];

export const TeaderSandCanvas: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);

  useEffect(() => {
    // 1. DevTools Console Banner
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
    let particles: ButterflyParticle[] = [];
    let startTime = Date.now();

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    // 2. Render solid bold "TEADER" text to extract particle pixel positions
    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const offCtx = offscreen.getContext('2d');

    const fontSize = Math.min(canvas.width * 0.16, 130);

    if (offCtx) {
      offCtx.fillStyle = '#FFFFFF';
      offCtx.font = `900 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      offCtx.textAlign = 'center';
      offCtx.textBaseline = 'middle';
      offCtx.fillText('TEADER', canvas.width / 2, canvas.height / 2);

      // Subtitle below
      offCtx.font = `700 ${Math.max(12, fontSize * 0.15)}px monospace`;
      offCtx.fillText('HIGH-VELOCITY PLATFORM', canvas.width / 2, canvas.height / 2 + fontSize * 0.65);

      const imgData = offCtx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Sample particle mesh
      const step = Math.max(3, Math.floor(canvas.width / 450));
      for (let y = 0; y < canvas.height; y += step) {
        for (let x = 0; x < canvas.width; x += step) {
          const index = (y * canvas.width + x) * 4;
          const alpha = data[index + 3];

          if (alpha > 128) {
            // Random 360-degree direction with varied speeds for butterfly flight
            const baseAngle = Math.random() * Math.PI * 2;
            const isFastGlider = Math.random() < 0.25;
            const baseSpeed = isFastGlider 
              ? 3.5 + Math.random() * 4.5 
              : 1.2 + Math.random() * 2.8;

            particles.push({
              x,
              y,
              originX: x,
              originY: y,
              baseAngle,
              baseSpeed,
              flutterFreq: 0.04 + Math.random() * 0.08,
              flutterAmp: 1.2 + Math.random() * 3.5,
              flutterPhase: Math.random() * Math.PI * 2,
              curveFactor: (Math.random() - 0.5) * 0.04,
              size: 1.4 + Math.random() * 2.2,
              color: BUTTERFLY_COLORS[Math.floor(Math.random() * BUTTERFLY_COLORS.length)],
              alpha: 1,
              delay: 850 + Math.random() * 600, // Stay solid bold text first, then smoothly dissolve
            });
          }
        }
      }
    }

    // 3. Animation Loop
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const elapsed = Date.now() - startTime;

      // ─── Phase 1: Draw Thick Solid Bold "TEADER" Text ────────────
      // Stays fully solid for the first 800ms, then fades out smoothly as particles disperse
      const textFadeStart = 800;
      const textFadeEnd = 1300;
      let textAlpha = 1;

      if (elapsed > textFadeEnd) {
        textAlpha = 0;
      } else if (elapsed > textFadeStart) {
        textAlpha = 1 - (elapsed - textFadeStart) / (textFadeEnd - textFadeStart);
      }

      if (textAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = textAlpha;

        // Glowing outer drop shadow
        ctx.shadowColor = '#DCB001';
        ctx.shadowBlur = 28;

        // Gradient fill for bold solid typography
        const textGrad = ctx.createLinearGradient(
          canvas.width / 2 - 200, 
          canvas.height / 2 - 50, 
          canvas.width / 2 + 200, 
          canvas.height / 2 + 50
        );
        textGrad.addColorStop(0, '#DCB001');
        textGrad.addColorStop(0.5, '#FDE047');
        textGrad.addColorStop(1, '#F59E0B');

        ctx.fillStyle = textGrad;
        ctx.font = `900 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TEADER', canvas.width / 2, canvas.height / 2);

        // Subtitle
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#CFD4DD';
        ctx.font = `700 ${Math.max(12, fontSize * 0.15)}px monospace`;
        ctx.fillText('HIGH-VELOCITY PLATFORM', canvas.width / 2, canvas.height / 2 + fontSize * 0.65);

        ctx.restore();
      }

      // ─── Phase 2: Butterfly Flying Style Particles ─────────────────
      let activeCount = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (elapsed > p.delay) {
          const flightTime = elapsed - p.delay;

          // Butterfly wing flutter oscillation perpendicular to heading
          p.baseAngle += p.curveFactor;
          const flutter = Math.sin(flightTime * p.flutterFreq + p.flutterPhase) * p.flutterAmp;

          // Velocity components with harmonic fluttering
          const vx = Math.cos(p.baseAngle) * p.baseSpeed + Math.cos(p.baseAngle + Math.PI / 2) * flutter;
          const vy = Math.sin(p.baseAngle) * p.baseSpeed + Math.sin(p.baseAngle + Math.PI / 2) * flutter;

          p.x += vx;
          p.y += vy;

          // Air drag & smooth graceful fade out
          p.baseSpeed *= 0.992;
          p.alpha = Math.max(0, p.alpha - 0.009);
        } else if (elapsed > 700) {
          // Subtle shimmer right before take-off
          p.alpha = 0.6 + Math.sin(elapsed * 0.02) * 0.4;
        } else {
          // Hide particles during solid text phase
          p.alpha = 0;
        }

        if (p.alpha > 0.01) {
          activeCount++;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // ─── Phase 3: Transition Out ──────────────────────────────────
      if (elapsed > 3500 || (elapsed > 1500 && activeCount === 0)) {
        setIsOverlayVisible(false);
        if (onComplete) onComplete();
      } else {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    animationFrameId = requestAnimationFrame(render);

    const handleResize = () => resize();
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
          transition={{ duration: 0.7 }}
          onClick={() => setIsOverlayVisible(false)}
          className="fixed inset-0 z-[100] bg-[#0A0B0D]/95 backdrop-blur-md flex items-center justify-center pointer-events-auto cursor-pointer select-none"
          title="Click to skip animation"
        >
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
          <div className="absolute bottom-8 text-[11px] font-mono text-[#787C83] animate-pulse">
            Click anywhere to enter • Butterfly Particle Intro
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
