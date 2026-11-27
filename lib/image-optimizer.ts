/**
 * Client-Side Image Optimizer for Canvas Board
 * 
 * Features:
 * - Ultra-HD / 4K image compression into optimized WebP format
 * - Multi-tier LOD (Level of Detail) variant generation (HD Master + 480px Fast Zoom Thumbnail)
 * - Hardware-accelerated OffscreenCanvas / HTML5 canvas pipeline
 * - Batch image optimization for entire canvas boards with live progress & savings tracking
 * - Safe bypass for vector SVGs and animated GIFs
 */

import { BoardElement } from '@/types/board';
import { authFetch } from '@/lib/api-client';

export interface OptimizeImageOptions {
  maxDimension?: number; // default: 4096px (Ultra-HD / 4K)
  quality?: number;      // default: 0.90 (High fidelity)
  minSizeToOptimize?: number; // default: 2.5MB (2,621,440 bytes)
}

export interface ImageVariantResult {
  file: File;
  blob: Blob;
  width: number;
  height: number;
  size: number;
}

export interface DualVariantResult {
  hdFile: File;
  thumbFile: File;
  origWidth: number;
  origHeight: number;
  origSize: number;
  hdSize: number;
  thumbSize: number;
}

export interface BatchOptimizationProgress {
  current: number;
  total: number;
  currentName: string;
  percent: number;
  savedBytes: number;
}

export interface BatchOptimizationResult {
  totalProcessed: number;
  totalSkipped: number;
  totalOriginalBytes: number;
  totalOptimizedBytes: number;
  totalSavedBytes: number;
  updatedElements: BoardElement[];
}

/**
 * Checks whether an image can and should be optimized (skips SVGs and animated GIFs).
 */
export function isImageOptimizable(url?: string, mimeType?: string): boolean {
  if (!url && !mimeType) return false;
  const target = (url || '').toLowerCase();
  const type = (mimeType || '').toLowerCase();

  if (target.endsWith('.svg') || type.includes('image/svg')) return false;
  if (target.endsWith('.gif') || type.includes('image/gif')) return false;

  return true;
}

/**
 * Fetch or decode an image URL into a Blob (handles /uploads/..., blob:..., and data:... URLs).
 */
export async function fetchImageSourceBlob(url: string): Promise<Blob | null> {
  if (!url) return null;

  try {
    // 1. Data URLs
    if (url.startsWith('data:')) {
      const res = await fetch(url);
      return await res.blob();
    }

    // 2. Relative or absolute URLs
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) {
      console.warn(`[fetchImageSourceBlob] Failed to fetch image: ${res.status}`);
      return null;
    }
    return await res.blob();
  } catch (err) {
    console.warn('[fetchImageSourceBlob] Error retrieving image blob:', err);
    return null;
  }
}

/**
 * Core image resizer and WebP compressor using browser Canvas APIs.
 */
export async function createImageVariant(
  source: Blob | File | ImageBitmap,
  maxDimension: number,
  quality: number,
  outputFilename: string
): Promise<ImageVariantResult | null> {
  if (typeof window === 'undefined') return null;

  let bitmap: ImageBitmap | null = null;
  let shouldCloseBitmap = false;

  try {
    if (source instanceof ImageBitmap) {
      bitmap = source;
    } else {
      bitmap = await createImageBitmap(source);
      shouldCloseBitmap = true;
    }

    const origW = bitmap.width;
    const origH = bitmap.height;

    let targetW = origW;
    let targetH = origH;

    if (origW > maxDimension || origH > maxDimension) {
      if (origW >= origH) {
        targetW = maxDimension;
        targetH = Math.max(1, Math.round((origH / origW) * maxDimension));
      } else {
        targetH = maxDimension;
        targetW = Math.max(1, Math.round((origW / origH) * maxDimension));
      }
    }

    // OffscreenCanvas or fallback HTML5 Canvas
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
      if (shouldCloseBitmap) bitmap.close?.();
      return null;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    if (shouldCloseBitmap) {
      bitmap.close?.();
    }

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

    if (!blob) return null;

    const file = new File([blob], outputFilename, {
      type: 'image/webp',
      lastModified: Date.now(),
    });

    return {
      file,
      blob,
      width: targetW,
      height: targetH,
      size: blob.size,
    };
  } catch (err) {
    if (shouldCloseBitmap && bitmap) bitmap.close?.();
    console.warn('[createImageVariant] Failed:', err);
    return null;
  }
}

