'use server'

import { NextResponse } from 'next/server'
import { createSupabaseService } from '@/lib/supabaseService'

export async function POST(req: Request) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const supabase = createSupabaseService()

    // delete auth user
    const { error: authError } = await supabase.auth.admin.deleteUser(id)
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

    // delete profile
    const { error: profileError } = await supabase.from('profiles').delete().eq('id', id)
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
  }
}
