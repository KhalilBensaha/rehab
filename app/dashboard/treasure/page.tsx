"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useStore } from "@/lib/store"
import { supabase } from "@/lib/supabaseClient"
import { isSuperRole } from "@/lib/utils"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Filter } from "lucide-react"
import { useTranslations } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export default function TreasurePage() {
  const { t } = useTranslations()
  const { products, currentUser, setProducts } = useStore()

  const [filterCompany, setFilterCompany] = useState<string>("all")
  const [isResetOpen, setIsResetOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  
  // Load companies and workers with their benefit/fee data from Supabase
  const [companies, setCompanies] = useState<Array<{ id: string; name: string; benefit: number }>>([])
  const [workers, setWorkers] = useState<Array<{ id: string; name: string; commission: number }>>([])

  useEffect(() => {
    const loadData = async () => {
      const [{ data: companiesData }, { data: workersData }] = await Promise.all([
        supabase.from("companies").select("id, name, combenef"),
        supabase.from("delivery_workers").select("id, name, product_fee"),
      ])

      if (companiesData) {
        setCompanies(
          companiesData.map((c) => ({
            id: String(c.id),
            name: c.name,
            benefit: Number(c.combenef || 0),
          }))
        )
      }

      if (workersData) {
        setWorkers(
          workersData.map((w) => ({
            id: String(w.id),
            name: w.name,
            commission: Number(w.product_fee || 0),
          }))
        )
      }
    }
    loadData()
  }, [])

  const delivered = products.filter((p) => p.status === "delivered")

  const filteredDelivered = useMemo(() => {
    if (filterCompany === "all") return delivered
    return delivered.filter((p) => p.companyName === filterCompany)
  }, [delivered, filterCompany])

  const { totalRevenue, totalWorkerFees, totalBenefit } = useMemo(() => {
    return filteredDelivered.reduce(
      (acc, p) => {
        const company = companies.find((c) => c.name === p.companyName)
        const worker = workers.find((w) => w.id === p.workerId)
        const companyBenefit = company?.benefit ?? 0
        const workerFee = worker?.commission ?? 0
        return {
          totalRevenue: acc.totalRevenue + companyBenefit,
          totalWorkerFees: acc.totalWorkerFees + workerFee,
          totalBenefit: acc.totalBenefit + (companyBenefit - workerFee),
        }
      },
      { totalRevenue: 0, totalWorkerFees: 0, totalBenefit: 0 },
    )
  }, [companies, filteredDelivered, workers])

  const handleReset = () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/treasure/reset", { method: "DELETE" })
        if (res.ok) {
          setProducts([])
          setIsResetOpen(false)
        } else {
          const body = await res.json().catch(() => ({}))
          console.error("Reset treasure failed", body)
        }
      } catch (err) {
        console.error("Reset treasure error", err)
      }
    })
  }

  if (!isSuperRole(currentUser?.role)) {
    return (
      <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle>{t("adminsSection.accessDenied")}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">{t("adminsSection.cannotRemoveOwnAccess")}</CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{t("treasure.title")}</h1>
            <p className="text-muted-foreground">{t("treasure.subtitle")}</p>
          </div>
          <Button variant="destructive" onClick={() => setIsResetOpen(true)}>
            {t("treasure.resetButton")}
          </Button>
        </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("treasure.cards.delivered")}</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{filteredDelivered.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("treasure.cards.revenue")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("treasure.cards.revenueHint")}</p>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{totalRevenue.toFixed(2)} {t("common.currency")}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("treasure.cards.workerFees")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("treasure.cards.workerFeesHint")}</p>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-orange-500">-{totalWorkerFees.toFixed(2)} {t("common.currency")}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("treasure.cards.final")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("treasure.cards.finalHint")}</p>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-green-600">{totalBenefit.toFixed(2)} {t("common.currency")}</CardContent>
        </Card>
      </div>

      <Separator />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{t("treasure.tableTitle")}</CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger className="w-50">
                <SelectValue placeholder={t("treasure.filterAll") || undefined} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("treasure.filterAll")}</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("treasure.table.id")}</TableHead>
                <TableHead>{t("treasure.table.client")}</TableHead>
                <TableHead>{t("treasure.table.company")}</TableHead>
                <TableHead>{t("treasure.table.status")}</TableHead>
                <TableHead>{t("treasure.table.worker")}</TableHead>
                <TableHead className="text-right">{t("treasure.table.companyBenefit")}</TableHead>
                <TableHead className="text-right">{t("treasure.table.workerFee")}</TableHead>
                <TableHead className="text-right">{t("treasure.table.net")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDelivered.map((p) => {
                const company = companies.find((c) => c.name === p.companyName)
                const worker = workers.find((w) => w.id === p.workerId)
                const companyBenefit = company?.benefit ?? 0
                const workerFee = worker?.commission ?? 0
                const benefit = companyBenefit - workerFee
                return (
                  <TableRow key={p.id}>
                    <TableCell>{p.id}</TableCell>
                    <TableCell>{p.clientName}</TableCell>
                    <TableCell>{p.companyName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.status}</Badge>
                    </TableCell>
                    <TableCell>{worker?.name || t("workers.empty")}</TableCell>
                    <TableCell className="text-right">{companyBenefit} {t("common.currency")}</TableCell>
                    <TableCell className="text-right text-orange-500">-{workerFee} {t("common.currency")}</TableCell>
                    <TableCell className="text-right text-green-600">{benefit} {t("common.currency")}</TableCell>
                  </TableRow>
                )
              })}
              {filteredDelivered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                    {filterCompany !== "all" ? t("treasure.emptyFiltered") : t("treasure.empty")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("treasure.resetTitle")}</DialogTitle>
            <DialogDescription>
              {t("treasure.resetDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsResetOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleReset} disabled={isPending}>
              {isPending ? t("common.loading") || "Resetting..." : t("treasure.resetConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  )
}
