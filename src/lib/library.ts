import { get, set } from 'idb-keyval';
import type { SignatureAsset } from './types';

const KEY = 'pdfsign.signatures.v1';

export async function loadSignatures(): Promise<SignatureAsset[]> {
  try {
    const stored = await get<SignatureAsset[]>(KEY);
    if (!Array.isArray(stored)) return [];
    return stored.filter((s) => s && typeof s.dataUrl === 'string');
  } catch (err) {
    console.warn('Could not read signature library', err);
    return [];
  }
}

async function writeAll(items: SignatureAsset[]): Promise<void> {
  await set(KEY, items);
  window.dispatchEvent(new Event('pdfsign:library'));
}

export async function saveSignature(asset: SignatureAsset): Promise<SignatureAsset[]> {
  const items = await loadSignatures();
  const next = [asset, ...items.filter((s) => s.id !== asset.id)];
  await writeAll(next);
  return next;
}

export async function deleteSignatureFromLibrary(id: string): Promise<SignatureAsset[]> {
  const items = await loadSignatures();
  const next = items.filter((s) => s.id !== id);
  await writeAll(next);
  return next;
}

export async function renameSignatureInLibrary(id: string, name: string): Promise<SignatureAsset[]> {
  const items = await loadSignatures();
  const next = items.map((s) => (s.id === id ? { ...s, name } : s));
  await writeAll(next);
  return next;
}
