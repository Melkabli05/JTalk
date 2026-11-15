import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RoomsStore } from './rooms.store';

const room = (id: string, targetLanguage: string) => ({
  id,
  title: id,
  topic: '',
  hostId: 'h-1',
  targetLanguage,
  nativeLanguage: 'en',
  maxStageSeats: 4,
  createdAt: '2026-11-14T10:00:00Z',
  speakers: ['h-1'],
  participantCount: 1,
  handRaiseCount: 0,
});

describe('RoomsStore', () => {
  function setup() {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return { store: TestBed.inject(RoomsStore), http: TestBed.inject(HttpTestingController) };
  }

  async function listed(rooms: object[]) {
    const { store, http } = setup();
    TestBed.tick();
    http
      .expectOne((request) => request.url.startsWith('/api/v1/voice-rooms'))
      .flush({ content: rooms });
    await Promise.resolve();
    TestBed.tick();
    return { store, http };
  }

  it('lists nothing until the server has answered', () => {
    const { store } = setup();

    expect(store.shown()).toEqual([]);
    expect(store.languages()).toEqual([]);
  });

  it('shows every open room, and the languages they practise once each', async () => {
    const { store } = await listed([room('a', 'es'), room('b', 'fr'), room('c', 'es')]);

    expect(store.shown().map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(store.languages()).toEqual(['es', 'fr']);
  });

  it('narrows the list to one language, and back', async () => {
    const { store } = await listed([room('a', 'es'), room('b', 'fr'), room('c', 'es')]);

    store.setFilter('es');
    expect(store.filter()).toBe('es');
    expect(store.shown().map((r) => r.id)).toEqual(['a', 'c']);

    store.setFilter('');
    expect(store.shown()).toHaveLength(3);
  });

  it('asks the server again on reload', async () => {
    const { store, http } = await listed([room('a', 'es')]);

    store.reload();
    TestBed.tick();

    http.expectOne((request) => request.url.startsWith('/api/v1/voice-rooms'));
  });
});
