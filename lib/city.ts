export type Asset = {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  color: string;
  sprite?: string;
};
export const assets: Asset[] = [
  {
    ticker: "NVDA",
    name: "NVIDIA",
    sector: "Technology",
    price: 142.87,
    change: 3.42,
    color: "#78a943",
    sprite: "nvidia",
  },
  {
    ticker: "TSLA",
    name: "Tesla",
    sector: "Automotive",
    price: 248.5,
    change: -1.24,
    color: "#cb5750",
    sprite: "tesla",
  },
  {
    ticker: "AMZN",
    name: "Amazon",
    sector: "Consumer",
    price: 224.32,
    change: 1.86,
    color: "#d19c47",
    sprite: "amazon",
  },
  {
    ticker: "BLK",
    name: "BlackRock",
    sector: "Finance",
    price: 1018.6,
    change: 0.72,
    color: "#526d69",
    sprite: "blackrock",
  },
  {
    ticker: "MSFT",
    name: "Microsoft",
    sector: "Technology",
    price: 428.76,
    change: 0.83,
    color: "#00a4ef",
    sprite: "microsoft",
  },
  {
    ticker: "JPM",
    name: "JPMorgan Chase",
    sector: "Finance",
    price: 251.9,
    change: 0.54,
    color: "#1170cf",
    sprite: "jpmorgan",
  },
  {
    ticker: "WMT",
    name: "Walmart",
    sector: "Consumer",
    price: 96.8,
    change: 0.48,
    color: "#0071ce",
    sprite: "walmart",
  },
  {
    ticker: "KO",
    name: "Coca-Cola",
    sector: "Consumer",
    price: 62.74,
    change: -0.21,
    color: "#f40009",
    sprite: "coca_cola",
  },
  {
    ticker: "XOM",
    name: "ExxonMobil",
    sector: "Energy",
    price: 109.42,
    change: 1.18,
    color: "#fe000c",
    sprite: "exxonmobil",
  },
  {
    ticker: "UNH",
    name: "UnitedHealth Group",
    sector: "Healthcare",
    price: 598.24,
    change: 0.65,
    color: "#002677",
    sprite: "unitedhealth",
  },
  ...[
    ["AAPL", "Apple", "Technology", 237.49, 1.12],
    ["GOOGL", "Alphabet", "Technology", 192.04, 1.43],
    ["META", "Meta", "Technology", 612.77, -0.64],
    ["NFLX", "Netflix", "Consumer", 886.12, 2.1],
    ["AMD", "AMD", "Technology", 121.34, -1.08],
    ["AVGO", "Broadcom", "Technology", 228.4, 1.65],
    ["COIN", "Coinbase", "Finance", 274.3, -2.32],
    ["BRK.B", "Berkshire Hathaway", "Finance", 478.2, 0.31],
    ["V", "Visa", "Finance", 338.14, 0.92],
    ["SPY", "S&P 500 ETF", "Index", 598.48, 0.73],
    ["QQQ", "Nasdaq 100 ETF", "Index", 523.16, 1.08],
  ].map(([ticker, name, sector, price, change]) => ({
    ticker: String(ticker),
    name: String(name),
    sector: String(sector),
    price: Number(price),
    change: Number(change),
    color: "#6c8179",
  })),
];

export type Cell = { r: number; c: number };
export type Category = "roads" | "companies" | "services";
export type Tool = "inspect" | "road" | "build" | "bulldoze" | "move";
export type BuildingKind =
  | "nvidia"
  | "tesla"
  | "amazon"
  | "blackrock"
  | "microsoft"
  | "jpmorgan"
  | "walmart"
  | "coca_cola"
  | "exxonmobil"
  | "unitedhealth"
  | "hall"
  | "exchange"
  | "oracle";
