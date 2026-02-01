'use server'

import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')

import { NextResponse } from 'next/server'
import { createSupabaseService } from '@/lib/supabaseService'

export async function POST(req: Request) {
  try {
    const { id, clientName, phone, price, companyId } = await req.json()

    if (!clientName || typeof clientName !== 'string') {
      return NextResponse.json({ error: 'clientName required' }, { status: 400 })
    }
    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ error: 'phone required' }, { status: 400 })
    }

    const parsedPrice = Number(price)
    const priceValue = Number.isFinite(parsedPrice) ? parsedPrice : 0

    const supabase = createSupabaseService()
    const payload: any = {
      client_name: clientName,
      phone,
      price: priceValue,
      status: 'in_stock',
      company_id: companyId || null,
    }

    const trimmedId = typeof id === 'string' ? id.trim() : ''
    if (trimmedId) payload.id = trimmedId

    const { data, error } = await supabase.from('products').insert(payload).select().single()

    if (error) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: (error as any)?.details, hint: (error as any)?.hint },
        { status: 400 }
      )
    }

    return NextResponse.json({ product: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
  }
}
