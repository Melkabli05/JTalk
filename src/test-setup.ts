const noop = (): void => undefined;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (media: string): MediaQueryList => ({
    matches: false,
    media,
    onchange: null,
    addEventListener: noop,
    removeEventListener: noop,
    addListener: noop,
    removeListener: noop,
    dispatchEvent: () => false,
  }),
});
