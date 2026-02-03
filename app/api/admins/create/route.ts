'use server'

import { NextResponse } from 'next/server'
import { createSupabaseService } from '@/lib/supabaseService'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const username = String(body?.username || '').trim()
    const password = String(body?.password || '').trim()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
    }

    const supabase = createSupabaseService()
    const email = `${username}@rehab.local`

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, name: username, role: 'admin' },
    })

    let user = data?.user

    if (error || !user) {
      const message = error?.message || 'Failed to create admin'
      const isAlreadyRegistered = /already (registered|exists)/i.test(message)
      if (isAlreadyRegistered) {
        const { data: usersData, error: listError } = await supabase.auth.admin.listUsers()
        if (listError) {
          return NextResponse.json({ error: listError.message }, { status: 400 })
        }
        user = usersData?.users?.find((u) => u.email === email)
        if (!user) {
          return NextResponse.json({ error: message }, { status: 400 })
        }
      } else {
        return NextResponse.json({ error: message }, { status: 400 })
      }
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: user.id, role: 'admin' })

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({
      admin: {
        id: user.id,
        email,
        name: username,
        role: 'admin',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
  }
}
