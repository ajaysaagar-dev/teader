import { describe, it, expect, vi } from 'vitest';
import { optimizeImageForBoard } from '@/lib/image-optimizer';

describe('Client-Side Image Optimizer', () => {
  it('bypasses non-image files immediately', async () => {
    const textFile = new File(['hello world'], 'notes.txt', { type: 'text/plain' });
    const result = await optimizeImageForBoard(textFile);
    expect(result).toBe(textFile);
  });

  it('strictly preserves animated GIFs byte-for-byte to maintain animations', async () => {
    const gifFile = new File(['GIF89a fake animated gif content'], 'animation.gif', { type: 'image/gif' });
    const result = await optimizeImageForBoard(gifFile);
    expect(result).toBe(gifFile);
    expect(result.type).toBe('image/gif');
  });

  it('strictly preserves vector SVGs untouched to maintain vector resolution', async () => {
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="50"/></svg>';
    const svgFile = new File([svgContent], 'diagram.svg', { type: 'image/svg+xml' });
    const result = await optimizeImageForBoard(svgFile);
    expect(result).toBe(svgFile);
    expect(result.type).toBe('image/svg+xml');
  });

  it('bypasses lightweight images below minSizeToOptimize to conserve CPU cycles', async () => {
    const smallFile = new File(['small dummy content'], 'photo.png', { type: 'image/png' });
    const result = await optimizeImageForBoard(smallFile, { minSizeToOptimize: 1024 * 1024 });
    expect(result).toBe(smallFile);
  });

  it('handles server-side / node environment gracefully without throwing', async () => {
    // In Node.js / test environment without window or DOM canvas
    const largeDummy = new File([new Uint8Array(2 * 1024 * 1024)], 'screenshot.png', { type: 'image/png' });
    const result = await optimizeImageForBoard(largeDummy);
    expect(result).toBeDefined();
    expect(result.name).toBe('screenshot.png');
  });
});
