"use client";
import { useEffect, useRef, useState } from "react";
import StockLogo from "./stock-logo";
import type {
  Building,
  BuildingKind,
  Cell,
  CityState,
  Tool,
  TierThresholds,
} from "../lib/city";
import {
  ALL_CELLS,
  ROAD_COST,
  buildingAt,
  buildingImage,
  cellKey,
  defFor,
  footprint,
  fromPoint,
  hasRoad,
  placementError,
  point,
  returnOf,
  roadError,
  roadLine,
  sameCell,
  sprite,
  wholeMoney,
  tier,
  tierName,
  isHeroTicker,
} from "../lib/city";
import type { PriceMap } from "../lib/city";
import {
  portfolioLevel,
  portfolioPercent,
  portfolioStatus,
} from "../lib/portfolio-view";

import Traffic from "./traffic";
import PortfolioOverlay from "./portfolio-overlay";
import portfolioStyles from "./portfolio-view.module.css";
import RoadNetwork from "./road-network";
import { cameraBounds } from "../lib/map-geometry";
import ConstructionProgressBar from "./construction-progress";
import { bscTxLink } from "../lib/contracts";
import agentStyles from "./agent-worksite.module.css";

export type AgentMapActivity = {
  buildingId?: string;
  r?: number;
  c?: number;
  ticker: string;
  kind: "buy" | "sell";
  phase: "wallet" | "submitted" | "confirmed" | "error";
  detail: string;
  hash?: string;
};

