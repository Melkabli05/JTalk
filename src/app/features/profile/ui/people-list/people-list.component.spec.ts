import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { PersonSummary } from '@shared/utils/people';
import { PeopleListComponent } from './people-list.component';

const ANA: PersonSummary = {
  id: 'u-1',
  name: 'Ana',
  username: 'ana',
  nativeLanguage: 'es',
  learning: '',
  avatar: '',
  countryCode: 'ES',
};

describe('PeopleListComponent (presentational)', () => {
  let fixture: ComponentFixture<PeopleListComponent>;
  const root = () => fixture.nativeElement as HTMLElement;

  async function render(inputs: Record<string, unknown> = {}) {
    fixture = TestBed.createComponent(PeopleListComponent);
    for (const [name, value] of Object.entries({
      people: [],
      title: 'No partners yet',
      text: 'Add your languages.',
      ...inputs,
    })) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  it('says what to do when there is no one', async () => {
    await render();

    expect(root().querySelector('h2')?.textContent).toBe('No partners yet');
    expect(root().textContent).toContain('Add your languages.');
    expect(root().querySelector('.list')).toBeNull();
  });

  it('shows placeholders, announced as busy, while it loads for the first time', async () => {
    await render({ loading: true });

    expect(root().querySelector('[role="status"]')?.getAttribute('aria-label')).toBe(
      'Finding people',
    );
    expect(root().querySelectorAll('p-skeleton').length).toBeGreaterThan(2);
    expect(root().querySelector('h2')).toBeNull();
  });

  it('says it failed, and asks again when pressed', async () => {
    await render({ failed: true });
    const more = vi.fn();
    fixture.componentInstance.more.subscribe(more);

    expect(root().textContent).toContain('Could not load people.');
    root().querySelector<HTMLButtonElement>('p-message button')!.click();

    expect(more).toHaveBeenCalledOnce();
  });

  it('lists the people, opens the one pressed, and asks for more only when there is more', async () => {
    await render({ people: [ANA], hasMore: false });
    const opened = vi.fn();
    fixture.componentInstance.opened.subscribe(opened);

    root().querySelector<HTMLButtonElement>('app-person-row .open')!.click();
    expect(opened).toHaveBeenCalledExactlyOnceWith('u-1');
    expect(root().querySelector('.more')).toBeNull();

    await render({ people: [ANA], hasMore: true });
    const more = vi.fn();
    fixture.componentInstance.more.subscribe(more);
    root().querySelector<HTMLButtonElement>('.more')!.click();
    expect(more).toHaveBeenCalledOnce();
  });

  it('keeps the people it has and says so when the next page fails', async () => {
    await render({ people: [ANA], failed: true });

    expect(root().querySelectorAll('app-person-row')).toHaveLength(1);
    expect(root().textContent).toContain('Could not load more people.');
    expect(root().querySelector('.more')?.textContent).toContain('Try again');
  });
});
