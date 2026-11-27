import { InjectionToken } from '@angular/core';
import { defaultLiveKitConnector } from '../data-access/livekit-connector';
import type { LiveKitConnectorFn } from '../models/livekit.model';

export const LIVEKIT_CONNECTOR = new InjectionToken<LiveKitConnectorFn>('LIVEKIT_CONNECTOR', {
  providedIn: 'root',
  factory: () => defaultLiveKitConnector,
});
