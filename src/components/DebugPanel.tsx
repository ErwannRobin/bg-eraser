import { useSyncExternalStore } from 'react';
import { clearDebugLog, debugEnabled, getDebugLog, subscribeDebugLog } from '@/utils/debugLog';

// On-screen log, shown with ?debug=1. Logs from before a crash are kept (see debugLog.ts).
const DebugPanel = () => {
  const lines = useSyncExternalStore(subscribeDebugLog, getDebugLog);
  if (!debugEnabled) return null;

  const copy = () => navigator.clipboard?.writeText(lines.join('\n')).catch(() => undefined);

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] max-h-[45vh] overflow-auto border-t bg-black/90 p-2 font-mono text-[10px] leading-tight text-green-300">
      <div className="mb-1 flex gap-2">
        <button className="rounded border px-2 py-0.5" onClick={copy}>Copy</button>
        <button className="rounded border px-2 py-0.5" onClick={clearDebugLog}>Clear</button>
        <span className="opacity-70">{lines.length} lines (kept after a crash)</span>
      </div>
      {lines.map((line, i) => (
        <div key={i} className="break-all">{line}</div>
      ))}
    </div>
  );
};

export default DebugPanel;
