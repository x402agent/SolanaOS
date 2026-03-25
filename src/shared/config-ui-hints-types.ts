export type ConfigUiHintType =
  | "string"
  | "password"
  | "number"
  | "boolean"
  | "select"
  | "multiline"
  | "url";

export interface ConfigUiHint {
  path: string;
  label?: string;
  description?: string;
  section?: string;
  subsection?: string;
  type?: ConfigUiHintType;
  options?: string[];
  placeholder?: string;
  deprecated?: boolean;
}
export type ConfigUiHints = Record<string, ConfigUiHint>;

export function normalizeConfigUiHints(hints: ConfigUiHints): ConfigUiHints {
  return Object.fromEntries(
    Object.entries(hints).map(([key, hint]) => [
      key,
      {
        ...hint,
        path: hint.path.trim(),
        label: hint.label?.trim(),
        description: hint.description?.trim(),
        section: hint.section?.trim(),
        subsection: hint.subsection?.trim(),
        placeholder: hint.placeholder?.trim(),
        options: hint.options?.map((option) => option.trim()).filter(Boolean),
      },
    ]),
  );
}
