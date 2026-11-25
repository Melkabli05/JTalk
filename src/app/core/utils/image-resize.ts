/**
 * Center-crops and resizes a user-selected image file into a 256×256 JPEG Blob
 * below the User Service's 204,800-byte avatar limit.
 */
export const MAX_AVATAR_BYTES = 204_800;
const AVATAR_SIZE = 256;

export async function squareJpeg(file: File, signal?: AbortSignal): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    if (signal?.aborted) {
      throw new DOMException('Image encoding aborted.', 'AbortError');
    }
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = Math.floor((bitmap.width - side) / 2);
    const sy = Math.floor((bitmap.height - side) / 2);

    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not prepare image encoder.');
    }

    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

    let quality = 0.86;
    while (quality >= 0.45) {
      if (signal?.aborted) {
        throw new DOMException('Image encoding aborted.', 'AbortError');
      }
      const blob = await canvasToJpegBlob(canvas, quality);
      if (blob.size <= MAX_AVATAR_BYTES) {
        return blob;
      }
      quality -= 0.1;
    }

    const fallback = await canvasToJpegBlob(canvas, 0.4);
    if (fallback.size > MAX_AVATAR_BYTES) {
      throw new Error('Image is still too large after compression. Choose a simpler photo.');
    }
    return fallback;
  } finally {
    bitmap.close();
  }
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Could not encode JPEG image.'));
        }
      },
      'image/jpeg',
      quality,
    );
  });
}
