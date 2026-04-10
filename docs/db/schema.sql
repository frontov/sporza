CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE activity_visibility AS ENUM ('public', 'followers', 'private');
CREATE TYPE import_status AS ENUM ('queued', 'processing', 'completed', 'failed', 'deduplicated');
CREATE TYPE event_participation_status AS ENUM ('interested', 'going');
CREATE TYPE notification_type AS ENUM (
  'like_created',
  'comment_created',
  'follow_created',
  'import_completed',
  'import_failed'
);

CREATE TYPE external_connection_status AS ENUM ('active', 'revoked', 'error');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  email_verified_at TIMESTAMPTZ,
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username VARCHAR(32) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  avatar_url TEXT,
  city VARCHAR(120),
  bio TEXT,
  sports JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  user_agent TEXT,
  ip_address INET,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_active ON sessions (user_id, expires_at DESC) WHERE revoked_at IS NULL;

CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport_type VARCHAR(50) NOT NULL,
  title VARCHAR(160),
  description TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
  distance_meters NUMERIC(10, 2),
  elevation_gain_meters NUMERIC(10, 2),
  avg_speed_mps NUMERIC(8, 3),
  avg_pace_seconds_per_km INTEGER,
  avg_heart_rate SMALLINT,
  calories INTEGER,
  visibility activity_visibility NOT NULL DEFAULT 'public',
  source_type VARCHAR(30) NOT NULL,
  source_label VARCHAR(100),
  has_route BOOLEAN NOT NULL DEFAULT FALSE,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE activity_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  file_hash_sha256 CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, file_hash_sha256)
);

CREATE TABLE activity_routes (
  activity_id UUID PRIMARY KEY REFERENCES activities(id) ON DELETE CASCADE,
  geom GEOGRAPHY(LINESTRING, 4326),
  bounds JSONB,
  start_point GEOGRAPHY(POINT, 4326),
  end_point GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  storage_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_type VARCHAR(10) NOT NULL,
  file_hash_sha256 CHAR(64) NOT NULL,
  status import_status NOT NULL DEFAULT 'queued',
  error_code VARCHAR(100),
  error_message TEXT,
  duplicate_of_activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE follows (
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE TABLE likes (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, activity_id)
);

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  city VARCHAR(120),
  sport_type VARCHAR(50),
  description TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  members_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE club_members (
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (club_id, user_id)
);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name VARCHAR(50) NOT NULL,
  source_event_id VARCHAR(120) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  sport_type VARCHAR(50) NOT NULL,
  region VARCHAR(120),
  city VARCHAR(120),
  venue VARCHAR(200),
  starts_at TIMESTAMPTZ NOT NULL,
  registration_url TEXT,
  source_url TEXT NOT NULL,
  image_url TEXT,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_name, source_event_id)
);

CREATE TABLE event_participations (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status event_participation_status NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);

CREATE TABLE event_favorites (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE strava_connections (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  athlete_id BIGINT NOT NULL UNIQUE,
  athlete_username VARCHAR(120),
  athlete_full_name VARCHAR(160),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  status external_connection_status NOT NULL DEFAULT 'active',
  last_backfill_started_at TIMESTAMPTZ,
  last_backfill_finished_at TIMESTAMPTZ,
  last_sync_started_at TIMESTAMPTZ,
  last_sync_finished_at TIMESTAMPTZ,
  last_synced_activity_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE event_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activities_user_started_at ON activities (user_id, started_at DESC);
CREATE INDEX idx_activities_created_at ON activities (created_at DESC);
CREATE INDEX idx_import_jobs_user_status ON import_jobs (user_id, status, created_at DESC);
CREATE INDEX idx_comments_activity_created_at ON comments (activity_id, created_at DESC);
CREATE INDEX idx_events_starts_at ON events (starts_at ASC);
CREATE INDEX idx_events_filters ON events (sport_type, region, starts_at ASC);
CREATE INDEX idx_event_favorites_user_created_at ON event_favorites (user_id, created_at DESC);
CREATE INDEX idx_event_sync_runs_created_at ON event_sync_runs (created_at DESC);
CREATE INDEX idx_notifications_user_created_at ON notifications (user_id, created_at DESC);
CREATE INDEX idx_follows_followee ON follows (followee_id, created_at DESC);
CREATE INDEX idx_activity_routes_geom ON activity_routes USING GIST (geom);
CREATE INDEX idx_strava_connections_status_updated_at ON strava_connections (status, updated_at DESC);
