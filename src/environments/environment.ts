// Production defaults. Never put secrets here: this file is bundled into client code.
// The backend is the deployed one (Render), another origin, so it allows this app's origin with CORS. While it runs in its
// open testing mode (MICRONAUT_ENVIRONMENTS=cloud,dev: no sign-in, the caller is named by an X-User-Id header, the people come
// from /dev/users), `devIdentity` is on. When a user service issues tokens and the backend is back to "cloud" alone, turn it
// off: the app then sends the token's `Authorization: Bearer` header instead.
export const environment = {
  apiUrl: 'https://live-communication-service.onrender.com/api',
  devUrl: 'https://live-communication-service.onrender.com/dev',
  devIdentity: true,
};
