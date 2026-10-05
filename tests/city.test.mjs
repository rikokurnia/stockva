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
  sellPosition,
  catalogue,
  assets,
  HERO_TICKERS,
  isHeroTicker,
  buildingImage,
  marketClock,
  tier,
  simulationStep,
  validThresholds,
  DEFAULT_THRESHOLDS,
  SIMULATION_INTERVALS,
  SECTOR_DEFINITIONS,
  defForSector,
} from "../lib/city.ts";

test("custom tiers classify exact boundaries without gaps or overlaps", () => {
  const thresholds = { minus: -5, level2: 5, level3: 15 };
  for (const [gain, expected] of [
    [-5.01, "minus"],
    [-5, "level_1"],
    [4.99, "level_1"],
    [5, "level_2"],
    [14.99, "level_2"],
    [15, "level_3"],
  ])
    assert.equal(tier(gain, thresholds), expected);
  assert.equal(tier(3, { minus: 4, level2: 6, level3: 9 }), "minus");
  for (const invalid of [
    null,
    {},
    { minus: 5, level2: 5, level3: 15 },
    { minus: 8, level2: 5, level3: 15 },
    { minus: -100, level2: 5, level3: 15 },
    { minus: -5, level2: NaN, level3: 15 },
    { minus: -5, level2: 5, level3: Infinity },
  ])
    assert.equal(validThresholds(invalid), false);
  assert.equal(validThresholds(DEFAULT_THRESHOLDS), true);
  assert.deepEqual(SIMULATION_INTERVALS, [4, 6, 8, 10]);
});
test("simulation traverses sprite tiers without changing market prices or positions", () => {
  const city = constructBuilding(
    "nvidia",
    { r: 1, c: 1 },
    500,
    constructBuilding("exchange", { r: -6, c: 0 }, 400, { ...newCity(), cash: 10000 }).state,
    { NVDA: 100 },
  ).state;
  const b = city.buildings.at(-1),
    prices = { NVDA: 100 };
  const before = JSON.stringify(city);
  let returns = { [b.id]: 0 };
  const visited = new Set();
  for (const random of [0, 1, 1, 1, 0, 0, 0]) {
    const previous = returns;
    returns = simulationStep(returns, DEFAULT_THRESHOLDS, () => random);
    assert.notEqual(returns, previous);
    visited.add(tier(returns[b.id]));
    assert.ok(
      buildingImage(b, prices, DEFAULT_THRESHOLDS, returns[b.id]).endsWith(
        tier(returns[b.id]),
      ),
    );
  }
  assert.ok(
    visited.has("minus") &&
      visited.has("level_1") &&
      visited.has("level_2") &&
      visited.has("level_3"),
  );
  for (let n = 0; n < 100; n++)
    returns = simulationStep(returns, DEFAULT_THRESHOLDS, () => 1);
  assert.equal(returns[b.id], 27);
  assert.equal(JSON.stringify(city), before);
  assert.deepEqual(prices, { NVDA: 100 });
  assert.equal(buildingImage(b, prices, DEFAULT_THRESHOLDS), "nvidia/level_1");
});

