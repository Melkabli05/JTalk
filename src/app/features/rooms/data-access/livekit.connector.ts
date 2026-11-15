import type { RealtimeConnection, RealtimeListener } from '../models/realtime.model';

export const ROOM_EVENTS_TOPIC = 'room-events';

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
    .on(RoomEvent.DataReceived, (_payload, participant, _kind, topic) => {
      if (participant === undefined && topic === ROOM_EVENTS_TOPIC) {
        listener.roomEvent();
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
