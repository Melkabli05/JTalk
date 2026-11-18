export const environment = {
  /** The API is on the same origin: the dev server's proxy and Vercel's rewrites send /api/v1/users to the user service and the rest to the live communication service. */
  apiUrl: '/api',
  /** Auth0: the tenant, this app (a Single Page Application) and the API the access tokens are for. None of these is a secret. */
  auth0: {
    domain: 'dev-fffl5f080xabhazz.us.auth0.com',
    clientId: 'LBZ64XuaiCQWOksIehjOSF7S8xWoq498',
    audience: 'https://api.jtalk.app',
  },
};
