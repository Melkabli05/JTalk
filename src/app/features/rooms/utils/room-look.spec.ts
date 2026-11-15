import { roomLook } from './room-look';

describe('roomLook', () => {
  it('names the two languages and gives the room a steady color', () => {
    const look = roomLook({ targetLanguage: 'es', nativeLanguage: 'en' });

    expect(look.target.code).toBe('es');
    expect(look.native.code).toBe('en');
    expect(look.colors).toEqual(roomLook({ targetLanguage: 'es', nativeLanguage: 'ar' }).colors);
  });

  it('still gives something to show before the room has loaded', () => {
    const look = roomLook(undefined);

    expect(look.target.code).toBe('');
    expect(look.colors.background).toContain('--p-jtalk-tone');
  });
});
