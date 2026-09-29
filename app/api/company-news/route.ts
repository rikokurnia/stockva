import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { assets } from "../../../lib/city";
import {
  companyProfiles,
  type CompanyNews,
  type CompanyHeadline,
} from "../../../lib/company-intel";

const cache = new Map<string, { at: number; news: CompanyNews }>();
const companyNames: Record<string, RegExp> = {
  NVDA: /nvidia|blackwell|\bCUDA\b/i,
  AAPL: /apple|iphone|ipad/i,
  TSLA: /tesla|cybercab|cybertruck/i,
  AMZN: /amazon|\bAWS\b/i,
  MSFT: /microsoft|azure|copilot/i,
  GOOGL: /google|alphabet|gemini/i,
  META: /\bmeta\b|facebook|instagram|whatsapp/i,
  BLK: /blackrock|buidl|ishares/i,
  COIN: /coinbase/i,
  AMD: /\bAMD\b|advanced micro devices|instinct/i,
};
export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker") ?? "";
  const asset = assets.find((a) => a.ticker === ticker);
  if (!asset)
    return NextResponse.json({ error: "Unknown company" }, { status: 400 });
  const saved = cache.get(ticker);
  if (saved && Date.now() - saved.at < 600000)
    return NextResponse.json(saved.news);
  try {
    const query = `${companyProfiles[ticker]?.query ?? `${asset.name} stock`} when:14d`;
    const response = await fetch(
      `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`,
      { signal: AbortSignal.timeout(8000), next: { revalidate: 600 } },
    );
    if (!response.ok) throw Error();
    const xml = await response.text();
    if (xml.length > 2000000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw Error();
    const parsed = new XMLParser({
      ignoreAttributes: false,
      trimValues: true,
    }).parse(xml);
    const raw = parsed.rss?.channel?.item;
    const items: unknown[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const cutoff = Date.now() - 14 * 86400000;
    const seen = new Set<string>();
    const articles: CompanyHeadline[] = [];
    for (const raw of items) {
      const item = raw as {
        title?: unknown;
        link?: unknown;
        pubDate?: string;
        source?: { "#text"?: string };
      };
      const source = item.source?.["#text"];
      if (
        typeof item.title !== "string" ||
        typeof item.link !== "string" ||
        typeof source !== "string"
      )
        continue;
      const time = Date.parse(item.pubDate ?? "");
      if (
        !Number.isFinite(time) ||
        time < cutoff ||
        time > Date.now() + 3600000
      )
        continue;
      const url = new URL(item.link);
      if (url.protocol !== "https:" || url.hostname !== "news.google.com")
        continue;
      const title = item.title
        .replace(
          new RegExp(` - ${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
          "",
        )
        .replace(/<[^>]*>/g, "")
        .trim();
      if (
        title.length < 20 ||
        (companyNames[ticker] && !companyNames[ticker].test(title)) ||
        seen.has(title.toLowerCase()) ||
        /should you buy|stocks? to buy|millionaire|motley fool|prediction|could (?:soar|double)|is it too late|buy now|i[’']d buy|i would buy|price, news, quote|why .*stock|real story|top stocks|best stocks|how you can .*money|funds (?:she|he) recommends|history rhymes|our plan for|\?$/i.test(
          title + " " + source,
        )
      )
        continue;
      seen.add(title.toLowerCase());
      articles.push({
        title,
        source,
        url: url.href,
        publishedAt: new Date(time).toISOString(),
      });
    }
    const preferred =
      /reuters|bloomberg|cnbc|financial times|wall street|associated press|barron|marketwatch|newsroom|coindesk|the block|techcrunch|business wire|pr newswire/i;
    const event =
      /launch|report|sues?|sign|deal|invest|approv|partner|order|tariff|permit|spend|earning|revenue|buyback|raises?|cuts?|appeal|acquir|acquisition|chips?|expand|fund|contract|regulat/i;
    articles.sort(
      (a, b) =>
        Number(preferred.test(b.source)) - Number(preferred.test(a.source)) ||
        Number(event.test(b.title)) - Number(event.test(a.title)) ||
        Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
    );
    const chosen = articles
      .slice(0, 3)
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
    if (!chosen.length) throw Error();
    const news: CompanyNews = {
      ticker,
      articles: chosen,
      fetchedAt: new Date().toISOString(),
    };
    cache.set(ticker, { at: Date.now(), news });
    return NextResponse.json(news);
  } catch {
    if (saved)
      return NextResponse.json({
        ...saved.news,
        stale: true,
        error: "News refresh unavailable. Showing the last retrieved reports.",
      });
    return NextResponse.json({
      ticker,
      articles: [],
      fetchedAt: new Date().toISOString(),
      error: "Headlines are unavailable right now. Try again shortly.",
    } satisfies CompanyNews);
  }
}
