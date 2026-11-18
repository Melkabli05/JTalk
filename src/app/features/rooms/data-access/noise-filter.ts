import type { LocalAudioTrack } from 'livekit-client';

export async function filterNoise(track: LocalAudioTrack): Promise<void> {
  try {
    const { isKrispNoiseFilterSupported, KrispNoiseFilter } =
      await import('@livekit/krisp-noise-filter');
    if (isKrispNoiseFilterSupported()) {
      await track.setProcessor(KrispNoiseFilter());
    }
  } catch {
    return;
  }
}
