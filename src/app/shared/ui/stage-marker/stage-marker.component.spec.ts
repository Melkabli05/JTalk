import { TestBed } from '@angular/core/testing';
import { StageMarkerComponent } from './stage-marker.component';

describe('StageMarkerComponent', () => {
  it('shows the icon, hidden from assistive tech, and exposes the state to the theme', async () => {
    const fixture = TestBed.createComponent(StageMarkerComponent);
    fixture.componentRef.setInput('icon', 'pi pi-lock');
    fixture.componentRef.setInput('state', 'current');
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('data-state')).toBe('current');
    const icon = host.querySelector('i');
    expect(icon?.className).toBe('pi pi-lock');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });
});
