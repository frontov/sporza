export interface ParsedRoutePoint {
  lat: number;
  lon: number;
  altitude?: number | null;
  heartRate?: number | null;
  timestamp?: string | null;
  distanceMeters?: number | null;
}

export interface ParsedActivityData {
  title: string;
  description: string;
  startedAt: string;
  durationSeconds: number;
  distanceMeters: number | null;
  elevationGainMeters: number | null;
  avgSpeedMps: number | null;
  avgPaceSecondsPerKm: number | null;
  avgHeartRate: number | null;
  calories: number | null;
  sportType: string;
  mimeType: string;
  routePoints: ParsedRoutePoint[];
}
