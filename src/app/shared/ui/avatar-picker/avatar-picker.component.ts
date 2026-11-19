import { NgOptimizedImage } from '@angular/common';
import { Component, ElementRef, input, model, output, signal, viewChildren } from '@angular/core';
import { AVATARS } from '../../utils/avatars';
import { squareJpeg } from '../../utils/image-resize';
import { FieldControlDirective } from '../field-control.directive';
import { FieldErrorsComponent } from '../field-errors/field-errors.component';

/** The value of the picker while the picture they uploaded is the one chosen (the bundled ones are chosen by their id). */
export const CUSTOM_AVATAR = 'custom';

@Component({
  selector: 'app-avatar-picker',
  imports: [FieldErrorsComponent, NgOptimizedImage],
  templateUrl: './avatar-picker.component.html',
  styleUrl: './avatar-picker.component.scss',
})
export class AvatarPickerComponent extends FieldControlDirective<string> {
  readonly value = model('');
  /** Where to show the picture they uploaded from: the one they have, or the one they just chose. None until there is one. */
  readonly custom = input<string | null>(null);

  /** A picture was chosen from their device, already made small and square, ready to be sent. */
  readonly picked = output<Blob>();

  /** Why the last file could not be used, in words for the person. */
  protected readonly problem = signal<string | null>(null);
  protected readonly customValue = CUSTOM_AVATAR;

  protected readonly avatars = AVATARS;
  protected readonly group = `${this.inputId}-group`;

  private readonly radios = viewChildren<ElementRef<HTMLInputElement>>('radio');

  protected async choose(event: Event): Promise<void> {
    const chooser = event.target as HTMLInputElement;
    const file = chooser.files?.[0];
    chooser.value = '';
    if (!file) {
      return;
    }
    this.problem.set(null);
    try {
      this.picked.emit(await squareJpeg(file));
    } catch (error) {
      this.problem.set(error instanceof Error ? error.message : 'That picture could not be used.');
    }
  }

  focus(): void {
    const radios = this.radios();
    (radios.find((radio) => radio.nativeElement.checked) ?? radios[0])?.nativeElement.focus();
  }
}
