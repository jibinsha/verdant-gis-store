import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOUNDARY_DIR = path.join(__dirname, "boundaries");

const DATASETS = {
  country: "world.geojson",
  state: "states.geojson",
  district: "districts.geojson",
  village: "villages.geojson"
};

const cache = new Map();

function loadDataset(level) {
  if (cache.has(level)) return cache.get(level);

  const filename = DATASETS[level];
  if (!filename) throw new Error(`Unsupported boundary level: ${level}`);

  const filePath = path.join(BOUNDARY_DIR, filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Boundary dataset is missing: ${filePath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));

  if (parsed?.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
    throw new Error(`${filename} is not a valid GeoJSON FeatureCollection.`);
  }

  const prepared = parsed.features
    .filter((feature) => feature?.geometry)
    .map((feature) => ({
      feature,
      bbox: geometryBbox(feature.geometry)
    }));

  const result = { ...parsed, features: parsed.features };
  cache.set(level, { geojson: result, prepared });
  return cache.get(level);
}

function geometryBbox(geometry) {
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];

  const walk = (coordinates) => {
    if (!Array.isArray(coordinates)) return;

    if (
      coordinates.length >= 2 &&
      Number.isFinite(Number(coordinates[0])) &&
      Number.isFinite(Number(coordinates[1]))
    ) {
      const x = Number(coordinates[0]);
      const y = Number(coordinates[1]);
      bbox[0] = Math.min(bbox[0], x);
      bbox[1] = Math.min(bbox[1], y);
      bbox[2] = Math.max(bbox[2], x);
      bbox[3] = Math.max(bbox[3], y);
      return;
    }

    coordinates.forEach(walk);
  };

  walk(geometry?.coordinates);
  return bbox[0] === Infinity ? null : bbox;
}

function bboxContainsPoint(bbox, point) {
  if (!bbox) return false;
  return (
    point[0] >= bbox[0] &&
    point[0] <= bbox[2] &&
    point[1] >= bbox[1] &&
    point[1] <= bbox[3]
  );
}

function pointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i][0]);
    const yi = Number(ring[i][1]);
    const xj = Number(ring[j][0]);
    const yj = Number(ring[j][1]);

    if (!Number.isFinite(xi) || !Number.isFinite(yi) ||
        !Number.isFinite(xj) || !Number.isFinite(yj)) {
      continue;
    }

    const intersects =
      ((yi > y) !== (yj > y)) &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

function pointInPolygon(point, coordinates) {
  if (!coordinates?.length || !pointInRing(point, coordinates[0])) {
    return false;
  }

  for (let i = 1; i < coordinates.length; i++) {
    if (pointInRing(point, coordinates[i])) return false;
  }

  return true;
}

function pointInGeometry(point, geometry) {
  if (!geometry) return false;

  if (geometry.type === "Polygon") {
    return pointInPolygon(point, geometry.coordinates);
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) =>
      pointInPolygon(point, polygon)
    );
  }

  return false;
}

function featureContainsPoint(prepared, point) {
  if (!bboxContainsPoint(prepared.bbox, point)) return false;
  return pointInGeometry(point, prepared.feature.geometry);
}

function centroid(points) {
  if (!points.length) return null;

  const sum = points.reduce(
    (acc, point) => [acc[0] + point[0], acc[1] + point[1]],
    [0, 0]
  );

  return [
    sum[0] / points.length,
    sum[1] / points.length
  ];
}

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function stateName(feature) {
  const p = feature?.properties || {};
  return p.STNAME_SH || p.STNAME || p.stname || p.state || p.STATE || p.Name || p.name || "";
}

function districtStateName(feature) {
  const p = feature?.properties || {};
  return p.stname || p.STNAME || p.state || p.STATE || "";
}

function findFeatureContainingAllPoints(preparedFeatures, points) {
  if (!points.length) return null;

  const center = centroid(points);

  const candidates = center
    ? preparedFeatures.filter((item) => featureContainsPoint(item, center))
    : preparedFeatures;

  for (const candidate of candidates) {
    if (points.every((point) => featureContainsPoint(candidate, point))) {
      return candidate.feature;
    }
  }

  return null;
}

function findBestFeature(preparedFeatures, points) {
  if (!points.length) return null;

  const all = findFeatureContainingAllPoints(preparedFeatures, points);
  if (all) return all;

  const center = centroid(points);
  if (!center) return null;

  let best = null;
  let bestCount = 0;

  for (const candidate of preparedFeatures) {
    if (!featureContainsPoint(candidate, center)) continue;

    let count = 0;
    for (const point of points) {
      if (featureContainsPoint(candidate, point)) count++;
    }

    if (count > bestCount) {
      best = candidate.feature;
      bestCount = count;
    }
  }

  return bestCount >= Math.max(1, Math.ceil(points.length * 0.5))
    ? best
    : null;
}

