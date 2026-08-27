import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, MapPinned } from "lucide-react";
import StudioUpload from "./StudioUpload";
import StudioMap from "./StudioMap";
import StudioAnalysis from "./StudioAnalysis";
import StudioLayers from "./StudioLayers";
import StudioBoundaryUpload from "./StudioBoundaryUpload";
import StudioLayout from "./StudioLayout";
import { detectBoundaryFeature, detectBoundaryForStudy } from "./spatial";
import { getPermanentBoundaryResolution } from "./boundaryApi";

function combineBoundaryFeatures(boundary) {
  const features = boundary?.geojson?.features || [];
  if (!features.length) return null;

  if (features.length === 1) {
    return features[0];
  }

  const polygonParts = [];

  features.forEach((feature) => {
    const geometry = feature?.geometry;
    if (!geometry) return;

    if (geometry.type === "Polygon") {
      polygonParts.push(geometry.coordinates);
    } else if (geometry.type === "MultiPolygon") {
      polygonParts.push(...geometry.coordinates);
    }
  });

  if (!polygonParts.length) {
    return features[0];
  }

  return {
    type: "Feature",
    properties: {
      ...(features[0]?.properties || {}),
      name: boundary.name
    },
    geometry: {
      type: "MultiPolygon",
      coordinates: polygonParts
    }
  };
}

