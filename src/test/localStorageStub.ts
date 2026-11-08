import { beforeEach } from 'vitest';

// Minimal in-memory localStorage for the node test environment.
class MemoryStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return Array.from(this.map.keys())[i] ?? null;
  }
  getItem(k: string) {
    return this.map.has(k) ? (this.map.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
}

beforeEach(() => {
  (globalThis as any).localStorage = new MemoryStorage();
});
