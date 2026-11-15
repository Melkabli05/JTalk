import { asRecord } from '@shared/utils/as-record';

/** The `sub` claim of a JWT (the user's id), or null when the token is missing or unreadable. The signature is not checked: the API does that. */
export function tokenSubject(token: string | null): string | null {
  const payload = token?.split('.')[1];
  if (!payload) {
    return null;
  }
  try {
    const subject = asRecord(JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))))?.[
      'sub'
    ];
    return typeof subject === 'string' ? subject : null;
  } catch {
    return null;
  }
}
