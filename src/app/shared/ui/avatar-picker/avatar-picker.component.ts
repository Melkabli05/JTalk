import { NgOptimizedImage } from '@angular/common';
import { Component, ElementRef, viewChildren, model } from '@angular/core';
import { AVATARS } from '../../utils/avatars';
import { FieldControlDirective } from '../field-control.directive';
import { FieldErrorsComponent } from '../field-errors/field-errors.component';

@Component({
  selector: 'app-avatar-picker',
  imports: [FieldErrorsComponent, NgOptimizedImage],
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
