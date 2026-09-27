import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  newCity,
  constructRoad,
  constructBuilding,
  bulldoze,
  roadLine,
  placementError,
  trafficRoute,
  roadSprite,
  isSavedCity,
  hasRoad,
  valueOf,
  ALL_CELLS,
  validCell,
} from "../lib/city.ts";

test("a new game has no buildings, roads, holdings, or traffic", () => {
  const city = newCity();
  assert.deepEqual(city.buildings, []);
  assert.deepEqual(city.roads, []);
  assert.equal(city.cash, 10000);
  assert.deepEqual(trafficRoute(city.roads), []);
  assert.equal(
    isSavedCity({ positions: [{ ticker: "NVDA" }], cash: 5240, roads: [] }),
    false,
  );
});
test("the first road can start on bare ground and is one atomic purchase", () => {
  const city = newCity();
  const cells = roadLine({ r: 0, c: -3 }, { r: 0, c: 3 });
  const result = constructRoad(cells, city);
  assert.equal(result.error, "");
  assert.equal(result.state.roads.length, 7);
  assert.equal(result.state.cash, 9930);
  assert.equal(city.roads.length, 0);
  const repeat = constructRoad(cells, result.state);
  assert.equal(repeat.state.cash, 9930);
  assert.equal(repeat.state.roads.length, 7);
});
test("every building is manually purchased and reserves all four footprint tiles", () => {
  const city = constructRoad(
    roadLine({ r: 0, c: -3 }, { r: 0, c: 3 }),
    newCity(),
  ).state;
  const placed = constructBuilding("nvidia", { r: 1, c: 1 }, 500, city);
  assert.equal(placed.error, "");
  assert.equal(placed.state.buildings.length, 1);
  assert.equal(placed.state.cash, 9430);
  assert.equal(valueOf(placed.state.buildings[0]), 500);
  assert.equal(hasRoad(placed.state.buildings[0], city.roads), true);
  assert.equal(
    placementError({ r: 2, c: 2 }, placed.state),
    "Building in the way",
  );
  const civic = constructBuilding("hall", { r: -4, c: -3 }, 999, placed.state);
  assert.equal(civic.error, "");
  assert.equal(civic.state.buildings.length, 2);
  assert.equal(civic.state.cash, 9180);
});
test("invalid road routes are rejected in full without spending or partial placement", () => {
  const city = constructBuilding("tesla", { r: 1, c: 1 }, 500, newCity()).state;
  const blocked = constructRoad(roadLine({ r: 0, c: 1 }, { r: 4, c: 1 }), city);
  assert.equal(blocked.error, "A building blocks this route");
  assert.equal(blocked.state, city);
  const ocean = constructRoad([{ r: 100, c: 100 }], city);
  assert.ok(ocean.error);
  assert.equal(ocean.state, city);
});
test("overlap, ocean placement, invalid amounts and insufficient funds are rejected", () => {
  const city = constructRoad([{ r: 0, c: 0 }], newCity()).state;
  for (const [cell, amount] of [
    [{ r: 0, c: 0 }, 500],
    [{ r: 100, c: 100 }, 500],
    [{ r: 1, c: 1 }, NaN],
    [{ r: 1, c: 1 }, -1],
    [{ r: 1, c: 1 }, 20000],
  ]) {
    const result = constructBuilding("amazon", cell, amount, city);
    assert.ok(result.error);
    assert.equal(result.state, city);
  }
  assert.ok(ALL_CELLS.length > 100);
  assert.ok(ALL_CELLS.every(validCell));
});
test("bulldozing a stock building releases its position and frees all its tiles", () => {
  const city = constructBuilding(
    "blackrock",
    { r: 1, c: 1 },
    500,
    newCity(),
  ).state;
  const result = bulldoze({ r: 2, c: 2 }, city);
  assert.equal(result.state.buildings.length, 0);
  assert.equal(result.state.cash, 10000);
  assert.equal(placementError({ r: 1, c: 1 }, result.state), "");
});
test("traffic only follows neighboring tiles in a connected component", () => {
  assert.deepEqual(
    trafficRoute([
      { r: 0, c: 0 },
      { r: 0, c: 1 },
    ]),
    [],
  );
  const roads = [
    { r: 0, c: 0 },
    { r: 0, c: 1 },
    { r: 1, c: 1 },
    { r: 1, c: 2 },
    { r: 5, c: 5 },
  ];
  const route = trafficRoute(roads);
  assert.ok(route.length >= 5);
  for (let i = 1; i < route.length; i++)
    assert.equal(
      Math.abs(route[i].r - route[i - 1].r) +
        Math.abs(route[i].c - route[i - 1].c),
      1,
    );
  assert.ok(route.every((p) => roads.some((r) => r.r === p.r && r.c === p.c)));
  assert.ok(!route.some((p) => p.r === 5 && p.c === 5));
});
test("all road connection combinations map to supplied sprites", () => {
  const center = { r: 0, c: 0 },
    neighbors = [
      { r: 0, c: -1 },
      { r: -1, c: 0 },
      { r: 1, c: 0 },
      { r: 0, c: 1 },
    ];
  const sprites = new Set();
  for (let mask = 0; mask < 16; mask++) {
    const roads = [center, ...neighbors.filter((_, i) => mask & (1 << i))];
    const filename = roadSprite(center, roads);
    assert.ok(
      existsSync(
        new URL(
          `../public/assets/sprites/roads/${filename}.png`,
          import.meta.url,
        ),
      ),
    );
    sprites.add(filename);
  }
  assert.equal(sprites.size, 11);
});

