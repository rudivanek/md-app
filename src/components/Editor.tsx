import { useState, useEffect } from 'react';
import { CheckCircle, Loader2, Eye, Code as CodeIcon, Columns2, AlertCircle, X } from 'lucide-react';
import type { Note } from '../types';
import type { SaveStatus, ConflictInfo } from '../hooks/useNotes';
import { FormattingToolbar } from './FormattingToolbar';
import { MarkdownPreview } from './MarkdownPreview';
import { useCodeMirror } from '../codemirror/useCodeMirror';

type ViewMode = 'source' | 'preview' | 'split';

interface Props {
  note: Note | undefined;
  saveStatus: SaveStatus;
  onUpdateContent: (id: string, content: string) => void;
  conflict: ConflictInfo | null;
  onResolveKeepMine: () => void;
  onResolveReload: () => void;
  onDismissConflict: () => void;
}

export function Editor({
  note,
  saveStatus,
  onUpdateContent,
  conflict,
  onResolveKeepMine,
  onResolveReload,
  onDismissConflict,
}: Props) {
  const [mode, setMode] = useState<ViewMode>('source');

  const { parentRef, view } = useCodeMirror({
    noteId: note?.id ?? '',
    initialDoc: note?.content ?? '',
    onChange: (doc) => {
      if (note) onUpdateContent(note.id, doc);
    },
  });

  useEffect(() => {
    if (mode !== 'preview' && view) view.focus();
  }, [mode, view]);

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-[#1e1e1e] flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <p className="text-[#444] text-sm">Select a note or create a new one</p>
        </div>
      </div>
    );
  }

  const wordCount = note.content.trim().split(/\s+/).filter(Boolean).length;
  const charCount = note.content.length;

  const viewToggle = (m: ViewMode, Icon: typeof Eye, label: string, title: string) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={() => setMode(m)}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
        mode === m
          ? 'bg-[#252525] text-[#ddd]'
          : 'text-[#666] hover:bg-[#1e1e1e] hover:text-[#aaa]'
      }`}
    >
      <Icon size={12} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top header */}
      <header className="h-11 flex-shrink-0 flex items-center justify-between px-4 border-b border-[#2a2a2a] bg-[#1a1a1a]">
        <span className="text-xs text-[#555] font-medium truncate">{note.title}</span>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-0.5 bg-[#141414] rounded-md p-0.5 border border-[#222]">
            {viewToggle('source', CodeIcon, 'Edit', 'Source view')}
            {viewToggle('split', Columns2, 'Split', 'Split view')}
            {viewToggle('preview', Eye, 'Preview', 'Preview view')}
          </div>
          <SaveIndicator status={saveStatus} />
        </div>
      </header>

      {/* Formatting toolbar (hidden in pure preview mode) */}
      {mode !== 'preview' && <FormattingToolbar view={view} />}

      {/* Editor / preview area */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div
          className={`${
            mode === 'split' ? 'w-1/2 border-r border-[#2a2a2a]' : mode === 'source' ? 'w-full' : 'hidden'
          } flex-1 min-h-0 overflow-y-auto`}
        >
          <div className="max-w-3xl mx-auto px-8 py-6 h-full">
            <div ref={parentRef} className="h-full cm-host" />
          </div>
        </div>

        {(mode === 'preview' || mode === 'split') && (
          <div
            className={`${
              mode === 'split' ? 'w-1/2' : 'w-full'
            } flex-1 min-h-0 overflow-y-auto bg-[#161616]`}
          >
            <div className="max-w-3xl mx-auto px-8 py-6">
              <MarkdownPreview content={note.content} />
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex-shrink-0 h-7 flex items-center gap-4 px-6 border-t border-[#222] bg-[#141414]">
        <span className="text-[10px] text-[#444]">{wordCount} words</span>
        <span className="text-[10px] text-[#444]">{charCount} chars</span>
        <span className="text-[10px] text-[#444] ml-auto">
          {new Date(note.updatedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {conflict && (
        <ConflictDialog
          conflict={conflict}
          onKeepMine={onResolveKeepMine}
          onReload={onResolveReload}
          onDismiss={onDismissConflict}
        />
      )}
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'saving') {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <Loader2 size={11} className="text-[#555] animate-spin" />
        <span className="text-[#888]">Saving...</span>
      </div>
    );
  }
  if (status === 'save-failed') {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <AlertCircle size={11} className="text-[#e06c6c]" />
        <span className="text-[#e06c6c]">Save failed</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <CheckCircle size={11} className="text-[#4a9e6b]" />
      <span className="text-[#4a4a4a]">Saved</span>
    </div>
  );
}

function ConflictDialog({
  conflict,
  onKeepMine,
  onReload,
  onDismiss,
}: {
  conflict: ConflictInfo;
  onKeepMine: () => void;
  onReload: () => void;
  onDismiss: () => void;
}) {
  const [view, setView] = useState<'buttons' | 'both'>('buttons');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl mx-6 bg-[#1e1e1e] border border-[#333] rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={16} className="text-[#e0a040]" />
            <h2 className="text-sm font-semibold text-[#e0e0e0]">
              File changed on disk
            </h2>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 rounded text-[#555] hover:text-[#ccc] hover:bg-[#2a2a2a] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-[#888] leading-relaxed mb-4">
            <span className="text-[#ccc]">{conflict.title}</span> was modified
            outside this app since you started editing. Choose how to resolve.
          </p>

          {view === 'both' ? (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[#666] mb-1.5">
                  Mine
                </p>
                <pre className="text-[11px] text-[#aaa] bg-[#141414] border border-[#222] rounded-md p-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono">
                  {conflict.mine}
                </pre>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[#666] mb-1.5">
                  Disk
                </p>
                <pre className="text-[11px] text-[#aaa] bg-[#141414] border border-[#222] rounded-md p-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono">
                  {conflict.disk}
                </pre>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onKeepMine}
              className="px-3.5 py-2 rounded-md bg-[#7c6af7] text-xs font-semibold text-white hover:bg-[#8d7dff] transition-colors"
            >
              Keep mine
            </button>
            <button
              onClick={onReload}
              className="px-3.5 py-2 rounded-md bg-[#252525] border border-[#333] text-xs font-medium text-[#ddd] hover:bg-[#2a2a2a] transition-colors"
            >
              Reload from disk
            </button>
            <button
              onClick={() => setView((v) => (v === 'buttons' ? 'both' : 'buttons'))}
              className="px-3.5 py-2 rounded-md bg-transparent border border-[#333] text-xs font-medium text-[#aaa] hover:bg-[#222] transition-colors"
            >
              {view === 'both' ? 'Hide versions' : 'View both'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
