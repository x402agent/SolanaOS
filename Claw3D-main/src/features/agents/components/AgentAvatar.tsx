import Image from "next/image";
import { useMemo } from "react";

import { buildAvatarDataUrl } from "@/lib/avatars/multiavatar";

type AgentAvatarProps = {
  seed: string;
  name: string;
  avatarUrl?: string | null;
  size?: number;
  isSelected?: boolean;
};

export const AgentAvatar = ({
  seed,
  name,
  avatarUrl,
  size = 112,
  isSelected = false,
}: AgentAvatarProps) => {
  const src = useMemo(() => {
    const trimmed = avatarUrl?.trim();
    if (trimmed) return trimmed;
    return buildAvatarDataUrl(seed);
  }, [avatarUrl, seed]);

  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-full border border-border/80 bg-card transition-transform duration-300 ${isSelected ? "agent-avatar-selected scale-[1.02]" : ""}`}
      style={{ width: size, height: size }}
    >
      <Image
        className="pointer-events-none h-full w-full select-none"
        src={src}
        alt={`Avatar for ${name}`}
        width={size}
        height={size}
        unoptimized
        draggable={false}
      />
    </div>
  );
};
