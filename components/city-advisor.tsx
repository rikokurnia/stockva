"use client";

import { useEffect, useRef, useState } from "react";
import {
  defFor,
  hasRoad,
  priceOf,
  returnOf,
  valueOf,
  wholeMoney,
} from "../lib/city";
import type { CityState, PriceMap } from "../lib/city";
import { getOnchainPositions, type OnchainPosition } from "../lib/contracts";
import styles from "./city-advisor.module.css";

type Message = { role: "guide" | "user"; text: string };

type Props = {
  city: CityState;
  prices: PriceMap;
  walletAddress?: `0x${string}` | null;
};

export default function CityAdvisor({ city, prices, walletAddress }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [onchain, setOnchain] = useState<OnchainPosition[]>([]);
  const toggle = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const holdings = city.buildings.filter(
    (b) => defFor(b.kind).ticker && !b.locked,
  );
  const disconnected = city.buildings.filter(
    (b) => !hasRoad(b, city.roads),
  ).length;
  const total = holdings.reduce((sum, b) => sum + valueOf(b, prices), 0);
  const briefing = !city.roads.length
    ? "A fresh start. Lay your first road."
    : disconnected
      ? `${disconnected} ${disconnected === 1 ? "building needs" : "buildings need"} road access.`
      : !holdings.length
        ? "Roads are ready. Bring your first company home."
        : `${holdings.length} company ${holdings.length === 1 ? "building" : "buildings"} · ${wholeMoney(total)} in stock value.`;

  useEffect(() => {
    if (open) input.current?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, open, thinking]);

  // Keep the advisor's view of on-chain vault positions fresh.
  useEffect(() => {
    if (!open || !walletAddress) {
      if (!walletAddress) setOnchain([]);
      return;
    }
    let cancelled = false;
    getOnchainPositions(walletAddress)
      .then((positions) => {
        if (!cancelled) setOnchain(positions);
      })
      .catch(() => {
        if (!cancelled) setOnchain([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, walletAddress]);

  function localReply(question: string) {
    const q = question.toLowerCase();
    if (/buy|sell|rotate|trade|rebalance|defensive|transaction/.test(q))
      return "I can help you explore your city here. Trading commands aren’t connected in this preview. Select a company building to review its position and available actions; this chat won’t move your funds.";
    if (/allocation|portfolio|stock|holding/.test(q)) {
      if (!holdings.length && !onchain.filter((p) => p.active).length)
        return `Your portfolio is still empty, with ${wholeMoney(city.cash)} in available funds. Open Build to choose your first company, then place it beside a road. Portfolio will reveal each building’s return and level.`;
      const groups = new Map<string, number>();
      holdings.forEach((b) => {
        const name = defFor(b.kind).name;
        groups.set(name, (groups.get(name) ?? 0) + valueOf(b, prices));
      });
      return `${wholeMoney(total)} in tokenized stock positions. ${Array.from(
        groups,
      )
        .sort((a, b) => b[1] - a[1])
        .map(
          ([name, value]) =>
            `${name}: ${total > 0 ? ((value / total) * 100).toFixed(1) : "0"}%`,
        )
        .join(
          " · ",
        )}. Open Portfolio to see returns and building levels across your island.`;
    }
    if (/expand|next|build|road|review|city/.test(q))
      return `${briefing} You have ${wholeMoney(city.cash)} in available funds. ${!city.roads.length ? "Open Build and choose Roads, then draw a small connected route on the island." : disconnected ? "Extend a road to the disconnected buildings before adding a new block." : "Open Build to choose a company and place it alongside your road network. Select a finished building to explore its position."}`;
    return "Try asking for a city review, your portfolio allocation, or what to build next. This preview guide uses your current city and available market prices (including labeled fallbacks).";
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || thinking) return;
    const history = [...messages, { role: "user", text: question } as Message];
    setMessages(history);
    setDraft("");
    input.current?.focus({ preventScroll: true });

    // Realtime snapshot: unlocked buildings + position-only holdings.
    const paper = city.paper ?? [];
    const snapshot = {
      cash: city.cash,
      totalValue:
        total +
        paper.reduce((s, p) => s + p.quantity * priceOf(p.ticker, prices), 0),
      walletConnected: !!walletAddress,
      onchainCount: onchain.filter((p) => p.active).length,
      holdings: [
        ...holdings.map((b) => {
          const ticker = defFor(b.kind).ticker!;
          return {
            ticker,
            name: defFor(b.kind).name,
            units: b.quantity,
            entry: b.entry,
            price: priceOf(ticker, prices),
            value: valueOf(b, prices),
            returnPct: returnOf(b, prices) * 100,
            onchain: false,
            active: true,
          };
        }),
        ...paper.map((p) => ({
          ticker: p.ticker,
          units: p.quantity,
          entry: p.entry,
          price: priceOf(p.ticker, prices),
          value: p.quantity * priceOf(p.ticker, prices),
          returnPct:
            p.entry > 0
              ? ((priceOf(p.ticker, prices) - p.entry) / p.entry) * 100
              : 0,
          onchain: false,
          active: true,
        })),
        ...onchain.map((p) => ({
          ticker: p.ticker,
          units: Number(p.quantity) / 1e18,
          entry: Number(p.entryPrice) / 1e18,
          price: undefined,
          value: undefined,
          returnPct: undefined,
          tier: p.buildingTier,
          onchain: true,
          active: p.active,
        })),
      ].slice(0, 20),
    };

    setThinking(true);
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          history: history.slice(-6),
          snapshot,
        }),
        signal: AbortSignal.timeout(55000),
      });
      if (!res.ok) throw new Error(`advisor ${res.status}`);
      const data = (await res.json()) as { reply?: string };
      if (!data.reply) throw new Error("empty reply");
      setMessages((previous) => [
        ...previous,
        { role: "guide", text: data.reply as string },
      ]);
    } catch {
      // Offline fallback: local rule-based insights so chat always answers.
      setMessages((previous) => [
        ...previous,
        { role: "guide", text: localReply(question) },
      ]);
    } finally {
      setThinking(false);
      input.current?.focus({ preventScroll: true });
    }
  }

  return (
    <aside
      className={styles.advisor}
      data-open={open}
      aria-label="cokoo"
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape" && open) {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      {open && (
        <section
          id="city-advisor-content"
          className={styles.content}
          aria-label="cokoo conversation"
        >
          <header className={styles.heading}>
            <div>
              <span className={styles.eyebrow}>YOUR ISLAND BUDDY</span>
              <h2>Hey, I'm cokoo!</h2>
            </div>
          </header>
          <div
            ref={log}
            className={styles.messages}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            <p className={styles.welcome}>
              Let's grow your island together, one good decision at a time. Ask
              me about your city or your portfolio!
            </p>
            {messages.map((message, index) => (
              <p
                key={index}
                className={
                  message.role === "user" ? styles.user : styles.answer
                }
              >
                <span>{message.role === "user" ? "You" : "cokoo"}</span>
                {message.text}
              </p>
            ))}
            {thinking && (
              <p className={styles.answer}>
                <span>cokoo</span>Thinking…
              </p>
            )}
          </div>
          <div className={styles.prompts} aria-label="Suggested questions">
            {[
              "Review my city",
              "Portfolio allocation",
              "What to build next?",
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => void send(prompt)}
                disabled={thinking}
              >
                {prompt}
              </button>
            ))}
          </div>
          <form
            className={styles.composer}
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
          >
            <input
              ref={input}
              value={draft}
              maxLength={500}
              onChange={(event) => setDraft(event.target.value)}
              aria-label="Ask cokoo"
              placeholder="Ask cokoo anything…"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!draft.trim() || thinking}
              aria-label="Send message"
            >
              Send
            </button>
          </form>
          <p className={styles.note}>Live insights · Tokenized assets</p>
        </section>
      )}
      <button
        ref={toggle}
        className={styles.capsule}
        aria-expanded={open}
        aria-controls="city-advisor-content"
        onClick={() => setOpen((value) => !value)}
      >
        <img
          src="/assets/ai_logo.png"
          alt=""
          width="64"
          height="64"
          draggable={false}
        />
        <span className={styles.brief}>
          <span className={styles.title}>
            <i />
            cokoo<span>{open ? "Close" : "Ask me"}</span>
          </span>
          <span className={styles.summary}>{briefing}</span>
        </span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>
    </aside>
  );
}
