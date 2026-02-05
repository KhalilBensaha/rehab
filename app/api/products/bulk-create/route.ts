'use server'

import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')

import { NextResponse } from 'next/server'
import { createSupabaseService } from '@/lib/supabaseService'

function parsePrice(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw !== 'string') return 0
  const normalized = raw
    .replace(/\s+/g, '')
    .replace(/[A-Za-z]/g, '')
    .replace(/,/g, '.')
  const match = normalized.match(/-?\d+(?:\.\d+)?/)
  if (!match) return 0
  const parsed = Number.parseFloat(match[0])
  return Number.isFinite(parsed) ? parsed : 0
}

export async function POST(req: Request) {
  try {
    const { items, companyId } = await req.json()

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items required' }, { status: 400 })
    }

    const cleaned = items
      .map((item) => ({
        id: typeof item?.trackingId === 'string' ? item.trackingId.trim() : String(item?.id || '').trim(),
        clientName: typeof item?.clientName === 'string' ? item.clientName.trim() : '',
        phone: typeof item?.phone === 'string' ? item.phone.trim() : '',
        price: parsePrice(item?.price),
      }))
      .filter((item) => item.id)

    const uniqueMap = new Map<string, typeof cleaned[number]>()
    const duplicateInPayload: string[] = []

    cleaned.forEach((item) => {
      if (uniqueMap.has(item.id)) {
        duplicateInPayload.push(item.id)
      } else {
        uniqueMap.set(item.id, item)
      }
    })

    const uniqueItems = Array.from(uniqueMap.values())
    const ids = uniqueItems.map((i) => i.id)

    const supabase = createSupabaseService()
    const { data: existing } = await supabase.from('products').select('id').in('id', ids)
    const existingIds = new Set((existing || []).map((row: any) => String(row.id)))

    const toInsert = uniqueItems.filter((item) => !existingIds.has(item.id))

    if (toInsert.length === 0) {
      return NextResponse.json({ inserted: [], skippedExisting: Array.from(existingIds), duplicateInPayload })
    }

    const payload = toInsert.map((item) => ({
      id: item.id,
      client_name: item.clientName,
      phone: item.phone,
      price: item.price,
      status: 'in_stock',
      company_id: companyId || null,
    }))

    // Use upsert with ignoreDuplicates to skip any that slip through the check
    const { data, error } = await supabase
      .from('products')
      .upsert(payload, { onConflict: 'id', ignoreDuplicates: true })
      .select()

    if (error) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: (error as any)?.details, hint: (error as any)?.hint },
        { status: 400 }
      )
    }

    return NextResponse.json({ inserted: data || [], skippedExisting: Array.from(existingIds), duplicateInPayload })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
  }
}
