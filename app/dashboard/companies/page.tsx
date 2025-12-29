"use client"

import type React from "react"

import { useState } from "react"
import { useStore } from "@/lib/store"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Building2, Trash2, Plus, TrendingUp } from "lucide-react"
import { toast } from "@/hooks/use-toast"

export default function CompaniesPage() {
  const { companies, addCompany, removeCompany, currentUser } = useStore()
  const [isAddOpen, setIsAddOpen] = useState(false)

  const [newCompany, setNewCompany] = useState({
    name: "",
    benefit: 0,
  })

  if (currentUser?.role !== "superadmin") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-muted-foreground">Access denied. Super Admin only.</p>
        </div>
      </DashboardLayout>
    )
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    addCompany({
      id: `COMP-${Math.floor(Math.random() * 1000)}`,
      ...newCompany,
    })
    setIsAddOpen(false)
    setNewCompany({ name: "", benefit: 0 })
    toast({ title: "Company added", description: `${newCompany.name} is now in the system.` })
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Partner Companies</h1>
            <p className="text-muted-foreground">Manage companies and their benefit (bnifit) percentages.</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Add Company
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Company</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4 pt-4">
                <div className="grid gap-2">
                  <Label htmlFor="cname">Company Name</Label>
                  <Input
                    id="cname"
                    required
                    value={newCompany.name}
                    onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="benefit">Bnifit Percentage (%)</Label>
                  <Input
                    id="benefit"
                    type="number"
                    step="0.1"
                    required
                    value={newCompany.benefit}
                    onChange={(e) => setNewCompany({ ...newCompany, benefit: Number.parseFloat(e.target.value) })}
                  />
                </div>
                <Button type="submit" className="w-full mt-4">
                  Create Company
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
                  onClick={() => removeCompany(company.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{company.benefit}%</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  Benefit Margin
                </p>
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Company ID:</span>
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
