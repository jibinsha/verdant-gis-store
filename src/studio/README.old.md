# Verdant GIS Studio V1

Initial modular GIS Studio.

Included:
- CSV coordinate upload
- Automatic latitude/longitude detection
- GeoJSON conversion
- MapLibre map
- Layer list
- Numeric-field detection
- Turf IDW interpolation pipeline

Install:
npm install maplibre-gl @turf/interpolate @turf/bbox @turf/helpers papaparse xlsx

Add to App.jsx:
import StudioPage from "./studio/StudioPage";
<Route path="/studio" element={<StudioPage />} />

This is the foundation for later Shapefile, GeoJSON, XLSX, raster/GeoTIFF,
remote-sensing, classification, map composition and export modules.
