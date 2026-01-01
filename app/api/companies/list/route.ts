"use server"

import dns from "node:dns"
dns.setDefaultResultOrder("ipv4first")

import { NextResponse } from "next/server"
import { createSupabaseService } from "@/lib/supabaseService"

export async function GET() {
  try {
    const supabase = createSupabaseService()
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, combenef, created_at")
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: (error as any)?.details },
        { status: 400 }
      )
    }

    return NextResponse.json({ companies: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 })
  }
}
