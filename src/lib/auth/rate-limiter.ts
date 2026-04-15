/**
 * In-memory rate limiter
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private limits = new Map<string, RateLimitEntry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  constructor(
    private windowMs = 60_000,
    private maxRequests = 10
  ) {
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    if (this.cleanupTimer && typeof this.cleanupTimer === "object" && "unref" in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const entry = this.limits.get(key);
    if (!entry || now > entry.resetTime) {
      this.limits.set(key, { count: 1, resetTime: now + this.windowMs });
      return true;
    }
    if (entry.count < this.maxRequests) {
      entry.count++;
      return true;
    }
    return false;
  }

  getRemainingRequests(key: string): number {
    const entry = this.limits.get(key);
    if (!entry || Date.now() > entry.resetTime) return this.maxRequests;
    return Math.max(0, this.maxRequests - entry.count);
  }

  getResetTime(key: string): number {
    const entry = this.limits.get(key);
    if (!entry || Date.now() > entry.resetTime) return 0;
    return entry.resetTime;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits) {
      if (now > entry.resetTime) this.limits.delete(key);
    }
  }
}

export const chatRateLimiter = new RateLimiter(60_000, 30);
export const modelsRateLimiter = new RateLimiter(60_000, 20);
export const searchRateLimiter = new RateLimiter(60_000, 10);
export const authRateLimiter = new RateLimiter(60_000, 5);
