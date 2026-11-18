import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { fakeIdentity } from '../auth/auth-testing';
import { PersonCardService } from './person-card.service';

const BASE = '/api/v1/users';
const ME = {
  id: 'me-1',
  name: 'Mona',
  nativeLanguage: 'ar',
  learning: 'es',
  avatar: '',
  languages: { native: ['ar'], learning: [{ code: 'es', level: 'BEGINNER' as const }] },
};
const NOUR = {
  id: 'u-2',
  username: 'nour',
  displayName: 'Nour',
  bio: 'Hola',
  nativeLanguage: 'es',
  countryCode: 'ES',
  createdAt: '2026-10-01T10:00:00Z',
  nativeLanguages: ['es'],
  learningLanguages: [{ languageCode: 'ar', proficiencyLevel: 'INTERMEDIATE' }],
};

describe('PersonCardService', () => {
  let http: HttpTestingController;
  let sent: { method: string; url: string }[];
  let social: object;
  let failing: Record<string, number>;

  function answer(request: TestRequest): void {
    const { method, url } = request.request;
    sent.push({ method, url });
    const status = failing[`${method} ${url}`];
    if (status) {
      request.flush('error', { status, statusText: 'Error' });
      return;
    }
    const body = url === `${BASE}/u-2` ? NOUR : url === `${BASE}/u-2/social` ? social : null;
    request.flush(
      body,
      body === null ? { status: 204, statusText: 'No Content' } : { status: 200, statusText: 'OK' },
    );
  }

  async function settle(): Promise<void> {
    for (let quiet = 0; quiet < 3;) {
      TestBed.tick();
      const pending = http.match(() => true);
      quiet = pending.length === 0 ? quiet + 1 : 0;
      pending.forEach(answer);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  function setup(): PersonCardService {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), fakeIdentity(ME).provider],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(PersonCardService);
  }

  beforeEach(() => {
    sent = [];
    failing = {};
    social = { followerCount: 12, followingCount: 3, followedByMe: false, followsMe: true };
  });

  it('shows nothing until someone is chosen, and asks for no one', async () => {
    const cards = setup();
    await settle();

    expect(cards.card()).toBeUndefined();
    expect(sent.some((r) => r.url === `${BASE}/u-2`)).toBe(false);
  });

  it('puts a person together from their profile, their numbers and their languages, and judges the match against mine', async () => {
    const cards = setup();

    cards.show('u-2');
    await settle();

    const card = cards.card();
    expect(card?.details).toMatchObject({
      id: 'u-2',
      name: 'Nour',
      bio: 'Hola',
      countryCode: 'ES',
      learning: 'ar',
    });
    expect(card?.social).toEqual({
      followers: 12,
      following: 3,
      followedByMe: false,
      followsMe: true,
    });
    expect(card?.languages?.native).toEqual(['es']);
    expect(card?.match).toEqual({ kind: 'exchange', theySpeak: 'es', theyLearn: 'ar' });
    expect(card?.isMe).toBe(false);
  });

  it('gives no match for the person themselves', async () => {
    const cards = setup();

    cards.show('me-1');
    await settle();
    sent.length = 0;

    expect(cards.isMe()).toBe(true);
  });

  it('follows, then reads the numbers again instead of assuming it worked', async () => {
    const cards = setup();
    cards.show('u-2');
    await settle();
    sent.length = 0;
    social = { followerCount: 13, followingCount: 3, followedByMe: true, followsMe: true };

    cards.follow();
    await settle();

    expect(sent).toContainEqual({ method: 'POST', url: `${BASE}/u-2/follow` });
    expect(sent).toContainEqual({ method: 'GET', url: `${BASE}/u-2/social` });
    expect(cards.card()?.social?.followedByMe).toBe(true);
    expect(cards.card()?.social?.followers).toBe(13);
  });

  it('unfollows with DELETE', async () => {
    const cards = setup();
    cards.show('u-2');
    await settle();
    sent.length = 0;

    cards.unfollow();
    await settle();

    expect(sent).toContainEqual({ method: 'DELETE', url: `${BASE}/u-2/follow` });
  });

  it('blocks, then tells the caller it is done', async () => {
    const cards = setup();
    const done = vi.fn();
    cards.show('u-2');
    await settle();

    cards.block(done);
    await settle();

    expect(sent).toContainEqual({ method: 'POST', url: `${BASE}/u-2/block` });
    expect(done).toHaveBeenCalledOnce();
  });

  it('says what went wrong and does not call it done when a request fails', async () => {
    const cards = setup();
    const done = vi.fn();
    cards.show('u-2');
    await settle();
    failing[`POST ${BASE}/u-2/block`] = 500;

    cards.block(done);
    await settle();

    expect(cards.action.error()).toBe('Could not block them. Please try again.');
    expect(done).not.toHaveBeenCalled();
  });

  it('reports a profile that cannot be read', async () => {
    const cards = setup();
    failing[`GET ${BASE}/u-2`] = 404;

    cards.show('u-2');
    await settle();

    expect(cards.failed()).toBe(true);
    expect(cards.card()).toBeUndefined();
  });
});
