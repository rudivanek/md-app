import { useNotes } from './hooks/useNotes';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';

export default function App() {
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
  } = useNotes();

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
