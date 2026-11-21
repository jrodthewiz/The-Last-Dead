import { ROOM_PATH, d1Rooms, roomRequest } from '../coop/rooms.js';

// Standalone edge host for The Last Dead · Blackwater.
//
// Static release files are served by Workers Static Assets, and the Worker runs
// first (`assets.run_worker_first` in wrangler.jsonc) so it can redirect retired
// hostnames before anything else. It also serves the co-op radio API through the
// canonical protocol in coop/rooms.js so the browser client and the hosted
// backend cannot drift apart.
//
// D1 is required: Workers isolates do not share memory, and the room directory
// must survive across requests, so the same `coop_rooms` schema used by the
// Sites deployment is bound as `DB`.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Canonical hostname is thelastdead.jrod.download. lastdead still answers
    // here and 308s to the canonical name; blackwater is detached and handled
    // by a jrod-hub route if its DNS is ever restored.
    if (url.hostname === 'blackwater.jrod.download' || url.hostname === 'lastdead.jrod.download') {
      const target = `https://thelastdead.jrod.download${url.pathname}${url.search}`;
      return new Response(null, {
        status: 308,
        headers: { Location: target, 'Cache-Control': 'no-store' },
      });
    }

    if (url.pathname === ROOM_PATH || url.pathname.startsWith(`${ROOM_PATH}/`)) {
      if (!env.DB) {
        return Response.json(
          { error: 'The expedition radio is temporarily unavailable.' },
          { status: 503, headers: { 'cache-control': 'no-store' } },
        );
      }
      return roomRequest(request, d1Rooms(env.DB));
    }

    // /healthz gives the deploy check a cheap Worker-side probe without
    // touching the game bundle or the room directory.
    if (url.pathname === '/healthz') {
      return Response.json(
        { ok: true, service: 'the-last-dead', transport: 'https', version: 1 },
        { headers: { 'cache-control': 'no-store' } },
      );
    }

    return env.ASSETS.fetch(request);
  },
};
