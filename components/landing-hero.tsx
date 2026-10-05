"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import styles from "./landing-hero.module.css";

const WalletConnect = dynamic(() => import("./wallet-connect"), {
  ssr: false,
  loading: () => (
    <button
      className={styles.walletImgBtn}
      disabled
      aria-label="Loading wallet"
      title="Loading wallet"
    >
      <img
        src="/assets/connect-wallet.png"
        alt="Connect Wallet"
        className={styles.connectWalletImg}
      />
    </button>
  ),
});

export default function LandingHero({ appId }: { appId: string }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (preference.matches) {
        video.current?.pause();
      } else {
        void video.current?.play().catch(() => {});
      }
    };
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, []);

  return (
    <main className={styles.hero}>
      <video
        ref={video}
        className={styles.video}
        src="/assets/landing-page-video.mp4"
        poster="/assets/landing-poster.jpg"
        loop
        muted
        playsInline
        autoPlay
        preload="metadata"
        aria-hidden="true"
      />
      <div className={styles.shade} />

      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Stockva home">
          <img
            src="/assets/ai_logo.png"
            alt="Stockva logo"
            className={styles.brandLogo}
            width={40}
            height={40}
          />
          <span className={styles.brandText}>
            Stockva<span className={styles.brandDot}>.</span>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Main navigation">
          <Link
            href="/city"
            className={styles.exploreBtn}
            aria-label="Explore the city"
          >
            Explore the city{" "}
            <ArrowUpRight size={14} className={styles.exploreIcon} />
          </Link>
        </nav>

        <div className={styles.walletArea}>
          <WalletConnect />
        </div>
      </header>

      <section className={styles.content} aria-labelledby="hero-title">
        <h1 id="hero-title">
          BUILD THE CITY
          <br />
          <em>behind</em> YOUR <em>tokenized</em> STOCKS.
        </h1>
      </section>

      <aside className={styles.bottomLeft} aria-label="About Stockva">
        <p className={styles.description}>
          Turn real-world equities into a living, breathing metropolis. Lay
          roads, place company headquarters, and watch your island thrive.
        </p>
      </aside>
    </main>
  );
}
