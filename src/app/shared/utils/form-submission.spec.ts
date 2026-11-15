import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, FormRoot, form, required } from '@angular/forms/signals';
import { formSubmission } from './form-submission';

@Component({
  imports: [FormField, FormRoot],
  template: `
    <form [formRoot]="f">
      <input id="name" [formField]="f.name" />
      <input id="email" [formField]="f.email" />
    </form>
  `,
})
class HostComponent {
  readonly busy = signal(false);
  readonly submitted: { name: string; email: string }[] = [];
  protected readonly model = signal({ name: '', email: '' });
  protected readonly f = form(
    this.model,
    (path) => {
      required(path.name);
      required(path.email);
    },
    {
      submission: formSubmission<{ name: string; email: string }>({
        busy: () => this.busy(),
        submit: (value) => this.submitted.push(value),
      }),
    },
  );
}

describe('formSubmission', () => {
  async function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const type = async (id: string, value: string) => {
      const input = root.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const submit = async () => {
      root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await fixture.whenStable();
    };
    return { fixture, root, type, submit };
  }

  it('hands the value over once the form is valid', async () => {
    const { fixture, type, submit } = await setup();
    await type('name', 'Ada');
    await type('email', 'ada@x.io');
    await submit();

    expect(fixture.componentInstance.submitted).toEqual([{ name: 'Ada', email: 'ada@x.io' }]);
  });

  it('submits nothing and focuses the first invalid field when invalid', async () => {
    const { fixture, root, type, submit } = await setup();
    await type('email', 'ada@x.io');
    await submit();

    expect(fixture.componentInstance.submitted).toEqual([]);
    expect(document.activeElement).toBe(root.querySelector('#name'));
  });

  it('ignores a submit while the container is busy', async () => {
    const { fixture, type, submit } = await setup();
    await type('name', 'Ada');
    await type('email', 'ada@x.io');
    fixture.componentInstance.busy.set(true);
    await submit();

    expect(fixture.componentInstance.submitted).toEqual([]);
  });
});
