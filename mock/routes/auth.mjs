// /auth/*: sign in (with a lockout), register, and the two password-reset steps. Registration and reset
// requests answer the same whatever the address, like a backend that does not leak who has an account.
import { isEmail, isText, reply } from '../http.mjs';

const MIN_PASSWORD_LENGTH = 12;
const MAX_FAILED_LOGINS = 5;

export const authRoutes = [
  {
    method: 'POST',
    path: '/auth/login',
    handle: ({ body, state }) => {
      if (!isEmail(body.email) || !isText(body.password)) {
        return reply(422, { message: 'email and password are required' });
      }
      const email = body.email.trim().toLowerCase();
      const failures = state.failedLogins.get(email) ?? 0;
      if (failures >= MAX_FAILED_LOGINS) {
        return reply(429, { message: 'Too many failed attempts' });
      }
      // Any password works, except "wrong" (to see the failure path). Five failures lock the address out.
      if (body.password === 'wrong') {
        state.failedLogins.set(email, failures + 1);
        return reply(401, { message: 'Invalid credentials' });
      }
      state.failedLogins.delete(email);
      return reply(200, { token: 'mock-token' });
    },
  },
  {
    method: 'POST',
    path: '/auth/register',
    handle: ({ body }) =>
      !isEmail(body.email) || !isText(body.password) || body.password.length < MIN_PASSWORD_LENGTH
        ? reply(422, {
            message: `email and a password of at least ${MIN_PASSWORD_LENGTH} characters are required`,
          })
        : reply(202),
  },
  {
    method: 'POST',
    path: '/auth/forgot-password',
    handle: ({ body }) =>
      isEmail(body.email) ? reply(202) : reply(422, { message: 'email is required' }),
  },
  {
    method: 'POST',
    path: '/auth/reset-password',
    // The token "expired" stands for a link that was used or has run out.
    handle: ({ body }) => {
      if (
        !isText(body.token) ||
        !isText(body.password) ||
        body.password.length < MIN_PASSWORD_LENGTH
      ) {
        return reply(422, { message: 'token and a long enough password are required' });
      }
      return body.token === 'expired'
        ? reply(400, { message: 'Invalid or expired token' })
        : reply(204);
    },
  },
];
