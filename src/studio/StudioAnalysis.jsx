import React, { useMemo, useState } from "react";
import { Layers3, WandSparkles } from "lucide-react";
import { runIDW } from "./analysis/idw";

function isNumericField(features, field) {
  const values = features
    .slice(0, 100)
    .map((feature) => feature.properties?.[field])
    .filter((value) => value !== "" && value !== null && value !== undefined);

  if (!values.length) return false;

  return values.every((value) =>
    Number.isFinite(Number(String(value).replace(/,/g, "")))
  );
}

export default function StudioAnalysis({
  activeLayer,
  onResult,
  onMapMode
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
        power: Number(power)
      });

      onResult({
        type: "idw",
        name: `${activeLayer.name} - IDW interpolation`,
        geojson: result,
        valueField: field,
        cellSize: Number(cellSize),
        power: Number(power)
      });

      changeMapType("interpolation");
    } catch (error) {
      window.alert(error.message || "Interpolation failed.");
    }
  }

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
        <p className="studio-muted">
          Upload a coordinate dataset to create a map.
        </p>
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
            <div className="studio-map-type-help">
              <Layers3 size={16} />
              <span>
                Creates a location map from your uploaded coordinates and fits the map to your study area.
              </span>
            </div>
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
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>

              {!numericFields.length && (
                <p className="studio-warning">
                  No numeric fields were detected in this dataset.
                </p>
              )}

              <label htmlFor="studio-cell-size">Cell size</label>
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
              >
                <WandSparkles size={17} />
                Run IDW interpolation
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
