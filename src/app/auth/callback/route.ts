import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { ALL_ADMIN_EMAILS, getRoleDashboardPath, needsProfileCompletion } from '@/lib/types'
import type { UserRole } from '@/lib/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const ALLOWED_DOMAIN = 'bitsathy.ac.in'

function redirectToLogin(origin: string, error: string) {
  return NextResponse.redirect(`${origin}/login?error=${error}`)
}

function canAccessPortal(email: string) {
  return email.endsWith(`@${ALLOWED_DOMAIN}`) || ALL_ADMIN_EMAILS.includes(email)
}

async function getProfileByEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  email: string
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const profileClient =
    supabaseUrl && serviceRoleKey
      ? createAdminClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false },
        })
      : supabase

  return profileClient
    .from('users')
    .select('role, society_id, profile_completed')
    .eq('email', email)
    .maybeSingle()
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const authError = searchParams.get('error')

  if (authError) {
    console.error('OAuth provider returned an error:', authError)
    return redirectToLogin(origin, 'auth_failed')
  }

  if (!code) {
    return redirectToLogin(origin, 'auth_failed')
  }

  try {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('Auth code exchange failed:', exchangeError.message)
      return redirectToLogin(origin, 'auth_failed')
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user?.email) {
      console.error('Authenticated user lookup failed:', userError?.message)
      return redirectToLogin(origin, 'auth_failed')
    }

    const email = user.email.toLowerCase()

    if (!canAccessPortal(email)) {
      await supabase.auth.signOut()
      return redirectToLogin(origin, 'unauthorized_domain')
    }

    const { data: profile, error: profileError } = await getProfileByEmail(supabase, email)

    if (profileError) {
      console.error('Profile fetch error in callback:', profileError.message)
    }

    if (!profile) {
      await supabase.auth.signOut()
      return redirectToLogin(origin, 'not_registered')
    }

    const role = profile.role as UserRole

    if (needsProfileCompletion(role) && !profile.profile_completed) {
      return NextResponse.redirect(`${origin}/profile-setup`)
    }

    return NextResponse.redirect(
      `${origin}${getRoleDashboardPath(role)}`
    )
  } catch (error) {
    console.error('Auth callback crashed:', error)
    return redirectToLogin(origin, 'auth_failed')
  }
}
