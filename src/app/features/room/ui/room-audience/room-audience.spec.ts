import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RoomListener } from '../../models/live-room.model';
import { RoomAudience } from './room-audience';

describe('RoomAudience', () => {
  const listeners: RoomListener[] = [
    {
      id: 'l1',
      name: 'Maya',
      initial: 'M',
      chipClass: 'avatar-chip-warm',
      handRaised: false,
    },
    {
      id: 'l2',
      name: 'Sofia',
      initial: 'S',
      chipClass: 'avatar-chip-blue',
      handRaised: true,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoomAudience],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('hides the entire audience section when there are no listeners', () => {
    const fixture = TestBed.createComponent(RoomAudience);
    fixture.componentRef.setInput('listeners', []);
    fixture.componentRef.setInput('listenerLabel', '0 listening');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.audience-section')).toBeNull();
  });

  it('can hide the listener rail without reporting an empty audience', () => {
    const fixture = TestBed.createComponent(RoomAudience);
    fixture.componentRef.setInput('listeners', listeners);
    fixture.componentRef.setInput('listenerLabel', '2 listeners');
    fixture.detectChanges();

    const tiles = fixture.nativeElement.querySelectorAll('.listener-tile');
    expect(tiles.length).toBe(2);
    expect(fixture.nativeElement.querySelector('#audienceEmpty')).toBeNull();

    const toggleBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector('#audienceToggle');
    toggleBtn?.click();
    fixture.detectChanges();
    expect(toggleBtn?.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.querySelector('#audienceList')).toBeNull();
  });
});
