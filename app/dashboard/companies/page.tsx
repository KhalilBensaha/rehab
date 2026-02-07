"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { isSuperRole } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Building2, Trash2, Plus, TrendingUp } from "lucide-react"
import { toast } from "@/hooks/use-toast"

export default function CompaniesPage() {
  const { t } = useTranslations()
  const [companies, setCompanies] = useState<any[]>([])
  const [currentRole, setCurrentRole] = useState<string | undefined>(undefined)
  const [isAddOpen, setIsAddOpen] = useState(false)

  const [newCompany, setNewCompany] = useState({
    name: "",
    benefit: 0,
  })

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: companiesData } = await supabase.from("companies").select("id, name, combenef, created_at")
      if (companiesData) setCompanies(companiesData)

      const { data: userData } = await supabase.auth.getUser()
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user?.id || "")
        .single()
      setCurrentRole(profileData?.role || undefined)
    }
    load()
  }, [])

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
          {companies.map((company) => (
            <Card key={company.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">
                  <Building2 className="h-4 w-4 inline mr-2 text-primary" />
                  {company.name}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => handleRemove(company.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Number(company.combenef || 0).toFixed(2)} {t("common.currency")}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  {t("companies.benefitHelp")}
                </p>
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{t("companies.companyId")}</span>
                    <span className="font-mono">{company.id}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
