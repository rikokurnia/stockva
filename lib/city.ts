export type Asset = {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  color: string;
  sprite?: string;
  logo?: string;
  rwaLogo?: string;
};

export function stockLogoUrl(ticker: string): string {
  const clean = ticker.toLowerCase().replace(/\./g, "_");
  return `/logos/stocks/${clean}.svg`;
}

export function rwaLogoUrl(ticker: string): string {
  const clean = ticker.toLowerCase().replace(/\./g, "_");
  if (clean === "brk_b") return `/logos/stocks/brk_b.svg`;
  return `/logos/rwa/${clean}.png`;
}

export function stockLogoApiUrl(ticker: string): string {
  const clean = ticker.toUpperCase().replace(/\./g, "-");
  return `https://assets.parqet.com/logos/symbol/${clean}`;
}

export function rwaLogoApiUrl(ticker: string): string {
  const clean = ticker.replace(/\./g, "");
  return `https://xstocks-metadata.backed.fi/logos/tokens/${clean}x.png`;
}

export const HERO_ASSETS: Asset[] = [
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
  {
    ticker: "AAPL",
    name: "Apple",
    sector: "Technology",
    price: 237.49,
    change: 1.12,
    color: "#a2aaad",
    sprite: "aapl",
  },
  {
    ticker: "GOOGL",
    name: "Alphabet",
    sector: "Technology",
    price: 192.04,
    change: 1.43,
    color: "#4285f4",
    sprite: "googl",
  },
  {
    ticker: "META",
    name: "Meta",
    sector: "Technology",
    price: 612.77,
    change: -0.64,
    color: "#0668e1",
    sprite: "meta",
  },
  {
    ticker: "NFLX",
    name: "Netflix",
    sector: "Consumer",
    price: 886.12,
    change: 2.1,
    color: "#e50914",
    sprite: "nflx",
  },
  {
    ticker: "AMD",
    name: "AMD",
    sector: "Technology",
    price: 121.34,
    change: -1.08,
    color: "#ed1c24",
    sprite: "amd",
  },
  {
    ticker: "AVGO",
    name: "Broadcom",
    sector: "Technology",
    price: 228.4,
    change: 1.65,
    color: "#cc092f",
    sprite: "avgo",
  },
  {
    ticker: "COIN",
    name: "Coinbase",
    sector: "Finance",
    price: 274.3,
    change: -2.32,
    color: "#0052ff",
    sprite: "coin",
  },
  {
    ticker: "V",
    name: "Visa",
    sector: "Finance",
    price: 338.14,
    change: 0.92,
    color: "#1a1f71",
    sprite: "v",
  },
  {
    ticker: "SPY",
    name: "S&P 500 ETF",
    sector: "Index",
    price: 598.48,
    change: 0.73,
    color: "#003366",
    sprite: "spy",
  },
  {
    ticker: "QQQ",
    name: "Nasdaq 100 ETF",
    sector: "Index",
    price: 523.16,
    change: 1.08,
    color: "#1b5e20",
    sprite: "qqq",
  },
  {
    ticker: "ADBE",
    name: "Adobe",
    sector: "Technology",
    price: 345.2,
    change: 0.4,
    color: "#fa0f00",
    sprite: "adbe",
  },
  {
    ticker: "CRM",
    name: "Salesforce",
    sector: "Technology",
    price: 260.1,
    change: -0.3,
    color: "#00a1e0",
    sprite: "crm",
  },
  {
    ticker: "ORCL",
    name: "Oracle",
    sector: "Technology",
    price: 168.4,
    change: 0.8,
    color: "#c74634",
    sprite: "orcl",
  },
  {
    ticker: "INTC",
    name: "Intel",
    sector: "Technology",
    price: 23.8,
    change: -0.5,
    color: "#0071c5",
    sprite: "intc",
  },
  {
    ticker: "PLTR",
    name: "Palantir",
    sector: "Technology",
    price: 88.2,
    change: 1.3,
    color: "#101113",
    sprite: "pltr",
  },
  {
    ticker: "PEP",
    name: "PepsiCo",
    sector: "Consumer",
    price: 148.3,
    change: -0.2,
    color: "#004b93",
    sprite: "pep",
  },
  {
    ticker: "MCD",
    name: "McDonald’s",
    sector: "Consumer",
    price: 307.2,
    change: 0.3,
    color: "#ffbc0d",
    sprite: "mcd",
  },
  {
    ticker: "COST",
    name: "Costco",
    sector: "Consumer",
    price: 963.7,
    change: 0.5,
    color: "#005dab",
    sprite: "cost",
  },
  {
    ticker: "DIS",
    name: "Walt Disney",
    sector: "Consumer",
    price: 110.8,
    change: 0.6,
    color: "#113ccf",
    sprite: "dis",
  },
  {
    ticker: "PFE",
    name: "Pfizer",
    sector: "Healthcare",
    price: 25.1,
    change: 0.2,
    color: "#0093d0",
    sprite: "pfe",
  },
];

