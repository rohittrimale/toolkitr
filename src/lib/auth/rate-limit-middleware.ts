// lib/rate-limit-middleware.ts - Rate limit enforcement for Next.js API routes
import { NextRequest, NextResponse } from 'next/server';
import { chatRateLimiter, modelsRateLimiter, searchRateLimiter, authRateLimiter } from '@/lib/auth/rate-limiter';
import { prisma } from '@/lib/core/db';

export interface RateLimitConfig {
  windowMs?: number;  // Time window in milliseconds (default 60000)
  maxRequests?: number;  // Max requests per window (default from limiter)
  keyGenerator?: (request: NextRequest) => string;  // Custom key generation
  skipSuccessfulRequests?: boolean;  // Skip counting successful requests
  skipFailedRequests?: boolean;  // Skip counting failed requests
}

/**
 * Identify rate limiter instance based on endpoint
 */
export function getRateLimiterForEndpoint(endpoint: string) {
  if (endpoint.includes('/chat') || endpoint.includes('/learn')) {
    return chatRateLimiter;
  }
  if (endpoint.includes('/models')) {
    return modelsRateLimiter;
  }
  if (endpoint.includes('/search')) {
    return searchRateLimiter;
  }
  if (endpoint.includes('/auth') || endpoint.includes('/login')) {
    return authRateLimiter;
  }
  // Default to chat limiter for safety
  return chatRateLimiter;
}

/**
 * Extract user ID from request headers or session
 * Supports: Authorization header, X-User-Id header, extracting from JWT
 */
export function extractUserIdFromRequest(request: NextRequest): string {
  // Try X-User-Id header (custom)
  const customUserId = request.headers.get('x-user-id');
  if (customUserId) return customUserId;

  // Try Authorization header (JWT/Bearer token)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // For simple extraction, just use first 20 chars of token
    // In production, you'd validate and decode the JWT properly
    return `user-${token.substring(0, 20)}`;
  }

  // Fallback to IP address (less ideal, but better than nothing)
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  return `ip-${ip}`;
}

/**
 * Generate rate limit key from request
 * Format: "endpoint:userId"
 */
export function generateRateLimitKey(endpoint: string, userId: string): string {
  return `${endpoint}:${userId}`;
}

/**
 * Check rate limit for a request
 * Returns: { allowed: boolean, remaining: number, resetTime: number, headers: Record<string, string> }
 */
export function checkRateLimit(
  rateLimiter: any,
  key: string,
  endpoint: string,
  userId: string
): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  headers: Record<string, string>;
} {
  const allowed = rateLimiter.isAllowed(key);
  const remaining = rateLimiter.getRemainingRequests(key);
  const resetTime = rateLimiter.getResetTime(key);

  // Return rate limit headers (RFC 6585 compliant)
  const headers: Record<string, string> = {
    'RateLimit-Limit': rateLimiter.maxRequests.toString(),
    'RateLimit-Remaining': remaining.toString(),
    'RateLimit-Reset': Math.ceil(resetTime / 1000).toString(), // Unix timestamp
    'X-RateLimit-Limit': rateLimiter.maxRequests.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
  };

  if (!allowed) {
    // Add retry-after header
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
    headers['Retry-After'] = retryAfter.toString();
  }

  return {
    allowed,
    remaining,
    resetTime,
    headers,
  };
}

/**
 * Middleware function to be called at the start of API route handlers
 * Usage:
 *   const rateLimitResult = await enforceRateLimit(request);
 *   if (!rateLimitResult.allowed) {
 *     return rateLimitResult.response;
 *   }
 */
export async function enforceRateLimit(
  request: NextRequest,
  config: RateLimitConfig = {}
): Promise<{
  allowed: boolean;
  response?: NextResponse;
  remaining?: number;
  resetTime?: number;
  headers: Record<string, string>;
}> {
  try {
    // Get endpoint from request URL
    const endpoint = new URL(request.url).pathname;

    // Extract user ID (required for rate limiting)
    const userId = extractUserIdFromRequest(request);

    // Get appropriate rate limiter for this endpoint
    const limiter = getRateLimiterForEndpoint(endpoint);

    // Generate rate limit key
    const key = generateRateLimitKey(endpoint, userId);

    // Check rate limit
    const result = checkRateLimit(limiter, key, endpoint, userId);

    if (!result.allowed) {
      // Rate limit exceeded - return 429
      return {
        allowed: false,
        response: NextResponse.json(
          {
            error: 'Too Many Requests',
            message: 'You have exceeded the rate limit for this endpoint',
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
          },
          {
            status: 429,
            headers: result.headers,
          }
        ),
        headers: result.headers,
      };
    }

    // Rate limit check passed
    return {
      allowed: true,
      remaining: result.remaining,
      resetTime: result.resetTime,
      headers: result.headers,
    };
  } catch (error) {
    console.error('[RateLimit] Error in rate limit check:', error);
    // On error, allow the request but log it
    // Never fail-closed on rate limiting
    return {
      allowed: true,
      headers: {},
    };
  }
}

/**
 * Helper to wrap an API route handler with rate limiting
 * Usage:
 *   export const POST = withRateLimit(async (request) => {
 *     // your handler code
 *   });
 */
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  config: RateLimitConfig = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const rateLimitResult = await enforceRateLimit(request, config);

    if (!rateLimitResult.allowed && rateLimitResult.response) {
      return rateLimitResult.response;
    }

    // Call the actual handler
    const response = await handler(request);

    // Add rate limit headers to response
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  };
}

/**
 * Optional: Log rate limit events to database for analytics
 * Run this after a successful or failed request to record the attempt
 */
export async function logRateLimitEvent(
  userId: string,
  endpoint: string,
  allowed: boolean,
  remaining: number
): Promise<void> {
  try {
    const now = new Date();
    // Round down to minute for window grouping
    const windowStart = new Date(Math.floor(now.getTime() / 60000) * 60000);
    const windowEnd = new Date(windowStart.getTime() + 60000);

    // Try to update existing record, otherwise create new one
    const existing = await prisma.rateLimit.findUnique({
      where: {
        user_id_endpoint_window_start: {
          user_id: userId,
          endpoint,
          window_start: windowStart,
        },
      },
    });

    if (existing) {
      // Update existing window record
      await prisma.rateLimit.update({
        where: {
          id: existing.id,
        },
        data: {
          request_count: existing.request_count + 1,
        },
      });
    } else {
      // Create new window record
      await prisma.rateLimit.create({
        data: {
          user_id: userId,
          endpoint,
          request_count: 1,
          window_start: windowStart,
          window_end: windowEnd,
        },
      });
    }
  } catch (error) {
    // Silently fail - don't let logging errors block the request
    console.error('[RateLimit] Error logging rate limit event:', error);
  }
}
