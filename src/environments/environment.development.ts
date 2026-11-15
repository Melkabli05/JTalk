// Swapped in for `environment.ts` by the "development" build configuration.
// `/api` and `/dev` are forwarded to the backend by the dev server (see proxy.conf.json).
// `devIdentity` is for the backend's `dev` profile only: it has no sign-in, so the caller is named by an
// `X-User-Id` header and the people come from `GET /dev/users`.
export const environment = {
  apiUrl: '/api',
  devUrl: '/dev',
  devIdentity: true,
};