test("a new game has no buildings, roads, holdings, or traffic", () => {
  const city = newCity();
  assert.deepEqual(city.buildings, []);
  assert.deepEqual(city.roads, []);
  assert.equal(city.cash, 0);
  assert.deepEqual(trafficRoute(city.roads), []);
  assert.equal(
    isSavedCity({ positions: [{ ticker: "NVDA" }], cash: 5240, roads: [] }),
    false,
  );
});
test("a brand new city starts with 0 cash and cannot build without faucet funding", () => {
  const city = newCity();
  assert.equal(city.cash, 0);
  const roadResult = constructRoad(roadLine({ r: 0, c: -1 }, { r: 0, c: 1 }), city);
  assert.equal(roadResult.error, "Not enough funds");
  const buildResult = constructBuilding("exchange", { r: -6, c: 0 }, 400, city);
  assert.equal(buildResult.error, "Not enough funds");
});
test("the first road can start on bare ground and is one atomic purchase", () => {
  const city = { ...newCity(), cash: 10000 };
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
const tradingCity = () =>
  constructBuilding("exchange", { r: -6, c: 0 }, 400, { ...newCity(), cash: 10000 }).state;

test("every building is manually purchased and reserves all four footprint tiles", () => {
  const city = constructRoad(
    roadLine({ r: 0, c: -3 }, { r: 0, c: 3 }),
    tradingCity(),
  ).state;
  const placed = constructBuilding("nvidia", { r: 1, c: 1 }, 500, city);
  assert.equal(placed.error, "");
  assert.equal(placed.state.buildings.length, 2);
  assert.equal(placed.state.cash, 9030);
  assert.equal(valueOf(placed.state.buildings[1]), 500);
  assert.equal(hasRoad(placed.state.buildings[1], city.roads), true);
  assert.equal(
    placementError({ r: 2, c: 2 }, placed.state),
    "Building in the way",
  );
  const civic = constructBuilding("hall", { r: -4, c: -3 }, 999, placed.state);
  assert.equal(civic.error, "");
  assert.equal(civic.state.buildings.length, 3);
  assert.equal(civic.state.cash, 8780);
});
test("invalid road routes are rejected in full without spending or partial placement", () => {
  const city = constructBuilding(
    "tesla",
    { r: 1, c: 1 },
    500,
    tradingCity(),
  ).state;
  const blocked = constructRoad(roadLine({ r: 0, c: 1 }, { r: 4, c: 1 }), city);
  assert.equal(blocked.error, "A building blocks this route");
  assert.equal(blocked.state, city);
  const ocean = constructRoad([{ r: 100, c: 100 }], city);
  assert.ok(ocean.error);
  assert.equal(ocean.state, city);
});
test("overlap, ocean placement, invalid amounts and insufficient funds are rejected", () => {
  const city = constructRoad([{ r: 0, c: 0 }], tradingCity()).state;
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
    tradingCity(),
  ).state;
  const result = bulldoze({ r: 2, c: 2 }, city);
  assert.equal(result.state.buildings.length, 1);
  assert.equal(result.state.cash, 9600);
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

const { vehicleView, vehicleSize, VEHICLES, DIRECTIONS, screenHeading } =
  await import("../lib/vehicle-view.ts");
test("vehicle art follows all eight road headings without mirroring", () => {
  for (let i = 0; i < 8; i++) {
    const view = vehicleView((i * Math.PI) / 4);
    assert.equal(view.direction, DIRECTIONS[i]);
    assert.ok(Math.abs(view.rotation) < 1e-8);
  }
  assert.equal(vehicleView(0).direction, "lower_right");
  assert.equal(vehicleView(Math.PI / 2).direction, "lower_left");
  assert.equal(vehicleView(Math.PI).direction, "upper_left");
  assert.equal(vehicleView(-Math.PI / 2).direction, "upper_right");
});
test("intermediate vehicle headings project onto the travel tangent", () => {
  for (let angle = -Math.PI * 2; angle <= Math.PI * 2; angle += 0.01) {
    const view = vehicleView(angle),
      index = DIRECTIONS.indexOf(view.direction);
    const rendered =
      screenHeading((index * Math.PI) / 4) + (view.rotation * Math.PI) / 180;
    assert.ok(Math.abs(Math.sin(rendered - screenHeading(angle))) < 1e-8);
    assert.ok(Math.abs(view.rotation) < 36);
    for (const v of VEHICLES) {
      const size = vehicleSize(v, angle);
      assert.ok(
        size.width > 0 &&
          size.height > 0 &&
          size.width < 32 &&
          size.height < 24,
      );
    }
  }
});
test("each original vehicle has all eight local image frames with valid crop bounds", async () => {
  const { readFile } = await import("node:fs/promises");
  const frames = JSON.parse(
    await readFile(
      new URL("../lib/vehicle-frames.json", import.meta.url),
      "utf8",
    ),
  );
  for (const v of VEHICLES)
    for (const direction of DIRECTIONS) {
      const f = frames[v][direction];
      assert.ok(existsSync(new URL(`../public${f.src}`, import.meta.url)));
      const [x, y, w, h] = f.viewBox.split(" ").map(Number);
      assert.ok(
        x >= 0 &&
          y >= 0 &&
          w > 0 &&
          h > 0 &&
          x + w <= f.width &&
          y + h <= f.height,
      );
      if (direction.startsWith("upper"))
        assert.ok(f.src.endsWith(`${direction}.webp`));
    }
});

test("progression rejects company construction without an Exchange, including after demolition", () => {
  const empty = { ...newCity(), cash: 10000 };
  const rejected = constructBuilding("nvidia", { r: 1, c: 1 }, 500, empty);
  assert.match(rejected.error, /Stock Exchange/);
  assert.equal(rejected.state, empty);
  assert.equal(constructBuilding("hall", { r: 1, c: 1 }, 0, empty).error, "");
  const city = tradingCity();
  const removed = bulldoze({ r: -6, c: 0 }, city).state;
  assert.match(
    constructBuilding("nvidia", { r: 1, c: 1 }, 500, removed).error,
    /Stock Exchange/,
  );
});
test("partial and complete liquidation conserve cash, units and remaining cost basis", () => {
  const city = constructBuilding("nvidia", { r: 1, c: 1 }, 800, tradingCity(), {
    NVDA: 100,
  }).state;
  const cash = city.cash;
  const partial = sellPosition(city, "NVDA", 0.25, { NVDA: 200 });
  assert.equal(partial.error, "");
  assert.equal(partial.state.cash, cash + 400);
  assert.equal(partial.state.realizedPnl, 200);
  const stocks = partial.state.buildings.filter((b) => b.kind === "nvidia");
  assert.equal(
    stocks.reduce((s, b) => s + b.quantity, 0),
    6,
  );
  assert.equal(
    stocks.reduce((s, b) => s + b.quantity * b.entry, 0),
    600,
  );
  const full = sellPosition(partial.state, "NVDA", 1, { NVDA: 200 });
  assert.equal(full.state.realizedPnl, 800);
  assert.equal(full.state.cash, cash + 1600);
  assert.equal(full.state.buildings.length, 1);
  for (const fraction of [0, -1, 1.1, NaN, Infinity])
    assert.equal(sellPosition(city, "NVDA", fraction).state, city);
  assert.match(sellPosition(city, "TSLA", 1).error, /do not own/);
});
test("building placement is strictly limited to 1 per service and 1 per company", () => {
  const city = tradingCity(); // contains 'exchange'
  // 1. Service building duplicate rejection
  const dupExchange = constructBuilding("exchange", { r: 1, c: 1 }, 400, city);
  assert.match(dupExchange.error, /already built/i);
  assert.equal(dupExchange.state, city);

  const hall = constructBuilding("hall", { r: -4, c: -3 }, 250, city);
  assert.equal(hall.error, "");
  const dupHall = constructBuilding("hall", { r: 1, c: 1 }, 250, hall.state);
  assert.match(dupHall.error, /already built/i);
  assert.equal(dupHall.state, hall.state);

  // 2. Company building duplicate rejection
  const nvda1 = constructBuilding("nvidia", { r: 1, c: 1 }, 500, hall.state, { NVDA: 100 });
  assert.equal(nvda1.error, "");
  const dupNvda = constructBuilding("nvidia", { r: 1, c: 4 }, 500, nvda1.state, { NVDA: 100 });
  assert.match(dupNvda.error, /already built/i);
  assert.equal(dupNvda.state, nvda1.state);
});
test("catalogue contains 30 hero bespoke stocks, 10 sector templates, 70 sector companies, 5 civic services, and 100 S&P 100 assets", () => {
  const heroDefs = catalogue.filter((d) => d.category === "companies" && d.ticker);
  assert.equal(heroDefs.length, 30);
  const sectorCompanyDefs = catalogue.filter((d) => d.category === "sectors" && d.ticker);
  assert.equal(sectorCompanyDefs.length, 70);
  const companyDefs = catalogue.filter((d) => d.ticker);
  assert.equal(companyDefs.length, 100);
  assert.equal(catalogue.length, 115);
  assert.equal(assets.length, 100);
  assert.equal(HERO_TICKERS.length, 30);
  for (const def of catalogue) {
    const baseCity = def.ticker ? tradingCity() : { ...newCity(), cash: 10000 };
    const built = constructBuilding(
      def.kind,
      { r: 1, c: 1 },
      100,
      baseCity,
    );
    assert.equal(built.error, "");
    assert.ok(isSavedCity(built.state));
    const path = buildingImage(built.state.buildings.at(-1));
    assert.ok(
      existsSync(
        new URL(`../public/assets/sprites/${path}.png`, import.meta.url),
      ),
      path,
    );
    if (def.ticker && isHeroTicker(def.ticker)) {
      for (const lvl of ["minus", "level_1", "level_2", "level_3"]) {
        assert.ok(
          existsSync(
            new URL(
              `../public/assets/sprites/${def.kind}/${lvl}.png`,
              import.meta.url,
            ),
          ),
          `${def.kind}/${lvl}.png`,
        );
      }
    } else if (def.sectorKey) {
      for (const lvl of ["minus", "level_1", "level_2", "level_3"]) {
        assert.ok(
          existsSync(
            new URL(
              `../public/assets/sprites/${def.sectorKey}/${lvl}.png`,
              import.meta.url,
            ),
          ),
          `${def.sectorKey}/${lvl}.png`,
        );
      }
    }
  }
});
test("regular-session estimate handles DST, weekends and closing boundary", () => {
  assert.equal(marketClock(new Date("2026-01-05T14:00:00Z")).open, false);
  assert.equal(marketClock(new Date("2026-01-05T15:00:00Z")).open, true);
  assert.equal(marketClock(new Date("2026-07-07T13:30:00Z")).open, true);
  assert.equal(marketClock(new Date("2026-07-07T20:00:00Z")).open, false);
  assert.equal(marketClock(new Date("2026-07-05T15:00:00Z")).open, false);
});
test("position-only buys track without buildings and sell by fraction", async () => {
  const { buyPaper, sellPaper } = await import("../lib/city.ts");
  const prices = { AAPL: 200 };
  let city = { ...newCity(), cash: 10000 };
  const bought = buyPaper(city, "AAPL", 1000, prices.AAPL);
  assert.equal(bought.error, "");
  assert.equal(bought.state.cash, 9000);
  assert.equal(bought.state.paper.length, 1);
  assert.equal(bought.state.paper[0].quantity, 5);
  assert.ok(isSavedCity(bought.state));
  const sold = sellPaper(bought.state, "AAPL", 0.5, { AAPL: 220 });
  assert.equal(sold.error, "");
  assert.equal(sold.state.paper.length, 1);
  assert.equal(sold.state.paper[0].quantity, 2.5);
  assert.equal(sold.state.cash, 9000 + 550);
  const all = sellPaper(sold.state, "AAPL", 1, { AAPL: 220 });
  assert.equal(all.state.paper.length, 0);
});
test("locked draft buildings persist and validate as saved cities", async () => {
  const locked = {
    ...newCity(),
    buildings: [
      {
        r: 1,
        c: 1,
        id: "draft-1",
        kind: "nvidia",
        quantity: 1,
        entry: 100,
        cost: 100,
        builtAt: Date.now(),
        locked: true,
      },
    ],
  };
  assert.ok(isSavedCity(locked));
  assert.ok(isSavedCity({ ...newCity(), paper: [] }));
  assert.ok(!isSavedCity({ ...newCity(), paper: [{ id: 1 }] }));
});

test("sector towers support multi-deployment of the same sector for different companies while strictly enforcing single-instance per stock", () => {
  assert.equal(SECTOR_DEFINITIONS.length, 10);
  const healthDef = defForSector("sector_healthcare");
  assert.ok(healthDef);
  assert.equal(healthDef.stocks.length, 10);
  assert.ok(healthDef.stocks.includes("JNJ"));
  assert.ok(healthDef.stocks.includes("LLY"));

  const baseCity = constructBuilding("exchange", { r: -6, c: 0 }, 400, { ...newCity(), cash: 10000 }).state;

  // 2. Build JNJ Healthcare Tower
  const b1 = constructBuilding("jnj", { r: 1, c: 1 }, 500, baseCity);
  assert.equal(b1.error, "");
  assert.equal(b1.state.buildings.length, 2);
  const jnjBuilding = b1.state.buildings.find((b) => b.kind === "jnj");
  assert.ok(jnjBuilding);
  assert.equal(buildingImage(jnjBuilding), "sector_healthcare/level_1");

  // 3. Deploy a second Healthcare Tower for LLY on adjacent valid coordinates
  const b2 = constructBuilding("lly", { r: 3, c: 1 }, 500, b1.state);
  assert.equal(b2.error, "");
  assert.equal(b2.state.buildings.length, 3);
  const llyBuilding = b2.state.buildings.find((b) => b.kind === "lly");
  assert.ok(llyBuilding);
  assert.equal(buildingImage(llyBuilding), "sector_healthcare/level_1");

  // 4. Verify duplicate building rule: attempting to build JNJ again fails
  const bDuplicate = constructBuilding("jnj", { r: 5, c: 1 }, 500, b2.state);
  assert.match(bDuplicate.error, /already built/i);
  assert.equal(bDuplicate.state.buildings.length, 3);
});

