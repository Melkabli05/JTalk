import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { ActiveRoomService } from '../rooms/active-room.service';
import type { Person, ProfileDraft } from './identity.models';
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
/** A full profile: the same fields, and the languages the person speaks and learns. */
const full = (learning: string[], extra: object = {}) =>
  profile({
    nativeLanguages: ['ar'],
    learningLanguages: learning.map((languageCode) => ({
      languageCode,
      proficiencyLevel: 'BEGINNER',
    })),
    ...extra,
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

  /** A signed-in person the user service knows: one request gives their profile and languages. */
  async function known(...learning: string[]) {
    setup();
    await settle();
    await answer('GET', ME, full(learning));
  }

  /** Starts a save and keeps what came of it, so a spec can answer the requests in between. */
  function save(draft: ProfileDraft) {
    const outcome: { saved?: Person; failure?: unknown } = {};
    identity.saveProfile(draft).subscribe({
      next: (saved) => (outcome.saved = saved),
      error: (failure: unknown) => (outcome.failure = failure),
    });
    return outcome;
  }

  afterEach(() => logout.mockClear());

  it('asks the user service for nothing until Auth0 has signed the person in', async () => {
    setup(false);
    await settle();

    http.expectNone(() => true);
    expect(identity.userId()).toBeNull();
    expect(identity.needsProfile()).toBe(false);
  });

  it('knows the person, and the languages they speak and learn, from one request', async () => {
    await known('en');

    expect(identity.profile()).toEqual({
      id: 'm-1',
      name: 'Mona',
      nativeLanguage: 'ar',
      learning: 'en',
      avatar: 'avatar-06',
      languages: { native: ['ar'], learning: [{ code: 'en', level: 'BEGINNER' }] },
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
    async function newcomer() {
      setup();
      await settle();
      await answer('GET', ME, { status: 404 }, 404);
    }

    it('creates it for a new person in one request: a handle made from the name, the bundled picture as a path, the language to learn', async () => {
      await newcomer();

      const outcome = save(DRAFT);
      const created = await answer('POST', ME, full(['fr'], { displayName: 'Mona B' }));

      expect(created).toEqual({
        username: expect.stringMatching(/^mona_b_[0-9a-f]{6}$/) as unknown,
        displayName: 'Mona B',
        avatarUrl: '/avatars/avatar-03.svg',
        nativeLanguage: 'ar',
        learningLanguages: [{ languageCode: 'fr' }],
      });
      expect(outcome.saved?.name).toBe('Mona B');
      expect(identity.needsProfile()).toBe(false);
      expect(identity.profile()?.learning).toBe('fr');
      http.expectNone(() => true); // the answer is the profile: nothing is read back
    });

    it('sends the bio and country of a new person only when they wrote or chose them', async () => {
      await newcomer();

      save({ ...DRAFT, bio: '  Tea and Spanish  ', countryCode: 'MA' });
      const created = await answer('POST', ME, full(['fr']));

      expect(created).toMatchObject({ bio: 'Tea and Spanish', countryCode: 'MA' });
    });

    it('leaves an empty bio and no country out of a new profile', async () => {
      await newcomer();

      save({ ...DRAFT, bio: '', countryCode: '' });
      const created = (await answer('POST', ME, full(['fr']))) as Record<string, unknown>;

      expect('bio' in created).toBe(false);
      expect('countryCode' in created).toBe(false);
    });

    it('makes a handle even from a name with no Latin letters', async () => {
      await newcomer();

      save({ ...DRAFT, name: 'منى' });
      const created = (await answer('POST', ME, full(['fr']))) as { username: string };

      expect(created.username).toMatch(/^user_[0-9a-f]{6}$/);
    });

    it('tries once more with another handle when the first one was taken', async () => {
      await newcomer();

      const outcome = save(DRAFT);
      const first = (await answer('POST', ME, { status: 409 }, 409)) as { username: string };
      const second = (await answer('POST', ME, full(['fr']))) as { username: string };

      expect(second.username).not.toBe(first.username);
      expect(outcome.saved).toBeDefined();
    });

    it('does not hide a failure that is not a taken handle', async () => {
      await newcomer();

      const outcome = save(DRAFT);
      await answer('POST', ME, { status: 400 }, 400);

      expect(outcome.failure).toMatchObject({ status: 400 });
      expect(identity.needsProfile()).toBe(true);
    });

    it('changes an existing profile in one request, the new language included', async () => {
      await known('en');

      const outcome = save(DRAFT);
      const changed = await answer('PATCH', ME, full(['fr'], { displayName: 'Mona B' }));

      expect(changed).toEqual({
        displayName: 'Mona B',
        avatarUrl: '/avatars/avatar-03.svg',
        nativeLanguage: 'ar',
        learningLanguages: [{ languageCode: 'fr' }],
      });
      expect(outcome.saved?.name).toBe('Mona B');
      expect(identity.profile()?.name).toBe('Mona B');
      expect(identity.profile()?.learning).toBe('fr');
      http.expectNone(() => true);
    });

    it('sends an emptied bio when changing a profile, so a bio can be cleared', async () => {
      await known('fr');

      save({ ...DRAFT, bio: '   ', countryCode: 'ES' });
      const changed = await answer('PATCH', ME, full(['fr']));

      expect(changed).toMatchObject({ bio: '', countryCode: 'ES' });
    });

    it('leaves the languages alone when the one being learned did not change, so their levels stay', async () => {
      await known('fr');

      save(DRAFT);
      const changed = (await answer('PATCH', ME, full(['fr']))) as Record<string, unknown>;

      expect('learningLanguages' in changed).toBe(false);
    });

    it('can swap the language spoken and the one learned in one save', async () => {
      await known('en');

      save({ ...DRAFT, nativeLanguage: 'en', learning: 'ar' });
      const changed = await answer('PATCH', ME, full(['ar']));

      expect(changed).toMatchObject({
        nativeLanguage: 'en',
        learningLanguages: [{ languageCode: 'ar' }],
      });
    });

    it('keeps the profile it had when the change failed', async () => {
      await known('en');

      const outcome = save(DRAFT);
      await answer('PATCH', ME, { status: 422 }, 422);

      expect(outcome.failure).toMatchObject({ status: 422 });
      expect(identity.profile()?.name).toBe('Mona');
      expect(identity.profile()?.learning).toBe('en');
    });
  });

  it('signs out through Auth0, which sends the person back to this app', async () => {
    setup();

    await identity.signOut();

    expect(logout).toHaveBeenCalledTimes(1);
  });

  describe('deleting the account', () => {
    it('deletes it on the user service, then signs out, and leaves the room first', async () => {
      await known();
      const leave = vi.fn();
      TestBed.inject(ActiveRoomService).onLeave(leave);
      logout.mockClear();

      const deleted = firstValueFrom(identity.deleteAccount());
      expect(leave, 'left before anything is deleted').toHaveBeenCalled();
      await answer('DELETE', ME, null, 204);
      await deleted;

      expect(logout).toHaveBeenCalledOnce();
    });

    it('sends the person to the start when the account is gone but Auth0 could not sign them out, instead of leaving them in the app', async () => {
      await known();
      const assign = vi.fn();
      vi.stubGlobal('location', { ...window.location, assign, origin: 'http://localhost' });
      logout.mockImplementationOnce(() => throwError(() => new Error('offline')));

      const deleted = firstValueFrom(identity.deleteAccount(), { defaultValue: 'done' });
      await answer('DELETE', ME, null, 204);

      expect(await deleted).toBe('done');
      expect(assign).toHaveBeenCalledExactlyOnceWith('/');
      vi.unstubAllGlobals();
    });

    it('does not sign out when the account could not be deleted, so the person can try again', async () => {
      await known();
      logout.mockClear();

      const failed = firstValueFrom(identity.deleteAccount()).catch(() => 'failed');
      await answer('DELETE', ME, {}, 500);

      expect(await failed).toBe('failed');
      expect(logout).not.toHaveBeenCalled();
    });
  });

  it('leaves the room it is in before signing out, so nobody is left on a stage with no one at the controls', async () => {
    setup();
    const leave = vi.fn();
    TestBed.inject(ActiveRoomService).onLeave(leave);

    await identity.signOut();

    expect(leave).toHaveBeenCalledOnce();
    expect(leave.mock.invocationCallOrder[0]).toBeLessThan(logout.mock.invocationCallOrder[0] ?? 0);
  });
});
