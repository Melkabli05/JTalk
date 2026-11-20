import { TestBed } from '@angular/core/testing';
import type { Reaction } from '../../models/reaction.model';
import { ReactionPickerComponent } from './reaction-picker.component';

describe('ReactionPickerComponent', () => {
  async function render() {
    const fixture = TestBed.createComponent(ReactionPickerComponent);
    const chosen: Reaction[] = [];
    fixture.componentInstance.chosen.subscribe((reaction) => chosen.push(reaction));
    document.body.append(fixture.nativeElement as HTMLElement);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const options = () => [...root.querySelectorAll<HTMLElement>('[role="option"]')];
    return { fixture, root, options, chosen };
  }

  afterEach(() => (document.body.innerHTML = ''));

  it('is a labelled listbox of the ten reactions, each named for a screen reader', async () => {
    const { root, options } = await render();

    const listbox = root.querySelector('[role="listbox"]');
    expect(listbox?.getAttribute('aria-label')).toBe('Reactions');
    expect(options().map((option) => option.getAttribute('aria-label'))).toEqual([
      'Heart',
      'Clap',
      'Thumbs up',
      'Smile',
      'Sparkles',
      'Fire',
      'Party',
      'Laugh',
      'Wow',
      'Thanks',
    ]);
  });

  it('hands over the reaction that was pressed, and can be pressed for the same one again', async () => {
    const { fixture, options, chosen } = await render();

    options()[1].click();
    await fixture.whenStable();
    options()[1].click();
    await fixture.whenStable();
    options()[5].click();
    await fixture.whenStable();

    expect(chosen).toEqual(['CLAP', 'CLAP', 'FIRE']);
  });

  it('is one stop for Tab, laid out across, so the left and right arrows move between the reactions', async () => {
    const { root } = await render();
    const listbox = root.querySelector('[role="listbox"]');

    expect(listbox?.getAttribute('aria-orientation')).toBe('horizontal');
    expect(listbox?.hasAttribute('tabindex')).toBe(true);
  });
});
