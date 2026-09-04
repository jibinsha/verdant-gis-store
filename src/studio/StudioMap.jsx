import React, { useEffect, useRef } from "react";
import {
  Map,
  Marker,
  Popup,
  NavigationControl,
  ScaleControl,
  AttributionControl,
  LngLatBounds,
  setWorkerUrl
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { featureContainsPoint } from "./spatial";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

const SOURCE_PREFIX = "studio-source-";
const LAYER_PREFIX = "studio-layer-";
const IDW_PALETTES = {
  Spectrum: [
    "#3b4cc0",
    "#5b6fd0",
    "#7b8fd1",
    "#4aa6b8",
    "#75b798",
    "#a7cf8c",
    "#d6d94f",
    "#f5c04b",
    "#f28e38",
    "#d84a5a",
    "#9b3f8f",
    "#303f9f"
  ],

  Viridis: [
    "#440154",
    "#482878",
    "#3e4989",
    "#31688e",
    "#26828e",
    "#1f9e89",
    "#35b779",
    "#6ece58",
    "#b5de2b",
    "#fde725"
  ],

  Earth: [
    "#543005",
    "#8c510a",
    "#bf812d",
    "#dfc27d",
    "#c7eae5",
    "#80cdc1",
    "#35978f",
    "#01665e",
    "#003c30",
    "#1b7837"
  ],

  Cool: [
    "#313695",
    "#4575b4",
    "#74add1",
    "#abd9e9",
    "#e0f3f8",
    "#fee090",
    "#fdae61",
    "#f46d43",
    "#d73027",
    "#a50026"
  ]
};
// Vite must emit the MapLibre worker as a real JavaScript module. This avoids
// the static-host fallback page being returned for /assets/*.mjs.
setWorkerUrl(maplibreWorkerUrl);

// Key-free public basemaps for the Studio canvas.
// Sampling points, boundaries and interpolation are rendered above these layers.
class BasemapControl {
  onAdd(map) {
    this.map = map;

    const container = document.createElement("div");
    container.className = "maplibregl-ctrl maplibregl-ctrl-group studio-basemap-control";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.overflow = "hidden";

    const makeButton = (label, title) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.title = title;
      button.setAttribute("aria-label", title);
      button.style.width = "58px";
      button.style.height = "30px";
      button.style.fontSize = "11px";
      button.style.fontWeight = "600";
      button.style.lineHeight = "1";
      button.style.padding = "0 6px";
      button.style.cursor = "pointer";
      button.style.background = "#fff";
      button.style.color = "#24332d";
      button.style.border = "0";
      return button;
    };

    this.osmButton = makeButton("OSM", "OpenStreetMap");
    this.satelliteButton = makeButton("SAT", "Satellite imagery");

    const setActive = (mode) => {
      if (!this.map.getLayer("studio-basemap-osm") || !this.map.getLayer("studio-basemap-satellite")) return;

      const satellite = mode === "satellite";
      this.map.setLayoutProperty(
        "studio-basemap-osm",
        "visibility",
        satellite ? "none" : "visible"
      );
      this.map.setLayoutProperty(
        "studio-basemap-satellite",
        "visibility",
        satellite ? "visible" : "none"
      );

      this.osmButton.style.background = satellite ? "#fff" : "#e8f4ef";
      this.satelliteButton.style.background = satellite ? "#e8f4ef" : "#fff";
      this.osmButton.style.color = satellite ? "#52645b" : "#087f5b";
      this.satelliteButton.style.color = satellite ? "#087f5b" : "#52645b";
    };

    this.osmButton.addEventListener("click", () => setActive("osm"));
    this.satelliteButton.addEventListener("click", () => setActive("satellite"));

    container.appendChild(this.osmButton);
    container.appendChild(this.satelliteButton);
    this.container = container;
    this.setActive = setActive;

    return container;
  }

  onRemove() {
    this.osmButton?.removeEventListener("click", this.setActive);
    this.satelliteButton?.removeEventListener("click", this.setActive);
    this.container?.remove();
    this.map = undefined;
  }
}

