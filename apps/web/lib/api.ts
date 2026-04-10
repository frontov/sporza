export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: "user" | "admin";
}

export interface AuthResponse extends AuthTokens {
  user: AuthUser;
}

export interface Profile {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  city: string | null;
  bio: string | null;
  sports: string[];
}

export interface ProfileSearchResponse {
  items: Profile[];
}

export interface FollowListItem {
  userId: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface FollowListResponse {
  items: FollowListItem[];
}

export interface PublicProfile extends Profile {
  isFollowedByMe: boolean;
  activities: Activity[];
  events: EventItem[];
}

export interface Activity {
  id: string;
  userId: string;
  sportType: string;
  title: string | null;
  startedAt: string;
  durationSeconds: number;
  distanceMeters: number | null;
  elevationGainMeters: number | null;
  avgHeartRate: number | null;
  calories: number | null;
  visibility: "public" | "followers" | "private";
  likesCount: number;
  commentsCount: number;
  /** Present in home feed responses when joined from profiles */
  authorUsername?: string;
}

export interface ActivityRoutePoint {
  lat: number;
  lon: number;
}

export interface ActivityDetail extends Activity {
  description: string | null;
  avgSpeedMps: number | null;
  avgPaceSecondsPerKm: number | null;
  sourceType: string | null;
  sourceLabel: string | null;
  hasRoute: boolean;
  likedByMe: boolean;
  route: {
    bounds: {
      minLat: number;
      maxLat: number;
      minLon: number;
      maxLon: number;
    } | null;
    points: ActivityRoutePoint[];
  } | null;
}

export interface ActivityComment {
  id: string;
  userId: string;
  body: string;
  createdAt: string;
}

export interface ActivitiesResponse {
  items: Activity[];
  nextCursor: string | null;
}

export interface ImportJob {
  id: string;
  status: string;
  duplicateOfActivityId: string | null;
  activityId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  originalFilename: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  sportType: string;
  region: string | null;
  city: string | null;
  venue: string | null;
  startsAt: string;
  registrationUrl: string | null;
  sourceUrl: string;
  imageUrl: string | null;
  sourceName: string;
  sourceEventId: string;
  participationStatus: "interested" | "going" | null;
  isFavorite: boolean;
  favoritesCount: number;
  favoriteFriends: FavoriteFriend[];
  favoriteFriendsCount: number;
}

export interface FavoriteFriend {
  userId: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface EventChatMessage {
  id: string;
  eventId: string;
  userId: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  body: string;
  createdAt: string;
}

export interface EventsResponse {
  items: EventItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface FriendEventItem extends EventItem {
  friend: FavoriteFriend;
}

export interface StravaConnection {
  athleteId: number;
  athleteUsername: string | null;
  athleteFullName: string | null;
  status: "active" | "revoked" | "error";
  tokenExpiresAt: string;
  lastBackfillStartedAt: string | null;
  lastBackfillFinishedAt: string | null;
  lastSyncStartedAt: string | null;
  lastSyncFinishedAt: string | null;
  lastSyncedActivityAt: string | null;
  lastError: string | null;
}

export interface StravaStatusResponse {
  connected: boolean;
  connection: StravaConnection | null;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if ("message" in payload) {
    const message = (payload as { message?: unknown }).message;

    if (typeof message === "string" && message.trim()) {
      return message;
    }

    if (Array.isArray(message)) {
      const firstString = message.find((item) => typeof item === "string" && item.trim());
      if (typeof firstString === "string") {
        return firstString;
      }
    }
  }

  if ("error" in payload) {
    const error = (payload as { error?: unknown }).error;

    if (typeof error === "string" && error.trim()) {
      return error;
    }
  }

  return null;
}

function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    const hostname = window.location.hostname;

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:4000";
    }

    return window.location.origin.replace(/\/$/, "");
  }

  return "http://localhost:4000";
}

