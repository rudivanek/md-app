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

export function useNotes(rootHandle: FileSystemDirectoryHandle): UseNotesResult {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  const fileHandlesRef = useRef<Map<string, FileSystemFileHandle>>(new Map());
  const dirHandlesRef = useRef<Map<string, FileSystemDirectoryHandle>>(new Map());
  const itemsRef = useRef<Item[]>([]);
  const saveTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Initial scan of the connected folder.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rootHandle]);

  const activeNote = items.find(
    (i): i is Note => i.id === activeId && i.type === 'note'
  );

  const getParentDir = useCallback(
    (parentId: string | null): FileSystemDirectoryHandle => {
      if (parentId === null) return rootHandle;
      const dir = dirHandlesRef.current.get(parentId);
      if (!dir) return rootHandle;
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
      const parentDir = getParentDir(parentId);
      const { handle } = await createNoteFile(parentDir, 'Untitled');
      const id = Math.random().toString(36).slice(2, 11);
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
      fileHandlesRef.current.set(id, handle);
      setItems((prev) => [...prev, note]);
      setActiveId(id);
    },
    [getParentDir, getNextOrder]
  );

  const createFolder = useCallback(
    async (parentId: string | null = null) => {
      const parentDir = getParentDir(parentId);
      const dirHandle = await createFolderOnDisk(parentDir, 'New Folder');
      const id = Math.random().toString(36).slice(2, 11);
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
      dirHandlesRef.current.set(id, dirHandle);
      setItems((prev) => [...prev, folder]);
    },
    [getParentDir, getNextOrder]
  );

  const updateContent = useCallback((id: string, content: string) => {
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
        const handle = fileHandlesRef.current.get(id);
        if (note && handle) {
          try {
            await writeFileContent(handle, note.content);
          } catch (err) {
            console.error('Failed to write file', err);
          }
        }
        timers.delete(id);
        if (timers.size === 0) setSaveStatus('saved');
      }, 500)
    );
  }, []);

  const renameItem = useCallback(
    async (id: string, newName: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item) return;
      const parentDir = getParentDir(item.parentId);
      const isFolder = item.type === 'folder';
      const oldName = isFolder ? item.name : safeNameForNote(item.title);
      const newNameSafe = isFolder ? safeNameForFolder(newName) : safeNameForNote(newName);

      if (oldName === newNameSafe) return;

      try {
        await renameOnDisk(parentDir, oldName, newNameSafe, isFolder);
      } catch (err) {
        console.error('Rename failed on disk', err);
      }

      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? it.type === 'folder'
              ? { ...it, name: newNameSafe }
              : { ...it, title: isFolder ? it.title : newName }
            : it
        )
      );
    },
    [getParentDir]
  );

  const toggleFavorite = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, favorite: !item.favorite } : item
      )
    );
  }, []);

  const toggleCollapsed = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id && item.type === 'folder'
          ? { ...item, collapsed: !item.collapsed }
          : item
      )
    );
  }, []);

  const deleteItem = useCallback(
    async (id: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item) return;
      const parentDir = getParentDir(item.parentId);
      const isFolder = item.type === 'folder';
      const name = isFolder ? item.name : safeNameForNote(item.title);

      try {
        await deleteEntryOnDisk(parentDir, name, isFolder);
      } catch (err) {
        console.error('Delete failed on disk', err);
      }

      const toDelete: string[] = [];
      const collect = (itemId: string) => {
        toDelete.push(itemId);
        itemsRef.current
          .filter((i) => i.parentId === itemId)
          .forEach((child) => collect(child.id));
      };
      collect(id);

      fileHandlesRef.current.forEach((_, fid) => {
        if (toDelete.includes(fid)) fileHandlesRef.current.delete(fid);
      });
      dirHandlesRef.current.forEach((_, did) => {
        if (toDelete.includes(did)) dirHandlesRef.current.delete(did);
      });

      setItems((prev) => prev.filter((i) => !toDelete.includes(i.id)));
      if (toDelete.includes(activeId ?? '')) {
        const remaining = itemsRef.current.filter(
          (i) => !toDelete.includes(i.id) && i.type === 'note'
        );
        setActiveId(remaining[0]?.id ?? null);
      }
    },
    [getParentDir, activeId]
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
      const sourceDir = getParentDir(dragged.parentId);

      let newParentId: string | null;
      let newOrder: number;

      if (position === 'inside' && target.type === 'folder') {
        newParentId = target.id;
        const children = itemsRef.current.filter(
          (i) => i.parentId === target.id
        );
        newOrder = children.reduce((m, i) => Math.max(m, i.order), -1) + 1;
        const targetDir = getParentDir(target.id);
        try {
          await moveEntryToFolder(sourceDir, name, targetDir, isFolder);
        } catch (err) {
          console.error('Move failed on disk', err);
        }
        if (isFolder) {
          const dirHandle = dirHandlesRef.current.get(dragId);
          if (dirHandle) {
            dirHandlesRef.current.set(dragId, await targetDir.getDirectoryHandle(name));
          }
        } else {
          const fileHandle = fileHandlesRef.current.get(dragId);
          if (fileHandle) {
            fileHandlesRef.current.set(dragId, await targetDir.getFileHandle(name));
          }
        }
      } else {
        newParentId = target.parentId;
        const siblings = itemsRef.current
          .filter((i) => i.parentId === newParentId && i.id !== dragId)
          .sort((a, b) => a.order - b.order);
        const targetIdx = siblings.findIndex((i) => i.id === targetId);
        const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
        newOrder = insertIdx;

        if (sourceDir !== getParentDir(newParentId)) {
          const targetDir = getParentDir(newParentId);
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

      setItems((prev) => {
        if (position === 'inside' && target.type === 'folder') {
          return prev.map((i) =>
            i.id === dragId
              ? { ...i, parentId: newParentId, order: newOrder }
              : i
          );
        }
        const siblings = prev
          .filter((i) => i.parentId === newParentId && i.id !== dragId)
          .sort((a, b) => a.order - b.order);
        const targetIdx = siblings.findIndex((i) => i.id === targetId);
        const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
        const reordered = [...siblings];
        reordered.splice(insertIdx, 0, {
          ...dragged,
          parentId: newParentId,
        });
        const withOrders = reordered.map((item, idx) => ({ ...item, order: idx }));
        const updatedMap = new Map(withOrders.map((i) => [i.id, i]));
        return prev.map((i) =>
          updatedMap.has(i.id) ? (updatedMap.get(i.id) as Item) : i
        );
      });
    },
    [getParentDir]
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
