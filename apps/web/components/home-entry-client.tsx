"use client";

import Link from "next/link";

import { FeedClient } from "./feed-client";
import { AuthPanel } from "./auth-panel";
import { MetricPill } from "./metric-pill";
import { SectionCard } from "./section-card";
import { useAuth } from "./auth-provider";

export function HomeEntryClient() {
  const { isReady, user } = useAuth();

  if (!isReady) {
    return <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">Загрузка...</main>;
  }

  if (user) {
    return <FeedClient />;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6">
      <section className="overflow-hidden rounded-[28px] bg-ink px-5 py-7 text-white shadow-[0_30px_90px_rgba(17,42,70,0.26)] sm:px-8 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-coral">Sporza</p>
        <h1 className="mt-4 max-w-3xl font-display text-3xl leading-tight sm:text-5xl">
          Войдите, чтобы открыть свою спортивную ленту и реальные события.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
          После входа главная страница становится вашей лентой: активности, события, подписки и импорт тренировок.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:max-w-md">
          <MetricPill label="Лента" value="Live" />
          <MetricPill label="Импорт" value="FIT / GPX / TCX" />
          <MetricPill label="События" value="Real data" />
          <MetricPill label="Карта" value="Yandex" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <AuthPanel />
        <div className="grid gap-6">
          <SectionCard title="Что будет после входа" eyebrow="Entry Flow">
            <ul className="m-0 space-y-2 pl-5">
              <li>Главная страница станет вашей лентой активностей.</li>
              <li>Можно будет импортировать тренировки и сразу видеть их в профиле.</li>
              <li>Реальные спортивные события будут доступны с участием и избранным.</li>
            </ul>
          </SectionCard>
          <SectionCard title="Открытые разделы" eyebrow="Public">
            <p>Даже без входа можно посмотреть каталог событий и публичные профили спортсменов.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Link className="rounded-full bg-coral px-5 py-3 text-center text-sm font-semibold text-white" href="/events">
                Открыть события
              </Link>
              <Link
                className="rounded-full border border-ink/15 px-5 py-3 text-center text-sm font-semibold text-ink"
                href="/profile"
              >
                Перейти к профилю
              </Link>
            </div>
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
