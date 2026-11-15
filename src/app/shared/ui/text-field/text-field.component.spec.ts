import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, email, form, required } from '@angular/forms/signals';
import { TextFieldComponent } from './text-field.component';

@Component({
  imports: [TextFieldComponent, FormField],
  template: `<app-text-field label="Email" type="email" [formField]="f.email" />`,
})
class Host {
  protected readonly model = signal({ email: '' });
  protected readonly f = form(this.model, (path) => {
    required(path.email, { message: 'Required.' });
    email(path.email, { message: 'Invalid.' });
  });
  readonly value = () => this.model().email;
}

describe('TextFieldComponent', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector('input')!;
    return { fixture, root, input };
  }

  it('links the label to the input', async () => {
    const { root, input } = await setup();
    expect(root.querySelector('label')?.getAttribute('for')).toBe(input.id);
    expect(root.querySelector('label')?.textContent).toBe('Email');
  });

  it('stays quiet until touched, then announces the error accessibly', async () => {
    const { fixture, root, input } = await setup();
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(input.classList.contains('p-invalid')).toBe(false);

    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.classList.contains('p-invalid')).toBe(true);
    const describedBy = input.getAttribute('aria-describedby')!;
    expect(root.querySelector(`#${describedBy}`)?.textContent).toContain('Required.');
  });

  it('writes typed text back to the form model', async () => {
    const { fixture, input } = await setup();
    input.value = 'a@b.co';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBe('a@b.co');
  });

  it('marks required fields for assistive tech', async () => {
    const { input } = await setup();
    expect(input.getAttribute('aria-required')).toBe('true');
  });
});
