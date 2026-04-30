import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getRoleDashboardPath, needsProfileCompletion } from '@/lib/types'
import type { UserRole } from '@/lib/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function DashboardRedirect() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) redirect('/login')

  // Use service role key to bypass RLS (avoids infinite recursion in users policies)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const profileClient =
    supabaseUrl && serviceRoleKey
      ? createAdminClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false },
        })
      : supabase

  const { data: profile, error: profileError } = await profileClient
    .from('users')
    .select('role, profile_completed')
    .eq('email', user.email.toLowerCase())
    .maybeSingle()

  if (profileError) {
    console.error('Dashboard profile fetch error:', profileError.message)
  }

  if (!profile) redirect('/login?error=not_registered')

  const role = profile.role as UserRole

  // Check profile completion only for roles that need the setup form
  if (needsProfileCompletion(role) && !profile.profile_completed) {
    redirect('/profile-setup')
  }

  redirect(getRoleDashboardPath(role))
}
