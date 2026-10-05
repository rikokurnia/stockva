"use client";
import { useEffect, useState } from "react";
import { estimatedSession, type RwaSession } from "../lib/rwa";

const shortTime = (iso: string | null) => {
  if (!iso) return "";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  return t.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
};

/** US-market session pill (Binance RWA Data, 60s refresh with schedule fallback). */
export default function RwaSessionClock() {
  const [session, setSession] = useState<RwaSession | null>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/rwa/session", {
          cache: "no-store",
        });
        if (response.ok) {
          const data = (await response.json()) as RwaSession;
          if (active && data && data.provenance !== "unavailable") {
            setSession(data);
            return;
          }
        }
      } catch {
        /* fallback to estimated clock */
      }
      if (active) {
        setSession(estimatedSession());
      }
    };
    void load();
    const id = setInterval(load, 60000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);
  if (!session) return null;
  const color =
    session.state === "open"
      ? "#34d399"
      : session.state === "halted"
        ? "#f87171"
        : "#f0b90b";
  const stateText =
    session.state === "open"
      ? "US market open"
      : session.state === "halted"
        ? "Trading halted"
        : "US market closed";
  const next =
    session.state === "open" ? session.nextCloseAt : session.nextOpenAt;
  return (
    <span
      title={`${session.label}${session.provenance === "estimated" ? " (estimated schedule)" : " · Binance RWA Data"}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "11px",
        fontWeight: 700,
        color,
        background: `${color}1f`,
        border: `1px solid ${color}55`,
        borderRadius: "20px",
        padding: "6px 10px",
        whiteSpace: "nowrap",
      }}
    >
      <i
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: color,
        }}
      />
      {stateText}
      {next ? (
        <span style={{ fontWeight: 400, opacity: 0.85 }}>
          · {session.state === "open" ? "closes" : "opens"} {shortTime(next)}
        </span>
      ) : session.state === "closed" ? (
        <span style={{ fontWeight: 400, opacity: 0.85 }}>· ref frozen</span>
      ) : null}
    </span>
  );
}
