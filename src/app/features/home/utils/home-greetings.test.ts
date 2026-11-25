import {
  formatEditorialIndex,
  formatLiveRoomsSummary,
  HOME_GREETINGS,
  nextCyclicIndex,
} from './home-greetings';

describe('home-greetings', () => {
  it('provides six distinct multilingual greetings including RTL Arabic', () => {
    expect(HOME_GREETINGS.length).toBe(6);
    const arabic = HOME_GREETINGS.find((g) => g.lang === 'ar');
    expect(arabic?.dir).toBe('rtl');
    expect(arabic?.text).toBe('مرحبا');
  });

  it('cycles indices cleanly and wraps around boundaries', () => {
    expect(nextCyclicIndex(0, 6)).toBe(1);
    expect(nextCyclicIndex(5, 6)).toBe(0);
    expect(nextCyclicIndex(-1, 6)).toBe(0);
    expect(nextCyclicIndex(3, 4)).toBe(0);
    expect(nextCyclicIndex(1, 0)).toBe(0);
  });

  it('formats live room counts with natural copy', () => {
    expect(formatLiveRoomsSummary(0)).toBe('Start the first room');
    expect(formatLiveRoomsSummary(1)).toBe('1 open now');
    expect(formatLiveRoomsSummary(4)).toBe('4 open now');
  });

  it('formats editorial two-digit indices', () => {
    expect(formatEditorialIndex(0)).toBe('01');
    expect(formatEditorialIndex(3)).toBe('04');
    expect(formatEditorialIndex(9)).toBe('10');
  });
});
