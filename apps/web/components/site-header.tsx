"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "./auth-provider";

const navItems = [
  { href: "/feed", label: "Лента" },
  { href: "/profile", label: "Профиль" },
  { href: "/imports", label: "Импорт" },
  { href: "/events", label: "События" },
];

const mobilePrimaryNav = navItems.slice(0, 4);

export function SiteHeader() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <Link className="font-display text-lg text-ink sm:text-xl" href="/">
              Sporza
            </Link>
            <p className="mt-1 text-xs text-slate-500 sm:hidden">Лента, профиль, импорт и события</p>
          </div>

          <div className="flex items-center gap-2 text-sm">
            {user ? (
              <>
                <span className="hidden max-w-[180px] truncate text-slate-600 lg:inline">{user.fullName}</span>
                <button
                  className="rounded-full border border-ink/10 bg-white px-3 py-2 font-semibold text-ink sm:px-4"
                  onClick={logout}
                  type="button"
                >
                  Выйти
                </button>
              </>
            ) : (
              <Link className="rounded-full bg-coral px-4 py-2 font-semibold text-white" href="/profile">
                Войти
              </Link>
            )}
          </div>
        </div>

        <div className="border-t border-white/60 md:hidden">
          <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3 sm:px-6">
            {navItems.map((item) => {
              const isActive = item.href === "/"
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
                    isActive ? "bg-ink text-white" : "bg-white text-slate-600"
                  }`}
                  href={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mx-auto hidden max-w-6xl px-4 pb-3 md:block md:px-6 lg:px-8">
          <nav className="flex gap-4 text-sm font-medium text-slate-600">
            {navItems.map((item) => {
              const isActive = item.href === "/"
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link key={item.href} className={isActive ? "text-ink" : undefined} href={item.href}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/70 bg-white/92 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-4 gap-2">
          {mobilePrimaryNav.map((item) => {
            const isActive = item.href === "/"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                className={`rounded-2xl px-3 py-3 text-center text-xs font-semibold ${
                  isActive ? "bg-ink text-white" : "bg-sky text-ink"
                }`}
                href={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
