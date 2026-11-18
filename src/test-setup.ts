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

// The tab bar watches its own size; there is no layout here, so it is told nothing changes.
class NoResizeObserver implements ResizeObserver {
  observe = noop;
  unobserve = noop;
  disconnect = noop;
}
window.ResizeObserver ??= NoResizeObserver;
