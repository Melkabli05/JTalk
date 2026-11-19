import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChatApiService } from './chat-api.service';

const BASE = '/api/v1/voice-rooms/r-1/comments';
const comment = {
  id: 'c-1',
  authorId: 'u-1',
  type: 'TEXT',
  content: 'Hola',
  createdAt: '2026-11-19T10:00:00Z',
};

describe('ChatApiService', () => {
  let http: HttpTestingController;
  let api: ChatApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(ChatApiService);
  });
  afterEach(() => http.verify());

  it('reads the chat only once there is a room to read it from', async () => {
    const id = signal('');
    const chat = TestBed.runInInjectionContext(() => api.chatResource(id));
    TestBed.tick();
    http.expectNone(BASE);

    id.set('r-1');
    TestBed.tick();
    http.expectOne(BASE).flush({ comments: [comment], topic: null, muted: false, mutedUsers: [] });
    await TestBed.inject(ApplicationRef).whenStable();

    expect(chat.value()?.comments[0].content).toBe('Hola');
  });

  it('posts a comment and returns it as the server kept it', () => {
    let posted: string | undefined;

    api.post('r-1', { type: 'TEXT', content: 'Hola' }).subscribe((c) => (posted = c.id));
    const request = http.expectOne({ method: 'POST', url: BASE });
    expect(request.request.body).toEqual({ type: 'TEXT', content: 'Hola' });
    request.flush(comment);

    expect(posted).toBe('c-1');
  });

  it('deletes a comment, mutes and unmutes a person, and pins and clears the topic', () => {
    api.remove('r-1', 'c-1').subscribe();
    http.expectOne({ method: 'DELETE', url: `${BASE}/c-1` }).flush(null);

    api.mute('r-1', 'u-2').subscribe();
    http.expectOne({ method: 'POST', url: `${BASE}/mute/u-2` }).flush(null);

    api.unmute('r-1', 'u-2').subscribe();
    http.expectOne({ method: 'DELETE', url: `${BASE}/mute/u-2` }).flush(null);

    api.pinTopic('r-1', 'Weekend').subscribe();
    const pin = http.expectOne({ method: 'PUT', url: `${BASE}/topic` });
    expect(pin.request.body).toEqual({ text: 'Weekend' });
    pin.flush(null);

    api.clearTopic('r-1').subscribe();
    http.expectOne({ method: 'DELETE', url: `${BASE}/topic` }).flush(null);
  });
});
