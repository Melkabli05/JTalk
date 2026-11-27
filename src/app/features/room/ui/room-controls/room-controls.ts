import { BackendReaction, REACTION_CATALOG } from '../../../../shared/models/voice-room.model';
import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-room-controls',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatRippleModule, MatTooltipModule],
  templateUrl: './room-controls.html',
  styleUrl: './room-controls.scss',
})
export class RoomControls {
  readonly muted = input.required<boolean>();
  readonly handRaised = input.required<boolean>();

  readonly canEndRoom = input(false);
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
}
