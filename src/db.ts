import { openDB, type IDBPDatabase } from 'idb';
import type { Item } from './types';

const DB_NAME = 'my-notes-db';
const DB_VERSION = 2;

interface MetaRow {
  key: string;
  value: unknown;
}

function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('items', { keyPath: 'id' });
      }
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      }
    },
  });
}

export async function loadAllItems(): Promise<Item[]> {
  const db = await getDB();
  return (await db.getAll('items')) as Item[];
}

export async function saveItem(item: Item): Promise<void> {
  const db = await getDB();
  await db.put('items', item);
}

export async function saveItems(items: Item[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('items', 'readwrite');
  await Promise.all([...items.map((item) => tx.store.put(item)), tx.done]);
}

export async function removeItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('items', id);
}

export async function removeItems(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('items', 'readwrite');
  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
}

export async function clearItems(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('items', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

// --- Folder handle persistence (lightweight cache) ---

export async function saveFolderHandle(
  handle: FileSystemDirectoryHandle
): Promise<void> {
  const db = await getDB();
  await db.put('meta', { key: 'rootHandle', value: handle } as MetaRow);
}

export async function loadFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await getDB();
  const row = (await db.get('meta', 'rootHandle')) as MetaRow | undefined;
  return (row?.value as FileSystemDirectoryHandle | undefined) ?? null;
}

export async function clearFolderHandle(): Promise<void> {
  const db = await getDB();
  await db.delete('meta', 'rootHandle');
}
