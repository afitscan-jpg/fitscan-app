// src/lib/progress-photos.ts
// LOCAL-ONLY progress photos. Images are copied into the app's document directory
// and indexed in a small JSON file next to them. Nothing here touches the network,
// Supabase, or any backend — body-image data never leaves the device.
//
// Storage layout (document dir):
//   progress-photos/
//     index.json                 ← [{ id, uri, date, weight_kg }]
//     <id>.<ext>                 ← the copied image files
//
// Uses the Expo 56 file-system API (File / Directory / Paths classes).

import { Directory, File, Paths } from 'expo-file-system';

const DIR_NAME = 'progress-photos';
const INDEX_NAME = 'index.json';

export interface ProgressPhoto {
  id: string;
  uri: string;              // file:// URI inside the document directory
  date: string;             // ISO timestamp
  weight_kg?: number | null;
}

function photosDir(): Directory {
  return new Directory(Paths.document, DIR_NAME);
}

function ensureDir(): Directory {
  const dir = photosDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function indexFile(dir: Directory): File {
  return new File(dir, INDEX_NAME);
}

function isValidEntry(v: unknown): v is ProgressPhoto {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  return typeof e.id === 'string' && typeof e.uri === 'string' && typeof e.date === 'string';
}

async function readIndex(dir: Directory): Promise<ProgressPhoto[]> {
  const f = indexFile(dir);
  if (!f.exists) return [];
  try {
    const parsed: unknown = JSON.parse(await f.text());
    return Array.isArray(parsed) ? parsed.filter(isValidEntry) : [];
  } catch {
    // Corrupt/empty index — treat as no photos rather than crashing.
    return [];
  }
}

function writeIndex(dir: Directory, list: ProgressPhoto[]): void {
  const f = indexFile(dir);
  if (!f.exists) f.create();
  f.write(JSON.stringify(list));
}

function extFromUri(uri: string): string {
  const clean = uri.split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  const slash = clean.lastIndexOf('/');
  if (dot > slash && dot < clean.length - 1) {
    const ext = clean.slice(dot + 1).toLowerCase();
    if (/^[a-z0-9]{2,5}$/.test(ext)) return ext;
  }
  return 'jpg';
}

/**
 * Copy a picked/captured image into the document directory and record it in the
 * local index. Returns the saved entry. Purely on-device.
 */
export async function addPhoto(
  sourceUri: string,
  opts: { date?: string; weight_kg?: number | null } = {},
): Promise<ProgressPhoto> {
  const dir = ensureDir();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dest = new File(dir, `${id}.${extFromUri(sourceUri)}`);

  await new File(sourceUri).copy(dest);

  const entry: ProgressPhoto = {
    id,
    uri: dest.uri,
    date: opts.date ?? new Date().toISOString(),
    weight_kg: opts.weight_kg ?? null,
  };

  const list = await readIndex(dir);
  list.push(entry);
  writeIndex(dir, list);
  return entry;
}

/** All photos, newest first. */
export async function listPhotos(): Promise<ProgressPhoto[]> {
  const dir = photosDir();
  if (!dir.exists) return [];
  const list = await readIndex(dir);
  return list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Remove a photo's file and its index entry. */
export async function deletePhoto(id: string): Promise<void> {
  const dir = photosDir();
  if (!dir.exists) return;
  const list = await readIndex(dir);
  const entry = list.find((p) => p.id === id);
  if (entry) {
    try {
      const f = new File(entry.uri);
      if (f.exists) f.delete();
    } catch {
      // File already gone — still drop the index entry below.
    }
  }
  writeIndex(dir, list.filter((p) => p.id !== id));
}
