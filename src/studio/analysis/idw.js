import { interpolate } from "@turf/interpolate";

export function runIDW({
  geojson,
  valueField,
  cellSize = 1,
  power = 2,
  units = "kilometers"
}) {
  if (!geojson?.features?.length) {
    throw new Error("No point data available.");
  }

  const validFeatures = geojson.features.filter((feature) => {
    const value = Number(
      String(feature.properties?.[valueField] ?? "").replace(/,/g, "")
    );

    return Number.isFinite(value) && feature.geometry?.type === "Point";
  }).map((feature) => ({
    ...feature,
    properties: {
      ...feature.properties,
      [valueField]: Number(
        String(feature.properties?.[valueField]).replace(/,/g, "")
      )
    }
  }));

  if (validFeatures.length < 3) {
    throw new Error(
      "At least 3 valid numeric points are required for interpolation."
    );
  }

  const result = interpolate(
    { type: "FeatureCollection", features: validFeatures },
    Math.max(0.1, Number(cellSize) || 1),
    {
      gridType: "square",
      property: valueField,
      units,
      weight: Math.max(0.5, Number(power) || 2)
    }
  );

  return result;
}
