"use client";

import { useEffect, useState } from "react";

import { api, EventChatMessage, EventItem } from "../lib/api";

export function useEvent(eventId: string, accessToken: string | null) {
  const [event, setEvent] = useState<EventItem | null>(null);
  const [messages, setMessages] = useState<EventChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    Promise.all([api.getEvent(eventId, accessToken ?? undefined), api.getEventChat(eventId, accessToken ?? undefined)])
      .then(([response, chat]) => {
        setEvent(response);
        setMessages(chat.items);
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

  async function toggleFavorite() {
    if (!accessToken) {
      setError("Чтобы добавить событие в избранное, войдите в аккаунт.");
      return;
    }

    if (!event) {
      return;
    }

    setIsPending(true);
    setError(null);

    try {
      if (event.isFavorite) {
        await api.removeFavoriteEvent(accessToken, event.id);
        setEvent({ ...event, isFavorite: false });
      } else {
        await api.addFavoriteEvent(accessToken, event.id);
        setEvent({ ...event, isFavorite: true });
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось обновить избранное");
    } finally {
      setIsPending(false);
    }
  }

  async function sendMessage(body: string) {
    if (!accessToken) {
      setError("Чтобы писать в обсуждение, войдите в аккаунт.");
      return false;
    }

    setIsPending(true);
    setError(null);

    try {
      const next = await api.createEventChatMessage(accessToken, eventId, body);
      setMessages((current) => [...current, next]);
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось отправить сообщение");
      return false;
    } finally {
      setIsPending(false);
    }
  }

  return {
    event,
    messages,
    error,
    isPending,
    toggleParticipateGoing,
    toggleFavorite,
    sendMessage,
  };
}
