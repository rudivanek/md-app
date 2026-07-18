import { useState, useEffect, useCallback, useRef } from 'react';
import type { Item, Note, Folder } from '../types';
import {
  scanDirectory,
  writeFileContent,
  readFileContent,
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

export type SaveStatus = 'saved' | 'saving' | 'save-failed';

export interface ConflictInfo {
  id: string;
  title: string;
  mine: string;
  disk: string;
  diskMtime: number;
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

function isPermissionError(err: unknown): boolean {
  const e = err as DOMException | undefined;
  if (!e) return false;
  return (
    e.name === 'SecurityError' ||
    e.name === 'NotAllowedError' ||
    e.name === 'AbortError'
  );
}

export interface UseNotesResult {
  items: Item[];
  loading: boolean;
  activeId: string | null;
  activeNote: Note | undefined;
  saveStatus: SaveStatus;
  conflict: ConflictInfo | null;
  permissionLost: boolean;
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
  resolveConflictKeepMine: () => Promise<void>;
  resolveConflictReload: () => Promise<void>;
  dismissConflict: () => void;
  retryPermission: () => Promise<void>;
}

export function useNotes(
  rootHandle: FileSystemDirectoryHandle | null
): UseNotesResult {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [permissionLost, setPermissionLost] = useState(false);

  const fileHandlesRef = useRef<Map<string, FileSystemFileHandle>>(new Map());
  const dirHandlesRef = useRef<Map<string, FileSystemDirectoryHandle>>(new Map());
  const itemsRef = useRef<Item[]>([]);
  const activeIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastMtimeRef = useRef<Map<string, number>>(new Map());

  const isDiskMode = rootHandle !== null;

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const markPermissionLost = useCallback(() => {
    setPermissionLost(true);
    setSaveStatus('save-failed');
  }, []);

  // Shared external-change check. Reads the file handle's current on-disk
  // lastModified, compares against lastMtimeRef, and only surfaces a conflict
  // when the disk text actually differs from the in-memory content. If only
  // the mtime moved (e.g. a no-op save), silently updates lastMtimeRef.
  // Returns 'conflict' | 'clean' | 'error' | 'skip'.
  const checkExternalChange = useCallback(
    async (id: string): Promise<'conflict' | 'clean' | 'error' | 'skip'> => {
      if (!isDiskMode) return 'skip';
      const handle = fileHandlesRef.current.get(id);
      if (!handle) return 'skip';
      const note = itemsRef.current.find(
        (i): i is Note => i.id === id && i.type === 'note'
      );
      if (!note) return 'skip';
      try {
        const currentFile = await handle.getFile();
        const knownMtime = lastMtimeRef.current.get(id);
        if (knownMtime === undefined) {
          lastMtimeRef.current.set(id, currentFile.lastModified);
          return 'clean';
        }
        if (currentFile.lastModified === knownMtime) return 'clean';
        const diskContent = await currentFile.text();
        lastMtimeRef.current.set(id, currentFile.lastModified);
        if (diskContent === note.content) return 'clean';
        setConflict({
          id,
          title: note.title,
          mine: note.content,
          disk: diskContent,
          diskMtime: currentFile.lastModified,
        });
        setSaveStatus('save-failed');
        return 'conflict';
      } catch (err) {
        if (isPermissionError(err)) markPermissionLost();
        else console.error('External change check failed', err);
        return 'error';
      }
    },
    [isDiskMode, markPermissionLost]
  );

  // Initial load: scan folder (disk mode) or load from IndexedDB (local mode).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setPermissionLost(false);
      try {
        if (isDiskMode && rootHandle) {
          const ok = await verifyPermission(rootHandle, true);
          if (!ok) {
            markPermissionLost();
            setLoading(false);
            return;
          }
          let result: ScanResult;
          try {
            result = await scanDirectory(rootHandle);
          } catch (err) {
            if (isPermissionError(err)) markPermissionLost();
            setLoading(false);
            return;
          }
          if (cancelled) return;
          fileHandlesRef.current = result.fileHandles;
          dirHandlesRef.current = result.dirHandles;
          lastMtimeRef.current.clear();
          result.items.forEach((it) => {
            if (it.type === 'note') lastMtimeRef.current.set(it.id, it.updatedAt);
          });
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
  }, [rootHandle, isDiskMode, markPermissionLost]);

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
      const now = Date.now();
      const note: Note = {
        id,
        type: 'note',
        title: 'Untitled',
        fileName: '',
        content: '',
        parentId,
        favorite: false,
        order: getNextOrder(parentId),
        updatedAt: now,
        createdAt: now,
      };
      if (isDiskMode) {
        try {
          const parentDir = getParentDir(parentId);
          const { handle, name } = await createNoteFile(parentDir, 'Untitled');
          fileHandlesRef.current.set(id, handle);
          note.fileName = name;
          note.title = name.replace(/\.md$/i, '');
          const file = await handle.getFile();
          lastMtimeRef.current.set(id, file.lastModified);
        } catch (err) {
          if (isPermissionError(err)) {
            markPermissionLost();
            return;
          }
          throw err;
        }
      } else {
        await saveItem(note);
      }
      setItems((prev) => [...prev, note]);
      setActiveId(id);
    },
    [getParentDir, getNextOrder, isDiskMode, markPermissionLost]
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
        try {
          const parentDir = getParentDir(parentId);
          const dirHandle = await createFolderOnDisk(parentDir, 'New Folder');
          dirHandlesRef.current.set(id, dirHandle);
        } catch (err) {
          if (isPermissionError(err)) {
            markPermissionLost();
            return;
          }
          throw err;
        }
      } else {
        await saveItem(folder);
      }
      setItems((prev) => [...prev, folder]);
    },
    [getParentDir, getNextOrder, isDiskMode, markPermissionLost]
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
            if (!handle) {
              timers.delete(id);
              if (timers.size === 0) setSaveStatus('saved');
              return;
            }
            try {
              const result = await checkExternalChange(id);
              if (result === 'conflict') {
                timers.delete(id);
                return;
              }
              await writeFileContent(handle, note.content);
              const written = await handle.getFile();
              lastMtimeRef.current.set(id, written.lastModified);
              setSaveStatus('saved');
            } catch (err) {
              if (isPermissionError(err)) {
                markPermissionLost();
              } else {
                console.error('Failed to write file', err);
                setSaveStatus('save-failed');
              }
            }
          } else {
            try {
              await saveItem(note);
              setSaveStatus('saved');
            } catch (err) {
              console.error('Failed to persist note', err);
              setSaveStatus('save-failed');
            }
          }
          timers.delete(id);
        }, 500)
      );
    },
    [isDiskMode, markPermissionLost, checkExternalChange]
  );

  const selectNote = useCallback(
    async (id: string | null) => {
      if (id && id !== activeId) {
        await checkExternalChange(id);
      }
      setActiveId(id);
    },
    [activeId, checkExternalChange]
  );

  // Re-check the active note when the window regains focus / becomes visible.
  useEffect(() => {
    if (!isDiskMode) return;
    const onFocus = () => {
      const id = activeIdRef.current;
      if (id) checkExternalChange(id);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onFocus();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isDiskMode, checkExternalChange]);

  const resolveConflictKeepMine = useCallback(async () => {
    const c = conflict;
    if (!c) return;
    const handle = fileHandlesRef.current.get(c.id);
    if (handle) {
      try {
        await writeFileContent(handle, c.mine);
        const written = await handle.getFile();
        lastMtimeRef.current.set(c.id, written.lastModified);
        setSaveStatus('saved');
      } catch (err) {
        if (isPermissionError(err)) markPermissionLost();
        else setSaveStatus('save-failed');
      }
    }
    setConflict(null);
  }, [conflict, markPermissionLost]);

  const resolveConflictReload = useCallback(async () => {
    const c = conflict;
    if (!c) return;
    const handle = fileHandlesRef.current.get(c.id);
    if (handle) {
      try {
        const content = await readFileContent(handle);
        const file = await handle.getFile();
        lastMtimeRef.current.set(c.id, file.lastModified);
        setItems((prev) =>
          prev.map((it) =>
            it.id === c.id && it.type === 'note'
              ? {
                  ...it,
                  content,
                  updatedAt: file.lastModified,
                }
              : it
          )
        );
        setSaveStatus('saved');
      } catch (err) {
        if (isPermissionError(err)) markPermissionLost();
        else setSaveStatus('save-failed');
      }
    }
    setConflict(null);
  }, [conflict, markPermissionLost]);

  const dismissConflict = useCallback(() => {
    setConflict(null);
    setSaveStatus('save-failed');
  }, []);

  const retryPermission = useCallback(async () => {
    if (!rootHandle) {
      setPermissionLost(false);
      return;
    }
    try {
      const ok = await verifyPermission(rootHandle, true);
      if (ok) {
        setPermissionLost(false);
        setSaveStatus('saved');
      }
    } catch {
      /* keep permissionLost */
    }
  }, [rootHandle]);

  const renameItem = useCallback(
    async (id: string, newName: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item) return;
      const isFolder = item.type === 'folder';
      const newNameSafe = isFolder ? safeNameForFolder(newName) : newName;

      if (isDiskMode) {
        const oldName = isFolder ? item.name : item.fileName;
        const diskName = isFolder
          ? newNameSafe
          : safeNameForNote(newNameSafe);
        if (oldName === diskName) return;
        const parentDir = getParentDir(item.parentId);
        try {
          await renameOnDisk(parentDir, oldName, diskName, isFolder);
        } catch (err) {
          if (isPermissionError(err)) {
            markPermissionLost();
            return;
          }
          console.error('Rename failed on disk', err);
          setSaveStatus('save-failed');
          return;
        }
      }

      const updated: Item =
        item.type === 'folder'
          ? { ...item, name: newNameSafe }
          : { ...item, title: newNameSafe, fileName: safeNameForNote(newNameSafe) };

      setItems((prev) => prev.map((it) => (it.id === id ? updated : it)));
      if (!isDiskMode) await saveItem(updated);
    },
    [getParentDir, isDiskMode, markPermissionLost]
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
        const name = isFolder ? item.name : item.fileName;
        try {
          await deleteEntryOnDisk(parentDir, name, isFolder);
        } catch (err) {
          if (isPermissionError(err)) {
            markPermissionLost();
            return;
          }
          console.error('Delete failed on disk', err);
          setSaveStatus('save-failed');
          return;
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
        toDelete.forEach((tid) => lastMtimeRef.current.delete(tid));
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
    [getParentDir, activeId, isDiskMode, markPermissionLost]
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

      if (dragged.type === 'folder') {
        let cur: Item | undefined = target;
        while (cur) {
          if (cur.id === dragId) return;
          cur = itemsRef.current.find((i) => i.id === cur!.parentId);
        }
      }

      const isFolder = dragged.type === 'folder';
      const name = isFolder ? dragged.name : dragged.fileName;

      let newParentId: string | null;

      if (position === 'inside' && target.type === 'folder') {
        newParentId = target.id;
        if (isDiskMode) {
          const sourceDir = getParentDir(dragged.parentId);
          const targetDir = getParentDir(target.id);
          try {
            await moveEntryToFolder(sourceDir, name, targetDir, isFolder);
          } catch (err) {
            if (isPermissionError(err)) {
              markPermissionLost();
              return;
            }
            console.error('Move failed on disk', err);
            setSaveStatus('save-failed');
            return;
          }
          try {
            if (isFolder) {
              const newDir = await getParentDir(target.id).getDirectoryHandle(name);
              dirHandlesRef.current.set(dragId, newDir);
            } else {
              const newFile = await getParentDir(target.id).getFileHandle(name);
              fileHandlesRef.current.set(dragId, newFile);
            }
          } catch (err) {
            if (isPermissionError(err)) markPermissionLost();
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
              if (isPermissionError(err)) {
                markPermissionLost();
                return;
              }
              console.error('Move failed on disk', err);
              setSaveStatus('save-failed');
              return;
            }
            try {
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
            } catch (err) {
              if (isPermissionError(err)) markPermissionLost();
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
    [getParentDir, isDiskMode, markPermissionLost]
  );

  return {
    items,
    loading,
    activeId,
    activeNote,
    saveStatus,
    conflict,
    permissionLost,
    setActiveId: selectNote,
    createNote,
    createFolder,
    updateContent,
    renameItem,
    toggleFavorite,
    toggleCollapsed,
    deleteItem,
    moveItem,
    resolveConflictKeepMine,
    resolveConflictReload,
    dismissConflict,
    retryPermission,
  };
}

export { clearItems };
