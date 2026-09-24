// The Last Dead — top-down map playground.
//
// Draws the authored campaign as a dungeon map straight from campaign.js and
// room-progression.js so design review never has to guess at a copied layout.
// Everything is plain canvas 2D: pan, zoom, inspect, measure, drag anchors and
// export a retune patch.

import {
  CELL,
  LAYER_DEFS,
  ROUTE_ROLE_COLORS,
  ZONE_ROLE_COLORS,
  buildCampaignScene,
  buildDungeonOverview,
  buildDungeonScene,
  buildSectorScene,
  compassLabel,
  dungeonLayerOptions,
  dungeonSummary,
  overrideKey,
  refreshScene,
  sceneSnapshot,
  sectorOptions,
  summarizeOverrides,
} from './map-model.js';

const THEMES = {
  dungeon: {
    page: '#08080a',
    panel: '#0d0d12',
    panelEdge: '#2a2a36',
    floor: '#101015',
    floorAlt: '#13131a',
    grid: '#1b1b24',
    gridMajor: '#282835',
    wall: '#d2c6ad',
    block: '#23232e',
    blockEdge: '#3c3c4c',
    text: '#ece4d3',
    dim: '#8d8778',
    accent: '#caac72',
    ghost: 'rgba(210,198,173,.34)',
    path: '#ffd479',
    bad: '#ff6b5e',
    warn: '#ffb15e',
    info: '#7fb2ff',
    good: '#43c98a',
  },
  blueprint: {
    page: '#04090f',
    panel: '#061423',
    panelEdge: '#164058',
    floor: '#071a28',
    floorAlt: '#0a2133',
    grid: '#0e2b3e',
    gridMajor: '#164058',
    wall: '#93daff',
    block: '#0c2a3e',
    blockEdge: '#1d5f80',
    text: '#d6ecf8',
    dim: '#7ba0b6',
    accent: '#59d0ff',
    ghost: 'rgba(147,218,255,.36)',
    path: '#ffd479',
    bad: '#ff7a6b',
    warn: '#ffc46b',
    info: '#59d0ff',
    good: '#5ce0a4',
  },
};

const SEVERITY_COLORS = { error: 'bad', warn: 'warn', info: 'info' };
const PANEL_GAP = 3;
const ARENA_W = 12;
const ARENA_H = 12;
const MONO = '"IBM Plex Mono", ui-monospace, "Cascadia Mono", Consolas, monospace';
const UI = '"Barlow Condensed", "Arial Narrow", "Segoe UI", system-ui, sans-serif';

// Detail views can carry more authored data than a label stack can safely
// display. Keep primary objectives and room names visible while collapsing
// secondary dressing to icons at the close map zoom used for Story floors.
function storyDetailLabel(kind, item, scale) {
  if (!state.labels) return false;
  if (state.focus) {
    if (kind === 'room' || kind === 'key' || kind === 'secret') return true;
    const focusId = String(item?.id || item?.role || item?.type || '').toLowerCase();
    if (kind === 'machinery') return /lift|hoist/.test(focusId);
    return /hero|altar|entry|exit|cache|vault|organ|door|bulkhead|scare/.test(focusId);
  }
  if (state.mode !== 'dungeon' || scale < 24) return true;
  if (kind === 'room') return true;
  const id = String(item?.id || item?.role || item?.type || '').toLowerCase();
  return /hero|altar|entry|exit|key|cache|secret|vault|organ|door|bulkhead|scare/.test(id);
}

const state = {
  mode: 'sector',
  sectorIndex: 0,
  dungeonIndex: 0,
  theme: 'dungeon',
  gateMode: 'designed',
  labels: true,
  edit: false,
  measure: false,
  layers: Object.fromEntries(LAYER_DEFS.map(layer => [layer.id, true])),
  overrides: {},
  baseline: null,
  history: [],
  measurePoints: [],
  focus: false,
  selection: null,
  hover: null,
  revision: 0,
  drag: null,
  pointer: { x: 0, y: 0, cells: { x: 0, y: 0 }, inside: false },
};

const dom = {
  canvas: document.getElementById('map'),
  stage: document.getElementById('stage'),
  sectors: document.getElementById('sector-tabs'),
  mode: document.getElementById('mode'),
  gateMode: document.getElementById('gate-mode'),
  theme: document.getElementById('theme'),
  layers: document.getElementById('layers'),
  metrics: document.getElementById('metrics'),
  diagnostics: document.getElementById('diagnostics'),
  inspector: document.getElementById('inspector'),
  draft: document.getElementById('draft'),
  editToggle: document.getElementById('edit-toggle'),
  undo: document.getElementById('undo'),
  reset: document.getElementById('reset'),
  copyDraft: document.getElementById('copy-draft'),
  savePng: document.getElementById('save-png'),
  playFloor: document.getElementById('play-floor'),
  fit: document.getElementById('fit'),
  measure: document.getElementById('measure'),
  focus: document.getElementById('focus'),
  labels: document.getElementById('labels'),
  hud: document.getElementById('hud'),
  banner: document.getElementById('banner'),
  toast: document.getElementById('toast'),
  boot: document.getElementById('boot-status'),
};

const ctx = dom.canvas.getContext('2d');
const cam = { scale: 26, ox: 40, oy: 40 };
let sceneCache = null;
let sceneCacheKey = '';
let hits = [];
let labelBoxes = [];
let frame = 0;
let layersSignature = '';
const metricsSignature = { value: '' };

const SECTORS = sectorOptions();
const DUNGEON_LAYERS = dungeonLayerOptions();

// ---------------------------------------------------------------- scene state

function applyOverrides(next) {
  const apply = panel => {
    const pools = [
      ['landmark', panel.landmarks],
      ['machinery', panel.machinery],
      ['setpiece', panel.setpieces],
      ['light', panel.lights],
      ['spawn', panel.spawns],
      ['zone', panel.zones],
    ];
    for (const [kind, pool] of pools) {
      for (const item of pool || []) {
        const override = state.overrides[overrideKey(kind, item.id)];
        if (!override) continue;
        if (Array.isArray(item.anchor)) item.anchor = [...override];
        else {
          item.x = override[0];
          item.y = override[1];
        }
      }
    }
    for (const id of ['player', 'exit']) {
      const override = state.overrides[overrideKey('anchor', id)];
      if (override) panel[id] = { ...panel[id], x: override[0], y: override[1] };
    }
  };
  if (next.kind === 'campaign') next.panels.forEach(apply);
  else apply(next);
  return next;
}

function currentScene() {
  const key = `${state.mode}:${state.sectorIndex}:${state.dungeonIndex}:${state.revision}`;
  if (sceneCacheKey !== key) {
    const built = state.mode === 'campaign' ? buildCampaignScene()
      : state.mode === 'dungeon-stack' ? buildDungeonOverview()
        : state.mode === 'dungeon' ? buildDungeonScene(state.dungeonIndex)
          : buildSectorScene(state.sectorIndex);
    state.baseline ||= {};
    if (built) for (const panel of panelsOf(built)) recordBaseline(panel);
    sceneCache = refreshScene(applyOverrides(built));
    sceneCacheKey = key;
  }
  return sceneCache;
}

function recordBaseline(panel) {
  const remember = (kind, id, value) => {
    const key = overrideKey(kind, id);
    if (!state.baseline[key]) state.baseline[key] = [...value];
  };
  for (const item of panel.landmarks) remember('landmark', item.id, item.anchor);
  for (const item of panel.machinery) remember('machinery', item.id, item.anchor);
  for (const item of panel.setpieces) remember('setpiece', item.id, item.anchor);
  for (const item of panel.lights) remember('light', item.id, item.anchor);
  for (const item of panel.zones) remember('zone', item.id, item.anchor);
  for (const item of panel.spawns) remember('spawn', item.id, [item.x, item.y]);
  remember('anchor', 'player', [panel.player.x, panel.player.y]);
  remember('anchor', 'exit', [panel.exit.x, panel.exit.y]);
}

function panelsOf(scene) {
  return scene?.panels ? scene.panels : [scene];
}

function layoutOf(scene) {
  const panels = panelsOf(scene);
  if (panels.length === 1) {
    return { width: panels[0].width, height: panels[0].height, origin: () => ({ x: 0, y: 0 }) };
  }
  const aspect = Math.max(0.4, (dom.stage.clientWidth || 1280) / (dom.stage.clientHeight || 800));
  let best = { score: Infinity, columns: 1 };
  for (let columns = 1; columns <= panels.length; columns += 1) {
    const rows = Math.ceil(panels.length / columns);
    const rowWidths = [];
    const rowHeights = [];
    for (let row = 0; row < rows; row += 1) {
      const slice = panels.slice(row * columns, row * columns + columns);
      rowWidths.push(slice.reduce((sum, panel) => sum + panel.width, 0) + Math.max(0, slice.length - 1) * PANEL_GAP);
      rowHeights.push(Math.max(...slice.map(panel => panel.height)));
    }
    const width = Math.max(...rowWidths);
    const height = rowHeights.reduce((sum, value) => sum + value, 0) + Math.max(0, rows - 1) * PANEL_GAP;
    const score = Math.abs(width / height - aspect);
    if (score < best.score) best = { score, columns };
  }
  const columns = best.columns;
  const rows = Math.ceil(panels.length / columns);
  const origins = [];
  let cursorY = 0;
  for (let row = 0; row < rows; row += 1) {
    const slice = panels.slice(row * columns, row * columns + columns);
    const rowHeight = Math.max(...slice.map(panel => panel.height));
    let cursorX = 0;
    for (const panel of slice) {
      origins.push({ x: cursorX, y: cursorY });
      cursorX += panel.width + PANEL_GAP;
    }
    cursorY += rowHeight + PANEL_GAP;
  }
  const width = Math.max(...origins.map((origin, index) => origin.x + panels[index].width));
  const height = Math.max(...origins.map((origin, index) => origin.y + panels[index].height));
  return { width, height, origin: index => origins[index] || { x: 0, y: 0 } };
}

// ------------------------------------------------------------------- camera

function cellToScreen(origin, x, y) {
  return { x: cam.ox + (origin.x + x) * cam.scale, y: cam.oy + (origin.y + y) * cam.scale };
}

function screenToCell(origin, x, y) {
  return { x: (x - cam.ox) / cam.scale - origin.x, y: (y - cam.oy) / cam.scale - origin.y };
}

function fitView() {
  const scene = currentScene();
  const layout = layoutOf(scene);
  const pad = 1.4;
  const width = layout.width + pad * 2;
  const height = layout.height + pad * 2;
  const scale = Math.max(3, Math.min(dom.stage.clientWidth / width, dom.stage.clientHeight / height));
  cam.scale = scale;
  cam.ox = (dom.stage.clientWidth - layout.width * scale) / 2 - pad * scale;
  cam.oy = (dom.stage.clientHeight - layout.height * scale) / 2 - pad * scale;
}

function focusCell(target) {
  cam.ox = dom.stage.clientWidth / 2 - target.x * cam.scale - ARENA_W * cam.scale * 0.5;
  cam.oy = dom.stage.clientHeight / 2 - target.y * cam.scale - ARENA_H * cam.scale * 0.5;
}

// ------------------------------------------------------------------ painting

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = dom.stage.getBoundingClientRect();
  dom.canvas.width = Math.max(1, Math.round(rect.width * dpr));
  dom.canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function theme() {
  return THEMES[state.theme] || THEMES.dungeon;
}

function drawScene() {
  const t = theme();
  const scene = currentScene();
  const layout = layoutOf(scene);
  const width = dom.stage.clientWidth;
  const height = dom.stage.clientHeight;
  ctx.save();
  ctx.fillStyle = t.page;
  ctx.fillRect(0, 0, width, height);
  hits = [];
  labelBoxes = [];
  const panels = panelsOf(scene);
  panels.forEach((panel, index) => {
    const origin = layout.origin(index);
    drawPanel(panel, origin, scene.kind === 'campaign' ? 'overview' : 'detail');
  });
  if (panels.length === 1) drawRulers(scene, layout.origin(0));
  drawMeasure(scene, layout);
  drawHoverTip();
  ctx.restore();
  updateBanner(scene);
  updateHud(scene);
}