export default function StudioPage() {
  const [layers, setLayers] = useState([]);
  const [boundaries, setBoundaries] = useState([]);
  const [recommendedBoundaryLevel, setRecommendedBoundaryLevel] = useState(null);
  const [activeLayerId, setActiveLayerId] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [mapMode, setMapMode] = useState("location");
  const [layoutOpen, setLayoutOpen] = useState(false);

  const activeLayer = useMemo(
    () => layers.find((layer) => layer.id === activeLayerId) || null,
    [layers, activeLayerId]
  );

  const detected = useMemo(() => {
    if (!activeLayer) return {};

    const find = (level) => {
      const source = boundaries.filter((boundary) => boundary.level === level);

      for (const boundary of source) {
        const feature = detectBoundaryFeature(
          boundary,
          activeLayer.geojson?.features || []
        );

        if (feature) {
          return { boundary, feature };
        }
      }

      return null;
    };

    const customBoundary = boundaries.find(
      (item) => item.sourceType === "upload" && item.level === "custom"
    );

    // Uploaded custom boundaries are project layers in their own right.
    // Keep the whole uploaded geometry available for the map/layout even
    // when the sampling points do not fall inside the boundary.
    const customFeature = customBoundary
      ? detectBoundaryFeature(
          customBoundary,
          activeLayer.geojson?.features || []
        ) || combineBoundaryFeatures(customBoundary)
      : null;

    return {
      country: find("country"),
      state: find("state"),
      district: find("district"),
      village: find("village"),
      custom: customBoundary
        ? {
            boundary: customBoundary,
            feature: customFeature
          }
        : null,

      countryBoundary: find("country")?.boundary || null,
      countryFeature: find("country")?.feature || null,
      stateBoundary: find("state")?.boundary || null,
      stateFeature: find("state")?.feature || null,
      districtBoundary: find("district")?.boundary || null,
      districtFeature: find("district")?.feature || null,
      villageBoundary: find("village")?.boundary || null,
      villageFeature: find("village")?.feature || null,
      customBoundary: customBoundary || null,
      customFeature: customFeature || null,
      countryInsetGeojson: find("country")?.boundary?.insetGeojson || null,
      stateInsetGeojson: find("state")?.boundary?.insetGeojson || null
    };
  }, [activeLayer, boundaries]);

  const mainDetected = useMemo(() => {
    if (!activeLayer) return null;

    // A customer-uploaded custom boundary always takes precedence.
    if (detected.custom?.boundary && detected.custom?.feature) {
      return {
        ...detected.custom,
        level: "custom"
      };
    }

    // The backend recommends the smallest permanent boundary that contains
    // the complete point set. This avoids selecting a single district or
    // village when the uploaded points span several adjacent features.
    if (recommendedBoundaryLevel) {
      const recommended = detected[recommendedBoundaryLevel];
      if (recommended?.boundary && recommended?.feature) {
        return {
          ...recommended,
          level: recommendedBoundaryLevel
        };
      }
    }

    const levels = [
      ["village", detected.village],
      ["district", detected.district],
      ["state", detected.state],
      ["country", detected.country]
    ];

    for (const [level, item] of levels) {
      if (item?.boundary && item?.feature) {
        return {
          ...item,
          level
        };
      }
    }

    return null;
  }, [activeLayer, detected, recommendedBoundaryLevel]);

  useEffect(() => {
    if (!activeLayer) {
      setRecommendedBoundaryLevel(null);
      return;
    }

    let cancelled = false;
    const pointFeatures = activeLayer.geojson?.features || [];

    // Keep a customer-uploaded custom boundary while replacing only the
    // permanent backend boundary results for the newly active point layer.
    setBoundaries((current) =>
      current.filter((boundary) => boundary.sourceType === "upload")
    );
    setRecommendedBoundaryLevel(null);

    getPermanentBoundaryResolution(pointFeatures)
      .then((resolution) => {
        if (cancelled) return;

        const backend = (resolution?.boundaries || []).map((boundary) => ({
          ...boundary,
          sourceType: "backend"
        }));

        setRecommendedBoundaryLevel(
          resolution?.recommendedLevel || null
        );

        setBoundaries((current) => {
          const custom = current.filter(
            (boundary) => boundary.sourceType === "upload"
          );
          return [...custom, ...backend];
        });
      })
      .catch((error) => {
        if (cancelled) return;

        console.warn(
          "[Verdant GIS Studio] Permanent boundary service unavailable:",
          error?.message || error
        );

        setRecommendedBoundaryLevel(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeLayer]);

  function addLayer(layer) {
    setLayers((current) => [...current, layer]);
    setActiveLayerId(layer.id);
    setAnalysisResult(null);
    setMapMode("location");
  }

  function removeLayer(id) {
    setLayers((current) => current.filter((layer) => layer.id !== id));

    if (activeLayerId === id) {
      setActiveLayerId(null);
    }

    setAnalysisResult(null);
    setMapMode("location");
  }

  function addBoundary(boundary) {
    setBoundaries((current) => [...current, boundary]);
  }

  function openLayout() {
    if (!activeLayer) {
      window.alert("Upload a coordinate CSV first.");
      return;
    }

    setLayoutOpen(true);
  }

  return (
    <div className="studio-page">
      <header className="studio-header">
        <div>
          <span className="section-kicker">VERDANT GIS</span>
          <h1>GIS Studio</h1>
          <p>
            Upload your coordinates, create location maps and generate spatial
            analyses from your own data.
          </p>
        </div>

        <div className="studio-header-actions">
          <Link to="/" className="secondary-btn">
            Exit Studio
          </Link>

          <button className="primary-btn" type="button" onClick={openLayout}>
            <Download size={17} /> Map Layout
          </button>
        </div>
      </header>

      <div className="studio-toolbar">
        <div>
          <MapPinned size={16} />
          <strong>
            {mapMode === "interpolation"
              ? `IDW interpolation${
                  analysisResult?.valueField
                    ? ` — ${analysisResult.valueField}`
                    : ""
                }`
              : "Location map"}
          </strong>
        </div>

        <span>
          {activeLayer
            ? `${
                activeLayer.featureCount ||
                activeLayer.geojson?.features?.length ||
                0
              } valid locations`
            : "Upload CSV to begin"}
        </span>
      </div>

      <div className="studio-layout">
        <aside className="studio-sidebar">
          <StudioUpload onAddLayer={addLayer} />

          <StudioBoundaryUpload onAddBoundary={addBoundary} />

          <StudioLayers
            layers={layers}
            boundaries={boundaries}
            activeLayerId={activeLayerId}
            onSelect={(id) => {
              setActiveLayerId(id);
              setAnalysisResult(null);
              setMapMode("location");
            }}
            onRemove={removeLayer}
          />

          {boundaries.length > 0 && (
            <section className="studio-panel">
              <div className="studio-panel-heading">
                <div>
                  <span className="section-kicker">BOUNDARY LIBRARY</span>
                  <h2>Loaded</h2>
                </div>
              </div>

              {boundaries.map((boundary) => (
                <div className="studio-boundary-row" key={boundary.id}>
                  <strong>{boundary.name}</strong>
                  <span>
                    {boundary.level} ·{" "}
                    {boundary.geojson?.features?.length || 0} features
                  </span>
                </div>
              ))}
            </section>
          )}
        </aside>

        <main className="studio-map-area">
          <StudioMap
            key={activeLayerId || "studio-empty"}
            layers={layers}
            boundaries={boundaries}
            analysisResult={analysisResult}
            mapMode={mapMode}
            selectedBoundaryId={mainDetected?.boundary?.id || ""}
            selectedBoundaryFeature={mainDetected?.feature || null}
            activeLayerId={activeLayerId}
          />
        </main>

        <aside className="studio-sidebar">
          <StudioAnalysis
            activeLayer={activeLayer}
            detectedBoundary={mainDetected}
            analysisResult={analysisResult}
            onResult={setAnalysisResult}
            onMapMode={setMapMode}
            onOpenLayout={openLayout}
          />

          {activeLayer && (
            <section className="studio-panel">
              <div className="studio-panel-heading">
                <div>
                  <span className="section-kicker">AUTO LOCATION</span>
                  <h2>Study area</h2>
                </div>
              </div>

              {mainDetected?.boundary ? (
                <>
                  <p className="studio-muted">
                    The point dataset has been spatially matched to the
                    uploaded boundary library.
                  </p>

                  {detected.countryBoundary && (
                    <div className="studio-detected">
                      Country: {detected.countryBoundary.name}
                    </div>
                  )}

                  {detected.stateBoundary && (
                    <div className="studio-detected">
                      State: {detected.stateBoundary.name}
                    </div>
                  )}

                  {detected.districtBoundary && (
                    <div className="studio-detected">
                      District: {detected.districtBoundary.name}
                    </div>
                  )}

                  {detected.villageBoundary && (
                    <div className="studio-detected">
                      Local area: {detected.villageBoundary.name}
                    </div>
                  )}

                  {detected.customBoundary && (
                    <div className="studio-detected">
                      Custom boundary: {detected.customBoundary.name}
                    </div>
                  )}
                </>
              ) : (
                <p className="studio-muted">
                  {boundaries.length
                    ? "No matching boundary was found. Check that the permanent backend boundary library is connected or upload a custom boundary."
                    : "Automatic country, state, district and village boundaries are fetched from the permanent backend library. Upload a custom boundary only when needed."}
                </p>
              )}
            </section>
          )}
        </aside>
      </div>

      <StudioLayout
        open={layoutOpen}
        onClose={() => setLayoutOpen(false)}
        layers={layers}
        activeLayer={activeLayer}
        boundaries={boundaries}
        detected={{ ...detected, mainFeature: mainDetected?.feature || null }}
        analysisResult={analysisResult}
      />
    </div>
  );
}
