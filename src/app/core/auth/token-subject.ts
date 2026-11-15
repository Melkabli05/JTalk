import { asRecord } from '@shared/utils/as-record';

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
