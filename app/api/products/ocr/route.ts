'use server'

import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')

import { NextResponse } from 'next/server'
import { createSupabaseService } from '@/lib/supabaseService'

const OCR_MODEL = process.env.CLAUDE_OCR_MODEL || 'claude-3-5-sonnet-latest'
const OCR_FALLBACK_MODEL = process.env.CLAUDE_OCR_FALLBACK_MODEL || 'claude-3-haiku-20240307'

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

function cleanJsonText(text: string) {
  const noFences = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  const start = noFences.indexOf('{')
  const end = noFences.lastIndexOf('}')
  if (start >= 0 && end >= 0 && end > start) {
    return noFences.slice(start, end + 1)
  }
  return noFences
}

function normalizeItem(item: any) {
  const trackingId =
    (typeof item?.trackingId === 'string' && item.trackingId) ||
    (typeof item?.tracking === 'string' && item.tracking) ||
    (typeof item?.numero_de_tracking === 'string' && item.numero_de_tracking) ||
    (typeof item?.numeroTracking === 'string' && item.numeroTracking) ||
    (typeof item?.id === 'string' && item.id) ||
    ''

  const clientName =
    (typeof item?.clientName === 'string' && item.clientName) ||
    (typeof item?.client === 'string' && item.client) ||
    (typeof item?.name === 'string' && item.name) ||
    ''

  const phone =
    (typeof item?.phone === 'string' && item.phone) ||
    (typeof item?.telephone === 'string' && item.telephone) ||
    ''

  const price = parsePrice(item?.price)

  return {
    trackingId: String(trackingId).trim(),
    clientName: String(clientName).trim(),
    phone: String(phone).trim(),
    price,
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 })
    }

    const fileType = file.type || ''
    const isPdf = fileType === 'application/pdf'
    const isImage = fileType.startsWith('image/')

    if (!isPdf && !isImage) {
      return NextResponse.json({ error: 'unsupported file type' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')

    const prompt = `Extract all product rows from this document. Return ONLY valid JSON with this format: {"items": [{"trackingId": "", "clientName": "", "phone": "", "price": 0}]}.\n\nRules:\n- trackingId is the tracking number / numero de tracking.\n- clientName is the client name.\n- phone is the telephone.\n- price is numeric in DZD (no currency symbol).\n- If a field is missing, return an empty string or 0.`

    const content: any[] = [
      { type: 'text', text: prompt },
      isPdf
        ? {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          }
        : {
            type: 'image',
            source: { type: 'base64', media_type: fileType, data: base64 },
          },
    ]

    const requestBody = {
      model: OCR_MODEL,
      max_tokens: 1200,
      temperature: 0,
      messages: [{ role: 'user', content }],
    }

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    })

    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      const isModelNotFound = errText.includes('not_found_error') || errText.toLowerCase().includes('model')
      if (isModelNotFound && OCR_FALLBACK_MODEL) {
        const retryRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY || '',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({ ...requestBody, model: OCR_FALLBACK_MODEL }),
        })

        if (!retryRes.ok) {
          const retryText = await retryRes.text()
          return NextResponse.json(
            { error: retryText || 'Claude request failed', model: OCR_FALLBACK_MODEL, fallbackUsed: true },
            { status: 502 },
          )
        }

        const retryBody = await retryRes.json()
        const retryText = Array.isArray(retryBody?.content)
          ? retryBody.content.map((c: any) => c?.text || '').join('\n')
          : ''

        const cleanedRetry = cleanJsonText(retryText)
        let parsedRetry: any
        try {
          parsedRetry = JSON.parse(cleanedRetry)
        } catch (err) {
          return NextResponse.json({ error: 'Failed to parse OCR result', raw: retryText }, { status: 500 })
        }

        const itemsRawRetry = Array.isArray(parsedRetry?.items) ? parsedRetry.items : []
        const normalizedRetry = itemsRawRetry.map(normalizeItem).filter((item) => item.trackingId)

        const uniqueMapRetry = new Map<string, typeof normalizedRetry[number]>()
        const duplicateInUploadRetry = new Set<string>()
        normalizedRetry.forEach((item) => {
          const id = item.trackingId
          if (uniqueMapRetry.has(id)) {
            duplicateInUploadRetry.add(id)
          } else {
            uniqueMapRetry.set(id, item)
          }
        })

        const uniqueItemsRetry = Array.from(uniqueMapRetry.values())
        const idsRetry = uniqueItemsRetry.map((i) => i.trackingId)

        const supabaseRetry = createSupabaseService()
        const { data: existingRetry } = await supabaseRetry.from('products').select('id').in('id', idsRetry)
        const existingIdsRetry = new Set((existingRetry || []).map((row: any) => String(row.id)))

        const withFlagsRetry = uniqueItemsRetry.map((item) => ({
          ...item,
          exists: existingIdsRetry.has(item.trackingId),
          duplicateInUpload: duplicateInUploadRetry.has(item.trackingId),
        }))

        return NextResponse.json({ items: withFlagsRetry, modelUsed: OCR_FALLBACK_MODEL })
      }

      return NextResponse.json(
        { error: errText || 'Claude request failed', model: OCR_MODEL },
        { status: 502 },
      )
    }

    const claudeBody = await claudeRes.json()
    const text = Array.isArray(claudeBody?.content)
      ? claudeBody.content.map((c: any) => c?.text || '').join('\n')
      : ''

    const cleaned = cleanJsonText(text)
    let parsed: any
    try {
      parsed = JSON.parse(cleaned)
    } catch (err) {
      return NextResponse.json({ error: 'Failed to parse OCR result', raw: text }, { status: 500 })
    }

    const itemsRaw = Array.isArray(parsed?.items) ? parsed.items : []
    const normalized = itemsRaw.map(normalizeItem).filter((item) => item.trackingId)

    const uniqueMap = new Map<string, typeof normalized[number]>()
    const duplicateInUpload = new Set<string>()
    normalized.forEach((item) => {
      const id = item.trackingId
      if (uniqueMap.has(id)) {
        duplicateInUpload.add(id)
      } else {
        uniqueMap.set(id, item)
      }
    })

    const uniqueItems = Array.from(uniqueMap.values())
    const ids = uniqueItems.map((i) => i.trackingId)

    const supabase = createSupabaseService()
    const { data: existing } = await supabase.from('products').select('id').in('id', ids)
    const existingIds = new Set((existing || []).map((row: any) => String(row.id)))

    const withFlags = uniqueItems.map((item) => ({
      ...item,
      exists: existingIds.has(item.trackingId),
      duplicateInUpload: duplicateInUpload.has(item.trackingId),
    }))

    return NextResponse.json({ items: withFlags })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
  }
}
