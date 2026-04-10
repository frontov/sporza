"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";

import { api, ActivitiesResponse, Profile } from "../lib/api";
import { useProfileSearch } from "../hooks/use-profile-search";
import { MetricPill } from "./metric-pill";
import { SectionCard } from "./section-card";
import { AuthPanel } from "./auth-panel";
import { useAuth } from "./auth-provider";
import { ConnectionsClient } from "./connections-client";

export function ProfileClient() {
  const { accessToken, isReady, user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activities, setActivities] = useState<ActivitiesResponse["items"]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [regions, setRegions] = useState<string[]>([]);
  const [form, setForm] = useState({
    fullName: "",
    region: "",
    city: "",
    bio: "",
    sports: "",
  });
  const { items: foundProfiles, error: searchError } = useProfileSearch(searchQuery);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    Promise.all([api.getMyProfile(accessToken), api.getMyActivities(accessToken), api.getRegions()])
      .then(([profileResponse, activitiesResponse, regionsResponse]) => {
        setProfile(profileResponse);
        setActivities(activitiesResponse.items);
        setRegions(regionsResponse.items);
        setForm({
          fullName: profileResponse.fullName,
          region: profileResponse.region ?? "",
          city: profileResponse.city ?? "",
          bio: profileResponse.bio ?? "",
          sports: profileResponse.sports.join(", "),
        });
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить профиль");
      });
  }, [accessToken]);

  function onFieldChange(field: "fullName" | "region" | "city" | "bio" | "sports", value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function onSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken || !profile) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updated = await api.updateMyProfile(accessToken, {
        fullName: form.fullName.trim(),
        region: form.region.trim() || null,
        city: form.city.trim() || null,
        bio: form.bio.trim() || null,
        sports: form.sports
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });

      setProfile(updated);
      setForm({
        fullName: updated.fullName,
        region: updated.region ?? "",
        city: updated.city ?? "",
        bio: updated.bio ?? "",
        sports: updated.sports.join(", "),
      });
      setSuccessMessage("Профиль обновлён.");
      setIsEditing(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось обновить профиль");
    } finally {
      setIsSaving(false);
    }
  }

  async function onAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !accessToken) {
      return;
    }

    setIsUploadingAvatar(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updated = await api.uploadMyAvatar(accessToken, file);
      setProfile(updated);
      setSuccessMessage("Фото профиля обновлено.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить фото профиля");
    } finally {
      setIsUploadingAvatar(false);
      event.target.value = "";
    }
  }

  if (!isReady) {
    return <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">Загрузка профиля...</main>;
  }

  if (!user || !accessToken) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <AuthPanel />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <section className="rounded-[32px] bg-white/80 p-6 shadow-[0_20px_60px_rgba(17,42,70,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-coral">Профиль</p>
        <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            {profile?.avatarUrl ? (
              <img
                alt={profile.fullName}
                className="h-20 w-20 rounded-3xl object-cover ring-4 ring-white"
                src={profile.avatarUrl}
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-sky text-2xl font-bold text-ink">
                {(profile?.fullName ?? user.fullName).slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="font-display text-3xl text-ink">{profile?.fullName ?? user.fullName}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {[profile?.region, profile?.city, ...(profile?.sports ?? [])].filter(Boolean).join(" • ") || "Профиль спортсмена"}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <label className="cursor-pointer rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink">
              {isUploadingAvatar ? "Загрузка фото..." : "Загрузить фото"}
              <input accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onAvatarChange} type="file" />
            </label>
            <button
              className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white"
              onClick={() => {
                setIsEditing((current) => !current);
                setSuccessMessage(null);
              }}
              type="button"
            >
              {isEditing ? "Скрыть редактирование" : "Редактировать профиль"}
            </button>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricPill label="Активности" value={String(activities.length)} />
          <MetricPill label="Username" value={profile?.username ?? user.username} />
          <MetricPill label="Спорты" value={String(profile?.sports.length ?? 0)} />
          <MetricPill label="Роль" value={user.role} />
        </div>
      </section>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      {successMessage ? <p className="mt-4 text-sm text-emerald-700">{successMessage}</p> : null}

      {isEditing ? (
        <div className="mt-6">
          <SectionCard title="Редактирование профиля">
            <form className="grid gap-4" onSubmit={onSaveProfile}>
              <input
                className="w-full rounded-2xl border border-ink/10 px-4 py-3"
                onChange={(event) => onFieldChange("fullName", event.target.value)}
                placeholder="Имя"
                value={form.fullName}
              />
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-600">Регион</span>
                <select
                  className="w-full rounded-2xl border border-ink/10 px-4 py-3"
                  onChange={(event) => onFieldChange("region", event.target.value)}
                  value={form.region}
                >
                  <option value="">Не выбран</option>
                  {regions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </label>
              <input
                className="w-full rounded-2xl border border-ink/10 px-4 py-3"
                onChange={(event) => onFieldChange("city", event.target.value)}
                placeholder="Город"
                value={form.city}
              />
              <textarea
                className="min-h-32 w-full rounded-2xl border border-ink/10 px-4 py-3"
                onChange={(event) => onFieldChange("bio", event.target.value)}
                placeholder="Расскажите о себе"
                value={form.bio}
              />
              <input
                className="w-full rounded-2xl border border-ink/10 px-4 py-3"
                onChange={(event) => onFieldChange("sports", event.target.value)}
                placeholder="Любимые виды спорта, через запятую"
                value={form.sports}
              />
              <button
                className="rounded-2xl bg-coral px-4 py-3 font-semibold text-white"
                disabled={isSaving}
                type="submit"
              >
                {isSaving ? "Сохраняем..." : "Сохранить профиль"}
              </button>
            </form>
          </SectionCard>
        </div>
      ) : null}

      <div className="mt-6">
        <SectionCard title="Социальный фокус">
          <p className="text-sm leading-6 text-slate-600">
            В этом MVP акцент сделан на событиях: сохраняйте старты в избранное, смотрите, что выбрали друзья, и обсуждайте
            участие прямо на странице события.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="rounded-full bg-coral px-4 py-3 text-sm font-semibold text-white" href="/events">
              Открыть события
            </Link>
            <Link className="rounded-full border border-ink/10 px-4 py-3 text-sm font-semibold text-ink" href="/imports">
              Импорт тренировок
            </Link>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <SectionCard title="Последние активности">
          {activities.length ? (
            <div className="space-y-3">
              {activities.slice(0, 3).map((activity) => (
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
            <p>После первого успешного импорта здесь появятся активности пользователя.</p>
          )}
        </SectionCard>
        <SectionCard title="О себе">
          <p>{profile?.bio ?? "Пока bio не заполнено."}</p>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title="Поиск пользователей">
          <input
            className="w-full rounded-2xl border border-ink/10 px-4 py-3"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Имя, username или город"
            value={searchQuery}
          />
          {searchError ? <p className="mt-3 text-sm text-red-600">{searchError}</p> : null}
          {searchQuery.trim() ? (
            <div className="mt-4 space-y-3">
              {foundProfiles.length ? (
                foundProfiles.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-sky p-4">
                    <Link className="font-semibold text-ink" href={`/profiles/${item.username}`}>
                      {item.fullName}
                    </Link>
                    <div className="mt-1 text-sm text-slate-600">
                      @{item.username}
                      {item.city ? ` • ${item.city}` : ""}
                    </div>
                    <Link className="mt-3 inline-block text-sm font-semibold text-coral" href={`/profiles/${item.username}`}>
                      Открыть профиль
                    </Link>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">Никого не найдено.</p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Начните вводить запрос, чтобы найти спортсменов.</p>
          )}
        </SectionCard>
      </div>

      <div className="mt-6">
        <ConnectionsClient embedded />
      </div>
    </main>
  );
}
