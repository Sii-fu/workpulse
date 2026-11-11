// Asks the server to open the folder dialog on this computer. Every outcome comes back as a plain sentence.

export type PickFolderOutcome =
  | { kind: 'path'; path: string }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

const TYPE_INSTEAD = 'Type the folder path below instead.';

export function pickFolderErrorMessage(status: number): string {
  if (status === 409) return 'A folder window is already open. Choose the folder there, or type the folder path below.';
  if (status === 501) return `Choosing a folder only works on Windows. ${TYPE_INSTEAD}`;
  if (status === 403) return `The folder window is not available in this setup. ${TYPE_INSTEAD}`;
  return `Could not open the folder window. ${TYPE_INSTEAD}`;
}

export async function pickFolder(fetchFn: typeof fetch = fetch): Promise<PickFolderOutcome> {
  try {
    const res = await fetchFn('/api/pick-folder', { method: 'POST' });
    if (!res.ok) return { kind: 'error', message: pickFolderErrorMessage(res.status) };
    const data = (await res.json()) as { path?: unknown; cancelled?: unknown };
    if (typeof data.path === 'string' && data.path.trim()) return { kind: 'path', path: data.path };
    if (data.cancelled === true) return { kind: 'cancelled' };
    return { kind: 'error', message: pickFolderErrorMessage(500) };
  } catch {
    return { kind: 'error', message: pickFolderErrorMessage(500) };
  }
}
