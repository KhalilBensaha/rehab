'use server'

import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')

import { NextResponse } from 'next/server'
import { createSupabaseService } from '@/lib/supabaseService'

export async function DELETE() {
  try {
    const supabase = createSupabaseService()

    const { error } = await supabase.from('products').delete().eq('status', 'delivered')
    if (error) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: (error as any)?.details },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
  }
}
