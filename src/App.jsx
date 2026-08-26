import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, Route, Routes, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Database,
  Download,
  Map,
  Search,
  ShieldCheck,
  Plus,
  RefreshCw,
  ExternalLink,
  Eye,
  EyeOff,
  Trash2,
  LoaderCircle,
  ShoppingCart,
  Sparkles,
  Layers3,
  Mountain,
  Route as RouteIcon,
  Menu,
  X,
  UserRound,
  CheckCircle2,
  SlidersHorizontal,
  IndianRupee,
  MapPinned,
  LogOut,
  Satellite,
  Mail,
  Phone,
  Send,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import StudioPage from "./studio/StudioPage";
import "./studio/studio.css";
import {
  supabase,
  supabaseReady,
  signIn,
  signUp,
  signOut,
  getDatasets,
  getCurrentUserProfile,
  getCategories,
  createDatasetWithFiles,
  deleteDataset,
  updateDataset,
} from "./supabase";

import "leaflet/dist/leaflet.css";

import L from "leaflet";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Tooltip,
  useMap,
} from "react-leaflet";/* =========================================================
   MAP HELPERS


/* =========================================================
   MAP HELPERS
========================================================= */

function MapAutoFit({ geojson }) {
  const map = useMap();

  useEffect(() => {
    // Leaflet can calculate its size before the Explore grid has finished
    // laying out. Recalculate after mount and on container resize so tiles
    // always fill the full map area without a blank lower section.
    const refresh = () => map.invalidateSize({ pan: false, animate: false });
    const timer = window.setTimeout(refresh, 80);
    window.addEventListener("resize", refresh);

    const container = map.getContainer();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(refresh)
        : null;

    observer?.observe(container);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", refresh);
      observer?.disconnect();
    };
  }, [map]);

  useEffect(() => {
    if (!geojson) return;

    try {
      const layer = window.L?.geoJSON
        ? window.L.geoJSON(geojson)
        : null;

      if (layer && layer.getBounds().isValid()) {
        map.fitBounds(layer.getBounds(), {
          padding: [28, 28],
          maxZoom: 13,
        });
      }
    } catch (e) {
      console.warn("Could not calculate GeoJSON bounds", e);
    }
  }, [geojson, map]);

  return null;
}


function HeroWorldMap() {
  // These are real geographic coordinates, so the markers stay on the
  // correct countries regardless of the map projection.
  const markers = [
    { position: [20.5937, 78.9629], label: "India" },
    { position: [50.8503, 4.3517], label: "Europe" },
    { position: [23.6345, -102.5528], label: "Americas" },
    { position: [-25.2744, 133.7751], label: "Australia" },
  ];

  return (
    <div className="hero-world-map">
      <MapContainer
        center={[20, 0]}
        zoom={1.45}
        minZoom={1.45}
        maxZoom={1.45}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        keyboard={false}
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap &copy; CARTO"
        />

        {markers.map((marker) => (
          <CircleMarker
            key={marker.label}
            center={marker.position}
            radius={6}
            pathOptions={{
              color: "#a9e2c8",
              weight: 2,
              fillColor: "#4fd39a",
              fillOpacity: 0.95,
            }}
          >
            <Tooltip permanent direction="top" offset={[0, -7]} className="hero-map-tooltip">
              {marker.label}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>

      <div className="hero-world-overlay" />
      <div className="hero-world-grid" />

      <div className="hero-world-caption">
        <span className="section-kicker">GLOBAL GIS CATALOGUE</span>
        <b>Discover data across the world.</b>
        <span>Explore published geospatial datasets with map-first previews.</span>
      </div>
    </div>
  );
}

function PreviewGeoBounds({ geojson }) {
  const map = useMap();

  useEffect(() => {
    if (!geojson || !window.L) return;

    try {
      const layer = window.L.geoJSON(geojson);
      const bounds = layer.getBounds();

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20], maxZoom: 12 });
      }
    } catch (e) {
      // Keep the card preview usable even if a malformed preview is uploaded.
    }
  }, [geojson, map]);

  return null;
}

function MiniGeoPreview({ url, imageUrl, title }) {
  /*
   * Catalogue cards must never download the full GeoJSON preview.
   * The GeoJSON is reserved for /explore, where it is actually needed
   * for interactive mapping and visualization.
   */
  if (imageUrl) {
    return (
      <div
        className="mini-map mini-map-image"
        aria-label={`${title || "Dataset"} preview`}
      >
        <img
          src={imageUrl}
          alt={`${title || "Dataset"} preview`}
          loading="lazy"
          decoding="async"
        />
        <span className="preview-pill">
          <Eye size={13} /> Dataset preview
        </span>
        <span className="mini-map-title">{title || "GIS dataset"}</span>
      </div>
    );
  }

  return (
    <div className="mini-map mini-map-fallback">
      <div className="mini-grid"></div>
      <div className="mini-land"></div>
      <span className="preview-pill"><Map size={13} /> Preview map</span>
      <Map className="dataset-watermark" size={38} />
      <span className="mini-map-title">{title || "GIS dataset"}</span>
    </div>
  );
}

function DatasetPreviewImage({ url, title }) {
  if (!url) return null;

  return (
    <div className="dataset-image-preview" aria-label={`${title || "Dataset"} preview`}>
      <img
        src={url}
        alt={`${title || "Dataset"} preview`}
        loading="eager"
        decoding="async"
      />
    </div>
  );
}

const VISUAL_PALETTES = {
  Spectrum: [
    "#3b4cc0", "#5b6fd0", "#7b8fd1", "#4aa6b8",
    "#75b798", "#a7cf8c", "#d6d94f", "#f5c04b",
    "#f28e38", "#d84a5a", "#9b3f8f", "#303f9f",
  ],
  Viridis: [
    "#440154", "#482878", "#3e4989", "#31688e",
    "#26828e", "#1f9e89", "#35b779", "#6ece58",
    "#b5de2b", "#fde725",
  ],
  Earth: [
    "#543005", "#8c510a", "#bf812d", "#dfc27d",
    "#c7eae5", "#80cdc1", "#35978f", "#01665e",
    "#003c30", "#1b7837",
  ],
  Cool: [
    "#313695", "#4575b4", "#74add1", "#abd9e9",
    "#e0f3f8", "#fee090", "#fdae61", "#f46d43",
    "#d73027", "#a50026",
  ],
};

function featureStyle() {
  return {
    color: "#0b6b50",
    weight: 2,
    opacity: 0.95,
    fillColor: "#38a169",
    fillOpacity: 0.22,
  };
}

function getFeatureProperties(geojson) {
  if (!geojson) return [];

  if (geojson.type === "Feature") {
    return [geojson.properties || {}];
  }

  if (geojson.type === "FeatureCollection") {
    return (geojson.features || []).map(
      (feature) => feature?.properties || {}
    );
  }

  return [];
}

function getVisualizationFields(geojson) {
  const properties = getFeatureProperties(geojson);
  const keys = new Set();

  // Attribute names normally repeat across all features. Inspecting the
  // first 1000 is enough to build the control without scanning huge files.
  for (const props of properties.slice(0, 1000)) {
    Object.keys(props).forEach((key) => keys.add(key));
  }

  return Array.from(keys);
}

function buildFeatureVisualization(
  geojson,
  displayMode,
  attributeField,
  colorPalette
) {
  const properties = getFeatureProperties(geojson);
  const palette =
    VISUAL_PALETTES[colorPalette] ||
    VISUAL_PALETTES.Spectrum;

  if (
    !attributeField ||
    displayMode === "single" ||
    !properties.length
  ) {
    return {
      getStyle: () => featureStyle(),
      legend: [],
    };
  }

  const values = properties
    .map((props) => props?.[attributeField])
    .filter(
      (value) =>
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
    );

  if (!values.length) {
    return {
      getStyle: () => featureStyle(),
      legend: [],
    };
  }

  if (displayMode === "graduated") {
    const numericValues = values
      .map(Number)
      .filter(Number.isFinite);

    if (numericValues.length !== values.length) {
      return buildFeatureVisualization(
        geojson,
        "category",
        attributeField,
        colorPalette
      );
    }

    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    const bins = Math.min(5, palette.length);
    const step = max === min ? 1 : (max - min) / bins;

    const legend = Array.from(
      { length: bins },
      (_, index) => {
        const lower =
          index === 0
            ? min
            : min + step * index;
        const upper =
          index === bins - 1
            ? max
            : min + step * (index + 1);

        return {
          label:
            min === max
              ? String(min)
              : `${Number(lower.toFixed(2))} – ${Number(upper.toFixed(2))}`,
          color: palette[index],
          lower,
          upper,
        };
      }
    );

    const getStyle = (feature) => {
      const value = Number(
        feature?.properties?.[attributeField]
      );

      let index = 0;

      if (Number.isFinite(value) && max !== min) {
        index = Math.min(
          bins - 1,
          Math.max(
            0,
            Math.floor((value - min) / step)
          )
        );
      }

      return {
        ...featureStyle(),
        color: palette[index],
        fillColor: palette[index],
        fillOpacity: 0.5,
      };
    };

    return { getStyle, legend };
  }

  let uniqueValues = Array.from(
    new Set(values.map((value) => String(value)))
  );

  const allNumeric = uniqueValues.every((value) =>
    Number.isFinite(Number(value))
  );

  if (allNumeric) {
    uniqueValues = uniqueValues.sort(
      (a, b) => Number(a) - Number(b)
    );
  }

  // Give every category a colour. For datasets with more categories than
  // the base palette, generate additional shades while preserving the
  // selected palette family instead of collapsing values into "Other".
  const categoryColors = uniqueValues.map((_, index) => {
    const base = palette[index % palette.length];
    const cycle = Math.floor(index / palette.length);

    if (cycle === 0) return base;

    // Deterministically vary saturation/lightness for additional cycles.
    const hex = base.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const l = (max + min) / 2;
    const d = max - min;
    let h = 0;
    let sat = 0;

    if (d !== 0) {
      sat = d / (1 - Math.abs(2 * l - 1));
      if (max === r / 255) h = ((g - b) / 255 / d) % 6;
      else if (max === g / 255) h = (b - r) / 255 / d + 2;
      else h = (r - g) / 255 / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }

    const lightness = Math.max(0.28, Math.min(0.72, l + (cycle % 2 ? 0.10 : -0.08)));
    const saturation = Math.max(0.48, Math.min(0.90, sat || 0.65));
    return `hsl(${Math.round(h)}, ${Math.round(saturation * 100)}%, ${Math.round(lightness * 100)}%)`;
  });

  const colorByValue = Object.fromEntries(
    uniqueValues.map((value, index) => [
      value,
      categoryColors[index],
    ])
  );

  const legend = uniqueValues.map((value, index) => ({
    label: value,
    color: categoryColors[index],
  }));

  const getStyle = (feature) => {
    const value = String(
      feature?.properties?.[attributeField] ?? ""
    );

    const color = colorByValue[value] || "#64748b";

    return {
      ...featureStyle(),
      color,
      fillColor: color,
      fillOpacity: 0.5,
    };
  };

  return { getStyle, legend };
}


function haversine(a, b) {
  const R = 6371000;

  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;

  const dp = ((b.lat - a.lat) * Math.PI) / 180;
  const dl = ((b.lng - a.lng) * Math.PI) / 180;

  const x =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) *
      Math.cos(p2) *
      Math.sin(dl / 2) ** 2;

  return (
    2 *
    R *
    Math.atan2(
      Math.sqrt(x),
      Math.sqrt(1 - x)
    )
  );
}


function ringArea(coords) {
  if (!coords || coords.length < 3) return 0;

  const R = 6371000;

  const lat0 =
    (coords.reduce((s, p) => s + p[1], 0) /
      coords.length) *
    (Math.PI / 180);

  const projected = coords.map(([lng, lat]) => [
    R *
      lng *
      (Math.PI / 180) *
      Math.cos(lat0),

    R *
      lat *
      (Math.PI / 180),
  ]);

  let area = 0;

  for (let i = 0; i < projected.length - 1; i++) {
    area +=
      projected[i][0] *
        projected[i + 1][1] -
      projected[i + 1][0] *
        projected[i][1];
  }

  return Math.abs(area) / 2;
}


function geometryAreaSqM(geometry) {
  if (!geometry) return 0;

  const poly = (rings) => {
    if (!rings?.length) return 0;

    return Math.max(
      0,
      ringArea(rings[0]) -
        rings
          .slice(1)
          .reduce(
            (s, r) => s + ringArea(r),
            0
          )
    );
  };

  if (geometry.type === "Polygon") {
    return poly(geometry.coordinates);
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.reduce(
      (s, p) => s + poly(p),
      0
    );
  }

  return 0;
}


/* =========================================================
   MAP VIEWPORT
========================================================= */

function MapViewportController({
  geojson,
  layerOpacity,
  basemap,
  measureMode,
  onMeasurePoint,
  fullscreen,
  setFullscreen,
}) {
  const map = useMap();

  useEffect(() => {
    // Leaflet can calculate its size before the Explore grid has finished
    // laying out. Recalculate after mount and on container resize so tiles
    // always fill the full map area without a blank lower section.
    const refresh = () => map.invalidateSize({ pan: false, animate: false });
    const timer = window.setTimeout(refresh, 80);
    window.addEventListener("resize", refresh);

    const container = map.getContainer();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(refresh)
        : null;

    observer?.observe(container);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", refresh);
      observer?.disconnect();
    };
  }, [map]);

  useEffect(() => {
    if (!geojson) return;

    try {
      const layer = window.L?.geoJSON
        ? window.L.geoJSON(geojson)
        : null;

      if (layer && layer.getBounds().isValid()) {
        map.fitBounds(layer.getBounds(), {
          padding: [34, 34],
          maxZoom: 14,
        });
      }
    } catch (e) {}
  }, [geojson, map]);

  useEffect(() => {
    if (!measureMode) return;

    const handler = (e) =>
      onMeasurePoint(e.latlng);

    map.on("click", handler);

    return () =>
      map.off("click", handler);
  }, [
    map,
    measureMode,
    onMeasurePoint,
  ]);

  useEffect(() => {
    const handler = () =>
      setFullscreen(
        Boolean(document.fullscreenElement)
      );

    document.addEventListener(
      "fullscreenchange",
      handler
    );

    return () =>
      document.removeEventListener(
        "fullscreenchange",
        handler
      );
  }, [setFullscreen]);

  return null;
}


/* =========================================================
   GIS MAP
========================================================= */

