import { GREETINGS, partOfDay } from './greeting';

describe('partOfDay', () => {
  it('splits the day at noon and at six in the evening', () => {
    expect([0, 5, 11].map(partOfDay)).toEqual(['morning', 'morning', 'morning']);
    expect([12, 17].map(partOfDay)).toEqual(['afternoon', 'afternoon']);
    expect([18, 23].map(partOfDay)).toEqual(['evening', 'evening']);
  });

  it('has a greeting with a name and one without for each part of the day', () => {
    for (const [without, withName] of Object.values(GREETINGS)) {
      expect(without).not.toContain('{name}');
      expect(withName).toContain('{name}');
    }
  });
});
