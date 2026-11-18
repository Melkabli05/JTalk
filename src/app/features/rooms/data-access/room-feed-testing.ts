import { HttpEventType } from '@angular/common/http';
import type { HttpTestingController } from '@angular/common/http/testing';

export const FEED_URL = '/api/v1/voice-rooms/feed';
export const ROOMS_URL = '/api/v1/voice-rooms?size=100';

/** The room feed from the server's side: say what the server says, then drop the connection. For tests. */
export function openFeed(http: HttpTestingController) {
  const request = http.expectOne(FEED_URL);
  let text = '';
  return {
    say(...events: readonly object[]): void {
      text += events.map((event) => `data:${JSON.stringify(event)}\n\n`).join('');
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
