import { roadPath } from "../lib/map-geometry";
import type { Cell } from "../lib/city";
export default function RoadNetwork({ roads }: { roads: Cell[] }) {
  const path = roadPath(roads);
  return (
    <svg className="road-network" viewBox="0 0 1280 720" aria-hidden="true">
      <g
        transform="matrix(1 .5625 -1 .5625 640 350)"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={path} stroke="#69735a" strokeWidth="23" />
        <path d={path} stroke="#d6d3bc" strokeWidth="21" />
        <path d={path} stroke="#777e77" strokeWidth="17" />
        <path
          d={path}
          stroke="#eee9ce"
          strokeWidth=".65"
          strokeDasharray="4 7"
        />
        {roads
          .filter(
            (p) =>
              roads.filter(
                (q) => Math.abs(p.r - q.r) + Math.abs(p.c - q.c) === 1,
              ).length > 2,
          )
          .map((p) => (
            <circle
              key={`${p.r},${p.c}`}
              cx={p.c * 32}
              cy={p.r * 32}
              r="7"
              fill="#777e77"
              stroke="none"
            />
          ))}
      </g>
    </svg>
  );
}
