"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { getAddress } from "viem";
import { LogOut } from "lucide-react";
import styles from "./landing-hero.module.css";

export default function WalletConnect({ appId }: { appId?: string }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();

  const rawAddress = user?.wallet?.address || wallets?.[0]?.address;
  let formatted = rawAddress;
  if (rawAddress) {
    try {
      formatted = getAddress(rawAddress);
    } catch {
      formatted = rawAddress;
    }
  }

  const label = formatted
    ? `${formatted.slice(0, 6)}…${formatted.slice(-4)}`
    : "Connected";

  if (authenticated && formatted) {
    return (
      <button
        className={styles.wallet}
        disabled={!ready}
        onClick={() => logout()}
        aria-label={`Disconnect wallet ${label}`}
        title={`Connected: ${formatted} · Click to disconnect`}
      >
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#22c55e",
            boxShadow: "0 0 8px #22c55e",
            marginRight: 2,
          }}
        />
        <LogOut size={14} />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <button
      className={styles.walletImgBtn}
      disabled={!ready}
      onClick={() => login({ loginMethods: ["wallet"] })}
      aria-label="Connect wallet"
      title="Connect with Privy"
    >
      <img
        src="/assets/connect-wallet.png"
        alt="Connect Wallet"
        className={styles.connectWalletImg}
      />
    </button>
  );
}
