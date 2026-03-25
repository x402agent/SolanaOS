const AVATAR_PALETTE = [
  "#1d4ed8",
  "#0f766e",
  "#7c3aed",
  "#c2410c",
  "#be123c",
  "#4f46e5",
  "#0f172a",
  "#1f2937",
] as const;

const AVATAR_ACCENTS = [
  "#bfdbfe",
  "#99f6e4",
  "#ddd6fe",
  "#fed7aa",
  "#fecdd3",
  "#c7d2fe",
  "#cbd5e1",
  "#fde68a",
] as const;

const AVATAR_FOREGROUNDS = [
  "#eff6ff",
  "#f8fafc",
  "#fefce8",
  "#fdf4ff",
] as const;

const hashSeed = (seed: string) => {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const pick = <T,>(values: readonly T[], index: number) => values[index % values.length];

const buildAvatarLabel = (seed: string) => {
  const compact = seed
    .trim()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return compact || seed.trim().slice(0, 2).toUpperCase() || "?";
};

export const buildAvatarSvg = (seed: string): string => {
  const trimmed = seed.trim();
  if (!trimmed) {
    throw new Error("Avatar seed is required.");
  }

  const hash = hashSeed(trimmed);
  const background = pick(AVATAR_PALETTE, hash);
  const accent = pick(AVATAR_ACCENTS, hash >>> 3);
  const foreground = pick(AVATAR_FOREGROUNDS, hash >>> 5);
  const label = buildAvatarLabel(trimmed);
  const offsetA = 16 + (hash % 28);
  const offsetB = 68 - ((hash >>> 7) % 24);
  const radius = 12 + ((hash >>> 11) % 10);
  const tilt = ((hash >>> 13) % 20) - 10;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" role="img" aria-label="${label} avatar">`,
    `<rect width="80" height="80" rx="18" fill="${background}"/>`,
    `<circle cx="${offsetA}" cy="18" r="${radius}" fill="${accent}" opacity="0.65"/>`,
    `<circle cx="${offsetB}" cy="66" r="${radius + 4}" fill="${accent}" opacity="0.42"/>`,
    `<path d="M10 60 Q40 ${44 + tilt} 70 22 L70 80 L10 80 Z" fill="${foreground}" opacity="0.14"/>`,
    `<circle cx="40" cy="32" r="16" fill="${foreground}" opacity="0.92"/>`,
    `<path d="M20 72c4-12 14-18 20-18s16 6 20 18" fill="${foreground}" opacity="0.92"/>`,
    `<text x="40" y="37" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="${background}">${label}</text>`,
    `</svg>`,
  ].join("");
};

export const buildAvatarDataUrl = (seed: string): string => {
  const svg = buildAvatarSvg(seed);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};
