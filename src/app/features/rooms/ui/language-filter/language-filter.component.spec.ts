import { TestBed } from '@angular/core/testing';
import { LanguageFilterComponent } from './language-filter.component';

describe('LanguageFilterComponent (presentational)', () => {
  async function render(selected = '') {
    const fixture = TestBed.createComponent(LanguageFilterComponent);
    fixture.componentRef.setInput('languages', ['es', 'ar']);
    fixture.componentRef.setInput('selected', selected);
    await fixture.whenStable();
    const options = () => [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="button"]'),
    ];
    return { fixture, options };
  }

  it('offers all rooms first, then each language that has a room, with its flag', async () => {
    const { options } = await render();

    expect(options().map((o) => o.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'All',
      '🇪🇸 Spanish',
      '🇸🇦 Arabic',
    ]);
  });

  it('marks the chosen language', async () => {
    const { options } = await render('ar');

    expect(options().map((o) => o.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'true',
    ]);
  });

  it('reports the language that was picked', async () => {
    const { fixture, options } = await render();

    options()[1].click();
    await fixture.whenStable();

    expect(fixture.componentInstance.selected()).toBe('es');
  });
});
