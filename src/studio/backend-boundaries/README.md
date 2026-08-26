# Verdant GIS permanent boundary library — V4

The Studio is designed around **four permanent backend datasets only**:

```text
server/gis/boundaries/
├── world.geojson       # countries / world country polygons
├── states.geojson      # all Indian states
├── districts.geojson   # all Indian districts
└── villages.geojson    # all Indian villages / local administrative polygons
```

The customer does **not** upload these datasets in the Studio. They live on the server.

## What the backend should do

The frontend calls:

```text
POST /api/studio/boundaries/resolve
```

with:

```json
{
  "points": [[76.12, 32.11], [76.15, 32.12]]
}
```

The endpoint should return:

```json
{
  "boundaries": [
    {
      "id": "backend-country-India",
      "name": "India",
      "level": "country",
      "sourceType": "backend",
      "geojson": { "type": "FeatureCollection", "features": [] }
    },
    {
      "id": "backend-state-Kerala",
      "name": "Kerala",
      "level": "state",
      "sourceType": "backend",
      "geojson": { "type": "FeatureCollection", "features": [] }
    }
  ]
}
```

The helper `boundaryResolver.js` contains the core file-loading and point-in-polygon logic. It is framework-independent and can be called from Express, Fastify, a native Node server, or your existing API.

## Customer custom boundary

A customer can still upload a GeoJSON or ZIP shapefile from the Studio when they need a boundary that is not in the permanent four-dataset library. That upload is kept as `sourceType: "upload"` and is never mixed into the permanent datasets.

## Recommended production setup

For large village/district datasets, use PostGIS behind the same endpoint. The public Studio API does not need to change: the endpoint still returns the same boundary object shape. This keeps the frontend independent of whether the server stores GeoJSON files or a spatial database.
