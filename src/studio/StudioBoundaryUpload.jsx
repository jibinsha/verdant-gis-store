import React, { useRef, useState } from "react";
import { Upload, MapPinned } from "lucide-react";

function flattenGeoJSON(value) {
  if (!value) return null;
  if (value.type === "FeatureCollection") return value;
  if (value.type === "Feature") return { type: "FeatureCollection", features: [value] };
  if (value.type === "GeometryCollection") {
    return {
      type: "FeatureCollection",
      features: (value.geometries || []).map((geometry, i) => ({
        type: "Feature",
        id: i + 1,
        geometry,
        properties: {}
      }))
    };
  }
  if (value.type && value.coordinates) {
    return {
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: value, properties: {} }]
    };
  }
  return null;
}

async function parseFile(file) {
  const lower = file.name.toLowerCase();

  if (lower.endsWith(".geojson") || lower.endsWith(".json")) {
    return flattenGeoJSON(JSON.parse(await file.text()));
  }

  if (lower.endsWith(".zip")) {
    try {
      const shp = await import("shpjs");
      return flattenGeoJSON(await shp.default(await file.arrayBuffer()));
    } catch {
      throw new Error("Could not read the shapefile ZIP. Install shpjs with: npm install shpjs");
    }
  }

  throw new Error("Upload a GeoJSON, JSON, or ZIP shapefile.");
}

export default function StudioBoundaryUpload({ onAddBoundary }) {
  const inputRef = useRef(null);
  const [processing, setProcessing] = useState(false);

  async function handleFile(file) {
    if (!file) return;
    setProcessing(true);
    try {
      const geojson = await parseFile(file);
      if (!geojson?.features?.length) throw new Error("The boundary file contains no features.");

      onAddBoundary({
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^/.]+$/, ""),
        level: "custom",
        sourceType: "upload",
        geojson
      });
    } catch (error) {
      window.alert(error.message || "Could not read the boundary file.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <section className="studio-panel studio-custom-boundary-panel">
      <div className="studio-panel-heading">
        <div>
          <span className="section-kicker">CUSTOM BOUNDARY</span>
          <h2>Map boundary</h2>
        </div>
        <MapPinned size={19} />
      </div>

      <button
        type="button"
        className="studio-upload-box studio-boundary-upload"
        onClick={() => inputRef.current?.click()}
        disabled={processing}
      >
        <Upload size={24} />
        <strong>{processing ? "Reading boundary…" : "Upload custom boundary"}</strong>
        <span>GeoJSON or ZIP shapefile</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".geojson,.json,.zip"
        hidden
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </section>
  );
}
