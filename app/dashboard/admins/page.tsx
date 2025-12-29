"use client"

import type React from "react"

import { useState } from "react"
import { useStore } from "@/lib/store"
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
  const { admins, addAdmin, removeAdmin, updateAdminRole, currentUser } = useStore()
  const { t } = useTranslations()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null)
  const [newAdmin, setNewAdmin] = useState({ name: "", email: "" })

  if (currentUser?.role !== "superadmin") {
    return <DashboardLayout>Access Denied</DashboardLayout>
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    addAdmin({
      id: Math.random().toString(36).substr(2, 9),
      ...newAdmin,
      role: "admin",
    })
    setIsAddOpen(false)
    setNewAdmin({ name: "", email: "" })
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
                  <Label htmlFor="aname">{t("name")}</Label>
                  <Input
                    id="aname"
                    required
                    value={newAdmin.name}
                    onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="aemail">{t("emailAddress")}</Label>
                  <Input
                    id="aemail"
                    type="email"
                    required
                    value={newAdmin.email}
                    onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
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
                    <div className="font-medium">{admin.name}</div>
                    <div className="text-xs text-muted-foreground">{admin.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={admin.role === "superadmin" ? "default" : "secondary"} className="gap-1">
                      {admin.role === "superadmin" ? (
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
                          onClick={() =>
                            updateAdminRole(admin.id, admin.role === "superadmin" ? "admin" : "superadmin")
                          }
                        >
                          <Shield className="mr-2 h-4 w-4" /> {t("toggleSuperStatus")}
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
                    <Label className="text-xs text-muted-foreground">{t("fullName")}</Label>
                    <p className="font-medium">{selectedAdmin.name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">{t("emailAddress")}</Label>
                    <p className="font-medium">{selectedAdmin.email}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">{t("role")}</Label>
                    <div className="pt-1">
                      <Badge variant={selectedAdmin.role === "superadmin" ? "default" : "secondary"}>
                        {selectedAdmin.role}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">{t("userID")}</Label>
                    <p className="font-mono text-xs">{selectedAdmin.id}</p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h3 className="text-sm font-semibold mb-3 text-destructive">{t("dangerZone")}</h3>
                  <Button
                    variant="destructive"
                    className="w-full gap-2"
                    disabled={selectedAdmin.id === currentUser?.id}
                    onClick={() => {
                      removeAdmin(selectedAdmin.id)
                      setSelectedAdmin(null)
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> {t("removeUserAccess")}
                  </Button>
                  {selectedAdmin.id === currentUser?.id && (
                    <p className="text-[10px] text-muted-foreground mt-2 text-center italic">
                      {t("cannotRemoveOwnAccess")}
                    </p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
