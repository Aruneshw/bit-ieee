import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getRoleDashboardPath, needsProfileCompletion } from '@/lib/types'
import type { UserRole } from '@/lib/types'

export default async function DashboardRedirect() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) redirect('/login')

  // Lookup by email — handles admin pre-populated rows
  const { data: profile } = await supabase
    .from('users')
    .select('role, profile_completed')
    .eq('email', user.email.toLowerCase())
    .single()

  if (!profile) redirect('/login?error=not_registered')

  const role = profile.role as UserRole

  // Check profile completion only for roles that need the setup form
  if (needsProfileCompletion(role) && !profile.profile_completed) {
    redirect('/profile-setup')
  }

  redirect(getRoleDashboardPath(role))
}
