import { GREETINGS, partOfDay } from './greeting';

describe('partOfDay', () => {
  it('is morning from five until noon, afternoon until six, evening until ten, and night until five', () => {
    expect([5, 8, 11].map(partOfDay)).toEqual(['morning', 'morning', 'morning']);
    expect([12, 15, 17].map(partOfDay)).toEqual(['afternoon', 'afternoon', 'afternoon']);
    expect([18, 20, 21].map(partOfDay)).toEqual(['evening', 'evening', 'evening']);
    expect([22, 23, 0, 3, 4].map(partOfDay)).toEqual(['night', 'night', 'night', 'night', 'night']);
  });

  it('has a greeting with a name and one without for each part of the day', () => {
    for (const [without, withName] of Object.values(GREETINGS)) {
      expect(without).not.toContain('{name}');
      expect(withName).toContain('{name}');
    }
  });
});
