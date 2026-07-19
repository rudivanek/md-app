import { useState, useEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Folder as FolderIcon,
  FolderOpen,
  Star,
  Trash2,
  GripVertical,
  MoreHorizontal,
  MoveRight,
} from 'lucide-react';
import type { Item } from '../types';
import { itemLabel } from '../types';

interface Props {
  item: Item;
  depth: number;
  isActive: boolean;
  isSelectedFolder: boolean;
  isDragOver: boolean;
  isAnyDragging: boolean;
  onSelect: (id: string) => void;
  onSelectFolder: (id: string) => void;
  onToggleCollapsed: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onMoveToFolder: (id: string) => void;
  autoEditId: string | null;
  onClearAutoEdit: () => void;
}

export function SortableTreeItem({
  item,
  depth,
  isActive,
  isSelectedFolder,
  isDragOver,
  isAnyDragging,
  onSelect,
  onSelectFolder,
  onToggleCollapsed,
  onToggleFavorite,
  onDelete,
  onRename,
  onMoveToFolder,
  autoEditId,
  onClearAutoEdit,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  useEffect(() => {
    if (autoEditId === item.id && !editing) {
      setEditValue(itemLabel(item));
      setEditing(true);
      onClearAutoEdit();
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          el.select();
        }
      });
    }
  }, [autoEditId, item, editing, onClearAutoEdit]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    paddingLeft: `${depth * 12 + 8}px`,
  };

  const isFolder = item.type === 'folder';
  const collapsed = isFolder && item.collapsed;
  const isFolderDropTarget = isDragOver && isFolder && !isDragging;
  // Selected-folder highlight is distinct from active-note highlight:
  // a subtle green-tinted background + ring, shown only on folders.
  const isSelectedFolderHighlight =
    isSelectedFolder && isFolder && !isFolderDropTarget && !isDragging;

  function startRename() {
    setEditValue(itemLabel(item));
    setEditing(true);
  }

  function commitRename() {
    const trimmed = editValue.trim();
    if (trimmed) onRename(item.id, trimmed);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') setEditing(false);
  }

  // While a drag is active, folder rows get a taller, more prominent drop
  // band so they're a bigger/easier target than a normal row. Notes get a
  // subtle dim so folders visually "pop" as drop targets.
  const dropBandClass = isAnyDragging && isFolder
    ? isFolderDropTarget
      ? 'py-[14px] ring-2 ring-[#7c6af7] bg-[#7c6af725] shadow-[0_0_0_3px_#7c6af720] rounded-md'
      : 'py-[10px] ring-1 ring-[#3a3a3a] rounded-md'
    : 'py-[5px]';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-1 pr-2 ${dropBandClass} cursor-pointer select-none transition-all ${
        isFolderDropTarget
          ? ''
          : isSelectedFolderHighlight
          ? 'bg-[#1e2a1e] text-[#7c6af7] ring-1 ring-[#3a5a3a] rounded-md'
          : isActive
          ? 'bg-[#252525] text-[#e0e0e0] rounded-md'
          : 'text-[#888] hover:bg-[#1e1e1e] hover:text-[#bbb] rounded-md'
      } ${isAnyDragging && !isFolder && !isDragOver ? 'opacity-50' : ''}`}
      onClick={() => {
        if (isFolder) onSelectFolder(item.id);
        else onSelect(item.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        startRename();
      }}
    >
      {/* Drag handle */}
      <span
        {...attributes}
        {...listeners}
        className="flex-shrink-0 opacity-0 group-hover:opacity-40 hover:!opacity-70 cursor-grab active:cursor-grabbing text-[#555]"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={12} />
      </span>

      {/* Folder chevron */}
      {isFolder ? (
        <span className={`flex-shrink-0 ${isFolderDropTarget ? 'text-[#7c6af7]' : 'text-[#555]'}`}>
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </span>
      ) : (
        <span className="w-3 flex-shrink-0" />
      )}

      {/* Icon */}
      <span className={`flex-shrink-0 ${isFolderDropTarget ? 'text-[#7c6af7]' : isActive ? 'text-[#7c6af7]' : 'text-[#444] group-hover:text-[#666]'}`}>
        {isFolder ? (
          collapsed ? <FolderIcon size={13} /> : <FolderOpen size={13} />
        ) : (
          <FileText size={13} />
        )}
      </span>

      {/* Label / rename input */}
      {editing ? (
        <input
          ref={inputRef}
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-[#2a2a2a] border border-[#3a3a3a] rounded px-1 text-xs text-[#e0e0e0] focus:outline-none"
        />
      ) : (
        <span className={`flex-1 min-w-0 truncate text-xs font-medium ${isFolderDropTarget ? 'text-[#9d8fff]' : ''}`}>
          {itemLabel(item)}
        </span>
      )}

      {/* Action buttons — hidden while a drag is in progress so they don't
          interfere with the drop target hit area. */}
      {!isAnyDragging && (
        <>
          <span
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(item.id);
            }}
            className={`flex-shrink-0 p-0.5 rounded transition-all ${
              item.favorite
                ? 'opacity-100 text-[#f5c542]'
                : 'opacity-0 group-hover:opacity-60 text-[#555] hover:text-[#f5c542]'
            }`}
            role="button"
            aria-label="Toggle favorite"
          >
            <Star size={11} fill={item.favorite ? 'currentColor' : 'none'} />
          </span>

          <span
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
            className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-60 text-[#555] hover:text-[#e06c6c] hover:opacity-100 transition-all"
            role="button"
            aria-label="Delete"
          >
            <Trash2 size={11} />
          </span>

          <span
            onClick={(e) => {
              e.stopPropagation();
              onMoveToFolder(item.id);
            }}
            className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-60 text-[#555] hover:text-[#7c6af7] hover:opacity-100 transition-all"
            role="button"
            aria-label="Move to folder"
            title="Move to folder..."
          >
            <MoreHorizontal size={11} />
          </span>
        </>
      )}
    </div>
  );
}
