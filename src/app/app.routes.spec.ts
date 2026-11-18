import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MessageService } from '@openng/optimus-ui/api';
import { of } from 'rxjs';
import { fakeAuth0, fakeIdentity } from '@core/auth/auth-testing';
import { routes } from './app.routes';
import { openFeed } from './features/rooms/data-access/room-feed-testing';

const MONA = { id: 'm-1', name: 'Mona', nativeLanguage: 'ar', learning: 'en', avatar: '' };

describe('routes', () => {
  function setup(auth: Parameters<typeof fakeAuth0>[0] = {}) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
        fakeAuth0(auth),
        fakeIdentity(MONA).provider,
        MessageService,
      ],
    });
  }

  const text = (harness: RouterTestingHarness) =>
    (harness.fixture.nativeElement as HTMLElement).textContent;
  const navigation = (harness: RouterTestingHarness) =>
    (harness.fixture.nativeElement as HTMLElement).querySelector('nav[aria-label="Primary"]');

  const answerRoomList = () =>
    openFeed(TestBed.inject(HttpTestingController)).say({ type: 'SNAPSHOT', rooms: [] });

  it('starts on the hallway of rooms, inside the shell', async () => {
    setup();
    const harness = await RouterTestingHarness.create('/');
    answerRoomList();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/');
    expect(text(harness)).toContain('Start a room');
    expect(navigation(harness)).not.toBeNull();
  });

  it('sends someone who is not signed in to Auth0 to sign in, and shows them nothing meanwhile', async () => {
    const loginWithRedirect = vi.fn(() => of(undefined));
    setup({ signedIn: false, loginWithRedirect });

    const harness = await RouterTestingHarness.create('/');
    await harness.fixture.whenStable();

    expect(loginWithRedirect).toHaveBeenCalledTimes(1);
    expect(navigation(harness)).toBeNull();
  });

  it('has no account pages of its own: Auth0 signs people in', async () => {
    setup();
    const harness = await RouterTestingHarness.create('/login');
    await harness.fixture.whenStable();

    expect(text(harness)).toContain('Page not found');
  });

  it('shows the shell and the not-found page for any unknown URL', async () => {
    setup();
    const harness = await RouterTestingHarness.create('/does-not-exist');
    await harness.fixture.whenStable();

    expect(text(harness)).toContain('Page not found');
    expect(navigation(harness)).not.toBeNull();
  });
});
