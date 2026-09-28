"use client";
import { useMemo } from "react";
import {
  buildingImage,
  defFor,
  point,
  returnOf,
  sprite,
  tier,
  type Building,
  type PriceMap,
} from "../lib/city";
import {
  layoutPortfolioLabels,
  portfolioLevel,
  portfolioPercent,
} from "../lib/portfolio-view";
import styles from "./portfolio-view.module.css";
export default function PortfolioOverlay({
  buildings,
  prices,
}: {
  buildings: Building[];
  prices: PriceMap;
}) {
  const labels = useMemo(
    () =>
      layoutPortfolioLabels(
        buildings
          .filter((b) => !!defFor(b.kind).ticker)
          .map((b) => ({ id: b.id, ...point(b.r + 0.5, b.c + 0.5) })),
      ),
    [buildings],
  );
  const byId = new Map(buildings.map((b) => [b.id, b]));
  return (
    <div
      className={styles.overlay}
      data-testid="portfolio-overlay"
      aria-label="Portfolio holdings on the island"
    >
      <svg
        className={styles.connections}
        viewBox="0 0 1280 720"
        aria-hidden="true"
      >
        {buildings.map((b) => {
          const p = point(b.r + 0.5, b.c + 0.5);
          return (
            <path
              key={b.id}
              className={styles.footprint}
              d={`M${p.x},${p.y - 36}l64,36 -64,36 -64,-36Z`}
            />
          );
        })}
        {labels.map((p) => (
          <g key={p.id}>
            <path
              className={styles.leader}
              d={`M${p.left + 62},${p.top + 30} L${p.x},${p.y}`}
            />
            <circle cx={p.x} cy={p.y} r="3" className={styles.pin} />
          </g>
        ))}
      </svg>
      {buildings.map((b) => {
        const p = point(b.r + 0.5, b.c + 0.5),
          company = !!defFor(b.kind).ticker;
        return (
          <div
            key={b.id}
            className={`city-building ${company ? "company" : "service"} ${styles.shadow}`}
            style={{ left: p.x, top: p.y + 36 }}
            aria-hidden="true"
          >
            <img
              className="building-sprite"
              src={sprite(buildingImage(b, prices))}
              alt=""
              draggable={false}
            />
          </div>
        );
      })}
      {labels.map((p) => {
        const b = byId.get(p.id)!,
          def = defFor(b.kind),
          gain = returnOf(b, prices),
          level = portfolioLevel(tier(gain));
        return (
          <article
            key={b.id}
            className={styles.plaque}
            style={{ left: p.left, top: p.top }}
            aria-label={`${def.name}, ${portfolioPercent(gain)} unrealized return, Level ${level}`}
            data-building-id={b.id}
          >
            <h3>{def.name}</h3>
            <div className={styles.stats}>
              <strong
                className={
                  gain < -0.05
                    ? styles.loss
                    : gain >= 0.05
                      ? styles.gain
                      : styles.flat
                }
              >
                {portfolioPercent(gain)}
              </strong>
              <span>Level {level}</span>
            </div>
            <div className={styles.level} aria-hidden="true">
              {[1, 2, 3].map((n) => (
                <i key={n} className={n <= level ? styles.filled : ""} />
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
