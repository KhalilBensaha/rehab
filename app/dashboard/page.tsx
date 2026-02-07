"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { useTranslations } from "@/lib/i18n"
import { useStore } from "@/lib/store"
import { isSuperRole } from "@/lib/utils"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Package, Truck, Building2, Users } from "lucide-react"

export default function OverviewPage() {
  const router = useRouter()
  const { t } = useTranslations()
  const { currentUser } = useStore()
  const [products, setProducts] = useState<any[]>([])
  const [workers, setWorkers] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [admins, setAdmins] = useState<any[]>([])
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  useEffect(() => {
    const load = async () => {
      const [{ data: p }, { data: w }, { data: c }] = await Promise.all([
        supabase.from("products").select("*").limit(1000),
        supabase.from("delivery_workers").select("*").limit(1000),
        supabase.from("companies").select("*").limit(1000),
      ])
      if (p) setProducts(p)
      if (w) setWorkers(w)
      if (c) setCompanies(c)

      if (isSuperRole(currentUser?.role)) {
        const res = await fetch("/api/admins/list")
        if (res.ok) {
          const body = await res.json()
          setAdmins(body.admins || [])
        }
      }
    }
    load()
  }, [currentUser?.role])

  const isSuperAdmin = isSuperRole(currentUser?.role)

  const inDateRange = (value?: string | null) => {
    if (!dateFrom && !dateTo) return true
    if (!value) return false
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return false
    const fromOk = !dateFrom || date >= new Date(dateFrom)
    const toOk = !dateTo || date <= new Date(`${dateTo}T23:59:59`)
    return fromOk && toOk
  }

  const rangeProducts = products.filter((p) => inDateRange(p.created_at))
  const deliveredInRange = rangeProducts.filter((p) => p.status === "delivered")
  const inDeliveryInRange = rangeProducts.filter((p) => p.status === "delivery")
  const revenueInRange = deliveredInRange.reduce((acc, p) => acc + Number(p.price || 0), 0)

  const kpis = [
    {
      name: t("dashboard.kpiProducts"),
      value: rangeProducts.length,
      icon: Package,
      color: "text-blue-500",
    },
    {
      name: t("dashboard.kpiDelivered"),
      value: deliveredInRange.length,
      icon: Truck,
      color: "text-green-600",
    },
    {
      name: t("dashboard.kpiInDelivery"),
      value: inDeliveryInRange.length,
      icon: Truck,
      color: "text-amber-600",
    },
    {
      name: t("dashboard.kpiRevenue"),
      value: `${revenueInRange.toFixed(2)} ${t("common.currency")}`,
      icon: Building2,
      color: "text-rehab-dark",
    },
  ]

  const stats = [
    { name: t("dashboard.stats.products"), value: products.length, icon: Package, color: "text-blue-500", href: "/dashboard/stock" },
    { name: t("dashboard.stats.workers"), value: workers.length, icon: Truck, color: "text-rehab-dark", href: "/dashboard/workers" },
    { name: t("dashboard.stats.companies"), value: companies.length, icon: Building2, color: "text-orange-500", href: "/dashboard/companies" },
    ...(isSuperAdmin
      ? [{ name: t("dashboard.stats.admins"), value: admins.length, icon: Users, color: "text-purple-500", href: "/dashboard/admins" }]
      : []),
  ]

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.kpiTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="grid gap-2">
                <Label>{t("dashboard.dateFrom")}</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>{t("dashboard.dateTo")}</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {kpis.map((kpi) => (
                <Card key={kpi.name}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">{kpi.name}</CardTitle>
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{kpi.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className={`grid grid-cols-1 md:grid-cols-2 ${isSuperAdmin ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-6`}>
          {stats.map((stat) => (
            <Card key={stat.name} className="cursor-pointer hover:shadow-md transition" onClick={() => router.push(stat.href)}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">{stat.name}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.recent")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {products
                  .slice(-5)
                  .reverse()
                  .map((p) => (
                    <div key={p.id} className="flex items-center gap-4 border-b pb-4 last:border-0 last:pb-0">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{t("dashboard.recentItem")}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.companyName} • {Number(p.price || 0).toFixed(2)} {t("common.currency")}
                        </p>
                      </div>
                      <div className="text-xs font-mono text-muted-foreground">{p.id}</div>
                    </div>
                  ))}
                {products.length === 0 && (
                  <p className="text-sm text-center py-10 text-muted-foreground">{t("dashboard.recentEmpty")}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-linear-to-br from-rehab-gradient-start to-rehab-gradient-end text-white border-none">
            <CardHeader>
              <CardTitle className="text-white">{t("dashboard.performanceTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center h-48">
              <div className="text-center">
                <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-xl font-medium">{t("dashboard.performanceSubtitle")}</p>
                <p className="text-sm opacity-80 mt-2">{t("dashboard.performanceDesc")}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
