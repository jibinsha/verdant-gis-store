import React from "react";
import { Layers, Trash2 } from "lucide-react";

export default function StudioLayers({ layers, activeLayerId, onSelect, onRemove }) {
  return (
    <section className="studio-panel">
      <div className="studio-panel-heading">
        <div><span className="section-kicker">LAYERS</span><h2>Project layers</h2></div>
        <Layers size={19} />
      </div>

      {!layers.length ? (
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
        </div>
      )}
    </section>
  );
}
