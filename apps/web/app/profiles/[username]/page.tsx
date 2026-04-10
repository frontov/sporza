import { PublicProfileClient } from "../../../components/public-profile-client";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  return <PublicProfileClient username={username} />;
}
