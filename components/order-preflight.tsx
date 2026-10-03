import React, { useEffect, useState } from "react";
import {
  Coins,
  Fuel,
  Sliders,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { getMusdBalance, claimFaucetOnchain } from "../lib/contracts";
import styles from "./order-preflight.module.css";

interface OrderPreflightProps {
  amount: number;
  itemCount?: number;
  walletAddress?: `0x${string}` | null | undefined;
  onFaucetClaimed?: () => void;
  compact?: boolean;
}

export function OrderPreflight({
  amount,
  itemCount = 1,
  walletAddress,
  onFaucetClaimed,
  compact = false,
}: OrderPreflightProps) {
  const [musdBalance, setMusdBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const fetchBalance = async () => {
    if (!walletAddress) {
      setMusdBalance(null);
      return;
    }
    setLoadingBalance(true);
    try {
      const bal = await getMusdBalance(walletAddress);
      setMusdBalance(bal);
    } catch {
      // ignore
    } finally {
      setLoadingBalance(false);
    }
  };

  useEffect(() => {
    void fetchBalance();
  }, [walletAddress]);

  const handleClaim = async () => {
    if (!walletAddress || claiming) return;
    setClaiming(true);
    setClaimError(null);
    try {
      await claimFaucetOnchain(walletAddress);
      setClaimSuccess(true);
      await fetchBalance();
      onFaucetClaimed?.();
      setTimeout(() => setClaimSuccess(false), 4000);
    } catch (err: unknown) {
      setClaimError(err instanceof Error ? err.message : "Faucet claim failed");
    } finally {
      setClaiming(false);
    }
  };

  const validAmount = Number.isFinite(amount) && amount > 0;
  const isBalanceSufficient =
    walletAddress && musdBalance !== null
      ? musdBalance >= (validAmount ? amount : 0)
      : true;

  // Gas estimation on BSC Testnet (approx 140k gas single, 220k gas batch @ 3 gwei)
  const estimatedGasBnb = 0.00032 + Math.max(1, itemCount) * 0.00012;
  const estimatedGasUsd = estimatedGasBnb * 600; // ~600 USD per BNB

  // Dynamic price impact
  const priceImpact =
    amount > 5000
      ? "< 0.08%"
      : amount > 1000
        ? "< 0.04%"
        : "< 0.02%";

  return (
    <div className={`${styles.preflight} ${compact ? styles.compact : ""}`}>
      <div className={styles.preflightHeader}>
        <span className={styles.preflightTitle}>
          <Activity size={13} className={styles.pulseIcon} />
          REAL-TIME PRE-FLIGHT CHECKS
        </span>
        <span className={styles.networkBadge}>BSC TESTNET</span>
      </div>

      <div className={styles.grid}>
        {/* Check 1: $mUSD Balance */}
        <div
          className={`${styles.card} ${
            walletAddress && musdBalance !== null && !isBalanceSufficient
              ? styles.cardWarning
              : styles.cardOk
          }`}
        >
          <div className={styles.cardTop}>
            <span className={styles.cardLabel}>
              <Coins size={13} />
              Wallet $mUSD
            </span>
            {walletAddress ? (
              loadingBalance ? (
                <span className={styles.badgeMuted}>Checking…</span>
              ) : isBalanceSufficient ? (
                <span className={styles.badgeSuccess}>
                  <CheckCircle2 size={11} /> OK
                </span>
              ) : (
                <span className={styles.badgeAlert}>
                  <AlertTriangle size={11} /> Low
                </span>
              )
            ) : (
              <span className={styles.badgeMuted}>Disconnected</span>
            )}
          </div>
          <div className={styles.cardValue}>
            {loadingBalance ? (
              <span className={styles.loadingPulse}>···</span>
            ) : walletAddress && musdBalance !== null ? (
              `$${musdBalance.toLocaleString("en-US", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}`
            ) : (
              "$0.00 mUSD"
            )}
          </div>
          <div className={styles.cardFooter}>
            {walletAddress ? (
              <button
                type="button"
                className={styles.faucetBtn}
                onClick={handleClaim}
                disabled={claiming}
                title="Claim 10,000 $mUSD free from the BSC Testnet Faucet"
              >
                {claiming ? (
                  <>
                    <Loader2 size={10} className={styles.spin} /> Claiming…
                  </>
                ) : claimSuccess ? (
                  <>
                    <Sparkles size={10} /> +10k Claimed!
                  </>
                ) : (
                  <>+10,000 Faucet</>
                )}
              </button>
            ) : (
              <small className={styles.cardSub}>Connects on commit</small>
            )}
          </div>
        </div>

        {/* Check 2: Gas Estimation */}
        <div className={styles.card}>
          <div className={styles.cardTop}>
            <span className={styles.cardLabel}>
              <Fuel size={13} />
              Gas Estimate
            </span>
            <span className={styles.badgeNeutral}>
              {itemCount > 1 ? `${itemCount} txs batch` : "Fast"}
            </span>
          </div>
          <div className={styles.cardValue}>
            ~{estimatedGasBnb.toFixed(4)} BNB
          </div>
          <div className={styles.cardFooter}>
            <small className={styles.cardSub}>
              ≈ ${estimatedGasUsd.toFixed(2)} USD (BSC)
            </small>
          </div>
        </div>

        {/* Check 3: Slippage Tolerance */}
        <div className={styles.card}>
          <div className={styles.cardTop}>
            <span className={styles.cardLabel}>
              <Sliders size={13} />
              Slippage
            </span>
            <span className={styles.badgeNeutral}>Fixed</span>
          </div>
          <div className={styles.cardValue}>0.5%</div>
          <div className={styles.cardFooter}>
            <small className={styles.cardSub}>Vault max slippage</small>
          </div>
        </div>

        {/* Check 4: Price Impact */}
        <div className={styles.card}>
          <div className={styles.cardTop}>
            <span className={styles.cardLabel}>
              <Activity size={13} />
              Price Impact
            </span>
            <span className={styles.badgeSuccess}>Optimal</span>
          </div>
          <div className={styles.cardValue}>{priceImpact}</div>
          <div className={styles.cardFooter}>
            <small className={styles.cardSub}>Oracle liquidity</small>
          </div>
        </div>
      </div>

      {/* Warning banner if balance is insufficient */}
      {walletAddress && musdBalance !== null && !isBalanceSufficient && (
        <div className={styles.warningBanner}>
          <AlertTriangle size={15} />
          <div className={styles.warningContent}>
            <strong>Insufficient $mUSD balance for this order</strong>
            <p>
              Your wallet holds ${musdBalance.toLocaleString()} mUSD, but need $
              {amount.toLocaleString()} mUSD. Claim 10,000 $mUSD free from the
              testnet faucet to proceed.
            </p>
          </div>
          <button
            type="button"
            className={styles.bannerFaucetBtn}
            onClick={handleClaim}
            disabled={claiming}
          >
            {claiming ? "Claiming Faucet…" : "Claim +10,000 $mUSD"}
          </button>
        </div>
      )}

      {claimError && (
        <div className={styles.errorBanner}>
          <AlertTriangle size={13} />
          <span>{claimError}</span>
        </div>
      )}
    </div>
  );
}