function getPointFeatures(layers) {
  return (layers || []).flatMap((layer) =>
    (layer?.geojson?.features || [])
      .filter((feature) => feature?.geometry?.type === "Point")
      .filter((feature) => {
        const coordinates = feature.geometry.coordinates;

        return (
          Array.isArray(coordinates) &&
          Number.isFinite(Number(coordinates[0])) &&
          Number.isFinite(Number(coordinates[1])) &&
          Number(coordinates[0]) >= -180 &&
          Number(coordinates[0]) <= 180 &&
          Number(coordinates[1]) >= -90 &&
          Number(coordinates[1]) <= 90
        );
      })
  );
}

function removeStudioLayers(map) {
  if (!map?.getStyle()) return;

  [...(map.getStyle().layers || [])]
    .reverse()
    .forEach((layer) => {
      if (
        layer.id.startsWith(LAYER_PREFIX) &&
        map.getLayer(layer.id)
      ) {
        map.removeLayer(layer.id);
      }
    });

  Object.keys(map.getStyle().sources || {}).forEach((sourceId) => {
    if (
      sourceId.startsWith(SOURCE_PREFIX) &&
      map.getSource(sourceId)
    ) {
      map.removeSource(sourceId);
    }
  });
}

function featureBounds(features) {
  const bounds = new LngLatBounds();

  const walk = (coordinates) => {
    if (!Array.isArray(coordinates)) return;

    if (
      coordinates.length >= 2 &&
      Number.isFinite(Number(coordinates[0])) &&
      Number.isFinite(Number(coordinates[1]))
    ) {
      bounds.extend([
        Number(coordinates[0]),
        Number(coordinates[1])
      ]);
      return;
    }

    coordinates.forEach(walk);
  };

  (features || []).forEach((feature) => {
    walk(feature?.geometry?.coordinates);
  });

  return bounds.isEmpty() ? null : bounds;
}

function fitToMapExtent(
  map,
  {
    points = [],
    selectedBoundaryFeature = null,
    boundaryFeatures = [],
    analysisGeojson = null,
    focusTarget = null,
    mapModeForFit = "location",
    duration = 550
  }
) {
  const pointBounds = featureBounds(points);
  const boundaryBounds = featureBounds([
    ...(boundaryFeatures || []),
    ...(selectedBoundaryFeature ? [selectedBoundaryFeature] : [])
  ]);
  const analysisBounds = featureBounds(analysisGeojson?.features || []);
  const bounds = new LngLatBounds();

  // Camera is changed only by an initial data load or an explicit user
  // action. Automatic boundary matching never reaches this function as a
  // camera trigger, so it cannot re-zoom the sampling sites later.
  if (focusTarget?.type === "boundary" && boundaryBounds && !boundaryBounds.isEmpty()) {
    // A boundary click/upload is an explicit request: show the uploaded
    // boundary AND the sampling points in the canvas so the boundary can
    // never be silently off-screen.
    bounds.extend(boundaryBounds);
    if (pointBounds && !pointBounds.isEmpty()) bounds.extend(pointBounds);
  } else if (focusTarget?.type === "layer") {
    // Clicking a project layer always means "zoom to this layer".
    if (pointBounds && !pointBounds.isEmpty()) bounds.extend(pointBounds);
  } else if (pointBounds && !pointBounds.isEmpty()) {
    // Default/initial view: the complete CSV point set is authoritative.
    bounds.extend(pointBounds);

    if (
      mapModeForFit === "interpolation" &&
      analysisBounds &&
      !analysisBounds.isEmpty()
    ) {
      bounds.extend(analysisBounds);
    }
  } else if (boundaryBounds && !boundaryBounds.isEmpty()) {
    bounds.extend(boundaryBounds);
  }

  if (bounds.isEmpty()) return;

  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const samePoint =
    Math.abs(sw.lng - ne.lng) < 0.000001 &&
    Math.abs(sw.lat - ne.lat) < 0.000001;

  if (samePoint) {
    map.easeTo({
      center: [sw.lng, sw.lat],
      zoom: 15.5,
      duration
    });
    return;
  }

  map.fitBounds(bounds, {
    padding: { top: 70, bottom: 70, left: 70, right: 70 },
    maxZoom: 16.5,
    duration
  });
}

