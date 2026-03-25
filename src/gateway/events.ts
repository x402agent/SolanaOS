export const GATEWAY_EVENT_CONNECT_CHALLENGE = "connect.challenge" as const;
export const GATEWAY_EVENT_HEALTH = "health" as const;
export const GATEWAY_EVENT_UPDATE_AVAILABLE = "update.available" as const;
export const GATEWAY_EVENT_CHAT_MESSAGE = "chat.message" as const;
export const GATEWAY_EVENT_CHAT_STREAM = "chat.stream" as const;
export const GATEWAY_EVENT_TOOL_STREAM = "tool.stream" as const;
export const GATEWAY_EVENT_SESSION_REFRESH = "session.refresh" as const;
export const GATEWAY_EVENT_EXEC_APPROVAL = "exec.approval" as const;
export const GATEWAY_EVENT_CHAT = "chat" as const;
export const GATEWAY_EVENT_AGENT = "agent" as const;
export const GATEWAY_EVENT_AGENT_REQUEST = "agent.request" as const;
export const GATEWAY_EVENT_NODE_INVOKE_REQUEST = "node.invoke.request" as const;
export const GATEWAY_EVENT_NOTIFICATIONS_CHANGED = "notifications.changed" as const;

export const GATEWAY_EVENTS = [
  GATEWAY_EVENT_CONNECT_CHALLENGE,
  GATEWAY_EVENT_HEALTH,
  GATEWAY_EVENT_UPDATE_AVAILABLE,
  GATEWAY_EVENT_CHAT_MESSAGE,
  GATEWAY_EVENT_CHAT_STREAM,
  GATEWAY_EVENT_TOOL_STREAM,
  GATEWAY_EVENT_SESSION_REFRESH,
  GATEWAY_EVENT_EXEC_APPROVAL,
  GATEWAY_EVENT_CHAT,
  GATEWAY_EVENT_AGENT,
  GATEWAY_EVENT_AGENT_REQUEST,
  GATEWAY_EVENT_NODE_INVOKE_REQUEST,
  GATEWAY_EVENT_NOTIFICATIONS_CHANGED,
] as const;

export type GatewayEventName = (typeof GATEWAY_EVENTS)[number];

export function isGatewayEventName(value: string): value is GatewayEventName {
  return (GATEWAY_EVENTS as readonly string[]).includes(value);
}
