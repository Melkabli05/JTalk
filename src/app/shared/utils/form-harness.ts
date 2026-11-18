import type { ComponentFixture } from '@angular/core/testing';

export function formHarness(fixture: () => ComponentFixture<unknown>) {
  const root = () => fixture().nativeElement as HTMLElement;

  const field = (label: string) =>
    [...root().querySelectorAll('app-text-field')]
      .find((f) => f.querySelector('label')?.textContent === label)!
      .querySelector('input')!;

  async function type(label: string, value: string) {
    const control = field(label);
    control.value = value;
    control.dispatchEvent(new Event('input'));
    control.dispatchEvent(new Event('blur'));
    await fixture().whenStable();
  }

  async function submit() {
    root()
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture().whenStable();
  }

  return { root, field, type, submit };
}
