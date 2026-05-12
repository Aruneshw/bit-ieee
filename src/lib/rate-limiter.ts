import { getRedis } from './redis'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitTier {
  /** Human-readable name for logging */
  name: string
  /** Maximum requests allowed in the window */
  maxRequests: number
  /** Window size in seconds */
  windowSeconds: number
}

export interface RateLimitResult {
  /** Whether the request is allowed through */
  allowed: boolean
  /** Requests remaining in the current window */
  remaining: number
  /** Total limit for the current tier */
  limit: number
  /** Seconds until the window resets (useful for Retry-After header) */
  retryAfterSeconds: number
}

// ---------------------------------------------------------------------------
// Tier Definitions
// ---------------------------------------------------------------------------

export const RATE_LIMIT_TIERS: Record<string, RateLimitTier> = {
  GENERAL: {
    name: 'general',
    maxRequests: 60,
    windowSeconds: 60,
  },
  AUTH_CALLBACK: {
    name: 'auth_callback',
    maxRequests: 10,
    windowSeconds: 60,
  },
  LOGIN_PAGE: {
    name: 'login_page',
    maxRequests: 15,
    windowSeconds: 60,
  },
  QUIZ_VERIFY: {
    name: 'quiz_verify',
    maxRequests: 5,
    windowSeconds: 60,
  },
  QUIZ_START: {
    name: 'quiz_start',
    maxRequests: 3,
    windowSeconds: 60,
  },
  SEND_EMAIL: {
    name: 'send_email',
    maxRequests: 5,
    windowSeconds: 60,
  },
  BULK_CREATE: {
    name: 'bulk_create',
    maxRequests: 3,
    windowSeconds: 60,
  },
  SYNC_EVENTS: {
    name: 'sync_events',
    maxRequests: 2,
    windowSeconds: 60,
  },
}

// ---------------------------------------------------------------------------
// Lua Script — Atomic Sliding Window Log
// ---------------------------------------------------------------------------

/**
 * Atomic Lua script that implements a sliding window log rate limiter.
 *
 * KEYS[1] = the rate-limit key (sorted set)
 * ARGV[1] = current timestamp in milliseconds
 * ARGV[2] = window size in milliseconds
 * ARGV[3] = max allowed requests
 * ARGV[4] = TTL in seconds (for automatic key expiry)
 *
 * Returns: [allowed (0|1), remaining, retryAfterMs]
 */
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

-- Remove entries outside the current window
local windowStart = now - window
redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

-- Count current entries
local count = redis.call('ZCARD', key)

if count < limit then
  -- Add current request (score = timestamp, member = unique id)
  redis.call('ZADD', key, now, now .. '-' .. math.random(100000))
  redis.call('EXPIRE', key, ttl)
  return {1, limit - count - 1, 0}
else
  -- Rate limited — calculate retry-after from the oldest entry
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retryAfter = 0
  if oldest and #oldest >= 2 then
    retryAfter = tonumber(oldest[2]) + window - now
    if retryAfter < 0 then retryAfter = 0 end
  end
  return {0, 0, retryAfter}
end
`

// ---------------------------------------------------------------------------
// Route → Tier Mapping
// ---------------------------------------------------------------------------

/**
 * Determines the rate-limit tier for a given request pathname.
 * More specific paths are checked first.
 */
export function getTierForPath(pathname: string): RateLimitTier {
  if (pathname.startsWith('/api/quiz/verify')) return RATE_LIMIT_TIERS.QUIZ_VERIFY
  if (pathname.startsWith('/api/quiz/start')) return RATE_LIMIT_TIERS.QUIZ_START
  if (pathname.startsWith('/api/send-email')) return RATE_LIMIT_TIERS.SEND_EMAIL
  if (pathname.startsWith('/api/admin/bulk-create-users')) return RATE_LIMIT_TIERS.BULK_CREATE
  if (pathname.startsWith('/api/sync-ieee-events')) return RATE_LIMIT_TIERS.SYNC_EVENTS
  if (pathname.startsWith('/auth/callback')) return RATE_LIMIT_TIERS.AUTH_CALLBACK
  if (pathname === '/login') return RATE_LIMIT_TIERS.LOGIN_PAGE
  return RATE_LIMIT_TIERS.GENERAL
}

// ---------------------------------------------------------------------------
// Fingerprint Builder
// ---------------------------------------------------------------------------

/**
 * Builds a composite fingerprint from request signals.
 *
 * For authenticated users the Supabase user-id is the primary key,
 * making IP rotation irrelevant.  For anonymous users we combine
 * IP + User-Agent + Accept-Language as a best-effort identifier.
 *
 * We use a simple hash (Web Crypto SHA-256) to keep Redis keys short
 * and avoid storing raw PII.
 */
export async function buildFingerprint(
  ip: string,
  userAgent: string,
  acceptLanguage: string,
  userId?: string | null,
): Promise<string> {
  const raw = userId
    ? `uid:${userId}`
    : `anon:${ip}|${userAgent}|${acceptLanguage}`

  // Use Web Crypto (available in Edge Runtime) for SHA-256
  const encoder = new TextEncoder()
  const data = encoder.encode(raw)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ---------------------------------------------------------------------------
// Core Check
// ---------------------------------------------------------------------------

/**
 * Checks whether a request identified by `fingerprint` is within the
 * allowed rate for the given `tier`.
 *
 * Fail-open: if Redis is unreachable the request is always allowed.
 */
export async function checkRateLimit(
  fingerprint: string,
  tier: RateLimitTier,
): Promise<RateLimitResult> {
  const redis = getRedis()

  // Fail-open when Redis is unavailable
  if (!redis) {
    return { allowed: true, remaining: tier.maxRequests, limit: tier.maxRequests, retryAfterSeconds: 0 }
  }

  const key = `rl:${tier.name}:${fingerprint}`
  const now = Date.now()
  const windowMs = tier.windowSeconds * 1000

  try {
    const result = await redis.eval(
      SLIDING_WINDOW_SCRIPT,
      [key],
      [now.toString(), windowMs.toString(), tier.maxRequests.toString(), (tier.windowSeconds + 10).toString()],
    ) as [number, number, number]

    const [allowed, remaining, retryAfterMs] = result
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000)

    return {
      allowed: allowed === 1,
      remaining,
      limit: tier.maxRequests,
      retryAfterSeconds,
    }
  } catch (error) {
    // Fail-open: Redis error should never block legitimate users
    console.error('[RateLimit] Redis error — failing open:', error)
    return { allowed: true, remaining: tier.maxRequests, limit: tier.maxRequests, retryAfterSeconds: 0 }
  }
}

// ---------------------------------------------------------------------------
// Abuse Logger
// ---------------------------------------------------------------------------

/**
 * Logs rate-limit violations for post-incident analysis.
 * This structured output integrates with any log aggregator or Sentry.
 */
export function logAbuse(details: {
  fingerprint: string
  endpoint: string
  ip: string
  userAgent: string
  tier: string
  retryAfterSeconds: number
}): void {
  console.warn(
    JSON.stringify({
      event: 'RATE_LIMIT_EXCEEDED',
      ...details,
      timestamp: new Date().toISOString(),
    }),
  )
}
