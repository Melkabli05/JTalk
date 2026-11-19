/** The largest file we agree to look at: a phone's photo is a few megabytes, and decoding something far bigger only freezes the page. */
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

/** The biggest square in the middle of a picture of this size: where it starts and how long its side is. */
export function centredSquare(
  width: number,
  height: number,
): { x: number; y: number; edge: number } {
  const edge = Math.min(width, height);
  return { x: (width - edge) / 2, y: (height - edge) / 2, edge };
}

/**
 * A square JPEG of a picture the person chose: the middle of it, scaled to `side` pixels. What is sent is a few tens of kilobytes, however
 * large the photo was. Rejects, with words for the person, when the file is not a picture or is too big to open.
 */
export async function squareJpeg(file: File, side = 256, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose a picture (a JPEG or PNG file).');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('That picture is too large. Choose one under 15 MB.');
  }
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('That file could not be opened as a picture.');
  });
  try {
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const { x, y, edge } = centredSquare(bitmap.width, bitmap.height);
    canvas.getContext('2d')?.drawImage(bitmap, x, y, edge, edge, 0, 0, side, side);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('That picture could not be prepared.'))),
        'image/jpeg',
        quality,
      );
    });
  } finally {
    bitmap.close();
  }
}
