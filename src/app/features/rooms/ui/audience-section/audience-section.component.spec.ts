import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { Member } from '../../models/room.model';
import { AudienceSectionComponent } from './audience-section.component';

const MEMBERS: ReadonlyMap<string, Member> = new Map(
  ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => [
    id,
    { id, name: `Person ${id}`, nativeLanguage: 'es', learning: 'en', avatar: '' },
  ]),
);

describe('AudienceSectionComponent (presentational)', () => {
  let fixture: ComponentFixture<AudienceSectionComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  const toggle = () => root().querySelector<HTMLElement>('[aria-expanded]')!;

  async function render(ids: string[]) {
    fixture = TestBed.createComponent(AudienceSectionComponent);
    fixture.componentRef.setInput('ids', ids);
    fixture.componentRef.setInput('members', MEMBERS);
    fixture.componentRef.setInput('meId', 'a');
    await fixture.whenStable();
  }

  it('shows the count and a few faces, and keeps the full list closed by default', async () => {
    await render(['a', 'b', 'c', 'd', 'e', 'f', 'g']);

    expect(root().querySelector('h2')?.textContent).toContain('Listeners');
    expect(root().querySelector('.count')?.textContent).toBe('7');
    expect(root().querySelectorAll('app-person-avatar')).toHaveLength(5);
    expect(root().querySelector('.more')?.textContent).toContain('+2');
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(root().querySelector('app-audience-grid')).toBeNull();
  });

  it('opens the whole list, and closes it again', async () => {
    await render(['a', 'b']);

    toggle().click();
    await fixture.whenStable();
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(root().querySelectorAll('app-audience-grid .person')).toHaveLength(2);
    expect(root().querySelector('p-avatargroup')).toBeNull();

    toggle().click();
    await fixture.whenStable();
    expect(root().querySelector('app-audience-grid')).toBeNull();
  });

  it('says nobody is listening when the room has no audience', async () => {
    await render([]);
    toggle().click();
    await fixture.whenStable();

    expect(root().querySelector('.count')?.textContent).toBe('0');
    expect(root().querySelector('.empty')?.textContent).toContain('Nobody is listening yet.');
  });

  it('reports who was picked', async () => {
    await render(['a', 'b']);
    const picked: string[] = [];
    fixture.componentInstance.memberSelected.subscribe((id) => picked.push(id));

    toggle().click();
    await fixture.whenStable();
    root().querySelectorAll<HTMLButtonElement>('app-audience-grid .person')[1].click();

    expect(picked).toEqual(['b']);
  });
});
