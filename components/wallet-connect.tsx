"use client";

import { useEffect } from "react";
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (authenticated && formatted) {
      localStorage.setItem("stockcity_connected_wallet", formatted);
    } else if (ready && !authenticated) {
      localStorage.removeItem("stockcity_connected_wallet");
    }
  }, [ready, authenticated, formatted]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("stockcity_connected_wallet");
    }
  };

  if (authenticated && formatted) {
    return (
      <button
        className={styles.wallet}
        disabled={!ready}
        onClick={handleLogout}
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
