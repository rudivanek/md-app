import { useState, useEffect } from 'react';
import { CheckCircle, Loader2, Eye, Code as CodeIcon, Columns2 } from 'lucide-react';
import type { Note } from '../types';
import type { SaveStatus } from '../hooks/useNotes';
import { FormattingToolbar } from './FormattingToolbar';
import { MarkdownPreview } from './MarkdownPreview';
import { useCodeMirror } from '../codemirror/useCodeMirror';

type ViewMode = 'source' | 'preview' | 'split';

interface Props {
  note: Note | undefined;
  saveStatus: SaveStatus;
  onUpdateContent: (id: string, content: string) => void;
}

export function Editor({ note, saveStatus, onUpdateContent }: Props) {
  const [mode, setMode] = useState<ViewMode>('source');

  const { parentRef, view } = useCodeMirror({
    noteId: note?.id ?? '',
    initialDoc: note?.content ?? '',
    onChange: (doc) => {
      if (note) onUpdateContent(note.id, doc);
    },
  });

  // Focus editor when switching to source/split
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
          <div className="flex items-center gap-1.5 text-xs">
            {saveStatus === 'saving' ? (
              <>
                <Loader2 size={11} className="text-[#555] animate-spin" />
                <span className="text-[#555]">Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle size={11} className="text-[#4a9e6b]" />
                <span className="text-[#4a4a4a]">Saved</span>
              </>
            )}
          </div>
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
    </div>
  );
}
