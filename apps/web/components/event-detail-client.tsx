"use client";

import Link from "next/link";

import { useEvent } from "../hooks/use-event";
import { SectionCard } from "./section-card";
import { useAuth } from "./auth-provider";

interface EventDetailClientProps {
  eventId: string;
}

export function EventDetailClient({ eventId }: EventDetailClientProps) {
  const { accessToken } = useAuth();
  const { event, error, isPending, toggleParticipateGoing } = useEvent(eventId, accessToken);

  if (error && !event) {
    return <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">{error}</main>;
  }

  if (!event) {
    return <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">Загрузка события...</main>;
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
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Вы</div>
            <div className="mt-2 font-semibold text-ink">
              {event.participationStatus === "going" ? "Отмечено участие — событие в избранном" : "Ещё не отмечали участие"}
            </div>
          </div>
        </div>
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        <div className="mt-6 flex flex-wrap items-center gap-3">
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
    </main>
  );
}
