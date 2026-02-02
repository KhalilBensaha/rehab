"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useStore, type ProductStatus } from "@/lib/store"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Phone, DollarSign, FileCheck, Package } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useTranslations } from "@/lib/i18n"

export default function WorkersPage() {
  const { t } = useTranslations()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [workers, setWorkers] = useState<Array<any>>([])
  const { setWorkers: setStoreWorkers, setProducts: setStoreProducts, products, updateProductStatus } = useStore()
  const [loading, setLoading] = useState(false)
  const [selectedWorkerForProducts, setSelectedWorkerForProducts] = useState<any | null>(null)
  const [isProductsDialogOpen, setIsProductsDialogOpen] = useState(false)

  const [newWorker, setNewWorker] = useState({
    name: "",
    phone: "",
    commission: 0,
  })

  const [profileFile, setProfileFile] = useState<File | null>(null)
  const [certificateFile, setCertificateFile] = useState<File | null>(null)

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingWorker, setEditingWorker] = useState<any | null>(null)
  const [editProfileFile, setEditProfileFile] = useState<File | null>(null)
  const [editCertificateFile, setEditCertificateFile] = useState<File | null>(null)

  const normalizeStatus = (status: string): ProductStatus => {
    if (status === "in stock") return "in_stock"
    if (status === "in_stock" || status === "delivery" || status === "delivered" || status === "canceled") {
      return status as ProductStatus
    }
    return "in_stock"
  }

  const statusLabel = (status: string) => {
    const normalized = normalizeStatus(status)
    if (normalized === "in_stock") return t("stock.status.inStock")
    if (normalized === "delivery") return t("stock.status.delivery")
    if (normalized === "delivered") return t("stock.status.delivered")
    if (normalized === "canceled") return t("stock.status.canceled")
    return normalized
  }

  const handleMarkStatus = async (productId: string, status: ProductStatus) => {
    updateProductStatus(productId, status)
    
    const updateData: Record<string, any> = { status }
    
    // If marking as delivered, save the delivery timestamp
    if (status === "delivered") {
      updateData.delivered_at = new Date().toISOString()
    }
    
    await supabase.from("products").update(updateData).eq("id", productId)
    
    if (status === "delivered") {
      toast({
        title: t("workers.toastDeliveredTitle"),
        description: t("workers.toastDeliveredDesc"),
      })
    }
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [{ data, error }, { data: productsData }, { data: companiesData }] = await Promise.all([
        supabase
          .from("delivery_workers")
          .select("id, name, phone, profile_image_url, certificate_image_url, product_fee, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("products")
          .select("id, client_name, phone, price, status, company_id, delivery_worker_id"),
        supabase.from("companies").select("id, name"),
      ])
      if (!error && data) {
        setWorkers(data)
        setStoreWorkers(
          data.map((w) => ({
            id: String(w.id),
            name: w.name,
            phone: w.phone,
            profilePic: w.profile_image_url || "",
            certificates: w.certificate_image_url || "",
            commission: Number(w.product_fee || 0),
          })),
        )
      }

      if (productsData) {
        const nameById = new Map<string, string>()
        companiesData?.forEach((c) => nameById.set(String(c.id), c.name))

        setStoreProducts(
          productsData.map((prod) => ({
            id: String(prod.id),
            clientName: prod.client_name,
            companyName: prod.company_id ? nameById.get(String(prod.company_id)) || String(prod.company_id) : "-",
            phone: prod.phone,
            price: Number(prod.price || 0),
            status: (prod.status as ProductStatus) || "in_stock",
            workerId: prod.delivery_worker_id ? String(prod.delivery_worker_id) : undefined,
          })),
        )
      }
      setLoading(false)
    }
    load()
  }, [])

  const uploadFile = async (file: File, folder: string) => {
    const bucket = process.env.NEXT_PUBLIC_SUPABASE_WORKERS_BUCKET || "workers"
    if (!bucket) {
      throw new Error(t("workers.bucketMissing"))
    }
    const path = `${folder}/${crypto.randomUUID()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    })
    if (uploadError) throw uploadError

    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    if (!data?.publicUrl) {
      throw new Error(t("workers.publicUrlMissing"))
    }
    return data.publicUrl
  }

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const [profileUrl, certificateUrl] = await Promise.all([
        profileFile ? uploadFile(profileFile, "profiles") : Promise.resolve(null),
        certificateFile ? uploadFile(certificateFile, "certificates") : Promise.resolve(null),
      ])

      const { data, error } = await supabase
        .from("delivery_workers")
        .insert({
          name: newWorker.name,
          phone: newWorker.phone,
          product_fee: newWorker.commission,
          profile_image_url: profileUrl || null,
          certificate_image_url: certificateUrl || null,
        })
        .select()
        .single()

      if (error) throw error

      if (data) {
        setWorkers((prev) => [data, ...prev])
        setIsAddOpen(false)
        setNewWorker({ name: "", phone: "", commission: 0 })
        setProfileFile(null)
        setCertificateFile(null)
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: t("workers.toastUploadFailedTitle"),
        description: err?.message || err?.error || t("workers.toastUploadFailedDesc"),
      })
    }
  }

  const openEdit = (worker: any) => {
    setEditingWorker(worker)
    setEditProfileFile(null)
    setEditCertificateFile(null)
    setIsEditOpen(true)
  }

  const handleUpdateWorker = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingWorker) return
    try {
      const [profileUrl, certificateUrl] = await Promise.all([
        editProfileFile ? uploadFile(editProfileFile, "profiles") : Promise.resolve(editingWorker.profile_image_url || null),
        editCertificateFile
          ? uploadFile(editCertificateFile, "certificates")
          : Promise.resolve(editingWorker.certificate_image_url || null),
      ])

      const { data, error } = await supabase
        .from("delivery_workers")
        .update({
          name: editingWorker.name,
          phone: editingWorker.phone,
          product_fee: editingWorker.product_fee,
          profile_image_url: profileUrl,
          certificate_image_url: certificateUrl,
        })
        .eq("id", editingWorker.id)
        .select()
        .single()

      if (error) throw error

      if (data) {
        setWorkers((prev) => prev.map((w) => (w.id === data.id ? data : w)))
        setIsEditOpen(false)
        setEditingWorker(null)
        setEditProfileFile(null)
        setEditCertificateFile(null)
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: t("workers.toastUpdateFailedTitle"),
        description: err?.message || err?.error || t("workers.toastUpdateFailedDesc"),
      })
    }
  }

  const handleDeleteWorker = async (id: number) => {
    const { error } = await supabase.from("delivery_workers").delete().eq("id", id)
    if (!error) {
      setWorkers((prev) => prev.filter((w) => w.id !== id))
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("workers.title")}</h1>
            <p className="text-muted-foreground">{t("workers.subtitle")}</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> {t("workers.add")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("workers.dialogTitle")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddWorker} className="space-y-4 pt-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">{t("workers.name")}</Label>
                  <Input
                    id="name"
                    required
                    value={newWorker.name}
                    onChange={(e) => setNewWorker({ ...newWorker, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">{t("workers.phone")}</Label>
                  <Input
                    id="phone"
                    required
                    value={newWorker.phone}
                    onChange={(e) => setNewWorker({ ...newWorker, phone: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="commission">{t("workers.commission")}</Label>
                  <Input
                    id="commission"
                    type="number"
                    step="0.01"
                    required
                    value={newWorker.commission}
                    onChange={(e) => setNewWorker({ ...newWorker, commission: Number.parseFloat(e.target.value) })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <label className="cursor-pointer border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center text-xs text-muted-foreground">
                    <Plus className="h-4 w-4 mb-1" />
                    {profileFile ? profileFile.name : t("workers.profilePic")}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setProfileFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <label className="cursor-pointer border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center text-xs text-muted-foreground">
                    <FileCheck className="h-4 w-4 mb-1" />
                    {certificateFile ? certificateFile.name : t("workers.certificates")}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => setCertificateFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
                <Button type="submit" className="w-full mt-4">
                  {t("workers.submit")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workers.map((worker) => (
            <Card key={worker.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-linear-to-r from-rehab-gradient-start to-rehab-gradient-end h-20" />
                <div className="px-6 pb-6 text-center">
                  <div className="-mt-10 mb-4 flex justify-center">
                    <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                      <AvatarImage src={worker.profile_image_url || "/placeholder.svg"} />
                      <AvatarFallback>{worker.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </div>
                  <h3 className="font-bold text-lg">{worker.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("workers.idLabel")}: {worker.id}
                  </p>

                  <div className="space-y-2 text-sm text-left">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3 text-primary" />
                      <span>{worker.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-3 w-3 text-primary" />
                      <span>
                        {worker.product_fee} {t("common.currency")} {t("workers.perDelivery")}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-6">
                    <Button variant="outline" size="sm" className="w-full bg-transparent" onClick={() => openEdit(worker)}>
                      {t("workers.edit")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => handleDeleteWorker(worker.id)}
                    >
                      {t("workers.delete")}
                    </Button>
                  </div>

                  <div className="mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => {
                        setSelectedWorkerForProducts(worker)
                        setIsProductsDialogOpen(true)
                      }}
                    >
                      <Package className="h-4 w-4" />
                      {t("workers.assignedProducts")} ({products.filter((p) => p.workerId === String(worker.id)).length})
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {workers.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
              {t("workers.empty")}
            </div>
          )}
        </div>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("workers.editTitle")}</DialogTitle>
          </DialogHeader>
          {editingWorker && (
            <form onSubmit={handleUpdateWorker} className="space-y-4 pt-2">
              <div className="grid gap-2">
                <Label>{t("workers.name")}</Label>
                <Input
                  value={editingWorker.name}
                  onChange={(e) => setEditingWorker({ ...editingWorker, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("workers.phone")}</Label>
                <Input
                  value={editingWorker.phone}
                  onChange={(e) => setEditingWorker({ ...editingWorker, phone: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("workers.commission")}</Label>
                <Input
                  type="number"
                  value={editingWorker.product_fee}
                  onChange={(e) => setEditingWorker({ ...editingWorker, product_fee: Number.parseFloat(e.target.value) })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="cursor-pointer border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center text-xs text-muted-foreground">
                  <Plus className="h-4 w-4 mb-1" />
                  {editProfileFile ? editProfileFile.name : t("workers.profilePic")}
                  {editingWorker.profile_image_url && !editProfileFile && (
                    <span className="text-[11px] text-muted-foreground mt-1">{t("workers.currentSet")}</span>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setEditProfileFile(e.target.files?.[0] || null)}
                  />
                </label>
                <label className="cursor-pointer border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center text-xs text-muted-foreground">
                  <FileCheck className="h-4 w-4 mb-1" />
                  {editCertificateFile ? editCertificateFile.name : t("workers.certificates")}
                  {editingWorker.certificate_image_url && !editCertificateFile && (
                    <a
                      className="text-[11px] text-primary underline mt-1"
                      href={editingWorker.certificate_image_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("workers.viewCurrent")}
                    </a>
                  )}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => setEditCertificateFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>

              <Button type="submit" className="w-full mt-2">
                {t("common.save")}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Assigned Products Dialog */}
      <Dialog open={isProductsDialogOpen} onOpenChange={setIsProductsDialogOpen}>
        <DialogContent className="sm:max-w-5xl w-full max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t("workers.assignedProductsTitle", { name: selectedWorkerForProducts?.name || "" })}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("stock.table.id")}</TableHead>
                    <TableHead>{t("stock.table.client")}</TableHead>
                    <TableHead>{t("stock.table.company")}</TableHead>
                    <TableHead>{t("stock.table.price")}</TableHead>
                    <TableHead>{t("stock.table.status")}</TableHead>
                    <TableHead className="text-right">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedWorkerForProducts && products.filter((p) => p.workerId === String(selectedWorkerForProducts.id)).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.id}</TableCell>
                      <TableCell>{p.clientName}</TableCell>
                      <TableCell>{p.companyName}</TableCell>
                      <TableCell>{p.price} {t("common.currency")}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            normalizeStatus(p.status) === "delivered"
                              ? "secondary"
                              : normalizeStatus(p.status) === "canceled"
                                ? "destructive"
                                : "outline"
                          }
                          className="capitalize"
                        >
                          {statusLabel(p.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {normalizeStatus(p.status) === "delivered" ? (
                          <div className="flex justify-end gap-2">
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              ✓ {t("stock.status.delivered")}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkStatus(p.id, "delivery")}
                            >
                              {t("workers.backToDelivery")}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleMarkStatus(p.id, "delivered")}
                            >
                              {t("stock.status.delivered")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => handleMarkStatus(p.id, "canceled")}
                            >
                              {t("common.cancel")}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {selectedWorkerForProducts && products.filter((p) => p.workerId === String(selectedWorkerForProducts.id)).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-8">
                        {t("workers.noAssignedProducts")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
