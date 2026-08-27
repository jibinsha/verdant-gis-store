import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { bboxOfFeatures } from "./spatial";

const A4_W = 1123;
const A4_H = 794;

function geometryPath(geometry, project) {
  if (!geometry) return "";

  const ringPath = (ring) =>
    (ring || [])
      .map((coordinate, i) => {
        const [x, y] = project(coordinate);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ") + " Z";

  if (geometry.type === "Polygon") {
    return geometry.coordinates.map(ringPath).join(" ");
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flat().map(ringPath).join(" ");
  }

  return "";
}

function bboxFrom(features = [], points = []) {
  return (
    bboxOfFeatures([
      ...(features || []).filter(Boolean),
      ...(points || []).filter(Boolean)
    ]) || [0, 0, 1, 1]
  );
}

function expandBbox(bbox, paddingRatio = 0.05) {
  let [minX, minY, maxX, maxY] = bbox;
  const dx = Math.max(maxX - minX, 0.0001);
  const dy = Math.max(maxY - minY, 0.0001);

  minX -= dx * paddingRatio;
  maxX += dx * paddingRatio;
  minY -= dy * paddingRatio;
  maxY += dy * paddingRatio;

  return [minX, minY, maxX, maxY];
}

function focusedBbox(bbox, targetAspect, paddingRatio = 0.035) {
  let [minX, minY, maxX, maxY] = expandBbox(bbox, paddingRatio);
  let width = Math.max(maxX - minX, 0.0001);
  let height = Math.max(maxY - minY, 0.0001);
  const currentAspect = width / height;

  // Keep the sampling area prominent while preserving geographic aspect.
  // The main frame is already wider than most point clusters, so only add
  // the minimum amount of geographic space needed to fill the frame.
  if (currentAspect < targetAspect) {
    const desiredWidth = height * targetAspect;
    const extra = (desiredWidth - width) / 2;
    minX -= extra;
    maxX += extra;
  } else if (currentAspect > targetAspect) {
    const desiredHeight = width / targetAspect;
    const extra = (desiredHeight - height) / 2;
    minY -= extra;
    maxY += extra;
  }

  return [minX, minY, maxX, maxY];
}

function aspectFitBbox(bbox, targetAspect, paddingRatio = 0.04) {
  let [minX, minY, maxX, maxY] = expandBbox(bbox, paddingRatio);
  let width = Math.max(maxX - minX, 0.0001);
  let height = Math.max(maxY - minY, 0.0001);
  const currentAspect = width / height;

  if (currentAspect < targetAspect) {
    const desiredWidth = height * targetAspect;
    const extra = (desiredWidth - width) / 2;
    minX -= extra;
    maxX += extra;
  } else if (currentAspect > targetAspect) {
    const desiredHeight = width / targetAspect;
    const extra = (desiredHeight - height) / 2;
    minY -= extra;
    maxY += extra;
  }

  return [minX, minY, maxX, maxY];
}

function projectionFor(bbox, width, height) {
  const [minX, minY, maxX, maxY] = bbox;
  const dx = Math.max(maxX - minX, 0.000001);
  const dy = Math.max(maxY - minY, 0.000001);

  const scale = Math.min(width / dx, height / dy);
  const mapW = dx * scale;
  const mapH = dy * scale;
  const offsetX = (width - mapW) / 2;
  const offsetY = (height - mapH) / 2;

  return ([x, y]) => [
    offsetX + (Number(x) - minX) * scale,
    height - offsetY - (Number(y) - minY) * scale
  ];
}

function formatCoordinate(value, axis) {
  if (!Number.isFinite(Number(value))) return "";

  const n = Number(value);
  const suffix =
    axis === "lon"
      ? n >= 0
        ? "E"
        : "W"
      : n >= 0
      ? "N"
      : "S";

  return `${Math.abs(n).toFixed(3)}°${suffix}`;
}

function formatNumber(value) {
  if (!Number.isFinite(Number(value))) return "";

  const n = Number(value);
  const abs = Math.abs(n);

  if (abs >= 1000) return n.toFixed(0);
  if (abs >= 100) return n.toFixed(1);
  if (abs >= 10) return n.toFixed(2);
  return n.toFixed(3);
}

function niceScaleKm(widthDegrees, latitude) {
  const approximateKm =
    Math.max(
      0.1,
      widthDegrees *
        111.32 *
        Math.max(
          Math.cos((latitude * Math.PI) / 180),
          0.15
        )
    );

  const target = approximateKm * 0.32;
  const power = Math.pow(
    10,
    Math.floor(Math.log10(Math.max(target, 0.1)))
  );

  const candidates = [1, 1.5, 2, 2.5, 5, 7.5, 10];
  let best = candidates[0] * power;

  for (const candidate of candidates) {
    const value = candidate * power;
    if (value <= target * 1.15) best = value;
  }

  return Math.max(0.1, best);
}

function formatScaleDistance(km) {
  const value = Number(km);
  if (!Number.isFinite(value) || value <= 0) return "";

  if (value < 1) {
    const metres = value * 1000;
    if (metres >= 100) return `${Math.round(metres)} m`;
    if (metres >= 10) return `${Math.round(metres)} m`;
    return `${Number(metres.toFixed(1))} m`;
  }

  if (value >= 1000) {
    const thousands = value / 1000;
    return `${Number(thousands.toFixed(thousands >= 10 ? 0 : 1))} km`;
  }

  return `${Number(value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2))} km`;
}

function ScaleBar({ x, y, km, width = 136 }) {
  const totalLabel = formatScaleDistance(km);
  const halfLabel = formatScaleDistance(km / 2);
  const labelFont = 8.6;

  return (
    <g aria-label={`Scale bar ${totalLabel}`}>
      <line x1={x} y1={y} x2={x + width} y2={y} stroke="#111" strokeWidth="1.3" />
      <line x1={x} y1={y - 6} x2={x} y2={y + 6} stroke="#111" strokeWidth="1.3" />
      <line x1={x + width / 2} y1={y - 6} x2={x + width / 2} y2={y + 6} stroke="#111" strokeWidth="1.3" />
      <line x1={x + width} y1={y - 6} x2={x + width} y2={y + 6} stroke="#111" strokeWidth="1.3" />
      <text x={x} y={y - 10} fontSize={labelFont} textAnchor="start">0</text>
      <text x={x + width / 2} y={y - 10} fontSize={labelFont} textAnchor="middle">{halfLabel}</text>
      <text x={x + width} y={y - 10} fontSize={labelFont} textAnchor="end">{totalLabel}</text>
    </g>
  );
}

function NorthArrow({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} aria-label="North arrow">
      <text x="0" y="-30" textAnchor="middle" fontSize="12" fontWeight="700">N</text>
      <line x1="0" y1="25" x2="0" y2="-18" stroke="#111" strokeWidth="1.25" />
      <circle cx="0" cy="-3" r="10" fill="#fff" stroke="#111" strokeWidth="1.15" />
      <path d="M 0 -22 L -3 -11 L 0 -14 L 3 -11 Z" fill="#fff" stroke="#111" strokeWidth="0.95" />
      <path d="M 0 16 L -3 6 L 0 9 L 3 6 Z" fill="#fff" stroke="#111" strokeWidth="0.95" />
      <path d="M -19 -3 L -9 -6 L -12 -3 L -9 0 Z" fill="#fff" stroke="#111" strokeWidth="0.95" />
      <path d="M 19 -3 L 9 -6 L 12 -3 L 9 0 Z" fill="#fff" stroke="#111" strokeWidth="0.95" />
    </g>
  );
}

function featureName(feature, fallback = "") {
  const p = feature?.properties || {};

  return (
    p.NAME ||
    p.Name ||
    p.name ||
    p.STNAME_SH ||
    p.STNAME ||
    p.dtname ||
    p.DTNAME ||
    p.sdtname ||
    p.VILLAGE ||
    p.Village ||
    p.STATE ||
    p.State ||
    fallback
  );
}

function interiorGridValues(min, max, count = 3) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return [];
  }

  // Deliberately omit the four map corners. Three clean interior ticks are
  // used for publication maps, with longitude labels above/below the frame
  // and latitude labels outside the left/right frame edges.
  return Array.from(
    { length: count },
    (_, i) => min + ((max - min) * (i + 1)) / (count + 1)
  );
}

