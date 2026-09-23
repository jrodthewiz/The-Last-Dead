// Shared cell-grid helpers for the map playground.
//
// The Last Dead keeps collision in a 12-column bitfield of wall sides per cell
// ([north, east, south, west]). Both the arena campaign view and the story
// dungeon compiler read and write that format, so the primitives live here.
// Units are gameplay cells; one cell is CELL metres.

import { canTraverse } from '../../campaign.js';

export const CELL = 4;

export function cloneCells(cells) {
  return (cells || []).map(sides => [0, 1, 2, 3].map(direction => (sides?.[direction] ? 1 : 0)));
}

export function solidAt(cells, width, height, x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= width || cy >= height) return true;
  return (cells[cy * width + cx] || []).every(Boolean);
}

export function cellAt(x, y) {
  return { x: Math.floor(x), y: Math.floor(y) };
}

// Mirrors renderer.js _buildWalls: side 0 is the low-z edge of a cell, side 1
// the high-x edge, side 2 the high-z edge, side 3 the low-x edge.
export function wallSegments(cells, width, height, options = {}) {
  const solidCell = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return true;
    const sides = cells[y * width + x];
    return Array.isArray(sides) && sides.every(Boolean);
  };
  const seen = new Set();
  const segments = [];
  for (let cy = 0; cy < height; cy += 1) {
    for (let cx = 0; cx < width; cx += 1) {
      const sides = cells[cy * width + cx] || [0, 0, 0, 0];
      for (let direction = 0; direction < 4; direction += 1) {
        if (!sides[direction]) continue;
        if (options.boundaryOnly) {
          const nx = cx + (direction === 1 ? 1 : direction === 3 ? -1 : 0);
          const ny = cy + (direction === 2 ? 1 : direction === 0 ? -1 : 0);
          if (solidCell(cx, cy) && solidCell(nx, ny)) continue;
        }
        const key = direction === 0 ? `h:${cx},${cy}`
          : direction === 2 ? `h:${cx},${cy + 1}`
            : direction === 1 ? `v:${cx + 1},${cy}`
              : `v:${cx},${cy}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const horizontal = direction === 0 || direction === 2;
        segments.push({
          horizontal,
          direction,
          x: horizontal ? cx + 0.5 : (direction === 1 ? cx + 1 : cx),
          z: horizontal ? (direction === 0 ? cy : cy + 1) : cy + 0.5,
          cx,
          cy,
        });
      }
    }
  }
  return segments;
}

export function blockCells(cells, width, height) {
  const solid = [];
  for (let cy = 0; cy < height; cy += 1) {
    for (let cx = 0; cx < width; cx += 1) {
      const sides = cells[cy * width + cx];
      if (Array.isArray(sides) && sides.every(Boolean)) solid.push({ x: cx, y: cy, cx, cy });
    }
  }
  return solid;
}

// Breadth-first walk over the same traversal rules the simulation uses.
export function shortestPath(cells, width, height, start, end) {
  const startCell = cellAt(start.x, start.y);
  const endCell = cellAt(end.x, end.y);
  if (solidAt(cells, width, height, start.x, start.y)) return null;
  if (solidAt(cells, width, height, end.x, end.y)) return null;
  const key = (x, y) => `${x},${y}`;
  const startKey = key(startCell.x, startCell.y);
  const endKey = key(endCell.x, endCell.y);
  const parents = new Map([[startKey, null]]);
  const queue = [[startCell.x, startCell.y]];
  const neighbours = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  while (queue.length) {
    const [x, y] = queue.shift();
    if (`${x},${y}` === endKey) break;
    for (const [dx, dy] of neighbours) {
      const nx = x + dx;
      const ny = y + dy;
      const nextKey = key(nx, ny);
      if (parents.has(nextKey)) continue;
      if (!canTraverse(cells, width, height, x, y, nx, ny)) continue;
      parents.set(nextKey, key(x, y));
      queue.push([nx, ny]);
    }
  }
  if (!parents.has(endKey)) return null;
  const path = [];
  let cursor = endKey;
  while (cursor) {
    const [x, y] = cursor.split(',').map(Number);
    path.push({ x, y });
    cursor = parents.get(cursor);
  }
  path.reverse();
  return path;
}

export function pathPoints(path) {
  return (path || []).map(({ x, y }) => ({ x: x + 0.5, y: y + 0.5 }));
}

export function pathMetrics(path) {
  if (!path || path.length < 2) return { cells: 0, steps: 0, meters: 0, turns: 0 };
  let turns = 0;
  let previous = null;
  for (let i = 1; i < path.length; i += 1) {
    const direction = `${path[i].x - path[i - 1].x},${path[i].y - path[i - 1].y}`;
    if (previous !== null && direction !== previous) turns += 1;
    previous = direction;
  }
  return { cells: path.length, steps: path.length - 1, meters: (path.length - 1) * CELL, turns };
}

// Counts how many extra connections exist beyond a spanning tree: the classic
// "does this level loop back on itself" reading for Quake/Doom style maps.
export function loopStats(cells, width, height) {
  const seen = new Set();
  let nodes = 0;
  let edges = 0;
  let deadEnds = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (solidAt(cells, width, height, x + 0.5, y + 0.5)) continue;
      nodes += 1;
      let open = 0;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= width || ny >= height) continue;
        if (!canTraverse(cells, width, height, x, y, nx, ny)) continue;
        const key = `${x},${y}->${nx},${ny}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges += 1;
        open += 1;
      }
      let neighbours = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (canTraverse(cells, width, height, x, y, x + dx, y + dy)) neighbours += 1;
      }
      if (neighbours <= 1) deadEnds += 1;
    }
  }
  return { nodes, edges, loops: Math.max(0, edges - Math.max(0, nodes - 1)), deadEnds };
}
