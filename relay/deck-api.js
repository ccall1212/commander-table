/* Fixed public-provider routes only. No arbitrary URLs, credentials or browser impersonation. */
const MAX_BYTES = 4 * 1024 * 1024;
export function deckOriginAllowed(origin) {
  return typeof origin === 'string' && (origin === 'null' || origin === 'https://ccall1212.github.io' || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin));
}
function json(body, status, origin) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } });
}
export function targetFor(params) {
  if ([...params.keys()].some(k => !['site', 'action', 'id', 'page'].includes(k)) || [...params.keys()].some(k => params.getAll(k).length > 1)) return null;
  const site = params.get('site'), action = params.get('action'), id = params.get('id') || '', page = params.get('page') || '1';
  if (action === 'deck' && !params.has('page')) {
    if (site === 'archidekt' && /^\d{1,12}$/.test(id)) return { url: `https://archidekt.com/api/decks/${id}/`, ttl: 900 };
    if (site === 'moxfield' && /^[A-Za-z0-9_-]{1,64}$/.test(id)) return { url: `https://api.moxfield.com/v2/decks/all/${id}`, ttl: 900 };
  }
  if (action === 'search' && site === 'archidekt' && !id && /^[1-4]$/.test(page)) return { url: `https://archidekt.com/api/decks/v3/?deckFormat=3&orderBy=-updatedAt&pageSize=100&page=${page}`, ttl: 120 };
  return null;
}
async function boundedText(response) {
  const size = Number(response.headers.get('content-length'));
  if (size > MAX_BYTES) throw new Error('Response too large');
  if (!/application\/(?:[\w.-]+\+)?json/i.test(response.headers.get('content-type') || '')) throw new Error('Not JSON');
  const reader = response.body.getReader(), parts = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) throw new Error('Response too large');
      parts.push(value);
    }
  } catch (e) { await reader.cancel(); throw e; }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
export async function handleDeckApi(request, ctx = {}, upstream = fetch, cache = globalThis.caches && caches.default) {
  const origin = request.headers.get('Origin');
  if (!deckOriginAllowed(origin)) return new Response('Origin not allowed', { status: 403 });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET', 'Vary': 'Origin' } });
  if (request.method !== 'GET') return json({ error: 'Only GET is supported.' }, 405, origin);
  const params = new URL(request.url).searchParams;
  if (params.get('site') === 'moxfield' && params.get('action') === 'search') return json({ error: 'Random Moxfield search is unavailable without approved API access. Choose Archidekt or use plain-text export.' }, 501, origin);
  const target = targetFor(params);
  if (!target) return json({ error: 'Unsupported deck request.' }, 400, origin);
  const key = new Request(target.url);
  let data;
  try {
    const hit = cache && await cache.match(key);
    if (hit) data = JSON.parse(await boundedText(hit));
  } catch (_) { /* caching is optional */ }
  if (!data) {
    try {
      const response = await upstream(target.url, { headers: { Accept: 'application/json', 'User-Agent': 'CommanderTable/0.30 (+https://github.com/ccall1212/commander-table)' }, redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (!response.ok) return json({ error: `The deck provider returned HTTP ${response.status}. Use its plain-text export instead.`, blocked: [401,403,429].includes(response.status) }, 502, origin);
      data = JSON.parse(await boundedText(response));
      // Cache only successful JSON from the fixed public endpoint, never provider error pages.
      if (cache && ctx.waitUntil) ctx.waitUntil(cache.put(key, new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${target.ttl}` } })).catch(() => {}));
    } catch (_) { return json({ error: 'The deck provider could not return readable data in time. Use plain-text export instead.' }, 502, origin); }
  }
  return json(data, 200, origin);
}
