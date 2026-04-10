"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { api, Activity } from "../lib/api";
import { AuthPanel } from "./auth-panel";
import { SectionCard } from "./section-card";
import { useAuth } from "./auth-provider";

export function FeedClient() {
  const { accessToken, isReady, user } = useAuth();
  const [items, setItems] = useState<Activity[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    api
      .getFeed(accessToken)
      .then((response) => setItems(response.items))
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить ленту");
      });
  }, [accessToken]);

  if (!isReady) {
    return <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">Загрузка ленты...</main>;
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
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-coral">Feed MVP</p>
        <h1 className="mt-3 font-display text-3xl text-ink">Лента активностей</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Здесь ваши тренировки и публичные активности (и для подписчиков — «только подписчики») людей, на которых вы подписаны.
        </p>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <div className="space-y-4">
        {items.length ? (
          items.map((item) => (
            <SectionCard
              key={item.id}
              title={item.title ?? item.sportType}
              eyebrow={item.authorUsername ? `@${item.authorUsername} · ${item.sportType}` : item.sportType}
            >
              <p>
                {new Date(item.startedAt).toLocaleString("ru-RU")} • {item.distanceMeters ?? 0} м • {item.durationSeconds} сек
              </p>
              <div className="mt-4 flex gap-3 text-sm text-slate-500">
                <span>{item.likesCount} лайков</span>
                <span>{item.commentsCount} комментариев</span>
              </div>
              <Link className="mt-4 inline-block text-sm font-semibold text-coral" href={`/activities/${item.id}`}>
                Открыть активность
              </Link>
            </SectionCard>
          ))
        ) : (
          <SectionCard title="Лента пока пустая">
            <p>
              Добавьте тренировку на странице импорта или подпишитесь на спортсменов — их публичные активности появятся здесь.
            </p>
          </SectionCard>
        )}
      </div>
    </main>
  );
}
