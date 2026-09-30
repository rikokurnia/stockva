"use client";

import { useEffect, useState } from "react";
import { getAddress } from "viem";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ExternalLink, LogOut, Check, Copy } from "lucide-react";
import {
  bscAddressLink,
  connectInjectedWallet,
  hasInjectedWallet,
} from "../lib/contracts";

type Props = {
  address: `0x${string}` | null;
  onChange: (address: `0x${string}` | null) => void;
};

export default function OnchainWallet({ address, onChange }: Props) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync Privy connected wallet address into dashboard state
  useEffect(() => {
    if (!ready) return;

    const rawAddr = user?.wallet?.address || wallets?.[0]?.address;
    if (authenticated && rawAddr) {
      try {
        const formatted = getAddress(rawAddr);
        onChange(formatted);
        if (typeof window !== "undefined") {
          localStorage.setItem("stockcity_connected_wallet", formatted);
        }
      } catch {
        onChange(rawAddr as `0x${string}`);
      }
    } else if (!authenticated && !hasInjectedWallet()) {
      onChange(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("stockcity_connected_wallet");
      }
    }
  }, [ready, authenticated, user?.wallet?.address, wallets, onChange]);

  // Fallback: auto-detect injected wallet if Privy is not yet connected but user has active injected account
  useEffect(() => {
    if (authenticated || typeof window === "undefined" || !window.ethereum?.request) return;

    const saved = localStorage.getItem("stockcity_connected_wallet");
    if (saved && saved.startsWith("0x")) {
      try {
        onChange(getAddress(saved) as `0x${string}`);
      } catch {}
    }

    window.ethereum
      .request({ method: "eth_accounts" })
      .then((res: unknown) => {
        const accounts = res as string[];
        if (accounts && accounts.length > 0 && accounts[0]) {
          try {
            const formatted = getAddress(accounts[0]);
            onChange(formatted);
            localStorage.setItem("stockcity_connected_wallet", formatted);
          } catch {
            onChange(accounts[0] as `0x${string}`);
          }
        }
      })
      .catch(() => {});

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (accs && accs.length > 0 && accs[0]) {
        try {
          const formatted = getAddress(accs[0]);
          onChange(formatted);
          localStorage.setItem("stockcity_connected_wallet", formatted);
        } catch {
          onChange(accs[0] as `0x${string}`);
        }
      } else {
        onChange(null);
        localStorage.removeItem("stockcity_connected_wallet");
      }
    };

    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, [authenticated, onChange]);

  const activeAddress =
    address ||
    (user?.wallet?.address
      ? (() => {
          try {
            return getAddress(user.wallet.address);
          } catch {
            return user.wallet.address as `0x${string}`;
          }
        })()
      : null);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);
      // Trigger Privy wallet connection modal
      login({ loginMethods: ["wallet"] });
    } catch (err: unknown) {
      // Fallback to direct injected wallet if Privy login throws
      try {
        const acc = await connectInjectedWallet();
        const formatted = getAddress(acc);
        onChange(formatted);
        if (typeof window !== "undefined") {
          localStorage.setItem("stockcity_connected_wallet", formatted);
        }
      } catch (injectedErr: unknown) {
        const msg =
          injectedErr instanceof Error
            ? injectedErr.message
            : "Failed to connect wallet";
        setError(msg);
        setTimeout(() => setError(null), 4000);
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      if (authenticated) {
        await logout();
      }
    } catch {
      // ignore
    }
    onChange(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("stockcity_connected_wallet");
    }
    setMenuOpen(false);
  };

  const copyAddress = () => {
    if (!activeAddress) return;
    navigator.clipboard.writeText(activeAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shorten = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  if (!activeAddress) {
    return (
      <div className="onchain-wallet-wrapper">
        <button
          type="button"
          className="onchain-wallet-img-btn"
          onClick={handleConnect}
          disabled={connecting || !ready}
          title={error || "Connect Wallet (Privy / BSC Testnet)"}
          aria-label={connecting ? "Connecting wallet…" : "Connect Wallet"}
        >
          <img
            src="/assets/connect-wallet.png"
            alt="Connect Wallet"
            className="onchain-wallet-img"
          />
        </button>
        {error && <div className="onchain-wallet-tooltip">{error}</div>}
      </div>
    );
  }

  return (
    <div className="onchain-wallet-wrapper">
      <button
        type="button"
        className="onchain-wallet-btn connected-btn"
        onClick={() => setMenuOpen((v) => !v)}
        title={`Connected Address: ${activeAddress} (BSC Testnet)`}
      >
        <span className="live-pulse-dot" />
        <span className="wallet-addr-text">{shorten(activeAddress)}</span>
      </button>

      {menuOpen && (
        <>
          <div
            className="onchain-wallet-backdrop"
            onClick={() => setMenuOpen(false)}
          />
          <div className="onchain-wallet-menu">
            <div className="wallet-menu-header">
              <span className="wallet-badge">BSC Testnet (97)</span>
              <span className="wallet-user-label">Connected Address:</span>
              <strong className="wallet-full-addr" title={activeAddress}>
                {shorten(activeAddress)}
              </strong>
              <small className="wallet-raw-addr">{activeAddress}</small>
            </div>

            <button
              type="button"
              className="wallet-menu-item"
              onClick={copyAddress}
            >
              {copied ? (
                <Check size={13} color="#22c55e" />
              ) : (
                <Copy size={13} />
              )}
              <span>{copied ? "Copied!" : "Copy Address"}</span>
            </button>

            <a
              href={bscAddressLink(activeAddress)}
              target="_blank"
              rel="noreferrer"
              className="wallet-menu-item"
              onClick={() => setMenuOpen(false)}
            >
              <ExternalLink size={13} />
              <span>View on BscScan</span>
            </a>

            <button
              type="button"
              className="wallet-menu-item danger"
              onClick={handleDisconnect}
            >
              <LogOut size={13} />
              <span>Disconnect</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
