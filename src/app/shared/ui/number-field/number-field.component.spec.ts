import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormField, form, min, required } from '@angular/forms/signals';
import { NumberFieldComponent } from './number-field.component';

@Component({
  imports: [FormField, NumberFieldComponent],
  template: '<app-number-field label="Amount" [formField]="f.total" />',
})
class HostComponent {
  readonly model = signal<{ total: number | null }>({ total: null });
  protected readonly f = form(this.model, (p) => {
    required(p.total, { message: 'Enter an amount.' });
    min(p.total, 1, { message: 'At least 1.' });
  });
  readonly field = this.f.total;
}

describe('NumberFieldComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  const input = () => root().querySelector('input')!;

  async function type(value: string) {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    input().dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  it('links the label to the input and starts without errors', () => {
    const label = root().querySelector('label')!;
    expect(label.getAttribute('for')).toBe(input().id);
    expect(root().textContent).not.toContain('Enter an amount.');
    expect(input().getAttribute('aria-invalid')).toBe('false');
  });

  it('writes the parsed number to the form model', async () => {
    await type('12.5');
    expect(fixture.componentInstance.model().total).toBe(12.5);
  });

  it('reveals errors and aria-invalid only after the field was touched', async () => {
    await type('0');
    expect(root().textContent).toContain('At least 1.');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(input().getAttribute('aria-describedby')).toBeTruthy();
  });

  it('focuses the real input', () => {
    const field = fixture.debugElement.query(By.directive(NumberFieldComponent));
    (field.componentInstance as NumberFieldComponent).focus();
    expect(document.activeElement).toBe(input());
  });
});
