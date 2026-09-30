"use client";

import { useEffect, useState } from "react";
import { ExternalLink, LogOut, Check, Copy } from "lucide-react";
import {
  bscAddressLink,
  connectInjectedWallet,
  ensureBscTestnet,
  hasInjectedWallet,
} from "../lib/contracts";

type Props = {
  address: `0x${string}` | null;
  onChange: (address: `0x${string}` | null) => void;
};

export default function OnchainWallet({ address, onChange }: Props) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-detect existing connected account on mount
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum?.request) return;

    window.ethereum
      .request({ method: "eth_accounts" })
      .then((res: unknown) => {
        const accounts = res as string[];
        if (accounts && accounts.length > 0) {
          onChange(accounts[0] as `0x${string}`);
        }
      })
      .catch(() => {});

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (accs && accs.length > 0) {
        onChange(accs[0] as `0x${string}`);
      } else {
        onChange(null);
      }
    };

    const handleChainChanged = () => {
      // Reload on network switch or verify testnet
    };

    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    window.ethereum.on?.("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener?.(
        "accountsChanged",
        handleAccountsChanged,
      );
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [onChange]);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);
      const acc = await connectInjectedWallet();
      onChange(acc);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to connect wallet";
      setError(msg);
      setTimeout(() => setError(null), 4000);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    onChange(null);
    setMenuOpen(false);
  };

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shorten = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  if (!address) {
    return (
      <div className="onchain-wallet-wrapper">
        <button
          type="button"
          className="onchain-wallet-img-btn"
          onClick={handleConnect}
          disabled={connecting}
          title={error || "Connect MetaMask (BSC Testnet)"}
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
        title={`Connected: ${address} (BSC Testnet)`}
      >
        <span className="live-pulse-dot" />
        <span className="wallet-addr-text">{shorten(address)}</span>
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
              <strong className="wallet-full-addr">{shorten(address)}</strong>
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
              href={bscAddressLink(address)}
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
