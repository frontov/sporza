"use client";

import { useEffect, useState } from "react";

import { api, PublicProfile } from "../lib/api";

export function usePublicProfile(username: string, accessToken: string | null) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPendingFollow, setIsPendingFollow] = useState(false);

  useEffect(() => {
    api
      .getPublicProfile(username, accessToken ?? undefined)
      .then((response) => {
        setProfile(response);
        setError(null);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить профиль пользователя");
      });
  }, [accessToken, username]);

  async function toggleFollow() {
    if (!profile || !accessToken) {
      setError("Для подписки нужно войти в аккаунт.");
      return;
    }

    setIsPendingFollow(true);
    setError(null);

    try {
      if (profile.isFollowedByMe) {
        await api.unfollowUser(accessToken, profile.id);
        setProfile({
          ...profile,
          isFollowedByMe: false,
        });
      } else {
        await api.followUser(accessToken, profile.id);
        setProfile({
          ...profile,
          isFollowedByMe: true,
        });
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось обновить подписку");
    } finally {
      setIsPendingFollow(false);
    }
  }

  return {
    profile,
    error,
    isPendingFollow,
    toggleFollow,
  };
}
