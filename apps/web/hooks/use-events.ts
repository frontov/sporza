"use client";

import { useEffect, useState } from "react";

import { api, EventItem } from "../lib/api";

export function useEvents(accessToken: string | null) {
  const [items, setItems] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(24);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    api
      .getEvents({ page, pageSize }, accessToken ?? undefined)
      .then((response) => {
        setItems(response.items);
        setTotal(response.total);
        setTotalPages(response.totalPages);
        setError(null);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить события");
      });
  }, [accessToken, page, pageSize]);

  /** «Участвую»: в избранном + статус going; повторное нажатие снимает и то и другое. */
  async function toggleParticipateGoing(eventId: string) {
    if (!accessToken) {
      setError("Для участия сначала войдите в аккаунт на странице профиля.");
      return;
    }

    const targetEvent = items.find((item) => item.id === eventId);
    if (!targetEvent) {
      return;
    }

    setPendingEventId(eventId);
    setError(null);

    try {
      if (targetEvent.participationStatus === "going") {
        await api.removeEventParticipation(accessToken, eventId);
        await api.removeFavoriteEvent(accessToken, eventId);
        setItems((current) =>
          current.map((item) =>
            item.id === eventId
              ? {
                  ...item,
                  participationStatus: null,
                  isFavorite: false,
                }
              : item,
          ),
        );
      } else {
        await api.addFavoriteEvent(accessToken, eventId);
        await api.setEventParticipation(accessToken, eventId, "going");
        setItems((current) =>
          current.map((item) =>
            item.id === eventId
              ? {
                  ...item,
                  participationStatus: "going",
                  isFavorite: true,
                }
              : item,
          ),
        );
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить");
    } finally {
      setPendingEventId(null);
    }
  }

  async function toggleFavorite(eventId: string) {
    if (!accessToken) {
      setError("Чтобы сохранять события, сначала войдите в аккаунт.");
      return;
    }

    const targetEvent = items.find((item) => item.id === eventId);
    if (!targetEvent) {
      return;
    }

    setPendingEventId(eventId);
    setError(null);

    try {
      if (targetEvent.isFavorite) {
        await api.removeFavoriteEvent(accessToken, eventId);
        setItems((current) => current.map((item) => (item.id === eventId ? { ...item, isFavorite: false } : item)));
      } else {
        await api.addFavoriteEvent(accessToken, eventId);
        setItems((current) => current.map((item) => (item.id === eventId ? { ...item, isFavorite: true } : item)));
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось обновить избранное");
    } finally {
      setPendingEventId(null);
    }
  }

  return {
    items,
    error,
    pendingEventId,
    toggleParticipateGoing,
    toggleFavorite,
    page,
    pageSize,
    total,
    totalPages,
    setPage,
  };
}
