import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RoomSpeaker } from '../../models/live-room.model';
import { RoomStage } from './room-stage';

describe('RoomStage', () => {
  const sampleSpeakers: readonly RoomSpeaker[] = [
    {
      id: 'host-you',
      name: 'Jilali',
      initial: 'J',
      chipClass: 'speaker-avatar-host',
      role: 'host',
      isYou: true,
      muted: true,
      speaking: false,
    },
    {
      id: 'elena',
      name: 'Elena',
      initial: 'E',
      chipClass: 'avatar-chip-lav',
      role: 'speaker',
      muted: false,
      speaking: true,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoomStage],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('should render speaker tiles, speaking state, muted state, and open seat', () => {
    const fixture = TestBed.createComponent(RoomStage);
    fixture.componentRef.setInput('speakers', sampleSpeakers);
    fixture.componentRef.setInput('maxSeats', 8);
    fixture.componentRef.setInput('hasOpenSeat', true);
    fixture.detectChanges();

    const tiles: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll(
      '.speaker-tile:not(.speaker-tile-open)',
    );
    expect(tiles.length).toBe(2);
    expect(tiles[0]?.classList.contains('is-muted')).toBe(true);
    expect(tiles[1]?.classList.contains('is-speaking')).toBe(true);
    const claim = vi.fn();
    fixture.componentInstance.claimSeat.subscribe(claim);
    fixture.nativeElement.querySelector('#openSeatButton').click();
    expect(claim).toHaveBeenCalledOnce();
  });

  it('renders the full server roster when the stage has no open seat', () => {
    const eightSpeakers: RoomSpeaker[] = Array.from({ length: 8 }, (_, idx) => ({
      id: `sp-${idx}`,
      name: `Speaker ${idx + 1}`,
      initial: `${idx + 1}`,
      chipClass: 'avatar-chip-blue',
      role: idx === 0 ? 'host' : 'speaker',
      muted: false,
      speaking: idx === 0,
    }));

    const fixture = TestBed.createComponent(RoomStage);
    fixture.componentRef.setInput('speakers', eightSpeakers);
    fixture.componentRef.setInput('maxSeats', 8);
    fixture.detectChanges();

    const tiles = fixture.nativeElement.querySelectorAll('.speaker-tile:not(.speaker-tile-open)');
    expect(tiles.length).toBe(8);
    expect(fixture.nativeElement.querySelector('#openSeatButton')).toBeNull();
    expect(fixture.componentInstance.stageColumns()).toBe(4);
  });

  it('renders reconnecting state on speakers and hides self-mute when canUseMic is false', () => {
    const fixture = TestBed.createComponent(RoomStage);
    fixture.componentRef.setInput('speakers', [
      { ...sampleSpeakers[0]!, reconnecting: false },
      { ...sampleSpeakers[1]!, reconnecting: true },
    ]);
    fixture.componentRef.setInput('maxSeats', 8);
    fixture.componentRef.setInput('canUseMic', false);
    fixture.detectChanges();

    const reconnectingTile = fixture.nativeElement.querySelector(
      '[data-speaker-id="elena"]',
    ) as HTMLButtonElement | null;
    expect(reconnectingTile?.classList.contains('is-reconnecting')).toBe(true);
    expect(reconnectingTile?.textContent).toContain('Reconnecting');
    expect(fixture.componentInstance.canMuteSpeaker(sampleSpeakers[0]!)).toBe(false);
  });
});
