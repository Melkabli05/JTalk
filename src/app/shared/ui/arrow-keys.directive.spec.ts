import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ArrowKeysDirective } from './arrow-keys.directive';

@Component({
  imports: [ArrowKeysDirective],
  template: `
    <div appArrowKeys [attr.dir]="dir">
      <button type="button" id="a">A</button>
      <button type="button" id="b" disabled>B</button>
      <button type="button" id="c">C</button>
      <button type="button" id="d">D</button>
    </div>
    <button type="button" id="outside">Outside</button>
  `,
})
class Host {
  dir = 'ltr';
}

describe('ArrowKeysDirective', () => {
  const press = (key: string, from: string) => {
    const element = document.getElementById(from)!;
    element.focus();
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event;
  };

  beforeEach(async () => {
    const fixture = TestBed.createComponent(Host);
    document.body.append(fixture.nativeElement as HTMLElement);
    await fixture.whenStable();
  });

  afterEach(() => (document.body.innerHTML = ''));

  it('moves forward and back between the buttons that can be used, going round at the ends', () => {
    press('ArrowRight', 'a');
    expect(document.activeElement?.id).toBe('c');
    press('ArrowRight', 'c');
    press('ArrowRight', 'd');
    expect(document.activeElement?.id).toBe('a');
    press('ArrowLeft', 'a');
    expect(document.activeElement?.id).toBe('d');
  });

  it('goes to the first and the last with Home and End', () => {
    press('End', 'c');
    expect(document.activeElement?.id).toBe('d');
    press('Home', 'd');
    expect(document.activeElement?.id).toBe('a');
  });

  it('leaves other keys, and keys pressed with a modifier, alone', () => {
    expect(press('Tab', 'a').defaultPrevented).toBe(false);
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.getElementById('a')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('ignores a key from outside the group', () => {
    expect(press('ArrowRight', 'outside').defaultPrevented).toBe(false);
  });
});
