import { useState, useEffect, useCallback, useRef } from 'react';
import { loadAllItems, saveItem, saveItems, removeItems } from '../db';
import type { Item, Note, Folder } from '../types';

export type SaveStatus = 'saved' | 'saving';

function genId() {
  return Math.random().toString(36).slice(2, 11);
}

function extractTitle(content: string): string {
  const line = content.split('\n')[0].replace(/^#+\s*/, '').trim();
  return line || 'Untitled';
}

function makeWelcomeNote(): Note {
  return {
    id: genId(),
    type: 'note',
    title: 'Welcome',
    content:
      '# Welcome to My-Notes\n\nStart writing your notes here.\n\n## Features\n\n- **Folders** — organize notes into nested folders\n- **Favorites** — star any note or folder\n- **Drag & drop** — reorder and move items\n- **Autosave** — changes save automatically\n\n## Markdown tips\n\n```\n# Heading 1\n## Heading 2\n**bold**  _italic_  `code`\n- bullet list\n1. numbered list\n```\n',
    parentId: null,
    favorite: false,
    order: 0,
    updatedAt: Date.now(),
    createdAt: Date.now(),
  };
}

export function useNotes() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemsRef = useRef<Item[]>([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    loadAllItems().then(async (loaded) => {
      if (loaded.length === 0) {
        const welcome = makeWelcomeNote();
        await saveItem(welcome);
        setItems([welcome]);
        setActiveId(welcome.id);
      } else {
        setItems(loaded);
        const firstNote = loaded
          .filter((i): i is Note => i.type === 'note')
          .sort((a, b) => a.order - b.order)[0];
        setActiveId(firstNote?.id ?? null);
      }
      setLoading(false);
    });
  }, []);

  const activeNote = items.find(
    (i): i is Note => i.id === activeId && i.type === 'note'
  );

  const getNextOrder = (parentId: string | null) => {
    const siblings = itemsRef.current.filter((i) => i.parentId === parentId);
    return siblings.reduce((max, i) => Math.max(max, i.order), -1) + 1;
  };

  const createNote = useCallback(async (parentId: string | null = null) => {
    const note: Note = {
      id: genId(),
      type: 'note',
      title: 'Untitled',
      content: '',
      parentId,
      favorite: false,
      order: getNextOrder(parentId),
      updatedAt: Date.now(),
      createdAt: Date.now(),
    };
    await saveItem(note);
    setItems((prev) => [...prev, note]);
    setActiveId(note.id);
  }, []);

  const createFolder = useCallback(async (parentId: string | null = null) => {
    const folder: Folder = {
      id: genId(),
      type: 'folder',
      name: 'New Folder',
      parentId,
      favorite: false,
      order: getNextOrder(parentId),
      collapsed: false,
      createdAt: Date.now(),
    };
    await saveItem(folder);
    setItems((prev) => [...prev, folder]);
  }, []);

  const updateContent = useCallback((id: string, content: string) => {
    setSaveStatus('saving');
    setItems((prev) =>
      prev.map((item) =>
        item.id === id && item.type === 'note'
          ? {
              ...item,
              content,
              title: extractTitle(content) || 'Untitled',
              updatedAt: Date.now(),
            }
          : item
      )
    );

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const note = itemsRef.current.find((i) => i.id === id);
      if (note) saveItem(note);
      setSaveStatus('saved');
    }, 500);
  }, []);

  const renameItem = useCallback((id: string, newName: string) => {
    setItems((prev) => {
      const next = prev.map((item) => {
        if (item.id !== id) return item;
        return item.type === 'folder'
          ? { ...item, name: newName }
          : { ...item, title: newName };
      });
      const updated = next.find((i) => i.id === id);
      if (updated) saveItem(updated);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.map((item) =>
        item.id === id ? { ...item, favorite: !item.favorite } : item
      );
      const updated = next.find((i) => i.id === id);
      if (updated) saveItem(updated);
      return next;
    });
  }, []);

  const toggleCollapsed = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.map((item) =>
        item.id === id && item.type === 'folder'
          ? { ...item, collapsed: !item.collapsed }
          : item
      );
      const updated = next.find((i) => i.id === id);
      if (updated) saveItem(updated);
      return next;
    });
  }, []);

  const deleteItem = useCallback(
    (id: string) => {
      const toDelete: string[] = [];
      const collect = (itemId: string) => {
        toDelete.push(itemId);
        itemsRef.current
          .filter((i) => i.parentId === itemId)
          .forEach((child) => collect(child.id));
      };
      collect(id);

      removeItems(toDelete);
      setItems((prev) => prev.filter((i) => !toDelete.includes(i.id)));
      if (toDelete.includes(activeId ?? '')) {
        const remaining = itemsRef.current.filter(
          (i) => !toDelete.includes(i.id) && i.type === 'note'
        );
        setActiveId(remaining[0]?.id ?? null);
      }
    },
    [activeId]
  );

  const moveItem = useCallback(
    (dragId: string, targetId: string, position: 'before' | 'after' | 'inside') => {
      setItems((prev) => {
        const dragged = prev.find((i) => i.id === dragId);
        const target = prev.find((i) => i.id === targetId);
        if (!dragged || !target || dragId === targetId) return prev;

        // Prevent moving a folder into itself or its own descendants
        if (dragged.type === 'folder') {
          let cur: Item | undefined = target;
          while (cur) {
            if (cur.id === dragId) return prev;
            cur = prev.find((i) => i.id === cur!.parentId);
          }
        }

        if (position === 'inside' && target.type === 'folder') {
          const children = prev.filter((i) => i.parentId === target.id);
          const maxOrder = children.reduce((m, i) => Math.max(m, i.order), -1);
          const updated = { ...dragged, parentId: target.id, order: maxOrder + 1 };
          saveItem(updated);
          return prev.map((i) => (i.id === dragId ? updated : i));
        }

        // Reorder within (or move to) target's parent level
        const newParentId = target.parentId;
        const siblings = prev
          .filter((i) => i.parentId === newParentId && i.id !== dragId)
          .sort((a, b) => a.order - b.order);

        const targetIdx = siblings.findIndex((i) => i.id === targetId);
        const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;

        const reordered = [...siblings];
        reordered.splice(insertIdx, 0, { ...dragged, parentId: newParentId });
        const withOrders = reordered.map((item, idx) => ({ ...item, order: idx }));

        const changed = withOrders.filter((item) => {
          const orig = prev.find((p) => p.id === item.id);
          return !orig || orig.order !== item.order || orig.parentId !== item.parentId;
        });
        if (changed.length) saveItems(changed);

        const updatedMap = new Map(withOrders.map((i) => [i.id, i]));
        return prev.map((i) => (updatedMap.has(i.id) ? updatedMap.get(i.id)! : i));
      });
    },
    []
  );

  return {
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
  };
}
