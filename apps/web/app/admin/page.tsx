import { SectionCard } from "../../components/section-card";

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-coral">Admin MVP</p>
        <h1 className="mt-3 font-display text-3xl text-ink">Административная панель</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SectionCard title="Пользователи">
          <p>Просмотр пользователей, блокировки и история административных действий.</p>
        </SectionCard>
        <SectionCard title="Комментарии">
          <p>Скрытие токсичных комментариев и модерация публичного контента.</p>
        </SectionCard>
        <SectionCard title="События">
          <p>Ручной запуск синхронизации, скрытие и архивирование событий.</p>
        </SectionCard>
        <SectionCard title="Импорты">
          <p>Просмотр import jobs, ошибок парсинга и повторного запуска обработки.</p>
        </SectionCard>
        <SectionCard title="Наблюдаемость">
          <p>Sentry, structured logs и контроль стабильности асинхронного пайплайна.</p>
        </SectionCard>
      </div>
    </main>
  );
}
