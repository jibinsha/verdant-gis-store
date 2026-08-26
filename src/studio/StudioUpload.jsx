import React, { useRef, useState } from "react";
import Papa from "papaparse";
import { Upload } from "lucide-react";

/*
 * ============================================================
 * COORDINATE COLUMN DETECTION
 * ============================================================
 */

function normalizeColumnName(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[\s\-().[\]{}:/\\]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isLatitudeColumn(name) {
  const n = normalizeColumnName(name);

  const exact = new Set([
    "lat",
    "latitude",
    "y",
    "ycoord",
    "y_coordinate",
    "ycoordinate",
    "latcoord",
    "lat_coordinate",
    "latitude_coord",
    "latitude_coordinate",
    "gpslat",
    "gps_lat",
    "gpslatitude",
    "gps_latitude",
    "latitude_dd",
    "lat_dd",
    "latitude_deg",
    "lat_deg"
  ]);

  if (exact.has(n)) return true;

  /*
   * Handle names such as:
   * sample_latitude
   * point_lat
   * gps_latitude_dd
   * latitude_decimal
   */
  if (
    n.includes("latitude") ||
    n.includes("gps_lat") ||
    n.includes("lat_coord") ||
    n.includes("lat_coordinate")
  ) {
    return true;
  }

  /*
   * Short x/y style names.
   * Y normally represents latitude.
   */
  if (
    n === "y" ||
    n.startsWith("y_") ||
    n.endsWith("_y") ||
    n.includes("_y_coord") ||
    n.includes("_y_coordinate")
  ) {
    return true;
  }

  return false;
}

function isLongitudeColumn(name) {
  const n = normalizeColumnName(name);

  const exact = new Set([
    "lon",
    "long",
    "lng",
    "longitude",
    "x",
    "xcoord",
    "x_coordinate",
    "xcoordinate",
    "loncoord",
    "lon_coordinate",
    "longitude_coord",
    "longitude_coordinate",
    "gpslon",
    "gps_lon",
    "gpslng",
    "gps_lng",
    "gpslong",
    "gps_long",
    "gpslongitude",
    "gps_longitude",
    "longitude_dd",
    "lon_dd",
    "long_dd",
    "longitude_deg",
    "lon_deg",
    "long_deg"
  ]);

  if (exact.has(n)) return true;

  if (
    n.includes("longitude") ||
    n.includes("gps_lon") ||
    n.includes("gps_long") ||
    n.includes("gps_lng") ||
    n.includes("lon_coord") ||
    n.includes("long_coord") ||
    n.includes("longitude_coord")
  ) {
    return true;
  }

  /*
   * Short x/y style names.
   * X normally represents longitude.
   */
  if (
    n === "x" ||
    n.startsWith("x_") ||
    n.endsWith("_x") ||
    n.includes("_x_coord") ||
    n.includes("_x_coordinate")
  ) {
    return true;
  }

  return false;
}

/*
 * ============================================================
 * COORDINATE VALUE PARSER
 * ============================================================
 *
 * Supports:
 *
 * 32.11018
 * 32.11018 N
 * N 32.11018
 * 32°06'36.65"N
 * 32°06′36.65″ N
 * -32.11018
 *
 * Returns decimal degrees.
 */

function parseCoordinate(value, axis) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  let text = String(value)
    .trim()
    .replace(/[−–—]/g, "-")
    .replace(/[′’]/g, "'")
    .replace(/[″”]/g, '"')
    .replace(/º/g, "°")
    .replace(/\s+/g, " ");

  if (!text) return null;

  /*
   * Detect hemisphere.
   */
  const hemisphereMatch = text.match(
    /(?:^|\s)([NSEW])(?:\s|$)/i
  );

  const hemisphere =
    hemisphereMatch?.[1]?.toUpperCase() || null;

  /*
   * Also support:
   *
   * 32.11018N
   * 76.28411E
   */
  const attachedHemisphere =
    text.match(/([NSEW])$/i);

  const finalHemisphere =
    hemisphere ||
    attachedHemisphere?.[1]?.toUpperCase() ||
    null;

  /*
   * Remove hemisphere letters.
   */
  let cleaned = text
    .replace(/[NSEW]/gi, "")
    .trim();

  /*
   * Remove degree/minute/second symbols for parsing.
   */
  const dmsMatch = cleaned.match(
    /^([+-]?\d+(?:\.\d+)?)\s*°\s*(\d+(?:\.\d+)?)?\s*(?:'|\s)\s*(\d+(?:\.\d+)?)?\s*(?:"|$)/
  );

  let result = null;

  if (dmsMatch) {
    const degrees = Number(dmsMatch[1]);
    const minutes = Number(dmsMatch[2] || 0);
    const seconds = Number(dmsMatch[3] || 0);

    if (
      Number.isFinite(degrees) &&
      Number.isFinite(minutes) &&
      Number.isFinite(seconds) &&
      minutes >= 0 &&
      minutes < 60 &&
      seconds >= 0 &&
      seconds < 60
    ) {
      const sign = degrees < 0 ? -1 : 1;

      result =
        Math.abs(degrees) +
        minutes / 60 +
        seconds / 3600;

      result *= sign;
    }
  }

  /*
   * Support DMS without degree symbols:
   *
   * 32 06 36.65 N
   */
  if (result === null) {
    const spaceDms = cleaned.match(
      /^([+-]?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/
    );

    if (spaceDms) {
      const degrees = Number(spaceDms[1]);
      const minutes = Number(spaceDms[2]);
      const seconds = Number(spaceDms[3]);

      if (
        Number.isFinite(degrees) &&
        Number.isFinite(minutes) &&
        Number.isFinite(seconds) &&
        minutes >= 0 &&
        minutes < 60 &&
        seconds >= 0 &&
        seconds < 60
      ) {
        const sign = degrees < 0 ? -1 : 1;

        result =
          (Math.abs(degrees) +
            minutes / 60 +
            seconds / 3600) *
          sign;
      }
    }
  }

  /*
   * Decimal degrees.
   */
  if (result === null) {
    let decimalText = cleaned
      .replace(/°/g, "")
      .replace(/'/g, "")
      .replace(/"/g, "")
      .trim();

    /*
     * Support decimal comma when it is clearly a decimal comma.
     */
    if (
      decimalText.includes(",") &&
      !decimalText.includes(".") &&
      /^[-+]?\d+,\d+$/.test(decimalText)
    ) {
      decimalText =
        decimalText.replace(",", ".");
    }

    const number = Number(
      decimalText.replace(/,/g, "")
    );

    if (Number.isFinite(number)) {
      result = number;
    }
  }

  if (result === null) return null;

  /*
   * Apply hemisphere.
   */
  if (finalHemisphere) {
    const isLatitude =
      axis === "latitude";

    if (
      isLatitude &&
      !["N", "S"].includes(finalHemisphere)
    ) {
      return null;
    }

    if (
      !isLatitude &&
      !["E", "W"].includes(finalHemisphere)
    ) {
      return null;
    }

    const absolute = Math.abs(result);

    if (
      finalHemisphere === "S" ||
      finalHemisphere === "W"
    ) {
      result = -absolute;
    } else {
      result = absolute;
    }
  }

  /*
   * Final geographic validation.
   */
  if (axis === "latitude") {
    if (result < -90 || result > 90) {
      return null;
    }
  }

  if (axis === "longitude") {
    if (result < -180 || result > 180) {
      return null;
    }
  }

  return result;
}

/*
 * ============================================================
 * FIND BEST COORDINATE COLUMNS
 * ============================================================
 */

function findCoordinateColumn(
  columns,
  rows,
  axis
) {
  const candidates = columns
    .map((column) => {
      let score = 0;

      if (
        axis === "latitude" &&
        isLatitudeColumn(column)
      ) {
        score += 100;
      }

      if (
        axis === "longitude" &&
        isLongitudeColumn(column)
      ) {
        score += 100;
      }

      /*
       * Additional evidence from actual values.
       */
      const sample = rows
        .slice(0, 100)
        .map((row) =>
          parseCoordinate(
            row[column],
            axis
          )
        )
        .filter(
          (value) => value !== null
        );

      if (sample.length) {
        score += Math.min(
          sample.length,
          20
        );
      }

      return {
        column,
        score,
        validSamples: sample.length
      };
    })
    .filter(
      (candidate) =>
        candidate.score > 0
    )
    .sort(
      (a, b) =>
        b.score - a.score
    );

  return candidates[0]?.column || null;
}

/*
 * ============================================================
 * COMPONENT
 * ============================================================
 */

export default function StudioUpload({
  onAddLayer
}) {
  const inputRef = useRef(null);
  const [processing, setProcessing] =
    useState(false);

  function handleFile(file) {
    if (!file) return;

    setProcessing(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,

      complete(results) {
        try {
          const rows =
            results.data || [];

          if (!rows.length) {
            throw new Error(
              "The CSV contains no data."
            );
          }

          const columns =
            Object.keys(rows[0]);

          if (!columns.length) {
            throw new Error(
              "Could not detect CSV columns."
            );
          }

          /*
           * Detect latitude.
           */
          const latitudeColumn =
            findCoordinateColumn(
              columns,
              rows,
              "latitude"
            );

          /*
           * Detect longitude.
           */
          const longitudeColumn =
            findCoordinateColumn(
              columns,
              rows,
              "longitude"
            );

          if (
            !latitudeColumn ||
            !longitudeColumn
          ) {
            throw new Error(
              `Could not automatically detect coordinate columns.

Supported examples include:
lat / latitude / Lat / GPS_Lat / y

lon / long / lng / longitude / GPS_Long / x`
            );
          }

          /*
           * Prevent accidentally selecting the
           * same column for both axes.
           */
          if (
            latitudeColumn ===
            longitudeColumn
          ) {
            throw new Error(
              `The same column "${latitudeColumn}" was detected for both latitude and longitude.`
            );
          }

          /*
           * Convert rows to GeoJSON.
           */
          const features =
            rows
              .map(
                (row, index) => {
                  const lat =
                    parseCoordinate(
                      row[
                        latitudeColumn
                      ],
                      "latitude"
                    );

                  const lon =
                    parseCoordinate(
                      row[
                        longitudeColumn
                      ],
                      "longitude"
                    );

                  if (
                    lat === null ||
                    lon === null
                  ) {
                    return null;
                  }

                  return {
                    type: "Feature",

                    id:
                      index + 1,

                    geometry: {
                      type: "Point",

                      coordinates: [
                        lon,
                        lat
                      ]
                    },

                    properties: {
                      ...row
                    }
                  };
                }
              )
              .filter(Boolean);

          if (!features.length) {
            throw new Error(
              `Coordinate columns "${latitudeColumn}" and "${longitudeColumn}" were detected, but no valid coordinate records were found.`
            );
          }

          /*
           * Warn if some rows were invalid,
           * but don't prevent the valid records
           * from being mapped.
           */
          const invalidCount =
            rows.length -
            features.length;

          if (
            invalidCount > 0
          ) {
            console.warn(
              `[Verdant GIS Studio] Ignored ${invalidCount} invalid coordinate rows.`
            );
          }

          /*
           * Add the layer.
           */
          onAddLayer({
            id:
              crypto.randomUUID(),

            name:
              file.name.replace(
                /\.[^/.]+$/,
                ""
              ),

            type: "point",

            sourceType:
              "csv",

            geojson: {
              type:
                "FeatureCollection",

              features
            },

            columns,

            latitudeColumn,

            longitudeColumn,

            featureCount:
              features.length
          });

          console.log(
            "[Verdant GIS Studio] Coordinate detection:",
            {
              latitudeColumn,
              longitudeColumn,
              totalRows:
                rows.length,
              validFeatures:
                features.length,
              invalidRows:
                invalidCount
            }
          );
        } catch (error) {
          window.alert(
            error.message ||
              "Could not read the CSV."
          );
        } finally {
          setProcessing(false);
        }
      },

      error(error) {
        setProcessing(false);

        window.alert(
          error.message ||
            "Could not read the CSV."
        );
      }
    });
  }

  return (
    <section className="studio-panel">
      <div className="studio-panel-heading">
        <div>
          <span className="section-kicker">
            DATA
          </span>

          <h2>
            Add data
          </h2>
        </div>

        <Upload size={19} />
      </div>

      <button
        type="button"
        className="studio-upload-box"
        onClick={() =>
          inputRef.current?.click()
        }
        disabled={processing}
      >
        <Upload size={28} />

        <strong>
          {processing
            ? "Reading data…"
            : "Upload CSV"}
        </strong>

        <span>
          Latitude + longitude
          coordinates
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(event) => {
          handleFile(
            event.target.files?.[0]
          );

          event.target.value = "";
        }}
      />
    </section>
  );
}