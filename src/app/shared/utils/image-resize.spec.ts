import { centredSquare, squareJpeg } from './image-resize';

const png = (bytes = 10) => new File([new Uint8Array(bytes)], 'photo.png', { type: 'image/png' });

describe('centredSquare', () => {
  it('takes the middle of a wide picture', () => {
    expect(centredSquare(1600, 900)).toEqual({ x: 350, y: 0, edge: 900 });
  });

  it('takes the middle of a tall one', () => {
    expect(centredSquare(300, 900)).toEqual({ x: 0, y: 300, edge: 300 });
  });

  it('takes all of a square one', () => {
    expect(centredSquare(500, 500)).toEqual({ x: 0, y: 0, edge: 500 });
  });
});

describe('squareJpeg', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function browser(size: { width: number; height: number }) {
    const close = vi.fn();
    const drawImage = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ ...size, close }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation((done) => done(new Blob(['jpeg'], { type: 'image/jpeg' })));
    return { close, drawImage, toBlob };
  }

  it('draws the middle of the picture, scaled to the side asked for, as a JPEG', async () => {
    const { close, drawImage, toBlob } = browser({ width: 1600, height: 900 });

    const result = await squareJpeg(png(), 128, 0.7);

    expect(result.type).toBe('image/jpeg');
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 350, 0, 900, 900, 0, 0, 128, 128);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.7);
    expect(close).toHaveBeenCalledOnce();
  });

  it('makes a 256 pixel square unless asked for another size', async () => {
    const { drawImage } = browser({ width: 300, height: 300 });

    await squareJpeg(png());

    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 300, 300, 0, 0, 256, 256);
  });

  it('refuses what is not a picture, in words a person can read', async () => {
    await expect(squareJpeg(new File(['hello'], 'a.txt', { type: 'text/plain' }))).rejects.toThrow(
      'Choose a picture',
    );
  });

  it('refuses a file that says it is a picture and is not', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode')));

    await expect(squareJpeg(png())).rejects.toThrow('could not be opened');
  });

  it('refuses a file that is too large to open', async () => {
    await expect(squareJpeg(png(16 * 1024 * 1024))).rejects.toThrow('too large');
  });

  it('says so when the browser cannot make the picture', async () => {
    browser({ width: 100, height: 100 });
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) => done(null));

    await expect(squareJpeg(png())).rejects.toThrow('could not be prepared');
  });
});
