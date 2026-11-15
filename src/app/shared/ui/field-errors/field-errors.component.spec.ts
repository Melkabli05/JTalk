import { TestBed } from '@angular/core/testing';
import { FieldErrorsComponent } from './field-errors.component';

describe('FieldErrorsComponent', () => {
  const errors = [{ kind: 'required', message: 'Enter a value.' }] as never;

  async function render(visible: boolean) {
    const fixture = TestBed.createComponent(FieldErrorsComponent);
    fixture.componentRef.setInput('errors', errors);
    fixture.componentRef.setInput('visible', visible);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('lists the messages when visible', async () => {
    expect((await render(true)).textContent).toContain('Enter a value.');
  });

  it('stays empty (but present) until visible', async () => {
    expect((await render(false)).textContent?.trim()).toBe('');
  });
});
