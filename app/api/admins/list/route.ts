'use server'

import { NextResponse } from 'next/server'
import { createSupabaseService } from '@/lib/supabaseService'

export async function GET() {
  try {
    const supabase = createSupabaseService()

    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, role')

    if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 400 })

    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers()
    if (usersError) return NextResponse.json({ error: usersError.message }, { status: 400 })

    const profileRoleMap = new Map<string, string>()
    profilesData?.forEach((p) => profileRoleMap.set(p.id, p.role))

    const admins = (usersData?.users || []).map((u) => ({
      id: u.id,
      email: u.email,
      name: (u.user_metadata as any)?.name || (u.user_metadata as any)?.username || u.email || u.id,
      role: profileRoleMap.get(u.id) || (u.user_metadata as any)?.role || 'admin',
    }))

    return NextResponse.json({ admins })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
  }
}
