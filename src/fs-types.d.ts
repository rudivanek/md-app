// Minimal File System Access API type declarations.
// Browsers that implement the API (Chromium-based) provide these on window;
// other browsers (Firefox/Safari) do not, which is why we feature-detect at runtime.

export interface FileSystemDirectoryHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

export interface FileSystemHandlePermissionState {
  state: 'granted' | 'denied' | 'prompt';
}

interface FileSystemHandleBase {
  queryPermission?: (
    descriptor?: FileSystemDirectoryHandlePermissionDescriptor
  ) => Promise<FileSystemHandlePermissionState['state']>;
  requestPermission?: (
    descriptor?: FileSystemDirectoryHandlePermissionDescriptor
  ) => Promise<FileSystemHandlePermissionState['state']>;
}

export interface FileSystemWritableFileStream {
  write(data: string | BufferSource | BlobPart): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

export interface FileSystemFileHandleExt extends FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
  move?: (destination: string | FileSystemDirectoryHandle) => Promise<void>;
}

export interface FileSystemDirectoryHandleExt
  extends FileSystemDirectoryHandle,
    FileSystemHandleBase {
  values(): AsyncIterableIterator<FileSystemHandle>;
  entries(): AsyncIterableIterator<
    [string, FileSystemHandle]
  >;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<FileSystemDirectoryHandleExt>;
  getFileHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<FileSystemFileHandleExt>;
  move?: (destination: string | FileSystemDirectoryHandle) => Promise<void>;
}

export interface WindowWithFS {
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite';
  }) => Promise<FileSystemDirectoryHandleExt>;
}

declare global {
  interface FileSystemFileHandle {
    createWritable(): Promise<FileSystemWritableFileStream>;
    move?: (destination: string | FileSystemDirectoryHandle) => Promise<void>;
  }
  interface FileSystemDirectoryHandle {
    queryPermission?: (
      descriptor?: FileSystemDirectoryHandlePermissionDescriptor
    ) => Promise<FileSystemHandlePermissionState['state']>;
    requestPermission?: (
      descriptor?: FileSystemDirectoryHandlePermissionDescriptor
    ) => Promise<FileSystemHandlePermissionState['state']>;
    values(): AsyncIterableIterator<FileSystemHandle>;
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
    getDirectoryHandle(
      name: string,
      options?: { create?: boolean }
    ): Promise<FileSystemDirectoryHandle>;
    getFileHandle(
      name: string,
      options?: { create?: boolean }
    ): Promise<FileSystemFileHandle>;
    move?: (destination: string | FileSystemDirectoryHandle) => Promise<void>;
  }
  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: 'read' | 'readwrite';
    }) => Promise<FileSystemDirectoryHandle>;
  }
}

export {};
