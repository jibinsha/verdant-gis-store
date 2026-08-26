# Verdant GIS Studio V2

V2 is the map-making foundation for Verdant GIS. It is intentionally focused on turning uploaded coordinate data into usable GIS maps before the final cartographic layout module is added from the user's example.

## Included

- CSV coordinate upload
- Flexible latitude/longitude column detection
- Decimal degree coordinates
- N/S/E/W hemisphere coordinates
- DMS coordinates such as `32°06'36.65"N`
- DMS coordinates with spaces such as `32 06 36.65 N`
- `lat`, `latitude`, `GPS_Lat`, `y`, `lon`, `lng`, `longitude`, `GPS_Long`, `x` and related naming variants
- Coordinate validation and invalid-row handling
- Automatic zoom to uploaded locations
- Location map with visible point symbols
- Numeric-field detection
- IDW interpolation using Turf
- Square interpolation grid displayed as a continuous colored surface
- Optional observation points over the interpolation
- Basic blue-to-red interpolation color ramp
- PNG map-canvas export foundation
- Modular architecture ready for final map composition/layout

## Install

```bash
npm install maplibre-gl @turf/interpolate papaparse lucide-react
```

If these packages are already in the Verdant GIS project, do not install them again.

## Add to App.jsx

```jsx
import StudioPage from "./studio/StudioPage";

<Route path="/studio" element={<StudioPage />} />
```

Import the stylesheet wherever the existing Studio stylesheet is imported:

```jsx
import "./studio/studio.css";
```

## V2 workflow

1. Open `/studio`.
2. Upload a CSV containing coordinates.
3. The Studio detects coordinate columns and parses coordinate formats.
4. A location map is created and the map automatically fits the uploaded points.
5. Select `IDW interpolation` when a numeric variable is available.
6. Choose the variable, cell size and IDW power.
7. Run interpolation.
8. The interpolation grid is rendered as a colored surface and the map zooms to the result.
9. Export Map currently exports the MapLibre canvas where the basemap permits canvas export.

## Planned V3 after map-layout example

The final cartographic composer should be built after the supplied map-layout reference. It can then add:

- title and subtitle
- legend
- north arrow
- scale bar
- neatline
- coordinate grid/graticule
- study-area inset/location map
- logo/branding
- data/source/author/date text
- paper size and orientation
- margins and map frame
- print-quality PNG/PDF export
- saved map projects

Additional analysis modules can then be added without changing the core upload/map architecture: point density, buffer, proximity, thematic/proportional symbols, classification, contours/isolines, clipping, and other GIS operations.
