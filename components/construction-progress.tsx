"use client";

import { useEffect, useRef, useState } from "react";
import { Line } from "rc-progress";
import confetti from "canvas-confetti";
import styles from "./construction-progress.module.css";

export type ConstructionState =
  "Drafting Site..." | "Constructing on BSC..." | "100% Completed!";

type Props = {
  buildingId: string;
  builtAt: number;
  durationMs?: number;
  isConfirmingOnchain?: boolean;
  isConfirmedOnchain?: boolean;
  onComplete?: (buildingId: string) => void;
};

/**
 * Fires block-confirmation celebration particles over the completed building
 */
export function fireCelebrationParticles(element: HTMLElement | null) {
  let origin = { x: 0.5, y: 0.5 };
  if (element && typeof window !== "undefined") {
    const rect = element.getBoundingClientRect();
    origin = {
      x: Math.min(
        0.95,
        Math.max(0.05, (rect.left + rect.width / 2) / window.innerWidth),
      ),
      y: Math.min(
        0.95,
        Math.max(0.05, (rect.top + rect.height / 2) / window.innerHeight),
      ),
    };
  }

  // 1. Primary gold & emerald BNB burst
  confetti({
    particleCount: 50,
    spread: 65,
    origin,
    colors: ["#f0b90b", "#fcd535", "#10b981", "#38bdf8", "#ffffff"],
    startVelocity: 24,
    ticks: 110,
    gravity: 0.92,
    scalar: 0.85,
    shapes: ["square", "circle"],
    disableForReducedMotion: true,
  });

  // 2. Secondary accent sparkles
  setTimeout(() => {
    confetti({
      particleCount: 22,
      spread: 80,
      origin: { x: origin.x, y: Math.max(0.05, origin.y - 0.02) },
      colors: ["#f0b90b", "#ffffff", "#34d399"],
      startVelocity: 18,
      ticks: 80,
      gravity: 0.85,
      scalar: 0.65,
      shapes: ["circle"],
      disableForReducedMotion: true,
    });
  }, 120);
}

/**
 * Smooth cubic easing curve: accelerates smoothly and eases into completion
 */
function easeProgress(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - clamped, 2.6);
}

export default function ConstructionProgressBar({
  buildingId,
  builtAt,
  durationMs = 7000,
  isConfirmingOnchain = false,
  isConfirmedOnchain = false,
  onComplete,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [percent, setPercent] = useState(0);
  const [fading, setFading] = useState(false);
  const [hidden, setHidden] = useState(false);
  const startTimeRef = useRef(builtAt || Date.now());
  const celebratedRef = useRef(false);

  useEffect(() => {
    startTimeRef.current = builtAt || Date.now();
  }, [builtAt]);

  useEffect(() => {
    let animId: number;

    const frame = () => {
      const now = Date.now();
      const elapsed = Math.max(0, now - startTimeRef.current);
      const rawRatio = elapsed / durationMs;
      let currentProgress = easeProgress(rawRatio);

      // If waiting on active on-chain transaction that hasn't confirmed yet, hold near 95%
      if (isConfirmingOnchain && !isConfirmedOnchain && rawRatio >= 0.95) {
        currentProgress = 0.95;
      }

      // If on-chain confirmed, advance to 100%
      if (isConfirmedOnchain) {
        currentProgress = 1.0;
      }

      const currentPercent = Math.min(
        100,
        Math.max(0, Math.round(currentProgress * 100)),
      );
      setPercent(currentPercent);

      if (currentPercent >= 100) {
        if (!celebratedRef.current) {
          celebratedRef.current = true;
          fireCelebrationParticles(containerRef.current);

          // Graceful fadeout after 1.5s celebration view
          setTimeout(() => setFading(true), 1500);
          setTimeout(() => {
            setHidden(true);
            onComplete?.(buildingId);
          }, 1850);
        }
        return;
      }

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [
    buildingId,
    durationMs,
    isConfirmingOnchain,
    isConfirmedOnchain,
    onComplete,
  ]);

  if (hidden) return null;

  // Determine state based on exact criteria
  let stateText: ConstructionState = "Drafting Site...";
  if (percent >= 100) {
    stateText = "100% Completed!";
  } else if (percent >= 35 || isConfirmingOnchain) {
    stateText = "Constructing on BSC...";
  }

  // Format: [████████░░] 78% · 7s
  const filledCount = Math.min(10, Math.max(0, Math.round(percent / 10)));
  const emptyCount = 10 - filledCount;
  const blockString = `[${"█".repeat(filledCount)}${"░".repeat(emptyCount)}]`;
  const formatString =
    percent >= 100
      ? `${blockString} 100% Completed!`
      : `${blockString} ${percent}% · 7s`;

  const isCompleted = percent >= 100;

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${isCompleted ? styles.containerCompleted : ""} ${
        fading ? styles.containerFading : ""
      }`}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${stateText} ${percent}%`}
    >
      <div className={styles.headerRow}>
        <div className={styles.stateWrap}>
          <span
            className={`${styles.dot} ${isCompleted ? styles.dotCompleted : ""}`}
            aria-hidden="true"
          />
          <span
            className={`${styles.stateText} ${
              isCompleted ? styles.stateTextCompleted : ""
            }`}
          >
            {stateText}
          </span>
        </div>
        <span className={styles.bscBadge}>BSC</span>
      </div>

      <div className={styles.barTrack}>
        <Line
          percent={percent}
          strokeWidth={6}
          strokeColor={isCompleted ? "#10b981" : "#f0b90b"}
          trailWidth={6}
          trailColor="rgba(255, 255, 255, 0.12)"
          strokeLinecap="square"
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      <div
        className={`${styles.formatRow} ${
          isCompleted ? styles.formatRowCompleted : ""
        }`}
      >
        <span>{formatString}</span>
      </div>
    </div>
  );
}
