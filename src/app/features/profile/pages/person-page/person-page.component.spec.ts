import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { fakeIdentity } from '@core/auth/auth-testing';
import PersonPageComponent from './person-page.component';

const BASE = '/api/v1/users';
const ME = { id: 'me-1', name: 'Mona', nativeLanguage: 'ar', learning: 'es', avatar: '' };
const NOUR = {
  id: 'u-2',
  username: 'nour',
  displayName: 'Nour',
  bio: 'Hola! I love tea.',
  nativeLanguage: 'es',
  countryCode: 'ES',
  createdAt: '2026-10-01T10:00:00Z',
};

describe('PersonPageComponent (container)', () => {
  let fixture: ComponentFixture<PersonPageComponent>;
  let http: HttpTestingController;
  let sent: { method: string; url: string }[];
  let failing: Record<string, number>;
  let social: object;
  const toast = { add: vi.fn() };
  const root = () => fixture.nativeElement as HTMLElement;
  const page = () => document.body;
  const buttons = () => [...page().querySelectorAll('button, a[pbutton], a.p-button')];
  const nameOf = (el: Element) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '';
  const press = (label: string) =>
    buttons()
      .find((b) => nameOf(b) === label)!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

  function answer(request: TestRequest): void {
    const { method, url } = request.request;
    sent.push({ method, url });
    const status = failing[`${method} ${url}`];
    if (status) {
      request.flush('error', { status, statusText: 'Error' });
      return;
    }
    const body =
      url === `${BASE}/u-2` || url === `${BASE}/me-1`
        ? url.endsWith('me-1')
          ? { id: 'me-1', username: 'mona', displayName: 'Mona', nativeLanguage: 'ar', bio: '' }
          : NOUR
        : url === `${BASE}/u-2/social` || url === `${BASE}/me-1/social`
          ? social
          : url === `${BASE}/u-2/languages`
            ? {
                userId: 'u-2',
                nativeLanguages: ['es'],
                learningLanguages: [{ languageCode: 'ar', proficiencyLevel: 'INTERMEDIATE' }],
              }
            : url === `${BASE}/me-1/languages`
              ? {
                  userId: 'me-1',
                  nativeLanguages: ['ar'],
                  learningLanguages: [{ languageCode: 'es', proficiencyLevel: 'BEGINNER' }],
                }
              : null;
    request.flush(
      body,
      body === null ? { status: 204, statusText: 'No Content' } : { status: 200, statusText: 'OK' },
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

  async function open(id: string) {
    fixture = TestBed.createComponent(PersonPageComponent);
    fixture.componentRef.setInput('id', id);
    await settle();
  }

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('jtalk:locale', 'en');
    toast.add.mockClear();
    sent = [];
    failing = {};
    social = { followerCount: 1250, followingCount: 3, followedByMe: false, followsMe: true };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        fakeIdentity(ME).provider,
        { provide: MessageService, useValue: toast },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  it('shows who they are: name, handle, country, bio, how many follow them and how they could help you', async () => {
    await open('u-2');

    expect(root().querySelector('h1')?.textContent).toBe('Nour');
    expect(root().textContent).toContain('@nour');
    expect(root().textContent).toContain('Spain');
    expect(root().textContent).toContain('Hola! I love tea.');
    expect(root().textContent).toContain('1.3K');
    expect(root().textContent).toContain('Follows you');
    expect(root().textContent).toContain('Language exchange match');
    expect(root().textContent).toContain('Intermediate');
  });

  it('follows them with one press, and reads the numbers again', async () => {
    await open('u-2');
    sent.length = 0;
    social = { followerCount: 1251, followingCount: 3, followedByMe: true, followsMe: true };

    press('Follow back');
    await settle();

    expect(sent).toContainEqual({ method: 'POST', url: `${BASE}/u-2/follow` });
    expect(sent).toContainEqual({ method: 'GET', url: `${BASE}/u-2/social` });
    expect(page().textContent).toContain('Following');
  });

  it('blocks only after asking, and says so afterwards', async () => {
    await open('u-2');

    press('Block');
    await settle();
    expect(page().textContent).toContain('Blocking removes any follows');
    expect(sent.some((r) => r.url === `${BASE}/u-2/block`)).toBe(false);

    buttons()
      .filter((b) => b.textContent?.trim() === 'Block')
      .at(-1)!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();

    expect(sent).toContainEqual({ method: 'POST', url: `${BASE}/u-2/block` });
    expect(toast.add).toHaveBeenCalledWith(
      expect.objectContaining({ summary: 'Nour is blocked.' }),
    );
  });

  it('is a view of your own profile when it is you: no follow, no block', async () => {
    await open('me-1');

    expect(root().querySelector('h1')?.textContent).toBe('Mona');
    expect(buttons().map(nameOf)).not.toContain('Follow back');
    expect(buttons().map(nameOf)).not.toContain('Block');
  });

  it('says so, with a way back, when the profile cannot be found', async () => {
    failing[`GET ${BASE}/u-2`] = 404;

    await open('u-2');

    expect(root().textContent).toContain('This profile could not be found.');
    expect(root().querySelector('a')?.textContent).toContain('Back to the rooms');
  });

  it('shows a spinner while it looks', async () => {
    fixture = TestBed.createComponent(PersonPageComponent);
    fixture.componentRef.setInput('id', 'u-2');
    fixture.detectChanges();

    expect(root().querySelector('p-progress-spinner')).not.toBeNull();
    await settle();
  });
});
