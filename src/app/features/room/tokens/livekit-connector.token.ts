import { InjectionToken } from '@angular/core';
import { defaultLiveKitConnector, type LiveKitConnectorFn } from '../data-access/livekit-connector';

export const LIVEKIT_CONNECTOR = new InjectionToken<LiveKitConnectorFn>('LIVEKIT_CONNECTOR', {
  providedIn: 'root',
  factory: () => defaultLiveKitConnector,
});