function cellColor(value, min, max) {
  const t =
    max === min
      ? 0.5
      : Math.max(
          0,
          Math.min(1, (value - min) / (max - min))
        );

  const stops = [
    [44, 123, 182],
    [171, 217, 233],
    [255, 255, 191],
    [253, 174, 97],
    [215, 25, 33]
  ];

  const position = t * (stops.length - 1);
  const index = Math.min(
    Math.floor(position),
    stops.length - 2
  );
  const local = position - index;
  const a = stops[index];
  const b = stops[index + 1];

  return `rgb(${a
    .map((c, i) =>
      Math.round(c + (b[i] - c) * local)
    )
    .join(",")})`;
}

function InsetMap({
  x,
  y,
  width,
  height,
  title,
  baseGeojson,
  fallbackFeature,
  highlightFeature,
  scaleKm
}) {
  const baseFeatures =
    baseGeojson?.features?.length
      ? baseGeojson.features
      : fallbackFeature
      ? [fallbackFeature]
      : [];

  const bbox = bboxFrom(baseFeatures);
  const project = projectionFor(
    aspectFitBbox(
      bbox,
      width / height,
      0.08
    ),
    width,
    height
  );

  const highlightPath = highlightFeature
    ? geometryPath(
        highlightFeature.geometry,
        project
      )
    : "";

  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        width={width}
        height={height}
        fill="#fff"
        stroke="#1b2621"
        strokeWidth="1"
      />

      {baseFeatures.map((feature, index) => {
        const path = geometryPath(
          feature.geometry,
          project
        );

        if (!path) return null;

        return (
          <path
            key={feature.id ?? index}
            d={path}
            fill="#f7f8f7"
            stroke="#565e5a"
            strokeWidth="0.7"
            fillRule="evenodd"
          />
        );
      })}

      {highlightPath && (
        <path
          d={highlightPath}
          fill="#3187c5"
          fillOpacity="0.82"
          stroke="#2874ad"
          strokeWidth="0.9"
          fillRule="evenodd"
        />
      )}

      <text
        x={width / 2}
        y="27"
        textAnchor="middle"
        fontSize="15"
        fontWeight="700"
      >
        {title}
      </text>

      <NorthArrow
        x={width - 31}
        y={51}
        scale={0.62}
      />

      <ScaleBar
        x={16}
        y={height - 18}
        km={scaleKm}
        width={108}
      />
    </g>
  );
}

