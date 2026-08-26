import React, { useEffect, useRef } from "react";
import maplibregl, {
  NavigationControl,
  ScaleControl
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const STUDIO_SOURCE_PREFIX = "studio-source-";
const STUDIO_LAYER_PREFIX = "studio-layer-";

function getAllPointCoordinates(layers) {
  const coordinates = [];

  (layers || []).forEach((layer) => {
    const features = layer.geojson?.features || [];

    features.forEach((feature) => {
      if (feature.geometry?.type !== "Point") return;

      const [lon, lat] = feature.geometry.coordinates || [];
      const longitude = Number(lon);
      const latitude = Number(lat);

      if (
        Number.isFinite(longitude) &&
        Number.isFinite(latitude)
      ) {
        coordinates.push([longitude, latitude]);
      }
    });
  });

  return coordinates;
}

function removeStudioLayers(map) {
  const styleLayers = map.getStyle()?.layers || [];

  styleLayers.forEach((layer) => {
    if (layer.id.startsWith(STUDIO_LAYER_PREFIX)) {
      if (map.getLayer(layer.id)) map.removeLayer(layer.id);
    }
  });

  const sources = map.getStyle()?.sources || {};

  Object.keys(sources).forEach((sourceId) => {
    if (sourceId.startsWith(STUDIO_SOURCE_PREFIX)) {
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }
  });
}

function fitToCoordinates(map, coordinates) {
  if (!coordinates.length) return;

  if (coordinates.length === 1) {
    map.easeTo({
      center: coordinates[0],
      zoom: 13,
      duration: 1000
    });
    return;
  }

  const bounds = new maplibregl.LngLatBounds();
  coordinates.forEach((coordinate) => bounds.extend(coordinate));

  map.fitBounds(bounds, {
    padding: 90,
    maxZoom: 14,
    duration: 1100
  });
}

function valueRange(features, field) {
  const values = features
    .map((feature) => Number(feature.properties?.[field]))
    .filter(Number.isFinite);

  if (!values.length) return [0, 1];

  return [Math.min(...values), Math.max(...values)];
}

function paintForRange(field, features) {
  const [min, max] = valueRange(features, field);

  return {
    "circle-radius": 6,
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 1.5,
    "circle-opacity": 0.92,
    "circle-color": [
      "interpolate",
      ["linear"],
      ["coalesce", ["to-number", ["get", field]], min],
      min,
      "#2c7bb6",
      min + (max - min) * 0.25,
      "#abd9e9",
      min + (max - min) * 0.5,
      "#ffffbf",
      min + (max - min) * 0.75,
      "#fdae61",
      max,
      "#d7191c"
    ]
  };
}

export default function StudioMap({
  layers,
  analysisResult,
  mapMode = "location",
  valueField = "",
  showPoints = true,
  pointSize = 6
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      preserveDrawingBuffer: true,
      style: {
        version: 8,
        sources: {
          "carto-light": {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
              "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
              "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors © CARTO"
          }
        },
        layers: [
          {
            id: "carto-light",
            type: "raster",
            source: "carto-light"
          }
        ]
      },
      center: [78.9629, 20.5937],
      zoom: 4.5
    });

    map.addControl(new NavigationControl(), "top-right");
    map.addControl(new ScaleControl(), "bottom-left");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const render = () => {
      removeStudioLayers(map);

      const pointCoordinates = getAllPointCoordinates(layers);

      if (mapMode === "interpolation" && analysisResult?.geojson) {
        const geojson = analysisResult.geojson;
        const sourceId = `${STUDIO_SOURCE_PREFIX}analysis`;
        const fillId = `${STUDIO_LAYER_PREFIX}analysis-fill`;
        const outlineId = `${STUDIO_LAYER_PREFIX}analysis-outline`;

        map.addSource(sourceId, {
          type: "geojson",
          data: geojson
        });

        const [min, max] = valueRange(
          geojson.features || [],
          analysisResult.valueField
        );

        map.addLayer({
          id: fillId,
          type: "fill",
          source: sourceId,
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: {
            "fill-opacity": 0.68,
            "fill-color": [
              "interpolate",
              ["linear"],
              ["coalesce", ["to-number", ["get", analysisResult.valueField]], min],
              min,
              "#2c7bb6",
              min + (max - min) * 0.2,
              "#abd9e9",
              min + (max - min) * 0.4,
              "#ffffbf",
              min + (max - min) * 0.6,
              "#fdae61",
              min + (max - min) * 0.8,
              "#f46d43",
              max,
              "#d7191c"
            ]
          }
        });

        map.addLayer({
          id: outlineId,
          type: "line",
          source: sourceId,
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: {
            "line-color": "#ffffff",
            "line-width": 0.5,
            "line-opacity": 0.45
          }
        });

        if (showPoints) {
          (layers || []).forEach((layer) => {
            const source = `${STUDIO_SOURCE_PREFIX}${layer.id}`;
            const layerId = `${STUDIO_LAYER_PREFIX}points-${layer.id}`;

            map.addSource(source, {
              type: "geojson",
              data: layer.geojson
            });

            map.addLayer({
              id: layerId,
              type: "circle",
              source,
              paint: {
                ...paintForRange(valueField, layer.geojson.features || []),
                "circle-radius": pointSize
              }
            });
          });
        }

        const bounds = new maplibregl.LngLatBounds();
        (geojson.features || []).forEach((feature) => {
          const geometry = feature.geometry;
          if (geometry?.type === "Polygon") {
            geometry.coordinates.flat(1).forEach((coordinate) => {
              if (coordinate?.length >= 2) bounds.extend(coordinate);
            });
          } else if (geometry?.type === "Point") {
            bounds.extend(geometry.coordinates);
          }
        });

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 1000 });
        } else {
          fitToCoordinates(map, pointCoordinates);
        }

        return;
      }

      (layers || []).forEach((layer) => {
        if (!layer.geojson) return;

        const sourceId = `${STUDIO_SOURCE_PREFIX}${layer.id}`;
        const layerId = `${STUDIO_LAYER_PREFIX}points-${layer.id}`;

        map.addSource(sourceId, {
          type: "geojson",
          data: layer.geojson
        });

        map.addLayer({
          id: layerId,
          type: "circle",
          source: sourceId,
          paint: {
            "circle-radius": pointSize,
            "circle-color": "#087f5b",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
            "circle-opacity": 0.95
          }
        });
      });

      fitToCoordinates(map, pointCoordinates);
    };

    if (map.isStyleLoaded()) render();
    else map.once("load", render);

    return () => map.off("load", render);
  }, [layers, analysisResult, mapMode, valueField, showPoints, pointSize]);

  return <div ref={containerRef} className="studio-map" />;
}
