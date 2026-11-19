import { TestBed } from '@angular/core/testing';
import { LiveWavesComponent } from './live-waves.component';

describe('LiveWavesComponent (presentational)', () => {
  async function render() {
    const fixture = TestBed.createComponent(LiveWavesComponent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('is decoration: hidden from assistive technology', async () => {
    const root = await render();

    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.textContent?.trim()).toBe('');
  });

  it('draws three waves and no icon', async () => {
    const root = await render();

    expect(root.querySelectorAll('.wave')).toHaveLength(3);
    expect(root.querySelector('i, .pi')).toBeNull();
  });
});
