import { TestBed } from '@angular/core/testing';
import HomePageComponent from './home-page.component';

describe('HomePageComponent', () => {
  it('shows the product name and what will be here', async () => {
    const fixture = TestBed.createComponent(HomePageComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h1')?.textContent).toBe('Live communication');
    expect(root.querySelector('p')?.textContent).toBe(
      'Voice rooms for language practice will live here.',
    );
  });
});