function GISMap({
  geojson = null,
  height = 520,
  layerKey = "dataset",
  displayMode = "single",
  attributeField = "",
  colorPalette = "Spectrum",
}) {
  const defaultCenter = [10.3, 76.3];

  const [basemap, setBasemap] =
    useState("street");

  const [opacity, setOpacity] =
    useState(0.22);

  const [measureMode, setMeasureMode] =
    useState(null);

  const [measurePoints, setMeasurePoints] =
    useState([]);

  const [tableOpen, setTableOpen] =
    useState(false);

  const [tableSearch, setTableSearch] =
    useState("");

  const [fullscreen, setFullscreen] =
    useState(false);

  const mapWrapRef = useRef(null);

  const featureCount =
    geojson?.features?.length ??
    (geojson?.type === "Feature" ? 1 : 0);

  const features =
    geojson?.type === "FeatureCollection"
      ? geojson.features
      : geojson?.type === "Feature"
      ? [geojson]
      : [];

  const visualization = useMemo(
    () =>
      buildFeatureVisualization(
        geojson,
        displayMode,
        attributeField,
        colorPalette
      ),
    [
      geojson,
      displayMode,
      attributeField,
      colorPalette,
    ]
  );

  const filteredFeatures = useMemo(
    () =>
      features
        .filter((f) => {
          if (!tableSearch.trim()) return true;

          const q =
            tableSearch.toLowerCase();

          return Object.entries(
            f.properties || {}
          ).some(([k, v]) =>
            `${k} ${v ?? ""}`
              .toLowerCase()
              .includes(q)
          );
        })
        .slice(0, 200),
    [features, tableSearch]
  );

  const onMeasurePoint = (latlng) => {
    setMeasurePoints((prev) => [
      ...prev,
      latlng,
    ]);
  };

  const clearMeasure = () => {
    setMeasurePoints([]);
    setMeasureMode(null);
  };

  const distance =
    measurePoints.length > 1
      ? measurePoints.reduce(
          (s, p, i) =>
            i === 0
              ? 0
              : s +
                haversine(
                  measurePoints[i - 1],
                  p
                ),
          0
        )
      : 0;

  const measurementArea =
    measureMode === "area" &&
    measurePoints.length >= 3
      ? ringArea(
          measurePoints
            .concat([measurePoints[0]])
            .map((p) => [
              p.lng,
              p.lat,
            ])
        )
      : 0;

  const formatDistance = (m) =>
    m >= 1000
      ? `${(m / 1000).toFixed(2)} km`
      : `${Math.round(m)} m`;

  const formatArea = (m2) =>
    m2 >= 1000000
      ? `${(m2 / 1000000).toFixed(2)} km²`
      : `${Math.round(
          m2
        ).toLocaleString()} m²`;

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      mapWrapRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  const basemaps = {
    street: {
      name: "Street",
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution:
        "&copy; OpenStreetMap contributors",
    },

    satellite: {
      name: "Satellite",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution:
        "Tiles &copy; Esri",
    },

    terrain: {
      name: "Terrain",
      url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      attribution:
        "Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap",
    },
  };

  const onEachFeature = (
    feature,
    layer
  ) => {
    const props =
      feature?.properties || {};

    const entries =
      Object.entries(props).slice(
        0,
        12
      );

    layer.on({
      mouseover: (e) =>
        e.target.setStyle({
          weight: 3,
          fillOpacity: Math.min(
            opacity + 0.18,
            0.8
          ),
        }),

      mouseout: (e) =>
        e.target.setStyle(
          visualization.getStyle(feature)
        ),
    });

    if (entries.length) {
      const html = `
        <div style="min-width:190px">
          <strong>Feature information</strong>
          <div style="margin-top:7px">
            ${entries
              .map(
                ([k, v]) =>
                  `<div style="display:flex;gap:8px;margin:3px 0">
                    <b>${String(k).replace(
                      /</g,
                      "&lt;"
                    )}</b>
                    <span>${String(
                      v ?? ""
                    ).replace(
                      /</g,
                      "&lt;"
                    )}</span>
                  </div>`
              )
              .join("")}
          </div>
        </div>
      `;

      layer.bindPopup(html, {
        maxWidth: 360,
        className: "feature-popup",
        closeButton: true,
        autoPan: true,
        autoPanPadding: [24, 24],
      });
    }
  };

  return (
    <div
      ref={mapWrapRef}
      style={{
        height,
        width: "100%",
      }}
      className={`real-map-wrap advanced-map ${
        fullscreen
          ? "map-fullscreen"
          : ""
      }`}
    >
      <MapContainer
        center={defaultCenter}
        zoom={7}
        scrollWheelZoom
        preferCanvas
        style={{
          height: "100%",
          width: "100%",
        }}
      >
        <TileLayer
          attribution={
            basemaps[basemap]
              .attribution
          }
          url={
            basemaps[basemap].url
          }
        />

        {geojson && (
          <>
            <MapViewportController
              geojson={geojson}
              layerOpacity={opacity}
              basemap={basemap}
              measureMode={measureMode}
              onMeasurePoint={
                onMeasurePoint
              }
              fullscreen={fullscreen}
              setFullscreen={
                setFullscreen
              }
            />

            <GeoJSON
              key={`${layerKey}-${displayMode}-${attributeField}-${colorPalette}-${opacity}`}
              data={geojson}
              style={(feature) => {
                const style =
                  visualization.getStyle(feature);

                return {
                  ...style,
                  fillOpacity:
                    displayMode === "single"
                      ? opacity
                      : Math.min(
                          style.fillOpacity ?? opacity,
                          opacity + 0.25
                        ),
                };
              }}
              onEachFeature={
                onEachFeature
              }
            />
          </>
        )}

        {measurePoints.length > 0 && (
          <GeoJSON
            data={{
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  properties: {},
                  geometry: {
                    type: "LineString",
                    coordinates:
                      measurePoints.map(
                        (p) => [
                          p.lng,
                          p.lat,
                        ]
                      ),
                  },
                },
              ],
            }}
            style={{
              color: "#d88a1d",
              weight: 3,
              dashArray: "6 5",
            }}
          />
        )}
      </MapContainer>

      <div className="gis-toolbar">
        <div className="gis-tool-group">
          {Object.entries(
            basemaps
          ).map(([key, val]) => (
            <button
              key={key}
              className={
                basemap === key
                  ? "active"
                  : ""
              }
              onClick={() =>
                setBasemap(key)
              }
              title={`${val.name} basemap`}
            >
              {key === "street" ? (
                <Map size={15} />
              ) : key === "satellite" ? (
                <Satellite
                  size={15}
                />
              ) : (
                <Mountain size={15} />
              )}

              <span>{val.name}</span>
            </button>
          ))}
        </div>

        <div className="gis-tool-group">
          <button
            className={
              measureMode ===
              "distance"
                ? "active"
                : ""
            }
            onClick={() => {
              setMeasureMode(
                measureMode ===
                  "distance"
                  ? null
                  : "distance"
              );
              setMeasurePoints([]);
            }}
            title="Measure distance"
          >
            ↔ <span>Distance</span>
          </button>

          <button
            className={
              measureMode === "area"
                ? "active"
                : ""
            }
            onClick={() => {
              setMeasureMode(
                measureMode ===
                  "area"
                  ? null
                  : "area"
              );
              setMeasurePoints([]);
            }}
            title="Measure area"
          >
            ⌂ <span>Area</span>
          </button>

          {measureMode && (
            <button
              onClick={
                clearMeasure
              }
              title="Clear measurement"
            >
              × <span>Clear</span>
            </button>
          )}

          <button
            onClick={
              toggleFullscreen
            }
            title="Fullscreen"
          >
            ⛶ <span>Full</span>
          </button>
        </div>
      </div>

      {visualization.legend.length > 0 && (
        <div className="gis-legend">
          <strong>{attributeField}</strong>

          <div className="gis-legend-items">
            {visualization.legend.map((item, index) => (
              <div className="gis-legend-item" key={`${item.label}-${index}`}>
                <span
                  className="gis-legend-swatch"
                  style={{ background: item.color }}
                />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="gis-opacity">
        <span>Layer</span>

        <input
          aria-label="Layer opacity"
          type="range"
          min="0.05"
          max="0.8"
          step="0.05"
          value={opacity}
          onChange={(e) =>
            setOpacity(
              Number(e.target.value)
            )
          }
        />

        <span>
          {Math.round(
            opacity * 100
          )}
          %
        </span>
      </div>

      <div className="map-status">
        <span className="map-dot" />{" "}
        {geojson
          ? `Layer loaded · ${featureCount.toLocaleString()} feature${
              featureCount === 1
                ? ""
                : "s"
            }`
          : "Loading GIS preview…"}
      </div>

      {measureMode && (
        <div className="measure-panel">
          <b>
            {measureMode ===
            "distance"
              ? "Distance measurement"
              : "Area measurement"}
          </b>

          <span>
            Click points on the map.
          </span>

          {measureMode ===
            "distance" &&
            measurePoints.length >
              1 && (
              <strong>
                {formatDistance(
                  distance
                )}
              </strong>
            )}

          {measureMode === "area" &&
            measurePoints.length >=
              3 && (
              <strong>
                {formatArea(
                  measurementArea
                )}
              </strong>
            )}

          {measurePoints.length >
            0 && (
            <small>
              {measurePoints.length}{" "}
              point
              {measurePoints.length ===
              1
                ? ""
                : "s"}
            </small>
          )}
        </div>
      )}

      <button
        className="attribute-button"
        onClick={() =>
          setTableOpen(true)
        }
      >
        <Database size={15} />{" "}
        Attributes{" "}
        <span>{featureCount}</span>
      </button>

      {tableOpen && (
        <div className="attribute-overlay">
          <div className="attribute-modal">
            <div className="attribute-head">
              <div>
                <span className="section-kicker">
                  DATA EXPLORER
                </span>

                <h3>
                  Attribute table
                </h3>

                <p>
                  {featureCount.toLocaleString()}{" "}
                  features · showing up
                  to 200 rows
                </p>
              </div>

              <button
                onClick={() =>
                  setTableOpen(false)
                }
                className="modal-close"
              >
                ×
              </button>
            </div>

            <div className="attribute-search">
              <Search size={15} />

              <input
                value={tableSearch}
                onChange={(e) =>
                  setTableSearch(
                    e.target.value
                  )
                }
                placeholder="Search attributes..."
              />
            </div>

            <div className="attribute-table-wrap">
              <table className="attribute-table">
                <thead>
                  <tr>
                    {Object.keys(
                      filteredFeatures[0]
                        ?.properties || {}
                    )
                      .slice(0, 10)
                      .map((k) => (
                        <th key={k}>
                          {k}
                        </th>
                      ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredFeatures.map(
                    (f, i) => (
                      <tr key={i}>
                        {Object.keys(
                          filteredFeatures[0]
                            ?.properties || {}
                        )
                          .slice(0, 10)
                          .map(
                            (k) => (
                              <td key={k}>
                                {String(
                                  f
                                    .properties?.[
                                    k
                                  ] ??
                                    "—"
                                )}
                              </td>
                            )
                          )}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* =========================================================
   PAYMENT
========================================================= */

const PAYMENT_API =
  import.meta.env.VITE_PAYMENT_API_URL ||
  "http://localhost:8787";


async function getAccessToken() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured."
    );
  }

  const { data, error } =
    await supabase.auth.getSession();

  if (
    error ||
    !data.session?.access_token
  ) {
    throw new Error(
      "Please sign in before checkout."
    );
  }

  return data.session.access_token;
}


async function paymentApi(
  path,
  options = {}
) {
  const token =
    await getAccessToken();

  const response = await fetch(
    `${PAYMENT_API}${path}`,
    {
      ...options,
      headers: {
        "Content-Type":
          "application/json",

        Authorization: `Bearer ${token}`,

        ...(options.headers || {}),
      },
    }
  );

  const body =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      body.error ||
        "Payment service error."
    );
  }

  return body;
}


async function secureDownloadApi(
  path
) {
  const token =
    await getAccessToken();

  const response = await fetch(
    `${PAYMENT_API}${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const contentType =
    response.headers.get(
      "content-type"
    ) || "";

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    const body =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        body.error ||
          "Could not start download."
      );
    }

    return {
      type: "json",
      ...body,
    };
  }

  if (!response.ok) {
    const text =
      await response
        .text()
        .catch(() => "");

    throw new Error(
      text ||
        "Could not start download."
    );
  }

  const blob =
    await response.blob();

  const disposition =
    response.headers.get(
      "content-disposition"
    ) || "";

  const match =
    disposition.match(
      /filename="?([^";]+)"?/i
    );

  const filename =
    match?.[1] ||
    "verdant-gis-dataset";

  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement("a");

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(
    () => URL.revokeObjectURL(url),
    1000
  );

  return {
    type: "file",
    title: filename,
  };
}


function loadRazorpayScript() {
  return new Promise(
    (resolve, reject) => {
      if (window.Razorpay) {
        return resolve(true);
      }

      const existing =
        document.querySelector(
          'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
        );

      if (existing) {
        existing.addEventListener(
          "load",
          () => resolve(true),
          { once: true }
        );

        existing.addEventListener(
          "error",
          () =>
            reject(
              new Error(
                "Could not load Razorpay Checkout."
              )
            ),
          { once: true }
        );

        return;
      }

      const script =
        document.createElement(
          "script"
        );

      script.src =
        "https://checkout.razorpay.com/v1/checkout.js";

      script.async = true;

      script.onload = () =>
        resolve(true);

      script.onerror = () =>
        reject(
          new Error(
            "Could not load Razorpay Checkout."
          )
        );

      document.body.appendChild(
        script
      );
    }
  );
}


/* =========================================================
   CART
========================================================= */

const CART_KEY =
  "verdant_gis_cart";


function readCart() {
  try {
    return JSON.parse(
      localStorage.getItem(
        CART_KEY
      ) || "[]"
    );
  } catch {
    return [];
  }
}


function writeCart(items) {
  localStorage.setItem(
    CART_KEY,
    JSON.stringify(items)
  );

  window.dispatchEvent(
    new Event(
      "verdant-cart-updated"
    )
  );
}


function addToCart(dataset) {
  const item = {
    /*
     * IMPORTANT:
     * id MUST be the Supabase UUID.
     * slug is only used for URLs.
     */
    id: dataset.id,

    title: dataset.title,

    slug:
      dataset.slug ||
      dataset.id,

    category:
      dataset.category ||
      "GIS Data",

    location:
      dataset.location ||
      dataset.coverage ||
      "",

    price: Number(
      dataset.price || 0
    ),

    currency:
      dataset.currency ||
      "INR",

    formats:
      dataset.formats || [],

    features:
      dataset.features ||
      dataset.feature_count ||
      "—",

    preview_geojson_url:
      dataset.preview_geojson_url ||
      null,

    download_path:
      dataset.download_path ||
      null,
  };

  const current =
    readCart();

  if (
    current.some(
      (x) => x.id === item.id
    )
  ) {
    return false;
  }

  writeCart([
    ...current,
    item,
  ]);

  return true;
}


function removeFromCart(id) {
  writeCart(
    readCart().filter(
      (x) => x.id !== id
    )
  );
}


function clearCart() {
  writeCart([]);
}


function useCart() {
  const [items, setItems] =
    useState(() =>
      readCart()
    );

  useEffect(() => {
    const sync = () =>
      setItems(readCart());

    window.addEventListener(
      "verdant-cart-updated",
      sync
    );

    window.addEventListener(
      "storage",
      sync
    );

    return () => {
      window.removeEventListener(
        "verdant-cart-updated",
        sync
      );

      window.removeEventListener(
        "storage",
        sync
      );
    };
  }, []);

  return items;
}


/* =========================================================
   NAVIGATION
========================================================= */

function Nav() {
  const [open, setOpen] =
    useState(false);

  const [profile, setProfile] =
    useState(null);

  const cart = useCart();

  useEffect(() => {
    let active = true;

    if (!supabase)
      return undefined;

    getCurrentUserProfile()
      .then(({ profile: p }) => {
        if (active) {
          setProfile(p || null);
        }
      })
      .catch(() => {
        if (active) {
          setProfile(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const isAdmin =
    profile?.role === "admin";

  async function handleSignOut() {
    try {
      await signOut();
    } finally {
      setProfile(null);
      setOpen(false);
      window.location.assign("/");
    }
  }

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link
          className="brand"
          to={
            isAdmin
              ? "/admin"
              : "/"
          }
          onClick={() =>
            setOpen(false)
          }
        >
          <span className="brand-mark">
            V
          </span>

          <span>
            <b>VERDANT</b>
            <small>GIS</small>
          </span>
        </Link>

        <nav
          className={
            open
              ? "nav-links open"
              : "nav-links"
          }
        >
          {!isAdmin && (
            <>
              <Link
                to="/store"
                onClick={() =>
                  setOpen(false)
                }
              >
                Explore Data
              </Link>

              <Link
                to="/explore"
                onClick={() =>
                  setOpen(false)
                }
              >
                Map Explorer
              </Link>
              <Link
                to="/studio"
                onClick={() => setOpen(false)}
              >
                GIS Studio
              </Link>
              <a
                href="/#categories"
                onClick={() =>
                  setOpen(false)
                }
              >
                Categories
              </a>

              <a
                href="/#about"
                onClick={() =>
                  setOpen(false)
                }
              >
                About
              </a>

              <Link
                to="/contact"
                onClick={() =>
                  setOpen(false)
                }
              >
                Contact
              </Link>
            </>
          )}

          {isAdmin && (
            <Link
              to="/admin"
              onClick={() =>
                setOpen(false)
              }
            >
              Admin Portal
            </Link>
          )}
        </nav>

        <div className="nav-actions">
          {!isAdmin && (
            <Link
              className="icon-btn cart-nav-btn"
              to="/cart"
              aria-label="Cart"
            >
              <ShoppingCart
                size={19}
              />

              {cart.length > 0 && (
                <span className="cart-dot">
                  {cart.length}
                </span>
              )}
            </Link>
          )}

          {isAdmin ? (
            <>
              <Link
                className="account-btn"
                to="/admin"
              >
                <ShieldCheck
                  size={17}
                />
                Admin Portal
              </Link>

              <button
                type="button"
                className="admin-signout-btn"
                onClick={
                  handleSignOut
                }
                title="Sign out of Admin Portal"
              >
                <LogOut size={16} />
                <span>
                  Sign out
                </span>
              </button>
            </>
          ) : (
            <Link
              className="account-btn"
              to="/dashboard"
            >
              <UserRound
                size={17}
              />
              Account
            </Link>
          )}

          <button
            className="mobile-menu"
            onClick={() =>
              setOpen(!open)
            }
            aria-label="Menu"
          >
            {open ? (
              <X />
            ) : (
              <Menu />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}


/* =========================================================
   HOME
========================================================= */

function Hero() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  function submitSearch(e) {
    e.preventDefault();
    const q = query.trim();

    if (q) {
      navigate(`/store?q=${encodeURIComponent(q)}`);
    } else {
      navigate("/store");
    }
  }

  return (
    <section className="hero">
      <div className="hero-grid">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="pulse"></span>
            India-focused geospatial marketplace
          </div>

          <h1>
            Geospatial data.
            <br />
            <em>Ready to explore.</em>
          </h1>

          <p>
            Discover reliable GIS datasets for agriculture,
            research, planning and location intelligence —
            preview them on a map before you buy.
          </p>

          <form className="hero-search" onSubmit={submitSearch}>
            <Search size={20} />

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search datasets, locations or themes..."
              aria-label="Search datasets"
            />

            <button type="submit">Find data</button>
          </form>

          <div className="hero-meta">
            <span>
              <ShieldCheck size={16} />
              Quality checked
            </span>

            <span>
              <Map size={16} />
              Interactive previews
            </span>

            <span>
              <Download size={16} />
              Instant downloads
            </span>
          </div>
        </div>

        <div className="hero-map">
          <div className="map-toolbar">
            <span className="live">
              <i></i> LIVE WORLD MAP
            </span>

            <Link to="/explore">Map Explorer</Link>
            <Link to="/store">Find data</Link>
          </div>

          <HeroWorldMap />
        </div>
      </div>
    </section>
  );
}

function slugifyCategory(name = "") {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function CategorySection() {
  const [rows, setRows] = useState([]);
  const [datasets, setDatasets] = useState([]);

  useEffect(() => {
    let active = true;

    Promise.all([getCategories(), getDatasets()]).then(
      ([categoriesResult, datasetsResult]) => {
        if (!active) return;
        setRows(categoriesResult.data || []);
        setDatasets(datasetsResult.data || []);
      }
    );

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="section" id="categories">
      <div className="section-head">
        <div>
          <span className="section-kicker">BROWSE</span>
          <h2>Find data by category</h2>
        </div>

        <Link to="/categories" className="text-link">
          All categories <ArrowRight size={16} />
        </Link>
      </div>

      {!rows.length ? (
        <div className="empty-state">
          <Database size={30} />
          <h3>No categories yet</h3>
          <p>Published datasets will appear here automatically when their categories are configured.</p>
        </div>
      ) : (
        <div className="category-grid">
          {rows.map((c) => {
            const count = datasets.filter(
              (d) =>
                d.category_id === c.id &&
                d.status === "published"
            ).length;

            return (
              <Link
                className="category-card"
                to={`/categories/${slugifyCategory(c.name)}`}
                key={c.id}
              >
                <span className="category-icon">
                  <Layers3 size={22} />
                </span>

                <b>{c.name}</b>

                <small>
                  {count} {count === 1 ? "dataset" : "datasets"}
                </small>

                <ArrowRight className="cat-arrow" size={17} />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}


/* =========================================================
   DATASET CARD
========================================================= */

function DatasetCard({ d }) {
  const Icon = d.icon || Map;

  return (
    <article className="dataset-card">
      <Link
        to={`/dataset/${d.slug}`}
        className="dataset-preview"
      >
        <MiniGeoPreview
          url={d.preview_geojson_url}
          imageUrl={d.thumbnail_url}
          title={d.title}
        />
      </Link>

      <div className="dataset-body">
        <div className="tag-row">
          <span className="tag">
            {d.category}
          </span>

          <span className="location">
            {d.location}
          </span>
        </div>

        <Link
          to={`/dataset/${d.slug}`}
        >
          <h3>{d.title}</h3>
        </Link>

        <p>{d.description}</p>

        <div className="dataset-specs">
          <span>
            {d.features} features
          </span>

          {d.formats
            .slice(0, 3)
            .map((f) => (
              <span key={f}>
                {f}
              </span>
            ))}
        </div>

        <div className="dataset-bottom">
          <strong>
            {d.price === 0
              ? "FREE"
              : `₹${d.price.toLocaleString(
                  "en-IN"
                )}`}
          </strong>

          <Link
            to={`/dataset/${d.slug}`}
            className="view-btn"
          >
            View dataset{" "}
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}


/* =========================================================
   FEATURED
   IMPORTANT FIX:
   id = UUID
   slug = slug
========================================================= */

function Featured() {
  const [rows, setRows] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    getDatasets()
      .then(({ data }) => {
        setRows(
          (data || [])
            .slice(0, 3)
            .map((d) => ({
              ...d,

              // FIXED:
              // Keep Supabase UUID
              id: d.id,

              // Keep slug separately
              slug: d.slug,

              category:
                d.categories?.name ||
                "GIS Data",

              location:
                d.location ||
                d.coverage ||
                "",

              price: Number(
                d.price || 0
              ),

              formats:
                d.formats || [],

              features:
                d.feature_count ||
                "—",

              icon: Map,
            }))
        );

        setLoading(false);
      })
      .catch(() =>
        setLoading(false)
      );
  }, []);

  return (
    <section className="section featured">
      <div className="section-head">
        <div>
          <span className="section-kicker">
            LIVE CATALOGUE
          </span>

          <h2>
            Featured datasets
          </h2>
        </div>

        <Link
          to="/store"
          className="text-link"
        >
          Explore store{" "}
          <ArrowRight size={16} />
        </Link>
      </div>

      {loading ? (
        <div className="table-loading">
          <LoaderCircle
            className="spin"
            size={26}
          />

          <span>
            Loading live catalogue…
          </span>
        </div>
      ) : !rows.length ? (
        <div className="empty-state">
          <Database size={30} />

          <h3>
            Your catalogue is empty
          </h3>

          <p>
            Published datasets will
            appear here automatically.
          </p>

          <Link
            to="/admin/upload"
            className="primary-btn"
          >
            Add dataset{" "}
            <Plus size={16} />
          </Link>
        </div>
      ) : (
        <div className="dataset-grid">
          {rows.map((d) => (
            <DatasetCard
              d={d}
              key={d.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}


/* =========================================================
   HOME PAGE
========================================================= */

function Home() {
  return (
    <>
      <Nav />

      <main>
        <Hero />

        <CategorySection />

        <Featured />

        <section
          className="trust"
          id="about"
        >
          <div>
            <span className="section-kicker">
              WHY VERDANT GIS
            </span>

            <h2>
              Explore before you buy.
            </h2>

            <p>
              Every premium dataset is
              designed around a simple
              idea: you should be able to
              understand and preview
              geospatial data before
              spending money on it.
            </p>
          </div>

          <div className="trust-items">
            <div>
              <ShieldCheck />

              <b>
                Quality-first
              </b>

              <span>
                Metadata, CRS and
                dataset details presented
                clearly.
              </span>
            </div>

            <div>
              <Map />

              <b>
                Map-first
              </b>

              <span>
                See geographic coverage
                before downloading.
              </span>
            </div>

            <div>
              <Database />

              <b>
                GIS-ready
              </b>

              <span>
                Built for QGIS, ArcGIS,
                Python and research
                workflows.
              </span>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}


/* =========================================================
   STORE
   IMPORTANT FIX:
   id = UUID
   slug = slug
========================================================= */

function Store() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialCategory = searchParams.get("category") || "All";

  const [q, setQ] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);

  const [remoteDatasets, setRemoteDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setQ(searchParams.get("q") || "");
    setCategory(searchParams.get("category") || "All");
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!supabaseReady) {
        if (active) {
          setRemoteDatasets([]);
          setLoading(false);
        }
        return;
      }

      const { data, error } = await getDatasets();
      if (!active) return;

      if (error) {
        setError(error.message || "Could not load live datasets.");
      }

      setRemoteDatasets(
        (data || []).map((d) => ({
          ...d,
          id: d.id,
          slug: d.slug,
          category: d.categories?.name || "GIS Data",
          location: d.location || d.coverage || "India",
          price: Number(d.price || 0),
          formats: d.formats || [],
          features: d.feature_count || "—",
          updated: d.updated_label || "Recently updated",
          icon: Map,
        }))
      );

      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const allDatasets = remoteDatasets;

  const filtered = allDatasets.filter((d) => {
    const searchText = `${d.title || ""} ${d.description || ""} ${d.location || ""} ${d.coverage || ""} ${d.category || ""}`.toLowerCase();

    return (
      (category === "All" || d.category === category) &&
      searchText.includes(q.trim().toLowerCase())
    );
  });

  const categoryOptions = [
    ...new Set(
      allDatasets.map((d) => d.category).filter(Boolean)
    ),
  ].sort();

  function updateSearch(nextQ = q, nextCategory = category) {
    const params = {};

    if (nextQ.trim()) params.q = nextQ.trim();
    if (nextCategory !== "All") params.category = nextCategory;

    setSearchParams(params);
  }

  return (
    <>
      <Nav />

      <main className="store-page">
        <div className="page-hero">
          <span className="section-kicker">VERDANT GIS STORE</span>
          <h1>Find the right geospatial data.</h1>
          <p>Search, filter and preview published datasets before you buy.</p>
        </div>

        <div className="store-layout">
          <aside className="filters">
            <div className="filter-title">
              <SlidersHorizontal size={17} />
              Filters
            </div>

            <label>
              Search
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") updateSearch();
                }}
                placeholder="Dataset, location or category"
              />
            </label>

            <label>
              Category
              <select
                value={category}
                onChange={(e) => {
                  const next = e.target.value;
                  setCategory(next);
                  updateSearch(q, next);
                }}
              >
                <option>All</option>
                {categoryOptions.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                setQ("");
                setCategory("All");
                setSearchParams({});
              }}
            >
              Clear filters
            </button>

            <div className="filter-note">
              <ShieldCheck size={17} />
              <span>
                Only published datasets uploaded through the Verdant GIS admin portal are shown.
              </span>
            </div>
          </aside>

          <div className="store-results">
            <div className="result-top">
              <b>
                {loading ? "Loading datasets…" : `${filtered.length} datasets`}
              </b>
              <span>Live catalogue</span>
            </div>

            {error && (
              <div className="upload-status">
                Could not load the live catalogue: {error}
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="empty-state">
                <Database size={36} />
                <h3>No datasets found</h3>
                <p>
                  Try another search or choose a different category.
                </p>
              </div>
            )}

            <div className="dataset-grid">
              {filtered.map((d) => (
                <DatasetCard d={d} key={d.id} />
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}


/* =========================================================
   ADD TO CART
========================================================= */

function AddToCartButton({
  dataset,
}) {
  const navigate =
    useNavigate();

  const cart = useCart();

  const exists = cart.some(
    (x) => x.id === dataset.id
  );

  function handle() {
    if (exists) {
      navigate("/cart");
      return;
    }

    addToCart(dataset);
  }

  return (
    <button
      className="primary-btn cart-action"
      onClick={handle}
    >
      <ShoppingCart
        size={18}
      />

      {exists
        ? "View cart"
        : dataset.price === 0
        ? "Add free dataset"
        : "Add to cart"}
    </button>
  );
}


/* =========================================================
   FALLBACK DATASET PAGE
========================================================= */

function DatasetPage({ id }) {
  return (
    <>
      <Nav />

      <main className="simple-page">
        <span className="section-kicker">
          DATASET
        </span>

        <h1>
          Dataset not found.
        </h1>

        <div className="empty-state">
          <Database
            size={36}
          />

          <h3>
            This dataset is not
            available in the live
            catalogue.
          </h3>

          <p>
            Only published datasets
            from Supabase are displayed.
          </p>

          <Link
            to="/store"
            className="primary-btn"
          >
            Browse datasets{" "}
            <ArrowRight
              size={16}
            />
          </Link>
        </div>
      </main>

      <Footer />
    </>
  );
}


function Info({
  label,
  value,
}) {
  return (
    <div className="info-item">
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}



/* =========================================================
   CATEGORIES
   Published datasets are filtered from the same datasets
   table used by Store and Map Explorer.
========================================================= */

function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    // SEO metadata
    document.title =
      "GIS Data, Shapefiles & Remote Sensing Datasets | Verdant GIS";

    const description =
      "Explore GIS data, shapefiles, GeoJSON, raster and vector datasets, remote sensing data, satellite data, DEM, land use, agriculture, environmental and other geospatial datasets on Verdant GIS.";

    let meta = document.querySelector('meta[name="description"]');

    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }

    meta.setAttribute("content", description);

    let canonical = document.querySelector('link[rel="canonical"]');

    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }

    canonical.setAttribute(
      "href",
      "https://verdantgis.com/categories/"
    );

    // Load existing catalogue data
    Promise.all([getCategories(), getDatasets()])
      .then(([categoryResult, datasetResult]) => {
        if (!active) return;

        if (categoryResult.error || datasetResult.error) {
          setError(
            categoryResult.error?.message ||
              datasetResult.error?.message ||
              "Could not load catalogue categories."
          );
        }

        setCategories(categoryResult.data || []);
        setDatasets(datasetResult.data || []);
      })
      .catch((err) => {
        if (active) {
          setError(
            err.message || "Could not load catalogue categories."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Nav />

      <main className="categories-page">

        {/* PAGE HERO */}
        <div className="page-hero categories-hero">
          <span className="section-kicker">
            GIS DATA CATALOGUE
          </span>

          <h1>
            GIS Data, Shapefiles & Remote Sensing Datasets
          </h1>

          <p>
            Explore a growing catalogue of GIS data, shapefiles,
            GeoJSON, raster and vector datasets, remote sensing
            data and other geospatial resources for mapping,
            research, agriculture, environmental analysis,
            planning and spatial modelling.
          </p>
        </div>

        {error && (
          <div className="upload-status">
            {error}
          </div>
        )}

        {loading ? (
          <div className="table-loading">
            <LoaderCircle className="spin" size={28} />

            <span>
              Loading catalogue…
            </span>
          </div>
        ) : !categories.length ? (
          <div className="empty-state">
            <Layers3 size={36} />

            <h3>
              No categories available
            </h3>

            <p>
              Categories created in the admin/database will
              appear here.
            </p>
          </div>
        ) : (
          <>
            {/* CATEGORY CARDS */}
            <div className="categories-large-grid">
              {categories.map((category) => {
                const count = datasets.filter(
                  (d) =>
                    d.category_id === category.id &&
                    d.status === "published"
                ).length;

                return (
                  <Link
                    key={category.id}
                    to={`/categories/${slugifyCategory(
                      category.name
                    )}`}
                    className="category-large-card"
                  >
                    <span className="category-icon">
                      <Layers3 size={24} />
                    </span>

                    <div>
                      <span className="section-kicker">
                        GIS DATA CATEGORY
                      </span>

                      <h2>
                        {category.name}
                      </h2>

                      <p>
                        {count}{" "}
                        {count === 1
                          ? "published dataset"
                          : "published datasets"}
                      </p>
                    </div>

                    <ArrowRight size={19} />
                  </Link>
                );
              })}
            </div>

            {/* SEO CONTENT */}
            <section className="section">
              <div className="page-hero">

                <span className="section-kicker">
                  GEOSPATIAL DATA
                </span>

                <h2>
                  Explore GIS and geospatial data
                </h2>

                <p>
                  Verdant GIS is a geospatial data marketplace
                  providing access to ready-to-use spatial data
                  for GIS, remote sensing, mapping, research,
                  agriculture, environmental analysis, planning
                  and spatial modelling.
                </p>

                <p>
                  Browse datasets in vector and raster formats,
                  including shapefiles, GeoJSON and other
                  geospatial data resources. Explore datasets
                  covering administrative boundaries, rivers and
                  hydrology, agriculture, land use and land cover,
                  environmental information, transportation,
                  soils, elevation and other spatial themes.
                </p>

                <p>
                  The catalogue can also include remote sensing
                  and satellite-derived datasets suitable for
                  spatial analysis, image interpretation,
                  environmental monitoring, land assessment and
                  agricultural applications.
                </p>

                <p>
                  Whether you are looking for GIS data for
                  research, QGIS projects, remote sensing
                  analysis, agriculture, environmental studies,
                  planning or mapping, explore the available
                  datasets through the Verdant GIS catalogue.
                </p>

              </div>
            </section>
          </>
        )}
      </main>

      <Footer />
    </>
  );
}

function CategoryPage() {
  const { slug } = useParams();

  const [category, setCategory] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([getCategories(), getDatasets()])
      .then(([categoryResult, datasetResult]) => {
        if (!active) return;

        if (categoryResult.error || datasetResult.error) {
          setError(
            categoryResult.error?.message ||
              datasetResult.error?.message ||
              "Could not load this category."
          );
        }

        const categories = categoryResult.data || [];
        const allDatasets = datasetResult.data || [];

        const matchedCategory = categories.find(
          (c) => slugifyCategory(c.name) === slug
        );

        setCategory(matchedCategory || null);

        if (matchedCategory) {
          setDatasets(
            allDatasets.filter(
              (d) =>
                d.category_id === matchedCategory.id &&
                d.status === "published"
            )
          );
        } else {
          setDatasets([]);
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            err.message || "Could not load this category."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  /*
   * Dynamic SEO metadata
   * Runs after the category has been identified.
   */
  useEffect(() => {
    if (!category) return;

    const categoryName = category.name;

    document.title =
      `${categoryName} GIS Data & Shapefiles | Verdant GIS`;

    const description =
      `Explore ${categoryName} GIS data, shapefiles and geospatial datasets on Verdant GIS. Browse ready-to-use spatial data for GIS mapping, remote sensing, research, agriculture, environmental analysis and spatial applications.`;

    let meta = document.querySelector(
      'meta[name="description"]'
    );

    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }

    meta.setAttribute("content", description);

    let canonical = document.querySelector(
      'link[rel="canonical"]'
    );

    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }

    canonical.setAttribute(
      "href",
      `https://verdantgis.com/categories/${slugifyCategory(
        categoryName
      )}/`
    );

    return () => {
      // Keep the document clean when navigating between categories
      document.title =
        "GIS Data, Shapefiles & Remote Sensing Datasets | Verdant GIS";
    };
  }, [category]);

  if (loading) {
    return (
      <>
        <Nav />

        <main className="simple-page">
          <LoaderCircle
            className="spin"
            size={32}
          />

          <h2>Loading category…</h2>
        </main>
      </>
    );
  }

  if (!category) {
    return (
      <>
        <Nav />

        <main className="simple-page">
          <span className="section-kicker">
            GIS CATEGORY
          </span>

          <h1>Category not found.</h1>

          <div className="empty-state">
            <Layers3 size={36} />

            <h3>
              This category is not available.
            </h3>

            <p>
              Browse the live categories to find
              published GIS datasets.
            </p>

            <Link
              to="/categories"
              className="primary-btn"
            >
              Browse categories{" "}
              <ArrowRight size={16} />
            </Link>
          </div>
        </main>

        <Footer />
      </>
    );
  }

  const mappedDatasets = datasets.map((d) => ({
    ...d,
    id: d.id,
    slug: d.slug,
    category: category.name,
    location:
      d.location ||
      d.coverage ||
      "India",
    price: Number(d.price || 0),
    formats: d.formats || [],
    features:
      d.feature_count || "—",
    updated:
      d.updated_label ||
      "Recently updated",
    icon: Map,
  }));

  return (
    <>
      <Nav />

      <main className="category-detail-page">

        <div className="category-detail-head">

          <div>

            <div className="breadcrumbs">
              <Link to="/categories">
                GIS Data Categories
              </Link>

              <span>/</span>

              <b>{category.name}</b>
            </div>

            <span className="section-kicker">
              GIS DATA CATEGORY
            </span>

            <h1>
              {category.name} GIS Data & Shapefiles
            </h1>

            <p>
              Explore {category.name} geospatial
              datasets, GIS data and shapefiles
              available through the Verdant GIS
              catalogue.
            </p>

            <p>
              {mappedDatasets.length}{" "}
              {mappedDatasets.length === 1
                ? "published dataset"
                : "published datasets"}{" "}
              available in this category.
            </p>

          </div>

          <Link
            to={`/explore?category=${encodeURIComponent(
              slugifyCategory(category.name)
            )}`}
            className="primary-btn"
          >
            <Map size={17} />
            Explore on map
          </Link>

        </div>

        {error && (
          <div className="upload-status">
            {error}
          </div>
        )}

        {!mappedDatasets.length ? (
          <div className="empty-state">

            <Database size={36} />

            <h3>
              No published datasets in this category
            </h3>

            <p>
              Once a dataset is published with this
              category, it will appear here
              automatically.
            </p>

            <Link
              to="/store"
              className="primary-btn"
            >
              Browse all data{" "}
              <ArrowRight size={16} />
            </Link>

          </div>
        ) : (
          <>
            <div className="dataset-grid">
              {mappedDatasets.map((d) => (
                <DatasetCard
                  d={d}
                  key={d.id}
                />
              ))}
            </div>

            {/* SEO supporting content */}
            <section className="section">

              <div className="page-hero">

                <span className="section-kicker">
                  {category.name.toUpperCase()} GIS DATA
                </span>

                <h2>
                  {category.name} geospatial data
                  for GIS and remote sensing
                </h2>

                <p>
                  Browse {category.name} GIS data
                  and geospatial datasets available
                  through Verdant GIS. These datasets
                  can support GIS mapping, spatial
                  analysis, remote sensing,
                  agriculture, environmental
                  research, planning and other
                  geospatial applications.
                </p>

                <p>
                  Available data may include
                  vector datasets, shapefiles,
                  GeoJSON and other spatial formats,
                  depending on the datasets published
                  in this category.
                </p>

                <p>
                  Explore the available datasets
                  above to view their coverage,
                  formats, features and other
                  information before using them in
                  your GIS or remote sensing workflow.
                </p>

              </div>

            </section>
          </>
        )}

      </main>

      <Footer />
    </>
  );
}
/* =========================================================
   EXPLORE
========================================================= */

function Explore() {
  const [searchParams] = useSearchParams();
  const requestedCategory = searchParams.get("category") || "All";

  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(null);
  const [category, setCategory] = useState(requestedCategory);
  const [query, setQuery] = useState("");
  const [geojson, setGeojson] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const [displayMode, setDisplayMode] =
    useState("single");

  const [attributeField, setAttributeField] =
    useState("");

  const [colorPalette, setColorPalette] =
    useState("Spectrum");

  useEffect(() => {
    setCategory(requestedCategory);
  }, [requestedCategory]);

  useEffect(() => {
    let active = true;

    Promise.all([getDatasets(), getCategories()]).then(
      ([datasetsResult, categoriesResult]) => {
        if (!active) return;

        const datasets = (datasetsResult.data || []).map((d) => ({
          ...d,
          category: d.categories?.name || "GIS Data",
          location: d.location || d.coverage || "India",
        }));

        setRows(datasets);
        setCategories(categoriesResult.data || []);

        const initial = requestedCategory === "All"
          ? datasets[0]
          : datasets.find(
              (d) =>
                slugifyCategory(d.category) === requestedCategory
            );

        setSelected(initial || null);
      }
    );

    return () => {
      active = false;
    };
  }, [requestedCategory]);

  const filteredRows = rows.filter((d) => {
    const matchesCategory =
      category === "All" ||
      slugifyCategory(d.category) === category ||
      d.category === category;

    const haystack = `${d.title || ""} ${d.description || ""} ${d.location || ""} ${d.category || ""}`.toLowerCase();

    return matchesCategory && haystack.includes(query.trim().toLowerCase());
  });

  useEffect(() => {
    if (!filteredRows.length) {
      setSelected(null);
      return;
    }

    if (!selected || !filteredRows.some((d) => d.id === selected.id)) {
      setSelected(filteredRows[0]);
    }
  }, [category, query, rows]);

  useEffect(() => {
    let cancelled = false;

    setGeojson(null);
    setPreviewError("");

    if (!selected?.preview_geojson_url) {
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(true);

    fetch(selected.preview_geojson_url, { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Preview request failed (${response.status})`);
        }

        const json = await response.json();

        if (
          !json ||
          !["FeatureCollection", "Feature", "GeometryCollection"].includes(json.type)
        ) {
          throw new Error("The uploaded preview is not valid GeoJSON.");
        }

        if (!cancelled) setGeojson(json);
      })
      .catch((error) => {
        if (!cancelled) {
          setPreviewError(
            error.message || "Could not load the GIS preview."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected?.id, selected?.preview_geojson_url]);

  const visualizationFields = useMemo(
    () => getVisualizationFields(geojson),
    [geojson]
  );

  useEffect(() => {
    if (!visualizationFields.length) {
      setAttributeField("");
      return;
    }

    if (!visualizationFields.includes(attributeField)) {
      setAttributeField(visualizationFields[0]);
    }
  }, [visualizationFields, attributeField]);

  function selectCategory(value) {
    setCategory(value);
    setQuery("");

    const next = rows.find(
      (d) =>
        value === "All" ||
        slugifyCategory(d.category) === value ||
        d.category === value
    );

    setSelected(next || null);
  }

  return (
    <>
      <Nav />

      <main className="explore-page">
        <aside className="explore-sidebar">
          <div className="explore-title">
            <span className="section-kicker">MAP EXPLORER</span>
            <h2>Explore GIS data</h2>
          </div>

          <div className="explore-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search published datasets..."
            />
          </div>

          <label className="explore-filter-label">
            Category
            <select
              value={category}
              onChange={(e) => selectCategory(e.target.value)}
            >
              <option value="All">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={slugifyCategory(c.name)}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <div className="layer-group">
            <b>
              {filteredRows.length} published{" "}
              {filteredRows.length === 1 ? "dataset" : "datasets"}
            </b>

            <div className="explore-layer-list">
              {filteredRows.length ? (
                filteredRows.map((d) => (
                  <button
                    type="button"
                    key={d.id}
                    className={`explore-layer ${
                      selected?.id === d.id ? "active" : ""
                    }`}
                    onClick={() => setSelected(d)}
                  >
                    <span className="explore-layer-dot">
                      <MapPinned size={14} />
                    </span>

                    <span>
                      <strong>{d.title}</strong>
                      <small>
                        {d.category} · {d.location}
                      </small>
                    </span>
                  </button>
                ))
              ) : (
                <span className="muted">
                  No published datasets match your filters.
                </span>
              )}
            </div>
          </div>

          {selected && geojson && (
            <div className="explore-visualization">
              <div className="explore-visualization-head">
                <div>
                  <span className="section-kicker">VISUALIZATION</span>
                  <b>Style map features</b>
                </div>
                <Layers3 size={21} />
              </div>

              <label className="explore-filter-label">
                Display mode
                <select
                  value={displayMode}
                  onChange={(e) =>
                    setDisplayMode(e.target.value)
                  }
                >
                  <option value="single">
                    Single colour
                  </option>
                  <option value="category">
                    Different colours by attribute
                  </option>
                  <option value="graduated">
                    Graduated colours
                  </option>
                </select>
              </label>

              {displayMode !== "single" && (
                <>
                  <label className="explore-filter-label">
                    Attribute field
                    <select
                      value={attributeField}
                      onChange={(e) =>
                        setAttributeField(e.target.value)
                      }
                    >
                      {visualizationFields.map((field) => (
                        <option value={field} key={field}>
                          {field}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="explore-filter-label">
                    Colour palette
                    <select
                      value={colorPalette}
                      onChange={(e) =>
                        setColorPalette(e.target.value)
                      }
                    >
                      {Object.keys(VISUAL_PALETTES).map(
                        (palette) => (
                          <option value={palette} key={palette}>
                            {palette}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                </>
              )}
            </div>
          )}

          {selected && (
            <div className="explore-selected">
              <span className="section-kicker">SELECTED DATASET</span>
              <h3>{selected.title}</h3>
              <p>{selected.description || "Published geospatial dataset."}</p>

              <div className="explore-selected-meta">
                <span>{selected.category}</span>
                <span>{selected.formats?.join(" · ") || "GIS"}</span>
              </div>

              <Link
                to={`/dataset/${selected.slug}`}
                className="primary-btn"
              >
                View dataset <ArrowRight size={15} />
              </Link>
            </div>
          )}

          {!selected && (
            <div className="explore-tip">
              <Sparkles size={18} />
              <b>Live catalogue</b>
              <span>
                Datasets published from Admin automatically appear here.
                Select one to load its uploaded GeoJSON preview.
              </span>
            </div>
          )}
        </aside>

        <div className="explore-map">
          {selected ? (
            <div className="explore-real-map">
              {previewLoading && (
                <div className="explore-map-status">
                  <LoaderCircle className="spin" size={20} />
                  Loading {selected.title}…
                </div>
              )}

              {!previewLoading && previewError && (
                <div className="explore-map-status error">
                  <Database size={20} />
                  {previewError}
                </div>
              )}

              <GISMap
                geojson={geojson}
                height="100%"
                layerKey={selected.id}
                displayMode={displayMode}
                attributeField={attributeField}
                colorPalette={colorPalette}
              />
            </div>
          ) : (
            <div className="explore-empty-map">
              <Map size={42} />
              <h3>Choose a published dataset</h3>
              <p>
                The uploaded map preview will appear here.
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}


/* =========================================================
   LOGIN
========================================================= */

function Login() {
  const navigate =
    useNavigate();

  const [mode, setMode] =
    useState("login");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [name, setName] =
    useState("");

  const [msg, setMsg] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const configuredAdminEmail =
    String(
      import.meta.env
        .VITE_ADMIN_EMAIL ||
        ""
    )
      .trim()
      .toLowerCase();

  async function redirectByRole(
    fallbackEmail = ""
  ) {
    const {
      data: authData,
    } =
      await supabase.auth.getUser();

    const user =
      authData?.user;

    if (!user) return false;

    const { profile } =
      await getCurrentUserProfile();

    const adminByRole =
      profile?.role ===
      "admin";

    const adminByConfiguredEmail =
      configuredAdminEmail &&
      (
        user.email ||
        fallbackEmail ||
        ""
      )
        .trim()
        .toLowerCase() ===
        configuredAdminEmail;

    if (
      adminByRole ||
      adminByConfiguredEmail
    ) {
      navigate("/admin", {
        replace: true,
      });
    } else {
      navigate("/dashboard", {
        replace: true,
      });
    }

    return true;
  }

  async function submit(e) {
    e.preventDefault();

    setMsg("");
    setBusy(true);

    try {
      const cleanEmail =
        email
          .trim()
          .toLowerCase();

      if (mode === "login") {
        const result =
          await signIn(
            cleanEmail,
            password
          );

        if (result.error)
          throw result.error;

        await redirectByRole(
          cleanEmail
        );
      } else {
        const result =
          await signUp(
            cleanEmail,
            password,
            name
          );

        if (result.error)
          throw result.error;

        if (
          result.data?.session
        ) {
          await redirectByRole(
            cleanEmail
          );
        } else {
          setMsg(
            cleanEmail ===
              configuredAdminEmail
              ? "Admin account created. Complete email confirmation if enabled, then sign in — you will be sent directly to the Admin Portal."
              : "Account created. Check your email if confirmation is enabled, then sign in."
          );
        }
      }
    } catch (err) {
      setMsg(
        err.message ||
          "Authentication failed."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Nav />

      <main className="auth-page">
        <div className="auth-card">
          <span className="section-kicker">
            VERDANT GIS ACCOUNT
          </span>

          <h1>
            {mode === "login"
              ? "Welcome back."
              : "Create your account."}
          </h1>

          <p>
            {mode === "login"
              ? "Sign in to access your Verdant GIS workspace."
              : "Create an account to purchase and manage GIS data."}
          </p>

          {mode === "signup" && (
            <input
              value={name}
              onChange={(e) =>
                setName(
                  e.target.value
                )
              }
              placeholder="Full name"
              autoComplete="name"
            />
          )}

          <input
            value={email}
            onChange={(e) =>
              setEmail(
                e.target.value
              )
            }
            placeholder="Email address"
            type="email"
            autoComplete="email"
            required
          />

          <input
            value={password}
            onChange={(e) =>
              setPassword(
                e.target.value
              )
            }
            placeholder="Password"
            type="password"
            autoComplete={
              mode === "login"
                ? "current-password"
                : "new-password"
            }
            minLength={6}
            required
          />

          <button
            className="primary-btn"
            onClick={submit}
            disabled={busy}
          >
            {busy
              ? "Please wait…"
              : mode === "login"
              ? "Sign in"
              : "Create account"}
          </button>

          {msg && (
            <div className="auth-msg">
              {msg}
            </div>
          )}

          <button
            className="switch-btn"
            onClick={() => {
              setMode(
                mode === "login"
                  ? "signup"
                  : "login"
              );

              setMsg("");
            }}
          >
            {mode === "login"
              ? "Need an account? Create one"
              : "Already have an account? Sign in"}
          </button>

          {!supabaseReady && (
            <small className="config-warning">
              Supabase is not connected
              yet. Add the values from
              .env.example.
            </small>
          )}
        </div>
      </main>
    </>
  );
}


/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard() {
  const [user, setUser] =
    useState(null);

  const [downloads, setDownloads] =
    useState([]);

  const [orders, setOrders] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [busyId, setBusyId] =
    useState(null);

  const [msg, setMsg] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [sortMode, setSortMode] =
    useState("recent");

  const [activeTab, setActiveTab] =
    useState("library");

  const navigate =
    useNavigate();

  async function loadLibrary() {
    setLoading(true);
    setMsg("");

    try {
      if (!supabase) {
        throw new Error(
          "Supabase is not configured."
        );
      }

      // getSession() reads the existing Supabase session locally in the
      // normal case, avoiding an extra auth network request on dashboard load.
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const currentUser =
        sessionData.session?.user || null;

      setUser(currentUser);

      if (!currentUser)
        return;

const dashboard = await paymentApi("/api/dashboard");

const libraryDownloads = dashboard.downloads || [];
const orderHistory = dashboard.orders || [];
const orderDatasetMap = {};

for (const order of orderHistory) {
  for (const item of order.order_items || []) {
    const relation = item.datasets;
    const dataset = Array.isArray(relation)
      ? relation[0]
      : relation;

    if (item.dataset_id && dataset) {
      orderDatasetMap[item.dataset_id] = dataset;
    }
  }
}

/*
 * The dashboard endpoint already joins purchased downloads to the dataset
 * record. Normalize the relation shape here so the dashboard makes one
 * authenticated request instead of separate library + order requests.
 */
const enrichedDownloads = libraryDownloads.map((item) => {
  const datasetId =
    item.dataset_id ||
    item.dataset?.id ||
    item.datasets?.id;

  const relation = item.dataset || item.datasets;
  const apiDataset = Array.isArray(relation)
    ? relation[0] || {}
    : relation || {};

  const orderDataset =
    orderDatasetMap[datasetId] || {};

  return {
    ...item,
    dataset: {
      ...orderDataset,
      ...apiDataset,
    },
  };
});

setDownloads(enrichedDownloads);

setOrders(orderHistory);
    } catch (err) {
      setMsg(
        err.message ||
          "Could not load your GIS library."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLibrary();

    if (!supabase)
      return undefined;

    const {
      data: listener,
    } =
      supabase.auth.onAuthStateChange(
        () => loadLibrary()
      );

    return () =>
      listener?.subscription?.unsubscribe();
  }, []);

  async function secureDownload(
    item
  ) {
    const datasetId =
      item?.dataset?.id ||
      item?.dataset_id;

    console.log(
      "[Verdant GIS] Download clicked",
      {
        item,
        datasetId,
      }
    );

    if (!datasetId) {
      setMsg(
        "Could not identify this dataset. Please refresh your library."
      );

      return;
    }

    setBusyId(datasetId);
    setMsg("");

    try {
      const result =
        await secureDownloadApi(
          `/api/download/${encodeURIComponent(
            datasetId
          )}`
        );

      console.log(
        "[Verdant GIS] Download API response",
        result
      );

      if (
        result.type === "json"
      ) {
        if (!result.downloadUrl) {
          throw new Error(
            "The server did not return a secure download URL."
          );
        }

        window.location.assign(
          result.downloadUrl
        );

        setMsg(
          `${
            result.title ||
            "Dataset"
          } — secure download started.`
        );
      } else {
        setMsg(
          `${
            result.title ||
            "Dataset"
          } — download started.`
        );
      }

      await loadLibrary();
    } catch (err) {
      console.error(
        "[Verdant GIS] Secure download error",
        err
      );

      setMsg(
        err.message ||
          "Could not start download."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function logout() {
    await signOut();

    setUser(null);
    setDownloads([]);
    setOrders([]);

    navigate("/");
  }

  const paidOrders =
    orders.filter(
      (o) =>
        o.status === "paid"
    );

  const totalSpent =
    paidOrders.reduce(
      (sum, o) =>
        sum +
        Number(
          o.amount || 0
        ),
      0
    );

  const totalDownloads =
    downloads.reduce(
      (sum, item) =>
        sum +
        Number(
          item.download_count ||
            0
        ),
      0
    );

  const lastPurchase =
    downloads.length
      ? new Date(
          Math.max(
            ...downloads.map(
              (x) =>
                new Date(
                  x.created_at
                ).getTime()
            )
          )
        )
      : null;

  const filteredDownloads =
    downloads
      .filter((item) => {
        const d =
          item.dataset || {};

        const q =
          search
            .trim()
            .toLowerCase();

        if (!q) return true;

        return [
          d.title,
          d.description,
          d.location,
          d.coverage,
          d.crs,
          ...(d.formats || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        if (
          sortMode === "name"
        ) {
          return String(
            a.dataset?.title ||
              ""
          ).localeCompare(
            String(
              b.dataset?.title ||
                ""
            )
          );
        }

        if (
          sortMode ===
          "downloads"
        ) {
          return (
            Number(
              b.download_count ||
                0
            ) -
            Number(
              a.download_count ||
                0
            )
          );
        }

        return (
          new Date(
            b.created_at
          ).getTime() -
          new Date(
            a.created_at
          ).getTime()
        );
      });

  return (
    <>
      <Nav />

      <main className="dashboard dashboard-v11">
        <section className="library-command">
          <div className="library-command-copy">
            <div className="library-eyebrow">
              <span className="live-dot" />
              VERDANT GIS · CUSTOMER
              PORTAL
            </div>

            <h1>
              Welcome back
              {user
                ?.user_metadata
                ?.full_name
                ? `, ${
                    user.user_metadata.full_name.split(
                      " "
                    )[0]
                  }`
                : ""}
              .
            </h1>

            <p>
              Your purchased
              geospatial data, secure
              downloads and order
              history — all in one
              place.
            </p>

            {user && (
              <div className="library-email">
                <UserRound
                  size={14}
                />
                {user.email}
              </div>
            )}
          </div>

          <div className="library-command-actions">
            <Link
              to="/store"
              className="secondary-btn"
            >
              <Search size={15} />
              Explore datasets
            </Link>

            {user && (
              <button
                type="button"
                className="ghost-danger"
                onClick={
                  logout
                }
              >
                Sign out
              </button>
            )}
          </div>
        </section>

        {!user ? (
          <div className="empty-state dashboard-login-state">
            <UserRound size={36} />

            <h3>
              Sign in to continue
            </h3>

            <p>
              Your purchased GIS
              data will appear here.
            </p>

            <Link
              to="/login"
              className="primary-btn"
            >
              Sign in{" "}
              <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <>
            <section className="v11-overview-grid">
              <div className="v11-stat-card v11-stat-primary">
                <div className="v11-stat-icon">
                  <Database
                    size={19}
                  />
                </div>

                <div>
                  <span>
                    GIS DATASETS
                  </span>

                  <strong>
                    {downloads.length}
                  </strong>

                  <small>
                    Available in your
                    library
                  </small>
                </div>
              </div>

              <div className="v11-stat-card">
                <div className="v11-stat-icon">
                  <CheckCircle2
                    size={19}
                  />
                </div>

                <div>
                  <span>
                    PAID ORDERS
                  </span>

                  <strong>
                    {paidOrders.length}
                  </strong>

                  <small>
                    Completed purchases
                  </small>
                </div>
              </div>

              <div className="v11-stat-card">
                <div className="v11-stat-icon">
                  <Download
                    size={19}
                  />
                </div>

                <div>
                  <span>
                    DOWNLOADS
                  </span>

                  <strong>
                    {totalDownloads}
                  </strong>

                  <small>
                    Secure file accesses
                  </small>
                </div>
              </div>

              <div className="v11-stat-card">
                <div className="v11-stat-icon">
                  <IndianRupee
                    size={19}
                  />
                </div>

                <div>
                  <span>
                    TOTAL SPENT
                  </span>

                  <strong>
                    ₹
                    {totalSpent.toLocaleString(
                      "en-IN"
                    )}
                  </strong>

                  <small>
                    {lastPurchase
                      ? `Last purchase ${lastPurchase.toLocaleDateString(
                          "en-IN",
                          {
                            day: "2-digit",
                            month: "short",
                          }
                        )}`
                      : "No purchases yet"}
                  </small>
                </div>
              </div>
            </section>

            <section className="v11-security-strip">
              <div className="v11-security-icon">
                <ShieldCheck
                  size={20}
                />
              </div>

              <div>
                <b>
                  Your GIS files are
                  protected.
                </b>

                <span>
                  Paid files stay
                  private in secure
                  storage. Every
                  download is checked
                  against your
                  purchase before a
                  temporary link is
                  generated.
                </span>
              </div>

              <span className="secure-badge">
                <CheckCircle2
                  size={13}
                />
                SECURE ACCESS
              </span>
            </section>

            {msg && (
              <div className="library-notice v11-notice">
                <ShieldCheck
                  size={16}
                />

                <span>
                  {msg}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setMsg("")
                  }
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            )}

            <section className="v11-tabs-row">
              <button
                type="button"
                className={
                  activeTab ===
                  "library"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setActiveTab(
                    "library"
                  )
                }
              >
                <Database
                  size={15}
                />
                My library{" "}
                <b>
                  {downloads.length}
                </b>
              </button>

              <button
                type="button"
                className={
                  activeTab ===
                  "orders"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setActiveTab(
                    "orders"
                  )
                }
              >
                <ShoppingCart
                  size={15}
                />
                Orders{" "}
                <b>
                  {orders.length}
                </b>
              </button>
            </section>

            {activeTab ===
            "library" ? (
              <section className="v11-library-section">
                <div className="v11-section-head">
                  <div>
                    <span className="section-kicker">
                      PURCHASED DATA
                    </span>

                    <h2>
                      Your GIS library
                    </h2>

                    <p>
                      Download the
                      datasets you've
                      purchased whenever
                      you need them.
                    </p>
                  </div>

                  <Link
                    to="/store"
                    className="secondary-btn"
                  >
                    Browse more{" "}
                    <ArrowRight
                      size={15}
                    />
                  </Link>
                </div>

                {loading ? (
                  <div className="library-loading">
                    <LoaderCircle
                      className="spin"
                    />

                    Loading your GIS
                    library…
                  </div>
                ) : !downloads.length ? (
                  <div className="empty-state library-empty">
                    <Database
                      size={36}
                    />

                    <h3>
                      Your library is
                      empty.
                    </h3>

                    <p>
                      Purchase a dataset
                      and it will appear
                      here automatically.
                    </p>

                    <Link
                      to="/store"
                      className="primary-btn"
                    >
                      Browse GIS data{" "}
                      <ArrowRight
                        size={16}
                      />
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="v11-library-toolbar">
                      <label className="v11-search">
                        <Search
                          size={16}
                        />

                        <input
                          value={search}
                          onChange={(e) =>
                            setSearch(
                              e.target
                                .value
                            )
                          }
                          placeholder="Search your datasets..."
                        />

                        <span>
                          {
                            filteredDownloads.length
                          }
                        </span>
                      </label>

                      <select
                        value={
                          sortMode
                        }
                        onChange={(e) =>
                          setSortMode(
                            e.target
                              .value
                          )
                        }
                        aria-label="Sort datasets"
                      >
                        <option value="recent">
                          Recently
                          purchased
                        </option>

                        <option value="name">
                          Name A–Z
                        </option>

                        <option value="downloads">
                          Most downloaded
                        </option>
                      </select>
                    </div>

                    {!filteredDownloads.length ? (
                      <div className="v11-no-results">
                        <Search
                          size={25}
                        />

                        <b>
                          No matching
                          datasets
                        </b>

                        <span>
                          Try a different
                          search term.
                        </span>
                      </div>
                    ) : (
                      <div className="v11-library-grid">
                        {filteredDownloads.map(
                          (item) => {
                            const d =
                              item.dataset ||
                              {};

                            const formats =
                              Array.isArray(
                                d.formats
                              )
                                ? d.formats
                                : [];

                            return (
                              <article
                                className="v11-dataset-card"
                                key={
                                  item.id
                                }
                              >
                                <div className="v11-card-visual">
                                  <MiniGeoPreview
                                    url={d.preview_geojson_url}
                                    imageUrl={d.thumbnail_url}
          title={d.title}
                                  />

                                  <div className="v11-card-topline">
                                    <span className="v11-owned">
                                      <CheckCircle2
                                        size={
                                          12
                                        }
                                      />
                                      OWNED
                                    </span>

                                    <span className="v11-location">
                                      <MapPinned
                                        size={
                                          12
                                        }
                                      />
                                      {d.location ||
                                        "India"}
                                    </span>
                                  </div>

                                  <div className="v11-visual-label">
                                    VERDANT GIS
                                    DATA
                                  </div>
                                </div>

                                <div className="v11-card-body">
                                  <div className="v11-card-title-row">
                                    <div>
                                      <span className="v11-data-type">
                                        GEOSPATIAL
                                        DATA
                                      </span>

                                      <h3>
                                        {d.title ||
                                          "GIS Dataset"}
                                      </h3>
                                    </div>

                                    <span className="v11-price-paid">
                                      PAID
                                    </span>
                                  </div>

                                  <p>
                                    {d.description ||
                                      "Purchased geospatial dataset ready for download."}
                                  </p>

                                  <div className="v11-spec-grid">
                                    <div>
                                      <small>
                                        FORMAT
                                      </small>

                                      <b>
                                        {formats
                                          .slice(
                                            0,
                                            3
                                          )
                                          .join(
                                            " · "
                                          ) ||
                                          "GIS"}
                                      </b>
                                    </div>

                                    <div>
                                      <small>
                                        FEATURES
                                      </small>

                                      <b>
                                        {d.feature_count ??
                                          "—"}
                                      </b>
                                    </div>

                                    <div>
                                      <small>
                                        CRS
                                      </small>

                                      <b>
                                        {d.crs ||
                                          "EPSG:4326"}
                                      </b>
                                    </div>

                                    <div>
                                      <small>
                                        DOWNLOADED
                                      </small>

                                      <b>
                                        {item.download_count ||
                                          0}
                                        ×
                                      </b>
                                    </div>
                                  </div>

                                  <div className="v11-card-footer">
                                    <div>
                                      <small>
                                        Purchased
                                      </small>

                                      <b>
                                        {new Date(
                                          item.created_at
                                        ).toLocaleDateString(
                                          "en-IN",
                                          {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                          }
                                        )}
                                      </b>
                                    </div>

                                    <button
                                      type="button"
                                      className="primary-btn v11-download-btn"
                                      disabled={
                                        busyId ===
                                        d.id
                                      }
                                      onClick={(
                                        e
                                      ) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        secureDownload(
                                          item
                                        );
                                      }}
                                    >
                                      {busyId ===
                                      d.id ? (
                                        <>
                                          <LoaderCircle
                                            size={
                                              15
                                            }
                                            className="spin"
                                          />

                                          Preparing…
                                        </>
                                      ) : (
                                        <>
                                          <Download
                                            size={
                                              15
                                            }
                                          />

                                          Download
                                          dataset
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </article>
                            );
                          }
                        )}
                      </div>
                    )}
                  </>
                )}
              </section>
            ) : (
              <section className="v11-orders-section">
                <div className="v11-section-head">
                  <div>
                    <span className="section-kicker">
                      ORDER HISTORY
                    </span>

                    <h2>
                      Your purchases
                    </h2>

                    <p>
                      Track payments and
                      purchased GIS
                      datasets.
                    </p>
                  </div>
                </div>

                {orders.length ? (
                  <div className="v11-orders-table">
                    <div className="v11-orders-head">
                      <span>
                        ORDER
                      </span>

                      <span>
                        DATE
                      </span>

                      <span>
                        ITEMS
                      </span>

                      <span>
                        AMOUNT
                      </span>

                      <span>
                        STATUS
                      </span>
                    </div>

                    {orders.map(
                      (order) => (
                        <div
                          className="v11-order-row"
                          key={
                            order.id
                          }
                        >
                          <div>
                            <b>
                              #
                              {order.id
                                .slice(
                                  0,
                                  8
                                )
                                .toUpperCase()}
                            </b>

                            <small>
                              {order.razorpay_order_id ||
                                "Razorpay order"}
                            </small>
                          </div>

                          <span>
                            {new Date(
                              order.created_at
                            ).toLocaleDateString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              }
                            )}
                          </span>

                          <span>
                            {order
                              .order_items
                              ?.length ||
                              0}{" "}
                            dataset
                            {(order
                              .order_items
                              ?.length ||
                              0) === 1
                              ? ""
                              : "s"}
                          </span>

                          <strong>
                            ₹
                            {Number(
                              order.amount ||
                                0
                            ).toLocaleString(
                              "en-IN"
                            )}
                          </strong>

                          <span
                            className={`order-status ${order.status}`}
                          >
                            {order.status}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="muted">
                    No orders yet.
                  </p>
                )}
              </section>
            )}

            <section className="v11-help-card">
              <div className="v11-help-icon">
                <Map size={20} />
              </div>

              <div>
                <span className="section-kicker">
                  NEED MORE DATA?
                </span>

                <h3>
                  Explore the Verdant
                  GIS catalogue.
                </h3>

                <p>
                  Find administrative
                  boundaries, agriculture
                  layers, terrain, roads,
                  remote sensing and
                  research-ready datasets.
                </p>
              </div>

              <Link
                to="/store"
                className="primary-btn"
              >
                Explore data{" "}
                <ArrowRight size={15} />
              </Link>
            </section>
          </>
        )}
      </main>

      <Footer />
    </>
  );
}


/* =========================================================
   CART PAGE
========================================================= */

function Cart() {
  const items = useCart();

  const navigate =
    useNavigate();

  const subtotal =
    items.reduce(
      (sum, item) =>
        sum +
        Number(
          item.price || 0
        ),
      0
    );

  const paidCount =
    items.filter(
      (x) =>
        Number(
          x.price || 0
        ) > 0
    ).length;

  const freeCount =
    items.length -
    paidCount;

  return (
    <>
      <Nav />

      <main className="cart-page">
        <div className="cart-header">
          <div>
            <span className="section-kicker">
              YOUR CART
            </span>

            <h1>
              GIS data, ready when
              you are.
            </h1>

            <p>
              {items.length
                ? `${items.length} dataset${
                    items.length ===
                    1
                      ? ""
                      : "s"
                  } selected`
                : "Your cart is waiting for its first dataset."}
            </p>
          </div>

          {items.length > 0 && (
            <button
              className="clear-cart"
              onClick={
                clearCart
              }
            >
              Clear cart
            </button>
          )}
        </div>

        {!items.length ? (
          <div className="empty-state cart-empty">
            <ShoppingCart
              size={42}
            />

            <h3>
              Your cart is empty
            </h3>

            <p>
              Preview a dataset, add
              it here, and continue to
              checkout when you're
              ready.
            </p>

            <Link
              to="/store"
              className="primary-btn"
            >
              Browse datasets{" "}
              <ArrowRight
                size={16}
              />
            </Link>
          </div>
        ) : (
          <div className="cart-layout">
            <section className="cart-items">
              {items.map((item) => (
                <article
                  className="cart-item"
                  key={item.id}
                >
                  <div className="cart-item-map">
                    <Map size={22} />
                  </div>

                  <div className="cart-item-main">
                    <div className="cart-item-top">
                      <span className="tag">
                        {item.category}
                      </span>

                      <button
                        onClick={() =>
                          removeFromCart(
                            item.id
                          )
                        }
                        className="remove-item"
                      >
                        Remove
                      </button>
                    </div>

                    <Link
                      to={`/dataset/${item.slug}`}
                    >
                      <h3>
                        {item.title}
                      </h3>
                    </Link>

                    <p>
                      {item.location}
                    </p>

                    <div className="dataset-specs">
                      {item.formats
                        .slice(0, 4)
                        .map((f) => (
                          <span key={f}>
                            {f}
                          </span>
                        ))}

                      {item.features && (
                        <span>
                          {
                            item.features
                          }{" "}
                          features
                        </span>
                      )}
                    </div>
                  </div>

                  <strong className="cart-item-price">
                    {item.price ===
                    0
                      ? "FREE"
                      : `₹${item.price.toLocaleString(
                          "en-IN"
                        )}`}
                  </strong>
                </article>
              ))}
            </section>

            <aside className="cart-summary">
              <span className="section-kicker">
                ORDER SUMMARY
              </span>

              <h2>
                Checkout
              </h2>

              <div className="summary-line">
                <span>
                  Datasets
                </span>

                <b>
                  {items.length}
                </b>
              </div>

              {paidCount > 0 && (
                <div className="summary-line">
                  <span>
                    Paid datasets
                  </span>

                  <b>
                    {paidCount}
                  </b>
                </div>
              )}

              {freeCount > 0 && (
                <div className="summary-line">
                  <span>
                    Free datasets
                  </span>

                  <b>
                    {freeCount}
                  </b>
                </div>
              )}

              <div className="summary-total">
                <span>
                  Total
                </span>

                <strong>
                  {subtotal === 0
                    ? "FREE"
                    : `₹${subtotal.toLocaleString(
                        "en-IN"
                      )}`}
                </strong>
              </div>

              <button
                className="primary-btn checkout-btn"
                onClick={() =>
                  navigate(
                    "/checkout"
                  )
                }
              >
                Proceed to checkout{" "}
                <ArrowRight
                  size={17}
                />
              </button>

              <div className="checkout-trust">
                <ShieldCheck
                  size={16}
                />

                <span>
                  Secure checkout ·
                  Your files stay private
                  until access is granted.
                </span>
              </div>

              <Link
                to="/store"
                className="continue-link"
              >
                Continue exploring
                data
              </Link>
            </aside>
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}


/* =========================================================
   CHECKOUT
========================================================= */

function Checkout() {
  const items = useCart();

  const navigate =
    useNavigate();

  const [email, setEmail] =
    useState("");

  const [name, setName] =
    useState("");

  const [notice, setNotice] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [
    paymentDone,
    setPaymentDone,
  ] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (data.user?.email) {
          setEmail(
            data.user.email
          );
        }

        if (
          data.user?.user_metadata
            ?.full_name
        ) {
          setName(
            data.user
              .user_metadata
              .full_name
          );
        }
      });
  }, []);

  const subtotal =
    items.reduce(
      (sum, item) =>
        sum +
        Number(
          item.price || 0
        ),
      0
    );

  if (!items.length) {
    return (
      <>
        <Nav />

        <main className="simple-page">
          <span className="section-kicker">
            CHECKOUT
          </span>

          <h1>
            No items to checkout.
          </h1>

          <div className="empty-state">
            <ShoppingCart
              size={38}
            />

            <p>
              Add a dataset first.
            </p>

            <Link
              to="/store"
              className="primary-btn"
            >
              Browse datasets
            </Link>
          </div>
        </main>

        <Footer />
      </>
    );
  }

  async function startPayment(e) {
    e.preventDefault();

    if (
      busy ||
      paymentDone
    )
      return;

    setBusy(true);
    setNotice("");

    try {
      if (!supabaseReady) {
        throw new Error(
          "Supabase is not configured."
        );
      }

      if (!email || !name) {
        throw new Error(
          "Please enter your name and email."
        );
      }

      /*
       * IMPORTANT:
       * items[].id is now the Supabase UUID.
       */
      const orderData =
        await paymentApi(
          "/api/orders/create",
          {
            method: "POST",

            body: JSON.stringify({
              datasetIds:
                items.map(
                  (x) => x.id
                ),
            }),
          }
        );

      if (orderData.free) {
        clearCart();

        setPaymentDone(true);

        setNotice(
          "Free order completed. Your dataset access is ready."
        );

        setTimeout(() => {
          navigate("/dashboard", { replace: true });
        }, 450);

        return;
      }

      await loadRazorpayScript();

      const configResponse =
        await fetch(
          `${PAYMENT_API}/api/config`
        );

      const config =
        await configResponse.json();

      if (!config.keyId) {
        throw new Error(
          "Razorpay Key ID is not configured on the payment server."
        );
      }

      const options = {
        key: config.keyId,

        amount:
          orderData.order.amount,

        currency:
          orderData.order.currency,

        name: "Verdant GIS",

        description: `${
          items.length
        } GIS dataset${
          items.length ===
          1
            ? ""
            : "s"
        }`,

        order_id:
          orderData.order
            .razorpayOrderId,

        prefill: {
          name,
          email,
        },

        notes: {
          verdant_order_id:
            orderData.order.id,
        },

        theme: {
          color: "#0b6b50",
        },

        modal: {
          ondismiss: () => {
            setBusy(false);

            setNotice(
              "Payment window closed. Your order is still pending; you can try again."
            );
          },
        },

        handler:
          async function (
            response
          ) {
            try {
              setNotice(
                "Payment received. Verifying securely…"
              );

              const verified =
                await paymentApi(
                  "/api/orders/verify",
                  {
                    method:
                      "POST",

                    body: JSON.stringify(
                      response
                    ),
                  }
                );

              if (
                verified.paid
              ) {
                clearCart();

                setPaymentDone(
                  true
                );

                setNotice(
                  "Payment verified successfully. Your GIS download access is now active."
                );

                setTimeout(() => {
                  navigate("/dashboard", { replace: true });
                }, 450);
              } else {
                setNotice(
                  "Payment is awaiting capture. Your access will activate after confirmation."
                );
              }
            } catch (err) {
              setNotice(
                err.message ||
                  "Payment verification failed. Do not retry the payment until the order status is checked."
              );
            } finally {
              setBusy(false);
            }
          },
      };

      const rzp =
        new window.Razorpay(
          options
        );

      rzp.on(
        "payment.failed",
        (response) => {
          setNotice(
            response?.error
              ?.description ||
              "Payment failed. No download access was granted."
          );

          setBusy(false);
        }
      );

      rzp.open();
    } catch (err) {
      setNotice(
        err.message ||
          "Could not start payment."
      );

      setBusy(false);
    }
  }

  return (
    <>
      <Nav />

      <main className="checkout-page">
        <div className="checkout-top">
          <span className="section-kicker">
            SECURE CHECKOUT · TEST
            MODE
          </span>

          <h1>
            Complete your order.
          </h1>

          <p>
            Your price is recalculated
            from the store database
            before the Razorpay order
            is created.
          </p>
        </div>

        <div className="checkout-grid">
          <form
            className="checkout-form"
            onSubmit={
              startPayment
            }
          >
            <div className="checkout-card">
              <div className="checkout-card-title">
                <span>
                  01
                </span>

                <div>
                  <h3>
                    Contact details
                  </h3>

                  <p>
                    We'll use this
                    for your order
                    and download
                    access.
                  </p>
                </div>
              </div>

              <label>
                Full name

                <input
                  value={name}
                  onChange={(e) =>
                    setName(
                      e.target
                        .value
                    )
                  }
                  required
                  placeholder="Your name"
                />
              </label>

              <label>
                Email address

                <input
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(
                      e.target
                        .value
                    )
                  }
                  required
                  placeholder="you@example.com"
                />
              </label>
            </div>

            <div className="checkout-card">
              <div className="checkout-card-title">
                <span>
                  02
                </span>

                <div>
                  <h3>
                    Razorpay
                  </h3>

                  <p>
                    Secure test
                    checkout. No real
                    money is charged
                    in Test Mode.
                  </p>
                </div>
              </div>

              <div className="payment-placeholder">
                <ShieldCheck
                  size={25}
                />

                <div>
                  <b>
                    Razorpay Standard
                    Checkout
                  </b>

                  <span>
                    UPI, cards and
                    other test payment
                    methods are handled
                    by Razorpay.
                  </span>
                </div>
              </div>
            </div>

            {notice && (
              <div
                className={`checkout-notice ${
                  paymentDone
                    ? "success"
                    : ""
                }`}
              >
                {notice}
              </div>
            )}

            <button
              className="primary-btn checkout-submit"
              type="submit"
              disabled={
                busy ||
                paymentDone
              }
            >
              {paymentDone ? (
                <>
                  Payment verified{" "}
                  <CheckCircle2
                    size={17}
                  />
                </>
              ) : busy ? (
                <>
                  Opening secure
                  checkout…{" "}
                  <LoaderCircle
                    size={17}
                    className="spin"
                  />
                </>
              ) : (
                <>
                  Pay ₹
                  {subtotal.toLocaleString(
                    "en-IN"
                  )}{" "}
                  <ArrowRight
                    size={17}
                  />
                </>
              )}
            </button>

            {paymentDone && (
              <button
                type="button"
                className="secondary-btn checkout-submit"
                onClick={() =>
                  navigate(
                    "/dashboard"
                  )
                }
              >
                Go to My Downloads
              </button>
            )}
          </form>

          <aside className="checkout-summary">
            <span className="section-kicker">
              YOUR ORDER
            </span>

            <h2>
              {items.length} dataset
              {items.length ===
              1
                ? ""
                : "s"}
            </h2>

            <div className="checkout-order-items">
              {items.map(
                (item) => (
                  <div
                    className="checkout-order-item"
                    key={
                      item.id
                    }
                  >
                    <div>
                      <b>
                        {item.title}
                      </b>

                      <small>
                        {item.formats
                          .slice(
                            0,
                            3
                          )
                          .join(
                            " · "
                          )}
                      </small>
                    </div>

                    <strong>
                      {item.price ===
                      0
                        ? "FREE"
                        : `₹${item.price.toLocaleString(
                            "en-IN"
                          )}`}
                    </strong>
                  </div>
                )
              )}
            </div>

            <div className="summary-total">
              <span>
                Total
              </span>

              <strong>
                {subtotal === 0
                  ? "FREE"
                  : `₹${subtotal.toLocaleString(
                      "en-IN"
                    )}`}
              </strong>
            </div>

            <Link
              to="/cart"
              className="continue-link"
            >
              ← Back to cart
            </Link>
          </aside>
        </div>
      </main>
    </>
  );
}


/* =========================================================
   ADMIN DASHBOARD
========================================================= */

function AdminDashboard() {
  const [profile, setProfile] =
    useState(null);

  const [rows, setRows] =
    useState([]);

  const [categories, setCategories] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [query, setQuery] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState("all");

  const [busyId, setBusyId] =
    useState(null);

  const [message, setMessage] =
    useState("");

  async function load() {
    setLoading(true);
    setMessage("");

    const [
      { profile: p },
      {
        data: d,
        error: de,
      },
      { data: c },
    ] = await Promise.all([
      getCurrentUserProfile(),

      supabase
        .from("datasets")
        .select(
          "*, categories(name)"
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        ),

      getCategories(),
    ]);

    setProfile(p);

    if (de) {
      setMessage(
        de.message
      );
    }

    setRows(d || []);
    setCategories(c || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered =
    rows.filter((d) => {
      const q =
        query
          .trim()
          .toLowerCase();

      const haystack = [
        d.title,
        d.slug,
        d.location,
        d.coverage,
        d.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!q ||
          haystack.includes(q)) &&
        (statusFilter ===
          "all" ||
          d.status ===
            statusFilter) &&
        (categoryFilter ===
          "all" ||
          d.category_id ===
            categoryFilter)
      );
    });

  async function removeDataset(
    d
  ) {
    if (
      !window.confirm(
        `Delete "${d.title}"?\n\nThis removes the dataset record and its stored preview/source files. This cannot be undone.`
      )
    )
      return;

    setBusyId(d.id);

    try {
      await deleteDataset(d);

      setRows((prev) =>
        prev.filter(
          (x) =>
            x.id !== d.id
        )
      );

      setMessage(
        `Deleted "${d.title}".`
      );
    } catch (e) {
      setMessage(
        e.message ||
          "Delete failed."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function changeStatus(
    d,
    status
  ) {
    setBusyId(d.id);

    try {
      const updated =
        await updateDataset(
          d.id,
          { status }
        );

      setRows((prev) =>
        prev.map((x) =>
          x.id === d.id
            ? {
                ...x,
                ...updated,
              }
            : x
        )
      );

      setMessage(
        `"${d.title}" is now ${status}.`
      );
    } catch (e) {
      setMessage(
        e.message ||
          "Status update failed."
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!profile) {
    return (
      <>
        <Nav />

        <main className="simple-page">
          <div className="empty-state">
            <LoaderCircle
              className="spin"
              size={32}
            />

            <h3>
              Checking admin
              access…
            </h3>
          </div>
        </main>
      </>
    );
  }

  if (
    profile.role !==
    "admin"
  ) {
    return (
      <>
        <Nav />

        <main className="simple-page">
          <span className="section-kicker">
            ADMIN
          </span>

          <h1>
            Access denied.
          </h1>

          <div className="empty-state">
            <ShieldCheck
              size={36}
            />

            <h3>
              Your account is not
              an administrator.
            </h3>
          </div>
        </main>
      </>
    );
  }

  const published =
    rows.filter(
      (x) =>
        x.status ===
        "published"
    ).length;

  const drafts =
    rows.filter(
      (x) =>
        x.status ===
        "draft"
    ).length;

  const free =
    rows.filter(
      (x) =>
        Number(
          x.price || 0
        ) === 0
    ).length;

  const value =
    rows.reduce(
      (s, x) =>
        s +
        Number(
          x.price || 0
        ),
      0
    );

  return (
    <>
      <Nav />

      <main className="admin-dashboard">
        <div className="admin-head">
          <div>
            <span className="section-kicker">
              VERDANT GIS ADMIN
            </span>

            <h1>
              Manage your GIS store.
            </h1>

            <p>
              View, publish,
              unpublish and remove
              every dataset from one
              place.
            </p>
          </div>

          <div className="admin-head-actions">
            <button
              type="button"
              className="admin-signout-btn admin-signout-large"
              onClick={async () => {
                await signOut();
                window.location.assign(
                  "/"
                );
              }}
            >
              <LogOut
                size={16}
              />
              Sign out
            </button>

            <Link
              className="primary-btn admin-add"
              to="/admin/upload"
            >
              <Plus size={17} />
              Add dataset
            </Link>
          </div>
        </div>

        <div className="admin-stats">
          <div>
            <span>
              Total datasets
            </span>

            <strong>
              {rows.length}
            </strong>
          </div>

          <div>
            <span>
              Published
            </span>

            <strong>
              {published}
            </strong>
          </div>

          <div>
            <span>
              Drafts
            </span>

            <strong>
              {drafts}
            </strong>
          </div>

          <div>
            <span>
              Free datasets
            </span>

            <strong>
              {free}
            </strong>
          </div>

          <div>
            <span>
              Catalogue value
            </span>

            <strong>
              ₹
              {value.toLocaleString(
                "en-IN"
              )}
            </strong>
          </div>
        </div>

        {message && (
          <div className="admin-message">
            {message}
          </div>
        )}

        <section className="admin-table-card">
          <div className="admin-toolbar">
            <div className="admin-search">
              <Search
                size={16}
              />

              <input
                value={query}
                onChange={(e) =>
                  setQuery(
                    e.target
                      .value
                  )
                }
                placeholder="Search datasets, location or slug..."
              />
            </div>

            <select
              value={
                statusFilter
              }
              onChange={(e) =>
                setStatusFilter(
                  e.target
                    .value
                )
              }
            >
              <option value="all">
                All status
              </option>

              <option value="published">
                Published
              </option>

              <option value="draft">
                Draft
              </option>

              <option value="archived">
                Archived
              </option>
            </select>

            <select
              value={
                categoryFilter
              }
              onChange={(e) =>
                setCategoryFilter(
                  e.target
                    .value
                )
              }
            >
              <option value="all">
                All categories
              </option>

              {categories.map(
                (c) => (
                  <option
                    value={c.id}
                    key={c.id}
                  >
                    {c.name}
                  </option>
                )
              )}
            </select>

            <button
              className="ghost-btn"
              onClick={
                load
              }
            >
              <RefreshCw
                size={15}
              />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="table-loading">
              <LoaderCircle
                className="spin"
                size={28}
              />

              <span>
                Loading datasets…
              </span>
            </div>
          ) : filtered.length ===
            0 ? (
            <div className="table-loading">
              <Database
                size={30}
              />

              <span>
                No datasets match your
                filters.
              </span>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>
                      Dataset
                    </th>

                    <th>
                      Category
                    </th>

                    <th>
                      Price
                    </th>

                    <th>
                      Features
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Created
                    </th>

                    <th>
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map(
                    (d) => (
                      <tr
                        key={
                          d.id
                        }
                      >
                        <td>
                          <div className="dataset-cell">
                            <div className="dataset-thumb">
                              <Map
                                size={
                                  17
                                }
                              />
                            </div>

                            <div>
                              <b>
                                {
                                  d.title
                                }
                              </b>

                              <small>
                                {
                                  d.slug
                                }
                              </small>
                            </div>
                          </div>
                        </td>

                        <td>
                          {d
                            .categories
                            ?.name ||
                            "—"}
                        </td>

                        <td>
                          {Number(
                            d.price ||
                              0
                          ) ===
                          0
                            ? "FREE"
                            : `₹${Number(
                                d.price
                              ).toLocaleString(
                                "en-IN"
                              )}`}
                        </td>

                        <td>
                          {d.feature_count
                            ? Number(
                                d.feature_count
                              ).toLocaleString(
                                "en-IN"
                              )
                            : "—"}
                        </td>

                        <td>
                          <span
                            className={`status-pill ${
                              d.status ||
                              "draft"
                            }`}
                          >
                            {d.status ||
                              "draft"}
                          </span>
                        </td>

                        <td>
                          {d.created_at
                            ? new Date(
                                d.created_at
                              ).toLocaleDateString(
                                "en-IN"
                              )
                            : "—"}
                        </td>

                        <td>
                          <div className="row-actions">
                            <Link
                              className="icon-btn"
                              title="View"
                              to={`/dataset/${d.slug}`}
                            >
                              <ExternalLink
                                size={
                                  15
                                }
                              />
                            </Link>

                            {d.status ===
                            "published" ? (
                              <button
                                className="icon-btn"
                                title="Unpublish"
                                disabled={
                                  busyId ===
                                  d.id
                                }
                                onClick={() =>
                                  changeStatus(
                                    d,
                                    "draft"
                                  )
                                }
                              >
                                <EyeOff
                                  size={
                                    15
                                  }
                                />
                              </button>
                            ) : (
                              <button
                                className="icon-btn"
                                title="Publish"
                                disabled={
                                  busyId ===
                                  d.id
                                }
                                onClick={() =>
                                  changeStatus(
                                    d,
                                    "published"
                                  )
                                }
                              >
                                <Eye
                                  size={
                                    15
                                  }
                                />
                              </button>
                            )}

                            <button
                              className="icon-btn danger"
                              title="Delete permanently"
                              disabled={
                                busyId ===
                                d.id
                              }
                              onClick={() =>
                                removeDataset(
                                  d
                                )
                              }
                            >
                              <Trash2
                                size={
                                  15
                                }
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="admin-footnote">
          <ShieldCheck
            size={16}
          />

          <span>
            Delete requires
            confirmation. Private
            source files stay
            protected by Supabase
            Storage.
          </span>
        </div>
      </main>
    </>
  );
}


/* =========================================================
   ADMIN UPLOAD
========================================================= */

function AdminUpload() {
  const [profile, setProfile] =
    useState(null);

  const [
    categories,
    setCategories,
  ] = useState([]);

  const [form, setForm] =
    useState({
      title: "",
      description: "",
      categoryId: "",
      location: "",
      coverage: "",
      price: "0",
      formats:
        "SHP, GeoJSON",
      featureCount: "",
      crs: "EPSG:4326",
      source: "",
      updatedLabel: "",
    });

  const [
    previewFile,
    setPreviewFile,
  ] = useState(null);

  const [
    previewImageFile,
    setPreviewImageFile,
  ] = useState(null);

  const [
    sourceFile,
    setSourceFile,
  ] = useState(null);

  const [status, setStatus] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  useEffect(() => {
    getCurrentUserProfile().then(
      ({ profile }) =>
        setProfile(profile)
    );

    getCategories().then(
      ({ data }) =>
        setCategories(data || [])
    );
  }, []);

  function update(
    key,
    value
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function publish(e) {
    e.preventDefault();

    setStatus("");

    if (!previewFile) {
      return setStatus(
        "Please upload a GeoJSON preview file for Map Explorer."
      );
    }

    if (!form.title.trim()) {
      return setStatus(
        "Dataset title is required."
      );
    }

    if (
      !profile ||
      profile.role !==
        "admin"
    ) {
      return setStatus(
        "Admin access is required."
      );
    }

    setBusy(true);

    try {
      await createDatasetWithFiles({
        ...form,

        formats:
          form.formats
            .split(",")
            .map((x) =>
              x.trim()
            )
            .filter(Boolean),

        previewFile,
        previewImageFile,
        sourceFile,
      });

      setStatus(
        "Dataset published successfully."
      );

      setForm({
        title: "",
        description: "",
        categoryId: "",
        location: "",
        coverage: "",
        price: "0",
        formats:
          "SHP, GeoJSON",
        featureCount: "",
        crs: "EPSG:4326",
        source: "",
        updatedLabel: "",
      });

      setPreviewFile(null);
      setPreviewImageFile(null);
      setSourceFile(null);

      document.getElementById(
        "preview-upload"
      ).value = "";

      document.getElementById(
        "preview-image-upload"
      ).value = "";

      document.getElementById(
        "source-upload"
      ).value = "";
    } catch (err) {
      setStatus(
        err.message ||
          "Upload failed."
      );
    } finally {
      setBusy(false);
    }
  }

  if (
    profile &&
    profile.role !==
      "admin"
  ) {
    return (
      <>
        <Nav />

        <main className="simple-page">
          <span className="section-kicker">
            ADMIN
          </span>

          <h1>
            Access denied.
          </h1>

          <div className="empty-state">
            <ShieldCheck
              size={36}
            />

            <h3>
              Your account is not
              an administrator.
            </h3>

            <p>
              Set your profile role to
              admin in Supabase before
              using the uploader.
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />

      <main className="admin-upload">
        <div className="page-hero compact">
          <span className="section-kicker">
            DATA MANAGEMENT
          </span>

          <h1>
            Add a GIS dataset.
          </h1>

          <p>
            Upload a preview layer and
            an optional private source
            file.
          </p>
        </div>

        <form
          className="upload-card"
          onSubmit={publish}
        >
          <div className="upload-section">
            <h3>
              1. Dataset information
            </h3>

            <div className="form-grid">
              <label>
                Dataset title

                <input
                  value={form.title}
                  onChange={(e) =>
                    update(
                      "title",
                      e.target
                        .value
                    )
                  }
                  placeholder="e.g. District Boundaries 2026"
                />
              </label>

              <label>
                Category

                <select
                  value={
                    form.categoryId
                  }
                  onChange={(e) =>
                    update(
                      "categoryId",
                      e.target
                        .value
                    )
                  }
                >
                  <option value="">
                    Select category
                  </option>

                  {categories.map(
                    (c) => (
                      <option
                        value={
                          c.id
                        }
                        key={
                          c.id
                        }
                      >
                        {c.name}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Location

                <input
                  value={
                    form.location
                  }
                  onChange={(e) =>
                    update(
                      "location",
                      e.target
                        .value
                    )
                  }
                  placeholder="e.g. Kerala, India"
                />
              </label>

              <label>
                Coverage

                <input
                  value={
                    form.coverage
                  }
                  onChange={(e) =>
                    update(
                      "coverage",
                      e.target
                        .value
                    )
                  }
                  placeholder="e.g. Kerala"
                />
              </label>

              <label>
                Price (INR)

                <input
                  type="number"
                  min="0"
                  value={
                    form.price
                  }
                  onChange={(e) =>
                    update(
                      "price",
                      e.target
                        .value
                    )
                  }
                />
              </label>

              <label>
                Feature count

                <input
                  value={
                    form.featureCount
                  }
                  onChange={(e) =>
                    update(
                      "featureCount",
                      e.target
                        .value
                    )
                  }
                  placeholder="e.g. 1664"
                />
              </label>

              <label>
                CRS

                <input
                  value={
                    form.crs
                  }
                  onChange={(e) =>
                    update(
                      "crs",
                      e.target
                        .value
                    )
                  }
                  placeholder="EPSG:4326"
                />
              </label>

              <label>
                Formats

                <input
                  value={
                    form.formats
                  }
                  onChange={(e) =>
                    update(
                      "formats",
                      e.target
                        .value
                    )
                  }
                  placeholder="SHP, GeoJSON, KML"
                />
              </label>

              <label className="full-field">
                Description

                <textarea
                  value={
                    form.description
                  }
                  onChange={(e) =>
                    update(
                      "description",
                      e.target
                        .value
                    )
                  }
                  placeholder="Describe what the customer receives..."
                />
              </label>

              <label>
                Source

                <input
                  value={
                    form.source
                  }
                  onChange={(e) =>
                    update(
                      "source",
                      e.target
                        .value
                    )
                  }
                  placeholder="Verdant GIS / public source / survey"
                />
              </label>

              <label>
                Updated label

                <input
                  value={
                    form.updatedLabel
                  }
                  onChange={(e) =>
                    update(
                      "updatedLabel",
                      e.target
                        .value
                    )
                  }
                  placeholder="e.g. August 2026"
                />
              </label>
            </div>
          </div>

          <div className="upload-section">
            <h3>
              2. Files
            </h3>

            <label className="file-drop">
              Map Explorer preview —
              GeoJSON *

              <input
                id="preview-upload"
                type="file"
                accept=".geojson,.json,application/geo+json,application/json"
                onChange={(e) =>
                  setPreviewFile(
                    e.target
                      .files?.[0] ||
                      null
                  )
                }
              />

              <span>
                {previewFile
                  ? `✓ ${previewFile.name}`
                  : "Used only by Map Explorer for the interactive GIS layer."}
              </span>
            </label>

            <label className="file-drop image-drop">
              Dataset preview image

              <input
                id="preview-image-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) =>
                  setPreviewImageFile(
                    e.target.files?.[0] || null
                  )
                }
              />

              <span>
                {previewImageFile
                  ? `✓ ${previewImageFile.name}`
                  : "Optional. Used for fast product, category and dashboard previews."}
              </span>
            </label>

            <label className="file-drop private-drop">
              Paid source file —
              private

              <input
                id="source-upload"
                type="file"
                accept=".zip,.gpkg,.kml,.kmz,.tif,.tiff,.csv"
                onChange={(e) =>
                  setSourceFile(
                    e.target
                      .files?.[0] ||
                      null
                  )
                }
              />

              <span>
                {sourceFile
                  ? `✓ ${sourceFile.name}`
                  : "Optional. Stored in the private dataset-files bucket."}
              </span>
            </label>
          </div>

          {status && (
            <div className="upload-status">
              {status}
            </div>
          )}

          <div className="upload-actions">
            <span>
              <ShieldCheck
                size={16}
              />
              Only admins can publish
              datasets.
            </span>

            <button
              className="primary-btn"
              disabled={busy}
            >
              {busy
                ? "Publishing..."
                : "Publish dataset"}
            </button>
          </div>
        </form>
      </main>
    </>
  );
}


/* =========================================================
   CONTACT / DATASET REQUEST
========================================================= */

function ContactPage() {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", organization: "",
    requestType: "Dataset request", datasetArea: "", coverage: "",
    format: "", message: "", website: "",
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitRequest(event) {
    event.preventDefault();
    setBusy(true); setNotice(""); setSuccess(false);
    try {
      const response = await fetch(`${PAYMENT_API}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not submit your request.");
      setSuccess(true);
      setNotice("Thank you. Your request has been received. Our team will contact you shortly.");
      setForm({ name: "", email: "", phone: "", organization: "", requestType: "Dataset request", datasetArea: "", coverage: "", format: "", message: "", website: "" });
    } catch (err) {
      setNotice(err.message || "Could not submit your request.");
    } finally { setBusy(false); }
  }

  return (
    <>
      <Nav />
      <main className="contact-page">
        <section className="contact-hero">
          <div>
            <span className="section-kicker">CONTACT VERDANT GIS</span>
            <h1>Need a dataset that isn't in the catalogue?</h1>
            <p>Tell us what you need. Request a specific GIS dataset, ask for a custom dataset, or simply get in touch with our team.</p>
            <div className="contact-details">
              <a href="mailto:verdantelevate@gmail.com" className="contact-detail-card">
                <Mail size={19} />
                <span><small>Email</small><b>verdantelevate@gmail.com</b></span>
              </a>
              <div className="contact-detail-card">
                <Phone size={19} />
                <span><small>Phone / WhatsApp</small><b>We will contact you using the details submitted below.</b></span>
              </div>
            </div>
          </div>

          <div className="contact-form-card">
            <div className="contact-form-heading">
              <div><span className="section-kicker">REQUEST DATA</span><h2>Tell us what you need</h2></div>
              <Send size={22} />
            </div>
            <form onSubmit={submitRequest} className="contact-form-grid">
              <label>Name *<input value={form.name} onChange={(e) => updateField("name", e.target.value)} required maxLength={120} placeholder="Your name" /></label>
              <label>Email *<input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} required maxLength={180} placeholder="you@example.com" /></label>
              <label>Phone / WhatsApp<input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} maxLength={40} placeholder="+91 ..." /></label>
              <label>Organization / Institution<input value={form.organization} onChange={(e) => updateField("organization", e.target.value)} maxLength={160} placeholder="Optional" /></label>
              <label>Request type *<select value={form.requestType} onChange={(e) => updateField("requestType", e.target.value)} required><option>Dataset request</option><option>Custom GIS dataset</option><option>GIS mapping service</option><option>General enquiry</option></select></label>
              <label>Preferred format<select value={form.format} onChange={(e) => updateField("format", e.target.value)}><option value="">Select format</option><option>Shapefile</option><option>GeoJSON</option><option>GeoPackage</option><option>KML / KMZ</option><option>Raster</option><option>Other</option></select></label>
              <label>Dataset / area required<input value={form.datasetArea} onChange={(e) => updateField("datasetArea", e.target.value)} maxLength={180} placeholder="e.g. Kerala village boundaries" /></label>
              <label>Geographic coverage<input value={form.coverage} onChange={(e) => updateField("coverage", e.target.value)} maxLength={180} placeholder="e.g. Kerala, India" /></label>
              <label className="contact-full-field">Message / requirements *<textarea value={form.message} onChange={(e) => updateField("message", e.target.value)} required maxLength={3000} placeholder="Describe the dataset or service you need..." /></label>
              <label className="contact-honeypot" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => updateField("website", e.target.value)} /></label>
              {notice && <div className={`contact-notice ${success ? "success" : ""}`}>{notice}</div>}
              <button type="submit" className="primary-btn contact-submit" disabled={busy}>{busy ? "Sending…" : "Send Request"}<Send size={16} /></button>
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}


/* =========================================================
   FOOTER
========================================================= */

function Footer() {
  return (
    <footer>
      <div className="footer-inner">
        <div className="brand">
          <span className="brand-mark">
            V
          </span>

          <span>
            <b>
              VERDANT
            </b>

            <small>
              GIS
            </small>
          </span>
        </div>

        <span>
          Geospatial data, made
          usable.
        </span>

        <div>
          <Link to="/store">
            Store
          </Link>

          <Link to="/explore">
            Explorer
          </Link>

          <Link to="/contact">
            Contact
          </Link>

          <Link to="/dashboard">
            Account
          </Link>
        </div>
      </div>
    </footer>
  );
}


/* =========================================================
   APP ROUTES
========================================================= */

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<Home />}
      />

      <Route
        path="/store"
        element={<Store />}
      />

      <Route
        path="/categories"
        element={<CategoriesPage />}
      />

      <Route
        path="/categories/:slug"
        element={<CategoryPage />}
      />

      <Route
        path="/dataset/:id"
        element={<DatasetRoute />}
      />

      <Route
        path="/explore"
        element={<Explore />}
      />
      <Route
        path="/studio"
        element={<StudioPage />}
      />
      <Route
        path="/contact"
        element={<ContactPage />}
      />

      <Route
        path="/dashboard"
        element={<Dashboard />}
      />

      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/cart"
        element={<Cart />}
      />

      <Route
        path="/checkout"
        element={<Checkout />}
      />

      <Route
        path="/admin"
        element={
          <AdminDashboard />
        }
      />

      <Route
        path="/admin/upload"
        element={
          <AdminUpload />
        }
      />

      <Route
        path="*"
        element={<Home />}
      />
    </Routes>
  );
}


/* =========================================================
   DATASET ROUTE
========================================================= */

function DatasetRoute() {
  const { id } = useParams();

  const [remote, setRemote] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    if (!supabaseReady) {
      setLoading(false);
      return;
    }

    supabase
      .from("datasets")
      .select(
        "id,slug,title,description,category_id,location,coverage,price,currency,formats,feature_count,crs,file_size,source,updated_label,thumbnail_url,preview_geojson_url,download_path,status,created_at,updated_at,categories(name)"
      )
      .eq("slug", id)
      .eq("status", "published")
      .maybeSingle()
      .then(({ data }) => {
        if (active) {
          setRemote(data || null);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  /*
   * =========================================================
   * DYNAMIC SEO METADATA
   * =========================================================
   */

  useEffect(() => {
    if (!remote) return;

    const datasetTitle =
      remote.title || "GIS Dataset";

    const categoryName =
      remote.categories?.name || "GIS Data";

    const location =
      remote.location ||
      remote.coverage ||
      "India";

    const description =
      remote.description ||
      `Explore ${datasetTitle}, a ${categoryName} geospatial dataset available through Verdant GIS.`;

    /*
     * SEO TITLE
     */

    document.title =
      `${datasetTitle} | GIS Data & Shapefile | Verdant GIS`;

    /*
     * META DESCRIPTION
     */

    const seoDescription =
      `${description} GIS data for mapping, research, remote sensing, spatial analysis and planning.`.slice(
        0,
        160
      );

    let metaDescription =
      document.querySelector(
        'meta[name="description"]'
      );

    if (!metaDescription) {
      metaDescription =
        document.createElement("meta");

      metaDescription.setAttribute(
        "name",
        "description"
      );

      document.head.appendChild(
        metaDescription
      );
    }

    metaDescription.setAttribute(
      "content",
      seoDescription
    );

    /*
     * CANONICAL
     *
     * Your dataset URL uses the slug from Supabase.
     */

    const canonicalUrl =
      `https://verdantgis.com/dataset/${remote.slug}`;

    let canonical =
      document.querySelector(
        'link[rel="canonical"]'
      );

    if (!canonical) {
      canonical =
        document.createElement("link");

      canonical.setAttribute(
        "rel",
        "canonical"
      );

      document.head.appendChild(
        canonical
      );
    }

    canonical.setAttribute(
      "href",
      canonicalUrl
    );

    /*
     * =========================================================
     * OPEN GRAPH
     * =========================================================
     */

    const setPropertyMeta = (
      property,
      content
    ) => {
      let element =
        document.querySelector(
          `meta[property="${property}"]`
        );

      if (!element) {
        element =
          document.createElement("meta");

        element.setAttribute(
          "property",
          property
        );

        document.head.appendChild(
          element
        );
      }

      element.setAttribute(
        "content",
        content
      );
    };

    setPropertyMeta(
      "og:title",
      `${datasetTitle} | Verdant GIS`
    );

    setPropertyMeta(
      "og:description",
      seoDescription
    );

    setPropertyMeta(
      "og:url",
      canonicalUrl
    );

    setPropertyMeta(
      "og:type",
      "website"
    );

    setPropertyMeta(
      "og:site_name",
      "Verdant GIS"
    );

    if (remote.thumbnail_url) {
      setPropertyMeta(
        "og:image",
        remote.thumbnail_url
      );
    }

    /*
     * =========================================================
     * TWITTER / X
     * =========================================================
     */

    const setNameMeta = (
      name,
      content
    ) => {
      let element =
        document.querySelector(
          `meta[name="${name}"]`
        );

      if (!element) {
        element =
          document.createElement("meta");

        element.setAttribute(
          "name",
          name
        );

        document.head.appendChild(
          element
        );
      }

      element.setAttribute(
        "content",
        content
      );
    };

    setNameMeta(
      "twitter:card",
      "summary_large_image"
    );

    setNameMeta(
      "twitter:title",
      `${datasetTitle} | Verdant GIS`
    );

    setNameMeta(
      "twitter:description",
      seoDescription
    );

    if (remote.thumbnail_url) {
      setNameMeta(
        "twitter:image",
        remote.thumbnail_url
      );
    }

    /*
     * =========================================================
     * DATASET STRUCTURED DATA
     * =========================================================
     */

    const oldSchema =
      document.getElementById(
        "verdant-dataset-schema"
      );

    if (oldSchema) {
      oldSchema.remove();
    }

    const schema =
      document.createElement("script");

    schema.id =
      "verdant-dataset-schema";

    schema.type =
      "application/ld+json";

    schema.textContent =
      JSON.stringify({
        "@context":
          "https://schema.org",

        "@type":
          "Dataset",

        name:
          datasetTitle,

        description:
          description,

        url:
          canonicalUrl,

        creator: {
          "@type":
            "Organization",

          name:
            "Verdant GIS",

          url:
            "https://verdantgis.com/"
        },

        publisher: {
          "@type":
            "Organization",

          name:
            "Verdant GIS",

          url:
            "https://verdantgis.com/"
        },

        spatialCoverage:
          location,

        keywords: [
          "GIS data",
          "GIS dataset",
          "geospatial data",
          "shapefile",
          "remote sensing data",
          "spatial data",
          categoryName,
          location
        ],

        ...(remote.formats?.length
          ? {
              encodingFormat:
                remote.formats
            }
          : {}),

        ...(remote.updated_at
          ? {
              dateModified:
                remote.updated_at
            }
          : {}),

        ...(remote.created_at
          ? {
              datePublished:
                remote.created_at
            }
          : {}),

        ...(remote.thumbnail_url
          ? {
              image:
                remote.thumbnail_url
            }
          : {})
      });

    document.head.appendChild(
      schema
    );

    /*
     * Cleanup structured data
     */

    return () => {
      const schemaElement =
        document.getElementById(
          "verdant-dataset-schema"
        );

      if (schemaElement) {
        schemaElement.remove();
      }
    };
  }, [remote]);

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (loading) {
    return (
      <>
        <Nav />

        <main className="simple-page">
          <LoaderCircle
            className="spin"
            size={32}
          />

          <h2>
            Loading dataset…
          </h2>
        </main>
      </>
    );
  }

  /*
   * =========================================================
   * FALLBACK
   * =========================================================
   */

  if (!remote) {
    return (
      <DatasetPage
        id={id}
      />
    );
  }

  /*
   * =========================================================
   * DATASET OBJECT
   *
   * IMPORTANT:
   * UUID and slug remain separate.
   * =========================================================
   */

  const d = {
    ...remote,

    id: remote.id,

    slug: remote.slug,

    category:
      remote.categories?.name ||
      "GIS Data",

    formats:
      remote.formats || [],

    price: Number(
      remote.price || 0
    ),

    features:
      remote.feature_count ||
      "—",

    location:
      remote.location ||
      remote.coverage ||
      "",

    coverage:
      remote.coverage ||
      remote.location ||
      "",

    updated:
      remote.updated_label ||
      "Recently updated",

    icon: Map,
  };

  return (
    <DatasetPageRemote
      d={d}
    />
  );
}

/* =========================================================
   REMOTE DATASET PAGE
========================================================= */

function DatasetPageRemote({ d }) {
  /*
   * =========================================================
   * DYNAMIC SEO FOR INDIVIDUAL GIS DATASET PAGES
   * =========================================================
   */

  useEffect(() => {
    const siteName = "Verdant GIS";

    const datasetTitle =
      d.title || "GIS Dataset";

    const category =
      d.category || "GIS Data";

    const location =
      d.location ||
      d.coverage ||
      "India";

    /*
     * SEO title
     */
    const seoTitle =
      `${datasetTitle} | GIS Data, Shapefile & Geospatial Dataset | ${siteName}`;

    /*
     * SEO description
     */
    const seoDescription =
      d.description ||
      `${datasetTitle} is a ${category} geospatial dataset covering ${location}. Suitable for GIS mapping, spatial analysis, research, planning, QGIS, ArcGIS and Python.`;

    /*
     * Keep description within a good search-result length.
     */
    const description =
      seoDescription
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 160);

    /*
     * Canonical URL
     */
    const canonicalUrl =
      `https://verdantgis.com/dataset/${d.slug}`;

    /*
     * ---------------------------------------------------------
     * PAGE TITLE
     * ---------------------------------------------------------
     */

    document.title = seoTitle;

    /*
     * ---------------------------------------------------------
     * HELPER FOR META TAGS
     * ---------------------------------------------------------
     */

    const setMeta = (
      attribute,
      key,
      content
    ) => {
      if (!content) return;

      let element =
        document.head.querySelector(
          `meta[${attribute}="${key}"]`
        );

      if (!element) {
        element =
          document.createElement("meta");

        element.setAttribute(
          attribute,
          key
        );

        document.head.appendChild(
          element
        );
      }

      element.setAttribute(
        "content",
        content
      );
    };

    /*
     * ---------------------------------------------------------
     * META DESCRIPTION
     * ---------------------------------------------------------
     */

    setMeta(
      "name",
      "description",
      description
    );

    /*
     * ---------------------------------------------------------
     * ROBOTS
     * ---------------------------------------------------------
     */

    setMeta(
      "name",
      "robots",
      "index, follow"
    );

    /*
     * ---------------------------------------------------------
     * CANONICAL
     * ---------------------------------------------------------
     */

    let canonical =
      document.head.querySelector(
        'link[rel="canonical"]'
      );

    if (!canonical) {
      canonical =
        document.createElement("link");

      canonical.setAttribute(
        "rel",
        "canonical"
      );

      document.head.appendChild(
        canonical
      );
    }

    canonical.setAttribute(
      "href",
      canonicalUrl
    );

    /*
     * ---------------------------------------------------------
     * OPEN GRAPH
     * ---------------------------------------------------------
     */

    setMeta(
      "property",
      "og:title",
      seoTitle
    );

    setMeta(
      "property",
      "og:description",
      description
    );

    setMeta(
      "property",
      "og:url",
      canonicalUrl
    );

    setMeta(
      "property",
      "og:type",
      "website"
    );

    setMeta(
      "property",
      "og:site_name",
      siteName
    );

    if (d.thumbnail_url) {
      setMeta(
        "property",
        "og:image",
        d.thumbnail_url
      );
    }

    /*
     * ---------------------------------------------------------
     * TWITTER / X
     * ---------------------------------------------------------
     */

    setMeta(
      "name",
      "twitter:card",
      "summary_large_image"
    );

    setMeta(
      "name",
      "twitter:title",
      seoTitle
    );

    setMeta(
      "name",
      "twitter:description",
      description
    );

    if (d.thumbnail_url) {
      setMeta(
        "name",
        "twitter:image",
        d.thumbnail_url
      );
    }

    /*
     * ---------------------------------------------------------
     * CLEANUP
     * ---------------------------------------------------------
     */

    return () => {
      const schema =
        document.getElementById(
          "dataset-schema"
        );

      if (schema) {
        schema.remove();
      }
    };
  }, [
    d.title,
    d.description,
    d.slug,
    d.category,
    d.location,
    d.coverage,
    d.thumbnail_url,
  ]);

  /*
   * =========================================================
   * DATASET STRUCTURED DATA
   * =========================================================
   */

  useEffect(() => {
    const existing =
      document.getElementById(
        "dataset-schema"
      );

    if (existing) {
      existing.remove();
    }

    const keywords = [
      "GIS data",
      "GIS dataset",
      "geospatial data",
      "shapefile",
      "India GIS data",
      "India shapefile",
      "geospatial dataset",
      "spatial data",
      "remote sensing data",
      "GIS mapping",
      "QGIS data",
      "ArcGIS data",
      d.category,
      d.location,
      d.coverage,
    ].filter(Boolean);

    const schema = {
      "@context":
        "https://schema.org",

      "@type": "Dataset",

      "name":
        d.title ||
        "GIS Dataset",

      "description":
        d.description ||
        `${d.title} GIS dataset available from Verdant GIS.`,

      "url":
        `https://verdantgis.com/dataset/${d.slug}`,

      "keywords":
        keywords.join(", "),

      "spatialCoverage":
        d.coverage ||
        d.location ||
        "India",

      "creator": {
        "@type":
          "Organization",

        "name":
          "Verdant GIS",

        "url":
          "https://verdantgis.com/"
      },

      "publisher": {
        "@type":
          "Organization",

        "name":
          "Verdant GIS",

        "url":
          "https://verdantgis.com/"
      },

      "distribution":
        (d.formats || []).map(
          (format) => ({
            "@type":
              "DataDownload",

            "encodingFormat":
              format,

            "contentUrl":
              `https://verdantgis.com/dataset/${d.slug}`
          })
        )
    };

    const script =
      document.createElement(
        "script"
      );

    script.id =
      "dataset-schema";

    script.type =
      "application/ld+json";

    script.textContent =
      JSON.stringify(schema);

    document.head.appendChild(
      script
    );

    return () => {
      const element =
        document.getElementById(
          "dataset-schema"
        );

      if (element) {
        element.remove();
      }
    };
  }, [
    d.title,
    d.description,
    d.slug,
    d.category,
    d.location,
    d.coverage,
    d.formats,
  ]);

  /*
   * =========================================================
   * PRODUCT PAGE UI
   * =========================================================
   */

  return (
    <>
      <Nav />

      <main className="detail-page">

        <div className="breadcrumbs">

          <Link to="/categories">
            GIS Data Catalogue
          </Link>

          <span>/</span>

          <span>
            {d.category ||
              "GIS Data"}
          </span>

          <span>/</span>

          <b>
            {d.title}
          </b>

        </div>


        <div className="detail-grid">

          <div>

            <div className="large-map">

              {d.thumbnail_url ? (

                <DatasetPreviewImage
                  url={d.thumbnail_url}
                  title={d.title}
                />

              ) : (

                <div className="dataset-preview-placeholder">

                  <Map size={42} />

                  <strong>
                    {d.title ||
                      "GIS dataset"}
                  </strong>

                  <span>
                    Interactive preview
                    available in Map Explorer.
                  </span>

                </div>

              )}

            </div>

          </div>


          <div className="detail-copy">

            <span className="tag">
              {d.category ||
                "GIS Data"}
            </span>


            <h1>
              {d.title}
            </h1>


            <p className="lead">
              {d.description}
            </p>


            <div className="price">

              {d.price === 0
                ? "FREE"
                : `₹${d.price.toLocaleString(
                    "en-IN"
                  )}`}

              {d.price > 0 && (
                <small>
                  one-time
                </small>
              )}

            </div>


            <div className="format-list">

              {(d.formats || []).map(
                (f) => (

                  <span key={f}>
                    {f}
                  </span>

                )
              )}

            </div>


            <AddToCartButton
              dataset={d}
            />


            <div className="purchase-note">

              <ShieldCheck
                size={17}
              />

              <span>
                Secure checkout ·
                Instant access after
                purchase
              </span>

            </div>

          </div>

        </div>


        <section className="data-info">

          <div>

            <span className="section-kicker">
              DATASET DETAILS
            </span>

            <h2>
              {d.title} — Dataset Details
            </h2>

          </div>


          <div className="info-grid">

            <Info
              label="Coverage"
              value={
                d.coverage ||
                d.location ||
                "India"
              }
            />

            <Info
              label="Features"
              value={
                d.features ||
                "—"
              }
            />

            <Info
              label="Formats"
              value={
                (d.formats || []).join(
                  ", "
                )
              }
            />

            <Info
              label="Last updated"
              value={
                d.updated ||
                "Recently updated"
              }
            />

            <Info
              label="CRS"
              value={
                d.crs ||
                "EPSG:4326"
              }
            />

            <Info
              label="Compatibility"
              value="QGIS · ArcGIS · Python"
            />

          </div>

        </section>

      </main>

      <Footer />
    </>
  );
}