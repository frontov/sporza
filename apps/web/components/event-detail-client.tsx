"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { useEvent } from "../hooks/use-event";
import { SectionCard } from "./section-card";
import { useAuth } from "./auth-provider";

interface EventDetailClientProps {
  eventId: string;
}

export function EventDetailClient({ eventId }: EventDetailClientProps) {
  const { accessToken } = useAuth();
  const { event, messages, error, isPending, toggleParticipateGoing, toggleFavorite, sendMessage } = useEvent(
    eventId,
    accessToken,
  );
  const [message, setMessage] = useState("");

  if (error && !event) {
    return <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">{error}</main>;
  }

  if (!event) {
    return <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">Загрузка события...</main>;
  }

  async function onSubmitMessage(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    const ok = await sendMessage(message);
    if (ok) {
      setMessage("");
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <p className="mb-4 text-sm">
        <Link className="font-semibold text-coral hover:underline" href="/events">
          ← К списку событий
        </Link>
      </p>
      <SectionCard
        title={event.title}
        eyebrow={`${event.sportType} • ${new Date(event.startsAt).toLocaleDateString("ru-RU")}`}
      >
        <p>{event.description ?? "Описание пока не добавлено."}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-sky p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Локация</div>
            <div className="mt-2 font-semibold text-ink">{[event.region, event.city, event.venue].filter(Boolean).join(" • ") || "Не указана"}</div>
          </div>
          <div className="rounded-2xl bg-sky p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Избранное</div>
            <div className="mt-2 font-semibold text-ink">
              {event.isFavorite ? "Событие уже у вас в избранном" : "Событие пока не в избранном"}
            </div>
          </div>
        </div>
        {event.favoriteFriendsCount > 0 ? (
          <div className="mt-4 rounded-2xl bg-mint/70 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Друзья</div>
            <div className="mt-2 text-sm text-ink">
              Уже добавили в избранное: {event.favoriteFriends.map((friend) => friend.fullName).join(", ")}
              {event.favoriteFriendsCount > event.favoriteFriends.length
                ? ` и ещё ${event.favoriteFriendsCount - event.favoriteFriends.length}`
                : ""}
            </div>
          </div>
        ) : null}
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            className={`rounded-full px-5 py-2.5 text-sm font-semibold ${
              event.isFavorite ? "bg-ink text-white" : "border border-ink/15 bg-white text-ink"
            }`}
            disabled={isPending || !accessToken}
            onClick={toggleFavorite}
            type="button"
          >
            {event.isFavorite ? "В избранном" : "В избранное"}
          </button>
          <button
            className={`rounded-full px-5 py-2.5 text-sm font-semibold ${
              event.participationStatus === "going" ? "bg-coral text-white" : "bg-mint text-ink"
            }`}
            disabled={isPending || !accessToken}
            onClick={toggleParticipateGoing}
            type="button"
          >
            {event.participationStatus === "going" ? "Участвую ✓" : "Участвую"}
          </button>
          {!accessToken ? <span className="text-sm text-slate-500">Войдите, чтобы отметить участие</span> : null}
        </div>
      </SectionCard>

      <div className="mt-6">
        <SectionCard title="Обсуждение события" eyebrow="Чат">
          <div className="grid gap-3">
            {messages.length ? (
              messages.map((item) => (
                <div key={item.id} className="rounded-2xl border border-ink/10 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-ink">{item.fullName}</div>
                    <div className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString("ru-RU")}</div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{item.body}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Пока сообщений нет. Начните обсуждение первым.</p>
            )}
          </div>
          <form className="mt-5 grid gap-3" onSubmit={onSubmitMessage}>
            <textarea
              className="min-h-28 rounded-2xl border border-ink/10 px-4 py-3"
              onChange={(inputEvent) => setMessage(inputEvent.target.value)}
              placeholder="Обсудите участие, дорогу, регистрацию, экипировку или командный выезд."
              value={message}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-white"
                disabled={isPending || !accessToken || !message.trim()}
                type="submit"
              >
                Отправить
              </button>
              {!accessToken ? <span className="text-sm text-slate-500">Войдите, чтобы писать в обсуждение</span> : null}
            </div>
          </form>
        </SectionCard>
      </div>
    </main>
  );
}
