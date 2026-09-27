"use client";
import { useEffect, useMemo, useRef } from "react";
import { trafficRoute, type Cell } from "../lib/city";
import { trafficSamples, sampleTraffic, project } from "../lib/map-geometry";
import {
  VEHICLES,
  VEHICLE_LABELS,
  vehicleView,
  vehicleSize,
  type Vehicle,
  type Direction,
} from "../lib/vehicle-view";
import frames from "../lib/vehicle-frames.json";

type Frame = { src: string; viewBox: string; width: number; height: number };
const assets = frames as Record<Vehicle, Record<Direction, Frame>>;
export default function Traffic({
  roads,
  paused,
  speed,
}: {
  roads: Cell[];
  paused: boolean;
  speed: number;
}) {
  const samples = useMemo(() => trafficSamples(trafficRoute(roads)), [roads]);
  const refs = useRef<(SVGSVGElement | null)[]>([]);
  const clock = useRef(0);
  useEffect(() => {
    // Decode every perspective before driving: changing direction must never flash blank.
    const urls = [
      ...new Set(
        VEHICLES.flatMap((v) => Object.values(assets[v]).map((f) => f.src)),
      ),
    ];
    let disposed = false,
      frame = 0;
    const loaded = urls.map((src) => {
      const img = new Image();
      img.src = src;
      return img.decode().catch(() => {});
    });
    let last = performance.now();
    const tick = (now: number) => {
      if (disposed || samples.length < 2) return;
      if (!paused)
        clock.current += (Math.min(now - last, 60) / 1000) * speed * 12;
      last = now;
      refs.current.forEach((el, i) => {
        if (!el) return;
        const pose = sampleTraffic(
          samples,
          clock.current + (i * samples.at(-1)!.distance) / 3,
        );
        const center = project(pose),
          view = vehicleView(pose.angle),
          vehicle = VEHICLES[i];
        const asset = assets[vehicle][view.direction],
          size = vehicleSize(vehicle, pose.angle);
        el.style.left = `${center.x}px`;
        el.style.top = `${center.y - size.lift}px`;
        el.style.width = `${size.width}px`;
        el.style.height = `${size.height}px`;
        el.style.zIndex = String(Math.floor(center.y));
        el.style.transform = `translate(-50%,-50%) rotate(${view.rotation}deg)`;
        el.style.visibility = "visible";
        if (el.dataset.direction !== view.direction) {
          el.dataset.direction = view.direction;
          el.setAttribute("viewBox", asset.viewBox);
          const img = el.firstElementChild!;
          img.setAttribute("href", asset.src);
          img.setAttribute("width", String(asset.width));
          img.setAttribute("height", String(asset.height));
        }
      });
      if (!paused) frame = requestAnimationFrame(tick);
    };
    if (samples.length > 1)
      Promise.all(loaded).then(() => {
        if (!disposed) {
          last = performance.now();
          frame = requestAnimationFrame(tick);
        }
      });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
    };
  }, [samples, paused, speed]);
  if (samples.length < 2) return null;
  return (
    <>
      {VEHICLES.map((vehicle, i) => (
        <svg
          key={vehicle}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="traffic-vehicle"
          role="img"
          aria-label={VEHICLE_LABELS[vehicle]}
          data-vehicle={vehicle}
          preserveAspectRatio="none"
          style={{ visibility: "hidden" }}
        >
          <image />
        </svg>
      ))}
    </>
  );
}