function drawPanel(panel, origin, mode) {
  const t = theme();
  const scale = cam.scale;
  const dungeon = panel.kind === 'dungeon';
  const topLeft = cellToScreen(origin, 0, 0);
  const size = { w: panel.width * scale, h: panel.height * scale };
  ctx.save();
  roundRect(topLeft.x, topLeft.y, size.w, size.h, Math.max(2, scale * 0.18));
  ctx.fillStyle = t.panel;
  ctx.fill();
  ctx.strokeStyle = t.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.clip();

  ctx.fillStyle = t.floor;
  ctx.fillRect(topLeft.x, topLeft.y, size.w, size.h);
  for (let y = 0; y < panel.height; y += 1) {
    for (let x = 0; x < panel.width; x += 1) {
      if ((x + y) % 3 !== 0) continue;
      const cell = cellToScreen(origin, x, y);
      ctx.fillStyle = t.floorAlt;
      ctx.fillRect(cell.x, cell.y, scale, scale);
    }
  }

  if (state.layers.zones && !dungeon) drawZones(panel, origin);
  if (dungeon && state.layers.corridors) drawCorridors(panel, origin);
  if (state.layers.rooms) drawRooms(panel, origin, mode);
  if (state.layers.routes && !dungeon) drawRoutes(panel, origin);
  if (state.layers.grid) drawGrid(panel, origin);
  if (dungeon && state.layers.props) drawProps(panel, origin);
  if (state.layers.lights) drawLights(panel, origin);
  if (state.layers.blocks) drawBlocks(panel, origin);
  if (state.layers.walls) drawWalls(panel, origin);
  if (state.layers.setpieces) drawSetpieces(panel, origin);
  if (state.layers.machinery) drawMachinery(panel, origin);
  if (state.layers.landmarks) drawLandmarks(panel, origin, mode);
  if (state.layers.portals) {
    if (dungeon) drawOpenings(panel, origin);
    else drawPortals(panel, origin);
  }
  if (dungeon && state.layers.picks) drawPicks(panel, origin);
  if (dungeon && state.layers.connections) drawConnections(panel, origin);
  if (dungeon && state.layers.scares) drawScares(panel, origin);
  if (state.layers.path) drawPath(panel, origin);
  if (state.layers.spawns) drawSpawns(panel, origin);
  drawAnchors(panel, origin);
  if (state.layers.diagnostics) drawDiagnostics(panel, origin);
  if (mode === 'overview' || panel.kind === 'dungeon') drawPanelCaption(panel, origin);
  ctx.restore();

  if (scale > 9) {
    ctx.strokeStyle = t.panelEdge;
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(topLeft.x) + 0.5, Math.round(topLeft.y) + 0.5, Math.round(size.w), Math.round(size.h));
  }
}

