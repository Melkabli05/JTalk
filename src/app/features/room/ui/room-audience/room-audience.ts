import { Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RoomListener } from '../../models/live-room.model';

export type ListenerMenuAction = 'stage' | 'approve' | 'profile' | 'remove';

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
  readonly hasAudience = computed(() => this.listeners().length > 0 || this.hasMore());

  readonly loadMore = output<void>();
  readonly listenerAction = output<{
    action: ListenerMenuAction;
    listener: RoomListener;
  }>();

  listenerAriaLabel(listener: RoomListener): string {
    const state = listener.handRaised ? 'hand raised' : 'listening';
    return `${listener.name}, ${state}. Open listener actions`;
  }
}
