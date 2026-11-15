import { TestBed } from '@angular/core/testing';
import { BauhausBlocksComponent } from './bauhaus-blocks.component';

describe('BauhausBlocksComponent', () => {
  it('draws four decorative blocks, hidden from assistive technology', async () => {
    const fixture = TestBed.createComponent(BauhausBlocksComponent);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelectorAll('.block')).toHaveLength(4);
  });
});
