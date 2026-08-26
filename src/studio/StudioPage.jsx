import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, MapPinned } from "lucide-react";
import StudioUpload from "./StudioUpload";
import StudioMap from "./StudioMap";
import StudioAnalysis from "./StudioAnalysis";
import StudioLayers from "./StudioLayers";

export default function StudioPage() {
  const [layers, setLayers] = useState([]);
  const [activeLayerId, setActiveLayerId] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [mapMode, setMapMode] = useState("location");

  const activeLayer = useMemo(
    () => layers.find((layer) => layer.id === activeLayerId) || null,
    [layers, activeLayerId]
  );

  function addLayer(layer) {
    setLayers((current) => [...current, layer]);
    setActiveLayerId(layer.id);
    setAnalysisResult(null);
    setMapMode("location");
  }

  function removeLayer(id) {
    setLayers((current) => current.filter((layer) => layer.id !== id));
    if (activeLayerId === id) setActiveLayerId(null);
    setAnalysisResult(null);
    setMapMode("location");
  }

  function exportMap() {
    const canvas = document.querySelector(".studio-map canvas");

    if (!canvas) {
      window.alert("The map is not ready yet.");
      return;
    }

    try {
      const link = document.createElement("a");
      link.download = `verdant-gis-${mapMode}-map.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      window.alert(
        "Map export was blocked by the basemap provider. The map can still be exported after a print/layout module is added."
      );
    }
  }

  return (
    <div className="studio-page">
      <header className="studio-header">
        <div>
          <span className="section-kicker">VERDANT GIS</span>
          <h1>GIS Studio</h1>
          <p>
            Upload your coordinates, create location maps and generate spatial analyses from your own data.
          </p>
        </div>

        <div className="studio-header-actions">
          <Link to="/" className="secondary-btn">Exit Studio</Link>
          <button className="primary-btn" type="button" onClick={exportMap}>
            <Download size={17} /> Export Map
          </button>
        </div>
      </header>

      <div className="studio-toolbar">
        <div>
          <MapPinned size={16} />
          <strong>
            {mapMode === "interpolation"
              ? `IDW interpolation${analysisResult?.valueField ? ` — ${analysisResult.valueField}` : ""}`
              : "Location map"}
          </strong>
        </div>
        <span>
          {activeLayer
            ? `${activeLayer.featureCount || activeLayer.geojson?.features?.length || 0} valid locations`
            : "Upload CSV to begin"}
        </span>
      </div>

      <div className="studio-layout">
        <aside className="studio-sidebar">
          <StudioUpload onAddLayer={addLayer} />
          <StudioLayers
            layers={layers}
            activeLayerId={activeLayerId}
            onSelect={(id) => {
              setActiveLayerId(id);
              setAnalysisResult(null);
              setMapMode("location");
            }}
            onRemove={removeLayer}
          />
        </aside>

        <main className="studio-map-area">
          <StudioMap
            layers={layers}
            analysisResult={analysisResult}
            mapMode={mapMode}
            valueField={analysisResult?.valueField || ""}
          />
        </main>

        <aside className="studio-sidebar">
          <StudioAnalysis
            activeLayer={activeLayer}
            onResult={setAnalysisResult}
            onMapMode={setMapMode}
          />
        </aside>
      </div>
    </div>
  );
}
