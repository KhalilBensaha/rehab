'use server'

import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')

import { NextResponse } from 'next/server'
import { createSupabaseService } from '@/lib/supabaseService'

const OCR_MODEL = process.env.CLAUDE_OCR_MODEL || 'claude-3-5-sonnet-latest'
const OCR_FALLBACK_MODEL = process.env.CLAUDE_OCR_FALLBACK_MODEL || 'claude-3-haiku-20240307'

const OCR_TOOL = {
  name: 'extract_products',
  description: 'Extract product rows from a shipping list',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            trackingId: { type: 'string' },
            clientName: { type: 'string' },
            phone: { type: 'string' },
            price: { type: 'number' },
          },
          required: ['trackingId', 'clientName', 'phone', 'price'],
        },
      },
    },
    required: ['items'],
  },
}

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

function tryParseJson(text: string): any | null {
  try {
    return JSON.parse(text)
  } catch {
    const arrStart = text.indexOf('[')
    const arrEnd = text.lastIndexOf(']')
    if (arrStart >= 0 && arrEnd > arrStart) {
      const arrayText = text.slice(arrStart, arrEnd + 1)
      try {
        return JSON.parse(arrayText)
      } catch {
        return null
      }
    }
    return null
  }
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

function buildPrompt(companyId: string) {
  const basePrompt = `Extract all product rows from this document. Return ONLY valid JSON with this format: {"items": [{"trackingId": "", "clientName": "", "phone": "", "price": 0}]}.

Rules:
- trackingId is the tracking number / numero de tracking.
- clientName is the client name.
- phone is the telephone.
- price is numeric in DZD (no currency symbol).
- If a field is missing, return an empty string or 0.`

  const zrExpressPrompt = `You are extracting a ZR Express delivery list. The table columns are: Numero de tracking, Client, Telephone, Prix. Each ROW is a single product.

Return ONLY valid JSON with this format: {"items": [{"trackingId": "", "clientName": "", "phone": "", "price": 0}]}.

Rules:
- trackingId must be copied exactly from "Numero de tracking" (keep hyphens and ZR suffix).
- clientName must be copied exactly from "Client" (keep Arabic letters as-is, do NOT merge names from adjacent rows).
- phone must be copied from "Telephone" (keep digits and spaces if any).
- price must be numeric DZD from "Prix" (ignore 'DA' and thousand separators).
- Do NOT use values from "Address" or "Produits" columns.
- Each row becomes exactly one item in order.
- If a cell is empty, return "" or 0 for that field.`

  return companyId === '6' ? zrExpressPrompt : basePrompt
}

function extractItemsFromText(text: string) {
  const cleaned = cleanJsonText(text)
  const parsed = tryParseJson(cleaned)
  if (!parsed) {
    return { error: 'Failed to parse OCR result', items: [] as ReturnType<typeof normalizeItem>[] }
  }

  const itemsRaw = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : []
  const normalized = itemsRaw.map(normalizeItem).filter((item) => item.trackingId)

  const uniqueMap = new Map<string, (typeof normalized)[number]>()
  const duplicateInUpload = new Set<string>()
  normalized.forEach((item) => {
    const id = item.trackingId
    if (uniqueMap.has(id)) {
      duplicateInUpload.add(id)
    } else {
      uniqueMap.set(id, item)
    }
  })

  return { items: Array.from(uniqueMap.values()), duplicateInUpload }
}

function extractItemsFromParsed(parsed: any) {
  const itemsRaw = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : []
  const normalized = itemsRaw.map(normalizeItem).filter((item) => item.trackingId)

  const uniqueMap = new Map<string, (typeof normalized)[number]>()
  const duplicateInUpload = new Set<string>()
  normalized.forEach((item) => {
    const id = item.trackingId
    if (uniqueMap.has(id)) {
      duplicateInUpload.add(id)
    } else {
      uniqueMap.set(id, item)
    }
  })

  return { items: Array.from(uniqueMap.values()), duplicateInUpload }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const companyId = String(formData.get('companyId') || '').trim()

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

    const prompt = buildPrompt(companyId)
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
      tools: [OCR_TOOL],
      tool_choice: { type: 'tool', name: 'extract_products' },
      messages: [{ role: 'user', content }],
    }

    const callClaude = async (model: string) => {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ ...requestBody, model }),
      })

      if (!res.ok) {
        return { ok: false, error: await res.text() }
      }

      const body = await res.json()
      const contentArr = Array.isArray(body?.content) ? body.content : []
      const toolUse = contentArr.find((c: any) => c?.type === 'tool_use' && c?.name === 'extract_products')
      const text = contentArr.map((c: any) => c?.text || '').join('\n')
      return { ok: true, text, toolInput: toolUse?.input }
    }

    let response = await callClaude(OCR_MODEL)
    if (!response.ok) {
      const isModelNotFound = response.error?.includes('not_found_error') || response.error?.toLowerCase().includes('model')
      if (isModelNotFound && OCR_FALLBACK_MODEL) {
        response = await callClaude(OCR_FALLBACK_MODEL)
        if (!response.ok) {
          return NextResponse.json(
            { error: response.error || 'Claude request failed', model: OCR_FALLBACK_MODEL, fallbackUsed: true },
            { status: 502 },
          )
        }
      } else {
        return NextResponse.json({ error: response.error || 'Claude request failed', model: OCR_MODEL }, { status: 502 })
      }
    }

    const extracted = response.toolInput ? extractItemsFromParsed(response.toolInput) : extractItemsFromText(response.text || '')
    if (extracted.error) {
      return NextResponse.json({ error: extracted.error, raw: response.text }, { status: 500 })
    }

    const ids = extracted.items.map((i) => i.trackingId)
    const supabase = createSupabaseService()
    const { data: existing } = await supabase.from('products').select('id').in('id', ids)
    const existingIds = new Set((existing || []).map((row: any) => String(row.id)))

    const withFlags = extracted.items.map((item) => ({
      ...item,
      exists: existingIds.has(item.trackingId),
      duplicateInUpload: extracted.duplicateInUpload.has(item.trackingId),
    }))

    return NextResponse.json({ items: withFlags })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
  }
}
