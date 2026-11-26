import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { VoiceRoomDto } from '../../../../shared/models/voice-room.model';
import { RoomCard } from './room-card';

describe('RoomCard', () => {
  const sampleRoom: VoiceRoomDto = {
    id: 'r1',
    hostId: 'host',
    targetLanguage: 'fr',
    nativeLanguage: 'en',
    title: 'Coffee in Paris',
    topic: 'Relaxed everyday conversation.',
    maxStageSeats: 8,
    speakers: ['host', 'speaker'],
    participantCount: 6,
    handRaiseCount: 0,
    host: { id: 'host', displayName: 'Camille', username: 'camille', avatarUrl: null },
    speakerProfiles: [
      { id: 'host', displayName: 'Camille', username: 'camille', avatarUrl: null },
      { id: 'speaker', displayName: 'Nadia', username: 'nadia', avatarUrl: '/avatars/nadia.jpg' },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoomCard],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('should render room info, embedded host/speaker avatars, and emit join when Join room is clicked', () => {
    const fixture = TestBed.createComponent(RoomCard);
    fixture.componentRef.setInput('room', sampleRoom);
    const spy = vi.fn();
    fixture.componentInstance.join.subscribe(spy);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Coffee in Paris');
    expect(fixture.nativeElement.textContent).toContain('2 speaking · 6 participants · 8 seats');
    expect(fixture.componentInstance.hostAvatar()?.displayName).toBe('Camille');
    expect(fixture.componentInstance.avatars().map((a) => a.displayName)).toEqual(['Nadia']);
    expect(fixture.nativeElement.querySelector('img[alt="Nadia"]')).toBeTruthy();

    const joinBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector('.join-btn');
    joinBtn?.click();
    expect(spy).toHaveBeenCalledWith(sampleRoom);
  });
});
