import { Component, computed, ElementRef, input, output, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import type {
  DiscussionMessage,
  RoomSpeaker,
  SpeakerMenuAction,
} from '../../models/live-room.model';

@Component({
  selector: 'app-room-stage',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatRippleModule],
  templateUrl: './room-stage.html',
  styleUrl: './room-stage.scss',
})
export class RoomStage {
  private readonly stageSectionRef = viewChild<ElementRef<HTMLElement>>('stageSection');

  readonly speakers = input.required<readonly RoomSpeaker[]>();
  readonly maxSeats = input.required<number>();
  readonly stageReaction = input<string | null>(null);
  readonly stageReactionKey = input(0);

  readonly isHost = input(false);
  readonly hasOpenSeat = input(false);
  readonly pinnedMessage = input<DiscussionMessage | null>(null);

  readonly speakerAction = output<{ action: SpeakerMenuAction; speaker: RoomSpeaker }>();
  readonly endRoom = output<void>();
  readonly claimSeat = output<void>();
  readonly unpinMessage = output<void>();

  readonly stageColumns = computed<2 | 3 | 4>(() => {
    const slots = this.speakers().length + (this.hasOpenSeat() ? 1 : 0);
    return slots <= 2 ? 2 : slots === 3 ? 3 : 4;
  });

  canModerateTarget(speaker: RoomSpeaker): boolean {
    return this.isHost() && !speaker.isYou && speaker.role !== 'host';
  }

  canMuteSpeaker(speaker: RoomSpeaker): boolean {
    return Boolean(speaker.isYou) || this.canModerateTarget(speaker);
  }

  canLeaveOwnStage(speaker: RoomSpeaker): boolean {
    return Boolean(speaker.isYou) && speaker.role !== 'host';
  }

  speakerRoleLabel(speaker: RoomSpeaker): string {
    if (speaker.role === 'host') return 'Host';
    return speaker.isYou ? 'You' : '';
  }

  speakerAriaLabel(speaker: RoomSpeaker): string {
    const role = speaker.role === 'host' ? 'Host' : 'Speaker';
    const state = speaker.muted ? 'muted' : speaker.speaking ? 'speaking' : 'microphone on';
    return `${speaker.name}, ${role}, ${state}. Open speaker options`;
  }

  focusStage(): void {
    this.stageSectionRef()?.nativeElement.focus({ preventScroll: true });
  }
}