const { cameraBounds, roadPath, trafficSamples, sampleTraffic, project } =
  await import("../lib/map-geometry.ts");
test("camera always covers the viewport, including mobile, resize and extreme drags", () => {
  for (const [w, h] of [
    [1280, 720],
    [375, 812],
    [1920, 900],
    [768, 1024],
  ])
    for (const zoom of [0.65, 1, 1.5, 2, 5])
      for (const pan of [
        { x: 0, y: 0 },
        { x: 10000, y: -10000 },
        { x: -10000, y: 10000 },
      ]) {
        const c = cameraBounds(w, h, zoom, pan);
        assert.ok(w / 2 + c.x - 640 * c.scale <= 1e-8);
        assert.ok(w / 2 + c.x + 640 * c.scale >= w - 1e-8);
        assert.ok(h / 2 + c.y - 360 * c.scale <= 1e-8);
        assert.ok(h / 2 + c.y + 360 * c.scale >= h - 1e-8);
      }
});
test("road corners use a joined quadratic surface", () => {
  assert.match(
    roadPath([
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 1, c: 1 },
    ]),
    /Q32,0/,
  );
});
test("vehicle paths have continuous positions and headings through corners and dead ends", () => {
  const samples = trafficSamples(
    trafficRoute([
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 1, c: 1 },
      { r: 2, c: 1 },
    ]),
  );
  assert.ok(samples.length > 100);
  const total = samples.at(-1).distance;
  for (let d = 0; d < total; d += 0.2) {
    const a = sampleTraffic(samples, d),
      b = sampleTraffic(samples, d + 0.2);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 0.21);
    const delta = Math.atan2(
      Math.sin(b.angle - a.angle),
      Math.cos(b.angle - a.angle),
    );
    assert.ok(Math.abs(delta) < 0.4, `abrupt steering at ${d}: ${delta}`);
    assert.ok(Number.isFinite(project(a).x));
  }
});

const {vehicleView,vehicleSize,VEHICLES,DIRECTIONS,screenHeading}=await import('../lib/vehicle-view.ts');
test('vehicle art follows all eight road headings without mirroring',()=>{
  for(let i=0;i<8;i++) {
    const view=vehicleView(i*Math.PI/4);
    assert.equal(view.direction,DIRECTIONS[i]);
    assert.ok(Math.abs(view.rotation)<1e-8);
  }
  assert.equal(vehicleView(0).direction,'lower_right');
  assert.equal(vehicleView(Math.PI/2).direction,'lower_left');
  assert.equal(vehicleView(Math.PI).direction,'upper_left');
  assert.equal(vehicleView(-Math.PI/2).direction,'upper_right');
});
test('intermediate vehicle headings project onto the travel tangent',()=>{
  for(let angle=-Math.PI*2;angle<=Math.PI*2;angle+=.01){
    const view=vehicleView(angle),index=DIRECTIONS.indexOf(view.direction);
    const rendered=screenHeading(index*Math.PI/4)+view.rotation*Math.PI/180;
    assert.ok(Math.abs(Math.sin(rendered-screenHeading(angle)))<1e-8);
    assert.ok(Math.abs(view.rotation)<36);
    for(const v of VEHICLES){const size=vehicleSize(v,angle);assert.ok(size.width>0&&size.height>0&&size.width<32&&size.height<24);}
  }
});
test('each original vehicle has all eight local image frames with valid crop bounds',async()=>{
  const {readFile}=await import('node:fs/promises');
  const frames=JSON.parse(await readFile(new URL('../lib/vehicle-frames.json',import.meta.url),'utf8'));
  for(const v of VEHICLES)for(const direction of DIRECTIONS){
    const f=frames[v][direction];
    assert.ok(existsSync(new URL(`../public${f.src}`,import.meta.url)));
    const [x,y,w,h]=f.viewBox.split(' ').map(Number);
    assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=f.width&&y+h<=f.height);
    if(direction.startsWith('upper'))assert.ok(f.src.endsWith(`${direction}.webp`));
  }
});
