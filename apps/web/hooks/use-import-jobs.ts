"use client";

import { useEffect, useMemo, useState } from "react";

import { api, ImportJob } from "../lib/api";

export function useImportJobs(accessToken: string | null) {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [error, setError] = useState<string | null>(null);

  const activeJobs = useMemo(
    () => jobs.filter((job) => ["queued", "processing"].includes(job.status)),
    [jobs],
  );

  useEffect(() => {
    if (!accessToken) {
      setJobs([]);
      return;
    }

    api
      .getImportJobs(accessToken)
      .then((response) => {
        setJobs(response.items);
        setError(null);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить историю импортов");
      });
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !activeJobs.length) {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const response = await api.getImportJobs(accessToken);
        setJobs(response.items);
        setError(null);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Не удалось обновить статусы импортов");
      }
    }, 3000);

    return () => window.clearInterval(timer);
  }, [accessToken, activeJobs.length]);

  return {
    jobs,
    setJobs,
    error,
    setError,
  };
}
