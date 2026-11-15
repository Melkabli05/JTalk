import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormField, form, minLength, required } from '@angular/forms/signals';
import { By } from '@angular/platform-browser';
import { formHarness } from '../../utils/form-harness';
import { PasswordFieldComponent } from './password-field.component';

@Component({
  imports: [FormField, PasswordFieldComponent],
  template: `<app-password-field
    label="Password"
    autocomplete="new-password"
    hint="At least 8 characters."
    [formField]="f.password"
  />`,
})
class HostComponent {
  readonly model = signal({ password: '' });
  protected readonly f = form(this.model, (p) => {
    required(p.password, { message: 'Choose a password.' });
    minLength(p.password, 8, { message: 'Too short.' });
  });
}

describe('PasswordFieldComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  const { root, field, type } = formHarness(() => fixture);

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  it('links the label, the autocomplete purpose and the hint to the input', () => {
    const input = field('Password');
    expect(root().querySelector('label')!.getAttribute('for')).toBe(input.id);
    expect(input.type).toBe('password');
    expect(input.getAttribute('autocomplete')).toBe('new-password');
    expect(input.getAttribute('aria-describedby')).toBe(root().querySelector('.hint')!.id);
    expect(input.getAttribute('aria-invalid')).toBe('false');
  });

  it('keeps the password exactly as typed: spaces are part of it', async () => {
    await type('Password', '  a long phrase  ');
    expect(fixture.componentInstance.model().password).toBe('  a long phrase  ');
  });

  it('reveals errors, aria-invalid and a second describedby id only after the field was touched', async () => {
    await type('Password', 'abc');
    const input = field('Password');

    expect(root().textContent).toContain('Too short.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')?.split(' ')).toHaveLength(2);
  });

  it('can show the password with the Optimus toggle', async () => {
    const toggle = root().querySelector('p-password svg, p-password i');
    expect(toggle).not.toBeNull();
    toggle!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();

    expect(field('Password').type).toBe('text');
  });

  it('focuses the real input', () => {
    const control = fixture.debugElement.query(By.directive(PasswordFieldComponent));
    (control.componentInstance as PasswordFieldComponent).focus();
    expect(document.activeElement).toBe(field('Password'));
  });
});
