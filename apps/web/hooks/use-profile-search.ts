"use client";

import { useEffect, useState } from "react";

import { api, Profile } from "../lib/api";

export function useProfileSearch(query: string) {
  const [items, setItems] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!trimmedQuery) {
      setItems([]);
      setError(null);
      return;
    }

    const timer = window.setTimeout(() => {
      api
        .searchProfiles(trimmedQuery)
        .then((response) => {
          setItems(response.items);
          setError(null);
        })
        .catch((requestError) => {
          setError(requestError instanceof Error ? requestError.message : "Не удалось найти пользователей");
        });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [trimmedQuery]);

  return {
    items,
    error,
  };
}
