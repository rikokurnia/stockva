"use client";
import { useState } from "react";
import {
  ChevronDown,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import {
  SIMULATION_INTERVALS,
  validThresholds,
  type TierThresholds,
} from "../lib/city";
import styles from "./company-intel.module.css";

type Props = {
  thresholds: TierThresholds;
  interval: number;
  running: boolean;
  active: boolean;
  count: number;
  onThresholds: (value: TierThresholds) => void;
  onInterval: (value: number) => void;
  onToggle: () => void;
  onReset: () => void;
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
  return (
    <section
      className={styles.simulation}
      aria-label="Building level simulation"
    >
      <div className={styles.simTop}>
        <button
          className={styles.simTitle}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <SlidersHorizontal size={16} />
          <span>
            Building simulation
            <small>
              {props.active
                ? `${props.running ? "Running" : "Paused"} · ${props.interval}s interval`
                : "Preview your skyline"}
            </small>
          </span>
          <ChevronDown size={13} />
        </button>
        <button
          className={styles.start}
          onClick={props.onToggle}
          disabled={!props.count}
          aria-label={
            props.running
              ? "Pause building simulation"
              : "Start building simulation"
          }
        >
          {props.running ? <Pause size={14} /> : <Play size={14} />}{" "}
          {props.running ? "Pause" : "Start"}
        </button>
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
          <div className={styles.sectionLabel}>SET THE TURNING POINTS</div>
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
            {props.count
              ? "Visual preview only. Market quotes, funds and cost basis stay unchanged."
              : "Place a company building to start the simulation."}
          </p>
          {props.active && (
            <button
              className={styles.reset}
              type="button"
              onClick={props.onReset}
            >
              <RotateCcw size={13} />
              Return to market percentages
            </button>
          )}
        </form>
      )}
    </section>
  );
}
