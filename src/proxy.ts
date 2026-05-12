import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import {
  checkRateLimit,
  getTierForPath,
  buildFingerprint,
  logAbuse,
} from '@/lib/rate-limiter'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the real client IP — Vercel injects x-forwarded-for automatically. */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    // x-forwarded-for can be a comma-separated list; first is the real client
    return forwarded.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') ?? '0.0.0.0'
}

/**
 * Attempt to extract a Supabase user ID from the session cookie
 * WITHOUT calling Supabase (we want this to be fast and not duplicate
 * the session check that updateSession already does).
 *
 * The Supabase auth cookie is a base64-encoded JWT. We decode the
 * payload to get `sub` (the user ID). If anything fails, we return null.
 */
function extractUserIdFromCookie(request: NextRequest): string | null {
  try {
    // Supabase v2 uses a cookie named sb-<ref>-auth-token (stringified JSON array)
    // We look for any cookie starting with 'sb-' and containing 'auth-token'
    const cookies = request.cookies.getAll()
    const authCookie = cookies.find(
      (c) => c.name.startsWith('sb-') && c.name.includes('auth-token'),
    )
    if (!authCookie?.value) return null

    // The cookie value may be a JSON array where the first element is the access token
    let tokenStr = authCookie.value
    // Handle URL-encoded JSON (e.g. ["eyJ...","eyJ..."])
    if (tokenStr.startsWith('%5B') || tokenStr.startsWith('[')) {
      try {
        const decoded = decodeURIComponent(tokenStr)
        const parsed = JSON.parse(decoded)
        if (Array.isArray(parsed) && parsed.length > 0) {
          tokenStr = parsed[0]
        }
      } catch {
        // Not a JSON array, try using the raw value
      }
    }

    // Decode the JWT payload (middle segment)
    const parts = tokenStr.split('.')
    if (parts.length !== 3) return null

    const payload = JSON.parse(atob(parts[1]))
    return payload.sub ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Paths that should skip rate limiting entirely
// ---------------------------------------------------------------------------
const SKIP_RATE_LIMIT_PREFIXES = [
  '/_next/',
  '/favicon.ico',
]

function shouldSkipRateLimit(pathname: string): boolean {
  return SKIP_RATE_LIMIT_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

// ---------------------------------------------------------------------------
// Middleware entry point
// ---------------------------------------------------------------------------

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // ── 1. Skip rate limiting for static assets ──
  if (shouldSkipRateLimit(pathname)) {
    return await updateSession(request)
  }

  // ── 2. Build identity fingerprint ──
  const ip = getClientIp(request)
  const ua = request.headers.get('user-agent') ?? ''
  const lang = request.headers.get('accept-language') ?? ''
  const userId = extractUserIdFromCookie(request)
  const fingerprint = await buildFingerprint(ip, ua, lang, userId)

  // ── 3. Determine rate-limit tier ──
  const tier = getTierForPath(pathname)

  // ── 4. Check rate limit ──
  const result = await checkRateLimit(fingerprint, tier)

  // ── 5. If blocked → 429 with Retry-After ──
  if (!result.allowed) {
    logAbuse({
      fingerprint,
      endpoint: pathname,
      ip,
      userAgent: ua,
      tier: tier.name,
      retryAfterSeconds: result.retryAfterSeconds,
    })

    return NextResponse.json(
      {
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Please retry after ${result.retryAfterSeconds} seconds.`,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfterSeconds),
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(
            Math.ceil(Date.now() / 1000) + result.retryAfterSeconds,
          ),
        },
      },
    )
  }

  // ── 6. Allowed → proceed to existing Supabase middleware (untouched) ──
  const response = await updateSession(request)

  // Attach informational rate-limit headers to successful responses
  response.headers.set('X-RateLimit-Limit', String(result.limit))
  response.headers.set('X-RateLimit-Remaining', String(result.remaining))

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
