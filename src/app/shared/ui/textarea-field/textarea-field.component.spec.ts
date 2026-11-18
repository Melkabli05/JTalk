import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, form, maxLength } from '@angular/forms/signals';
import { TextareaFieldComponent } from './textarea-field.component';

@Component({
  imports: [TextareaFieldComponent, FormField],
  template: `<app-textarea-field label="About you" [formField]="f.bio" />`,
})
class Host {
  protected readonly model = signal({ bio: '' });
  protected readonly f = form(this.model, (path) => {
    maxLength(path.bio, 10, { message: 'Too long.' });
  });
  readonly value = () => this.model().bio;
}

describe('TextareaFieldComponent', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    return { fixture, root, area: root.querySelector('textarea')! };
  }

  it('links the label to the box, and stops typing at the limit', async () => {
    const { root, area } = await setup();

    expect(root.querySelector('label')?.getAttribute('for')).toBe(area.id);
    expect(root.querySelector('label')?.textContent).toBe('About you');
    expect(area.getAttribute('maxlength')).toBe('10');
  });

  it('writes typed text back to the form and counts it', async () => {
    const { fixture, root, area } = await setup();

    area.value = 'Hola amigo';
    area.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBe('Hola amigo');
    expect(root.querySelector('.count')?.textContent).toBe('10/10');
  });
});
