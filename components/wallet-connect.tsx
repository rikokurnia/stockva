"use client";

import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { LogOut } from "lucide-react";
import styles from "./landing-hero.module.css";
function ConnectButton() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const address = user?.wallet?.address;
  const label = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : "Connected";

  if (authenticated) {
    return (
      <button
        className={styles.wallet}
        disabled={!ready}
        onClick={() => logout()}
        aria-label={`Disconnect wallet ${label}`}
        title="Disconnect wallet"
      >
        <LogOut size={15} />
        {label}
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

export default function WalletConnect({ appId }: { appId: string }) {
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["wallet"],
        appearance: {
          theme: "light",
          accentColor: "#315747",
          walletChainType: "ethereum-only",
        },
      }}
    >
      <ConnectButton />
    </PrivyProvider>
  );
}
