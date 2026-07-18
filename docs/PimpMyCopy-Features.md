<!--
  Version: 1.1.0
  Last Updated: 2026-07-18T00:00:00Z
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
- Falls back to `closestCenter` for note-vs-note reordering when no folder is under the pointer.
- Folder rows show a distinct drop-zone highlight (ring + tint) via `isDragOver && isFolder` in `SortableTreeItem`, visually distinct from the reorder indicator between notes.

### Auto-focus title after note/folder creation

After `createNote` / `createFolder` completes, the newly created item enters rename mode automatically:

- `useNotes` exposes `autoEditId` (the id to auto-edit) and `clearAutoEdit`.
- `Sidebar` passes `autoEditId` / `onClearAutoEdit` down to each `SortableTreeItem`.
- `SortableTreeItem` watches `autoEditId`; when it matches the item, it enters editing mode with the label pre-filled and selected, so the user can immediately type a new name over "Untitled" / "New Folder".
- `autoEditId` is cleared once consumed (or when the rename commits/cancels via `renameItem`).

## Local-mode migration

### Double .md extension fix

The local-mode migration previously built filenames as `` `${safeNameForNote(it.title)}.md` ``, double-appending `.md` since `safeNameForNote` already appends it internally. Fixed to `safeNameForNote(it.title)`.