export const SECTOR_COMPANIES_RAW: [
  ticker: string,
  name: string,
  sector: string,
  price: number,
  change: number,
  sectorKey: SectorBuildingKind,
  kind: SectorCompanyKind,
][] = [
  // 1. sector_healthcare (10 stocks)
  [
    "JNJ",
    "Johnson & Johnson",
    "Healthcare",
    161.2,
    0.35,
    "sector_healthcare",
    "jnj",
  ],
  ["LLY", "Eli Lilly", "Healthcare", 885.4, 1.25, "sector_healthcare", "lly"],
  ["ABBV", "AbbVie", "Healthcare", 188.7, -0.42, "sector_healthcare", "abbv"],
  [
    "TMO",
    "Thermo Fisher",
    "Healthcare",
    572.1,
    0.85,
    "sector_healthcare",
    "tmo",
  ],
  ["DHR", "Danaher", "Healthcare", 258.9, -0.15, "sector_healthcare", "dhr"],
  [
    "BMY",
    "Bristol-Myers",
    "Healthcare",
    53.6,
    0.45,
    "sector_healthcare",
    "bmy",
  ],
  ["AMGN", "Amgen", "Healthcare", 314.8, 0.62, "sector_healthcare", "amgn"],
  ["GILD", "Gilead", "Healthcare", 84.5, 0.92, "sector_healthcare", "gild"],
  ["ABT", "Abbott", "Healthcare", 132.7, 0.1, "sector_healthcare", "abt"],
  ["MRK", "Merck", "Healthcare", 85.4, -0.3, "sector_healthcare", "mrk"],

  // 2. sector_technology (7 stocks)
  ["IBM", "IBM", "Technology", 221.4, 0.48, "sector_technology", "ibm"],
  ["NOW", "ServiceNow", "Technology", 892.6, 1.34, "sector_technology", "now"],
  ["INTU", "Intuit", "Technology", 645.8, 0.72, "sector_technology", "intu"],
  [
    "PANW",
    "Palo Alto Networks",
    "Technology",
    368.9,
    0.88,
    "sector_technology",
    "panw",
  ],
  ["SNPS", "Synopsys", "Technology", 512.4, 0.65, "sector_technology", "snps"],
  [
    "CDNS",
    "Cadence Design",
    "Technology",
    284.1,
    0.52,
    "sector_technology",
    "cdns",
  ],
  ["CSCO", "Cisco", "Technology", 61.3, 0.2, "sector_technology", "csco"],

  // 3. sector_semiconductor (7 stocks)
  [
    "TXN",
    "Texas Instruments",
    "Technology",
    204.3,
    -0.32,
    "sector_semiconductor",
    "txn",
  ],
  [
    "QCOM",
    "Qualcomm",
    "Technology",
    168.2,
    0.94,
    "sector_semiconductor",
    "qcom",
  ],
  [
    "AMAT",
    "Applied Materials",
    "Technology",
    202.5,
    1.05,
    "sector_semiconductor",
    "amat",
  ],
  [
    "LRCX",
    "Lam Research",
    "Technology",
    81.4,
    1.42,
    "sector_semiconductor",
    "lrcx",
  ],
  [
    "MU",
    "Micron Technology",
    "Technology",
    104.2,
    -1.12,
    "sector_semiconductor",
    "mu",
  ],
  [
    "ADI",
    "Analog Devices",
    "Technology",
    218.6,
    0.38,
    "sector_semiconductor",
    "adi",
  ],
  [
    "KLAC",
    "KLA Corporation",
    "Technology",
    712.5,
    1.22,
    "sector_semiconductor",
    "klac",
  ],

  // 4. sector_finance (9 stocks)
  ["BAC", "Bank of America", "Finance", 42.8, 0.65, "sector_finance", "bac"],
  ["WFC", "Wells Fargo", "Finance", 64.2, 0.42, "sector_finance", "wfc"],
  ["C", "Citigroup", "Finance", 66.8, 0.81, "sector_finance", "c"],
  ["MS", "Morgan Stanley", "Finance", 112.5, 0.95, "sector_finance", "ms"],
  ["SCHW", "Charles Schwab", "Finance", 73.6, -0.35, "sector_finance", "schw"],
  ["PGR", "Progressive", "Finance", 248.9, 0.78, "sector_finance", "pgr"],
  ["MCO", "Moody’s", "Finance", 475.6, 0.61, "sector_finance", "mco"],
  ["GS", "Goldman Sachs", "Finance", 589.2, 0.6, "sector_finance", "gs"],
  ["MA", "Mastercard", "Finance", 542.1, 0.4, "sector_finance", "ma"],

  // 5. sector_consumer (9 stocks)
  ["PG", "Procter & Gamble", "Consumer", 172.5, 0.22, "sector_consumer", "pg"],
  ["HD", "Home Depot", "Consumer", 398.2, 0.55, "sector_consumer", "hd"],
  ["NKE", "Nike", "Consumer", 84.6, -0.85, "sector_consumer", "nke"],
  ["SBUX", "Starbucks", "Consumer", 95.8, 0.45, "sector_consumer", "sbux"],
  ["LOW", "Lowe’s", "Consumer", 262.4, 0.38, "sector_consumer", "low"],
  ["TJX", "TJX Companies", "Consumer", 118.6, 0.68, "sector_consumer", "tjx"],
  ["MDLZ", "Mondelez", "Consumer", 71.8, 0.15, "sector_consumer", "mdlz"],
  ["PM", "Philip Morris", "Consumer", 124.6, 0.42, "sector_consumer", "pm"],
  ["MO", "Altria Group", "Consumer", 52.8, -0.22, "sector_consumer", "mo"],

  // 6. sector_energy (6 stocks)
  ["COP", "ConocoPhillips", "Energy", 108.4, 0.95, "sector_energy", "cop"],
  ["EOG", "EOG Resources", "Energy", 126.8, 0.75, "sector_energy", "eog"],
  ["MPC", "Marathon Petroleum", "Energy", 168.2, 1.05, "sector_energy", "mpc"],
  ["PSX", "Phillips 66", "Energy", 134.6, 0.62, "sector_energy", "psx"],
  ["VLO", "Valero Energy", "Energy", 142.8, 0.84, "sector_energy", "vlo"],
  ["CVX", "Chevron", "Energy", 156.8, 0.4, "sector_energy", "cvx"],

  // 7. sector_industrial (9 stocks)
  ["CAT", "Caterpillar", "Industrial", 388.5, 1.45, "sector_industrial", "cat"],
  ["GE", "GE Aerospace", "Industrial", 188.2, 1.82, "sector_industrial", "ge"],
  [
    "UNP",
    "Union Pacific",
    "Industrial",
    242.6,
    0.34,
    "sector_industrial",
    "unp",
  ],
  ["HON", "Honeywell", "Industrial", 212.8, 0.25, "sector_industrial", "hon"],
  [
    "RTX",
    "RTX Corporation",
    "Industrial",
    122.4,
    0.58,
    "sector_industrial",
    "rtx",
  ],
  [
    "LMT",
    "Lockheed Martin",
    "Industrial",
    578.9,
    0.72,
    "sector_industrial",
    "lmt",
  ],
  ["BA", "Boeing", "Industrial", 154.8, -1.45, "sector_industrial", "ba"],
  [
    "DE",
    "Deere & Company",
    "Industrial",
    408.2,
    0.64,
    "sector_industrial",
    "de",
  ],
  ["UPS", "UPS", "Industrial", 132.5, -0.52, "sector_industrial", "ups"],

  // 8. sector_communication (4 stocks)
  [
    "CMCSA",
    "Comcast",
    "Communication",
    44.2,
    -0.32,
    "sector_communication",
    "cmcsa",
  ],
  [
    "TMUS",
    "T-Mobile US",
    "Communication",
    204.8,
    0.85,
    "sector_communication",
    "tmus",
  ],
  ["VZ", "Verizon", "Communication", 43.6, 0.22, "sector_communication", "vz"],
  [
    "CHTR",
    "Charter",
    "Communication",
    335.4,
    -0.92,
    "sector_communication",
    "chtr",
  ],

  // 9. sector_etf_index (3 stocks)
  ["IWM", "Russell 2000 ETF", "Index", 218.4, 0.82, "sector_etf_index", "iwm"],
  [
    "VTI",
    "Vanguard Total Stock",
    "Index",
    284.5,
    0.68,
    "sector_etf_index",
    "vti",
  ],
  ["VOO", "Vanguard S&P 500", "Index", 548.2, 0.71, "sector_etf_index", "voo"],

  // 10. sector_generic (6 stocks)
  ["LIN", "Linde", "Materials", 468.2, 0.38, "sector_generic", "lin"],
  ["NEE", "NextEra Energy", "Utilities", 82.4, 0.52, "sector_generic", "nee"],
  ["SO", "Southern Company", "Utilities", 88.6, 0.28, "sector_generic", "so"],
  ["DUK", "Duke Energy", "Utilities", 114.2, 0.18, "sector_generic", "duk"],
  ["WM", "Waste Management", "Industrial", 214.5, 0.42, "sector_generic", "wm"],
  [
    "BRK.B",
    "Berkshire Hathaway",
    "Finance",
    478.2,
    0.31,
    "sector_generic",
    "brk_b",
  ],
];

