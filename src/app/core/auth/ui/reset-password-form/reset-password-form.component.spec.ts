import { ComponentFixture, TestBed } from '@angular/core/testing';
import { formHarness } from '@shared/utils/form-harness';
import { MIN_PASSWORD_LENGTH } from '../../auth.models';
import { ResetPasswordFormComponent } from './reset-password-form.component';

describe('ResetPasswordFormComponent (presentational)', () => {
  let fixture: ComponentFixture<ResetPasswordFormComponent>;
  let chosen: ReturnType<typeof vi.fn<(password: string) => void>>;
  const { root, field, type, submit } = formHarness(() => fixture);

  beforeEach(async () => {
    fixture = TestBed.createComponent(ResetPasswordFormComponent);
    chosen = vi.fn<(password: string) => void>();
    fixture.componentInstance.resetPassword.subscribe(chosen);
    await fixture.whenStable();
  });

  it('is a new-password field', () => {
    expect(field('New password').getAttribute('autocomplete')).toBe('new-password');
  });

  it('requires a password of the minimum length', async () => {
    await submit();
    expect(root().textContent).toContain('Choose a new password.');
    expect(chosen).not.toHaveBeenCalled();

    await type('New password', 'short');
    expect(root().textContent).toContain(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  });

  it('emits the new password untouched', async () => {
    await type('New password', ' correct horse battery ');
    await submit();
    expect(chosen).toHaveBeenCalledExactlyOnceWith(' correct horse battery ');
  });
});
