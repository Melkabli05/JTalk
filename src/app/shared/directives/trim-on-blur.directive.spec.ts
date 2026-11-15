import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TrimOnBlurDirective } from './trim-on-blur.directive';

@Component({
  imports: [TrimOnBlurDirective],
  template: `<input
    appTrimOnBlur
    [value]="value()"
    (input)="value.set($any($event.target).value)"
  />`,
})
class HostComponent {
  readonly value = signal('');
}

describe('TrimOnBlurDirective', () => {
  async function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    return { fixture, input: (fixture.nativeElement as HTMLElement).querySelector('input')! };
  }

  it('trims on blur and tells the bound value', async () => {
    const { fixture, input } = await setup();
    input.value = '  a@b.co  ';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    expect(input.value).toBe('a@b.co');
    expect(fixture.componentInstance.value()).toBe('a@b.co');
  });

  it('leaves already-clean text alone', async () => {
    const { fixture, input } = await setup();
    const listener = vi.fn();
    input.value = 'clean';
    input.addEventListener('input', listener);
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    expect(input.value).toBe('clean');
    expect(listener).not.toHaveBeenCalled();
  });
});
