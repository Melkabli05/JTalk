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

  it('renders animated Noto Emoji for live stage reactions and speaker reaction badges', () => {
    const fixture = TestBed.createComponent(RoomStage);
    fixture.componentRef.setInput('speakers', sampleSpeakers);
    fixture.componentRef.setInput('maxSeats', 8);
    fixture.componentRef.setInput('stageReactions', [
      { id: 1, userId: 'elena', emoji: '❤️', reactorName: 'Elena', count: 2, lane: 0 },
    ]);
    fixture.componentRef.setInput('speakerReactions', new Map([['elena', '❤️']]));
    fixture.detectChanges();

    const stageEmoji = fixture.nativeElement.querySelector('.stage-reaction-emoji app-animated-emoji');
    const badgeEmoji = fixture.nativeElement.querySelector('.speaker-badge-reaction app-animated-emoji');
    expect(stageEmoji?.getAttribute('data-animated')).toBe('true');
    expect(stageEmoji?.querySelector('source')?.getAttribute('srcset')).toContain('/2764_fe0f/512.webp');
    expect(badgeEmoji?.getAttribute('data-animated')).toBe('true');
    expect(badgeEmoji?.querySelector('source')?.getAttribute('srcset')).toContain('/2764_fe0f/512.webp');
  });

  it('distinguishes host-muted speakers, toggles mute/unmute mic and chat, and respects moderator hierarchy', () => {
    const fixture = TestBed.createComponent(RoomStage);
    const speakers: readonly RoomSpeaker[] = [
      {
        ...sampleSpeakers[0]!,
        id: 'host-1',
        isYou: false,
        role: 'host',
        muted: false,
      },
      {
        ...sampleSpeakers[1]!,
        id: 'mod-you',
        name: 'Mod',
        isYou: true,
        role: 'speaker',
        muted: false,
        speaking: false,
      },
      {
        id: 'sp-2',
        name: 'Tariq',
        initial: 'T',
        chipClass: 'avatar-chip-blue',
        role: 'speaker',
        muted: true,
        muteReason: 'host',
        speaking: false,
      },
    ];
    fixture.componentRef.setInput('speakers', speakers);
    fixture.componentRef.setInput('maxSeats', 8);
    fixture.componentRef.setInput('isHost', false);
    fixture.componentRef.setInput('canModerate', true);
    fixture.componentRef.setInput('hostId', 'host-1');
    fixture.componentRef.setInput('moderatorIds', new Set(['mod-you']));
    fixture.componentRef.setInput('chatMutedUsers', new Set(['sp-2']));
    fixture.detectChanges();

    const hostMutedBadge = fixture.nativeElement.querySelector(
      '[data-speaker-id="sp-2"] .speaker-badge-mic',
    ) as HTMLElement | null;
    expect(hostMutedBadge?.classList.contains('is-host-muted')).toBe(true);
    expect(hostMutedBadge?.getAttribute('title')).toBe('Muted by host');
    expect(
      fixture.nativeElement
        .querySelector('[data-speaker-id="sp-2"]')
        ?.getAttribute('aria-label'),
    ).toContain('muted by host');

    // Moderator can moderate regular speaker, cannot moderate host, and cannot transfer host
    expect(fixture.componentInstance.canModerateTarget(speakers[0]!)).toBe(false);
    expect(fixture.componentInstance.canModerateTarget(speakers[2]!)).toBe(true);
    expect(fixture.componentInstance.canTransferHost(speakers[2]!)).toBe(false);
    expect(fixture.componentInstance.isHostMuted(speakers[2]!)).toBe(true);

    const actionSpy = vi.fn();
    fixture.componentInstance.speakerAction.subscribe(actionSpy);
    const tariqTile = fixture.nativeElement.querySelector(
      '[data-speaker-id="sp-2"]',
    ) as HTMLButtonElement;
    tariqTile.click();
    fixture.detectChanges();

    const menuButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-panel button[mat-menu-item]'),
    );
    const unmuteBtn = menuButtons.find((b) => b.textContent?.includes('Unmute speaker'));
    const unmuteChatBtn = menuButtons.find((b) => b.textContent?.includes('Unmute in chat'));
    expect(unmuteBtn).toBeTruthy();
    expect(unmuteChatBtn).toBeTruthy();

    unmuteBtn?.click();
    expect(actionSpy).toHaveBeenCalledWith({ action: 'unmute', speaker: speakers[2] });
  });
});

