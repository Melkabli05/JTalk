import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { fakeAuth0 } from './auth-testing';
import { IdentityService } from './identity.service';

const ME = '/api/v1/users/me';
const BATCH = '/api/v1/users/batch';
const profile = (extra: object = {}) => ({
  id: 'm-1',
  username: 'mona_1a2b3c',
  displayName: 'Mona',
  avatarUrl: '/avatars/avatar-06.svg',
  nativeLanguage: 'ar',
  createdAt: '2026-11-18T10:00:00Z',
  ...extra,
});
const matrix = (...learning: string[]) => ({
  userId: 'm-1',
  nativeLanguages: ['ar'],
  learningLanguages: learning.map((languageCode) => ({
    languageCode,
    proficiencyLevel: 'BEGINNER',
  })),
});
const DRAFT = { name: '  Mona B  ', nativeLanguage: 'ar', learning: 'fr', avatar: 'avatar-03' };

describe('IdentityService', () => {
  let http: HttpTestingController;
  let identity: IdentityService;
  const logout = vi.fn(() => of(undefined));

  function setup(signedIn = true) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), fakeAuth0({ signedIn, logout })],
    });
    http = TestBed.inject(HttpTestingController);
    identity = TestBed.inject(IdentityService);
  }

  const settle = async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    TestBed.tick();
  };

  /** Answers the next request with this method and URL, waiting for it to be sent; returns what was sent. */
  async function answer(method: string, url: string, body: object | null = null, status = 200) {
    let sent: unknown;
    await vi.waitFor(() => {
      const [request] = http.match((r) => r.method === method && r.url === url);
      expect(request, `${method} ${url}`).toBeDefined();
      sent = request?.request.body;
      request?.flush(body, { status, statusText: status < 400 ? 'OK' : 'Error' });
    });
    await settle();
    return sent;
  }

  /** A signed-in person the user service knows, with their profile and languages loaded. */
  async function known(...learning: string[]) {
    setup();
    await settle();
    await answer('GET', ME, profile());
    await answer('GET', `${ME}/languages`, matrix(...learning));
  }

  afterEach(() => logout.mockClear());

  it('asks the user service for nothing until Auth0 has signed the person in', async () => {
    setup(false);
    await settle();

    http.expectNone(() => true);
    expect(identity.userId()).toBeNull();
    expect(identity.needsProfile()).toBe(false);
  });

  it('knows the person from their profile and the language they are learning', async () => {
    await known('en');

    expect(identity.profile()).toEqual({
      id: 'm-1',
      name: 'Mona',
      nativeLanguage: 'ar',
      learning: 'en',
      avatar: 'avatar-06',
    });
    expect(identity.userId()).toBe('m-1');
    expect(identity.needsProfile()).toBe(false);
    expect(identity.directory().get('m-1')?.name).toBe('Mona');
  });

  it('needs a profile when the user service does not know the person yet', async () => {
    setup();
    await settle();
    await answer('GET', ME, { status: 404 }, 404);

    expect(identity.needsProfile()).toBe(true);
    expect(identity.userId()).toBeNull();
  });

  describe('looking people up', () => {
    const summary = (id: string, name: string) => ({
      id,
      username: id,
      displayName: name,
      avatarUrl: null,
      nativeLanguage: 'en',
    });

    it('asks for everyone not known yet in one call, and never twice for the same person', async () => {
      await known('en');

      identity.resolve(['a', 'b', 'a', 'm-1', '']);
      expect(await answer('POST', BATCH, [summary('a', 'Ana'), summary('b', 'Ben')])).toEqual({
        ids: ['a', 'b'],
      });
      identity.resolve(['a', 'c']);

      expect(await answer('POST', BATCH, [summary('c', 'Cy')])).toEqual({
        ids: ['c'],
      });
      expect([...identity.directory().values()].map((p) => p.name).sort()).toEqual([
        'Ana',
        'Ben',
        'Cy',
        'Mona',
      ]);
    });

    it('asks again later when a lookup failed', async () => {
      await known('en');

      identity.resolve(['a']);
      await answer('POST', BATCH, null, 500);
      expect(identity.directory().has('a')).toBe(false);

      identity.resolve(['a']);
      await answer('POST', BATCH, [summary('a', 'Ana')]);
      expect(identity.directory().get('a')?.name).toBe('Ana');
    });

    it('splits a very large room into lookups the service accepts', async () => {
      await known('en');
      const everyone = Array.from({ length: 1200 }, (_, i) => `u-${i}`);

      identity.resolve(everyone);

      const sizes = http.match(BATCH).map((r) => (r.request.body as { ids: string[] }).ids.length);
      expect(sizes).toEqual([500, 500, 200]);
    });
  });

  describe('saving the profile', () => {
    it('creates it for a new person: a handle made from the name, the bundled picture as a path, then the language to learn', async () => {
      setup();
      await settle();
      await answer('GET', ME, { status: 404 }, 404);

      const saving = identity.saveProfile(DRAFT);
      const created = await answer('POST', ME, profile({ displayName: 'Mona B' }));
      const learning = await answer('POST', `${ME}/languages`);
      await answer('GET', ME, profile({ displayName: 'Mona B' }));
      await answer('GET', `${ME}/languages`, matrix('fr'));
      await saving;

      expect(created).toEqual({
        username: expect.stringMatching(/^mona_b_[0-9a-f]{6}$/) as unknown,
        displayName: 'Mona B',
        avatarUrl: '/avatars/avatar-03.svg',
        nativeLanguage: 'ar',
      });
      expect(learning).toEqual({ languageCode: 'fr', languageType: 'LEARNING' });
      expect(identity.needsProfile()).toBe(false);
      expect(identity.profile()?.learning).toBe('fr');
    });

    it('sends the bio and country of a new person only when they wrote or chose them', async () => {
      setup();
      await settle();
      await answer('GET', ME, { status: 404 }, 404);

      const saving = identity.saveProfile({
        ...DRAFT,
        bio: '  Tea and Spanish  ',
        countryCode: 'MA',
      });
      const created = await answer('POST', ME, profile());
      await answer('POST', `${ME}/languages`);
      await answer('GET', ME, profile());
      await answer('GET', `${ME}/languages`, matrix('fr'));
      await saving;

      expect(created).toMatchObject({ bio: 'Tea and Spanish', countryCode: 'MA' });
    });

    it('leaves an empty bio and no country out of a new profile', async () => {
      setup();
      await settle();
      await answer('GET', ME, { status: 404 }, 404);

      const saving = identity.saveProfile({ ...DRAFT, bio: '', countryCode: '' });
      const created = (await answer('POST', ME, profile())) as Record<string, unknown>;
      await answer('POST', `${ME}/languages`);
      await answer('GET', ME, profile());
      await answer('GET', `${ME}/languages`, matrix('fr'));
      await saving;

      expect('bio' in created).toBe(false);
      expect('countryCode' in created).toBe(false);
    });

    it('makes a handle even from a name with no Latin letters', async () => {
      setup();
      await settle();
      await answer('GET', ME, { status: 404 }, 404);

      const saving = identity.saveProfile({ ...DRAFT, name: 'منى' });
      const created = (await answer('POST', ME, profile())) as { username: string };
      await answer('POST', `${ME}/languages`);
      await answer('GET', ME, profile());
      await answer('GET', `${ME}/languages`, matrix('fr'));
      await saving;

      expect(created.username).toMatch(/^user_[0-9a-f]{6}$/);
    });

    it('tries once more with another handle when the first one was taken', async () => {
      setup();
      await settle();
      await answer('GET', ME, { status: 404 }, 404);

      const saving = identity.saveProfile(DRAFT);
      const first = (await answer('POST', ME, { status: 409 }, 409)) as { username: string };
      const second = (await answer('POST', ME, profile())) as { username: string };
      await answer('POST', `${ME}/languages`);
      await answer('GET', ME, profile());
      await answer('GET', `${ME}/languages`, matrix('fr'));
      await saving;

      expect(second.username).not.toBe(first.username);
    });

    it('does not hide a failure that is not a taken handle', async () => {
      setup();
      await settle();
      await answer('GET', ME, { status: 404 }, 404);

      const saving = identity.saveProfile(DRAFT);
      const failed = saving.catch((error: unknown) => error);
      await answer('POST', ME, { status: 400 }, 400);

      expect(await failed).toMatchObject({ status: 400 });
    });

    it('changes an existing profile: drops the old language, adds the new one, then updates the profile', async () => {
      await known('en');

      const saving = identity.saveProfile(DRAFT);
      await answer('DELETE', `${ME}/languages/en`);
      const learning = await answer('POST', `${ME}/languages`);
      const changed = await answer('PATCH', ME, profile({ displayName: 'Mona B' }));
      await answer('GET', ME, profile({ displayName: 'Mona B' }));
      await answer('GET', `${ME}/languages`, matrix('fr'));
      await saving;

      expect(learning).toEqual({ languageCode: 'fr', languageType: 'LEARNING' });
      expect(changed).toEqual({
        displayName: 'Mona B',
        avatarUrl: '/avatars/avatar-03.svg',
        nativeLanguage: 'ar',
      });
      expect(identity.profile()?.name).toBe('Mona B');
    });

    it('sends an emptied bio when changing a profile, so a bio can be cleared', async () => {
      await known('fr');

      const saving = identity.saveProfile({ ...DRAFT, bio: '   ', countryCode: 'ES' });
      const changed = await answer('PATCH', ME, profile());
      await answer('GET', ME, profile());
      await answer('GET', `${ME}/languages`, matrix('fr'));
      await saving;

      expect(changed).toMatchObject({ bio: '', countryCode: 'ES' });
    });

    it('leaves the languages alone when the one being learned did not change', async () => {
      await known('fr');

      const saving = identity.saveProfile(DRAFT);
      await answer('PATCH', ME, profile());
      await answer('GET', ME, profile());
      await answer('GET', `${ME}/languages`, matrix('fr'));
      await saving;

      http.expectNone((r) => r.url.includes('/languages') && r.method !== 'GET');
    });
  });

  it('signs out through Auth0, which sends the person back to this app', async () => {
    setup();

    await identity.signOut();

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
