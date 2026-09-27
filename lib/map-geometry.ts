// All road geometry is measured on the ground plane, then projected once.
export type GroundPoint = { x: number; y: number };
type Tile = { r: number; c: number };
export const ground = (p: Tile): GroundPoint => ({ x: p.c * 32, y: p.r * 32 });
export const project = (p: GroundPoint, height = 0) => ({
  x: 640 + p.x - p.y,
  y: 350 + (p.x + p.y) * 0.5625 - height,
});
export function cameraBounds(
  w: number,
  h: number,
  zoom: number,
  pan: GroundPoint,
) {
  const scale = Math.max(w / 1280, h / 720) * Math.max(1, Math.min(2, zoom));
  const x = Math.max(0, (1280 * scale - w) / 2),
    y = Math.max(0, (720 * scale - h) / 2);
  return {
    scale,
    x: Math.max(-x, Math.min(x, pan.x)),
    y: Math.max(-y, Math.min(y, pan.y)),
  };
}
const toward = (a: GroundPoint, b: GroundPoint, distance: number) => {
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return {
    x: a.x + ((b.x - a.x) * distance) / length,
    y: a.y + ((b.y - a.y) * distance) / length,
  };
};
const xy = (p: GroundPoint) => `${p.x},${p.y}`;
export function roadPath(roads: Tile[]) {
  const keys = new Set(roads.map((p) => `${p.r},${p.c}`));
  return roads
    .map((tile) => {
      const p = ground(tile);
      const neighbors = [
        { r: tile.r - 1, c: tile.c },
        { r: tile.r + 1, c: tile.c },
        { r: tile.r, c: tile.c - 1 },
        { r: tile.r, c: tile.c + 1 },
      ]
        .filter((n) => keys.has(`${n.r},${n.c}`))
        .map(ground);
      if (!neighbors.length) return `M${p.x - 7},${p.y}h14`;
      if (neighbors.length === 2)
        return `M${xy(toward(p, neighbors[0], 16))} Q${xy(p)} ${xy(toward(p, neighbors[1], 16))}`;
      return neighbors
        .map((n) => `M${xy(p)} L${xy(toward(p, n, 16))}`)
        .join(" ");
    })
    .join(" ");
}
// Offset lanes and cubic junction arcs also give dead ends a proper U-turn.
export function trafficSamples(route: Tile[]) {
  const result: (GroundPoint & { distance: number })[] = [];
  const nodes = route.slice(0, -1).map(ground);
  if (nodes.length < 2) return result;
  const push = (p: GroundPoint) => {
    const last = result.at(-1);
    result.push({
      ...p,
      distance: last
        ? last.distance + Math.hypot(p.x - last.x, p.y - last.y)
        : 0,
    });
  };
  const lane = (p: GroundPoint, d: GroundPoint, along: number) => ({
    x: p.x + d.x * along - d.y * 3,
    y: p.y + d.y * along + d.x * 3,
  });
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i],
      prev = nodes[(i + nodes.length - 1) % nodes.length],
      next = nodes[(i + 1) % nodes.length];
    const incoming = { x: (p.x - prev.x) / 32, y: (p.y - prev.y) / 32 },
      outgoing = { x: (next.x - p.x) / 32, y: (next.y - p.y) / 32 };
    const a = lane(p, incoming, -16),
      b = lane(p, outgoing, 16);
    const uturn = incoming.x === -outgoing.x && incoming.y === -outgoing.y;
    if (uturn) {
      push(a);
      const center = { x: p.x - incoming.x * 3, y: p.y - incoming.y * 3 };
      for (let j = 0; j <= 48; j++) {
        const theta = (j / 48) * Math.PI;
        push({
          x:
            center.x -
            incoming.y * 3 * Math.cos(theta) +
            incoming.x * 3 * Math.sin(theta),
          y:
            center.y +
            incoming.x * 3 * Math.cos(theta) +
            incoming.y * 3 * Math.sin(theta),
        });
      }
      push(b);
      continue;
    }
    const reach = uturn ? 27 : 15;
    const c = { x: a.x + incoming.x * reach, y: a.y + incoming.y * reach },
      d = { x: b.x - outgoing.x * reach, y: b.y - outgoing.y * reach };
    for (let j = 0; j <= 24; j++) {
      const t = j / 24,
        s = 1 - t;
      push({
        x:
          s * s * s * a.x +
          3 * s * s * t * c.x +
          3 * s * t * t * d.x +
          t * t * t * b.x,
        y:
          s * s * s * a.y +
          3 * s * s * t * c.y +
          3 * s * t * t * d.y +
          t * t * t * b.y,
      });
    }
  }
  push(result[0]);
  return result;
}
export function sampleTraffic(
  samples: ReturnType<typeof trafficSamples>,
  distance: number,
) {
  const total = samples.at(-1)?.distance || 1;
  const target = ((distance % total) + total) % total;
  let lo = 1,
    hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].distance < target) lo = mid + 1;
    else hi = mid;
  }
  const a = samples[lo - 1],
    b = samples[lo],
    t = (target - a.distance) / (b.distance - a.distance || 1);
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    angle: Math.atan2(b.y - a.y, b.x - a.x),
  };
}
