import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { AudienceSectionComponent } from './audience-section.component';
import type { Person } from '@core/auth/identity.models';

const MEMBERS: ReadonlyMap<string, Person> = new Map(
  ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => [
    id,
    { id, name: `Person ${id}`, nativeLanguage: 'es', learning: 'en', avatar: '' },
  ]),
);

describe('AudienceSectionComponent (presentational)', () => {
  let fixture: ComponentFixture<AudienceSectionComponent>;
  const root = () => fixture.nativeElement as HTMLElement;

  async function render(ids: string[], inputs: Record<string, unknown> = {}) {
    fixture = TestBed.createComponent(AudienceSectionComponent);
    fixture.componentRef.setInput('ids', ids);
    fixture.componentRef.setInput('members', MEMBERS);
    fixture.componentRef.setInput('meId', 'a');
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  it('is a labelled section: Listeners, and how many, over everyone at once', async () => {
    await render(['a', 'b', 'c']);
    const section = root().querySelector('section')!;

    expect(root().querySelector('h2')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Listeners 3',
    );
    expect(section.getAttribute('aria-labelledby')).toBe(root().querySelector('h2')?.id);
    expect(root().querySelectorAll('app-audience-grid .person')).toHaveLength(3);
  });

  it('shows faces in a grid where there is room, with no hint to swipe', async () => {
    await render(['a', 'b']);

    expect(root().querySelector('.audience.row')).toBeNull();
    expect(root().querySelector('.hint')).toBeNull();
    expect(root().querySelector('.name')).toBeNull();
  });

  it('is a row to swipe through, with the names under the faces, on a phone', async () => {
    await render(['a', 'b'], { swipeable: true });

    expect(root().querySelector('.audience.row')).not.toBeNull();
    expect(root().querySelector('.hint')?.textContent).toContain('Swipe');
    expect(root().querySelector('.hint')?.getAttribute('aria-hidden')).toBe('true');
    expect([...root().querySelectorAll('.person .name')].map((n) => n.textContent)).toEqual([
      'Person a',
      'Person b',
    ]);
  });

  it('says which of them is you in the row', async () => {
    await render(['a', 'b'], { swipeable: true });

    expect(root().querySelectorAll('.person p-tag')).toHaveLength(1);
    expect(root().querySelector('.person p-tag')?.textContent).toContain('You');
  });

  it('says nobody is listening when the room has no audience', async () => {
    await render([]);

    expect(root().querySelector('h2')?.textContent).toContain('0');
    expect(root().querySelector('.empty')?.textContent).toContain('Nobody is listening yet.');
  });

  it('reports who was picked', async () => {
    await render(['a', 'b']);
    const picked: string[] = [];
    fixture.componentInstance.memberSelected.subscribe((id) => picked.push(id));

    root().querySelectorAll<HTMLButtonElement>('app-audience-grid .person')[1]?.click();

    expect(picked).toEqual(['b']);
  });
});
