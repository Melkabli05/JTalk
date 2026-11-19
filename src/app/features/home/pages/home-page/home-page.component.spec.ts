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
    loginWithRedirect.mockClear();
    TestBed.configureTestingModule({
      providers: [fakeAuth0({ signedIn: false, loginWithRedirect })],
    });
    fixture = TestBed.createComponent(HomePageComponent);
    await fixture.whenStable();
  });

  it('is one section: a heading that says what Jtalk is, a line under it, and the way in', () => {
    expect(root().querySelectorAll('main section')).toHaveLength(1);
    expect(root().querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Learn a language by talking.',
    );
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

  it('draws the glow, the grid, the two stepped blocks and their glass orbs as decoration only', () => {
    const backdrop = root().querySelector('app-poster-backdrop')!;

    expect(backdrop.getAttribute('aria-hidden')).toBe('true');
    for (const selector of [
      '.glow',
      '.grid',
      '.block.one',
      '.block.two',
      '.badge.mic',
      '.badge.hand',
    ]) {
      expect(backdrop.querySelector(selector), selector).not.toBeNull();
    }
    expect(backdrop.querySelectorAll('.glow .orb')).toHaveLength(3);
    expect(backdrop.querySelector('.badge.mic .pi-microphone')).not.toBeNull();
    expect(backdrop.querySelector('.badge.hand .pi-hand')).not.toBeNull();
    expect(backdrop.querySelector('button, a, input')).toBeNull();
  });

  it('sets each line of the heading on its own block, under a small label', () => {
    const lines = [...root().querySelectorAll('h1 .line')];

    expect(root().querySelector('.tag')?.textContent).toBe('#Live audio');
    expect(lines.map((line) => line.textContent)).toEqual(['Learn a language', 'by talking.']);
    expect(lines.map((line) => line.className)).toEqual(['line paper', 'line sand']);
  });

  it('has a main button that is a square arrow tile and a label, and starts an account', () => {
    const go = root().querySelector<HTMLButtonElement>('button.go')!;

    expect(go.querySelector('.arrow')?.getAttribute('aria-hidden')).toBe('true');
    expect(go.textContent?.trim()).toBe('Get started');
    go.click();
    expect(loginWithRedirect).toHaveBeenLastCalledWith({
      authorizationParams: { screen_hint: 'signup' },
    });
  });

  it('leans towards the pointer, from the left and top (-1) to the right and bottom (1)', async () => {
    const host = root();
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    host.dispatchEvent(new MouseEvent('pointermove', { clientX: 1000, clientY: 0, bubbles: true }));
    await fixture.whenStable();

    expect(host.style.getPropertyValue('--mx')).toBe('1');
    expect(host.style.getPropertyValue('--my')).toBe('-1');
  });

  it('lists three small facts along the bottom, the greetings in the middle', () => {
    const facts = [...root().querySelectorAll('.facts li')];

    expect(facts).toHaveLength(3);
    expect(facts[0]?.textContent).toBe('Audio only');
    expect(facts[1]?.classList).toContain('greetings');
    expect(facts[2]?.textContent).toBe('No camera, no pressure');
  });

  it('is always in the night theme, whatever the visitor chose', () => {
    expect(root().classList).toContain('app-dark');
  });
});
