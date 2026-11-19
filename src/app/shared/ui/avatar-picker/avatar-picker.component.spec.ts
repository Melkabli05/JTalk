import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, form } from '@angular/forms/signals';
import { AvatarPickerComponent } from './avatar-picker.component';

@Component({
  imports: [AvatarPickerComponent, FormField],
  template: `<app-avatar-picker
    label="Choose your picture"
    [custom]="custom()"
    [formField]="f.avatar"
    (picked)="picked.push($event)"
  />`,
})
class Host {
  readonly model = signal({ avatar: 'avatar-02' });
  readonly custom = signal<string | null>(null);
  readonly picked: Blob[] = [];
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

  describe('uploading their own', () => {
    const file = (name = 'me.png', type = 'image/png') => new File(['x'], name, { type });
    const chooser = (root: HTMLElement) =>
      root.querySelector<HTMLInputElement>('input[type="file"]')!;

    async function choose(root: HTMLElement, chosen: File) {
      const input = chooser(root);
      Object.defineProperty(input, 'files', { value: [chosen], configurable: true });
      input.dispatchEvent(new Event('change'));
      await new Promise((resolve) => setTimeout(resolve));
    }

    const small = new Blob(['jpeg'], { type: 'image/jpeg' });

    beforeEach(() => {
      vi.stubGlobal('createImageBitmap', () =>
        Promise.resolve({ width: 40, height: 20, close: () => undefined }),
      );
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        drawImage: () => undefined,
      } as unknown as CanvasRenderingContext2D);
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) => done(small));
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('has a labelled way to upload, which only takes pictures', async () => {
      const { root } = await setup();

      expect(chooser(root).getAttribute('aria-label')).toBe('Upload your own picture');
      expect(chooser(root).accept).toContain('image/jpeg');
      expect(root.querySelector('.hint')?.textContent).toContain('cropped to a square');
    });

    it('hands over the picture made small and square, not the file that was chosen', async () => {
      const { fixture, root } = await setup();

      await choose(root, file());
      await fixture.whenStable();

      expect(fixture.componentInstance.picked).toEqual([small]);
      expect(root.querySelector('.problem')).toBeNull();
    });

    it('says why a file could not be used, and takes the next one', async () => {
      const { fixture, root } = await setup();

      await choose(root, file('a.txt', 'text/plain'));
      await fixture.whenStable();
      expect(root.querySelector('.problem')?.textContent).toContain('Choose a picture');
      expect(root.querySelector('.problem')?.getAttribute('role')).toBe('alert');

      await choose(root, file());
      await fixture.whenStable();
      expect(root.querySelector('.problem')).toBeNull();
      expect(fixture.componentInstance.picked).toHaveLength(1);
    });

    it('does nothing when the dialog is closed without a file', async () => {
      const { fixture, root } = await setup();
      Object.defineProperty(chooser(root), 'files', { value: [], configurable: true });

      chooser(root).dispatchEvent(new Event('change'));
      await fixture.whenStable();

      expect(root.querySelector('.problem')).toBeNull();
      expect(fixture.componentInstance.picked).toEqual([]);
    });
  });

  describe('their own picture as one more choice', () => {
    it('is not offered until they have one', async () => {
      const { radios } = await setup();

      expect(radios()).toHaveLength(10);
    });

    it('is offered, named for screen readers, and chosen by clicking it', async () => {
      const { fixture, root, radios } = await setup();
      fixture.componentInstance.custom.set('blob:mine');
      await fixture.whenStable();

      expect(radios()).toHaveLength(11);
      const own = radios()[10];
      expect(own.getAttribute('aria-label')).toBe('Your own picture');
      expect(root.querySelector<HTMLElement>('.own')?.style.backgroundImage).toContain('blob:mine');

      own.click();
      await fixture.whenStable();

      expect(fixture.componentInstance.model().avatar).toBe('custom');
      expect(root.querySelectorAll('.option.selected')).toHaveLength(1);
    });
  });
});
