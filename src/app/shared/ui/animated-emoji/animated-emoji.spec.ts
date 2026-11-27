import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AnimatedEmoji } from './animated-emoji';

describe('AnimatedEmoji', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnimatedEmoji],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('renders static Noto SVG at rest and mounts animated WebP/GIF when active', () => {
    const fixture = TestBed.createComponent(AnimatedEmoji);
    fixture.componentRef.setInput('code', 'CLAP');
    fixture.componentRef.setInput('emoji', '👏');
    fixture.componentRef.setInput('active', false);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const staticImg = el.querySelector<HTMLImageElement>('img.noto-static');
    expect(staticImg?.getAttribute('src')).toContain('/1f44f/emoji.svg');
    expect(el.querySelector('picture.noto-motion')).toBeNull();

    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();

    const source = el.querySelector<HTMLSourceElement>('picture.noto-motion source');
    const motionImg = el.querySelector<HTMLImageElement>('img.noto-motion-img');
    expect(source?.getAttribute('srcset')).toContain('/1f44f/512.webp');
    expect(motionImg?.getAttribute('src')).toContain('/1f44f/512.gif');
    expect(el.getAttribute('data-animated')).toBe('true');
  });

  it('falls back to native emoji text when codepoint is unmapped or static SVG errors', () => {
    const fixture = TestBed.createComponent(AnimatedEmoji);
    fixture.componentRef.setInput('emoji', '🦄');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.noto-fallback')?.textContent?.trim()).toBe('🦄');
    expect(el.querySelector('img')).toBeNull();
  });
});
