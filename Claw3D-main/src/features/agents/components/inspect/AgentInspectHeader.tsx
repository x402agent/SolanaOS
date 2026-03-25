"use client";

import { X } from "lucide-react";

export type AgentInspectHeaderProps = {
  label?: string;
  title?: string;
  onClose: () => void;
  closeTestId: string;
  closeDisabled?: boolean;
};

export const AgentInspectHeader = ({
  label,
  title,
  onClose,
  closeTestId,
  closeDisabled,
}: AgentInspectHeaderProps) => {
  const normalizedLabel = label?.trim() ?? "";
  const normalizedTitle = title?.trim() ?? "";
  const hasLabel = normalizedLabel.length > 0;
  const hasTitle = normalizedTitle.length > 0;

  if (!hasLabel && !hasTitle) {
    return null;
  }

  return (
    <div className="flex items-center justify-between pl-4 pr-2 pb-3 pt-2">
      <div>
        {hasLabel ? (
          <div className="font-mono text-[9px] font-medium tracking-[0.04em] text-muted-foreground/58">
            {normalizedLabel}
          </div>
        ) : null}
        {hasTitle ? (
          <div
            className={
              hasLabel
                ? "text-[1.45rem] font-semibold leading-[1.05] tracking-[0.01em] text-foreground"
                : "font-mono text-[12px] font-semibold tracking-[0.05em] text-foreground"
            }
          >
            {normalizedTitle}
          </div>
        ) : null}
      </div>
      <button
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/55 transition hover:bg-surface-2 hover:text-muted-foreground/85"
        type="button"
        data-testid={closeTestId}
        aria-label="Close panel"
        disabled={closeDisabled}
        onClick={onClose}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};
