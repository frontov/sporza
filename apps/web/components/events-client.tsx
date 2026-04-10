"use client";

import Link from "next/link";
import { useState } from "react";

import { EventsFilterState, useEvents } from "../hooks/use-events";
import { FavoriteEventsClient } from "./favorite-events-client";
import { FriendsEventsClient } from "./friends-events-client";
import { SectionCard } from "./section-card";
import { useAuth } from "./auth-provider";

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function EventsClient() {
  const [tab, setTab] = useState<"all" | "favorites" | "friends">("all");
  const { accessToken } = useAuth();
  const {
    items,
    error,
    pendingEventId,
    toggleParticipateGoing,
    toggleFavorite,
    page,
    total,
    totalPages,
    sort,
    filters,
    availableRegions,
    availableCities,
    popularCities,
    availableCategories,
    setPage,
    setSort,
    setFilters,
    resetFilters,
  } = useEvents(accessToken);

  function updateFilters(patch: Partial<EventsFilterState>) {
    setFilters({
      ...filters,
      ...patch,
    });
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-coral">События</p>
        <h1 className="mt-3 font-display text-2xl text-ink sm:text-3xl">Реальные спортивные события</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Сохраняйте события в избранное, смотрите, что выбрали ваши друзья, и переходите в обсуждение конкретного старта.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
              tab === "all" ? "bg-coral text-white" : "border border-ink/10 bg-white text-ink"
            }`}
            onClick={() => setTab("all")}
            type="button"
          >
            Все
          </button>
          <button
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
              tab === "favorites" ? "bg-coral text-white" : "border border-ink/10 bg-white text-ink"
            }`}
            onClick={() => setTab("favorites")}
            type="button"
          >
            Избранные
          </button>
          <button
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
              tab === "friends" ? "bg-coral text-white" : "border border-ink/10 bg-white text-ink"
            }`}
            onClick={() => setTab("friends")}
            type="button"
          >
            События друзей
          </button>
        </div>
        {tab === "all" ? (
          <SectionCard className="mt-4" title="Фильтры" eyebrow="Поиск мероприятий">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Поиск</span>
                <input
                  className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-coral/60"
                  onChange={(event) => updateFilters({ q: event.target.value })}
                  placeholder="Название, город, площадка"
                  value={filters.q}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Регион</span>
                  <select
                    className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-coral/60"
                    onChange={(event) => updateFilters({ region: event.target.value, cities: [] })}
                    value={filters.region}
                  >
                    <option value="">Все регионы</option>
                    {availableRegions.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Дата от</span>
                  <input
                    className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-coral/60"
                    onChange={(event) => updateFilters({ dateFrom: event.target.value })}
                    type="date"
                    value={filters.dateFrom}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Дата до</span>
                  <input
                    className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-coral/60"
                    onChange={(event) => updateFilters({ dateTo: event.target.value })}
                    type="date"
                    value={filters.dateTo}
                  />
                </label>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  sort === "date_asc" ? "bg-ink text-white" : "border border-ink/10 bg-white text-ink"
                }`}
                onClick={() => setSort("date_asc")}
                type="button"
              >
                По дате
              </button>
              <button
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  sort === "popular" ? "bg-ink text-white" : "border border-ink/10 bg-white text-ink"
                }`}
                onClick={() => setSort("popular")}
                type="button"
              >
                Популярные
              </button>
              <button
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  filters.includePast ? "bg-coral text-white" : "border border-ink/10 bg-white text-ink"
                }`}
                onClick={() => updateFilters({ includePast: !filters.includePast })}
                type="button"
              >
                {filters.includePast ? "С прошедшими" : "Только ближайшие"}
              </button>
              <button
                className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-coral/40"
                onClick={resetFilters}
                type="button"
              >
                Сбросить
              </button>
            </div>

            {popularCities.length > 0 ? (
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Популярные города</p>
                <div className="flex flex-wrap gap-2">
                  {popularCities.map((city) => (
                    <button
                      key={city}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        filters.cities.includes(city) ? "bg-coral text-white" : "border border-ink/10 bg-white text-ink"
                      }`}
                      onClick={() => updateFilters({ cities: toggleValue(filters.cities, city) })}
                      type="button"
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {availableCategories.length > 0 ? (
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Виды событий</p>
                <div className="flex flex-wrap gap-2">
                  {availableCategories.map((category) => (
                    <button
                      key={category}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        filters.categories.includes(category)
                          ? "bg-mint text-ink"
                          : "border border-ink/10 bg-white text-ink"
                      }`}
                      onClick={() => updateFilters({ categories: toggleValue(filters.categories, category) })}
                      type="button"
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {availableCities.length > 0 ? (
              <label className="mt-5 block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Город</span>
                <select
                  className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-coral/60"
                  onChange={(event) => {
                    const value = event.target.value;
                    updateFilters({ cities: value ? [value] : [] });
                  }}
                  value={filters.cities[0] ?? ""}
                >
                  <option value="">Все города</option>
                  {availableCities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </SectionCard>
        ) : null}
        {tab === "all" ? <p className="mt-2 text-sm text-slate-500">Всего событий: {total}</p> : null}
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {tab === "all" ? (
        <>
          <div className="grid gap-4">
            {items.map((event) => (
              <SectionCard
                key={event.id}
                title={
                  <Link className="text-ink hover:text-coral" href={`/events/${event.id}`}>
                    {event.title}
                  </Link>
                }
                eyebrow={`${event.sportType} • ${new Date(event.startsAt).toLocaleDateString("ru-RU")}`}
              >
                <p className="text-slate-700">{[event.region, event.city].filter(Boolean).join(" • ") || "Локация уточняется"}</p>
                {event.category ? <p className="mt-2 text-sm text-slate-500">{event.category}</p> : null}
                <p className="mt-2 text-sm text-slate-500">Сохранили в избранное: {event.favoritesCount}</p>
                {event.favoriteFriendsCount > 0 ? (
                  <p className="mt-3 text-sm text-slate-600">
                    Уже в избранном у друзей: {event.favoriteFriends.map((friend) => friend.fullName).join(", ")}
                    {event.favoriteFriendsCount > event.favoriteFriends.length
                      ? ` и ещё ${event.favoriteFriendsCount - event.favoriteFriends.length}`
                      : ""}
                  </p>
                ) : null}
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <button
                    className={`w-full rounded-full px-5 py-3 text-sm font-semibold sm:w-auto ${
                      event.isFavorite ? "bg-ink text-white" : "border border-ink/15 bg-white text-ink"
                    }`}
                    disabled={pendingEventId === event.id || !accessToken}
                    onClick={() => toggleFavorite(event.id)}
                    type="button"
                  >
                    {event.isFavorite ? "В избранном" : "В избранное"}
                  </button>
                  <button
                    className={`w-full rounded-full px-5 py-3 text-sm font-semibold sm:w-auto ${
                      event.participationStatus === "going" ? "bg-coral text-white" : "bg-mint text-ink"
                    }`}
                    disabled={pendingEventId === event.id || !accessToken}
                    onClick={() => toggleParticipateGoing(event.id)}
                    type="button"
                  >
                    {event.participationStatus === "going" ? "Участвую ✓" : "Участвую"}
                  </button>
                  <Link
                    className="w-full rounded-full border border-ink/15 px-5 py-3 text-center text-sm font-semibold text-ink hover:border-coral/50 sm:w-auto"
                    href={`/events/${event.id}`}
                  >
                    Открыть и обсудить
                  </Link>
                  {!accessToken ? <span className="text-sm text-slate-500">Войдите, чтобы сохранять события и отмечать участие</span> : null}
                </div>
              </SectionCard>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Страница {page} из {totalPages}
            </p>
            <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto">
              <button
                className="rounded-full border border-ink/15 px-5 py-3 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                type="button"
              >
                Назад
              </button>
              <button
                className="rounded-full border border-ink/15 px-5 py-3 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                type="button"
              >
                Вперёд
              </button>
            </div>
          </div>
        </>
      ) : tab === "favorites" ? (
        <div className="mt-2">
          <FavoriteEventsClient />
        </div>
      ) : (
        <div className="mt-2">
          <FriendsEventsClient />
        </div>
      )}
    </main>
  );
}
