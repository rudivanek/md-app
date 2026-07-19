import { useEffect, useRef } from 'react';
import { Folder as FolderIcon, Home, X } from 'lucide-react';
import type { Folder } from '../types';

interface Props {
  open: boolean;
  noteId: string | null;
  folders: Folder[];
  onPick: (folderId: string | null) => void;
  onClose: () => void;
}

export function MoveToFolderModal({
  open,
  noteId,
  folders,
  onPick,
  onClose,
}: Props) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    requestAnimationFrame(() => closeRef.current?.focus());
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !noteId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-xl bg-[#1c1c1c] border border-[#2a2a2a] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
          <h2 className="text-sm font-semibold text-[#e0e0e0]">Move note to…</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            className="p-1 rounded text-[#555] hover:text-[#e0e0e0] hover:bg-[#2a2a2a] transition-colors"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto py-1">
          <button
            onClick={() => onPick(null)}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs text-[#bbb] hover:bg-[#252525] transition-colors"
          >
            <Home size={14} className="text-[#666] flex-shrink-0" />
            <span>Root (no folder)</span>
          </button>
          {folders.length > 0 && (
            <div className="px-4 pt-2 pb-1">
              <span className="text-[10px] uppercase tracking-widest text-[#444] font-semibold">
                Folders
              </span>
            </div>
          )}
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => onPick(f.id)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs text-[#bbb] hover:bg-[#252525] transition-colors"
            >
              <FolderIcon size={14} className="text-[#7c6af7] flex-shrink-0" />
              <span className="truncate">{f.name}</span>
            </button>
          ))}
          {folders.length === 0 && (
            <div className="px-4 py-3 text-xs text-[#555]">
              No folders yet. Create one with the folder button in the sidebar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
