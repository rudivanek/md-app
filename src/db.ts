import { openDB } from 'idb';
import type { Item } from './types';

const DB_NAME = 'my-notes-db';
const DB_VERSION = 1;

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('items', { keyPath: 'id' });
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
