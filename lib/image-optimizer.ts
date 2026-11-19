/**
 * Client-Side Image Optimizer for Canvas Board
 * 
 * Accelerates image paste and upload by:
 * - Downscaling massive raw screenshots (e.g. 4K/retina captures > 2560px)
 * - Compressing raw clipboard PNG bitmaps into high-quality WebP/JPEG (< 350KB)
 * - Preserving animated GIFs and vector SVGs byte-for-byte
 * - Bypassing small images (< 1.2MB) to save CPU cycles
 */

export interface OptimizeImageOptions {
  maxDimension?: number; // default: 2560px
  quality?: number;      // default: 0.85
  minSizeToOptimize?: number; // default: 1.2MB (1,258,291 bytes)
}

export async function optimizeImageForBoard(
  file: File,
  options: OptimizeImageOptions = {}
): Promise<File> {
  // Only process images in browser environment
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) {
    return file;
  }

  // 1. Preserve animated GIFs and vector SVGs untouched
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }

  const minSize = options.minSizeToOptimize ?? 1.2 * 1024 * 1024;
  const maxDim = options.maxDimension ?? 2560;
  const quality = options.quality ?? 0.85;

  // 2. If already lightweight, keep original
  if (file.size < minSize) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const origW = bitmap.width;
    const origH = bitmap.height;

    // Check if downscale is needed
    let targetW = origW;
    let targetH = origH;

    if (origW > maxDim || origH > maxDim) {
      if (origW >= origH) {
        targetW = maxDim;
        targetH = Math.round((origH / origW) * maxDim);
      } else {
        targetH = maxDim;
        targetW = Math.round((origW / origH) * maxDim);
      }
    }

    // Render onto offscreen / HTML5 canvas
    let canvas: HTMLCanvasElement | OffscreenCanvas;
    let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(targetW, targetH);
      ctx = canvas.getContext('2d');
    } else {
      canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      ctx = canvas.getContext('2d');
    }

    if (!ctx) {
      bitmap.close?.();
      return file;
    }

    // Use high image smoothing quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close?.();

    // Export as WebP (or JPEG fallback)
    let blob: Blob | null = null;

    if ('convertToBlob' in canvas) {
      blob = await (canvas as OffscreenCanvas).convertToBlob({
        type: 'image/webp',
        quality,
      });
    } else {
      blob = await new Promise<Blob | null>((resolve) => {
        (canvas as HTMLCanvasElement).toBlob(
          (b) => resolve(b),
          'image/webp',
          quality
        );
      });
    }

    if (!blob || blob.size >= file.size) {
      // If conversion failed or didn't save size, use original
      return file;
    }

    const origExt = file.name.substring(file.name.lastIndexOf('.'));
    const baseName = origExt ? file.name.slice(0, -origExt.length) : file.name;
    const optimizedName = `${baseName}.webp`;

    return new File([blob], optimizedName, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } catch (err) {
    console.warn('[optimizeImageForBoard] Optimization bypassed:', err);
    return file;
  }
}