function markerElement(size) {
  const el = document.createElement("div");
  const px = Math.max(10, Number(size || 6) * 2);

  el.style.width = `${px}px`;
  el.style.height = `${px}px`;
  el.style.borderRadius = "50%";
  el.style.background = "#087f5b";
  el.style.border = "2px solid #fff";
  el.style.boxShadow =
    "0 0 0 2px rgba(8,127,91,.25),0 2px 6px rgba(0,0,0,.3)";

  return el;
}

function addBoundary(map, boundary, selected) {
  if (!boundary?.geojson) return;

  const sourceId =
    `${SOURCE_PREFIX}boundary-${boundary.id}`;

  const fillId =
    `${LAYER_PREFIX}boundary-fill-${boundary.id}`;

  const lineId =
    `${LAYER_PREFIX}boundary-line-${boundary.id}`;

  map.addSource(sourceId, {
    type: "geojson",
    data: boundary.geojson
  });

  map.addLayer({
    id: fillId,
    type: "fill",
    source: sourceId,
    filter: [
      "any",
      ["==", ["geometry-type"], "Polygon"],
      ["==", ["geometry-type"], "MultiPolygon"]
    ],
    paint: {
      "fill-color": selected ? "#2f9e76" : "#8bb7a6",
      "fill-opacity": selected ? 0.08 : 0.015
    }
  });

  map.addLayer({
    id: lineId,
    type: "line",
    source: sourceId,
    // A line layer can draw polygon outlines as well as LineString
    // boundaries, so uploaded boundary files remain visible even when the
    // source is not a Polygon/MultiPolygon FeatureCollection.
    paint: {
      "line-color": selected ? "#087f5b" : "#65756e",
      "line-width": selected ? 3 : 1.4,
      "line-opacity": selected ? 1 : 0.8
    }
  });
}

