"use client";

import { FormEvent, useState } from "react";

import { useAuth } from "./auth-provider";

type Mode = "login" | "register";

function getFriendlyAuthErrorMessage(error: unknown, mode: Mode) {
  const fallback = mode === "login" ? "Не удалось войти. Попробуйте ещё раз." : "Не удалось создать аккаунт. Попробуйте ещё раз.";
  const message = error instanceof Error ? error.message.trim() : "";

  if (!message) {
    return fallback;
  }

  const normalized = message.toLowerCase();

  if (
    normalized.includes("invalid credentials") ||
    normalized.includes("unauthorized") ||
    normalized.includes("невер") ||
    normalized.includes("invalid email or password")
  ) {
    return "Неверный email или пароль.";
  }

  if (normalized.includes("email already in use")) {
    return "Этот email уже зарегистрирован.";
  }

  if (normalized.includes("username already in use")) {
    return "Этот username уже занят.";
  }

  if (normalized.includes("username must be longer")) {
    return "Username слишком короткий.";
  }

  if (normalized.includes("username must be shorter")) {
    return "Username слишком длинный.";
  }

  if (normalized.includes("password must be longer")) {
    return "Пароль слишком короткий. Используйте минимум 8 символов.";
  }

  if (normalized.includes("password")) {
    return mode === "login" ? "Проверьте пароль и попробуйте ещё раз." : "Проверьте пароль и попробуйте снова.";
  }

  if (normalized.includes("email must be an email")) {
    return "Введите корректный email.";
  }

  if (normalized.includes("full name")) {
    return "Укажите имя, которое будет видно в профиле.";
  }

  if (normalized.includes("failed to fetch") || normalized.includes("networkerror")) {
    return "Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз.";
  }

  return mode === "login" ? "Не удалось войти. Проверьте данные и попробуйте ещё раз." : "Не удалось создать аккаунт. Проверьте данные и попробуйте ещё раз.";
}

export function AuthPanel() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);

    try {
      if (mode === "login") {
        await login({
          email: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? ""),
        });
      } else {
        await register({
          email: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? ""),
          username: String(formData.get("username") ?? ""),
          fullName: String(formData.get("fullName") ?? ""),
        });
      }
    } catch (submissionError) {
      setError(getFriendlyAuthErrorMessage(submissionError, mode));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(17,42,70,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-coral">Вход</p>
          <h2 className="mt-2 font-display text-2xl text-ink">
            {mode === "login" ? "Вход по email" : "Быстрая регистрация"}
          </h2>
        </div>
        <button
          className="rounded-full border border-ink/10 px-4 py-2 text-sm font-semibold text-ink"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          type="button"
        >
          {mode === "login" ? "Регистрация" : "Вход"}
        </button>
      </div>

      <form className="mt-5 grid gap-3" onSubmit={onSubmit}>
        {mode === "register" ? (
          <>
            <input className="rounded-2xl border border-ink/10 px-4 py-3" name="fullName" placeholder="Имя" required />
            <input className="rounded-2xl border border-ink/10 px-4 py-3" name="username" placeholder="Username" required />
          </>
        ) : null}
        <input className="rounded-2xl border border-ink/10 px-4 py-3" name="email" placeholder="Email" required type="email" />
        <input
          className="rounded-2xl border border-ink/10 px-4 py-3"
          name="password"
          placeholder="Пароль"
          required
          type="password"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className="rounded-2xl bg-coral px-4 py-3 font-semibold text-white" disabled={isPending} type="submit">
          {isPending ? "Обработка..." : mode === "login" ? "Войти" : "Создать аккаунт"}
        </button>
      </form>
    </section>
  );
}
