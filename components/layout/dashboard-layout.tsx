"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useStore } from "@/lib/store"
import { LayoutDashboard, Package, Truck, Building2, LogOut, ChevronRight, ClipboardList, UserPlus, PiggyBank, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn, isSuperRole } from "@/lib/utils"
import { translations } from "@/lib/i18n"
import { LanguageSwitcher } from "@/components/language-switcher"
import Image from "next/image"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, setCurrentUser, locale } = useStore()
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    setMounted(true)
    if (!currentUser && pathname !== "/login") {
      router.push("/login")
    }
  }, [currentUser, pathname, router])

  if (!mounted || !currentUser) return null

  const isSuper = isSuperRole(currentUser.role)
  const t = translations[locale || "en"]
  const dir = t.dir

  const navigation = [
    { name: t.nav.overview, href: "/dashboard", icon: LayoutDashboard },
    { name: t.nav.stock, href: "/dashboard/stock", icon: Package },
    { name: t.nav.workers, href: "/dashboard/workers", icon: Truck },
    { name: t.nav.sheets, href: "/dashboard/sheets", icon: ClipboardList },
    ...(isSuper
      ? [
          { name: t.nav.companies, href: "/dashboard/companies", icon: Building2 },
          { name: t.nav.admins, href: "/dashboard/admins", icon: UserPlus },
          { name: t.nav.treasure, href: "/dashboard/treasure", icon: PiggyBank },
        ]
      : []),
  ]

  return (
    <div className={cn("flex min-h-screen bg-background text-foreground")}> 
      {/* Sidebar */}
      <aside
        dir={dir}
        className={cn(
          "bg-card flex flex-col transition-all duration-300 overflow-hidden",
          sidebarOpen ? "w-64" : "w-0",
          dir === "rtl" ? "border-l border-r-0" : "border-r",
          dir === "rtl" && "items-end text-right",
        )}
        aria-hidden={!sidebarOpen}
      >
        <div className={cn("p-6 w-full", dir === "rtl" && "text-right")}>
          <div
            className={cn(
              "flex items-center gap-2 font-bold text-2xl tracking-tighter text-rehab-dark dark:text-rehab-light",
              dir === "rtl" && "flex-row-reverse",
            )}
          >
            <Image src="/logo.jpg" alt="Logo" width={48} height={48} />
            REHAB
          </div>
          <p className={cn("text-xs text-muted-foreground mt-1 px-1", dir === "rtl" && "text-right")}>
            {locale === "ar" ? "إدارة التوصيل" : locale === "fr" ? "Gestion de Livraison" : "Delivery Management"}
          </p>
        </div>

        <nav className="flex-1 px-4 space-y-1 w-full">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Button
                key={item.name}
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3",
                  dir === "rtl" && "flex-row-reverse text-right",
                  isActive && "bg-primary/10 text-primary hover:bg-primary/20",
                )}
                onClick={() => router.push(item.href)}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.name}</span>
              </Button>
            )
          })}
        </nav>

        <div className="p-4 border-t mt-auto w-full">
          <div className={cn("flex items-center gap-3 px-2 py-3", dir === "rtl" && "flex-row-reverse text-right")}>
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-semibold uppercase">
              {currentUser?.name ? currentUser.name.charAt(0) : "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentUser.name}</p>
              <p className="text-xs text-muted-foreground truncate">{currentUser.role}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive",
              dir === "rtl" && "flex-row-reverse text-right",
            )}
            onClick={() => {
              setCurrentUser(null)
              router.push("/login")
            }}
          >
            <LogOut className={cn("h-4 w-4", dir === "rtl" ? "ml-3" : "mr-3")} />
            {t.nav.logout}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 border-b flex items-center justify-between px-8 sticky top-0 bg-background/80 backdrop-blur z-10">
          <div
            className={cn("flex items-center gap-2 text-sm text-muted-foreground", dir === "rtl" && "flex-row-reverse")}
          >
            <Button
              variant="ghost"
              size="icon"
              className="mr-2"
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-label="Toggle sidebar"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <span>{t.nav.dashboard}</span>
            <ChevronRight className={cn("h-3 w-3", dir === "rtl" && "rotate-180")} />
            <span className="text-foreground font-medium capitalize">
              {t.nav[pathname.split("/").pop() as keyof typeof t.nav] || t.nav.overview}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
          </div>
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
