import type { AppEnvironment } from './app-environment';

export const environment: AppEnvironment = {
  production: true,
  apiBaseUrl: '/api',
  auth0: {
    domain: 'dev-fffl5f080xabhazz.us.auth0.com',
    clientId: 'LBZ64XuaiCQWOksIehjOSF7S8xWoq498',
    audience: 'https://api.jtalk.app',
  },
};
