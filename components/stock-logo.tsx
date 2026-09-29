"use client";
import { useState, useId } from "react";
import styles from "./stock-logo.module.css";
import {
  stockLogoUrl,
  rwaLogoUrl,
  stockLogoApiUrl,
  rwaLogoApiUrl,
} from "../lib/city";

export type StockLogoProps = {
  ticker: string;
  name?: string;
  size?: number;
  shape?: "rounded" | "circle" | "square";
  type?: "stock" | "rwa";
  color?: string;
  className?: string;
  badge?: string;
};

export default function StockLogo({
  ticker,
  name,
  size = 32,
  shape = "rounded",
  type = "stock",
  color,
  className = "",
  badge,
}: StockLogoProps) {
  const [attempt, setAttempt] = useState(0);

  // Generate sequence of fallback sources
  const sources =
    type === "rwa"
      ? [
          rwaLogoUrl(ticker),
          rwaLogoApiUrl(ticker),
          stockLogoUrl(ticker),
          stockLogoApiUrl(ticker),
          `/api/stock-logo?ticker=${encodeURIComponent(ticker)}&type=rwa`,
        ]
      : [
          stockLogoUrl(ticker),
          stockLogoApiUrl(ticker),
          `/api/stock-logo?ticker=${encodeURIComponent(ticker)}&type=stock`,
        ];

  const hasImage = attempt < sources.length;
  const currentSrc = hasImage ? sources[attempt] : null;

  const handleImgError = () => {
    setAttempt((prev) => prev + 1);
  };

  return (
    <div
      className={`${styles.container} ${styles[shape]} ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        fontSize: `${size}px`,
      }}
      title={name ? `${name} (${ticker})` : ticker}
      aria-label={name ? `${name} logo` : `${ticker} logo`}
    >
      {currentSrc ? (
        <img
          src={currentSrc}
          alt={name ? `${name} logo` : `${ticker} logo`}
          className={styles.logoImg}
          onError={handleImgError}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span
          className={styles.fallbackBadge}
          style={{ background: color ?? "#1e293b" }}
        >
          {ticker.slice(0, 2).toUpperCase()}
        </span>
      )}
      {badge && <span className={styles.badgeChip}>{badge}</span>}
    </div>
  );
}
