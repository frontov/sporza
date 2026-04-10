import { XMLParser } from "fast-xml-parser";

import { ParsedActivityData, ParsedRoutePoint } from "./types";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

export function parseXmlDocument<T>(content: string): T {
  return xmlParser.parse(content) as T;
}

export function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function toIsoString(value: unknown): string | null {
  const text = asString(value);

  if (!text) {
    return null;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function inferSportType(originalFilename: string, fallback = "running") {
  const lower = originalFilename.toLowerCase();

  if (lower.includes("ride") || lower.includes("bike") || lower.includes("velo") || lower.includes("cycle")) {
    return "cycling";
  }

  if (lower.includes("swim")) {
    return "swimming";
  }

  if (lower.includes("walk")) {
    return "walking";
  }

  return fallback;
}

export function computeRouteMetrics(points: ParsedRoutePoint[]) {
  if (points.length < 2) {
    return {
      distanceMeters: null,
      elevationGainMeters: null,
      avgHeartRate: computeAverage(points.map((point) => point.heartRate ?? null)),
    };
  }

  let distanceMeters = 0;
  let elevationGainMeters = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];

    const segmentDistance =
      current.distanceMeters !== null && current.distanceMeters !== undefined
        ? Math.max(0, (current.distanceMeters ?? 0) - (previous.distanceMeters ?? 0))
        : haversineMeters(previous.lat, previous.lon, current.lat, current.lon);

    distanceMeters += segmentDistance;

    if (previous.altitude !== null && previous.altitude !== undefined && current.altitude !== null && current.altitude !== undefined) {
      const deltaAltitude = current.altitude - previous.altitude;
      if (deltaAltitude > 0) {
        elevationGainMeters += deltaAltitude;
      }
    }
  }

  return {
    distanceMeters,
    elevationGainMeters,
    avgHeartRate: computeAverage(points.map((point) => point.heartRate ?? null)),
  };
}

export function finalizeParsedActivity(input: {
  title: string;
  description: string;
  startedAt: string | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  elevationGainMeters: number | null;
  avgHeartRate: number | null;
  calories: number | null;
  sportType: string;
  mimeType: string;
  routePoints: ParsedRoutePoint[];
}): ParsedActivityData {
  const routeMetrics = computeRouteMetrics(input.routePoints);
  const durationSecondsRaw =
    input.durationSeconds && input.durationSeconds > 0 ? input.durationSeconds : deriveDurationFromPoints(input.routePoints);
  const durationSeconds = roundNullableInteger(durationSecondsRaw) ?? 0;
  const distanceMeters = input.distanceMeters ?? routeMetrics.distanceMeters;
  const elevationGainMeters = input.elevationGainMeters ?? routeMetrics.elevationGainMeters;
  const avgHeartRate = roundNullableInteger(input.avgHeartRate ?? routeMetrics.avgHeartRate);
  const avgSpeedMps = durationSeconds && distanceMeters ? distanceMeters / durationSeconds : null;
  const avgPaceSecondsPerKm =
    avgSpeedMps && avgSpeedMps > 0 && ["running", "walking", "trail"].includes(input.sportType)
      ? Math.round(1000 / avgSpeedMps)
      : null;

  return {
    title: input.title,
    description: input.description,
    startedAt: input.startedAt ?? deriveStartTimeFromPoints(input.routePoints) ?? new Date().toISOString(),
    durationSeconds,
    distanceMeters,
    elevationGainMeters,
    avgSpeedMps,
    avgPaceSecondsPerKm,
    avgHeartRate,
    calories: roundNullableInteger(input.calories),
    sportType: input.sportType,
    mimeType: input.mimeType,
    routePoints: input.routePoints,
  };
}

function roundNullableInteger(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadius = 6371000;
  const dLat = degreesToRadians(lat2 - lat1);
  const dLon = degreesToRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function computeAverage(values: Array<number | null>) {
  const filtered = values.filter((value): value is number => value !== null && Number.isFinite(value));

  if (!filtered.length) {
    return null;
  }

  return Math.round(filtered.reduce((sum, value) => sum + value, 0) / filtered.length);
}

function deriveDurationFromPoints(points: ParsedRoutePoint[]) {
  const start = deriveStartTimeFromPoints(points);
  const end = deriveEndTimeFromPoints(points);

  if (!start || !end) {
    return 0;
  }

  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
}

function deriveStartTimeFromPoints(points: ParsedRoutePoint[]) {
  return points.find((point) => point.timestamp)?.timestamp ?? null;
}

function deriveEndTimeFromPoints(points: ParsedRoutePoint[]) {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index].timestamp) {
      return points[index].timestamp;
    }
  }

  return null;
}
