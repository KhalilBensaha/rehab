"use client"

import type React from "react"
import { useRouter } from "next/navigation" // Import router here
import { useState } from "react"
import { login, getUserRole } from "@/lib/auth"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { translations } from "@/lib/i18n"
import { LanguageSwitcher } from "@/components/language-switcher"
import Image from "next/image"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const { admins, setCurrentUser, locale } = useStore()
  const t = translations[locale || "en"]
  const dir = t.dir
  const router = useRouter() // Declare router here

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoggingIn) return
    setIsLoggingIn(true)
    try {
      const { data, error } = await login(username, password)
      if (error || !data.user) {
        toast({
          variant: "destructive",
          title: t.login.failed,
          description: t.login.failedDesc || t.login.userNotFound,
        })
        setIsLoggingIn(false)
        return
      }
      // Fetch user role
      const role = await getUserRole(data.user.id);
      const email = data.user.email || `${username}@rehab.local`;
      setCurrentUser({ id: data.user.id, name: username, email, role });
      toast({
        title: t.login.welcome,
        description: (t.login.welcomeDesc || "Welcome, {name}.").replace("{name}", username),
      })
      router.push("/dashboard")
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: t.login.failed,
        description: t.login.failedDesc || t.login.userNotFound,
      })
    } finally {
      setIsLoggingIn(false)
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
           <Image src="/logo.jpg" alt="Logo" width={100} height={100} />
          </div>
          <CardTitle className="text-2xl">{t.login.title}</CardTitle>
          <CardDescription>{t.login.description}</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className={dir === "rtl" ? "text-right block" : ""}>
                Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={dir === "rtl" ? "text-right" : ""}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" type="submit" disabled={isLoggingIn}>
              {isLoggingIn ? t.common.loading : t.login.submit}
            </Button>
          </CardFooter>
        </form>
      </Card>
      <Toaster />
    </div>
  )
}
