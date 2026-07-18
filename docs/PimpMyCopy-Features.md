<!--
  Version: 1.0.0
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
