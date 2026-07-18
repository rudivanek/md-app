import { useState, useEffect, useCallback, useRef } from 'react';
import type { Item, Note, Folder } from '../types';
import {
  scanDirectory,
  writeFileContent,
  createNoteFile,
  createFolderOnDisk,
  deleteEntryOnDisk,
  renameOnDisk,
  moveEntryToFolder,
  verifyPermission,
  type ScanResult,
} from '../fileSystem';
import {
  loadAllItems,
  saveItem,
  removeItem as dbRemoveItem,
  clearItems,
} from '../db';

export type SaveStatus = 'saved' | 'saving';

function extractTitle(content: string): string {
  const line = content.split('\n')[0].replace(/^#+\s*/, '').trim();
  return line || 'Untitled';
}

function safeNameForNote(title: string): string {
  const base = title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'Untitled';
  return base.endsWith('.md') ? base : base + '.md';
}

function safeNameForFolder(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

function genId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export interface UseNotesResult {
  items: Item[];
  loading: boolean;
  activeId: string | null;
  activeNote: Note | undefined;
  saveStatus: SaveStatus;
  setActiveId: (id: string | null) => void;
  createNote: (parentId?: string | null) => Promise<void>;
  createFolder: (parentId?: string | null) => Promise<void>;
  updateContent: (id: string, content: string) => void;
  renameItem: (id: string, newName: string) => Promise<void>;
  toggleFavorite: (id: string) => void;
  toggleCollapsed: (id: string) => void;
  deleteItem: (id: string) => Promise<void>;
  moveItem: (
    dragId: string,
    targetId: string,
    position: 'before' | 'after' | 'inside'
  ) => Promise<void>;
}

export function useNotes(
  rootHandle: FileSystemDirectoryHandle | null
): UseNotesResult {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  const fileHandlesRef = useRef<Map<string, FileSystemFileHandle>>(new Map());
  const dirHandlesRef = useRef<Map<string, FileSystemDirectoryHandle>>(new Map());
  const itemsRef = useRef<Item[]>([]);
  const saveTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const isDiskMode = rootHandle !== null;

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Initial load: scan folder (disk mode) or load from IndexedDB (local mode).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (isDiskMode && rootHandle) {
          const ok = await verifyPermission(rootHandle, true);
          if (!ok) {
            setLoading(false);
            return;
          }
          const result: ScanResult = await scanDirectory(rootHandle);
          if (cancelled) return;
          fileHandlesRef.current = result.fileHandles;
          dirHandlesRef.current = result.dirHandles;
          setItems(result.items);
          const firstNote = result.items
            .filter((i): i is Note => i.type === 'note')
            .sort((a, b) => a.order - b.order)[0];
          setActiveId(firstNote?.id ?? null);
        } else {
          const stored = await loadAllItems();
          if (cancelled) return;
          setItems(stored);
          const firstNote = stored
            .filter((i): i is Note => i.type === 'note')
            .sort((a, b) => a.order - b.order)[0];
          setActiveId(firstNote?.id ?? null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rootHandle, isDiskMode]);

  const activeNote = items.find(
    (i): i is Note => i.id === activeId && i.type === 'note'
  );

  const getParentDir = useCallback(
    (parentId: string | null): FileSystemDirectoryHandle => {
      if (parentId === null) return rootHandle!;
      const dir = dirHandlesRef.current.get(parentId);
      if (!dir) return rootHandle!;
      return dir;
    },
    [rootHandle]
  );

  const getNextOrder = useCallback((parentId: string | null) => {
    const siblings = itemsRef.current.filter((i) => i.parentId === parentId);
    return siblings.reduce((max, i) => Math.max(max, i.order), -1) + 1;
  }, []);

  const createNote = useCallback(
    async (parentId: string | null = null) => {
      const id = genId();
      const note: Note = {
        id,
        type: 'note',
        title: 'Untitled',
        content: '',
        parentId,
        favorite: false,
        order: getNextOrder(parentId),
        updatedAt: Date.now(),
        createdAt: Date.now(),
      };
      if (isDiskMode) {
        const parentDir = getParentDir(parentId);
        const { handle } = await createNoteFile(parentDir, 'Untitled');
        fileHandlesRef.current.set(id, handle);
      } else {
        await saveItem(note);
      }
      setItems((prev) => [...prev, note]);
      setActiveId(id);
    },
    [getParentDir, getNextOrder, isDiskMode]
  );

  const createFolder = useCallback(
    async (parentId: string | null = null) => {
      const id = genId();
      const folder: Folder = {
        id,
        type: 'folder',
        name: 'New Folder',
        parentId,
        favorite: false,
        order: getNextOrder(parentId),
        collapsed: false,
        createdAt: Date.now(),
      };
      if (isDiskMode) {
        const parentDir = getParentDir(parentId);
        const dirHandle = await createFolderOnDisk(parentDir, 'New Folder');
        dirHandlesRef.current.set(id, dirHandle);
      } else {
        await saveItem(folder);
      }
      setItems((prev) => [...prev, folder]);
    },
    [getParentDir, getNextOrder, isDiskMode]
  );

  const updateContent = useCallback(
    (id: string, content: string) => {
      setSaveStatus('saving');
      setItems((prev) =>
        prev.map((item) =>
          item.id === id && item.type === 'note'
            ? {
                ...item,
                content,
                title: extractTitle(content),
                updatedAt: Date.now(),
              }
            : item
        )
      );

      const timers = saveTimerRef.current;
      const existing = timers.get(id);
      if (existing) clearTimeout(existing);
      timers.set(
        id,
        setTimeout(async () => {
          const note = itemsRef.current.find(
            (i): i is Note => i.id === id && i.type === 'note'
          );
          if (!note) {
            timers.delete(id);
            if (timers.size === 0) setSaveStatus('saved');
            return;
          }
          if (isDiskMode) {
            const handle = fileHandlesRef.current.get(id);
            if (handle) {
              try {
                await writeFileContent(handle, note.content);
              } catch (err) {
                console.error('Failed to write file', err);
              }
            }
          } else {
            try {
              await saveItem(note);
            } catch (err) {
              console.error('Failed to persist note', err);
            }
          }
          timers.delete(id);
          if (timers.size === 0) setSaveStatus('saved');
        }, 500)
      );
    },
    [isDiskMode]
  );

  const renameItem = useCallback(
    async (id: string, newName: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item) return;
      const isFolder = item.type === 'folder';
      const newNameSafe = isFolder
        ? safeNameForFolder(newName)
        : newName;

      if (isDiskMode) {
        const oldName = isFolder ? item.name : safeNameForNote(item.title);
        const diskName = isFolder ? newNameSafe : safeNameForNote(newNameSafe);
        if (oldName === diskName) return;
        const parentDir = getParentDir(item.parentId);
        try {
          await renameOnDisk(parentDir, oldName, diskName, isFolder);
        } catch (err) {
          console.error('Rename failed on disk', err);
        }
      }

      const updated: Item =
        item.type === 'folder'
          ? { ...item, name: newNameSafe }
          : { ...item, title: newNameSafe };

      setItems((prev) => prev.map((it) => (it.id === id ? updated : it)));
      if (!isDiskMode) await saveItem(updated);
    },
    [getParentDir, isDiskMode]
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      setItems((prev) => {
        const next = prev.map((item) =>
          item.id === id ? { ...item, favorite: !item.favorite } : item
        );
        const updated = next.find((i) => i.id === id);
        if (!isDiskMode && updated) saveItem(updated);
        return next;
      });
    },
    [isDiskMode]
  );

  const toggleCollapsed = useCallback(
    (id: string) => {
      setItems((prev) => {
        const next = prev.map((item) =>
          item.id === id && item.type === 'folder'
            ? { ...item, collapsed: !item.collapsed }
            : item
        );
        const updated = next.find((i) => i.id === id);
        if (!isDiskMode && updated) saveItem(updated);
        return next;
      });
    },
    [isDiskMode]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item) return;
      const isFolder = item.type === 'folder';

      if (isDiskMode) {
        const parentDir = getParentDir(item.parentId);
        const name = isFolder ? item.name : safeNameForNote(item.title);
        try {
          await deleteEntryOnDisk(parentDir, name, isFolder);
        } catch (err) {
          console.error('Delete failed on disk', err);
        }
      }

      const toDelete: string[] = [];
      const collect = (itemId: string) => {
        toDelete.push(itemId);
        itemsRef.current
          .filter((i) => i.parentId === itemId)
          .forEach((child) => collect(child.id));
      };
      collect(id);

      if (isDiskMode) {
        fileHandlesRef.current.forEach((_, fid) => {
          if (toDelete.includes(fid)) fileHandlesRef.current.delete(fid);
        });
        dirHandlesRef.current.forEach((_, did) => {
          if (toDelete.includes(did)) dirHandlesRef.current.delete(did);
        });
      } else {
        await Promise.all(toDelete.map((tid) => dbRemoveItem(tid)));
      }

      setItems((prev) => prev.filter((i) => !toDelete.includes(i.id)));
      if (toDelete.includes(activeId ?? '')) {
        const remaining = itemsRef.current.filter(
          (i) => !toDelete.includes(i.id) && i.type === 'note'
        );
        setActiveId(remaining[0]?.id ?? null);
      }
    },
    [getParentDir, activeId, isDiskMode]
  );

  const moveItem = useCallback(
    async (
      dragId: string,
      targetId: string,
      position: 'before' | 'after' | 'inside'
    ) => {
      const dragged = itemsRef.current.find((i) => i.id === dragId);
      const target = itemsRef.current.find((i) => i.id === targetId);
      if (!dragged || !target || dragId === targetId) return;

      // Prevent moving a folder into itself or its descendants.
      if (dragged.type === 'folder') {
        let cur: Item | undefined = target;
        while (cur) {
          if (cur.id === dragId) return;
          cur = itemsRef.current.find((i) => i.id === cur!.parentId);
        }
      }

      const isFolder = dragged.type === 'folder';
      const name = isFolder ? dragged.name : safeNameForNote(dragged.title);

      let newParentId: string | null;

      if (position === 'inside' && target.type === 'folder') {
        newParentId = target.id;
        if (isDiskMode) {
          const sourceDir = getParentDir(dragged.parentId);
          const targetDir = getParentDir(target.id);
          try {
            await moveEntryToFolder(sourceDir, name, targetDir, isFolder);
          } catch (err) {
            console.error('Move failed on disk', err);
          }
          if (isFolder) {
            const newDir = await getParentDir(target.id).getDirectoryHandle(name);
            dirHandlesRef.current.set(dragId, newDir);
          } else {
            const newFile = await getParentDir(target.id).getFileHandle(name);
            fileHandlesRef.current.set(dragId, newFile);
          }
        }
      } else {
        newParentId = target.parentId;
        if (isDiskMode) {
          const sourceDir = getParentDir(dragged.parentId);
          const targetDir = getParentDir(newParentId);
          if (sourceDir !== targetDir) {
            try {
              await moveEntryToFolder(sourceDir, name, targetDir, isFolder);
            } catch (err) {
              console.error('Move failed on disk', err);
            }
            if (isFolder) {
              dirHandlesRef.current.set(
                dragId,
                await targetDir.getDirectoryHandle(name)
              );
            } else {
              fileHandlesRef.current.set(
                dragId,
                await targetDir.getFileHandle(name)
              );
            }
          }
        }
      }

      setItems((prev) => {
        const siblings = prev
          .filter((i) => i.parentId === newParentId && i.id !== dragId)
          .sort((a, b) => a.order - b.order);
        const targetIdx = siblings.findIndex((i) => i.id === targetId);
        const insertIdx =
          position === 'inside'
            ? siblings.length
            : position === 'before'
            ? targetIdx
            : targetIdx + 1;
        const reordered = [...siblings];
        reordered.splice(insertIdx, 0, {
          ...dragged,
          parentId: newParentId,
        });
        const withOrders = reordered.map((item, idx) => ({ ...item, order: idx }));
        const updatedMap = new Map(withOrders.map((i) => [i.id, i]));
        const next = prev.map((i) =>
          updatedMap.has(i.id) ? (updatedMap.get(i.id) as Item) : i
        );
        if (!isDiskMode) {
          Promise.all(withOrders.map((it) => saveItem(it))).catch((err) =>
            console.error('Failed to persist order', err)
          );
        }
        return next;
      });
    },
    [getParentDir, isDiskMode]
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

export { clearItems };
