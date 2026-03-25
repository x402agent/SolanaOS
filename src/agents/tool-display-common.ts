export interface ToolDisplaySpec {
  verb?: string;
  title?: string;
  icon?: string;
  label?: string;
  description?: string;
  detail?: string;
}

export function normalizeToolName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_.-]/g, "-");
}

export function defaultTitle(tool: string): string {
  return tool
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatToolDetailText(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (detail == null) return "";
  return JSON.stringify(detail, null, 2);
}

export function resolveToolVerbAndDetailForArgs(
  tool: string,
  args?: Record<string, unknown>,
  spec?: ToolDisplaySpec | null,
): { verb: string; detail: string } {
  const resolvedSpec = spec ?? getToolDisplay(tool);
  const verb = resolvedSpec?.verb?.trim() || "Running";
  const detail =
    resolvedSpec?.detail?.trim() ||
    (args && Object.keys(args).length > 0 ? formatToolDetailText(args) : "");
  return { verb, detail };
}

export function getToolDisplay(tool: string): ToolDisplaySpec | null {
  const normalized = normalizeToolName(tool);
  switch (normalized) {
    case "chat.send":
      return { verb: "Sending", title: "Chat Reply", icon: "message-square" };
    case "chat.history":
      return { verb: "Loading", title: "Chat History", icon: "history" };
    case "sessions.list":
      return { verb: "Loading", title: "Sessions", icon: "list" };
    case "health":
    case "device.health":
      return { verb: "Checking", title: "Health", icon: "heart-pulse" };
    case "config.get":
      return { verb: "Loading", title: "Config", icon: "settings" };
    case "node.canvas.capability.refresh":
      return { verb: "Refreshing", title: "Canvas Capability", icon: "refresh-cw" };
    default:
      return null;
  }
}

export function formatToolLabel(tool: string): string {
  return defaultTitle(tool);
}
