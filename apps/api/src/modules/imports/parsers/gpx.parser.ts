import { asNumber, asString, ensureArray, finalizeParsedActivity, inferSportType, parseXmlDocument, toIsoString } from "./helpers";
import { ParsedActivityData, ParsedRoutePoint } from "./types";

interface GpxRoot {
  gpx?: {
    metadata?: {
      time?: string;
      name?: string;
    };
    trk?: unknown;
  };
}

export function parseGpxActivity(file: Buffer, originalFilename: string): ParsedActivityData {
  const xml = file.toString("utf8");
  const root = parseXmlDocument<GpxRoot>(xml);
  const gpx = root.gpx;
  const tracks = ensureArray(gpx?.trk);
  const routePoints: ParsedRoutePoint[] = [];

  for (const track of tracks) {
    if (!track || typeof track !== "object") {
      continue;
    }

    const trackRecord = track as Record<string, unknown>;
    const segments = ensureArray(trackRecord.trkseg);

    for (const segment of segments) {
      if (!segment || typeof segment !== "object") {
        continue;
      }

      const segmentRecord = segment as Record<string, unknown>;
      const points = ensureArray(segmentRecord.trkpt);

      for (const point of points) {
        if (!point || typeof point !== "object") {
          continue;
        }

        const pointRecord = point as Record<string, unknown>;
        const extensions = pointRecord.extensions as Record<string, unknown> | undefined;
        const trackPointExtension =
          (extensions?.TrackPointExtension as Record<string, unknown> | undefined) ??
          (extensions?.gpxtpxTrackPointExtension as Record<string, unknown> | undefined);

        const lat = asNumber(pointRecord.lat);
        const lon = asNumber(pointRecord.lon);

        if (lat === null || lon === null) {
          continue;
        }

        routePoints.push({
          lat,
          lon,
          altitude: asNumber(pointRecord.ele),
          timestamp: toIsoString(pointRecord.time),
          heartRate:
            asNumber(trackPointExtension?.hr) ??
            asNumber(trackPointExtension?.heartrate) ??
            asNumber(extensions?.hr),
          distanceMeters: null,
        });
      }
    }
  }

  const firstTrack = tracks[0] as Record<string, unknown> | undefined;
  const title = asString(firstTrack?.name) ?? asString(gpx?.metadata?.name) ?? originalFilename.replace(/\.[^.]+$/, "");

  return finalizeParsedActivity({
    title,
    description: "Imported from GPX file.",
    startedAt: toIsoString(gpx?.metadata?.time),
    durationSeconds: null,
    distanceMeters: null,
    elevationGainMeters: null,
    avgHeartRate: null,
    calories: null,
    sportType: inferSportType(originalFilename),
    mimeType: "application/gpx+xml",
    routePoints,
  });
}
