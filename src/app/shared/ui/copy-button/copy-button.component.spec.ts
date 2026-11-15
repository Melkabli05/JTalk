import { Clipboard } from '@angular/cdk/clipboard';
import { TestBed } from '@angular/core/testing';
import { CopyButtonComponent } from './copy-button.component';

describe('CopyButtonComponent', () => {
  function setup(copies = true) {
    const copy = vi.fn<(text: string) => boolean>().mockReturnValue(copies);
    TestBed.configureTestingModule({ providers: [{ provide: Clipboard, useValue: { copy } }] });
    const fixture = TestBed.createComponent(CopyButtonComponent);
    fixture.componentRef.setInput('text', 'hello');
    fixture.componentRef.setInput('what', 'code');
    TestBed.tick();
    const button = () => (fixture.nativeElement as HTMLElement).querySelector('button')!;
    const status = () => (fixture.nativeElement as HTMLElement).querySelector('[role="status"]')!;
    return { copy, button, status, fixture };
  }

  it('names what it copies, copies the text, and says "copied" for a moment', () => {
    vi.useFakeTimers();
    try {
      const { copy, button, status } = setup();
      expect(button().getAttribute('aria-label')).toBe('Copy code');
      expect(button().textContent).toContain('Copy');

      button().click();
      TestBed.tick();
      expect(copy).toHaveBeenCalledExactlyOnceWith('hello');
      expect(button().getAttribute('aria-label')).toBe('Code copied');
      expect(button().textContent).toContain('Copied');
      expect(status().textContent).toBe('Code copied');

      vi.advanceTimersByTime(2100);
      TestBed.tick();
      expect(button().getAttribute('aria-label')).toBe('Copy code');
      expect(status().textContent).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not claim success when the browser refused to copy', () => {
    const { button } = setup(false);
    button().click();
    TestBed.tick();
    expect(button().getAttribute('aria-label')).toBe('Copy code');
  });
});
