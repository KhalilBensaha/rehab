"use client"

import type React from "react"

import { useEffect } from "react"
import { useStore } from "@/lib/store"
import { translations } from "@/lib/i18n"

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useStore()

  useEffect(() => {
    const t = translations[locale || "en"]
    document.documentElement.lang = locale || "en"
    document.documentElement.dir = t.dir
  }, [locale])

  return <>{children}</>
}
