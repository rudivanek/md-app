import type { Item, Note, Folder } from './types';

export interface ScanResult {
  items: Item[];
  /** Map of item id -> file handle (notes only). */
  fileHandles: Map<string, FileSystemFileHandle>;
  /** Map of item id -> directory handle (folders only). */
  dirHandles: Map<string, FileSystemDirectoryHandle>;
}

const MD_EXT = '.md';

function isHidden(name: string): boolean {
  return name.startsWith('.') || name === '.git';
}

function genId(): string {
  return Math.random().toString(36).slice(2, 11);
}

function extractTitle(content: string): string {
  const line = content.split('\n')[0].replace(/^#+\s*/, '').trim();
  return line || 'Untitled';
}

function safeNameForFolder(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

function safeNameForNote(title: string): string {
  const base = title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'Untitled';
  return base.endsWith(MD_EXT) ? base : base + MD_EXT;
}

export function isFsApiSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

export async function pickRootDirectory(): Promise<FileSystemDirectoryHandle> {
  const handle = await window.showDirectoryPicker!({ mode: 'readwrite' });
  return handle;
}

export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  readWrite: boolean
): Promise<boolean> {
  const opts = { mode: (readWrite ? 'readwrite' : 'read') as 'read' | 'readwrite' };
  const anyHandle = handle as unknown as {
    queryPermission?: (o: { mode: string }) => Promise<string>;
    requestPermission?: (o: { mode: string }) => Promise<string>;
  };
  if (!anyHandle.queryPermission || !anyHandle.requestPermission) return true;
  let perm = await anyHandle.queryPermission(opts);
  if (perm === 'granted') return true;
  perm = await anyHandle.requestPermission(opts);
  return perm === 'granted';
}

export async function scanDirectory(
  root: FileSystemDirectoryHandle
): Promise<ScanResult> {
  const items: Item[] = [];
  const fileHandles = new Map<string, FileSystemFileHandle>();
  const dirHandles = new Map<string, FileSystemDirectoryHandle>();

  async function walk(
    dir: FileSystemDirectoryHandle,
    parentId: string | null,
    depth: number
  ): Promise<void> {
    const entries: { name: string; handle: FileSystemHandle }[] = [];
    for await (const entry of dir.values()) {
      entries.push({ name: entry.name, handle: entry });
    }
    entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    let order = 0;
    for (const { name, handle } of entries) {
      if (isHidden(name)) continue;

      if (handle.kind === 'directory') {
        const dirHandle = handle as FileSystemDirectoryHandle;
        const id = genId();
        const folder: Folder = {
          id,
          type: 'folder',
          name,
          parentId,
          order: order++,
          favorite: false,
          collapsed: depth >= 1,
          createdAt: Date.now(),
        };
        items.push(folder);
        dirHandles.set(id, dirHandle);
        await walk(dirHandle, id, depth + 1);
      } else if (handle.kind === 'file' && name.toLowerCase().endsWith(MD_EXT)) {
        const fileHandle = handle as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        const content = await file.text();
        const title = extractTitle(content);
        const id = genId();
        const note: Note = {
          id,
          type: 'note',
          title,
          content,
          parentId,
          order: order++,
          favorite: false,
          updatedAt: file.lastModified,
          createdAt: file.lastModified,
        };
        items.push(note);
        fileHandles.set(id, fileHandle);
      }
    }
  }

  await walk(root, null, 0);
  return { items, fileHandles, dirHandles };
}

export async function readFileContent(
  handle: FileSystemFileHandle
): Promise<string> {
  const file = await handle.getFile();
  return file.text();
}

export async function writeFileContent(
  handle: FileSystemFileHandle,
  content: string
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

export async function createNoteFile(
  parentDir: FileSystemDirectoryHandle,
  title: string
): Promise<{ handle: FileSystemFileHandle; name: string }> {
  const baseName = safeNameForNote(title);
  let name = baseName;
  let attempt = 1;
  while (await exists(parentDir, name)) {
    name = baseName.replace(MD_EXT, ` ${attempt}${MD_EXT}`);
    attempt++;
  }
  const handle = await parentDir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write('');
  await writable.close();
  return { handle, name };
}

export async function createFolderOnDisk(
  parentDir: FileSystemDirectoryHandle,
  name: string
): Promise<FileSystemDirectoryHandle> {
  const safe = safeNameForFolder(name);
  let final = safe;
  let attempt = 1;
  while (await exists(parentDir, final)) {
    final = `${safe} ${attempt}`;
    attempt++;
  }
  return parentDir.getDirectoryHandle(final, { create: true });
}

async function exists(
  dir: FileSystemDirectoryHandle,
  name: string
): Promise<boolean> {
  try {
    for await (const entry of dir.values()) {
      if (entry.name === name) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function deleteEntryOnDisk(
  dirHandle: FileSystemDirectoryHandle,
  name: string,
  isFolder: boolean
): Promise<void> {
  await dirHandle.removeEntry(name, { recursive: isFolder });
}

export async function renameOnDisk(
  dirHandle: FileSystemDirectoryHandle,
  oldName: string,
  newName: string,
  isFolder: boolean
): Promise<void> {
  // Try native move() if supported (Chrome 110+).
  const handle = await getEntry(dirHandle, oldName, isFolder);
  const movable = handle as unknown as {
    move?: (newName: string) => Promise<void>;
  };
  if (typeof movable.move === 'function') {
    await movable.move(newName);
    return;
  }
  // Fallback: copy + delete.
  await copyEntry(dirHandle, oldName, newName, isFolder);
  await dirHandle.removeEntry(oldName, { recursive: isFolder });
}

async function getEntry(
  dir: FileSystemDirectoryHandle,
  name: string,
  isFolder: boolean
): Promise<FileSystemHandle> {
  if (isFolder) return dir.getDirectoryHandle(name);
  return dir.getFileHandle(name);
}

async function copyEntry(
  dir: FileSystemDirectoryHandle,
  oldName: string,
  newName: string,
  isFolder: boolean
): Promise<void> {
  if (isFolder) {
    const src = await dir.getDirectoryHandle(oldName);
    const dst = await dir.getDirectoryHandle(newName, { create: true });
    for await (const entry of src.values()) {
      if (entry.kind === 'file') {
        const srcFile = entry as FileSystemFileHandle;
        const file = await srcFile.getFile();
        const dstFile = await dst.getFileHandle(entry.name, { create: true });
        const w = await dstFile.createWritable();
        await w.write(await file.arrayBuffer());
        await w.close();
      } else {
        await copyEntry(
          src,
          entry.name,
          entry.name,
          true
        );
        // Re-copy into dst by walking; simplified: recursive copy
      }
    }
  } else {
    const srcFile = await dir.getFileHandle(oldName);
    const file = await srcFile.getFile();
    const dstFile = await dir.getFileHandle(newName, { create: true });
    const w = await dstFile.createWritable();
    await w.write(await file.arrayBuffer());
    await w.close();
  }
}

export async function moveEntryToFolder(
  sourceDir: FileSystemDirectoryHandle,
  name: string,
  targetDir: FileSystemDirectoryHandle,
  isFolder: boolean
): Promise<void> {
  // Try native move() with directory target if supported.
  const handle = await getEntry(sourceDir, name, isFolder);
  const movable = handle as unknown as {
    move?: (destination: FileSystemDirectoryHandle) => Promise<void>;
  };
  if (typeof movable.move === 'function') {
    await movable.move(targetDir);
    return;
  }
  // Fallback: copy into target, then delete from source.
  await copyEntryToTarget(sourceDir, name, targetDir, isFolder);
  await sourceDir.removeEntry(name, { recursive: isFolder });
}

async function copyEntryToTarget(
  sourceDir: FileSystemDirectoryHandle,
  name: string,
  targetDir: FileSystemDirectoryHandle,
  isFolder: boolean
): Promise<void> {
  if (isFolder) {
    const src = await sourceDir.getDirectoryHandle(name);
    const dst = await targetDir.getDirectoryHandle(name, { create: true });
    for await (const entry of src.values()) {
      if (entry.kind === 'file') {
        const srcFile = entry as FileSystemFileHandle;
        const file = await srcFile.getFile();
        const dstFile = await dst.getFileHandle(entry.name, { create: true });
        const w = await dstFile.createWritable();
        await w.write(await file.arrayBuffer());
        await w.close();
      } else {
        await copyEntryToTarget(src, entry.name, dst, true);
      }
    }
  } else {
    const srcFile = await sourceDir.getFileHandle(name);
    const file = await srcFile.getFile();
    const dstFile = await targetDir.getFileHandle(name, { create: true });
    const w = await dstFile.createWritable();
    await w.write(await file.arrayBuffer());
    await w.close();
  }
}
