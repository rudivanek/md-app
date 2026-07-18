import { FileText, Folder as FolderIcon, Star } from 'lucide-react';
import type { Item } from '../types';
import { itemLabel } from '../types';

interface Props {
  items: Item[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export function FavoritesSection({ items, activeId, onSelect, onToggleFavorite }: Props) {
  const favorites = items.filter((i) => i.favorite);
  if (favorites.length === 0) return null;

  return (
    <div className="px-3 pb-2">
      <div className="px-1 pb-1">
        <span className="text-[10px] uppercase tracking-widest text-[#444] font-semibold flex items-center gap-1.5">
          <Star size={9} className="text-[#f5c542]" fill="currentColor" />
          Favorites
        </span>
      </div>
      <div className="space-y-0.5">
        {favorites.map((item) => {
          const isActive = item.id === activeId && item.type === 'note';
          return (
            <button
              key={item.id}
              onClick={() => item.type === 'note' && onSelect(item.id)}
              className={`group w-full flex items-center gap-2 px-2 py-[5px] rounded-md text-left transition-colors ${
                isActive
                  ? 'bg-[#252525] text-[#e0e0e0]'
                  : 'text-[#888] hover:bg-[#1e1e1e] hover:text-[#bbb]'
              } ${item.type === 'folder' ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <span
                className={`flex-shrink-0 ${isActive ? 'text-[#7c6af7]' : 'text-[#444] group-hover:text-[#666]'}`}
              >
                {item.type === 'folder' ? (
                  <FolderIcon size={13} />
                ) : (
                  <FileText size={13} />
                )}
              </span>
              <span className="flex-1 truncate text-xs font-medium">{itemLabel(item)}</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(item.id);
                }}
                className="flex-shrink-0 p-0.5 rounded text-[#f5c542] opacity-70 hover:opacity-100 transition-opacity"
                role="button"
                aria-label="Remove from favorites"
              >
                <Star size={11} fill="currentColor" />
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 border-t border-[#222]" />
    </div>
  );
}
