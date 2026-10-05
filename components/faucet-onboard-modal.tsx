"use client";

import { useEffect, useState, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { getAddress } from "viem";
import confetti from "canvas-confetti";
import {
  Coins,
  Wallet,
  Check,
  Lock,
  Sparkles,
  X,
  ExternalLink,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import {
  claimFaucetOnchain,
  connectInjectedWallet,
  bscAddressLink,
  BSC_EXPLORER_URL,
} from "../lib/contracts";
import { money } from "../lib/city";
import styles from "./faucet-onboard-modal.module.css";

interface FaucetOnboardModalProps {
  open: boolean;
  onClose: () => void;
  walletAddress: `0x${string}` | null;
  onWalletConnected: (address: `0x${string}`) => void;
  onClaimSuccess: (amount: number, hash?: string) => void;
  currentCash: number;
}

export default function FaucetOnboardModal({
  open,
  onClose,
  walletAddress,
  onWalletConnected,
  onClaimSuccess,
  currentCash,
}: FaucetOnboardModalProps) {
  const { ready, authenticated, user, login } = usePrivy();
  const { wallets } = useWallets();

  const [connecting, setConnecting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimStatus, setClaimStatus] = useState<string>("");
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync Privy wallet if authenticated
  useEffect(() => {
    if (!ready) return;
    const rawAddr = user?.wallet?.address || wallets?.[0]?.address;
    if (authenticated && rawAddr) {
      try {
        const formatted = getAddress(rawAddr);
        onWalletConnected(formatted);
      } catch {
        onWalletConnected(rawAddr as `0x${string}`);
      }
    }
  }, [ready, authenticated, user?.wallet?.address, wallets, onWalletConnected]);

  // Handle escape key
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const activeWallet =
    walletAddress ||
    (authenticated &&
      ((user?.wallet?.address || wallets?.[0]?.address) as `0x${string}`));

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          const acc = await connectInjectedWallet();
          if (acc) {
            onWalletConnected(acc);
            setConnecting(false);
            return;
          }
        } catch {
          // fallback to Privy login below
        }
      }
      if (login) {
        login({ loginMethods: ["wallet"] });
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to connect wallet";
      setError(msg);
    } finally {
      setConnecting(false);
    }
  };

  const fireSuccessConfetti = useCallback(() => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#f0b90b", "#10b981", "#3b82f6", "#ffffff"],
      });
    } catch {
      // ignore
    }
  }, []);

  const handleClaim = async () => {
    if (!activeWallet) {
      setError("Please sign in with your wallet first before claiming.");
      return;
    }

    setClaiming(true);
    setError(null);
    setClaimStatus("Preparing faucet claim transaction on BSC Testnet…");

    try {
      setClaimStatus("Please confirm the faucet transaction in your wallet…");
      const hash = await claimFaucetOnchain(activeWallet);
      setClaimTxHash(hash);
      setClaimed(true);
      setClaimStatus("10,000 $mUSD successfully claimed!");
      fireSuccessConfetti();
      onClaimSuccess(10000, hash);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("User rejected") || msg.includes("denied")) {
        setError("Transaction cancelled in wallet.");
        setClaimStatus("");
      } else if (msg.includes("cooldown")) {
        setError(
          "Faucet cooldown active on-chain. Faucet can be claimed once per cooldown period.",
        );
        setClaimStatus("");
      } else {
        // In testnet sandbox mode, if RPC timeout or tBNB gas is missing:
        // We still strictly require connected wallet, but can credit treasury with note
        setError(`On-chain transaction notice: ${msg.slice(0, 120)}`);
        setClaimStatus("");
      }
    } finally {
      setClaiming(false);
    }
  };

  const handleSandboxFallback = () => {
    if (!activeWallet) {
      setError("Wallet sign-in required to claim faucet funds.");
      return;
    }
    setClaimed(true);
    setClaimStatus("10,000 $mUSD granted to City Treasury!");
    fireSuccessConfetti();
    onClaimSuccess(10000);
  };

  if (!open) return null;

  const shorten = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboard-modal-title"
      >
        <button
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close onboarding modal"
        >
          <X size={18} />
        </button>

        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <Coins size={28} />
          </div>
          <div className={styles.titleArea}>
            <h2 id="onboard-modal-title">
              City Treasury Onboarding
              <span className={styles.badgeTag}>BSC Testnet</span>
            </h2>
            <p className={styles.subtitle}>
              Starting funds begin at $0. Connect your Web3 wallet to claim the
              10,000 $mUSD municipal faucet.
            </p>
          </div>
        </div>

        <div className={styles.treasuryCard}>
          <div>
            <span className={styles.treasuryLabel}>
              Current Treasury Balance
            </span>
            <div className={styles.treasuryAmount}>{money(currentCash)}</div>
          </div>
          <span
            className={`${styles.statusPill} ${
              currentCash > 0 ? styles.connected : styles.ready
            }`}
          >
            {currentCash > 0 ? "✓ Funded" : "Empty Treasury ($0)"}
          </span>
        </div>

        <div className={styles.stepsContainer}>
          {/* Step 1: Sign in with Wallet */}
          <div
            className={`${styles.stepCard} ${
              activeWallet ? styles.completed : styles.active
            }`}
          >
            <div className={styles.stepHeader}>
              <span className={styles.stepTitle}>
                <span className={styles.stepNum}>
                  {activeWallet ? <Check size={14} /> : "1"}
                </span>
                Sign in with Wallet
              </span>
              <span
                className={`${styles.statusPill} ${
                  activeWallet ? styles.connected : styles.unconnected
                }`}
              >
                {activeWallet
                  ? `Connected (${shorten(activeWallet)})`
                  : "Not Signed In"}
              </span>
            </div>
            <p className={styles.stepDesc}>
              Connect with MetaMask, Binance Web3 Wallet, Coinbase, or any EVM
              wallet.
            </p>
            {!activeWallet ? (
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={handleConnect}
                disabled={connecting}
              >
                <Wallet size={16} />
                {connecting ? "Connecting Wallet…" : "Connect Wallet to Begin"}
              </button>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.82rem",
                  color: "#4ade80",
                }}
              >
                <Check size={15} />
                <span>Identity verified: {shorten(activeWallet)}</span>
              </div>
            )}
          </div>

          {/* Step 2: Claim Municipal Faucet */}
          <div
            className={`${styles.stepCard} ${
              !activeWallet
                ? styles.locked
                : claimed || currentCash >= 10000
                  ? styles.completed
                  : styles.active
            }`}
          >
            <div className={styles.stepHeader}>
              <span className={styles.stepTitle}>
                <span className={styles.stepNum}>
                  {claimed || currentCash >= 10000 ? <Check size={14} /> : "2"}
                </span>
                Claim 10,000 $mUSD Faucet
              </span>
              <span
                className={`${styles.statusPill} ${
                  !activeWallet
                    ? styles.locked
                    : claimed || currentCash >= 10000
                      ? styles.connected
                      : styles.ready
                }`}
              >
                {!activeWallet ? (
                  <>
                    <Lock size={12} /> Wallet Required
                  </>
                ) : claimed || currentCash >= 10000 ? (
                  "✓ 10,000 $mUSD Claimed"
                ) : (
                  "Ready to Claim"
                )}
              </span>
            </div>
            <p className={styles.stepDesc}>
              Mints 10,000 testnet USD ($mUSD) on BNB Smart Chain to fund road
              construction and initial stock investments.
            </p>

            {claimed || currentCash >= 10000 ? (
              <div className={styles.successCard}>
                <div className={styles.successHeader}>
                  <Sparkles size={18} />
                  <span>Treasury Successfully Funded with +$10,000 USD!</span>
                </div>
                {claimTxHash && (
                  <a
                    href={`${BSC_EXPLORER_URL}/tx/${claimTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.txLink}
                  >
                    <span>
                      View transaction on BscScan: {shorten(claimTxHash)}
                    </span>
                    <ExternalLink size={12} />
                  </a>
                )}
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={onClose}
                >
                  Start Building My City <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={!activeWallet || claiming}
                  onClick={handleClaim}
                  title={
                    !activeWallet
                      ? "Connect your wallet first"
                      : "Claim 10,000 $mUSD"
                  }
                >
                  {claiming ? (
                    <>
                      <span className={styles.spinner} />
                      {claimStatus || "Submitting to BSC Testnet…"}
                    </>
                  ) : !activeWallet ? (
                    <>
                      <Lock size={15} /> Sign In Wallet First to Claim
                    </>
                  ) : (
                    <>
                      <Coins size={16} /> Claim 10,000 $mUSD Faucet
                    </>
                  )}
                </button>

                {error && (
                  <div style={{ marginTop: "10px" }}>
                    <div className={styles.errorBanner}>
                      <AlertCircle size={16} style={{ flexShrink: 0 }} />
                      <span>{error}</span>
                    </div>
                    {activeWallet && !claimed && (
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        style={{ marginTop: "8px" }}
                        onClick={handleSandboxFallback}
                      >
                        Credit 10,000 $mUSD to Local Treasury
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <p className={styles.footerNote}>
            BNB Smart Chain Testnet · MockUSD Token Contract
          </p>
          <button type="button" className={styles.dismissBtn} onClick={onClose}>
            Explore island first
          </button>
        </div>
      </div>
    </div>
  );
}
