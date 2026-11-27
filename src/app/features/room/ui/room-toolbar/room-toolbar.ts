import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { ToolbarPendingRequest } from '../../models/live-room.model';
import type {
  AudioDeviceOption,
  LiveKitConnectionStatus,
  NoiseIsolationMode,
} from '../../models/livekit.model';

@Component({
  selector: 'app-room-toolbar',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  templateUrl: './room-toolbar.html',
  styleUrl: './room-toolbar.scss',
})
export class RoomToolbar {
  readonly roomTitle = input('Live room');
  readonly roomTopic = input('');
  readonly practiseLang = input('English');
  readonly hostName = input('Host');
  readonly peopleCount = input(1);
  readonly handCount = input(0);

  readonly isHost = input(false);
  readonly canModerate = input(false);
  readonly pendingRequests = input<readonly ToolbarPendingRequest[]>([]);

  readonly audioStatus = input<LiveKitConnectionStatus>('idle');
  readonly noiseIsolationEnabled = input(true);
  readonly noiseIsolationMode = input<NoiseIsolationMode>('webrtc-fallback');
  readonly audioInputDevices = input<readonly AudioDeviceOption[]>([]);
  readonly selectedAudioInputId = input<string | null>(null);

  readonly backToRooms = output<void>();
  readonly copyRoomLink = output<void>();
  readonly findPeople = output<void>();
  readonly openEditRoom = output<void>();
  readonly openEndRoom = output<void>();
  readonly approveRequest = output<string>();
  readonly toggleNoiseIsolation = output<void>();
  readonly selectAudioDevice = output<string>();
  readonly refreshAudioDevices = output<void>();
  readonly reconnectAudio = output<void>();

  readonly audioStatusLabel = computed(() => {
    switch (this.audioStatus()) {
      case 'connected':
        return 'Audio connected';
      case 'connecting':
        return 'Connecting audio…';
      case 'reconnecting':
        return 'Reconnecting audio…';
      case 'failed':
        return 'Audio disconnected';
      default:
        return 'Audio idle';
    }
  });

  readonly noiseIsolationLabel = computed(() => {
    switch (this.noiseIsolationMode()) {
      case 'krisp-active':
        return 'Noise isolation: On';
      case 'krisp-bypassed':
        return 'Noise isolation: Off';
      case 'webrtc-fallback':
        return 'Noise reduction: Standard';
      default:
        return 'Noise isolation unavailable';
    }
  });
}
