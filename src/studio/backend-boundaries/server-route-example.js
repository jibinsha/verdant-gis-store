/*
 * Example Express route for the four permanent GeoJSON files.
 * Merge this logic into your existing backend instead of replacing it.
 * Requires: npm install express
 */
import path from "node:path";
import { loadBoundaryDatasets, resolveBoundaries } from "./boundaryResolver.js";

export async function createStudioBoundaryResolver() {
  const boundaryDir = path.resolve(process.env.STUDIO_BOUNDARY_DIR || "server/gis/boundaries");
  const datasets = await loadBoundaryDatasets(boundaryDir);

  return async function resolve(req, res) {
    try {
      const coordinates = req.body?.points || [];
      const boundaries = resolveBoundaries(datasets, coordinates);
      res.json({ boundaries });
    } catch (error) {
      console.error("[Verdant GIS] boundary resolve failed", error);
      res.status(500).json({ error: "Could not resolve study boundaries." });
    }
  };
}

// Example wiring:
// const resolver = await createStudioBoundaryResolver();
// app.post("/api/studio/boundaries/resolve", resolver);
