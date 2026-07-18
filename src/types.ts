export interface BaseItem {
  id: string;
  parentId: string | null;
  order: number;
  favorite: boolean;
  createdAt: number;
}

export interface Note extends BaseItem {
  type: 'note';
  title: string;
  /** Real on-disk filename including extension, e.g. "Untitled 2.md". */
  fileName: string;
  content: string;
  updatedAt: number;
}

export interface Folder extends BaseItem {
  type: 'folder';
  name: string;
  collapsed: boolean;
}

export type Item = Note | Folder;

const MD_EXT = '.md';

export function itemLabel(item: Item): string {
  return item.type === 'note'
    ? item.fileName.endsWith(MD_EXT)
      ? item.fileName.slice(0, -MD_EXT.length)
      : item.fileName
    : item.name;
}
