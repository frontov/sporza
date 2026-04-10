export type UserRole = "user" | "admin";

export type ActivityVisibility = "public" | "followers" | "private";

export type ImportStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "deduplicated";

export type EventParticipationStatus = "interested" | "going";

export interface ProfileSummary {
  id: string;
  username: string;
  fullName: string;
  city?: string | null;
  avatarUrl?: string | null;
  sports: string[];
}

export interface ActivitySummary {
  id: string;
  sportType: string;
  title: string | null;
  startedAt: string;
  durationSeconds: number;
  distanceMeters?: number | null;
  likesCount: number;
  commentsCount: number;
  visibility: ActivityVisibility;
}

export interface EventSummary {
  id: string;
  title: string;
  sportType: string;
  region?: string | null;
  city?: string | null;
  startsAt: string;
  imageUrl?: string | null;
}
