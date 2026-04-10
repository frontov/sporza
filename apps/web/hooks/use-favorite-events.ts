"use client";

import { useEffect, useState } from "react";

import { api, EventItem } from "../lib/api";

export function useFavoriteEvents(accessToken: string | null) {
  const [items, setItems] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setItems([]);
      return;
    }

    api
      .getFavoriteEvents(accessToken)
      .then((response) => {
        setItems(response.items);
        setError(null);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить избранные события");
      });
  }, [accessToken]);

  async function removeFavorite(eventId: string) {
    if (!accessToken) {
      setError("Для работы с избранным войдите в аккаунт.");
      return;
    }

    setPendingEventId(eventId);
    setError(null);

    try {
      await api.removeFavoriteEvent(accessToken, eventId);
      setItems((current) => current.filter((item) => item.id !== eventId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось удалить событие из избранного");
    } finally {
      setPendingEventId(null);
    }
  }

  return {
    items,
    error,
    pendingEventId,
    removeFavorite,
  };
}
