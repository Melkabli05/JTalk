// Small HTTP helpers shared by the server and the routes.

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * What a route handler returns: a status and a JSON body (or none).
 * @typedef {{ status: number, body?: unknown }} Reply
 */

/** @returns {Reply} */
export const reply = (status, body) => ({ status, body });

export function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

/** The JSON body of a request: `{}` when empty, `undefined` when it is not valid JSON. */
export async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || '{}');
  } catch {
    return undefined;
  }
}

/** A non-empty string. */
export const isText = (value) => typeof value === 'string' && value.trim() !== '';

/** Looks like an address, which is all a mock needs to know. */
export const isEmail = (value) => isText(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