/**
 * Generates both an HD Master WebP and a compact 480px Thumbnail WebP from an image source.
 */
export async function generateBoardImageVariants(
  source: Blob | File,
  baseFilename: string,
  hdMaxDimension = 3840,
  hdQuality = 0.88,
  thumbMaxDimension = 480,
  thumbQuality = 0.70
): Promise<DualVariantResult | null> {
  try {
    const bitmap = await createImageBitmap(source);
    const origWidth = bitmap.width;
    const origHeight = bitmap.height;
    const origSize = source.size;

    const cleanBase = baseFilename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'image';
    const hdName = `${cleanBase}_hd.webp`;
    const thumbName = `${cleanBase}_thumb.webp`;

    // 1. Generate HD Master
    const hdResult = await createImageVariant(bitmap, hdMaxDimension, hdQuality, hdName);
    // 2. Generate Low-Res LOD Thumbnail
    const thumbResult = await createImageVariant(bitmap, thumbMaxDimension, thumbQuality, thumbName);

    bitmap.close?.();

    if (!hdResult || !thumbResult) {
      return null;
    }

    return {
      hdFile: hdResult.file,
      thumbFile: thumbResult.file,
      origWidth,
      origHeight,
      origSize,
      hdSize: hdResult.size,
      thumbSize: thumbResult.size,
    };
  } catch (err) {
    console.warn('[generateBoardImageVariants] Failed:', err);
    return null;
  }
}

/**
 * Client-Side Single Image Optimizer for Canvas Board (Paste / Drop Upload)
 */
export async function optimizeImageForBoard(
  file: File,
  options: OptimizeImageOptions = {}
): Promise<File> {
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) {
    return file;
  }

  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }

  const minSize = options.minSizeToOptimize ?? 2.5 * 1024 * 1024;
  const maxDim = options.maxDimension ?? 4096;
  const quality = options.quality ?? 0.90;

  if (file.size < minSize) {
    return file;
  }

  try {
    const origExt = file.name.substring(file.name.lastIndexOf('.'));
    const baseName = origExt ? file.name.slice(0, -origExt.length) : file.name;
    const optimizedName = `${baseName}.webp`;

    const result = await createImageVariant(file, maxDim, quality, optimizedName);
    if (!result || result.size >= file.size) {
      return file;
    }

    return result.file;
  } catch (err) {
    console.warn('[optimizeImageForBoard] Optimization bypassed:', err);
    return file;
  }
}

/**
 * Upload an optimized File to the project's board uploads directory
 */
export async function uploadOptimizedFile(
  projectId: number | string,
  file: File
): Promise<{ url: string; size: number } | null> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await authFetch(`/api/projects/${projectId}/boards/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      console.warn(`[uploadOptimizedFile] Server returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    return {
      url: data.url,
      size: data.size || file.size,
    };
  } catch (err) {
    console.warn('[uploadOptimizedFile] Upload failed:', err);
    return null;
  }
}

/**
 * Batch optimizes all images on a canvas board:
 * - Converts to HD WebP and creates 480px LOD thumbnails
 * - Uploads both assets to the server
 * - Updates element metadata and URLs
 * - Reports live progress
 */
