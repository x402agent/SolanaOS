export function roleScopesAllow(_role: string, _scope: string): boolean {
  const role = String(_role).trim().toLowerCase();
  const scope = String(_scope).trim().toLowerCase();
  if (!role || !scope) return false;

  if (role === "operator") {
    return matchesScope(scope, [
      "operator.",
      "chat.",
      "sessions.",
      "config.get",
      "health",
      "talk.",
      "agent.request",
      "voicewake.",
    ]);
  }

  if (role === "node") {
    return matchesScope(scope, [
      "node.",
      "canvas.",
      "camera.",
      "sms.",
      "location.",
      "device.",
      "notifications.",
      "system.",
      "photos.",
      "contacts.",
      "calendar.",
      "motion.",
      "debug.",
    ]);
  }

  return matchesScope(scope, [`${role}.`]);
}

function matchesScope(scope: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => scope === prefix.replace(/\.$/, "") || scope.startsWith(prefix));
}