function drawGrid(panel, origin) {
  const t = theme();
  const scale = cam.scale;
  if (scale < 6) return;
  const topLeft = cellToScreen(origin, 0, 0);
  ctx.save();
  ctx.lineWidth = 1;
  for (let x = 0; x <= panel.width; x += 1) {
    const screen = cellToScreen(origin, x, 0);
    ctx.strokeStyle = x % 4 === 0 ? t.gridMajor : t.grid;
    ctx.beginPath();
    ctx.moveTo(screen.x, topLeft.y);
    ctx.lineTo(screen.x, topLeft.y + panel.height * scale);
    ctx.stroke();
  }
  for (let y = 0; y <= panel.height; y += 1) {
    const screen = cellToScreen(origin, 0, y);
    ctx.strokeStyle = y % 4 === 0 ? t.gridMajor : t.grid;
    ctx.beginPath();
    ctx.moveTo(topLeft.x, screen.y);
    ctx.lineTo(topLeft.x + panel.width * scale, screen.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWalls(panel, origin) {
  const t = theme();
  const scale = cam.scale;
  if (scale < 2.2) return;
  ctx.save();
  ctx.lineCap = 'square';
  ctx.beginPath();
  for (const segment of panel.walls) {
    const from = segment.horizontal
      ? cellToScreen(origin, segment.x - 0.5, segment.z)
      : cellToScreen(origin, segment.x, segment.z - 0.5);
    const to = segment.horizontal
      ? cellToScreen(origin, segment.x + 0.5, segment.z)
      : cellToScreen(origin, segment.x, segment.z + 0.5);
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
  }
  // Dark casing first so wall runs stay readable over zone and light fills.
  ctx.strokeStyle = '#000000a8';
  ctx.lineWidth = Math.max(4, scale * 0.3);
  ctx.stroke();
  ctx.strokeStyle = t.wall;
  ctx.lineWidth = Math.max(2, scale * 0.15);
  ctx.stroke();
  ctx.restore();
}

function drawBlocks(panel, origin) {
  const t = theme();
  const scale = cam.scale;
  ctx.save();
  for (const block of panel.ghostBlocks) {
    const screen = cellToScreen(origin, block.x, block.y);
    ctx.fillStyle = t.block;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(screen.x + scale * 0.06, screen.y + scale * 0.06, scale * 0.88, scale * 0.88);
    ctx.globalAlpha = 1;
    ctx.setLineDash([Math.max(2, scale * 0.16), Math.max(2, scale * 0.14)]);
    ctx.strokeStyle = t.ghost;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(screen.x + scale * 0.06, screen.y + scale * 0.06, scale * 0.88, scale * 0.88);
    ctx.setLineDash([]);
  }
  for (const block of panel.blocks) {
    const screen = cellToScreen(origin, block.x, block.y);
    ctx.fillStyle = t.block;
    ctx.fillRect(screen.x, screen.y, scale, scale);
    ctx.strokeStyle = t.blockEdge;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(screen.x + 0.75, screen.y + 0.75, scale - 1.5, scale - 1.5);
    ctx.beginPath();
    const inset = Math.min(scale * 0.22, 5);
    ctx.moveTo(screen.x + inset, screen.y + inset);
    ctx.lineTo(screen.x + scale - inset, screen.y + scale - inset);
    ctx.moveTo(screen.x + scale - inset, screen.y + inset);
    ctx.lineTo(screen.x + inset, screen.y + scale - inset);
    ctx.strokeStyle = t.blockEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
    pushHit({ sceneId: panel.id, kind: 'block', id: `block-${block.x}-${block.y}`, label: `cover cell ${block.x}, ${block.y}`, anchor: { x: block.x + 0.5, y: block.y + 0.5 }, rect: { x: block.x, y: block.y, w: 1, h: 1 } });
  }
  ctx.restore();
}

function drawZones(panel, origin) {
  const scale = cam.scale;
  ctx.save();
  for (const zone of panel.zones) {
    const [zx, zy, zw, zh] = zone.rect;
    const screen = cellToScreen(origin, zx, zy);
    const width = zw * scale;
    const height = zh * scale;
    const color = zone.color || ZONE_ROLE_COLORS[zone.role] || '#8b93a7';
    ctx.globalAlpha = zone.arena ? 0.16 : 0.1;
    ctx.fillStyle = color;
    ctx.fillRect(screen.x, screen.y, width, height);
    ctx.globalAlpha = 1;
    ctx.setLineDash(zone.arena ? [] : [Math.max(3, scale * 0.22), Math.max(3, scale * 0.18)]);
    ctx.strokeStyle = color;
    ctx.lineWidth = zone.arena ? 2 : 1.3;
    ctx.strokeRect(screen.x + 0.5, screen.y + 0.5, width - 1, height - 1);
    ctx.setLineDash([]);
    if (state.labels && scale > 4.5) {
      // Zone labels ride their authored anchor instead of the rect corner so
      // they never stack on top of the room-band labels.
      const anchor = cellToScreen(origin, zone.anchor[0], zone.anchor[1]);
      pill(anchor.x + 6, anchor.y - 16, `${zone.id}`, color, 'left', 11);
      if (scale > 9) pill(anchor.x + 6, anchor.y - 1, `${zone.role}${zone.arena ? ' · arena' : ''}`, theme().dim, 'left', 10);
    }
    pushHit({ sceneId: panel.id, kind: 'zone', id: zone.id, label: zone.id, anchor: { x: zone.anchor[0], y: zone.anchor[1] }, rect: { x: zx, y: zy, w: zw, h: zh }, item: zone });
  }
  ctx.restore();
}

function drawRooms(panel, origin, mode) {
  const t = theme();
  const scale = cam.scale;
  ctx.save();
  for (const room of panel.rooms) {
    const bounds = room.bounds;
    const screen = cellToScreen(origin, bounds.minX, bounds.minZ);
    const width = (bounds.maxX - bounds.minX) * scale;
    const height = (bounds.maxZ - bounds.minZ) * scale;
    const roomId = String(room.id || room.name || '').toLowerCase();
    const focusRoom = state.focus && /hero|boss|exit|vault|cache|altar/.test(roomId);
    ctx.globalAlpha = state.focus ? (focusRoom ? 0.2 : 0.065) : 0.12;
    ctx.fillStyle = room.color;
    const hasFootprint = Array.isArray(room.footprint) && room.footprint.length > 0;
    if (hasFootprint) {
      for (let z = 0; z < room.footprint.length; z += 1) {
        const row = room.footprint[z] || '';
        for (let x = 0; x < row.length; x += 1) {
          if (row[x] !== '1') continue;
          ctx.fillRect(screen.x + x * scale, screen.y + z * scale, scale, scale);
        }
      }
    } else {
      ctx.fillRect(screen.x, screen.y, width, height);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = room.color;
    ctx.lineWidth = 1.6;
    if (hasFootprint) {
      const contains = (x, z) => x >= 0 && z >= 0
        && z < room.footprint.length
        && room.footprint[z]?.[x] === '1';
      ctx.beginPath();
      for (let z = 0; z < room.footprint.length; z += 1) {
        const row = room.footprint[z] || '';
        for (let x = 0; x < row.length; x += 1) {
          if (!contains(x, z)) continue;
          const left = screen.x + x * scale;
          const top = screen.y + z * scale;
          const right = left + scale;
          const bottom = top + scale;
          if (!contains(x, z - 1)) { ctx.moveTo(left, top); ctx.lineTo(right, top); }
          if (!contains(x + 1, z)) { ctx.moveTo(right, top); ctx.lineTo(right, bottom); }
          if (!contains(x, z + 1)) { ctx.moveTo(right, bottom); ctx.lineTo(left, bottom); }
          if (!contains(x - 1, z)) { ctx.moveTo(left, bottom); ctx.lineTo(left, top); }
        }
      }
      ctx.stroke();
    } else {
      ctx.strokeRect(screen.x + 0.5, screen.y + 0.5, width - 1, height - 1);
    }
    if (state.labels && scale > 4.5) {
      const title = `${room.sequence}. ${room.name}`;
      const firstTopCell = hasFootprint ? Math.max(0, room.footprint[0].indexOf('1')) : 0;
      pill(screen.x + firstTopCell * scale + 6, screen.y + 6, title, room.color, 'left', scale > 12 ? 13 : 11);
      if (scale > 12 && !state.focus && (state.mode !== 'dungeon' || scale < 24)) {
        const encounter = room.encounter || {};
        pill(screen.x + 6, screen.y + 24, `${room.role.toUpperCase()} · TIER ${encounter.tier ?? '-'} · BUDGET ${encounter.budget ?? 0}`, t.dim, 'left', 10.5);
      }
    }
    pushHit({ sceneId: panel.id, kind: 'room', id: room.id, label: room.name, anchor: { x: room.center.x, y: room.center.y }, rect: { x: bounds.minX, y: bounds.minZ, w: bounds.maxX - bounds.minX, h: bounds.maxZ - bounds.minZ }, item: room, always: true });
  }
  ctx.restore();
}

function drawRoutes(panel, origin) {
  const scale = cam.scale;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const route of panel.routes) {
    const color = route.color || ROUTE_ROLE_COLORS[route.role] || '#8b93a7';
    const points = route.points.map(([x, y]) => cellToScreen(origin, x + 0.5, y + 0.5));
    if (points.length < 2) continue;
    ctx.globalAlpha = route.combatLane ? 0.32 : 0.22;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(3, route.width * scale);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = Math.max(1.4, scale * 0.09);
    ctx.setLineDash([Math.max(4, scale * 0.4), Math.max(4, scale * 0.32)]);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const middle = points[Math.floor(points.length / 2)];
    if (state.labels && scale > 6) {
      pill(middle.x + 6, middle.y - 16, `${route.id}`, color, 'left', 10.5);
    }
    pushHit({
      sceneId: panel.id,
      kind: 'route',
      id: route.id,
      label: route.id,
      anchor: { x: route.points[0][0] + 0.5, y: route.points[0][1] + 0.5 },
      rect: boundsOfPolyline(route.points, route.width / 2),
      item: route,
    });
  }
  ctx.restore();
}

// Story-mode corridors read as carved floor lanes, not glowing route spines.
function drawCorridors(panel, origin) {
  const scale = cam.scale;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const corridor of panel.corridors || []) {
    const color = corridor.color || '#f2a33c';
    const points = corridor.points.map(([x, y]) => cellToScreen(origin, x + 0.5, y + 0.5));
    if (points.length < 2) continue;
    ctx.globalAlpha = corridor.role === 'vent' ? 0.22 : 0.3;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2.5, corridor.width * scale);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.globalAlpha = corridor.role === 'vent' ? 0.6 : 0.45;
    ctx.lineWidth = Math.max(1, scale * 0.06);
    ctx.setLineDash([Math.max(3, scale * 0.34), Math.max(3, scale * 0.3)]);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    const middle = points[Math.floor(points.length / 2)];
    if (storyDetailLabel('corridor', corridor, scale) && scale > 9) pill(middle.x + 6, middle.y + 12, `${corridor.role} · ${Math.round(corridor.lengthMeters)} m`, color, 'left', 10);
    pushHit({
      sceneId: panel.id,
      kind: 'corridor',
      id: corridor.id,
      label: `${corridor.role} corridor`,
      anchor: { x: corridor.points[0][0] + 0.5, y: corridor.points[0][1] + 0.5 },
      rect: boundsOfPolyline(corridor.points, corridor.width / 2),
      item: corridor,
    });
  }
  ctx.restore();
}

function drawOpenings(panel, origin) {
  const t = theme();
  const scale = cam.scale;
  ctx.save();
  for (const opening of panel.openings || []) {
    const keyed = !!opening.keyId;
    const color = opening.secret ? '#59e0d0' : keyed ? '#ff6b5e' : opening.role === 'door' ? t.warn : t.good;
    const horizontal = opening.axis === 'h';
    const span = opening.span;
    const from = horizontal ? cellToScreen(origin, span[0], opening.at) : cellToScreen(origin, opening.at, span[0]);
    const to = horizontal ? cellToScreen(origin, span[1] + 1, opening.at) : cellToScreen(origin, opening.at, span[1] + 1);
    ctx.strokeStyle = '#000000a8';
    ctx.lineWidth = Math.max(5, scale * 0.34);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2.4, scale * 0.2);
    if (opening.role === 'vent') ctx.setLineDash([Math.max(3, scale * 0.22), Math.max(3, scale * 0.18)]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    if (scale > 8) {
      ctx.fillStyle = '#07070ad0';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(middle.x, middle.y, Math.max(5, scale * 0.24), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      if (keyed) {
        ctx.arc(middle.x - scale * 0.06, middle.y, scale * 0.06, 0, Math.PI * 2);
        ctx.moveTo(middle.x - scale * 0.0, middle.y);
        ctx.lineTo(middle.x + scale * 0.11, middle.y);
      } else if (opening.role === 'door') {
        ctx.rect(middle.x - scale * 0.09, middle.y - scale * 0.01, scale * 0.18, scale * 0.13);
        ctx.arc(middle.x, middle.y - scale * 0.02, scale * 0.07, Math.PI, Math.PI * 2);
      } else if (opening.role === 'vent') {
        ctx.moveTo(middle.x - scale * 0.09, middle.y - scale * 0.06);
        ctx.lineTo(middle.x + scale * 0.09, middle.y + scale * 0.06);
        ctx.moveTo(middle.x + scale * 0.09, middle.y - scale * 0.06);
        ctx.lineTo(middle.x - scale * 0.09, middle.y + scale * 0.06);
      } else {
        ctx.moveTo(middle.x - scale * 0.08, middle.y);
        ctx.lineTo(middle.x + scale * 0.09, middle.y);
        ctx.moveTo(middle.x + scale * 0.02, middle.y - scale * 0.07);
        ctx.lineTo(middle.x + scale * 0.09, middle.y);
        ctx.lineTo(middle.x + scale * 0.02, middle.y + scale * 0.07);
      }
      ctx.stroke();
    }
    if (state.labels && scale > 15) {
      const label = opening.secret ? 'secret vent' : keyed ? `key gate · ${opening.keyId}` : opening.role;
      pill(middle.x + 7, middle.y - 13, label, color, 'left', 10);
    }
    pushHit({
      sceneId: panel.id,
      kind: 'opening',
      id: opening.id,
      label: `${opening.role} ${opening.id}`,
      anchor: { x: opening.anchor.x, y: opening.anchor.y },
      r: Math.max(9, scale * 0.45),
      item: opening,
    });
  }
  ctx.restore();
}

function drawPicks(panel, origin) {
  const scale = cam.scale;
  ctx.save();
  for (const key of panel.keys || []) {
    const screen = cellToScreen(origin, key.at[0] + 0.5, key.at[1] + 0.5);
    const size = Math.max(7, scale * 0.34);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, size, 0, Math.PI * 2);
    ctx.fillStyle = '#0b0b0fe0';
    ctx.fill();
    ctx.strokeStyle = '#ffd479';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.rotate(-0.5);
    ctx.strokeStyle = '#ffd479';
    ctx.lineWidth = Math.max(1.4, size * 0.16);
    ctx.beginPath();
    ctx.arc(-size * 0.28, -size * 0.14, size * 0.3, 0, Math.PI * 2);
    ctx.moveTo(size * 0.02, size * 0.06);
    ctx.lineTo(size * 0.52, size * 0.5);
    ctx.moveTo(size * 0.24, size * 0.24);
    ctx.lineTo(size * 0.4, size * 0.44);
    ctx.stroke();
    ctx.restore();
    if (storyDetailLabel('key', key, scale) && scale > 7) pill(screen.x + 9, screen.y + 10, key.name, '#ffd479', 'left', 11);
    pushHit({
      sceneId: panel.id,
      kind: 'key',
      id: key.id,
      label: key.name,
      anchor: { x: key.at[0] + 0.5, y: key.at[1] + 0.5 },
      r: Math.max(10, scale * 0.5),
      item: key,
    });
  }
  for (const secret of panel.secrets || []) {
    const screen = cellToScreen(origin, secret.at[0], secret.at[1]);
    const size = Math.max(8, scale * 0.4);
    ctx.fillStyle = '#07201c';
    ctx.strokeStyle = '#59e0d0';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = screen.x + Math.cos(angle) * size;
      const py = screen.y + Math.sin(angle) * size;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#59e0d0';
    ctx.font = `700 ${Math.max(9, size)}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', screen.x, screen.y + 0.5);
    if (storyDetailLabel('secret', secret, scale) && scale > 7) pill(screen.x + 10, screen.y - 10, `${secret.name} · ${secret.reward}`, '#59e0d0', 'left', 10.5);
    pushHit({
      sceneId: panel.id,
      kind: 'secret',
      id: secret.id,
      label: secret.name,
      anchor: { x: secret.at[0], y: secret.at[1] },
      r: Math.max(10, scale * 0.5),
      item: secret,
    });
  }
  ctx.restore();
}

function drawConnections(panel, origin) {
  const scale = cam.scale;
  ctx.save();
  for (const connection of panel.connections || []) {
    const screen = cellToScreen(origin, connection.at[0], connection.at[1]);
    const size = Math.max(10, scale * 0.6);
    const color = connection.kind === 'end' ? '#ffd479' : '#7fb2ff';
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, size, 0, Math.PI * 2);
    ctx.fillStyle = '#08080bd8';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = `700 ${Math.max(10, size * 0.9)}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(connection.kind === 'lift' ? '▼' : connection.kind === 'stair' ? '≡' : connection.kind === 'drop' ? '↓' : '■', screen.x, screen.y + 0.5);
    if (state.labels && scale > 5) pill(screen.x + size + 6, screen.y - 10, connection.label, color, 'left', 11);
    pushHit({
      sceneId: panel.id,
      kind: 'connection',
      id: connection.id,
      label: connection.label,
      anchor: { x: connection.at[0], y: connection.at[1] },
      r: Math.max(11, size * 1.2),
      item: connection,
    });
  }
  ctx.restore();
}

function drawProps(panel, origin) {
  const scale = cam.scale;
  ctx.save();
  for (const item of panel.props || []) {
    const screen = cellToScreen(origin, item.x, item.y);
    const radius = Math.max(1.2, item.r * scale);
    ctx.globalAlpha = item.kind === 'fog' ? 0.3 : 0.9;
    ctx.fillStyle = item.color;
    if (item.kind === 'candle') {
      const glow = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, Math.max(4, radius * 5));
      glow.addColorStop(0, hexAlpha(item.color, 0.5));
      glow.addColorStop(1, hexAlpha(item.color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, Math.max(4, radius * 5), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, Math.max(1.2, radius * 0.5), 0, Math.PI * 2);
      ctx.fill();
    } else if (item.kind === 'gore' || item.kind === 'blood' || item.kind === 'fog') {
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, radius * 1.5, radius, (item.r * 7) % Math.PI, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.kind === 'bones') {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = Math.max(1, radius * 0.5);
      for (let i = 0; i < 3; i += 1) {
        const angle = (i / 3) * Math.PI * 2 + item.r * 9;
        ctx.beginPath();
        ctx.moveTo(screen.x - Math.cos(angle) * radius, screen.y - Math.sin(angle) * radius);
        ctx.lineTo(screen.x + Math.cos(angle) * radius, screen.y + Math.sin(angle) * radius);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(screen.x + radius * 0.6, screen.y - radius * 0.4, Math.max(1, radius * 0.45), 0, Math.PI * 2);
      ctx.fillStyle = item.color;
      ctx.fill();
    } else if (item.kind === 'skull') {
      const size = Math.max(3.5, radius * 2.1);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, size, 0, Math.PI * 2);
      ctx.fillStyle = item.color;
      ctx.fill();
      ctx.beginPath();
      ctx.rect(screen.x - size * 0.45, screen.y + size * 0.55, size * 0.9, size * 0.5);
      ctx.fill();
      ctx.fillStyle = '#120d10';
      ctx.beginPath();
      ctx.arc(screen.x - size * 0.36, screen.y - size * 0.1, size * 0.26, 0, Math.PI * 2);
      ctx.arc(screen.x + size * 0.36, screen.y - size * 0.1, size * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(screen.x - size * 0.12, screen.y + size * 0.35, size * 0.24, size * 0.4);
    } else if (item.kind === 'eyes') {
      const size = Math.max(2.2, radius * 1.1);
      for (const side of [-1, 1]) {
        const ex = screen.x + side * size * 1.5;
        const glow = ctx.createRadialGradient(ex, screen.y, 0, ex, screen.y, size * 5);
        glow.addColorStop(0, hexAlpha(item.color, 0.55));
        glow.addColorStop(1, hexAlpha(item.color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(ex, screen.y, size * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.ellipse(ex, screen.y, size, size * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#120d10';
        ctx.beginPath();
        ctx.ellipse(ex, screen.y, size * 0.34, size * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (item.kind === 'limb') {
      ctx.save();
      ctx.translate(screen.x, screen.y);
      ctx.rotate(item.r * 9);
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(3.5, radius * 2.2), Math.max(1.6, radius * 0.8), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d8cdb4';
      ctx.beginPath();
      ctx.arc(Math.max(3, radius * 2), 0, Math.max(1.1, radius * 0.55), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (item.kind === 'altar') {
      const size = Math.max(5, radius * 3);
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(screen.x - size, screen.y - size * 0.7, size * 2, size * 1.4);
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y - size * 1.5);
      ctx.lineTo(screen.x, screen.y + size * 0.9);
      ctx.moveTo(screen.x - size * 0.7, screen.y - size * 0.5);
      ctx.lineTo(screen.x + size * 0.7, screen.y - size * 0.5);
      ctx.stroke();
    } else if (item.kind === 'barrel') {
      const size = Math.max(2.6, radius * 1.5);
      const tipped = item.r > 0.42;
      ctx.save();
      ctx.translate(screen.x, screen.y);
      if (tipped) ctx.rotate(item.r * 12);
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, size, size * (tipped ? 0.62 : 0.86), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2a1a10';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.55, size * (tipped ? 0.34 : 0.48), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (tipped) {
        ctx.fillStyle = '#141014cc';
        ctx.beginPath();
        ctx.ellipse(screen.x + size * 1.6, screen.y + size * 0.7, size * 1.3, size * 0.7, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (item.kind === 'bloodpile' || item.kind === 'bodypile') {
      const size = Math.max(2.4, radius * (item.kind === 'bodypile' ? 2.3 : 3));
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, size * 1.5, size, item.r * 4, 0, Math.PI * 2);
      ctx.fill();
      if (item.kind === 'bodypile') {
        ctx.fillStyle = '#8d5a5e';
        for (let i = 0; i < 4; i += 1) {
          const angle = i * 1.7 + item.r * 6;
          ctx.beginPath();
          ctx.ellipse(screen.x + Math.cos(angle) * size * 0.8, screen.y + Math.sin(angle) * size * 0.6, size * 0.62, size * 0.34, angle, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#ded3b8';
        ctx.beginPath();
        ctx.arc(screen.x - size * 0.6, screen.y - size * 0.4, size * 0.34, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#3d0810';
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y, size * 0.9, size * 0.6, item.r * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (item.kind === 'cage' || item.kind === 'crate') {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(screen.x - radius, screen.y - radius, radius * 2, radius * 2);
      ctx.beginPath();
      ctx.moveTo(screen.x - radius, screen.y);
      ctx.lineTo(screen.x + radius, screen.y);
      ctx.moveTo(screen.x, screen.y - radius);
      ctx.lineTo(screen.x, screen.y + radius);
      ctx.stroke();
    } else if (item.kind === 'sigil') {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, Math.max(6, radius * 3), 0, Math.PI * 2);
      ctx.moveTo(screen.x - radius * 3, screen.y);
      ctx.lineTo(screen.x + radius * 3, screen.y);
      ctx.moveTo(screen.x, screen.y - radius * 3);
      ctx.lineTo(screen.x, screen.y + radius * 3);
      ctx.stroke();
    } else if (item.kind === 'webs') {
      ctx.strokeStyle = hexAlpha(item.color, 0.6);
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, Math.max(3, radius * (1 + i * 0.6)), i * 2.1, i * 2.1 + 2.4);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, radius * 1.4, radius * 0.8, item.r * 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawScares(panel, origin) {
  const scale = cam.scale;
  ctx.save();
  for (const scare of panel.scares || []) {
    const screen = cellToScreen(origin, scare.anchor[0], scare.anchor[1]);
    const size = Math.max(9, scale * 0.5);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, size * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = hexAlpha(scare.color, 0.18);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, size, 0, Math.PI * 2);
    ctx.fillStyle = '#0b0b0fe8';
    ctx.fill();
    ctx.strokeStyle = scare.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = scare.color;
    ctx.font = `700 ${Math.max(10, size)}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('☠', screen.x, screen.y + 0.5);
    if (state.labels && scale > 8) pill(screen.x + size + 6, screen.y - 8, scare.role, scare.color, 'left', 10.5);
    pushHit({
      sceneId: panel.id,
      kind: 'scare',
      id: scare.id,
      label: `${scare.role} beat`,
      anchor: { x: scare.anchor[0], y: scare.anchor[1] },
      r: Math.max(11, size * 1.5),
      item: scare,
    });
  }
  ctx.restore();
}

function boundsOfPolyline(points, pad) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

function drawPortals(panel, origin) {
  const t = theme();
  const scale = cam.scale;
  ctx.save();
  for (const room of panel.rooms) {
    for (const portal of room.portals) {
      if (portal.kind === 'flank') {
        const from = cellToScreen(origin, portal.at, portal.span[0]);
        const to = cellToScreen(origin, portal.at, portal.span[1]);
        ctx.setLineDash([Math.max(3, scale * 0.24), Math.max(3, scale * 0.2)]);
        ctx.strokeStyle = t.info;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.setLineDash([]);
      if (storyDetailLabel('flank', { id: 'flank-lane' }, scale) && scale > 12) pill(from.x + 4, from.y + 4, 'flank lane', t.info, 'left', 10);
        pushHit({ sceneId: panel.id, kind: 'portal', id: portal.id, label: `${room.name} flank lane`, anchor: { x: portal.at, y: (portal.span[0] + portal.span[1]) / 2 }, item: { ...portal, room: room.name } });
        continue;
      }
      const locked = portal.lockedBy === 'room-clear';
      const from = cellToScreen(origin, portal.span[0], portal.at);
      const to = cellToScreen(origin, portal.span[1], portal.at);
      ctx.strokeStyle = locked ? t.warn : t.good;
      ctx.lineWidth = Math.max(3, scale * 0.22);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      for (const point of [from, to]) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, Math.max(2, scale * 0.13), 0, Math.PI * 2);
        ctx.fillStyle = locked ? t.warn : t.good;
        ctx.fill();
      }
      const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      if (storyDetailLabel('opening', opening, scale) && scale > 38) {
        pill(middle.x + 5, middle.y - 15, `${locked ? 'sealed' : 'open'} · ${portal.kind}`, locked ? t.warn : t.good, 'left', 10);
      } else if (state.labels && scale > 10) {
        // Compact glyph keeps every threshold identifiable without six long
        // text pills fighting the landmark labels for the same row.
        const color = locked ? t.warn : t.good;
        ctx.save();
        ctx.fillStyle = '#07070ad0';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(middle.x, middle.y, Math.max(5, scale * 0.22), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        if (locked) {
          ctx.rect(middle.x - scale * 0.09, middle.y - scale * 0.01, scale * 0.18, scale * 0.13);
          ctx.arc(middle.x, middle.y - scale * 0.02, scale * 0.07, Math.PI, Math.PI * 2);
        } else {
          ctx.moveTo(middle.x - scale * 0.08, middle.y);
          ctx.lineTo(middle.x + scale * 0.09, middle.y);
          ctx.moveTo(middle.x + scale * 0.02, middle.y - scale * 0.07);
          ctx.lineTo(middle.x + scale * 0.09, middle.y);
          ctx.lineTo(middle.x + scale * 0.02, middle.y + scale * 0.07);
        }
        ctx.stroke();
        ctx.restore();
      }
      pushHit({ sceneId: panel.id, kind: 'portal', id: portal.id, label: `${room.name} ${portal.kind}`, anchor: { x: (portal.span[0] + portal.span[1]) / 2, y: portal.at }, item: { ...portal, room: room.name, roomId: room.id, axisHint: 'horizontal' } });
    }
  }
  ctx.restore();
}

function drawLights(panel, origin) {
  const scale = cam.scale;
  ctx.save();
  const radius = 4 * scale;
  for (const light of panel.lights) {
    const screen = cellToScreen(origin, light.anchor[0], light.anchor[1]);
    const gradient = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, Math.max(6, radius));
    gradient.addColorStop(0, hexAlpha(light.color, 0.3));
    gradient.addColorStop(0.45, hexAlpha(light.color, 0.11));
    gradient.addColorStop(1, hexAlpha(light.color, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, Math.max(6, radius), 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, Math.max(2.2, scale * 0.14), 0, Math.PI * 2);
    ctx.fillStyle = light.color;
    ctx.fill();
    pushHit({ sceneId: panel.id, kind: 'light', id: light.id, label: `${light.role} light`, anchor: { x: light.anchor[0], y: light.anchor[1] }, r: Math.max(9, scale * 0.4), item: light });
    if (storyDetailLabel('light', light, scale) && scale > 11) pill(screen.x + 6, screen.y + 6, light.role, light.color, 'left', 10);
  }
  ctx.restore();
}

function drawSetpieces(panel, origin) {
  const scale = cam.scale;
  ctx.save();
  for (const item of panel.setpieces) {
    const color = item.color || '#c8c8d4';
    if (item.points.length > 1) {
      const points = item.points.map(([x, y]) => cellToScreen(origin, x, y));
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(3, item.width * scale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([Math.max(3, scale * 0.3), Math.max(3, scale * 0.24)]);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
      ctx.stroke();
      ctx.setLineDash([]);
      pushHit({ sceneId: panel.id, kind: 'setpiece', id: item.id, label: item.id, anchor: { x: item.points[0][0], y: item.points[0][1] }, rect: boundsOfPolyline(item.points, item.width / 2), item });
    } else {
      const width = (item.size?.[0] ?? item.width) * scale;
      const depth = (item.size?.[2] ?? 1.2) * scale;
      const screen = cellToScreen(origin, item.anchor[0] - (item.size?.[0] ?? item.width) / 2, item.anchor[1] - (item.size?.[2] ?? 1.2) / 2);
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = color;
      ctx.fillRect(screen.x, screen.y, width, depth);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(screen.x + 0.5, screen.y + 0.5, width - 1, depth - 1);
      pushHit({ sceneId: panel.id, kind: 'setpiece', id: item.id, label: item.id, anchor: { x: item.anchor[0], y: item.anchor[1] }, r: Math.max(10, scale * 0.4), item });
    }
    const screen = cellToScreen(origin, item.anchor[0], item.anchor[1]);
    if (storyDetailLabel('setpiece', item, scale) && scale > 10) pill(screen.x + 6, screen.y + 6, `${item.id}`, color, 'left', 10);
  }
  ctx.restore();
}

function drawMachinery(panel, origin) {
  const t = theme();
  const scale = cam.scale;
  ctx.save();
  for (const item of panel.machinery) {
    const width = Math.max(0.7, item.span[0]) * scale;
    const depth = Math.max(0.7, item.span[1]) * scale;
    const screen = cellToScreen(origin, item.anchor[0] - Math.max(0.7, item.span[0]) / 2, item.anchor[1] - Math.max(0.7, item.span[1]) / 2);
    ctx.globalAlpha = 0.26;
    ctx.fillStyle = t.accent;
    ctx.fillRect(screen.x, screen.y, width, depth);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(screen.x + 0.5, screen.y + 0.5, width - 1, depth - 1);
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y);
    ctx.lineTo(screen.x + width, screen.y + depth);
    ctx.moveTo(screen.x + width, screen.y);
    ctx.lineTo(screen.x, screen.y + depth);
    ctx.strokeStyle = hexAlpha(t.accent, 0.6);
    ctx.lineWidth = 1;
    ctx.stroke();
    const center = cellToScreen(origin, item.anchor[0], item.anchor[1]);
    if (storyDetailLabel('machinery', item, scale) && scale > 8) pill(center.x + 6, center.y + 6, item.id, t.accent, 'left', 10);
    pushHit({ sceneId: panel.id, kind: 'machinery', id: item.id, label: item.id, anchor: { x: item.anchor[0], y: item.anchor[1] }, r: Math.max(10, scale * 0.4), item });
  }
  ctx.restore();
}

function drawLandmarks(panel, origin, mode) {
  const t = theme();
  const scale = cam.scale;
  ctx.save();
  for (const item of panel.landmarks) {
    const center = cellToScreen(origin, item.anchor[0], item.anchor[1]);
    const width = Math.max(1, item.size[0]) * scale;
    const depth = Math.max(1, item.size[2]) * scale;
    ctx.globalAlpha = item.hero ? 0.34 : 0.22;
    ctx.fillStyle = item.hero ? t.bad : t.accent;
    ctx.fillRect(center.x - width / 2, center.y - depth / 2, width, depth);
    ctx.globalAlpha = 1;
    ctx.setLineDash(item.hero ? [] : [Math.max(3, scale * 0.2), Math.max(3, scale * 0.16)]);
    ctx.strokeStyle = item.hero ? t.bad : t.accent;
    ctx.lineWidth = item.hero ? 2 : 1.3;
    ctx.strokeRect(center.x - width / 2, center.y - depth / 2, width, depth);
    ctx.setLineDash([]);
    diamond(center.x, center.y, Math.max(4, scale * 0.3), item.hero ? t.bad : t.accent, item.hero);
    if (storyDetailLabel('landmark', item, scale) && scale > 6.5) {
      pill(center.x + 7, center.y + Math.max(6, scale * 0.3), item.id, item.hero ? t.bad : t.text, 'left', item.hero && scale > 12 ? 12 : 10.5);
      if (scale > 12 && mode === 'detail' && !state.focus) pill(center.x + 7, center.y + Math.max(6, scale * 0.3) + 15, `${item.type}${item.animated ? ' · ' + item.animated : ''}`, t.dim, 'left', 10);
    }
    pushHit({ sceneId: panel.id, kind: 'landmark', id: item.id, label: item.id, anchor: { x: item.anchor[0], y: item.anchor[1] }, r: Math.max(11, scale * 0.42), item });
  }
  ctx.restore();
}

function drawSpawns(panel, origin) {
  const t = theme();
  const scale = cam.scale;
  ctx.save();
  for (const spawn of panel.spawns) {
    const screen = cellToScreen(origin, spawn.x, spawn.y);
    const waves = spawn.usage.length;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, Math.max(5, scale * 0.32), 0, Math.PI * 2);
    ctx.fillStyle = '#0b0b0fd0';
    ctx.fill();
    ctx.strokeStyle = waves ? t.info : t.dim;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.fillStyle = waves ? t.info : t.dim;
    ctx.font = `600 ${Math.max(9, Math.min(13, scale * 0.52))}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(spawn.index), screen.x, screen.y + 0.5);
    pushHit({ sceneId: panel.id, kind: 'spawn', id: spawn.id, label: `spawn ${spawn.index}`, anchor: { x: spawn.x, y: spawn.y }, r: Math.max(9, scale * 0.5), item: spawn });
  }
  ctx.restore();
}

function drawAnchors(panel, origin) {
  const t = theme();
  const scale = cam.scale;
  const player = cellToScreen(origin, panel.player.x, panel.player.y);
  const angle = panel.player.angle ?? 0;
  const marker = Math.max(9, scale * 0.7);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.arc(player.x, player.y, Math.max(16, scale * 1.6), angle - 0.42, angle + 0.42);
  ctx.closePath();
  ctx.fillStyle = hexAlpha(panel.color, 0.24);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(player.x, player.y, marker * 1.9, 0, Math.PI * 2);
  ctx.strokeStyle = '#000000a0';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = panel.color;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.translate(player.x, player.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(marker, 0);
  ctx.lineTo(-marker * 0.62, marker * 0.58);
  ctx.lineTo(-marker * 0.62, -marker * 0.58);
  ctx.closePath();
  ctx.fillStyle = panel.color;
  ctx.fill();
  ctx.strokeStyle = '#00000088';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  if (state.labels) pill(player.x + 10, player.y + 8, `ENTRY · faces ${compassLabel(angle)}`, panel.color, 'left', 10.5);
  pushHit({ sceneId: panel.id, kind: 'anchor', id: 'player', label: 'player spawn', anchor: { x: panel.player.x, y: panel.player.y }, r: Math.max(12, scale * 0.6), item: { id: 'player', x: panel.player.x, y: panel.player.y, angle } });

  const exit = cellToScreen(origin, panel.exit.x, panel.exit.y);
  const doorW = Math.max(9, scale * 0.7);
  ctx.save();
  ctx.strokeStyle = t.good;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(exit.x - doorW, exit.y + doorW * 0.6);
  ctx.lineTo(exit.x - doorW, exit.y - doorW * 0.6);
  ctx.lineTo(exit.x + doorW, exit.y - doorW * 0.6);
  ctx.lineTo(exit.x + doorW, exit.y + doorW * 0.6);
  ctx.stroke();
  ctx.fillStyle = hexAlpha(t.good, 0.2);
  ctx.fillRect(exit.x - doorW, exit.y - doorW * 0.6, doorW * 2, doorW * 1.2);
  ctx.restore();
  if (state.labels) pill(exit.x + 10, exit.y + 6, 'EXIT', t.good, 'left', 10.5);
  pushHit({ sceneId: panel.id, kind: 'anchor', id: 'exit', label: 'sector exit', anchor: { x: panel.exit.x, y: panel.exit.y }, r: Math.max(12, scale * 0.6), item: { id: 'exit', x: panel.exit.x, y: panel.exit.y } });
}

function drawPath(panel, origin) {
  const route = state.gateMode === 'sealed' ? panel.path.sealed : panel.path.designed;
  const t = theme();
  if (!route || route.length < 2) return;
  ctx.save();
  ctx.strokeStyle = t.path;
  ctx.lineWidth = Math.max(2, cam.scale * 0.12);
  ctx.setLineDash([Math.max(5, cam.scale * 0.42), Math.max(4, cam.scale * 0.3)]);
  ctx.beginPath();
  route.forEach((point, index) => {
    const screen = cellToScreen(origin, point.x, point.y);
    if (index === 0) ctx.moveTo(screen.x, screen.y);
    else ctx.lineTo(screen.x, screen.y);
  });
  ctx.stroke();
  ctx.setLineDash([]);
  const metrics = state.gateMode === 'sealed' ? panel.path.sealedMetrics : panel.path.metrics;
  const middle = route[Math.floor(route.length / 2)];
  const labelPoint = cellToScreen(origin, middle.x, middle.y);
  if (state.labels && cam.scale > 5 && !state.focus) {
    pill(labelPoint.x + 8, labelPoint.y - 10, `${metrics.meters} m · ${metrics.turns} turns`, t.path, 'left', 10.5);
  }
  ctx.restore();
}

function drawDiagnostics(panel, origin) {
  const t = theme();
  const scale = cam.scale;
  ctx.save();
  for (const diagnostic of panel.diagnostics) {
    if (diagnostic.severity === 'info' && scale < 6) continue;
    const color = t[SEVERITY_COLORS[diagnostic.severity] || 'info'];
    const screen = cellToScreen(origin, diagnostic.at.x, diagnostic.at.y);
    const radius = Math.max(6, scale * 0.3);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#0b0b0fe0';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = `700 ${Math.max(9, Math.min(14, scale * 0.55))}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(diagnostic.severity === 'error' ? '!' : diagnostic.severity === 'warn' ? '?' : 'i', screen.x, screen.y + 0.5);
    pushHit({ sceneId: panel.id, kind: 'diagnostic', id: diagnostic.code + ':' + (diagnostic.itemId || '') + ':' + diagnostic.at.x + ',' + diagnostic.at.y, label: diagnostic.code, anchor: { x: diagnostic.at.x, y: diagnostic.at.y }, r: radius * 1.6, item: diagnostic });
  }
  ctx.restore();
}

function drawPanelCaption(panel, origin) {
  const t = theme();
  const topLeft = cellToScreen(origin, 0, 0);
  const scale = cam.scale;
  const dungeon = panel.kind === 'dungeon';
  ctx.save();
  ctx.fillStyle = '#000000a8';
  ctx.fillRect(topLeft.x, topLeft.y, panel.width * scale, Math.max(26, scale * (dungeon ? 2.4 : 1.5)));
  ctx.fillStyle = panel.color;
  ctx.font = `600 ${Math.max(13, Math.min(22, scale * 1.05))}px ${UI}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${dungeon ? `FLOOR 0${panel.depth} · ` : `S${(panel.sectorIndex ?? 0) + 1} · `}${panel.name.toUpperCase()}`, topLeft.x + 8, topLeft.y + Math.max(13, scale * 0.75));
  ctx.fillStyle = t.dim;
  ctx.font = `500 ${Math.max(10, Math.min(14, scale * 0.66))}px ${MONO}`;
  ctx.textAlign = 'right';
  const summary = dungeon
    ? `${panel.stats.routeMeters} m route · ${panel.stats.loops} loops · ${panel.stats.corridorMeters} m corridors`
    : `${panel.stats.routeMeters} m route · ${panel.stats.coverPct}% cover`;
  ctx.fillText(summary, topLeft.x + panel.width * scale - 8, topLeft.y + Math.max(13, scale * 0.75));
  if (dungeon && (panel.signature || panel.blurb)) {
    ctx.textAlign = 'left';
    ctx.fillStyle = hexAlpha(panel.color, 0.9);
    ctx.font = `600 ${Math.max(10, Math.min(16, scale * 0.72))}px ${UI}`;
    ctx.fillText(panel.signature || panel.blurb, topLeft.x + 8, topLeft.y + Math.max(26, scale * 1.75));
    ctx.fillStyle = theme().dim;
    ctx.font = `500 ${Math.max(9, Math.min(13, scale * 0.56))}px ${MONO}`;
    ctx.fillText(panel.wallpaper || '', topLeft.x + 8, topLeft.y + Math.max(38, scale * 2.5));
  }
  ctx.restore();
}

function drawRulers(panel, origin) {
  const t = theme();
  const scale = cam.scale;
  if (scale < 7) return;
  ctx.save();
  ctx.fillStyle = t.dim;
  ctx.font = `500 ${Math.max(9, Math.min(12, scale * 0.4))}px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (let x = 0; x <= panel.width; x += 1) {
    const screen = cellToScreen(origin, x, 0);
    ctx.fillText(String(x), screen.x, screen.y - 4);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let y = 0; y <= panel.height; y += 1) {
    const screen = cellToScreen(origin, 0, y);
    ctx.fillText(String(y), screen.x - 6, screen.y);
  }
  // Metre scale bar under the panel.
  const feet = cellToScreen(origin, 0, panel.height);
  const barCells = 4;
  const barWidth = barCells * scale;
  const barY = feet.y + Math.max(14, scale * 0.8);
  ctx.strokeStyle = t.text;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(feet.x, barY);
  ctx.lineTo(feet.x + barWidth, barY);
  ctx.moveTo(feet.x, barY - 4);
  ctx.lineTo(feet.x, barY + 4);
  ctx.moveTo(feet.x + barWidth, barY - 4);
  ctx.lineTo(feet.x + barWidth, barY + 4);
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = t.dim;
  ctx.fillText(`${barCells * CELL} m`, feet.x + barWidth + 6, barY - 6);
  ctx.restore();
}

function drawMeasure(scene, layout) {
  if (state.measurePoints.length === 0) return;
  const t = theme();
  const points = state.measurePoints;
  const project = point => {
    const origin = layout.origin(Math.max(0, Math.min(panelsOf(scene).length - 1, point.index ?? 0)));
    return cellToScreen(origin, point.x, point.y);
  };
  ctx.save();
  ctx.strokeStyle = t.accent;
  ctx.lineWidth = 1.6;
  ctx.setLineDash([5, 4]);
  for (const point of points) {
    const screen = project(point);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (points.length === 2) {
    const a = project(points[0]);
    const b = project(points[1]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const dx = points[1].x - points[0].x;
    const dy = points[1].y - points[0].y;
    const meters = Math.hypot(dx, dy) * CELL;
    const bearing = compassLabel(Math.atan2(dy, dx));
    pill((a.x + b.x) / 2 + 8, (a.y + b.y) / 2 - 12, `${meters.toFixed(1)} m · ${Math.hypot(dx, dy).toFixed(2)} cells · ${bearing}`, t.accent, 'left', 11.5);
  }
  ctx.restore();
}

function drawHoverTip() {
  if (!state.hover || state.drag) return;
  const t = theme();
  const lines = state.hover.tip || [];
  if (!lines.length) return;
  const width = Math.max(...lines.map(line => ctx.measureText(line).width)) + 18;
  const height = lines.length * 14 + 12;
  let x = state.pointer.x + 14;
  let y = state.pointer.y + 14;
  if (x + width > dom.stage.clientWidth - 8) x = state.pointer.x - width - 12;
  if (y + height > dom.stage.clientHeight - 8) y = dom.stage.clientHeight - height - 8;
  ctx.save();
  roundRect(x, y, width, height, 4);
  ctx.fillStyle = '#0b0b0ff0';
  ctx.fill();
  ctx.strokeStyle = t.panelEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = `500 11.5px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((line, index) => {
    ctx.fillStyle = index === 0 ? t.accent : t.text;
    ctx.fillText(line, x + 9, y + 7 + index * 14);
  });
  ctx.restore();
}

// ------------------------------------------------------------------- helpers

function pushHit(hit) {
  hits.push(hit);
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function pill(x, y, text, color, align = 'left', size = 11) {
  ctx.save();
  ctx.font = `600 ${size}px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const width = ctx.measureText(text).width + 10;
  const height = size + 7;
  const left = align === 'left' ? x : x - width;
  // Keep dense areas (gallery landmarks, props, doors) legible by nudging a
  // label down when it would collide and dropping it when there is no room.
  let top = y - height / 2;
  let placed = false;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const box = { x: left, y: top, w: width, h: height };
    if (!labelBoxes.some(other => box.x < other.x + other.w && box.x + box.w > other.x && box.y < other.y + other.h && box.y + box.h > other.y)) {
      labelBoxes.push(box);
      placed = true;
      break;
    }
    top += height + 3;
  }
  if (!placed) {
    ctx.restore();
    return;
  }
  ctx.fillStyle = '#07070ad0';
  roundRect(left, top, width, height, 3);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(text, left + 5, top + height / 2 + 0.5);
  ctx.restore();
}

function diamond(x, y, size, color, filled) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size, y);
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function hexAlpha(hex, alpha) {
  const value = String(hex || '#ffffff').replace('#', '');
  const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value.padEnd(6, '0');
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// -------------------------------------------------------------------- picking

function pickAt(screenX, screenY) {
  let best = null;
  for (let i = hits.length - 1; i >= 0; i -= 1) {
    const hit = hits[i];
    if (hit.kind === 'room') continue;
    if (hit.r) {
      const screen = hitScreen(hit);
      if (!screen) continue;
      const distance = Math.hypot(screen.x - screenX, screen.y - screenY);
      if (distance <= hit.r * 1.5) best = { ...hit, distance, tip: tipFor(hit) };
      if (best) return best;
      continue;
    }
    if (hit.rect) {
      const screen = hitScreen(hit);
      if (!screen) continue;
      const width = hit.rect.w * cam.scale;
      const height = hit.rect.h * cam.scale;
      if (screenX >= screen.x && screenX <= screen.x + width && screenY >= screen.y && screenY <= screen.y + height) {
        return { ...hit, tip: tipFor(hit) };
      }
    }
  }
  if (best) return best;
  for (let i = hits.length - 1; i >= 0; i -= 1) {
    const hit = hits[i];
    if (hit.kind !== 'room' || !hit.rect) continue;
    const screen = hitScreen(hit);
    if (!screen) continue;
    const width = hit.rect.w * cam.scale;
    const height = hit.rect.h * cam.scale;
    if (screenX >= screen.x && screenX <= screen.x + width && screenY >= screen.y && screenY <= screen.y + height) {
      return { ...hit, tip: tipFor(hit) };
    }
  }
  return null;
}

function hitScreen(hit) {
  const panel = findPanel(hit.sceneId);
  if (!panel) return null;
  const layout = layoutOf(currentScene());
  const index = panelsOf(currentScene()).indexOf(panel);
  const origin = layout.origin(index);
  return cellToScreen(origin, hit.anchor.x, hit.anchor.y);
}

function findPanel(sceneId) {
  return panelsOf(currentScene()).find(panel => panel.id === sceneId) || null;
}

function tipFor(hit) {
  const panel = findPanel(hit.sceneId);
  const position = `cell ${round(hit.anchor.x)}, ${round(hit.anchor.y)} · ${round(hit.anchor.x * CELL)} m, ${round(hit.anchor.y * CELL)} m`;
  if (!panel) return [hit.label, position];
  switch (hit.kind) {
    case 'room': {
      const room = hit.item;
      const encounter = room.encounter || {};
      return [
        `${room.sequence}. ${room.name}`,
        `${room.role} · tier ${encounter.tier ?? '-'} · budget ${encounter.budget ?? 0}`,
        `${room.size.w} × ${room.size.d} cells (${round(room.size.w * CELL)} × ${round(room.size.d * CELL)} m)`,
        position,
      ];
    }
    case 'spawn': {
      const spawn = hit.item;
      const usage = spawn.usage.map(item => `w${item.wave} ${item.variant}@${item.delay}s`).join(', ');
      return [hit.label, usage || 'unused by any wave', position];
    }
    case 'landmark':
      return [hit.item.id, `${hit.item.type}${hit.item.hero ? ' · hero' : ''}${hit.item.animated ? ' · ' + hit.item.animated : ''}`, `authored size ${hit.item.size.join(' × ')} cells`, position];
    case 'machinery':
      return [hit.item.id, `${hit.item.type}${hit.item.motion ? ' · ' + hit.item.motion : ''}`, `span ${hit.item.span.join(' × ')} cells`, position];
    case 'setpiece':
      return [hit.item.id, hit.item.type, position];
    case 'light':
      return [hit.item.id, `${hit.item.color} · intensity ${hit.item.intensity}`, position];
    case 'zone':
      return [hit.item.id, hit.item.role, `rect ${hit.item.rect.join(', ')} cells · cue ${hit.item.cue || '-'}`, position];
    case 'route':
      return [hit.item.id, `${hit.item.role} route · ${hit.item.width} cells wide`, `${hit.item.points.length} authored points`, position];
    case 'portal':
      return [hit.label, `${hit.item.kind}${hit.item.lockedBy ? ' · locked by ' + hit.item.lockedBy : ''}`, `span ${hit.item.span.join('-')} at ${hit.item.axis} ${hit.item.at}`, position];
    case 'diagnostic':
      return [hit.item.code, hit.item.message, position];
    case 'corridor':
      return [hit.item.id, `${hit.item.role} corridor · ${hit.item.width} cells wide`, `${Math.round(hit.item.lengthMeters)} m long`, position];
    case 'opening': {
      const parts = [`${hit.item.role}${hit.item.secret ? ' · secret' : ''}`];
      if (hit.item.keyId) parts.push(`opens with ${hit.item.keyId}`);
      else if (hit.item.lockedBy) parts.push(`locked by ${hit.item.lockedBy}`);
      parts.push(`span ${hit.item.span[0]}–${hit.item.span[1]} at ${hit.item.axis} ${hit.item.at}`);
      return [hit.item.id, ...parts, position];
    }
    case 'key':
      return [hit.item.name, `opens ${hit.item.opens.join(', ')}`, hit.item.note || '', position];
    case 'secret':
      return [hit.item.name, `secret · ${hit.item.reward}`, hit.item.note || '', position];
    case 'scare':
      return [`☠ ${hit.item.role}`, hit.item.note || '', position];
    case 'connection':
      return [hit.item.label, `${hit.item.kind}${hit.item.to ? ' → ' + hit.item.to : ''}`, position];
    case 'anchor':
      return [hit.label, position];
    case 'block':
      return [hit.label, 'solid cell · cover', position];
    default:
      return [hit.label, position];
  }
}

function round(value) {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------- interaction

function pointerPosition(event) {
  const rect = dom.canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function cellAtPointer(point) {
  const scene = currentScene();
  const layout = layoutOf(scene);
  const panels = panelsOf(scene);
  for (let index = 0; index < panels.length; index += 1) {
    const origin = layout.origin(index);
    const cell = screenToCell(origin, point.x, point.y);
    if (cell.x >= -0.2 && cell.y >= -0.2 && cell.x <= panels[index].width + 0.2 && cell.y <= panels[index].height + 0.2) {
      return { ...cell, panel: panels[index], index };
    }
  }
  const origin = layout.origin(0);
  return { ...screenToCell(origin, point.x, point.y), panel: panels[0], index: 0 };
}

function onPointerDown(event) {
  if (event.button !== 0) return;
  const point = pointerPosition(event);
  dom.canvas.setPointerCapture(event.pointerId);
  const hit = pickAt(point.x, point.y);
  if (state.measure) {
    const cell = cellAtPointer(point);
    if (state.measurePoints.length >= 2) state.measurePoints = [];
    state.measurePoints.push({ x: cell.x, y: cell.y, index: cell.index ?? 0 });
    requestDraw();
    return;
  }
  if (state.edit && hit && draggable(hit)) {
    state.history.push({ overrides: JSON.stringify(state.overrides), label: `move ${hit.label}` });
    if (state.history.length > 60) state.history.shift();
    const cell = cellAtPointer(point);
    const key = keyForHit(hit);
    const authored = Array.isArray(hit.item.anchor) ? hit.item.anchor : [hit.item.x, hit.item.y];
    const current = state.overrides[key] || authored;
    state.drag = { hit, key, startCell: cell, startAnchor: [...current], moved: false };
    dom.canvas.classList.add('dragging');
    return;
  }
  state.drag = { pan: true, startX: point.x, startY: point.y, startOx: cam.ox, startOy: cam.oy, moved: false };
  dom.canvas.classList.add('dragging');
}

function onPointerMove(event) {
  const point = pointerPosition(event);
  state.pointer = { ...point, inside: true };
  if (state.drag?.pan) {
    cam.ox = state.drag.startOx + (point.x - state.drag.startX);
    cam.oy = state.drag.startOy + (point.y - state.drag.startY);
    if (Math.hypot(point.x - state.drag.startX, point.y - state.drag.startY) > 3) state.drag.moved = true;
    requestDraw();
    return;
  }
  if (state.drag?.hit) {
    const cell = cellAtPointer(point);
    const snap = event.altKey ? 0.05 : 0.25;
    const dx = cell.x - state.drag.startCell.x;
    const dy = cell.y - state.drag.startCell.y;
    const next = [
      clampSnap(state.drag.startAnchor[0] + dx, snap),
      clampSnap(state.drag.startAnchor[1] + dy, snap),
    ];
    const panel = findPanel(state.drag.hit.sceneId);
    next[0] = Math.max(0, Math.min(panel?.width ?? 12, next[0]));
    next[1] = Math.max(0, Math.min(panel?.height ?? 12, next[1]));
    state.overrides[state.drag.key] = next;
    state.drag.moved = true;
    state.revision += 1;
    requestDraw();
    renderDraft();
    return;
  }
  const hit = pickAt(point.x, point.y);
  state.hover = hit;
  const cell = cellAtPointer(point);
  state.pointer.cells = cell;
  requestDraw();
}

function onPointerUp(event) {
  if (state.drag?.hit) {
    if (!state.drag.moved) state.history.pop();
  }
  if (state.drag?.pan && !state.drag.moved) {
    const point = pointerPosition(event);
    const hit = pickAt(point.x, point.y);
    if (hit) select(hit);
    else state.selection = null;
    renderInspector();
  }
  state.drag = null;
  dom.canvas.classList.remove('dragging');
  requestDraw();
}

function onWheel(event) {
  event.preventDefault();
  const point = pointerPosition(event);
  const before = cellAtPointer(point);
  const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
  cam.scale = Math.max(3.2, Math.min(170, cam.scale * factor));
  const scene = currentScene();
  const layout = layoutOf(scene);
  const panels = panelsOf(scene);
  const index = Math.max(0, Math.min(panels.length - 1, before.index ?? 0));
  const origin = layout.origin(index);
  const after = screenToCell(origin, point.x, point.y);
  cam.ox += (after.x - before.x) * cam.scale;
  cam.oy += (after.y - before.y) * cam.scale;
  requestDraw();
}

function clampSnap(value, snap) {
  return Math.round(value / snap) * snap;
}

function draggable(hit) {
  return ['landmark', 'machinery', 'setpiece', 'light', 'spawn', 'anchor', 'zone'].includes(hit.kind);
}

function keyForHit(hit) {
  if (hit.kind === 'anchor') return overrideKey('anchor', hit.id);
  return overrideKey(hit.kind, hit.id);
}

function select(hit) {
  state.selection = { sceneId: hit.sceneId, kind: hit.kind, id: hit.id, anchor: hit.anchor, item: hit.item };
}

function onKeyDown(event) {
  if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
  if (event.ctrlKey && event.key.toLowerCase() === 'z') {
    undo();
    return;
  }
  switch (event.key.toLowerCase()) {
    case 'f': fitView(); break;
    case 'm': toggleMeasure(); break;
    case 'g': toggleLayer('grid'); break;
    case 'l':
      state.labels = !state.labels;
      dom.labels.classList.toggle('active', state.labels);
      break;
    case 'p': toggleLayer('path'); break;
    case 'e': toggleEdit(); break;
    case 'escape':
      state.measurePoints = [];
      state.selection = null;
      renderInspector();
      break;
    case '1': setSector(0); break;
    case '2': setSector(1); break;
    case '3': setSector(2); break;
    case '9': setDungeon(state.dungeonIndex); break;
    case '[':
      if (state.mode === 'dungeon' || state.mode === 'dungeon-stack') setDungeon(state.dungeonIndex - 1);
      break;
    case ']':
      if (state.mode === 'dungeon' || state.mode === 'dungeon-stack') setDungeon(state.dungeonIndex + 1);
      break;
    case '0':
      state.mode = 'campaign';
      dom.mode.value = 'campaign';
      state.selection = null;
      fitView();
      refreshUi();
      break;
    default: return;
  }
  requestDraw();
}

// ------------------------------------------------------------------- ui state

function setSector(index) {
  state.sectorIndex = index;
  state.mode = 'sector';
  dom.mode.value = 'sector';
  state.selection = null;
  state.measurePoints = [];
  fitView();
  refreshUi();
}

function toggleMeasure() {
  state.measure = !state.measure;
  state.measurePoints = [];
  dom.measure.classList.toggle('active', state.measure);
  dom.canvas.classList.toggle('editing', state.measure || state.edit);
  requestDraw();
}

function toggleEdit() {
  state.edit = !state.edit;
  dom.editToggle.classList.toggle('active', state.edit);
  dom.canvas.classList.toggle('editing', state.edit || state.measure);
  toast(state.edit ? 'Edit mode: drag anchors to retune the map' : 'Edit mode off');
  requestDraw();
}

function toggleLayer(id) {
  state.layers[id] = !state.layers[id];
  refreshUi();
  requestDraw();
}

function undo() {
  const entry = state.history.pop();
  if (!entry) {
    toast('Nothing to undo');
    return;
  }
  state.overrides = JSON.parse(entry.overrides);
  state.revision += 1;
  refreshUi();
  requestDraw();
  toast(`Undid ${entry.label}`);
}

function resetEdits() {
  if (!Object.keys(state.overrides).length) {
    toast('No draft edits yet');
    return;
  }
  state.history.push({ overrides: JSON.stringify(state.overrides), label: 'reset' });
  state.overrides = {};
  state.revision += 1;
  state.selection = null;
  refreshUi();
  requestDraw();
  toast('Draft edits cleared');
}

// ------------------------------------------------------------------ rendering

function refreshUi() {
  const scene = currentScene();
  dom.playFloor.disabled = state.mode !== 'dungeon';
  dom.playFloor.title = state.mode === 'dungeon' ? `Open Floor ${String(state.dungeonIndex + 1).padStart(2, '0')} in a new playable 3D tab` : 'Select Story descent · floor detail to play a floor';
  updateSectorTabs();
  updateLayers(scene);
  updateMetrics(scene);
  updateDiagnostics(scene);
  renderInspector();
  renderDraft();
  updateBanner(scene);
}

function updateSectorTabs() {
  dom.sectors.innerHTML = '';
  const story = state.mode === 'dungeon' || state.mode === 'dungeon-stack';
  const entries = story
    ? DUNGEON_LAYERS.map(layer => ({ index: layer.index, name: layer.name, color: layer.color, hint: `F${layer.depth}` }))
    : SECTORS;
  entries.forEach(sector => {
    const button = document.createElement('button');
    const selected = story ? state.dungeonIndex === sector.index : (state.mode === 'sector' && state.sectorIndex === sector.index);
    button.className = 'sector' + (selected ? ' active' : '');
    button.textContent = story ? `${sector.hint} ${sector.name.replace('The ', '')}` : sector.name.replace('The ', '');
    button.style.borderColor = selected ? sector.color : '';
    button.addEventListener('click', () => (story ? setDungeon(sector.index) : setSector(sector.index)));
    dom.sectors.append(button);
  });
}

function setDungeon(index) {
  state.dungeonIndex = Math.max(0, Math.min(DUNGEON_LAYERS.length - 1, index));
  if (state.mode !== 'dungeon' && state.mode !== 'dungeon-stack') state.mode = 'dungeon';
  dom.mode.value = state.mode;
  state.selection = null;
  state.measurePoints = [];
  fitView();
  refreshUi();
  requestDraw();
}

function layerCounts(scene) {
  const panels = panelsOf(scene);
  const sum = key => panels.reduce((total, panel) => total + (panel[key]?.length || 0), 0);
  return {
    grid: panels[0]?.width * panels[0]?.height,
    rooms: sum('rooms'),
    zones: sum('zones'),
    routes: sum('routes'),
    corridors: sum('corridors'),
    walls: sum('walls'),
    blocks: sum('blocks'),
    portals: panels.reduce((total, panel) => total + (panel.openings?.length || 0) + panel.rooms.reduce((count, room) => count + room.portals.length, 0), 0),
    landmarks: sum('landmarks'),
    machinery: sum('machinery'),
    setpieces: sum('setpieces'),
    lights: sum('lights'),
    spawns: sum('spawns'),
    picks: sum('keys') + sum('secrets'),
    connections: sum('connections'),
    props: sum('props'),
    scares: sum('scares'),
    path: panels.filter(panel => panel.path.designed.length).length,
    diagnostics: panels.reduce((total, panel) => total + panel.diagnostics.filter(item => item.severity !== 'info').length, 0),
  };
}

function updateLayers(scene) {
  const counts = layerCounts(scene);
  const signature = JSON.stringify({ state: state.layers, counts });
  if (signature === layersSignature) return;
  layersSignature = signature;
  dom.layers.innerHTML = '';
  for (const layer of LAYER_DEFS) {
    const label = document.createElement('label');
    label.className = 'toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = state.layers[layer.id] !== false;
    input.addEventListener('change', () => {
      state.layers[layer.id] = input.checked;
      layersSignature = '';
      requestDraw();
    });
    const text = document.createElement('span');
    text.textContent = layer.label;
    text.title = layer.hint;
    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = counts[layer.id] ?? '';
    label.append(input, text, count);
    dom.layers.append(label);
  }
}

function updateMetrics(scene) {
  const rows = [];
  if (scene.kind === 'campaign' || scene.kind === 'dungeon-stack') {
    rows.push(['Sectors', scene.stats.sectors], ['Rooms', scene.stats.rooms], ['Waves', scene.stats.waves],
      ['Total route', `${scene.stats.routeMeters} m`], ['Enemy budget', scene.stats.enemyBudgetTotal],
      ['Arena', '48 × 48 m each']);
    if (scene.kind === 'dungeon-stack') {
      const summary = dungeonSummary();
      rows.length = 0;
      rows.push(
        ['Floors', summary.layers],
        ['Rooms', summary.rooms],
        ['Corridors', summary.corridors],
        ['Openings', summary.openings],
        ['Keys / secrets', `${summary.keys} / ${summary.secrets}`],
        ['Loops', summary.loops],
        ['Route total', `${summary.routeMeters} m`],
        ['Footprint', `${Math.round(summary.areaSqMeters).toLocaleString()} m²`],
        ['Enemy budget', summary.enemyBudget],
      );
    }
  } else if (scene.kind === 'dungeon') {
    const stats = scene.stats;
    rows.push(
      ['Floor', `F${scene.depth} · ${scene.meters.w} × ${scene.meters.d} m`],
      ['Rooms', stats.corridors !== undefined ? `${scene.rooms.length} rooms · ${stats.corridors} corridors` : scene.rooms.length],
      ['Openings', `${stats.doorSpans} (${scene.openings.filter(o => o.role === 'gate').length} key gates)`],
      ['Walkable', `${stats.walkableCells} cells · ${stats.openAreaPct}%`],
      ['Route', `${stats.routeMeters} m · ${stats.routeTurns} turns`],
      ['Corridor run', `${stats.corridorMeters} m`],
      ['Loops', stats.loops],
      ['Dead ends', stats.deadEnds],
      ['Cover', `${stats.blockCells} cells · ${stats.coverPct}%`],
      ['Scare beats', scene.scares.length],
      ['Dressing', `${scene.props.length} marks`],
      ['Enemy budget', stats.enemyBudgetTotal],
    );
  } else {
    const stats = scene.stats;
    const sealed = scene.path.sealedMetrics;
    rows.push(
      ['Arena', `${scene.meters.w} × ${scene.meters.d} m`],
      ['Walkable', `${stats.walkableCells} cells · ${stats.walkableSqMeters} m²`],
      ['Open area', `${stats.openAreaPct}%`],
      ['Cover', `${stats.blockCells} cells · ${stats.coverPct}%`],
      ['Authored cover', `${scene.authoredBlocks.length} cells (${scene.ghostBlocks.length} carved)`],
      ['Wall edges', stats.wallSegments],
      ['Door spans', stats.doorSpans],
      ['Route (open)', `${stats.routeMeters} m · ${stats.routeSteps} steps · ${stats.routeTurns} turns`],
      ['Route (sealed)', sealed.meters ? `${sealed.meters} m` : 'no path until clear'],
      ['Enemy budget', stats.enemyBudgetTotal],
      ['Landmarks', scene.landmarks.length],
    );
  }
  const signature = JSON.stringify(rows);
  if (signature === metricsSignature.value) return;
  metricsSignature.value = signature;
  dom.metrics.innerHTML = rows
    .map(([key, value]) => `<dt>${escapeHtml(String(key))}</dt><dd>${escapeHtml(String(value))}</dd>`)
    .join('');
}

function updateDiagnostics(scene) {
  const panels = panelsOf(scene);
  const items = [];
  for (const panel of panels) {
    for (const diagnostic of panel.diagnostics) {
      items.push({ panel, diagnostic });
    }
  }
  const rank = { error: 0, warn: 1, info: 2 };
  items.sort((a, b) => (rank[a.diagnostic.severity] ?? 3) - (rank[b.diagnostic.severity] ?? 3));
  dom.diagnostics.innerHTML = '';
  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'info';
    li.innerHTML = '<span class="copy">No conflicts detected in the authored data.</span>';
    dom.diagnostics.append(li);
    return;
  }
  for (const { panel, diagnostic } of items) {
    const li = document.createElement('li');
    li.className = diagnostic.severity + (diagnostic.severity === 'info' ? ' muted' : '');
    li.innerHTML = `<span class="code">${escapeHtml(diagnostic.severity)}</span><span class="copy">${escapeHtml(diagnostic.message)}</span>`;
    li.addEventListener('click', () => {
      if (scene.kind === 'campaign') {
        state.sectorIndex = panel.sectorIndex;
        state.mode = 'sector';
        dom.mode.value = 'sector';
        refreshUi();
      }
      const target = panelsOf(currentScene()).find(candidate => candidate.id === panel.id) || panelsOf(currentScene())[0];
      const hit = {
        sceneId: target.id,
        kind: 'diagnostic',
        id: diagnostic.code,
        label: diagnostic.code,
        anchor: diagnostic.at,
        item: diagnostic,
      };
      select(hit);
      focusOn(target.id, diagnostic.at);
      renderInspector();
      requestDraw();
    });
    dom.diagnostics.append(li);
  }
}

function focusOn(sceneId, anchor) {
  const scene = currentScene();
  const layout = layoutOf(scene);
  const panels = panelsOf(scene);
  const index = Math.max(0, panels.findIndex(panel => panel.id === sceneId));
  const origin = layout.origin(index);
  cam.ox = dom.stage.clientWidth / 2 - (origin.x + anchor.x) * cam.scale;
  cam.oy = dom.stage.clientHeight / 2 - (origin.y + anchor.y) * cam.scale;
}

function renderInspector() {
  const selection = state.selection;
  if (!selection) {
    dom.inspector.innerHTML = '<p class="empty">Click any room, zone, landmark, spawn or prop to inspect the authored data.</p>';
    return;
  }
  const panel = findPanel(selection.sceneId);
  const item = selection.item;
  const rows = [];
  const position = selection.anchor;
  rows.push(['Cell', `${round(position.x)}, ${round(position.y)}`]);
  rows.push(['Metres', `${round(position.x * CELL)}, ${round(position.y * CELL)}`]);
  let title = selection.id;
  let kindLabel = selection.kind;
  let json = item;
  switch (selection.kind) {
    case 'room': {
      const encounter = item.encounter || {};
      kindLabel = `room ${item.sequence} of ${panel?.rooms.length ?? 4}`;
      title = item.name;
      rows.push(['Role', item.role]);
      rows.push(['Size', `${round(item.size.w * CELL)} × ${round(item.size.d * CELL)} m`]);
      rows.push(['Bounds', `${item.bounds.minX}–${item.bounds.maxX} x · ${item.bounds.minZ}–${item.bounds.maxZ} z`]);
      rows.push(['Tier', encounter.tier ?? '-']);
      rows.push(['Budget', encounter.budget ?? 0]);
      rows.push(['Alive cap', encounter.maxAlive ?? 0]);
      rows.push(['Doors', item.portals.length]);
      if (encounter.composition) rows.push(['Mix', formatComposition(encounter.composition)]);
      break;
    }
    case 'spawn':
      kindLabel = 'enemy spawn';
      title = `Spawn ${item.index}`;
      rows.push(['Waves', item.usage.length]);
      for (const usage of item.usage) rows.push([`Wave ${usage.wave}`, `${usage.variant} @ ${usage.delay}s`]);
      break;
    case 'landmark':
      kindLabel = item.hero ? 'hero landmark' : 'landmark';
      rows.push(['Type', item.type]);
      rows.push(['Material', item.material || '-']);
      rows.push(['Animated', item.animated || '-']);
      rows.push(['Authored size', `${item.size.join(' × ')} cells`]);
      if (item.zone) rows.push(['Zone', item.zone.id]);
      break;
    case 'machinery':
      kindLabel = 'machinery';
      rows.push(['Type', item.type]);
      rows.push(['Span', item.span.join(' × ') + ' cells']);
      rows.push(['Motion', item.motion || '-']);
      rows.push(['Hazard', item.hazard || '-']);
      break;
    case 'setpiece':
      kindLabel = 'setpiece';
      rows.push(['Type', item.type]);
      rows.push(['Width', `${item.width} cells`]);
      rows.push(['Height', `${item.height} m`]);
      rows.push(['Points', item.points.length || 1]);
      break;
    case 'light':
      kindLabel = 'authored light';
      title = item.role;
      rows.push(['Colour', item.color]);
      rows.push(['Intensity', item.intensity]);
      rows.push(['Phase', item.phase]);
      break;
    case 'zone': {
      kindLabel = 'authored zone';
      rows.push(['Role', item.role]);
      rows.push(['Rect', `${item.rect.join(', ')} cells`]);
      rows.push(['Cue', item.cue || '-']);
      rows.push(['Landmark', item.landmark || '-']);
      break;
    }
    case 'route': {
      kindLabel = 'route spine';
      rows.push(['Role', item.role]);
      rows.push(['Width', `${item.width} cells`]);
      rows.push(['Cue', item.cue || '-']);
      rows.push(['Points', item.points.length]);
      rows.push(['Combat lane', item.combatLane ? 'yes' : 'no']);
      break;
    }
    case 'portal':
      kindLabel = 'threshold';
      title = item.room || item.id;
      rows.push(['Kind', item.kind]);
      rows.push(['Span', item.span.join('–')]);
      rows.push(['At', `${item.axis} ${item.at}`]);
      rows.push(['Locked by', item.lockedBy || 'always open']);
      break;
    case 'diagnostic':
      kindLabel = `warning · ${item.severity}`;
      title = item.code;
      rows.push(['Code', item.code]);
      rows.push(['Message', item.message]);
      rows.push(['Item', item.itemId || '-']);
      break;
    case 'corridor':
      kindLabel = `${item.role} corridor`;
      title = item.id;
      rows.push(['Width', `${item.width} cells · ${Math.round(item.width * CELL)} m`]);
      rows.push(['Length', `${Math.round(item.lengthMeters)} m`]);
      rows.push(['Points', item.points.length]);
      break;
    case 'opening':
      kindLabel = item.secret ? 'secret opening' : `${item.role} opening`;
      title = item.id;
      rows.push(['Kind', item.role]);
      rows.push(['Room', item.roomId]);
      rows.push(['Span', `${item.span[0]}–${item.span[1]} at ${item.axis} ${item.at}`]);
      rows.push(['Width', `${item.width} cells`]);
      rows.push(['Locked by', item.keyId ? `key ${item.keyId}` : item.lockedBy || 'always open']);
      break;
    case 'key':
      kindLabel = 'key item';
      title = item.name;
      rows.push(['Room', item.roomId]);
      rows.push(['Opens', item.opens.join(', ')]);
      rows.push(['Note', item.note || '-']);
      break;
    case 'secret':
      kindLabel = 'secret';
      title = item.name;
      rows.push(['Reward', item.reward]);
      rows.push(['Note', item.note || '-']);
      break;
    case 'scare':
      kindLabel = `scare beat · ${item.role}`;
      title = item.id;
      rows.push(['Type', item.role]);
      rows.push(['Room', item.roomId || '-']);
      rows.push(['Direction', item.note || '-']);
      break;
    case 'connection':
      kindLabel = `floor link · ${item.kind}`;
      title = item.label;
      rows.push(['Kind', item.kind]);
      rows.push(['Leads to', item.to || 'campaign end']);
      break;
    case 'anchor':
      kindLabel = item.id === 'player' ? 'player entry' : 'sector exit';
      title = selection.label;
      if (item.angle !== undefined) {
        rows.push(['Facing', `${compassLabel(item.angle)} (${round((item.angle * 180) / Math.PI)}°)`]);
      }
      break;
    default:
      break;
  }
  const key = keyForHit(selection);
  const override = state.overrides[key];
  if (override) rows.push(['Draft', `${round(override[0])}, ${round(override[1])}`]);
  const pretty = JSON.stringify(json, null, 1);
  dom.inspector.innerHTML = `
    <div class="card">
      <div class="kind">${escapeHtml(kindLabel)}</div>
      <div class="name">${escapeHtml(String(title))}</div>
      <dl>${rows.map(([key2, value]) => `<dt>${escapeHtml(String(key2))}</dt><dd>${escapeHtml(String(value))}</dd>`).join('')}</dl>
      <pre>${escapeHtml(pretty)}</pre>
    </div>`;
}

function formatComposition(composition) {
  const entries = Object.entries(composition).filter(([, count]) => count);
  return entries.length ? entries.map(([name, count]) => `${count}× ${name}`).join(', ') : '-';
}

function renderDraft() {
  const scene = currentScene();
  const panels = panelsOf(scene);
  const payload = {
    note: 'Paste this back to Codex to retune the authored campaign. Cells are 4 m; x runs east, z runs south.',
    sectors: {},
  };
  let count = 0;
  for (const panel of panels) {
    const rows = summarizeOverrides(panel, state.overrides, state.baseline);
    if (!rows.length) continue;
    payload.sectors[panel.id] = rows.map(row => ({
      key: row.key,
      id: row.id,
      type: row.type,
      authored: row.authored,
      to: row.to,
      deltaMeters: row.deltaMeters,
      totalMeters: row.totalMeters,
    }));
    count += rows.length;
  }
  if (!count) {
    dom.draft.value = '';
    dom.draft.placeholder = state.edit
      ? 'Drag a landmark, prop, light, spawn or anchor to retune the map.'
      : 'Switch on edit mode to move anchors and build a patch.';
    metricsSignature.value = '';
    return;
  }
  dom.draft.value = JSON.stringify(payload, null, 1);
  metricsSignature.value = '';
}

function updateBanner(scene) {
  const t = theme();
  const label = scene.kind === 'dungeon'
    ? `<b>FLOOR 0${scene.depth} · ${escapeHtml(scene.name.toUpperCase())}</b> · ${escapeHtml(scene.tag || '')} · ${scene.rooms.length} rooms · ${scene.scares.length} scares`
    : scene.kind === 'dungeon-stack'
      ? `<b>STORY MODE · THE DESCENT</b> · ${scene.stats.sectors} floors · ${scene.stats.rooms} rooms · ${scene.stats.keys} keys · ${scene.stats.secrets} secrets`
      : scene.kind === 'campaign'
    ? `<b>WHOLE CAMPAIGN</b> · ${scene.stats.sectors} sectors · ${scene.stats.rooms} rooms · ${scene.stats.waves} waves`
    : `<b>${escapeHtml(scene.name.toUpperCase())}</b> · ${escapeHtml(scene.tag || '')} · route ${scene.stats.routeMeters} m`;
  dom.banner.innerHTML = label;
  dom.banner.style.borderColor = scene.kind === 'campaign' ? t.accent : (scene.color || t.accent);
}

function updateHud(scene) {
  const pointer = state.pointer;
  const parts = [];
  if (pointer.inside) {
    parts.push(`cell <b>${round(pointer.cells.x)}, ${round(pointer.cells.y)}</b>`);
    parts.push(`<b>${round(pointer.cells.x * CELL)} m, ${round(pointer.cells.y * CELL)} m</b>`);
  }
  if (state.hover) parts.push(`<span>${escapeHtml(state.hover.label)}</span>`);
  else if (pointer.inside) parts.push(`<span>${escapeHtml(pointer.cells.panel?.name || '')}</span>`);
  parts.push(`<span>zoom ${round(cam.scale)} px/cell</span>`);
  if (state.measure) parts.push(`<b>measure</b> ${state.measurePoints.length}/2`);
  if (state.edit) parts.push('<b>edit</b>');
  dom.hud.innerHTML = parts.join('<span class="sep">|</span>');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function toast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add('show');
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => dom.toast.classList.remove('show'), 1700);
}

function requestDraw() {
  if (frame) return;
  frame = window.requestAnimationFrame(() => {
    frame = 0;
    drawScene();
  });
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
  } catch {
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.append(helper);
    helper.select();
    try {
      document.execCommand('copy');
      toast(message);
    } catch {
      toast('Copy failed — select the patch text and copy manually');
    }
    helper.remove();
  }
}

function savePng() {
  const url = dom.canvas.toDataURL('image/png');
  const link = document.createElement('a');
  const scene = currentScene();
  link.href = url;
  link.download = `the-last-dead-map-${scene.id || 'campaign'}-${state.theme}.png`;
  link.click();
  toast('Saved PNG');
}

function bootStatus(payload) {
  dom.boot.dataset.ready = '1';
  dom.boot.textContent = JSON.stringify(payload);
  window.__MAP_PLAYGROUND__ = {
    state,
    cam,
    scene: () => currentScene(),
    draw: drawScene,
    fit: fitView,
    status: payload,
  };
}

// ------------------------------------------------------------------- wiring

dom.mode.addEventListener('change', () => {
  state.mode = dom.mode.value;
  state.selection = null;
  fitView();
  refreshUi();
  requestDraw();
});
dom.gateMode.addEventListener('change', () => {
  state.gateMode = dom.gateMode.value;
  requestDraw();
});
dom.theme.addEventListener('change', () => {
  state.theme = dom.theme.value;
  document.documentElement.style.setProperty('--accent', theme().accent);
  requestDraw();
});
dom.fit.addEventListener('click', () => {
  fitView();
  requestDraw();
});
dom.playFloor.addEventListener('click', () => {
  if (state.mode !== 'dungeon') return;
  const target = new URL('./index.html', location.href);
  target.searchParams.set('dungeon', String(state.dungeonIndex));
  target.searchParams.set('debug', '1');
  const tab = window.open(target.href, '_blank');
  if (!tab) {
    toast('Allow pop-ups to open the playable floor in a new tab');
    return;
  }
  tab.opener = null;
  toast(`Opened Floor ${String(state.dungeonIndex + 1).padStart(2, '0')} in a new tab`);
});
dom.measure.addEventListener('click', toggleMeasure);
dom.focus.addEventListener('click', () => {
  state.focus = !state.focus;
  dom.focus.classList.toggle('active', state.focus);
  toast(state.focus ? 'Focus mode: objectives and thresholds prioritized' : 'Focus mode off');
  requestDraw();
});
dom.labels.addEventListener('click', () => {
  state.labels = !state.labels;
  dom.labels.classList.toggle('active', state.labels);
  requestDraw();
});
dom.editToggle.addEventListener('click', toggleEdit);
dom.undo.addEventListener('click', undo);
dom.reset.addEventListener('click', resetEdits);
dom.copyDraft.addEventListener('click', () => {
  const text = dom.draft.value || 'no draft edits';
  copyText(text, 'Patch copied');
});
dom.savePng.addEventListener('click', savePng);

dom.canvas.addEventListener('pointerdown', onPointerDown);
dom.canvas.addEventListener('pointermove', onPointerMove);
dom.canvas.addEventListener('pointerup', onPointerUp);
dom.canvas.addEventListener('pointercancel', onPointerUp);
dom.canvas.addEventListener('pointerleave', () => {
  state.pointer.inside = false;
  state.hover = null;
  requestDraw();
});
dom.canvas.addEventListener('wheel', onWheel, { passive: false });
dom.canvas.addEventListener('contextmenu', event => event.preventDefault());
window.addEventListener('keydown', onKeyDown);
window.addEventListener('resize', () => {
  resize();
  fitView();
  requestDraw();
});

window.addEventListener('error', event => {
  dom.boot.dataset.ready = 'error';
  dom.boot.textContent = String(event.message || 'error');
});

resize();
state.mode = dom.mode.value || state.mode;
fitView();
refreshUi();
drawScene();
const initial = currentScene();
bootStatus({
  ready: true,
  mode: state.mode,
  sector: initial.id,
  floor: initial.depth ?? null,
  rooms: initial.rooms.length,
  zones: initial.zones.length,
  routes: initial.routes.length,
  corridors: initial.corridors?.length ?? 0,
  openings: initial.openings?.length ?? 0,
  props: initial.props?.length ?? 0,
  scares: initial.scares?.length ?? 0,
  keys: initial.keys?.length ?? 0,
  secrets: initial.secrets?.length ?? 0,
  landmarks: initial.landmarks.length,
  machinery: initial.machinery.length,
  setpieces: initial.setpieces.length,
  lights: initial.lights.length,
  spawns: initial.spawns.length,
  walls: initial.walls.length,
  blocks: initial.blocks.length,
  ghostBlocks: initial.ghostBlocks.length,
  routeMeters: initial.stats.routeMeters,
  diagnostics: initial.diagnostics.length,
  path: initial.path.designed.length,
});
