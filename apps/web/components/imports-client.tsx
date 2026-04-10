"use client";

import Link from "next/link";
import { ChangeEvent, useState } from "react";

import { api, ImportJob } from "../lib/api";
import { useImportJobs } from "../hooks/use-import-jobs";
import { AuthPanel } from "./auth-panel";
import { SectionCard } from "./section-card";
import { useAuth } from "./auth-provider";

export function ImportsClient() {
  const { accessToken, isReady, user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const { jobs, setJobs, error, setError } = useImportJobs(accessToken);

  async function onFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !accessToken) {
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const job = await api.uploadImport(accessToken, file);
      setJobs((current) => [job, ...current]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Не удалось загрузить файл");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  if (!isReady) {
    return <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">Загрузка импорта...</main>;
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
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-coral">Imports MVP</p>
        <h1 className="mt-3 font-display text-3xl text-ink">Импорт тренировок</h1>
      </div>

      <SectionCard title="Загрузка файла">
        <label className="inline-flex cursor-pointer rounded-2xl bg-coral px-5 py-3 font-semibold text-white">
          <input accept=".fit,.gpx,.tcx" className="hidden" onChange={onFileSelect} type="file" />
          {isUploading ? "Загрузка..." : "Выбрать FIT / GPX / TCX"}
        </label>
        <p className="mt-4 text-sm text-slate-500">
          Файл уходит в storage, затем в очередь BullMQ и обрабатывается асинхронно на backend.
        </p>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </SectionCard>

      <div className="mt-6 space-y-4">
        {jobs.length ? (
          jobs.map((item) => (
            <SectionCard key={item.id} title={item.originalFilename ?? item.id} eyebrow={item.status}>
              <p>
                Создан: {new Date(item.createdAt).toLocaleString("ru-RU")}
                {item.activityId ? ` • activity ${item.activityId}` : ""}
              </p>
              {item.activityId ? (
                <Link className="mt-3 inline-block text-sm font-semibold text-coral" href={`/activities/${item.activityId}`}>
                  Открыть активность
                </Link>
              ) : null}
              {item.errorMessage ? <p className="mt-2 text-red-600">{item.errorMessage}</p> : null}
            </SectionCard>
          ))
        ) : (
          <SectionCard title="История импортов пока пуста">
            <p>Загрузите первый файл, и здесь появится статус import job.</p>
          </SectionCard>
        )}
      </div>
    </main>
  );
}
