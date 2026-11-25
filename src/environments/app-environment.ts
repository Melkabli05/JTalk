export interface AppEnvironment {
  readonly production: boolean;
  readonly apiBaseUrl: string;
  readonly auth0: {
    readonly domain: string;
    readonly clientId: string;
    readonly audience: string;
  };
}
