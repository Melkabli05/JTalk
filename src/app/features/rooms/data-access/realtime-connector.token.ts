import { InjectionToken } from '@angular/core';
import type { RealtimeConnector } from '../models/realtime.model';
import { connectLiveKit } from './adapters/livekit.adapter';

/** How the room's audio is connected. LiveKit in the app; a fake in specs. */
export const REALTIME_CONNECTOR = new InjectionToken<RealtimeConnector>('REALTIME_CONNECTOR', {
  providedIn: 'root',
  factory: () => connectLiveKit,
});
