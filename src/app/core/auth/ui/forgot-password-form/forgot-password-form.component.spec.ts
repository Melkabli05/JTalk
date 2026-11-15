import { ComponentFixture, TestBed } from '@angular/core/testing';
import { formHarness } from '@shared/utils/form-harness';
import { ForgotPasswordFormComponent } from './forgot-password-form.component';

describe('ForgotPasswordFormComponent (presentational)', () => {
  let fixture: ComponentFixture<ForgotPasswordFormComponent>;
  let requested: ReturnType<typeof vi.fn<(email: string) => void>>;
  const { root, field, type, submit } = formHarness(() => fixture);

  beforeEach(async () => {
    fixture = TestBed.createComponent(ForgotPasswordFormComponent);
    requested = vi.fn<(email: string) => void>();
    fixture.componentInstance.requestReset.subscribe(requested);
    await fixture.whenStable();
  });

  it('asks for an address first', async () => {
    await submit();
    expect(root().textContent).toContain('Enter your email address.');
    expect(document.activeElement).toBe(field('Email'));
    expect(requested).not.toHaveBeenCalled();
  });

  it('rejects a malformed address', async () => {
    await type('Email', 'nope');
    expect(root().textContent).toContain('Enter a valid email address.');
  });

  it('emits the trimmed address', async () => {
    await type('Email', ' ada@x.io ');
    await submit();
    expect(requested).toHaveBeenCalledExactlyOnceWith('ada@x.io');
  });
});
