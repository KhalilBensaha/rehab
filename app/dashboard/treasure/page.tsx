"use client"

import { useMemo, useState } from "react"
import { useStore } from "@/lib/store"
import { isSuperRole } from "@/lib/utils"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Filter } from "lucide-react"

export default function TreasurePage() {
  const { products, companies, workers, currentUser } = useStore()

  if (!isSuperRole(currentUser?.role)) {
    return (
      <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">Super admin only.</CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  const delivered = products.filter((p) => p.status === "delivered")

  const [filterCompany, setFilterCompany] = useState<string>("all")

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Treasure</h1>
        <p className="text-muted-foreground">Delivered products, revenue, and benefit summary.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Delivered</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{filteredDelivered.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Revenue</CardTitle>
            <p className="text-xs text-muted-foreground">Sum of company benefits</p>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{totalRevenue.toFixed(2)} DZD</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Worker Fees</CardTitle>
            <p className="text-xs text-muted-foreground">Total commissions paid</p>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-orange-500">-{totalWorkerFees.toFixed(2)} DZD</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Final Benefit</CardTitle>
            <p className="text-xs text-muted-foreground">Revenue - Worker fees</p>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-green-600">{totalBenefit.toFixed(2)} DZD</CardContent>
        </Card>
      </div>

      <Separator />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Delivered Products</CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
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
                <TableHead>ID</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Worker</TableHead>
                <TableHead className="text-right">Company Benefit</TableHead>
                <TableHead className="text-right">Worker Fee</TableHead>
                <TableHead className="text-right">Net Benefit</TableHead>
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
                    <TableCell>{worker?.name || "Unassigned"}</TableCell>
                    <TableCell className="text-right">{companyBenefit} DZD</TableCell>
                    <TableCell className="text-right text-orange-500">-{workerFee} DZD</TableCell>
                    <TableCell className="text-right text-green-600">{benefit} DZD</TableCell>
                  </TableRow>
                )
              })}
              {filteredDelivered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                    No delivered products{filterCompany !== "all" ? " for this company" : ""} yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
    </DashboardLayout>
  )
}
