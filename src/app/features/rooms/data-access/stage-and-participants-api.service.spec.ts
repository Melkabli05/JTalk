import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Observable } from 'rxjs';
import { ParticipantsApiService } from './participants-api.service';
import { StageApiService } from './stage-api.service';

describe('the stage and participants services', () => {
  let http: HttpTestingController;
  let stage: StageApiService;
  let participants: ParticipantsApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    stage = TestBed.inject(StageApiService);
    participants = TestBed.inject(ParticipantsApiService);
  });
  afterEach(() => http.verify());

  const base = '/api/v1/voice-rooms/r-1';

  it.each<
    [string, string, string, (s: StageApiService, p: ParticipantsApiService) => Observable<unknown>]
  >([
    ['takes a seat', 'POST', `${base}/stage/join`, (s) => s.takeSeat('r-1')],
    ['leaves a seat', 'POST', `${base}/stage/leave`, (s) => s.leaveSeat('r-1')],
    ['raises a hand', 'POST', `${base}/stage/raise-hand`, (s) => s.raiseHand('r-1')],
    ['lowers a hand', 'DELETE', `${base}/stage/raise-hand`, (s) => s.lowerHand('r-1')],
    ['promotes someone', 'POST', `${base}/stage/promote/u-9`, (s) => s.promote('r-1', 'u-9')],
    ['demotes someone', 'POST', `${base}/stage/demote/u-9`, (s) => s.demote('r-1', 'u-9')],
    ['leaves the room', 'POST', `${base}/participants/leave`, (_s, p) => p.leave('r-1')],
    ['sends a heartbeat', 'POST', `${base}/participants/heartbeat`, (_s, p) => p.heartbeat('r-1')],
    ['removes someone', 'DELETE', `${base}/participants/u-9`, (_s, p) => p.remove('r-1', 'u-9')],
  ])('%s with %s %s', (_name, method, url, call) => {
    call(stage, participants).subscribe();

    const request = http.expectOne(url);
    expect(request.request.method).toBe(method);
    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('joins a room and reads the session', () => {
    let joined: string | undefined;

    participants.join('r-1').subscribe((session) => (joined = session.room.id));
    http.expectOne(`${base}/participants/join`).flush({
      room: {
        id: 'r-1',
        title: 'T',
        topic: null,
        hostId: 'h',
        targetLanguage: 'es',
        nativeLanguage: 'en',
        maxStageSeats: 4,
        createdAt: '2026-11-14T10:00:00Z',
        speakers: [],
        participantCount: 0,
        handRaiseCount: 0,
      },
      canPublishAudio: false,
      liveKitToken: 'x',
      liveKitUrl: 'wss://livekit.test',
    });

    expect(joined).toBe('r-1');
  });

  it('loads the stage and the people in the room', async () => {
    const stageResource = TestBed.runInInjectionContext(() => stage.stageResource(() => 'r-1'));
    const people = TestBed.runInInjectionContext(() =>
      participants.participantsResource(() => 'r-1'),
    );
    TestBed.tick();
    http.expectOne(`${base}/stage`).flush({ speakers: ['a'], handRaiseQueue: ['b'] });
    http.expectOne(`${base}/participants`).flush([{ userId: 'a', role: 'HOST', status: 'ACTIVE' }]);
    await TestBed.inject(ApplicationRef).whenStable();

    expect(stageResource.value()?.handRaiseQueue).toEqual(['b']);
    expect(people.value()?.[0].userId).toBe('a');
  });
});
