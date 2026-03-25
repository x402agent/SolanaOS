import { redirect } from "next/navigation";

export default async function AgentSettingsPage({
  params,
}: {
  params: Promise<{ agentId?: string }> | { agentId?: string };
}) {
  await params;
  redirect("/office");
}
