import { TestBed } from '@angular/core/testing';
import { VoiceBubblesComponent } from './voice-bubbles.component';

describe('VoiceBubblesComponent', () => {
  it('draws four decorative bubbles, hidden from assistive technology', async () => {
    const fixture = TestBed.createComponent(VoiceBubblesComponent);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelectorAll('.bubble')).toHaveLength(4);
  });
});
