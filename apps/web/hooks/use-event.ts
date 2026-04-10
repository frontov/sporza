"use client";

import { useEffect, useState } from "react";

import { api, EventItem } from "../lib/api";

export function useEvent(eventId: string, accessToken: string | null) {
  const [event, setEvent] = useState<EventItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    api
      .getEvent(eventId, accessToken ?? undefined)
      .then((response) => {
        setEvent(response);
        setError(null);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить событие");
      });
  }, [accessToken, eventId]);

  async function toggleParticipateGoing() {
    if (!accessToken) {
      setError("Для участия войдите в аккаунт.");
      return;
    }

    if (!event) {
      return;
    }

    setIsPending(true);
    setError(null);

    try {
      if (event.participationStatus === "going") {
        await api.removeEventParticipation(accessToken, event.id);
        await api.removeFavoriteEvent(accessToken, event.id);
        setEvent({
          ...event,
          participationStatus: null,
          isFavorite: false,
        });
      } else {
        await api.addFavoriteEvent(accessToken, event.id);
        await api.setEventParticipation(accessToken, event.id, "going");
        setEvent({
          ...event,
          participationStatus: "going",
          isFavorite: true,
        });
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить");
    } finally {
      setIsPending(false);
    }
  }

  return {
    event,
    error,
    isPending,
    toggleParticipateGoing,
  };
}
