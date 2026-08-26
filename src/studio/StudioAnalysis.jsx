import React, { useMemo, useState } from "react";
import { Layers3, WandSparkles } from "lucide-react";
import { runIDW } from "./analysis/idw";

function isNumericField(features, field) {
  const values = features
    .slice(0, 100)
    .map((feature) => feature.properties?.[field])
    .filter((value) => value !== "" && value !== null && value !== undefined);

  return values.length > 0 && values.every((value) =>
    Number.isFinite(Number(String(value).replace(/,/g, "")))
  );
}

export default function StudioAnalysis({
  activeLayer,
  detectedBoundary = null,
  analysisResult = null,
  onResult,
  onMapMode,
  onOpenLayout
}) {
  const [mapType, setMapType] = useState("location");
  const [field, setField] = useState("");
  const [cellSize, setCellSize] = useState(1);
  const [power, setPower] = useState(2);

  const numericFields = useMemo(() => {
    if (!activeLayer) return [];
    return (activeLayer.columns || []).filter((column) =>
      isNumericField(activeLayer.geojson?.features || [], column)
    );
  }, [activeLayer]);

  function changeMapType(value) {
    setMapType(value);
    onMapMode?.(value);

    // A location map must never inherit an old IDW surface. This was the
    // cause of interpolation appearing in the location-map layout.
    if (value === "location") {
      onResult?.(null);
    }
  }

  function handleIDW() {
    if (!activeLayer) {
      window.alert("Upload point data first.");
      return;
    }

    if (!field) {
      window.alert("Select the variable to interpolate.");
      return;
    }

    try {
      const result = runIDW({
        geojson: activeLayer.geojson,
        valueField: field,
        cellSize: Number(cellSize),
        power: Number(power),
        boundaryFeature: detectedBoundary?.feature || null
      });

      const nextResult = {
        type: "idw",
        name: `${activeLayer.name} - IDW interpolation`,
        geojson: result,
        valueField: field,
        cellSize: Number(cellSize),
        power: Number(power),
        boundaryId: detectedBoundary?.boundary?.id || "",
        boundaryName: detectedBoundary?.boundary?.name || "",
        boundaryFeature: detectedBoundary?.feature || null
      };

      onResult?.(nextResult);
      setMapType("interpolation");
      onMapMode?.("interpolation");
    } catch (error) {
      window.alert(error.message || "Interpolation failed.");
    }
  }

  const boundaryReady = Boolean(detectedBoundary?.feature);
  const canCreateMap =
    mapType === "interpolation" &&
    analysisResult?.type === "idw";

  return (
    <section className="studio-panel">
      <div className="studio-panel-heading">
        <div>
          <span className="section-kicker">MAPS & ANALYSIS</span>
          <h2>Create map</h2>
        </div>
        <WandSparkles size={19} />
      </div>

      {!activeLayer ? (
        <p className="studio-muted">Upload a coordinate dataset to create a map.</p>
      ) : (
        <>
          <label htmlFor="studio-map-type">Map type</label>
          <select
            id="studio-map-type"
            value={mapType}
            onChange={(event) => changeMapType(event.target.value)}
          >
            <option value="location">Location map</option>
            <option value="interpolation">IDW interpolation</option>
          </select>

          {mapType === "location" ? (
            <>
              <div className="studio-map-type-help">
                <Layers3 size={16} />
                <span>
                  Shows only the uploaded sampling locations and automatically
                  fits the study area.
                </span>
              </div>

              <button
                type="button"
                className="primary-btn studio-run-btn"
                onClick={onOpenLayout}
              >
                Open location map layout
              </button>
            </>
          ) : (
            <>
              <label htmlFor="studio-value-field">Numeric variable</label>
              <select
                id="studio-value-field"
                value={field}
                onChange={(event) => setField(event.target.value)}
              >
                <option value="">Select field</option>
                {numericFields.map((column) => (
                  <option key={column} value={column}>{column}</option>
                ))}
              </select>

              {!numericFields.length && (
                <p className="studio-warning">
                  No numeric fields were detected in this dataset.
                </p>
              )}

              {!boundaryReady && (
                <p className="studio-warning">
                  Waiting for the automatic study boundary. Upload a custom
                  boundary if you do not want to use the permanent boundary
                  library.
                </p>
              )}

              <label htmlFor="studio-cell-size">Cell size (km)</label>
              <input
                id="studio-cell-size"
                type="number"
                min="0.1"
                step="0.1"
                value={cellSize}
                onChange={(event) => setCellSize(event.target.value)}
              />

              <label htmlFor="studio-power">IDW power</label>
              <input
                id="studio-power"
                type="number"
                min="0.5"
                step="0.5"
                value={power}
                onChange={(event) => setPower(event.target.value)}
              />

              <button
                type="button"
                className="primary-btn studio-run-btn"
                onClick={handleIDW}
                disabled={!numericFields.length || !boundaryReady}
              >
                <WandSparkles size={17} /> Run IDW interpolation
              </button>

              <button
                type="button"
                className="secondary-btn studio-run-btn"
                onClick={onOpenLayout}
                disabled={!canCreateMap}
              >
                Create map
              </button>

              <div className="studio-map-type-help studio-analysis-note">
                <Layers3 size={16} />
                <span>
                  The interpolation is clipped to the automatically detected
                  study boundary or to the customer-uploaded custom boundary.
                </span>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
