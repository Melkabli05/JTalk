import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { RoomControls } from './room-controls';

describe('RoomControls', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoomControls],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('should emit toggleMute when on stage and toggleHand when audience can raise hand', () => {
    const fixture = TestBed.createComponent(RoomControls);
    fixture.componentRef.setInput('muted', false);
    fixture.componentRef.setInput('handRaised', false);
    fixture.componentRef.setInput('canUseMic', true);
    fixture.componentRef.setInput('canRaiseHand', true);
    const muteSpy = vi.fn();
    const handSpy = vi.fn();
    fixture.componentInstance.toggleMute.subscribe(muteSpy);
    fixture.componentInstance.toggleHand.subscribe(handSpy);
    fixture.detectChanges();

    const muteBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector('#muteBtn');
    const handBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector('#raiseHandBtn');
    muteBtn?.click();
    handBtn?.click();

    expect(muteSpy).toHaveBeenCalledTimes(1);
    expect(handSpy).toHaveBeenCalledTimes(1);
  });

  it('should display Enable audio and Join stage CTAs when soundBlocked and canClaimStageSeat are true', () => {
    const fixture = TestBed.createComponent(RoomControls);
    fixture.componentRef.setInput('muted', true);
    fixture.componentRef.setInput('handRaised', false);
    fixture.componentRef.setInput('canUseMic', false);
    fixture.componentRef.setInput('canClaimStageSeat', true);
    fixture.componentRef.setInput('soundBlocked', true);

    const claimSpy = vi.fn();
    const audioSpy = vi.fn();
    fixture.componentInstance.claimStageSeat.subscribe(claimSpy);
    fixture.componentInstance.enableAudio.subscribe(audioSpy);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#muteBtn')).toBeNull();
    const joinStageBtn: HTMLButtonElement | null =
      fixture.nativeElement.querySelector('#joinStageBtn');
    const enableAudioBtn: HTMLButtonElement | null =
      fixture.nativeElement.querySelector('#enableAudioBtn');

    expect(joinStageBtn).toBeTruthy();
    expect(enableAudioBtn).toBeTruthy();
    joinStageBtn?.click();
    enableAudioBtn?.click();
    expect(claimSpy).toHaveBeenCalledTimes(1);
    expect(audioSpy).toHaveBeenCalledTimes(1);
  });

  it('shows Muted by host when host-muted and Retry audio when audio failed', () => {
    const fixture = TestBed.createComponent(RoomControls);
    fixture.componentRef.setInput('muted', true);
    fixture.componentRef.setInput('handRaised', false);
    fixture.componentRef.setInput('canUseMic', false);
    fixture.componentRef.setInput('mutedByHost', true);
    fixture.componentRef.setInput('audioFailed', true);
    const retrySpy = vi.fn();
    fixture.componentInstance.reconnectAudio.subscribe(retrySpy);
    fixture.detectChanges();

    const hostMutedBtn = fixture.nativeElement.querySelector(
      '#hostMutedBtn',
    ) as HTMLButtonElement | null;
    expect(hostMutedBtn?.disabled).toBe(true);
    expect(hostMutedBtn?.textContent).toContain('Muted by host');

    const retryBtn = fixture.nativeElement.querySelector(
      '#retryAudioBtn',
    ) as HTMLButtonElement | null;
    expect(retryBtn).toBeTruthy();
    retryBtn?.click();
    expect(retrySpy).toHaveBeenCalledOnce();
  });

  it('activates animated Noto emoji on picker hover and shows a launch burst on pick', () => {
    const fixture = TestBed.createComponent(RoomControls);
    fixture.componentRef.setInput('muted', false);
    fixture.componentRef.setInput('handRaised', false);
    const pickedSpy = vi.fn();
    fixture.componentInstance.reactionPicked.subscribe(pickedSpy);
    fixture.detectChanges();

    fixture.componentInstance.setActivePickerReaction('FIRE');
    expect(fixture.componentInstance.activePickerReaction()).toBe('FIRE');

    const fireItem = fixture.componentInstance.reactionEmojis.find((item) => item.code === 'FIRE')!;
    fixture.componentInstance.onPickReaction(fireItem);
    fixture.detectChanges();

    expect(pickedSpy).toHaveBeenCalledWith('FIRE');
    expect(fixture.componentInstance.activePickerReaction()).toBeNull();
    const burst = fixture.nativeElement.querySelector('.ctrl-react-burst app-animated-emoji');
    expect(burst?.getAttribute('data-animated')).toBe('true');
    expect(burst?.querySelector('source')?.getAttribute('srcset')).toContain('/1f525/512.webp');
  });
});
