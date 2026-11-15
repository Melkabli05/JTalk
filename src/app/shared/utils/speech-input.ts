interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionConstructor = new () => Recognition;

interface SpeechWindow {
  readonly SpeechRecognition?: RecognitionConstructor;
  readonly webkitSpeechRecognition?: RecognitionConstructor;
}

const recognitionConstructor = (): RecognitionConstructor | undefined => {
  const speech = globalThis as unknown as SpeechWindow;
  return speech.SpeechRecognition ?? speech.webkitSpeechRecognition;
};

export const speechInputSupported = (): boolean => recognitionConstructor() !== undefined;

export interface SpeechInput {
  start(): void;
  stop(): void;
}

export interface SpeechInputHandlers {
  readonly lang: string;
  readonly onTranscript: (transcript: string) => void;
  readonly onEnd: () => void;
  readonly onError: (code: string) => void;
}

export function createSpeechInput(handlers: SpeechInputHandlers): SpeechInput | undefined {
  const Recognition = recognitionConstructor();
  if (Recognition === undefined) {
    return undefined;
  }
  const recognition = new Recognition();
  recognition.lang = handlers.lang;
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.onresult = (event) =>
    handlers.onTranscript(
      Array.from(event.results, (result) => result[0]?.transcript ?? '').join(''),
    );
  recognition.onerror = (event) => handlers.onError(event.error);
  recognition.onend = () => handlers.onEnd();
  return { start: () => recognition.start(), stop: () => recognition.stop() };
}
