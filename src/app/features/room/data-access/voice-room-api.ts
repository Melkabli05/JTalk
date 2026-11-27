import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/http/api-base-url.token';
import type {
  AudiencePage,
  BackendReaction,
  ChatStateDto,
  NetworkMode,
  PostCommentPayload,
  RoomCommentDto,
  RoomSessionDto,
  RoomSnapshotDto,
} from '../../../shared/models/voice-room.model';

@Service()
export class VoiceRoomApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/v1/voice-rooms`;

  private url(roomId: string, path: string): string {
    return `${this.base}/${encodeURIComponent(roomId)}/${path}`;
  }

  private mutate<T>(
    method: 'POST' | 'PUT' | 'DELETE',
    roomId: string,
    path: string,
    body?: unknown,
  ): Observable<T> {
    return this.http.request<T>(method, this.url(roomId, path), body !== undefined ? { body } : {});
  }

  getSnapshot(roomId: string): Observable<RoomSnapshotDto> {
    return this.http.get<RoomSnapshotDto>(this.url(roomId, 'participants/snapshot'));
  }

  getAudience(roomId: string, cursor: string | null): Observable<AudiencePage> {
    return this.http.get<AudiencePage>(this.url(roomId, 'participants/audience'), {
      ...(cursor ? { params: { cursor } } : {}),
    });
  }

  getChatState(roomId: string): Observable<ChatStateDto> {
    return this.http.get<ChatStateDto>(this.url(roomId, 'comments'));
  }

  join(roomId: string): Observable<RoomSessionDto> {
    return this.mutate('POST', roomId, 'participants/join');
  }

  keepalive(roomId: string): Observable<void> {
    return this.mutate('POST', roomId, 'keepalive');
  }

  leave(roomId: string, successorUserId?: string | null): Observable<void> {
    return this.mutate(
      'POST',
      roomId,
      'participants/leave',
      successorUserId ? { successorUserId } : undefined,
    );
  }

  kickParticipant(roomId: string, targetUserId: string): Observable<void> {
    return this.mutate('DELETE', roomId, `participants/${encodeURIComponent(targetUserId)}`);
  }

  claimStageSeat(roomId: string): Observable<RoomSessionDto> {
    return this.mutate('POST', roomId, 'stage/join');
  }

  leaveStageSeat(roomId: string): Observable<void> {
    return this.mutate('POST', roomId, 'stage/leave');
  }

  raiseHand(roomId: string): Observable<void> {
    return this.mutate('POST', roomId, 'stage/raise-hand');
  }

  lowerHand(roomId: string): Observable<void> {
    return this.mutate('DELETE', roomId, 'stage/raise-hand');
  }

  promoteSpeaker(roomId: string, targetUserId: string): Observable<void> {
    return this.mutate('POST', roomId, `stage/promote/${encodeURIComponent(targetUserId)}`);
  }

  demoteSpeaker(roomId: string, targetUserId: string): Observable<void> {
    return this.mutate('POST', roomId, `stage/demote/${encodeURIComponent(targetUserId)}`);
  }

  grantModerator(roomId: string, targetUserId: string): Observable<void> {
    return this.mutate('POST', roomId, `moderators/${encodeURIComponent(targetUserId)}`);
  }

  revokeModerator(roomId: string, targetUserId: string): Observable<void> {
    return this.mutate('DELETE', roomId, `moderators/${encodeURIComponent(targetUserId)}`);
  }

  muteSpeaker(roomId: string, targetUserId: string): Observable<void> {
    return this.mutate('POST', roomId, `stage/mute/${encodeURIComponent(targetUserId)}`);
  }

  updateSelfMute(roomId: string, muted: boolean): Observable<void> {
    return this.mutate('PUT', roomId, 'stage/self-mute', { muted });
  }

  updateNetworkMode(
    roomId: string,
    mode: NetworkMode,
    secondaryTrackSidsToDrop: readonly string[],
    primaryTrackSidsToKeep: readonly string[],
  ): Observable<void> {
    return this.mutate('POST', roomId, 'stage/network-mode', {
      mode,
      secondaryTrackSidsToDrop,
      primaryTrackSidsToKeep,
    });
  }

  postComment(roomId: string, payload: PostCommentPayload): Observable<RoomCommentDto> {
    return this.mutate('POST', roomId, 'comments', payload);
  }

  deleteComment(roomId: string, commentId: string): Observable<void> {
    return this.mutate('DELETE', roomId, `comments/${encodeURIComponent(commentId)}`);
  }

  reactToComment(roomId: string, commentId: string, reaction: BackendReaction): Observable<void> {
    return this.mutate('PUT', roomId, `comments/${encodeURIComponent(commentId)}/reaction`, {
      reaction,
    });
  }

  removeCommentReaction(roomId: string, commentId: string): Observable<void> {
    return this.mutate('DELETE', roomId, `comments/${encodeURIComponent(commentId)}/reaction`);
  }

  muteChatUser(roomId: string, targetUserId: string): Observable<void> {
    return this.mutate('POST', roomId, `comments/mute/${encodeURIComponent(targetUserId)}`);
  }

  unmuteChatUser(roomId: string, targetUserId: string): Observable<void> {
    return this.mutate('DELETE', roomId, `comments/mute/${encodeURIComponent(targetUserId)}`);
  }

  pinTopic(roomId: string, text: string): Observable<void> {
    return this.mutate('PUT', roomId, 'comments/topic', { text });
  }

  clearTopic(roomId: string): Observable<void> {
    return this.mutate('DELETE', roomId, 'comments/topic');
  }

  pinComment(roomId: string, commentId: string): Observable<void> {
    return this.mutate('PUT', roomId, `comments/${encodeURIComponent(commentId)}/pin`, {});
  }

  unpinComment(roomId: string, commentId: string): Observable<void> {
    return this.mutate('DELETE', roomId, `comments/${encodeURIComponent(commentId)}/pin`);
  }

  transferHost(roomId: string, toUserId: string): Observable<void> {
    return this.mutate('POST', roomId, 'transfer-host', { toUserId });
  }

  sendReaction(roomId: string, reaction: BackendReaction): Observable<void> {
    return this.mutate('POST', roomId, 'reactions', { reaction });
  }
}
