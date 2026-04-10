"use client";

import Link from "next/link";
import { useState } from "react";

import { useEvents } from "../hooks/use-events";
import { FavoriteEventsClient } from "./favorite-events-client";
import { SectionCard } from "./section-card";
import { useAuth } from "./auth-provider";

export function EventsClient() {
  const [tab, setTab] = useState<"all" | "favorites">("all");
  const { accessToken } = useAuth();
  const { items, error, pendingEventId, toggleParticipateGoing, toggleFavorite, page, total, totalPages, setPage } =
    useEvents(accessToken);

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
        </div>
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
      ) : (
        <div className="mt-2">
          <FavoriteEventsClient />
        </div>
      )}
    </main>
  );
}