type Props = {
  city: CityState;
  tool: Tool;
  kind: BuildingKind | null;
  amount: number;
  selected: string | null;
  moving: string | null;
  zoom: number;
  cameraReset: number;
  focusTarget?: { r: number; c: number; nonce: number } | null;
  scanMode?: boolean;
  scanTarget?: string | null;
  onScanTarget?: (id: string | null) => void;
  grid: boolean;
  portfolioView: boolean;
  motion: boolean;
  paused: boolean;
  speed: number;
  prices: PriceMap;
  thresholds: TierThresholds;
  simulationReturns: Record<string, number> | null;
  now: number;
  upgrades: Record<string, number>;
  confirmingBuildings?: Record<
    string,
    { confirming: boolean; confirmed: boolean; startedAt?: number }
  >;
  onConstructionComplete?: (buildingId: string) => void;
  agentActivity?: AgentMapActivity | null;
  onZoom: (delta: number) => void;
  onSelect: (id: string | null) => void;
  onPlace: (cell: Cell) => void;
  onRoad: (cells: Cell[]) => void;
  onBulldoze: (cell: Cell) => void;
  onCancel: () => void;
  onHover: (cell: Cell | null) => void;
};
const diamond = (cell: Cell) => {
  const { x, y } = point(cell.r, cell.c);
  return `M${x},${y - 18}l32,18 -32,18 -32,-18Z`;
};
export default function CityMap(props: Props) {
  const {
    city,
    tool,
    kind,
    amount,
    selected,
    moving,
    zoom,
    cameraReset,
    grid,
    portfolioView,
    motion,
    paused,
    speed,
    prices,
    now,
    upgrades,
    onZoom,
    onSelect,
    onPlace,
    onRoad,
    onBulldoze,
    onCancel,
    onHover,
  } = props;
  const root = useRef<HTMLDivElement>(null),
    video = useRef<HTMLVideoElement>(null);
  const [size, setSize] = useState({ w: 1280, h: 720 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<Cell | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [preview, setPreview] = useState<Cell[]>([]);
  const [agentSite, setAgentSite] = useState<{
    key: string;
    cell: Cell;
    existing: boolean;
    image?: string;
  } | null>(null);
  const agentActivity = props.agentActivity;
  const agentKey = agentActivity
    ? `${agentActivity.kind}:${agentActivity.ticker}:${Number.isFinite(agentActivity.r) && Number.isFinite(agentActivity.c) ? `${agentActivity.r},${agentActivity.c}` : (agentActivity.buildingId ?? "new")}`
    : "";
  const agentBuilding = agentActivity
    ? city.buildings.find((b) => b.id === agentActivity.buildingId)
    : undefined;
  const suppliedAgentCell =
    agentActivity &&
    Number.isFinite(agentActivity.r) &&
    Number.isFinite(agentActivity.c)
      ? { r: agentActivity.r!, c: agentActivity.c! }
      : null;
  const agentCell =
    agentBuilding ??
    suppliedAgentCell ??
    (agentSite?.key === agentKey ? agentSite.cell : null);
  const agentPoint = agentCell
    ? point(agentCell.r + 0.5, agentCell.c + 0.5)
    : null;
  const agentResult =
    agentActivity?.kind === "sell"
      ? agentBuilding
        ? "Position resized"
        : "Building removed"
      : agentSite?.key === agentKey && agentSite.existing
        ? "Position resized"
        : "Building added";
  useEffect(() => {
    if (!agentActivity) {
      setAgentSite(null);
      return;
    }
    const target = city.buildings.find(
      (b) => b.id === agentActivity.buildingId,
    );
    const cell =
      target ??
      (Number.isFinite(agentActivity.r) && Number.isFinite(agentActivity.c)
        ? { r: agentActivity.r!, c: agentActivity.c! }
        : null);
    if (!cell) return;
    setAgentSite((current) => {
      if (current?.key === agentKey && agentActivity.phase !== "wallet")
        return current;
      return {
        key: agentKey,
        cell: { r: cell.r, c: cell.c },
        existing: Boolean(target),
        image: target
          ? sprite(
              buildingImage(
                target,
                prices,
                props.thresholds,
                props.simulationReturns?.[target.id],
              ),
            )
          : undefined,
      };
    });
  }, [agentActivity, agentKey]);
  const drag = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
    cell: Cell;
    pan: boolean;
    distance: number;
    startedOnBuilding?: boolean;
    buildingId?: string;
  } | null>(null);
  const lastDragDistance = useRef(0);
  const space = useRef(false);
  const camera = cameraBounds(size.w, size.h, zoom, pan);
  const { scale } = camera;
  useEffect(() => {
    if (!props.focusTarget) return;
    const p = point(props.focusTarget.r + 0.5, props.focusTarget.c + 0.5);
    const targetCenterX =
      size.w > 768 ? Math.max(300, size.w / 2 - 120) : size.w / 2;
    const targetCenterY = size.h / 2;
    const bounded = cameraBounds(size.w, size.h, zoom, {
      x: (targetCenterX - p.x) * scale,
      y: (targetCenterY - p.y) * scale,
    });
    setPan({ x: bounded.x, y: bounded.y });
  }, [props.focusTarget, size.w, size.h, scale, zoom]);
  const clampPan = (p: { x: number; y: number }) => {
    const bounded = cameraBounds(size.w, size.h, zoom, p);
    return { x: bounded.x, y: bounded.y };
  };
  useEffect(() => {
    setPan((p) => {
      const bounded = cameraBounds(size.w, size.h, zoom, p);
      return { x: bounded.x, y: bounded.y };
    });
  }, [size.w, size.h, zoom]);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [cameraReset]);
  useEffect(() => {
    setPreview([]);
    drag.current = null;
  }, [tool, kind]);
  useEffect(() => {
    if (video.current) {
      if (paused) video.current.pause();
      else video.current.play().catch(() => {});
    }
  }, [paused, motion]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(
          (e.target as HTMLElement).tagName,
        )
      ) {
        e.preventDefault();
        space.current = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") space.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);
  const cellFromEvent = (e: { clientX: number; clientY: number }) => {
    const box = root.current!.getBoundingClientRect();
    return fromPoint(
      (e.clientX - box.left - size.w / 2 - camera.x) / scale + 640,
      (e.clientY - box.top - size.h / 2 - camera.y) / scale + 360,
    );
  };
  const updateHover = (e: React.PointerEvent) => {
    const cell = cellFromEvent(e);
    setHover(cell);
    onHover(cell);
    setCursor({ x: e.clientX, y: e.clientY });
    return cell;
  };
  const isBuild = tool === "build" || tool === "move";
  const footprintError =
    hover && isBuild ? placementError(hover, city, moving ?? undefined) : "";
  const previewError = roadError(
    preview.length ? preview : hover ? [hover] : [],
    city,
  );
  const buildingDef = kind ? defFor(kind) : null;
  const cost = buildingDef?.ticker ? amount : (buildingDef?.cost ?? 0);
  const actualError =
    footprintError ||
    (tool === "build" &&
    (cost > city.cash || !Number.isFinite(cost) || cost < 1)
      ? "Not enough funds"
      : "");
  const drawCells = preview.length ? preview : hover ? [hover] : [];
  const plannedRoads = [
    ...city.roads,
    ...drawCells.filter((c) => !city.roads.some((r) => sameCell(c, r))),
  ];
  const buildCenter = hover ? point(hover.r + 0.5, hover.c + 0.5) : null;
  const hoveredBuilding = hover ? buildingAt(hover, city) : null;
  const tooltip =
    tool === "road"
      ? previewError ||
        `${wholeMoney(drawCells.filter((c) => !city.roads.some((r) => sameCell(r, c))).length * ROAD_COST)} · ${drawCells.length > 1 ? "Release to build" : "Drag to draw road"}`
      : isBuild
        ? actualError ||
          `${tool === "move" ? "Move here" : wholeMoney(cost) + " · Click to place"}`
        : tool === "bulldoze"
          ? hoveredBuilding
            ? `Remove ${defFor(hoveredBuilding.kind).name}`
            : "Click a road to remove"
          : "";
  const commit = (cell: Cell) => {
    if (tool === "road") onRoad([cell]);
    else if (isBuild) onPlace(cell);
    else if (tool === "bulldoze") onBulldoze(cell);
  };
  return (
    <div
      ref={root}
      className={`game-world tool-${tool}${portfolioView ? ` portfolio-map-view ${portfolioStyles.mapView}` : ""}`}
      tabIndex={0}
      role="region"
      aria-label="Island canvas. Drag to pan. Select a construction tool to build."
      onContextMenu={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onDragStart={(e) => e.preventDefault()}
      onWheel={(e) => {
        e.preventDefault();
        if (e.ctrlKey) {
          onZoom(e.deltaY < 0 ? 0.05 : -0.05);
        } else if (
          Math.abs(e.deltaX) > 0 ||
          !Number.isInteger(e.deltaY) ||
          Math.abs(e.deltaY) < 40
        ) {
          setPan((p) =>
            clampPan({
              x: p.x - e.deltaX,
              y: p.y - e.deltaY,
            }),
          );
        } else {
          onZoom(e.deltaY < 0 ? 0.1 : -0.1);
        }
      }}
      onKeyDown={(e) => {
        const directions: Record<string, [number, number]> = {
          ArrowUp: [0, 40],
          ArrowDown: [0, -40],
          ArrowLeft: [40, 0],
          ArrowRight: [-40, 0],
        };
        if (directions[e.key] && e.target === e.currentTarget) {
          e.preventDefault();
          const [x, y] = directions[e.key];
          setPan((p) => clampPan({ x: p.x + x, y: p.y + y }));
        }
      }}
      onPointerDown={(e) => {
        if (e.button === 2) return;
        const onBuilding = Boolean(
          (e.target as Element).closest(".city-building"),
        );
        const cell = updateHover(e);
        drag.current = {
          x: e.clientX,
          y: e.clientY,
          panX: camera.x,
          panY: camera.y,
          cell,
          pan: tool === "inspect" || e.button === 1 || space.current,
          distance: 0,
          startedOnBuilding: onBuilding,
          buildingId: (e.target as Element).closest<HTMLElement>(
            ".city-building",
          )?.dataset.buildingId,
        };
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
        if (tool === "road" && !drag.current.pan) setPreview([cell]);
      }}
      onPointerMove={(e) => {
        const cell = updateHover(e);
        if (!drag.current) return;
        drag.current.distance = Math.hypot(
          e.clientX - drag.current.x,
          e.clientY - drag.current.y,
        );
        if (drag.current.pan) {
          if (
            drag.current.startedOnBuilding &&
            tool === "inspect" &&
            drag.current.distance < 6
          ) {
            return;
          }
          setPan(
            clampPan({
              x: drag.current.panX + e.clientX - drag.current.x,
              y: drag.current.panY + e.clientY - drag.current.y,
            }),
          );
        } else if (tool === "road")
          setPreview(roadLine(drag.current.cell, cell));
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        if (!d) return;
        lastDragDistance.current = d.distance;
        const cell = cellFromEvent(e);
        if (d.pan) {
          if (tool === "inspect") {
            if (d.startedOnBuilding && d.buildingId) {
              if (d.distance < 8) onSelect(d.buildingId);
            } else if (d.distance < 6) {
              onSelect(null);
            }
          }
        } else if (tool === "road") onRoad(roadLine(d.cell, cell));
        else if (d.distance < 8) commit(cell);
        drag.current = null;
        setPreview([]);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setPreview([]);
      }}
      onPointerLeave={() => {
        if (!drag.current) {
          setHover(null);
          onHover(null);
        }
      }}
    >
      <div
        className="island-world"
        onDragStart={(e) => e.preventDefault()}
        style={{
          transform: `translate(calc(-50% + ${camera.x}px),calc(-50% + ${camera.y}px)) scale(${scale})`,
        }}
      >
        <img
          className="island-media"
          src="/assets/background.png"
          alt="An undeveloped tropical island"
          draggable={false}
        />
        {motion && (
          <video
            ref={video}
            className="island-media"
            muted
            autoPlay={!paused}
            loop
            playsInline
            poster="/assets/background.png"
            onError={(e) => {
              const v = e.currentTarget;
              if (!v.dataset.fallback) {
                v.dataset.fallback = "1";
                v.src = "/assets/background-main.mp4";
              } else v.style.display = "none";
            }}
          >
            <source src="/assets/background-main.mp4" type="video/mp4" />
          </video>
        )}
        {(grid || tool !== "inspect") && (
          <svg
            className="terrain-grid"
            viewBox="0 0 1280 720"
            aria-hidden="true"
          >
            {ALL_CELLS.map((c) => (
              <path key={cellKey(c)} d={diamond(c)} />
            ))}
          </svg>
        )}
        <RoadNetwork
          roads={
            tool === "road" && hover && !previewError
              ? plannedRoads
              : city.roads
          }
        />
        {motion && <Traffic roads={city.roads} paused={paused} speed={speed} />}
        {portfolioView && (
          <PortfolioOverlay
            buildings={city.buildings}
            prices={prices}
            thresholds={props.thresholds}
            simulationReturns={props.simulationReturns}
            selected={selected}
            onInspect={onSelect}
          />
        )}
        {!portfolioView &&
          [...city.buildings]
            .sort((a, b) => a.r + a.c - b.r - b.c)
            .map((b) => {
              const p = point(b.r + 0.5, b.c + 0.5),
                def = defFor(b.kind);
              const ret = def.ticker
                ? (props.simulationReturns?.[b.id] ?? returnOf(b, prices))
                : 0;
              const currentTier = tier(ret, props.thresholds);
              const level =
                currentTier === "minus" ? 0 : portfolioLevel(currentTier);
              const status = portfolioStatus(ret);
              const confirmation = props.confirmingBuildings?.[b.id];
              const isConfirmedAgentBuilding = city.agentReceipts?.some(
                (receipt) => receipt.action === "buy" && receipt.positionId === b.vaultId,
              );
              const isUnderConstruction =
                (!isConfirmedAgentBuilding && now - b.builtAt < 8850) ||
                Boolean(confirmation?.confirming) ||
                Boolean(confirmation?.confirmed);
              const fresh = !isConfirmedAgentBuilding && now - b.builtAt < 7000;
              const upgraded = upgrades[b.id] && now - upgrades[b.id] < 2200;
              const isAgentTarget = agentActivity?.buildingId === b.id;
              return (
                <button
                  key={b.id}
                  data-building-id={b.id}
                  data-locked={b.locked ? "true" : undefined}
                  className={`city-building ${props.scanMode && hoveredBuilding?.id === b.id ? "scan-active" : ""} ${def.category === "companies" ? "company" : "service"} ${selected === b.id ? "selected" : ""} ${moving === b.id ? "being-moved" : ""} ${tool === "bulldoze" && hoveredBuilding?.id === b.id ? "demolish" : ""} ${b.locked ? "locked" : ""} ${isAgentTarget ? agentStyles.targetBuilding : ""} ${isAgentTarget && agentActivity?.phase === "confirmed" && motion && !paused ? agentStyles.confirmedBuilding : ""}`}
                  style={{
                    left: p.x,
                    top: p.y + 36,
                    zIndex: Math.round(p.y + 36),
                  }}
                  onPointerEnter={() => {
                    if (props.scanMode) props.onScanTarget?.(b.id);
                  }}
                  onFocus={() => {
                    if (props.scanMode) props.onScanTarget?.(b.id);
                  }}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  onClick={(e) => {
                    if (tool === "inspect") {
                      e.stopPropagation();
                      if (e.detail === 0 || lastDragDistance.current < 8) {
                        onSelect(b.id);
                      }
                    }
                  }}
                  aria-label={`${def.name} building${b.locked ? ", locked unpaid" : ""}`}
                  tabIndex={tool === "inspect" ? 0 : -1}
                >
                  {isUnderConstruction && !isAgentTarget && (
                    <ConstructionProgressBar
                      buildingId={b.id}
                      builtAt={confirmation?.startedAt ?? b.builtAt}
                      isConfirmingOnchain={confirmation?.confirming}
                      isConfirmedOnchain={confirmation?.confirmed}
                      onComplete={props.onConstructionComplete}
                    />
                  )}
                  {props.scanMode &&
                    props.scanTarget === b.id &&
                    def.ticker && (
                      <span className="scan-beam" aria-hidden="true" />
                    )}
                  {selected === b.id && (
                    <img
                      className="selected-effect"
                      src={sprite("effects/selection")}
                      alt=""
                    />
                  )}
                  {fresh && !isAgentTarget && (
                    <img
                      className="fx-layer fx-construction"
                      src={sprite("effects/construction")}
                      alt=""
                    />
                  )}
                  {upgraded && !fresh && (
                    <img
                      className="fx-layer fx-upgrade"
                      src={sprite("effects/upgrade")}
                      alt=""
                    />
                  )}
                  {def.ticker &&
                    tier(ret, props.thresholds) === "minus" &&
                    !fresh && (
                      <img
                        className="fx-layer fx-negative"
                        src={sprite("effects/negative_performance")}
                        alt="Negative performance"
                      />
                    )}
                  <img
                    className="building-sprite"
                    style={{ opacity: b.locked ? 0.65 : undefined }}
                    src={sprite(
                      buildingImage(
                        b,
                        prices,
                        props.thresholds,
                        props.simulationReturns?.[b.id],
                      ),
                    )}
                    alt=""
                    onPointerEnter={() => {
                      if (props.scanMode) props.onScanTarget?.(b.id);
                    }}
                    onFocus={() => {
                      if (props.scanMode) props.onScanTarget?.(b.id);
                    }}
                    draggable={false}
                  />
                  {def.ticker && !isHeroTicker(def.ticker) && (
                    <div
                      className={`sector-building-badge ${b.locked ? "locked" : ""}`}
                      title={`${def.name} (${def.ticker})${b.locked ? " · Locked unpaid" : ""}`}
                      aria-label={`${def.name} (${def.ticker})${b.locked ? ", locked unpaid" : ""}`}
                    >
                      <StockLogo
                        ticker={def.ticker}
                        name={def.name}
                        size={14}
                        shape="circle"
                        className="sector-badge-logo"
                      />
                      <span className="sector-badge-label">{def.ticker}</span>
                      {b.locked && (
                        <span className="sector-badge-lock" aria-hidden="true">
                          🔒
                        </span>
                      )}
                    </div>
                  )}
                  {!def.ticker && (
                    <span className="building-name">{def.name}</span>
                  )}
                  {b.locked && def.ticker && (
                    <span
                      className="no-road"
                      title="Locked — pay in City Hall to unlock"
                      aria-label="Locked, unpaid building"
                      style={{ background: "#f0b90b", color: "#1a1a1a" }}
                    >
                      🔒
                    </span>
                  )}
                  {!hasRoad(b, city.roads) && (
                    <span
                      className="no-road"
                      title="No road access"
                      aria-label="No road access"
                    >
                      !
                    </span>
                  )}
                </button>
              );
            })}
        {agentActivity && agentCell && agentPoint && (
          <div
            className={`${agentStyles.worksite} ${agentStyles[agentActivity.phase]} ${agentActivity.kind === "sell" ? agentStyles.sell : ""} ${!motion || paused ? agentStyles.noMotion : ""}`}
            data-agent-phase={agentActivity.phase}
            data-agent-ticker={agentActivity.ticker}
          >
            <svg
              className={agentStyles.plot}
              viewBox="0 0 1280 720"
              aria-hidden="true"
            >
              {footprint(agentCell).map((cell) => (
                <path
                  key={cellKey(cell)}
                  className={agentStyles.plotTile}
                  d={diamond(cell)}
                />
              ))}
              {agentActivity.phase !== "error" && (
                <g transform={`translate(${agentPoint.x},${agentPoint.y})`}>
                  <path
                    className={agentStyles.plotBorder}
                    d="M0,-36 64,0 0,36 -64,0Z"
                  />
                  {agentActivity.phase !== "confirmed" && (
                    <g className={agentStyles.scaffolding}>
                      <path d="M-64,0V-84L0,-120 64,-84V0M0,36V-48M-64,-84 0,-48 64,-84M-64,-42 0,-6 64,-42M-64,0 0,-48 64,0M-64,-84 0,-6 64,-84" />
                      <path
                        className={agentStyles.scaffoldRail}
                        d="M-64,0 0,36 64,0"
                      />
                    </g>
                  )}
                  {agentActivity.phase === "confirmed" && (
                    <path
                      className={agentStyles.confirmationRing}
                      d="M0,-46 82,0 0,46 -82,0Z"
                    />
                  )}
                </g>
              )}
            </svg>
            {agentActivity.kind === "sell" &&
              agentActivity.phase === "confirmed" &&
              !agentBuilding &&
              agentSite?.key === agentKey &&
              agentSite.image && (
                <img
                  className={agentStyles.removedBuilding}
                  style={{ left: agentPoint.x, top: agentPoint.y + 36 }}
                  src={agentSite.image}
                  alt=""
                  aria-hidden="true"
                />
              )}
            <div
              className={agentStyles.siteMarker}
              style={{ left: agentPoint.x, top: agentPoint.y + 44 }}
              aria-hidden="true"
            >
              <span>
                {agentActivity.phase === "confirmed"
                  ? "✓"
                  : agentActivity.kind === "buy"
                    ? "+"
                    : "−"}
              </span>
              {agentActivity.ticker}
            </div>
            <div
              className={agentStyles.status}
              style={{
                left: agentPoint.x,
                top: agentPoint.y - 190,
                transform: `translate(-50%, -100%) scale(${Math.max(1, 1 / scale)})`,
              }}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <div className={agentStyles.statusHeading}>
                <span className={agentStyles.signal} aria-hidden="true" />
                <strong>
                  {agentActivity.phase === "wallet"
                    ? "Wallet approval"
                    : agentActivity.phase === "submitted"
                      ? "On-chain confirmation"
                      : agentActivity.phase === "confirmed"
                        ? agentResult
                        : "Action paused"}
                </strong>
                <span className={agentStyles.agentLabel}>AGENT</span>
              </div>
              <p>{agentActivity.detail}</p>
              <ol className={agentStyles.steps} aria-label="Transaction stages">
                {["Wallet", "BNB Chain", "City updated"].map((label, index) => {
                  const stage =
                    agentActivity.phase === "confirmed"
                      ? 3
                      : agentActivity.phase === "submitted" ||
                          (agentActivity.phase === "error" &&
                            agentActivity.hash)
                        ? 1
                        : 0;
                  const done = index < stage;
                  const current =
                    index === stage && agentActivity.phase !== "error";
                  return (
                    <li
                      key={label}
                      className={
                        done
                          ? agentStyles.stepDone
                          : current
                            ? agentStyles.stepCurrent
                            : ""
                      }
                      aria-current={current ? "step" : undefined}
                    >
                      <span aria-hidden="true">{done ? "✓" : index + 1}</span>
                      {label}
                    </li>
                  );
                })}
              </ol>
              {agentActivity.hash && (
                <a
                  className={agentStyles.receipt}
                  href={bscTxLink(agentActivity.hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  {agentActivity.phase === "confirmed"
                    ? "View confirmed transaction"
                    : "View transaction"}
                  <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
          </div>
        )}
        {tool !== "inspect" && (
          <svg
            className="build-grid"
            viewBox="0 0 1280 720"
            role="group"
            aria-label="Construction plots"
          >
            {ALL_CELLS.map((c) => (
              <path
                key={cellKey(c)}
                d={diamond(c)}
                tabIndex={0}
                role="button"
                aria-label={`Plot ${c.r}, ${c.c}`}
                onFocus={() => setHover(c)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    commit(c);
                  }
                }}
              />
            ))}
          </svg>
        )}
        {tool === "road" && hover && (
          <>
            <svg
              className={`placement-outline ${previewError ? "invalid" : ""}`}
              viewBox="0 0 1280 720"
            >
              {drawCells.map((c) => (
                <path key={cellKey(c)} d={diamond(c)} />
              ))}
            </svg>
          </>
        )}
        {isBuild && hover && buildingDef && buildCenter && (
          <>
            <svg
              className={`placement-outline ${actualError ? "invalid" : ""}`}
              viewBox="0 0 1280 720"
            >
              {footprint(hover).map((c) => (
                <path key={cellKey(c)} d={diamond(c)} />
              ))}
            </svg>
            <div
              className={`building-ghost ${buildingDef.category === "companies" ? "company" : "service"} ${actualError ? "invalid" : ""}`}
              style={{ left: buildCenter.x, top: buildCenter.y + 36 }}
            >
              <img
                src={sprite(buildingDef.image)}
                alt={`${buildingDef.name} placement preview`}
              />
            </div>
          </>
        )}
        {tool === "bulldoze" && hover && (
          <svg className="placement-outline invalid" viewBox="0 0 1280 720">
            {(hoveredBuilding ? footprint(hoveredBuilding) : [hover]).map(
              (c) => (
                <path key={cellKey(c)} d={diamond(c)} />
              ),
            )}
          </svg>
        )}
      </div>
      {hover && tooltip && (
        <div
          className={`cursor-hint ${(isBuild && actualError) || (tool === "road" && previewError) ? "invalid" : ""}`}
          style={{
            left: Math.max(8, Math.min(cursor.x + 18, size.w - 258)),
            top: Math.max(64, cursor.y - 40),
          }}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}
