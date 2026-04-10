"use client";

import Link from "next/link";

import { useFavoriteEvents } from "../hooks/use-favorite-events";
import { SectionCard } from "./section-card";
import { useAuth } from "./auth-provider";

export function FavoriteEventsClient() {
  const { accessToken, user, isReady } = useAuth();
  const { items, error, pendingEventId, removeFavorite } = useFavoriteEvents(accessToken);

  if (!isReady) {
    return <div>Загрузка избранного...</div>;
  }

  if (!user || !accessToken) {
    return <p className="text-sm text-slate-500">Войдите, чтобы видеть избранные события.</p>;
  }

  return (
    <div className="grid gap-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {items.length ? (
        items.map((event) => (
          <SectionCard
            key={event.id}
            title={event.title}
            eyebrow={`${event.sportType} • ${new Date(event.startsAt).toLocaleDateString("ru-RU")}`}
          >
            <p>{[event.region, event.city, event.venue].filter(Boolean).join(" • ") || "Локация не указана"}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link className="rounded-full bg-coral px-4 py-2 font-semibold text-white" href={`/events/${event.id}`}>
                Открыть событие
              </Link>
              <button
                className="rounded-full border border-ink/10 px-4 py-2 font-semibold text-ink"
                disabled={pendingEventId === event.id}
                onClick={() => removeFavorite(event.id)}
                type="button"
              >
                Убрать из избранного
              </button>
            </div>
          </SectionCard>
        ))
      ) : (
        <SectionCard title="Пока пусто">
          <p>На странице событий нажмите «Участвую» у интересных мероприятий — они появятся здесь.</p>
        </SectionCard>
      )}
    </div>
  );
}
