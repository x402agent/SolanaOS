export type CuratedVoiceOption = {
  id: string | null;
  label: string;
  description: string;
};

export const CURATED_ELEVENLABS_VOICES: CuratedVoiceOption[] = [
  {
    id: null,
    label: "Rachel",
    description: "Balanced and conversational.",
  },
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    label: "Bella",
    description: "Warm and friendly.",
  },
  {
    id: "MF3mGyEYCl7XYWbV9V6O",
    label: "Elli",
    description: "Clear and upbeat.",
  },
  {
    id: "ErXwobaYiN019PkySvjV",
    label: "Antoni",
    description: "Calm and professional.",
  },
  {
    id: "TxGEqnHWrfWFTfGW9XjX",
    label: "Josh",
    description: "Steady and confident.",
  },
  {
    id: "pNInz6obpgDQGcFmaJgB",
    label: "Adam",
    description: "Deep and authoritative.",
  },
];
