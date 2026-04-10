"use client";

import { useEffect, useState } from "react";

import { ActivityDetail, api } from "../lib/api";

export function useActivityDetail(activityId: string, accessToken: string | null) {
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getActivity(activityId, accessToken ?? undefined)
      .then((response) => {
        setActivity(response);
        setError(null);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить активность");
      });
  }, [accessToken, activityId]);

  return {
    activity,
    error,
  };
}
