import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { MenuItem } from '@openng/optimus-ui/api';
import { ModerationMenuComponent } from './moderation-menu.component';

describe('ModerationMenuComponent (presentational)', () => {
  let fixture: ComponentFixture<ModerationMenuComponent>;
  const button = () => (fixture.nativeElement as HTMLElement).querySelector('button')!;

  async function render(items: readonly MenuItem[]) {
    fixture = TestBed.createComponent(ModerationMenuComponent);
    fixture.componentRef.setInput('name', 'Maya');
    fixture.componentRef.setInput('items', items);
    await fixture.whenStable();
  }

  it('is one compact icon button, named for the person it acts on', async () => {
    await render([{ label: 'Mute' }]);

    expect(button().getAttribute('aria-label')).toBe('Maya: moderation');
    expect(button().classList.contains('compact')).toBe(true);
    expect(button().textContent?.trim()).toBe('');
  });

  it('opens a menu of what the host can do, and runs the one that is chosen', async () => {
    const mute = vi.fn();
    const remove = vi.fn();
    await render([
      { label: 'Mute', command: mute },
      { label: 'Remove from the room', linkClass: 'danger-item', command: remove },
    ]);

    button().click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));

    const links = [...document.querySelectorAll<HTMLElement>('.p-menu-item-link')];
    expect(links.map((link) => link.textContent?.trim())).toEqual(['Mute', 'Remove from the room']);
    expect(links[1].classList.contains('danger-item')).toBe(true);

    links[0].click();
    expect(mute).toHaveBeenCalledOnce();
    expect(remove).not.toHaveBeenCalled();
  });
});
