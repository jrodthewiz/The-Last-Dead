// Deploy verification for The Last Dead · Blackwater on Cloudflare.
// Run with: node worker/verify-deploy.mjs
const ORIGINS = [
  'https://lastdead.jrod.download',
  'https://blackwater.jrod.download',
];

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function getText(url, attempts = 6) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fetch(url, { redirect: 'manual' });
    } catch (error) {
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  throw last;
}

for (const origin of ORIGINS) {
  const page = await getText(`${origin}/`);
  const html = await page.text();
  check(`${origin}/ status 200`, page.status === 200, `status ${page.status}`);
  check(`${origin}/ is the game shell`, /<title>The Last Dead · Blackwater<\/title>/.test(html) && html.includes('./island/game.js'), `${html.length} bytes`);
  check(`${origin}/?room=TEST01&autoJoin=1 status 200`, (await getText(`${origin}/?room=TEST01&autoJoin=1`)).status === 200);

  const health = await getText(`${origin}/healthz`);
  const healthBody = await health.json();
  check(`${origin}/healthz`, health.status === 200 && healthBody.ok === true, JSON.stringify(healthBody));

  // Co-op radio room lifecycle against the deployed D1-backed API.
  const api = `${origin}/api/blackwater/rooms`;
  const empty = await (await getText(api)).json();
  check(`${origin} GET rooms`, Array.isArray(empty.rooms) && empty.transport === 'https', `${empty.rooms?.length ?? '?'} room(s)`);

  const hostResponse = await fetch(api, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ player: 'Cloudflare-Host', name: 'Verification expedition' }),
  });
  const host = await hostResponse.json();
  check(`${origin} POST host room`, hostResponse.status === 201 && /^[A-Z2-9]{6}$/.test(host.code) && host.role === 'host', `code ${host.code ?? '?'} status ${hostResponse.status}`);

  const listed = await (await getText(api)).json();
  check(`${origin} room appears in directory`, listed.rooms.some((room) => room.code === host.code), `${listed.rooms.length} room(s)`);

  const joinResponse = await fetch(`${api}/${host.code}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ player: 'Cloudflare-Guest' }),
  });
  const guest = await joinResponse.json();
  check(`${origin} POST guest join`, joinResponse.status === 200 && guest.role === 'guest' && guest.code === host.code, `role ${guest.role ?? '?'}`);

  const hostSyncResponse = await fetch(`${api}/${host.code}/sync`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: host.token, packet: { net: { epoch: 'verify', tick: 1, status: 'waiting' } } }),
  });
  const hostSync = await hostSyncResponse.json();
  check(`${origin} host sync`, hostSyncResponse.status === 200 && hostSync.connected === true && hostSync.code === host.code, `status ${hostSync.status ?? '?'}`);

  const startResponse = await fetch(`${api}/${host.code}/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: host.token, packet: { net: { epoch: hostSync.guestEpoch, tick: 2, status: 'playing' } } }),
  });
  const started = await startResponse.json();
  check(`${origin} host start`, startResponse.status === 200 && started.status === 'playing', `status ${started.status ?? '?'}`);

  const leaveResponse = await fetch(`${api}/${host.code}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: host.token }),
  });
  const left = await leaveResponse.json();
  check(`${origin} host leave`, leaveResponse.status === 200 && left.left === true, `status ${leaveResponse.status}`);
}

// Hub aliases must still resolve through the existing 307s.
for (const alias of ['https://jrod.download/lastdead', 'https://jrod.download/thelastdead']) {
  const response = await fetch(alias, { redirect: 'manual' });
  check(`${alias} -> lastdead.jrod.download`, response.status === 307 && response.headers.get('location') === 'https://lastdead.jrod.download/', `${response.status} ${response.headers.get('location')}`);
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error('Failed checks:', failed);
  process.exitCode = 1;
}
