import { TestBed } from '@angular/core/testing';
import { LocaleSwitchComponent } from './locale-switch.component';

describe('LocaleSwitchComponent', () => {
  async function render(locale: 'en' | 'ar') {
    const fixture = TestBed.createComponent(LocaleSwitchComponent);
    fixture.componentRef.setInput('locale', locale);
    await fixture.whenStable();
    const buttons = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="button"]'),
    ];
    return { fixture, buttons };
  }

  it('offers every language named in its own script, and marks which one it is', async () => {
    const { buttons } = await render('en');

    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['English', 'العربية']);
    expect(buttons.map((button) => button.querySelector('[lang]')?.getAttribute('lang'))).toEqual([
      'en',
      'ar',
    ]);
  });

  it('shows the current language as pressed', async () => {
    const { buttons } = await render('ar');

    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
  });

  it('changes the locale to the chosen language, and never clears it', async () => {
    const { fixture, buttons } = await render('en');

    buttons[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.locale()).toBe('ar');

    buttons[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.locale()).toBe('ar');
  });
});
