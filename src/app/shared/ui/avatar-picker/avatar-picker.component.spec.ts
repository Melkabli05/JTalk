import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, form } from '@angular/forms/signals';
import { AvatarPickerComponent } from './avatar-picker.component';

@Component({
  imports: [AvatarPickerComponent, FormField],
  template: `<app-avatar-picker label="Choose your picture" [formField]="f.avatar" />`,
})
class Host {
  readonly model = signal({ avatar: 'avatar-02' });
  protected readonly f = form(this.model);
}

describe('AvatarPickerComponent', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const radios = () => [...root.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    return { fixture, root, radios };
  }

  it('is a labelled group of ten radio buttons that share one name', async () => {
    const { root, radios } = await setup();

    expect(root.querySelector('fieldset legend')?.textContent).toBe('Choose your picture');
    expect(radios()).toHaveLength(10);
    expect(new Set(radios().map((r) => r.name)).size).toBe(1);
  });

  it('names each picture by its number, since the pictures themselves are decorative', async () => {
    const { root, radios } = await setup();

    expect(radios().map((r) => r.getAttribute('aria-label'))).toEqual(
      Array.from({ length: 10 }, (_, index) => `Avatar ${index + 1}`),
    );
    expect([...root.querySelectorAll('img')].every((img) => img.getAttribute('alt') === '')).toBe(
      true,
    );
  });

  it('shows the current choice as selected', async () => {
    const { root, radios } = await setup();

    expect(radios().findIndex((r) => r.checked)).toBe(1);
    expect(root.querySelectorAll('.option.selected')).toHaveLength(1);
  });

  it('writes the choice back to the form', async () => {
    const { fixture, radios } = await setup();

    radios()[6].click();
    await fixture.whenStable();

    expect(fixture.componentInstance.model().avatar).toBe('avatar-07');
    expect(radios().findIndex((r) => r.checked)).toBe(6);
  });

  it('shows each picture from the bundled folder', async () => {
    const { root } = await setup();

    expect(
      [...root.querySelectorAll('img')].map((img) => img.getAttribute('src')).slice(0, 2),
    ).toEqual(['avatars/avatar-01.svg', 'avatars/avatar-02.svg']);
  });
});
