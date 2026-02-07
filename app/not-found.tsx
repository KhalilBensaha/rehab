"use client"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border bg-background/90 shadow-sm p-8 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <Image src="/rehab.png" alt="Rehab" width={56} height={56} priority className="rounded-2xl" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-muted-foreground">
          The page you’re looking for doesn’t exist or was moved.
        </p>
        <div className="mt-6 flex justify-center">
          <Button asChild>
            <Link href="/dashboard">Back to home</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
