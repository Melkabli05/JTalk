import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { LiveRoomCard } from '../../models/room-card.model';
import { RoomCard } from './room-card';

describe('RoomCard', () => {
  const sampleRoom: LiveRoomCard = {
    id: 'r1',
    lang: 'fr',
    langLabel: 'French',
    dotClass: 'dot-nb-error',
    title: 'Coffee in Paris',
    description: 'Relaxed everyday conversation.',
    avatars: [{ userId: 'speaker', initial: 'S', chipClass: 'chip-a' }],
    moreCount: '+4',
    meta: '5 talking · 12 listening',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoomCard],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('should render room info and emit join when Join room is clicked', () => {
    const fixture = TestBed.createComponent(RoomCard);
    fixture.componentRef.setInput('room', sampleRoom);
    const spy = vi.fn();
    fixture.componentInstance.join.subscribe(spy);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Coffee in Paris');
    const joinBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector('.join-btn');
    joinBtn?.click();
    expect(spy).toHaveBeenCalledWith(sampleRoom);
  });
});
