"use client";

import { useActivityDetail } from "../hooks/use-activity-detail";
import { useActivitySocial } from "../hooks/use-activity-social";
import { useAuth } from "./auth-provider";
import { MetricPill } from "./metric-pill";
import { SectionCard } from "./section-card";
import { ActivityRouteMap } from "./activity-route-map";

interface ActivityDetailClientProps {
  activityId: string;
}

export function ActivityDetailClient({ activityId }: ActivityDetailClientProps) {
  const { accessToken } = useAuth();
  const { activity, error } = useActivityDetail(activityId, accessToken);
  const {
    activity: socialActivity,
    comments,
    socialError,
    isSubmittingComment,
    isTogglingLike,
    toggleLike,
    submitComment,
  } = useActivitySocial(activity, accessToken);

  if (error) {
    return <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{error}</main>;
  }

  if (!socialActivity) {
    return <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">Загрузка активности...</main>;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <section className="rounded-[32px] bg-white/80 p-6 shadow-[0_20px_60px_rgba(17,42,70,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-coral">Activity</p>
        <h1 className="mt-3 font-display text-3xl text-ink">{socialActivity.title ?? socialActivity.sportType}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {new Date(socialActivity.startedAt).toLocaleString("ru-RU")} • {socialActivity.description ?? "Импортированная активность"}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricPill label="Дистанция" value={`${Math.round((socialActivity.distanceMeters ?? 0) / 10) / 100} км`} />
          <MetricPill label="Время" value={`${socialActivity.durationSeconds} сек`} />
          <MetricPill label="Набор" value={`${Math.round(socialActivity.elevationGainMeters ?? 0)} м`} />
          <MetricPill label="Пульс" value={socialActivity.avgHeartRate ? `${socialActivity.avgHeartRate} bpm` : "n/a"} />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className={`rounded-full px-4 py-3 text-sm font-semibold ${
              socialActivity.likedByMe ? "bg-coral text-white" : "border border-ink/10 bg-white text-ink"
            }`}
            disabled={isTogglingLike}
            onClick={toggleLike}
            type="button"
          >
            {socialActivity.likedByMe ? "Лайк поставлен" : "Поставить лайк"} • {socialActivity.likesCount}
          </button>
          <div className="rounded-full border border-ink/10 bg-white px-4 py-3 text-sm text-slate-600">
            Комментарии: {socialActivity.commentsCount}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <ActivityRouteMap
          distanceMeters={socialActivity.distanceMeters}
          durationSeconds={socialActivity.durationSeconds}
          points={socialActivity.route?.points ?? []}
        />
        <SectionCard title="Детали импорта" eyebrow={socialActivity.sourceLabel ?? socialActivity.sourceType ?? "activity"}>
          <div className="space-y-3">
            <p>Вид спорта: {socialActivity.sportType}</p>
            <p>Скорость: {socialActivity.avgSpeedMps ? `${socialActivity.avgSpeedMps.toFixed(2)} м/с` : "n/a"}</p>
            <p>Темп: {socialActivity.avgPaceSecondsPerKm ? `${socialActivity.avgPaceSecondsPerKm} сек/км` : "n/a"}</p>
            <p>Лайки: {socialActivity.likesCount}</p>
            <p>Комментарии: {socialActivity.commentsCount}</p>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="Новый комментарий">
          <form className="space-y-3" onSubmit={submitComment}>
            <textarea
              className="min-h-[120px] w-full rounded-2xl border border-ink/10 px-4 py-3"
              name="body"
              placeholder="Напишите комментарий к тренировке"
            />
            <button
              className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white"
              disabled={isSubmittingComment}
              type="submit"
            >
              {isSubmittingComment ? "Отправка..." : "Добавить комментарий"}
            </button>
          </form>
          {socialError ? <p className="mt-3 text-sm text-red-600">{socialError}</p> : null}
        </SectionCard>

        <SectionCard title="Комментарии">
          {comments.length ? (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-2xl bg-sky p-4">
                  <div className="text-xs text-slate-500">{new Date(comment.createdAt).toLocaleString("ru-RU")}</div>
                  <div className="mt-2 text-sm text-ink">{comment.body}</div>
                </div>
              ))}
            </div>
          ) : (
            <p>Пока комментариев нет.</p>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
