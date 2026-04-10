import { SectionCard } from "../../components/section-card";

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-coral">Settings MVP</p>
        <h1 className="mt-3 font-display text-3xl text-ink">Настройки аккаунта</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title="Аккаунт и безопасность">
          <p>Email, пароль, подтверждение почты, refresh sessions и базовые настройки приватности.</p>
        </SectionCard>
        <SectionCard title="Уведомления">
          <p>In-app уведомления о лайках, комментариях, подписках и статусах импортов.</p>
        </SectionCard>
      </div>
    </main>
  );
}
