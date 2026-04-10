import { SectionCard } from "../../components/section-card";

export default function ClubsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-coral">Clubs MVP</p>
        <h1 className="mt-3 font-display text-3xl text-ink">Клубы спортсменов</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title="Создание клуба">
          <p>Владелец задаёт название, город, спорт и описание, после чего получает страницу клуба и управление участниками.</p>
        </SectionCard>
        <SectionCard title="Страница клуба">
          <p>Участники, описание, публичный профиль клуба и кнопки вступления или выхода.</p>
        </SectionCard>
      </div>
    </main>
  );
}
