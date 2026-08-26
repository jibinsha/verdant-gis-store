import fs from "node:fs/promises";

function pointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i][0]);
    const yi = Number(ring[i][1]);
    const xj = Number(ring[j][0]);
    const yj = Number(ring[j][1]);
    const intersects = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInGeometry(point, geometry) {
  if (!geometry) return false;
  if (geometry.type === "Polygon") {
    if (!pointInRing(point, geometry.coordinates[0] || [])) return false;
    return (geometry.coordinates || []).slice(1).every((ring) => !pointInRing(point, ring));
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) => pointInGeometry(point, { type: "Polygon", coordinates: polygon }));
  }
  return false;
}

function pointFeature(point) {
  return { type: "Feature", geometry: { type: "Point", coordinates: point }, properties: {} };
}

function findMatchingFeature(collection, points) {
  const features = collection?.features || [];
  if (!features.length || !points.length) return null;

  const all = features.find((feature) => points.every((point) => pointInGeometry(point, feature.geometry)));
  if (all) return all;

  let best = null;
  let bestCount = 0;
  for (const feature of features) {
    const count = points.reduce((sum, point) => sum + (pointInGeometry(point, feature.geometry) ? 1 : 0), 0);
    if (count > bestCount) {
      best = feature;
      bestCount = count;
    }
  }
  return best;
}

function featureName(feature, fallback) {
  const p = feature?.properties || {};
  return p.NAME || p.Name || p.name || p.DISTRICT || p.District || p.STATE || p.State || p.VILLAGE || p.Village || fallback;
}

export async function loadBoundaryDatasets(rootDir) {
  const names = {
    country: "world.geojson",
    state: "states.geojson",
    district: "districts.geojson",
    village: "villages.geojson"
  };

  const result = {};
  for (const [level, filename] of Object.entries(names)) {
    const text = await fs.readFile(`${rootDir}/${filename}`, "utf8");
    result[level] = JSON.parse(text);
  }
  return result;
}

export function resolveBoundaries(datasets, coordinates) {
  const points = (coordinates || [])
    .map((coordinate) => [Number(coordinate?.[0]), Number(coordinate?.[1])])
    .filter((coordinate) => Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1]));

  if (!points.length) return [];

  return Object.entries(datasets).map(([level, collection]) => {
    const feature = findMatchingFeature(collection, points);
    if (!feature) return null;

    return {
      id: `backend-${level}-${feature.id || feature.properties?.OBJECTID || featureName(feature, "match")}`,
      name: featureName(feature, level),
      level,
      sourceType: "backend",
      geojson: {
        type: "FeatureCollection",
        features: [feature]
      }
    };
  }).filter(Boolean);
}

export { pointFeature };
