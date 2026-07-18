import { useState } from 'react';
import { Loader2, RefreshCw, X } from 'lucide-react';

interface Props {
  onRetry: () => Promise<void>;
  onDismiss: () => void;
}

export function ReconnectPrompt({ onRetry, onDismiss }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRetry() {
    setBusy(true);
    setError(null);
    try {
      await onRetry();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-6 bg-[#1e1e1e] border border-[#333] rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-sm font-semibold text-[#e0e0e0]">
            Folder permission lost
          </h2>
          <button
            onClick={onDismiss}
            className="p-1 rounded text-[#555] hover:text-[#ccc] hover:bg-[#2a2a2a] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-5">
          <p className="text-xs text-[#888] leading-relaxed mb-5">
            The browser revoked access to your notes folder — this can happen
            after long inactivity. Reconnect to keep working with your files.
          </p>
          <button
            onClick={handleRetry}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-[#7c6af7] text-xs font-semibold text-white hover:bg-[#8d7dff] disabled:opacity-50 transition-colors"
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Reconnect folder
          </button>
          {error && <p className="mt-3 text-xs text-[#e06c6c]">{error}</p>}
        </div>
      </div>
    </div>
  );
}
