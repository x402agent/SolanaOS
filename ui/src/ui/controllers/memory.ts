import type { GatewayBrowserClient } from "../gateway";
import type { MemoryStatus } from "../views/memory";

export type MemoryState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  memoryLoading: boolean;
  memoryStatus: MemoryStatus | null;
  memoryError: string | null;
  memorySweeping: boolean;
  memorySweepResult: string | null;
  memoryDiaryEntry: string | null;
};

export async function loadMemoryStatus(state: MemoryState) {
  if (!state.client || !state.connected) return;
  if (state.memoryLoading) return;
  state.memoryLoading = true;
  state.memoryError = null;
  try {
    const res = await state.client.request("memory.status", {});
    state.memoryStatus = res as MemoryStatus;
  } catch (err) {
    state.memoryError = String(err);
  } finally {
    state.memoryLoading = false;
  }
}

export async function runDreamingSweep(state: MemoryState) {
  if (!state.client || !state.connected) return;
  if (state.memorySweeping) return;
  state.memorySweeping = true;
  state.memorySweepResult = null;
  try {
    const res = await state.client.request("dreaming.sweep", {});
    const r = res as { summary?: string; lastPromoted?: number; lastStaged?: number; diaryEntry?: string };
    const parts: string[] = [];
    if (r.summary) parts.push(r.summary);
    if (r.diaryEntry) {
      state.memoryDiaryEntry = r.diaryEntry;
    }
    // Refresh status after sweep
    await loadMemoryStatus(state);
    state.memorySweepResult = parts.length > 0 ? parts.join("\n") : "Sweep complete.";
  } catch (err) {
    state.memorySweepResult = `Sweep failed: ${String(err)}`;
  } finally {
    state.memorySweeping = false;
  }
}

export async function loadDreamDiary(state: MemoryState) {
  if (!state.client || !state.connected) return;
  try {
    const res = await state.client.request("dreaming.diary", {});
    const r = res as { diaryEntry?: string };
    state.memoryDiaryEntry = r.diaryEntry ?? null;
  } catch {
    // non-fatal
  }
}