export type BuildingDef = {
  kind: BuildingKind;
  name: string;
  category: "companies" | "services";
  ticker?: string;
  image: string;
  cost: number;
  description: string;
};
export const catalogue: BuildingDef[] = [
  {
    kind: "nvidia",
    name: "NVIDIA",
    category: "companies",
    ticker: "NVDA",
    image: "nvidia/level_1",
    cost: 500,
    description:
      "Semiconductors & AI. Place a building to create a simulated NVIDIA stock position.",
  },
  {
    kind: "tesla",
    name: "Tesla",
    category: "companies",
    ticker: "TSLA",
    image: "tesla/level_1",
    cost: 500,
    description:
      "Electric vehicles & energy. Place a building to create a simulated Tesla stock position.",
  },
  {
    kind: "amazon",
    name: "Amazon",
    category: "companies",
    ticker: "AMZN",
    image: "amazon/level_1",
    cost: 500,
    description:
      "Commerce & cloud computing. Place a building to create a simulated Amazon stock position.",
  },
  {
    kind: "blackrock",
    name: "BlackRock",
    category: "companies",
    ticker: "BLK",
    image: "blackrock/level_1",
    cost: 500,
    description:
      "Asset management. Place a building to create a simulated BlackRock stock position.",
  },
  {
    kind: "microsoft",
    name: "Microsoft",
    category: "companies",
    ticker: "MSFT",
    image: "microsoft/level_1",
    cost: 500,
    description:
      "Software & cloud infrastructure. Place a building to create a simulated Microsoft stock position.",
  },
  {
    kind: "jpmorgan",
    name: "JPMorgan Chase",
    category: "companies",
    ticker: "JPM",
    image: "jpmorgan/level_1",
    cost: 500,
    description:
      "Global banking & financial services. Place a building to create a simulated JPMorgan stock position.",
  },
  {
    kind: "walmart",
    name: "Walmart",
    category: "companies",
    ticker: "WMT",
    image: "walmart/level_1",
    cost: 500,
    description:
      "Retail & supply chain networks. Place a building to create a simulated Walmart stock position.",
  },
  {
    kind: "coca_cola",
    name: "Coca-Cola",
    category: "companies",
    ticker: "KO",
    image: "coca_cola/level_1",
    cost: 500,
    description:
      "Global beverages & consumer goods. Place a building to create a simulated Coca-Cola stock position.",
  },
  {
    kind: "exxonmobil",
    name: "ExxonMobil",
    category: "companies",
    ticker: "XOM",
    image: "exxonmobil/level_1",
    cost: 500,
    description:
      "Energy & petrochemical infrastructure. Place a building to create a simulated ExxonMobil stock position.",
  },
  {
    kind: "unitedhealth",
    name: "UnitedHealth",
    category: "companies",
    ticker: "UNH",
    image: "unitedhealth/level_1",
    cost: 500,
    description:
      "Healthcare & medical services. Place a building to create a simulated UnitedHealth stock position.",
  },
  {
    kind: "hall",
    name: "City Hall",
    category: "services",
    image: "functional/portfolio_city_hall",
    cost: 250,
    description:
      "Your city headquarters. Select it to inspect city finances and your portfolio.",
  },
  {
    kind: "exchange",
    name: "Stock Exchange",
    category: "services",
    image: "functional/stock_exchange",
    cost: 400,
    description:
      "A home for the market. Select it to open the stock watchlist.",
  },
  {
    kind: "oracle",
    name: "Data Center",
    category: "services",
    image: "functional/oracle_data_center",
    cost: 300,
    description:
      "Your city’s information hub. Select it to inspect the status of the demo data.",
  },
];
export type Building = Cell & {
  id: string;
  kind: BuildingKind;
  quantity: number;
  entry: number;
  cost: number;
  builtAt: number;
};
export type CityState = {
  version: 2;
  cash: number;
  buildings: Building[];
  roads: Cell[];
};
export const STORAGE = "stockva.sandbox.v2";
export const ROAD_COST = 10;
export const newCity = (): CityState => ({
  version: 2,
  cash: 10000,
  buildings: [],
  roads: [],
});
export const point = (r: number, c: number) => ({
  x: 640 + (c - r) * 32,
  y: 350 + (c + r) * 18,
});
export const fromPoint = (x: number, y: number): Cell => ({
  r: Math.round(((y - 350) / 18 - (x - 640) / 32) / 2),
  c: Math.round(((y - 350) / 18 + (x - 640) / 32) / 2),
});
export const cellKey = (p: Cell) => `${p.r},${p.c}`;
export const sameCell = (a: Cell, b: Cell) => a.r === b.r && a.c === b.c;
export const defFor = (kind: BuildingKind) =>
  catalogue.find((d) => d.kind === kind)!;
export const assetFor = (ticker: string) =>
  assets.find((a) => a.ticker === ticker)!;
export const sprite = (path: string) =>
  path.startsWith("vehicles/")
    ? `/assets/sprites/${path}.webp`
    : `/assets/sprites/${path}.png`;
