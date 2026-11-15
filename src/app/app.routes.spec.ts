import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MessageService } from '@openng/optimus-ui/api';
import { routes } from './app.routes';

describe('routes', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.setItem(
      'jtalk:profile',
      JSON.stringify({ id: 'm-1', name: 'Mona', nativeLanguage: 'ar', learning: 'en' }),
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
      ],
    });
  });

  const text = (harness: RouterTestingHarness) =>
    (harness.fixture.nativeElement as HTMLElement).textContent;

  const answerRoomList = () =>
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/voice-rooms?size=100')
      .flush({ content: [] });

  it('starts on the hallway of rooms', async () => {
    const harness = await RouterTestingHarness.create('/');
    answerRoomList();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/');
    expect(text(harness)).toContain('Start a room');
  });

  it('serves the sign-in page without the shell', async () => {
    const harness = await RouterTestingHarness.create('/login');
    await harness.fixture.whenStable();

    const root = harness.fixture.nativeElement as HTMLElement;
    expect(text(harness)).toContain('Sign in');
    expect(root.querySelector('nav[aria-label="Primary"]')).toBeNull();
  });

  it.each(['/register', '/forgot-password', '/reset-password?token=abc'])(
    'serves %s without the shell',
    async (url) => {
      const harness = await RouterTestingHarness.create(url);
      await harness.fixture.whenStable();

      expect(
        (harness.fixture.nativeElement as HTMLElement).querySelector('nav[aria-label="Primary"]'),
      ).toBeNull();
      expect(TestBed.inject(Router).url).toBe(url);
    },
  );

  it('sends a signed-in user away from the sign-in page', async () => {
    sessionStorage.setItem('jtalk:token', 'jwt');
    const harness = await RouterTestingHarness.create('/login');
    answerRoomList();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('shows the shell and the not-found page for any unknown URL', async () => {
    const harness = await RouterTestingHarness.create('/does-not-exist');
    await harness.fixture.whenStable();

    expect(text(harness)).toContain('Page not found');
    expect(
      (harness.fixture.nativeElement as HTMLElement).querySelector('nav[aria-label="Primary"]'),
    ).not.toBeNull();
  });
});
