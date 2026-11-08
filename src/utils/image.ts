// Screenshot helpers: keep stored images small so localStorage (~5 MB) is not exhausted (D1).

export const MAX_IMAGE_BYTES = 300 * 1024;

export function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

// Decoded size in bytes of the base64 payload of a data URL.
export function dataUrlBytes(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

// Tries progressively smaller sizes and lower JPEG quality until the result fits MAX_IMAGE_BYTES.
// Ordinary screenshots fit on the first try; noisy photos may need a smaller size.
export async function downscaleImage(file: File, maxDim = 1280, quality = 0.7): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const dims = [maxDim, 1024, 800, 640].filter((d) => d <= maxDim);
    const qualities = [quality, 0.5, 0.35];
    for (const dim of dims) {
      const { width, height } = fitWithin(bitmap.width, bitmap.height, dim);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not process the image in this browser');
      // JPEG has no alpha: paint white first so transparent PNGs do not turn black.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      for (const q of qualities) {
        const dataUrl = canvas.toDataURL('image/jpeg', q);
        if (dataUrlBytes(dataUrl) <= MAX_IMAGE_BYTES) return dataUrl;
      }
    }
    throw new Error('Image is still too large after resizing. Try a smaller screenshot.');
  } finally {
    bitmap.close();
  }
}
