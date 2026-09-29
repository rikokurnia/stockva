"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Pause, Play, Wallet } from "lucide-react";
import styles from "./landing-hero.module.css";

const WalletConnect = dynamic(() => import("./wallet-connect"), {
  ssr: false,
  loading: () => (
    <button className={styles.wallet} disabled>
      <Wallet size={15} /> Connect wallet
    </button>
  ),
});

export default function LandingHero({ appId }: { appId: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (preference.matches) video.current?.pause();
      else void video.current?.play().catch(() => setPlaying(false));
    };
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, []);

  function toggleVideo() {
    if (video.current?.paused)
      void video.current.play().catch(() => setPlaying(false));
    else video.current?.pause();
  }

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
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        aria-hidden="true"
      />
      <div className={styles.shade} />
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Stockva home">
          stockva<span className={styles.brandDot}>.</span>
        </Link>
        <nav className={styles.nav} aria-label="Main navigation">
          <Link href="/city">
            Explore the city <ArrowUpRight size={13} />
          </Link>
        </nav>
        <div className={styles.walletArea}>
          {appId ? (
            <WalletConnect appId={appId} />
          ) : (
            <button
              className={styles.wallet}
              disabled
              title="Wallet connection is not configured"
            >
              <Wallet size={15} /> Wallet unavailable
            </button>
          )}
        </div>
      </header>

      <section className={styles.content} aria-labelledby="hero-title">
        <h1 id="hero-title">
          BUILD THE CITY
          <br />
          <em>behind</em> YOUR STOCKS.
        </h1>
        <p className={styles.description}>
          Build roads. Place the companies you follow.
        </p>
        <Link href="/city" className={styles.primary}>
          Enter Stockva <ArrowRight size={17} />
        </Link>
      </section>

      <footer className={styles.footer}>
        <span>STOCKVA · CITY-BUILDING PORTFOLIO DEMO</span>
        <div className={styles.footerRight}>
          <span className={styles.demoLabel}>Simulated holdings</span>
          <button
            className={styles.videoControl}
            onClick={toggleVideo}
            aria-label={
              playing ? "Pause background video" : "Play background video"
            }
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
        </div>
      </footer>
    </main>
  );
}
