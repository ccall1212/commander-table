// Separate HTTP-only test Worker: it has no access to live game-room Durable Objects.
import { handleDeckApi } from './deck-api.js';
export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path === '/health') return Response.json({ ok: true, service: 'deck-import-test' });
    if (path === '/deck-api') return handleDeckApi(request, ctx);
    return new Response('Not found', { status: 404 });
  }
};
