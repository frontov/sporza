"use client";

import { FormEvent, useEffect, useState } from "react";

import { ActivityComment, ActivityDetail, api } from "../lib/api";

export function useActivitySocial(activity: ActivityDetail | null, accessToken: string | null) {
  const [comments, setComments] = useState<ActivityComment[]>([]);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isTogglingLike, setIsTogglingLike] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [localActivity, setLocalActivity] = useState<ActivityDetail | null>(activity);

  useEffect(() => {
    setLocalActivity(activity);
  }, [activity]);

  useEffect(() => {
    if (!activity) {
      return;
    }

    api
      .getActivityComments(activity.id, accessToken ?? undefined)
      .then((response) => {
        setComments(response.items);
        setSocialError(null);
      })
      .catch((requestError) => {
        setSocialError(requestError instanceof Error ? requestError.message : "Не удалось загрузить комментарии");
      });
  }, [accessToken, activity]);

  async function toggleLike() {
    if (!accessToken || !localActivity) {
      setSocialError("Для лайка нужно войти в аккаунт.");
      return;
    }

    setIsTogglingLike(true);
    setSocialError(null);

    try {
      if (localActivity.likedByMe) {
        await api.unlikeActivity(accessToken, localActivity.id);
        setLocalActivity({
          ...localActivity,
          likedByMe: false,
          likesCount: Math.max(localActivity.likesCount - 1, 0),
        });
      } else {
        await api.likeActivity(accessToken, localActivity.id);
        setLocalActivity({
          ...localActivity,
          likedByMe: true,
          likesCount: localActivity.likesCount + 1,
        });
      }
    } catch (requestError) {
      setSocialError(requestError instanceof Error ? requestError.message : "Не удалось обновить лайк");
    } finally {
      setIsTogglingLike(false);
    }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken || !localActivity) {
      setSocialError("Для комментария нужно войти в аккаунт.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = String(formData.get("body") ?? "").trim();

    if (!body) {
      return;
    }

    setIsSubmittingComment(true);
    setSocialError(null);

    try {
      const comment = await api.createActivityComment(accessToken, localActivity.id, body);
      setComments((current) => [comment, ...current]);
      setLocalActivity({
        ...localActivity,
        commentsCount: localActivity.commentsCount + 1,
      });
      form.reset();
    } catch (requestError) {
      setSocialError(requestError instanceof Error ? requestError.message : "Не удалось отправить комментарий");
    } finally {
      setIsSubmittingComment(false);
    }
  }

  return {
    activity: localActivity,
    comments,
    socialError,
    isSubmittingComment,
    isTogglingLike,
    toggleLike,
    submitComment,
  };
}