function filterFeaturesByProperty(features, getter, value) {
  const target = normalize(value);
  return features.filter((feature) => normalize(getter(feature)) === target);
}

function boundaryObject(level, feature, insetGeojson = null) {
  if (!feature) return null;

  const props = feature.properties || {};

  let name = "";
  if (level === "country") {
    name = props.name || props.NAME || "Country";
  } else if (level === "state") {
    name = stateName(feature) || "State";
  } else if (level === "district") {
    name = props.dtname || props.DTNAME || props.district || props.DISTRICT || "District";
  } else {
    name = props.sdtname || props.VILLAGE || props.village || props.name || "Village";
  }

  return {
    id: `backend-${level}-${String(name).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
    name,
    level,
    sourceType: "backend",
    geojson: {
      type: "FeatureCollection",
      features: [feature]
    },
    insetGeojson
  };
}

export function resolveStudioBoundaries(points) {
  const cleanPoints = (points || [])
    .filter((point) =>
      Array.isArray(point) &&
      point.length >= 2 &&
      Number.isFinite(Number(point[0])) &&
      Number.isFinite(Number(point[1])) &&
      Number(point[0]) >= -180 &&
      Number(point[0]) <= 180 &&
      Number(point[1]) >= -90 &&
      Number(point[1]) <= 90
    )
    .map((point) => [Number(point[0]), Number(point[1])]);

  if (!cleanPoints.length) {
    return {
      boundaries: [],
      recommendedLevel: null
    };
  }

  const countryData = loadDataset("country");
  const stateData = loadDataset("state");
  const districtData = loadDataset("district");

  const countryFeature = findBestFeature(countryData.prepared, cleanPoints);
  const countryName = countryFeature?.properties?.name || "";
  const countryStates = normalize(countryFeature?.properties?.iso3) === "ind"
    ? stateData.geojson.features
    : [];

  const stateFeature = countryFeature
    ? findBestFeature(
        stateData.prepared.filter((item) =>
          normalize(countryName) === "india"
            ? true
            : false
        ),
        cleanPoints
      )
    : null;

  const districtFeature = stateFeature
    ? findBestFeature(
        districtData.prepared.filter((item) =>
          normalize(districtStateName(item.feature)) === normalize(stateName(stateFeature))
        ),
        cleanPoints
      )
    : null;

  let villageFeature = null;
  if (districtFeature) {
    const villageData = loadDataset("village");
    const districtName =
      districtFeature.properties?.dtname ||
      districtFeature.properties?.DTNAME ||
      districtFeature.properties?.district ||
      districtFeature.properties?.DISTRICT ||
      "";

    villageFeature = findBestFeature(
      villageData.prepared.filter((item) => {
        const p = item.feature.properties || {};
        return (
          normalize(p.dtname || p.DTNAME || p.district || p.DISTRICT) ===
          normalize(districtName)
        );
      }),
      cleanPoints
    );
  }

  const boundaries = [];

  const countryInsetGeojson = countryStates.length
    ? {
        type: "FeatureCollection",
        features: countryStates
      }
    : null;

  if (countryFeature) {
    boundaries.push(
      boundaryObject("country", countryFeature, countryInsetGeojson)
    );
  }

  let stateInsetGeojson = null;

  if (stateFeature) {
    const stateDistricts = filterFeaturesByProperty(
      districtData.geojson.features,
      districtStateName,
      stateName(stateFeature)
    );

    stateInsetGeojson = stateDistricts.length
      ? {
          type: "FeatureCollection",
          features: stateDistricts
        }
      : null;

    boundaries.push(
      boundaryObject("state", stateFeature, stateInsetGeojson)
    );
  }

  if (districtFeature) {
    boundaries.push(boundaryObject("district", districtFeature));
  }

  if (villageFeature) {
    boundaries.push(boundaryObject("village", villageFeature));
  }

  // The smallest permanent boundary that contains every sampling point is
  // the preferred study boundary. If no village contains all points, fall
  // back to district, state, then country.
  const recommended =
    villageFeature &&
    pointsAllInside(villageFeature, cleanPoints)
      ? "village"
      : districtFeature &&
        pointsAllInside(districtFeature, cleanPoints)
      ? "district"
      : stateFeature &&
        pointsAllInside(stateFeature, cleanPoints)
      ? "state"
      : countryFeature &&
        pointsAllInside(countryFeature, cleanPoints)
      ? "country"
      : "state";

  return {
    boundaries,
    recommendedLevel: recommended,
    pointCount: cleanPoints.length
  };
}

function pointsAllInside(feature, points) {
  const prepared = {
    feature,
    bbox: geometryBbox(feature.geometry)
  };

  return points.every((point) => featureContainsPoint(prepared, point));
}
