import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageLevelsComponent } from './language-levels.component';

describe('LanguageLevelsComponent (presentational)', () => {
  let fixture: ComponentFixture<LanguageLevelsComponent>;
  const root = () => fixture.nativeElement as HTMLElement;

  async function render(inputs: Record<string, unknown>) {
    fixture = TestBed.createComponent(LanguageLevelsComponent);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  it('lists what they speak, and what they learn with the level in words and a meter', async () => {
    await render({
      native: ['ar', 'fr'],
      learning: [
        { code: 'es', level: 'INTERMEDIATE' },
        { code: 'de', level: null },
      ],
    });

    const speaks = [...root().querySelectorAll('.chips li')].map((li) =>
      li.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(speaks).toEqual(['🇸🇦 Arabic', '🇫🇷 French']);
    const learned = [...root().querySelectorAll('.levels li')];
    expect(
      learned.map((li) => li.querySelector('.name')?.textContent?.replace(/\s+/g, ' ').trim()),
    ).toEqual(['🇪🇸 Spanish', '🇩🇪 German']);
    expect(learned[0]?.querySelector('.level')?.textContent).toBe('Intermediate');
    expect(learned[0]?.querySelector('p-progressbar')?.getAttribute('aria-hidden')).toBe('true');
    expect(learned[1]?.querySelector('.level')).toBeNull();
    expect(learned[1]?.querySelector('p-progressbar')).toBeNull();
  });

  it('leaves out a section that has nothing in it', async () => {
    await render({ native: ['en'] });

    expect(root().querySelector('.levels')).toBeNull();
    expect(root().querySelectorAll('h3')).toHaveLength(1);
  });
});
