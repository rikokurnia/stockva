"use client";
import { useState } from "react";
import {
  ChevronDown,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import {
  SIMULATION_INTERVALS,
  validThresholds,
  type TierThresholds,
} from "../lib/city";
import styles from "./company-intel.module.css";

type Props = {
  mode: "live" | "simulation";
  thresholds: TierThresholds;
  interval: number;
  running: boolean;
  active: boolean;
  count: number;
  onThresholds: (value: TierThresholds) => void;
  onInterval: (value: number) => void;
  onToggle: () => void;
  onReset: () => void;
  onSwitchToLive: () => void;
  onSwitchToSimulation: () => void;
};

export default function BuildingSimulation(props: Props) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(() => ({
    minus: String(props.thresholds.minus),
    level2: String(props.thresholds.level2),
    level3: String(props.thresholds.level3),
  }));
  const [editing, setEditing] = useState(false);

  const values = editing
    ? draft
    : {
        minus: String(props.thresholds.minus),
        level2: String(props.thresholds.level2),
        level3: String(props.thresholds.level3),
      };
  const next = {
    minus: Number(values.minus),
    level2: Number(values.level2),
    level3: Number(values.level3),
  };
  const valid =
    Object.values(values).every((s) => s.trim() !== "") &&
    validThresholds(next);
  const sign = (n: number) => `${n > 0 ? "+" : ""}${n}%`;

  const isLive = props.mode === "live";

  return (
    <section
      className={styles.simulation}
      aria-label="Building level simulation & 24/7 RWA market controls"
    >
      {/* Top Mode Segmented Switcher */}
      <div className={styles.modeSwitchHeader}>
        <button
          type="button"
          className={`${styles.modeTab} ${isLive ? styles.modeTabActiveLive : ""}`}
          onClick={props.onSwitchToLive}
          title="24/7 Live RWA Market: Real-time on-chain pricing (no timer looping)"
        >
          <span className={styles.livePulseDot} />
          <span>Live RWA (24/7)</span>
        </button>
        <button
          type="button"
          className={`${styles.modeTab} ${!isLive ? styles.modeTabActiveSim : ""}`}
          onClick={props.onSwitchToSimulation}
          title="Simulation Mode: Custom % thresholds & dynamic looping skyline preview"
        >
          <SlidersHorizontal size={12} />
          <span>Simulation</span>
        </button>
      </div>

      <div className={styles.simTop}>
        <button
          className={styles.simTitle}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {isLive ? (
            <span className={styles.liveIndicator}>
              <span className={styles.livePulseDot} />
            </span>
          ) : (
            <SlidersHorizontal size={16} />
          )}
          <span>
            {isLive ? "24/7 Live RWA Mode" : "Simulation Sandbox"}
            <small>
              {isLive
                ? "Live on-chain feed · Realtime PnL"
                : props.running
                  ? `Looping every ${props.interval}s · Custom %`
                  : "Paused · Custom %"}
            </small>
          </span>
          <ChevronDown size={13} />
        </button>

        {isLive ? (
          <button
            className={styles.start}
            onClick={props.onSwitchToSimulation}
            disabled={!props.count}
            title={
              props.count
                ? "Switch to Simulation Mode"
                : "Place a company to simulate"
            }
          >
            <Sparkles size={14} /> Start
          </button>
        ) : (
          <button
            className={styles.start}
            onClick={props.onToggle}
            disabled={!props.count}
            aria-label={
              props.running
                ? "Pause building simulation"
                : "Resume building simulation"
            }
          >
            {props.running ? <Pause size={14} /> : <Play size={14} />}{" "}
            {props.running ? "Pause" : "Resume"}
          </button>
        )}
      </div>

      {expanded && (
        <form
          className={styles.simForm}
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) {
              props.onThresholds(next);
              setEditing(false);
            }
          }}
        >
          <div className={styles.sectionLabel}>
            {isLive
              ? "PREVIEW / CUSTOMIZE THRESHOLDS"
              : "SET THE TURNING POINTS"}
          </div>

          <div className={styles.thresholdInputs}>
            {(
              [
                ["minus", "X · Minus below"],
                ["level2", "Y · Level 2 at"],
                ["level3", "Z · Level 3 at"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <span>
                  <input
                    type="number"
                    step="0.5"
                    min="-98.5"
                    max="1000"
                    value={values[key]}
                    aria-label={label}
                    aria-invalid={!valid}
                    aria-describedby="tier-validation"
                    onChange={(e) => {
                      setDraft({ ...values, [key]: e.target.value });
                      setEditing(true);
                    }}
                  />
                  %
                </span>
              </label>
            ))}
          </div>

          <div
            id="tier-validation"
            className={valid ? styles.rule : styles.error}
          >
            {valid
              ? "X < Y < Z · changes apply when saved below"
              : "Enter three numbers in order: −99 < X < Y < Z ≤ 1000."}
          </div>

          <dl className={styles.tierRanges}>
            <div>
              <dt>Minus</dt>
              <dd>&lt; {sign(props.thresholds.minus)}</dd>
            </div>
            <div>
              <dt>Level 1</dt>
              <dd>
                {sign(props.thresholds.minus)} to &lt;{" "}
                {sign(props.thresholds.level2)}
              </dd>
            </div>
            <div>
              <dt>Level 2</dt>
              <dd>
                {sign(props.thresholds.level2)} to &lt;{" "}
                {sign(props.thresholds.level3)}
              </dd>
            </div>
            <div>
              <dt>Level 3</dt>
              <dd>≥ {sign(props.thresholds.level3)}</dd>
            </div>
          </dl>

          <div className={styles.simActions}>
            <label>
              Tick every
              <select
                aria-label="Simulation interval"
                value={props.interval}
                onChange={(e) => props.onInterval(Number(e.target.value))}
              >
                {SIMULATION_INTERVALS.map((n) => (
                  <option key={n} value={n}>
                    {n} seconds
                  </option>
                ))}
              </select>
            </label>
            <button
              className={styles.paperButton}
              type="submit"
              disabled={!valid}
            >
              Apply thresholds
            </button>
          </div>

          <p className={styles.rule}>
            {isLive
              ? "Currently in 24/7 Live RWA Mode. Buildings reflect real-time on-chain prices. Switch to Simulation to test custom threshold transformations in a loop."
              : props.count
                ? "Visual simulation sandbox active. Ticking every " +
                  props.interval +
                  "s. Funds and cost basis stay unchanged."
                : "Place a hero company building to preview dynamic tier transitions."}
          </p>

          {!isLive && (
            <button
              className={styles.reset}
              type="button"
              onClick={props.onReset}
            >
              <RotateCcw size={13} />
              Return to 24/7 Live RWA Market
            </button>
          )}
        </form>
      )}
    </section>
  );
}
