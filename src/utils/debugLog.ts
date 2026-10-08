// Debug helpers, enabled with URL parameters:
//   ?debug=1          show the on-screen log panel
//   ?device=wasm      force the WASM backend ("webgpu" forces WebGPU)
// The panel also has a button for the device; the choice is saved in localStorage.
// Logs always go to the console. They are also saved in localStorage, so they survive
// the page reload that follows an iOS Safari tab crash.

const STORAGE_KEY = 'bg-eraser-debug-log';
const MAX_ENTRIES = 300;

const params = new URLSearchParams(window.location.search);

export const debugEnabled = params.get('debug') === '1';
const DEVICE_KEY = 'bg-eraser-device';
type Device = 'wasm' | 'webgpu';

function readDevice(): Device | null {
  const fromUrl = params.get('device');
  if (fromUrl === 'wasm' || fromUrl === 'webgpu') return fromUrl;
  try {
    const saved = localStorage.getItem(DEVICE_KEY);
    return saved === 'wasm' || saved === 'webgpu' ? saved : null;
  } catch {
    return null;
  }
}

export const forcedDevice: Device | null = readDevice();

// Cycle auto -> wasm -> webgpu -> auto, then reload so the model is loaded again.
export function cycleDevice(): void {
  const next = forcedDevice === null ? 'wasm' : forcedDevice === 'wasm' ? 'webgpu' : null;
  try {
    if (next) localStorage.setItem(DEVICE_KEY, next);
    else localStorage.removeItem(DEVICE_KEY);
  } catch {
    // ignore
  }
  // drop ?device= from the URL, otherwise it would win over the saved choice
  const url = new URL(window.location.href);
  url.searchParams.delete('device');
  window.location.replace(url.toString());
}

const sessionId = Math.random().toString(36).slice(2, 6);
const startTime = performance.now();

let entries: string[] = [];
const listeners = new Set<() => void>();

try {
  entries = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
} catch {
  entries = [];
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage may be blocked; the console log still works
  }
}

export function debugLog(message: string, data?: unknown): void {
  const seconds = ((performance.now() - startTime) / 1000).toFixed(2);
  const detail = data === undefined ? '' : ' ' + (typeof data === 'string' ? data : safeStringify(data));
  const line = `[${sessionId} +${seconds}s] ${message}${detail}`;
  console.log('[bg-eraser]', line);
  entries = [...entries, line].slice(-MAX_ENTRIES);
  persist(); // write now: the tab can be killed at any moment
  listeners.forEach((listener) => listener());
}

function safeStringify(value: unknown): string {
  try {
    if (value instanceof Error) return `${value.name}: ${value.message}`;
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const subscribeDebugLog = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getDebugLog = () => entries;
export const clearDebugLog = () => {
  entries = [];
  persist();
  listeners.forEach((listener) => listener());
};

// Log what the browser reports, and every way the page can die or hide.
export function installGlobalDebugHooks(): void {
  debugLog('page loaded', {
    ua: navigator.userAgent,
    gpu: 'gpu' in navigator,
    cores: navigator.hardwareConcurrency,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    forcedDevice,
    url: window.location.href,
  });
  window.addEventListener('error', (e) => debugLog('window error', e.message));
  window.addEventListener('unhandledrejection', (e) => debugLog('unhandled rejection', String(e.reason)));
  window.addEventListener('pagehide', () => debugLog('pagehide'));
  document.addEventListener('visibilitychange', () => debugLog('visibility', document.visibilityState));
}

// Log the WebGPU adapter limits (Safari exposes them; useful to spot memory limits).
export async function logWebGpuInfo(): Promise<void> {
  const gpu = (navigator as Navigator & {
    gpu?: { requestAdapter: () => Promise<{ limits: Record<string, number> } | null> };
  }).gpu;
  if (!gpu) {
    debugLog('WebGPU: not available');
    return;
  }
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      debugLog('WebGPU: no adapter');
      return;
    }
    const { maxBufferSize, maxStorageBufferBindingSize, maxTextureDimension2D } = adapter.limits;
    debugLog('WebGPU adapter limits', { maxBufferSize, maxStorageBufferBindingSize, maxTextureDimension2D });
  } catch (error) {
    debugLog('WebGPU: requestAdapter failed', error);
  }
}
