import { buildDeviceAuthStoreKey } from "./device-auth";

export interface DeviceAuthEntry {
  token: string;
  role: string;
  scopes?: string[];
  createdAt: number;
  updatedAt?: number;
}

export interface DeviceAuthStore {
  version: number;
  deviceId: string;
  tokens: Record<string, DeviceAuthEntry>;
}

export interface StoreAdapter {
  readStore(): DeviceAuthStore | null | undefined;
  writeStore(store: DeviceAuthStore): void;
}

export function createEmptyDeviceAuthStore(deviceId: string): DeviceAuthStore {
  return {
    version: 1,
    deviceId: deviceId.trim(),
    tokens: {},
  };
}

export function loadDeviceAuthTokenFromStore(params: {
  adapter: StoreAdapter;
  deviceId: string;
  role: string;
}): DeviceAuthEntry | null {
  const store = params.adapter.readStore();
  if (!store || store.deviceId !== params.deviceId.trim()) return null;
  return store.tokens[params.role.trim()] ?? null;
}

export function storeDeviceAuthTokenInStore(params: {
  adapter: StoreAdapter;
  deviceId: string;
  role: string;
  token: string;
  scopes?: string[];
}): DeviceAuthEntry {
  let store = params.adapter.readStore();
  if (!store || store.deviceId !== params.deviceId.trim()) {
    store = createEmptyDeviceAuthStore(params.deviceId);
  }
  const now = Date.now();
  const entry: DeviceAuthEntry = {
    token: params.token.trim(),
    role: params.role.trim(),
    scopes: params.scopes?.map((scope) => scope.trim()).filter(Boolean),
    createdAt: loadDeviceAuthTokenFromStore(params)?.createdAt ?? now,
    updatedAt: now,
  };
  store.tokens[params.role.trim()] = entry;
  params.adapter.writeStore(store);
  return entry;
}

export function clearDeviceAuthTokenFromStore(params: {
  adapter: StoreAdapter;
  deviceId: string;
  role: string;
}): void {
  const store = params.adapter.readStore();
  if (!store) return;
  delete store.tokens[params.role.trim()];
  params.adapter.writeStore(store);
}

export function listDeviceAuthEntries(params: {
  adapter: StoreAdapter;
  deviceId: string;
}): Array<DeviceAuthEntry & { key: string }> {
  const store = params.adapter.readStore();
  if (!store || store.deviceId !== params.deviceId.trim()) return [];
  return Object.values(store.tokens)
    .map((entry) => ({
      ...entry,
      key: buildDeviceAuthStoreKey(store.deviceId, entry.role),
    }))
    .sort((left, right) => (right.updatedAt ?? right.createdAt) - (left.updatedAt ?? left.createdAt));
}
