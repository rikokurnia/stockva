"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import {
  sprite,
  type Building,
  type BuildingKind,
  type CityState,
  type PriceMap,
} from "../lib/city";
import type { MarketFeed } from "../lib/market";
import CivicCityHall from "./civic-city-hall";
import CivicMarket from "./civic-market";
import styles from "./civic-panel.module.css";

export type CivicMode = "portfolio" | "market" | "data";
export type CivicProps = {
  mode: CivicMode;
  city: CityState;
  prices: PriceMap;
  feed: MarketFeed;
  loading: boolean;
  initialTicker: string | null;
  onClose: () => void;
  onRetry: () => void;
  onBuy: (kind: BuildingKind, amount: number) => void;
  onBuyBundle: (items: { kind: BuildingKind; amount: number }[]) => string;
  onBuyPaper: (ticker: string, amount: number) => string;
  onSell: (ticker: string, fraction: number) => string;
  onSellPaper: (ticker: string, fraction: number) => string;
  onFocus: (building: Building) => void;
  onScan: () => void;
  walletAddress?: `0x${string}` | null;
  onConnectWallet?: () => Promise<`0x${string}`>;
  onAddDemoCash?: (amount?: number) => void;
  onClaimFaucet?: () => void;
  onConfirmBatch?: (
    receipts: { buildingId: string; hash: `0x${string}`; vaultId: string }[],
  ) => void;
};
const services = {
  portfolio: {
    title: "City Hall",
    image: "functional/portfolio_city_hall",
    description: "Holdings, treasury & city activity",
  },
  market: {
    title: "Stock Exchange",
    image: "functional/stock_exchange",
    description: "Research assets. Build a bundle.",
  },
  data: {
    title: "Data Center",
    image: "functional/oracle_data_center",
    description: "Inspect the evidence behind each token",
  },
};
export default function CivicPanel(props: CivicProps) {
  const { mode, onClose } = props;
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const resetScroll = useCallback(() => body.current?.scrollTo({ top: 0 }), []);
  const service = services[mode];
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
  }, [mode]);
  return (
    <div
      className={styles.backdrop}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        className={styles.panel}
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="civic-title"
        tabIndex={-1}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape" && !busy) onClose();
          if (event.key !== "Tab") return;
          const nodes = Array.from(
            dialog.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]',
            ) ?? [],
          ).filter((node) => node.getClientRects().length > 0);
          const first = nodes[0],
            last = nodes[nodes.length - 1];
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === dialog.current)
          ) {
            event.preventDefault();
            last?.focus();
          } else if (
            !event.shiftKey &&
            (document.activeElement === last ||
              document.activeElement === dialog.current)
          ) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <header className={styles.header}>
          <div className={styles.identity}>
            <Image
              src={sprite(service.image)}
              alt=""
              width={64}
              height={64}
              sizes="64px"
              quality={85}
            />
            <div>
              <h2 id="civic-title">{service.title}</h2>
              <p>{service.description}</p>
            </div>
          </div>
          <div className={styles.headerEnd}>
            <span className={styles.badge}>City sandbox · BNB testnet</span>
            <button
              className={styles.iconButton}
              aria-label={`Close ${service.title}`}
              disabled={busy}
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>
        </header>
        <div ref={body} className={styles.body}>
          {mode === "portfolio" ? (
            <CivicCityHall {...props} onBusy={setBusy} />
          ) : (
            <CivicMarket key={mode} {...props} onResetScroll={resetScroll} />
          )}
        </div>
        <footer className={styles.footer}>
          <span>
            {busy
              ? "Wallet confirmation in progress. Keep this window open."
              : "Your city uses testnet mUSD, not ownership of the underlying stock."}
          </span>
          <span>StockCity</span>
        </footer>
      </div>
    </div>
  );
}
