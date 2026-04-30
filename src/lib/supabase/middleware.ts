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

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      console.error('Supabase middleware auth error:', error.message)
    }

    const path = request.nextUrl.pathname

    // Public routes that don't need auth at all
    const publicRoutes = ['/', '/login', '/auth/callback']
    const isPublicRoute = publicRoutes.some(r => path === r || path.startsWith('/auth/'))

    // Routes that need auth but NOT profile completion
    const authOnlyRoutes = ['/profile-setup', '/dashboard']
    const isAuthOnlyRoute = authOnlyRoutes.some(r => path === r || path.startsWith(r + '/'))

    // Not logged in → redirect to login (unless public)
    if (!user && !isPublicRoute) {
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
