export interface ToolPolicy {
  tool: string;
  action: "allow" | "deny" | "ask";
}
export type ToolPolicies = ToolPolicy[];

export interface ToolPolicyProfile {
  allow?: string[];
  deny?: string[];
  ask?: string[];
}

export const DEFAULT_TOOL_GROUPS: Record<string, string[]> = {
  chat: ["chat.send", "chat.history", "chat.abort", "chat.subscribe"],
  sessions: ["sessions.list"],
  gateway: ["health", "config.get", "agent.request", "node.event"],
  device: [
    "device.status",
    "device.info",
    "device.permissions",
    "device.health",
    "camera.list",
    "camera.snap",
    "camera.clip",
    "location.get",
    "sms.send",
    "notifications.list",
    "notifications.actions",
    "system.notify",
    "photos.latest",
    "contacts.search",
    "contacts.add",
    "calendar.events",
    "calendar.add",
    "motion.activity",
    "motion.pedometer",
  ],
};

export function normalizeToolName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
}

export function expandToolGroups(
  tools: string[],
  groups: Record<string, string[]> = DEFAULT_TOOL_GROUPS,
): string[] {
  const expanded = new Set<string>();
  for (const tool of tools) {
    const trimmed = tool.trim();
    if (!trimmed) continue;
    const groupKey = trimmed.replace(/^group:/, "");
    const groupMembers = groups[groupKey];
    if (groupMembers) {
      for (const member of groupMembers) expanded.add(member);
      continue;
    }
    expanded.add(trimmed);
  }
  return [...expanded];
}

export function resolveToolProfilePolicy(
  tool: string,
  profiles?: ToolPolicyProfile[],
): "allow" | "deny" | "ask" {
  const normalized = tool.trim();
  const allow = new Set<string>();
  const deny = new Set<string>();
  const ask = new Set<string>();
  for (const profile of profiles ?? []) {
    for (const item of expandToolGroups(profile.allow ?? [])) allow.add(item);
    for (const item of expandToolGroups(profile.deny ?? [])) deny.add(item);
    for (const item of expandToolGroups(profile.ask ?? [])) ask.add(item);
  }
  if (deny.has(normalized)) return "deny";
  if (ask.has(normalized)) return "ask";
  if (allow.has(normalized)) return "allow";
  return "allow";
}
