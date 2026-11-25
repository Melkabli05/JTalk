import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { HeroScene } from '../../models/hero-scene.model';
import { RoomsHero } from './rooms-hero';

describe('RoomsHero', () => {
  const scenes: HeroScene[] = [
    {
      id: 'morning-1',
      period: 'morning',
      greeting: 'Good morning',
      src: '/assets/aistudio/morning_a135c675.jpg',
      alt: 'Misty sunrise over a calm lake',
    },
    {
      id: 'morning-2',
      period: 'morning',
      greeting: 'Good morning',
      src: '/assets/aistudio/morning-2_89f96d9a.jpg',
      alt: 'Golden morning fog above tranquil water',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoomsHero],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('should render active scene greeting, subtitle, and emit nextScene on switcher click', () => {
    const fixture = TestBed.createComponent(RoomsHero);
    fixture.componentRef.setInput('liveCount', 5);
    fixture.componentRef.setInput('scenes', scenes);
    fixture.componentRef.setInput('activeScene', scenes[0]);
    const spy = vi.fn();
    fixture.componentInstance.nextScene.subscribe(spy);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Good morning');
    expect(fixture.nativeElement.querySelector('.hero-inner p')?.textContent).toContain(
      'Start the day talking.',
    );
    expect(fixture.nativeElement.textContent).toContain('5 rooms live now');
    expect(fixture.nativeElement.querySelector('#heroStartRoomBtn')).toBeNull();

    const activeImages = fixture.nativeElement.querySelectorAll('img.hero-bg.is-active');
    expect(activeImages.length).toBe(1);

    const btn: HTMLButtonElement | null = fixture.nativeElement.querySelector('.hero-scene-btn');
    btn?.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should reflect active language filter count in the status pill', () => {
    const fixture = TestBed.createComponent(RoomsHero);
    fixture.componentRef.setInput('liveCount', 2);
    fixture.componentRef.setInput('activeFilter', 'fr');
    fixture.componentRef.setInput('activeFilterLabel', 'French');
    fixture.componentRef.setInput('scenes', scenes);
    fixture.componentRef.setInput('activeScene', scenes[0]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.live-pill')?.textContent).toContain(
      '2 rooms in French',
    );
  });

  it('should turn into an invite with Start a room button when no rooms are live', () => {
    const fixture = TestBed.createComponent(RoomsHero);
    fixture.componentRef.setInput('liveCount', 0);
    fixture.componentRef.setInput('scenes', scenes);
    fixture.componentRef.setInput('activeScene', scenes[0]);
    const startSpy = vi.fn();
    fixture.componentInstance.startRoom.subscribe(startSpy);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.hero-inner p')?.textContent).toContain(
      'No rooms live now. Start one.',
    );
    const startBtn: HTMLButtonElement | null =
      fixture.nativeElement.querySelector('#heroStartRoomBtn');
    expect(startBtn).toBeTruthy();
    startBtn?.click();
    expect(startSpy).toHaveBeenCalledTimes(1);
  });
});

