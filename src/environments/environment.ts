// Production defaults. Never put secrets here: this file is bundled into client code.
// `/api` and `/dev` are the app's own origin: vercel.json rewrites them to the deployed backend (Render), so the browser never
// calls another origin and CORS is not involved. While that backend runs in its open testing mode (MICRONAUT_ENVIRONMENTS=cloud,dev:
// no sign-in, the caller is named by an X-User-Id header, the people come from /dev/users), `devIdentity` is on. When a user
// service issues tokens and the backend is back to "cloud" alone, turn it off: the app then sends the token's
// `Authorization: Bearer` header instead.
export const environment = {
  apiUrl: '/api',
  devUrl: '/dev',
  devIdentity: true,
};
