import { Suspense } from "react";

import { ProfileClient } from "../../components/profile-client";

export default function ProfilePage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">Загрузка профиля...</main>}>
      <ProfileClient />
    </Suspense>
  );
}
