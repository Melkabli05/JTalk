import { HttpClient, HttpEventType } from '@angular/common/http';
import { concatMap, defer, type Observable } from 'rxjs';

const BLANK_LINE = /\r?\n\r?\n/g;

/** The `data:` lines of one frame, joined; undefined when it has none. */
function dataOf(frame: string): string | undefined {
  const lines = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(line.startsWith('data: ') ? 6 : 5));
  return lines.length === 0 ? undefined : lines.join('\n');
}

function parsed(data: string): unknown[] {
  try {
    return [JSON.parse(data)];
  } catch {
    return []; // a frame that is not JSON (a keep-alive) is not for the app
  }
}

/**
 * A server-sent events stream, through the HTTP client so the sign-in interceptor adds the token (the browser's EventSource cannot). Emits
 * the JSON in each frame's data as it arrives; the observable completes if the server ends the stream and errors if the connection fails.
 * Unsubscribing closes the connection.
 */
export function serverSentJson(http: HttpClient, url: string): Observable<unknown> {
  return defer(() => {
    let read = 0; // how much of the text so far has been turned into frames
    return http
      .get(url, {
        observe: 'events',
        reportDownloadProgress: true,
        responseType: 'text',
        headers: { Accept: 'text/event-stream' },
      })
      .pipe(
        concatMap((event) => {
          if (event.type !== HttpEventType.DownloadProgress || event.partialText === undefined) {
            return [];
          }
          const text = event.partialText;
          const frames: string[] = [];
          BLANK_LINE.lastIndex = read;
          for (let end = BLANK_LINE.exec(text); end !== null; end = BLANK_LINE.exec(text)) {
            frames.push(text.slice(read, end.index));
            read = BLANK_LINE.lastIndex;
          }
          return frames.flatMap((frame) => {
            const data = dataOf(frame);
            return data === undefined || data === '' ? [] : parsed(data);
          });
        }),
      );
  });
}