export const assets: Asset[] = [
  ...HERO_ASSETS,
  ...SECTOR_COMPANIES_RAW.map(
    ([ticker, name, sector, price, change, sectorKey]) => ({
      ticker,
      name,
      sector,
      price,
      change,
      color: "#6c8179",
      sprite: sectorKey,
    }),
  ),
];

for (const a of assets) {
  a.logo = stockLogoUrl(a.ticker);
  a.rwaLogo = rwaLogoUrl(a.ticker);
}

export type Cell = { r: number; c: number };
export type Category = "roads" | "companies" | "sectors" | "services";
export type Tool = "inspect" | "road" | "build" | "bulldoze" | "move";

export type HeroBuildingKind =
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
  | "aapl"
  | "googl"
  | "meta"
  | "nflx"
  | "amd"
  | "avgo"
  | "coin"
  | "v"
  | "spy"
  | "qqq"
  | "adbe"
  | "crm"
  | "orcl"
  | "intc"
  | "pltr"
  | "pep"
  | "mcd"
  | "cost"
  | "dis"
  | "pfe";

export type ServiceBuildingKind =
  "hall" | "exchange" | "oracle" | "monument" | "agent_hall";

export type SectorBuildingKind =
  | "sector_technology"
  | "sector_semiconductor"
  | "sector_finance"
  | "sector_healthcare"
  | "sector_consumer"
  | "sector_energy"
  | "sector_industrial"
  | "sector_communication"
  | "sector_etf_index"
  | "sector_generic";

export type SectorCompanyKind =
  | "jnj"
  | "lly"
  | "abbv"
  | "tmo"
  | "dhr"
  | "bmy"
  | "amgn"
  | "gild"
  | "abt"
  | "mrk"
  | "ibm"
  | "now"
  | "intu"
  | "panw"
  | "snps"
  | "cdns"
  | "csco"
  | "txn"
  | "qcom"
  | "amat"
  | "lrcx"
  | "mu"
  | "adi"
  | "klac"
  | "bac"
  | "wfc"
  | "c"
  | "ms"
  | "schw"
  | "pgr"
  | "mco"
  | "gs"
  | "ma"
  | "pg"
  | "hd"
  | "nke"
  | "sbux"
  | "low"
  | "tjx"
  | "mdlz"
  | "pm"
  | "mo"
  | "cop"
  | "eog"
  | "mpc"
  | "psx"
  | "vlo"
  | "cvx"
  | "cat"
  | "ge"
  | "unp"
  | "hon"
  | "rtx"
  | "lmt"
  | "ba"
  | "de"
  | "ups"
  | "cmcsa"
  | "tmus"
  | "vz"
  | "chtr"
  | "iwm"
  | "vti"
  | "voo"
  | "lin"
  | "nee"
  | "so"
  | "duk"
  | "wm"
  | "brk_b";

