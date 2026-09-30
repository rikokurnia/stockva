"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  ChevronRight,
  Coins,
  Crosshair,
  ExternalLink,
  Landmark,
  Radio,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  assets,
  catalogue,
  defFor,
  healthOf,
  isHeroTicker,
  marketClock,
  money,
  pct,
  priceOf,
  valueOf,
  type Building,
  type BuildingKind,
  type CityState,
  type PriceMap,
} from "../lib/city";
import {
  sampleHistory,
  type HistoryFeed,
  type MarketFeed,
  type PricePoint,
  type Passport,
} from "../lib/market";
import {
  MOCK_USD_ADDRESS,
  VAULT_ADDRESS,
  bscAddressLink,
  bscTxLink,
  claimFaucetOnchain,
  getFaucetTxns,
  getLiveVaultStats,
  getOnchainPositions,
  getPositionOpenTxns,
  recordBuildingsBatch,
  type OnchainPosition,
  type OnChainVaultStats,
} from "../lib/contracts";
import StockLogo from "./stock-logo";
import TradingChart from "./trading-chart";
import styles from "./civic-panel.module.css";
export type CivicMode = "portfolio" | "market" | "data";
type Props = {
  mode: CivicMode;
  city: CityState;
  prices: PriceMap;
  feed: MarketFeed;
  loading: boolean;
  initialTicker: string | null;
  onClose: () => void;
  onRetry: () => void;
  onBuy: (kind: BuildingKind, amount: number) => void;
  onBuyPaper: (ticker: string, amount: number) => string;
  onSell: (ticker: string, fraction: number) => string;
  onSellPaper: (ticker: string, fraction: number) => string;
  onFocus: (building: Building) => void;
  onScan: () => void;
  walletAddress?: `0x${string}` | null;
  onClaimFaucet?: () => void;
  onConfirmBatch?: (
    receipts: { buildingId: string; hash: `0x${string}`; vaultId: string }[],
  ) => void;
};
const stamp = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : "No observed timestamp";
export default function CivicPanel({
  mode,
  city,
  prices,
  feed,
  loading,
  initialTicker,
  onClose,
  onRetry,
  onBuy,
  onBuyPaper,
  onSell,
  onSellPaper,
  onFocus,
  onScan,
  walletAddress,
  onClaimFaucet,
  onConfirmBatch,
}: Props) {
  const [ticker, setTicker] = useState<string | null>(initialTicker);
  const [search, setSearch] = useState("");
  const [amount, setAmount] = useState("500");
  const [sale, setSale] = useState(25);
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [vaultStats, setVaultStats] = useState<OnChainVaultStats | null>(null);
  const [faucetClaiming, setFaucetClaiming] = useState(false);
  const [faucetTxHash, setFaucetTxHash] = useState<string | null>(null);
  const [faucetError, setFaucetError] = useState<string | null>(null);
  const [onchainPositions, setOnchainPositions] = useState<OnchainPosition[]>([]);
  const [onchainLoading, setOnchainLoading] = useState(false);
  const [openTxns, setOpenTxns] = useState<Record<string, `0x${string}`>>({});
  const [faucetTxns, setFaucetTxns] = useState<`0x${string}`[]>([]);
  const [batchConfirming, setBatchConfirming] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryFeed | null>(null);
  const [passport, setPassport] = useState<Passport | null>(null);
  const [network, setNetwork] = useState(0);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartRetry, setChartRetry] = useState(0);
  const [clock, setClock] = useState(() => marketClock());
  const ref = useRef<HTMLElement>(null);
  const drag = useRef(0);
  const swiped = useRef(false);
  const passportTicker = useRef<string | null>(null);
  const deployment = passport?.deployments[network];
  const quote = ticker ? feed.quotes[ticker] : undefined;

  useEffect(() => {
    if (!walletAddress) {
      setOnchainPositions([]);
      setOpenTxns({});
      setFaucetTxns([]);
      return;
    }
    let active = true;
    setOnchainLoading(true);
    getOnchainPositions(walletAddress)
      .then((positions) => {
        if (active) setOnchainPositions(positions);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setOnchainLoading(false);
      });
    getPositionOpenTxns(walletAddress)
      .then((map) => {
        if (active) setOpenTxns(map);
      })
      .catch(() => {});
    getFaucetTxns(walletAddress)
      .then((txns) => {
        if (active) setFaucetTxns(txns);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [walletAddress, faucetTxHash]);

  const handleClaimFaucet = async () => {
    if (!walletAddress) {
      if (onClaimFaucet) onClaimFaucet();
      return;
    }
    try {
      setFaucetClaiming(true);
      setFaucetError(null);
      const hash = await claimFaucetOnchain(walletAddress);
      setFaucetTxHash(hash);
      if (onClaimFaucet) onClaimFaucet();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to claim faucet";
      setFaucetError(msg);
    } finally {
      setFaucetClaiming(false);
    }
  };

  const pendingBatch = city.buildings.filter(
    (b) => defFor(b.kind).ticker && b.locked,
  );

  const handleConfirmBatch = async () => {
    if (!walletAddress || !pendingBatch.length || batchConfirming) return;
    setBatchError(null);
    setBatchConfirming(true);
    setMessage("Approve the spend in your wallet, then confirm all buildings…");
    try {
      const { hash, positionIds } = await recordBuildingsBatch(
        walletAddress,
        pendingBatch.map((b) => ({
          buildingId: b.id,
          ticker: defFor(b.kind).ticker!,
          usdAmount: b.cost,
          entryPrice: b.entry,
          initialTier: 1,
        })),
        (step, stepHash) => {
          if (step === "approve" && !stepHash)
            setMessage("Confirm the mUSD approval popup in your wallet…");
          else if (step === "approve" && stepHash)
            setMessage(
              `Approval sent. Now confirm all ${pendingBatch.length} buildings in one signature…`,
            );
          else if (step === "buy" && !stepHash)
            setMessage(
              `Confirm the batch purchase popup — ${pendingBatch.length} buildings, one signature…`,
            );
          else if (step === "buy" && stepHash)
            setMessage("Batch sent. Waiting for BSC confirmation…");
        },
      );
      onConfirmBatch?.(
        pendingBatch.map((b, i) => ({
          buildingId: b.id,
          hash,
          vaultId: positionIds[i] ?? "0x",
        })),
      );
      setMessage(
        `${pendingBatch.length} buildings recorded on-chain in one tx. Receipts below.`,
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Batch confirm failed";
      setBatchError(msg);
      setMessage(`Batch kept as local-sim: ${msg}`);
    } finally {
      setBatchConfirming(false);
    }
  };
  useEffect(() => {
    setTicker(initialTicker);
    setMessage("");
  }, [initialTicker, mode]);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setClock(marketClock()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    getLiveVaultStats().then((stats) => {
      if (stats) setVaultStats(stats);
    });
  }, []);
  useEffect(() => {
    if (!ticker || mode === "portfolio") return;
    const controller = new AbortController();
    setChartLoading(true);
    setHistory(null);
    fetch(
      `/api/history?ticker=${encodeURIComponent(ticker)}${quote?.pair ? `&pair=${encodeURIComponent(quote.pair)}` : ""}`,
      { signal: controller.signal },
    )
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data: HistoryFeed) => {
        if (!Array.isArray(data.points)) throw Error();
        setHistory(data);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setHistory({
            points: sampleHistory(priceOf(ticker, prices)),
            simulated: true,
            tokenSource: "Illustrative fallback",
            benchmarkSource: "Unavailable",
          });
      })
      .finally(() => {
        if (!controller.signal.aborted) setChartLoading(false);
      });
    return () => controller.abort();
    // Quotes refresh separately. Only reload history when the selected instrument changes.
  }, [ticker, quote?.pair, mode, chartRetry]);
  useEffect(() => {
    if (!ticker || mode === "portfolio") return;
    const controller = new AbortController();
    if (passportTicker.current !== ticker) {
      setPassport(null);
      setNetwork(0);
      passportTicker.current = ticker;
    }
    fetch(`/api/passport?ticker=${encodeURIComponent(ticker)}`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then(setPassport)
      .catch(() => {
        if (!controller.signal.aborted)
          setPassport({
            fetchedAt: new Date().toISOString(),
            deployments: [],
            error: "Issuer information unavailable. Retry to check again.",
          });
      });
    return () => controller.abort();
  }, [ticker, mode, chartRetry, feed.fetchedAt]);
  const regularOpen = passport?.period
    ? passport.period === "market"
    : clock.open;
  const marketLabel = passport?.period
    ? regularOpen
      ? "U.S. market open"
      : "U.S. market closed"
    : clock.label;
  const selected = assets.find((a) => a.ticker === ticker);
  const paper = city.paper ?? [];
  const paperValue = (t?: string) =>
    paper
      .filter((p) => !t || p.ticker === t)
      .reduce((sum, p) => sum + p.quantity * priceOf(p.ticker, prices), 0);
  const paperBasis = (t?: string) =>
    paper
      .filter((p) => !t || p.ticker === t)
      .reduce((sum, p) => sum + p.cost, 0);
  const positions = city.buildings.filter(
    (b) => defFor(b.kind).ticker && !b.locked,
  );
  const total =
    positions.reduce((sum, b) => sum + valueOf(b, prices), 0) + paperValue();
  const realizedPnl = city.realizedPnl ?? 0;
  const basis =
    positions.reduce((sum, b) => sum + b.entry * b.quantity, 0) +
    paperBasis();
  const totalPnl = total - basis + realizedPnl;
  const companies = [
    ...new Set([
      ...positions.map((b) => defFor(b.kind).ticker!),
      ...paper.map((p) => p.ticker),
    ]),
  ];
  const held = positions.filter((b) => defFor(b.kind).ticker === ticker);
  const heldPaper = ticker ? paper.filter((p) => p.ticker === ticker) : [];
  const heldValue =
    held.reduce((sum, b) => sum + valueOf(b, prices), 0) +
    paperValue(ticker ?? undefined);
  const sectors = [
    ...new Set([
      ...positions.map(
        (b) => assets.find((a) => a.ticker === defFor(b.kind).ticker)!.sector,
      ),
      ...paper.map(
        (p) => assets.find((a) => a.ticker === p.ticker)?.sector ?? "Other",
      ),
    ]),
  ];
  const input = Number(amount);
  const validAmount =
    Number.isFinite(input) && input >= 1 && input <= city.cash;
  const hasExchange = city.buildings.some((b) => b.kind === "exchange");
  const liveCount = Object.values(feed.quotes).filter(
    (q) => q.status === "live",
  ).length;
  const title =
    mode === "portfolio"
      ? "City Hall"
      : mode === "market"
        ? "Stock Exchange"
        : "Data Center";
  return (
    <aside
      ref={ref}
      className={`${styles.panel} ${expanded ? styles.expanded : ""}`}
      role="dialog"
      aria-modal="false"
      aria-label={title}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <button
        className={styles.handle}
        aria-label={expanded ? "Collapse panel" : "Expand panel"}
        aria-expanded={expanded}
        onClick={() => {
          if (swiped.current) {
            swiped.current = false;
            return;
          }
          setExpanded((v) => !v);
        }}
        onPointerDown={(e) => {
          swiped.current = false;
          drag.current = e.clientY;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={(e) => {
          if (Math.abs(e.clientY - drag.current) > 20) {
            swiped.current = true;
            setExpanded(e.clientY < drag.current);
          }
        }}
      >
        <span />
      </button>
      <header className={styles.header}>
        <div className={styles.serviceIcon}>
          {mode === "portfolio" ? (
            <Landmark size={21} />
          ) : mode === "market" ? (
            <Building2 size={21} />
          ) : (
            <ShieldCheck size={21} />
          )}
        </div>
        <div>
          <span className={styles.eyebrow}>
            {mode === "portfolio"
              ? "YOUR CITY, ACCOUNTED FOR"
              : mode === "market"
                ? "THE ISLAND TRADING DESK"
                : "RWA SCANNER & VERIFICATION"}
          </span>
          <h2>{title}</h2>
        </div>
        <button
          className={styles.iconButton}
          onClick={onClose}
          aria-label="Close building panel"
        >
          <X size={20} />
        </button>
      </header>
      <div className={styles.content}>
        {mode === "portfolio" ? (
          <>
            <section className={styles.summary}>
              <span className={styles.eyebrow}>INVESTED PORTFOLIO</span>
              <h3>{money(total)}</h3>
              <span className={totalPnl >= 0 ? styles.up : styles.down}>
                {money(totalPnl)} total profit / loss
              </span>
              <div className={styles.stats}>
                <div>
                  Available funds<strong>{money(city.cash)}</strong>
                </div>
                <div>
                  Cost basis<strong>{money(basis)}</strong>
                </div>
                <div>
                  Unrealized P/L<strong>{money(total - basis)}</strong>
                </div>
                <div>
                  Realized P/L<strong>{money(realizedPnl)}</strong>
                </div>
              </div>
            </section>
            <div className={styles.note}>
              <Radio size={15} />
              <span>
                <strong>{healthOf(city.buildings, prices).label}</strong>
                <br />
                {healthOf(city.buildings, prices).detail}
              </span>
            </div>
            <div className={styles.bnbVaultCard}>
              <div className={styles.bnbVaultHeader}>
                <span className={styles.bnbBadge}>
                  <ShieldCheck size={13} />
                  BNB Chain Testnet (97)
                </span>
                <span style={{ fontSize: "11px", color: "#f0b90b", fontWeight: 600 }}>
                  {vaultStats?.verified ? "Contracts Verified" : "Syncing RPC..."}
                </span>
              </div>

              <div className={styles.contractInfoRow}>
                <div className={styles.contractLabel}>
                  <strong>MockUSD Faucet Token (mUSD)</strong>
                  <small>{MOCK_USD_ADDRESS.slice(0, 10)}...{MOCK_USD_ADDRESS.slice(-8)}</small>
                </div>
                <a
                  href={bscAddressLink(MOCK_USD_ADDRESS)}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.contractLink}
                  title="View MockUSD on BscScan"
                >
                  <span>BscScan</span>
                  <ExternalLink size={11} />
                </a>
              </div>

              <div className={styles.contractInfoRow}>
                <div className={styles.contractLabel}>
                  <strong>StockCityVault Contract</strong>
                  <small>{VAULT_ADDRESS.slice(0, 10)}...{VAULT_ADDRESS.slice(-8)}</small>
                </div>
                <a
                  href={bscAddressLink(VAULT_ADDRESS)}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.contractLink}
                  title="View StockCityVault on BscScan"
                >
                  <span>BscScan</span>
                  <ExternalLink size={11} />
                </a>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px", marginTop: "2px" }}>
                <div style={{ background: "rgba(0,0,0,0.2)", padding: "6px 8px", borderRadius: "4px" }}>
                  <span style={{ color: "var(--civic-muted)", display: "block", fontSize: "10px" }}>VAULT RESERVES</span>
                  <strong style={{ color: "#edf2f3" }}>${vaultStats?.vaultReserves.toLocaleString() ?? "200,000"} mUSD</strong>
                </div>
                <div style={{ background: "rgba(0,0,0,0.2)", padding: "6px 8px", borderRadius: "4px" }}>
                  <span style={{ color: "var(--civic-muted)", display: "block", fontSize: "10px" }}>ON-CHAIN POSITIONS</span>
                  <strong style={{ color: "#edf2f3" }}>{vaultStats?.totalPositions ?? 0} Recorded</strong>
                </div>
              </div>

              <div className={styles.faucetActionRow}>
                <button
                  type="button"
                  className={styles.faucetBtn}
                  disabled={faucetClaiming}
                  onClick={handleClaimFaucet}
                >
                  <Coins size={14} />
                  <span>
                    {faucetClaiming
                      ? "Confirming on BSC Testnet…"
                      : walletAddress
                        ? "Claim 10,000 $mUSD (On-chain Faucet)"
                        : "Claim 10,000 $mUSD (Connect Wallet)"}
                  </span>
                </button>
              </div>
              {faucetTxHash && (
                <p className={styles.caption} style={{ color: "#4caf50", marginTop: 6 }}>
                  Claimed!{" "}
                  <a
                    href={bscTxLink(faucetTxHash)}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.contractLink}
                  >
                    View on BscScan <ExternalLink size={11} />
                  </a>
                </p>
              )}
              {faucetError && (
                <p role="alert" className={styles.caption} style={{ color: "#f87171", marginTop: 6 }}>
                  {faucetError}
                </p>
              )}
              {walletAddress && faucetTxns.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <span style={{ color: "var(--civic-muted)", display: "block", fontSize: "10px", marginBottom: 4 }}>
                    FAUCET HISTORY
                  </span>
                  <div style={{ display: "grid", gap: 4 }}>
                    {faucetTxns.map((hash) => (
                      <a
                        key={hash}
                        href={bscTxLink(hash)}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.contractLink}
                        title={`Faucet tx ${hash} on BscScan`}
                        style={{ fontSize: 11 }}
                      >
                        <span>
                          {hash.slice(0, 10)}…{hash.slice(-8)}
                        </span>
                        <ExternalLink size={11} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <SectionTitle
              title="On-chain buildings"
              detail={
                walletAddress
                  ? onchainLoading
                    ? "Syncing…"
                    : `${onchainPositions.filter((p) => p.active).length} active`
                  : "Connect wallet"
              }
            />
            {!walletAddress ? (
              <p className={styles.empty}>
                Connect your wallet to see vault positions recorded on BSC
                testnet.
              </p>
            ) : onchainLoading ? (
              <p className={styles.empty}>Reading vault positions…</p>
            ) : !onchainPositions.length ? (
              <p className={styles.empty}>
                No on-chain positions yet for this wallet. Claim the faucet,
                then buy &amp; place a building.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {onchainPositions.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      background: "rgba(0,0,0,0.2)",
                      padding: "8px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <strong style={{ color: "#edf2f3" }}>
                        {p.ticker} · Tier {p.buildingTier}
                      </strong>
                      <span
                        style={{
                          color: p.active ? "#4caf50" : "#9e9e9e",
                          fontWeight: 700,
                        }}
                      >
                        {p.active ? "ACTIVE" : "CLOSED"}
                      </span>
                    </div>
                    <div style={{ color: "var(--civic-muted)", marginTop: 2 }}>
                      {(Number(p.quantity) / 1e18).toFixed(4)} units @ $
                      {(Number(p.entryPrice) / 1e18).toFixed(2)}
                    </div>
                    {openTxns[p.id.toLowerCase()] ? (
                      <a
                        href={bscTxLink(openTxns[p.id.toLowerCase()])}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.contractLink}
                        title={`Open tx for position ${p.id} on BscScan`}
                      >
                        <span>Open tx on BscScan</span>
                        <ExternalLink size={11} />
                      </a>
                    ) : (
                      <a
                        href={bscAddressLink(VAULT_ADDRESS)}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.contractLink}
                        title={`Position ${p.id} on BscScan`}
                      >
                        <span>Vault tx history</span>
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
            <SectionTitle
              title="Confirm on-chain"
              detail={
                !walletAddress
                  ? "Connect wallet"
                  : pendingBatch.length
                    ? `${pendingBatch.length} queued`
                    : "All recorded"
              }
            />
            {!walletAddress ? (
              <p className={styles.empty}>
                Connect your wallet to record queued buildings on BSC testnet.
              </p>
            ) : !pendingBatch.length ? (
              <p className={styles.empty}>
                Nothing queued. Place more buildings, then confirm them
                together.
              </p>
            ) : (
              <>
                <div className={styles.faucetActionRow}>
                  <button
                    type="button"
                    className={styles.faucetBtn}
                    disabled={batchConfirming}
                    onClick={() => void handleConfirmBatch()}
                    title="One signature records all queued buildings"
                  >
                    <Coins size={14} />
                    <span>
                      {batchConfirming
                        ? "Waiting for wallet signature…"
                        : `Confirm ${pendingBatch.length} building${pendingBatch.length === 1 ? "" : "s"} (1 signature)`}
                    </span>
                  </button>
                </div>
                {batchError && (
                  <p role="alert" className={styles.caption} style={{ color: "#f87171", marginTop: 6 }}>
                    {batchError}
                  </p>
                )}
              </>
            )}
            <SectionTitle
              title="Placement receipts"
              detail={
                positions.filter((b) => b.vaultTx).length
                  ? `${positions.filter((b) => b.vaultTx).length}/${positions.length} on-chain`
                  : "local-sim"
              }
            />
            {!positions.length ? (
              <p className={styles.empty}>
                No buildings placed yet. Buy &amp; place a company to get a
                receipt.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {positions.map((b) => {
                  const t = defFor(b.kind).ticker!;
                  return (
                    <div
                      key={b.id}
                      style={{
                        background: "rgba(0,0,0,0.2)",
                        padding: "8px 10px",
                        borderRadius: 6,
                        fontSize: 11,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <strong style={{ color: "#edf2f3" }}>
                          {t} · {money(valueOf(b, prices))}
                        </strong>
                        {b.vaultTx ? (
                          <a
                            href={bscTxLink(b.vaultTx)}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.contractLink}
                            title={`Buy tx for this ${t} building on BscScan`}
                          >
                            <span>Buy tx</span>
                            <ExternalLink size={11} />
                          </a>
                        ) : (
                          <span style={{ color: "#9e9e9e" }}>
                            Local-sim only
                          </span>
                        )}
                      </div>
                      {b.vaultTx && (
                        <div style={{ color: "var(--civic-muted)", marginTop: 2 }}>
                          {b.vaultTx.slice(0, 10)}…{b.vaultTx.slice(-8)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <SectionTitle
              title="Sector allocation"
              detail={`${sectors.length} sectors`}
            />
            {!sectors.length && (
              <p className={styles.empty}>
                Your city has no investments yet. Build the Stock Exchange, then
                choose your first company.
              </p>
            )}
            {sectors.map((sector) => {
              const value =
                positions
                  .filter(
                    (b) =>
                      assets.find((a) => a.ticker === defFor(b.kind).ticker)
                        ?.sector === sector,
                  )
                  .reduce((s, b) => s + valueOf(b, prices), 0) +
                paper
                  .filter(
                    (p) =>
                      (assets.find((a) => a.ticker === p.ticker)?.sector ??
                        "Other") === sector,
                  )
                  .reduce(
                    (s, p) => s + p.quantity * priceOf(p.ticker, prices),
                    0,
                  );
              return (
                <div className={styles.sector} key={sector}>
                  <div>
                    <span>{sector}</span>
                    <b>{total ? ((value / total) * 100).toFixed(1) : 0}%</b>
                  </div>
                  <div className={styles.track}>
                    <i
                      style={{ width: `${total ? (value / total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {companies.length > 0 && (
              <>
                <SectionTitle
                  title="Company allocation"
                  detail={`${companies.length} companies`}
                />
                {companies.map((ticker) => {
                  const buildings = positions.filter(
                    (b) => defFor(b.kind).ticker === ticker,
                  );
                  const paperHoldings = paper.filter((p) => p.ticker === ticker);
                  const value =
                    buildings.reduce(
                      (sum, b) => sum + valueOf(b, prices),
                      0,
                    ) +
                    paperHoldings.reduce(
                      (sum, p) => sum + p.quantity * priceOf(p.ticker, prices),
                      0,
                    );
                  const paperOnly = !buildings.length && paperHoldings.length > 0;
                  return (
                    <button
                      key={ticker}
                      className={styles.assetRow}
                      onClick={() => {
                        if (buildings[0]) onFocus(buildings[0]);
                        else {
                          setTicker(ticker);
                          setMessage("");
                        }
                      }}
                    >
                      <StockLogo
                        ticker={ticker}
                        name={assets.find((a) => a.ticker === ticker)?.name}
                        size={34}
                        color={assets.find((a) => a.ticker === ticker)?.color}
                      />
                      <span>
                        <strong>
                          {assets.find((a) => a.ticker === ticker)?.name}
                        </strong>
                        <small>
                          {paperOnly
                            ? `${paperHoldings.length} position${paperHoldings.length === 1 ? "" : "s"} · no building`
                            : `${buildings.length} building${buildings.length === 1 ? "" : "s"}`}{" "}
                          · {total ? ((value / total) * 100).toFixed(1) : 0}%
                          allocation
                        </small>
                      </span>
                      <span className={styles.rowPrice}>{money(value)}</span>
                      <Crosshair size={14} />
                    </button>
                  );
                })}
              </>
            )}
            <SectionTitle
              title="Owned buildings"
              detail={`${city.buildings.length} on island`}
            />
            <p className={styles.caption}>
              Select a name to find it on your island.
            </p>
            {city.buildings.map((b) => {
              const def = defFor(b.kind);
              return (
                <button
                  key={b.id}
                  className={styles.assetRow}
                  onClick={() => onFocus(b)}
                >
                  {def.ticker ? (
                    <StockLogo
                      ticker={def.ticker}
                      name={def.name}
                      size={34}
                      color={assets.find((a) => a.ticker === def.ticker)?.color}
                    />
                  ) : (
                    <span className={styles.monogram}>
                      <Landmark size={15} />
                    </span>
                  )}
                  <span>
                    <strong>
                      {def.name} {b.locked ? "🔒" : ""}
                    </strong>
                    <small>
                      {def.ticker
                        ? `${b.quantity.toFixed(4)} units · ${assets.find((a) => a.ticker === def.ticker)?.sector}${b.locked ? " · locked" : ""}`
                        : "Public service"}
                    </small>
                  </span>
                  <span className={styles.rowPrice}>
                    <b>{def.ticker ? money(valueOf(b, prices)) : "Built"}</b>
                    {def.ticker && (
                      <small
                        className={
                          valueOf(b, prices) >= b.quantity * b.entry
                            ? styles.up
                            : styles.down
                        }
                      >
                        {money(valueOf(b, prices) - b.quantity * b.entry)}
                      </small>
                    )}
                  </span>
                  <Crosshair size={14} />
                </button>
              );
            })}
            <p className={styles.caption}>
              Valued with the latest available quotes; individual assets may use
              illustrative fallback prices. {liveCount}/{assets.length} live
              quotes.
            </p>
          </>
        ) : (
          <>
            {mode === "data" && (
              <button className={styles.scanButton} onClick={onScan}>
                <Crosshair size={18} />
                <span>
                  Scan the island<small>Hover or tap a company building</small>
                </span>
                <ArrowUpRight size={18} />
              </button>
            )}
            {!selected ? (
              <>
                <div className={styles.intro}>
                  <h3>
                    {mode === "market"
                      ? "Build a position."
                      : "Look behind the building."}
                  </h3>
                  <p>
                    {mode === "market"
                      ? "Choose a company. Invest demo funds. Give it a place on your island."
                      : "Inspect the token, its price source, and the evidence available before you invest."}
                  </p>
                </div>
                <div className={styles.feedStatus}>
                  <span
                    className={loading ? styles.loadingDot : styles.liveDot}
                  />
                  {loading
                    ? "Connecting to public market data…"
                    : `${liveCount} live · ${assets.length - liveCount} fallback or stale`}
                  <button onClick={onRetry} disabled={loading}>
                    Refresh
                  </button>
                </div>
                {feed.error && <p className={styles.warning}>{feed.error}</p>}
                <label className={styles.search}>
                  <Search size={16} />
                  <input
                    aria-label="Search companies"
                    placeholder={`Search ${assets.length} stocks and funds`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <div className={styles.listHeader}>
                  <span>COMPANY / TOKEN</span>
                  <span>PRICE / TODAY</span>
                </div>
                {assets
                  .filter((a) =>
                    `${a.ticker} ${a.name} ${a.sector}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .sort((a, b) => {
                    const ab = isHeroTicker(a.ticker) ? 0 : 1;
                    const bb = isHeroTicker(b.ticker) ? 0 : 1;
                    return ab - bb;
                  })
                  .map((a) => {
                    const q = feed.quotes[a.ticker];
                    const buildable = isHeroTicker(a.ticker);
                    return (
                      <button
                        className={styles.assetRow}
                        key={a.ticker}
                        onClick={() => {
                          setTicker(a.ticker);
                          setMessage("");
                        }}
                      >
                        <StockLogo
                          ticker={a.ticker}
                          name={a.name}
                          size={34}
                          color={a.color}
                          type={mode === "data" ? "rwa" : "stock"}
                          badge={mode === "data" ? "RWA" : undefined}
                        />
                        <span>
                          <strong>{a.name}</strong>
                          <small>
                            {q?.tokenName ?? a.ticker}{" "}
                            <span className={styles.tag}>
                              {q?.status === "live"
                                ? "xStocks"
                                : (q?.status ?? "fallback")}
                            </span>{" "}
                            <span className={styles.tag}>
                              {buildable ? "🏢 Builds a building" : "Position only"}
                            </span>
                          </small>
                        </span>
                        <span className={styles.rowPrice}>
                          <b>{money(priceOf(a.ticker, prices))}</b>
                          <small
                            className={
                              (q?.change ?? 0) >= 0 ? styles.up : styles.down
                            }
                          >
                            {pct(q?.change ?? 0)}
                          </small>
                        </span>
                        <ChevronRight size={14} />
                      </button>
                    );
                  })}
                {!assets.some((a) =>
                  `${a.ticker} ${a.name} ${a.sector}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                ) && (
                  <div className={styles.empty}>
                    No companies match “{search}”.{" "}
                    <button onClick={() => setSearch("")}>Clear search</button>
                  </div>
                )}
              </>
            ) : (
              <>
                <button className={styles.back} onClick={() => setTicker(null)}>
                  <ArrowLeft size={14} />
                  All assets<span>{assets.length}</span>
                </button>
                <div className={styles.instrument}>
                  <div className={styles.instrumentHeader}>
                    <StockLogo
                      ticker={selected.ticker}
                      name={selected.name}
                      size={46}
                      color={selected.color}
                      type="stock"
                    />
                    <div>
                      <span className={styles.eyebrow}>
                        {selected.ticker} / USD · {selected.sector}
                      </span>
                      <h3>{selected.name}</h3>
                    </div>
                  </div>
                  <div className={styles.quote}>
                    {money(priceOf(selected.ticker, prices))}
                    <span
                      className={
                        (quote?.change ?? 0) >= 0 ? styles.up : styles.down
                      }
                    >
                      {pct(quote?.change ?? 0)}
                    </span>
                  </div>
                  <div className={styles.marketState}>
                    <span className={styles.liveDot} />
                    <span>24/7 On-Chain RWA Market</span>
                    <span>
                      {quote?.status === "live"
                        ? "Continuous trade"
                        : `${quote?.status ?? "fallback"} price`}
                    </span>
                  </div>
                  <p className={styles.caption}>
                    {passport?.period
                      ? `24/7 continuous on-chain trading · Issuer window: ${passport.period}${passport.halted ? " · trading halted" : ""}`
                      : "Tokenized RWA assets trade 24/7 continuously on decentralized protocols."}
                  </p>
                </div>
                <div className={styles.chartHeader}>
                  <strong>
                    {mode === "data"
                      ? "Token vs. underlying"
                      : "Price movement"}
                  </strong>
                  <span>HOURLY · USD</span>
                </div>
                {chartLoading ? (
                  <div className={styles.chartSkeleton} role="status">
                    Loading price history…
                  </div>
                ) : (
                  <TradingChart
                    points={history?.points ?? []}
                    compare={mode === "data"}
                    simulated={history?.simulated ?? true}
                    ticker={selected.ticker}
                    tokenName={quote?.tokenName ?? `${selected.ticker}x`}
                    benchmarkName={`${selected.name} (${selected.ticker})`}
                    defaultPrice={priceOf(selected.ticker, prices)}
                    livePrice={quote?.price ?? priceOf(selected.ticker, prices)}
                    liveChange={quote?.change ?? selected.change}
                  />
                )}
                <div className={styles.chartLegend}>
                  <span>
                    <i />
                    {history?.tokenSource ?? "Loading token history"}
                  </span>
                  {mode === "data" && (
                    <span>
                      <i className={styles.benchmarkKey} />
                      {history?.benchmarkSource ?? "Loading reference"}
                    </span>
                  )}
                </div>
                {(history?.simulated ||
                  (mode === "data" && !history?.benchmarkPrice)) && (
                  <p className={styles.warning}>
                    {history?.simulated
                      ? "Observed token history unavailable. Any sample line is illustrative."
                      : "Underlying price unavailable; a spread cannot be calculated."}{" "}
                    <button onClick={() => setChartRetry((v) => v + 1)}>
                      Retry
                    </button>
                  </p>
                )}
                {mode === "market" ? (
                  <>
                    <section className={styles.trade}>
                      <SectionTitle
                        title="Make it part of your city"
                        detail="DEMO ORDER"
                      />
                      <label htmlFor="investment">Investment amount</label>
                      <div className={styles.amount}>
                        <span>USD</span>
                        <input
                          id="investment"
                          type="number"
                          min="1"
                          step="0.01"
                          inputMode="decimal"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          aria-invalid={!validAmount}
                          aria-describedby="amount-hint"
                        />
                      </div>
                      <div id="amount-hint" className={styles.caption} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>
                          {validAmount
                            ? `≈ ${(input / priceOf(selected.ticker, prices)).toFixed(4)} units · ${money(city.cash)} available`
                            : `Enter $1–${money(city.cash)} in available demo funds.`}
                        </span>
                        <button
                          type="button"
                          onClick={handleClaimFaucet}
                          disabled={faucetClaiming}
                          style={{
                            background: "rgba(240, 185, 11, 0.15)",
                            border: "1px solid rgba(240, 185, 11, 0.4)",
                            color: "#f0b90b",
                            borderRadius: "4px",
                            fontSize: "10px",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "2px 7px",
                          }}
                          title={
                            walletAddress
                              ? "Claim 10,000 $mUSD from BSC Testnet Faucet"
                              : "Connect wallet to claim 10,000 $mUSD on BSC Testnet"
                          }
                        >
                          <Coins size={11} />
                          {faucetClaiming ? "Claiming…" : "+10k Faucet"}
                        </button>
                      </div>
                      {catalogue.find((d) => d.ticker === selected.ticker) ? (
                        <>
                          <button
                            className={styles.primary}
                            disabled={!validAmount || !hasExchange}
                            onClick={() =>
                              onBuy(
                                catalogue.find((d) => d.ticker === selected.ticker)!
                                  .kind,
                                input,
                              )
                            }
                          >
                            Buy & place building
                            <ArrowUpRight size={17} />
                          </button>
                          <p className={styles.caption}>
                            Places a locked draft on the island. Pay in City
                            Hall (bundle, 1 signature) to unlock it
                            permanently.
                          </p>
                        </>
                      ) : (
                        <>
                          <button
                            className={styles.primary}
                            disabled={!validAmount}
                            onClick={() =>
                              setMessage(onBuyPaper(selected.ticker, input))
                            }
                          >
                            Buy position (no building)
                            <ArrowUpRight size={17} />
                          </button>
                          <p className={styles.caption}>
                            Position-only asset: tracked in City Hall without
                            an island building.
                          </p>
                        </>
                      )}
                    </section>
                    <section className={styles.trade}>
                      <SectionTitle
                        title="Your position"
                        detail={money(heldValue)}
                      />
                      {held.length || heldPaper.length ? (
                        <>
                          <div className={styles.segment}>
                            {[25, 50, 75, 100].map((n) => (
                              <button
                                key={n}
                                aria-pressed={sale === n}
                                className={sale === n ? styles.chosen : ""}
                                onClick={() => setSale(n)}
                              >
                                {n === 100 ? "All" : `${n}%`}
                              </button>
                            ))}
                          </div>
                          {held.length > 0 && (
                            <button
                              className={styles.sell}
                              disabled={!hasExchange}
                              onClick={() =>
                                setMessage(onSell(selected.ticker, sale / 100))
                              }
                            >
                              {sale === 100
                                ? "Liquidate buildings"
                                : `Sell ${sale}% buildings`}{" "}
                              ·{" "}
                              {money(
                                (held.reduce(
                                  (s, b) => s + valueOf(b, prices),
                                  0,
                                ) *
                                  sale) /
                                  100,
                              )}
                            </button>
                          )}
                          {heldPaper.length > 0 && (
                            <button
                              className={styles.sell}
                              disabled={!hasExchange}
                              onClick={() =>
                                setMessage(
                                  onSellPaper(selected.ticker, sale / 100),
                                )
                              }
                              style={{ marginTop: 8 }}
                            >
                              {sale === 100
                                ? "Liquidate position"
                                : `Sell ${sale}% position`}{" "}
                              ·{" "}
                              {money(
                                (paperValue(selected.ticker) * sale) / 100,
                              )}
                            </button>
                          )}
                          <p className={styles.caption}>
                            A full sale removes all {selected.ticker} buildings
                            and positions. Partial sales keep their remaining
                            units.
                          </p>
                        </>
                      ) : (
                        <p className={styles.caption}>
                          No position yet. Your first purchase starts here.
                        </p>
                      )}
                      {message && (
                        <p role="status" className={styles.notice}>
                          {message}
                        </p>
                      )}
                    </section>
                  </>
                ) : (
                  <>
                    <SectionTitle
                      title="RWA passport"
                      detail={quote?.tokenName ?? "NOT CONFIRMED"}
                    />
                    <div className={styles.passportHero}>
                      <div className={styles.passportLogos}>
                        <StockLogo
                          ticker={selected.ticker}
                          name={selected.name}
                          size={44}
                          color={selected.color}
                          type="stock"
                        />
                        <span className={styles.rwaLinkArrow}>⇄</span>
                        <StockLogo
                          ticker={selected.ticker}
                          name={passport?.name ?? `${selected.ticker}x`}
                          size={44}
                          color={selected.color}
                          type="rwa"
                          badge="RWA"
                        />
                      </div>
                      <div className={styles.passportHeroMeta}>
                        <h4>{passport?.name ?? `${selected.name} Tokenized Stock`}</h4>
                        <span className={styles.passportIssuer}>
                          Underlying: {selected.name} ({selected.ticker}) · Backed by Physical Equity
                        </span>
                      </div>
                    </div>
                    <dl className={styles.passport}>
                      <Fact label="Underlying">
                        {selected.name} · {selected.ticker}
                      </Fact>
                      <Fact label="Stock exchange">
                        {passport?.exchange ??
                          history?.exchange ??
                          "Not supplied by the reference provider"}
                      </Fact>
                      <Fact label="Token">
                        {passport?.name ??
                          quote?.tokenName ??
                          "No live token match returned"}
                      </Fact>
                      <Fact label="Issuer">
                        {passport?.symbol
                          ? "Backed Assets (JE) Limited"
                          : "Unconfirmed — issuer metadata unavailable"}
                      </Fact>
                      <Fact label="ISIN">
                        {passport?.isin ?? "Unavailable"}
                      </Fact>
                      <Fact label="Network">
                        {passport?.deployments.length ? (
                          <select
                            aria-label="Token network"
                            value={network}
                            onChange={(e) => setNetwork(Number(e.target.value))}
                          >
                            {passport.deployments.map((d, i) => (
                              <option value={i} key={d.network}>
                                {d.network === "BinanceSmartChain"
                                  ? "BNB Smart Chain"
                                  : d.network}
                              </option>
                            ))}
                          </select>
                        ) : (
                          "No verified deployment returned"
                        )}
                      </Fact>
                      <Fact label="Contract">
                        {deployment ? (
                          <>
                            <code>{deployment.address}</code>
                            {deployment.explorer && (
                              <a
                                className={styles.contractLink}
                                href={deployment.explorer}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Verify contract & transactions{" "}
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </>
                        ) : (
                          "Unavailable — no address inferred"
                        )}
                      </Fact>
                    </dl>
                    <SectionTitle
                      title="Price comparison"
                      detail="INDEPENDENT SOURCES"
                    />
                    <div className={styles.comparison}>
                      <div>
                        <small>Token · {quote?.status}</small>
                        <strong>
                          {money(priceOf(selected.ticker, prices))}
                        </strong>
                        <span>{stamp(quote?.fetchedAt)} · fetched</span>
                      </div>
                      <div>
                        <small>Underlying benchmark</small>
                        <strong>
                          {history?.benchmarkPrice
                            ? money(history.benchmarkPrice)
                            : "Unavailable"}
                        </strong>
                        <span>{stamp(history?.benchmarkAt)} · traded</span>
                      </div>
                    </div>
                    <p className={styles.caption}>
                      {quote?.source} / {history?.benchmarkSource}. Token
                      retrieval time is not its last-trade time.
                    </p>
                    <div className={styles.note}>
                      <Radio size={15} />
                      <span>
                        {quote?.status === "live" && history?.benchmarkPrice
                          ? `Indicative spread: ${pct((quote.price / history.benchmarkPrice - 1) * 100)}. Quotes are not synchronized.`
                          : "Spread unavailable without two observed prices."}
                        <br />
                        {!regularOpen &&
                          "U.S. session closed: the stock reference stays at its last reported trade; tokens can still trade."}
                      </span>
                    </div>
                    <SectionTitle
                      title="Evidence & limitations"
                      detail="READ BEFORE BUYING"
                    />
                    <div className={styles.evidence}>
                      <strong>
                        {passport?.reserve
                          ? `Issuer reserve report · ${Date.now() - Date.parse(passport.reserve.timestamp) > 86400000 ? "stale (>24h)" : "available"}`
                          : "Reserve status: report unavailable"}
                      </strong>
                      {passport?.reserve ? (
                        <>
                          <dl className={styles.passport}>
                            <Fact label="Reported shares">
                              {passport.reserve.sharesHeld.toLocaleString(
                                undefined,
                                { maximumFractionDigits: 4 },
                              )}
                            </Fact>
                            <Fact label="Circulating supply">
                              {passport.reserve.circulatingSupply.toLocaleString(
                                undefined,
                                { maximumFractionDigits: 4 },
                              )}
                            </Fact>
                            <Fact label="Custody providers">
                              {passport.reserve.providers.join(", ") ||
                                "Not supplied"}
                            </Fact>
                            <Fact label="Report timestamp">
                              {stamp(passport.reserve.timestamp)}
                            </Fact>
                          </dl>
                          <p>
                            Issuer-reported holdings, not an independent audit.
                            Share counts and token supply can differ due to
                            multipliers, dividends, and pending issuance. No
                            backing ratio is inferred.
                          </p>
                          <a
                            href={`https://api.xstocks.fi/api/v2/public/proof-of-reserves/${encodeURIComponent(passport.symbol ?? `${selected.ticker}x`)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View source reserve report{" "}
                            <ExternalLink size={13} />
                          </a>
                        </>
                      ) : (
                        <p>
                          {passport
                            ? "No reserve report returned. A live token price is not proof of backing."
                            : "Fetching the issuer’s current reserve report…"}
                        </p>
                      )}
                    </div>
                    <div className={styles.evidence}>
                      <strong>Rights & limitations</strong>
                      <p>
                        {passport?.symbol
                          ? "A tracker certificate gives economic exposure to the stock, without shareholder voting rights or direct equity ownership. Redemption eligibility, geographic restrictions and fees follow the prospectus. Issuer, custody, liquidity and price-deviation risks remain."
                          : "Token rights are unconfirmed until issuer metadata is available. Review the official product documents before relying on an illustrative listing."}
                      </p>
                      <a
                        href="https://assets.backed.fi/legal-documentation"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Official base prospectus & product terms{" "}
                        <ExternalLink size={13} />
                      </a>
                      <br />
                      <a
                        href="https://docs.xstocks.fi/docs/product-legal-overview"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Issuer legal overview <ExternalLink size={13} />
                      </a>
                    </div>
                    {passport?.error && (
                      <p className={styles.warning}>
                        {passport.error}{" "}
                        <button onClick={() => setChartRetry((v) => v + 1)}>
                          Retry issuer data
                        </button>
                      </p>
                    )}
                    <p className={styles.caption}>
                      Issuer API checked {stamp(passport?.fetchedAt)}. Contract
                      details describe the real token; your city position is a
                      local simulation.
                    </p>
                  </>
                )}
                <p className={styles.caption}>
                  {quote?.source} · {stamp(quote?.fetchedAt)}{" "}
                  <button onClick={onRetry} disabled={loading}>
                    {loading ? "Refreshing…" : "Refresh quote"}
                  </button>
                </p>
              </>
            )}
          </>
        )}
      </div>
      <footer className={styles.footer}>
        <span>DEMO CITY</span>Simulated positions · no real securities are
        purchased
      </footer>
    </aside>
  );
}
function SectionTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <div className={styles.sectionTitle}>
      <h3>{title}</h3>
      <span>{detail}</span>
    </div>
  );
}
function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

