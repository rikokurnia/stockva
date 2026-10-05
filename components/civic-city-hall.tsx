"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ArrowUpRight,
  ChevronDown,
  Coins,
  Crosshair,
  ExternalLink,
  MapPin,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { formatUnits } from "viem";
import { assets, defFor, money, pct, priceOf, sprite } from "../lib/city";
import { portfolioLandscape } from "../lib/agent-hall";
import { transactionHistory, type CityTransaction } from "../lib/civic";
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
import type { CivicProps } from "./civic-panel";
import { stamp } from "../lib/civic";
import StockLogo from "./stock-logo";
import styles from "./civic-panel.module.css";

export default function CivicCityHall(
  props: CivicProps & { onBusy: (busy: boolean) => void },
) {
  const {
    city,
    prices,
    feed,
    walletAddress,
    onConnectWallet,
    onConfirmBatch,
    onFocus,
    onSell,
    onSellPaper,
    onBusy,
  } = props;
  const [positions, setPositions] = useState<OnchainPosition[]>([]);
  const [stats, setStats] = useState<OnChainVaultStats | null>(null);
  const [chainLoading, setChainLoading] = useState(false);
  const [chainError, setChainError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [operation, setOperation] = useState<
    "connect" | "faucet" | "batch" | null
  >(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [openTxns, setOpenTxns] = useState<Record<string, `0x${string}`>>({});
  const [faucetTxns, setFaucetTxns] = useState<`0x${string}`[]>([]);
  const [recentFaucet, setRecentFaucet] = useState<{
    owner: string;
    hash: `0x${string}`;
  } | null>(null);
  const [saleTicker, setSaleTicker] = useState<string | null>(null);
  const [salePercent, setSalePercent] = useState(25);
  const [saleMessage, setSaleMessage] = useState("");
  const drafts = city.buildings.filter(
    (building) => building.locked && Boolean(defFor(building.kind).ticker),
  );
  const stocks = city.buildings.filter(
    (building) => !building.locked && defFor(building.kind).ticker,
  );
  const landscape = useMemo(
    () =>
      portfolioLandscape([
        ...stocks.map((building) => ({
          ticker: defFor(building.kind).ticker!,
          sector:
            assets.find(
              (asset) => asset.ticker === defFor(building.kind).ticker,
            )?.sector ?? "Other",
          units: building.quantity,
          basis: building.entry * building.quantity,
          price: priceOf(defFor(building.kind).ticker!, prices),
        })),
        ...(city.paper ?? []).map((holding) => ({
          ticker: holding.ticker,
          sector:
            assets.find((asset) => asset.ticker === holding.ticker)?.sector ??
            "Other",
          units: holding.quantity,
          basis: holding.cost,
          price: priceOf(holding.ticker, prices),
        })),
      ]),
    [city, prices],
  );
  const sectors = [
    ...new Set(landscape.holdings.map((holding) => holding.sector)),
  ]
    .map((sector) => ({
      name: sector,
      value: landscape.holdings
        .filter((holding) => holding.sector === sector)
        .reduce((sum, holding) => sum + holding.value, 0),
    }))
    .sort((a, b) => b.value - a.value);
  const mappedIds = new Set(
    stocks.map((building) => building.vaultId?.toLowerCase()).filter(Boolean),
  );
  const walletOnly = positions.filter(
    (position) => position.active && !mappedIds.has(position.id.toLowerCase()),
  );
  const localPnl = landscape.total - landscape.basis;
  const totalDraft = drafts.reduce((sum, building) => sum + building.cost, 0);

  useEffect(() => {
    onBusy(Boolean(operation));
    return () => onBusy(false);
  }, [operation, onBusy]);
  useEffect(() => {
    let active = true;
    setPositions([]);
    setStats(null);
    setChainError("");
    setChainLoading(true);
    Promise.allSettled([
      getLiveVaultStats(),
      walletAddress ? getOnchainPositions(walletAddress) : Promise.resolve([]),
    ]).then(([vault, wallet]) => {
      if (!active) return;
      if (vault.status === "fulfilled") setStats(vault.value);
      if (wallet.status === "fulfilled") setPositions(wallet.value);
      if (wallet.status === "rejected")
        setChainError(
          "Wallet positions could not be read. Your saved city holdings are still shown.",
        );
      setChainLoading(false);
    });
    return () => {
      active = false;
    };
  }, [walletAddress, refresh]);
  useEffect(() => {
    setOpenTxns({});
    setFaucetTxns([]);
    setHistoryError("");
    if (!historyOpen || !walletAddress) {
      setHistoryLoading(false);
      return;
    }
    let active = true;
    setHistoryLoading(true);
    Promise.all([
      getPositionOpenTxns(walletAddress),
      getFaucetTxns(walletAddress, 20),
    ])
      .then(([open, faucet]) => {
        if (!active) return;
        setOpenTxns(open);
        setFaucetTxns(faucet);
        if (!Object.keys(open).length && positions.length)
          setHistoryError(
            "Opening logs were not returned. Saved city receipts and the vault explorer are still available.",
          );
      })
      .catch(() => {
        if (active)
          setHistoryError(
            "History RPC unavailable. Retry or use the vault explorer.",
          );
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [historyOpen, walletAddress, refresh, positions]);
  const transactions = transactionHistory([
    ...(city.agentReceipts ?? [])
      .filter(
        (receipt) =>
          !walletAddress ||
          receipt.owner.toLowerCase() === walletAddress.toLowerCase(),
      )
      .map((receipt): CityTransaction => ({
        hash: receipt.hash,
        kind: receipt.batch
          ? "agent-rebalance"
          : receipt.action === "buy"
            ? "agent-buy"
            : "agent-sell",
        tickers: [receipt.ticker],
        at: receipt.at,
        source: "city",
      })),
    ...stocks.flatMap((building): CityTransaction[] =>
      building.vaultTx
        ? [
            {
              hash: building.vaultTx,
              kind: "placement",
              tickers: [defFor(building.kind).ticker!],
              source: "city",
            },
          ]
        : [],
    ),
    ...positions.flatMap((position): CityTransaction[] =>
      openTxns[position.id.toLowerCase()]
        ? [
            {
              hash: openTxns[position.id.toLowerCase()],
              kind: "placement",
              tickers: [position.ticker],
              at: Number(position.openedAt) * 1000,
              source: "wallet",
            },
          ]
        : [],
    ),
    ...faucetTxns.map((hash): CityTransaction => ({
      hash,
      kind: "faucet",
      tickers: [],
      source: "wallet",
    })),
    ...(recentFaucet && recentFaucet.owner === walletAddress
      ? [
          {
            hash: recentFaucet.hash,
            kind: "faucet" as const,
            tickers: [],
            source: "wallet" as const,
          },
        ]
      : []),
  ]);
  async function transact(kind: "connect" | "faucet" | "batch") {
    if (operation) return;
    setOperation(kind);
    setError("");
    setStatus(
      kind === "connect"
        ? "Connect your wallet to BNB testnet."
        : "Preparing your wallet…",
    );
    try {
      const account = walletAddress ?? (await onConnectWallet?.());
      if (!account)
        throw new Error(
          "Connect a wallet using the wallet menu, then try again.",
        );
      if (kind === "faucet") {
        setStatus(
          "Approve the faucet claim in your wallet. Waiting for confirmation…",
        );
        const hash = await claimFaucetOnchain(account);
        setRecentFaucet({ owner: account, hash });
        setStatus(
          "10,000 testnet mUSD claimed. You can now confirm placed buildings.",
        );
        props.onClaimFaucet?.();
        setRefresh((val) => val + 1);
      } else if (kind === "batch") {
        const result = await recordBuildingsBatch(
          account,
          drafts.map((building) => ({
            buildingId: building.id,
            ticker: defFor(building.kind).ticker!,
            usdAmount: building.cost,
            entryPrice: building.entry,
            initialTier: 1,
          })),
          (step, hash) => {
            setStatus(
              step === "approve"
                ? hash
                  ? "Approval sent. Waiting for confirmation…"
                  : "Approve the mUSD allowance in your wallet…"
                : hash
                  ? "Batch sent. Waiting for BNB testnet confirmation…"
                  : "Confirm the batch purchase in your wallet…",
            );
          },
        );
        onConfirmBatch?.(
          drafts.map((building, index) => ({
            buildingId: building.id,
            hash: result.hash,
            vaultId: result.positionIds[index] ?? "",
          })),
        );
        setStatus(
          `${drafts.length} buildings confirmed. Find the batch receipt in transaction history below.`,
        );
        setHistoryOpen(true);
      } else setStatus("Wallet connected. Your wallet records are syncing.");
      setRefresh((value) => value + 1);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Wallet action failed. Your drafts are unchanged.",
      );
      setStatus("");
    } finally {
      setOperation(null);
    }
  }
  return (
    <>
      <div className={styles.intro}>
        <div>
          <h3>Your city, accounted for.</h3>
          <p>
            One place for invested holdings, pending buildings and testnet
            activity. Unpaid drafts are kept out of portfolio value.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {stocks.length > 0 && (
            <button
              className={styles.primary}
              onClick={() => {
                const topHolding = landscape.holdings[0];
                const target = topHolding
                  ? (stocks.find(
                      (stock) =>
                        defFor(stock.kind).ticker === topHolding.ticker,
                    ) ?? stocks[0])
                  : stocks[0];
                if (target) onFocus(target);
              }}
            >
              <ExternalLink size={15} /> Manage portfolio
            </button>
          )}
          <button
            className={styles.secondary}
            disabled={chainLoading || Boolean(operation)}
            onClick={() => setRefresh((value) => value + 1)}
          >
            <RefreshCw size={15} />{" "}
            {chainLoading ? "Syncing wallet…" : "Sync wallet"}
          </button>
        </div>
      </div>
      <div className={styles.summaryStrip}>
        <Metric
          label="Invested value"
          value={money(landscape.total)}
          detail={`${landscape.holdings.length} companies · saved city holdings`}
        />
        <Metric
          label="Unrealized P/L"
          value={`${localPnl >= 0 ? "+" : ""}${money(localPnl)}`}
          detail={
            landscape.basis
              ? `${pct((localPnl / landscape.basis) * 100)} on ${money(landscape.basis)} invested`
              : "No invested positions yet"
          }
          tone={localPnl < 0 ? "loss" : "gain"}
        />
        <Metric
          label="Available city cash"
          value={money(city.cash)}
          detail="Local treasury · separate from wallet mUSD"
          action={
            walletAddress ? (
              <button
                type="button"
                className={styles.miniBtn}
                title="Claim 10,000 $mUSD municipal faucet"
                onClick={() => void transact("faucet")}
                disabled={Boolean(operation)}
              >
                <Coins size={11} />
                Claim Faucet
              </button>
            ) : (
              <button
                type="button"
                className={styles.miniBtn}
                title="Connect wallet to claim faucet"
                onClick={() => void transact("connect")}
                disabled={Boolean(operation)}
              >
                <Wallet size={11} />
                Connect for Faucet
              </button>
            )
          }
        />
      </div>
      <div className={styles.hallGrid}>
        <section className={styles.section} aria-labelledby="city-holdings">
          <div className={styles.sectionHeading}>
            <h4 id="city-holdings">Your holdings</h4>
            <span>{landscape.holdings.length} assets</span>
          </div>
          {!landscape.holdings.length ? (
            <div className={styles.empty}>
              <h4>A city starts with its first company.</h4>
              <p>
                Buy a building from the left menu, place it on the island, then
                confirm it here.
              </p>
              <button className={styles.secondary} onClick={props.onClose}>
                Return to city <ArrowUpRight size={15} />
              </button>
            </div>
          ) : (
            <>
              <div className={styles.holdingLabels}>
                <span>Asset / record</span>
                <span>Value / P/L</span>
                <span>Actions</span>
              </div>
              {landscape.holdings.map((holding) => {
                const building = stocks.find(
                  (stock) => defFor(stock.kind).ticker === holding.ticker,
                );
                const asset = assets.find(
                  (item) => item.ticker === holding.ticker,
                );
                const matched = building?.vaultId
                  ? positions.find(
                      (position) =>
                        position.id.toLowerCase() ===
                        building.vaultId?.toLowerCase(),
                    )
                  : null;
                return (
                  <div key={holding.ticker} className={styles.holdingRow}>
                    <div className={styles.assetIdentity}>
                      <StockLogo
                        ticker={holding.ticker}
                        name={asset?.name ?? holding.ticker}
                        size={36}
                      />
                      <div>
                        <strong>{holding.ticker}</strong>
                        <small>
                          {holding.units.toLocaleString(undefined, {
                            maximumFractionDigits: 4,
                          })}{" "}
                          units · {holding.allocation.toFixed(1)}%
                        </small>
                        <small>
                          {matched
                            ? matched.active
                              ? "Wallet record matched"
                              : "Wallet record closed · city differs"
                            : building?.vaultTx
                              ? "Saved chain receipt · not wallet-verified"
                              : "Local city position"}
                        </small>
                      </div>
                    </div>
                    <div className={styles.numeric}>
                      <strong>{money(holding.value)}</strong>
                      <small
                        className={
                          holding.value < holding.basis
                            ? styles.loss
                            : styles.gain
                        }
                      >
                        {holding.value - holding.basis >= 0 ? "+" : ""}
                        {money(holding.value - holding.basis)}
                      </small>
                    </div>
                    <div className={styles.rowActions}>
                      {building ? (
                        <button
                          className={styles.secondary}
                          style={{
                            minHeight: "34px",
                            padding: "4px 10px",
                            fontSize: "12px",
                            whiteSpace: "nowrap",
                            gap: "6px",
                          }}
                          aria-label={`Manage ${holding.ticker} portfolio`}
                          onClick={() => onFocus(building)}
                        >
                          <Crosshair size={14} /> Manage
                        </button>
                      ) : (
                        <button
                          className={styles.textButton}
                          onClick={() => {
                            setSaleTicker(
                              saleTicker === holding.ticker
                                ? null
                                : holding.ticker,
                            );
                            setSaleMessage("");
                          }}
                        >
                          Sell
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {saleTicker && (
                <div className={styles.inlineForm}>
                  <h4>Manage {saleTicker} · local city position</h4>
                  <p>
                    This adjusts your saved city balance only. It does not sell
                    a token or close your wallet’s vault record.
                  </p>
                  <label className={styles.field}>
                    Portion to sell
                    <select
                      value={salePercent}
                      onChange={(event) =>
                        setSalePercent(Number(event.target.value))
                      }
                    >
                      {[25, 50, 75, 100].map((percent) => (
                        <option key={percent} value={percent}>
                          {percent}%
                          {percent === 100 ? " · remove entire holding" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className={styles.actions}>
                    {stocks.some(
                      (building) => defFor(building.kind).ticker === saleTicker,
                    ) && (
                      <button
                        className={styles.secondary}
                        onClick={() =>
                          setSaleMessage(onSell(saleTicker, salePercent / 100))
                        }
                      >
                        Sell {salePercent}% of building units
                      </button>
                    )}
                    {(city.paper ?? []).some(
                      (holding) => holding.ticker === saleTicker,
                    ) && (
                      <button
                        className={styles.secondary}
                        onClick={() =>
                          setSaleMessage(
                            onSellPaper(saleTicker, salePercent / 100),
                          )
                        }
                      >
                        Sell {salePercent}% of position-only units
                      </button>
                    )}
                    <button
                      className={styles.textButton}
                      onClick={() => setSaleTicker(null)}
                    >
                      Cancel
                    </button>
                  </div>
                  {saleMessage && <p role="status">{saleMessage}</p>}
                </div>
              )}
              <p className={styles.caption}>
                City quantities and P/L are local portfolio records. Wallet
                records are matched by position ID, not counted a second time.
              </p>
            </>
          )}
          {walletOnly.length > 0 && (
            <details className={styles.details}>
              <summary>
                <span>Wallet records not on this island</span>
                <span>
                  {walletOnly.length}
                  <ChevronDown size={16} />
                </span>
              </summary>
              <div className={styles.detailsBody}>
                <p>
                  These active vault positions belong to this wallet but have no
                  matching local building. They are excluded from city totals.
                </p>
                {walletOnly.map((position) => (
                  <div className={styles.simpleRow} key={position.id}>
                    <span>
                      <strong>{position.ticker}</strong>
                      <small>
                        Tier {position.buildingTier} ·{" "}
                        {Number(
                          formatUnits(position.quantity, 18),
                        ).toLocaleString(undefined, {
                          maximumFractionDigits: 4,
                        })}{" "}
                        units
                      </small>
                    </span>
                    <code>{position.id.slice(0, 10)}…</code>
                  </div>
                ))}
              </div>
            </details>
          )}
          {chainError && (
            <p className={styles.warning} role="status">
              {chainError}{" "}
              <button
                className={styles.textButton}
                onClick={() => setRefresh((value) => value + 1)}
              >
                Retry
              </button>
            </p>
          )}
        </section>
        <aside className={styles.treasury}>
          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <h4>Sector allocation</h4>
              <span>Invested value</span>
            </div>
            {sectors.length ? (
              <>
                {sectors.map((sector, index) => (
                  <div className={styles.allocation} key={sector.name}>
                    <div>
                      <span>{sector.name}</span>
                      <strong>
                        {((sector.value / landscape.total) * 100).toFixed(1)}%
                      </strong>
                    </div>
                    <div className={styles.bar}>
                      <span
                        style={{
                          width: `${(sector.value / landscape.total) * 100}%`,
                          opacity: 1 - Math.min(index, 4) * 0.1,
                        }}
                      />
                    </div>
                  </div>
                ))}
                <p className={styles.caption}>
                  Largest holding: {landscape.holdings[0]?.ticker} ·{" "}
                  {landscape.concentration.toFixed(1)}% of invested value.
                </p>
              </>
            ) : (
              <p className={styles.caption}>
                Allocation appears after your first confirmed investment.
              </p>
            )}
          </section>
          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <h4>Testnet treasury</h4>
              <span>Chain 97</span>
            </div>
            <p className={styles.caption}>
              {walletAddress
                ? `Wallet ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
                : "Connect a wallet to read positions and confirm buildings."}
            </p>
            <dl className={styles.facts}>
              <Fact label="Vault reserves">
                {stats
                  ? `${money(stats.vaultReserves)} mUSD`
                  : chainLoading
                    ? "Reading RPC…"
                    : "RPC unavailable"}
              </Fact>
              <Fact label="All vault positions">
                {stats ? stats.totalPositions.toLocaleString() : "—"}
              </Fact>
              <Fact label="Realized city P/L">
                {money(city.realizedPnl ?? 0)}
              </Fact>
            </dl>
            <div className={styles.actions}>
              {walletAddress ? (
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={Boolean(operation)}
                  aria-busy={operation === "faucet"}
                  onClick={() => void transact("faucet")}
                >
                  <Coins size={16} />
                  {operation === "faucet"
                    ? "Claiming 10,000 mUSD…"
                    : "Claim 10,000 mUSD"}
                </button>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    width: "100%",
                  }}
                >
                  <button
                    type="button"
                    className={styles.primary}
                    style={{ width: "100%" }}
                    disabled={Boolean(operation)}
                    onClick={() => void transact("connect")}
                  >
                    <Wallet size={15} />
                    Connect wallet to claim faucet
                  </button>
                  <span
                    style={{
                      fontSize: "0.76rem",
                      color: "#94a3b8",
                      textAlign: "center",
                    }}
                  >
                    Sign in with your wallet first to claim 10,000 $mUSD from
                    the municipal faucet.
                  </span>
                </div>
              )}
            </div>
            <p className={styles.caption}>
              Free test funds. Gas requires testnet BNB. mUSD is not redeemable
              money.
            </p>
            <div className={styles.sourceLinks}>
              <a
                href={bscAddressLink(VAULT_ADDRESS)}
                target="_blank"
                rel="noreferrer"
              >
                <Image
                  src="/bnb-logo.png"
                  alt="BNB"
                  width={14}
                  height={14}
                  style={{ flexShrink: 0 }}
                />
                Vault contract <ExternalLink size={13} />
              </a>
              <a
                href={bscAddressLink(MOCK_USD_ADDRESS)}
                target="_blank"
                rel="noreferrer"
              >
                <Image
                  src="/bnb-logo.png"
                  alt="BNB"
                  width={14}
                  height={14}
                  style={{ flexShrink: 0 }}
                />
                mUSD contract <ExternalLink size={13} />
              </a>
            </div>
          </section>
        </aside>
      </div>
      <section className={styles.confirmSection}>
        <div className={styles.sectionHeading}>
          <h4>Pending confirmation</h4>
          <span>
            {drafts.length} placed {drafts.length === 1 ? "draft" : "drafts"}
          </span>
        </div>
        {drafts.length ? (
          <>
            <p>
              These buildings are placed but unpaid. Confirm the batch to unlock
              them and include them in your portfolio.
            </p>
            <div className={styles.draftList}>
              {drafts.map((building) => (
                <button
                  disabled={Boolean(operation)}
                  className={styles.draft}
                  key={building.id}
                  onClick={() => onFocus(building)}
                >
                  <Image
                    src={sprite(defFor(building.kind).image)}
                    alt=""
                    width={48}
                    height={48}
                    sizes="48px"
                    quality={85}
                  />
                  <span>
                    <strong>{defFor(building.kind).ticker}</strong>
                    <small>{money(building.cost)} mUSD</small>
                  </span>
                  <MapPin size={14} />
                </button>
              ))}
            </div>
            <div className={styles.confirmBar}>
              <span>
                <strong>{money(totalDraft)} mUSD</strong>
                <small>
                  One batch transaction. An allowance approval may also be
                  needed.
                </small>
              </span>
              <button
                className={styles.primary}
                disabled={Boolean(operation) || !onConfirmBatch}
                aria-busy={operation === "batch"}
                onClick={() => void transact("batch")}
              >
                {operation === "batch"
                  ? "Confirming…"
                  : walletAddress
                    ? `Confirm ${drafts.length} buildings`
                    : "Connect & confirm batch"}
                <ArrowUpRight size={16} />
              </button>
            </div>
          </>
        ) : (
          <p>
            All placed buildings are accounted for. New stock drafts will appear
            here before payment.
          </p>
        )}
        {status && (
          <p className={styles.success} role="status">
            {status}
          </p>
        )}
        {error && (
          <p className={styles.warning} role="alert">
            {error}
          </p>
        )}
      </section>
      <details
        className={styles.details}
        open={historyOpen}
        onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
      >
        <summary>
          <span>
            Chain transaction history
            <small>
              Agent rebalances, placements and faucet claims · BNB testnet
            </small>
          </span>
          <span>
            {transactions.length}{" "}
            {transactions.length === 1 ? "receipt" : "receipts"}
            <ChevronDown size={18} />
          </span>
        </summary>
        <div className={styles.detailsBody}>
          <div className={styles.sectionHeading}>
            <p>One row per transaction, including multi-building batches.</p>
            <button
              className={styles.textButton}
              disabled={historyLoading}
              onClick={() => setRefresh((value) => value + 1)}
            >
              <RefreshCw size={14} />{" "}
              {historyLoading ? "Reading logs…" : "Refresh history"}
            </button>
          </div>
          {!transactions.length && (
            <div className={styles.empty}>
              <h4>
                {historyLoading
                  ? "Reading wallet activity…"
                  : "No receipts to show yet."}
              </h4>
              <p>
                {walletAddress
                  ? "Confirmed placements and faucet claims will appear here. If RPC logs are unavailable, use the vault explorer."
                  : "Saved city receipts appear here. Connect your wallet to include its on-chain activity."}
              </p>
            </div>
          )}
          {transactions.map((transaction) => (
            <div key={transaction.hash} className={styles.transaction}>
              <div>
                <strong>
                  {transaction.kind === "faucet"
                    ? "Faucet claim"
                    : transaction.kind === "agent-rebalance"
                      ? "Agent · city rebalance"
                      : transaction.kind === "agent-sell"
                        ? "Agent · building removed"
                        : transaction.kind === "agent-buy"
                          ? "Agent · building constructed"
                          : transaction.tickers.length > 1
                            ? "Building batch"
                            : "Building placement"}
                </strong>
                <small>
                  {transaction.tickers.join(" · ") || "Testnet mUSD"} ·{" "}
                  {transaction.source === "wallet"
                    ? "Wallet log"
                    : "Saved city receipt"}
                  {transaction.at
                    ? ` · ${stamp(new Date(transaction.at).toISOString())}`
                    : " · time not returned"}
                </small>
              </div>
              <a
                href={bscTxLink(transaction.hash)}
                target="_blank"
                rel="noreferrer"
              >
                <Image
                  src="/bnb-logo.png"
                  alt="BNB"
                  width={16}
                  height={16}
                  style={{ flexShrink: 0 }}
                />
                <code>
                  {transaction.hash.slice(0, 8)}…{transaction.hash.slice(-6)}
                </code>
                <ExternalLink size={14} />
                <span className={styles.srOnly}>View transaction</span>
              </a>
            </div>
          ))}
          {historyError && <p className={styles.warning}>{historyError}</p>}
          <p className={styles.caption}>
            Local receipts can belong to a previously connected wallet. Only
            “Wallet log” entries are matched to the current wallet. This view
            covers opening events and faucet claims; the explorer has the
            complete contract activity.
          </p>
          <a
            className={styles.textLink}
            href={`${bscAddressLink(VAULT_ADDRESS)}#events`}
            target="_blank"
            rel="noreferrer"
          >
            <Image
              src="/bnb-logo.png"
              alt="BNB"
              width={14}
              height={14}
              style={{ flexShrink: 0 }}
            />
            Open complete vault history <ExternalLink size={14} />
          </a>
        </div>
      </details>
      <p className={styles.caption}>
        Valuation uses the current quote feed, including explicitly labelled
        fallback prices when a provider is unavailable. Last feed refresh:{" "}
        {stamp(feed.fetchedAt)}.
      </p>
    </>
  );
}
function Metric({
  label,
  value,
  detail,
  tone,
  action,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "gain" | "loss";
  action?: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>{label}</span>
        {action}
      </div>
      <strong className={tone ? styles[tone] : ""}>{value}</strong>
      <small>{detail}</small>
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