export type BuildingKind =
  | HeroBuildingKind
  | ServiceBuildingKind
  | SectorBuildingKind
  | SectorCompanyKind;

export const HERO_TICKERS = [
  "NVDA",
  "TSLA",
  "AMZN",
  "BLK",
  "MSFT",
  "JPM",
  "WMT",
  "KO",
  "XOM",
  "UNH",
  "AAPL",
  "GOOGL",
  "META",
  "NFLX",
  "AMD",
  "AVGO",
  "COIN",
  "V",
  "SPY",
  "QQQ",
  "ADBE",
  "CRM",
  "ORCL",
  "INTC",
  "PLTR",
  "PEP",
  "MCD",
  "COST",
  "DIS",
  "PFE",
] as const;

export type HeroTicker = (typeof HERO_TICKERS)[number];
export const isHeroTicker = (ticker: string): ticker is HeroTicker =>
  (HERO_TICKERS as readonly string[]).includes(ticker);

export type BuildingDef = {
  kind: BuildingKind;
  name: string;
  category: "companies" | "sectors" | "services";
  ticker?: string;
  image: string;
  cost: number;
  description: string;
  sectorKey?: SectorBuildingKind;
};

export type SectorDefinition = {
  key: SectorBuildingKind;
  kind: SectorBuildingKind;
  name: string;
  sectorName: string;
  category: "sectors";
  image: string;
  cost: number;
  description: string;
  color: string;
  badge: string;
  stocks: string[];
};

export const SECTOR_DEFINITIONS: SectorDefinition[] = [
  {
    key: "sector_technology",
    kind: "sector_technology",
    name: "Tech Innovation Tower",
    sectorName: "Technology & Software",
    category: "sectors",
    image: "sector_technology/level_1",
    cost: 500,
    description:
      "Enterprise software, cloud systems, and cybersecurity powerhouses.",
    color: "#38bdf8",
    badge: "TECH",
    stocks: ["IBM", "NOW", "INTU", "PANW", "SNPS", "CDNS", "CSCO"],
  },
  {
    key: "sector_semiconductor",
    kind: "sector_semiconductor",
    name: "Silicon Foundry",
    sectorName: "Semiconductors & Hardware",
    category: "sectors",
    image: "sector_semiconductor/level_1",
    cost: 500,
    description:
      "Cutting-edge microchip design, wafer fab, and advanced lithography.",
    color: "#a855f7",
    badge: "SEMI",
    stocks: ["TXN", "QCOM", "AMAT", "LRCX", "MU", "ADI", "KLAC"],
  },
  {
    key: "sector_finance",
    kind: "sector_finance",
    name: "Capital Exchange",
    sectorName: "Financial Services & Banking",
    category: "sectors",
    image: "sector_finance/level_1",
    cost: 500,
    description:
      "Global commercial banking, credit networks, and asset custodians.",
    color: "#34d399",
    badge: "FIN",
    stocks: ["BAC", "WFC", "C", "MS", "SCHW", "PGR", "MCO", "GS", "MA"],
  },
  {
    key: "sector_healthcare",
    kind: "sector_healthcare",
    name: "Healthcare & Bio Complex",
    sectorName: "Healthcare & Pharmaceuticals",
    category: "sectors",
    image: "sector_healthcare/level_1",
    cost: 500,
    description:
      "Biomedical research, clinical therapies, and life sciences innovation.",
    color: "#f43f5e",
    badge: "HEALTH",
    stocks: [
      "JNJ",
      "LLY",
      "ABBV",
      "TMO",
      "DHR",
      "BMY",
      "AMGN",
      "GILD",
      "ABT",
      "MRK",
    ],
  },
  {
    key: "sector_consumer",
    kind: "sector_consumer",
    name: "Consumer Plaza",
    sectorName: "Consumer & Retail",
    category: "sectors",
    image: "sector_consumer/level_1",
    cost: 500,
    description:
      "Iconic consumer goods, retail chains, and household brand staples.",
    color: "#f59e0b",
    badge: "CONS",
    stocks: ["PG", "HD", "NKE", "SBUX", "LOW", "TJX", "MDLZ", "PM", "MO"],
  },
  {
    key: "sector_energy",
    kind: "sector_energy",
    name: "Energy Grid & Terminal",
    sectorName: "Energy & Petroleum",
    category: "sectors",
    image: "sector_energy/level_1",
    cost: 500,
    description:
      "Exploration, refining infrastructure, and modern energy distribution.",
    color: "#ef4444",
    badge: "NRG",
    stocks: ["COP", "EOG", "MPC", "PSX", "VLO", "CVX"],
  },
  {
    key: "sector_industrial",
    kind: "sector_industrial",
    name: "Industrial Works",
    sectorName: "Industrials & Aerospace",
    category: "sectors",
    image: "sector_industrial/level_1",
    cost: 500,
    description:
      "Aerospace defense, heavy machinery, rail freight, and global logistics.",
    color: "#f97316",
    badge: "IND",
    stocks: ["CAT", "GE", "UNP", "HON", "RTX", "LMT", "BA", "DE", "UPS"],
  },
  {
    key: "sector_communication",
    kind: "sector_communication",
    name: "Telecom Network Hub",
    sectorName: "Communication & Media",
    category: "sectors",
    image: "sector_communication/level_1",
    cost: 500,
    description:
      "5G broadband, wireless telecom infrastructure, and digital broadcasting.",
    color: "#818cf8",
    badge: "COMM",
    stocks: ["CMCSA", "TMUS", "VZ", "CHTR"],
  },
  {
    key: "sector_etf_index",
    kind: "sector_etf_index",
    name: "Index & ETF Pavilion",
    sectorName: "Index & Broad Market ETFs",
    category: "sectors",
    image: "sector_etf_index/level_1",
    cost: 500,
    description:
      "Benchmark market trackers, broad-market equities, and liquidity hubs.",
    color: "#eab308",
    badge: "ETF",
    stocks: ["IWM", "VTI", "VOO"],
  },
  {
    key: "sector_generic",
    kind: "sector_generic",
    name: "Enterprise Conglomerate",
    sectorName: "Conglomerates & Utilities",
    category: "sectors",
    image: "sector_generic/level_1",
    cost: 500,
    description:
      "Diversified industrial gases, clean utilities, waste management, and holdings.",
    color: "#64748b",
    badge: "CORP",
    stocks: ["LIN", "NEE", "SO", "DUK", "WM", "BRK.B"],
  },
];

