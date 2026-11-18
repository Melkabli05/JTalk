import type { RealtimeConnection, RealtimeListener, RoomUpdate } from '../models/realtime.model';
import { filterNoise } from './noise-filter';
import { parseRoomEvent } from './parsers/room-event.parser';

export const ROOM_EVENTS_TOPIC = 'room-events';

function readRoomEvent(payload: Uint8Array): RoomUpdate | undefined {
  try {
    return parseRoomEvent(JSON.parse(new TextDecoder().decode(payload)));
  } catch {
    return undefined;
  }
}

export async function connectLiveKit(
  url: string,
  token: string,
  listener: RealtimeListener,
): Promise<RealtimeConnection> {
  const { Room, RoomEvent, Track } = await import('livekit-client');
  const room = new Room({ adaptiveStream: true, dynacast: true });

  const speakers = document.createElement('div');
  speakers.hidden = true;
  document.body.append(speakers);
  let closing = false;

  room
    .on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        speakers.append(track.attach());
      }
    })
    .on(RoomEvent.TrackUnsubscribed, (track) => {
      for (const element of track.detach()) {
        element.remove();
      }
    })
    .on(RoomEvent.ActiveSpeakersChanged, (active) => {
      listener.speakersChanged(active.map((participant) => participant.identity));
    })
    .on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
      if (participant === undefined && topic === ROOM_EVENTS_TOPIC) {
        const event = readRoomEvent(payload);
        if (event !== undefined) {
          listener.roomEvent(event);
        }
      }
    })
    .on(RoomEvent.LocalTrackPublished, (publication) => {
      const microphone = publication.audioTrack;
      if (publication.source === Track.Source.Microphone && microphone !== undefined) {
        void filterNoise(microphone);
      }
    })
    .on(RoomEvent.AudioPlaybackStatusChanged, (playing) => listener.soundBlocked(!playing))
    .on(RoomEvent.ParticipantPermissionsChanged, (_previous, participant) => {
      if (participant === room.localParticipant) {
        listener.canPublishChanged(participant.permissions?.canPublish ?? false);
      }
    })
    .on(RoomEvent.Reconnecting, () => listener.linkChanged(false))
    .on(RoomEvent.Reconnected, () => listener.linkChanged(true))
    .on(RoomEvent.Disconnected, () => {
      speakers.remove();
      if (!closing) {
        listener.connectionLost();
      }
    });

  try {
    await room.connect(url, token);
  } catch (error) {
    speakers.remove();
    throw error;
  }
  listener.soundBlocked(!room.canPlaybackAudio);

  return {
    setMicrophone: async (on) => {
      await room.localParticipant.setMicrophoneEnabled(on);
    },
    startSound: () => room.startAudio(),
    disconnect: async () => {
      closing = true;
      await room.disconnect();
    },
  };
}
