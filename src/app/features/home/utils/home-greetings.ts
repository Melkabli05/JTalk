export interface HomeGreeting {
  readonly text: string;
  readonly lang: string;
  readonly dir?: 'ltr' | 'rtl';
}

export const HOME_GREETINGS: readonly HomeGreeting[] = [
  { text: 'Hola', lang: 'es', dir: 'ltr' },
  { text: 'Hello', lang: 'en', dir: 'ltr' },
  { text: 'مرحبا', lang: 'ar', dir: 'rtl' },
  { text: 'こんにちは', lang: 'ja', dir: 'ltr' },
  { text: 'Bonjour', lang: 'fr', dir: 'ltr' },
  { text: 'Ciao', lang: 'it', dir: 'ltr' },
];

export function nextCyclicIndex(currentIndex: number, total: number): number {
  if (total <= 0) return 0;
  const normalized = ((currentIndex % total) + total) % total;
  return (normalized + 1) % total;
}

export function formatLiveRoomsSummary(liveCount: number): string {
  if (liveCount <= 0) return 'Start the first room';
  return liveCount === 1 ? '1 open now' : `${liveCount} open now`;
}

export function formatEditorialIndex(index: number): string {
  return String(Math.max(1, index + 1)).padStart(2, '0');
}
