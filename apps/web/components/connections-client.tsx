"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { api, FollowListItem } from "../lib/api";
import { AuthPanel } from "./auth-panel";
import { SectionCard } from "./section-card";
import { useAuth } from "./auth-provider";

type Tab = "following" | "followers";

interface ConnectionsClientProps {
  embedded?: boolean;
}

export function ConnectionsClient({ embedded = false }: ConnectionsClientProps) {
  const { accessToken, isReady, user } = useAuth();
  const [tab, setTab] = useState<Tab>("following");
  const [following, setFollowing] = useState<FollowListItem[]>([]);
  const [followers, setFollowers] = useState<FollowListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all([api.getFollowing(accessToken), api.getFollowers(accessToken)])
      .then(([followingRes, followersRes]) => {
        setFollowing(followingRes.items);
        setFollowers(followersRes.items);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить списки");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [accessToken]);

  if (!isReady) {
    return <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">Загрузка...</main>;
  }

  if (!user || !accessToken) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <AuthPanel />
      </main>
    );
  }

  const items = tab === "following" ? following : followers;
  const emptyHint =
    tab === "following"
      ? "Вы ещё ни на кого не подписаны. Откройте профиль спортсмена и нажмите «Подписаться»."
      : "Пока никто не подписался. Поделитесь профилем или активностями.";

  const content = (
    <>
      {!embedded ? (
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-coral">Социальные связи</p>
          <h1 className="mt-3 font-display text-3xl text-ink">Подписки и подписчики</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Кого вы читаете и кто читает вас. Переходите в профиль по клику на имя.
          </p>
        </div>
      ) : null}

      <div className={`${embedded ? "mb-4" : "mb-6"} flex flex-wrap gap-2`}>
        <button
          className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            tab === "following" ? "bg-coral text-white" : "border border-ink/10 bg-white text-ink"
          }`}
          onClick={() => setTab("following")}
          type="button"
        >
          Подписки ({following.length})
        </button>
        <button
          className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            tab === "followers" ? "bg-coral text-white" : "border border-ink/10 bg-white text-ink"
          }`}
          onClick={() => setTab("followers")}
          type="button"
        >
          Подписчики ({followers.length})
        </button>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <SectionCard title={tab === "following" ? "Вы подписаны" : "Ваши подписчики"}>
        {loading ? (
          <p className="text-sm text-slate-600">Загрузка списков...</p>
        ) : items.length ? (
          <ul className="m-0 list-none space-y-3 p-0">
            {items.map((item) => (
              <li key={item.userId}>
                <Link
                  className="flex items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-sky/40 px-4 py-3 transition hover:border-coral/40"
                  href={`/profiles/${encodeURIComponent(item.username)}`}
                >
                  <div>
                    <div className="font-semibold text-ink">{item.fullName}</div>
                    <div className="text-sm text-slate-600">@{item.username}</div>
                  </div>
                  <span className="text-sm font-semibold text-coral">Профиль →</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm text-slate-600">{emptyHint}</p>
        )}
      </SectionCard>
    </>
  );

  if (embedded) {
    return content;
  }

  return <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">{content}</main>;
}
