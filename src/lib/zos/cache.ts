import { zosConfig } from './config';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds || 60;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttl * 1000),
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  deletePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  // Helper methods for generating cache keys
  static keyDatasetList(userId: string, host: string, port: number, pattern: string): string {
    return `ds:list:${userId}@${host}:${port}:${pattern}`;
  }

  static keyMembers(userId: string, host: string, port: number, dataset: string): string {
    return `ds:members:${userId}@${host}:${port}:${dataset}`;
  }

  static keyContent(userId: string, host: string, port: number, dataset: string, member?: string): string {
    const base = `ds:content:${userId}@${host}:${port}:${dataset}`;
    return member ? `${base}:${member}` : base;
  }

  static keyJobs(userId: string, host: string, port: number, owner?: string): string {
    const base = `jes:jobs:${userId}@${host}:${port}`;
    return owner ? `${base}:${owner}` : base;
  }

  static keyJob(userId: string, host: string, port: number, jobId: string): string {
    return `jes:job:${userId}@${host}:${port}:${jobId}`;
  }
}

export const zosCache = new CacheService();
export default zosCache;
