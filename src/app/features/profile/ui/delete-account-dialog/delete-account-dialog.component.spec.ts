import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { DeleteAccountDialogComponent } from './delete-account-dialog.component';

describe('DeleteAccountDialogComponent (presentational)', () => {
  let fixture: ComponentFixture<DeleteAccountDialogComponent>;
  const page = () => document.body;
  const buttons = () => [...page().querySelectorAll<HTMLButtonElement>('.p-dialog button')];
  const button = (label: string) => buttons().find((b) => b.textContent?.trim() === label)!;
  const field = () => page().querySelector<HTMLInputElement>('.p-dialog input')!;

  async function render(inputs: Record<string, unknown> = {}) {
    fixture = TestBed.createComponent(DeleteAccountDialogComponent);
    for (const [name, value] of Object.entries({ visible: true, word: 'mona_1a2b', ...inputs })) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  async function type(text: string) {
    field().value = text;
    field().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  afterEach(() => fixture.destroy());

  it('says plainly what is deleted, and that it cannot be undone', async () => {
    await render();

    const text = page().querySelector('.p-dialog')?.textContent ?? '';
    expect(text).toContain('Delete your account');
    expect(text).toContain('permanently deletes your profile');
    expect(text).toContain('It cannot be undone.');
    expect(text).toContain('You can sign up again any time');
  });

  it('asks for the handle, and deletes nothing until it has been typed', async () => {
    const confirmed = vi.fn();
    await render();
    fixture.componentInstance.confirmed.subscribe(confirmed);
    expect(page().querySelector('.p-dialog label')?.textContent).toContain(
      'Type mona_1a2b to confirm',
    );
    expect(button('Delete my account').disabled).toBe(true);

    button('Delete my account').click();
    expect(confirmed).not.toHaveBeenCalled();

    await type('mona');
    expect(button('Delete my account').disabled).toBe(true);

    await type('mona_1a2b');
    expect(button('Delete my account').disabled).toBe(false);
    button('Delete my account').click();
    expect(confirmed).toHaveBeenCalledOnce();
  });

  it('does not mind capitals or spaces around what was typed', async () => {
    await render();

    await type('  Mona_1A2B ');

    expect(button('Delete my account').disabled).toBe(false);
  });

  it('is not red until it matters: Cancel is quiet, the deleting button is the danger one', async () => {
    await render();

    expect(button('Delete my account').className).toContain('p-button-danger');
    expect(button('Cancel').className).toContain('p-button-secondary');
    expect(button('Cancel').className).toContain('p-button-text');
  });

  it('closes on Cancel', async () => {
    const closed = vi.fn();
    await render();
    fixture.componentInstance.visible.subscribe(closed);

    button('Cancel').click();

    expect(closed).toHaveBeenCalledWith(false);
  });

  it('cannot be dismissed or changed while it works, and says when it failed', async () => {
    await render({ busy: true, error: 'Could not delete your account. Please try again.' });

    expect(button('Cancel').disabled).toBe(true);
    expect(field().disabled).toBe(true);
    expect(page().querySelector('.p-dialog p-message')?.textContent).toContain(
      'Could not delete your account.',
    );
  });
});
