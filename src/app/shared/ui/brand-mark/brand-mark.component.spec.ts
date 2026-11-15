import { TestBed } from '@angular/core/testing';
import { BrandMarkComponent } from './brand-mark.component';

describe('BrandMarkComponent', () => {
  it('draws the three bars and hides them from assistive technology', async () => {
    const fixture = TestBed.createComponent(BrandMarkComponent);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect([...host.querySelectorAll('span')].map((shape) => shape.className)).toEqual([
      'bar',
      'bar',
      'bar',
    ]);
    expect(host.getAttribute('aria-hidden')).toBe('true');
  });

  it('pulses only when asked to', async () => {
    const fixture = TestBed.createComponent(BrandMarkComponent);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList.contains('animated')).toBe(false);

    fixture.componentRef.setInput('animated', true);
    await fixture.whenStable();
    expect(host.classList.contains('animated')).toBe(true);
  });
});
