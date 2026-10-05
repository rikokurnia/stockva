"use client";

import { useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import type { PendingDirectPurchase } from "../lib/rebalance-execution";
import { X, CheckCircle2, AlertCircle, Layers } from "lucide-react";
import type { Building, PriceMap } from "../lib/city";
import { defFor, money, sprite, wholeMoney } from "../lib/city";
import { recordBuildingsBatch } from "../lib/contracts";
import styles from "./bundle-modal.module.css";

type Props = {
  open: boolean;
  buildings: Building[];
  prices: PriceMap;
  walletAddress: `0x${string}` | null;
  onClose: () => void;
  onConnectWallet: () => Promise<`0x${string}`>;
  onConfirmSuccess: (
    receipts: { buildingId: string; hash: `0x${string}`; vaultId: string }[],
  ) => void;
  onStartConfirmation?: (buildingIds: string[]) => void;
  onFinishConfirmation?: (buildingIds: string[]) => void;
  transactionPending?: boolean;
  onPurchaseSubmitted?: (purchase: PendingDirectPurchase) => void;
};

export default function BundleModal({
  open,
  buildings,
  prices,
  walletAddress,
  onClose,
  onConnectWallet,
  onConfirmSuccess,
  onStartConfirmation,
  onFinishConfirmation,
  transactionPending,
  onPurchaseSubmitted,
}: Props) {
  const { wallets } = useWallets();
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open || !buildings.length) return null;

  const totalCost = buildings.reduce((sum, b) => sum + b.cost, 0);

  const handleConfirm = async () => {
    if (transactionPending) return;
    setErrorMsg(null);
    setSubmitting(true);
    setStatusMsg("Preparing batch transaction on BSC Testnet…");

    try {
      let account = walletAddress;
      if (!account) {
        setStatusMsg("Connecting Web3 wallet…");
        account = await onConnectWallet();
      }

      onStartConfirmation?.(buildings.map((b) => b.id));

      const batchItems = buildings.map((b) => ({
        buildingId: b.id,
        ticker: defFor(b.kind).ticker!,
        usdAmount: b.cost,
        entryPrice: b.entry,
        initialTier: 1,
      }));
      const connected = wallets.find((w) => w.address.toLowerCase() === account.toLowerCase());
      const provider = connected ? await connected.getEthereumProvider() : window.ethereum;

      const { hash, positionIds } = await recordBuildingsBatch(
        account,
        batchItems,
        (step, stepHash) => {
          if (step === "approve" && !stepHash) {
            setStatusMsg(
              "Confirm the $mUSD allowance approval in your wallet…",
            );
          } else if (step === "approve" && stepHash) {
            setStatusMsg(
              `Allowance approved. Now confirm all ${buildings.length} buildings in 1 signature…`,
            );
          } else if (step === "buy" && !stepHash) {
            setStatusMsg(
              `Confirm batch purchase popup — ${buildings.length} positions, 1 signature…`,
            );
          } else if (step === "buy" && stepHash) {
            onPurchaseSubmitted?.({ owner: account!, hash: stepHash, items: batchItems });
            setStatusMsg(
              "Transaction broadcast! Waiting for BSC block confirmation…",
            );
          }
        },
        provider,
      );

      const receipts = buildings.map((b, i) => ({
        buildingId: b.id,
        hash,
        vaultId: positionIds[i],
      }));

      onConfirmSuccess(receipts);
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Batch transaction failed or was rejected.";
      setErrorMsg(msg);
      setStatusMsg(null);
    } finally {
      onFinishConfirmation?.(buildings.map((b) => b.id));
      setSubmitting(false);
    }
  };

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bundle-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className={styles.modal}>
        <header className={styles.header}>
          <div className={styles.headerTitleWrap}>
            <Layers size={18} color="#f0b90b" />
            <h2 id="bundle-modal-title" className={styles.headerTitle}>
              Confirm Bundle Purchase
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={styles.badge}>BATCH PURCHASE</span>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              disabled={submitting}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div className={styles.body}>
          <p className={styles.subtitle}>
            All {buildings.length} buildings have been placed on your island.
            Sign once to mint and permanently unlock all positions on BNB Smart
            Chain.
          </p>

          <div className={styles.buildingList}>
            {buildings.map((b) => {
              const def = defFor(b.kind);
              return (
                <div key={b.id} className={styles.buildingItem}>
                  <div className={styles.buildingMeta}>
                    <img
                      className={styles.buildingSprite}
                      src={sprite(def.image)}
                      alt=""
                    />
                    <div className={styles.buildingInfo}>
                      <span className={styles.buildingName}>{def.name}</span>
                      <span className={styles.buildingTicker}>
                        {def.ticker} · {money(b.entry)} / share
                      </span>
                    </div>
                  </div>
                  <div className={styles.buildingAmount}>
                    <span className={styles.costVal}>{money(b.cost)}</span>
                    <span className={styles.sharesVal}>
                      {b.quantity.toFixed(2)} shares
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.summaryBox}>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>
                Total Bundle Investment:
              </span>
              <span className={styles.summaryTotal}>
                {money(totalCost)} mUSD
              </span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Settlement Network:</span>
              <span style={{ fontSize: 11, color: "#e7eef2" }}>
                BNB Smart Chain Testnet (97)
              </span>
            </div>
            <div className={styles.summaryHighlight}>
              <CheckCircle2 size={13} />
              <span>
                Zero redundant gas · Instant single-tx batch confirmation
              </span>
            </div>
          </div>

          {statusMsg && (
            <div className={styles.statusMessage}>
              <span className={styles.spinner} />
              <span>{statusMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className={styles.errorMessage}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={submitting}
          >
            Keep as Drafts
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={submitting || transactionPending}
          >
            {submitting ? (
              <>
                <span className={styles.spinner} />
                <span>Confirming…</span>
              </>
            ) : (
              <span>{transactionPending ? "Confirming submitted purchase" : "Confirm on BSC"}</span>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
