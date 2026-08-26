const DEFAULT_API_PATH = "https://verdant-gis-api.onrender.com/api/studio/boundaries/resolve";

function getBoundaryApiUrl() {
  const configured = import.meta?.env?.VITE_STUDIO_BOUNDARY_API;
  if (configured) return configured;

  // Vite serves the Studio on :5173 while the existing V21 Express server
  // normally runs on :8787 during local development. Production deployments
  // can set VITE_STUDIO_BOUNDARY_API or proxy the /api path.
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "http://localhost:8787/api/studio/boundaries/resolve";
  }

  return DEFAULT_API_PATH;
}

export async function resolvePermanentBoundaries(pointFeatures) {
  if (!pointFeatures?.length) return [];

  const points = pointFeatures
    .map((feature) => feature?.geometry?.coordinates)
    .filter(
      (coordinates) =>
        Array.isArray(coordinates) &&
        coordinates.length >= 2 &&
        Number.isFinite(Number(coordinates[0])) &&
        Number.isFinite(Number(coordinates[1]))
    )
    .map((coordinates) => [
      Number(coordinates[0]),
      Number(coordinates[1])
    ]);

  if (!points.length) return [];

  const response = await fetch(getBoundaryApiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points })
  });

  if (!response.ok) {
    let message = `Boundary service returned HTTP ${response.status}.`;

    try {
      const payload = await response.json();
      if (payload?.error) message = payload.error;
    } catch {
      // Keep the HTTP error message when the server did not return JSON.
    }

    throw new Error(message);
  }

  const payload = await response.json();

  return Array.isArray(payload.boundaries)
    ? payload.boundaries
    : [];
}

export async function getPermanentBoundaryResolution(pointFeatures) {
  const points = pointFeatures
    ?.map((feature) => feature?.geometry?.coordinates)
    .filter(Boolean);

  if (!points?.length) {
    return { boundaries: [], recommendedLevel: null };
  }

  const response = await fetch(getBoundaryApiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      payload?.error ||
      `Boundary service returned HTTP ${response.status}.`
    );
  }

  return response.json();
}
