import React from "react";
import { Layers, Trash2, MapPinned } from "lucide-react";

export default function StudioLayers({
  layers,
  boundaries = [],
  activeLayerId,
  onSelect,
  onRemove,
  onRemoveBoundary
}) {
  const projectBoundaries = (boundaries || []).filter(
    (boundary) => boundary?.sourceType === "upload"
  );
  return (
    <section className="studio-panel">
      <div className="studio-panel-heading">
        <div><span className="section-kicker">LAYERS</span><h2>Project layers</h2></div>
        <Layers size={19} />
      </div>

      {!layers.length && !projectBoundaries.length ? (
        <p className="studio-muted">No layers added yet.</p>
      ) : (
        <div className="studio-layer-list">
          {layers.map((layer) => (
            <div key={layer.id} className={`studio-layer-row ${activeLayerId === layer.id ? "active" : ""}`}>
              <button type="button" className="studio-layer-select" onClick={() => onSelect(layer.id)}>
                <strong>{layer.name}</strong>
                <span>{layer.featureCount ?? layer.geojson?.features?.length ?? 0} features</span>
              </button>
              <button type="button" className="icon-btn" title="Remove layer" onClick={() => onRemove(layer.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          {projectBoundaries.map((boundary) => (
            <div key={boundary.id} className="studio-layer-row">
              <div className="studio-layer-select">
                <strong>
                  <MapPinned size={16} /> {boundary.name}
                </strong>
                <span>
                  custom · {boundary.geojson?.features?.length || 0} features
                </span>
              </div>
              <button
                type="button"
                className="icon-btn"
                title="Remove boundary"
                aria-label={`Remove boundary ${boundary.name}`}
                onClick={() => onRemoveBoundary?.(boundary.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
