import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError } from 'rxjs';
import { asRecord } from './as-record';

const problemMessages = new Map<string, string>([
  ['urn:jtalk:user:problem:user-not-found', 'Profile not found.'],
  ['urn:jtalk:live-communication:problem:voice-room-not-found', 'This voice room no longer exists.'],
  ['urn:jtalk:live-communication:problem:already-on-stage', 'You are already on stage.'],
  ['urn:jtalk:live-communication:problem:kicked-from-room', 'You have been removed from this room.'],
  ['urn:jtalk:proxy:problem:upstream-unavailable', 'The JTalk backend service is waking up or temporarily unavailable. Please retry.'],
]);

function readBody(body: unknown) {
  if (typeof body !== 'string') return asRecord(body);
  try {
    return asRecord(JSON.parse(body));
  } catch {
    return undefined;
  }
}

function messageFor(response: HttpErrorResponse, type: string, detail: string): string {
  const mapped = problemMessages.get(type);
  if (mapped) return mapped;
  const event = asRecord(response.error);
  if (response.status === 408 || response.status === 504 ||
      (response.status === 0 && (event?.['name'] === 'TimeoutError' || event?.['type'] === 'timeout'))) {
    return 'The request timed out. Please try again.';
  }
  switch (response.status) {
    case 401: return 'Please sign in to continue.';
    case 403: return detail || 'You do not have permission for this action.';
    case 404: return detail || 'The requested resource was not found.';
    case 429: {
      const retry = response.headers.get('Retry-After');
      const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : 0;
      return seconds > 0 ? `Too many requests. Try again in ${seconds}s.` : 'Too many requests. Please wait a moment.';
    }
    default:
      if (response.status === 0 || response.status >= 500) return 'Unable to reach JTalk right now. Please try again shortly.';
      return detail || 'The request could not be completed.';
  }
}

export class ApiError extends Error {
  readonly type: string;
  readonly status: number;
  readonly statusText: string;

  constructor(response: HttpErrorResponse) {
    const body = readBody(response.error);
    const type = typeof body?.['type'] === 'string' ? body['type'] : 'about:blank';
    const detail = [body?.['detail'], body?.['message'], body?.['title']].find(
      (value): value is string => typeof value === 'string' && value.trim().length > 0,
    );
    super(messageFor(response, type, detail ?? ''), { cause: response });
    this.type = type;
    this.status = response.status;
    this.statusText = response.statusText;
  }
}

export const httpErrorInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(catchError((error: unknown) => {
    throw error instanceof HttpErrorResponse ? new ApiError(error) : error;
  }));

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
