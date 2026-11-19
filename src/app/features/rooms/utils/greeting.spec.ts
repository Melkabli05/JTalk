import { greetingFor, partOfDay } from './greeting';

describe('partOfDay', () => {
  it('is morning from five until noon, afternoon until six, evening until ten, and night until five', () => {
    expect([5, 8, 11].map(partOfDay)).toEqual(['morning', 'morning', 'morning']);
    expect([12, 15, 17].map(partOfDay)).toEqual(['afternoon', 'afternoon', 'afternoon']);
    expect([18, 20, 21].map(partOfDay)).toEqual(['evening', 'evening', 'evening']);
    expect([22, 23, 0, 3, 4].map(partOfDay)).toEqual(['night', 'night', 'night', 'night', 'night']);
  });
});

describe('greetingFor', () => {
  it('names the person at their time of day, and says Hello in the small hours', () => {
    expect(greetingFor(9, 'Mona')).toBe('Good morning, Mona');
    expect(greetingFor(14, 'Mona')).toBe('Good afternoon, Mona');
    expect(greetingFor(19, 'Mona')).toBe('Good evening, Mona');
    expect(greetingFor(2, 'Mona')).toBe('Hello, Mona');
  });

  it('is only the greeting until the name is known', () => {
    expect(greetingFor(9, '')).toBe('Good morning');
  });
});
