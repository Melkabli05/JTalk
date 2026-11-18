import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { Person } from '@core/auth/identity.models';
import { ReactionStreamComponent } from './reaction-stream.component';

const MONA: Person = {
  id: 'm-1',
  name: 'Mona',
  nativeLanguage: 'ar',
  learning: 'es',
  avatar: '',
};

describe('ReactionStreamComponent (presentational)', () => {
  let fixture: ComponentFixture<ReactionStreamComponent>;
  const items = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll('li')];

  async function render(inputs: Record<string, unknown>) {
    fixture = TestBed.createComponent(ReactionStreamComponent);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  it('shows nothing while nobody reacts', async () => {
    await render({ reactions: [], members: new Map() });

    expect(items()).toEqual([]);
  });

  it('shows each reaction as an icon with who sent it, and "You" for the person themselves', async () => {
    await render({
      reactions: [
        { id: 1, userId: 'm-1', reaction: 'HEART' },
        { id: 2, userId: 'me-1', reaction: 'SPARKLES' },
      ],
      members: new Map([['m-1', MONA]]),
      meId: 'me-1',
    });

    expect(items().map((item) => item.textContent?.trim())).toEqual(['Mona', 'You']);
    expect(items()[0]?.querySelector('i')?.className).toContain('pi-heart-fill');
    expect(items()[1]?.querySelector('i')?.className).toContain('pi-sparkles');
  });

  it('is decoration: hidden from screen readers, and each person keeps to one lane', async () => {
    await render({
      reactions: [
        { id: 1, userId: 'm-1', reaction: 'HEART' },
        { id: 2, userId: 'm-1', reaction: 'SMILE' },
      ],
      members: new Map([['m-1', MONA]]),
    });

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('ul')?.getAttribute('aria-hidden'),
    ).toBe('true');
    const lanes = items().map((item) => item.style.getPropertyValue('--lane'));
    expect(lanes[0]).toBe(lanes[1]);
  });
});
