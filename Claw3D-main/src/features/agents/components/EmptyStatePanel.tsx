import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

type EmptyStatePanelProps = {
  title: string;
  label?: string;
  description?: string;
  detail?: string;
  fillHeight?: boolean;
  compact?: boolean;
  className?: string;
};

export const EmptyStatePanel = ({
  title,
  label,
  description,
  detail,
  fillHeight = false,
  compact = false,
  className,
}: EmptyStatePanelProps) => {
  return (
    <div
      className={cn(
        "ui-card text-muted-foreground",
        fillHeight ? "flex h-full w-full flex-col justify-center" : "",
        className
      )}
    >
      {label ? (
        <p className="font-mono text-[10px] font-semibold tracking-[0.06em] text-muted-foreground">
          {label}
        </p>
      ) : null}
      <p
        className={cn(
          "console-title mt-2 text-2xl leading-none text-foreground sm:text-3xl",
          compact ? "mt-0 text-xs font-medium tracking-normal text-muted-foreground sm:text-xs" : ""
        )}
      >
        {title}
      </p>
      {description ? (
        <p className={cn("mt-3 text-sm text-muted-foreground", compact ? "mt-1 text-xs" : "")}>
          {description}
        </p>
      ) : null}
      {detail ? (
        <p className="ui-input mt-3 rounded-md px-4 py-2 font-mono text-[11px] text-muted-foreground/90">
          {detail}
        </p>
      ) : null}
    </div>
  );
};
