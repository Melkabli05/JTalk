import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { DEV_IDENTITY } from './dev-identity.token';
import type { Person } from './identity.models';
import { IdentityService } from './identity.service';

const MONA: Person = { id: 'm-1', name: 'Mona', nativeLanguage: 'ar', learning: 'en', avatar: '' };
const BOB: Person = { id: 'b-2', name: 'Bob', nativeLanguage: 'en', learning: 'ar', avatar: '' };
const NO_CONTENT = { status: 204, statusText: 'No Content' };

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
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DEV_IDENTITY, useValue: devMode },
      ],
    });
    return {
      identity: TestBed.inject(IdentityService),
      http: TestBed.inject(HttpTestingController),
    };
  }

  const answerLoad = (http: HttpTestingController, people: object | null) => {
    http.expectOne({ method: 'GET', url: '/dev/users' }).flush(people);
  };

  it('needs a profile in a development build until one is saved', () => {
    const { identity, http } = setup();

    expect(identity.needsProfile()).toBe(true);
    expect(identity.userId()).toBeNull();

    identity.saveProfile({ name: 'Mona', nativeLanguage: 'ar', learning: 'en', avatar: '' });
    http.expectOne({ method: 'POST', url: '/dev/users' }).flush(null, NO_CONTENT);
    answerLoad(http, []);

    expect(identity.needsProfile()).toBe(false);
  });

  it('does not ask for a profile outside a development build, and does not look for people', () => {
    const { identity, http } = setup(false);

    identity.load().subscribe();

    expect(identity.needsProfile()).toBe(false);
    http.expectNone('/dev/users');
  });

  it('makes an id for a saved profile, keeps it in this browser, and registers it with the backend', () => {
    const { identity, http } = setup();

    identity.saveProfile({ name: '  Mona  ', nativeLanguage: 'ar', learning: 'en', avatar: '' });
    const register = http.expectOne({ method: 'POST', url: '/dev/users' });
    register.flush(null, NO_CONTENT);
    answerLoad(http, []);

    const saved = identity.profile();
    expect(saved?.name).toBe('Mona');
    expect(saved?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(register.request.body).toEqual(saved);
    expect(JSON.parse(localStorage.getItem('jtalk:profile') ?? 'null')).toEqual(saved);
    expect(identity.needsProfile()).toBe(false);
    expect(identity.userId()).toBe(saved?.id);
    expect(identity.devUserId()).toBe(saved?.id);
  });

  it('keeps the chosen picture with the profile, and registers it with the backend', () => {
    const { identity, http } = setup();

    identity.saveProfile({
      name: 'Mona',
      nativeLanguage: 'ar',
      learning: 'en',
      avatar: 'avatar-05',
    });
    const register = http.expectOne({ method: 'POST', url: '/dev/users' });
    register.flush(null, NO_CONTENT);
    answerLoad(http, []);

    expect(identity.profile()?.avatar).toBe('avatar-05');
    expect((register.request.body as { avatar: string }).avatar).toBe('avatar-05');
    expect(JSON.parse(localStorage.getItem('jtalk:profile') ?? '{}')).toMatchObject({
      avatar: 'avatar-05',
    });
  });

  it('reads a profile with no picture, such as an older one, as having an empty picture', () => {
    const { identity, http } = setup(true, {
      id: 'm-1',
      name: 'Mona',
      nativeLanguage: 'ar',
      learning: 'en',
    });

    identity.load().subscribe();
    http.expectOne({ method: 'POST', url: '/dev/users' }).flush(null, NO_CONTENT);
    answerLoad(http, [
      { id: 'b-2', name: 'Bob', nativeLanguage: 'en', learning: 'ar', avatar: 'avatar-02' },
      { id: 'c-3', name: 'Cy', nativeLanguage: 'en', learning: 'ar' },
    ]);

    expect(identity.profile()?.avatar).toBe('');
    expect(identity.directory().get('b-2')?.avatar).toBe('avatar-02');
    expect(identity.directory().get('c-3')?.avatar).toBe('');
  });

  it('keeps the same id when the profile is edited', () => {
    const { identity, http } = setup(true, MONA);

    identity.saveProfile({
      name: 'Mona K',
      nativeLanguage: 'fr',
      learning: 'de',
      avatar: 'avatar-02',
    });
    http.expectOne({ method: 'POST', url: '/dev/users' }).flush(null, NO_CONTENT);
    answerLoad(http, []);

    expect(identity.profile()).toEqual({
      id: 'm-1',
      name: 'Mona K',
      nativeLanguage: 'fr',
      learning: 'de',
      avatar: 'avatar-02',
    });
  });

  it('remembers the profile, and registers it again when it loads, then reads everyone', () => {
    const { identity, http } = setup(true, MONA);
    expect(identity.needsProfile()).toBe(false);

    identity.load().subscribe();
    http.expectOne({ method: 'POST', url: '/dev/users' }).flush(null, NO_CONTENT);
    answerLoad(http, [MONA, BOB, { id: 'broken' }]);

    expect([...identity.directory().keys()].sort()).toEqual(['b-2', 'm-1']);
    expect(identity.directory().get('b-2')?.name).toBe('Bob');
  });

  it('shows this profile as it is, whatever the backend says about the same id', () => {
    const { identity, http } = setup(true, MONA);

    identity.load().subscribe();
    http.expectOne({ method: 'POST', url: '/dev/users' }).flush(null, NO_CONTENT);
    answerLoad(http, [{ ...MONA, name: 'Old name' }]);

    expect(identity.directory().get('m-1')?.name).toBe('Mona');
  });

  it.each(['not json', '{"id":1}', 'null'])(
    'ignores a stored profile that is not valid: %s',
    (stored) => {
      const { identity } = setup(true, stored);

      expect(identity.profile()).toBeNull();
      expect(identity.needsProfile()).toBe(true);
    },
  );

  it('carries on without names when the backend is not there', () => {
    const { identity, http } = setup(true, MONA);

    identity.load().subscribe();
    http
      .expectOne({ method: 'POST', url: '/dev/users' })
      .flush('no', { status: 404, statusText: 'Not Found' });
    answerLoad(http, null);

    expect(identity.directory().size).toBe(1);
    expect(identity.userId()).toBe('m-1');
  });

  it('is the subject of the token once there is one, and then needs no profile', () => {
    sessionStorage.setItem('jtalk:token', `x.${btoa(JSON.stringify({ sub: 'from-token' }))}.y`);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DEV_IDENTITY, useValue: true },
      ],
    });

    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(true);
    expect(TestBed.inject(IdentityService).userId()).toBe('from-token');
    expect(TestBed.inject(IdentityService).needsProfile()).toBe(false);
  });
});
