import { X, Info, GitBranch } from 'lucide-react';

interface Props {
  onClose: () => void;
  isDiskMode: boolean;
}

export function AboutPanel({ onClose, isDiskMode }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-6 bg-[#1e1e1e] border border-[#333] rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-2.5">
            <Info size={16} className="text-[#7c6af7]" />
            <h2 className="text-sm font-semibold text-[#e0e0e0]">About My-Notes</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#555] hover:text-[#ccc] hover:bg-[#2a2a2a] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div>
            <p className="text-xs text-[#aaa] leading-relaxed">
              A markdown notes editor that reads and writes <code className="text-[#7c6af7]">.md</code> files
              directly to a folder on your computer using the File System Access API.
              No cloud, no lock-in.
            </p>
          </div>

          <div className="px-3.5 py-3 rounded-md bg-[#141414] border border-[#222]">
            <p className="text-[10px] uppercase tracking-wide text-[#666] mb-1.5">
              Storage mode
            </p>
            <p className="text-xs text-[#aaa]">
              {isDiskMode ? (
                <>
                  <span className="text-[#4a9e6b]">●</span> Disk-backed — files
                  are saved to your chosen folder.
                </>
              ) : (
                <>
                  <span className="text-[#e0a040]">●</span> Local-only — notes are
                  stored in this browser. Connect a folder to save to disk.
                </>
              )}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <GitBranch size={13} className="text-[#7c6af7]" />
              <p className="text-xs font-medium text-[#ccc]">Version history</p>
            </div>
            <p className="text-xs text-[#888] leading-relaxed">
              This app does not track file history. If you want version history,
              run <code className="text-[#7c6af7]">git init</code> in your chosen
              folder yourself — the app will not touch or interfere with a{' '}
              <code className="text-[#7c6af7]">.git</code> folder if one exists.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
