import { InjectionToken } from '@angular/core';
import type { RealtimeConnector } from '../models/realtime.model';
import { connectLiveKit } from './livekit.connector';

export const REALTIME_CONNECTOR = new InjectionToken<RealtimeConnector>('REALTIME_CONNECTOR', {
  providedIn: 'root',
  factory: () => connectLiveKit,
});