export async function batchOptimizeBoardImages(
  projectId: number | string,
  elements: BoardElement[],
  options: {
    hdMaxDimension?: number;
    hdQuality?: number;
    generateThumbnails?: boolean;
    onProgress?: (progress: BatchOptimizationProgress) => void;
  } = {}
): Promise<BatchOptimizationResult> {
  const {
    hdMaxDimension = 3840,
    hdQuality = 0.88,
    generateThumbnails = true,
    onProgress,
  } = options;

  const imageElements = elements.filter(
    (el) => el.type === 'image' && isImageOptimizable(el.url, el.metadata?.mimeType)
  );

  const total = imageElements.length;
  let current = 0;
  let totalOriginalBytes = 0;
  let totalOptimizedBytes = 0;
  let totalSavedBytes = 0;
  let totalSkipped = 0;

  const updatedElementsMap = new Map<string, BoardElement>();

  for (const elem of imageElements) {
    current++;
    const elemName = elem.title || elem.metadata?.filename || `image-${elem.id}`;

    onProgress?.({
      current,
      total,
      currentName: elemName,
      percent: Math.round(((current - 1) / total) * 100),
      savedBytes: totalSavedBytes,
    });

    const sourceUrl = elem.url || (elem.metadata as any)?.dataUrl;
    if (!sourceUrl) {
      totalSkipped++;
      continue;
    }

    try {
      const blob = await fetchImageSourceBlob(sourceUrl);
      if (!blob) {
        totalSkipped++;
        continue;
      }

      const origSize = blob.size;
      totalOriginalBytes += origSize;

      // Generate HD + Thumbnail variants
      const variants = await generateBoardImageVariants(
        blob,
        elemName,
        hdMaxDimension,
        hdQuality,
        480,
        0.70
      );

      if (!variants) {
        totalSkipped++;
        continue;
      }

      // Check if optimization actually reduced size or if element was already optimal
      const shouldKeepHd = variants.hdSize < origSize || !elem.url?.endsWith('.webp');

      let uploadedHdUrl = elem.url;
      let finalHdSize = origSize;

      if (shouldKeepHd) {
        const uploadedHd = await uploadOptimizedFile(projectId, variants.hdFile);
        if (uploadedHd) {
          uploadedHdUrl = uploadedHd.url;
          finalHdSize = uploadedHd.size;
        }
      }

      // Upload LOD thumbnail
      let uploadedThumbUrl = elem.thumbnailUrl;
      let finalThumbSize = 0;

      if (generateThumbnails) {
        const uploadedThumb = await uploadOptimizedFile(projectId, variants.thumbFile);
        if (uploadedThumb) {
          uploadedThumbUrl = uploadedThumb.url;
          finalThumbSize = uploadedThumb.size;
        }
      }

      const savedForElem = Math.max(0, origSize - finalHdSize);
      totalOptimizedBytes += finalHdSize;
      totalSavedBytes += savedForElem;

      // Update element
      const updatedElem: BoardElement = {
        ...elem,
        url: uploadedHdUrl,
        thumbnailUrl: uploadedThumbUrl,
        metadata: {
          ...elem.metadata,
          url: uploadedHdUrl,
          thumbnailUrl: uploadedThumbUrl,
          optimized: true,
          optimizedAt: new Date().toISOString(),
          originalSize: origSize,
          hdSize: finalHdSize,
          thumbnailSize: finalThumbSize,
          savedBytes: savedForElem,
        },
      };

      updatedElementsMap.set(elem.id, updatedElem);
    } catch (elemErr) {
      console.warn(`[batchOptimizeBoardImages] Failed on element ${elem.id}:`, elemErr);
      totalSkipped++;
    }

    onProgress?.({
      current,
      total,
      currentName: elemName,
      percent: Math.round((current / total) * 100),
      savedBytes: totalSavedBytes,
    });
  }

  const updatedElements = elements.map((el) => updatedElementsMap.get(el.id) || el);

  return {
    totalProcessed: updatedElementsMap.size,
    totalSkipped,
    totalOriginalBytes,
    totalOptimizedBytes,
    totalSavedBytes,
    updatedElements,
  };
}
