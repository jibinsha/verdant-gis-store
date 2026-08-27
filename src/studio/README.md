## V26 fixes

- Fixes the `focusPoints is not defined` crash that blanked the Studio.
- Separates automatic CSV fitting from explicit project-layer and custom-boundary zoom actions.
- Project layer cards zoom directly to their layer without remounting the map.
- Automatic boundary matching never changes the CSV camera.
- Configures the MapLibre worker through Vite so the worker is emitted/loaded as JavaScript instead of receiving the SPA HTML fallback.
- Keeps the A4 point-first layout logic: unrelated custom boundary = Boundary Overview only; all points inside = boundary + points in the main map.


## V25 fixes

- Prevents automatic boundary matching from changing the CSV camera extent.
- Project layer cards explicitly zoom to the selected layer/boundary.
- Custom boundary is clearly rendered in the Studio map canvas.
- Layout uses CSV points as the default extent; custom boundary is included in the main frame only when all points are inside it. Otherwise it is shown only in the Boundary overview.
- Shows `Fetching auto location…` while automatic study-area detection is running.
# Verdant GIS Studio V24
## V26.1 interaction/layout fixes

- Custom boundaries that contain all sampling points are now drawn as the actual boundary shape in the A4 main map, together with the points.
- Custom boundaries that contain none/only some of the points remain in the Boundary Overview only.
- If no custom boundary is uploaded, the existing point/automatic-study-area layout behavior is preserved.
- Project-layer zoom is handled as an explicit camera action using the clicked layer ID, so selecting a layer cannot be lost in a state-update race.
- Automatic boundary-resolution results do not trigger another camera fit, preventing the map from re-zooming after `Fetching auto location…` completes.


This version separates the **location-map workflow** from the **IDW interpolation workflow** and prepares the Studio for permanent backend administrative boundaries.

## 1. Location map

When `Location map` is selected:

- only the uploaded sampling points are drawn;
- no previous IDW surface is retained;
- the map automatically fits the study area;
- `Open location map layout` opens an A4 landscape location map.

The location layout contains points only in the main map. It does **not** display an interpolation surface.

## 2. IDW interpolation

When `IDW interpolation` is selected:

- choose a numeric field;
- choose cell size and IDW power;
- run the interpolation;
- the IDW surface immediately appears in the Studio map canvas;
- sampling points remain visible above the surface;
- the interpolation extent is based on the detected study boundary when available;
- `Create map` opens the A4 landscape interpolation layout.

The publication interpolation map contains:

- IDW surface;
- sampling points;
- study boundary;
- coordinate grid and degree labels;
- north arrow;
- scale bar;
- value legend;
- title, subtitle and source text.

## 3. Permanent backend boundary architecture

The customer should **not** upload the country's administrative datasets.

Keep four permanent server datasets:

```text
server/gis/boundaries/
├── world.geojson
├── states.geojson
├── districts.geojson
└── villages.geojson
```

`world.geojson` contains countries. `states.geojson` contains the Indian states. `districts.geojson` contains all Indian districts. `villages.geojson` contains the complete Indian village/local-area dataset.

The Studio calls:

```text
POST /api/studio/boundaries/resolve
```

with the uploaded CSV coordinates. The backend returns the matching country/state/district/village features as small GeoJSON FeatureCollections.

See `backend-boundaries/README.md` and `backend-boundaries/server-route-example.js`.

## 4. Customer custom boundary

The left panel now treats boundary upload as **custom boundary upload only**. It accepts:

- `.geojson`
- `.json`
- `.zip` shapefile

This is used when the customer's study boundary is not available in the four permanent datasets.

## 5. A4 layout

The page is 1123 × 794 SVG units, matching an A4 landscape aspect ratio. The left inset column contains the detected country and state. The main panel uses the detected study feature and keeps the coordinate labels around the map frame in a publication-style presentation.

Exports:

- SVG
- PNG at 3369 × 2382 pixels

## 6. GIS Store V21 integration

V22 is the Studio integration for GIS Store V21. The existing Store catalogue, authentication, Supabase, payment, order and download workflows are intentionally untouched.

The Studio-only backend additions are:

```text
server/gis/studioBoundaries.js
server/index.js
```

The Express route is:

```text
POST /api/studio/boundaries/resolve
```

For local development, the Studio automatically uses:

```text
http://localhost:8787/api/studio/boundaries/resolve
```

when `VITE_STUDIO_BOUNDARY_API` is not configured. For another deployment, set `VITE_STUDIO_BOUNDARY_API` to the backend endpoint or proxy `/api` to the existing Express server.

The permanent datasets remain:

```text
server/gis/boundaries/
├── world.geojson
├── states.geojson
├── districts.geojson
└── villages.geojson
```

The backend caches these files after first use and returns only the matched administrative features needed by the Studio.



## V24 camera behavior

- CSV upload fits once to all valid sampling points.
- Automatic permanent boundary loading never changes that viewport.
- Clicking a project layer explicitly zooms to that layer.
- Clicking the custom boundary explicitly zooms to the boundary.
- Removing the custom boundary returns the camera to the active CSV points.
- Compact point sets are capped at a readable maximum zoom instead of being
  over-zoomed.
- The A4 layout keeps all sampling points visible and uses the custom/main
  boundary in the main frame only when all sampling points are inside it;
  otherwise it keeps the point-focused main frame and boundary overview.
