import { memberOf } from './members';

describe('member helpers', () => {
  it('shows the person the directory knows, and the start of the id for anyone else', () => {
    const ada = { id: 'a-1', name: 'Ada', nativeLanguage: 'en', learning: 'ar', avatar: '' };

    expect(memberOf(new Map([['a-1', ada]]), 'a-1')).toBe(ada);
    expect(memberOf(new Map(), '1f9d2c0e-aaaa-bbbb').name).toBe('1f9d2c0e');
  });
});
