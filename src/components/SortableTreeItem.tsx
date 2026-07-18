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
} from 'lucide-react';
import type { Item } from '../types';
import { itemLabel } from '../types';

interface Props {
  item: Item;
  depth: number;
  isActive: boolean;
  isDragOver: boolean;
  onSelect: (id: string) => void;
  onToggleCollapsed: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  autoEditId: string | null;
  onClearAutoEdit: () => void;
}

export function SortableTreeItem({
  item,
  depth,
  isActive,
  isDragOver,
  onSelect,
  onToggleCollapsed,
  onToggleFavorite,
  onDelete,
  onRename,
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-1 pr-2 py-[5px] rounded-md cursor-pointer select-none transition-colors ${
        isDragOver && isFolder
          ? 'ring-1 ring-[#7c6af7] bg-[#7c6af720]'
          : isActive
          ? 'bg-[#252525] text-[#e0e0e0]'
          : 'text-[#888] hover:bg-[#1e1e1e] hover:text-[#bbb]'
      }`}
      onClick={() => {
        if (isFolder) onToggleCollapsed(item.id);
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
        <span className="flex-shrink-0 text-[#555]">
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </span>
      ) : (
        <span className="w-3 flex-shrink-0" />
      )}

      {/* Icon */}
      <span className={`flex-shrink-0 ${isActive ? 'text-[#7c6af7]' : 'text-[#444] group-hover:text-[#666]'}`}>
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
        <span className="flex-1 min-w-0 truncate text-xs font-medium">
          {itemLabel(item)}
        </span>
      )}

      {/* Action buttons */}
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
    </div>
  );
}
