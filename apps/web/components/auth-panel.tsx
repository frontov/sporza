"use client";

import { FormEvent, useState } from "react";

import { useAuth } from "./auth-provider";

type Mode = "login" | "register";

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
      setError(submissionError instanceof Error ? submissionError.message : "Не удалось выполнить вход");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(17,42,70,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-coral">Auth</p>
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
