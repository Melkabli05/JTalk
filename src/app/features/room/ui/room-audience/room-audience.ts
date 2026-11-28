import { Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { ListenerMenuAction, RoomListener } from '../../models/live-room.model';
import { canModerateTargetUser } from '../../utils/room-moderation.utils';

@Component({
  selector: 'app-room-audience',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatRippleModule, MatTooltipModule],
  templateUrl: './room-audience.html',
  styleUrl: './room-audience.scss',
})
export class RoomAudience {
  readonly listeners = input.required<readonly RoomListener[]>();
  readonly audienceVisible = signal(true);
  readonly listenerLabel = input.required<string>();
  readonly hasMore = input(false);
  readonly loading = input(false);
  readonly isHost = input(false);
  readonly canModerate = input(false);
  readonly hostId = input<string | null>(null);
  readonly moderatorIds = input<ReadonlySet<string>>(new Set());
  readonly chatMutedUsers = input<ReadonlySet<string>>(new Set());
  readonly effectiveCanModerate = computed(() => this.isHost() || this.canModerate());
  readonly hasAudience = computed(() => this.listeners().length > 0 || this.hasMore());

  readonly loadMore = output<void>();
  readonly listenerAction = output<{
    action: ListenerMenuAction;
    listener: RoomListener;
  }>();

  canModerateTarget(listener: RoomListener): boolean {
    return canModerateTargetUser({
      isHost: this.isHost(),
      isModerator: this.canModerate() && !this.isHost(),
      currentUserId: '',
      hostId: this.hostId(),
      moderatorIds: this.moderatorIds(),
      targetUserId: listener.id,
    });
  }

  listenerAriaLabel(listener: RoomListener): string {
    const state = listener.handRaised ? 'hand raised' : 'listening';
    return `${listener.name}, ${state}. Open listener actions`;
  }
}
