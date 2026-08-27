import React, { useEffect, useRef } from "react";
import {
  Map,
  Marker,
  Popup,
  NavigationControl,
  ScaleControl,
  AttributionControl,
  LngLatBounds
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { featureContainsPoint } from "./spatial";

const SOURCE_PREFIX = "studio-source-";
const LAYER_PREFIX = "studio-layer-";

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
    duration = 550
  }
) {
  const pointBounds = featureBounds(points);
  const boundaryBounds = featureBounds([
    ...(boundaryFeatures || []),
    ...(selectedBoundaryFeature ? [selectedBoundaryFeature] : [])
  ]);
  const analysisBounds = featureBounds(analysisGeojson?.features || []);

  // Only let the selected boundary control the camera when the complete CSV
  // point set is actually inside it. If the boundary is unrelated to the
  // sampling points, keep the map focused on every point instead of zooming
  // out to an unreadable extent.
  const pointsAreInsideSelectedBoundary =
    Boolean(selectedBoundaryFeature) &&
    points.length > 0 &&
    points.every((point) =>
      featureContainsPoint(
        selectedBoundaryFeature,
        point?.geometry?.coordinates
      )
    );

  const useBoundaryExtent =
    Boolean(boundaryBounds && !boundaryBounds.isEmpty()) &&
    (points.length === 0 || pointsAreInsideSelectedBoundary);

  const bounds = new LngLatBounds();

  if (useBoundaryExtent && boundaryBounds && !boundaryBounds.isEmpty()) {
    bounds.extend(boundaryBounds);
  }

  if (pointBounds && !pointBounds.isEmpty()) {
    bounds.extend(pointBounds);
  }

  if (analysisBounds && !analysisBounds.isEmpty()) {
    bounds.extend(analysisBounds);
  }

  if (bounds.isEmpty()) return;
  if (!bounds || bounds.isEmpty()) return;

  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const samePoint =
    Math.abs(sw.lng - ne.lng) < 0.000001 &&
    Math.abs(sw.lat - ne.lat) < 0.000001;

  if (samePoint) {
    map.easeTo({
      center: [sw.lng, sw.lat],
      zoom: 16,
      duration
    });
    return;
  }

  map.fitBounds(bounds, {
    padding: { top: 55, bottom: 55, left: 55, right: 55 },
    maxZoom: 17,
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
      "line-width": selected ? 2.5 : 0.65,
      "line-opacity": selected ? 0.95 : 0.55
    }
  });
}

export default function StudioMap({
  layers = [],
  boundaries = [],
  analysisResult = null,
  mapMode = "location",
  pointSize = 6,
  showPoints = true,
  selectedBoundaryId = "",
  selectedBoundaryFeature = null,
  activeLayerId = null,
  focusRequest = 0
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const fitListenerRef = useRef(null);
  const fitTimeoutsRef = useRef([]);

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
            "#2c7bb6",
            min + range * 0.25,
            "#abd9e9",
            min + range * 0.5,
            "#ffffbf",
            min + range * 0.75,
            "#fdae61",
            max,
            "#d7191c"
          ]
        }
      });
    }

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

    const fitCurrentExtent = () => {
      fitToMapExtent(map, {
        points,
        selectedBoundaryFeature,
        boundaryFeatures: uploadedBoundaryFeatures,
        analysisGeojson:
          mapMode === "interpolation"
            ? analysisResult?.geojson
            : null,
        duration: 450
      });
    };

    // Cancel any previous camera animation before fitting the new dataset.
    // Fit immediately, then again after MapLibre has painted the new source.
    // This is important when one CSV is deleted and another is uploaded
    // without refreshing the Studio page.
    map.stop();
    fitCurrentExtent();
    fitListenerRef.current = fitCurrentExtent;
    map.once("idle", fitCurrentExtent);
    fitTimeoutsRef.current = [
      window.setTimeout(fitCurrentExtent, 120),
      window.setTimeout(fitCurrentExtent, 350)
    ];
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
    pointSize,
    showPoints,
    selectedBoundaryId,
    selectedBoundaryFeature,
    activeLayerId,
    focusRequest
  ]);

  return (
    <div
      ref={containerRef}
      className="studio-map"
    />
  );
}
