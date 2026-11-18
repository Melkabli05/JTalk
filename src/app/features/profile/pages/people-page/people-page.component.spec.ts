import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { fakeIdentity } from '@core/auth/auth-testing';
import PeoplePageComponent from './people-page.component';

const BASE = '/api/v1/users';
const ME = { id: 'me-1', name: 'Mona', nativeLanguage: 'ar', learning: 'es', avatar: '' };

const user = (id: string, name: string, extra: object = {}) => ({
  id,
  username: name.toLowerCase(),
  displayName: name,
  nativeLanguage: 'es',
  countryCode: 'ES',
  ...extra,
});

describe('PeoplePageComponent (container)', () => {
  let fixture: ComponentFixture<PeoplePageComponent>;
  let http: HttpTestingController;
  let sent: { method: string; url: string }[];
  let failing: Set<string>;
  let answers: Record<string, unknown>;
  const toast = { add: vi.fn() };
  const root = () => fixture.nativeElement as HTMLElement;
  // Only the rows of the tab being looked at: the panels of the others are kept, hidden.
  const names = () =>
    [...root().querySelectorAll('app-person-row')]
      .filter((row) => row.closest('[hidden]') === null)
      .map((row) => row.querySelector('.name')?.textContent);
  const buttons = () => [...root().querySelectorAll<HTMLButtonElement>('button')];
  const nameOf = (el: Element) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '';
  const press = (label: string) =>
    buttons()
      .find((b) => nameOf(b) === label)!
      .click();
  const urls = () => sent.map((r) => `${r.method} ${r.url}`);

  function answer(request: TestRequest): void {
    const { method, urlWithParams } = request.request;
    sent.push({ method, url: urlWithParams });
    const key = `${method} ${urlWithParams}`;
    if (failing.has(key)) {
      failing.delete(key);
      request.flush('error', { status: 500, statusText: 'Error' });
      return;
    }
    const body = answers[key];
    request.flush(
      body ?? null,
      body === undefined
        ? { status: 204, statusText: 'No Content' }
        : { status: 200, statusText: 'OK' },
    );
  }

  async function settle(): Promise<void> {
    for (let quiet = 0; quiet < 3;) {
      TestBed.tick();
      fixture.detectChanges();
      const pending = http.match(() => true);
      quiet = pending.length === 0 ? quiet + 1 : 0;
      pending.forEach(answer);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    await fixture.whenStable();
  }

  async function open() {
    fixture = TestBed.createComponent(PeoplePageComponent);
    await settle();
  }

  async function goTo(label: string) {
    [...root().querySelectorAll<HTMLElement>('p-tab')]
      .find((tab) => tab.textContent?.includes(label))!
      .click();
    await settle();
  }

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('jtalk:locale', 'en');
    toast.add.mockClear();
    sent = [];
    failing = new Set();
    answers = {
      [`GET ${BASE}/matchmaking`]: {
        content: [user('u-1', 'Ana'), user('u-2', 'Ben')],
        hasNext: true,
        nextAfterCreatedAt: '2026-11-01T10:00:00Z',
        nextAfterId: 'u-2',
      },
      [`GET ${BASE}/matchmaking?afterCreatedAt=2026-11-01T10:00:00Z&afterId=u-2`]: {
        content: [user('u-3', 'Cy')],
        hasNext: false,
        nextAfterCreatedAt: null,
        nextAfterId: null,
      },
      [`GET ${BASE}/me-1/following?page=0`]: {
        content: [user('u-4', 'Dana')],
        page: 0,
        size: 20,
        total: 1,
      },
      [`GET ${BASE}/me-1/followers?page=0`]: {
        content: [user('u-5', 'Eli'), user('u-6', 'Fay')],
        page: 0,
        size: 20,
        total: 2,
      },
      [`GET ${BASE}/me/blocks`]: [user('u-7', 'Gus')],
      [`GET ${BASE}/search?q=an`]: [user('u-1', 'Ana')],
      [`GET ${BASE}/search?q=zz`]: [],
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'people/:id', children: [] }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        fakeIdentity(ME).provider,
        { provide: MessageService, useValue: toast },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  it('opens on partners to practise with, and reads nothing else yet', async () => {
    await open();

    expect(root().querySelector('h1')?.textContent).toBe('People');
    expect(names()).toEqual(['Ana', 'Ben']);
    expect(urls()).toEqual([`GET ${BASE}/matchmaking`]);
    expect(root().textContent).toContain('@ana');
  });

  it('asks for the next partners from where the last ones ended', async () => {
    await open();

    press('Show more');
    await settle();

    expect(names()).toEqual(['Ana', 'Ben', 'Cy']);
    expect(urls()).toContain(
      `GET ${BASE}/matchmaking?afterCreatedAt=2026-11-01T10:00:00Z&afterId=u-2`,
    );
    expect(buttons().map(nameOf)).not.toContain('Show more');
  });

  it('follows a partner with one press, and unfollows with another', async () => {
    await open();
    const ana = () => root().querySelector('app-person-row')!;

    ana().querySelector<HTMLButtonElement>('.action button')!.click();
    await settle();
    expect(urls()).toContain(`POST ${BASE}/u-1/follow`);
    expect(ana().querySelector('.action')?.textContent).toContain('Following');

    ana().querySelector<HTMLButtonElement>('.action button')!.click();
    await settle();
    expect(urls()).toContain(`DELETE ${BASE}/u-1/follow`);
    expect(ana().querySelector('.action')?.textContent).toContain('Follow');
    expect(ana().querySelector('.action')?.textContent).not.toContain('Following');
  });

  it('says so, and offers to try again, when the partners cannot be read', async () => {
    failing.add(`GET ${BASE}/matchmaking`);
    await open();

    expect(root().textContent).toContain('Could not load people.');
    press('Try again');
    await settle();

    expect(names()).toEqual(['Ana', 'Ben']);
  });

  it('opens a person when they are pressed', async () => {
    await open();
    const router = TestBed.inject(Router);

    root().querySelector<HTMLButtonElement>('app-person-row .open')!.click();
    await settle();

    expect(router.url).toBe('/people/u-1');
  });

  it('lists who you follow, as followed, and lets you unfollow without losing the row', async () => {
    await open();
    await goTo('Following');

    expect(urls()).toContain(`GET ${BASE}/me-1/following?page=0`);
    const dana = () =>
      [...root().querySelectorAll('app-person-row')].find((r) => r.textContent?.includes('Dana'))!;
    expect(dana().querySelector('.action')?.textContent).toContain('Following');

    dana().querySelector<HTMLButtonElement>('.action button')!.click();
    await settle();

    expect(urls()).toContain(`DELETE ${BASE}/u-4/follow`);
    expect(dana().querySelector('.action')?.textContent).not.toContain('Following');
  });

  it('lists who follows you, with nothing to press but their profile', async () => {
    await open();
    await goTo('Followers');

    expect(urls()).toContain(`GET ${BASE}/me-1/followers?page=0`);
    const rows = [...root().querySelectorAll('app-person-row')].filter(
      (r) => r.textContent?.includes('Eli') || r.textContent?.includes('Fay'),
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.querySelector('.action button') === null)).toBe(true);
  });

  it('reads each list only the first time it is looked at', async () => {
    await open();
    await goTo('Followers');
    await goTo('Discover');
    await goTo('Followers');

    expect(urls().filter((u) => u.includes('/followers'))).toHaveLength(1);
    expect(urls().filter((u) => u.includes('/matchmaking'))).toHaveLength(1);
  });

  it('lists who you blocked, and unblocks them with one press', async () => {
    await open();
    await goTo('Blocked');
    expect(root().textContent).toContain('Gus');

    press('Unblock');
    await settle();

    expect(urls()).toContain(`DELETE ${BASE}/u-7/block`);
    expect(root().textContent).not.toContain('Gus');
    expect(root().textContent).toContain('You have not blocked anyone');
    expect(toast.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Gus is unblocked.' }),
    );
  });

  describe('searching', () => {
    const type = async (text: string) => {
      const input = root().querySelector<HTMLInputElement>('input[type="search"]')!;
      input.value = text;
      input.dispatchEvent(new Event('input'));
      await new Promise((resolve) => setTimeout(resolve, 350));
      await settle();
    };

    it('asks nothing until there is enough to search for', async () => {
      await open();
      await goTo('Search');

      await type('a');

      expect(urls().some((u) => u.includes('/search'))).toBe(false);
      expect(root().textContent).toContain('Type at least two letters of a name or a handle.');
    });

    it('shows who matches, after a pause in typing', async () => {
      await open();
      await goTo('Search');

      await type('an');

      expect(urls()).toContain(`GET ${BASE}/search?q=an`);
      expect(names()).toEqual(['Ana']);
      expect(root().querySelector('[role="status"]')?.textContent).toContain('People found: 1');
    });

    it('says when no one matches', async () => {
      await open();
      await goTo('Search');

      await type('zz');

      expect(root().textContent).toContain('No one found');
    });
  });
});