function MainMap({
  x,
  y,
  width,
  height,
  title,
  subtitle,
  source,
  boundaryFeature,
  points,
  cells,
  valueField,
  minValue,
  maxValue,
  showPoints,
  showGrid,
  showBoundary,
  showLabels,
  samplingLegend
}) {
  const hasInterpolation =
    cells?.length > 0 && Boolean(valueField);

  // The publication map should be centred on the sampling locations.
  // Boundaries and interpolation cells are visual/clip layers and must not
  // pull the map extent away from the actual study points.
  const extentFeatures = [
    ...(points || []),
    ...(boundaryFeature ? [boundaryFeature] : []),
    ...(cells || [])
  ];

  const rawBbox = bboxFrom(
    extentFeatures,
    points
  );

  // The publication map frame is a distinct dark rectangle. Grid lines stay
  // inside it, while coordinate labels/ticks sit directly on the outside
  // edge of the frame (matching the reference cartographic layout).
  // One publication frame for the main map. The coordinate labels live
  // outside this dark frame, while the title/subtitle and north arrow live
  // cleanly inside it, matching the supplied reference layout.
  const plotX = 18;
  const plotY = 28;
  const plotW = width - 36;
  const plotH = height - plotY - 14;

  const bbox = hasInterpolation
    ? aspectFitBbox(rawBbox, plotW / plotH, 0.02)
    : focusedBbox(rawBbox, plotW / plotH, 0.025);

  const project = projectionFor(
    bbox,
    plotW,
    plotH
  );

  // Publication-style grid: exactly three interior longitude and latitude
  // lines. Corner coordinates are intentionally omitted.
  const lons = interiorGridValues(
    bbox[0],
    bbox[2],
    3
  );
  const lats = interiorGridValues(
    bbox[1],
    bbox[3],
    3
  );

  const midLat =
    (bbox[1] + bbox[3]) / 2;

  const scaleKm = niceScaleKm(
    bbox[2] - bbox[0],
    midLat
  );

  const clipId = `main-boundary-clip-${Math.random()
    .toString(36)
    .slice(2)}`;

  const boundaryPath = boundaryFeature
    ? geometryPath(
        boundaryFeature.geometry,
        project
      )
    : "";

  const toPlot = ([px, py]) => [
    plotX + px,
    plotY + py
  ];

  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <linearGradient
          id="idw-gradient"
          x1="0%"
          x2="100%"
          y1="0%"
          y2="0%"
        >
          <stop
            offset="0%"
            stopColor="#2c7bb6"
          />
          <stop
            offset="25%"
            stopColor="#abd9e9"
          />
          <stop
            offset="50%"
            stopColor="#ffffbf"
          />
          <stop
            offset="75%"
            stopColor="#fdae61"
          />
          <stop
            offset="100%"
            stopColor="#d7191d"
          />
        </linearGradient>

        {boundaryPath && (
          <clipPath
            id={clipId}
            clipPathUnits="userSpaceOnUse"
          >
            <path
              d={boundaryPath}
              transform={`translate(${plotX} ${plotY})`}
              fillRule="evenodd"
            />
          </clipPath>
        )}
      </defs>

      <rect
        width={width}
        height={height}
        fill="#fff"
      />

      <rect
        x={plotX}
        y={plotY}
        width={plotW}
        height={plotH}
        fill="none"
        stroke="#111"
        strokeWidth="1.15"
      />

      <text
        x={width / 2}
        y={plotY + 39}
        textAnchor="middle"
        fontSize="25"
        fontWeight="700"
      >
        {title}
      </text>

      {subtitle && (
        <text
          x={width / 2}
          y={plotY + 55}
          textAnchor="middle"
          fontSize="11.5"
          fill="#4b5752"
        >
          {subtitle}
        </text>
      )}

      {hasInterpolation && (
        <g
          clipPath={
            boundaryPath
              ? `url(#${clipId})`
              : undefined
          }
        >
          {cells.map((cell, index) => {
            const value = Number(
              cell.properties?.[valueField]
            );

            const ring =
              cell.geometry?.coordinates?.[0] ||
              [];

            if (!ring.length) return null;

            const cellPath =
              geometryPath(
                {
                  type: "Polygon",
                  coordinates: [ring]
                },
                project
              );

            return (
              <path
                key={`cell-${index}`}
                d={`translate(${plotX} ${plotY}) ${cellPath}`}
                fill={cellColor(
                  value,
                  minValue,
                  maxValue
                )}
                stroke="#fff"
                strokeWidth="0.18"
                opacity="0.84"
              />
            );
          })}
        </g>
      )}

      {!hasInterpolation &&
        boundaryFeature && (
          <path
            d={`translate(${plotX} ${plotY}) ${boundaryPath}`}
            fill="#f7f8f7"
            fillRule="evenodd"
            stroke={
              showBoundary
                ? "#555e5a"
                : "none"
            }
            strokeWidth={
              showBoundary ? "1.1" : "0"
            }
          />
        )}

      {hasInterpolation &&
        boundaryPath &&
        showBoundary && (
          <path
            d={`translate(${plotX} ${plotY}) ${boundaryPath}`}
            fill="none"
            stroke="#4b5651"
            strokeWidth="1.15"
            fillRule="evenodd"
          />
        )}

      {showGrid &&
        lons.map((value, index) => {
          const [gx] = project([
            value,
            bbox[1]
          ]);
          const px = plotX + gx;

          return (
            <g key={`lon-${index}`}>
              <line
                x1={px}
                y1={plotY}
                x2={px}
                y2={plotY + plotH}
                stroke="#7f8985"
                strokeWidth="0.7"
                opacity="0.30"
              />
              <line
                x1={px}
                y1={plotY}
                x2={px}
                y2={plotY + 5}
                stroke="#111"
                strokeWidth="1.1"
              />
              <line
                x1={px}
                y1={plotY + plotH}
                x2={px}
                y2={plotY + plotH + 5}
                stroke="#111"
                strokeWidth="1.1"
              />
              <text
                x={px}
                y={plotY - 7}
                textAnchor="middle"
                fontSize="10"
                fill="#303936"
              >
                {formatCoordinate(value, "lon")}
              </text>
              <text
                x={px}
                y={plotY + plotH + 14}
                textAnchor="middle"
                fontSize="10"
                fill="#303936"
              >
                {formatCoordinate(value, "lon")}
              </text>
            </g>
          );
        })}

      {showGrid &&
        lats.map((value, index) => {
          const [, gy] = project([
            bbox[0],
            value
          ]);
          const py = plotY + gy;

          return (
            <g key={`lat-${index}`}>
              <line
                x1={plotX}
                y1={py}
                x2={plotX + plotW}
                y2={py}
                stroke="#7f8985"
                strokeWidth="0.7"
                opacity="0.30"
              />
              <line
                x1={plotX}
                y1={py}
                x2={plotX + 5}
                y2={py}
                stroke="#111"
                strokeWidth="1.1"
              />
              <line
                x1={plotX + plotW}
                y1={py}
                x2={plotX + plotW + 5}
                y2={py}
                stroke="#111"
                strokeWidth="1.1"
              />
              <text
                x={plotX - 12}
                y={py}
                textAnchor="middle"
                fontSize="10"
                fill="#303936"
                transform={`rotate(-90 ${plotX - 12} ${py})`}
              >
                {formatCoordinate(value, "lat")}
              </text>
              <text
                x={plotX + plotW + 12}
                y={py}
                textAnchor="middle"
                fontSize="10"
                fill="#303936"
                transform={`rotate(90 ${plotX + plotW + 12} ${py})`}
              >
                {formatCoordinate(value, "lat")}
              </text>
            </g>
          );
        })}

      {showPoints &&
        points.map((point, index) => {
          const coordinate =
            point.geometry?.coordinates;

          if (!coordinate) return null;

          const [px0, py0] =
            project(coordinate);
          const [px, py] = toPlot([
            px0,
            py0
          ]);

          return (
            <circle
              key={`point-${
                point.id ?? index
              }`}
              cx={px}
              cy={py}
              r="4"
              fill="#087f5b"
              stroke="#fff"
              strokeWidth="1.25"
            />
          );
        })}

      <NorthArrow
        x={plotX + plotW - 42}
        y={plotY + 73}
        scale={0.78}
      />

      <ScaleBar
        x={plotX + 10}
        y={plotY + plotH - 16}
        km={scaleKm}
        width={136}
      />

      {samplingLegend && (
        <g
          transform={`translate(${
            plotX + plotW - 170
          } ${
            hasInterpolation
              ? plotY + plotH - 112
              : plotY + plotH - 58
          })`}
        >
          <rect
            x="-10"
            y="-18"
            width="160"
            height="30"
            fill="#fff"
            fillOpacity="0.96"
            stroke="#9ca7a2"
          />
          <circle
            cx="3"
            cy="-3"
            r="4"
            fill="#087f5b"
            stroke="#fff"
            strokeWidth="1.2"
          />
          <text
            x="13"
            y="1"
            fontSize="9.2"
          >
            {samplingLegend}
          </text>
        </g>
      )}

      {hasInterpolation && (
        <g
          transform={`translate(${
            plotX + plotW - 184
          } ${
            plotY + plotH - 60
          })`}
        >
          <rect
            x="-9"
            y="-25"
            width="177"
            height="51"
            fill="#fff"
            fillOpacity="0.96"
            stroke="#9ca7a2"
          />
          <text
            x="0"
            y="-8"
            fontSize="9.2"
            fontWeight="700"
          >
            {valueField}
          </text>
          <rect
            x="0"
            y="1"
            width="128"
            height="10"
            fill="url(#idw-gradient)"
          />
          <text
            x="0"
            y="22"
            fontSize="8.5"
          >
            {formatNumber(minValue)}
          </text>
          <text
            x="128"
            y="22"
            fontSize="8.5"
            textAnchor="end"
          >
            {formatNumber(maxValue)}
          </text>
        </g>
      )}

      {showLabels &&
        boundaryFeature && (
          <text
            x={plotX + plotW / 2}
            y={plotY + plotH / 2}
            textAnchor="middle"
            fontSize="13"
            fill="#39453f"
          >
            {featureName(
              boundaryFeature,
              ""
            )}
          </text>
        )}

      {source && (
        <text
          x={width - 9}
          y={height - 8}
          textAnchor="end"
          fontSize="7.5"
          fill="#68736f"
        >
          {source}
        </text>
      )}
    </g>
  );
}

