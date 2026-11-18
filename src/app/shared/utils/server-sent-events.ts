import { HttpClient, HttpEventType } from '@angular/common/http';
import { concatMap, defer, filter, type Observable } from 'rxjs';

/**
 * A server-sent events stream through the HTTP client, so the sign-in interceptor adds the token (the browser's EventSource cannot).
 * Emits the JSON in each message as it arrives. Completes if the server ends the stream, errors if the connection fails, and
 * unsubscribing closes it.
 */
export function serverSentJson(http: HttpClient, url: string): Observable<unknown> {
  return defer(() => {
    let read = 0; // how much of the text so far has been turned into messages
    return http
      .get(url, {
        observe: 'events',
        reportDownloadProgress: true,
        responseType: 'text',
        headers: { Accept: 'text/event-stream' },
      })
      .pipe(
        filter((event) => event.type === HttpEventType.DownloadProgress),
        concatMap(({ partialText = '' }) => {
          const end = partialText.lastIndexOf('\n\n');
          if (end < read) {
            return []; // no message has been completed since the last time
          }
          const messages = partialText.slice(read, end).split('\n\n');
          read = end + 2;
          return messages.flatMap((message) =>
            message
              .split('\n')
              .filter((line) => line.startsWith('data:') && line.slice(5).trim() !== '')
              .map((line) => JSON.parse(line.slice(5)) as unknown),
          );
        }),
      );
  });
}
