import type { OfficeAgentPresence } from "@/lib/office/presence";
import type { OfficeMap } from "@/lib/office/schema";

export type OfficeDebugSettings = {
  showZones: boolean;
  showAnchors: boolean;
  showEmitterBounds: boolean;
  showLightBounds: boolean;
  showMetrics: boolean;
};

export type OfficeRuntimeSettings = {
  enableAmbience: boolean;
  enableThoughtBubbles: boolean;
  enableLighting: boolean;
};

export type OfficeSceneBridgeState = {
  map: OfficeMap;
  presence: OfficeAgentPresence[];
  debug: OfficeDebugSettings;
  runtime: OfficeRuntimeSettings;
};

export type OfficeSceneBridge = {
  getState: () => OfficeSceneBridgeState;
  setState: (next: Partial<OfficeSceneBridgeState>) => void;
  subscribe: (listener: () => void) => () => void;
};

export const createOfficeSceneBridge = (
  initialState: OfficeSceneBridgeState
): OfficeSceneBridge => {
  let state = initialState;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    setState: (next) => {
      state = {
        ...state,
        ...next,
        debug: {
          ...state.debug,
          ...(next.debug ?? {}),
        },
        runtime: {
          ...state.runtime,
          ...(next.runtime ?? {}),
        },
      };
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
