import { HttpClient, HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { serverSentJson } from './server-sent-events';

describe('serverSentJson', () => {
  let http: HttpTestingController;
  const heard: unknown[] = [];

  beforeEach(() => {
    heard.length = 0;
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function connect() {
    const subscription = serverSentJson(TestBed.inject(HttpClient), '/events').subscribe((data) =>
      heard.push(data),
    );
    const request = http.expectOne('/events');
    let text = '';
    return {
      request,
      subscription,
      receive: (chunk: string) => {
        text += chunk;
        request.event({
          type: HttpEventType.DownloadProgress,
          loaded: text.length,
          partialText: text,
        });
      },
    };
  }

  it('asks for an event stream, and to be told as it arrives', () => {
    const { request, subscription } = connect();

    expect(request.request.headers.get('Accept')).toBe('text/event-stream');
    expect(request.request.reportDownloadProgress).toBe(true);
    subscription.unsubscribe();
  });

  it('emits the JSON of each message as it arrives, once', () => {
    const { receive, subscription } = connect();

    receive('data: {"n":1}\n\n');
    receive('data: {"n":2}\n\ndata: {"n":3}\n\n');

    expect(heard).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
    subscription.unsubscribe();
  });

  it('waits for a message to be complete', () => {
    const { receive, subscription } = connect();

    receive('data: {"n":');
    expect(heard).toEqual([]);
    receive('1}\n');
    expect(heard).toEqual([]);
    receive('\n');
    expect(heard).toEqual([{ n: 1 }]);
    subscription.unsubscribe();
  });

  it('skips keep-alives and lines that are not data', () => {
    const { receive, subscription } = connect();

    receive('event: ping\ndata: \n\n');
    receive(': a comment\n\n');
    receive('event: room\nid: 7\ndata: {"n":1}\n\n');

    expect(heard).toEqual([{ n: 1 }]);
    subscription.unsubscribe();
  });

  it('completes when the server ends the stream, and fails when the connection does', () => {
    const done = vi.fn();
    const failed = vi.fn();
    serverSentJson(TestBed.inject(HttpClient), '/events').subscribe({ complete: done });
    http.expectOne('/events').flush('');
    expect(done).toHaveBeenCalledOnce();

    serverSentJson(TestBed.inject(HttpClient), '/events').subscribe({ error: failed });
    http.expectOne('/events').flush('no', { status: 503, statusText: 'Unavailable' });
    expect(failed).toHaveBeenCalledOnce();
  });

  it('starts from the beginning each time it is subscribed', () => {
    const stream = serverSentJson(TestBed.inject(HttpClient), '/events');
    const first = stream.subscribe();
    http.expectOne('/events').event({
      type: HttpEventType.DownloadProgress,
      loaded: 14,
      partialText: 'data: {"n":1}\n\n',
    });
    first.unsubscribe();

    stream.subscribe((data) => heard.push(data));
    http.expectOne('/events').event({
      type: HttpEventType.DownloadProgress,
      loaded: 14,
      partialText: 'data: {"n":2}\n\n',
    });

    expect(heard).toEqual([{ n: 2 }]);
  });
});
