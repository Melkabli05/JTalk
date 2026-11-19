import { GREETINGS, partOfDay, sceneFor } from './greeting';

describe('partOfDay', () => {
  it('is morning from five until noon, afternoon until six, evening until ten, and night until five', () => {
    expect([5, 8, 11].map(partOfDay)).toEqual(['morning', 'morning', 'morning']);
    expect([12, 15, 17].map(partOfDay)).toEqual(['afternoon', 'afternoon', 'afternoon']);
    expect([18, 20, 21].map(partOfDay)).toEqual(['evening', 'evening', 'evening']);
    expect([22, 23, 0, 3, 4].map(partOfDay)).toEqual(['night', 'night', 'night', 'night', 'night']);
  });

  it('has a part of the day for every hour', () => {
    for (let hour = 0; hour < 24; hour++) {
      expect(Object.keys(GREETINGS)).toContain(partOfDay(hour));
    }
  });

  it('has a greeting with a name and one without for each part of the day', () => {
    for (const [without, withName] of Object.values(GREETINGS)) {
      expect(without).not.toContain('{name}');
      expect(withName).toContain('{name}');
    }
  });
});

describe('sceneFor', () => {
  it('changes the sky every two hours, twelve skies a day', () => {
    expect([0, 1].map((h) => sceneFor(h).slot)).toEqual([0, 0]);
    expect([2, 3].map((h) => sceneFor(h).slot)).toEqual([1, 1]);
    expect([12, 13].map((h) => sceneFor(h).slot)).toEqual([6, 6]);
    expect([22, 23].map((h) => sceneFor(h).slot)).toEqual([11, 11]);
    expect(new Set(Array.from({ length: 24 }, (_, h) => sceneFor(h).slot)).size).toBe(12);
  });

  it('is dark from 8 pm to 6 am, and light from 6 am to 8 pm', () => {
    const night = Array.from({ length: 24 }, (_, h) => h).filter((h) => sceneFor(h).night);

    expect(night).toEqual([0, 1, 2, 3, 4, 5, 20, 21, 22, 23]);
  });

  it('keeps an hour outside 0 to 23 inside the day', () => {
    expect(sceneFor(24).slot).toBe(0);
    expect(sceneFor(-1).slot).toBe(11);
  });
});
