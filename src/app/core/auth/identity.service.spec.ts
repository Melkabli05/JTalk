import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { DEV_IDENTITY } from './dev-identity.token';
import type { Person } from './identity.models';
import { IdentityService } from './identity.service';

const MONA: Person = { id: 'm-1', name: 'Mona', nativeLanguage: 'ar', learning: 'en', avatar: '' };

describe('IdentityService', () => {
  function setup(devMode = true, stored?: unknown) {
    sessionStorage.clear();
    localStorage.clear();
    if (stored !== undefined) {
      localStorage.setItem(
        'jtalk:profile',
        typeof stored === 'string' ? stored : JSON.stringify(stored),
      );
    }
    TestBed.configureTestingModule({ providers: [{ provide: DEV_IDENTITY, useValue: devMode }] });
    return TestBed.inject(IdentityService);
  }

  it('needs a profile until one is saved', () => {
    const identity = setup();

    expect(identity.needsProfile()).toBe(true);
    expect(identity.userId()).toBeNull();

    identity.saveProfile({ name: 'Mona', nativeLanguage: 'ar', learning: 'en', avatar: '' });

    expect(identity.needsProfile()).toBe(false);
  });

  it('does not ask for a profile when the build has no development identity', () => {
    expect(setup(false).needsProfile()).toBe(false);
  });

  it('makes an id for a saved profile, with a trimmed name, and keeps it in this browser', () => {
    const identity = setup();

    identity.saveProfile({ name: '  Mona  ', nativeLanguage: 'ar', learning: 'en', avatar: '' });

    const saved = identity.profile();
    expect(saved?.name).toBe('Mona');
    expect(saved?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(localStorage.getItem('jtalk:profile') ?? 'null')).toEqual(saved);
    expect(identity.userId()).toBe(saved?.id);
    expect(identity.devUserId()).toBe(saved?.id);
  });

  it('keeps the chosen picture with the profile', () => {
    const identity = setup();

    identity.saveProfile({
      name: 'Mona',
      nativeLanguage: 'ar',
      learning: 'en',
      avatar: 'avatar-05',
    });

    expect(identity.profile()?.avatar).toBe('avatar-05');
    expect(JSON.parse(localStorage.getItem('jtalk:profile') ?? '{}')).toMatchObject({
      avatar: 'avatar-05',
    });
  });

  it('reads a profile with no picture, such as an older one, as having an empty picture', () => {
    const identity = setup(true, { id: 'm-1', name: 'Mona', nativeLanguage: 'ar', learning: 'en' });

    expect(identity.profile()?.avatar).toBe('');
  });

  it('keeps the same id when the profile is edited', () => {
    const identity = setup(true, MONA);

    identity.saveProfile({
      name: 'Mona K',
      nativeLanguage: 'fr',
      learning: 'de',
      avatar: 'avatar-02',
    });

    expect(identity.profile()).toEqual({
      id: 'm-1',
      name: 'Mona K',
      nativeLanguage: 'fr',
      learning: 'de',
      avatar: 'avatar-02',
    });
  });

  it('remembers the profile from last time, and knows this person by name', () => {
    const identity = setup(true, MONA);

    expect(identity.needsProfile()).toBe(false);
    expect([...identity.directory().keys()]).toEqual(['m-1']);
    expect(identity.directory().get('m-1')?.name).toBe('Mona');
  });

  it.each(['not json', '{"id":1}', 'null'])(
    'ignores a stored profile that is not valid: %s',
    (stored) => {
      const identity = setup(true, stored);

      expect(identity.profile()).toBeNull();
      expect(identity.needsProfile()).toBe(true);
    },
  );

  it('is the subject of the token once there is one, and then needs no profile', () => {
    sessionStorage.setItem('jtalk:token', `x.${btoa(JSON.stringify({ sub: 'from-token' }))}.y`);
    TestBed.configureTestingModule({ providers: [{ provide: DEV_IDENTITY, useValue: true }] });

    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(true);
    expect(TestBed.inject(IdentityService).userId()).toBe('from-token');
    expect(TestBed.inject(IdentityService).needsProfile()).toBe(false);
  });
});
