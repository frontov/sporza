"use client";

import Link from "next/link";

import { usePublicProfile } from "../hooks/use-public-profile";
import { useAuth } from "./auth-provider";
import { MetricPill } from "./metric-pill";
import { SectionCard } from "./section-card";

interface PublicProfileClientProps {
  username: string;
}

export function PublicProfileClient({ username }: PublicProfileClientProps) {
  const { accessToken, user } = useAuth();
  const { profile, error, isPendingFollow, toggleFollow } = usePublicProfile(username, accessToken);

  if (error) {
    return <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{error}</main>;
  }

  if (!profile) {
    return <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">Загрузка профиля пользователя...</main>;
  }

  const isOwnProfile = user?.username === profile.username;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <section className="rounded-[32px] bg-white/80 p-6 shadow-[0_20px_60px_rgba(17,42,70,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-coral">Athlete Profile</p>
        <h1 className="mt-3 font-display text-3xl text-ink">{profile.fullName}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          @{profile.username}
          {profile.city ? ` • ${profile.city}` : ""}
          {profile.sports.length ? ` • ${profile.sports.join(", ")}` : ""}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricPill label="Активности" value={String(profile.activities.length)} />
          <MetricPill label="Username" value={profile.username} />
          <MetricPill label="Город" value={profile.city ?? "n/a"} />
          <MetricPill label="Спорты" value={String(profile.sports.length)} />
        </div>
        {!isOwnProfile ? (
          <div className="mt-6">
            <button
              className={`rounded-full px-5 py-3 text-sm font-semibold ${
                profile.isFollowedByMe ? "bg-ink text-white" : "bg-coral text-white"
              }`}
              disabled={isPendingFollow || !accessToken}
              onClick={toggleFollow}
              type="button"
            >
              {profile.isFollowedByMe ? "Отписаться" : "Подписаться"}
            </button>
            {!accessToken ? <p className="mt-3 text-sm text-slate-500">Войдите, чтобы подписаться на спортсмена.</p> : null}
          </div>
        ) : null}
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="Публичные активности">
          {profile.activities.length ? (
            <div className="space-y-3">
              {profile.activities.map((activity) => (
                <div key={activity.id} className="rounded-2xl bg-sky p-4">
                  <div className="font-semibold text-ink">{activity.title ?? activity.sportType}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {new Date(activity.startedAt).toLocaleString("ru-RU")} • {activity.distanceMeters ?? 0} м
                  </div>
                  <Link className="mt-3 inline-block text-sm font-semibold text-coral" href={`/activities/${activity.id}`}>
                    Открыть активность
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p>У пользователя пока нет публичных активностей.</p>
          )}
        </SectionCard>
        <SectionCard title="О спортсмене">
          <p>{profile.bio ?? "Пользователь пока не заполнил bio."}</p>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title="События пользователя">
          {profile.events.length ? (
            <div className="space-y-3">
              {profile.events.map((event) => (
                <div key={event.id} className="rounded-2xl bg-sky p-4">
                  <div className="font-semibold text-ink">{event.title}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {new Date(event.startsAt).toLocaleDateString("ru-RU")} • {[event.region, event.city].filter(Boolean).join(" • ")}
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    {event.participationStatus === "going"
                      ? "Участвует"
                      : event.participationStatus === "interested"
                        ? "Интересуется"
                        : event.isFavorite
                          ? "Сохранил в избранное"
                          : "Событие добавлено"}
                  </div>
                  <Link className="mt-3 inline-block text-sm font-semibold text-coral" href={`/events/${event.id}`}>
                    Открыть событие
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p>Пользователь пока не добавлял события.</p>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
