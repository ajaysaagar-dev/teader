import { describe, it, expect } from 'vitest';

export function calculatePreviewZoom(currentZoom: number, deltaY: number, step = 0.08, min = 0.5, max = 2.5): number {
  const direction = deltaY < 0 ? step : -step;
  const target = currentZoom + direction;
  return Math.min(max, Math.max(min, Number(target.toFixed(2))));
}

export function shouldTriggerPreviewZoom(e: { ctrlKey?: boolean; metaKey?: boolean }): boolean {
  return Boolean(e.ctrlKey || e.metaKey);
}

describe('Docs Preview Zoom In & Zoom Out Engine', () => {
  it('zooms in when wheel is scrolled up (negative deltaY)', () => {
    const initial = 1.0;
    const next = calculatePreviewZoom(initial, -100);
    expect(next).toBe(1.08);
    expect(next).toBeGreaterThan(initial);
  });

  it('zooms out when wheel is scrolled down (positive deltaY)', () => {
    const initial = 1.0;
    const next = calculatePreviewZoom(initial, 100);
    expect(next).toBe(0.92);
    expect(next).toBeLessThan(initial);
  });

  it('clamps zoom out at min 50% (0.5)', () => {
    let zoom = 0.6;
    zoom = calculatePreviewZoom(zoom, 100);
    expect(zoom).toBe(0.52);
    zoom = calculatePreviewZoom(zoom, 100);
    expect(zoom).toBe(0.5);
    zoom = calculatePreviewZoom(zoom, 100);
    expect(zoom).toBe(0.5);
  });

  it('clamps zoom in at max 250% (2.5)', () => {
    let zoom = 2.45;
    zoom = calculatePreviewZoom(zoom, -100);
    expect(zoom).toBe(2.5);
    zoom = calculatePreviewZoom(zoom, -100);
    expect(zoom).toBe(2.5);
  });

  it('detects Ctrl and Meta keys correctly for zoom wheel triggering', () => {
    expect(shouldTriggerPreviewZoom({ ctrlKey: true })).toBe(true);
    expect(shouldTriggerPreviewZoom({ metaKey: true })).toBe(true);
    expect(shouldTriggerPreviewZoom({ ctrlKey: false, metaKey: false })).toBe(false);
    expect(shouldTriggerPreviewZoom({})).toBe(false);
  });
});
