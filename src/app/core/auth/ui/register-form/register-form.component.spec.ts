import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { Mock } from 'vitest';
import { formHarness } from '@shared/utils/form-harness';
import { type Credentials, MIN_PASSWORD_LENGTH } from '../../auth.models';
import { RegisterFormComponent } from './register-form.component';

describe('RegisterFormComponent (presentational)', () => {
  let fixture: ComponentFixture<RegisterFormComponent>;
  let registered: Mock<(credentials: Credentials) => void>;
  const { root, field, type, submit } = formHarness(() => fixture);

  beforeEach(async () => {
    fixture = TestBed.createComponent(RegisterFormComponent);
    registered = vi.fn<(credentials: Credentials) => void>();
    fixture.componentInstance.register.subscribe(registered);
    await fixture.whenStable();
  });

  it('lets the browser create and save a password, and states the only rule', () => {
    expect(field('Email').getAttribute('autocomplete')).toBe('email');
    expect(field('Password').getAttribute('autocomplete')).toBe('new-password');
    expect(root().textContent).toContain(`At least ${MIN_PASSWORD_LENGTH} characters`);
  });

  it('shows errors, focuses the first bad field and emits nothing when empty', async () => {
    await submit();

    expect(root().textContent).toContain('Enter your email address.');
    expect(root().textContent).toContain('Choose a password.');
    expect(document.activeElement).toBe(field('Email'));
    expect(registered).not.toHaveBeenCalled();
  });

  it('rejects a short password but asks for nothing else (no symbols or capitals)', async () => {
    await type('Email', 'ada@x.io');
    await type('Password', 'short');
    expect(root().textContent).toContain(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);

    await type('Password', 'all lowercase words here');
    expect(root().textContent).not.toContain('Use at least');
  });

  it('emits the credentials as typed', async () => {
    await type('Email', ' ada@x.io ');
    await type('Password', 'correct horse battery');
    await submit();

    expect(registered).toHaveBeenCalledExactlyOnceWith({
      email: 'ada@x.io',
      password: 'correct horse battery',
    });
  });

  it('ignores a submit while the container is working, and shows its error', async () => {
    await type('Email', 'ada@x.io');
    await type('Password', 'correct horse battery');
    fixture.componentRef.setInput('submitting', true);
    await submit();
    expect(registered).not.toHaveBeenCalled();

    fixture.componentRef.setInput('error', 'Could not create your account.');
    await fixture.whenStable();
    expect(root().textContent).toContain('Could not create your account.');
  });
});
