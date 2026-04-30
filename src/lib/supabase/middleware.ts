import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables in Edge runtime.')
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const path = request.nextUrl.pathname

    // Public routes that should not ask Supabase for a session.
    if (path === '/' || path.startsWith('/auth/')) {
      return supabaseResponse
    }

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error && error.message !== 'Auth session missing!') {
      console.error('Supabase middleware auth error:', error.message)
    }

    // Not logged in → redirect to login (unless public)
    if (!user && path !== '/login') {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // Logged in + on /login → redirect to dashboard (which will route them)
    if (user && path === '/login') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  } catch (error) {
    // Prevent crashes: if anything throws (e.g. env vars missing), just proceed
    console.error('Middleware crash prevented:', error)
    return supabaseResponse
  }
}
