import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18n } from '../utils/i18n/i18n.service';
import { TranslatePipe } from './translate.pipe';

@Component({
  selector: 'app-host',
  imports: [TranslatePipe],
  template: `<p>{{ 'Sign out' | t }}</p>
    <p>{{ 'Open seats: {count}' | t: { count: 3 } }}</p>`,
})
class Host {}

describe('TranslatePipe', () => {
  it('shows the text in the current language, and follows a switch without a new render', async () => {
    const fixture = TestBed.createComponent(Host);
    const i18n = TestBed.inject(I18n);
    await fixture.whenStable();
    const paragraphs = () =>
      [...(fixture.nativeElement as HTMLElement).querySelectorAll('p')].map((p) => p.textContent);
    expect(paragraphs()).toEqual(['Sign out', 'Open seats: 3']);

    await i18n.use('ar');
    await fixture.whenStable();
    expect(paragraphs()).toEqual(['تسجيل الخروج', 'مقاعد شاغرة: 3']);

    await i18n.use('en');
    await fixture.whenStable();
    expect(paragraphs()).toEqual(['Sign out', 'Open seats: 3']);
  });
});
