import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { PersonSummary } from '@shared/utils/people';
import { PersonRowComponent } from './person-row.component';

const ANA: PersonSummary = {
  id: 'u-1',
  name: 'Ana López',
  username: 'ana',
  nativeLanguage: 'es',
  learning: '',
  avatar: '',
  countryCode: 'ES',
};

describe('PersonRowComponent (presentational)', () => {
  let fixture: ComponentFixture<PersonRowComponent>;
  const root = () => fixture.nativeElement as HTMLElement;

  async function render(person: PersonSummary) {
    fixture = TestBed.createComponent(PersonRowComponent);
    fixture.componentRef.setInput('person', person);
    await fixture.whenStable();
  }

  it('shows who they are in one quiet line: handle, country and the language they speak', async () => {
    await render(ANA);

    expect(root().querySelector('.name')?.textContent).toBe('Ana López');
    const meta = root().querySelector('.meta')?.textContent?.replace(/\s+/g, ' ').trim();
    expect(meta).toBe('@ana🇪🇸 Spain 🇪🇸 Speaks Spanish');
  });

  it('leaves out what is not known', async () => {
    await render({ ...ANA, username: '', countryCode: '' });

    expect(root().querySelector('.meta')?.textContent).not.toContain('@');
    expect(root().querySelector('.meta')?.textContent).not.toContain('Spain');
  });

  it('opens them when pressed', async () => {
    await render(ANA);
    const opened = vi.fn();
    fixture.componentInstance.opened.subscribe(opened);

    root().querySelector<HTMLButtonElement>('.open')!.click();

    expect(opened).toHaveBeenCalledExactlyOnceWith('u-1');
  });

  it('draws their initials when they have no picture', async () => {
    await render(ANA);

    expect(root().querySelector('p-avatar')?.textContent?.trim()).toBe('AL');
  });
});