async function request<T>(path: string, init?: RequestInit, accessToken?: string): Promise<T> {
  const hasBody = init?.body !== undefined && init.body !== null;
  const response = await fetch(`${getApiBaseUrl()}/v1${path}`, {
    ...init,
    headers: {
      ...(hasBody && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let message: string | null = null;
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      try {
        const payload = (await response.json()) as unknown;
        message = extractErrorMessage(payload);
      } catch {
        message = null;
      }
    } else {
      try {
        const text = await response.text();
        message = text.trim() || null;
      } catch {
        message = null;
      }
    }

    throw new Error(message ?? `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  register(payload: { email: string; password: string; username: string; fullName: string }) {
    return request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  login(payload: { email: string; password: string }) {
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  refresh(refreshToken: string) {
    return request<AuthResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  },
  getMyProfile(accessToken: string) {
    return request<Profile>("/profile/me", undefined, accessToken);
  },
  getStravaStatus(accessToken: string) {
    return request<StravaStatusResponse>("/strava/status", undefined, accessToken);
  },
  getStravaConnectUrl(accessToken: string) {
    return request<{ connectUrl: string; state: string }>(
      "/strava/connect-url",
      {
        method: "POST",
      },
      accessToken,
    );
  },
  connectStrava(accessToken: string, payload: { code: string; state: string }) {
    return request<{ connected: boolean; backgroundSyncStarted: boolean }>(
      "/strava/connect",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      accessToken,
    );
  },
  syncStrava(accessToken: string) {
    return request<{ enqueued: boolean }>(
      "/strava/sync",
      {
        method: "POST",
      },
      accessToken,
    );
  },
  disconnectStrava(accessToken: string) {
    return request<{ disconnected: boolean }>(
      "/strava/disconnect",
      {
        method: "DELETE",
      },
      accessToken,
    );
  },
  updateMyProfile(
    accessToken: string,
    payload: {
      fullName?: string;
      city?: string | null;
      bio?: string | null;
      sports?: string[];
    },
  ) {
    return request<Profile>(
      "/profile/me",
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
      accessToken,
    );
  },
  uploadMyAvatar(accessToken: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    return request<Profile>(
      "/profile/me/avatar",
      {
        method: "POST",
        body,
      },
      accessToken,
    );
  },
  searchProfiles(query: string) {
    const params = new URLSearchParams();
    params.set("query", query);
    return request<ProfileSearchResponse>(`/profiles?${params.toString()}`);
  },
  getPublicProfile(username: string, accessToken?: string) {
    return request<PublicProfile>(`/profiles/${encodeURIComponent(username)}`, undefined, accessToken);
  },
  getMyActivities(accessToken: string, cursor?: string) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return request<ActivitiesResponse>(`/activities${query}`, undefined, accessToken);
  },
  getFeed(accessToken: string, cursor?: string) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return request<ActivitiesResponse>(`/feed${query}`, undefined, accessToken);
  },
  getActivity(activityId: string, accessToken?: string) {
    return request<ActivityDetail>(`/activities/${activityId}`, undefined, accessToken);
  },
  likeActivity(accessToken: string, activityId: string) {
    return request<{ activityId: string; liked: boolean }>(
      `/activities/${activityId}/likes`,
      { method: "POST" },
      accessToken,
    );
  },
  followUser(accessToken: string, userId: string) {
    return request<{ userId: string; following: boolean }>(
      `/follows/${userId}`,
      { method: "POST" },
      accessToken,
    );
  },
  unfollowUser(accessToken: string, userId: string) {
    return request<{ userId: string; following: boolean }>(
      `/follows/${userId}`,
      { method: "DELETE" },
      accessToken,
    );
  },
  getFollowing(accessToken: string) {
    return request<FollowListResponse>("/follows/following", undefined, accessToken);
  },
  getFollowers(accessToken: string) {
    return request<FollowListResponse>("/follows/followers", undefined, accessToken);
  },
  unlikeActivity(accessToken: string, activityId: string) {
    return request<{ activityId: string; liked: boolean }>(
      `/activities/${activityId}/likes`,
      { method: "DELETE" },
      accessToken,
    );
  },
  getActivityComments(activityId: string, accessToken?: string) {
    return request<{ items: ActivityComment[] }>(`/activities/${activityId}/comments`, undefined, accessToken);
  },
  createActivityComment(accessToken: string, activityId: string, body: string) {
    return request<ActivityComment>(
      `/activities/${activityId}/comments`,
      {
        method: "POST",
        body: JSON.stringify({ body }),
      },
      accessToken,
    );
  },
  uploadImport(accessToken: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    return request<ImportJob>(
      "/imports",
      {
        method: "POST",
        body,
      },
      accessToken,
    );
  },
  getImportJob(accessToken: string, jobId: string) {
    return request<ImportJob>(`/imports/${jobId}`, undefined, accessToken);
  },
  getImportJobs(accessToken: string) {
    return request<{ items: ImportJob[] }>("/imports", undefined, accessToken);
  },
  getEvents(
    filters?: { sport?: string; region?: string; sort?: "date_asc" | "popular"; page?: number; pageSize?: number },
    accessToken?: string,
  ) {
    const params = new URLSearchParams();
    if (filters?.sport) params.set("sport", filters.sport);
    if (filters?.region) params.set("region", filters.region);
    if (filters?.sort) params.set("sort", filters.sort);
    if (filters?.page) params.set("page", String(filters.page));
    if (filters?.pageSize) params.set("pageSize", String(filters.pageSize));
    const query = params.size ? `?${params.toString()}` : "";
    return request<EventsResponse>(`/events${query}`, undefined, accessToken);
  },
  getFavoriteEvents(accessToken: string) {
    return request<{ items: EventItem[] }>("/events/favorites", undefined, accessToken);
  },
  getFriendsEvents(accessToken: string) {
    return request<{ items: FriendEventItem[] }>("/events/friends", undefined, accessToken);
  },
  getEvent(eventId: string, accessToken?: string) {
    return request<EventItem>(`/events/${eventId}`, undefined, accessToken);
  },
  getEventChat(eventId: string, accessToken?: string) {
    return request<{ items: EventChatMessage[] }>(`/events/${eventId}/chat`, undefined, accessToken);
  },
  createEventChatMessage(accessToken: string, eventId: string, body: string) {
    return request<EventChatMessage>(
      `/events/${eventId}/chat`,
      {
        method: "POST",
        body: JSON.stringify({ body }),
      },
      accessToken,
    );
  },
  addFavoriteEvent(accessToken: string, eventId: string) {
    return request<{ userId: string; eventId: string; isFavorite: boolean }>(
      `/events/${eventId}/favorite`,
      {
        method: "PUT",
      },
      accessToken,
    );
  },
  removeFavoriteEvent(accessToken: string, eventId: string) {
    return request<{ userId: string; eventId: string; isFavorite: boolean }>(
      `/events/${eventId}/favorite`,
      {
        method: "DELETE",
      },
      accessToken,
    );
  },
  setEventParticipation(accessToken: string, eventId: string, status: "interested" | "going") {
    return request<{ userId: string; eventId: string; status: string }>(
      `/events/${eventId}/participation`,
      {
        method: "PUT",
        body: JSON.stringify({ status }),
      },
      accessToken,
    );
  },
  removeEventParticipation(accessToken: string, eventId: string) {
    return request<void>(
      `/events/${eventId}/participation`,
      {
        method: "DELETE",
      },
      accessToken,
    );
  },
};