export const defForSector = (sectorKey: string): SectorDefinition | undefined =>
  SECTOR_DEFINITIONS.find((s) => s.key === sectorKey);

export const catalogue: BuildingDef[] = [
  // 1. Civic services
  {
    kind: "agent_hall",
    name: "Agent Hall",
    category: "services",
    image: "functional/agent_hall",
    cost: 350,
    description:
      "Cokoo’s command center. Explore portfolio allocation, preview baskets and stress-test your city.",
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
      "Your city’s information hub. Select it to inspect on-chain city data.",
  },
  {
    kind: "monument",
    name: "BNB Monument",
    category: "services",
    image: "functional/bnb_monument",
    cost: 500,
    description:
      "A grand golden monument honoring BNB Smart Chain and the Web3 builders. A proud island landmark.",
  },

  // 2. Hero Company Buildings (30 bespoke isometric 4-tier models)
  {
    kind: "nvidia",
    name: "NVIDIA",
    category: "companies",
    ticker: "NVDA",
    image: "nvidia/level_1",
    cost: 500,
    description:
      "Semiconductors & AI. Place a building to create an NVIDIA tokenized stock position.",
  },
  {
    kind: "tesla",
    name: "Tesla",
    category: "companies",
    ticker: "TSLA",
    image: "tesla/level_1",
    cost: 500,
    description:
      "Electric vehicles & energy. Place a building to create a Tesla tokenized stock position.",
  },
  {
    kind: "amazon",
    name: "Amazon",
    category: "companies",
    ticker: "AMZN",
    image: "amazon/level_1",
    cost: 500,
    description:
      "Commerce & cloud computing. Place a building to create an Amazon tokenized stock position.",
  },
  {
    kind: "blackrock",
    name: "BlackRock",
    category: "companies",
    ticker: "BLK",
    image: "blackrock/level_1",
    cost: 500,
    description:
      "Asset management. Place a building to create a BlackRock tokenized stock position.",
  },
  {
    kind: "microsoft",
    name: "Microsoft",
    category: "companies",
    ticker: "MSFT",
    image: "microsoft/level_1",
    cost: 500,
    description:
      "Software & cloud infrastructure. Place a building to create a Microsoft tokenized stock position.",
  },
  {
    kind: "jpmorgan",
    name: "JPMorgan Chase",
    category: "companies",
    ticker: "JPM",
    image: "jpmorgan/level_1",
    cost: 500,
    description:
      "Global banking & financial services. Place a building to create a JPMorgan tokenized stock position.",
  },
  {
    kind: "walmart",
    name: "Walmart",
    category: "companies",
    ticker: "WMT",
    image: "walmart/level_1",
    cost: 500,
    description:
      "Retail & supply chain networks. Place a building to create a Walmart tokenized stock position.",
  },
  {
    kind: "coca_cola",
    name: "Coca-Cola",
    category: "companies",
    ticker: "KO",
    image: "coca_cola/level_1",
    cost: 500,
    description:
      "Global beverages & consumer goods. Place a building to create a Coca-Cola tokenized stock position.",
  },
  {
    kind: "exxonmobil",
    name: "ExxonMobil",
    category: "companies",
    ticker: "XOM",
    image: "exxonmobil/level_1",
    cost: 500,
    description:
      "Energy & petrochemical infrastructure. Place a building to create an ExxonMobil tokenized stock position.",
  },
  {
    kind: "unitedhealth",
    name: "UnitedHealth",
    category: "companies",
    ticker: "UNH",
    image: "unitedhealth/level_1",
    cost: 500,
    description:
      "Healthcare & medical services. Place a building to create a UnitedHealth tokenized stock position.",
  },
  {
    kind: "aapl",
    name: "Apple",
    category: "companies",
    ticker: "AAPL",
    image: "aapl/level_1",
    cost: 500,
    description:
      "Consumer technology & ecosystem devices. Place a building to create an Apple tokenized stock position.",
  },
  {
    kind: "googl",
    name: "Alphabet",
    category: "companies",
    ticker: "GOOGL",
    image: "googl/level_1",
    cost: 500,
    description:
      "Search, cloud computing & artificial intelligence. Place a building to create an Alphabet tokenized stock position.",
  },
  {
    kind: "meta",
    name: "Meta",
    category: "companies",
    ticker: "META",
    image: "meta/level_1",
    cost: 500,
    description:
      "Social technologies, metaverse & AI platforms. Place a building to create a Meta tokenized stock position.",
  },
  {
    kind: "nflx",
    name: "Netflix",
    category: "companies",
    ticker: "NFLX",
    image: "nflx/level_1",
    cost: 500,
    description:
      "Streaming entertainment & digital media production. Place a building to create a Netflix tokenized stock position.",
  },
  {
    kind: "amd",
    name: "AMD",
    category: "companies",
    ticker: "AMD",
    image: "amd/level_1",
    cost: 500,
    description:
      "High-performance computing & graphics processors. Place a building to create an AMD tokenized stock position.",
  },
  {
    kind: "avgo",
    name: "Broadcom",
    category: "companies",
    ticker: "AVGO",
    image: "avgo/level_1",
    cost: 500,
    description:
      "Semiconductor infrastructure & enterprise software. Place a building to create a Broadcom tokenized stock position.",
  },
  {
    kind: "coin",
    name: "Coinbase",
    category: "companies",
    ticker: "COIN",
    image: "coin/level_1",
    cost: 500,
    description:
      "Crypto economy infrastructure & digital asset exchange. Place a building to create a Coinbase tokenized stock position.",
  },
  {
    kind: "v",
    name: "Visa",
    category: "companies",
    ticker: "V",
    image: "v/level_1",
    cost: 500,
    description:
      "Global payments & transaction technology network. Place a building to create a Visa tokenized stock position.",
  },
  {
    kind: "spy",
    name: "S&P 500 ETF",
    category: "companies",
    ticker: "SPY",
    image: "spy/level_1",
    cost: 500,
    description:
      "Diversified large-cap U.S. equities benchmark. Place a building to create an S&P 500 ETF tokenized position.",
  },
  {
    kind: "qqq",
    name: "Nasdaq 100 ETF",
    category: "companies",
    ticker: "QQQ",
    image: "qqq/level_1",
    cost: 500,
    description:
      "Innovation & top non-financial tech equities. Place a building to create a Nasdaq 100 ETF tokenized position.",
  },
  {
    kind: "adbe",
    name: "Adobe",
    category: "companies",
    ticker: "ADBE",
    image: "adbe/level_1",
    cost: 500,
    description:
      "Creative software & digital experience solutions. Place a building to create an Adobe tokenized stock position.",
  },
  {
    kind: "crm",
    name: "Salesforce",
    category: "companies",
    ticker: "CRM",
    image: "crm/level_1",
    cost: 500,
    description:
      "Customer relationship management & enterprise cloud. Place a building to create a Salesforce tokenized stock position.",
  },
  {
    kind: "orcl",
    name: "Oracle",
    category: "companies",
    ticker: "ORCL",
    image: "orcl/level_1",
    cost: 500,
    description:
      "Cloud enterprise database software & infrastructure. Place a building to create an Oracle tokenized stock position.",
  },
  {
    kind: "intc",
    name: "Intel",
    category: "companies",
    ticker: "INTC",
    image: "intc/level_1",
    cost: 500,
    description:
      "Semiconductor design & advanced silicon manufacturing. Place a building to create an Intel tokenized stock position.",
  },
  {
    kind: "pltr",
    name: "Palantir",
    category: "companies",
    ticker: "PLTR",
    image: "pltr/level_1",
    cost: 500,
    description:
      "Big data analytics & enterprise AI operating systems. Place a building to create a Palantir tokenized stock position.",
  },
  {
    kind: "pep",
    name: "PepsiCo",
    category: "companies",
    ticker: "PEP",
    image: "pep/level_1",
    cost: 500,
    description:
      "Global snack & beverage brands portfolio. Place a building to create a PepsiCo tokenized stock position.",
  },
  {
    kind: "mcd",
    name: "McDonald’s",
    category: "companies",
    ticker: "MCD",
    image: "mcd/level_1",
    cost: 500,
    description:
      "Global quick-service restaurant & franchise network. Place a building to create a McDonald’s tokenized stock position.",
  },
  {
    kind: "cost",
    name: "Costco",
    category: "companies",
    ticker: "COST",
    image: "cost/level_1",
    cost: 500,
    description:
      "Membership warehouse retail & bulk supply network. Place a building to create a Costco tokenized stock position.",
  },
  {
    kind: "dis",
    name: "Walt Disney",
    category: "companies",
    ticker: "DIS",
    image: "dis/level_1",
    cost: 500,
    description:
      "Global entertainment, theme parks & media streaming. Place a building to create a Walt Disney tokenized stock position.",
  },
  {
    kind: "pfe",
    name: "Pfizer",
    category: "companies",
    ticker: "PFE",
    image: "pfe/level_1",
    cost: 500,
    description:
      "Biopharmaceutical innovation & essential medicine. Place a building to create a Pfizer tokenized stock position.",
  },

  // 3. 10 Sector Building Templates
  ...SECTOR_DEFINITIONS.map((sec): BuildingDef => ({
    kind: sec.kind,
    name: sec.name,
    category: "sectors",
    image: sec.image,
    cost: sec.cost,
    description: sec.description,
    sectorKey: sec.key,
  })),

  // 4. 70 S&P 100 Sector Company Buildings
  ...SECTOR_COMPANIES_RAW.map(
    ([ticker, name, sector, price, change, sectorKey, kind]): BuildingDef => ({
      kind,
      name,
      category: "sectors",
      ticker,
      image: `${sectorKey}/level_1`,
      cost: 500,
      description: `${name} (${ticker}) tokenized stock position housed in the ${defForSector(sectorKey)?.name ?? "Sector Tower"}.`,
      sectorKey,
    }),
  ),
];

