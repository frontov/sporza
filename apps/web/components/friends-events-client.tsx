"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { api, FriendEventItem } from "../lib/api";
import { SectionCard } from "./section-card";
import { useAuth } from "./auth-provider";

export function FriendsEventsClient() {
  const { accessToken, user, isReady } = useAuth();
  const [items, setItems] = useState<FriendEventItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    api
      .getFriendsEvents(accessToken)
      .then((response) => {
        setItems(response.items);
        setError(null);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить события друзей");
      });
  }, [accessToken]);

  if (!isReady) {
    return <div>Загрузка событий друзей...</div>;
  }

  if (!user || !accessToken) {
    return <p className="text-sm text-slate-500">Войдите, чтобы видеть события друзей.</p>;
  }

  return (
    <div className="grid gap-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {items.length ? (
        items.map((event) => (
          <SectionCard
            key={`${event.friend.userId}-${event.id}`}
            title={event.title}
            eyebrow={`${event.sportType} • ${new Date(event.startsAt).toLocaleDateString("ru-RU")}`}
          >
            <p className="text-sm text-slate-600">
              Добавил в избранное:{" "}
              <Link className="font-semibold text-ink hover:text-coral" href={`/profiles/${event.friend.username}`}>
                {event.friend.fullName}
              </Link>
            </p>
            <p className="mt-2">{[event.region, event.city, event.venue].filter(Boolean).join(" • ") || "Локация не указана"}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link className="rounded-full bg-coral px-4 py-2 font-semibold text-white" href={`/events/${event.id}`}>
                Открыть событие
              </Link>
              <Link className="rounded-full border border-ink/10 px-4 py-2 font-semibold text-ink" href={`/profiles/${event.friend.username}`}>
                Открыть профиль друга
              </Link>
            </div>
          </SectionCard>
        ))
      ) : (
        <SectionCard title="Пока пусто">
          <p>Когда ваши подписки начнут добавлять события в избранное, они появятся здесь.</p>
        </SectionCard>
      )}
    </div>
  );
}