export default function StudioMap({
  layers = [],
  boundaries = [],
  analysisResult = null,
  mapMode = "location",
  idwPalette = "Spectrum",
  pointSize = 6,
  showPoints = true,
  selectedBoundaryId = "",
  selectedBoundaryFeature = null,
  activeLayerId = null,
  focusRequest = 0,
  focusTarget = null
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const fitListenerRef = useRef(null);
  const fitTimeoutsRef = useRef([]);
  // Tracks the last explicit layer/boundary focus request so rendering or
  // automatic boundary updates cannot accidentally repeat the camera move.
  const lastFocusRequestRef = useRef(null);

  function removeMarkers() {
    markersRef.current.forEach((marker) => {
      try {
        marker.remove();
      } catch {
        // Marker may already have been removed with the map.
      }
    });

    markersRef.current = [];
  }

  function render() {
    const map = mapRef.current;

    if (!map || !map.isStyleLoaded()) return;

    if (fitListenerRef.current) {
      map.off("idle", fitListenerRef.current);
      fitListenerRef.current = null;
    }

    fitTimeoutsRef.current.forEach((timeoutId) =>
      window.clearTimeout(timeoutId)
    );
    fitTimeoutsRef.current = [];

    removeStudioLayers(map);
    removeMarkers();

    const activeLayer = (layers || []).find(
      (layer) => layer?.id === activeLayerId
    );
    const points = getPointFeatures(
      activeLayer ? [activeLayer] : []
    );

    // Boundary library layers.
    (boundaries || []).forEach((boundary) => {
      addBoundary(
        map,
        boundary,
        boundary.id === selectedBoundaryId ||
          boundary?.sourceType === "upload"
      );
    });

    const uploadedBoundaryFeatures = (boundaries || [])
      .filter((boundary) => boundary?.sourceType === "upload")
      .flatMap((boundary) => boundary?.geojson?.features || []);

    // Publication-style IDW surface.
    if (
      mapMode === "interpolation" &&
      analysisResult?.geojson?.features?.length
    ) {
      const sourceId =
        `${SOURCE_PREFIX}analysis`;

      map.addSource(sourceId, {
        type: "geojson",
        data: analysisResult.geojson
      });

      const values = analysisResult.geojson.features
        .map((feature) =>
          Number(
            feature.properties?.[
              analysisResult.valueField
            ]
          )
        )
        .filter(Number.isFinite);

      const min = values.length
        ? Math.min(...values)
        : 0;

      const max = values.length
        ? Math.max(...values)
        : 1;

      const range =
        max === min ? 1 : max - min;

      map.addLayer({
        id: `${LAYER_PREFIX}analysis-fill`,
        type: "fill",
        source: sourceId,
        filter: [
          "any",
          ["==", ["geometry-type"], "Polygon"],
          ["==", ["geometry-type"], "MultiPolygon"]
        ],
        paint: {
          "fill-opacity": 0.78,
          "fill-color": [
            "interpolate",
            ["linear"],
            [
              "coalesce",
              [
                "to-number",
                [
                  "get",
                  analysisResult.valueField
                ]
              ],
              min
            ],

            min,
            IDW_PALETTES[idwPalette][0],

            min + range * 0.25,
            IDW_PALETTES[idwPalette][
              Math.floor(
                IDW_PALETTES[idwPalette].length * 0.25
              )
            ],

            min + range * 0.5,
            IDW_PALETTES[idwPalette][
              Math.floor(
                IDW_PALETTES[idwPalette].length * 0.5
              )
            ],

            min + range * 0.75,
            IDW_PALETTES[idwPalette][
              Math.floor(
                IDW_PALETTES[idwPalette].length * 0.75
              )
            ],

            max,
            IDW_PALETTES[idwPalette][
              IDW_PALETTES[idwPalette].length - 1
            ]
          ]
        }
      });

      // Keep sampling points as DOM markers. This is deliberately retained
      // for reliability: markers remain visible independently of the basemap
      // style/source stack and are recreated whenever the active CSV changes.
      // removeMarkers() above guarantees deleted/replaced CSV layers cannot
      // leave stale points behind.
      if (showPoints && points.length) {
        points.forEach((feature, index) => {
          const props = feature.properties || {};
          const label =
            props["Sample no."] ||
            props.Sample ||
            props.Name ||
            props.name ||
            `Location ${index + 1}`;

          const marker = new Marker({
            element: markerElement(pointSize),
            anchor: "center"
          })
            .setLngLat(feature.geometry.coordinates)
            .setPopup(
              new Popup({ offset: 12 }).setText(String(label))
            )
            .addTo(map);

          markersRef.current.push(marker);
        });
      }
    }


  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new Map({
      container: containerRef.current,
      preserveDrawingBuffer: true,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [
              "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            ],
            tileSize: 256,
            maxzoom: 19,
            attribution: "© OpenStreetMap contributors"
          },
          satellite: {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            ],
            tileSize: 256,
            maxzoom: 19,
            attribution: "© Esri, Maxar, Earthstar Geographics, and the GIS User Community"
          }
        },
        layers: [
          {
            id: "studio-basemap-osm",
            type: "raster",
            source: "osm"
          },
          {
            id: "studio-basemap-satellite",
            type: "raster",
            source: "satellite",
            layout: {
              visibility: "none"
            }
          }
        ]
      },
      center: [78.9629, 20.5937],
      zoom: 4.5
    });

    map.addControl(
      new NavigationControl(),
      "top-right"
    );

    map.addControl(
      new ScaleControl(),
      "bottom-left"
    );

    map.addControl(
      new AttributionControl({ compact: true }),
      "bottom-right"
    );

    map.addControl(
      new BasemapControl(),
      "top-right"
    );

    mapRef.current = map;

    // OSM is the default key-free basemap.
    map.once("idle", () => {
      const control = document.querySelector(".studio-basemap-control");
      if (control) {
        const buttons = control.querySelectorAll("button");
        if (buttons[0]) {
          buttons[0].style.background = "#e8f4ef";
          buttons[0].style.color = "#087f5b";
        }
      }
    });

    map.once("load", render);

    return () => {
      if (fitListenerRef.current) {
        map.off("idle", fitListenerRef.current);
        fitListenerRef.current = null;
      }
      fitTimeoutsRef.current.forEach((timeoutId) =>
        window.clearTimeout(timeoutId)
      );
      fitTimeoutsRef.current = [];
      removeMarkers();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let frame = null;
    let cancelled = false;

    const redraw = () => {
      if (cancelled) return;

      // A layer upload/removal can happen while MapLibre is still painting
      // the previous frame. Resize + redraw on the next frame so the canvas
      // always reflects the current active layer immediately, without a
      // page refresh.
      map.resize();
      render();
    };

    if (map.isStyleLoaded()) {
      frame = requestAnimationFrame(redraw);
    } else {
      map.once("load", redraw);
    }

    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
      map.off("load", redraw);
    };
  }, [
    layers,
    boundaries,
    analysisResult,
    mapMode,
    idwPalette,
    pointSize,
    showPoints,
    selectedBoundaryId,
    selectedBoundaryFeature,
    activeLayerId,
    focusRequest
  ]);

  // Camera fitting is controlled only by explicit canvas events:
  // 1) a dataset/layer is uploaded or selected,
  // 2) a boundary is explicitly selected,
  // 3) the user removes a boundary and we explicitly return to the active CSV.
  //
  // Automatic study-area detection, interpolation rendering, and other
  // state changes must never take control of the viewport.

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusRequest) return;

    let cancelled = false;
    let frame = null;

    const runFocus = () => {
      if (cancelled || !mapRef.current || !map.isStyleLoaded()) return;

      let targetLayer = null;
      let targetBoundary = null;

      if (focusTarget?.type === "boundary") {
        targetBoundary = (boundaries || []).find(
          (boundary) => boundary?.id === focusTarget.id
        );
      } else {
        targetLayer =
          (layers || []).find(
            (layer) => layer?.id === focusTarget?.id
          ) ||
          (layers || []).find(
            (layer) => layer?.id === activeLayerId
          );
      }

      const points = getPointFeatures(
        targetLayer ? [targetLayer] : []
      );

      // Do not consume a layer focus request until the newly uploaded
      // dataset actually exists and contains valid point geometry. This is
      // what makes delete -> upload-new-dataset reliably re-zoom.
      if (focusTarget?.type === "layer") {
        if (!targetLayer || !points.length) {
          frame = requestAnimationFrame(runFocus);
          return;
        }
      }

      if (focusTarget?.type === "boundary") {
        if (!targetBoundary) {
          frame = requestAnimationFrame(runFocus);
          return;
        }
      }

      if (focusTarget?.type === "boundary") {
        const boundaryFeatures =
          targetBoundary.geojson?.features || [];

        fitToMapExtent(map, {
          points,
          selectedBoundaryFeature: null,
          boundaryFeatures,
          analysisGeojson: null,
          mapModeForFit: "location",
          focusTarget,
          duration: 500
        });
      } else {
        // Dataset/layer focus is intentionally point-only. The automatic
        // study-area boundary must never make a newly uploaded CSV zoom out.
        fitToMapExtent(map, {
          points,
          selectedBoundaryFeature: null,
          boundaryFeatures: [],
          analysisGeojson: null,
          mapModeForFit: "location",
          focusTarget: { type: "layer" },
          duration: 500
        });
      }
    };

    const start = () => {
      if (cancelled) return;
      map.stop();
      frame = requestAnimationFrame(runFocus);
    };

    if (map.isStyleLoaded()) {
      start();
    } else {
      map.once("load", start);
    }

    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
      map.off("load", start);
    };
  }, [
    focusRequest,
    focusTarget,
    activeLayerId,
    layers,
    boundaries
  ]);


  return (
    <div
      ref={containerRef}
      className="studio-map"
    />
  );
}
