import { HttpEventType } from '@angular/common/http';
import type { HttpTestingController } from '@angular/common/http/testing';
import { vi } from 'vitest';

export const FEED_URL = '/api/v1/voice-rooms/feed';

/** The room feed from the server's side: say what the server says, then drop the connection. For tests. */
export function openFeed(http: HttpTestingController) {
  const request = http.expectOne(FEED_URL);
  let text = '';
  return {
    say(...events: readonly object[]): void {
      text += events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
      request.event({
        type: HttpEventType.DownloadProgress,
        loaded: text.length,
        partialText: text,
      });
    },
    end(): void {
      request.flush(text);
    },
    fail(): void {
      request.flush('no', { status: 500, statusText: 'Server Error' });
    },
  };
}

/** Fails every attempt to reach the feed until the client gives up. Needs fake timers: it waits out the pauses between attempts. */
export function failUntilGivenUp(http: HttpTestingController): void {
  openFeed(http).fail();
  for (let pause = 1000; pause <= 16_000; pause *= 2) {
    vi.advanceTimersByTime(pause);
    openFeed(http).fail();
  }
}
