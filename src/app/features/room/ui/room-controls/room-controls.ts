import {
  BackendReaction,
  REACTION_CATALOG,
  type ReactionPresentation,
} from '../../../../shared/models/voice-room.model';
import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AnimatedEmoji } from '../../../../shared/ui/animated-emoji/animated-emoji';
import {
  preloadNotoReactionAnimations,
  ROOM_REACTION_LAUNCH_MS,
} from '../../../../shared/utils/noto-emoji.utils';

interface ReactionLaunchBurst {
  readonly id: number;
  readonly code: BackendReaction;
  readonly emoji: string;
}

@Component({
  selector: 'app-room-controls',
  imports: [
    AnimatedEmoji,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatRippleModule,
    MatTooltipModule,
  ],
  templateUrl: './room-controls.html',
  styleUrl: './room-controls.scss',
})
export class RoomControls {
  private readonly destroyRef = inject(DestroyRef);
  private launchBurstTimer: ReturnType<typeof setTimeout> | null = null;
  private launchBurstSeq = 0;

  readonly muted = input.required<boolean>();
  readonly handRaised = input.required<boolean>();

  readonly canEndRoom = input(false);
  readonly canLeaveQuietly = input(true);
  readonly hasOtherParticipants = input(true);
  readonly canLeaveStage = input(false);
  readonly canUseMic = input(false);
  readonly mutedByHost = input(false);
  readonly canRaiseHand = input(false);
  readonly canClaimStageSeat = input(false);
  readonly claimingSeat = input(false);
  readonly togglingHand = input(false);
  readonly soundBlocked = input(false);
  readonly audioFailed = input(false);
  readonly reconnectingAudio = input(false);
  readonly micError = input<string | null>(null);

  readonly reactionPicked = output<BackendReaction>();
  readonly toggleHand = output<void>();
  readonly claimStageSeat = output<void>();
  readonly toggleMute = output<void>();
  readonly enableAudio = output<void>();
  readonly reconnectAudio = output<void>();
  readonly leaveQuietly = output<void>();
  readonly leaveStage = output<void>();
  readonly openEndRoom = output<void>();

  readonly reactionEmojis = REACTION_CATALOG;
  readonly activePickerReaction = signal<BackendReaction | null>(null);
  readonly launchBurst = signal<ReactionLaunchBurst | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.launchBurstTimer !== null) {
        clearTimeout(this.launchBurstTimer);
        this.launchBurstTimer = null;
      }
    });
  }

  onReactionMenuOpened(): void {
    preloadNotoReactionAnimations();
  }

  setActivePickerReaction(code: BackendReaction): void {
    this.activePickerReaction.set(code);
  }

  clearActivePickerReaction(code?: BackendReaction): void {
    if (code === undefined || this.activePickerReaction() === code) {
      this.activePickerReaction.set(null);
    }
  }

  onPickReaction(item: ReactionPresentation): void {
    this.activePickerReaction.set(null);
    this.triggerLaunchBurst(item);
    this.reactionPicked.emit(item.code);
  }

  private triggerLaunchBurst(item: ReactionPresentation): void {
    if (this.launchBurstTimer !== null) {
      clearTimeout(this.launchBurstTimer);
    }
    const id = ++this.launchBurstSeq;
    this.launchBurst.set({ id, code: item.code, emoji: item.emoji });
    this.launchBurstTimer = setTimeout(() => {
      this.launchBurstTimer = null;
      if (this.launchBurst()?.id === id) {
        this.launchBurst.set(null);
      }
    }, ROOM_REACTION_LAUNCH_MS);
  }

  onEmojiRowKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const row = event.currentTarget as HTMLElement;
    const items = Array.from(row.querySelectorAll<HTMLButtonElement>('[mat-menu-item]'));
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1 || items.length === 0) return;

    event.preventDefault();
    event.stopPropagation();
    const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }
}
