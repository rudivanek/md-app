import { useState } from 'react';
import { FolderOpen, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { isFsApiSupported, pickRootDirectory, verifyPermission } from '../fileSystem';

interface Props {
  onConnected: (handle: FileSystemDirectoryHandle) => void;
  savedHandle: FileSystemDirectoryHandle | null;
}

export function FolderPicker({ onConnected, savedHandle }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = isFsApiSupported();

  async function handlePick() {
    setBusy(true);
    setError(null);
    try {
      const handle = await pickRootDirectory();
      onConnected(handle);
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') {
        setError('Could not access that folder. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleReconnect() {
    if (!savedHandle) return;
    setBusy(true);
    setError(null);
    try {
      const granted = await verifyPermission(savedHandle, true);
      if (granted) {
        onConnected(savedHandle);
      } else {
        setError('Permission denied. Please choose the folder again.');
      }
    } catch {
      setError('Could not reconnect to the saved folder.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[#1a1a1a] text-[#dcddde] font-sans">
      <div className="w-full max-w-md mx-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#7c6af7] flex items-center justify-center mb-6 shadow-lg shadow-[#7c6af7]/20">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>

          <h1 className="text-xl font-semibold text-[#e0e0e0] mb-2">
            My-Notes
          </h1>

          {!supported ? (
            <div className="mt-4 px-5 py-4 rounded-lg bg-[#2a1a1a] border border-[#5a3030] text-left">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-[#e0a040] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[#e0c0a0] mb-1">
                    Browser not supported
                  </p>
                  <p className="text-xs text-[#a08070] leading-relaxed">
                    This app uses the File System Access API to read and write
                    markdown files directly to a folder on your computer. That
                    requires a Chromium-based browser such as{' '}
                    <span className="text-[#e0c0a0]">Chrome</span>,{' '}
                    <span className="text-[#e0c0a0]">Edge</span>, or{' '}
                    <span className="text-[#e0c0a0]">Brave</span>. Firefox and
                    Safari do not support this feature yet.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-[#888] leading-relaxed mb-8 max-w-sm">
                Choose a folder on your computer to store your markdown notes.
                Files are saved directly to disk — no cloud, no lock-in.
              </p>

              {savedHandle && (
                <button
                  onClick={handleReconnect}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#252525] border border-[#333] text-sm font-medium text-[#ddd] hover:bg-[#2a2a2a] hover:border-[#444] disabled:opacity-50 transition-colors mb-3"
                >
                  {busy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RefreshCw size={16} className="text-[#7c6af7]" />
                  )}
                  Reconnect to "{savedHandle.name}"
                </button>
              )}

              <button
                onClick={handlePick}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#7c6af7] text-sm font-semibold text-white hover:bg-[#8d7dff] disabled:opacity-50 transition-colors shadow-md shadow-[#7c6af7]/20"
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FolderOpen size={16} />
                )}
                {savedHandle ? 'Choose a different folder' : 'Choose folder'}
              </button>

              {error && (
                <p className="mt-4 text-xs text-[#e06c6c]">{error}</p>
              )}

              <p className="mt-6 text-[11px] text-[#555] leading-relaxed max-w-xs">
                Your browser will ask for permission to access the folder.
                You'll need to grant access each time you reload the page —
                this is a browser security requirement.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
