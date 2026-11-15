// A tiny router: a table of { method, path, handle } with `:name` segments. First match wins.

/** @param {{ method: string, path: string, handle: (ctx: any) => unknown }[]} routes */
export function createRouter(routes) {
  const compiled = routes.map((route) => ({
    ...route,
    segments: route.path.split('/').filter(Boolean),
  }));

  return {
    /** The route for this request and its `:params`, or undefined. `pathMatched` tells 404 from 405. */
    match(method, pathname) {
      const parts = pathname.split('/').filter(Boolean);
      let pathMatched = false;
      for (const route of compiled) {
        const params = matchSegments(route.segments, parts);
        if (!params) continue;
        pathMatched = true;
        if (route.method === method) return { route, params, pathMatched };
      }
      return { route: undefined, params: {}, pathMatched };
    },
  };
}

function matchSegments(pattern, parts) {
  if (pattern.length !== parts.length) return undefined;
  const params = {};
  for (const [index, segment] of pattern.entries()) {
    const part = parts[index];
    if (segment.startsWith(':')) params[segment.slice(1)] = decodeURIComponent(part);
    else if (segment !== part) return undefined;
  }
  return params;
}
