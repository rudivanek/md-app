import { useState, useEffect, useCallback } from 'react';
import { useNotes } from './hooks/useNotes';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { FolderPicker } from './components/FolderPicker';
import { ReconnectPrompt } from './components/ReconnectPrompt';
import { AboutPanel } from './components/AboutPanel';
import { Info } from 'lucide-react';
import {
  loadFolderHandle,
  saveFolderHandle,
  clearFolderHandle,
} from './db';
import { verifyPermission } from './fileSystem';

export default function App() {
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(
    null
  );
  const [savedHandle, setSavedHandle] = useState<FileSystemDirectoryHandle | null>(
    null
  );
  const [bootChecked, setBootChecked] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadFolderHandle();
      if (cancelled) return;
      setSavedHandle(stored);
      if (stored) {
        // Try to silently reconnect: queryPermission needs no user gesture,
        // and Chrome often remembers granted permission across reloads.
        try {
          const granted = await verifyPermission(stored, true);
          if (cancelled) return;
          if (granted) {
            setRootHandle(stored);
            setPickerOpen(false);
          } else {
            setPickerOpen(true);
          }
        } catch {
          if (!cancelled) setPickerOpen(true);
        }
      } else {
        setPickerOpen(false);
      }
      setBootChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleConnected = useCallback(
    async (handle: FileSystemDirectoryHandle) => {
      await saveFolderHandle(handle);
      setSavedHandle(handle);
      setRootHandle(handle);
      setPickerOpen(false);
    },
    []
  );

  const handleDisconnect = useCallback(async () => {
    await clearFolderHandle();
    setRootHandle(null);
    setSavedHandle(null);
    setPickerOpen(false);
  }, []);

  if (!bootChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1a1a1a]">
        <div className="w-5 h-5 border-2 border-[#7c6af7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (pickerOpen) {
    return (
      <FolderPicker onConnected={handleConnected} savedHandle={savedHandle} />
    );
  }

  return (
    <AppShell
      key={rootHandle?.name ?? 'local'}
      rootHandle={rootHandle}
      onDisconnect={handleDisconnect}
      onOpenPicker={() => setPickerOpen(true)}
      onOpenAbout={() => setAboutOpen(true)}
      onCloseAbout={() => setAboutOpen(false)}
      aboutOpen={aboutOpen}
    />
  );
}

interface AppShellProps {
  rootHandle: FileSystemDirectoryHandle | null;
  onDisconnect: () => void;
  onOpenPicker: () => void;
  onOpenAbout: () => void;
  onCloseAbout: () => void;
  aboutOpen: boolean;
}

function AppShell({
  rootHandle,
  onDisconnect,
  onOpenPicker,
  onOpenAbout,
  onCloseAbout,
  aboutOpen,
}: AppShellProps) {
  const {
    items,
    loading,
    activeId,
    activeNote,
    saveStatus,
    conflict,
    permissionLost,
    buggyMoveArtifacts,
    buggyWarningDismissed,
    dismissBuggyMoveWarning,
    autoEditId,
    clearAutoEdit,
    setActiveId,
    createNote,
    createFolder,
    updateContent,
    renameItem,
    toggleFavorite,
    toggleCollapsed,
    deleteItem,
    moveItem,
    resolveConflictKeepMine,
    resolveConflictReload,
    dismissConflict,
    retryPermission,
  } = useNotes(rootHandle);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1a1a1a]">
        <div className="w-5 h-5 border-2 border-[#7c6af7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#1a1a1a] text-[#dcddde] font-sans overflow-hidden">
      <Sidebar
        items={items}
        activeNoteId={activeId}
        onSelectNote={setActiveId}
        onCreateNote={(parentId) => createNote(parentId)}
        onCreateFolder={(parentId) => createFolder(parentId)}
        onToggleFavorite={toggleFavorite}
        onToggleCollapsed={toggleCollapsed}
        onDelete={deleteItem}
        onRename={renameItem}
        onMove={moveItem}
        folderName={rootHandle?.name ?? 'My Notes (local)'}
        onDisconnect={rootHandle ? onDisconnect : onOpenPicker}
        rootHandle={rootHandle}
        autoEditId={autoEditId}
        onClearAutoEdit={clearAutoEdit}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <Editor
          note={activeNote}
          saveStatus={saveStatus}
          onUpdateContent={updateContent}
          conflict={conflict}
          onResolveKeepMine={resolveConflictKeepMine}
          onResolveReload={resolveConflictReload}
          onDismissConflict={dismissConflict}
        />
      </main>

      <button
        onClick={onOpenAbout}
        title="About"
        className="fixed bottom-3 right-3 z-30 p-2 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] text-[#555] hover:text-[#7c6af7] hover:border-[#3a3a3a] transition-colors shadow-md"
      >
        <Info size={15} />
      </button>

      {buggyMoveArtifacts.length > 0 && !buggyWarningDismissed && (
        <div className="fixed bottom-3 left-3 z-30 max-w-md p-3 rounded-lg bg-[#2a1a1a] border border-[#5a3a3a] text-[#e0c0c0] text-xs shadow-lg">
          <div className="flex items-start gap-2">
            <span className="flex-1">
              <strong className="text-[#e06c6c]">Cleanup needed:</strong>{' '}
              {buggyMoveArtifacts.length} entr{buggyMoveArtifacts.length === 1 ? 'y' : 'ies'} renamed by an old bug (look for "[object FileSystemDirectoryHandle]" on disk) may need manual renaming:
              <ul className="mt-1 ml-4 list-disc text-[#c0a0a0]">
                {buggyMoveArtifacts.slice(0, 5).map((it) => (
                  <li key={it.id} className="truncate">
                    {it.type === 'note' ? it.fileName : it.name}
                  </li>
                ))}
                {buggyMoveArtifacts.length > 5 && (
                  <li className="text-[#806060]">
                    +{buggyMoveArtifacts.length - 5} more
                  </li>
                )}
              </ul>
            </span>
            <button
              onClick={dismissBuggyMoveWarning}
              className="flex-shrink-0 px-2 py-0.5 rounded bg-[#3a2a2a] hover:bg-[#4a3a3a] text-[#e0c0c0] text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {permissionLost && (
        <ReconnectPrompt
          onRetry={retryPermission}
          onDismiss={() => {
            /* keep prompt until resolved */
          }}
        />
      )}

      {aboutOpen && (
        <AboutPanel
          onClose={onCloseAbout}
          isDiskMode={rootHandle !== null}
        />
      )}
    </div>
  );
}