for (const a of assets) {
  if (!a.sprite) {
    const def = catalogue.find((d) => d.ticker === a.ticker);
    if (def) {
      a.sprite = def.image.split("/")[0];
    }
  }
}
export type Building = Cell & {
  id: string;
  kind: BuildingKind;
  quantity: number;
  entry: number;
  cost: number;
  builtAt: number;
  /** True while the building is an unpaid draft: ghost on the map,
   * excluded from portfolio until the on-chain purchase confirms. */
  locked?: boolean;
  /** On-chain receipt for stock buildings recorded via StockCityVault. */
  vaultTx?: `0x${string}`;
  vaultId?: string;
};
/** Position-only holding (no map building) for non-buildable assets. */
export type PaperHolding = {
  id: string;
  ticker: string;
  quantity: number;
  entry: number;
  cost: number;
  boughtAt: number;
};
/** One closed sale for the Performance sale-history feed. */
export type SaleRecord = {
  id: string;
  ticker: string;
  quantity: number;
  proceeds: number;
  realized: number;
  at: number;
  hash?: `0x${string}`;
  source: "onchain" | "local";
};
export type CityState = {
  version: 2;
  cash: number;
  realizedPnl?: number;
  buildings: Building[];
  roads: Cell[];
  paper?: PaperHolding[];
  rebalanceCount?: number;
  /** Every closed sale (local + on-chain) for history + balance proof. */
  saleHistory?: SaleRecord[];
  /** Confirmed agent receipts survive removal of the associated building. */
  agentReceipts?: {
    hash: `0x${string}`;
    owner: `0x${string}`;
    ticker: string;
    action: "buy" | "sell";
    at: number;
    planId: string;
    stepId: string;
    batch?: boolean;
    positionId: `0x${string}`;
  }[];
};
export const STORAGE = "stockva.sandbox.v2";
export const ROAD_COST = 10;
export const newCity = (): CityState => ({
  version: 2,
  cash: 0,
  realizedPnl: 0,
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
export const MARKET_SOURCE = "Live market pricing";
export const PROVIDER_TAG = "Tokenized stock position";
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
export type TierThresholds = { minus: number; level2: number; level3: number };
export const DEFAULT_THRESHOLDS: TierThresholds = {
  minus: -5,
  level2: 5,
  level3: 15,
};
export const SIMULATION_INTERVALS = [4, 6, 8, 10] as const;
export function validThresholds(value: unknown): value is TierThresholds {
  if (!value || typeof value !== "object") return false;
  const t = value as TierThresholds;
  return (
    [t.minus, t.level2, t.level3].every(Number.isFinite) &&
    t.minus > -99 &&
    t.minus < t.level2 &&
    t.level2 < t.level3 &&
    t.level3 <= 1000
  );
}
export const tier = (
  n: number,
  thresholds: TierThresholds = DEFAULT_THRESHOLDS,
) =>
  n < thresholds.minus
    ? "minus"
    : n < thresholds.level2
      ? "level_1"
      : n < thresholds.level3
        ? "level_2"
        : "level_3";
export const tierName = (value: ReturnType<typeof tier>) =>
  value === "minus" ? "Minus tier" : value.replace("level_", "Level ");
export function simulationStep(
  previous: Record<string, number>,
  thresholds: TierThresholds,
  random: () => number = Math.random,
) {
  const span = Math.max(10, thresholds.level3 - thresholds.minus);
  const low = Math.max(-98, thresholds.minus - span * 0.6),
    high = thresholds.level3 + span * 0.6;
  return Object.fromEntries(
    Object.entries(previous).map(([id, value]) => [
      id,
      Math.round(
        Math.max(low, Math.min(high, value + (random() - 0.5) * span * 1.3)) *
          100,
      ) / 100,
    ]),
  );
}
export const buildingImage = (
  b: Building,
  prices?: PriceMap,
  thresholds: TierThresholds = DEFAULT_THRESHOLDS,
  simulatedReturn?: number,
) =>
  defFor(b.kind).ticker
    ? `${defFor(b.kind).image.split("/")[0]}/${tier(simulatedReturn ?? returnOf(b, prices), thresholds)}`
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
    label: "Diversified",
    detail: `${stocks.length} holdings · ${sectors.size} sectors · largest ${max.toFixed(0)}%.`,
  };
}
export function marketClock(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const mins = Number(get("hour")) * 60 + Number(get("minute"));
  const open =
    !["Sat", "Sun"].includes(get("weekday")) && mins >= 570 && mins < 960;
  return {
    open,
    label: open ? "Regular session*" : "Market closed",
    next: "09:30–16:00 New York · holiday/early-close exceptions not supplied",
  };
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
  return count * ROAD_COST > state.cash ? "Not enough funds" : "";
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
  const def = defFor(kind);
  const alreadyBuilt = state.buildings.some(
    (b) =>
      b.kind === kind ||
      (Boolean(def.ticker) && defFor(b.kind).ticker === def.ticker),
  );
  if (alreadyBuilt)
    return {
      state,
      error: `${def.name} is already built. Only one instance is allowed on the island.`,
    };

  if (def.ticker && !state.buildings.some((b) => b.kind === "exchange"))
    return {
      state,
      error: "Build the Stock Exchange before buying companies.",
    };
  const error = placementError(cell, state);
  if (error) return { state, error };
  const cost = def.ticker ? amount : def.cost;
  if (!Number.isFinite(cost) || cost < 1)
    return { state, error: "Enter a position amount of at least $1" };
  if (cost > state.cash) return { state, error: "Not enough funds" };
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
  if (b) {
    const ticker = defFor(b.kind).ticker;
    const proceeds = valueOf(b, prices);
    const realized = ticker ? proceeds - b.quantity * b.entry : 0;
    const next: CityState = {
      ...state,
      cash: state.cash + proceeds,
      realizedPnl: (state.realizedPnl ?? 0) + realized,
      buildings: state.buildings.filter((p) => p.id !== b.id),
    };
    return {
      state: ticker
        ? recordSale(next, {
            ticker,
            quantity: b.quantity,
            proceeds,
            realized,
            source: "local",
          })
        : next,
      message: ticker
        ? `${defFor(b.kind).name} removed. ${money(proceeds)} returned to treasury funds.`
        : `${defFor(b.kind).name} removed.`,
    };
  }
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
    (s.realizedPnl === undefined || Number.isFinite(s.realizedPnl)) &&
    Array.isArray(s.roads) &&
    Array.isArray(s.buildings) &&
    (s.paper === undefined ||
      (Array.isArray(s.paper) &&
        s.paper.every(
          (p) =>
            typeof p?.id === "string" &&
            typeof p?.ticker === "string" &&
            Number.isFinite(p?.quantity) &&
            Number.isFinite(p?.entry) &&
            Number.isFinite(p?.cost),
        ))) &&
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

/** Buy a position-only holding (no map building) for non-buildable assets. */
export function buyPaper(
  state: CityState,
  ticker: string,
  amount: number,
  price: number,
) {
  if (!Number.isFinite(amount) || amount < 1)
    return { state, error: "Enter a position amount of at least $1" };
  if (amount > state.cash) return { state, error: "Not enough funds" };
  if (!Number.isFinite(price) || price <= 0)
    return { state, error: "No live price for this asset right now" };
  const holding: PaperHolding = {
    id: globalThis.crypto.randomUUID(),
    ticker,
    quantity: amount / price,
    entry: price,
    cost: amount,
    boughtAt: Date.now(),
  };
  return {
    state: {
      ...state,
      cash: state.cash - amount,
      paper: [...(state.paper ?? []), holding],
    },
    error: "",
  };
}

/** Append a closed sale to history. Pure: returns the next state. */
export function recordSale(
  state: CityState,
  sale: Omit<SaleRecord, "id" | "at">,
): CityState {
  return {
    ...state,
    saleHistory: [
      ...(state.saleHistory ?? []),
      {
        ...sale,
        id: globalThis.crypto.randomUUID(),
        at: Date.now(),
      },
    ],
  };
}

/** Sell a fraction of all paper holdings for a ticker. */
export function sellPaper(
  state: CityState,
  ticker: string,
  fraction: number,
  prices?: PriceMap,
) {
  const holdings = (state.paper ?? []).filter((p) => p.ticker === ticker);
  if (!holdings.length) return { state, error: "You do not own this asset." };
  if (!Number.isFinite(fraction) || fraction <= 0 || fraction > 1)
    return { state, error: "Choose a valid sell percentage." };
  let proceeds = 0;
  let realized = 0;
  let soldQty = 0;
  const ids = new Set(holdings.map((p) => p.id));
  const paper = (state.paper ?? [])
    .map((p) => {
      if (!ids.has(p.id)) return p;
      const price = priceOf(p.ticker, prices);
      const value = p.quantity * price;
      proceeds += value * fraction;
      realized += (value - p.quantity * p.entry) * fraction;
      soldQty += p.quantity * fraction;
      if (fraction === 1) return null;
      const quantity = p.quantity * (1 - fraction);
      return { ...p, quantity, cost: p.cost * (1 - fraction) };
    })
    .filter((p): p is PaperHolding => p !== null);
  return {
    state: recordSale(
      {
        ...state,
        cash: state.cash + proceeds,
        realizedPnl: (state.realizedPnl ?? 0) + realized,
        paper,
      },
      {
        ticker,
        quantity: soldQty,
        proceeds,
        realized,
        source: "local",
      },
    ),
    error: "",
    payout: proceeds,
  };
}

export function sellPosition(
  state: CityState,
  ticker: string,
  fraction: number,
  prices?: PriceMap,
) {
  if (!state.buildings.some((b) => b.kind === "exchange"))
    return { state, error: "Build the Stock Exchange before selling." };
  if (!Number.isFinite(fraction) || fraction <= 0 || fraction > 1)
    return { state, error: "Choose a valid sell percentage." };
  const holdings = state.buildings.filter(
    (b) => defFor(b.kind).ticker === ticker,
  );
  if (!holdings.length) return { state, error: "You do not own this asset." };
  const proceeds = holdings.reduce(
    (sum, b) => sum + valueOf(b, prices) * fraction,
    0,
  );
  const realized = holdings.reduce(
    (sum, b) => sum + (valueOf(b, prices) - b.quantity * b.entry) * fraction,
    0,
  );
  const soldQty = holdings.reduce((sum, b) => sum + b.quantity * fraction, 0);
  return {
    state: recordSale(
      {
        ...state,
        cash: state.cash + proceeds,
        realizedPnl: (state.realizedPnl ?? 0) + realized,
        buildings: state.buildings.flatMap((b) =>
          defFor(b.kind).ticker !== ticker
            ? [b]
            : fraction === 1
              ? []
              : [
                  {
                    ...b,
                    quantity: b.quantity * (1 - fraction),
                    cost: b.cost * (1 - fraction),
                  },
                ],
        ),
      },
      {
        ticker,
        quantity: soldQty,
        proceeds,
        realized,
        source: "local",
      },
    ),
    error: "",
  };
}
