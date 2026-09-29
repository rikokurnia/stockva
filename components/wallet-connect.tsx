"use client";

import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { LogOut, Wallet } from "lucide-react";
import styles from "./landing-hero.module.css";

function ConnectButton() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const address = user?.wallet?.address;
  const label = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : "Connected";
  return (
    <button
      className={styles.wallet}
      disabled={!ready}
      onClick={() =>
        authenticated ? void logout() : login({ loginMethods: ["wallet"] })
      }
      aria-label={
        authenticated ? `Disconnect wallet ${label}` : "Connect wallet"
      }
      title={authenticated ? "Disconnect wallet" : "Connect with Privy"}
    >
      {authenticated ? <LogOut size={15} /> : <Wallet size={15} />}
      {authenticated ? label : "Connect wallet"}
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
