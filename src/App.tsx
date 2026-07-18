import { useState, useEffect, useCallback } from 'react';
import { useNotes } from './hooks/useNotes';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { FolderPicker } from './components/FolderPicker';
import {
  loadFolderHandle,
  saveFolderHandle,
  clearFolderHandle,
} from './db';

export default function App() {
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(
    null
  );
  const [savedHandle, setSavedHandle] = useState<FileSystemDirectoryHandle | null>(
    null
  );
  const [bootChecked, setBootChecked] = useState(false);
  // When true, show the folder picker screen. When false, run in local
  // (IndexedDB-only) mode — used when the File System Access API is blocked
  // (e.g. inside Bolt's preview iframe) or when the user skips connecting.
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadFolderHandle();
      if (!cancelled) {
        setSavedHandle(stored);
        setBootChecked(true);
        // If no folder has ever been connected, start in local mode so the
        // app is usable immediately, even inside an iframe.
        if (!stored) setPickerOpen(false);
      }
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
    />
  );
}

interface AppShellProps {
  rootHandle: FileSystemDirectoryHandle | null;
  onDisconnect: () => void;
  onOpenPicker: () => void;
}

function AppShell({ rootHandle, onDisconnect, onOpenPicker }: AppShellProps) {
  const {
    items,
    loading,
    activeId,
    activeNote,
    saveStatus,
    setActiveId,
    createNote,
    createFolder,
    updateContent,
    renameItem,
    toggleFavorite,
    toggleCollapsed,
    deleteItem,
    moveItem,
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
        onCreateNote={() => createNote(null)}
        onCreateFolder={() => createFolder(null)}
        onToggleFavorite={toggleFavorite}
        onToggleCollapsed={toggleCollapsed}
        onDelete={deleteItem}
        onRename={renameItem}
        onMove={moveItem}
        folderName={rootHandle?.name ?? 'My Notes (local)'}
        onDisconnect={rootHandle ? onDisconnect : onOpenPicker}
        rootHandle={rootHandle}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <Editor
          note={activeNote}
          saveStatus={saveStatus}
          onUpdateContent={updateContent}
        />
      </main>
    </div>
  );
}
