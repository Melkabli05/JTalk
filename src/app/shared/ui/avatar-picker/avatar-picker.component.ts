import { NgOptimizedImage } from '@angular/common';
import { Component, ElementRef, viewChildren, model } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AVATARS } from '../../utils/avatars';
import { FieldControlDirective } from '../field-control.directive';
import { FieldErrorsComponent } from '../field-errors/field-errors.component';

/**
 * A labelled choice of picture that plugs into Signal Forms. Native radio buttons in a fieldset, so arrow keys, focus and
 * screen readers work without code; Optimus has no picture picker (its SelectButton is one row of text buttons). Each picture
 * is decorative: the radio's own name ("Avatar 3") is what is announced.
 */
@Component({
  selector: 'app-avatar-picker',
  imports: [FieldErrorsComponent, NgOptimizedImage, TranslatePipe],
  templateUrl: './avatar-picker.component.html',
  styleUrl: './avatar-picker.component.scss',
})
export class AvatarPickerComponent extends FieldControlDirective<string> {
  readonly value = model('');

  protected readonly avatars = AVATARS;
  protected readonly group = `${this.inputId}-group`;

  private readonly radios = viewChildren<ElementRef<HTMLInputElement>>('radio');

  focus(): void {
    const radios = this.radios();
    (radios.find((radio) => radio.nativeElement.checked) ?? radios[0])?.nativeElement.focus();
  }
}
