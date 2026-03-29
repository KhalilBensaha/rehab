import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isSuperRole(role?: string) {
  if (!role) return false
  const normalized = role.toLowerCase().replace(/[_\s-]+/g, "")
  return normalized === "superadmin"
}

// --- Product Timeline ---
export type TimelineEvent = {
  from: string
  to: string
  at: string // ISO timestamp
  by?: string // "stock" | "worker" | "sheets"
}

const TIMELINE_KEY = "product-timeline-v1"

export function getTimeline(productId: string): TimelineEvent[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(TIMELINE_KEY)
    if (!raw) return []
    const all = JSON.parse(raw)
    return Array.isArray(all[String(productId)]) ? all[String(productId)] : []
  } catch {
    return []
  }
}

export function addTimelineEvent(productId: string, from: string, to: string, by?: string) {
  if (typeof window === "undefined") return
  try {
    const raw = localStorage.getItem(TIMELINE_KEY)
    const all = raw ? JSON.parse(raw) : {}
    const key = String(productId)
    if (!Array.isArray(all[key])) all[key] = []
    all[key].push({ from, to, at: new Date().toISOString(), by })
    localStorage.setItem(TIMELINE_KEY, JSON.stringify(all))
  } catch {
    // ignore storage failures
  }
}
