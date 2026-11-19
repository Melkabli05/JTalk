import { HttpClient, httpResource, HttpResourceRef } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { API_BASE_URL } from '@core/http/api-base-url.token';
import type { ChatState, CommentDraft, RoomComment } from '../models/chat.model';
import type { Reaction } from '../models/reaction.model';
import { parseChatState, parseComment } from './parsers/chat.parser';

@Service()
export class ChatApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/v1/voice-rooms`;

  chatResource(id: () => string): HttpResourceRef<ChatState | undefined> {
    return httpResource(() => (id() ? `${this.base}/${id()}/comments` : undefined), {
      parse: parseChatState,
    });
  }

  post(id: string, draft: CommentDraft): Observable<RoomComment> {
    return this.http.post<unknown>(`${this.base}/${id}/comments`, draft).pipe(map(parseComment));
  }

  remove(id: string, commentId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/comments/${commentId}`);
  }

  react(id: string, commentId: string, reaction: Reaction): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/comments/${commentId}/reaction`, { reaction });
  }

  unreact(id: string, commentId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/comments/${commentId}/reaction`);
  }

  mute(id: string, userId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/comments/mute/${userId}`, null);
  }

  unmute(id: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/comments/mute/${userId}`);
  }

  pinTopic(id: string, text: string): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/comments/topic`, { text });
  }

  clearTopic(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/comments/topic`);
  }

  pinComment(id: string, commentId: string): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/comments/${commentId}/pin`, {});
  }

  unpinComment(id: string, commentId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/comments/${commentId}/pin`);
  }
}
