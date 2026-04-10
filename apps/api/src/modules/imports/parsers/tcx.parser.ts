import { asNumber, asString, ensureArray, finalizeParsedActivity, inferSportType, parseXmlDocument, toIsoString } from "./helpers";
import { ParsedActivityData, ParsedRoutePoint } from "./types";

interface TcxRoot {
  TrainingCenterDatabase?: {
    Activities?: {
      Activity?: unknown;
    };
  };
}

export function parseTcxActivity(file: Buffer, originalFilename: string): ParsedActivityData {
  const xml = file.toString("utf8");
  const root = parseXmlDocument<TcxRoot>(xml);
  const activities = ensureArray(root.TrainingCenterDatabase?.Activities?.Activity);
  const activity = (activities[0] as Record<string, unknown> | undefined) ?? {};
  const laps = ensureArray(activity.Lap);
  const routePoints: ParsedRoutePoint[] = [];

  let durationSeconds = 0;
  let distanceMeters: number | null = 0;
  let calories = 0;
  let totalHeartRate = 0;
  let heartRateSamples = 0;
  let elevationGainMeters = 0;
  let previousAltitude: number | null = null;

  for (const lap of laps) {
    if (!lap || typeof lap !== "object") {
      continue;
    }

    const lapRecord = lap as Record<string, unknown>;
    durationSeconds += asNumber(lapRecord.TotalTimeSeconds) ?? 0;
    distanceMeters = (distanceMeters ?? 0) + (asNumber(lapRecord.DistanceMeters) ?? 0);
    calories += asNumber(lapRecord.Calories) ?? 0;

    const tracks = ensureArray(lapRecord.Track);
    for (const track of tracks) {
      if (!track || typeof track !== "object") {
        continue;
      }

      const trackRecord = track as Record<string, unknown>;
      const points = ensureArray(trackRecord.Trackpoint);

      for (const point of points) {
        if (!point || typeof point !== "object") {
          continue;
        }

        const pointRecord = point as Record<string, unknown>;
        const position = pointRecord.Position as Record<string, unknown> | undefined;
        const lat = asNumber(position?.LatitudeDegrees);
        const lon = asNumber(position?.LongitudeDegrees);
        const altitude = asNumber(pointRecord.AltitudeMeters);
        const heartRate = asNumber((pointRecord.HeartRateBpm as Record<string, unknown> | undefined)?.Value);
        const cumulativeDistance = asNumber(pointRecord.DistanceMeters);

        if (lat !== null && lon !== null) {
          routePoints.push({
            lat,
            lon,
            altitude,
            timestamp: toIsoString(pointRecord.Time),
            heartRate,
            distanceMeters: cumulativeDistance,
          });
        }

        if (altitude !== null && previousAltitude !== null) {
          const delta = altitude - previousAltitude;
          if (delta > 0) {
            elevationGainMeters += delta;
          }
        }

        if (altitude !== null) {
          previousAltitude = altitude;
        }

        if (heartRate !== null) {
          totalHeartRate += heartRate;
          heartRateSamples += 1;
        }
      }
    }
  }

  const activitySport = asString(activity.Sport)?.toLowerCase() ?? inferSportType(originalFilename);
  const firstLap = (laps[0] as Record<string, unknown> | undefined) ?? {};

  return finalizeParsedActivity({
    title: originalFilename.replace(/\.[^.]+$/, ""),
    description: "Imported from TCX file.",
    startedAt: toIsoString(activity.Id) ?? toIsoString(firstLap.StartTime),
    durationSeconds,
    distanceMeters,
    elevationGainMeters: elevationGainMeters || null,
    avgHeartRate: heartRateSamples ? Math.round(totalHeartRate / heartRateSamples) : null,
    calories: calories || null,
    sportType: normalizeTcxSport(activitySport),
    mimeType: "application/vnd.garmin.tcx+xml",
    routePoints,
  });
}

function normalizeTcxSport(value: string) {
  const lower = value.toLowerCase();

  if (lower.includes("biking") || lower.includes("cycling")) {
    return "cycling";
  }

  if (lower.includes("swimming")) {
    return "swimming";
  }

  if (lower.includes("walking")) {
    return "walking";
  }

  return "running";
}
