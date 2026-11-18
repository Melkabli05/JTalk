import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { type Observable, of } from 'rxjs';
import { fakeAuth0 } from '@core/auth/auth-testing';
import HomePageComponent from './home-page.component';

describe('HomePageComponent (container)', () => {
  let fixture: ComponentFixture<HomePageComponent>;
  const loginWithRedirect = vi.fn<(options?: unknown) => Observable<void>>(() => of(undefined));
  const root = () => fixture.nativeElement as HTMLElement;
  const buttons = () => [...root().querySelectorAll<HTMLButtonElement>('button')];
  const button = (label: string) => buttons().filter((b) => b.textContent?.trim() === label);

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('jtalk:locale', 'en');
    loginWithRedirect.mockClear();
    TestBed.configureTestingModule({
      providers: [fakeAuth0({ signedIn: false, loginWithRedirect })],
    });
    fixture = TestBed.createComponent(HomePageComponent);
    await fixture.whenStable();
  });

  it('is one section: a heading that says what Jtalk is, a line under it, and the way in', () => {
    expect(root().querySelectorAll('main section')).toHaveLength(1);
    expect(root().querySelector('h1')?.textContent).toBe('Learn a language by talking.');
    expect(root().querySelector('.lead')?.textContent).toContain('Live audio rooms');
    expect(root().querySelector('main')?.getAttribute('id')).toBe('main-content');
    expect(root().querySelector('a.skip-link')?.getAttribute('href')).toBe('#main-content');
    expect(root().querySelector('section')?.getAttribute('aria-labelledby')).toBe('hero-title');
  });

  it('starts an account from Get started, and signs in from Sign in and from the line for people who have one', () => {
    button('Get started')[0].click();
    expect(loginWithRedirect).toHaveBeenLastCalledWith({
      authorizationParams: { screen_hint: 'signup' },
    });

    button('Sign in')[0].click();
    expect(loginWithRedirect).toHaveBeenLastCalledWith(undefined);

    button('I already have an account')[0].click();
    expect(loginWithRedirect).toHaveBeenLastCalledWith(undefined);
    expect(loginWithRedirect).toHaveBeenCalledTimes(3);
  });

  it('has the way in at the top and beside the pitch, and nothing else to press', () => {
    const pressable = buttons()
      .map((b) => b.textContent?.trim())
      .filter((label) => label !== 'English' && label !== 'العربية');

    expect(pressable).toEqual(['Sign in', 'Get started', 'I already have an account']);
  });

  it('says hello in the languages people practise, each in its own, and keeps the greetings from screen readers', () => {
    const greetings = root().querySelector('.greetings')!;

    expect(greetings.getAttribute('aria-hidden')).toBe('true');
    expect([...greetings.querySelectorAll('span')].map((s) => [s.textContent, s.lang])).toEqual([
      ['Hola', 'es'],
      ['Hello', 'en'],
      ['مرحبا', 'ar'],
      ['こんにちは', 'ja'],
      ['Bonjour', 'fr'],
      ['Ciao', 'it'],
    ]);
  });

  it('draws the three bars of the mark as decoration only', () => {
    const voice = root().querySelector('.voice')!;

    expect(voice.getAttribute('aria-hidden')).toBe('true');
    expect(voice.querySelectorAll('.bar')).toHaveLength(3);
    expect(voice.querySelector('button, a, input')).toBeNull();
  });

  it('switches language, and reads right to left in Arabic', async () => {
    const switcher = root().querySelector<HTMLElement>('app-locale-switch')!;
    const arabic = [...switcher.querySelectorAll<HTMLElement>('[role="button"]')].find(
      (option) => option.textContent?.trim() === 'العربية',
    )!;

    arabic.click();
    await vi.waitFor(() => expect(root().querySelector('h1')?.textContent).toContain('تعلّم'));

    expect(document.documentElement.dir).toBe('rtl');
    localStorage.setItem('jtalk:locale', 'en');
    document.documentElement.dir = 'ltr';
  });
});
