// Production defaults. Never put secrets here: this file is bundled into client code.
// `apiUrl` is the deployed backend (Render). It is another origin, so the backend must allow this app's origin with CORS.
export const environment = {
  apiUrl: 'https://live-communication-service.onrender.com/api',
  devUrl: '/dev',
  devIdentity: false,
};
