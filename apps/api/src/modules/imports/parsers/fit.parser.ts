import FitParser from "fit-file-parser";
import type { ParsedFit, ParsedRecord, ParsedSession } from "fit-file-parser/dist/fit_types.js";

import { finalizeParsedActivity, inferSportType } from "./helpers";
import { ParsedActivityData, ParsedRoutePoint } from "./types";

export async function parseFitActivity(file: Buffer, originalFilename: string): Promise<ParsedActivityData> {
  const parser = new FitParser({
    force: true,
    speedUnit: "m/s",
    lengthUnit: "m",
    elapsedRecordField: true,
    mode: "both",
  });

  const parsed = await parser.parseAsync(toArrayBuffer(file));
  const session = parsed.sessions?.[0];
  const records = resolveRecords(parsed, session);
  const routePoints = records
    .filter((record) => typeof record.position_lat === "number" && typeof record.position_long === "number")
    .map<ParsedRoutePoint>((record) => ({
      lat: record.position_lat as number,
      lon: record.position_long as number,
      altitude: record.altitude ?? record.enhanced_altitude ?? null,
      timestamp: record.timestamp ?? null,
      heartRate: record.heart_rate ?? null,
      distanceMeters: record.distance ?? null,
    }));

  const sportType = normalizeFitSport(session?.sport ?? inferSportType(originalFilename));

  return finalizeParsedActivity({
    title: originalFilename.replace(/\.[^.]+$/, ""),
    description: "Imported from FIT file.",
    startedAt: session?.start_time ?? records[0]?.timestamp ?? null,
    durationSeconds: roundNumber(session?.total_timer_time) ?? roundNumber(session?.total_elapsed_time) ?? null,
    distanceMeters: session?.total_distance ?? records[records.length - 1]?.distance ?? null,
    elevationGainMeters: session?.total_ascent ?? null,
    avgHeartRate: session?.avg_heart_rate ?? averageHeartRate(records),
    calories: session?.total_calories ?? null,
    sportType,
    mimeType: "application/octet-stream",
    routePoints,
  });
}

function resolveRecords(parsed: ParsedFit, session?: ParsedSession) {
  return (parsed.records ?? []) as ParsedRecord[];
}

function normalizeFitSport(value: string) {
  const lower = value.toLowerCase();

  if (lower.includes("cycling") || lower.includes("bike")) {
    return "cycling";
  }

  if (lower.includes("swimming")) {
    return "swimming";
  }

  if (lower.includes("walking") || lower.includes("hiking")) {
    return "walking";
  }

  if (lower.includes("rowing")) {
    return "rowing";
  }

  return "running";
}

function averageHeartRate(records: ParsedRecord[]) {
  const values = records
    .map((record) => record.heart_rate ?? null)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (!values.length) {
    return null;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function roundNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function toArrayBuffer(buffer: Buffer) {
  return new Uint8Array(buffer).buffer as ArrayBuffer;
}