function LayoutSvg({
  title,
  subtitle,
  source,
  countryFeature,
  stateFeature,
  countryInsetGeojson,
  stateInsetGeojson,
  mainFeature,
  mainPoints,
  idwCells,
  valueField,
  minValue,
  maxValue,
  isInterpolation,
  showPoints,
  showGrid,
  showBoundary,
  showLabels,
  samplingLegend
}) {
  const margin = 14;
  const insetW = 260;
  const gap = 12;
  const mainX =
    margin + insetW + gap;
  const mainW =
    A4_W - mainX - margin;
  const insetH =
    (A4_H -
      margin * 2 -
      gap) /
    2;

  const stateTitle =
    featureName(
      stateFeature,
      "STATE"
    );

  return (
    <svg
      className="layout-a4-svg"
      viewBox={`0 0 ${A4_W} ${A4_H}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        width={A4_W}
        height={A4_H}
        fill="#fff"
      />

      <InsetMap
        x={margin}
        y={margin}
        width={insetW}
        height={insetH}
        title="INDIA"
        baseGeojson={
          countryInsetGeojson
        }
        fallbackFeature={
          countryFeature
        }
        highlightFeature={
          stateFeature
        }
        scaleKm={500}
      />

      <InsetMap
        x={margin}
        y={
          margin +
          insetH +
          gap
        }
        width={insetW}
        height={insetH}
        title={stateTitle}
        baseGeojson={
          stateInsetGeojson
        }
        fallbackFeature={
          stateFeature
        }
        highlightFeature={
          mainFeature
        }
        scaleKm={100}
      />

      <MainMap
        x={mainX}
        y={margin}
        width={mainW}
        height={
          A4_H -
          margin * 2
        }
        title={title}
        subtitle={subtitle}
        source={source}
        boundaryFeature={
          mainFeature
        }
        points={mainPoints}
        cells={
          isInterpolation
            ? idwCells
            : []
        }
        valueField={
          isInterpolation
            ? valueField
            : ""
        }
        minValue={minValue}
        maxValue={maxValue}
        showPoints={showPoints}
        showGrid={showGrid}
        showBoundary={
          showBoundary
        }
        showLabels={showLabels}
        samplingLegend={samplingLegend}
      />
    </svg>
  );
}

export default function StudioLayout({
  open,
  onClose,
  layers = [],
  activeLayer = null,
  detected = {},
  analysisResult = null
}) {
  const [title, setTitle] =
    useState("");
  const [subtitle, setSubtitle] =
    useState("");
  const [source, setSource] =
    useState("Source: Verdant GIS");
  const [samplingLegend, setSamplingLegend] =
    useState("Sampling locations");
  const [showPoints, setShowPoints] =
    useState(true);
  const [showGrid, setShowGrid] =
    useState(true);
  const [showBoundary, setShowBoundary] =
    useState(true);
  const [showLabels, setShowLabels] =
    useState(false);

  const previewRef =
    useRef(null);

  const points = useMemo(
    () =>
      (activeLayer?.geojson?.features || [])
        .filter(
          (feature) =>
            feature?.geometry?.type === "Point"
        )
        .filter((feature) => {
          const coordinate = feature.geometry?.coordinates;
          return (
            Array.isArray(coordinate) &&
            Number.isFinite(Number(coordinate[0])) &&
            Number.isFinite(Number(coordinate[1]))
          );
        }),
    [activeLayer]
  );

  const isInterpolation =
    analysisResult?.type ===
    "idw";

  const countryFeature =
    detected?.countryFeature ||
    null;

  const stateFeature =
    detected?.stateFeature ||
    null;

  const countryInsetGeojson =
    detected?.countryInsetGeojson ||
    detected?.countryBoundary
      ?.insetGeojson ||
    null;

  const stateInsetGeojson =
    detected?.stateInsetGeojson ||
    detected?.stateBoundary
      ?.insetGeojson ||
    null;

  const mainFeature =
    detected?.mainFeature ||
    detected?.customFeature ||
    detected?.villageFeature ||
    detected?.districtFeature ||
    detected?.stateFeature ||
    detected?.countryFeature ||
    null;

  const idwCells =
    isInterpolation
      ? analysisResult?.geojson
          ?.features || []
      : [];

  const values =
    idwCells
      .map((feature) =>
        Number(
          feature.properties?.[
            analysisResult?.valueField
          ]
        )
      )
      .filter(
        Number.isFinite
      );

  const minValue =
    values.length
      ? Math.min(...values)
      : Number(
          analysisResult?.geojson
            ?.properties?.min
        );

  const maxValue =
    values.length
      ? Math.max(...values)
      : Number(
          analysisResult?.geojson
            ?.properties?.max
        );

  useEffect(() => {
    if (!open) return;

    const detectedTitle =
      featureName(
        mainFeature,
        "Study Area"
      );

    setTitle(
      detectedTitle ||
        "Study Area"
    );

    setSubtitle(
      isInterpolation &&
        analysisResult?.valueField
        ? `Spatial distribution of ${analysisResult.valueField}`
        : "Location of sampling sites"
    );
  }, [
    open,
    mainFeature,
    isInterpolation,
    analysisResult?.valueField
  ]);

  if (!open) return null;

  const mapSvgProps = {
    title:
      title || "Study Area",
    subtitle,
    source,
    samplingLegend,
    countryFeature,
    stateFeature,
    countryInsetGeojson,
    stateInsetGeojson,
    mainFeature,
    mainPoints: points,
    idwCells,
    valueField:
      analysisResult?.valueField ||
      "",
    minValue:
      Number.isFinite(minValue)
        ? minValue
        : 0,
    maxValue:
      Number.isFinite(maxValue)
        ? maxValue
        : 1,
    isInterpolation,
    showPoints,
    showGrid,
    showBoundary,
    showLabels
  };

  function exportSvg() {
    const svg =
      previewRef.current?.querySelector(
        "svg"
      );

    if (!svg) return;

    const xml =
      new XMLSerializer().serializeToString(
        svg
      );

    const url =
      URL.createObjectURL(
        new Blob(
          [xml],
          {
            type:
              "image/svg+xml;charset=utf-8"
          }
        )
      );

    const link =
      document.createElement("a");

    link.href = url;
    link.download =
      isInterpolation
        ? "verdant-gis-idw-map.svg"
        : "verdant-gis-location-map.svg";

    link.click();

    setTimeout(
      () => URL.revokeObjectURL(url),
      500
    );
  }

  function exportPng() {
    const svg =
      previewRef.current?.querySelector(
        "svg"
      );

    if (!svg) return;

    const xml =
      new XMLSerializer().serializeToString(
        svg
      );

    const url =
      URL.createObjectURL(
        new Blob(
          [xml],
          {
            type:
              "image/svg+xml;charset=utf-8"
          }
        )
      );

    const image =
      new Image();

    image.onload = () => {
      const canvas =
        document.createElement(
          "canvas"
        );

      // A4 landscape at 300 DPI.
      canvas.width = 3508;
      canvas.height = 2480;

      const context =
        canvas.getContext("2d");

      context.fillStyle = "#fff";
      context.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      context.drawImage(
        image,
        0,
        0,
        canvas.width,
        canvas.height
      );

      URL.revokeObjectURL(
        url
      );

      const link =
        document.createElement(
          "a"
        );

      link.href =
        canvas.toDataURL(
          "image/png"
        );

      link.download =
        isInterpolation
          ? "verdant-gis-idw-map.png"
          : "verdant-gis-location-map.png";

      link.click();
    };

    image.src = url;
  }

  return (
    <div className="studio-layout-modal">
      <div className="studio-layout-editor">
        <header className="layout-editor-header">
          <div>
            <span className="section-kicker">
              VERDANT GIS
            </span>
            <h1>Map Layout</h1>
            <p>
              {isInterpolation
                ? "Publication-ready A4 landscape interpolation map."
                : "Publication-ready A4 landscape location map."}
            </p>
          </div>

          <div className="studio-header-actions">
            <button
              className="secondary-btn"
              onClick={onClose}
            >
              <X size={17} /> Close
            </button>

            <button
              className="secondary-btn"
              onClick={exportSvg}
            >
              <Download size={17} /> SVG
            </button>

            <button
              className="primary-btn"
              onClick={exportPng}
            >
              <Download size={17} /> PNG
            </button>
          </div>
        </header>

        <div className="layout-editor-body">
          <aside className="layout-controls studio-sidebar">
            <section className="studio-panel">
              <div className="studio-panel-heading">
                <div>
                  <span className="section-kicker">
                    TEXT
                  </span>
                  <h2>Map text</h2>
                </div>
              </div>

              <label>Title</label>
              <input
                value={title}
                onChange={(e) =>
                  setTitle(e.target.value)
                }
              />

              <label>Subtitle</label>
              <input
                value={subtitle}
                onChange={(e) =>
                  setSubtitle(
                    e.target.value
                  )
                }
              />

              <label>Source</label>
              <input
                value={source}
                onChange={(e) =>
                  setSource(
                    e.target.value
                  )
                }
              />

              <label>Sampling legend</label>
              <input
                value={samplingLegend}
                onChange={(e) =>
                  setSamplingLegend(
                    e.target.value
                  )
                }
              />
            </section>

            <section className="studio-panel">
              <div className="studio-panel-heading">
                <div>
                  <span className="section-kicker">
                    ELEMENTS
                  </span>
                  <h2>Map elements</h2>
                </div>
              </div>

              <label className="layout-check">
                <input
                  type="checkbox"
                  checked={showPoints}
                  onChange={(e) =>
                    setShowPoints(
                      e.target.checked
                    )
                  }
                />{" "}
                Show sampling points
              </label>

              <label className="layout-check">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) =>
                    setShowGrid(
                      e.target.checked
                    )
                  }
                />{" "}
                Show coordinate grid
              </label>

              <label className="layout-check">
                <input
                  type="checkbox"
                  checked={showBoundary}
                  onChange={(e) =>
                    setShowBoundary(
                      e.target.checked
                    )
                  }
                />{" "}
                Show main boundary
              </label>

              <label className="layout-check">
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={(e) =>
                    setShowLabels(
                      e.target.checked
                    )
                  }
                />{" "}
                Show boundary label
              </label>
            </section>

            {isInterpolation && (
              <section className="studio-panel">
                <div className="studio-panel-heading">
                  <div>
                    <span className="section-kicker">
                      INTERPOLATION
                    </span>
                    <h2>IDW result</h2>
                  </div>
                </div>

                <p className="studio-muted">
                  {analysisResult.valueField} · power{" "}
                  {analysisResult.power} ·{" "}
                  {idwCells.length} cells
                </p>

                <div className="idw-preview-gradient" />

                <div className="idw-range">
                  <span>
                    {formatNumber(
                      minValue
                    )}
                  </span>
                  <span>
                    {formatNumber(
                      maxValue
                    )}
                  </span>
                </div>

                {analysisResult.boundaryName && (
                  <p className="studio-muted">
                    Clipped to:{" "}
                    <strong>
                      {
                        analysisResult.boundaryName
                      }
                    </strong>
                  </p>
                )}
              </section>
            )}
          </aside>

          <main className="layout-canvas-area">
            <div
              className="layout-page"
              ref={previewRef}
            >
              <LayoutSvg
                {...mapSvgProps}
              />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
