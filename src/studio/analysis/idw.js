/*
 * Verdant GIS Studio V4
 * Client-side IDW grid generator.
 *
 * Produces polygon grid cells so the result can be rendered both in
 * MapLibre and in the publication layout. The grid is optionally limited
 * to a polygon boundary by testing cell centres against that boundary.
 */

import { pointInGeometry, bboxOfFeatures } from "../spatial";

function numericValue(feature, field) {
  const raw = feature?.properties?.[field];
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function haversineKm(a, b) {
  const toRad = (v) => (v * Math.PI) / 180;
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const dLat = lat2 - lat1;
  const dLon = toRad(b[0] - a[0]);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

function kmToLatitudeDegrees(km) {
  return km / 110.574;
}

function kmToLongitudeDegrees(km, latitude) {
  const factor = Math.max(Math.cos((latitude * Math.PI) / 180), 0.15);
  return km / (111.32 * factor);
}

function polygonForCell(minX, minY, maxX, maxY) {
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
        [minX, minY]
      ]]
    },
    properties: {}
  };
}

export function runIDW({
  geojson,
  valueField,
  cellSize = 1,
  power = 2,
  boundaryFeature = null,
  maxCells = 100000
}) {
  if (!geojson?.features?.length) {
    throw new Error("No point data available.");
  }

  const points = geojson.features
    .filter((feature) => feature.geometry?.type === "Point")
    .map((feature) => ({
      feature,
      coordinate: [
        Number(feature.geometry.coordinates[0]),
        Number(feature.geometry.coordinates[1])
      ],
      value: numericValue(feature, valueField)
    }))
    .filter((item) =>
      Number.isFinite(item.coordinate[0]) &&
      Number.isFinite(item.coordinate[1]) &&
      Number.isFinite(item.value)
    );

  if (points.length < 3) {
    throw new Error("At least 3 valid numeric points are required for interpolation.");
  }

  const sourceFeatures = points.map((p) => ({
    ...p.feature,
    properties: {
      ...p.feature.properties,
      [valueField]: p.value
    }
  }));

  const boundary = boundaryFeature
    ? [boundaryFeature]
    : sourceFeatures;

  const bbox = bboxOfFeatures(boundary);

  if (!bbox) {
    throw new Error("Could not determine an interpolation extent.");
  }

  const [minX, minY, maxX, maxY] = bbox;
  const requestedKm = Math.max(0.001, Number(cellSize) || 1);
  const averageLat = (minY + maxY) / 2;
  const dx = kmToLongitudeDegrees(requestedKm, averageLat);
  const dy = kmToLatitudeDegrees(requestedKm);

  const columns = Math.max(1, Math.ceil((maxX - minX) / dx));
  const rows = Math.max(1, Math.ceil((maxY - minY) / dy));

  let stepX = dx;
  let stepY = dy;

  // Keep browser-side interpolation responsive.
  if (columns * rows > maxCells) {
    const scale = Math.sqrt((columns * rows) / maxCells);
    stepX *= scale;
    stepY *= scale;
  }

  const cells = [];

  for (let y = minY; y < maxY; y += stepY) {
    const y2 = Math.min(y + stepY, maxY);
    const centerLat = (y + y2) / 2;

    for (let x = minX; x < maxX; x += stepX) {
      const x2 = Math.min(x + stepX, maxX);
      const center = [(x + x2) / 2, centerLat];

      if (boundaryFeature && !pointInGeometry(center, boundaryFeature.geometry)) {
        continue;
      }

      let weightedSum = 0;
      let weightSum = 0;
      let exactValue = null;

      for (const point of points) {
        const distance = haversineKm(center, point.coordinate);

        if (distance < 0.000001) {
          exactValue = point.value;
          break;
        }

        const weight = 1 / Math.pow(distance, Math.max(0.5, Number(power) || 2));
        weightedSum += point.value * weight;
        weightSum += weight;
      }

      const value = exactValue ?? (weightSum ? weightedSum / weightSum : null);

      if (Number.isFinite(value)) {
        const cell = polygonForCell(x, y, x2, y2);
        cell.properties[valueField] = value;
        cell.properties.__idw = true;
        cells.push(cell);
      }
    }
  }

  if (!cells.length) {
    throw new Error("IDW produced no cells. Check the boundary and coordinate extent.");
  }

  const values = cells.map((f) => Number(f.properties[valueField]));
  const min = Math.min(...values);
  const max = Math.max(...values);

  return {
    type: "FeatureCollection",
    features: cells,
    properties: {
      method: "IDW",
      valueField,
      power: Math.max(0.5, Number(power) || 2),
      cellSizeKm: requestedKm,
      min,
      max,
      pointCount: points.length,
      boundaryApplied: Boolean(boundaryFeature)
    }
  };
}
