import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, MapPinned } from "lucide-react";
import StudioUpload from "./StudioUpload";
import StudioMap from "./StudioMap";
import StudioAnalysis from "./StudioAnalysis";
import StudioLayers from "./StudioLayers";
import StudioBoundaryUpload from "./StudioBoundaryUpload";
import StudioLayout from "./StudioLayout";
import { detectBoundaryFeature, detectBoundaryForStudy, featureContainsPoint } from "./spatial";
import { getPermanentBoundaryResolution } from "./boundaryApi";

function combineBoundaryFeatures(boundary) {
  const features = boundary?.geojson?.features || [];
  if (!features.length) return null;
  if (features.length === 1) return features[0];

  const polygonParts = [];
  for (const feature of features) {
    const geometry = feature?.geometry;
    if (!geometry) continue;
    if (geometry.type === "Polygon") polygonParts.push(geometry.coordinates);
    else if (geometry.type === "MultiPolygon") polygonParts.push(...geometry.coordinates);
  }

  if (!polygonParts.length) return features[0];

  return {
    type: "Feature",
    properties: { ...(features[0]?.properties || {}), name: boundary.name },
    geometry: { type: "MultiPolygon", coordinates: polygonParts }
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
  const [focusRequest, setFocusRequest] = useState(0);
  const [focusTarget, setFocusTarget] = useState(null);
  const [autoLocationLoading, setAutoLocationLoading] = useState(false);
  // Map Layout is available only after the backend has successfully
  // resolved at least one permanent study boundary for the active dataset.
  const [studyLocationReady, setStudyLocationReady] = useState(false);

  const activeLayer = useMemo(
    () => layers.find((layer) => layer.id === activeLayerId) || null,
    [layers, activeLayerId]
  );

  const detected = useMemo(() => {
    const find = (level) => {
      if (!activeLayer) return null;
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
      (boundary) =>
        boundary?.sourceType === "upload" &&
        boundary?.level === "custom"
    ) || null;

    const customFeature = customBoundary
      ? combineBoundaryFeatures(customBoundary)
      : null;

    const country = find("country");
    const state = find("state");
    const district = find("district");
    const village = find("village");

    return {
      country,
      state,
      district,
      village,
      custom: customBoundary
        ? { boundary: customBoundary, feature: customFeature }
        : null,

      countryBoundary: country?.boundary || null,
      countryFeature: country?.feature || null,
      stateBoundary: state?.boundary || null,
      stateFeature: state?.feature || null,
      districtBoundary: district?.boundary || null,
      districtFeature: district?.feature || null,
      villageBoundary: village?.boundary || null,
      villageFeature: village?.feature || null,
      customBoundary,
      customFeature,
      countryInsetGeojson: country?.boundary?.insetGeojson || null,
      stateInsetGeojson: state?.boundary?.insetGeojson || null
    };
  }, [activeLayer, boundaries]);

  const mainDetected = useMemo(() => {
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

  const customBoundaryStats = useMemo(() => {
    const feature = detected.customFeature || null;
    const pointFeatures = activeLayer?.geojson?.features || [];
    const total = pointFeatures.filter(
      (featureItem) => featureItem?.geometry?.type === "Point"
    ).length;
    const inside = feature
      ? pointFeatures.filter(
          (featureItem) =>
            featureItem?.geometry?.type === "Point" &&
            featureContainsPoint(feature, featureItem.geometry.coordinates)
        ).length
      : 0;

    return {
      total,
      inside,
      outside: Math.max(total - inside, 0)
    };
  }, [activeLayer, detected.customFeature]);

  useEffect(() => {
    if (!activeLayer) {
      setRecommendedBoundaryLevel(null);
      setAutoLocationLoading(false);
      setStudyLocationReady(false);
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
    setAutoLocationLoading(true);
    setStudyLocationReady(false);

    getPermanentBoundaryResolution(pointFeatures)
      .then((resolution) => {
        if (cancelled) return;

        setAutoLocationLoading(false);

        const backend = (resolution?.boundaries || []).map((boundary) => ({
          ...boundary,
          sourceType: "backend"
        }));

        // A successful HTTP response is not enough by itself. Unlock the
        // layout only when the backend actually returned a study boundary.
        setStudyLocationReady(backend.length > 0);

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

        setAutoLocationLoading(false);

        console.warn(
          "[Verdant GIS Studio] Permanent boundary service unavailable:",
          error?.message || error
        );

        setRecommendedBoundaryLevel(null);
        setStudyLocationReady(false);
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
    setFocusTarget({ type: "layer", id: layer.id });
    setFocusRequest((value) => value + 1);
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
    setBoundaries((current) => [
      ...current.filter((item) => item.sourceType !== "upload"),
      boundary
    ]);
    setAnalysisResult(null);
    setMapMode("location");
    // Boundary upload is an explicit user action. Request a boundary focus,
    // but StudioMap will fall back to the point extent if the boundary is
    // unrelated to the sampling points.
    setFocusTarget({ type: "boundary", id: boundary.id });
    setFocusRequest((value) => value + 1);
  }

  function handleRemoveBoundary(id) {
    setBoundaries((current) =>
      current.filter((boundary) => boundary.id !== id)
    );
    setAnalysisResult(null);
    setMapMode("location");
    setFocusTarget(activeLayerId ? { type: "layer", id: activeLayerId } : null);
    setFocusRequest((value) => value + 1);
  }

  function openLayout() {
    if (!activeLayer) {
      window.alert("Upload a coordinate CSV first.");
      return;
    }

    if (autoLocationLoading) {
      window.alert("Study location is still loading. Please wait for it to finish before opening Map Layout.");
      return;
    }

    if (!studyLocationReady) {
      window.alert("Study location has not been fetched successfully yet. Please wait for the study location to load before opening Map Layout.");
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

        <span className="studio-toolbar-status">
          {activeLayer
            ? `${
                activeLayer.featureCount ||
                activeLayer.geojson?.features?.length ||
                0
              } valid locations`
            : "Upload CSV to begin"}

          {activeLayer && autoLocationLoading && (
            <strong className="studio-auto-loading" role="status" aria-live="polite">
              Fetching auto location…
            </strong>
          )}

          {activeLayer &&
            detected.customBoundary &&
            customBoundaryStats.total > 0 &&
            customBoundaryStats.inside <
              customBoundaryStats.total && (
              <strong className="studio-top-warning" role="alert">
                {customBoundaryStats.inside === 0
                  ? `Warning: none of the ${customBoundaryStats.total} CSV points are inside the custom boundary.`
                  : `Warning: ${customBoundaryStats.inside} of ${customBoundaryStats.total} CSV points are inside the custom boundary; ${customBoundaryStats.outside} are outside.`}
              </strong>
            )}
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
              setFocusTarget({ type: "layer", id });
              setFocusRequest((value) => value + 1);
            }}
            onRemove={removeLayer}
            onRemoveBoundary={handleRemoveBoundary}
            onSelectBoundary={(id) => {
              setFocusTarget({ type: "boundary", id });
              setFocusRequest((value) => value + 1);
            }}
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
            layers={layers}
            boundaries={boundaries}
            analysisResult={analysisResult}
            mapMode={mapMode}
            selectedBoundaryId={mainDetected?.boundary?.id || ""}
            selectedBoundaryFeature={mainDetected?.feature || null}
            activeLayerId={activeLayerId}
            focusRequest={focusRequest}
            focusTarget={focusTarget}
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

              {autoLocationLoading ? (
                <div className="studio-detected studio-auto-loading-card" role="status" aria-live="polite">
                  Fetching auto location…
                </div>
              ) : mainDetected?.boundary ? (
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
                    <>
                      <div className="studio-detected">
                        Custom boundary: {detected.customBoundary.name}
                      </div>

                      {customBoundaryStats.total > 0 &&
                        customBoundaryStats.inside === 0 && (
                          <div className="studio-detected studio-warning">
                            Warning: none of the {customBoundaryStats.total} CSV
                            points are inside the custom boundary.
                          </div>
                        )}

                      {customBoundaryStats.total > 0 &&
                        customBoundaryStats.inside > 0 &&
                        customBoundaryStats.inside <
                          customBoundaryStats.total && (
                          <div className="studio-detected studio-warning">
                            Warning: {customBoundaryStats.inside} of{" "}
                            {customBoundaryStats.total} CSV points are inside
                            the custom boundary;{" "}
                            {customBoundaryStats.outside} are outside.
                          </div>
                        )}

                      {customBoundaryStats.total > 0 &&
                        customBoundaryStats.inside ===
                          customBoundaryStats.total && (
                          <div className="studio-detected">
                            All {customBoundaryStats.total} CSV points are
                            inside the custom boundary.
                          </div>
                        )}
                    </>
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
