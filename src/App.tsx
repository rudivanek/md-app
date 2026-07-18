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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadFolderHandle();
      if (!cancelled) {
        setSavedHandle(stored);
        setBootChecked(true);
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
    },
    []
  );

  const handleDisconnect = useCallback(async () => {
    await clearFolderHandle();
    setRootHandle(null);
    setSavedHandle(null);
  }, []);

  if (!bootChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1a1a1a]">
        <div className="w-5 h-5 border-2 border-[#7c6af7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!rootHandle) {
    return (
      <FolderPicker onConnected={handleConnected} savedHandle={savedHandle} />
    );
  }

  return (
    <AppShell
      key={rootHandle.name}
      rootHandle={rootHandle}
      onDisconnect={handleDisconnect}
    />
  );
}

interface AppShellProps {
  rootHandle: FileSystemDirectoryHandle;
  onDisconnect: () => void;
}

function AppShell({ rootHandle, onDisconnect }: AppShellProps) {
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
        folderName={rootHandle.name}
        onDisconnect={onDisconnect}
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
