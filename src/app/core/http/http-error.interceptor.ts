import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { catchError } from 'rxjs';

const problemMessages = new Map<string, string>([
  ['urn:jtalk:user:problem:user-not-found', 'Profile not found.'],
  [
    'urn:jtalk:live-communication:problem:voice-room-not-found',
    'This voice room no longer exists.',
  ],
  ['urn:jtalk:live-communication:problem:already-on-stage', 'You are already on stage.'],
  [
    'urn:jtalk:live-communication:problem:kicked-from-room',
    'You have been removed from this room.',
  ],
  [
    'urn:jtalk:proxy:problem:upstream-unavailable',
    'The JTalk backend service is waking up or temporarily unavailable. Please retry.',
  ],
]);

function isPlainObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readProp(target: object | undefined, key: string): unknown {
  return target ? Reflect.get(target, key) : undefined;
}

function readBody(body: unknown): object | undefined {
  if (typeof body !== 'string') return isPlainObject(body) ? body : undefined;
  try {
    const parsed: unknown = JSON.parse(body);
    return isPlainObject(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function messageFor(response: HttpErrorResponse, type: string, detail: string): string {
  const mapped = problemMessages.get(type);
  if (mapped) return mapped;
  const event = isPlainObject(response.error) ? response.error : undefined;
  if (
    response.status === 408 ||
    response.status === 504 ||
    (response.status === 0 &&
      (readProp(event, 'name') === 'TimeoutError' || readProp(event, 'type') === 'timeout'))
  ) {
    return 'The request timed out. Please try again.';
  }
  switch (response.status) {
    case 401:
      return 'Please sign in to continue.';
    case 403:
      return detail || 'You do not have permission for this action.';
    case 404:
      return detail || 'The requested resource was not found.';
    case 429: {
      const retry = response.headers.get('Retry-After');
      const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : 0;
      if (seconds > 0) return `Too many requests. Try again in ${seconds}s.`;
      return detail || 'Too many requests. Please wait a moment.';
    }
    default:
      if (response.status === 0 || response.status >= 500) {
        return 'Unable to reach JTalk right now. Please try again shortly.';
      }
      return detail || 'The request could not be completed.';
  }
}

export class ApiError extends Error {
  readonly type: string;
  readonly status: number;
  readonly statusText: string;

  constructor(response: HttpErrorResponse) {
    const body = readBody(response.error);
    const rawType = readProp(body, 'type');
    const type = typeof rawType === 'string' ? rawType : 'about:blank';
    const detail = [
      readProp(body, 'detail'),
      readProp(body, 'message'),
      readProp(body, 'title'),
    ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);
    super(messageFor(response, type, detail ?? ''), { cause: response });
    this.type = type;
    this.status = response.status;
    this.statusText = response.statusText;
  }
}

export const httpErrorInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(
    catchError((error: unknown) => {
      throw error instanceof HttpErrorResponse ? new ApiError(error) : error;
    }),
  );

const AUTH_SESSION_ERROR_RE =
  /missing refresh token|login_required|consent_required|interaction_required|invalid_grant/i;

function isAuthSessionError(error: unknown): boolean {
  if (error instanceof Error) {
    return AUTH_SESSION_ERROR_RE.test(error.message);
  }
  if (isPlainObject(error)) {
    const code = readProp(error, 'error');
    const description = readProp(error, 'error_description');
    return (
      (typeof code === 'string' && AUTH_SESSION_ERROR_RE.test(code)) ||
      (typeof description === 'string' && AUTH_SESSION_ERROR_RE.test(description))
    );
  }
  return false;
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.message) {
    return error.message;
  }
  if (isAuthSessionError(error)) {
    return 'Your session expired. Please sign in again.';
  }
  return fallback;
}
