"use client"

import type React from "react"
import { useRouter } from "next/navigation" // Import router here

import { useState } from "react"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { translations } from "@/lib/i18n"
import { LanguageSwitcher } from "@/components/language-switcher"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("") // Static for prototype
  const { admins, setCurrentUser, locale } = useStore()
  const t = translations[locale || "en"]
  const dir = t.dir
  const router = useRouter() // Declare router here

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()

    // Simple prototype auth
    const user = admins.find((a) => a.email === email)
    if (user) {
      setCurrentUser(user)
      toast({ title: t.login.welcome, description: `Logged in as ${user.name}` })
      router.push("/dashboard")
    } else {
      toast({
        variant: "destructive",
        title: t.login.failed,
        description: t.login.userNotFound,
      })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4" dir={dir}>
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-1">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded bg-gradient-to-br from-rehab-gradient-start to-rehab-gradient-end" />
          </div>
          <CardTitle className="text-2xl">{t.login.title}</CardTitle>
          <CardDescription>{t.login.description}</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className={dir === "rtl" ? "text-right block" : ""}>
                {t.login.email}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@rehab.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={dir === "rtl" ? "text-right" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className={dir === "rtl" ? "text-right block" : ""}>
                {t.login.password}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                className={dir === "rtl" ? "text-right" : ""}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" type="submit">
              {t.login.submit}
            </Button>
          </CardFooter>
        </form>
      </Card>
      <Toaster />
    </div>
  )
}
