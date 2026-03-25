"use client";

import { useMemo, useReducer } from "react";

import type {
  OfficeMap,
  OfficeMapObject,
  OfficeLightObject,
  OfficeAmbienceEmitter,
  OfficeInteractionPoint,
} from "@/lib/office/schema";

type BuilderHistory = {
  past: OfficeMap[];
  present: OfficeMap;
  future: OfficeMap[];
};

type BuilderSelection = {
  objectIds: string[];
};

type BuilderUi = {
  zoom: number;
  panX: number;
  panY: number;
  snapToGrid: boolean;
};

type BuilderState = {
  history: BuilderHistory;
  selection: BuilderSelection;
  ui: BuilderUi;
};

type BuilderAction =
  | { type: "select"; ids: string[] }
  | { type: "moveObject"; id: string; x: number; y: number }
  | { type: "rotateSelected"; step: number }
  | { type: "flipSelected"; axis: "x" | "y" }
  | { type: "setLayerOrder"; id: string; zIndex: number }
  | { type: "toggleSnap" }
  | { type: "setZoom"; zoom: number }
  | { type: "setPan"; x: number; y: number }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "replaceMap"; map: OfficeMap }
  | { type: "addLight"; light: OfficeLightObject }
  | { type: "addEmitter"; emitter: OfficeAmbienceEmitter }
  | { type: "addInteractionPoint"; point: OfficeInteractionPoint };

const cloneMap = (map: OfficeMap): OfficeMap => structuredClone(map);

const pushHistory = (history: BuilderHistory, present: OfficeMap): BuilderHistory => ({
  past: [...history.past.slice(-49), cloneMap(history.present)],
  present,
  future: [],
});

const updateObjects = (map: OfficeMap, updater: (entry: OfficeMapObject) => OfficeMapObject): OfficeMap => {
  return {
    ...map,
    objects: map.objects.map(updater),
  };
};

const reducer = (state: BuilderState, action: BuilderAction): BuilderState => {
  if (action.type === "select") {
    return {
      ...state,
      selection: {
        objectIds: action.ids,
      },
    };
  }
  if (action.type === "replaceMap") {
    return {
      ...state,
      history: pushHistory(state.history, cloneMap(action.map)),
    };
  }
  if (action.type === "moveObject") {
    const map = updateObjects(state.history.present, (entry) =>
      entry.id === action.id ? { ...entry, x: action.x, y: action.y } : entry
    );
    return { ...state, history: pushHistory(state.history, map) };
  }
  if (action.type === "rotateSelected") {
    const selected = new Set(state.selection.objectIds);
    const map = updateObjects(state.history.present, (entry) =>
      selected.has(entry.id)
        ? { ...entry, rotation: (((entry.rotation + action.step) % 360) + 360) % 360 }
        : entry
    );
    return { ...state, history: pushHistory(state.history, map) };
  }
  if (action.type === "flipSelected") {
    const selected = new Set(state.selection.objectIds);
    const map = updateObjects(state.history.present, (entry) => {
      if (!selected.has(entry.id)) return entry;
      return action.axis === "x" ? { ...entry, flipX: !entry.flipX } : { ...entry, flipY: !entry.flipY };
    });
    return { ...state, history: pushHistory(state.history, map) };
  }
  if (action.type === "setLayerOrder") {
    const map = updateObjects(state.history.present, (entry) =>
      entry.id === action.id ? { ...entry, zIndex: action.zIndex } : entry
    );
    return { ...state, history: pushHistory(state.history, map) };
  }
  if (action.type === "toggleSnap") {
    return {
      ...state,
      ui: {
        ...state.ui,
        snapToGrid: !state.ui.snapToGrid,
      },
    };
  }
  if (action.type === "setZoom") {
    return {
      ...state,
      ui: {
        ...state.ui,
        zoom: action.zoom,
      },
    };
  }
  if (action.type === "setPan") {
    return {
      ...state,
      ui: {
        ...state.ui,
        panX: action.x,
        panY: action.y,
      },
    };
  }
  if (action.type === "addLight") {
    const map: OfficeMap = {
      ...state.history.present,
      lights: [...(state.history.present.lights ?? []), action.light],
    };
    return { ...state, history: pushHistory(state.history, map) };
  }
  if (action.type === "addEmitter") {
    const map: OfficeMap = {
      ...state.history.present,
      ambienceEmitters: [...(state.history.present.ambienceEmitters ?? []), action.emitter],
    };
    return { ...state, history: pushHistory(state.history, map) };
  }
  if (action.type === "addInteractionPoint") {
    const map: OfficeMap = {
      ...state.history.present,
      interactionPoints: [...(state.history.present.interactionPoints ?? []), action.point],
    };
    return { ...state, history: pushHistory(state.history, map) };
  }
  if (action.type === "undo") {
    const previous = state.history.past[state.history.past.length - 1];
    if (!previous) return state;
    return {
      ...state,
      history: {
        past: state.history.past.slice(0, -1),
        present: previous,
        future: [cloneMap(state.history.present), ...state.history.future],
      },
    };
  }
  if (action.type === "redo") {
    const next = state.history.future[0];
    if (!next) return state;
    return {
      ...state,
      history: {
        past: [...state.history.past, cloneMap(state.history.present)],
        present: next,
        future: state.history.future.slice(1),
      },
    };
  }
  return state;
};

export const useOfficeBuilderStore = (initialMap: OfficeMap) => {
  const [state, dispatch] = useReducer(reducer, {
    history: {
      past: [],
      present: cloneMap(initialMap),
      future: [],
    },
    selection: {
      objectIds: [],
    },
    ui: {
      zoom: 1,
      panX: 0,
      panY: 0,
      snapToGrid: true,
    },
  });

  return useMemo(
    () => ({
      map: state.history.present,
      selection: state.selection,
      ui: state.ui,
      canUndo: state.history.past.length > 0,
      canRedo: state.history.future.length > 0,
      select: (ids: string[]) => dispatch({ type: "select", ids }),
      moveObject: (id: string, x: number, y: number) => dispatch({ type: "moveObject", id, x, y }),
      rotateSelected: (step: number) => dispatch({ type: "rotateSelected", step }),
      flipSelected: (axis: "x" | "y") => dispatch({ type: "flipSelected", axis }),
      setLayerOrder: (id: string, zIndex: number) => dispatch({ type: "setLayerOrder", id, zIndex }),
      toggleSnap: () => dispatch({ type: "toggleSnap" }),
      setZoom: (zoom: number) => dispatch({ type: "setZoom", zoom }),
      setPan: (x: number, y: number) => dispatch({ type: "setPan", x, y }),
      undo: () => dispatch({ type: "undo" }),
      redo: () => dispatch({ type: "redo" }),
      replaceMap: (map: OfficeMap) => dispatch({ type: "replaceMap", map }),
      addLight: (light: OfficeLightObject) => dispatch({ type: "addLight", light }),
      addEmitter: (emitter: OfficeAmbienceEmitter) => dispatch({ type: "addEmitter", emitter }),
      addInteractionPoint: (point: OfficeInteractionPoint) =>
        dispatch({ type: "addInteractionPoint", point }),
    }),
    [state.history.future.length, state.history.past.length, state.history.present, state.selection, state.ui]
  );
};
