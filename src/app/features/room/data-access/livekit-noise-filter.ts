import type { LocalAudioTrack } from 'livekit-client';
import type { KrispFilterController, NoiseIsolationMode } from '../models/livekit.model';

/**
 * Attaches LiveKit's official `@livekit/krisp-noise-filter` processor to a published
 * microphone `LocalAudioTrack`.
 *
 * When the browser or LiveKit environment does not support Krisp WASM audio processing,
 * or if attachment fails at runtime, this gracefully falls back to standard WebRTC
 * Audio Processing Module defaults (`echoCancellation`, `noiseSuppression`, `autoGainControl`)
 * already enabled on the LiveKit Room's `audioCaptureDefaults`.
 */
export async function attachKrispNoiseIsolation(
  track: LocalAudioTrack,
  initialEnabled = true,
): Promise<KrispFilterController> {
  try {
    const { isKrispNoiseFilterSupported, KrispNoiseFilter } =
      await import('@livekit/krisp-noise-filter');

    if (!isKrispNoiseFilterSupported()) {
      return createFallbackController('webrtc-fallback');
    }

    const processor = KrispNoiseFilter();
    await track.setProcessor(processor);
    const setMode = async (enabled: boolean): Promise<NoiseIsolationMode> => {
      await processor.setEnabled(enabled);
      return processor.isEnabled()
        ? 'krisp-active'
        : enabled
          ? 'webrtc-fallback'
          : 'krisp-bypassed';
    };
    let currentMode = await setMode(initialEnabled);

    return {
      get mode(): NoiseIsolationMode {
        return currentMode;
      },
      async setEnabled(enabled: boolean): Promise<NoiseIsolationMode> {
        try {
          currentMode = await setMode(enabled);
        } catch {
          currentMode = 'webrtc-fallback';
        }
        return currentMode;
      },
      async dispose(): Promise<void> {
        try {
          await track.stopProcessor();
        } catch {
          // Track may already be stopped/unpublished
        }
      },
    };
  } catch {
    try {
      await track.stopProcessor();
    } catch {
      // Ignore cleanup errors when processor attachment failed
    }
    return createFallbackController('webrtc-fallback');
  }
}

function createFallbackController(mode: NoiseIsolationMode): KrispFilterController {
  return {
    mode,
    async setEnabled(): Promise<NoiseIsolationMode> {
      return mode;
    },
    async dispose(): Promise<void> {
      // No external processor to stop
    },
  };
}
