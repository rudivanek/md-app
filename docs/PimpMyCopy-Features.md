<!--
  Version: 1.3.0
  Last Updated: 2026-07-19T00:00:00Z
-->

# PimpMyCopy Features

## File System

### moveEntryToFolder (cross-directory move)

Moves a file or folder from one directory to another on the user's connected disk folder.

- **Implementation:** Always performs a copy-then-delete sequence via `copyEntryToTarget` followed by `sourceDir.removeEntry`. The native `FileSystemHandle.move(destinationDir)` fast path is intentionally NOT used because that overload only works inside the browser's Origin Private File System (OPFS); for real user folders selected via `showDirectoryPicker()`, it silently renames the entry in place to `"[object FileSystemDirectoryHandle]"` without relocating it.
- **Verification before deletion:** After `copyEntryToTarget` completes, `existsInTarget` confirms the entry actually exists in the destination directory (via `getFileHandle` / `getDirectoryHandle`) before the source is removed. If verification fails, the move aborts with an error and the source is preserved — a failed copy can never result in data loss.
- **renameOnDisk (same-directory rename):** Unchanged. The single-argument `handle.move(newName)` overload is fully supported outside OPFS and remains the fast path for renames within the same folder.

### Buggy move() artifact detection

Older builds attempted the native `handle.move(destinationDir)` fast path, which on non-OPFS folders silently renamed entries to `"[object FileSystemDirectoryHandle]"` instead of moving them. `findBuggyMoveArtifacts(items)` scans the loaded item list for any entry whose `fileName`/`name` contains that marker string.

- On load, `useNotes` calls this helper and, if artifacts are found, stores them in `buggyMoveArtifacts` state and logs a console warning with the affected entries.
- These files/folders are not auto-renamed because the original intended name may not be recoverable from the marker alone; they are surfaced for manual review.
- A dismissible banner is shown in the app (bottom-left) when `buggyMoveArtifacts.length > 0`, listing up to 5 affected file names so the user knows to rename them manually. Dismissing sets `buggyWarningDismissed` and hides the banner for the session.

## App Boot & Folder Reconnect

### Silent reconnect on reload

On boot, `App.tsx` loads any previously-saved folder handle via `loadFolderHandle()`. If a stored handle exists, it attempts a real reconnect rather than just displaying it:

1. Calls `verifyPermission(stored, true)`, which first runs `queryPermission` (no user gesture needed). If Chrome already remembers granted permission (common case), it returns `granted` immediately.
2. On `granted`, sets `rootHandle` to the stored handle and opens straight into the vault — no picker shown.
3. If permission is denied or verification throws, sets `pickerOpen = true` so the `FolderPicker` "Reconnect" button is shown. That click provides the user gesture `requestPermission` needs.

## Sidebar

### Cross-folder drag-and-drop

Replaces the default `closestCenter`-only collision detection with a hybrid `collisionDetection` that gives folder rows priority for "move inside" drops:

- Uses `pointerWithin` to find pointer-over candidates; if any candidate is a folder, that folder is the sole collision target — so dropping anywhere over a folder row unambiguously triggers "move inside" rather than competing with "reorder near this note".
- When a folder is expanded, its visible children also count as "inside" that folder via a `childToFolder` map — dropping on a child moves into the parent folder, not next to the child. The entire expanded subtree is one drop target.
- Falls back to `closestCenter` for note-vs-note reordering when no folder (or folder child) is under the pointer.
- Folder rows show a distinct, enlarged drop-zone highlight during drag: a taller padded band (`py-[14px]`) with a 2px ring and tinted background, visually distinct from the thin reorder indicator between notes. Notes dim to 50% opacity while a drag is active so folders "pop" as targets.
- Action buttons (favorite/delete/menu) are hidden during an active drag so they don't reduce the drop-target hit area.

### "Move to folder..." non-drag fallback

A drag-free way to file notes exactly, useful for verification and accessibility:

- Each note row has a "..." (MoreHorizontal) menu button in its hover actions that opens a `MoveToFolderModal`.
- The modal lists "Root (no folder)" plus all existing folders by name, with folder icons.
- Picking a folder calls `moveItem(noteId, folderId, 'inside')`; picking Root calls `moveItem(noteId, null, 'inside')`.
- `moveItem` in `useNotes` accepts `targetId: null` to mean "move to root": it performs the same disk copy-then-delete + handle rebind + in-memory reorder as a cross-folder move, targeting `rootHandle` as the destination directory.
- Modal closes on pick, Escape, or backdrop click.

### Selected folder context for creation

Mirrors Explorer/Finder's "new file here" behavior — new notes/folders land in the currently selected folder, not always root:

- `Sidebar` tracks `selectedFolderId` (string | null; null = root), the "creation context."
- **Clicking a folder row** both toggles expand/collapse (existing behavior) AND marks it as the selected folder via `onSelectFolder`. The selected folder gets a distinct highlight: a subtle green-tinted background (`bg-[#1e2a1e]`) with a 1px green ring (`ring-[#3a5a3a]`) — visually distinct from the active-note highlight (dark gray `bg-[#252525]`).
- **Clicking a note** selects that note's parent folder as the creation context, so creating a new note while viewing a note inside "Projects/Ideas" creates the new note in "Projects/Ideas" too.
- **Root indicator**: a "Root" button at the top of the tree (with Home icon) shows the current creation target. When selected (null context), it highlights green and shows a "create here" label. Clicking it resets the context to root. Clicking empty space below the tree also resets to root.
- **+ New note / + New folder** buttons call `createNote(selectedFolderId)` / `createFolder(selectedFolderId)` instead of hardcoded `null`.
- If the selected folder is deleted, the context automatically falls back to root.
- Auto-edit-title-on-create behavior is unchanged regardless of which folder the new item lands in — `autoEditId` is set the same way in `createNote`/`createFolder`.

### Auto-focus title after note/folder creation

After `createNote` / `createFolder` completes, the newly created item enters rename mode automatically:

- `useNotes` exposes `autoEditId` (the id to auto-edit) and `clearAutoEdit`.
- `Sidebar` passes `autoEditId` / `onClearAutoEdit` down to each `SortableTreeItem`.
- `SortableTreeItem` watches `autoEditId`; when it matches the item, it enters editing mode with the label pre-filled and selected, so the user can immediately type a new name over "Untitled" / "New Folder".
- `autoEditId` is cleared once consumed (or when the rename commits/cancels via `renameItem`).

## Local-mode migration

### Double .md extension fix

The local-mode migration previously built filenames as `` `${safeNameForNote(it.title)}.md` ``, double-appending `.md` since `safeNameForNote` already appends it internally. Fixed to `safeNameForNote(it.title)`.

