function pointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i][0]);
    const yi = Number(ring[i][1]);
    const xj = Number(ring[j][0]);
    const yj = Number(ring[j][1]);

    const intersects =
      ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);

    if (intersects) inside = !inside;
  }

  return inside;
}

function pointInPolygon(point, coordinates) {
  if (!coordinates?.length) return false;
  if (!pointInRing(point, coordinates[0])) return false;

  for (let i = 1; i < coordinates.length; i++) {
    if (pointInRing(point, coordinates[i])) return false;
  }

  return true;
}

export function pointInGeometry(point, geometry) {
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

export function featureContainsPoint(feature, point) {
  return pointInGeometry(point, feature?.geometry);
}

export function bboxOfFeatures(features) {
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];

  (features || []).forEach((feature) => {
    const walk = (coords) => {
      if (!Array.isArray(coords)) return;

      if (
        coords.length >= 2 &&
        Number.isFinite(Number(coords[0])) &&
        Number.isFinite(Number(coords[1]))
      ) {
        const x = Number(coords[0]);
        const y = Number(coords[1]);

        bbox[0] = Math.min(bbox[0], x);
        bbox[1] = Math.min(bbox[1], y);
        bbox[2] = Math.max(bbox[2], x);
        bbox[3] = Math.max(bbox[3], y);
        return;
      }

      coords.forEach(walk);
    };

    walk(feature?.geometry?.coordinates);
  });

  return bbox[0] === Infinity ? null : bbox;
}

export function centroidOfPoints(features) {
  const points = (features || [])
    .map((f) => f?.geometry?.coordinates)
    .filter((c) => Array.isArray(c) && c.length >= 2);

  if (!points.length) return null;

  const sums = points.reduce(
    (acc, c) => [acc[0] + Number(c[0]), acc[1] + Number(c[1])],
    [0, 0]
  );

  return [sums[0] / points.length, sums[1] / points.length];
}

function pointsInsideFeature(feature, pointFeatures) {
  const points = pointFeatures || [];
  if (!points.length) return false;

  let valid = 0;

  for (const point of points) {
    const coordinate = point?.geometry?.coordinates;
    if (!coordinate) continue;
    if (featureContainsPoint(feature, coordinate)) valid++;
  }

  // A boundary is a strong match when it contains the centroid and
  // the majority of the supplied points. This avoids selecting a
  // neighbouring polygon from an unusually shaped sample.
  return valid > 0 && valid / points.length >= 0.5;
}

export function detectBoundaryFeature(boundary, pointFeatures) {
  return detectBoundaryMatch(boundary, pointFeatures);
}

export function detectBoundaryMatch(boundary, pointFeatures) {
  const features = boundary?.geojson?.features || [];
  if (!features.length || !pointFeatures?.length) return null;

  const center = centroidOfPoints(pointFeatures);

  // Prefer a feature containing every supplied point. This is important for
  // district/village datasets containing many adjacent polygons.
  const allMatch = features.find((feature) => {
    const validPoints = pointFeatures.filter((point) =>
      featureContainsPoint(feature, point?.geometry?.coordinates)
    );
    return validPoints.length === pointFeatures.length;
  });

  if (allMatch) return allMatch;

  // Otherwise use the feature containing the centroid, but only if it also
  // contains at least one sampling point.
  if (center) {
    const centerMatch = features.find((feature) =>
      featureContainsPoint(feature, center)
    );
    if (centerMatch) return centerMatch;
  }

  // Last resort: choose the feature containing the largest number of points.
  let best = null;
  let bestCount = 0;
  for (const feature of features) {
    let count = 0;
    for (const point of pointFeatures) {
      if (featureContainsPoint(feature, point?.geometry?.coordinates)) count += 1;
    }
    if (count > bestCount) {
      best = feature;
      bestCount = count;
    }
  }
  return best;
}

export function detectBoundaryForStudy(boundary, pointFeatures) {
  const features = boundary?.geojson?.features || [];
  if (!features.length || !pointFeatures?.length) return null;
  return features.find((feature) => pointFeatures.every((point) =>
    featureContainsPoint(feature, point?.geometry?.coordinates)
  )) || null;
}
