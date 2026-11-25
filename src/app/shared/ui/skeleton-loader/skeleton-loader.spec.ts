import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SkeletonLoader } from './skeleton-loader';

describe('SkeletonLoader', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SkeletonLoader],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('should render a single text skeleton bone by default', () => {
    const fixture = TestBed.createComponent(SkeletonLoader);
    fixture.detectChanges();

    const bones = fixture.nativeElement.querySelectorAll('.skeleton-bone');
    expect(bones.length).toBe(1);
    expect(bones[0].classList.contains('skeleton-text')).toBe(true);
    expect(fixture.nativeElement.getAttribute('aria-hidden')).toBe('true');
  });

  it('should render stacked lines and expose status role when ariaLabel is set', () => {
    const fixture = TestBed.createComponent(SkeletonLoader);
    fixture.componentRef.setInput('variant', 'pill');
    fixture.componentRef.setInput('lines', 3);
    fixture.componentRef.setInput('ariaLabel', 'Loading rooms');
    fixture.detectChanges();

    const bones = fixture.nativeElement.querySelectorAll('.skeleton-bone');
    expect(bones.length).toBe(3);
    expect(fixture.nativeElement.classList.contains('skeleton-stack')).toBe(true);
    expect(fixture.nativeElement.getAttribute('role')).toBe('status');
    expect(fixture.nativeElement.getAttribute('aria-label')).toBe('Loading rooms');
  });
});
