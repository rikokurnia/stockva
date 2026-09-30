"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { bscTestnet } from "viem/chains";
import type { ReactNode } from "react";

const PRIVY_APP_ID =
  process.env.NEXT_PUBLIC_PRIVY_APP_ID ??
  process.env.PRIVY_APP_ID ??
  "cmul4xdgk00710ckz56rzh7zl";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#f0b90b",
          walletChainType: "ethereum-only",
          showWalletLoginFirst: true,
          logo: "/assets/ai_logo.png",
        },
        defaultChain: bscTestnet,
        supportedChains: [bscTestnet],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
