import { HttpEventType, HttpInterceptorFn } from '@angular/common/http';
import { map, tap } from 'rxjs';
import { ROOM_FEED_TRANSPORT } from './room-feed-transport.token';

export const roomFeedTransport: HttpInterceptorFn = (request, next) => {
  const hooks = request.context.get(ROOM_FEED_TRANSPORT);
  if (!hooks) return next(request);

  // ngx-sse-client 21 splits each progress chunk individually and flushes its tail at EOF.
  // Deliver whole frames, including when a CRLF separator straddles two downloads.
  let consumed = 0;
  let delivered = '';
  const completeFrames = (text: string, final: boolean) => {
    const end = !final && text.endsWith('\r') ? text.length - 1 : text.length;
    const pending = text.slice(consumed, end);
    const separators = /(?:\r\n|\r(?!\n)|\n)(?:\r\n|\r(?!\n)|\n)/g;
    let boundary = 0;
    for (const match of pending.matchAll(separators)) boundary = match.index + match[0].length;
    if (boundary) {
      delivered += pending.slice(0, boundary).replace(/\r\n?/g, '\n');
      consumed += boundary;
    }
    return delivered;
  };

  return next(request.clone({ transferCache: false })).pipe(map(event => {
    if (event.type === HttpEventType.DownloadProgress && event.partialText !== undefined) {
      hooks.activity();
      return { ...event, partialText: completeFrames(event.partialText, false) };
    }
    if (event.type === HttpEventType.Response && typeof event.body === 'string') {
      return event.clone({ body: completeFrames(event.body, true) });
    }
    return event;
  }), tap({
    // Version 21 can swallow status-zero network failures with keepAlive disabled.
    error: () => hooks.disconnected(),
  }));
};
