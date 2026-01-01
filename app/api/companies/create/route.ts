'use server'

import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')

import { NextResponse } from 'next/server'
import { createSupabaseService } from '@/lib/supabaseService'

export async function POST(req: Request) {
  try {
    const { name, benefit } = await req.json()
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }
    const parsedBenefit = Number(benefit)
    const benefitValue = Number.isFinite(parsedBenefit) ? parsedBenefit : 0

    // Validate env here to surface clear errors
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_SUPABASE_URL missing' }, { status: 500 })
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 500 })
    }

    const supabase = createSupabaseService()
    const { data, error } = await supabase
      .from('companies')
      .insert({ name, combenef: benefitValue })
      .select()
      .single()

    if (error) {
      console.error('Create company error', error)
      return NextResponse.json({
        error: error.message,
        code: error.code,
        details: (error as any)?.details,
        hint: (error as any)?.hint,
      }, { status: 400 })
    }
    return NextResponse.json({ company: data })
  } catch (err: any) {
    console.error('Create company unexpected error', err)
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
  }
}
