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
  content: string;
  updatedAt: number;
}

export interface Folder extends BaseItem {
  type: 'folder';
  name: string;
  collapsed: boolean;
}

export type Item = Note | Folder;

export function itemLabel(item: Item): string {
  return item.type === 'note' ? item.title : item.name;
}
