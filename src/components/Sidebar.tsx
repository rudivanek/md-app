import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus, FolderPlus, Search, Unlink } from 'lucide-react';
import type { Item } from '../types';
import { itemLabel } from '../types';
import { SortableTreeItem } from './SortableTreeItem';
import { FavoritesSection } from './FavoritesSection';

interface FlatItem {
  item: Item;
  depth: number;
}

function flattenTree(
  items: Item[],
  parentId: string | null = null,
  depth = 0
): FlatItem[] {
  const children = items
    .filter((i) => i.parentId === parentId)
    .sort((a, b) => a.order - b.order);

  const result: FlatItem[] = [];
  for (const child of children) {
    result.push({ item: child, depth });
    if (child.type === 'folder' && !child.collapsed) {
      result.push(...flattenTree(items, child.id, depth + 1));
    }
  }
  return result;
}

interface Props {
  items: Item[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onCreateFolder: () => void;
  onToggleFavorite: (id: string) => void;
  onToggleCollapsed: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onMove: (dragId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
  folderName: string;
  onDisconnect: () => void;
  rootHandle: FileSystemDirectoryHandle | null;
}

export function Sidebar({
  items,
  activeNoteId,
  onSelectNote,
  onCreateNote,
  onCreateFolder,
  onToggleFavorite,
  onToggleCollapsed,
  onDelete,
  onRename,
  onMove,
  folderName,
  onDisconnect,
  rootHandle,
}: Props) {
  const [search, setSearch] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filteredItems = search.trim()
    ? items.filter((i) =>
        itemLabel(i).toLowerCase().includes(search.toLowerCase())
      )
    : items;

  const flatTree = flattenTree(filteredItems);
  const flatIds = flatTree.map((f) => f.item.id);

  const draggedItem = dragId ? items.find((i) => i.id === dragId) : null;

  function handleDragStart(event: DragStartEvent) {
    setDragId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    setOverId(event.over?.id as string | null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDragId(null);
    setOverId(null);

    if (!over || active.id === over.id) return;

    const overItem = items.find((i) => i.id === over.id);
    const activeItem = items.find((i) => i.id === active.id);
    if (!overItem || !activeItem) return;

    if (overItem.type === 'folder') {
      onMove(active.id as string, over.id as string, 'inside');
    } else {
      const activeIdx = flatIds.indexOf(active.id as string);
      const overIdx = flatIds.indexOf(over.id as string);
      const position = activeIdx > overIdx ? 'before' : 'after';
      onMove(active.id as string, over.id as string, position);
    }
  }

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col bg-[#141414] border-r border-[#2a2a2a] overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded bg-[#7c6af7] flex items-center justify-center flex-shrink-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-[#e0e0e0] tracking-wide truncate">
            {folderName}
          </span>
          <button
            onClick={onDisconnect}
            title={rootHandle ? 'Disconnect folder' : 'Connect a folder'}
            className="ml-auto p-1 rounded text-[#555] hover:text-[#7c6af7] hover:bg-[#1e1e1e] transition-colors flex-shrink-0"
          >
            <Unlink size={13} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#555]"
          />
          <input
            type="text"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-md pl-8 pr-3 py-1.5 text-xs text-[#aaa] placeholder-[#555] focus:outline-none focus:border-[#3a3a3a] focus:text-[#ddd] transition-colors"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-3 pb-2 flex gap-1 flex-shrink-0">
        <button
          onClick={onCreateNote}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium text-[#7c6af7] hover:bg-[#1e1e1e] hover:text-[#9d8fff] transition-colors"
        >
          <Plus size={13} />
          New note
        </button>
        <button
          onClick={onCreateFolder}
          className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-[#555] hover:bg-[#1e1e1e] hover:text-[#888] transition-colors"
          title="New folder"
        >
          <FolderPlus size={13} />
        </button>
      </div>

      {/* Favorites */}
      <div className="flex-shrink-0">
        <FavoritesSection
          items={items}
          activeId={activeNoteId}
          onSelect={onSelectNote}
          onToggleFavorite={onToggleFavorite}
        />
      </div>

      {/* Section label */}
      <div className="px-4 pb-1 flex-shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-[#444] font-semibold">
          {search
            ? `${flatTree.length} result${flatTree.length !== 1 ? 's' : ''}`
            : `${items.length} item${items.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {flatTree.length === 0 ? (
          <div className="px-2 py-6 text-center text-[#444] text-xs">
            {search ? 'No results' : 'No notes yet'}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={flatIds}
              strategy={verticalListSortingStrategy}
            >
              {flatTree.map(({ item, depth }) => (
                <SortableTreeItem
                  key={item.id}
                  item={item}
                  depth={depth}
                  isActive={item.id === activeNoteId}
                  isDragOver={overId === item.id && dragId !== item.id}
                  onSelect={onSelectNote}
                  onToggleCollapsed={onToggleCollapsed}
                  onToggleFavorite={onToggleFavorite}
                  onDelete={onDelete}
                  onRename={onRename}
                />
              ))}
            </SortableContext>

            <DragOverlay>
              {draggedItem ? (
                <div className="flex items-center gap-2 px-2 py-[5px] rounded-md bg-[#2a2a2a] border border-[#3a3a3a] text-[#bbb] text-xs font-medium shadow-xl opacity-90">
                  <span className="truncate max-w-[160px]">
                    {itemLabel(draggedItem)}
                  </span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </aside>
  );
}
