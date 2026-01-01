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
