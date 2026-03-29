"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { isSuperRole } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Building2, Trash2, Plus, TrendingUp, Package, Truck, DollarSign, BarChart3 } from "lucide-react"
import { toast } from "@/hooks/use-toast"

export default function CompaniesPage() {
  const { t } = useTranslations()
  const [companies, setCompanies] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [currentRole, setCurrentRole] = useState<string | undefined>(undefined)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [expandedAnalytics, setExpandedAnalytics] = useState<Record<string, boolean>>({})

  const [newCompany, setNewCompany] = useState({
    name: "",
    benefit: 0,
  })

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [{ data: companiesData }, { data: productsData }, { data: userData }] = await Promise.all([
        supabase.from("companies").select("id, name, combenef, created_at"),
        supabase.from("products").select("id, price, status, company_id"),
        supabase.auth.getUser(),
      ])
      if (companiesData) setCompanies(companiesData)
      if (productsData) setProducts(productsData)

      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user?.id || "")
        .single()
      setCurrentRole(profileData?.role || undefined)
    }
    load()
  }, [])

  const analyticsByCompany = useMemo(() => {
    const map: Record<string, { total: number; delivered: number; inDelivery: number; canceled: number; revenue: number }> = {}
    products.forEach((p) => {
      const cid = String(p.company_id || "")
      if (!cid) return
      if (!map[cid]) map[cid] = { total: 0, delivered: 0, inDelivery: 0, canceled: 0, revenue: 0 }
      const entry = map[cid]
      entry.total += 1
      const status = p.status === "in stock" ? "in_stock" : p.status
      if (status === "delivered") {
        entry.delivered += 1
        entry.revenue += Number(p.price || 0)
      } else if (status === "delivery") {
        entry.inDelivery += 1
      } else if (status === "canceled") {
        entry.canceled += 1
      }
    })
    return map
  }, [products])

  if (!isSuperRole(currentRole)) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-muted-foreground">Access denied. Super Admin only.</p>
        </div>
      </DashboardLayout>
    )
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/companies/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCompany.name, benefit: newCompany.benefit }),
      })

      if (res.ok) {
        const body = await res.json()
        if (body.company) {
          setCompanies((prev) => [body.company, ...prev])
          setIsAddOpen(false)
          setNewCompany({ name: "", benefit: 0 })
            toast({
              title: t("companies.toastAddedTitle"),
              description: t("companies.toastAddedDesc", { name: body.company.name }),
            })
          setSubmitting(false)
          return
        }
      }

      // Fallback: try anon insert (if RLS permits) and surface errors
      const fallback = await supabase
        .from("companies")
        .insert({ name: newCompany.name, combenef: newCompany.benefit })
        .select()
        .single()

      if (!fallback.error && fallback.data) {
        setCompanies((prev) => [fallback.data, ...prev])
        setIsAddOpen(false)
        setNewCompany({ name: "", benefit: 0 })
          toast({
            title: t("companies.toastAddedTitle"),
            description: t("companies.toastAddedDesc", { name: fallback.data.name }),
          })
      } else {
        const resText = await res.text().catch(() => "")
        let errBody: any = {}
        try {
          errBody = JSON.parse(resText || "{}")
        } catch (e) {
          errBody = { error: resText }
        }
        toast({
          variant: "destructive",
          title: t("companies.toastFailedTitle"),
          description: t("companies.toastFailedDesc"),
        })
        console.error("Create company failed", { status: res.status, body: errBody, fallbackError: fallback.error })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from("companies").delete().eq("id", id)
    if (!error) {
      setCompanies((prev) => prev.filter((c) => c.id !== id))
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("companies.title")}</h1>
            <p className="text-muted-foreground">{t("companies.subtitle")}</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> {t("companies.add")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("companies.dialogTitle")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4 pt-4">
                <div className="grid gap-2">
                  <Label htmlFor="cname">{t("companies.name")}</Label>
                  <Input
                    id="cname"
                    required
                    value={newCompany.name}
                    onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="benefit">{t("companies.benefit")}</Label>
                  <Input
                    id="benefit"
                    type="number"
                    step="0.01"
                    required
                    value={newCompany.benefit}
                    onChange={(e) => setNewCompany({ ...newCompany, benefit: Number.parseFloat(e.target.value) })}
                  />
                </div>
                <Button type="submit" className="w-full mt-4">
                  {t("companies.submit")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => {
            const stats = analyticsByCompany[String(company.id)] || { total: 0, delivered: 0, inDelivery: 0, canceled: 0, revenue: 0 }
            const avgPrice = stats.delivered > 0 ? stats.revenue / stats.delivered : 0
            const deliveredRatio = stats.total > 0 ? ((stats.delivered / stats.total) * 100).toFixed(1) : "0.0"
            const isExpanded = expandedAnalytics[String(company.id)]

            return (
            <Card key={company.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">
                  <Building2 className="h-4 w-4 inline mr-2 text-primary" />
                  {company.name}
                </CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setExpandedAnalytics((prev) => ({ ...prev, [String(company.id)]: !prev[String(company.id)] }))}
                  >
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleRemove(company.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Number(company.combenef || 0).toFixed(2)} {t("common.currency")}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  {t("companies.benefitHelp")}
                </p>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">{t("companies.analyticsTotal")}</p>
                          <p className="font-semibold">{stats.total}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Truck className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">{t("companies.analyticsDelivered")}</p>
                          <p className="font-semibold">{stats.delivered}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Truck className="h-4 w-4 text-amber-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">{t("companies.analyticsInDelivery")}</p>
                          <p className="font-semibold">{stats.inDelivery}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="h-4 w-4 text-red-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">{t("companies.analyticsCanceled")}</p>
                          <p className="font-semibold">{stats.canceled}</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                        <div>
                          <p className="text-xs text-muted-foreground">{t("companies.analyticsRevenue")}</p>
                          <p className="font-semibold">{stats.revenue.toFixed(2)} {t("common.currency")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="h-4 w-4 text-blue-600" />
                        <div>
                          <p className="text-xs text-muted-foreground">{t("companies.analyticsAvgPrice")}</p>
                          <p className="font-semibold">{avgPrice.toFixed(2)} {t("common.currency")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="text-xs text-muted-foreground">{t("companies.analyticsDeliveredRatio")}</p>
                          <p className="font-semibold">{deliveredRatio}%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{t("companies.companyId")}</span>
                    <span className="font-mono">{company.id}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            )
          })}
        </div>
      </div>
    </DashboardLayout>
  )
}
