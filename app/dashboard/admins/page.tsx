"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { isSuperRole } from "@/lib/utils"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { UserPlus, Shield, ShieldCheck, MoreHorizontal, Eye, Trash2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useTranslations } from "@/lib/i18n"

export default function AdminsPage() {
  const [admins, setAdmins] = useState<any[]>([])
  const [currentUser, setCurrentUserState] = useState<any>(null)
  const { t } = useTranslations()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null)
  const [newAdmin, setNewAdmin] = useState({ username: "", password: "" })

  const handleDeleteAdmin = async (id: string) => {
    const res = await fetch("/api/admins/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setAdmins((prev) => prev.filter((a) => a.id !== id))
      if (selectedAdmin?.id === id) setSelectedAdmin(null)
    }
  }

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setCurrentUserState(user)

      const res = await fetch("/api/admins/list")
      if (res.ok) {
        const body = await res.json()
        setAdmins(body.admins || [])
      }
    }
    load()
  }, [])

  // We only have auth user on the client; allow if current user exists and their role is super
  const currentRole = admins.find((a) => a.id === currentUser?.id)?.role || currentUser?.user_metadata?.role

  if (!isSuperRole(currentRole)) {
    return <DashboardLayout>Access Denied</DashboardLayout>
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const email = `${newAdmin.username}@rehab.local`
    const { data, error } = await supabase.auth.signUp({ email, password: newAdmin.password })
    if (error || !data.user) return
    await supabase.from("profiles").insert({ id: data.user.id, role: "admin" })
    if (data.user) {
      setAdmins((prev) => [{ id: data.user.id, role: "admin", email, name: newAdmin.username }, ...prev])
    }
    setIsAddOpen(false)
    setNewAdmin({ username: "", password: "" })
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("adminManagement")}</h1>
            <p className="text-muted-foreground">{t("createAndManageAccessLevels")}</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" /> {t("addAdmin")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("inviteNewAdmin")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4 pt-4">
                <div className="grid gap-2">
                  <Label htmlFor="aname">Username</Label>
                  <Input
                    id="aname"
                    required
                    value={newAdmin.username}
                    onChange={(e) => setNewAdmin({ ...newAdmin, username: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="apassword">Password</Label>
                  <Input
                    id="apassword"
                    type="password"
                    required
                    value={newAdmin.password}
                    onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full mt-4">
                  {t("createAdminAccount")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("user")}</TableHead>
                <TableHead>{t("role")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow
                  key={admin.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedAdmin(admin)}
                >
                  <TableCell>
                    <div className="font-medium">{admin.name || admin.email || admin.id}</div>
                    <div className="text-xs text-muted-foreground">{admin.email || admin.id}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={isSuperRole(admin.role) ? "default" : "secondary"} className="gap-1">
                      {isSuperRole(admin.role) ? (
                        <ShieldCheck className="h-3 w-3" />
                      ) : (
                        <Shield className="h-3 w-3" />
                      )}
                      {admin.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedAdmin(admin)}>
                          <Eye className="mr-2 h-4 w-4" /> {t("viewDetails")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          disabled={admin.id === currentUser?.id}
                          onClick={() => handleDeleteAdmin(admin.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Remove Admin
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* User Details Modal */}
        <Dialog open={!!selectedAdmin} onOpenChange={() => setSelectedAdmin(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("userDetails")}</DialogTitle>
            </DialogHeader>
            {selectedAdmin && (
              <div className="space-y-6 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <p className="font-medium break-all">{selectedAdmin.name || selectedAdmin.email || selectedAdmin.id}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <p className="font-medium break-all">{selectedAdmin.email || "(not provided)"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">{t("role")}</Label>
                    <div className="pt-1">
                      <Badge variant={isSuperRole(selectedAdmin.role) ? "default" : "secondary"}>
                        {selectedAdmin.role}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
