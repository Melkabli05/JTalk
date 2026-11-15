import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { Mock } from 'vitest';
import type { Credentials } from '../../auth.models';
import { LoginFormComponent } from './login-form.component';
import { formHarness } from '@shared/utils/form-harness';

describe('LoginFormComponent (presentational)', () => {
  let fixture: ComponentFixture<LoginFormComponent>;
  let signedIn: Mock<(credentials: Credentials) => void>;

  const { root, field, type, submit } = formHarness(() => fixture);

  beforeEach(async () => {
    fixture = TestBed.createComponent(LoginFormComponent);
    signedIn = vi.fn<(credentials: Credentials) => void>();
    fixture.componentInstance.signIn.subscribe(signedIn);
    await fixture.whenStable();
  });

  it('asks the browser to offer saved credentials', () => {
    expect(field('Email').getAttribute('autocomplete')).toBe('username');
    expect(field('Password').getAttribute('autocomplete')).toBe('current-password');
    expect(field('Password').type).toBe('password');
  });

  it('shows errors, focuses the first bad field and emits nothing when empty', async () => {
    await submit();

    expect(root().textContent).toContain('Enter your email address.');
    expect(root().textContent).toContain('Enter your password.');
    expect(document.activeElement).toBe(field('Email'));
    expect(signedIn).not.toHaveBeenCalled();
  });

  it('rejects a malformed email', async () => {
    await type('Email', 'not-an-email');
    expect(root().textContent).toContain('Enter a valid email address.');
  });

  it('emits the credentials, trimming the email but never the password', async () => {
    await type('Email', ' ada@x.io ');
    await type('Password', ' secret ');
    await submit();

    expect(signedIn).toHaveBeenCalledExactlyOnceWith({ email: 'ada@x.io', password: ' secret ' });
  });

  it('ignores a submit while the container is still signing in, and shows its error', async () => {
    await type('Email', 'ada@x.io');
    await type('Password', 'secret');
    fixture.componentRef.setInput('submitting', true);
    await submit();
    expect(signedIn).not.toHaveBeenCalled();

    fixture.componentRef.setInput('error', 'Incorrect email or password.');
    await fixture.whenStable();
    expect(root().textContent).toContain('Incorrect email or password.');
  });
});
