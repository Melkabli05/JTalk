import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { SocialStatsComponent } from './social-stats.component';

describe('SocialStatsComponent (presentational)', () => {
  let fixture: ComponentFixture<SocialStatsComponent>;
  const root = () => fixture.nativeElement as HTMLElement;

  async function render(inputs: Record<string, unknown>) {
    fixture = TestBed.createComponent(SocialStatsComponent);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  it('shows each count with its word, shortened when it is big', async () => {
    await render({ followers: 1250, following: 3 });

    const items = [...root().querySelectorAll('li')].map((li) => [
      li.querySelector('strong')?.textContent,
      li.querySelector('span')?.textContent,
    ]);
    expect(items).toEqual([
      ['1.3K', 'Followers'],
      ['3', 'Following'],
    ]);
  });

  it('says so, in words, when they follow you', async () => {
    await render({ followers: 1, following: 1 });
    expect(root().textContent).not.toContain('Follows you');

    fixture.componentRef.setInput('followsMe', true);
    await fixture.whenStable();
    expect(root().textContent).toContain('Follows you');
  });
});
