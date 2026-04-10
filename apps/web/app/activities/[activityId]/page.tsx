import { ActivityDetailClient } from "../../../components/activity-detail-client";

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  const { activityId } = await params;

  return <ActivityDetailClient activityId={activityId} />;
}
