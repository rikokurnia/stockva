export type CompanyProfile = {
  business: string;
  focus: string;
  risk: string;
  headquarters: string;
  query: string;
};
export const companyProfiles: Record<string, CompanyProfile> = {
  NVDA: {
    business:
      "NVIDIA designs accelerated-computing chips, networking systems and CUDA software for data centers, gaming and robotics.",
    focus:
      "Blackwell shipments, hyperscaler capital spending and advanced-packaging capacity.",
    risk: "Export restrictions, customer concentration and competition from custom AI accelerators.",
    headquarters: "Santa Clara, California",
    query: "NVIDIA (Blackwell OR chips OR earnings)",
  },
  AAPL: {
    business:
      "Apple sells the iPhone, Mac and wearables, alongside its App Store, subscriptions and payments ecosystem.",
    focus:
      "iPhone replacement demand, Services margins and manufacturing exposure to China.",
    risk: "Hardware concentration, tariffs and scrutiny of App Store rules.",
    headquarters: "Cupertino, California",
    query: "Apple (iPhone OR earnings OR tariffs)",
  },
  TSLA: {
    business:
      "Tesla manufactures electric vehicles, battery-storage systems and charging infrastructure, and develops autonomous-driving software.",
    focus:
      "Vehicle deliveries, automotive margins, energy storage and robotaxi permits.",
    risk: "Pricing pressure, regulatory approval of autonomy and execution of new vehicle programs.",
    headquarters: "Austin, Texas",
    query: "Tesla (robotaxi OR deliveries OR permits)",
  },
  AMZN: {
    business:
      "Amazon operates global online retail and logistics, Amazon Web Services and a large digital-advertising business.",
    focus: "AWS growth, AI infrastructure spending and fulfillment efficiency.",
    risk: "Heavy capital spending, retail margins and antitrust proceedings.",
    headquarters: "Seattle, Washington",
    query: "Amazon (AWS OR earnings OR investment)",
  },
  MSFT: {
    business:
      "Microsoft sells enterprise software, Azure cloud services, productivity subscriptions and gaming products.",
    focus:
      "Azure capacity, Copilot adoption and returns on AI data-center investment.",
    risk: "Power and chip constraints, AI infrastructure costs and regulatory scrutiny.",
    headquarters: "Redmond, Washington",
    query: "Microsoft (Azure OR Copilot OR earnings)",
  },
  GOOGL: {
    business:
      "Alphabet operates Google Search, YouTube, Google Cloud and a portfolio of businesses including Waymo.",
    focus:
      "Search advertising, Gemini distribution, Cloud profitability and Waymo deployment.",
    risk: "Search antitrust remedies, competition in AI answers and infrastructure spending.",
    headquarters: "Mountain View, California",
    query: "Google (antitrust OR Gemini OR earnings)",
  },
  META: {
    business:
      "Meta operates Facebook, Instagram, WhatsApp and Threads, with advertising funding its AI and extended-reality investments.",
    focus:
      "Advertising monetization, AI recommendations and data-center capital spending.",
    risk: "Privacy rules, content regulation and sustained Reality Labs losses.",
    headquarters: "Menlo Park, California",
    query: "Meta (advertising OR datacenter OR earnings)",
  },
  BLK: {
    business:
      "BlackRock manages investment assets through institutional mandates, iShares ETFs and private-market strategies, and licenses its Aladdin platform.",
    focus:
      "ETF flows, private-market fundraising and tokenized funds such as BUIDL.",
    risk: "Market-sensitive fee income, integration costs and liquidity in private assets.",
    headquarters: "New York, New York",
    query: "BlackRock (BUIDL OR iShares OR funds)",
  },
  COIN: {
    business:
      "Coinbase operates a digital-asset exchange, institutional custody and blockchain services, including the Base network.",
    focus:
      "Trading volumes, USDC economics, institutional custody and Base activity.",
    risk: "Crypto price cycles, fee compression and changes in regulation.",
    headquarters: "Distributed / remote-first",
    query: "Coinbase (USDC OR earnings OR regulation)",
  },
  AMD: {
    business:
      "AMD designs EPYC server processors, Ryzen PC chips, Radeon graphics and Instinct AI accelerators.",
    focus:
      "Instinct accelerator deployments, EPYC market share and manufacturing capacity.",
    risk: "AI software adoption, intense competition and reliance on external foundries.",
    headquarters: "Santa Clara, California",
    query: "AMD (Instinct OR chips OR earnings)",
  },
};
export type CompanyHeadline = {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
};
export type CompanyNews = {
  ticker: string;
  articles: CompanyHeadline[];
  fetchedAt: string;
  stale?: boolean;
  error?: string;
};
