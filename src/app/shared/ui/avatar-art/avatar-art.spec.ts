import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AvatarArt } from './avatar-art';

describe('AvatarArt', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarArt],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('should render SVG artwork for preset avatars', () => {
    const fixture = TestBed.createComponent(AvatarArt);
    fixture.componentRef.setInput('avatarId', 'preset-3');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img')?.getAttribute('src')).toBe('/avatars/preset-3.svg');
  });

  it('should render own photo or thumb fallback for custom avatar', () => {
    const fixture = TestBed.createComponent(AvatarArt);
    fixture.componentRef.setInput('avatarId', 'own');
    fixture.componentRef.setInput('variant', 'thumb');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.own-thumb')).toBeTruthy();

    fixture.componentRef.setInput('variant', 'full');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.own-photo')).toBeTruthy();
  });
});