export const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
export const wholeMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
export const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
export type PriceMap = Record<string, number>;
export const basePrices = (): PriceMap =>
  Object.fromEntries(assets.map((a) => [a.ticker, a.price]));
export const MARKET_SOURCE = "Local price simulation";
export const PROVIDER_TAG = "Simulated stock position";
export function tickMarket(prev: PriceMap, rand: () => number = Math.random) {
  const next: PriceMap = { ...prev };
  for (const a of assets) {
    const drift = (rand() - 0.5) * 0.018;
    const price = Math.max(1, prev[a.ticker] * (1 + drift));
    next[a.ticker] = Math.round(price * 100) / 100;
  }
  return next;
}
export const priceOf = (ticker: string, prices?: PriceMap) =>
  prices?.[ticker] ?? assetFor(ticker).price;
export const valueOf = (b: Building, prices?: PriceMap) => {
  const d = defFor(b.kind);
  return d.ticker ? b.quantity * priceOf(d.ticker, prices) : 0;
};
export const returnOf = (b: Building, prices?: PriceMap) =>
  b.entry
    ? ((priceOf(defFor(b.kind).ticker!, prices) - b.entry) / b.entry) * 100
    : 0;
export const tier = (n: number) =>
  n < 0 ? "minus" : n < 5 ? "level_1" : n < 10 ? "level_2" : "level_3";
export const buildingImage = (b: Building, prices?: PriceMap) =>
  defFor(b.kind).ticker
    ? `${b.kind}/${tier(returnOf(b, prices))}`
    : defFor(b.kind).image;
