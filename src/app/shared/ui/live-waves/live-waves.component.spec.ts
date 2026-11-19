import { TestBed } from '@angular/core/testing';
import { LiveWavesComponent } from './live-waves.component';

describe('LiveWavesComponent (presentational)', () => {
  async function render(live?: boolean) {
    const fixture = TestBed.createComponent(LiveWavesComponent);
    if (live !== undefined) {
      fixture.componentRef.setInput('live', live);
    }
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('is decoration: hidden from assistive technology', async () => {
    const root = await render();

    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.textContent?.trim()).toBe('');
  });

  it('draws a microphone with three waves', async () => {
    const root = await render();

    expect(root.querySelectorAll('.wave')).toHaveLength(3);
    expect(root.querySelector('.core .pi-microphone')).not.toBeNull();
  });

  it('is marked live only while something is live', async () => {
    expect((await render()).classList.contains('live')).toBe(false);
    expect((await render(true)).classList.contains('live')).toBe(true);
  });
});
