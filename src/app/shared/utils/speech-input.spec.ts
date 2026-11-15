import { createSpeechInput, speechInputSupported } from './speech-input';

class FakeRecognition {
  static last: FakeRecognition;
  lang = '';
  continuous = true;
  interimResults = false;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  constructor() {
    FakeRecognition.last = this;
  }
}

describe('speech input', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is unavailable in a browser without speech recognition', () => {
    expect(speechInputSupported()).toBe(false);
    expect(
      createSpeechInput({ lang: 'en-US', onTranscript: vi.fn(), onEnd: vi.fn(), onError: vi.fn() }),
    ).toBeUndefined();
  });

  it('listens in the given language, and passes on what was heard, the end and errors', () => {
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
    const onTranscript = vi.fn();
    const onEnd = vi.fn();
    const onError = vi.fn();
    const input = createSpeechInput({ lang: 'ar-SA', onTranscript, onEnd, onError })!;

    expect(speechInputSupported()).toBe(true);
    expect(FakeRecognition.last.lang).toBe('ar-SA');
    expect(FakeRecognition.last.continuous).toBe(false);
    expect(FakeRecognition.last.interimResults).toBe(true);

    input.start();
    input.stop();
    expect(FakeRecognition.last.start).toHaveBeenCalledOnce();
    expect(FakeRecognition.last.stop).toHaveBeenCalledOnce();

    FakeRecognition.last.onresult?.({
      results: [[{ transcript: 'مرحبا ' }], [{ transcript: 'بك' }]],
    });
    expect(onTranscript).toHaveBeenCalledExactlyOnceWith('مرحبا بك');
    FakeRecognition.last.onerror?.({ error: 'no-speech' });
    expect(onError).toHaveBeenCalledExactlyOnceWith('no-speech');
    FakeRecognition.last.onend?.();
    expect(onEnd).toHaveBeenCalledOnce();
  });
});