export function allocationOf(buildings: Building[], prices?: PriceMap) {
  const total = buildings.reduce((s, b) => s + valueOf(b, prices), 0);
  return buildings.map((b) => ({
    id: b.id,
    value: valueOf(b, prices),
    pct: total ? (valueOf(b, prices) / total) * 100 : 0,
  }));
}
export function healthOf(buildings: Building[], prices?: PriceMap) {
  const stocks = buildings.filter((b) => defFor(b.kind).ticker);
  if (!stocks.length)
    return { label: "No stock buildings", detail: "Place a company to start." };
  const alloc = allocationOf(stocks, prices);
  const max = Math.max(...alloc.map((a) => a.pct));
  const sectors = new Set(
    stocks.map((b) => assetFor(defFor(b.kind).ticker!).sector),
  );
  if (stocks.length === 1)
    return {
      label: "Single-stock city",
      detail: `100% in one asset · concentration risk is maximal.`,
    };
  if (max > 50)
    return {
      label: "Concentrated",
      detail: `${max.toFixed(0)}% in one holding across ${sectors.size} sector${sectors.size === 1 ? "" : "s"}.`,
    };
  if (max > 35 || sectors.size < 2)
    return {
      label: "Top-heavy",
      detail: `Largest holding ${max.toFixed(0)}% · ${sectors.size} sector${sectors.size === 1 ? "" : "s"}.`,
    };
  return {
    label: "Diversified (demo)",
    detail: `${stocks.length} holdings · ${sectors.size} sectors · largest ${max.toFixed(0)}%.`,
  };
}
export function marketClock(now: Date = new Date()) {
  // NYSE 09:30–16:00 ET, Mon–Fri. September = EDT (UTC-4).
  const et = new Date(now.getTime() - 4 * 3600 * 1000);
  const day = et.getUTCDay();
  const mins = et.getUTCHours() * 60 + et.getUTCMinutes();
  const open = day > 0 && day < 6 && mins >= 570 && mins < 960;
  const next = open
    ? "Closes 16:00 ET"
    : day === 0 || day === 6 || mins >= 960
      ? "Opens next weekday 09:30 ET"
      : "Opens today 09:30 ET";
  return { open, label: open ? "Market open" : "Market closed", next };
}
export function quoteDiff(ticker: string, prices?: PriceMap) {
  const ref = priceOf(ticker, prices);
  let h = 0;
  for (const ch of ticker) h = (h * 31 + ch.charCodeAt(0)) % 1000;
  const bps = (h % 30) - 10; // -10..+19 bps deterministic per ticker
  const onchain = Math.round(ref * (1 + bps / 10000) * 100) / 100;
  return { ref, onchain, bps };
}
export function txHashFor(id: string) {
  let h1 = 0x811c9dc5,
    h2 = 0x01000193;
  for (let i = 0; i < id.length; i++) {
    h1 = Math.imul(h1 ^ id.charCodeAt(i), 16777619);
    h2 = Math.imul(h2 + id.charCodeAt(i), 2246822519);
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return `0x${hex(h1)}${hex(h2)}${hex(h1 ^ h2)}${hex(h2 ^ 0x9e3779b9)}${hex(h1 + h2)}`;
}
export const bscLink = (hash: string) =>
  `https://testnet.bscscan.com/tx/${hash}`;
// A deliberately conservative polygon inside the supplied island's buildable grass.
export const LAND = [
  [355, 124],
  [760, 124],
  [980, 208],
  [1084, 328],
  [1030, 434],
  [811, 546],
  [650, 563],
  [432, 484],
  [278, 403],
  [190, 304],
  [281, 213],
];
export function insideLand(x: number, y: number) {
  let inside = false;
  for (let i = 0, j = LAND.length - 1; i < LAND.length; j = i++) {
    const [xi, yi] = LAND[i],
      [xj, yj] = LAND[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
export function validCell(cell: Cell) {
  const { x, y } = point(cell.r, cell.c);
  return (
    Number.isInteger(cell.r) &&
    Number.isInteger(cell.c) &&
    [
      [x, y - 18],
      [x + 32, y],
      [x, y + 18],
      [x - 32, y],
    ].every(([a, b]) => insideLand(a, b))
  );
}
export const ALL_CELLS: Cell[] = [];
for (let r = -16; r <= 16; r++)
  for (let c = -16; c <= 16; c++)
    if (validCell({ r, c })) ALL_CELLS.push({ r, c });
export const footprint = (cell: Cell): Cell[] => [
  { r: cell.r, c: cell.c },
  { r: cell.r + 1, c: cell.c },
  { r: cell.r, c: cell.c + 1 },
  { r: cell.r + 1, c: cell.c + 1 },
];
export const buildingAt = (cell: Cell, state: CityState) =>
  state.buildings.find((b) => footprint(b).some((p) => sameCell(p, cell)));
export function placementError(
  cell: Cell,
  state: CityState,
  ignoreId?: string,
) {
  const cells = footprint(cell);
  if (cells.some((p) => !validCell(p))) return "Outside the buildable area";
  if (cells.some((p) => state.roads.some((r) => sameCell(p, r))))
    return "Road in the way";
  if (
    state.buildings.some(
      (b) =>
        b.id !== ignoreId &&
        footprint(b).some((p) => cells.some((c) => sameCell(c, p))),
    )
  )
    return "Building in the way";
  return "";
}
export function hasRoad(b: Cell, roads: Cell[]) {
  const cells = footprint(b);
  return roads.some((r) =>
    cells.some((p) => Math.abs(p.r - r.r) + Math.abs(p.c - r.c) === 1),
  );
}
export function roadSprite(cell: Cell, roads: Cell[]) {
  const has = (r: number, c: number) =>
    roads.some((p) => p.r === r && p.c === c);
  const ports = [
    has(cell.r, cell.c - 1) ? "ul" : "",
    has(cell.r - 1, cell.c) ? "ur" : "",
    has(cell.r + 1, cell.c) ? "ll" : "",
    has(cell.r, cell.c + 1) ? "lr" : "",
  ].filter(Boolean);
  if (ports.length === 4) return "intersection";
  if (ports.length === 3) return "t_" + ports.join("_");
  if (ports.length === 2)
    return (
      {
        ul_ur: "corner_ul_ur",
        ul_ll: "corner_ll_ul",
        ul_lr: "straight_ul_lr",
        ur_ll: "straight_ur_ll",
        ur_lr: "corner_ur_lr",
        ll_lr: "corner_lr_ll",
      } as Record<string, string>
    )[ports.join("_")];
  return ports.includes("ul") || ports.includes("lr")
    ? "straight_ul_lr"
    : "straight_ur_ll";
}
// Orthogonal path: choose the major axis first, so a drag cannot skip cells.
export function roadLine(start: Cell, end: Cell) {
  const cells: Cell[] = [{ ...start }];
  let { r, c } = start;
  const firstRow = Math.abs(end.r - r) >= Math.abs(end.c - c);
  const row = () => {
    while (r !== end.r) {
      r += Math.sign(end.r - r);
      cells.push({ r, c });
    }
  };
  const col = () => {
    while (c !== end.c) {
      c += Math.sign(end.c - c);
      cells.push({ r, c });
    }
  };
  if (firstRow) {
    row();
    col();
  } else {
    col();
    row();
  }
  return cells;
}
export function roadError(cells: Cell[], state: CityState) {
  if (cells.some((c) => !validCell(c))) return "Road must stay on the island";
  if (cells.some((c) => buildingAt(c, state)))
    return "A building blocks this route";
  const count = cells.filter(
    (c) => !state.roads.some((r) => sameCell(c, r)),
  ).length;
  return count * ROAD_COST > state.cash ? "Not enough demo funds" : "";
}
export function constructRoad(cells: Cell[], state: CityState) {
  const error = roadError(cells, state);
  if (error) return { state, error };
  const additions = cells.filter(
    (c, i) =>
      cells.findIndex((p) => sameCell(p, c)) === i &&
      !state.roads.some((r) => sameCell(r, c)),
  );
  return {
    state: {
      ...state,
      cash: state.cash - additions.length * ROAD_COST,
      roads: [...state.roads, ...additions],
    },
    error: "",
  };
}
export function constructBuilding(
  kind: BuildingKind,
  cell: Cell,
  amount: number,
  state: CityState,
  prices?: PriceMap,
) {
  const error = placementError(cell, state);
  if (error) return { state, error };
  const def = defFor(kind),
    cost = def.ticker ? amount : def.cost;
  if (!Number.isFinite(cost) || cost < 1)
    return { state, error: "Enter a position amount of at least $1" };
  if (cost > state.cash) return { state, error: "Not enough demo funds" };
  const price = def.ticker ? priceOf(def.ticker, prices) : 0;
  return {
    state: {
      ...state,
      cash: state.cash - cost,
      buildings: [
        ...state.buildings,
        {
          ...cell,
          id: globalThis.crypto.randomUUID(),
          kind,
          quantity: price ? cost / price : 0,
          entry: price,
          cost,
          builtAt: Date.now(),
        },
      ],
    },
    error: "",
  };
}
export function bulldoze(cell: Cell, state: CityState, prices?: PriceMap) {
  const b = buildingAt(cell, state);
  if (b)
    return {
      state: {
        ...state,
        cash: state.cash + valueOf(b, prices),
        buildings: state.buildings.filter((p) => p.id !== b.id),
      },
      message: defFor(b.kind).ticker
        ? `${defFor(b.kind).name} removed. ${money(valueOf(b, prices))} returned to demo funds.`
        : `${defFor(b.kind).name} removed.`,
    };
  if (state.roads.some((r) => sameCell(r, cell)))
    return {
      state: { ...state, roads: state.roads.filter((r) => !sameCell(r, cell)) },
      message: "Road removed.",
    };
  return { state, message: "" };
}
// Walk every edge of the largest connected road component, backtracking at dead ends.
export function trafficRoute(roads: Cell[]) {
  const keys = new Set(roads.map(cellKey));
  const visited = new Set<string>();
  let best: Cell[] = [];
  const neighbors = (c: Cell) =>
    [
      { r: c.r - 1, c: c.c },
      { r: c.r, c: c.c + 1 },
      { r: c.r + 1, c: c.c },
      { r: c.r, c: c.c - 1 },
    ].filter((p) => keys.has(cellKey(p)));
  for (const start of roads) {
    if (visited.has(cellKey(start))) continue;
    const path: Cell[] = [];
    const walk = (c: Cell) => {
      visited.add(cellKey(c));
      path.push(c);
      for (const n of neighbors(c)) {
        if (!visited.has(cellKey(n))) {
          walk(n);
          path.push(c);
        }
      }
    };
    walk(start);
    if (path.length > best.length) best = path;
  }
  return best.length >= 5 ? best : [];
}
export function isSavedCity(input: unknown): input is CityState {
  if (!input || typeof input !== "object") return false;
  const s = input as CityState;
  return (
    s.version === 2 &&
    Number.isFinite(s.cash) &&
    s.cash >= 0 &&
    Array.isArray(s.roads) &&
    Array.isArray(s.buildings) &&
    s.roads.every(validCell) &&
    s.buildings.every(
      (b) =>
        catalogue.some((d) => d.kind === b.kind) &&
        typeof b.id === "string" &&
        footprint(b).every(validCell) &&
        Number.isFinite(b.cost) &&
        Number.isFinite(b.entry) &&
        Number.isFinite(b.quantity) &&
        b.quantity >= 0,
    )
  );
}
